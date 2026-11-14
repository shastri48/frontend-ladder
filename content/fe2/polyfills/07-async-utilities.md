---
title: Async Utilities — retry, backoff, setInterval & storage with expiry
summary: Production-flavoured helpers interviewers ask for — retrying failed promises with exponential backoff, a setInterval polyfill built on setTimeout, and a localStorage wrapper with TTL and graceful fallback.
minutes: 18
---

## Networks fail. Plan for it.

Real users are on flaky mobile networks, servers return 503 during deploys, and rate limiters return 429. A resilient frontend **retries transient failures** — carefully:

- Retry only **idempotent** or explicitly safe operations (GET, PUT with the same body, or POST with an *idempotency key*). Retrying a non-idempotent payment POST can charge twice.
- Retry only **transient** errors: network errors, timeouts, 408/429/5xx. Never retry 400/401/403/404 — they won't fix themselves.
- **Back off**: wait longer between attempts (exponential backoff) so you don't hammer a struggling server.
- Add **jitter** (randomness) so thousands of clients don't retry in sync (the "thundering herd").
- **Cap** attempts and total time, and respect `Retry-After` headers.
- Make retries **cancellable** (AbortSignal) — the user may navigate away.

```text
attempt 1 ──✗ wait 200ms ── attempt 2 ──✗ wait 400ms ── attempt 3 ──✗ wait 800ms ── attempt 4 ──✓
              (base)                       (base*2)                    (base*4)
```

Libraries like React Query/TanStack Query (`retry: 3`, `retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000)`), axios-retry and Workbox implement exactly this. Interviewers want to see you can build it and know these rules.

## setInterval vs recursive setTimeout

`setInterval(fn, 1000)` schedules every 1000ms **regardless of how long `fn` takes**. If `fn` is async (say a fetch that takes 1.5s), calls overlap and pile up. A **recursive `setTimeout`** schedules the next run only after the current one finishes, guaranteeing a gap:

```js
async function poll() {
  await fetchStatus()
  timer = setTimeout(poll, 1000) // next run 1s AFTER this one completes
}
```

Implementing `setInterval` with `setTimeout` is a common polyfill question ("Create a setInterval polyfill").

## Browser storage with expiry

`localStorage` has no expiry and only stores **strings**. A wrapper adds:

- JSON serialisation
- **TTL**: store `{ value, expiresAt }`, check on read, delete if expired (lazy expiry)
- **Fallback**: `localStorage` can throw — Safari private mode (historically), storage disabled by policy, sandboxed iframes (`SecurityError`), or `QuotaExceededError` when full (~5MB per origin). Fall back to an in-memory `Map` so the app keeps working.
- Namespacing keys (`app:v1:user`) and versioning so a schema change doesn't break old data.

Housing.com asked about "caching strategies (localStorage, sessionStorage, in-memory with expiry)" — this is that.

## Interview questions

:::question
difficulty: medium
companies: Accenture, Walmart
### How do you handle API errors and retries efficiently?
Centralise it in an API client/interceptor or a data library. Classify errors: retry only transient ones (network failure, timeout, 408, 429, 5xx) and only idempotent requests (or POSTs with idempotency keys). Use exponential backoff with jitter and a max attempt count; honour `Retry-After`. Make requests cancellable with `AbortController` and stop retrying when the component unmounts. Surface meaningful UI states (inline error with a Retry button, toasts, error boundaries for render failures), log to monitoring (Sentry), and avoid retry storms by deduplicating identical in-flight requests. React Query gives retries, caching, dedupe and stale-while-revalidate out of the box.
:::

:::question
difficulty: easy
### Why prefer recursive setTimeout over setInterval for polling?
`setInterval` fires on a fixed schedule even if the previous callback (e.g. an async fetch) hasn't finished, so requests can overlap or queue up; errors don't stop it. Recursive `setTimeout` waits for completion before scheduling the next run, guarantees spacing, and makes it easy to back off on errors, adjust the delay dynamically, and stop cleanly.
:::

## Challenges

