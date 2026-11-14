---
title: A Resilient API Client
summary: Retries with exponential backoff and jitter, timeouts, cancellation with AbortController, request de-duplication, caching with TTL, and "latest wins" protection against out-of-order responses.
minutes: 25
---

## What "resilient" means on the frontend

A senior question that shows up everywhere (Walmart, Housing.com, "design an API client with retries, caching and cancellation") boils down to one idea: **the network is unreliable and responses arrive in any order**. A resilient client handles five failure modes:

| Failure | Symptom | Fix |
|---|---|---|
| Transient errors | 503, network blip, 429 | **Retry** with exponential backoff + jitter |
| Hanging requests | Spinner forever | **Timeout** (abort after N ms) |
| Work nobody needs anymore | User navigated away, typed more | **Cancellation** via `AbortController` |
| Duplicate work | 5 components request `/me` on mount | **De-duplication** of in-flight requests |
| Stale or out-of-order data | Older response overwrites newer | **Latest-wins** guards, sequence numbers, caching with TTL |

We'll build each piece as a small composable function, then wire them together.

## 1. Retry with exponential backoff and jitter

```js
async function retry(fn, { retries = 3, baseDelay = 200, maxDelay = 5000, shouldRetry = () => true } = {}) {
  let attempt = 0
  while (true) {
    try {
      return await fn(attempt)
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err
      const exp = Math.min(maxDelay, baseDelay * 2 ** attempt)
      const delay = Math.random() * exp           // "full jitter"
      await new Promise((r) => setTimeout(r, delay))
      attempt++
    }
  }
}
```

Why each piece:

- **Exponential** (200ms, 400ms, 800ms…) gives a struggling server time to recover instead of hammering it.
- **Jitter** (randomising the delay) prevents the *thundering herd*: if 10,000 clients fail at the same second and all retry at exactly +200ms, they create a synchronized spike that knocks the server down again.
- **`shouldRetry`** — only retry what can succeed later: network errors, 408, 429, 5xx. **Never** retry 400/401/403/404/422; they'll fail the same way.
- **Idempotency** — only auto-retry requests that are safe to repeat: GET, PUT, DELETE. Retrying a `POST /payments` could charge twice unless the server supports an **idempotency key** header.
- Respect **`Retry-After`** on 429/503 if the server sends it.

```text
attempt:   0        1          2              3
           ✗ ─200ms─ ✗ ──400ms── ✗ ────800ms──── ✓
                 (each delay randomised in [0, cap])
```

## 2. Timeouts

`fetch` has no timeout by default — a request can hang for minutes. Two options:

```js
// Modern: built-in signal
fetch(url, { signal: AbortSignal.timeout(8000) })

// Combine a user cancel signal with a timeout
const signal = AbortSignal.any([userController.signal, AbortSignal.timeout(8000)])
```

A generic promise timeout (works for any promise, but **does not** stop the underlying work):

```js
function withTimeout(promise, ms) {
  let id
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error('Timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id))
}
```

Note the `clearTimeout` in `finally` — without it, every call leaves a timer alive until it fires.

## 3. Cancellation with AbortController

```js
const controller = new AbortController()
fetch('/api/search?q=re', { signal: controller.signal })
  .then((r) => r.json())
  .catch((err) => {
    if (err.name === 'AbortError') return // expected, not a real error
    throw err
  })

controller.abort() // network request is actually cancelled
```

In React, abort in the effect cleanup:

```jsx
useEffect(() => {
  const controller = new AbortController()
  fetch(`/api/users/${id}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((e) => { if (e.name !== 'AbortError') setError(e) })
  return () => controller.abort()
}, [id])
```

This fixes two bugs at once: "set state on an unmounted component" and "old response overwrites new one when `id` changes quickly". With axios, pass the same `signal` (the old `CancelToken` is deprecated).

## 4. De-duplicating in-flight requests

If a header, sidebar and page all call `getCurrentUser()` on mount, you want **one** network request. Store the in-flight promise by key:

```js
const inflight = new Map()

