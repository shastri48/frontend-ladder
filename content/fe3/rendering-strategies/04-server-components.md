---
title: React Server Components vs Client Components
summary: What RSCs are, the 'use client' boundary, what can cross it, the RSC payload, and patterns for composing server and client code.
minutes: 22
---

## The idea in one line

**Server Components run only on the server and send their *rendered result* — not their code — to the browser.** Client Components are the familiar React components that ship JS and run (and hydrate) in the browser.

This is **not the same as SSR**. SSR renders *client* components to HTML on the server and then hydrates *all* of them. With RSC, server components never hydrate and never appear in the JS bundle; only client components do.

| | Server Component | Client Component |
|---|---|---|
| Declared by | Default (in RSC frameworks) | `'use client'` at the top of the file |
| Runs on | Server (build time or request time) | Server (SSR for HTML) **and** browser |
| Ships JS to browser | **No** | Yes |
| Can be `async` / `await` data | **Yes** | No (use `use(promise)` or libraries) |
| Direct DB / filesystem / secrets | **Yes** | No |
| `useState`, `useEffect`, event handlers | **No** | Yes |
| Browser APIs (`window`, `localStorage`) | No | Yes (in effects/handlers) |
| Context (`useContext`) | No | Yes |
| Re-renders | Only on navigation/refresh/revalidation | On state changes |

## Why it matters

- **Zero-bundle-size dependencies**: render Markdown with a 200 kB parser or syntax-highlight code on the server; the client gets only HTML-like output.
- **Data close to the source**: `await db.query()` inside the component; no API layer, no client waterfalls, secrets stay on the server.
- **Less hydration**: static parts of the page cost no JS and no hydration time.
- **Streaming**: async server components suspend independently with `<Suspense>`.

```tsx
// Server Component — no 'use client'
import { marked } from 'marked'           // never shipped to the browser
import LikeButton from './LikeButton'      // client component

export default async function Post({ slug }: { slug: string }) {
  const post = await db.post.findUnique({ where: { slug } })
  const html = marked(post.body)
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: sanitize(html) }} />
      <LikeButton postId={post.id} initialLikes={post.likes} />
    </article>
  )
}
```

```tsx
'use client'
import { useState } from 'react'
export default function LikeButton({ postId, initialLikes }: { postId: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes)
  return <button onClick={() => { setLikes(l => l + 1); like(postId) }}>♥ {likes}</button>
}
```

## The 'use client' boundary

`'use client'` marks a **module** as an entry point into the client bundle. Everything it imports becomes client code too. So:

- Put `'use client'` as **low in the tree** as possible (a `LikeButton`, not the whole page).
- A client component **cannot import** a server component (it would become client code).
- But a client component **can render** server components passed to it as **props/children**:

```tsx
// Server: page.tsx
<Modal>                     {/* client component (needs state) */}
  <ProductDetails id={id} /> {/* server component, rendered on server, passed as children */}
</Modal>
```

`'use server'` is different: it marks **Server Actions** (functions callable from the client), not server components.

### What can cross the boundary (props from server → client)

Props must be **serialisable** by React: strings, numbers, booleans, `null`/`undefined`, plain objects/arrays, `Date`, `Map`, `Set`, typed arrays, **Promises** (consumed with `use()`), JSX elements, and Server Actions. **Not**: regular functions/event handlers, class instances, Symbols. "Functions cannot be passed directly to Client Components" is the classic error.

## How it works: the RSC payload

On a request, React renders the server component tree into a special streamed format (the **RSC payload**, a.k.a. "Flight") that describes the rendered output, with **placeholders referencing client components** (module ids + serialised props):

```text
0:["$","article",null,{"children":[["$","h1",null,{"children":"Hello"}], ...
1:I["./LikeButton.js",["chunk-a1b2"],"default"]
2:["$","$L1",null,{"postId":"42","initialLikes":7}]
```

The client React runtime:
1. Reads the payload stream and reconstructs the tree,
2. Loads the JS chunks for client components referenced,
3. Renders/hydrates only those client components.

For the initial page load, the framework also SSRs the whole result to HTML for fast paint. On client navigations it fetches **only the RSC payload** for the new route and **merges** it into the existing tree, preserving client state in shared layouts.

## Patterns

1. **Fetch in server components, interact in client leaves.** Pass data down as props.
2. **Composition over imports** — client wrappers (tabs, modals, carousels) accept server-rendered `children`.
3. **Providers**: context providers are client components; wrap them around `{children}` in the root layout — children can still be server components.
4. **Parallel data + Suspense** — start fetches without awaiting sequentially; wrap slow parts in `<Suspense>`.
5. **Mark server-only modules** with `import 'server-only'` so accidental client imports fail at build time (protects secrets).
6. **Mutations** with Server Actions, then `revalidatePath`/`revalidateTag` or `router.refresh()` to re-fetch the RSC payload.

