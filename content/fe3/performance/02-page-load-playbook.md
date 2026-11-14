---
title: The Page-Load Optimisation Playbook
summary: "The home page takes 5 seconds" — a systematic approach covering network, JavaScript, images, fonts, CSS, resource hints, caching and CDNs.
minutes: 22
---

## The question you will be asked

> "Our home page takes 5 seconds to load. How would you reduce it?"
> "How would you cut the initial load time of a React app by 40%?"

These are the most common senior frontend performance questions (Accenture, Walmart, Razorpay and many others). A weak answer lists techniques. A strong answer **follows the bytes from server to pixels**, quantifies where time goes, and fixes the biggest slice first.

:::callout analogy Shipping a flat-pack wardrobe
Loading a page is like delivering a wardrobe: the warehouse must find it (TTFB), the truck must drive (network), the box must be small enough (bytes), and then someone must assemble it (parse/execute JS, render). Making the screwdriver faster doesn't help if the truck is stuck in traffic.
:::

## Step 0 — Find where the 5 seconds go

Record a page load in the Performance panel with **4× CPU throttling + Fast 4G**, and look at the waterfall in the Network panel. Break the time into:

```text
|--TTFB--|--HTML/CSS download & parse--|--JS download--|--JS parse/execute + hydrate--|--LCP image--|
  0.9s             0.4s                      1.2s                 1.8s                       0.7s
```

Now you know a 0.9 s server problem, a 3 s JavaScript problem and a 0.7 s image problem. Fix them in that order of size.

## Step 1 — Server & network (TTFB)

- **CDN** for static assets *and* cacheable HTML (edge caching, stale-while-revalidate).
- **Compression**: Brotli (≈15–20% smaller than gzip for text) with gzip fallback.
- **HTTP/2 or HTTP/3**: multiplexing removes the "6 connections per host" bottleneck; stop domain sharding.
- **Kill redirects** (`http → https → www → /home` costs a round trip each).
- **Server rendering / caching**: if the HTML is generated per request, cache it or move to SSG/ISR where content allows.
- **`103 Early Hints`** lets the CDN tell the browser to start fetching CSS/fonts while the server is still thinking.

## Step 2 — JavaScript: ship less, run less

JavaScript is the most expensive byte: it must be downloaded, parsed, compiled and executed on the main thread, and then React must hydrate.

1. **Route-based code splitting** — each route is its own chunk:

```jsx
import { lazy, Suspense } from 'react'
const Dashboard = lazy(() => import('./routes/Dashboard'))
const Settings  = lazy(() => import('./routes/Settings'))

<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</Suspense>
```

2. **Component-level / interaction splitting** — heavy things the user may never open (charts, rich-text editor, maps, PDF viewer) load on demand:

```jsx
const Chart = lazy(() => import('./HeavyChart'))
// prefetch when the user shows intent
<button onMouseEnter={() => import('./HeavyChart')} onClick={() => setOpen(true)}>Show chart</button>
```

3. **Tree shaking** — use ES modules (`lodash-es`, named imports), mark packages `"sideEffects": false`, avoid barrel files that re-export everything in large apps.
4. **Replace heavy dependencies** — `moment` (≈70 KB+) → `date-fns`/`dayjs`; big UI kits → import per component; polyfills only for browsers you support (modern `browserslist`, differential serving).
5. **Defer third parties** — analytics, chat widgets, A/B scripts: load with `async`/`defer`, after `load`, on interaction, or move off-thread (Partytown).
6. **Reduce hydration cost** — SSR + partial/progressive hydration, React Server Components (zero-JS components), islands architecture.
7. **Modern output** — ES2020+ output is smaller and faster than ES5 transpilation.

## Step 3 — Images (usually the LCP element)

```html
<!-- Hero/LCP image: never lazy, high priority, explicit size, modern format -->
<img
  src="/hero-1200.avif"
  srcset="/hero-600.avif 600w, /hero-1200.avif 1200w, /hero-2000.avif 2000w"
  sizes="(max-width: 768px) 100vw, 1200px"
  width="1200" height="600"
  fetchpriority="high"
  alt="Summer sale on running shoes"
/>

<!-- Below the fold: native lazy loading -->
<img src="/card.webp" loading="lazy" decoding="async" width="300" height="200" alt="…" />
```

- **AVIF/WebP** are 30–50% smaller than JPEG/PNG.
- **Responsive `srcset`/`sizes`** — don't send a 2000px image to a 375px phone.
- **Always set `width`/`height`** (or `aspect-ratio`) to prevent CLS.
- **Never lazy-load the LCP image** — a classic Lighthouse finding.
- Use an **image CDN** (Cloudinary, imgix, Next/Image) to resize and convert on the fly.

## Step 4 — CSS and fonts

