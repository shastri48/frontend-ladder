---
title: State Management Architecture for Large Teams
summary: Classifying state, choosing tools per category, redesigning an app tangled in Redux + Context + local state, and how GraphQL fits at the architecture level.
minutes: 20
---

## The root cause of most state bugs

"Your application uses Redux, Context API and local state, creating synchronisation bugs. How would you redesign state management?" and "Explain your strategy for managing global state efficiently in a React app with multiple teams contributing" (Walmart).

The usual root cause is not the library — it's that **the same data lives in more than one place** (a copy of the user in Redux, another in Context, a third in a component's `useState` initialised from props) and those copies drift. The cure is a **single source of truth per piece of state**, with each category of state managed by the tool designed for it.

:::callout analogy One calendar
If your team keeps meetings in a shared calendar, a whiteboard and personal notebooks, double bookings are guaranteed. The fix isn't a better notebook — it's agreeing which calendar is the truth and making everything else read from it.
:::

## Classify state first

| Category | Examples | Best tool |
|---|---|---|
| **Server state** (cache of remote data) | Orders, user profile, product list | React Query / RTK Query / SWR / Apollo — caching, dedupe, invalidation, background refetch |
| **URL state** | Filters, sort, page, selected tab, search query | Router search params (`useSearchParams`) — shareable, back-button friendly |
| **Form state** | Field values, touched, validation | React Hook Form / Formik + schema (zod) |
| **Local UI state** | Is the modal open, hover, accordion expanded | `useState` / `useReducer` in the component |
| **Shared client state** | Theme, auth session, cart before checkout, wizard progress, feature toggles | Context (low-frequency) or Zustand/Redux Toolkit (frequent, complex) |
| **Derived state** | Totals, filtered lists | **Compute it** (selectors/`useMemo`) — never store it |

Once you classify, typically **70–80% of "global Redux state" turns out to be server cache**, which belongs in a query library. What remains global is small.

## Redesign playbook

1. **Inventory**: list every piece of state, where it lives, who writes it, who reads it.
2. **Kill duplicates**: each piece gets exactly one owner; others subscribe or derive.
3. **Move server data to a query cache** keyed by params; mutations **invalidate** keys instead of hand-updating multiple stores.
4. **Move filters/pagination to the URL.**
5. **Push local state down** to where it's used.
6. **Keep a small client store** (Redux Toolkit slices or Zustand stores) for truly shared client state, organised **per feature**.
7. **Never copy props into state** (`useState(props.user)` freezes the initial value) — derive or lift.
8. **Normalise** entities (by ID) if the same entity appears in many lists, or let the query cache's invalidation handle it.
9. Migrate incrementally, feature by feature, with tests.

```jsx
// Before: three copies of filters and orders
const [orders, setOrders] = useState([])                        // local copy
const { filters } = useContext(FiltersContext)                  // context copy
const reduxOrders = useSelector(s => s.orders.list)             // redux copy
useEffect(() => { fetchOrders(filters).then(o => { setOrders(o); dispatch(setOrdersList(o)) }) }, [filters])

// After: URL is the source of truth for filters, query cache for server data
const [params, setParams] = useSearchParams()
const filters = { status: params.get('status') ?? 'all', page: Number(params.get('page') ?? 1) }
const { data: orders, isPending } = useQuery({
  queryKey: ['orders', filters],
  queryFn: ({ signal }) => api.orders.list(filters, { signal }),
  placeholderData: keepPreviousData,
})
```

## Global state with many teams

- **Feature-scoped stores**: each feature owns its slice/store; no shared "god store" where everyone edits reducers. With Redux Toolkit, inject reducers lazily per feature (`combineSlices().inject`); with Zustand, one small store per feature.
- **Public selectors/hooks only**: other features consume `useCartCount()`, not `state.cart.items.length` — the shape is private.
- **Events over direct coupling** for cross-feature side effects (e.g. "order placed" → cart clears) via a typed event bus, RTK listener middleware, or query invalidation.
- **Performance**: subscribe to slices with selectors (`useSelector(selectX)`, Zustand selectors) to avoid re-rendering everything; memoise derived selectors (`createSelector`).
- **Tooling**: Redux DevTools for time travel, conventions documented in ADRs, lint rules against cross-feature imports.
- **Context is not a state manager** for high-frequency data: it has no selectors, so every consumer re-renders on every change. It's perfect for dependency injection and rarely changing values (theme, locale, auth user, feature flags).

### Redux Toolkit vs Context vs Zustand (quick view)

| | Context | Redux Toolkit | Zustand |
|---|---|---|---|
| Boilerplate | Minimal | Low (slices) | Minimal |
| Selective subscriptions | No | Yes | Yes |
| DevTools / time travel | No | Excellent | Via middleware |
| Middleware, side-effect patterns | DIY | Thunks, listener middleware, RTK Query | DIY/middleware |
| Best for | DI & low-frequency values | Large teams needing conventions | Small–medium shared state |

## GraphQL at the architecture level

GraphQL replaces many REST endpoints with a typed schema and client-specified queries.

