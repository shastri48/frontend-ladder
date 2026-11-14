---
title: The Event Loop in Depth
summary: How a single-threaded language does async work — call stack, Web APIs, microtasks, macrotasks, rendering and requestAnimationFrame — plus the ordering puzzles interviewers love.
minutes: 22
---

## The puzzle

JavaScript has **one call stack** and runs **one thing at a time**. Yet a page can fetch data, run timers, respond to clicks and animate — all "at once". How?

Answer: the JavaScript **engine** (V8, SpiderMonkey, JavaScriptCore) only runs your code. The **host environment** (the browser or Node.js) provides everything asynchronous — timers, network, DOM events — and an **event loop** that decides when queued callbacks get to run on the single stack.

:::callout analogy A one-chef kitchen
One chef (the call stack) cooks one dish at a time. Waiters (Web APIs) take orders, wait for the oven, and put finished tickets in two trays: an **urgent tray** (microtasks) and a **normal tray** (macrotasks). Whenever the chef's hands are free, they first empty the *entire* urgent tray, then take *one* ticket from the normal tray, then glance at the dining room to see if anything needs re-plating (render), and repeat.
:::

## The pieces

| Piece | What it is | Examples |
|---|---|---|
| **Call stack** | Where JS actually executes, one frame at a time | Your functions |
| **Web APIs / host APIs** | Browser-provided work done *outside* the JS thread | `setTimeout`, `fetch`, DOM events, `XMLHttpRequest`, geolocation |
| **Macrotask (task) queue** | Callbacks for "big" independent units of work | `setTimeout`/`setInterval` callbacks, I/O, UI events, `MessageChannel`, `postMessage` |
| **Microtask queue** | Callbacks that must run right after the current task, before anything else | Promise `.then/.catch/.finally`, `await` continuations, `queueMicrotask`, `MutationObserver` |
| **Render steps** | Style, layout, paint — *opportunity* roughly every 16.7ms at 60Hz | `requestAnimationFrame` callbacks run just before this |

:::visual event-loop
:::

## One turn of the loop

```text
┌──────────────────────────────────────────────────────────┐
│ 1. Take ONE task from the macrotask queue, run it to     │
│    completion (the call stack becomes empty).            │
│ 2. Drain the microtask queue COMPLETELY                  │
│    (microtasks queued by microtasks also run now).       │
│ 3. If it's time to render (~every frame):                │
│      a. run requestAnimationFrame callbacks              │
│      b. recalc style → layout → paint → composite        │
│ 4. Go to 1.                                              │
└──────────────────────────────────────────────────────────┘
```

The initial execution of your script is itself the first task. Key consequences:

1. **A running task is never interrupted.** A callback can't run "in the middle" of your function.
2. **Microtasks always run before the next macrotask** — and before rendering. That's why `Promise.then` beats `setTimeout(fn, 0)`.
3. **Microtasks can starve the page.** If each microtask queues another, the loop never reaches rendering or input — the tab freezes.
4. **`setTimeout(fn, 0)` is "as soon as possible after at least 0ms"**, not immediate. Browsers clamp nested timers to ≥4ms after 5 levels, and background tabs throttle to ≥1s.

## The classic ordering example

```js
console.log('1: sync start')

setTimeout(() => console.log('2: timeout'), 0)

Promise.resolve()
  .then(() => console.log('3: microtask 1'))
  .then(() => console.log('4: microtask 2'))

queueMicrotask(() => console.log('5: queueMicrotask'))

console.log('6: sync end')
```

```text
1: sync start
6: sync end
3: microtask 1
5: queueMicrotask
4: microtask 2
2: timeout
```

Walkthrough:

1. Sync code runs: logs 1, schedules the timer (macrotask), queues `then` #1 (microtask), queues the `queueMicrotask` callback (microtask), logs 6.
2. Stack empty → drain microtasks in FIFO order: `microtask 1` runs and **its** completion queues `then` #2 at the back; `queueMicrotask` runs; then `microtask 2`.
3. Microtask queue empty → next macrotask: the timeout.

## `async/await` in the loop

`await x` is roughly `Promise.resolve(x).then(continuation)`. Everything **before** the first `await` runs synchronously; everything **after** is a microtask.

```js
async function run() {
  console.log('A')
  await null
  console.log('B')
}
console.log('start')
run()
console.log('end')
// start, A, end, B
```

## Where rendering and rAF fit

```js
button.addEventListener('click', () => {
  box.style.transform = 'translateX(100px)'
  box.style.transform = 'translateX(200px)'
  // The user never sees 100px — rendering only happens after this task + microtasks.
})
```

- **`requestAnimationFrame(cb)`** runs `cb` right before the browser's next paint — the right place for visual updates/animations. It's neither a micro- nor a macrotask; it's part of the rendering step.
- rAF callbacks run **at most once per frame**; timers can fire multiple times per frame or drift.
- In hidden tabs, rAF pauses entirely.

## Why JavaScript blocks the UI

