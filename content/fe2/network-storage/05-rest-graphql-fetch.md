---
title: REST, GraphQL, fetch vs axios and Cancelling Requests
summary: API styles and their trade-offs, the differences between fetch and axios, robust error handling and retries, and cancelling stale requests with AbortController.
minutes: 16
---

## REST in one minute

**REST** models your API as **resources** identified by URLs, manipulated with HTTP methods:

| Method | Meaning | Idempotent? | Safe? |
|---|---|---|---|
| `GET /orders/42` | Read | Yes | Yes |
| `POST /orders` | Create | **No** | No |
| `PUT /orders/42` | Replace | Yes | No |
| `PATCH /orders/42` | Partial update | Not necessarily | No |
| `DELETE /orders/42` | Delete | Yes | No |

Status codes carry meaning: `200 OK`, `201 Created`, `204 No Content`, `301/302` redirect, `304 Not Modified`, `400 Bad Request`, `401 Unauthorized` (not authenticated), `403 Forbidden` (authenticated but not allowed), `404`, `409 Conflict`, `422 Unprocessable`, `429 Too Many Requests`, `500`, `502/503/504`.

REST strengths: simple, cacheable with standard HTTP caching/CDNs, easy to debug. Weaknesses: **over-fetching** (an endpoint returns more fields than you need) and **under-fetching** (you need N calls to assemble one screen — e.g. post → author → comments).

## GraphQL

A **query language** over a typed schema, usually served from a **single endpoint** (`POST /graphql`). The client asks for exactly the shape it needs:

```graphql
query PostPage($id: ID!) {
  post(id: $id) {
    title
    author { name avatarUrl }
    comments(first: 10) { edges { node { id body } } }
  }
}
```

```js
const res = await fetch('/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: POST_PAGE, variables: { id: '42' } }),
})
const { data, errors } = await res.json()   // note: errors often come back with HTTP 200!
```

- **Queries** (read), **mutations** (write), **subscriptions** (real-time, usually over WebSockets).
- Strongly typed schema → codegen of TypeScript types, great tooling.
- Clients (Apollo, urql, Relay) add a **normalized cache**: entities keyed by `__typename:id`, so updating a post in one place updates it everywhere.

| | REST | GraphQL |
|---|---|---|
| Endpoints | Many | Usually one |
| Data shape | Server decides | Client decides |
| Over/under-fetching | Common | Avoided |
| HTTP caching / CDN | Easy (GET URLs) | Harder (POST); needs persisted queries/GET |
| Errors | HTTP status codes | `errors` array, often HTTP 200 |
| Versioning | `/v2/` | Evolve schema, deprecate fields |
| Server complexity | Lower | Higher (resolvers, N+1 problem → DataLoader, query cost limits) |
| File upload | Easy | Awkward |

**In an interview**: GraphQL shines for complex, nested, client-driven data needs and many client types (web, mobile); REST is simpler and caches better for resource-oriented APIs. They can coexist (a GraphQL gateway over REST microservices, or a BFF).

## fetch vs axios

```js
// fetch
const res = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(user),
})
if (!res.ok) throw new Error(`HTTP ${res.status}`)   // fetch does NOT reject on 4xx/5xx!
const data = await res.json()

// axios
const { data } = await axios.post('/api/users', user)  // rejects on non-2xx, JSON by default
```

| | fetch | axios |
|---|---|---|
| Availability | Built into browsers & Node 18+ | Library (~13 KB gz) |
| Rejects on HTTP errors (4xx/5xx) | **No** — only on network failure | Yes |
| JSON | Manual `JSON.stringify` / `res.json()` | Automatic |
| Interceptors | No (wrap it yourself) | Request/response interceptors |
| Timeout | `AbortSignal.timeout(ms)` | `timeout` option |
| Cancellation | `AbortController` | `AbortController` (`signal`) |
| Upload progress | No (use XHR) | Yes (XHR-based in browser) |
| Streaming responses | **Yes** (`res.body` ReadableStream) | Limited in browser |
| Base URL / defaults | Wrap it | `axios.create({ baseURL })` |

