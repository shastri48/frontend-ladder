---
title: Browser Storage — Cookies, Web Storage, IndexedDB
summary: Cookies vs localStorage vs sessionStorage vs IndexedDB vs Cache Storage vs extension storage, plus building a localStorage wrapper and an in-memory cache with expiry.
minutes: 15
---

## Many boxes, different rules

The browser gives you several places to keep data. Picking the wrong one leads to security holes (tokens in localStorage), performance problems (huge JSON in localStorage blocking the main thread) or lost data (sessionStorage in a new tab).

:::visual storage-compare
:::

| | Cookies | localStorage | sessionStorage | IndexedDB | Cache Storage | In-memory (JS) |
|---|---|---|---|---|---|---|
| Capacity | ~4 KB per cookie | ~5–10 MB per origin | ~5 MB per origin | Large (% of disk) | Large | RAM |
| Lifetime | `Expires`/`Max-Age` or session | Until cleared | Tab session (survives reload) | Until cleared | Until cleared | Until reload |
| Sent with requests | **Yes**, automatically | No | No | No | No | No |
| Accessible from | Server + JS (unless HttpOnly) | JS (same origin) | JS (same origin + **same tab**) | JS, workers | JS, Service Worker | Current page |
| API | String (`document.cookie`) | Sync, strings | Sync, strings | **Async**, structured data, indexes, transactions | Async, Request/Response | Any value |
| Available in workers | No | No | No | **Yes** | **Yes** | Per-worker |

## Cookies

Cookies were designed for the **server** to keep state (sessions) across HTTP requests.

```http
Set-Cookie: session=8f3a...; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax
```

| Attribute | Purpose |
|---|---|
| `HttpOnly` | JS can't read it (`document.cookie`) → protects against XSS stealing it |
| `Secure` | Only sent over HTTPS |
| `SameSite=Strict/Lax/None` | Controls cross-site sending → CSRF defence (`Lax` is the default) |
| `Domain` / `Path` | Scope |
| `Max-Age` / `Expires` | Persistence; without them it's a session cookie |
| `Partitioned` (CHIPS) | Third-party cookie partitioned per top-level site |

Downsides: sent on **every** request to that domain (bandwidth), tiny, awkward API. Use them for **auth sessions** (HttpOnly) — not general data.

```js
// Reading/writing non-HttpOnly cookies in JS
document.cookie = 'theme=dark; Max-Age=31536000; Path=/; SameSite=Lax'
const theme = document.cookie.split('; ').find((c) => c.startsWith('theme='))?.split('=')[1]
// Modern async API (Chromium): await cookieStore.get('theme')
```

## localStorage and sessionStorage

```js
localStorage.setItem('prefs', JSON.stringify({ theme: 'dark' }))
const prefs = JSON.parse(localStorage.getItem('prefs') ?? '{}')
localStorage.removeItem('prefs')

// Cross-tab sync: fires in OTHER tabs of the same origin
window.addEventListener('storage', (e) => {
  if (e.key === 'prefs') applyPrefs(JSON.parse(e.newValue))
})
```

- **Synchronous** — reads/writes block the main thread; don't store megabytes.
- Strings only — you must `JSON.stringify`.
- `sessionStorage` is scoped to the **tab**: opening the same site in a new tab gets a fresh sessionStorage (duplicating a tab copies it). Survives reloads.
- Can throw: quota exceeded, or access denied (Safari private mode historically, disabled storage, sandboxed iframes). **Always wrap in try/catch.**
- **Any JS on your page can read it** → an XSS bug can exfiltrate everything. Don't store auth tokens here if you can avoid it.

## IndexedDB

A transactional, **asynchronous** NoSQL database in the browser: object stores, indexes, cursors, and it stores structured data (objects, Blobs, Files, ArrayBuffers) without stringifying. Works in workers and Service Workers. Use for offline data, large caches, drafts, media.

The raw API is verbose (event-based); in practice use **idb** (a tiny promise wrapper) or **Dexie**.

```js
import { openDB } from 'idb'
const db = await openDB('app', 1, {
  upgrade(db) { db.createObjectStore('drafts', { keyPath: 'id' }) },
})
await db.put('drafts', { id: 'post-1', body: 'Hello', updatedAt: Date.now() })
const draft = await db.get('drafts', 'post-1')
```

## Cache Storage

`caches.open()` — stores **Request/Response** pairs, designed for Service Workers (but usable from pages). For caching network responses/assets, not app data.

## Extension storage (`chrome.storage`)

Browser extensions get their own storage API:

