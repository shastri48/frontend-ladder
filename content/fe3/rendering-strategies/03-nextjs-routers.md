---
title: Next.js — Pages Router vs App Router
summary: getStaticProps, getServerSideProps and getStaticPaths in the Pages Router, and how the App Router replaces them with Server Components, caching and streaming.
minutes: 24
---

## Why Next.js?

React is a UI library; it doesn't decide routing, data loading, bundling or where code runs. Next.js is a framework that answers those questions: file-system routing, SSR/SSG/ISR per route, API routes, image/font optimisation, code splitting, and deployment on Node or the edge.

It has **two routers** that coexist:

| | Pages Router (`pages/`) | App Router (`app/`, Next 13.4+) |
|---|---|---|
| Components | Client components (all hydrated) | **Server Components by default**, `'use client'` opt-in |
| Data fetching | `getStaticProps`, `getServerSideProps`, `getStaticPaths` | `async` components + `fetch`/DB calls, caching config |
| Layouts | `_app.js`, `_document.js`, per-page `getLayout` pattern | Nested `layout.js` that persist across navigations |
| Loading/error UI | Manual | `loading.js` (Suspense), `error.js` (error boundary), `not-found.js` |
| Streaming | No | Yes, by default |
| Mutations | API routes | Server Actions (`'use server'`) + API route handlers |
| Status | Supported, stable | Recommended for new apps |

## Pages Router basics

Every file in `pages/` is a route:

```text
pages/index.js            → /
pages/about.js            → /about
pages/blog/[slug].js      → /blog/:slug
pages/docs/[...path].js   → /docs/* (catch-all)
pages/api/users.js        → /api/users (API route, server only)
pages/_app.js             → wraps every page (global CSS, providers)
pages/_document.js        → custom <html>/<body> (server only)
```

Navigation uses `next/link` (client-side transitions with prefetching of linked pages in the viewport) and `useRouter()` from `next/router`.

### getStaticProps — SSG / ISR

Runs **at build time** (and during ISR regeneration) on the server only. Its code and imports are stripped from the client bundle, so you can query a DB directly.

```jsx
export async function getStaticProps({ params, preview }) {
  const post = await db.post.findUnique({ where: { slug: params.slug } })
  if (!post) return { notFound: true }
  return {
    props: { post },        // must be JSON-serialisable (no Date objects, functions)
    revalidate: 300,        // ISR: regenerate at most every 5 minutes
  }
}

export default function Post({ post }) {
  return <article><h1>{post.title}</h1><div>{post.body}</div></article>
}
```

### getStaticPaths — which dynamic pages to pre-build

```jsx
export async function getStaticPaths() {
  const popular = await db.post.findMany({ take: 100, orderBy: { views: 'desc' } })
  return {
    paths: popular.map(p => ({ params: { slug: p.slug } })),
    fallback: 'blocking', // others render on first request, then cached (ISR)
  }
}
```

`fallback` options: `false` (unknown paths 404), `true` (serve a fallback page immediately, `router.isFallback`, then fill in), `'blocking'` (SSR the first request, then cache).

### getServerSideProps — SSR on every request

```jsx
export async function getServerSideProps({ params, req, res, query }) {
  const session = await getSession(req)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  const orders = await api.orders(session.userId, { page: query.page ?? 1 })
  res.setHeader('Cache-Control', 'private, no-store')
  return { props: { orders } }
}
```

Runs on **every request** with access to cookies, headers and the query string. Use for per-user or always-fresh pages. The page's TTFB waits for it to finish, so keep it fast.

| | `getStaticProps` | `getServerSideProps` |
|---|---|---|
| Runs | Build time (+ ISR revalidation) | Every request |
| Access to request (cookies, headers) | No | Yes |
| Output cached | Yes, CDN | No (unless you set Cache-Control) |
| Speed | Fastest | Slower TTFB |
| Use for | Blogs, docs, marketing, catalogues | Dashboards, personalised pages, search with live data |

Pages without either function are **automatically statically optimised** (pre-rendered as HTML with no data), then can fetch on the client (e.g. with SWR).

## App Router

```text
app/
  layout.tsx            ← root layout (html/body), persists across all routes
  page.tsx              ← /
  loading.tsx           ← Suspense fallback for this segment
  error.tsx             ← error boundary for this segment ('use client')
  dashboard/
    layout.tsx          ← nested layout (sidebar) – state preserved on navigation
    page.tsx            ← /dashboard
    [teamId]/page.tsx   ← /dashboard/:teamId
  api/users/route.ts    ← route handler (GET/POST functions)
```

### Data fetching = async Server Components

