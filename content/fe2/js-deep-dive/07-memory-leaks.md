---
title: Memory Management, Garbage Collection & Memory Leaks
summary: How JavaScript allocates and frees memory, why "reachability" is everything, the usual leak patterns in SPAs, and a step-by-step DevTools workflow to find and fix them.
minutes: 16
---

## You don't free memory — but you can still leak it

JavaScript is garbage-collected: you never call `free()`. The engine allocates memory when you create objects, strings, closures and arrays, and reclaims it when they're no longer **reachable**.

A **memory leak** in JS is therefore not "forgot to free" — it's **"accidentally kept something reachable"**. In a long-lived single-page app (users keep a tab open all day, navigate between routes without reloading), small leaks accumulate until the tab slows down or crashes. Walmart, Coinbase and many others ask "what does a memory leak look like in a long-lived SPA and how would you debug it?"

## Stack vs heap

| | Stack | Heap |
|---|---|---|
| Stores | Primitive locals, references, call frames | Objects, arrays, functions, closures' environments, big strings |
| Lifetime | Popped automatically when a function returns | Until unreachable, then GC |
| Size | Small, fixed | Large, dynamic |

```js
function demo() {
  const n = 42                   // value in the frame
  const user = { name: 'Ana' }   // reference in the frame → object in heap
  return user                    // object survives because the caller holds it
}
```

## How garbage collection works: mark-and-sweep

Modern engines use **reachability** from a set of **roots**:

- Global object (`window`/`globalThis`) and module scopes
- The current call stack (locals and arguments of running functions)
- Active handles held by the host: DOM tree, registered event listeners, timers, pending promises' reactions, etc.

**Mark phase:** start at the roots, follow every reference, mark everything you can reach.
**Sweep phase:** free everything unmarked.

```text
roots ──► window ──► app ──► cache ──► {…}      ✔ reachable
                         └─► currentUser ──► {…} ✔ reachable
          (no path) ──► oldModal {…}            ✘ collected
```

This handles cycles naturally (two objects referencing each other but unreachable from roots are collected) — unlike old **reference counting**, which leaked cycles.

### Generational GC (V8)

Most objects die young. V8 splits the heap:

- **Young generation (nursery)** — small, collected very often with a fast copying "scavenger".
- **Old generation** — objects that survived a couple of scavenges; collected less often with mark-sweep-compact, done incrementally and concurrently to avoid long pauses.

Allocating tons of short-lived objects in hot paths (e.g. inside a scroll handler) causes frequent minor GCs — visible as small "GC" slices in the Performance panel.

## The usual leak patterns

### 1. Forgotten event listeners

```js
function openModal() {
  const modal = createModal()
  window.addEventListener('resize', () => modal.reposition()) // never removed
}
```

Every `openModal()` adds a listener on `window` (a root) whose closure retains `modal` — even after the modal is removed from the DOM. Fix: keep a reference and `removeEventListener`, or use an `AbortController` signal:

```js
const controller = new AbortController()
window.addEventListener('resize', onResize, { signal: controller.signal })
// later
controller.abort() // removes all listeners registered with this signal
```

### 2. Timers and intervals never cleared

```js
setInterval(() => updateChart(bigDataset), 1000) // runs forever, retains bigDataset
```

### 3. Detached DOM nodes

A node removed from the document but still referenced from JS (an array, a Map, a closure) can't be freed — and it keeps its **whole subtree** alive.

```js
const rows = []
function addRow() {
  const tr = document.createElement('tr')
  table.appendChild(tr)
  rows.push(tr) // later table.innerHTML = '' — DOM gone, but `rows` still holds every <tr>
}
```

### 4. Unbounded caches / global collections

```js
const cache = {}
function getUser(id) {
  return (cache[id] ??= fetchUser(id)) // grows forever
}
```

Use an LRU with a max size, a TTL, or `WeakMap` when keys are objects (entries vanish when the key object is collected).

### 5. Closures holding more than you think

A long-lived closure keeps its whole scope's referenced variables alive (see the closures lesson).

### 6. Subscriptions in React components without cleanup

```jsx
useEffect(() => {
  const unsub = store.subscribe(handleChange)
  const id = setInterval(poll, 5000)
  const ws = new WebSocket(url)
  return () => {          // cleanup on unmount (and before re-running)
    unsub()
    clearInterval(id)
    ws.close()
  }
}, [])
```

