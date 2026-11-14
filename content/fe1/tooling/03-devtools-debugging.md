---
title: DevTools & Debugging Like a Pro
summary: Elements, Console, Sources breakpoints, Network (and why "Disable cache" doesn't bypass service workers), Application storage, Performance, and a systematic debugging process.
minutes: 17
---

## Debugging is a process, not luck

Good debuggers don't guess — they **reproduce, isolate, inspect, hypothesize, verify**:

1. **Reproduce** reliably (exact steps, browser, data, account). Can't fix what you can't trigger.
2. **Read the error** — message, stack trace, file and line. Most bugs announce themselves.
3. **Isolate** — which layer? Network (bad data), state, rendering, CSS? Binary-search: comment out halves, `git bisect` for regressions.
4. **Inspect** real values with breakpoints instead of assuming.
5. **Form one hypothesis, test it**, change one thing at a time.
6. **Fix the root cause**, add a test that would have caught it, and check for the same bug elsewhere.

Chrome DevTools (`F12` / `Cmd+Opt+I`) is your microscope. Firefox and Safari have equivalents.

## Elements panel

- Inspect any element (`Cmd/Ctrl+Shift+C`), edit HTML/CSS live.
- **Styles** pane shows every matching rule in cascade order, with overridden declarations struck through — perfect for "why isn't my style applying?" (specificity!). Hover a selector to see its specificity.
- **Computed** tab shows final values and which rule set them; the box-model diagram shows real margin/padding.
- Toggle states `:hover`, `:focus`, `:active` with the `:hov` button.
- Flex/Grid badges overlay the layout lines.
- Right-click a node → **Break on → subtree modifications / attribute modifications** to catch the JS that changes it.
- **Accessibility** pane shows the computed role/name — great for checking ARIA.

## Console

```js
console.log('user', user)          // pass objects as separate args (inspectable, not "[object Object]")
console.table(users)               // arrays of objects as a table
console.dir(element)               // element as JS object
console.group('checkout'); …; console.groupEnd()
console.time('sort'); …; console.timeEnd('sort')
console.count('render')            // how many times did this run?
console.trace()                    // print the call stack here
console.assert(x > 0, 'x must be positive')
```

Console tricks: `$0` is the element selected in Elements; `$('sel')`/`$$('sel')` query the page; `copy(obj)` copies to clipboard; `monitorEvents(window, 'resize')`; `queryObjects(Promise)` finds live objects.

:::callout warn console.log of objects is "live"
DevTools evaluates the object lazily when you **expand** it, so you may see the value *after* later mutations. Log `structuredClone(obj)` or `JSON.stringify(obj)` when you need a snapshot — or, better, use a breakpoint.
:::

## Sources panel: breakpoints

Breakpoints pause execution so you can inspect **everything**: local variables, closures, `this`, the call stack.

| Breakpoint | How | Use when |
|---|---|---|
| Line | Click a line number | You know where to look |
| Conditional | Right-click → "Add conditional breakpoint" (`item.id === 42`) | Loop/handler runs many times |
| Logpoint | Right-click → "Add logpoint" | Want a `console.log` without editing code |
| `debugger;` statement | In your code | Quick, but don't commit it |
| DOM change | Elements → Break on… | Something mutates an element |
| XHR/fetch | Sources → XHR/fetch breakpoints (URL contains `/api/cart`) | Find what triggers a request |
| Event listener | Sources → Event Listener Breakpoints (e.g. `click`) | Find the handler for an interaction |
| Exceptions | "Pause on uncaught/caught exceptions" | Errors swallowed or thrown deep inside |

While paused:

- **Step over** (F10) — next line. **Step into** (F11) — into the function call. **Step out** (Shift+F11). **Resume** (F8).
- **Scope** pane: Local, Closure, Script, Global variables.
- **Call Stack**: click any frame to see its variables — how did we get here?
- **Watch** expressions; hover over variables; run code in the console *in the paused scope*.

**Source maps** map minified production code back to your original TS/JSX. Use "Ignore list" (blackbox) to skip framework/library frames when stepping.

## Network panel

Every request: URL, method, status, type, initiator (who requested it), size, time, and a **waterfall**.

- Click a request → **Headers** (request/response, CORS headers, cookies), **Payload**, **Preview/Response**, **Timing** (DNS, connect, TLS, waiting for server = TTFB, content download).
- Filter by `Fetch/XHR`, `JS`, `CSS`, `Img`; search `status-code:500`, `larger-than:100k`, `-domain:google-analytics.com`.
- **Throttling** (Fast 4G, Slow 4G, Offline) — test loading states and slow devices.
- **Preserve log** — keep requests across navigations/redirects.
- Right-click → **Copy as cURL / fetch** to replay a request; **Block request URL** to test failures; **Override content** to mock a response locally.
- Size column shows `(memory cache)`, `(disk cache)`, `(ServiceWorker)` for cached responses.

### "Disable cache" — and the service-worker surprise

Checking **Disable cache** (only while DevTools is open) bypasses the browser's **HTTP cache**: the **memory cache** (RAM, super fast, dies with the tab) and the **disk cache** (persists across sessions). But many sites (e.g. large e-commerce PWAs) still load assets "instantly" — because a **service worker** intercepted the request and answered from the **Cache Storage API**, which lives outside the HTTP cache. Such rows show `(ServiceWorker)` in the size column and take a few ms (a hop to the SW thread).

To truly hit the network:

1. Application → Service Workers → tick **Bypass for network** (or Update on reload / Unregister).
2. Or hard reload (`Cmd/Ctrl+Shift+R`) — which bypasses the SW for that navigation.
3. Or Application → Storage → **Clear site data**.

:::visual cache-layers
:::

## Application panel

Inspect and edit **storage**: Local Storage, Session Storage, IndexedDB, Cookies (see `HttpOnly`, `Secure`, `SameSite` flags and expiry), Cache Storage, Service Workers, the web app Manifest, and "Clear site data". Extensions have their own storage (`chrome.storage`) visible when inspecting the extension's pages.

## Performance & Lighthouse

- **Performance** panel: record an interaction; look for **long tasks** (red-cornered, > 50ms) on the main thread, forced reflows ("Layout" triggered from JS), and dropped frames.
- **Lighthouse**: audits performance (Core Web Vitals), accessibility, best practices, SEO.
- **Memory** panel: heap snapshots to find leaks (detached DOM nodes, growing arrays) — covered in FE2/FE3.
- **React DevTools**: component tree, props/state/hooks, and the **Profiler** ("why did this render?").

## Debugging in VS Code

Use a `launch.json` "Chrome" configuration or the JavaScript Debug Terminal to set breakpoints in your editor for browser code, Node scripts and tests (`vitest --inspect`).

## Common bugs and where to look

| Symptom | First place to look |
|---|---|
| Blank page | Console errors; Network for 404 on the JS bundle |
| "Cannot read properties of undefined (reading 'x')" | Breakpoint on the line; check API response shape in Network |
| Style not applied | Elements → Styles (struck-through? specificity? typo? media query?) |
| API call fails | Network → status, response body, request payload, CORS errors in Console |
| Works locally, not in prod | Env vars, caching (old bundle / SW), source maps, different API data |
| Slow interaction | Performance panel: long tasks, re-renders (React Profiler) |
| Old code still served after deploy | Cache headers on `index.html`, service worker update, CDN invalidation |

:::question
difficulty: easy
companies: Agoda
### How do you debug JavaScript and React applications effectively?
Reproduce reliably, read the error and stack trace, then isolate the layer: Network panel to verify request/response data and status, Console for errors, Sources breakpoints (conditional breakpoints, logpoints, XHR/event-listener/exception breakpoints) to inspect real values, scope and call stack instead of guessing, Elements panel for DOM/CSS issues. For React: React DevTools to inspect props/state/hooks and the Profiler to see why components re-render; error boundaries and logging (Sentry) for production errors with source maps. Use `git bisect` for regressions. Fix the root cause and add a test.
:::

:::question
difficulty: medium
### You ticked "Disable cache" in DevTools but files still load instantly. Why?
"Disable cache" only bypasses the browser's HTTP cache (memory cache and disk cache). If the site has a **service worker**, it runs on its own thread, intercepts fetches and can respond from **Cache Storage**, which is separate from the HTTP cache — so assets still come back quickly (shown as "(ServiceWorker)" in Network). To bypass it, enable "Bypass for network" under Application → Service Workers, unregister it, clear site data, or hard reload.
:::

:::question
difficulty: easy
### What's the difference between memory cache and disk cache in the Network panel?
**Memory cache** keeps recently used resources in RAM for the current tab/session — ~0 ms, but cleared when the tab/process closes; typically used for resources reused in the same page load or quick navigations. **Disk cache** persists HTTP-cached responses on disk across sessions and restarts — slightly slower but long-lived, governed by `Cache-Control`/`ETag` headers. Both are part of the HTTP cache that "Disable cache" bypasses.
:::

:::question
difficulty: medium
### What's a conditional breakpoint and a logpoint, and when would you use them?
A **conditional breakpoint** pauses only when an expression is true (`order.total < 0`), ideal inside loops, render functions or event handlers that fire constantly. A **logpoint** logs an expression every time the line runs without pausing and without editing/rebuilding code — like a temporary `console.log` you can add in production-like builds via source maps.
:::

:::challenge
difficulty: easy
### Find the bug
This function should return the total price of items in the cart, but it returns `"0100200"` for `[{price: 100}, {price: 200}]` when the prices come from an API. Explain what's wrong, how you'd find it with DevTools, and fix it.
```js
function cartTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0)
}
```
@@@starter
```js
function cartTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0)
}
```
@@@tests
```js
test('number prices', () => { expect(cartTotal([{ price: 100 }, { price: 200 }])).toBe(300) })
test('string prices from API', () => { expect(cartTotal([{ price: '100' }, { price: '200' }])).toBe(300) })
test('bad values count as 0', () => { expect(cartTotal([{ price: 'abc' }, { price: 50 }])).toBe(50) })
test('empty', () => { expect(cartTotal([])).toBe(0) })
```
@@@solution
The API returns prices as **strings** (`"100"`). `0 + "100"` is string concatenation → `"0100"`, then `"0100" + "200"` → `"0100200"`.

How to find it: Network panel → the API response shows `"price": "100"` (quoted). Or a breakpoint inside the reducer shows `item.price` typed as a string in the Scope pane; `typeof item.price` in the console confirms.

```js
function cartTotal(items) {
  return items.reduce((sum, item) => {
    const price = Number(item.price)
    return sum + (Number.isFinite(price) ? price : 0)
  }, 0)
}
```
Better long-term: validate/parse API responses at the boundary (e.g. Zod schema, TypeScript types generated from the API) so the rest of the app can trust the data. For money, prefer integer paise/cents to avoid floating-point errors like `0.1 + 0.2`.
:::

:::quiz
### Which breakpoint helps you find which code triggered a specific API request?
- [ ] Line breakpoint
- [x] XHR/fetch breakpoint (URL contains …)
- [ ] DOM subtree modification breakpoint
@@@explain
It pauses at the moment the request is sent, with the full call stack.
:::

:::quiz
### What does `$0` refer to in the console?
- [x] The element currently selected in the Elements panel
- [ ] The first console log
- [ ] The window object
@@@explain
`$0` is the most recently inspected element; `$1` the one before.
:::

:::quiz
### A user still sees the old version of your app after a deploy. A likely culprit is…
- [ ] DNS
- [x] Cached `index.html` or an un-updated service worker
- [ ] CSS specificity
@@@explain
Hashed assets are fine to cache, but `index.html` must be revalidated and service workers must activate the new version.
:::
