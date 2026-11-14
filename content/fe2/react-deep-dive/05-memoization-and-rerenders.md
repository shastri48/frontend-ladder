---
title: Memoization & Preventing Re-renders
summary: React.memo, useMemo and useCallback — what they prevent, what they cost, and a systematic way to kill wasted renders.
minutes: 22
---

## The problem: render cascades

By default, when a component renders, **all of its descendants render too**. Usually that's fine — renders are cheap JS function calls. It becomes a problem when:

- The subtree is **large** (dashboards, tables, long lists).
- Some components do **expensive work** in render (sorting, filtering, formatting thousands of items).
- Updates are **frequent** (typing, dragging, scrolling, live prices over WebSocket).

:::visual react-rerender
:::

## The three tools

### React.memo — skip a component

```jsx
const Row = React.memo(function Row({ item, onSelect }) {
  return <li onClick={() => onSelect(item.id)}>{item.name}</li>
})
```

`React.memo` wraps a component so that, when its parent renders, React **shallowly compares** old and new props (`Object.is` per prop). If all equal, it reuses the previous result and skips the subtree. You can pass a custom comparator as the second argument (rarely needed).

`memo` only stops renders caused by the **parent**. The component still renders when its own state or a context it consumes changes.

### useMemo — cache a computed value

```jsx
const visible = useMemo(
  () => todos.filter(t => matches(t, filter)).sort(byDate),
  [todos, filter]
)
```

Two reasons to use it:
1. **Skip expensive recalculation** when inputs haven't changed.
2. **Keep a stable reference** for an object/array passed to a memoised child or used as an effect dependency.

### useCallback — cache a function identity

```jsx
const handleSelect = useCallback(id => setSelected(id), [])
```

`useCallback(fn, deps)` is exactly `useMemo(() => fn, deps)`. It does **not** make the function faster or prevent it from being created — the inline arrow is still allocated every render. It returns the *previous* function instance when deps are unchanged, so props stay referentially equal.

:::callout interview What useCallback prevents — and what it costs
It prevents a **memoised child** from re-rendering (or an **effect** from re-running) just because a callback got a new identity. It costs: a deps comparison every render, memory to hold the old closure, more complex code, and the risk of stale closures if deps are wrong. Without a `React.memo` consumer or an effect dependency, `useCallback` is pure overhead.
:::

## Why memo often "doesn't work"

```jsx
function Parent() {
  const [count, setCount] = useState(0)
  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <ExpensiveList
        items={items}
        style={{ color: 'red' }}          // ❌ new object every render
        onClick={() => console.log('hi')} // ❌ new function every render
      >
        <span>child</span>                {/* ❌ children are new elements every render */}
      </ExpensiveList>
    </>
  )
}
const ExpensiveList = React.memo(/* ... */)
```

Any one unstable prop defeats `memo`. Stabilise them: hoist constants outside the component, `useMemo` for objects, `useCallback` for handlers, and avoid passing JSX `children` into memoised components (or memoise the children element).

## A systematic playbook for "a parent updates and dozens of children re-render"

1. **Measure first.** React DevTools Profiler → "Highlight updates when components render" and the flame graph's "Why did this render?". Don't guess.
2. **Move state down (colocate).** If only the search box needs `query`, put the state in the search box, not the page.
3. **Lift content up / pass children.** A component that owns frequently-changing state can accept the expensive subtree as `children`. Elements created by the *grandparent* don't change when the parent's state changes, so React skips them.

```jsx
// Before: ScrollTracker's scroll state re-renders <HeavyContent/> every scroll
function Page() { return <ScrollTracker /> }
function ScrollTracker() {
  const [y, setY] = useState(0)
  /* ... */
  return <div>{y}<HeavyContent /></div>
}

// After: HeavyContent is created by Page, so it's the same element on each ScrollTracker render
function Page() { return <ScrollTracker><HeavyContent /></ScrollTracker> }
function ScrollTracker({ children }) {
  const [y, setY] = useState(0)
  return <div>{y}{children}</div>
}
```