:::challenge
difficulty: medium
### Implement retry(fetchData, retries)
`retry(fn, retries)` calls `fn()` (which returns a promise). If it rejects, try again — up to `retries` additional attempts. Resolve with the first success, or reject with the **last** error if all attempts fail.
@@@starter
```js
function retry(fn, retries) {
  // your code
}
```
@@@tests
```js
test('resolves after transient failures', async () => {
  let attempts = 0
  const flaky = () => (++attempts < 3 ? Promise.reject(new Error('fail ' + attempts)) : Promise.resolve('ok'))
  expect(await retry(flaky, 3)).toBe('ok')
  expect(attempts).toBe(3)
})
test('rejects with the last error after exhausting retries', async () => {
  let attempts = 0
  const alwaysFails = () => Promise.reject(new Error('fail ' + ++attempts))
  let err
  try { await retry(alwaysFails, 2) } catch (e) { err = e }
  expect(err.message).toBe('fail 3')
  expect(attempts).toBe(3)
})
test('no retries needed', async () => {
  let attempts = 0
  expect(await retry(() => { attempts++; return Promise.resolve(1) }, 5)).toBe(1)
  expect(attempts).toBe(1)
})
```
@@@solution
Async/await loop:
```js
async function retry(fn, retries) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
```
Recursive promise version (often expected):
```js
function retryRecursive(fn, retries) {
  return fn().catch((err) => (retries > 0 ? retryRecursive(fn, retries - 1) : Promise.reject(err)))
}
```
Total attempts = `retries + 1`. Note the `return await` inside `try` — without `await`, the rejection would escape the `try/catch`.
:::

:::challenge
difficulty: hard
### Auto-retry with exponential backoff
Implement `retryWithBackoff(fn, { retries = 3, baseDelay = 100, factor = 2, shouldRetry = () => true })`. Attempt `n` (0-based) that fails waits `baseDelay * factor ** n` ms before the next attempt. If `shouldRetry(error)` returns false, reject immediately. `fn` receives the attempt number.
@@@starter
```js
function retryWithBackoff(fn, options = {}) {
  // your code
}
```
@@@tests
```js
test('waits with growing delays', async () => {
  const times = []
  const start = Date.now()
  const fn = (attempt) => {
    times.push(Date.now() - start)
    return attempt < 2 ? Promise.reject(new Error('x')) : Promise.resolve('done')
  }
  expect(await retryWithBackoff(fn, { retries: 3, baseDelay: 20, factor: 2 })).toBe('done')
  expect(times.length).toBe(3)
  expect(times[1]).toBeGreaterThan(15)          // ~20ms
  expect(times[2] - times[1]).toBeGreaterThan(30) // ~40ms
})
test('stops when shouldRetry is false', async () => {
  let calls = 0
  const fn = () => { calls++; return Promise.reject({ status: 404 }) }
  let err
  try {
    await retryWithBackoff(fn, { retries: 5, baseDelay: 5, shouldRetry: (e) => e.status >= 500 })
  } catch (e) { err = e }
  expect(calls).toBe(1)
  expect(err.status).toBe(404)
})
test('gives up after retries', async () => {
  let calls = 0
  let err
  try {
    await retryWithBackoff(() => { calls++; return Promise.reject(new Error('down')) }, { retries: 2, baseDelay: 5 })
  } catch (e) { err = e }
  expect(calls).toBe(3)
  expect(err.message).toBe('down')
})
```
@@@solution
```js
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function retryWithBackoff(fn, options = {}) {
  const { retries = 3, baseDelay = 100, factor = 2, shouldRetry = () => true } = options

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      const canRetry = attempt < retries && shouldRetry(err)
      if (!canRetry) throw err
      await wait(baseDelay * factor ** attempt)
    }
  }
}
```
**Production extras:** jitter (`delay * (0.5 + Math.random())` or "full jitter" `Math.random() * delay`), a `maxDelay` cap, honouring `Retry-After`, and an `AbortSignal` that clears the wait and rejects with `AbortError`.
:::

:::challenge
difficulty: medium
companies: Meta
### setInterval polyfill using setTimeout
Implement `mySetInterval(fn, delay, ...args)` returning an id, and `myClearInterval(id)`. Use only `setTimeout`/`clearTimeout`. Clearing must stop future calls, even when called from inside `fn`.
@@@starter
```js
function mySetInterval(fn, delay, ...args) {
  // your code
}
function myClearInterval(id) {
  // your code
}
```
@@@tests
```js
test('calls repeatedly until cleared', async () => {
  let n = 0
  const id = mySetInterval(() => n++, 20)
  await sleep(110)
  myClearInterval(id)
  const snapshot = n
  expect(snapshot >= 3).toBe(true)
  await sleep(60)
  expect(n).toBe(snapshot)
})
test('passes args and can clear itself', async () => {
  const got = []
  const id = mySetInterval((x) => {
    got.push(x)
    if (got.length === 2) myClearInterval(id)
  }, 10, 'hi')
  await sleep(100)
  expect(got).toEqual(['hi', 'hi'])
})
test('ids are unique', () => {
  const a = mySetInterval(() => {}, 1000)
  const b = mySetInterval(() => {}, 1000)
  expect(a === b).toBe(false)
  myClearInterval(a); myClearInterval(b)
})
```
@@@solution
```js
const intervals = new Map() // our id -> current timeout id
let nextId = 1

function mySetInterval(fn, delay, ...args) {
  const id = nextId++
  const tick = () => {
    const timeoutId = setTimeout(() => {
      fn(...args)
      if (intervals.has(id)) tick() // schedule next only if not cleared
    }, delay)
    intervals.set(id, timeoutId)
  }
  tick()
  return id
}

function myClearInterval(id) {
  clearTimeout(intervals.get(id))
  intervals.delete(id)
}
```
We can't return the `setTimeout` id because it changes every tick — so we return our own stable id mapped to the latest timeout. Checking `intervals.has(id)` after `fn` runs handles clearing from inside the callback. Unlike native `setInterval`, this version measures `delay` from the **end** of each call (no overlap), which is usually what you want.
:::