```js
await chrome.storage.local.set({ settings: { enabled: true } })
const { settings } = await chrome.storage.local.get('settings')
chrome.storage.onChanged.addListener((changes, area) => { /* … */ })
```

- `chrome.storage.local` — on-device, ~10 MB (more with `unlimitedStorage` permission).
- `chrome.storage.sync` — synced across the user's signed-in browsers; small quota (~100 KB, 8 KB/item).
- `chrome.storage.session` — in-memory for the browser session.
- **Async**, stores JSON-serializable objects, accessible from service worker (background), popup, options and content scripts — unlike `localStorage`, which in a content script would be the **web page's** localStorage, and isn't available in MV3 background service workers at all.

## Storage limits and eviction

Browsers allocate quota per origin (a share of free disk). Under storage pressure, **best-effort** data can be evicted (least-recently-used origins). Request durability with `navigator.storage.persist()`; check usage with `navigator.storage.estimate()`. Safari may delete script-written storage for sites not visited in 7 days (ITP).

## In-memory cache with expiry

For API data within a session, a plain `Map` with timestamps is the fastest option (this is essentially what React Query/SWR do, plus dedupe and revalidation):

```js
class TTLCache {
  #store = new Map()
  constructor(defaultTtl = 60_000) { this.defaultTtl = defaultTtl }
  set(key, value, ttl = this.defaultTtl) {
    this.#store.set(key, { value, expires: Date.now() + ttl })
  }
  get(key) {
    const hit = this.#store.get(key)
    if (!hit) return undefined
    if (Date.now() > hit.expires) { this.#store.delete(key); return undefined }
    return hit.value
  }
  has(key) { return this.get(key) !== undefined }
  delete(key) { this.#store.delete(key) }
  clear() { this.#store.clear() }
}
```

## Interview questions

:::question
difficulty: easy
### localStorage vs sessionStorage vs cookies?
- **localStorage**: ~5–10 MB, persists until cleared, per origin, sync JS-only API, not sent to the server.
- **sessionStorage**: same API, but scoped to a single tab and cleared when the tab closes (survives reloads).
- **Cookies**: ~4 KB, sent automatically with every matching HTTP request, can be `HttpOnly` (hidden from JS), `Secure`, `SameSite`, with explicit expiry. Meant for server state like sessions.

Choose cookies (HttpOnly) for auth, localStorage for small non-sensitive preferences, sessionStorage for per-tab state (e.g. a wizard in progress), IndexedDB for large/structured/offline data.
:::

:::question
difficulty: medium
### Should you store a JWT in localStorage?
Generally **no** for anything sensitive. localStorage is readable by any script running on your origin, so a single **XSS** vulnerability (or a compromised third-party script) can steal the token and use it from anywhere until it expires.

