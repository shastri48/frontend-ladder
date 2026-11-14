---
title: Measure First — Core Web Vitals & Performance Tooling
summary: LCP, INP, CLS, FCP, TTFB and TTI explained; lab vs field data; Lighthouse, the Performance panel, React Profiler and Bundle Analyzer.
minutes: 18
---

## Why measure before you optimise

Every senior performance answer starts the same way: **"First I'd measure."** Optimising without data is guessing, and guessing usually means you spend a week shaving 20 KB off a bundle while the real problem was a 2.4 MB hero image or a 900 ms server response.

:::callout analogy The doctor analogy
A good doctor does not prescribe medicine before taking your temperature and blood pressure. Core Web Vitals are your app's vital signs. Profilers are the X-ray. Only after both do you prescribe code splitting, memoisation or a CDN.
:::

Performance work is a loop:

```text
  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
  │ Measure  │ ─▶ │ Diagnose  │ ─▶ │   Fix    │ ─▶ │ Verify & │
  │ (RUM+lab)│    │ (profile) │    │ (1 thing)│    │  guard   │
  └──────────┘    └───────────┘    └──────────┘    └────┬─────┘
       ▲                                                │
       └────────────────────────────────────────────────┘
```

"Guard" means adding a **performance budget** to CI so the regression cannot silently come back.

## The metrics that matter

Google's **Core Web Vitals** are the three user-centric metrics that summarise loading, interactivity and visual stability. The others are diagnostic metrics that help explain them.

:::visual web-vitals
:::

| Metric | Measures | Good | Poor | Typical causes when bad |
|---|---|---|---|---|
| **LCP** – Largest Contentful Paint | When the biggest image/text block in the viewport rendered | ≤ 2.5 s | > 4 s | Slow server, render-blocking CSS/JS, huge hero image, client-side-only rendering |
| **INP** – Interaction to Next Paint | Latency from a user interaction to the next frame painted (worst-ish of the session) | ≤ 200 ms | > 500 ms | Long tasks on main thread, heavy re-renders, synchronous layout |
| **CLS** – Cumulative Layout Shift | How much visible content jumps unexpectedly | ≤ 0.1 | > 0.25 | Images without dimensions, late-loading ads/banners, web-font swaps, injected content |
| FCP – First Contentful Paint | First text/image painted | ≤ 1.8 s | > 3 s | Render-blocking resources, slow TTFB |
| TTFB – Time To First Byte | Time until the first response byte arrives | ≤ 0.8 s | > 1.8 s | Slow backend, no CDN, redirects, cold starts |
| TTI – Time To Interactive (legacy) | When the page is reliably responsive | – | – | Large JS bundles, hydration cost |
| TBT – Total Blocking Time (lab) | Sum of the "over 50 ms" parts of long tasks between FCP and TTI | ≤ 200 ms | > 600 ms | Same as INP — it's INP's lab proxy |

:::callout info INP replaced FID
In March 2024 **INP** replaced FID (First Input Delay) as a Core Web Vital. FID only measured the *delay before* the first interaction's handler ran. INP measures the full latency — input delay + handler processing + presentation delay — of **all** interactions, reporting roughly the worst one. It is much harder to "game".
:::

### Anatomy of INP

```text
user clicks
   │
   ├── input delay ──────┤  main thread busy with another task
   ├── processing ───────┤  your event handlers + React re-render
   ├── presentation ─────┤  style, layout, paint, composite
   ▼
next frame painted          INP sample = total of all three
```

So INP can be bad because (1) something else was hogging the main thread when the user clicked, (2) your handler does too much, or (3) the resulting DOM change is expensive to lay out and paint.

### Anatomy of LCP

LCP breaks into four sub-parts, and the Performance panel shows them:

1. **TTFB** — server and network.
2. **Resource load delay** — time between TTFB and the browser *starting* to download the LCP resource (e.g. the image is only discovered after JS runs).
3. **Resource load duration** — downloading the image itself.
4. **Element render delay** — the resource is ready but rendering is blocked (CSS, JS, hydration).

Knowing which part dominates tells you the fix: CDN for (1), `<link rel="preload">` / `fetchpriority="high"` for (2), compression/AVIF/responsive images for (3), reducing render-blocking work for (4).

## Lab data vs field data

| | Lab (synthetic) | Field (RUM — Real User Monitoring) |
|---|---|---|
| Tools | Lighthouse, WebPageTest, DevTools Performance | CrUX, `web-vitals` library, Sentry/Datadog/SigNoz RUM, Vercel Analytics |
| Device/network | One controlled profile (e.g. Moto G4, slow 4G) | Every real user's device and network |
| Good for | Debugging, reproducing, CI budgets | Truth: what users actually experience; p75 |
| Has INP? | No (uses TBT as a proxy) | Yes |

Google ranks with the **75th percentile of field data**. A perfect Lighthouse score with poor field INP is still a slow site. Interviewers love hearing that you know this distinction.

