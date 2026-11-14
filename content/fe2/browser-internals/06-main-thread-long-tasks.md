---
title: The Main Thread and Long Tasks
summary: Why JavaScript blocks the UI, what a long task is, how to find one, and how to break work up so the page stays responsive.
minutes: 12
---

## Why JavaScript blocks the UI

JavaScript runs on the renderer's **main thread** — the same thread that handles input, style, layout and paint. The event loop runs **one task to completion** before anything else. While your function runs, the browser cannot:

- respond to clicks or key presses,
- run other callbacks,
- recalculate layout or paint a new frame.

That's the whole answer to "Why does JavaScript block the UI?" — **run-to-completion on a single shared thread**.

:::visual event-loop
:::

## Long tasks

A **long task** is any task that occupies the main thread for **more than 50 ms**. Why 50? The RAIL model aims to respond to input within 100 ms; if a task can be at most 50 ms, an input arriving mid-task still gets handled within budget.

Long tasks are the root cause of poor **INP** (Interaction to Next Paint) and **TBT** (Total Blocking Time).

```text
Main thread ─┬──────── 320 ms task (long!) ────────┬─ click handler ─┬ paint
             │                                     │                 │
             user clicks here ───── waits 300 ms ──┘   input delay   │
```

### Scenario: "The API response arrives fast, but the UI freezes for seconds"

A classic interview scenario. The network is fine; the problem is what you do **after** the response:

1. Open **DevTools → Performance**, record, reproduce. Look for long tasks (red triangle corners) on the Main track.
2. Expand the flame chart. Typical culprits:
   - `JSON.parse` of a multi-MB payload,
   - transforming/sorting/filtering 50k items synchronously,
   - React rendering thousands of rows at once (huge "Render"/"Commit" blocks),
   - layout thrashing (repeated purple "Layout" with forced reflow warnings),
   - a third-party script.
3. Fix based on cause:
   - **Less work**: paginate, request only needed fields, virtualize lists.
   - **Chunk work** and yield between chunks.
   - **Move work off thread**: Web Worker for parsing/transforming.
   - **Defer non-urgent rendering**: `startTransition`/`useDeferredValue` in React.
   - **Memoize** expensive derived data.

## Yielding to the main thread

Break long work into chunks and give the browser a chance to handle input and paint between them.

```js
// Generic yield
function yieldToMain() {
  if ('scheduler' in window && 'yield' in scheduler) return scheduler.yield()
  return new Promise((r) => setTimeout(r, 0))
}

async function processInChunks(items, processItem, chunkMs = 8) {
  let deadline = performance.now() + chunkMs
  for (const item of items) {
    processItem(item)
    if (performance.now() > deadline) {
      await yieldToMain()
      deadline = performance.now() + chunkMs
    }
  }
}
```

- `scheduler.yield()` (Chromium) resumes your work at a higher priority than other queued tasks, so you don't lose your place.
- `setTimeout(0)` puts the continuation at the back of the task queue (clamped to ≥4 ms after nesting).
- `requestIdleCallback(cb)` runs during idle periods — good for truly non-urgent work (analytics, prefetching).
- **Microtasks don't yield!** `await Promise.resolve()` continues before rendering — a loop of microtasks still blocks.

```js
// ❌ Doesn't yield to rendering — microtasks drain before paint
for (const chunk of chunks) { await Promise.resolve(); work(chunk) }
// ✅ Yields — a new macrotask lets the browser render and handle input
for (const chunk of chunks) { await new Promise((r) => setTimeout(r)); work(chunk) }
```

## Measuring long tasks in production

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Long task', Math.round(entry.duration), 'ms', entry.attribution)
  }
}).observe({ type: 'longtask', buffered: true })

