---
title: React Rendering Performance & Memoization
summary: Profiling a laggy dashboard, preventing wasted re-renders, memoising expensive computations, and knowing when memoisation hurts.
minutes: 20
---

## The mental model: render is cheap-ish, wasted render at scale is not

React re-renders a component when **its state changes, its parent re-renders, or a context it consumes changes**. Props changing is *not* the trigger — a parent re-render is. By default, a parent rendering re-renders every child below it.

:::visual react-rerender
:::

A single wasted render costs microseconds. A dashboard with 40 widgets, each with charts and 200 table rows, re-rendering on every keystroke costs hundreds of milliseconds — that's a poor INP.

:::callout analogy The office announcement
When a manager (parent) makes an announcement, everyone on the floor stops to listen — even people it doesn't concern. `React.memo` is a sign on someone's door: "only interrupt me if something addressed to me changed". Context is a building-wide PA system: everyone subscribed hears every announcement.
:::

## Case study: "the dashboard lags when users apply filters"

Walmart asked exactly this. Here's the systematic approach.

### 1. Reproduce and measure

- React Profiler with "why did this render" → which components render on a filter change, and how long each commit takes.
- Performance panel → is the time in React render (scripting), layout, or chart library painting?
- Note the interaction's INP in the Performance panel's Interactions track.

### 2. Typical findings and fixes

| Finding | Fix |
|---|---|
| Filter state lives in a top-level `DashboardContext` with one big value object; every widget consumes it | Split contexts (filters vs. user vs. theme), or use a store with **selectors** (Zustand/Redux `useSelector`) so widgets subscribe only to slices they use |
| Each widget recomputes aggregates over 100k rows every render | `useMemo` keyed by data + relevant filter, or move to a Web Worker / server |
| All widgets re-render even if their filter didn't change | `React.memo` widgets + stable props (`useCallback`, memoised objects) |
| Every keystroke in a text filter re-fetches and re-renders | Debounce input, `useDeferredValue`/`startTransition` for the expensive update |
| Charts redraw from scratch | Pass memoised data, update via library API, throttle real-time updates |
| Request waterfall per widget | Batch fetches, cache with React Query keyed by filters, prefetch on hover |
| Out-of-order responses overwrite fresh data | AbortController / request IDs |

### 3. Verify

Re-profile the same interaction; the commit should touch only affected widgets, with interaction latency < 200 ms.

## The tools of memoisation

```jsx
// 1. React.memo — skip re-render if props are shallow-equal
const Widget = React.memo(function Widget({ data, onSelect }) { /* ... */ })

// 2. useMemo — cache a computed value between renders
const totals = useMemo(() => aggregate(rows, filters), [rows, filters])

// 3. useCallback — cache a function identity (useMemo for functions)
const handleSelect = useCallback(id => setSelected(id), [])
```

**These only work together.** `React.memo(Child)` is useless if the parent passes `style={{...}}`, `items={data.filter(...)}`, or `onClick={() => ...}` created fresh every render.

### Prefer structure over memo

Often you can avoid memoisation altogether by restructuring:

**Move state down** — state that only one part of the tree needs shouldn't live at the top:

```jsx
// ❌ typing re-renders the whole page, including <ExpensiveTree />
function Page() {
  const [text, setText] = useState('')
  return (<><input value={text} onChange={e => setText(e.target.value)} /><ExpensiveTree /></>)
}

// ✅ the input owns its state; ExpensiveTree never re-renders
function SearchInput() {
  const [text, setText] = useState('')
  return <input value={text} onChange={e => setText(e.target.value)} />
}
function Page() { return (<><SearchInput /><ExpensiveTree /></>) }
```

**Lift content up (children as props)** — elements created by a grandparent don't re-render when an intermediate stateful wrapper re-renders:

```jsx
function ScrollTracker({ children }) {
  const [y, setY] = useState(0)
  // children were created by Page, so they keep the same element identity
  return <div onScroll={e => setY(e.currentTarget.scrollTop)}>{children}</div>
}
<ScrollTracker><ExpensiveTree /></ScrollTracker>
```

## Memoising expensive computations (beyond React)

Memoisation = caching a pure function's output by its input. In React you have `useMemo`; in plain JS you write a `memoize` utility.

```js
function memoize(fn, { key = (...args) => JSON.stringify(args), max = 500 } = {}) {
  const cache = new Map()
  return function (...args) {
    const k = key(...args)
    if (cache.has(k)) {
      const v = cache.get(k)
      cache.delete(k); cache.set(k, v)      // refresh LRU position
      return v
    }
    const result = fn.apply(this, args)
    cache.set(k, result)
    if (cache.size > max) cache.delete(cache.keys().next().value) // evict oldest
    return result
  }
}
```