function dedupe(key, fn) {
  if (inflight.has(key)) return inflight.get(key)
  const p = fn().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}
```

Every caller gets the same promise; once it settles, the entry is removed so the next call refetches. This is exactly what React Query / SWR do under the hood (keyed by query key).

## 5. Caching with TTL (and stale-while-revalidate)

```js
function createCachedFetcher(fetcher, ttl) {
  const cache = new Map() // key -> { value, expires }
  const inflight = new Map()

  return function get(key) {
    const hit = cache.get(key)
    if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value)
    if (inflight.has(key)) return inflight.get(key)

    const p = fetcher(key)
      .then((value) => {
        cache.set(key, { value, expires: Date.now() + ttl })
        return value
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, p)
    return p
  }
}
```

Design points interviewers probe:

- **Don't cache errors** (or cache them very briefly) — otherwise one blip poisons the cache.
- **Bound the cache** (LRU) so a long-lived SPA doesn't grow memory forever.
- **Invalidate on mutation**: after `PUT /todos/5`, drop or update `todos` keys.
- **Stale-while-revalidate**: return stale data instantly, refetch in the background, update UI when fresh data lands. Great perceived performance.

:::visual cache-layers
:::

## 6. Out-of-order responses: latest wins

The classic search bug (from the reference list): the user types "React", then "Redux". The "Redux" response arrives first, then the slower "React" response arrives and **overwrites** the correct results.

```text
type "React"  ──────request A──────────────────────▶ response A (slow) ✗ overwrites!
type "Redux"        ──request B──▶ response B (fast) ✓
```

Three fixes, from simplest to most robust:

1. **Abort the previous request** when a new one starts (also saves bandwidth).
2. **Ignore stale responses** with a request id / sequence number:

```js
function latest(asyncFn) {
  let lastId = 0
  return async function (...args) {
    const id = ++lastId
    const result = await asyncFn.apply(this, args)
    if (id !== lastId) throw Object.assign(new Error('Stale response'), { name: 'StaleError' })
    return result
  }
}
```

3. In React, an `ignore` flag in the effect cleanup:

```jsx
useEffect(() => {
  let ignore = false
  search(query).then((r) => { if (!ignore) setResults(r) })
  return () => { ignore = true }
}, [query])
```

### Out-of-order *mutations*

A user toggles a setting rapidly: `PATCH {dark:true}`, `PATCH {dark:false}`. If the first one is processed last, the server ends up with `dark:true` while the UI shows `false`. Fixes:

- **Serialise** writes for the same resource (a per-key queue: only one PATCH in flight; coalesce the rest into the latest value).
- Send a **version / timestamp** and let the server reject older writes (optimistic concurrency, `If-Match` with ETags).
- **Debounce** rapid toggles and send only the final state.
- After the final response, **reconcile** UI with the server's returned state.

## 7. Putting it together

```js
function createApiClient({ baseURL, getToken, onUnauthorized }) {
  const inflight = new Map()

  async function request(path, { method = 'GET', body, signal, retries = 2, timeout = 8000 } = {}) {
    const isIdempotent = method === 'GET' || method === 'PUT' || method === 'DELETE'
    const key = method === 'GET' ? path : null

    const run = () =>
      retry(
        async () => {
          const res = await fetch(baseURL + path, {
            method,
            body: body && JSON.stringify(body),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(timeout)]),
          })
          if (res.status === 401) { onUnauthorized(); throw httpError(res) }
          if (!res.ok) throw httpError(res)
          return res.status === 204 ? null : res.json()
        },
        {
          retries: isIdempotent ? retries : 0,
          shouldRetry: (e) => e.name !== 'AbortError' && (e.status === undefined || e.status === 429 || e.status >= 500),
        },
      )

    if (!key) return run()
    if (inflight.has(key)) return inflight.get(key)
    const p = run().finally(() => inflight.delete(key))
    inflight.set(key, p)
    return p
  }

  const httpError = (res) => Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
  return { get: (p, o) => request(p, o), post: (p, body, o) => request(p, { ...o, method: 'POST', body }) }
}
```

### Token refresh without a stampede

When the access token expires, 10 parallel requests all get 401. You want **one** refresh call and then replay all 10:

```js
let refreshing = null
async function getFreshToken() {
  refreshing ??= refreshToken().finally(() => { refreshing = null })
  return refreshing
}
// on 401: await getFreshToken(); retry the original request once
```

Same de-dupe trick — share the in-flight promise.

:::visual auth-flow
:::

:::callout interview Senior signal
Mention idempotency before retrying writes, jitter, not caching errors, bounding caches, and that `Promise.race` timeouts don't cancel the underlying work — only `AbortController` does. Then say you'd reach for React Query/SWR in production and explain *what* they're doing for you.
:::

## Interview questions

:::question
difficulty: medium
companies: Walmart
### How would you design client-side caching, API retries and error boundaries gracefully?
Layer it:

1. **Transport layer (API client):** timeouts via `AbortSignal.timeout`, retries with exponential backoff + jitter only for idempotent requests and retryable statuses (network, 429, 5xx), honour `Retry-After`, de-dupe in-flight GETs, a single shared token refresh on 401.
2. **Cache layer (React Query/SWR or custom):** keyed cache with `staleTime`/TTL, stale-while-revalidate, invalidation after mutations, optimistic updates with rollback, bounded size.
3. **UI layer:** each data region renders loading / error / empty / success states. Errors from data fetching are shown inline with a Retry button. Unexpected render errors are caught by **error boundaries** placed per route and per widget, so one broken widget doesn't blank the whole page. Report errors to Sentry with context.
4. **Observability:** log retry counts, error rates, latency to spot flaky endpoints.

Note: error boundaries catch errors thrown *during rendering*, not in event handlers or async code — so fetch errors must be turned into state (or thrown during render via Suspense-style libraries) to reach a boundary.
:::

:::question
difficulty: medium
companies: Groww, Razorpay
### How do you cancel a previous API request?
Create an `AbortController` per request and pass `controller.signal` to `fetch` (or axios). When a new request supersedes the old one — user types again, component unmounts, route changes — call `controller.abort()`. The browser cancels the network request and the promise rejects with an `AbortError`, which you ignore. In React put `controller.abort()` in the `useEffect` cleanup. In a search box, keep the controller in a `useRef` so each keystroke aborts the previous request.
:::

:::question
difficulty: hard
### Does `Promise.race([fetch(url), timeout(5000)])` cancel the fetch?
No. `race` just stops *listening*; the fetch keeps running, consumes bandwidth, and its result is discarded. To actually cancel, pass an `AbortSignal` (`AbortSignal.timeout(5000)`) to `fetch`. Same for any async work: cancellation must be cooperative — the work itself has to check a signal.
:::

:::question
difficulty: hard
companies: Coinbase
### A user rapidly changes a setting and two PATCH requests race. How do you keep UI and server consistent?
Options (often combined):

- **Coalesce/serialise** per resource: keep at most one write in flight; while it's in flight, remember only the latest desired value and send it after.
- **Debounce** UI-driven writes (send the final state after 300ms of quiet).
- **Versioning:** send `If-Match: <etag>` or a client sequence number; the server rejects stale writes with 412/409.
- **Optimistic UI with reconciliation:** update UI immediately, and when the *latest* request resolves, set state from the server response; ignore responses from older requests (sequence id).
:::

## Challenges

:::challenge
difficulty: medium
companies: Meta, Tekion
### Implement retry(fn, retries, delay) — auto-retry a promise on rejection
`fn` returns a promise. Call it; if it rejects, wait `delay` ms and try again, up to `retries` additional attempts. Resolve with the first success; if every attempt fails, reject with the **last** error. `fn` receives the attempt number (0-based).
@@@starter
```js
function retry(fn, retries, delay = 0) {
  // your code
}
```
@@@tests
```js
test('succeeds after failures', async () => {
  let calls = 0
  const v = await retry(() => (++calls < 3 ? Promise.reject(new Error('e' + calls)) : Promise.resolve('ok')), 3, 5)
  expect(v).toBe('ok')
  expect(calls).toBe(3)
})

