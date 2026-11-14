---
title: SSR From Scratch & SEO
summary: Build server rendering with plain Node and React (renderToString and streaming), then understand how rendering choices affect SEO.
minutes: 22
---

## SSR without a framework

Frameworks hide a simple core. Server rendering React needs four pieces:

1. A **server** that receives requests,
2. **Data loading** for the requested route,
3. **Rendering** the app to HTML with the data,
4. **Shipping** the HTML + serialised data + client bundle, then **hydrating**.

### 1. Shared app

```jsx
// src/App.jsx — runs on server and client
export default function App({ data }) {
  const [count, setCount] = useState(0)
  return (
    <main>
      <h1>{data.title}</h1>
      <ul>{data.items.map(i => <li key={i.id}>{i.name}</li>)}</ul>
      <button onClick={() => setCount(c => c + 1)}>Clicked {count}</button>
    </main>
  )
}
```

### 2. Server with renderToString

```js
// server.js (Node + Express)
import express from 'express'
import { renderToString } from 'react-dom/server'
import App from './src/App.jsx'

const app = express()
app.use('/assets', express.static('dist/assets', { maxAge: '1y', immutable: true }))

app.get('/', async (req, res) => {
  const data = await loadHomeData()                       // fetch on the server
  const html = renderToString(<App data={data} />)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(data.title)}</title>
    <meta name="description" content="${escapeHtml(data.description)}" />
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="root">${html}</div>
    <script>window.__DATA__ = ${serialize(data)}</script>
    <script type="module" src="/assets/client.js"></script>
  </body>
</html>`)
})

// Escape "</script>" and friends so data can't break out of the script tag (XSS!)
function serialize(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/ /g, '\\u2028').replace(/ /g, '\\u2029')
}