Design decisions interviewers probe:
- **Cache key**: `JSON.stringify` is slow for large args and breaks on key order; use a custom key or a `WeakMap` keyed by object identity.
- **Bounded size**: unbounded caches are memory leaks — use LRU or TTL.
- **Purity**: only memoise pure functions.
- **Async memoisation**: cache the **promise** to dedupe concurrent calls; delete on rejection.
- **Selectors**: `reselect`/`createSelector` memoise derived Redux state by input selectors.

## When memoisation hurts

- `useMemo` has a cost: dependency comparison + retained memory. Memoising `a + b` is slower than computing it.
- Wrong dependencies → **stale values** bugs.
- Memoising everything makes code noisy and hides the real fix (state colocation).
- **React Compiler** (React 19 era) auto-memoises components and values at build time, making most manual `useMemo`/`useCallback` unnecessary — but understanding *why* re-renders happen still matters for architecture (context design, state placement).

:::callout interview A strong closing line
"I treat memoisation as a targeted fix after profiling, not a default. First I colocate state and split contexts; then I memoise components on hot paths with stable props; and I verify with the Profiler that the render actually disappeared."
:::

:::question
difficulty: medium
companies: Walmart, Noon
### How do you prevent unnecessary re-renders in React?
1. **Colocate state** — keep state as low as possible so updates affect small subtrees.
2. **Children-as-props** pattern — stateful wrappers don't re-render elements passed in from above.
3. **`React.memo`** on expensive pure components, together with **stable props** (`useCallback`, `useMemo`, hoisted constants).
4. **Split contexts** or use selector-based stores (Redux `useSelector`, Zustand, `use-context-selector`) so consumers subscribe to slices.
5. **Stable keys** in lists (IDs, not indexes) so React reuses components instead of remounting.
6. **Defer** non-urgent updates with `startTransition`/`useDeferredValue`, debounce rapid input.
7. **Measure** with the React Profiler before and after. Consider React Compiler for automatic memoisation.
:::

:::question
difficulty: medium
companies: Impact Analytics
### Explain useMemo, useCallback and React.memo — and how they relate.
- `React.memo(Component)` — a higher-order component that skips re-rendering when props are shallowly equal to last time.
- `useMemo(fn, deps)` — returns a cached **value** recomputed only when deps change. Used for expensive calculations and for keeping object/array identities stable.
- `useCallback(fn, deps)` — returns a cached **function identity**; equivalent to `useMemo(() => fn, deps)`.

They relate because `React.memo` compares props by reference: if you pass new objects/functions each render, memo never bails out. `useMemo`/`useCallback` provide the stable references that make `React.memo` effective, and also stable dependencies for `useEffect`. Each has a cost (comparison + memory), so use them where profiling shows a benefit.
:::

:::question
difficulty: hard
### Why can a context provider re-render the whole app, and how do you fix it?
Every consumer of a context re-renders when the provider's `value` changes **by reference**. Two common mistakes:
1. `value={{ user, setUser }}` creates a new object every render of the provider → all consumers re-render even if `user` didn't change. Fix: `useMemo(() => ({ user, setUser }), [user])`.
2. One big context holding unrelated, frequently changing state (filters, theme, user, cart) → a filter change re-renders the cart badge. Fix: **split contexts** by update frequency, separate state and dispatch contexts, or use a store with selectors (`useSyncExternalStore` based libraries like Zustand/Redux) where components subscribe to slices.
:::

:::challenge
difficulty: hard
companies: Walmart
### A complex dashboard lags when users apply filters — profile and optimise it
```jsx
function Dashboard({ rawRows }) {
  const [filters, setFilters] = useState({ region: 'all', q: '' })
  const ctx = { filters, setFilters }
  return (
    <FiltersContext.Provider value={ctx}>
      <FilterBar />
      <KpiCards rows={rawRows} />
      <RevenueChart rows={rawRows} />
      <OrdersTable rows={rawRows} />
    </FiltersContext.Provider>
  )
}
// each widget does: const { filters } = useContext(FiltersContext)
// and then: rawRows.filter(...).reduce(...) on every render (rawRows = 150k rows)
// FilterBar's search input calls setFilters on every keystroke
```
Identify the problems and write the improved version.
@@@solution
**Problems**
1. `ctx` is a new object every render → every consumer re-renders on any Dashboard render.
2. Every keystroke updates shared state → all widgets recompute over 150k rows synchronously (long task → bad INP).
3. Each widget recomputes the same `filter` separately (3× work), and none is memoised.
4. The table renders all filtered rows (no virtualization).

