---
title: What a Browser Is & What Happens When You Type a URL
summary: Browser architecture (engines, processes, threads) and a first, gentle walk through the most famous frontend interview question.
minutes: 16
---

## A browser is an operating system for web apps

A browser does far more than "show pages". It is a sandboxed runtime that downloads untrusted code from anywhere and runs it safely. Its main parts:

| Part | Job | Examples |
|---|---|---|
| **User interface** | Address bar, tabs, back button | — |
| **Browser engine** | Coordinates UI and rendering engine | — |
| **Rendering engine** | Turns HTML + CSS into pixels | Blink (Chrome, Edge, Opera, Brave), WebKit (Safari, all iOS browsers), Gecko (Firefox) |
| **JavaScript engine** | Parses, compiles and runs JS | V8 (Chrome, Node.js), JavaScriptCore (Safari), SpiderMonkey (Firefox) |
| **Networking** | DNS, HTTP, caching, TLS | — |
| **Storage** | Cookies, localStorage, IndexedDB, Cache Storage | — |

### Multi-process architecture

Modern Chrome runs many **processes**:

- **Browser process** — UI, address bar, networking, storage coordination.
- **Renderer process** — one per site (roughly), runs the rendering engine + V8 for that tab. Sandboxed: if a page crashes or is malicious, it can't take down other tabs or read your files. This is **site isolation**.
- **GPU process** — draws to the screen.
- Plus network, storage and extension processes.

Inside a renderer, the **main thread** does a lot: parse HTML, compute styles, layout, paint, run your JavaScript and handle events. This is the single most important fact for frontend performance: **if your JS is busy, the page can't respond or repaint.** (The compositor and raster threads can still scroll and run some animations — that's why `transform` animations stay smooth.)

## The famous question: what happens when you type a URL and press Enter?

This is asked at almost every level — juniors get the outline, seniors are expected to go deep. Here is the junior-friendly walk-through; the FE2 "How Browsers Work" module goes much deeper.

:::visual url-journey
:::

### 1. Parse the input

The browser decides: is this a URL or a search query? `example.com` → `https://example.com/`. If the domain is on the **HSTS** list, it upgrades to https directly.

### 2. Check caches / service worker

If a service worker controls this origin it may answer from its cache. Otherwise, the HTTP cache may already have a fresh copy.

### 3. DNS lookup

Resolve `example.com` → IP address (browser cache → OS → resolver → root → TLD → authoritative).

### 4. Open a connection

- **TCP handshake**: SYN → SYN-ACK → ACK (1 round trip).
- **TLS handshake** for HTTPS: agree on keys, verify the certificate (1 round trip in TLS 1.3).
- With HTTP/3, QUIC combines both.

### 5. Send the HTTP request

`GET / HTTP/2` with headers: `Host`, `Accept`, `Cookie`, `User-Agent`, `Accept-Encoding: gzip, br`…

### 6. Server processes and responds

Maybe via a CDN edge, load balancer, app server, database. Response: `200 OK`, `Content-Type: text/html`, compressed body. Or a `301/302` redirect → repeat from step 3 with the new URL.

### 7. Browser parses HTML → DOM

The HTML is parsed **as it streams in**, building the **DOM** tree. When it finds `<link rel="stylesheet">`, `<script>`, `<img>`, it requests them (a **preload scanner** looks ahead to start downloads early).

- A plain `<script>` **blocks parsing** until it's downloaded and executed.
- `defer` / `async` scripts don't block parsing.

### 8. CSS → CSSOM

CSS is parsed into the **CSSOM**. CSS is **render-blocking**: the browser won't paint until it has the CSS (otherwise you'd see a flash of unstyled content).

### 9. Render tree → layout → paint → composite

- **Render tree**: DOM + CSSOM, only visible nodes (no `<head>`, no `display:none`).
- **Layout (reflow)**: compute the exact size and position of every box.
- **Paint**: fill in pixels — text, colours, borders, shadows — into layers.
- **Composite**: the GPU combines layers into the final frame on screen.

### 10. JavaScript runs, page becomes interactive

Scripts run, attach event listeners, maybe fetch data and update the DOM (which can trigger layout and paint again). `DOMContentLoaded` fires when HTML is parsed; `load` fires when images and everything else finish.

```text
URL ─▶ cache? ─▶ DNS ─▶ TCP ─▶ TLS ─▶ HTTP request ─▶ response
     ─▶ HTML parse ─▶ DOM ┐
     ─▶ CSS parse ─▶ CSSOM┴▶ render tree ─▶ layout ─▶ paint ─▶ composite ─▶ 🎉
                    JS executes, may modify DOM/CSSOM ─┘
```

