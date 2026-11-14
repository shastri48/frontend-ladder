---
title: Scripts — async, defer, module and Dynamic Loading
summary: Where JavaScript blocks the parser, how async/defer/module change that, when each is the wrong choice, and loading scripts dynamically through the DOM.
minutes: 13
---

## Where JavaScript blocks things

A classic `<script src="app.js">` in the `<head>` does this:

1. The HTML parser **stops**.
2. The browser downloads `app.js` (round trip!).
3. It waits for any pending **stylesheets** (the script might read styles).
4. It executes the script.
5. Only then does parsing continue.

That's why the old advice was "put scripts at the bottom of `<body>`". Today we have better tools.

:::visual script-loading
:::

## The four flavours

| Attribute | Download | Executes | Order preserved? | Blocks parser? |
|---|---|---|---|---|
| none (classic) | Immediately, blocks parsing | Immediately when downloaded | Yes | **Yes** |
| `async` | In parallel with parsing | As soon as it's downloaded (pauses parser briefly to run) | **No** | Only while executing |
| `defer` | In parallel with parsing | After parsing finishes, **before** `DOMContentLoaded` | **Yes** (document order) | No |
| `type="module"` | In parallel (+ its imports) | Deferred by default | Yes | No |
| `type="module" async` | In parallel | ASAP | No | Only while executing |

```html
<script src="legacy.js"></script>                 <!-- blocks -->
<script src="analytics.js" async></script>         <!-- independent, whenever -->
<script src="vendor.js" defer></script>           <!-- 1st after parse -->
<script src="app.js" defer></script>              <!-- 2nd after parse -->
<script type="module" src="main.js"></script>     <!-- deferred, supports import -->
<script nomodule src="legacy-bundle.js"></script> <!-- only old browsers run this -->
```

Note: `async` and `defer` have **no effect on inline scripts** (except `type="module"` inline scripts, which are deferred).

## When each one is wrong

- **`async` for scripts with dependencies** — `async` scripts run in whatever order they finish downloading. If `app.js` needs `jquery.js` and both are `async`, you get random `$ is not defined` errors.
- **`async` for scripts that need the full DOM** — an async script may run before the parser reaches `#root`.
- **`defer` for something that must run before first paint** — e.g. a theme script that sets `class="dark"` on `<html>` to avoid a flash of the wrong theme. A deferred script runs after parsing, possibly after first paint → flash. Use a tiny **inline, blocking** script in the head for this one job.
- **`defer` for independent third-party widgets** — analytics, chat, ads don't need ordering; `async` (or loading after `load`) gets them out of the way. With `defer` they delay `DOMContentLoaded`.
- **Classic blocking scripts in the head** — almost always wrong for app code.

:::callout tip Rule of thumb
App code: `type="module"` or `defer`. Independent third parties: `async` or lazy-loaded. Tiny "must run before paint" snippets (theme, feature flags in the HTML): inline in `<head>`.
:::

## DOMContentLoaded vs load

- **`DOMContentLoaded`** — HTML fully parsed **and** all `defer`/module scripts executed. Doesn't wait for images, async scripts or iframes. (It does wait for stylesheets only if a script needed them.)
- **`load`** — everything finished: images, stylesheets, iframes, async scripts.

```js
document.addEventListener('DOMContentLoaded', init)
window.addEventListener('load', () => console.log('all assets done'))
```

## Loading JavaScript dynamically via the DOM (no framework)

"Load JavaScript async via the DOM, not using Next.js" is a real interview ask. Scripts inserted via the DOM are **async by default** and never block the parser.

```js
function loadScript(src, { async = true, attrs = {} } = {}) {
  return new Promise((resolve, reject) => {
    // Don't load twice
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded) return resolve(existing)
      existing.addEventListener('load', () => resolve(existing))
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = async          // set false to preserve insertion order among dynamic scripts
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v))
    s.onload = () => { s.dataset.loaded = 'true'; resolve(s) }
    s.onerror = () => { s.remove(); reject(new Error(`Failed to load ${src}`)) }
    document.head.appendChild(s)
  })
}

// Usage: load the payment SDK only when the user reaches checkout
await loadScript('https://sdk.example.com/v3.js', { attrs: { crossorigin: 'anonymous' } })
window.PaymentSDK.init()
```

Other options:

```js
// ES modules: dynamic import returns a promise of the module
const { renderChart } = await import('./chart.js')

// Load after the page is idle
requestIdleCallback(() => loadScript('/chat-widget.js'))

// Load when an element becomes visible
new IntersectionObserver(([e], obs) => {
  if (e.isIntersecting) { loadScript('/comments.js'); obs.disconnect() }
}).observe(document.querySelector('#comments'))
```

