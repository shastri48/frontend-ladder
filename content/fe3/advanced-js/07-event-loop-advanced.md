---
title: Event Loop at Senior Level — Scheduling and Long Tasks
summary: Microtask starvation, where rendering fits in the loop, rAF vs setTimeout vs MessageChannel vs scheduler.postTask, long tasks, yielding, and how to investigate a frozen UI.
minutes: 22
---

## Beyond "microtasks before macrotasks"

Mid-level candidates can recite: *sync code → all microtasks → one macrotask → repeat*. Senior interviews ask what that means for **real UIs**:

- "The API responds in 80ms but the UI freezes for 3 seconds. Investigate." (reference doc)
- "Why does JavaScript block the UI?"
- "When would you use `requestAnimationFrame`, `setTimeout`, `MessageChannel`, `requestIdleCallback`, or a Web Worker?"

To answer, you need the full browser loop, including **rendering**.

## One turn of the browser event loop

```text
┌───────────────────────────────────────────────────────────────────┐
│ 1. Pick ONE task from a task queue (click handler, setTimeout cb, │
│    message event, network callback...) and run it to completion   │
│ 2. Microtask checkpoint: run ALL microtasks (promise reactions,   │
│    queueMicrotask, MutationObserver) — including ones queued      │
│    while draining                                                 │
│ 3. If it's time to render (~every 16.7ms at 60Hz, and something   │
│    changed):                                                      │
│      a. requestAnimationFrame callbacks                           │
│      b. style recalc → layout → paint → composite                 │
│ 4. If idle time remains before the next frame:                    │
│      requestIdleCallback callbacks                                │
└───────────────────────────────────────────────────────────────────┘
```

:::visual event-loop
:::

The main thread does **all** of this — your JS, style, layout, paint and input handling. While a task runs, nothing else can happen: clicks queue up, animations stop, the frame is skipped. That's the whole answer to "why does JS block the UI".

### Long tasks

A **long task** is any task over **50ms**. Why 50? To respond to input within 100ms (the threshold users perceive as instant), the browser needs gaps. Long tasks are what hurt **INP** (Interaction to Next Paint) and **TBT** (Total Blocking Time).

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) console.warn('Long task', entry.duration, entry)
}).observe({ type: 'longtask', buffered: true })
// Better attribution in Chrome: type 'long-animation-frame' (LoAF) shows which scripts ran
```

## Microtask starvation

Because the microtask checkpoint drains **until the queue is empty**, a microtask that keeps scheduling microtasks blocks forever — no rendering, no input, no timers:

```js
function spin() {
  Promise.resolve().then(spin) // page freezes; setTimeout loops would NOT freeze
}
```

Compare with `setTimeout(spin, 0)`: each iteration is a separate task, so the browser can render and handle input in between (and timers get clamped to ≥4ms after nesting). Lesson: **splitting work with promises/`await` does not yield to the browser.** An `async` function that `await`s already-resolved values in a loop still runs as one giant block.

```js
// ❌ Still a long task: each await only queues a microtask
for (const item of hugeList) { await null; process(item) }