Collecting field data yourself:

```js
import { onLCP, onINP, onCLS, onTTFB, onFCP } from 'web-vitals'

function send(metric) {
  // sendBeacon survives page unload
  navigator.sendBeacon('/rum', JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,        // 'good' | 'needs-improvement' | 'poor'
    id: metric.id,
    page: location.pathname,
    attribution: metric.attribution, // with the /attribution build: which element, which interaction
  }))
}

onLCP(send); onINP(send); onCLS(send); onTTFB(send); onFCP(send)
```

## The toolbox

### Lighthouse

Runs a lab audit for Performance, Accessibility, Best Practices and SEO. The performance score is a weighted blend (TBT and LCP carry the most weight, then CLS, FCP, Speed Index). Treat the **opportunities and diagnostics** list as the useful part, not the number. Run it in an incognito window (extensions skew it), and use `lighthouse-ci` to enforce budgets in pull requests.

### Chrome DevTools Performance panel

Record a page load or an interaction and you get:

- **Main thread flame chart** — every task; red-cornered tasks are **long tasks (> 50 ms)**. Click one to see the call tree ("Bottom-up" tab tells you which functions consumed self time).
- **Network track** — when each resource started and finished; spot late-discovered LCP images.
- **Frames / Timings / Layout shifts** tracks — LCP marker, layout shift clusters.
- **Purple = rendering (style/layout)**, **green = painting**, **yellow = scripting**. Lots of purple "Layout" right after JS writes is **layout thrashing**.
- CPU throttling (4×/6×) to simulate mid-range phones — always use it; your MacBook lies.

### React Profiler

From React DevTools → Profiler. Record an interaction and it shows each commit, which components rendered, how long each took, and **why** it rendered (enable "Record why each component rendered"). Use it to answer: *"Did this component need to re-render?"* Grey components did not render; yellow/orange ones were expensive.

```jsx
import { Profiler } from 'react'

function onRender(id, phase, actualDuration, baseDuration) {
  // actualDuration: time spent rendering this commit
  // baseDuration: estimated cost to render the whole subtree without memoisation
  if (actualDuration > 16) console.warn(`${id} ${phase} took ${actualDuration.toFixed(1)}ms`)
}

<Profiler id="OrdersTable" onRender={onRender}>
  <OrdersTable />
</Profiler>
```

### Bundle analysers

`webpack-bundle-analyzer`, `rollup-plugin-visualizer` (Vite) or `source-map-explorer` render a treemap of your bundles. Look for: whole libraries imported for one function (`lodash`, `moment` locales), duplicate copies of a package at different versions, polyfills you don't need, and code that should be in a lazy chunk.

```bash
# Vite
npx vite-bundle-visualizer
# webpack
npx webpack --profile --json > stats.json && npx webpack-bundle-analyzer stats.json
```

### Other tools worth naming

- **Coverage tab** (DevTools): how much of each JS/CSS file was actually executed — great for finding code to split.
- **WebPageTest**: filmstrips, real devices, multi-step scripts, waterfall comparisons.
- **Memory panel**: heap snapshots for leaks (separate lesson).
- **PerformanceObserver** + `performance.mark/measure` for custom metrics like "time to first search result".

```js
performance.mark('search:start')
await runSearch(q)
performance.mark('search:end')
performance.measure('search', 'search:start', 'search:end')

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) console.log(entry.name, entry.duration)
}).observe({ type: 'measure', buffered: true })
```

## Performance budgets

A budget is a hard limit enforced in CI: "main JS ≤ 170 KB gzipped", "LCP ≤ 2.5 s on the lab profile", "no new long task > 100 ms on checkout". Budgets turn performance from a heroic one-off project into a property the team maintains.

:::callout interview What interviewers look for
They want a **systematic** answer: user-centric metrics → field data to find *which* pages/users suffer → lab tools to reproduce → profiler to find the cause → targeted fix → verify with the same metric → budget to prevent regressions. Mentioning p75, INP replacing FID and the LCP sub-parts signals real-world experience.
:::

:::question
difficulty: medium
companies: Agoda, Walmart
### What are Core Web Vitals, and how would you explain them to a non-technical stakeholder?
**Core Web Vitals** are three metrics Google uses to quantify user experience:

- **LCP (Largest Contentful Paint)** — *"How long until the page looks loaded?"* Time until the largest visible image or text block renders. Good ≤ 2.5 s.
- **INP (Interaction to Next Paint)** — *"When I tap something, how quickly does the screen respond?"* Good ≤ 200 ms.
- **CLS (Cumulative Layout Shift)** — *"Does stuff jump around while I'm trying to read or tap?"* Good ≤ 0.1.

For stakeholders, tie them to business outcomes: slow LCP increases bounce rate, poor INP feels "broken" and reduces conversions, CLS causes mis-taps (like clicking "Cancel order" because a banner pushed the button). They also influence Google search ranking. Show the **p75** trend on a dashboard, not a single Lighthouse number.