Gotchas: scripts inserted with `innerHTML` **do not execute**; you must create a `<script>` element. And by setting `s.async = false` on several dynamic scripts, you get "download in parallel, execute in insertion order" — like `defer` for dynamic scripts.

## Priority hints

```html
<script src="critical.js" defer fetchpriority="high"></script>
<img src="hero.avif" fetchpriority="high" alt="">
<img src="footer-logo.png" loading="lazy" fetchpriority="low" alt="">
```

## Interview questions

:::question
difficulty: medium
companies: CRED
### Explain async vs defer. When is each wrong?
Both download the script in parallel with HTML parsing.

- **async** executes as soon as it arrives, in any order, possibly before parsing finishes. Good for **independent** scripts (analytics, ads). Wrong for scripts that depend on each other or on the full DOM.
- **defer** executes after parsing, in document order, before `DOMContentLoaded`. Good for **app code**. Wrong for scripts that must run before first paint (theme/anti-flicker snippets — inline them) and wasteful for unrelated third parties because they delay `DOMContentLoaded`.

`type="module"` behaves like `defer` by default.
:::

:::question
difficulty: easy
### Why did people put script tags at the end of body?
Because a classic script in the `<head>` blocks HTML parsing (and therefore rendering) until it downloads and executes, and it can't access elements that haven't been parsed yet. Putting it at the end let the page render first and guaranteed the DOM existed. Today `defer`/`type="module"` in the head is better: the download starts earlier (discovered sooner) without blocking parsing.
:::

:::question
difficulty: medium
### Why doesn't a script inserted with innerHTML run?
The HTML spec marks `<script>` elements created by the `innerHTML` parser as "already started", so they never execute — partly as an XSS mitigation and for historic consistency. To run a script dynamically, create it with `document.createElement('script')` and append it; it will be fetched and executed (async by default). Note this is **not** sufficient XSS protection — `<img onerror>` in innerHTML still executes, so sanitize untrusted HTML.
:::

## Challenges

:::challenge
difficulty: medium
### Implement loadScript with deduplication
Write `loadScript(src)` that returns a Promise resolving when the script has loaded. Calling it twice with the same `src` (even concurrently) must insert only one `<script>` and both calls must resolve.
@@@solution
Cache the **promise**, not just a flag — that handles concurrent calls cleanly:

```js
const cache = new Map()

function loadScript(src) {
  if (cache.has(src)) return cache.get(src)
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve(s)
    s.onerror = () => {
      cache.delete(src)   // allow retry
      s.remove()
      reject(new Error(`Failed: ${src}`))
    }
    document.head.append(s)
  })
  cache.set(src, p)
  return p
}
```

Follow-ups: add a timeout (`Promise.race` with a timer), support `integrity`/`crossorigin` attributes for third-party scripts (SRI), and load CSS the same way with a `<link>`.
:::

:::challenge
difficulty: easy
### Predict the order
```html
<script defer src="a.js"></script>   <!-- logs A, 300 KB -->
<script async src="b.js"></script>   <!-- logs B, 1 KB -->
<script defer src="c.js"></script>   <!-- logs C, 1 KB -->
<script>console.log('inline')</script>
<script>document.addEventListener('DOMContentLoaded', () => console.log('DCL'))</script>
```
What is the most likely console order?
@@@solution
Most likely: **`inline`, `B`, `A`, `C`, `DCL`**.

- The inline script runs immediately as the parser reaches it.
- `b.js` is async and tiny, so it probably runs as soon as it arrives — likely during/just after parsing. (Its exact position is not guaranteed — that's the nature of `async`.)
- Deferred scripts run after parsing **in document order**: `A` before `C` even though `c.js` downloaded first.
- `DOMContentLoaded` fires after all deferred scripts.
:::

## Quick check

:::quiz
### Which guarantees execution order AND doesn't block parsing?
- [ ] async
- [x] defer
- [ ] A classic script at the end of body
- [ ] async + defer together
@@@explain
`defer` preserves document order and executes after parsing. If both async and defer are present, modern browsers use async.
:::

:::quiz
### A script created with document.createElement('script') and appended is by default…
- [ ] Parser-blocking
- [x] Async
- [ ] Deferred
- [ ] Not executed
@@@explain
Dynamically inserted scripts are async unless you set `script.async = false`.
:::
