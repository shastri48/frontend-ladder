---
title: Frontend Caching Strategy
summary: Designing caching across HTTP, CDN, service worker, data-fetching libraries and in-memory stores — plus client-side caching, retries and error boundaries working together.
minutes: 18
---

## Caching is a stack, not a feature

"How would you optimise frontend caching?" and "Design a system to handle client-side caching, API retries and error boundaries gracefully" (Walmart) test whether you can reason about **every layer** a request passes through and pick the right policy per resource.

:::visual cache-layers
:::

```text
 Component ─▶ in-memory (React Query / SWR / Apollo) ─▶ Service Worker (Cache Storage)
          ─▶ browser memory cache ─▶ HTTP disk cache ─▶ CDN edge ─▶ origin server
```

Each layer has different lifetimes, invalidation tools and failure modes. The goal: **serve the fastest correct response** and invalidate precisely.

:::callout analogy Kitchen, pantry, supermarket
In-memory cache is the counter (instant, cleared when you leave), HTTP disk cache is the pantry (survives restarts), the CDN is the corner shop (close by, shared with neighbours), and the origin is the farm. You don't drive to the farm for salt — but milk has an expiry date you must respect.
:::

## Layer 1 — Static assets: cache forever, bust by filename

```http
# app.4f9c1a.js, styles.88ab.css, fonts, images with hashes
Cache-Control: public, max-age=31536000, immutable
```

Build tools put a content hash in filenames. When code changes, the filename changes, so "forever" is safe. Split vendor/framework chunks from app code so app deploys don't invalidate React.

## Layer 2 — HTML: always fresh (or briefly cached at the edge)

```http
# index.html — the entry point must reference the newest hashed assets
Cache-Control: no-cache                              # browser revalidates every time (ETag → 304)
# or at the CDN
Cache-Control: public, s-maxage=60, stale-while-revalidate=600
```

`no-cache` doesn't mean "don't cache" — it means "revalidate before use". `no-store` means never store (use for sensitive pages like banking statements).

## Layer 3 — API responses

- **Validation**: `ETag`/`If-None-Match` or `Last-Modified` → server replies `304 Not Modified` (no body).
- **`stale-while-revalidate`**: serve slightly stale data instantly while fetching fresh data in the background.
- **Private vs public**: user-specific responses must be `private` so CDNs don't serve one user's data to another. Use `Vary` correctly (`Vary: Accept-Encoding, Authorization`).

| Resource | Policy |
|---|---|
| Hashed JS/CSS/fonts/images | `public, max-age=31536000, immutable` |
| HTML shell | `no-cache` (+ CDN `s-maxage` + SWR if possible) |
| Public catalogue API | `public, s-maxage=300, stale-while-revalidate=3600` |
| User profile API | `private, no-cache` + ETag |
| Payments/PII | `no-store` |

## Layer 4 — Service worker (Cache Storage)

A service worker is a programmable proxy between page and network. It enables offline support and app-shell caching, and it is **independent of DevTools' "Disable cache"** (that only bypasses the memory/disk HTTP cache — use "Bypass for network" in Application → Service Workers).

Common strategies (Workbox names):

| Strategy | Behaviour | Use for |
|---|---|---|
| Cache first | Cache, fallback to network | Hashed static assets, fonts |
| Network first | Network, fallback to cache when offline | HTML, frequently changing APIs |
| Stale-while-revalidate | Return cache immediately, update cache from network in background | Avatars, non-critical APIs |
| Network only | Never cache | Payments, analytics POSTs |

Pitfalls: a buggy SW can pin users to old versions — version caches, clean old ones in `activate`, and have a kill-switch.

## Layer 5 — In-app data cache (React Query / SWR / Apollo / RTK Query)

