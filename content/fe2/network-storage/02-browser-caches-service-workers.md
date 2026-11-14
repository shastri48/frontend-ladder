---
title: Memory Cache, Disk Cache and Service Workers
summary: The layers a request passes through, why "Disable cache" doesn't stop a Service Worker, and how to build offline-first PWAs with caching strategies.
minutes: 16
---

## A real-world puzzle

A developer exploring the Myntra website in the Network tab noticed something weird: they ticked **Disable cache**, reloaded, and assets **still loaded almost instantly — "from ServiceWorker"**. How?

The answer requires knowing that the browser has **several independent caches**, and DevTools' checkbox only controls some of them.

:::visual cache-layers
:::

## The layers a request passes through

```text
fetch("/logo.png")
  │
  ├─ 1. Memory cache   (in-RAM, this tab/renderer, very short-lived)
  ├─ 2. Service Worker (if one controls the page: its fetch handler decides)
  │        └─ Cache Storage API (the SW's own programmable cache)
  ├─ 3. HTTP cache     (disk cache, governed by Cache-Control/ETag)
  ├─ 4. Push cache     (HTTP/2 server push — effectively dead, removed in Chrome)
  └─ 5. Network        (→ CDN edge → origin)
```

### Memory cache

- Keeps recently used resources in **RAM** for the current document — e.g. the same image used twice, or preloaded resources.
- Super fast (**0 ms** in the Network panel, "(memory cache)").
- Temporary: gone when the tab/renderer closes.

### Disk cache (HTTP cache)

- Persisted on disk, shared across tabs and sessions (partitioned by top-level site for privacy).
- Obeys `Cache-Control`, `ETag`, etc.
- Shows as "(disk cache)", a few ms.

### Service Worker + Cache Storage

- A **Service Worker** is a script that runs on a **separate background thread**, independent of any page, and can **intercept every network request** from pages in its scope.
- It can answer from **Cache Storage** (a programmable key-value store of Request → Response), from the network, or construct a response itself.
- Shows as "(ServiceWorker)", and still takes a few milliseconds because every response hops through the separate worker thread.

## Back to the Myntra puzzle

DevTools **"Disable cache"** only bypasses the browser-level **memory and disk (HTTP) caches**. A Service Worker plays by its own rules: it intercepts the request **before** the HTTP cache and responds from Cache Storage — completely outside the system DevTools disabled.

To truly bypass it:

1. Open **Application** tab → **Service Workers**.
2. Tick **"Bypass for network"**.
3. Reload — now you see the real network flow.

A **hard refresh** (Cmd/Ctrl + Shift + R) also bypasses the Service Worker for that navigation — the page loads uncontrolled — which is why it "fixes" things during debugging.

## Service Worker lifecycle

```text
register() ─► INSTALL ─► (waiting) ─► ACTIVATE ─► controls pages ─► idle/terminated ─► woken by events
               │ precache app shell     │ clean old caches
```

```js
// main.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
}
```

```js
// sw.js
const CACHE = 'app-v3'
const APP_SHELL = ['/', '/index.html', '/assets/app.3f9a.js', '/assets/app.8b2e.css', '/offline.html']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)))
  // self.skipWaiting()  // activate immediately (careful: old pages + new SW)
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  // self.clients.claim()  // take control of open pages now
})

self.addEventListener('fetch', (event) => {
  event.respondWith(cacheFirst(event.request))
})
```

Key lifecycle facts:

- A new SW **installs** in the background but **waits** until all tabs using the old SW are closed, so a page never runs with mismatched versions. `skipWaiting()` + `clients.claim()` skip this — common with a "New version available — Reload" prompt.
- SWs require **HTTPS** (or localhost) because they're so powerful.
- SWs are **event-driven** and get terminated when idle; don't keep state in global variables.
- The SW file itself is checked for updates on navigation (byte-diff); serve `sw.js` with `no-cache`.

## Caching strategies

```js
// Cache first — great for hashed static assets, fonts
async function cacheFirst(req) {
  const cached = await caches.match(req)
  return cached ?? fetch(req)
}

// Network first — great for HTML/API where freshness matters, cache as offline fallback
async function networkFirst(req) {
  try {
    const res = await fetch(req)
    const cache = await caches.open('runtime')
    cache.put(req, res.clone())
    return res
  } catch {
    return (await caches.match(req)) ?? caches.match('/offline.html')
  }
}

// Stale-while-revalidate — instant response, refresh in background
async function staleWhileRevalidate(req) {
  const cache = await caches.open('runtime')
  const cached = await cache.match(req)
  const network = fetch(req).then((res) => { cache.put(req, res.clone()); return res })
  return cached ?? network
}
```