The main thread does JS **and** style, layout, paint and input handling. If a task takes 2 seconds, nothing else can happen for 2 seconds — clicks queue up, animations freeze, the page feels dead. Any task over **50ms** is a *long task* (it hurts INP, the Core Web Vital for responsiveness).

```js
// Blocks for ~3s: no paint, no clicks
function heavy() {
  const end = Date.now() + 3000
  while (Date.now() < end) {}
}
```

### Investigating "API is fast but UI freezes"

This exact scenario is asked: "Your API response arrives quickly, but the UI freezes for several seconds."

1. **Record in DevTools → Performance.** Look for long yellow (scripting) blocks with red corners = long tasks. Expand the flame chart to find the function.
2. Common culprits: parsing/transforming huge JSON on the main thread, rendering thousands of DOM nodes at once, synchronous layout thrashing (read/write loops), expensive React re-renders, `JSON.parse` of multi-MB payloads.
3. Fixes:
   - **Chunk the work** and yield to the loop between chunks (`setTimeout`, `scheduler.yield()`, `scheduler.postTask`) so input and paint can happen.
   - **Move CPU work off the main thread** with a **Web Worker**.
   - **Render less**: virtualise lists, paginate, `useDeferredValue` / `startTransition` in React.
   - Avoid forced synchronous layout (batch DOM reads before writes).

```js
async function processInChunks(items, fn, chunkSize = 500) {
  for (let i = 0; i < items.length; i += chunkSize) {
    items.slice(i, i + chunkSize).forEach(fn)
    // yield so the browser can paint and handle input
    await new Promise((r) => setTimeout(r, 0))
  }
}
```

## Node.js differences (bonus)

Node's loop has phases (timers → pending callbacks → poll → check → close). `process.nextTick` runs before Promise microtasks; `setImmediate` runs in the check phase. In the browser you won't see these, but they show up in "Node vs browser" follow-ups.

## Interview questions

:::question
difficulty: medium
companies: Accenture, Tekion, Groww, Housing.com
### What is the event loop and how does it handle async tasks?
JavaScript runs on a single call stack. Async operations are handed to the host (browser Web APIs / Node's libuv), which queue their callbacks when ready. The event loop repeatedly: runs one macrotask to completion → drains the entire microtask queue → lets the browser render if a frame is due (running rAF callbacks first) → repeats. Promise reactions and `await` continuations are microtasks, so they run before timers and events; that's why `Promise.then` logs before `setTimeout(..., 0)`.
:::

:::question
difficulty: medium
### How does the event loop prioritise microtasks vs macrotasks in complex async flows?
After every macrotask (and after the initial script), the microtask queue is drained **completely**, including microtasks added while draining. Only then does the loop render and pick the next macrotask. So a chain `.then().then()` runs entirely before any pending timer, and a recursive microtask chain can starve rendering and input indefinitely. Different macrotask sources may be prioritised by the browser (e.g. user input over timers), but microtasks always beat all of them.
:::

:::question
difficulty: medium
### Why does JavaScript block the UI, and how do you avoid it?
The main thread is shared by JS execution, style/layout/paint and input dispatch. While a task runs, rendering and event handling wait. Avoid by keeping tasks short (<50ms): break work into chunks that yield back to the loop, use Web Workers for CPU-heavy work, virtualise large lists, debounce/throttle high-frequency handlers, use React transitions for non-urgent updates, and avoid layout thrashing.
:::

:::question
difficulty: easy
### Difference between synchronous and asynchronous functions?
A synchronous function runs to completion before the next line runs — the caller waits and the thread is blocked. An asynchronous function starts work that completes later; it returns immediately (often a Promise) and its result is delivered via a callback/microtask once the stack is free. `async` functions run synchronously until the first `await`, then return a pending promise.
:::

:::question
difficulty: medium
### What is `requestAnimationFrame` and how is it different from `setTimeout`?
`rAF` schedules a callback right before the next repaint, synchronised with the display refresh rate, at most once per frame, and paused in background tabs. `setTimeout` is a macrotask with no relation to frames — it can fire mid-frame, multiple times per frame or late, causing jank. Use rAF for visual updates and animations, timers for "do this later" logic.
:::

## Output prediction challenges

:::challenge
difficulty: medium
companies: Impact Analytics, Razorpay
### Predict the order
```js
console.log('A')
setTimeout(() => console.log('B'), 0)
Promise.resolve().then(() => console.log('C'))
console.log('D')
```
@@@solution
```text
A
D
C
B
```
Sync first (A, D), then microtasks (C), then the timer macrotask (B).
:::

:::challenge
difficulty: medium
### Predict the order (async/await)
```js
async function a1() {
  console.log('a1 start')
  await a2()
  console.log('a1 end')
}
async function a2() {
  console.log('a2')
}
console.log('script start')
setTimeout(() => console.log('timeout'), 0)
a1()
new Promise((resolve) => {
  console.log('promise executor')
  resolve()
}).then(() => console.log('then'))
console.log('script end')
```
@@@solution
```text
script start
a1 start
a2
promise executor
script end
a1 end
then
timeout
```
- `a1()` runs synchronously until `await`: logs `a1 start`, calls `a2` which logs `a2` synchronously and returns a resolved promise. The rest of `a1` becomes a microtask.
- The Promise **executor runs synchronously**, logs `promise executor`; `.then` is queued as a microtask after `a1`'s continuation.
- Microtasks in order: `a1 end`, `then`. Then the timer.

(In very old engines `await` on a promise took extra ticks; modern engines take one tick for an already-resolved native promise.)
:::

:::challenge
difficulty: hard
### Predict the order (nested queues)
```js
setTimeout(() => {
  console.log('t1')
  Promise.resolve().then(() => console.log('p-in-t1'))
}, 0)
setTimeout(() => console.log('t2'), 0)
Promise.resolve().then(() => {
  console.log('p1')
  setTimeout(() => console.log('t-in-p1'), 0)
})
console.log('sync')
```
@@@solution
```text
sync
p1
t1
p-in-t1
t2
t-in-p1
```
- Sync: `sync`. Timer queue: [t1, t2]. Microtasks: [p1].
- Drain microtasks: `p1`, which queues timer t-in-p1 → timer queue: [t1, t2, t-in-p1].
- Macrotask t1: logs `t1`, queues microtask p-in-t1. Microtasks drain **before** t2: `p-in-t1`.
- Then `t2`, then `t-in-p1`.
:::

:::challenge
difficulty: hard
### Predict the order (then chains interleave)
```js
Promise.resolve()
  .then(() => console.log(1))
  .then(() => console.log(2))
  .then(() => console.log(3))

Promise.resolve()
  .then(() => console.log('a'))
  .then(() => console.log('b'))
  .then(() => console.log('c'))
```
@@@solution
```text
1
a
2
b
3
c
```
Only the **first** `.then` of each chain is queued initially ([1, a]). Each reaction, when it runs, resolves its derived promise and queues the next one at the back of the queue. So the chains interleave level by level.
:::

:::challenge
difficulty: medium
### Predict the order (promise executor and resolve)
```js
const p = new Promise((resolve) => {
  console.log(1)
  resolve(2)
  console.log(3)
})
p.then((v) => console.log(v))
console.log(4)
```
@@@solution
```text
1
3
4
2
```
The executor is synchronous; `resolve()` doesn't stop it (it's not a `return`). The `.then` callback is always async (microtask), even if the promise is already resolved.
:::