These libraries treat server state as a **cache keyed by query key** with:
- **Deduplication** — 5 components asking for `['user', 7]` make one request.
- **`staleTime`** — how long data is fresh (no refetch); **`gcTime`** — how long unused data stays in memory.
- **Background refetch** on window focus/reconnect.
- **Invalidation** after mutations (`queryClient.invalidateQueries(['orders'])`), **optimistic updates** with rollback.
- **Retries** with exponential backoff, **cancellation** via `AbortSignal`.

```jsx
const { data, error, isPending } = useQuery({
  queryKey: ['products', { category, page }],
  queryFn: ({ signal }) => api.get('/products', { params: { category, page }, signal }),
  staleTime: 60_000,          // treat as fresh for a minute
  gcTime: 10 * 60_000,
  retry: (count, err) => err.status >= 500 && count < 3,  // don't retry 4xx
  placeholderData: keepPreviousData,  // no flicker between pages
})
```

## Layer 6 — Local persistence

`localStorage` (sync, ~5 MB, strings only — blocks the main thread on big reads), `IndexedDB` (async, large, structured), `sessionStorage` (per tab). Good for drafts, preferences and offline data; add **expiry** and **versioning** because stored data outlives deploys.

```js
const store = {
  set(key, value, ttlMs) {
    try {
      localStorage.setItem(key, JSON.stringify({ v: 1, value, exp: ttlMs ? Date.now() + ttlMs : null }))
    } catch { memoryFallback.set(key, value) }      // quota exceeded / Safari private mode
  },
  get(key) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return memoryFallback.get(key) ?? null
      const { v, value, exp } = JSON.parse(raw)
      if (v !== 1 || (exp && Date.now() > exp)) { localStorage.removeItem(key); return null }
      return value
    } catch { return memoryFallback.get(key) ?? null }
  },
}
const memoryFallback = new Map()
```

## Caching + retries + error boundaries: one resilient design

```text
UI ──▶ query hook (cache, dedupe, staleTime)
          │ miss/stale
          ▼
       API client  ──▶ timeout (AbortSignal.timeout) ──▶ retry w/ exponential backoff + jitter (idempotent only)
          │                                                │ final failure
          ▼                                                ▼
    response normalised                         typed error (status, retryable?)
                                                           │
                       ┌───────────────────────────────────┴────────────────┐
                       ▼                                                    ▼
          component-level inline error + Retry           Error Boundary (route/widget level)
          (keep showing cached/stale data)               for render crashes & thrown query errors
```

- Retry **only idempotent** requests (GET/PUT with idempotency keys), only for network errors/5xx/429 (respect `Retry-After`), with backoff + jitter, and a cap.
- When a refetch fails but cached data exists, **keep showing stale data** with a subtle "couldn't refresh" banner instead of blanking the UI.
- Error boundaries per **route and widget** so one failing chart doesn't crash the dashboard; reset them when query keys change (`resetKeys`).
- Report errors with context (query key, status, release) to Sentry.

:::question
difficulty: hard
companies: Walmart
### How would you design client-side caching, API retries and error boundaries gracefully?
Use a layered approach: HTTP caching headers + CDN for static and public data; a server-state cache (React Query/RTK Query) keyed by params with `staleTime`, deduplication, background refetch and mutation invalidation; an API client with timeouts, AbortController cancellation and retry with exponential backoff + jitter for idempotent requests on 5xx/network errors only; typed errors that UI can reason about (`retryable`, `status`). Show stale data with a retry affordance when refetches fail; use error boundaries at route and widget granularity (with reset on key change) for render errors and unrecoverable query errors; global handling for 401 (refresh token / redirect to login); and telemetry for errors and cache hit rates.
:::

:::question
difficulty: medium
### What's the difference between `no-cache`, `no-store` and `max-age=0`?
- `no-store`: never write the response to any cache — for sensitive data.
- `no-cache`: you may store it but **must revalidate** with the server (ETag/Last-Modified) before each use; a 304 avoids re-downloading.
- `max-age=0`: the response is immediately stale; caches typically revalidate, though `must-revalidate` is needed to forbid serving stale on errors. In practice `no-cache` expresses the intent most clearly.
:::