4. **Split contexts** and memoise provider values so unrelated consumers don't re-render.
5. **Use selectors** with external stores (`useSelector(s => s.cart.count)`) so components subscribe only to what they read.
6. **Then** apply `React.memo` + stable props (`useCallback`/`useMemo`) to genuinely expensive components.
7. **Virtualise** long lists (render only visible rows).
8. **Defer non-urgent updates** with `useTransition` / `useDeferredValue` so typing stays responsive.

## When NOT to memoise

- Cheap components (a `<Button>` with a label).
- Values that change on almost every render anyway.
- Primitive values — they're already compared by value.

Measure: memoisation that never hits its cache is strictly slower.

:::callout info The React Compiler
React Compiler (stable in 2025) automatically memoises components and values at build time, making most manual `useMemo`/`useCallback`/`memo` unnecessary. You still need to understand *why* re-renders happen — the compiler only works if your components follow the rules (pure render, no mutation).
:::

## Common performance optimisation techniques (summary)

| Technique | Fixes |
|---|---|
| State colocation, children-as-props | Unnecessary render cascades |
| `React.memo` + stable props | Re-rendering expensive pure children |
| `useMemo` | Expensive derived data recomputed |
| Context splitting, selectors | Global state updates touching everything |
| Virtualisation (`react-window`, TanStack Virtual) | Thousands of DOM nodes |
| `React.lazy` + `Suspense`, route splitting | Large initial bundle |
| `useTransition` / `useDeferredValue` | Input lag during heavy re-renders |
| Debounce/throttle input & scroll handlers | Too many updates |
| Stable keys | Remounting list items |
| Web Workers | CPU-heavy work blocking the main thread |

:::question
difficulty: medium
companies: Accenture, Impact Analytics
### What is the purpose of the useMemo hook?
`useMemo(compute, deps)` caches the result of a calculation between renders and recomputes only when a dependency changes. Use it to avoid repeating expensive work (filtering/sorting large arrays, heavy formatting) and to keep a **stable reference** for objects/arrays passed to `React.memo` children or used in effect dependencies. It's a performance hint, not a semantic guarantee — React may discard the cache — so code must still work without it.
:::

:::question
difficulty: medium
companies: CRED, Accenture, Impact Analytics
### What is the purpose of the useCallback hook? What does it prevent and what does it cost?
`useCallback(fn, deps)` returns the same function instance across renders until deps change. It prevents a `React.memo` child from re-rendering because a callback prop got a new identity, and prevents effects that depend on the function from re-running. It costs a dependency comparison every render, keeps the old closure in memory, adds complexity and can cause stale-closure bugs with wrong deps. It doesn't avoid creating the function — the inline function is still allocated. Without a memoised consumer it's pure overhead.
:::

:::question
difficulty: medium
companies: Impact Analytics, Noon
### Explain React.memo vs useMemo vs useCallback.
- **`React.memo(Component)`** — a higher-order component that skips re-rendering when props are shallowly equal. Works at the **component** level.
- **`useMemo(() => value, deps)`** — caches a **value** inside a component.
- **`useCallback(fn, deps)`** — caches a **function identity**; equivalent to `useMemo(() => fn, deps)`.

They work together: `memo` on the child only helps if the parent passes stable props, which `useMemo`/`useCallback` provide.
:::

:::question
difficulty: medium
companies: Accenture, Noon
### How do you prevent unnecessary re-renders?
Measure with the React Profiler first. Then: colocate state close to where it's used; pass expensive subtrees as `children` so they're created by a component that doesn't re-render; split contexts and memoise provider values; use selector-based subscriptions for global stores; wrap expensive pure components in `React.memo` and stabilise their props with `useCallback`/`useMemo`; use stable keys; virtualise long lists; defer non-urgent updates with `useTransition`/`useDeferredValue`. Don't memoise everything — it costs memory and comparisons.
:::