// ✅ Yields to the event loop: rendering & input can happen between chunks
for (const item of hugeList) { process(item); if (needsYield()) await yieldToMain() }
```

## The scheduling toolbox

| API | Queue / timing | Use it for |
|---|---|---|
| `queueMicrotask` / promise | Microtask — before rendering, same turn | Ordering after current sync code; batching state updates. **Never** to yield. |
| `setTimeout(fn, 0)` | Task — next turn, ≥ ~4ms after 5 nested calls, throttled to ≥1s in background tabs | Yielding coarsely, deferring non-urgent work |
| `MessageChannel` `postMessage` | Task — no 4ms clamp | Fast yielding (React's scheduler used this) |
| `requestAnimationFrame` | Right before the next paint; paused in background tabs | Visual updates, reading layout once per frame, animations |
| `requestIdleCallback` | When the frame has spare time (with `timeout` option) | Analytics, prefetch, low-priority work |
| `scheduler.postTask(fn, {priority})` | Prioritised tasks: `user-blocking`, `user-visible`, `background` | Modern priority scheduling (Chromium) |
| `scheduler.yield()` | Yields and **resumes ahead of other tasks** | Breaking long tasks without losing your place in line |
| Web Worker | Separate thread | CPU-heavy work: parsing, diffing, crypto, image processing |

A portable "yield to main":

```js
function yieldToMain() {
  if (globalThis.scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}
```

### rAF vs setTimeout for animation

`setTimeout(update, 16)` isn't synced with the display: it can fire mid-frame, twice per frame, or skip frames (jank), and it keeps running in background tabs. `requestAnimationFrame` fires exactly once before each paint at the display's refresh rate (60/120Hz), pauses when hidden, and batches with the browser's rendering. For layout, do **reads in rAF, then writes** to avoid forced synchronous layouts.

## Investigating "fast API, frozen UI"

The reference doc scenario: response arrives quickly but the UI freezes for seconds. A systematic approach:

1. **Reproduce with the Performance panel** (CPU throttling 4×). Record the interaction. Look for red-cornered **long tasks** on the Main track.
2. **Read the flame chart** bottom-up: is the time in *your* JS (`JSON.parse` of a 20MB payload, a sort, a `.map` creating 50k objects), in **React rendering** (thousands of components), or in **Recalculate Style / Layout** (huge DOM, layout thrashing)?
3. **React Profiler**: which components rendered and why ("props changed", "hooks changed"); look for whole-tree re-renders.
4. **Fix by category:**
   - Too much data → paginate, virtualize rows, send less from the server.
   - Heavy compute → memoize, move to a **Web Worker**, or chunk with `yieldToMain()`.
   - Huge render → virtualization, `React.memo`, splitting state, `useTransition` / `useDeferredValue` so typing stays responsive while results render at lower priority.
   - Layout thrashing → batch DOM reads before writes; use `transform` instead of layout properties.
   - Big JSON → stream/parse in a worker, or use smaller payloads.
5. **Verify**: re-record, check INP/TBT improved, add a `PerformanceObserver` for long tasks in production (RUM).

:::callout interview Say the mechanism, not just the tool
"The main thread is single-threaded and also does rendering. A 3-second task means no frames and no input processing for 3 seconds. I'd find the long task in the Performance panel, then either make the work smaller, split it so the browser can render between chunks, deprioritise it with transitions, or move it off the main thread."
:::

## Interview questions

:::question
difficulty: medium
companies: Tekion
### Why does JavaScript block the UI?
JavaScript, style calculation, layout, paint and input handling all share the **main thread**. The event loop runs one task at a time to completion and only renders between tasks (after microtasks drain). So while your code runs — a loop over 100k items, a giant `JSON.parse`, rendering 10k React components — the browser can't paint frames or respond to clicks. The fix is to keep tasks short (<50ms), yield between chunks, deprioritise non-urgent updates, or move heavy work to Web Workers.
:::

:::question
difficulty: hard
### Why doesn't `await` inside a loop keep the page responsive?
`await` on an already-resolved value (or a promise that resolves from a microtask) continues in a **microtask**. The microtask checkpoint drains completely before the browser gets a chance to render or process input. So the "async" loop is still one uninterrupted block of main-thread time. To actually yield you need a **task** boundary: `setTimeout`, `MessageChannel`, `scheduler.postTask`, or `scheduler.yield()`.
:::

:::question
difficulty: hard
### When would you use a Web Worker, and what are its limits?
Use one for CPU-bound work that doesn't need the DOM: parsing/transforming large datasets, search indexing, diffing, image/video processing, crypto, syntax highlighting of big files, running a WASM module. Limits: no DOM access; communication is by `postMessage` with **structured cloning** (copy cost for big objects — use `Transferable`s like `ArrayBuffer` to move without copying, or `SharedArrayBuffer` with cross-origin isolation); startup cost; separate bundling. Libraries like Comlink make the RPC ergonomic.
:::

:::question
difficulty: medium
### What is the difference between `requestAnimationFrame` and `requestIdleCallback`?
`requestAnimationFrame` runs right before the next paint, every frame — use it for visual updates that must be in sync with rendering. `requestIdleCallback` runs only when the browser has spare time at the end of a frame (or when its `timeout` expires) — use it for non-urgent background work (analytics batching, prefetching). rAF is "must happen this frame"; rIC is "whenever you're free". rIC isn't supported in Safari, so polyfill with `setTimeout`.
:::

## Challenges

:::challenge
difficulty: medium
companies: Meta
### Implement setInterval with setTimeout (and clear it)
Implement `mySetInterval(fn, delay, ...args)` returning an id, and `myClearInterval(id)`. Use only `setTimeout`/`clearTimeout`. `fn` must be called every `delay` ms with `args`. Clearing must stop future calls — **including when called from inside `fn` itself**.
@@@starter
```js
function mySetInterval(fn, delay, ...args) {}
function myClearInterval(id) {}
```
@@@tests
```js
test('calls repeatedly with args', async () => {
  const got = []
  const id = mySetInterval((a) => got.push(a), 10, 'x')
  await sleep(55)
  myClearInterval(id)
  const n = got.length
  expect(n).toBeGreaterThan(2)
  await sleep(30)
  expect(got.length).toBe(n)
  expect(got[0]).toBe('x')
})

test('can clear itself from inside the callback', async () => {
  let count = 0
  const id = mySetInterval(() => { count++; if (count === 3) myClearInterval(id) }, 5)
  await sleep(60)
  expect(count).toBe(3)
})

test('independent intervals', async () => {
  let a = 0, b = 0
  const ia = mySetInterval(() => a++, 5)
  const ib = mySetInterval(() => b++, 5)
  myClearInterval(ia)
  await sleep(30)
  myClearInterval(ib)
  expect(a).toBe(0)
  expect(b).toBeGreaterThan(1)
})
```
@@@solution
```js
const intervals = new Map() // our id -> current timeout id
let nextId = 1

function mySetInterval(fn, delay, ...args) {
  const id = nextId++
  const schedule = () => {
    const t = setTimeout(() => {
      fn(...args)
      if (intervals.has(id)) schedule() // not cleared during fn → keep going
    }, delay)
    intervals.set(id, t)
  }
  schedule()
  return id
}

function myClearInterval(id) {
  clearTimeout(intervals.get(id))
  intervals.delete(id)
}
```

- We return our **own stable id**, because the underlying `setTimeout` id changes every tick. A Map tracks the current timeout for each interval.
- After calling `fn`, we only reschedule if the id is still present — that's what makes clearing from inside the callback work.
- **Difference from native `setInterval`:** this is "chained timeouts", so the gap is measured from when `fn` *finished*, i.e. it never overlaps or bunches up if `fn` is slow. Many people prefer this behaviour. To approximate fixed cadence, compute the next delay from an expected timestamp: `delay - (Date.now() - expected)` (drift correction).
:::

:::challenge
difficulty: medium
### Process a huge array without freezing the UI
Implement `processInChunks(items, fn, { chunkSize = 100, onProgress } = {})` that calls `fn(item, index)` for every item, but **yields to the event loop (a macrotask) after every `chunkSize` items**, so other timers/rendering can run in between. It returns a promise resolving to an array of the results in order. Call `onProgress(doneCount, total)` after each chunk.
@@@starter
```js
function processInChunks(items, fn, { chunkSize = 100, onProgress } = {}) {
  // your code
}
```
@@@tests
```js
test('returns results in order', async () => {
  const out = await processInChunks([1, 2, 3, 4, 5], (x, i) => x * 10 + i, { chunkSize: 2 })
  expect(out).toEqual([10, 21, 32, 43, 54])
})

test('yields to timers between chunks', async () => {
  const log = []
  setTimeout(() => log.push('timer'), 0)
  await processInChunks([1, 2, 3, 4], (x) => log.push(x), { chunkSize: 2 })
  expect(log.indexOf('timer')).toBeGreaterThan(1)
  expect(log.indexOf('timer')).toBeLessThan(log.length - 1)
})

test('reports progress', async () => {
  const p = []
  await processInChunks(Array.from({ length: 5 }), () => 0, { chunkSize: 2, onProgress: (d, t) => p.push(d + '/' + t) })
  expect(p).toEqual(['2/5', '4/5', '5/5'])
})

test('empty input', async () => {
  expect(await processInChunks([], (x) => x)).toEqual([])
})
```
@@@solution
```js
// A macrotask boundary. In Chromium you could use scheduler.yield(), which
// resumes *ahead* of other queued tasks; setTimeout lets everything else run first.
const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0))