app.listen(3000)
```

### 3. Client entry: hydrate with the same data

```jsx
// src/client.jsx
import { hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
hydrateRoot(document.getElementById('root'), <App data={window.__DATA__} />)
```

The client must render with **exactly** the server's data — that's why it's serialised into the page instead of being fetched again (avoids mismatches and a duplicate request).

### 4. Build

Two builds: a **client bundle** (browser target, code-split) and a **server bundle** (Node target, JSX compiled, no CSS-in-browser assumptions). Vite has `ssr` build mode and `ssrLoadModule` for dev.

### Streaming instead of renderToString

`renderToString` waits for the entire tree and doesn't support Suspense data. Streaming sends the shell immediately:

```js
import { renderToPipeableStream } from 'react-dom/server'

app.get('*', (req, res) => {
  let didError = false
  const { pipe, abort } = renderToPipeableStream(<Root url={req.url} />, {
    bootstrapScripts: ['/assets/client.js'],
    onShellReady() {                      // shell (outside Suspense) is ready
      res.statusCode = didError ? 500 : 200
      res.setHeader('Content-Type', 'text/html')
      pipe(res)                           // stream; Suspense boundaries arrive later
    },
    onShellError() {
      res.statusCode = 500
      res.send('<h1>Something went wrong</h1>') // fall back to client rendering
    },
    onError(err) { didError = true; console.error(err) },
  })
  setTimeout(abort, 10_000)               // give up on slow boundaries → client renders them
})
```

Here `<Root>` renders the whole `<html>` document. For crawlers, you can wait for `onAllReady` instead of `onShellReady` so they get complete HTML.

| | `renderToString` | `renderToPipeableStream` / `renderToReadableStream` |
|---|---|---|
| Output | One string after everything renders | Progressive stream |
| Suspense | Shows fallbacks only, no data | Streams content as boundaries resolve |
| TTFB | Waits for full render | Sends shell immediately |
| Selective hydration | No | Yes |
| Environment | Anywhere | Node streams / Web streams (edge, Deno, Bun) |

### Production concerns of rolling your own

Routing on both sides, data loading per route without waterfalls, code-split chunk preloading, CSS extraction, head/meta management, caching (CDN `s-maxage`, `stale-while-revalidate`), error handling and status codes (404/500), redirects, environment differences (`window` usage), memory leaks across requests (no module-level per-user state!), security (escaping, CSP nonces). That list is why frameworks exist — but knowing the core lets you debug them.

:::callout danger Request isolation on the server
Module-level variables live for the process lifetime and are **shared by all users**. Never store the current user or request data in a module singleton (a global store instance, a cache keyed only by route) during SSR — create stores per request.
:::

## SEO: what rendering means for search

How Google processes a page:

```text
crawl (fetch HTML) ─► index HTML content ─► queue for rendering ─► headless Chromium runs JS ─► index rendered content
                         (immediate)              (may be delayed)
```

- Google **can** render JS, but rendering is deferred, resource-limited, and JS errors, blocked resources or content behind interactions (click-to-load, infinite scroll without links) may never be seen.
- Many other crawlers and **social preview bots** (Slack, WhatsApp, X, LinkedIn) **don't run JS at all** — a CSR page shows an empty preview.
- Page experience signals (**Core Web Vitals**: LCP, INP, CLS) influence ranking; SSR/SSG usually help LCP.

### SEO checklist for frontend engineers

- **Content in the initial HTML** for important pages: SSR/SSG/ISR.
- **Unique `<title>` and `<meta name="description">`** per page; Open Graph (`og:title`, `og:image`) and Twitter card tags for previews.
- **Canonical URLs** (`<link rel="canonical">`) to avoid duplicate content (query params, trailing slashes).
- **Real links**: `<a href="/products/42">` — crawlers follow `href`, not `onClick` navigation.
- **Semantic HTML**: one `h1`, logical headings, `<nav>`, `<main>`, `<article>`, `alt` text.
- **Structured data** (JSON-LD `schema.org` Product, Article, Breadcrumb, FAQ) for rich results.
- **Correct status codes**: real 404s (not a 200 "not found" page — "soft 404"), 301 for moved pages.
- **`robots.txt`** and **XML sitemap**; `noindex` for private/duplicate pages.
- **Pagination & infinite scroll** with crawlable paginated URLs.
- **Performance**: fast LCP, stable layout, small JS.
- **`hreflang`** for multi-language sites.
- **Don't block** CSS/JS in robots.txt (Google needs them to render).

:::question
difficulty: hard
### How would you implement SSR using plain JavaScript/Node without Next.js?
Create shared React components, then on the Node server: match the route, load its data, render the tree with `renderToString` (or `renderToPipeableStream` for streaming + Suspense), inject the HTML into a document template along with meta tags, the serialised data (`window.__DATA__`, escaped to prevent `</script>` injection), CSS and the client bundle script. On the client, call `hydrateRoot` with the same data so markup matches. Build separate server and client bundles, serve static assets with long cache headers, set correct status codes, isolate per-request state and add CDN caching.
:::

:::question
difficulty: medium
### How does rendering strategy affect SEO?
Crawlers index HTML they receive; Google can also render JS but does so later with limited resources, and many bots (social previews, other search engines) don't run JS. SSR/SSG/ISR put content, titles and meta tags in the initial HTML, making indexing reliable and previews correct, and typically improve LCP (a ranking signal). CSR risks incomplete indexing, empty previews and slower LCP. Regardless of strategy you need unique titles/descriptions, canonical URLs, crawlable `<a href>` links, semantic HTML, structured data, proper status codes and sitemaps.
:::

:::question
difficulty: medium
### Why serialise server data into the page instead of refetching on the client?
Hydration requires the client's first render to match the server HTML. Refetching could return different data (causing mismatches and a flash) and costs an extra round trip before the page is interactive. Embedding the exact data used on the server (escaped JSON) lets the client hydrate immediately and consistently; frameworks do this automatically (`__NEXT_DATA__`, the RSC payload, React Query dehydrate/hydrate).
:::

:::challenge
difficulty: hard
### Spot the SSR security and correctness bugs
```js
const store = createStore()  // module level

app.get('/profile', async (req, res) => {
  const user = await getUser(req.cookies.sid)
  store.dispatch({ type: 'setUser', user })
  const html = renderToString(<Provider store={store}><App /></Provider>)
  res.send(`<div id="root">${html}</div>
    <script>window.__STATE__ = ${JSON.stringify(store.getState())}</script>`)
})
```
@@@solution
1. **Shared store across requests** — `store` is created once per process. Concurrent requests overwrite each other's user; user A can receive user B's profile and state. Create the store **inside** the handler: `const store = createStore()`.
2. **XSS via JSON in a script tag** — if any string in the state contains `</script><script>evil()</script>` (e.g. a user's display name), `JSON.stringify` doesn't escape it and the browser ends the script early. Escape `<` (and U+2028/2029): `JSON.stringify(state).replace(/</g, '\\u003c')`, or use `serialize-javascript`.
3. **Leaking sensitive data** — the whole state (possibly tokens, emails of others, internal flags) is serialised to the client. Only serialise what the client needs.
4. **No caching headers** for a personalised page — a CDN could cache user A's page for user B. Set `Cache-Control: private, no-store`.
5. Missing doctype/html/head, meta tags and error handling (status codes when `getUser` fails).
:::

:::quiz
### A product page is client-rendered only. What's most likely to break?
- [ ] Hydration
- [x] Link previews on chat apps and reliable indexing by non-Google crawlers
- [ ] CSS loading
@@@explain
Many bots don't execute JS, so they see an empty shell.
:::

:::quiz
### What does onShellReady in renderToPipeableStream signal?
- [ ] All Suspense boundaries have resolved
- [x] Everything outside Suspense boundaries is rendered and streaming can start
- [ ] Hydration finished on the client
@@@explain
onAllReady fires when everything (including boundaries) is ready — useful for crawlers and static generation.
:::