Also: aborting in-flight fetches on unmount, disposing chart/map library instances (`chart.destroy()`), and not storing component instances in module-level variables.

### 7. Accidental globals (sloppy mode)

`function f() { leaked = [] }` creates `window.leaked`. Strict mode / ES modules throw instead.

### 8. console.log of large objects

DevTools keeps logged objects alive so you can inspect them. Don't leave verbose logging in production.

## WeakMap, WeakSet, WeakRef, FinalizationRegistry

| API | Holds key/target… | Use case |
|---|---|---|
| `WeakMap` | Weakly (keys must be objects) | Attach metadata to objects/DOM nodes without preventing GC |
| `WeakSet` | Weakly | "Have I seen this object?" |
| `WeakRef` | Weakly; `deref()` may return `undefined` | Caches of expensive objects |
| `FinalizationRegistry` | Callback after collection | Cleanup of external resources (non-deterministic — don't rely on it for correctness) |

```js
const metadata = new WeakMap()
function track(el) { metadata.set(el, { clicks: 0 }) }
// When `el` is removed and unreferenced, its entry disappears automatically.
```

WeakMaps aren't iterable and have no `size` — by design, since entries can disappear at any time.

## Debugging workflow in Chrome DevTools

This is the answer interviewers want for "Your React app consumes more memory every time users navigate between pages. How would you identify and fix it?"

1. **Reproduce and confirm the trend.** Open *Performance monitor* (or Performance panel with "Memory" checked). Navigate A → B → A repeatedly. If JS heap and **DOM node count** keep climbing even after forcing GC (trash-can icon), you have a leak.
2. **Heap snapshot comparison.**
   - Memory panel → take **Snapshot 1** (baseline).
   - Do the suspected action N times (open/close modal, navigate away and back).
   - Force GC, take **Snapshot 2**.
   - Select Snapshot 2, view **Comparison** against Snapshot 1. Sort by `# Delta` / `Size Delta`. Objects that grew by ~N are suspects.
3. **Search for "Detached"** in the class filter to find detached DOM trees (`Detached HTMLDivElement`).
4. **Read the Retainers panel** for a suspect object: it shows the chain from a GC root to the object — e.g. `Window → listeners → closure → context → modal`. The chain tells you exactly which reference to break.
5. **Allocation instrumentation on timeline** shows allocations that are *not* collected (blue bars that stay).
6. Fix (cleanup, remove listeners, bound caches), then repeat the snapshot comparison to verify the delta is flat.
7. For React: the **React DevTools Profiler** and "Highlight updates" help spot components that never unmount; check `useEffect` cleanups and third-party library disposals.

:::callout interview What interviewers look for
A crisp definition (unintended reachability), 3–4 concrete leak patterns from real SPAs, the snapshot-comparison workflow with retainers, and prevention habits (effect cleanups, AbortController, bounded caches, WeakMap). Bonus: mention monitoring `performance.memory`/`measureUserAgentSpecificMemory()` in the field.
:::

## Interview questions

:::question
difficulty: medium
companies: Walmart
### How do you detect and fix memory leaks in a large JavaScript codebase?
Detect: watch heap size and DOM node count over repeated user flows (Performance monitor); take heap snapshots before and after repeating an action N times, compare, look for objects/Detached DOM nodes growing by N; follow the **retainers** chain back to the GC root to find who holds them.

Fix by breaking the unintended reference: remove event listeners (or use `AbortController` signals), clear timers/intervals, unsubscribe from stores/sockets in cleanup functions, abort in-flight requests on unmount, dispose third-party instances, bound caches (LRU/TTL) or use `WeakMap`, avoid module-level arrays of components/DOM nodes. Verify with another snapshot comparison and add guardrails (lint rules for effect cleanups, memory checks in E2E/perf tests).
:::

:::question
difficulty: medium
companies: Coinbase
### What does a memory leak look like in a long-lived SPA?
Memory and DOM node count grow with each navigation or modal open and never return to baseline after GC; the app gets progressively slower (more GC pauses, longer interactions) and eventually the tab crashes ("Aw, Snap! Out of memory"). Typical causes: global listeners added per route, WebSocket/price-feed subscriptions not closed when leaving a page, intervals polling forever, caches keyed by route params growing without limit, and detached DOM kept in JS arrays.
:::

:::question
difficulty: easy
### How does garbage collection work in JavaScript?
Engines use reachability-based tracing (mark-and-sweep): starting from roots (globals, stack, host-held handles), mark everything reachable, then reclaim the rest. Cycles are collected if unreachable. V8 adds generational collection (frequent cheap scavenges for young objects, incremental/concurrent mark-compact for old ones) to keep pauses short. You can't force or control GC from page code.
:::

:::question
difficulty: medium
### When would you use a WeakMap instead of a Map?
When keys are objects whose lifetime you don't control and you only want to associate data while they're alive — e.g. caching computed results per object, storing private data per instance, metadata per DOM node. A `Map` would keep the key alive forever; a `WeakMap` lets the key and its value be collected once nothing else references the key.
:::

## Challenges

:::challenge
difficulty: medium
### Spot the leaks
Identify every leak in this component and rewrite it.
```jsx
const listeners = []

function PriceTicker({ symbol }) {
  const [price, setPrice] = useState(null)

  useEffect(() => {
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`)
    ws.onmessage = (e) => setPrice(JSON.parse(e.data).price)

    const onResize = () => console.log(window.innerWidth)
    window.addEventListener('resize', onResize)
    listeners.push(onResize)

    setInterval(() => fetch(`/api/stats/${symbol}`), 5000)
  }, [symbol])

  return <span>{price}</span>
}
```
@@@solution
Leaks:
1. **WebSocket never closed** — every symbol change or remount opens another socket, each calling `setPrice` on an unmounted component.
2. **Resize listener never removed** on `window` (a GC root).
3. **Module-level `listeners` array** retains every handler (and its closure) forever.
4. **Interval never cleared** — keeps firing requests forever, one more per symbol change.
5. In-flight fetches aren't aborted.

```jsx
function PriceTicker({ symbol }) {
  const [price, setPrice] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`)
    ws.onmessage = (e) => setPrice(JSON.parse(e.data).price)

    const onResize = () => console.log(window.innerWidth)
    window.addEventListener('resize', onResize, { signal: controller.signal })

    const id = setInterval(() => {
      fetch(`/api/stats/${symbol}`, { signal: controller.signal }).catch(() => {})
    }, 5000)

    return () => {
      ws.close()
      controller.abort() // removes listener + aborts fetches
      clearInterval(id)
    }
  }, [symbol])

  return <span>{price}</span>
}
```
The cleanup runs before the effect re-runs (symbol change) and on unmount, so resources never pile up.
:::

:::challenge
difficulty: medium
### Cache with weak keys
Write `memoizeByObject(fn)` that caches `fn(obj)` results per object argument without preventing those objects from being garbage-collected. Calling with the same object twice must call `fn` only once.
@@@starter
```js
function memoizeByObject(fn) {
  // your code
}
```
@@@tests
```js
test('caches per object', () => {
  let calls = 0
  const area = memoizeByObject((r) => { calls++; return r.w * r.h })
  const rect = { w: 2, h: 3 }
  expect(area(rect)).toBe(6)
  expect(area(rect)).toBe(6)
  expect(calls).toBe(1)
})
test('different objects computed separately', () => {
  let calls = 0
  const f = memoizeByObject((o) => { calls++; return o.v })
  f({ v: 1 }); f({ v: 1 })
  expect(calls).toBe(2)
})
```
@@@solution
```js
function memoizeByObject(fn) {
  const cache = new WeakMap()
  return function (obj) {
    if (cache.has(obj)) return cache.get(obj)
    const result = fn.call(this, obj)
    cache.set(obj, result)
    return result
  }
}
```
A `WeakMap` holds keys weakly, so once `rect` is unreachable elsewhere, both it and its cached result can be collected. Two structurally equal but distinct objects are different keys — identity, not equality.
:::

## Quick check

:::quiz
### In JavaScript, a memory leak usually means…
- [ ] Forgetting to call free()
- [x] Keeping objects reachable that are no longer needed
- [ ] A stack overflow
- [ ] Using too many `let` variables
@@@explain
GC frees unreachable memory automatically; leaks are unintended references keeping things reachable.
:::

:::quiz
### In a heap snapshot, what tells you *why* an object is still in memory?
- [ ] Shallow size
- [ ] Constructor name
- [x] The Retainers path from a GC root
- [ ] Distance column alone
@@@explain
Retainers show the reference chain keeping the object alive — that's the chain you must break.
:::