:::question
difficulty: medium
companies: Myntra
### Why do assets still load from a service worker when "Disable cache" is ticked in DevTools?
"Disable cache" bypasses only the browser's HTTP caches (memory cache and disk cache). A service worker sits *in front of* those as a programmable proxy and can answer from its own **Cache Storage** regardless. To bypass it, tick **Bypass for network** in Application → Service Workers, or hard reload (Cmd/Ctrl+Shift+R), which skips the SW for that load. These responses show "(ServiceWorker)" in the Network panel and take a few ms because they hop through the SW thread.
:::

:::challenge
difficulty: medium
companies: Housing.com
### Build a localStorage wrapper with expiry and fallback
Implement `createStorage(backend)` returning `{ set(key, value, ttlMs?), get(key), remove(key) }`. Values are JSON-serialised; expired entries return `null` and are removed; if the backend throws (quota exceeded, disabled storage), fall back to an in-memory map. `backend` has the `localStorage` interface (`getItem`, `setItem`, `removeItem`).
@@@starter
```js
function createStorage(backend) {
  // your code
}
```
@@@tests
```js
function fakeBackend() {
  const m = new Map()
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }
}
test('stores and reads objects', () => {
  const s = createStorage(fakeBackend())
  s.set('a', { x: 1 })
  expect(s.get('a')).toEqual({ x: 1 })
})
test('expires entries', async () => {
  const b = fakeBackend()
  const s = createStorage(b)
  s.set('t', 42, 30)
  expect(s.get('t')).toBe(42)
  await sleep(50)
  expect(s.get('t')).toBe(null)
  expect(b._m.has('t')).toBe(false)
})
test('falls back to memory when backend throws', () => {
  const broken = { getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') }, removeItem() { throw new Error('x') } }
  const s = createStorage(broken)
  s.set('k', 'v')
  expect(s.get('k')).toBe('v')
})
test('missing key returns null', () => {
  expect(createStorage(fakeBackend()).get('nope')).toBe(null)
})
```
@@@solution
```js
function createStorage(backend) {
  const memory = new Map()

  function set(key, value, ttlMs) {
    const record = JSON.stringify({ value, exp: ttlMs ? Date.now() + ttlMs : null })
    try {
      backend.setItem(key, record)
      memory.delete(key)
    } catch {
      memory.set(key, record)
    }
  }

  function readRaw(key) {
    try {
      const raw = backend.getItem(key)
      if (raw !== null) return raw
    } catch { /* fall through to memory */ }
    return memory.has(key) ? memory.get(key) : null
  }

  function remove(key) {
    memory.delete(key)
    try { backend.removeItem(key) } catch { /* ignore */ }
  }

  function get(key) {
    const raw = readRaw(key)
    if (raw === null) return null
    try {
      const { value, exp } = JSON.parse(raw)
      if (exp !== null && Date.now() > exp) { remove(key); return null }
      return value
    } catch {
      remove(key)            // corrupted entry
      return null
    }
  }

  return { set, get, remove }
}
```
**Discussion**: lazy expiry on read (plus optional sweep on startup), versioning the schema, namespacing keys per app/user, never storing secrets (localStorage is readable by any XSS), and listening to the `storage` event to sync across tabs.
:::

:::quiz
### Which header combo suits a hashed `app.9f3a.js` bundle?
- [ ] no-cache
- [ ] no-store
- [x] public, max-age=31536000, immutable
- [ ] private, max-age=60
@@@explain
The hash changes when contents change, so it's safe to cache for a year and skip revalidation.
:::

:::quiz
### In React Query, what does `staleTime` control?
- [x] How long data is considered fresh before a refetch can be triggered
- [ ] How long unused data stays in memory
- [ ] The request timeout
- [ ] Retry delay
@@@explain
gcTime (formerly cacheTime) controls how long inactive data stays in memory.
:::