**Benefits for frontend architecture**
- **No over/under-fetching** — each component (via **fragments**) declares exactly what fields it needs; queries compose fragments.
- **Typed end-to-end** — codegen produces TypeScript types and hooks from the schema.
- **Normalised client cache** (Apollo, Relay, urql Graphcache) keyed by `__typename:id`, so updating an entity anywhere updates every view.
- **One round trip** for screen data, great for mobile.
- **BFF pattern**: a GraphQL layer aggregates microservices for frontends.

**Costs**
- HTTP caching/CDN harder (POSTs; use persisted queries + GET).
- N+1 problems on the server (DataLoader), query complexity limits for security.
- Learning curve, client cache complexity, file uploads awkward.

**REST vs GraphQL quick answer**: REST exposes resources at URLs with fixed shapes and leverages HTTP semantics (caching, status codes); GraphQL exposes a single endpoint with a schema where clients ask for exactly the fields they need. Choose GraphQL for many clients with differing data needs and complex relational screens; REST for simple CRUD, public cacheable APIs and file-heavy workloads.

:::question
difficulty: hard
companies: Walmart
### Your app uses Redux, Context API and local state, creating synchronisation bugs. How would you redesign state management?
Inventory all state and classify it: server state, URL state, form state, local UI state, shared client state, derived state. Enforce a **single source of truth** for each: move server data to a query cache (React Query/RTK Query) with invalidation on mutations; move filters/pagination into URL params; keep UI state local; use a small feature-scoped store (Redux Toolkit or Zustand) only for genuinely shared client state; keep Context for low-frequency dependency injection (theme, auth, flags); compute derived data with selectors instead of storing it; never mirror props into state. Migrate feature by feature with tests and lint rules preventing direct cross-feature store access.
:::

:::question
difficulty: hard
companies: Walmart
### How do you manage global state efficiently in a React app with multiple teams contributing?
Minimise what's global (server state → query cache, URL state → router), split remaining client state into **feature-owned slices/stores** with private shapes and public hooks/selectors, communicate cross-feature through events or query invalidation instead of reaching into each other's state, use selector-based subscriptions to keep re-renders targeted, lazy-load feature reducers with their routes, document conventions in ADRs, and enforce boundaries with lint rules and CODEOWNERS.
:::

:::question
difficulty: medium
companies: Groww, Intuit
### REST vs GraphQL — what's the difference and when would you choose each?
REST models resources at multiple URLs with fixed response shapes and uses HTTP verbs, status codes and caching naturally. GraphQL exposes one endpoint and a typed schema; clients send queries selecting exactly the fields and nested relations they need, and mutations for writes. GraphQL shines when many clients need different shapes of related data, to avoid over-/under-fetching and multiple round trips, and with codegen/normalised caches. REST is simpler, cache/CDN-friendly, and fine for straightforward CRUD and public APIs. GraphQL trade-offs: harder HTTP caching (use persisted queries), server complexity (N+1, cost limits), and client cache complexity.
:::

:::challenge
difficulty: medium
### Find the state anti-patterns
```jsx
function OrderPage({ order }) {
  const [localOrder, setLocalOrder] = useState(order)
  const [total, setTotal] = useState(0)
  const { user } = useContext(AppContext)          // AppContext also holds cart, theme, filters
  const [page, setPage] = useState(1)

  useEffect(() => {
    setTotal(localOrder.items.reduce((s, i) => s + i.price * i.qty, 0))
  }, [localOrder])

  useEffect(() => {
    fetch(`/api/orders/${order.id}?page=${page}`).then(r => r.json()).then(setLocalOrder)
  }, [page])
  // ...
}
```
@@@solution
1. **Props mirrored into state** — `useState(order)` ignores later prop changes (stale when navigating to another order). Fetch by ID via a query cache or derive from props.
2. **Derived state stored** — `total` should be computed (`useMemo` or inline), not synced with an effect (extra render + possible inconsistency).
3. **God context** — `AppContext` holding cart, theme, filters means this page re-renders on any cart/theme change. Split contexts or use a store with selectors.
4. **Pagination in local state** — not shareable, lost on refresh/back. Put `page` in the URL.
5. **Unmanaged fetching** — no loading/error state, no cancellation (race when page changes quickly), missing `order.id` dependency, no caching/deduping. Use React Query with `queryKey: ['order', order.id, page]`.

```jsx
function OrderPage({ orderId }) {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1)
  const { data: order, isPending, error } = useQuery({
    queryKey: ['order', orderId, page],
    queryFn: ({ signal }) => api.getOrder(orderId, { page, signal }),
  })
  const user = useAuthUser()                               // narrow context/store hook
  const total = useMemo(() => order?.items.reduce((s, i) => s + i.price * i.qty, 0) ?? 0, [order])
  // ...
}
```
:::

:::quiz
### Where should table filters and the current page ideally live?
- [ ] A global Redux store
- [ ] Component local state
- [x] The URL (search params)
- [ ] localStorage
@@@explain
URL state is shareable, bookmarkable and works with back/forward navigation.
:::

:::quiz
### Why is React Context a poor fit for high-frequency global state?
- [ ] It can't hold objects
- [x] Every consumer re-renders whenever the value changes; there are no selectors
- [ ] It's deprecated
- [ ] It only works with class components
@@@explain
Context is great for dependency injection and low-frequency values like theme or locale.
:::