// Even better: Long Animation Frames API (LoAF) shows which scripts caused slow frames
new PerformanceObserver((list) => {
  list.getEntries().forEach((e) => console.log(e.duration, e.scripts))
}).observe({ type: 'long-animation-frame', buffered: true })
```

Pair with the `web-vitals` library to send INP with attribution to your analytics.

## When should you use Web Workers?

Use a Worker when work is **CPU-heavy, doesn't need the DOM**, and would take more than ~50 ms:

- Parsing/transforming huge JSON or CSV
- Search indexing, fuzzy search over large lists
- Image/video processing, compression, encryption/hashing
- Diffing, syntax highlighting (e.g. a regex101-style highlighter), Markdown rendering
- Complex calculations for charts or financial data

Don't use one for: tiny tasks (message-passing overhead and structured cloning cost more than the work), anything DOM-bound, or simple network calls (those are already async).

## Interview questions

:::question
difficulty: medium
companies: Tekion
### Why does JavaScript block the UI?
Because JS executes on the browser's **main thread**, which is also responsible for handling input, style, layout and painting, and JS follows **run-to-completion** semantics — a task runs until it finishes before the event loop picks the next one. A long synchronous task therefore delays input handling and frame rendering. Async APIs (fetch, timers) don't block because the waiting happens outside the JS thread — but the **callbacks** still run on the main thread, so heavy callback work blocks too.
:::

:::question
difficulty: hard
### The API responds in 200 ms but the UI freezes for several seconds. How do you investigate?
1. Reproduce with the **Performance** panel (CPU throttling on). Find long tasks after the network response.
2. Inspect the **flame chart** bottom-up to see which functions take time: JSON parsing, data transforms, React render/commit, layout/recalc style, GC.
3. Check the **React Profiler** for components rendering too many items or re-rendering repeatedly.
4. Fix: reduce payload, paginate/virtualize, chunk processing and yield (`scheduler.yield`, `setTimeout`), move parsing/transforms to a **Web Worker**, use `startTransition` for non-urgent updates, memoize derived data, batch DOM reads/writes.
5. Verify with INP/TBT and long-task monitoring in production.
:::

:::question
difficulty: easy
### What is a long task?
A main-thread task longer than **50 ms**. During it the page cannot respond to input. Long tasks drive Total Blocking Time (lab) and Interaction to Next Paint (field). Detect with DevTools Performance (red-cornered tasks), Lighthouse, or `PerformanceObserver` for `longtask` / `long-animation-frame` entries.
:::

## Challenges

:::challenge
difficulty: medium
### Chunked processing
Implement `processInChunks(items, fn, chunkSize)` that calls `fn(item)` for every item but yields to the event loop (with `setTimeout`) after every `chunkSize` items. It returns a promise that resolves with an array of the results.
@@@starter
```js
function processInChunks(items, fn, chunkSize) {
  // your code
}
```
@@@tests
```js
test('processes all items in order', async () => {
  const out = await processInChunks([1, 2, 3, 4, 5], (x) => x * 2, 2)
  expect(out).toEqual([2, 4, 6, 8, 10])
})
test('yields between chunks', async () => {
  let ticks = 0
  const timer = setInterval(() => ticks++, 0)
  await processInChunks(Array.from({ length: 50 }, (_, i) => i), (x) => x, 5)
  clearInterval(timer)
  expect(ticks).toBeGreaterThan(0)
})
test('handles empty input', async () => {
  expect(await processInChunks([], (x) => x, 3)).toEqual([])
})
```
@@@solution
```js
function processInChunks(items, fn, chunkSize) {
  return new Promise((resolve) => {
    const results = []
    let i = 0
    function runChunk() {
      const end = Math.min(i + chunkSize, items.length)
      for (; i < end; i++) results.push(fn(items[i]))
      if (i < items.length) setTimeout(runChunk, 0)   // yield to the event loop
      else resolve(results)
    }
    runChunk()
  })
}
```

Async/await version:

```js
async function processInChunks(items, fn, chunkSize) {
  const results = []
  for (let i = 0; i < items.length; i++) {
    results.push(fn(items[i]))
    if ((i + 1) % chunkSize === 0) await new Promise((r) => setTimeout(r, 0))
  }
  return results
}
```

Improvement: chunk by **time** (e.g. 8 ms budget) instead of count, since item cost varies; and use `scheduler.yield()` where available.
:::

## Quick check

:::quiz
### Which of these actually lets the browser paint between chunks?
- [ ] await Promise.resolve()
- [ ] queueMicrotask(next)
- [x] await new Promise(r => setTimeout(r, 0))
- [ ] A for loop with smaller chunks
@@@explain
Rendering happens between macrotasks, after the microtask queue drains. Only a new macrotask (or scheduler.yield) gives the browser a chance to render.
:::

:::quiz
### What threshold defines a long task?
- [ ] 16 ms
- [x] 50 ms
- [ ] 100 ms
- [ ] 200 ms
@@@explain
50 ms leaves room to still respond to input within ~100 ms.
:::