:::callout interview What interviewers look for
Structure (network phase → rendering phase), correct order, and at least one "why it matters": e.g. *"CSS is render-blocking and synchronous scripts are parser-blocking, so we put scripts at the end or use `defer`, inline critical CSS and preconnect to third-party origins."*
:::

## Rendering engines and cross-browser differences

Because Safari uses WebKit and all iOS browsers must use WebKit, "it works in Chrome" doesn't mean it works on an iPhone. Practical habits:

- Check support on **caniuse.com** / MDN compatibility tables.
- Use a CSS reset or normalize, and **Autoprefixer** for vendor prefixes.
- Feature-detect (`if ('IntersectionObserver' in window)`, `@supports (display: grid)`) instead of sniffing user agents.
- Test on real devices (BrowserStack, or at least Safari + Chrome + Firefox).
- **Polyfills** fill missing APIs; **transpilers** (Babel, SWC) rewrite new syntax to old.

:::question
difficulty: easy
companies: Housing.com, CRED, Reddit
### What happens when you type a URL in the browser and press Enter?
1. **Input parsing** — URL vs search; HSTS upgrade to https.
2. **Caches** — service worker, HTTP cache.
3. **DNS** — resolve domain to IP (browser → OS → resolver → root → TLD → authoritative).
4. **Connection** — TCP 3-way handshake + TLS handshake (or QUIC for HTTP/3).
5. **Request** — HTTP GET with headers and cookies.
6. **Response** — possibly redirects; HTML arrives, often compressed and via a CDN.
7. **Parsing** — HTML → DOM (streaming, preload scanner fetches subresources); CSS → CSSOM.
8. **Blocking rules** — CSS blocks rendering; synchronous scripts block parsing; `defer`/`async` don't.
9. **Render** — render tree → layout → paint → composite.
10. **Interactivity** — JS runs, event listeners attached, `DOMContentLoaded` then `load`.

Close with an optimization: fewer origins / preconnect, CDN, compression, critical CSS, defer scripts, optimized images.
:::

:::question
difficulty: easy
### What is the difference between a rendering engine and a JavaScript engine?
The **rendering engine** (Blink, WebKit, Gecko) parses HTML and CSS, computes styles, lays out boxes and paints pixels. The **JavaScript engine** (V8, JavaScriptCore, SpiderMonkey) parses and executes JavaScript, using JIT compilation and garbage collection. They cooperate through the DOM APIs: when JS calls `element.style.width = '10px'`, the JS engine calls into the rendering engine, which marks layout as dirty.
:::

:::question
difficulty: medium
companies: Walmart
### How do you ensure consistent rendering across different browsers and devices?
- Start from a CSS reset/normalize so default styles (margins, form controls) are consistent.
- Use standard, well-supported features; check caniuse/MDN; use `@supports` for progressive enhancement.
- Autoprefixer + Browserslist to generate vendor prefixes and choose transpile targets.
- Polyfill missing APIs only where needed; transpile modern syntax with Babel/SWC.
- Responsive design: fluid layouts with Flexbox/Grid, relative units, the viewport meta tag, test breakpoints.
- Feature detection over user-agent sniffing.
- Test on real browsers/devices (Safari/WebKit especially), with visual regression tests (Playwright screenshots, Chromatic) in CI.
:::

:::question
difficulty: medium
### Why is it said that JavaScript runs on the "main thread", and why does it matter?
In each renderer, a single main thread runs JavaScript **and** does style calculation, layout, paint and input handling. While a long JS task (say 300 ms of JSON processing) runs, the browser cannot respond to clicks or paint new frames — the page "freezes". That's why we keep tasks short (< 50 ms), split work, debounce handlers, use Web Workers for heavy computation, and prefer compositor-only animations (`transform`, `opacity`).
:::

:::quiz
### Which of these blocks the browser from *painting* the page?
- [x] A stylesheet in the `<head>`
- [ ] An image in the body
- [ ] A script with `defer`
@@@explain
CSS is render-blocking. Images load asynchronously; deferred scripts don't block parsing or rendering.
:::

:::quiz
### Every browser on iOS uses which rendering engine?
- [ ] Blink
- [x] WebKit
- [ ] Gecko
@@@explain
Apple has historically required WebKit on iOS, so Chrome on iPhone renders like Safari (with recent regulatory exceptions in some regions).
:::

:::quiz
### What does site isolation protect against?
- [ ] Slow DNS lookups
- [x] One malicious or crashed site affecting other sites' tabs and data
- [ ] CSS conflicts between pages
@@@explain
Each site gets its own sandboxed renderer process, so memory from one site isn't in the same process as another.
:::