test('rejects with last error after retries are used up', async () => {
  let calls = 0
  let err
  try { await retry(() => Promise.reject(new Error('fail ' + ++calls)), 2, 1) } catch (e) { err = e }
  expect(calls).toBe(3)
  expect(err.message).toBe('fail 3')
})

test('passes attempt number', async () => {
  const seen = []
  await retry((n) => { seen.push(n); return n < 2 ? Promise.reject(1) : Promise.resolve() }, 5)
  expect(seen).toEqual([0, 1, 2])
})

test('waits between attempts', async () => {
  const start = Date.now()
  let calls = 0
  await retry(() => (++calls < 3 ? Promise.reject(0) : Promise.resolve()), 3, 30)
  expect(Date.now() - start).toBeGreaterThan(50)
})
```
@@@solution
```js
async function retry(fn, retries, delay = 0) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastError = err
      if (attempt < retries && delay > 0) {
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}
```

`retries` counts *extra* attempts, so the loop runs `retries + 1` times. We don't sleep after the final failure.

**Upgrade path (say this out loud):** exponential backoff `delay * 2 ** attempt`, full jitter `Math.random() * cap`, a `shouldRetry(err)` predicate so 4xx errors fail immediately, an `AbortSignal` to stop retrying when the user leaves, and only retrying idempotent requests.

Non-async version for interviewers who ask:

```js
function retryCb(fn, retries, delay = 0, attempt = 0) {
  return fn(attempt).catch((err) => {
    if (attempt >= retries) throw err
    return new Promise((r) => setTimeout(r, delay)).then(() => retryCb(fn, retries, delay, attempt + 1))
  })
}
```
:::

:::challenge
difficulty: medium
### Implement createCachedFetcher(fetcher, ttl) with de-duplication
Return `get(key)`:

- If a cached value for `key` is younger than `ttl` ms, resolve with it without calling `fetcher`.
- If a request for `key` is already in flight, return the **same** promise (no duplicate calls).
- Otherwise call `fetcher(key)`, cache its value with an expiry, and resolve.
- Errors must **not** be cached: the next `get` after a failure calls `fetcher` again.
@@@starter
```js
function createCachedFetcher(fetcher, ttl) {
  return function get(key) {
    // your code
  }
}
```
@@@tests
```js
test('dedupes concurrent calls', async () => {
  let calls = 0
  const get = createCachedFetcher(async (k) => { calls++; await sleep(10); return k + '!' }, 1000)
  const [a, b, c] = await Promise.all([get('x'), get('x'), get('x')])
  expect([a, b, c]).toEqual(['x!', 'x!', 'x!'])
  expect(calls).toBe(1)
})