**Improved**
```jsx
function Dashboard({ rawRows }) {
  const [filters, setFilters] = useState({ region: 'all', q: '' })
  const deferredFilters = useDeferredValue(filters)          // widgets update at low priority

  // filter once, share the result
  const filteredRows = useMemo(
    () => applyFilters(rawRows, deferredFilters),
    [rawRows, deferredFilters]
  )
  const isStale = filters !== deferredFilters

  return (
    <>
      <FilterBar filters={filters} onChange={setFilters} />   {/* stays snappy */}
      <div style={{ opacity: isStale ? 0.6 : 1 }}>
        <KpiCards rows={filteredRows} />
        <RevenueChart rows={filteredRows} />
        <OrdersTable rows={filteredRows} />  {/* virtualized inside */}
      </div>
    </>
  )
}

const KpiCards = React.memo(function KpiCards({ rows }) {
  const kpis = useMemo(() => computeKpis(rows), [rows])
  return /* … */
})
```
Plus:
- Debounce the free-text search (~250 ms) before it updates `filters.q` if typing still feels heavy.
- If `applyFilters` on 150k rows is still > 50 ms, run it in a **Web Worker** or push filtering to the **server** (and cache per filter with React Query).
- Virtualize `OrdersTable`.
- Throttle chart re-draws and memoise chart data/options.

**Verify** with the Profiler: typing renders only `FilterBar` synchronously; widgets render once in a transition, and INP stays < 200 ms.
:::

:::challenge
difficulty: medium
companies: Intuit, Google
### Implement memoize(fn) with a bounded cache
Write `memoize(fn, max)` that caches results by arguments (primitives), returns cached results for repeated calls, preserves `this`, and evicts the least-recently-used entry when more than `max` entries are stored.
@@@starter
```js
function memoize(fn, max = 100) {
  // your code
}
```
@@@tests
```js
test('caches results', () => {
  let calls = 0
  const sq = memoize((n) => { calls++; return n * n })
  expect(sq(4)).toBe(16); expect(sq(4)).toBe(16)
  expect(calls).toBe(1)
})
test('different args are cached separately', () => {
  let calls = 0
  const add = memoize((a, b) => { calls++; return a + b })
  add(1, 2); add(2, 1); add(1, 2)
  expect(calls).toBe(2)
})
test('evicts least recently used', () => {
  let calls = 0
  const id = memoize((x) => { calls++; return x }, 2)
  id(1); id(2); id(1)   // 1 is now most recent
  id(3)                 // evicts 2
  id(1)                 // cached
  expect(calls).toBe(3)
  id(2)                 // recomputed
  expect(calls).toBe(4)
})
test('preserves this', () => {
  const obj = { base: 10, add: memoize(function (n) { return this.base + n }) }
  expect(obj.add(5)).toBe(15)
})
```
@@@solution
```js
function memoize(fn, max = 100) {
  const cache = new Map()   // Map keeps insertion order → cheap LRU
  return function (...args) {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      const value = cache.get(key)
      cache.delete(key)      // move to the "most recent" end
      cache.set(key, value)
      return value
    }
    const value = fn.apply(this, args)
    cache.set(key, value)
    if (cache.size > max) {
      const oldestKey = cache.keys().next().value
      cache.delete(oldestKey)
    }
    return value
  }
}
```
**Notes**: `Map` iterates in insertion order, so deleting + re-inserting on hit makes the first key the least-recently used — O(1) get and set. `JSON.stringify` is fine for primitive args; for object args use a `WeakMap` chain or a custom resolver. Including `this` in the key matters if the result depends on it and the function is shared across objects.
:::

:::quiz
### A parent passes `onClick={() => save(id)}` to a `React.memo` child. What happens when the parent re-renders?
- [ ] The child skips rendering
- [x] The child re-renders because the function prop is a new reference
- [ ] React throws a warning
- [ ] Only the onClick is updated without rendering
@@@explain
Memo compares props shallowly; a new arrow function each render breaks equality. Use useCallback.
:::

:::quiz
### What actually triggers a component to re-render by default?
- [ ] Its props object being deeply different
- [x] Its own state change, its parent re-rendering, or a consumed context changing
- [ ] Any DOM event on the page
- [ ] Only calls to forceUpdate
@@@explain
Without memo, a parent render re-renders children regardless of whether props changed.
:::
