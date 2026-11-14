---
title: The Critical Rendering Path
summary: HTML to DOM, CSS to CSSOM, render tree, layout, paint, composite — and how to optimise the path to first pixels in an SPA.
minutes: 16
---

## What "critical rendering path" means

The **critical rendering path (CRP)** is the minimum sequence of steps the browser must complete to put the **first pixels** on screen. Every resource that must be fetched and processed before that first render is a **critical resource**. Optimising the CRP means: fewer critical resources, fewer critical bytes, and fewer round trips before first paint.

:::visual rendering-pipeline
:::

## Step 1 — HTML → DOM

```text
Bytes → Characters → Tokens → Nodes → DOM
3C 62 6F 64 79 3E  →  "<body>"  →  StartTag:body  →  HTMLBodyElement  →  tree
```

- Parsing is **incremental**: the browser builds the DOM as bytes stream in and can render partial content.
- The HTML parser is **forgiving** — it fixes unclosed tags rather than failing.
- When the parser meets a **classic `<script>`** (no `async`/`defer`), it **stops**, fetches and runs the script, then continues. Scripts might call `document.write` or read the DOM, so the parser must wait.

## Step 2 — CSS → CSSOM

CSS goes through a similar pipeline into the **CSS Object Model**, a tree with cascaded, inherited styles.

- CSS is **render-blocking**: the browser will not paint until the CSSOM for all non-media-matching-excluded stylesheets is ready. Otherwise you'd see a flash of unstyled content (FOUC).
- CSS is also **script-blocking**: a script that runs after a stylesheet may ask `getComputedStyle`, so the browser waits for pending CSS before executing that script.
- Unlike HTML, CSS can't be applied incrementally — a later rule can override an earlier one.

```html
<!-- render-blocking for everyone -->
<link rel="stylesheet" href="main.css">
<!-- only blocks when the media query matches -->
<link rel="stylesheet" href="print.css" media="print">
<link rel="stylesheet" href="wide.css" media="(min-width: 1200px)">
```

## Step 3 — Render tree

DOM + CSSOM → **render tree** (also called the layout tree): only **visible** nodes with their computed styles.

- `display: none` → **not** in the render tree.
- `visibility: hidden` → **in** the render tree (takes space, just invisible).
- `<head>`, `<script>`, `<meta>` → not rendered.
- Pseudo-elements like `::before` → **are** in the render tree even though they aren't in the DOM.

## Step 4 — Layout (reflow)

Computes exact **geometry**: the position and size of every box, starting from the viewport (`<meta name="viewport">` matters on mobile). Percentages, `em`, flex and grid are resolved into pixels. Layout is expensive and usually covers the whole tree on first render.

## Step 5 — Paint

Turns each box into **paint records** — "draw a rectangle here, text there, a shadow" — in stacking order, split across **layers**.

## Step 6 — Composite

Layers are rasterized into tiles (often on the GPU) and the **compositor** combines them in the right order into the final frame. Elements with `transform`, `opacity` animation, `will-change`, `<video>`, `<canvas>` and fixed-position elements often get their own layer.

## The CRP in numbers

Three metrics describe a page's CRP:

- **Critical resources** — how many files block first render (HTML + CSS + sync JS).
- **Critical path length** — how many round trips are needed to fetch them.
- **Critical bytes** — the total size of those files.

```html
<!doctype html>
<html>
<head>
  <link rel="stylesheet" href="style.css">   <!-- critical -->
  <script src="app.js"></script>              <!-- critical, parser-blocking -->
</head>
<body>…</body>
</html>
```

3 critical resources (HTML, CSS, JS), path length ≥ 2 round trips (HTML first, then CSS and JS in parallel).

Make the script `defer` → 2 critical resources. Inline the small critical CSS → 1 critical resource: the HTML itself.

## Optimising the CRP

