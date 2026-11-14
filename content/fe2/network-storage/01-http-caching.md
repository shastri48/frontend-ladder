---
title: HTTP Caching
summary: Cache-Control, ETag, Last-Modified, 304s, immutable hashed assets and cache busting — how to make repeat visits nearly free.
minutes: 15
---

## The fastest request is the one you never make

HTTP caching lets the browser (and CDNs/proxies between you and the server) reuse previous responses. Done right, a returning user downloads almost nothing. Done wrong, users see stale code after a deploy — or re-download everything every time.

There are two separate questions the browser asks:

1. **Freshness** — "Can I use my cached copy *without asking* the server?" (controlled by `Cache-Control: max-age`, `Expires`)
2. **Validation** — "My copy is stale; is it still the same?" (controlled by `ETag` / `Last-Modified` → `304 Not Modified`)

```text
Request for /app.js
   │
   ├─ In cache and FRESH? ──yes──► use it (200 from memory/disk cache). No network.
   │
   ├─ In cache but STALE, has validator? ──► conditional request:
   │        If-None-Match: "abc123"   /   If-Modified-Since: <date>
   │           ├─ server: 304 Not Modified (no body) ──► reuse cached body, refresh freshness
   │           └─ server: 200 + new body ──► replace cache
   │
   └─ Not cached ──► normal request ──► 200, store per Cache-Control
```

## Cache-Control directives you must know

| Directive | Meaning |
|---|---|
| `max-age=N` | Fresh for N seconds |
| `s-maxage=N` | Like max-age but only for **shared** caches (CDN) |
| `no-cache` | **May store**, but must **revalidate** with the server before every use |
| `no-store` | Don't store at all (sensitive data) |
| `private` | Only the browser may cache (not CDN) — per-user data |
| `public` | Any cache may store, even for authenticated requests |
| `immutable` | The resource will never change while fresh — don't even revalidate on reload |
| `must-revalidate` | Once stale, must not be used without successful revalidation |
| `stale-while-revalidate=N` | Serve stale for up to N s while refreshing in the background |
| `stale-if-error=N` | Serve stale if the origin is down |

:::callout warn The classic confusion
`no-cache` does **not** mean "don't cache". It means "cache, but always check first". To prevent storage use `no-store`.
:::

## Validators: ETag and Last-Modified

```http
HTTP/1.1 200 OK
ETag: "33a64df5"
Last-Modified: Tue, 10 Nov 2026 08:00:00 GMT
Cache-Control: no-cache
```

Next time:

```http
GET /index.html
If-None-Match: "33a64df5"
If-Modified-Since: Tue, 10 Nov 2026 08:00:00 GMT
```

```http
HTTP/1.1 304 Not Modified
```

