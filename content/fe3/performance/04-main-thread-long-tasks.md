---
title: The Main Thread — Long Tasks, Yielding and Web Workers
summary: Why JavaScript blocks the UI, how to investigate "the API is fast but the UI freezes", and how to break up or offload work.
minutes: 20
---

## Why JavaScript blocks the UI

The browser's **main thread** does almost everything for a page: runs your JavaScript, handles input events, calculates styles, performs layout, and paints. It's a single queue of tasks processed one at a time by the event loop.

:::visual event-loop
:::

While a task runs, **nothing else on that thread can happen**. A click handler cannot run, the frame cannot paint, an animation driven by JS cannot advance. At 60 fps you get a frame every 16.7 ms; a task of 300 ms means ~18 dropped frames and a user who thinks the app is broken.

:::callout analogy The single cashier
The main thread is a shop with one cashier. If one customer unloads 400 items, everyone behind them waits — even the person who just wants to ask "where are the toilets?" (a click). The fix is either to have the big customer step aside every few items (yielding) or to open a second till in the back room (a Web Worker).
:::

Things that run *off* the main thread: network I/O, image decoding (mostly), compositor-only animations (`transform`, `opacity`), Web Workers, and service workers.

## "The API responds in 80 ms but the UI freezes for 3 seconds"

A classic scenario question. The network is fine — so the time is spent **after** the response arrives. Investigate:

1. **Record in the Performance panel** (with CPU throttling) around the action.
2. Find the **long task(s)** (red triangle). Expand the flame chart: is it `JSON.parse` of a 20 MB payload? A `sort`/`filter`/`reduce` over 200k records? React rendering 5k components? Synchronous layout?
3. Use **Bottom-up** to see which functions have the most self time.
4. Check for **layout thrashing**: alternating purple "Recalculate Style/Layout" blocks inside your JS (reading `offsetHeight` after writing styles in a loop).
5. Check the React Profiler to see whether the cost is render or commit.
6. In production, collect **Long Animation Frames (LoAF)** / long tasks via `PerformanceObserver` to see which scripts block real users.

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // entry.duration, entry.scripts[] (LoAF gives the source function/URL)
    report('long-frame', { duration: entry.duration, scripts: entry.scripts?.map(s => s.sourceURL) })
  }
}).observe({ type: 'long-animation-frame', buffered: true })
```

## Fix 1 — Do less

- Ask the backend for **less data** (pagination, field selection with GraphQL, server-side aggregation).
- Avoid repeated work: memoise derived data (`useMemo`), index data into a `Map` once instead of `find()` in loops (O(n²) → O(n)).
- Render less: virtualization, `React.memo`, splitting context.
- Avoid **layout thrashing** by batching reads, then writes:

```js
// ❌ forces layout on every iteration
items.forEach(el => { el.style.width = el.parentNode.offsetWidth / 2 + 'px' })

// ✅ read everything, then write everything
const widths = items.map(el => el.parentNode.offsetWidth)
items.forEach((el, i) => { el.style.width = widths[i] / 2 + 'px' })
```

## Fix 2 — Break up the work (yield to the main thread)

Chunking lets the browser handle input and paint between chunks.

```js
// Modern: scheduler.yield() keeps your continuation at the front of the queue
async function yieldToMain() {
  if (globalThis.scheduler?.yield) return scheduler.yield()
  return new Promise(resolve => setTimeout(resolve, 0))
}