async function processInChunks(items, fn, { chunkSize = 100, onProgress } = {}) {
  const results = new Array(items.length)
  for (let i = 0; i < items.length; i++) {
    results[i] = fn(items[i], i)
    const done = i + 1
    if (done % chunkSize === 0 || done === items.length) {
      if (onProgress) onProgress(done, items.length)
      if (done < items.length) await yieldToMain()
    }
  }
  return results
}
```

- The yield must be a **macrotask** (`setTimeout`, `MessageChannel`, `scheduler.yield`) — `await Promise.resolve()` would not let timers or rendering run.
- A better chunking rule in production is **time-based**: keep processing until ~5–10ms have passed (`performance.now()`), then yield. That adapts to fast and slow devices.
- If the work is pure computation and large, a Web Worker is usually better than chunking on the main thread.
:::

:::challenge
difficulty: hard
### Output prediction: tasks, microtasks and rAF
In a browser, what is the most likely output order?

```js
setTimeout(() => console.log('timeout'), 0)
requestAnimationFrame(() => console.log('raf'))
queueMicrotask(() => console.log('micro 1'))
Promise.resolve().then(() => {
  console.log('micro 2')
  queueMicrotask(() => console.log('micro 3'))
})
console.log('sync')
```
@@@solution
```text
sync
micro 1
micro 2
micro 3
timeout   ← usually
raf       ← usually (but may come before timeout)
```

1. `sync` — synchronous code first.
2. Microtask checkpoint drains completely, **including microtasks queued during draining**: `micro 1`, `micro 2`, then `micro 3`.
3. Then the event loop picks the next task or renders. `setTimeout(0)` is usually ready immediately, so `timeout` typically logs first and `raf` runs before the next paint (~up to 16ms later).

The honest senior answer: the relative order of `timeout` and `raf` is **not guaranteed** — if a frame is due right now, rendering steps (including rAF) can run before the timer task. What *is* guaranteed: sync → all microtasks → then tasks/rendering.
:::

## Quick check

:::quiz
### Which of these lets the browser paint between chunks of work?
- [ ] `await Promise.resolve()`
- [ ] `queueMicrotask(next)`
- [x] `setTimeout(next, 0)`
- [ ] A `for` loop with `async` callbacks
@@@explain
Only a task boundary lets the loop reach the rendering step. Microtasks drain before rendering.
:::

:::quiz
### What duration makes a task a "long task"?
- [ ] > 16ms
- [x] > 50ms
- [ ] > 100ms
- [ ] > 300ms
@@@explain
Long tasks are > 50ms, leaving room to respond to input within ~100ms.
:::

:::quiz
### Why is rAF better than `setTimeout(fn, 16)` for animations?
- [ ] It runs on a separate thread
- [x] It is synced to the display's refresh, runs once per frame before paint and pauses in background tabs
- [ ] It runs before microtasks
- [ ] It's faster because it skips layout
@@@explain
rAF aligns updates with rendering; timers drift relative to frames and cause jank.
:::