Preferred: keep the session/refresh token in an **HttpOnly, Secure, SameSite** cookie (JS can't read it), and if you need an access token in JS, keep a **short-lived** one in **memory** only, refreshed silently via the cookie. Cookies bring CSRF risk, mitigated by `SameSite`, CSRF tokens and checking `Origin`. No storage choice fixes XSS itself — you still need CSP and output encoding.
:::

:::question
difficulty: medium
companies: Housing.com
### Compare caching strategies: localStorage, sessionStorage and in-memory with expiry.
- **In-memory (Map + TTL)**: fastest, any data type, no serialization; lost on reload; per tab. Best for API responses within a session (what React Query does).
- **sessionStorage**: survives reloads, per tab, sync string API; good for restoring UI state (form progress, scroll) after refresh.
- **localStorage**: survives restarts, shared across tabs (sync via the `storage` event); sync and string-only, so keep it small; implement expiry yourself; good for preferences, feature-flag snapshots, small cached config.
- For larger data use IndexedDB; for HTTP assets rely on the HTTP cache/Service Worker.
:::

## Challenges

:::challenge
difficulty: medium
companies: Housing.com
### localStorage wrapper with expiry and fallback
Build `createStorage(backend)` returning `{ set(key, value, ttlMs?), get(key), remove(key) }`:
- values of any JSON type; `get` returns `null` if missing or expired (and removes expired entries);
- if `backend` throws (quota, disabled storage) or is unavailable, silently fall back to an in-memory Map;
- `backend` follows the `localStorage` interface (`getItem`, `setItem`, `removeItem`).
@@@starter
```js
function createStorage(backend) {
  // your code
}
```
@@@tests
```js
function fakeStorage() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
test('stores and reads objects', () => {
  const s = createStorage(fakeStorage())
  s.set('u', { name: 'Ada' })
  expect(s.get('u')).toEqual({ name: 'Ada' })
})
test('expires values', async () => {
  const s = createStorage(fakeStorage())
  s.set('t', 1, 30)
  expect(s.get('t')).toBe(1)
  await sleep(50)
  expect(s.get('t')).toBe(null)
})
test('missing key returns null', () => {
  expect(createStorage(fakeStorage()).get('nope')).toBe(null)
})
test('falls back when backend throws', () => {
  const broken = { getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') }, removeItem() { throw new Error('x') } }
  const s = createStorage(broken)
  s.set('a', [1, 2])
  expect(s.get('a')).toEqual([1, 2])
})
test('falls back when backend is undefined', () => {
  const s = createStorage(undefined)
  s.set('a', 5)
  expect(s.get('a')).toBe(5)
})
```
@@@solution
```js
function createStorage(backend) {
  const memory = new Map()
  const mem = {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  }

  // Run an operation on the backend; on failure use memory instead
  function safe(op, ...args) {
    if (backend) {
      try { return backend[op](...args) } catch { /* fall through */ }
    }
    return mem[op](...args)
  }

  return {
    set(key, value, ttlMs) {
      const record = JSON.stringify({ value, expires: ttlMs ? Date.now() + ttlMs : null })
      if (backend) {
        try { backend.setItem(key, record); return } catch { /* quota/denied */ }
      }
      mem.setItem(key, record)
    },
    get(key) {
      let raw = safe('getItem', key)
      if (raw == null) raw = mem.getItem(key)   // might have been written to memory on fallback
      if (raw == null) return null
      try {
        const { value, expires } = JSON.parse(raw)
        if (expires !== null && Date.now() > expires) {
          this.remove(key)
          return null
        }
        return value
      } catch {
        return null   // corrupted entry
      }
    },
    remove(key) {
      safe('removeItem', key)
      mem.removeItem(key)
    },
  }
}
```

Key points to mention: wrap every access in try/catch (Safari private mode, quota, disabled cookies); store metadata (expiry, optionally a schema **version** to invalidate on deploy); handle corrupted JSON; consider namespacing keys; optional cleanup sweep of expired keys on startup; for cross-tab invalidation listen to the `storage` event.
:::

:::challenge
difficulty: easy
### TTL cache
Implement `class TTLCache` with `set(key, value, ttlMs)`, `get(key)` (returns `undefined` when missing/expired) and a `size` getter that counts only live entries.
@@@starter
```js
class TTLCache {
  // your code
}
```
@@@tests
```js
test('get/set', () => {
  const c = new TTLCache()
  c.set('a', 1, 1000)
  expect(c.get('a')).toBe(1)
})
test('expiry', async () => {
  const c = new TTLCache()
  c.set('a', 1, 20)
  await sleep(40)
  expect(c.get('a')).toBe(undefined)
})
test('size counts live entries', async () => {
  const c = new TTLCache()
  c.set('a', 1, 20); c.set('b', 2, 1000)
  await sleep(40)
  expect(c.size).toBe(1)
})
```
@@@solution
```js
class TTLCache {
  #map = new Map()
  set(key, value, ttlMs) {
    this.#map.set(key, { value, expires: Date.now() + ttlMs })
    return this
  }
  get(key) {
    const e = this.#map.get(key)
    if (!e) return undefined
    if (Date.now() >= e.expires) { this.#map.delete(key); return undefined }
    return e.value
  }
  get size() {
    const now = Date.now()
    for (const [k, e] of this.#map) if (now >= e.expires) this.#map.delete(k)
    return this.#map.size
  }
}
```
Lazy expiry on read keeps it O(1); `size` sweeps O(n). For bounded memory, combine with LRU eviction (max entries).
:::

## Quick check

:::quiz
### Which storage is automatically sent to the server with requests?
- [x] Cookies
- [ ] localStorage
- [ ] sessionStorage
- [ ] IndexedDB
@@@explain
Only cookies are attached by the browser to matching HTTP requests.
:::

:::quiz
### Which storage can a Service Worker use?
- [ ] localStorage
- [ ] sessionStorage
- [x] IndexedDB and Cache Storage
- [ ] document.cookie
@@@explain
Web Storage is synchronous and not exposed to workers. IndexedDB and Cache Storage are async and available.
:::

:::quiz
### You open the same site in a brand new tab. What's in sessionStorage?
- [ ] The same data as the first tab
- [x] Nothing — it's a new session
- [ ] The localStorage data
- [ ] Only HttpOnly cookies
@@@explain
sessionStorage is per tab (duplicating a tab copies it, opening a new one doesn't).
:::