| Technique | What it improves |
|---|---|
| **Inline critical CSS** (above-the-fold styles), load the rest async | Removes a render-blocking round trip |
| `defer` / `async` / `type="module"` scripts | Removes parser blocking |
| `media` attributes on non-critical CSS | Fewer render-blocking stylesheets |
| **Minify + compress** (Brotli/gzip) | Fewer critical bytes |
| `preload` for late-discovered critical assets (fonts, hero image) | Shorter path length |
| `preconnect` to critical third-party origins | Saves DNS+TCP+TLS later |
| `font-display: swap` / `optional` | Text visible without waiting for font |
| Server-side render or pre-render HTML | Content in the first response |
| Avoid `@import` in CSS | `@import` creates a serial request chain |
| Reduce DOM size | Faster style & layout |

Loading non-critical CSS without blocking render:

```html
<link rel="preload" href="/below-fold.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/below-fold.css"></noscript>
```

## The SPA problem

A classic client-rendered SPA ships this:

```html
<body>
  <div id="root"></div>
  <script src="/bundle.3f9a.js"></script>
</body>
```

The CRP looks short (tiny HTML!) but the **meaningful** render is far away: download a large JS bundle → parse → execute → fetch data → render. The screen is blank until then.

Optimising the CRP in an SPA:

1. **Code-split** by route (`React.lazy`, dynamic `import()`); ship only what the first screen needs.
2. **SSR / SSG / streaming** so the first response contains real HTML (see FE3 rendering strategies).
3. **App shell**: render a static skeleton (header, layout, skeletons) in the HTML so something meaningful paints immediately.
4. **Start data fetching early** — in parallel with code loading (route loaders, `<link rel="preload" as="fetch">`), not in a `useEffect` after render ("waterfalls").
5. `preload` the main chunk and the LCP image; `modulepreload` critical modules.
6. Tree-shake and audit dependencies (bundle analyzer); avoid giant date/charting libraries on the first route.
7. Cache aggressively with hashed filenames + `Cache-Control: immutable`, and consider a Service Worker for repeat visits.

:::callout interview What interviewers look for
Don't just list "minify, compress, lazy-load". Explain **why** CSS blocks rendering, **why** sync scripts block parsing, and how each fix removes a round trip, a critical resource or critical bytes. Then relate it to a metric (FCP, LCP).
:::

## Interview questions

:::question
difficulty: medium
companies: CRED
### Explain the critical rendering path.
The sequence the browser goes through to turn HTML, CSS and JS into pixels:

1. Parse **HTML → DOM** (incrementally). Classic scripts pause the parser.
2. Parse **CSS → CSSOM**. CSS is render-blocking.
3. Combine into the **render tree** — visible nodes only (`display:none` excluded, pseudo-elements included).
4. **Layout** — calculate geometry of every box.
5. **Paint** — create draw commands per layer.
6. **Composite** — rasterize layers and combine them on the GPU into the frame.

Optimising it = minimizing critical resources, critical bytes and critical path length (round trips), e.g. inline critical CSS, defer JS, preload key assets, compress, SSR.
:::

:::question
difficulty: medium
### Why is CSS render-blocking but images are not?
Painting without CSS would show unstyled content and then restyle it (FOUC), and CSS rules can override each other, so the browser needs the complete CSSOM before it can know what anything looks like. Images don't change other elements' styles; the browser can lay out a placeholder (ideally with known `width`/`height` to avoid layout shift) and paint the image when it arrives.

CSS is also **script-blocking**: a script after a stylesheet waits for that CSS, because the script may read computed styles.
:::

:::question
difficulty: medium
### What is the difference between `display: none`, `visibility: hidden` and `opacity: 0`?
| | In render tree | Takes space | Receives events | Animatable cheaply |
|---|---|---|---|---|
| `display: none` | No | No | No | No (toggling causes layout) |
| `visibility: hidden` | Yes | Yes | No | Toggling causes repaint |
| `opacity: 0` | Yes | Yes | **Yes** (still clickable!) | Yes — compositor-only |

Screen readers ignore `display:none` and `visibility:hidden` content but may still read `opacity:0` content.
:::

