---
title: Component Design, Lazy Loading & React Router
summary: Splitting components for performance and maintainability, React.lazy + Suspense, and routing with nested, relative and protected routes.
minutes: 20
---

## Splitting components well

A component should have **one reason to change**. Splitting isn't about line count — it's about isolating what changes together, and isolating what *renders* together.

### For maintainability

- **Presentational vs container**: UI pieces that only take props (`<UserCard user={...}/>`) vs components that fetch/own state. Presentational parts are easy to test, reuse and put in Storybook.
- **Feature folders**: colocate a feature's components, hooks, API calls, tests and styles (`features/checkout/...`) rather than global `components/`, `hooks/` buckets.
- **Composition over configuration**: prefer `<Card><Card.Header/>...</Card>` (compound components) to a `<Card>` with 25 boolean props.
- **Extract hooks** for logic (`useCart()`), keep components mostly JSX.

### For performance

- **Isolate frequently-updating state** in small leaf components (a ticking clock, a typing input, hover state) so their updates don't re-render siblings.
- **Split at render-cost boundaries**: wrap expensive, stable parts so they can be memoised or passed as `children`.
- **Split at load boundaries**: routes, modals, heavy editors, charts — load them lazily.

```jsx
// ❌ the whole page re-renders on every keystroke
function ProductPage() {
  const [query, setQuery] = useState('')
  return (<>
    <input value={query} onChange={e => setQuery(e.target.value)} />
    <Gallery /> <Reviews /> <Recommendations />
  </>)
}

// ✅ only SearchBox re-renders
function ProductPage() {
  return (<><SearchBox /><Gallery /><Reviews /><Recommendations /></>)
}
```

## Lazy loading with React.lazy and Suspense

Bundlers split code at **dynamic `import()`** boundaries. `React.lazy` turns a dynamic import into a component; `Suspense` shows a fallback while the chunk downloads.

```jsx
import { lazy, Suspense } from 'react'

const Settings = lazy(() => import('./pages/Settings'))
const Chart = lazy(() => import('./components/HeavyChart'))

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  )
}
```

How it works: on first render `Settings` **throws a promise** (the import). The nearest `<Suspense>` catches it, renders the fallback, and re-renders when the promise resolves. The module must have a **default export** (or map it: `lazy(() => import('./x').then(m => ({ default: m.Named })))`).

What to lazy-load:
- **Routes** — the biggest, safest win.
- **Below-the-fold or interaction-gated UI** — modals, drawers, rich text editors, charts, maps, emoji pickers.
- **Admin-only / rarely-used features**.

Tips:
- **Prefetch** likely next chunks on hover or idle: `const load = () => import('./Settings')` called in `onMouseEnter`.
- Avoid **too many tiny chunks** (request overhead) and **waterfalls** (lazy component that lazily loads another).
- Put an **error boundary** around lazy parts — chunk loads can fail after a deploy; offer a reload.
- Image lazy loading is separate: `<img loading="lazy">` and `IntersectionObserver`.

## React Router essentials (v6/v7)

```jsx
import { createBrowserRouter, RouterProvider, Outlet, Link, NavLink, useParams, useNavigate } from 'react-router-dom'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,           // header + <Outlet/>
    errorElement: <RootError />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'projects',
        element: <ProjectsLayout />,   // sidebar + <Outlet/>
        children: [
          { index: true, element: <ProjectList /> },
          { path: ':projectId', element: <ProjectDetail />, loader: projectLoader },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])

function RootLayout() {
  return (<><Header /><main><Outlet /></main></>)
}

export default function App() { return <RouterProvider router={router} /> }
```

### Key concepts

- **Nested routes + `<Outlet/>`**: child routes render inside the parent layout's `<Outlet/>`. Layout state survives navigation between children.
- **Index route**: the default child for the parent's path.
- **Dynamic segments**: `:projectId` read with `useParams()`.
- **Relative vs absolute paths**: a path starting with `/` is absolute from the root. Without `/`, paths in `<Route>` and `<Link to>` are **relative to the parent route**. `<Link to="settings">` inside `/projects/42` goes to `/projects/42/settings`; `to=".."` goes up one route level.
- **`<Link>` vs `<a>`**: Link updates history via `pushState` without a full reload. `NavLink` adds active styling.
- **Programmatic navigation**: `const navigate = useNavigate(); navigate('/login', { replace: true, state: { from: location } })`.
- **Search params**: `useSearchParams()` for filters/pagination — makes state shareable in the URL.
- **Loaders and actions** (data routers): `loader` fetches data before the route renders (in parallel for nested routes — no waterfalls), `action` handles form submissions; `useLoaderData()` reads it.

### Protected routes

```jsx
function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

// routes: { element: <RequireAuth />, children: [{ path: 'dashboard', element: <Dashboard/> }] }
```
After login: `navigate(location.state?.from?.pathname ?? '/', { replace: true })`. Remember: client-side guards are UX only — **the server must authorise every API call**. Details in **State & Data → Auth & Route Protection**.

### How client-side routing works under the hood

The History API (`history.pushState`, `popstate` event) changes the URL without a reload. The router listens, matches the URL against the route tree and renders the matched elements. On a hosting platform, all unknown paths must be rewritten to `index.html` (SPA fallback) or a refresh on `/projects/42` returns 404.