```tsx
// app/blog/[slug]/page.tsx — a Server Component
export async function generateStaticParams() {            // replaces getStaticPaths
  const posts = await db.post.findMany({ select: { slug: true } })
  return posts.map(p => ({ slug: p.slug }))
}

export const revalidate = 300                               // ISR for this route

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await db.post.findUnique({ where: { slug } }) // direct DB access, never shipped to client
  if (!post) notFound()
  return (
    <article>
      <h1>{post.title}</h1>
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments postId={post.id} />                          {/* streamed separately */}
      </Suspense>
      <LikeButton postId={post.id} />                         {/* 'use client' island */}
    </article>
  )
}
```

Mapping from Pages Router:

| Pages Router | App Router |
|---|---|
| `getStaticProps` | async server component + static rendering (cached by default / `revalidate`) |
| `getStaticProps` + `revalidate` | `export const revalidate = N` or `fetch(url, { next: { revalidate: N } })` |
| `getServerSideProps` | dynamic rendering: reading `cookies()`, `headers()`, `searchParams`, or `cache: 'no-store'` |
| `getStaticPaths` | `generateStaticParams` |
| API routes | Route handlers (`route.ts`) + Server Actions for mutations |
| `_app` / `_document` | root `layout.tsx` |
| `next/head` | `export const metadata` / `generateMetadata` |
| `useRouter` from `next/router` | `useRouter`, `usePathname`, `useSearchParams` from `next/navigation` |

Rendering mode is **inferred per route**: static unless it uses dynamic APIs. On-demand revalidation via `revalidatePath('/blog')` / `revalidateTag('posts')` (e.g. from a CMS webhook or a Server Action). Partial Prerendering combines a static shell with dynamic Suspense holes in one response.

### Server Actions (mutations)

```tsx
// app/todos/actions.ts
'use server'
export async function addTodo(formData: FormData) {
  const title = String(formData.get('title') ?? '')
  if (!title) return { error: 'Title required' }
  await db.todo.create({ data: { title } })
  revalidatePath('/todos')
}

// app/todos/page.tsx
<form action={addTodo}><input name="title" /><button>Add</button></form>
```

Works without JS (progressive enhancement), and with JS React handles it as a transition. Server Actions are public HTTP endpoints — **always validate input and check authorisation** inside them.

## Choosing between them

- **New projects**: App Router — less client JS, streaming, nested layouts, Server Actions.
- **Existing Pages Router apps**: both routers can live in one project; migrate route by route.
- Pages Router can still be simpler for teams who don't need RSC, or for libraries not yet compatible with Server Components.

:::question
difficulty: medium
companies: Accenture
### How do you fetch data in Next.js using getStaticProps and getServerSideProps?
Both are exported async functions in a Pages Router page that run only on the server and return `{ props }` (or `redirect`/`notFound`). **`getStaticProps`** runs at build time (and again in the background with `revalidate` for ISR); its output is static HTML + JSON cached on the CDN — use it for content that's the same for every user. Dynamic routes pair it with **`getStaticPaths`** to list which params to pre-render and a `fallback` mode for the rest. **`getServerSideProps`** runs on every request with access to `req`, cookies, headers and query — use it for personalised or always-fresh data, at the cost of slower TTFB. Props must be JSON-serialisable; server-only imports are stripped from the client bundle.
:::

:::question
difficulty: medium
companies: Accenture
### Explain the concept of SSR in Next.js.
In Next.js, SSR means a page's HTML is generated on the server for each request. In the Pages Router you opt in with `getServerSideProps`, whose result is passed as props to the page; Next renders the page to HTML, sends it with the serialised props (`__NEXT_DATA__`), and the client hydrates. In the App Router a route is dynamically server-rendered when it uses request-time data (`cookies()`, `headers()`, `searchParams`, uncached `fetch`), and responses are streamed with Suspense/`loading.js`. Static routes are pre-rendered at build time instead.
:::

:::question
difficulty: easy
### Next.js Pages Router basics — how do routing and pages work?
Each file in `pages/` maps to a route: `pages/about.js` → `/about`, `pages/blog/[slug].js` → dynamic `/blog/:slug`, `[...slug]` for catch-all, `pages/api/*` for server API routes. `_app.js` wraps all pages (providers, global CSS) and `_document.js` customises the HTML shell. Navigate with `<Link>` (client-side with automatic prefetching) and `useRouter()`. Data per page via `getStaticProps`/`getStaticPaths` (SSG/ISR) or `getServerSideProps` (SSR); pages without them are statically optimised.
:::