| Strategy | Speed | Freshness | Use for |
|---|---|---|---|
| Cache only | Fastest | Never updates | Precached shell |
| Cache first | Fast | Updates on new version only | Hashed JS/CSS, fonts, images |
| Network first | Slow on bad networks | Fresh | HTML, critical API data |
| Stale-while-revalidate | Fast | Fresh next time | Avatars, non-critical API data |
| Network only | Network | Fresh | Payments, analytics POSTs |

Libraries like **Workbox** implement these with routing, expiration and precache manifests.

Note `res.clone()`: a Response body is a stream that can be read only once — you need one copy for the cache and one for the page.

## PWAs

A **Progressive Web App** is a web app that uses modern APIs to feel native:

- **Service Worker** → offline support, fast repeat loads, background sync, push notifications.
- **Web App Manifest** (`manifest.webmanifest`) → name, icons, theme color, `display: standalone` → installable to the home screen.
- **HTTPS**.

Benefits: works offline/flaky networks, installable without an app store, one codebase, smaller than native apps, instant updates. Limitations: iOS has historically restricted some features; storage can be evicted under pressure.

## Interview questions

:::question
difficulty: medium
companies: Myntra
### I ticked "Disable cache" in DevTools but assets still load instantly from ServiceWorker. Why?
"Disable cache" only bypasses the browser's **memory cache** and **HTTP disk cache**. A **Service Worker** runs on a separate thread, intercepts requests before the HTTP cache, and can respond from its own **Cache Storage**. That's outside what the checkbox controls, so those requests still appear "(ServiceWorker)" with a few ms (the response hops through the worker thread).

To bypass: Application → Service Workers → **Bypass for network** (or Update on reload / Unregister), or do a **hard refresh**, which loads the page without the SW controlling it.
:::

:::question
difficulty: medium
### What is a Service Worker and what can it do?
A JavaScript worker that runs in the background, separate from pages, acting as a **programmable network proxy** for its scope. It can:
- intercept and respond to `fetch` requests (offline support, caching strategies, custom responses),
- precache an app shell on install,
- handle **push** notifications and **background sync**,
- update caches in the background.

It cannot access the DOM, is event-driven (terminated when idle), requires HTTPS and has a lifecycle (install → waiting → activate).
:::

:::question
difficulty: easy
### Memory cache vs disk cache?
**Memory cache**: RAM, per renderer/document, extremely fast (0 ms), cleared when the tab closes; holds recently used/preloaded resources. **Disk cache**: the persistent HTTP cache, survives reloads and restarts, governed by HTTP headers, slightly slower. The browser decides which to use — frequently used small resources often come from memory on reload within a session.
:::

:::question
difficulty: medium
### How do you ship an update when a Service Worker caches the app shell?
- Version the cache name and delete old caches in `activate`.
- The browser checks `sw.js` for byte changes on navigation; serve it `no-cache`.
- The new SW waits; detect it (`registration.waiting` / `updatefound`) and show a "New version — Reload" toast. On click, `postMessage({type:'SKIP_WAITING'})` → `self.skipWaiting()`, then reload on `controllerchange`.
- Use network-first for HTML so users don't get stuck with an old shell.
:::

## Challenges

:::challenge
difficulty: medium
### Implement a cache-with-network-timeout strategy
Write a SW fetch strategy `networkWithTimeout(request, ms)`: try the network; if it doesn't respond within `ms`, fall back to the cache (if present). If the network wins, update the cache.
@@@solution
```js
async function networkWithTimeout(request, ms = 3000) {
  const cache = await caches.open('runtime-v1')

  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone())
    return res
  })

  const timeout = new Promise((resolve) =>
    setTimeout(async () => resolve(await cache.match(request)), ms)
  )

  // If the timeout fires but there's no cached copy, keep waiting for the network
  const first = await Promise.race([network, timeout])
  return first ?? network
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(networkWithTimeout(event.request, 3000))
  }
})
```

Edge cases: only cache `GET`s and `ok` responses; the network promise may reject (offline) — wrap it so the cache is used; avoid caching opaque cross-origin responses blindly (they can be large and you can't inspect status).
:::

## Quick check

:::quiz
### Which bypasses a Service Worker for one load?
- [ ] DevTools "Disable cache"
- [x] Hard reload (Cmd/Ctrl+Shift+R)
- [ ] Clearing localStorage
- [ ] Setting Cache-Control: no-store on the HTML
@@@explain
A hard reload makes the navigation uncontrolled by the SW. "Disable cache" only affects memory/disk HTTP caches.
:::

:::quiz
### Why must you call `response.clone()` before caching and returning a response?
- [ ] To strip headers
- [x] A response body stream can only be consumed once
- [ ] Cache Storage requires immutable objects
- [ ] To avoid CORS errors
@@@explain
Both the cache and the page need to read the body; a clone gives each its own stream.
:::