## Testing React components (pointer)

Test behaviour, not implementation: render with React Testing Library, query by role/label, fire user events, assert on what users see. Mock the network with MSW. Covered in depth in **TypeScript & Testing**.

:::question
difficulty: medium
companies: Accenture
### What is lazy loading in React?
Lazy loading defers loading code until it's needed. `React.lazy(() => import('./Page'))` creates a component whose code is split into a separate chunk by the bundler; it's fetched on first render. `<Suspense fallback={...}>` shows a placeholder while the chunk loads. Commonly applied to routes, modals, charts and editors to shrink the initial bundle and improve load time (LCP, TTI). Wrap lazy parts in an error boundary for chunk-load failures and prefetch likely-needed chunks.
:::

:::question
difficulty: medium
companies: Accenture
### Explain React Router, relative vs absolute paths and navigation use cases.
React Router maps URLs to components using the History API, so navigation doesn't reload the page. Routes can nest: a parent layout renders child routes in `<Outlet/>`. **Absolute paths** start with `/` and resolve from the root; **relative paths** (no leading slash) resolve against the current route, so `<Link to="edit">` inside `/users/7` goes to `/users/7/edit` and `..` goes up a route level. Navigation: `<Link>`/`<NavLink>` for user clicks, `useNavigate()` for programmatic redirects (after login, form submit, `replace` to avoid back-button loops), `<Navigate>` for declarative redirects (guards), `useParams`/`useSearchParams` to read URL state.
:::

:::question
difficulty: medium
companies: Impact Analytics
### How do you split React components for both performance and maintainability?
For maintainability: single responsibility, presentational vs container separation, logic in custom hooks, compound components over prop explosions, feature-based folders. For performance: isolate frequently-changing state in small leaves (state colocation), pass expensive stable subtrees as `children`, memoise expensive pure components, and split by load boundaries (lazy routes, modals, heavy widgets). Measure with the Profiler before optimising.
:::

:::challenge
difficulty: medium
companies: Tekion
### Build a React list with expand/collapse
Render a list of FAQ items `{ id, question, answer }`. Clicking a question toggles its answer. Support an "allow multiple open" prop and "Expand all / Collapse all" buttons. Make it accessible.
@@@solution
```jsx
function Accordion({ items, allowMultiple = false }) {
  const [open, setOpen] = useState(() => new Set())

  const toggle = id => setOpen(prev => {
    const next = new Set(allowMultiple ? prev : [])
    if (prev.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div>
      {allowMultiple && (
        <div>
          <button onClick={() => setOpen(new Set(items.map(i => i.id)))}>Expand all</button>
          <button onClick={() => setOpen(new Set())}>Collapse all</button>
        </div>
      )}
      <ul>
        {items.map(item => {
          const isOpen = open.has(item.id)
          return (
            <li key={item.id}>
              <h3>
                <button
                  aria-expanded={isOpen}
                  aria-controls={`panel-${item.id}`}
                  id={`header-${item.id}`}
                  onClick={() => toggle(item.id)}
                >
                  {isOpen ? '▾' : '▸'} {item.question}
                </button>
              </h3>
              <div
                id={`panel-${item.id}`}
                role="region"
                aria-labelledby={`header-${item.id}`}
                hidden={!isOpen}
              >
                {item.answer}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```
Talking points: a `Set` of open ids (O(1) lookups, supports multiple); immutable updates (new Set); stable `key`; `button` for keyboard support; `aria-expanded`/`aria-controls`; `hidden` keeps panels out of the accessibility tree. Extensions: nested items (recursive component), animation via CSS `grid-template-rows: 0fr → 1fr`, lazy-render answers, persist open state in the URL.
:::

:::challenge
difficulty: medium
### Lazy load a heavy chart only when it scrolls into view
Render a placeholder, and load `./HeavyChart` (default export) only when the placeholder enters the viewport.
@@@solution
```jsx
const HeavyChart = lazy(() => import('./HeavyChart'))

function useInView(options) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect() }
    }, options)
    io.observe(el)
    return () => io.disconnect()
  }, [inView])
  return [ref, inView]
}

function ChartSection(props) {
  const [ref, inView] = useInView({ rootMargin: '200px' }) // start a bit early
  return (
    <section ref={ref} style={{ minHeight: 320 }}>
      {inView && (
        <ErrorBoundary fallback={<p>Chart failed to load.</p>}>
          <Suspense fallback={<ChartSkeleton />}>
            <HeavyChart {...props} />
          </Suspense>
        </ErrorBoundary>
      )}
    </section>
  )
}
```
`minHeight` reserves space to avoid layout shift (CLS); `rootMargin` prefetches slightly before it's visible; disconnecting the observer avoids leaks.
:::

:::quiz
### Inside the route `/users/:id`, `<Link to="posts">` navigates to…
- [ ] /posts
- [x] /users/:id/posts (with the actual id)
- [ ] /users/posts
@@@explain
Paths without a leading slash are relative to the current route.
:::

:::quiz
### What does React.lazy require from the imported module?
- [x] A default export that is a component
- [ ] A named export called Component
- [ ] Nothing — any module works
@@@explain
React.lazy expects the promise to resolve to a module with a default export.
:::