A small fetch wrapper gets you most of axios:

```js
export async function http(path, { body, timeout = 10_000, ...opts } = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: opts.signal ?? AbortSignal.timeout(timeout),
    credentials: 'include',
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.message ?? `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
```

## Cancelling previous requests

Why cancel?

- **Race conditions**: a search for "re" returns after "react", overwriting newer results.
- **Wasted work**: the user navigated away; don't process or set state.
- **Bandwidth**: abort large downloads that are no longer needed.

```js
let controller

async function search(q) {
  controller?.abort()                 // cancel the previous in-flight request
  controller = new AbortController()
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
    return await res.json()
  } catch (err) {
    if (err.name === 'AbortError') return null   // expected, ignore
    throw err
  }
}
```

In React, abort in the effect cleanup:

```jsx
useEffect(() => {
  const controller = new AbortController()
  fetch(`/api/items?page=${page}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setItems)
    .catch((e) => { if (e.name !== 'AbortError') setError(e) })
  return () => controller.abort()     // runs on unmount or when page changes
}, [page])
```

Notes:

- Aborting stops the browser from processing the response; the server may still have processed the request (don't rely on abort for "undoing" a mutation).
- Combine signals: `AbortSignal.any([userSignal, AbortSignal.timeout(5000)])`.
- Alternative when you can't abort (e.g. a library without signal support): track a **request id** and ignore responses that aren't the latest.

## Error handling and retries

```js
async function withRetry(fn, { retries = 3, baseDelay = 300 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const retriable = !err.status || err.status >= 500 || err.status === 429
      if (attempt >= retries || !retriable || err.name === 'AbortError') throw err
      const delay = baseDelay * 2 ** attempt + Math.random() * 100   // exponential backoff + jitter
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}
```

Retry only **idempotent** operations (GETs, PUTs) or use **idempotency keys** for POSTs (payments!). Respect `Retry-After` on 429/503.

## Interview questions

:::question
difficulty: medium
companies: Intuit
### REST vs GraphQL — when would you choose each?
**GraphQL**: one endpoint; the client specifies exactly which fields and nested relations it needs → no over/under-fetching, fewer round trips, typed schema and codegen, great for complex UIs and multiple clients. Costs: server complexity (resolvers, N+1, query cost limiting), harder HTTP/CDN caching, errors in a 200 response.

**REST**: resource URLs + HTTP verbs + status codes; simple, cache-friendly (GET + CDN), easy to monitor. Costs: over-fetching, chatty multi-request screens, versioning.

Choose GraphQL for data-rich product UIs with nested relations and many consumers; REST for simple CRUD, public/cacheable APIs, file transfer and when the team wants simplicity. A BFF can also tailor REST responses to screens.
:::

:::question
difficulty: easy
### Difference between fetch and axios?
fetch is native, promise-based, and **only rejects on network errors** — you must check `res.ok` for 4xx/5xx; you manually stringify/parse JSON; supports streaming and AbortController. axios is a library with automatic JSON, rejection on non-2xx, interceptors (auth headers, refresh token handling), built-in timeout, upload/download progress, and instances with base config. For most apps, a thin fetch wrapper is enough; axios is convenient when you need interceptors and progress.
:::

:::question
difficulty: medium
### How do you cancel previous API requests?
Use **AbortController**: create a controller per request, pass `signal` to fetch/axios, and call `abort()` on the previous controller when a new request starts (or in a React effect cleanup). Catch and ignore `AbortError`. For libraries without abort support, ignore stale responses by comparing a request id/sequence number. Higher-level tools (React Query, RxJS `switchMap`) do this for you.
:::

:::question
difficulty: medium
### How do you handle API errors and retries efficiently?
- Centralize requests in a client/wrapper: normalize errors (status, message, data), add auth headers, handle 401 by refreshing the token once and replaying.
- **Retry** only transient failures (network errors, 5xx, 429) and only idempotent requests, with **exponential backoff + jitter** and a max attempt count; respect `Retry-After`.
- Timeouts via `AbortSignal.timeout`.
- Surface errors in UI: inline messages with a retry button, error boundaries for render failures, toast for background failures; keep previous data visible when refetching fails.
- Log/monitor (Sentry) with request ids.
- Libraries like React Query provide retries, caching, dedupe and stale handling out of the box.
:::

## Challenges

:::challenge
difficulty: medium
companies: Razorpay
### Implement retry(fn, retries)
Implement `retry(fn, retries, delayMs = 0)`: call the async `fn`; if it rejects, retry up to `retries` more times, waiting `delayMs` between attempts. Resolve with the first success; reject with the **last** error if all attempts fail.
@@@starter
```js
function retry(fn, retries, delayMs = 0) {
  // your code
}
```
@@@tests
```js
test('resolves on first success', async () => {
  expect(await retry(() => Promise.resolve(42), 3)).toBe(42)
})
test('retries until success', async () => {
  let n = 0
  const fn = () => (++n < 3 ? Promise.reject(new Error('fail ' + n)) : Promise.resolve('ok'))
  expect(await retry(fn, 5)).toBe('ok')
  expect(n).toBe(3)
})
test('rejects with last error after retries exhausted', async () => {
  let n = 0
  const fn = () => Promise.reject(new Error('fail ' + ++n))
  let msg = ''
  try { await retry(fn, 2) } catch (e) { msg = e.message }
  expect(msg).toBe('fail 3')
  expect(n).toBe(3)
})
test('waits between attempts', async () => {
  let n = 0
  const start = Date.now()
  await retry(() => (++n < 3 ? Promise.reject(new Error()) : Promise.resolve()), 3, 30)
  expect(Date.now() - start).toBeGreaterThan(50)
})
```
@@@solution
```js
async function retry(fn, retries, delayMs = 0) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }
  throw lastError
}
```

Recursive variant:

```js
function retry(fn, retries, delayMs = 0) {
  return fn().catch((err) =>
    retries <= 0
      ? Promise.reject(err)
      : new Promise((r) => setTimeout(r, delayMs)).then(() => retry(fn, retries - 1, delayMs))
  )
}
```

Follow-ups: exponential backoff with jitter, a `shouldRetry(err)` predicate (don't retry 4xx), abort support via a signal, and why not to retry non-idempotent POSTs without idempotency keys.
:::

:::challenge
difficulty: medium
### Latest-only fetcher
Implement `createLatest(fn)` returning a wrapped async function. When called repeatedly, only the result of the **most recent** call resolves; earlier calls' promises resolve to `undefined` even if they finish later (no stale overwrites).
@@@starter
```js
function createLatest(fn) {
  // your code
}
```
@@@tests
```js
const delay = (v, ms) => new Promise((r) => setTimeout(() => r(v), ms))
test('only latest result is delivered', async () => {
  const get = createLatest((q, ms) => delay(q, ms))
  const p1 = get('re', 60)       // slow, stale
  const p2 = get('react', 10)    // fast, latest
  expect(await p2).toBe('react')
  expect(await p1).toBe(undefined)
})
test('single call works', async () => {
  const get = createLatest((x) => delay(x * 2, 5))
  expect(await get(4)).toBe(8)
})
```
@@@solution
```js
function createLatest(fn) {
  let latest = 0
  return async (...args) => {
    const id = ++latest
    const result = await fn(...args)
    return id === latest ? result : undefined
  }
}
```

Each call captures its own `id` in a closure; when it settles, it compares with the shared `latest`. This is the "ignore stale responses" pattern — combine it with `AbortController` to also stop the network work.
:::

## Quick check

:::quiz
### fetch('/api') returns a 500 status. What happens?
- [ ] The promise rejects with a TypeError
- [x] The promise resolves; res.ok is false
- [ ] The promise never settles
- [ ] An AbortError is thrown
@@@explain
fetch only rejects for network failures (or abort). HTTP error statuses resolve normally.
:::

:::quiz
### What is a common GraphQL problem on the server?
- [ ] Over-fetching
- [x] The N+1 query problem in resolvers
- [ ] No type system
- [ ] Too many endpoints
@@@explain
Nested resolvers can trigger one DB query per item; DataLoader batches them.
:::