## Trade-offs and gotchas

- Mental model shift: two environments, a module graph split by directives.
- Third-party components using hooks need `'use client'` wrappers.
- Interactivity requiring frequent updates must live in client components; you can't `useState` in a server component.
- Over-fetching per request without caching can make server rendering slow — use `cache()`, `fetch` caching, or data-layer caching.
- Server components re-render on navigation, so heavy server work should be cached.

:::question
difficulty: hard
### Server Components vs Client Components?
Server Components run only on the server (at build or request time), can be async and access databases, filesystems and secrets directly, and send only their rendered output (the RSC payload) — their code and dependencies never reach the browser and they don't hydrate. They can't use state, effects, event handlers, browser APIs or context. Client Components (`'use client'`) ship JS, are SSR'd to HTML and then hydrated, and support state, effects and interactivity. Use server components for data fetching and static/heavy rendering, client components as small interactive leaves; pass server-rendered content to client components via `children`, and keep props serialisable.
:::

:::question
difficulty: hard
### How are React Server Components different from SSR?
SSR is about *when/where HTML is produced*: it renders the (client) component tree to HTML on the server for a fast first paint, then the browser downloads the JS for **all** components and hydrates them. RSC is about *where components run*: server components execute only on the server and are never shipped or hydrated; their output is streamed as an RSC payload that can be refetched on navigation without losing client state. They're complementary — RSC frameworks still SSR the result for the initial load.
:::

:::question
difficulty: medium
### Can a Client Component render a Server Component?
It can't **import** one — anything imported by a `'use client'` module becomes client code. But it can **render** a server component that a server parent passes in as `children` or another JSX prop. The server renders that subtree and the client component just places the already-rendered result. This composition pattern lets interactive wrappers (modals, tabs) contain server-rendered content.
:::

:::challenge
difficulty: hard
### Fix the boundary errors
```tsx
// app/dashboard/page.tsx
'use client'
import { useState } from 'react'
import { db } from '@/lib/db'

export default async function Dashboard() {
  const [tab, setTab] = useState('sales')
  const stats = await db.stats.findMany()
  return (
    <>
      <Tabs value={tab} onChange={setTab} />
      <StatsTable stats={stats} formatter={n => n.toFixed(2)} />
    </>
  )
}
```
List the problems and restructure it.
@@@solution
Problems:
1. A `'use client'` component can't be `async` and can't `await` on the server.
2. Importing `db` into a client module would try to bundle database code (and credentials) for the browser.
3. The whole page becomes client JS even though only the tabs are interactive.
4. Passing a function (`formatter`) from a server to a client component isn't serialisable.

Restructure:
```tsx
// app/dashboard/page.tsx — Server Component
import 'server-only'
import { db } from '@/lib/db'
import DashboardTabs from './DashboardTabs'

export default async function Dashboard() {
  const stats = await db.stats.findMany()
  return (
    <DashboardTabs
      sales={<StatsTable stats={stats.filter(s => s.kind === 'sales')} />}
      traffic={<StatsTable stats={stats.filter(s => s.kind === 'traffic')} />}
    />
  )
}

function StatsTable({ stats }) { // server component: formatting happens here
  return <table><tbody>{stats.map(s => <tr key={s.id}><td>{s.label}</td><td>{s.value.toFixed(2)}</td></tr>)}</tbody></table>
}
```
```tsx
// app/dashboard/DashboardTabs.tsx
'use client'
import { useState, type ReactNode } from 'react'
export default function DashboardTabs({ sales, traffic }: { sales: ReactNode; traffic: ReactNode }) {
  const [tab, setTab] = useState<'sales' | 'traffic'>('sales')
  return (
    <>
      <div role="tablist">
        <button role="tab" aria-selected={tab === 'sales'} onClick={() => setTab('sales')}>Sales</button>
        <button role="tab" aria-selected={tab === 'traffic'} onClick={() => setTab('traffic')}>Traffic</button>
      </div>
      <div role="tabpanel">{tab === 'sales' ? sales : traffic}</div>
    </>
  )
}
```
Only the tab switcher ships JS; tables are server-rendered and passed as JSX props (serialisable).
:::

:::quiz
### Which can be passed as a prop from a Server Component to a Client Component?
- [ ] An onClick arrow function
- [x] A JSX element rendered on the server
- [ ] A class instance with methods
@@@explain
JSX, plain data, Dates, Promises and Server Actions are serialisable; ordinary functions are not.
:::

:::quiz
### What does 'use client' mark?
- [ ] A component that renders only in the browser and is never SSR'd
- [x] A module boundary whose exports (and imports) are part of the client bundle
- [ ] A server action
@@@explain
Client components are still SSR'd to HTML; the directive means "this code ships to and runs on the client".
:::