:::challenge
difficulty: medium
### Yield to the event loop
Write `processAll(items, fn, chunkSize)` that calls `fn` on every item but yields to the event loop (via `setTimeout(…, 0)`) after each chunk, and resolves with the number of chunks processed. This keeps the UI responsive for huge arrays.
@@@starter
```js
async function processAll(items, fn, chunkSize = 100) {
  // your code
}
```
@@@tests
```js
test('processes every item in order', async () => {
  const seen = []
  await processAll([1, 2, 3, 4, 5], (x) => seen.push(x), 2)
  expect(seen).toEqual([1, 2, 3, 4, 5])
})
test('returns chunk count', async () => {
  const chunks = await processAll(new Array(10).fill(0), () => {}, 3)
  expect(chunks).toBe(4)
})
test('yields between chunks (timers can run)', async () => {
  let timerRan = false
  setTimeout(() => { timerRan = true }, 0)
  const order = []
  await processAll([1, 2], (x) => order.push(timerRan), 1)
  expect(order[0]).toBe(false)
  expect(order[1]).toBe(true)
})
```
@@@solution
```js
async function processAll(items, fn, chunkSize = 100) {
  let chunks = 0
  for (let i = 0; i < items.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, items.length)
    for (let j = i; j < end; j++) fn(items[j])
    chunks++
    if (end < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  return chunks
}
```
Each `await new Promise(r => setTimeout(r, 0))` ends the current task; the loop can render and process input (and other timers) before the next chunk. In modern Chromium you can use `await scheduler.yield()` which resumes with higher priority than a regular timer.
:::

## Quick check

:::quiz
### After a macrotask finishes, the event loop…
- [ ] Runs one microtask, then the next macrotask
- [x] Drains all microtasks (including newly added ones), then may render, then the next macrotask
- [ ] Renders first, then runs microtasks
- [ ] Runs all pending macrotasks first
@@@explain
The microtask checkpoint empties the whole queue before rendering or picking the next task.
:::

:::quiz
### Which of these is a microtask?
- [ ] setTimeout callback
- [ ] click event handler
- [x] code after `await` in an async function
- [ ] requestAnimationFrame callback
@@@explain
`await` continuations are promise reactions — microtasks. rAF belongs to the rendering step.
:::

:::quiz
### A task runs for 400ms. What happens to a click during that time?
- [ ] It's handled immediately on another thread
- [ ] It's dropped
- [x] It waits in the queue and is handled after the task finishes
- [ ] It interrupts the running task
@@@explain
Tasks run to completion; input is queued and processed later — the user perceives lag (poor INP).
:::