A 304 still costs a round trip, but saves the body. **ETag** (a content hash/version) is more precise than **Last-Modified** (1-second resolution, and can change on redeploy even when content didn't).

## The recipe for a modern web app

```text
index.html                         → Cache-Control: no-cache            (always revalidate)
/assets/app.3f9a1c.js              → Cache-Control: public, max-age=31536000, immutable
/assets/styles.8b2e4d.css          → Cache-Control: public, max-age=31536000, immutable
/images/hero.c1d2.avif             → Cache-Control: public, max-age=31536000, immutable
/api/products                      → Cache-Control: private, max-age=0, must-revalidate  (or no-store)
/api/config (public, slow-changing)→ Cache-Control: public, max-age=60, stale-while-revalidate=300
```

**Cache busting with content hashes**: the bundler (Vite/Webpack) puts a hash of the file's content in its name. Change the content → new filename → new URL → guaranteed fresh download. Old URLs can be cached "forever" (`immutable`). The HTML, which references the hashed names, is revalidated every time, so a deploy is picked up immediately.

Why not `app.js?v=2`? Query strings work but some proxies don't cache URLs with query strings, and you must remember to bump the version manually.

## Heuristic caching

If a response has **no** `Cache-Control`/`Expires` but has `Last-Modified`, browsers may cache it heuristically (often 10% of the time since last modification). This is a common source of "users see old files" bugs — always send explicit headers.

## Reload behaviours

- **Normal navigation**: uses fresh cache entries.
- **Reload (F5 / Cmd+R)**: revalidates the main document; subresources may be revalidated (not for `immutable`).
- **Hard reload (Cmd/Ctrl+Shift+R)**: bypasses the cache for that load (`Cache-Control: no-cache` request header).
- **DevTools "Disable cache"**: bypasses the HTTP memory/disk cache while DevTools is open — but **not** a Service Worker (next lesson!).

## The `Vary` header

`Vary: Accept-Encoding` tells caches that the response differs by that request header (gzip vs brotli). `Vary: Cookie` effectively makes responses uncacheable in shared caches. Use it carefully.

## Interview questions

:::question
difficulty: medium
### Explain no-cache vs no-store vs max-age=0.
- `no-store`: never write the response to any cache. For sensitive data (banking pages).
- `no-cache`: store it, but **revalidate** with the server (ETag/Last-Modified) before each use. Good for HTML entry points.
- `max-age=0`: it's immediately stale; caches typically revalidate before use (similar to `no-cache`, but in some edge cases—like with `stale-while-revalidate` or offline—a stale copy may be served; add `must-revalidate` to forbid that).
:::

:::question
difficulty: medium
companies: Housing.com
### What caching strategy would you use for an SPA's HTML, JS bundles, images and API data?
- **HTML**: `no-cache` with an ETag so every visit checks for a new deploy but gets a cheap 304 if nothing changed.
- **Hashed JS/CSS/images**: `public, max-age=31536000, immutable` — content-addressed filenames make them safe to cache forever.
- **User-specific API data**: `private` with short or zero max-age, or `no-store` for sensitive data; cache on the client with an in-memory data cache (React Query/SWR) with stale-while-revalidate semantics.
- **Public, slowly changing API data**: short `max-age` + `stale-while-revalidate` + CDN `s-maxage`.
- Optionally a **Service Worker** for offline/app-shell caching.
:::

:::question
difficulty: easy
### What is a 304 response?
"Not Modified" — the server's reply to a **conditional request** (`If-None-Match` / `If-Modified-Since`) when the client's cached copy is still valid. It has no body; the browser reuses its cached body and updates freshness metadata. It saves bandwidth but still costs a round trip.
:::

:::question
difficulty: medium
### Users report seeing an old version of the app after a deploy. What could be wrong?
- `index.html` is cached with a long `max-age` (by the browser or a CDN) so it still references the old bundle names → set `no-cache` for HTML and purge the CDN.
- Bundles aren't content-hashed, so same URL with long max-age → enable hashing.
- No cache headers at all → heuristic caching.
- A **Service Worker** serving a cached app shell → implement an update flow (`skipWaiting`/prompt "New version available").
- Long-lived SPA tabs never reload → detect new versions (poll a `version.json`) and prompt to refresh; also handle **chunk load errors** for deleted old chunks (retry/reload).
:::

## Challenges

:::challenge
difficulty: medium
### Pick the headers
Choose the `Cache-Control` header for each: (a) `/assets/vendor.a81c.js`, (b) `/index.html`, (c) `/api/me` (user profile), (d) `/api/bank-statement.pdf`, (e) `/api/exchange-rates` that changes every minute and is the same for everyone.
@@@solution
- (a) `public, max-age=31536000, immutable`
- (b) `no-cache` (plus ETag)
- (c) `private, no-cache` (or `private, max-age=0`) — per-user, must not be stored by a CDN
- (d) `no-store` — sensitive, shouldn't be written to disk
- (e) `public, max-age=30, s-maxage=60, stale-while-revalidate=60` — CDN absorbs traffic; users get near-fresh data quickly
:::

## Quick check

:::quiz
### Which header lets a cache reuse a response without contacting the server at all?
- [ ] ETag
- [x] Cache-Control: max-age=3600
- [ ] Cache-Control: no-cache
- [ ] Last-Modified
@@@explain
max-age defines freshness. ETag and Last-Modified are validators used only once the entry is stale.
:::

:::quiz
### Why is it safe to cache `app.4f2a9c.js` for a year?
- [ ] Browsers ignore max-age over a day
- [x] Any content change produces a different filename/URL
- [ ] CDNs revalidate it automatically
- [ ] JS files are never stale
@@@explain
Content hashing makes the URL a fingerprint of the content, so an old URL always means old content — and the HTML points to new URLs after a deploy.
:::