Related metrics: FCP (first anything painted), TTFB (server responsiveness), TTI/TBT (how long the page is blocked by JavaScript).

**In an interview, say:** "LCP is loading, INP is responsiveness, CLS is stability; I track them at p75 from real users and use lab tools only to debug."
:::

:::question
difficulty: medium
companies: Agoda
### Lab data vs field data — which one do you trust?
Both, for different jobs. **Field data (RUM)** is the truth about real users across devices and networks; it's what Google uses (CrUX p75) and it's the only place INP exists. But it's noisy and doesn't tell you *why*. **Lab data** (Lighthouse, Performance panel, WebPageTest) is reproducible and debuggable but represents one synthetic device/network. Use field data to **decide where to look**, lab data to **diagnose and verify**, and CI lab budgets to **prevent regressions**.
:::

:::question
difficulty: medium
companies: Agoda
### How do you use the React Profiler to find performance problems?
Open React DevTools → Profiler, enable "Record why each component rendered", start recording, perform the slow interaction, stop. Then:

1. Look at the **commit bar chart** — tall bars are slow commits.
2. In the **flame graph**, find wide coloured components (expensive) and components that rendered but whose output didn't change.
3. Read **"Why did this render?"** — props changed (which one?), parent rendered, context changed, hooks changed.
4. Typical fixes: stabilise props (`useMemo`/`useCallback`), wrap pure children in `React.memo`, split context so unrelated consumers don't update, move state down closer to where it's used, virtualise long lists.

Programmatically, `<Profiler onRender>` lets you log `actualDuration` in production builds that enable profiling.
:::

:::question
difficulty: easy
companies: Agoda
### What does Webpack Bundle Analyzer tell you and what do you do with it?
It visualises every bundle as a treemap sized by (stat/parsed/gzipped) bytes. You use it to find:

- **Heavy dependencies** — e.g. `moment` with all locales; swap for `date-fns`/`dayjs` or strip locales.
- **Non-tree-shaken imports** — `import _ from 'lodash'` instead of `import debounce from 'lodash/debounce'` or `lodash-es`.
- **Duplicates** — two versions of the same lib; dedupe via resolutions.
- **Code in the wrong chunk** — admin-only charts in the main bundle; move behind `React.lazy` / dynamic `import()`.

Then re-run and compare, and set a size budget (e.g. `size-limit`) in CI.
:::

:::challenge
difficulty: medium
companies: Walmart
### Explain FCP, TTI and CLS to a product manager using one real page
Your PM asks why the "Product listing" page "feels slow" even though "it loads in 2 seconds on my laptop". Write the explanation you'd give, using FCP, TTI and CLS, and propose what dashboard you'd build to track them.
@@@solution
**Script you might use:**

"Your laptop on office Wi-Fi is the best case. Our median customer is on a mid-range Android on 4G, and that is 4–6× slower at running JavaScript. Three numbers describe what they feel:

- **FCP (First Contentful Paint)** — the moment *anything* appears. On mobile it's 2.9 s, so for three seconds users stare at a white screen.
- **TTI (Time to Interactive)** — when tapping actually works. Ours is 7 s because we download and run 600 KB of JavaScript before the filters respond. Users tap "Sort", nothing happens, and they tap again. (Today we track this with **INP**, the responsiveness of each tap.)
- **CLS (Layout shift)** — a promo banner loads late and pushes the product grid down, so people tap the wrong product. Our score is 0.31, which Google rates 'poor'."

**Dashboard:** p75 LCP, INP, CLS (plus FCP, TTFB) from RUM, segmented by page template, device class (mobile/desktop) and country; trend over releases with deploy markers; conversion rate plotted alongside so the business link is visible; alerts when p75 crosses the "needs improvement" threshold.

Key communication principles: talk about the **user's experience**, use **p75 of real users**, connect to **revenue/conversion**, and propose a **target** ("LCP under 2.5 s for 75% of mobile users by Q3").
:::

:::quiz
### Which metric replaced First Input Delay as a Core Web Vital?
- [ ] Total Blocking Time
- [x] Interaction to Next Paint
- [ ] Time to Interactive
- [ ] Speed Index
@@@explain
INP became a Core Web Vital in March 2024. TBT is a lab-only proxy for it.
:::

:::quiz
### Google uses which slice of field data to assess Core Web Vitals?
- [ ] The median (p50)
- [x] The 75th percentile
- [ ] The 95th percentile
- [ ] The average
@@@explain
p75 means 75% of page views must meet the "good" threshold.
:::

:::quiz
### A long task is any main-thread task longer than…
- [ ] 16 ms
- [x] 50 ms
- [ ] 100 ms
- [ ] 200 ms
@@@explain
50 ms leaves room to respond to input within ~100 ms; TBT sums the portion of each task above 50 ms.
:::
