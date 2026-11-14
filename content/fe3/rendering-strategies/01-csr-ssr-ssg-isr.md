---
title: CSR vs SSR vs SSG vs ISR vs Streaming
summary: Where and when HTML gets generated, how each strategy affects TTFB, FCP, LCP, TTI and SEO, and how to choose.
minutes: 24
---

## The core question: where is the HTML made, and when?

Every rendering strategy answers two questions:

1. **Where** is the HTML generated — on the **client** (browser), the **server** (per request), or at **build** time?
2. **When** does the page become **interactive** — how much JavaScript must download and run?

:::visual rendering-strategies
:::

## Client-Side Rendering (CSR)

The server sends an almost empty HTML shell plus a JS bundle. The browser downloads and runs JS, fetches data, then renders.

```html
<body>
  <div id="root"></div>
  <script src="/assets/app.4f9c.js"></script>
</body>
```

```text
request ─► empty HTML ─► download JS ─► execute ─► fetch data ─► render ─► interactive
             (fast TTFB)                                  (late FCP/LCP)
```

| Pros | Cons |
|---|---|
| Simple hosting (static files + CDN) | Blank screen until JS runs → slow FCP/LCP on slow devices |
| Rich, app-like interactions after load; fast subsequent navigations | SEO and link previews depend on crawlers executing JS |
| Server does little work | Request waterfalls: HTML → JS → data |
| Great for apps behind login | Large bundles hurt low-end phones |

**Use for**: dashboards, admin tools, authenticated SaaS apps, highly interactive tools where SEO doesn't matter.

## Server-Side Rendering (SSR)

The server runs React **per request**, fetches data, produces full HTML, and sends it with the JS. The client **hydrates** it.

```text
request ─► server fetches data + renders ─► full HTML (FCP/LCP early) ─► JS downloads ─► hydrate ─► interactive
             (slower TTFB)
```

| Pros | Cons |
|---|---|
| Content visible early (good FCP/LCP), even before JS | Slower TTFB — server must render before responding |
| SEO-friendly, correct social previews | Server cost & complexity; scaling compute |
| Per-request data: personalised, always fresh | Hydration cost: JS still needed for interactivity ("uncanny valley") |
| Works with cookies/auth on the server | Whole page waits for the slowest data (without streaming) |

**Use for**: e-commerce product pages with fresh prices/stock, personalised feeds, search results pages, news with frequent updates.

## Static Site Generation (SSG)

HTML is generated **once at build time** and served from a CDN.

| Pros | Cons |
|---|---|
| Fastest TTFB and FCP — just a file from the edge | Content is as old as the last build |
| Cheap, scales infinitely, very resilient | Build time grows with page count (100k products?) |
| Excellent SEO | Not for per-user or rapidly changing data |

**Use for**: marketing pages, docs, blogs, landing pages — and this learning platform!

## Incremental Static Regeneration (ISR)

SSG + **background regeneration**. A page is served statically, but after a `revalidate` window (or an on-demand trigger), the next request triggers a rebuild in the background (**stale-while-revalidate**). New pages can be generated on first request.

```js
// Next.js Pages Router
export async function getStaticProps({ params }) {
  const product = await getProduct(params.slug)
  return { props: { product }, revalidate: 60 } // at most once a minute
}
```

**Use for**: large catalogues, blogs with many posts, pages that change occasionally where "a minute stale" is acceptable. On-demand revalidation (`revalidatePath`, webhooks from the CMS) makes updates near-instant.

## Streaming SSR

Instead of waiting for all data before sending anything, the server **streams** HTML in chunks as it becomes ready, using Suspense boundaries:

```text
t=0     <html><head>…</head><body><header>…</header><main>   ← shell flushed immediately
t=50    <div>product details…</div>
        <template id="B:1"></template><div class="skeleton">Loading reviews…</div>
t=800   <div hidden id="S:1">…reviews…</div><script>$RC("B:1","S:1")</script>  ← swapped in
```

- **Fast TTFB** like CSR + **content early** like SSR.
- Slow sections don't block fast ones.
- Combined with **selective hydration**, fast parts become interactive first.

React APIs: `renderToPipeableStream` (Node), `renderToReadableStream` (Web streams/edge). Next.js App Router streams by default with `loading.js` and `<Suspense>`.

## Comparison

| | CSR | SSR | SSG | ISR | Streaming SSR |
|---|---|---|---|---|---|
| HTML generated | Browser | Server, per request | Build | Build + background | Server, progressively |
| TTFB | Fast | Slower | Fastest | Fastest | Fast |
| FCP/LCP | Slow | Fast | Fastest | Fastest | Fast |
| Data freshness | Live | Live | Build time | ~revalidate window | Live |
| Personalisation | ✓ | ✓ | ✗ (client fetch) | ✗ | ✓ |
| SEO | Weaker | Strong | Strong | Strong | Strong |
| Server cost | Low | High | Lowest | Low | High |
| Hydration needed | No (renders fresh) | Yes | Yes | Yes | Yes (selective) |

## Choosing — a decision guide