:::challenge
difficulty: medium
companies: Housing.com
### localStorage wrapper with expiry & fallback
Implement `createStore({ storage, now = Date.now, prefix = 'app:' } = {})` returning `{ set(key, value, ttlMs?), get(key, fallback = null), remove(key) }`:
- Values are JSON-serialised; keys are prefixed.
- If `ttlMs` is given, `get` after expiry returns `fallback` and deletes the entry.
- If `storage` is missing or any storage call throws, transparently use an in-memory `Map`.
- `storage` defaults to `localStorage` when available.
@@@starter
```js
function createStore({ storage, now = Date.now, prefix = 'app:' } = {}) {
  // your code
}
```
@@@tests
```js
function fakeStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  }
}
test('stores JSON values with prefix', () => {
  const s = fakeStorage()
  const store = createStore({ storage: s })
  store.set('user', { name: 'Ana' })
  expect(store.get('user')).toEqual({ name: 'Ana' })
  expect(s._m.has('app:user')).toBe(true)
})
test('expires after ttl', () => {
  let t = 1000
  const s = fakeStorage()
  const store = createStore({ storage: s, now: () => t })
  store.set('token', 'abc', 500)
  t = 1400
  expect(store.get('token')).toBe('abc')
  t = 1600
  expect(store.get('token', 'gone')).toBe('gone')
  expect(s._m.has('app:token')).toBe(false)
})
test('falls back to memory when storage throws', () => {
  const broken = {
    getItem() { throw new Error('SecurityError') },
    setItem() { throw new Error('QuotaExceededError') },
    removeItem() { throw new Error('nope') },
  }
  const store = createStore({ storage: broken })
  store.set('k', 42)
  expect(store.get('k')).toBe(42)
  store.remove('k')
  expect(store.get('k')).toBe(null)
})
test('corrupted data returns fallback', () => {
  const s = fakeStorage()
  s.setItem('app:bad', '{not json')
  expect(createStore({ storage: s }).get('bad', 'fb')).toBe('fb')
})
```
@@@solution
```js
function createStore({ storage, now = Date.now, prefix = 'app:' } = {}) {
  const memory = new Map()
  const memoryStorage = {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  }

  if (!storage) {
    try { storage = globalThis.localStorage } catch { storage = undefined } // access itself can throw
  }
  let backend = storage || memoryStorage

  // Run an operation; on any error switch permanently to memory and retry there
  const safe = (op) => {
    try {
      return op(backend)
    } catch {
      backend = memoryStorage
      return op(backend)
    }
  }

  return {
    set(key, value, ttlMs) {
      const record = { value, expiresAt: ttlMs ? now() + ttlMs : null }
      safe((s) => s.setItem(prefix + key, JSON.stringify(record)))
    },
    get(key, fallback = null) {
      const raw = safe((s) => s.getItem(prefix + key))
      if (raw === null || raw === undefined) return fallback
      let record
      try { record = JSON.parse(raw) } catch { return fallback }
      if (record.expiresAt !== null && now() > record.expiresAt) {
        safe((s) => s.removeItem(prefix + key)) // lazy expiry
        return fallback
      }
      return record.value
    },
    remove(key) {
      safe((s) => s.removeItem(prefix + key))
    },
  }
}
```
**Talking points:** injecting `storage` and `now` makes it testable; lazy expiry on read (plus an optional sweep on startup); wrap even the `localStorage` *access* in try/catch; `QuotaExceededError` → evict oldest entries or fall back; never store secrets/tokens in localStorage (any XSS can read it — prefer httpOnly cookies); `storage` events sync across tabs; sessionStorage for per-tab data; IndexedDB for large/structured data.
:::

## Quick check

:::quiz
### Which error should NOT be retried automatically?
- [ ] 503 Service Unavailable
- [ ] Network timeout
- [x] 400 Bad Request
- [ ] 429 Too Many Requests (after Retry-After)
@@@explain
Client errors like 400/401/403/404 won't succeed on retry without changing the request.
:::

:::quiz
### Why add jitter to exponential backoff?
- [ ] To make retries faster
- [x] To spread out retries from many clients so they don't hit the server at the same instant
- [ ] Browsers require it
- [ ] To make tests deterministic
@@@explain
Synchronized retries create load spikes (thundering herd); randomness smooths them out.
:::