async function processInChunks(items, processItem, budgetMs = 8) {
  let deadline = performance.now() + budgetMs
  for (let i = 0; i < items.length; i++) {
    processItem(items[i])
    if (performance.now() > deadline) {
      await yieldToMain()
      deadline = performance.now() + budgetMs
    }
  }
}
```

Why not `await Promise.resolve()`? Because promise callbacks are **microtasks** — they run before the browser gets a chance to render or handle input. You must yield to a **macrotask** boundary (`setTimeout`, `MessageChannel`, `scheduler.postTask`, `scheduler.yield`).

In React, the equivalent is **concurrent rendering**: wrap the non-urgent update in `startTransition` or use `useDeferredValue`. React then renders in small slices and yields to the browser every ~5 ms, abandoning stale renders if newer input arrives.

```jsx
const [isPending, startTransition] = useTransition()
function onFilterChange(value) {
  setInput(value)                              // urgent: keep the input snappy
  startTransition(() => setFilter(value))      // non-urgent: big list re-render
}
```

Also for input handlers: do the **visual update first**, then defer heavy work:

```js
button.addEventListener('click', async () => {
  showSpinner()            // gets painted…
  await yieldToMain()      // …because we yield here
  doExpensiveWork()
})
```

## Fix 3 — Move it off the main thread with Web Workers

A Web Worker is a real OS thread with its own event loop and global scope. It cannot touch the DOM, but it can do CPU work and `fetch`. Communication is by message passing (structured clone) or by transferring/sharing memory.

```js
// worker.js
self.onmessage = (e) => {
  const { rows, query, sortKey } = e.data
  const result = rows
    .filter(r => r.name.includes(query))
    .sort((a, b) => a[sortKey] - b[sortKey])
  self.postMessage(result)
}

// main thread (Vite/webpack 5 syntax)
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
worker.onmessage = (e) => setRows(e.data)
worker.postMessage({ rows, query, sortKey })
```

**When to use a Web Worker**
- Parsing/transforming large data (CSV/JSON → objects), sorting/filtering/aggregating big datasets.
- Crypto, compression, image processing, diffing, syntax highlighting, search indexes, Markdown rendering.
- Anything consistently > 50 ms that doesn't need the DOM.

**When not to**
- Small tasks: message passing has overhead (serialising 50 MB via structured clone is itself slow — use **Transferable** `ArrayBuffer`s or `SharedArrayBuffer`).
- DOM-heavy work — workers can't touch the DOM (OffscreenCanvas is the exception for canvas drawing).

Libraries such as **Comlink** turn worker messaging into async function calls.

## Other main-thread hogs

- **Third-party scripts** (tag managers, chat widgets): audit with the Performance panel's "third-party" grouping; defer or load on interaction.
- **Hydration**: a big SSR page hydrates in one long task. Use selective hydration (React 18 with Suspense boundaries), RSC, or islands.
- **Huge `JSON.parse`**: stream it, paginate, or parse in a worker.
- **Garbage-collection pauses**: excessive allocation in hot loops (creating objects per frame).

:::question
difficulty: easy
### Why does JavaScript block the UI?
Because the page's JavaScript, input handling, style, layout and paint all share **one main thread**, processed as tasks by the event loop. A task runs to completion — there is no pre-emption — so a long synchronous task stops the browser from responding to input or rendering frames until it finishes. Async APIs (fetch, timers) don't block while waiting, but the **callback** that processes the result runs on the main thread and can block if it's heavy.
:::

:::question
difficulty: medium
### What is the difference between yielding with a Promise and with setTimeout?
`await Promise.resolve()` schedules the continuation as a **microtask**, and the microtask queue is fully drained before the browser renders or processes the next input event — so the UI is still blocked. `setTimeout(fn, 0)`, `MessageChannel` and `scheduler.yield()` schedule a **macrotask** (or prioritised task), so the browser gets a chance to paint and handle input in between. `scheduler.yield()` is preferred because the continuation keeps priority over other queued tasks (and `setTimeout` gets clamped to ≥4 ms after nesting).
:::

:::question
difficulty: medium
### When should you use Web Workers?
For CPU-heavy, DOM-independent work that would otherwise create long tasks: parsing or transforming large datasets, sort/filter/aggregate on 100k+ records, image/video processing, cryptography, compression, search indexing, syntax highlighting. Not for small jobs (messaging overhead), not for DOM manipulation, and be careful with large payloads — use Transferables or SharedArrayBuffer to avoid copying. Tools like Comlink make the API ergonomic.
:::

:::challenge
difficulty: hard
### "Your API response arrives quickly, but the UI freezes for several seconds." Walk through your investigation.
Describe the exact tools, what you'd look for, and three possible root causes with their fixes.
@@@solution
**Investigation**
1. Reproduce with DevTools **Performance** panel, CPU throttling 4×, and the network panel open to confirm the response really arrives fast (check "Timing" for the request).
2. In the main-thread flame chart, locate the long task(s) starting right after the response. Use **Bottom-up / Call tree** to find self time. Note colours: yellow = JS, purple = style/layout, green = paint.
3. Open the **React Profiler** on the same interaction to see if the commit is huge and which components render.
4. Check memory / GC activity in the timeline (sawtooth with frequent "Minor GC").
5. In production, look at **INP attribution** and **LoAF** entries from RUM to confirm real users hit the same script.

**Likely causes → fixes**
| Root cause | Evidence | Fix |
|---|---|---|
| Massive data processing (parse 15 MB JSON, sort/group 200k rows) | Long yellow task in `JSON.parse` / your transform | Paginate/aggregate on server; move to Web Worker; chunk with `scheduler.yield()` |
| Rendering thousands of components | React commit 2–3 s, thousands of rows | Virtualize, memoise rows, `startTransition` for the update |
| Layout thrashing | Interleaved purple Layout blocks inside a JS loop ("Forced reflow" warnings) | Batch DOM reads before writes; use `ResizeObserver`; let React handle DOM |
| O(n²) algorithm | `.find()`/`.includes()` inside `.map()` over large arrays | Build a `Map`/`Set` index once |
| Synchronous third-party script reacting to DOM mutations | Third-party in the flame chart | Defer/sandbox it |

**Verify**: re-record, confirm no task > 50 ms in the interaction, INP p75 < 200 ms in RUM.
:::

:::challenge
difficulty: medium
### Make this function non-blocking
```js
function highlightAll(nodes) {
  for (const node of nodes) {         // 20,000 nodes
    node.innerHTML = expensiveHighlight(node.textContent) // ~0.5ms each
  }
}
```
The page must stay responsive to clicks and scrolling while this runs, and a second call should cancel the first.
@@@solution
```js
let currentRun = 0