1. **Does the page need SEO or fast first paint for anonymous users?** No → CSR is fine (behind login).
2. **Is the content the same for every user?** Yes → **SSG**. Changes occasionally → **ISR**.
3. **Personalised or must be fresh per request?** → **SSR**, preferably **streaming**, with the slow parts in Suspense.
4. **Mix per route.** Real apps are hybrid: marketing pages SSG, product pages ISR, cart/checkout SSR or CSR, dashboard CSR. Modern frameworks (Next.js, Remix/React Router 7, Astro, Nuxt, SvelteKit) choose per route or even per component (Server Components, Partial Prerendering = static shell + streamed dynamic holes).

:::callout interview Talk in metrics
Strong answers connect strategies to **TTFB, FCP, LCP, INP/TTI**, SEO, infrastructure cost and data freshness — and mention hybrid rendering, caching at the CDN, and hydration cost.
:::

:::question
difficulty: medium
companies: Groww, Accenture
### What is the difference between SSR and CSR?
In **CSR** the server returns a minimal HTML shell and JS; the browser downloads and runs the JS, fetches data and builds the DOM. It's cheap to host and gives app-like navigation, but initial content appears late and SEO depends on crawlers executing JS. In **SSR** the server renders the full HTML per request (with data), so content appears quickly and is SEO-friendly; the client then hydrates it to make it interactive. SSR costs server compute, increases TTFB and still requires hydration JS. Choose CSR for authenticated, highly interactive apps; SSR for SEO-sensitive, personalised or fresh content.
:::

:::question
difficulty: medium
companies: Accenture
### What is server-side rendering (SSR)?
SSR renders React components to HTML on the server for each request (`renderToString` / `renderToPipeableStream`), including fetched data, and sends that HTML to the browser so users see content immediately and crawlers get full markup. The same components then run on the client and hydrate the HTML to attach events and state. Benefits: faster FCP/LCP, SEO, social previews; costs: server load, TTFB, hydration time and complexity (code must run in both environments).
:::

:::question
difficulty: medium
companies: Accenture
### What is Static Site Generation (SSG)?
SSG pre-renders pages to static HTML at **build time** using data available then, and serves them from a CDN. It gives the fastest TTFB/FCP, excellent SEO, low cost and high resilience. Downsides: content is only as fresh as the last build and builds get slow for huge sites — mitigated by ISR (regenerate pages incrementally after a time window or on demand). Ideal for docs, blogs and marketing pages.
:::

:::question
difficulty: hard
### SSR vs CSR vs SSG — when would you choose each?
- **SSG** for content identical for all users that changes rarely (marketing, docs, blogs) — fastest and cheapest; **ISR** when the set is large or changes occasionally.
- **SSR (streaming)** for SEO-relevant pages that are personalised or must be fresh per request (product prices/stock, search results, news, feeds).
- **CSR** for authenticated, highly interactive apps where SEO is irrelevant (dashboards, editors, admin panels).

Most production apps are hybrid, choosing per route, and frameworks increasingly mix within a page (static shell + streamed dynamic parts, Server Components).
:::

:::challenge
difficulty: hard
companies: Accenture
### The home page takes 5 seconds to load. How do you reduce it?
Walk through a structured diagnosis and remediation plan.
@@@solution
**1. Measure, don't guess.** Lighthouse / PageSpeed Insights (lab), CrUX / RUM (field data) for LCP, FCP, TTFB, INP, CLS. Chrome DevTools Performance + Network waterfall. Bundle analyzer.

**2. Diagnose where the 5 s goes:**
- **High TTFB** → slow server/API/DB, no caching, far from users.
- **Late FCP with OK TTFB** → render-blocking CSS/JS, CSR blank shell.
- **Late LCP** → huge hero image, image discovered late, client-side data fetch waterfall.
- **Long TTI/INP** → giant JS bundle, expensive hydration, long tasks.

**3. Fixes by cause:**
- **Rendering strategy**: home page is mostly the same for everyone → SSG/ISR (or SSR with CDN caching), streaming for personalised sections. Removes the CSR waterfall (HTML → JS → API → render).
- **Server/edge**: CDN caching (`Cache-Control`, `s-maxage`, `stale-while-revalidate`), compression (Brotli), HTTP/2/3, cache API responses, edge rendering.
- **JS**: route-based code splitting, lazy-load below-the-fold widgets, remove/replace heavy libraries (moment → date-fns), tree-shaking, defer third-party scripts (analytics, chat) until idle, Server Components to ship less JS.
- **CSS**: inline critical CSS, defer the rest, remove unused CSS.
- **Images**: modern formats (AVIF/WebP), responsive `srcset`/`sizes`, correct dimensions, `fetchpriority="high"` + preload for the LCP image, `loading="lazy"` for others, CDN image optimisation.
- **Fonts**: `font-display: swap`, preload critical fonts, subset.
- **Data**: parallelise requests, fetch on the server, prefetch, cache.
- **Resource hints**: `preconnect` to API/CDN origins, `preload` critical assets.

**4. Verify and guard**: re-measure, set performance budgets in CI (Lighthouse CI, bundle size limits), monitor RUM continuously.
:::

:::quiz
### Which strategy gives the fastest TTFB for content that's identical for all users?
- [ ] SSR
- [x] SSG served from a CDN
- [ ] CSR
@@@explain
A prebuilt file at the edge needs no computation per request.
:::

:::quiz
### What does ISR add on top of SSG?
- [ ] Client-side rendering of every page
- [x] Regenerating static pages in the background after a revalidate window or on demand
- [ ] Per-user personalisation in the HTML
@@@explain
ISR serves the stale page while regenerating it, then serves the fresh one.
:::