test('serves from cache within ttl, refetches after', async () => {
  let calls = 0
  const get = createCachedFetcher(async (k) => { calls++; return calls }, 30)
  expect(await get('a')).toBe(1)
  expect(await get('a')).toBe(1)
  await sleep(45)
  expect(await get('a')).toBe(2)
})

test('does not cache errors', async () => {
  let calls = 0
  const get = createCachedFetcher(async () => { calls++; if (calls === 1) throw new Error('blip'); return 'ok' }, 1000)
  let err
  try { await get('k') } catch (e) { err = e.message }
  expect(err).toBe('blip')
  expect(await get('k')).toBe('ok')
  expect(calls).toBe(2)
})

test('different keys are independent', async () => {
  const get = createCachedFetcher(async (k) => k * 2, 1000)
  expect(await Promise.all([get(1), get(2)])).toEqual([2, 4])
})
```
@@@solution
```js
function createCachedFetcher(fetcher, ttl) {
  const cache = new Map()    // key -> { value, expires }
  const inflight = new Map() // key -> promise

  return function get(key) {
    const hit = cache.get(key)
    if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value)
    if (inflight.has(key)) return inflight.get(key)

    const p = Promise.resolve()
      .then(() => fetcher(key))
      .then((value) => {
        cache.set(key, { value, expires: Date.now() + ttl })
        return value
      })
      .finally(() => inflight.delete(key))

    inflight.set(key, p)
    return p
  }
}
```

- Cache check first, then in-flight check, then fetch.
- Only the success path writes to `cache`; on failure the `finally` still clears `inflight`, so the next call retries.
- `Promise.resolve().then(() => fetcher(key))` turns synchronous throws into rejections.

**Production additions:** LRU eviction (Map preserves insertion order — delete + re-set on hit, evict `map.keys().next().value`), stale-while-revalidate (return stale value and refresh in background), manual `invalidate(key)`, and keying by serialised params.
:::

:::challenge
difficulty: medium
companies: CRED, Coinbase
### Implement latest(asyncFn) — ignore out-of-order responses
Return a wrapped function. When called several times, only the promise from the **most recent** call should resolve with its result. Promises from earlier calls must reject with an error whose `name` is `'StaleError'` — even if their underlying request finishes later.
@@@starter
```js
function latest(asyncFn) {
  // your code
}
```
@@@tests
```js
test('slow old response does not win', async () => {
  const search = latest((q, ms) => new Promise((r) => setTimeout(() => r('results for ' + q), ms)))
  const p1 = search('React', 40)
  const p2 = search('Redux', 10)
  let err1
  p1.catch((e) => { err1 = e })
  expect(await p2).toBe('results for Redux')
  await sleep(60)
  expect(err1.name).toBe('StaleError')
})