async function yieldToMain() {
  if (globalThis.scheduler?.yield) return scheduler.yield()
  return new Promise(r => setTimeout(r, 0))
}

async function highlightAll(nodes) {
  const runId = ++currentRun            // newer call invalidates older runs
  let deadline = performance.now() + 8  // ~half a frame budget

  for (const node of nodes) {
    if (runId !== currentRun) return    // cancelled
    node.innerHTML = expensiveHighlight(node.textContent)
    if (performance.now() > deadline) {
      await yieldToMain()               // let the browser paint & handle input
      deadline = performance.now() + 8
    }
  }
}
```
Better still: compute the highlighted HTML in a **Web Worker** (it's pure string work) and only assign `innerHTML` on the main thread, ideally only for nodes in the viewport (IntersectionObserver). Remember to sanitise if text came from users.
:::

:::quiz
### Which does NOT run on the main thread?
- [ ] A click handler
- [ ] React reconciliation
- [x] Code inside a dedicated Web Worker
- [ ] Layout calculation
@@@explain
Workers have their own thread and event loop; they cannot access the DOM.
:::

:::quiz
### Why does `await Promise.resolve()` inside a loop not unblock rendering?
- [ ] Promises are synchronous
- [x] Microtasks are drained before the browser renders, so no frame is painted in between
- [ ] await is ignored in loops
- [ ] Promises run in a worker
@@@explain
You need a macrotask boundary (setTimeout, MessageChannel, scheduler.yield) to let rendering happen.
:::
