---
title: Hydration Cost, Partial Hydration & Islands
summary: Why hydration is expensive and the family of techniques that ship less JavaScript — progressive, partial, islands, resumability.
minutes: 18
---

## Hydration is paying twice

With classic SSR, every component is rendered **twice**: once on the server to HTML, and again on the client during hydration. The client must:

1. Download the JS for **every** component on the page,
2. Parse and execute it,
3. Re-run every component function and rebuild the fiber tree,
4. Walk the DOM and attach listeners.

Even a static footer, a blog post body or a marketing hero — components that never change — cost JS bytes and CPU time. On a mid-range Android phone, hydrating a large page can block the main thread for 1–3 seconds, damaging **INP** and **TTI**.

:::callout analogy Re-assembling IKEA furniture that arrived assembled
SSR delivers fully built furniture. Classic hydration then ships the flat-pack kit too and makes you go over every screw — just so you can open one drawer.
:::

## The spectrum of solutions

| Technique | Idea | Examples |
|---|---|---|
| **Full hydration** | Hydrate the whole page at once | Classic React SSR, Next.js Pages Router |
| **Progressive hydration** | Hydrate pieces over time — visible/important first, rest when idle or visible | React 18 Suspense + selective hydration; custom `IntersectionObserver` hydration |
| **Partial hydration** | Only interactive components get hydrated; static parts never ship JS | React Server Components, Astro |
| **Islands architecture** | Page is static HTML with isolated interactive "islands", each hydrated independently | Astro (`client:load`, `client:visible`, `client:idle`), Fresh, Eleventy+WebC |
| **Resumability** | No hydration replay at all — serialise app state/listeners into HTML and resume lazily on interaction | Qwik |
| **Progressive enhancement** | Page works without JS (links, forms); JS enhances it | Remix/React Router forms, React 19 form Actions |

## Islands in practice

```astro
---
// Astro page: rendered to static HTML on the server
import Header from '../components/Header.astro'      // static, zero JS
import Search from '../components/Search.jsx'         // React island
import Comments from '../components/Comments.jsx'     // React island
---
<Header />
<article>{post.body}</article>
<Search client:load />          <!-- hydrate immediately -->
<Comments client:visible />     <!-- hydrate when scrolled into view -->
```

The page's JS is **proportional to interactivity, not page size**. Islands are great for content-heavy sites (blogs, docs, marketing, e-commerce listings); less natural for highly interactive apps where everything is an island.

## React's answer: Server Components + selective hydration

React Server Components (next lessons) are **partial hydration at component granularity**: server components render only on the server and send no JS; client components (`'use client'`) are the interactive islands, hydrated with selective hydration. Combined with streaming and Suspense, React gets:

- Less JS (server components excluded from the bundle),
- Earlier interactivity for important parts (selective hydration),
- No "all-or-nothing" blocking.

## Progressive hydration by hand (pre-RSC)

```jsx
function HydrateWhenVisible({ children, fallbackHtml }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  if (visible) return <div ref={ref}>{children}</div>
  // keep server HTML untouched until visible
  return <div ref={ref} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: fallbackHtml }} />
}
```

This is fragile (the HTML must be captured and kept identical) — which is why framework-level solutions (Suspense, RSC, islands) are preferred today. In React 18, wrapping below-the-fold parts in `<Suspense>` + `lazy()` already gives deferred, independent hydration.

## Measuring hydration cost

- Performance panel: look for long "Evaluate Script" and React's `hydrateRoot` tasks after FCP.
- React DevTools Profiler (hydration shows as a mount).
- Lighthouse **Total Blocking Time** (TBT) and field **INP**.
- Compare JS transferred vs. what's actually interactive (Coverage tab).

:::question
difficulty: hard
### What is the islands architecture?
A page is rendered as static HTML on the server, and only specific interactive components ("islands") ship JavaScript and hydrate — each independently, possibly lazily (on load, idle, or visible). Static content never ships JS. JS cost scales with interactivity rather than page size, giving fast TTI on content sites. Astro popularised it; React Server Components achieve similar results at component granularity within React apps.
:::

:::question
difficulty: hard
### What is the difference between progressive hydration, partial hydration and resumability?
**Progressive hydration** still hydrates everything but spreads it over time, prioritising visible/interacted parts (React 18 selective hydration). **Partial hydration** never hydrates static parts at all — they ship no JS (RSC server components, islands). **Resumability** (Qwik) avoids hydration replay entirely: the server serialises state and listener locations into HTML and the client lazily loads only the handler code needed when the user interacts.
:::

:::question
difficulty: medium
### Why is hydration expensive?
The browser must download, parse and execute JS for every component on the page, re-run all component functions to rebuild React's tree, and walk the DOM attaching listeners — duplicating work the server already did. This blocks the main thread (high TBT/INP) and leaves an "uncanny valley" where the page looks ready but doesn't respond. It scales with total components, not with how interactive the page is.
:::

:::challenge
difficulty: hard
### Pick the architecture
For each product, choose a rendering/hydration approach and justify it: (a) a documentation site with a search box and code playground; (b) an e-commerce product page with personalised recommendations and an "Add to cart" button; (c) a real-time trading dashboard behind login.
@@@solution
**(a) Docs site** — SSG with islands (Astro, or Next.js App Router with mostly server components). Pages are static and SEO-critical; only the search box and playground need JS. Hydrate search on idle/interaction and the playground when visible (it's heavy).

**(b) Product page** — Streaming SSR / ISR hybrid with Server Components. Product info (title, images, price) server-rendered and cached at the CDN (ISR or short `s-maxage` + on-demand revalidation on price change); personalised recommendations streamed in a Suspense boundary (they're slower and per-user, and shouldn't block LCP); the add-to-cart button is a small client component. Ship minimal JS so INP is good on mobile.

**(c) Trading dashboard** — CSR SPA (or SSR shell only). No SEO need, everything is interactive and live via WebSockets; prioritise a fast app shell, code splitting per panel, efficient real-time rendering (throttled updates, virtualisation, workers) over server rendering.
:::

:::quiz
### With islands architecture, JavaScript shipped scales with…
- [ ] Total page size
- [x] The number and size of interactive components
- [ ] The number of routes
@@@explain
Static parts ship no JS; only islands hydrate.
:::

:::quiz
### Which approach avoids re-executing components on the client at all?
- [ ] Progressive hydration
- [ ] Full hydration
- [x] Resumability
@@@explain
Resumable frameworks continue from serialised server state instead of replaying rendering.
:::