test('single call resolves normally', async () => {
  const f = latest(async (x) => x + 1)
  expect(await f(1)).toBe(2)
})

test('an older call that finishes first is still stale', async () => {
  const f = latest((v, ms) => new Promise((r) => setTimeout(() => r(v), ms)))
  const a = f('a', 5)
  const b = f('b', 20)
  let errA
  try { await a } catch (e) { errA = e }
  expect(errA.name).toBe('StaleError')
  expect(await b).toBe('b')
})
```
@@@solution
```js
function latest(asyncFn) {
  let lastId = 0
  return async function (...args) {
    const id = ++lastId
    const result = await asyncFn.apply(this, args)
    if (id !== lastId) {
      const err = new Error('Stale response ignored')
      err.name = 'StaleError'
      throw err
    }
    return result
  }
}
```

Each call captures its own `id` in a closure. When the result arrives, we compare against the shared `lastId`; if a newer call happened meanwhile, this result is stale. This is the generic version of React's `let ignore = false` cleanup pattern.

Improvement: also **abort** the previous call. Keep the previous `AbortController` in the closure, abort it on each new call and pass the new signal as an extra argument — that saves bandwidth as well as correctness.
:::

## Quick check

:::quiz
### Which request is generally safe to retry automatically?
- [x] `GET /products?page=2`
- [ ] `POST /payments` without an idempotency key
- [ ] `POST /orders`
- [ ] `POST /messages`
@@@explain
GET (and PUT/DELETE) are idempotent — repeating them has the same effect. A non-idempotent POST could create duplicates unless the server supports idempotency keys.
:::

:::quiz
### Why add jitter to exponential backoff?
- [ ] To make retries faster
- [x] To spread retries out so many clients don't retry in sync and spike the server
- [ ] Because `setTimeout` is inaccurate anyway
- [ ] To bypass rate limits
@@@explain
Without jitter, clients that failed together retry together (thundering herd). Randomising spreads the load.
:::

:::quiz
### Five components call `getUser()` at mount. What prevents five network calls?
- [ ] Debouncing
- [ ] Error boundary
- [x] Sharing the in-flight promise by key (de-duplication)
- [ ] `Promise.race`
@@@explain
Store the pending promise in a Map keyed by request; later callers get the same promise.
:::