:::question
difficulty: hard
companies: Walmart
### A complex dashboard lags when users apply filters. How do you profile and optimise it?
1. **Reproduce and measure**: Chrome Performance panel (long tasks, scripting vs rendering), React Profiler (which components render, how long, why).
2. **Identify the cause**: commonly the filter state lives at the top and re-renders every widget; expensive derived data recomputed per render; huge tables rendering thousands of rows; synchronous heavy computation.
3. **Fix**: keep filter state in a store with selectors so only affected widgets subscribe; memoise derived data (`useMemo`, or memoised selectors via `reselect`); wrap widgets in `memo`; virtualise tables; debounce text filters; mark the expensive update as a transition (`startTransition`) so the input stays responsive; move heavy aggregation to a Web Worker or the server; fetch pre-aggregated data.
4. **Verify** with the profiler again and set performance budgets.
:::

:::challenge
difficulty: medium
companies: Noon
### Why does the memoised child still re-render?
```jsx
const Chart = React.memo(function Chart({ data, options, onPointClick }) { /* expensive */ })

function Dashboard({ raw }) {
  const [tab, setTab] = useState('a')
  const data = raw.map(toPoint)
  return (
    <>
      <Tabs value={tab} onChange={setTab} />
      <Chart data={data} options={{ legend: true }} onPointClick={p => console.log(p)} />
    </>
  )
}
```
Switching tabs re-renders `Chart`. Fix it with minimal changes.
@@@solution
All three props are new references each render: `raw.map` returns a new array, the options literal is a new object, the arrow is a new function. `memo`'s shallow compare fails.

```jsx
const CHART_OPTIONS = { legend: true } // static → hoist out of the component

function Dashboard({ raw }) {
  const [tab, setTab] = useState('a')
  const data = useMemo(() => raw.map(toPoint), [raw])
  const onPointClick = useCallback(p => console.log(p), [])
  return (
    <>
      <Tabs value={tab} onChange={setTab} />
      <Chart data={data} options={CHART_OPTIONS} onPointClick={onPointClick} />
    </>
  )
}
```
Alternative: move `tab` state into a component that doesn't contain `Chart` (state colocation), making memoisation unnecessary.
:::

:::challenge
difficulty: hard
companies: Noon
### Case study: three ways to render a filterable list — rank them
```jsx
// A: filter in an effect
const [filtered, setFiltered] = useState([])
useEffect(() => setFiltered(items.filter(i => i.name.includes(q))), [items, q])

// B: filter during render
const filtered = items.filter(i => i.name.includes(q))

// C: memoised filter + deferred query
const deferredQ = useDeferredValue(q)
const filtered = useMemo(() => items.filter(i => i.name.includes(deferredQ)), [items, deferredQ])
```
@@@solution
- **A is worst.** It renders once with stale `filtered`, then the effect sets state and renders again — two renders per keystroke, a frame of stale UI, and an extra state variable that can get out of sync. Derived data should not live in state.
- **B is correct and simplest.** Fine for small/medium lists. Its only issue is recomputing on unrelated re-renders.
- **C is best for large lists.** `useMemo` skips filtering when unrelated state changes; `useDeferredValue` lets the input update immediately while the expensive list re-render happens at lower priority and can be interrupted by the next keystroke.

Pick B by default, upgrade to C when profiling shows the filter or list render is slow; never A.
:::

:::quiz
### `useCallback(fn, [])` is passed to a child that is NOT wrapped in React.memo. Benefit?
- [ ] The child stops re-rendering
- [x] Essentially none — the child re-renders with its parent anyway
- [ ] The function body runs faster
@@@explain
Stable identity only matters to consumers that compare it: memoised components or hook dependency arrays.
:::

:::quiz
### Which technique avoids re-rendering an expensive subtree without any memoisation?
- [ ] Wrapping state in useRef
- [x] Passing the subtree as children from a component that doesn't re-render
- [ ] Using index keys
@@@explain
Elements created by an un-rendered owner are the same objects, so React bails out of them.
:::