:::question
difficulty: hard
companies: Agoda
### If a home page takes 5 seconds to load, how would you approach reducing it?
1. **Measure first**: Lighthouse / PageSpeed (lab), RUM data (CrUX, web-vitals library), and the Chrome DevTools **Performance** and **Network** panels on a throttled mid-range mobile profile. Identify *which* metric is bad: TTFB? FCP? LCP? TBT/INP?
2. **Network/server (TTFB)**: CDN, caching HTML at the edge, fewer redirects, HTTP/2–3, server/database profiling.
3. **Render-blocking resources (FCP)**: inline critical CSS, defer/async JS, remove unused CSS, avoid `@import`, preconnect to critical origins.
4. **JavaScript cost (TBT/INP)**: bundle analyzer, route-based code splitting, remove heavy deps, tree shaking, defer third-party scripts (analytics, chat widgets), move work to workers.
5. **LCP element**: preload the hero image, use modern formats (AVIF/WebP), responsive `srcset`, `fetchpriority="high"`, never lazy-load the LCP image.
6. **Data waterfalls**: fetch data in parallel with code, or server-render the first view.
7. **Repeat visits**: hashed assets with long `max-age`, service worker caching.
8. **Verify** the improvement with the same metrics and set a **performance budget** in CI.
:::

## Challenges

:::challenge
difficulty: medium
### Count the critical resources
```html
<html>
<head>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="print.css" media="print">
  <script src="analytics.js" async></script>
  <script src="app.js"></script>
</head>
<body><h1>Hello</h1><img src="hero.jpg"></body>
</html>
```
How many critical (render-blocking or parser-blocking) resources are there? How would you get it down to one?
@@@solution
Critical resources: **HTML**, **styles.css** (render-blocking), **app.js** (parser-blocking) → **3**.

Not critical: `print.css` (media doesn't match screen — downloaded at low priority, doesn't block), `analytics.js` (`async` — doesn't block parsing), `hero.jpg` (images never block first render).

To get to **1** (just the HTML):
- Inline the critical part of `styles.css` in a `<style>` tag and load the rest non-blocking.
- Add `defer` to `app.js` (or `type="module"`, which defers by default).
:::

:::challenge
difficulty: medium
### Spot the waterfall
A React SPA's first screen does: download `main.js` (400 KB) → render `<App/>` → `useEffect` fetches `/api/user` → after it resolves, `<Dashboard/>` mounts → its `useEffect` fetches `/api/widgets` → `React.lazy` loads `Chart.js` chunk. What's wrong and how do you fix it?
@@@solution
It's a **serial waterfall**: code → data → data → code, each step waiting for the previous. Total time ≈ sum of all round trips.

Fixes:
- **Parallelize**: start `/api/user` and `/api/widgets` fetches at the route level (a loader or a query prefetch) at the same time as loading code, not inside child effects.
- **Preload** the chart chunk when the route starts (`import('./Chart')` call early, or `<link rel="modulepreload">`).
- **Code-split** `main.js` so the first route ships less JS.
- **Server-render** or stream the shell with initial data so the user sees content before JS finishes.
- Show **skeletons** for each region so the page is progressively useful.
:::

## Quick check

:::quiz
### Which element is NOT in the render tree?
- [ ] An element with `visibility: hidden`
- [x] An element with `display: none`
- [ ] A `::before` pseudo-element with content
- [ ] An element with `opacity: 0`
@@@explain
`display:none` removes the box from rendering entirely. The others are rendered (taking space) even if invisible.
:::

:::quiz
### What makes `<link rel="stylesheet" href="x.css" media="print">` non-render-blocking on screen?
- [ ] It is downloaded asynchronously by default
- [x] Its media query does not match, so the browser doesn't need it for the current render
- [ ] Print stylesheets are never downloaded
- [ ] It is deferred until DOMContentLoaded
@@@explain
The browser still downloads it (low priority) but doesn't wait for it before painting.
:::