:::question
difficulty: medium
### What does getStaticPaths' fallback option do?
For dynamic SSG routes it controls paths not returned by `getStaticPaths`: `false` → 404; `true` → immediately serve a fallback version of the page (`router.isFallback`), generate it in the background, then swap in the data and cache it; `'blocking'` → server-render the first request (no fallback UI) and cache the result for subsequent requests. `'blocking'` or `true` let you pre-build only popular pages and generate the long tail on demand.
:::

:::challenge
difficulty: medium
### Pick the data function
For each Pages Router page, choose `getStaticProps` (with or without `revalidate`), `getServerSideProps`, or client-side fetching, and justify: (1) the About page; (2) a product page for 200k products whose prices change a few times a day; (3) "My orders"; (4) live cricket score widget on an otherwise static article.
@@@solution
1. **About** → `getStaticProps` without revalidate (or no data function at all). Never changes between deploys.
2. **Product pages** → `getStaticProps` + `revalidate` (e.g. 300) + `getStaticPaths` pre-building only the top N products with `fallback: 'blocking'`; trigger on-demand revalidation (`res.revalidate(path)`) from the pricing system's webhook for immediate updates. SSR would work but costs more and slows TTFB; building 200k pages per deploy is too slow.
3. **My orders** → `getServerSideProps` (needs the session cookie, per user, must be fresh) with `Cache-Control: private, no-store` — or a static shell + client fetch if SEO doesn't matter (it doesn't, it's behind login).
4. **Article with live score** → `getStaticProps` for the article; the score widget fetches on the client (SWR with polling or a WebSocket). Never block the static page on live data.
:::

:::challenge
difficulty: hard
### Migrate a Pages Router page to the App Router
```jsx
// pages/products/[id].js
export async function getServerSideProps({ params, req }) {
  const user = await getUser(req.cookies.session)
  const product = await api.product(params.id)
  return { props: { user, product } }
}
export default function Product({ user, product }) {
  const [qty, setQty] = useState(1)
  return (<>
    <Head><title>{product.name}</title></Head>
    <h1>{product.name}</h1>
    <p>Hi {user?.name}</p>
    <input type="number" value={qty} onChange={e => setQty(+e.target.value)} />
    <button onClick={() => addToCart(product.id, qty)}>Add</button>
  </>)
}
```
@@@solution
```tsx
// app/products/[id]/page.tsx — Server Component (no 'use client')
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import AddToCart from './AddToCart'

export async function generateMetadata({ params }) {
  const { id } = await params
  const product = await api.product(id)
  return { title: product?.name ?? 'Product' }
}

export default async function ProductPage({ params }) {
  const { id } = await params
  const session = (await cookies()).get('session')?.value // dynamic → rendered per request
  const [user, product] = await Promise.all([getUser(session), api.product(id)]) // parallel, no waterfall
  if (!product) notFound()
  return (
    <>
      <h1>{product.name}</h1>
      <p>Hi {user?.name}</p>
      <AddToCart productId={product.id} />
    </>
  )
}
```
```tsx
// app/products/[id]/AddToCart.tsx — the only client JS on the page
'use client'
import { useState, useTransition } from 'react'
import { addToCart } from './actions'

export default function AddToCart({ productId }: { productId: string }) {
  const [qty, setQty] = useState(1)
  const [pending, start] = useTransition()
  return (
    <>
      <input type="number" min={1} value={qty} onChange={e => setQty(+e.target.value)} />
      <button disabled={pending} onClick={() => start(() => addToCart(productId, qty))}>
        {pending ? 'Adding…' : 'Add'}
      </button>
    </>
  )
}
```
```ts
// app/products/[id]/actions.ts
'use server'
export async function addToCart(productId: string, qty: number) {
  const user = await requireUser()         // authorise inside the action
  if (!Number.isInteger(qty) || qty < 1) throw new Error('Invalid quantity')
  await cart.add(user.id, productId, qty)
  revalidatePath('/cart')
}
```
Wins: `<Head>` → `generateMetadata`; data fetched in parallel in the server component; only the interactive part ships JS; mutation via a Server Action with server-side validation. Further: put the personalised greeting in a `<Suspense>` boundary so product info can be cached/streamed independently of the user lookup.
:::

:::quiz
### Which Pages Router function has access to the request's cookies?
- [ ] getStaticProps
- [x] getServerSideProps
- [ ] getStaticPaths
@@@explain
Only getServerSideProps runs per request; the others run at build/regeneration time.
:::

:::quiz
### In the App Router, what replaces getStaticPaths?
- [x] generateStaticParams
- [ ] generateMetadata
- [ ] route.ts
@@@explain
generateStaticParams returns the params to pre-render for a dynamic segment.
:::