- **CSS is render-blocking** by design. Inline the small **critical CSS** for above-the-fold content in `<head>`, load the rest asynchronously, remove unused CSS (PurgeCSS/Tailwind JIT).
- **Fonts**: self-host WOFF2, subset to the characters you need, `font-display: swap` (or `optional` to avoid shift), preload the one or two fonts used above the fold, and use `size-adjust` fallback metrics to stop CLS on swap.

```html
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
```

## Step 5 — Resource hints

| Hint | Meaning | Use for |
|---|---|---|
| `preconnect` | Do DNS + TCP + TLS now | Critical third-party origins (API, CDN, fonts) |
| `dns-prefetch` | Only DNS | Less important origins |
| `preload` | Fetch this resource now, high priority, for **this** page | LCP image, critical font, critical CSS discovered late |
| `prefetch` | Fetch at idle priority for a **future** navigation | Next route's chunk |
| `modulepreload` | Preload + parse an ES module | Critical JS modules |
| `fetchpriority` | Raise/lower priority | LCP image `high`, carousel images `low` |

Over-preloading is a real anti-pattern: preload competes for bandwidth, and preloading ten things means nothing is prioritised.

## Step 6 — Caching

- Hash filenames (`app.3f9a1c.js`) and serve them with `Cache-Control: public, max-age=31536000, immutable`.
- HTML: `Cache-Control: no-cache` (always revalidate) or short `s-maxage` + `stale-while-revalidate` at the CDN.
- API responses: ETags, client caching (React Query/SWR), and a service worker for repeat visits/offline.
- Split vendor chunks so a one-line app change doesn't invalidate the cached React bundle.

## Step 7 — Render smarter

- Skeletons instead of spinners (perceived performance and lower CLS).
- Render above-the-fold first; `content-visibility: auto` for long below-the-fold sections.
- Avoid request waterfalls (component A fetches, then renders B which fetches): hoist and parallelise fetches, use route loaders or server components.

## A concrete "40% faster" story

```text
Before: LCP 4.8s (p75 mobile), JS 920 KB gz, hero 1.1 MB JPEG
1. Route + component splitting     → main JS 920 → 310 KB
2. Replaced moment, lodash         → −85 KB
3. Hero → AVIF + srcset + fetchpriority=high + preload → 1.1 MB → 140 KB
4. Brotli + CDN edge caching HTML  → TTFB 900 → 180 ms
5. Analytics/chat after load       → TBT 1200 → 260 ms
After: LCP 2.3s (−52%), INP 180ms, CLS 0.03
Guard: size-limit + Lighthouse CI budgets in PR checks
```

:::callout interview What makes the answer senior
Quantify, prioritise by impact, mention **field verification** after the fix, and finish with **prevention** (budgets, CI, ownership). Bonus points for trade-offs: "Too many tiny chunks hurt on HTTP/1.1 and increase request overhead; I group by route."
:::

:::question
difficulty: medium
companies: Accenture, Walmart
### A home page takes 5 seconds to load. How would you reduce it?
1. **Measure & segment**: field p75 LCP/INP for the page, then a throttled Performance recording + network waterfall to split the 5 s into TTFB, render-blocking CSS/JS, JS execution/hydration and LCP resource load.
2. **TTFB**: CDN, edge-cache HTML or SSG/ISR, Brotli, remove redirects, HTTP/2/3, early hints.
3. **JavaScript**: route/component code splitting with `React.lazy`, tree shaking, replace heavy libraries, defer third-party scripts, reduce hydration (SSR/RSC/islands), modern build target.
4. **LCP image**: AVIF/WebP, responsive `srcset`, `fetchpriority="high"` + preload, explicit dimensions, never lazy-load it.
5. **CSS/fonts**: critical CSS inline, rest async, purge unused, WOFF2 subset, `font-display`.
6. **Caching**: immutable hashed assets, vendor chunk split, React Query/SWR for API data, service worker for repeat visits.
7. **Perceived performance**: skeletons, stream the shell first.
8. **Verify and guard**: compare before/after with RUM, add bundle and Lighthouse budgets in CI.
:::

:::question
difficulty: easy
### What is the difference between preload, prefetch and preconnect?
- **preconnect** warms up a connection (DNS + TCP + TLS) to an origin you'll use soon; it downloads nothing.
- **preload** downloads a specific resource **for the current page** at high priority — useful for resources the browser discovers late (a font referenced inside CSS, an LCP image set via CSS or JS).
- **prefetch** downloads a resource at **lowest priority** for a **likely future navigation** and stores it in the HTTP cache.

Misuse: preloading things not used within a few seconds triggers a console warning and wastes bandwidth that the critical path needed.
:::

:::question
difficulty: medium
### What is tree shaking and why does it sometimes fail?
Tree shaking is dead-code elimination based on the **static structure of ES modules**: the bundler sees which named exports are imported and drops the rest. It fails when:

- The library is CommonJS (`require`/`module.exports`) — dynamic and not statically analysable.
- Modules have **side effects** at import time and the package doesn't declare `"sideEffects": false`, so the bundler must keep them.
- You import a namespace/default object and use it dynamically (`import _ from 'lodash'; _[name]()`).
- Babel transpiles ESM to CommonJS before the bundler sees it (`modules: false` fixes this).
- Barrel files (`index.ts` re-exporting everything) with side-effectful modules.
:::

:::question
difficulty: medium
### Should every image be lazy loaded?
No. **Below-the-fold** images should use `loading="lazy"`. The **LCP image** (usually the hero above the fold) must load eagerly with `fetchpriority="high"` — lazy loading it delays LCP because the browser waits for layout to decide it's in the viewport. Also give every image `width`/`height` or `aspect-ratio` to avoid layout shift.
:::

:::challenge
difficulty: hard
companies: Walmart
### Reduce initial load of a React SPA by 40%
You inherit a create-react-app SPA: one 1.4 MB (minified) bundle, all routes imported eagerly, `moment` with locales, a full icon library imported via `import * as Icons`, Google Fonts via CSS `@import`, a 900 KB PNG hero, and three marketing scripts in `<head>` without `async`. Outline your plan with expected impact and how you'd prove the 40%.
@@@hint
Group fixes by cost category: bytes over the network, main-thread JS work, render-blocking resources, and the LCP element.
@@@solution
**Baseline**: record p75 LCP/INP/TBT from RUM (or set up `web-vitals` reporting first), plus Lighthouse mobile median of 5 runs and bundle stats. Define "load" precisely — e.g. LCP and TTI/TBT.

**Plan, highest impact first**

| # | Change | Why | Expected impact |
|---|---|---|---|
| 1 | Marketing scripts → `async`/`defer`/after `load` or via tag manager on idle | They block parsing and the main thread | FCP −0.5–1 s, TBT large drop |
| 2 | Hero PNG → AVIF/WebP + `srcset` + `fetchpriority="high"` + width/height | LCP element is 900 KB | LCP −1 s on 4G |
| 3 | Route-level `React.lazy` + `Suspense` | Users download only the current route | Main bundle −50–60% |
| 4 | `moment` → `dayjs`/`date-fns`, strip locales | ~230 KB minified with locales | −200 KB |
| 5 | Icons: named imports / per-icon modules | `import *` defeats tree shaking | −100–300 KB |
| 6 | Fonts: self-host WOFF2, `preload`, `font-display: swap`, remove CSS `@import` (it's a serial request chain) | Render-blocking chain | FCP −300 ms |
| 7 | Brotli + immutable caching + vendor chunk | Smaller transfer, better repeat visits | −20% bytes |
| 8 | Migrate CRA → Vite with modern browserslist | Less transpilation/polyfills | −10–15% JS |

**Proof**: same Lighthouse profile, median of 5 runs, before/after; WebPageTest filmstrip comparison; and most importantly RUM p75 LCP over the following week, segmented by mobile. Add `size-limit` with a budget equal to the new bundle size + 5% so it can't regress.
:::

:::challenge
difficulty: medium
### Spot the problems in this `<head>`
```html
<head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
  <script src="/analytics.js"></script>
  <link rel="stylesheet" href="/styles.css">
  <script src="/vendor.js"></script>
  <script src="/app.js"></script>
  <link rel="preload" href="/hero.jpg">
</head>
<body>
  <img src="/hero.jpg" loading="lazy">
```
@@@solution
1. **Google Fonts stylesheet** from a third-party origin with no `preconnect` → extra DNS/TCP/TLS; better self-host or add `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com` (crossorigin), plus `display=swap`.
2. **`analytics.js` synchronous in head** blocks HTML parsing → `async`, or load after `load`.
3. **`vendor.js` and `app.js` synchronous** → `defer` (or `type="module"`), so parsing continues and they execute in order after parsing.
4. **`preload` missing `as="image"`** → the browser can't prioritise or reuse it correctly and may fetch twice; add `as="image"` and `fetchpriority="high"`.
5. **Hero image is lazy** → LCP delayed; remove `loading="lazy"`.
6. **Hero has no `width`/`height`/`alt`** → layout shift and accessibility failure.
7. No `meta viewport` / `charset` shown — charset should be the very first element in head.
:::

:::quiz
### Which attribute should the LCP hero image have?
- [ ] loading="lazy"
- [x] fetchpriority="high"
- [ ] decoding="sync" only
- [ ] async
@@@explain
Lazy-loading the LCP image delays it; fetchpriority="high" moves it up the queue.
:::

:::quiz
### Why is `@import` inside CSS bad for performance?
- [ ] It disables caching
- [x] It creates a serial request chain: the imported file is discovered only after the parent CSS downloads
- [ ] It forces JavaScript to run
- [ ] It isn't supported by HTTP/2
@@@explain
Each @import is discovered late, adding round trips on the render-blocking critical path.
:::
