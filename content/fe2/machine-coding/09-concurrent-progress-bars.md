---
title: Concurrent Progress Bars and Task Queues
summary: Groww's machine-coding round — progress bars that run with a concurrency limit, pause/resume, and the async-queue thinking behind upload managers.
minutes: 16
---

## The prompt

Groww's SDE-II frontend machine-coding round: "Design a system of concurrent progress bars that handle multiple tasks running…". It usually escalates in levels:

1. A button adds a progress bar that fills from 0 → 100% in 2 seconds.
2. Clicking many times adds many bars — they all run.
3. **Only N (e.g. 3) bars may run at the same time**; the rest wait in a queue and start as others finish.
4. Pause / resume all (or each), and maybe cancel.

It's really a question about **async task scheduling** dressed as UI — the same logic powers upload managers, download queues and API concurrency limiting.

:::visual concurrency-limit
:::

## Level 1–2: a self-animating bar

The cheapest way to animate a fill is **CSS**, not JS ticks:

```jsx
function Bar({ onDone }) {
  const [started, setStarted] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setStarted(true)) }, [])   // next frame → transition runs
  return (
    <div className="track">
      <div
        className="fill"
        style={{ transform: `scaleX(${started ? 1 : 0})`, transition: 'transform 2s linear' }}
        onTransitionEnd={onDone}
      />
    </div>
  )
}
```

`transform: scaleX` runs on the compositor — 50 bars animate smoothly. But CSS-only bars are hard to **pause/resume precisely** or report progress, so for levels 3–4 we drive progress from state.

## Level 3–4: scheduler + pause/resume

Model each task as data: `{ id, progress (0–100), status: 'queued' | 'running' | 'paused' | 'done' }`. A single scheduler tick (one interval or rAF loop for **all** bars, not one timer per bar) advances running tasks, and after every change we promote queued tasks while `running < limit`.

:::challenge
difficulty: hard
companies: Groww
### Concurrent progress bars with a limit, pause and resume
Build `<ProgressBars limit={3} duration={2000} />`:
- "Add" creates a bar. At most `limit` bars fill at once; others show "Queued" and start in FIFO order when a slot frees up.
- Each bar fills linearly over `duration` ms.
- "Pause all" freezes running bars (keeping their progress); "Resume" continues them from where they stopped. Paused bars still occupy their slots.
- Show counts: running / queued / done. Clean up timers on unmount.
@@@hint
Use one `useReducer` with a `tick(deltaMs)` action and a `requestAnimationFrame` loop that's only active while something is running. After every action, run a "fill slots" step inside the reducer so scheduling is always consistent.
@@@solution
```jsx
import { useEffect, useReducer, useRef } from 'react'

let nextId = 1

function fillSlots(tasks, limit, paused) {
  if (paused) return tasks
  let running = tasks.filter((t) => t.status === 'running').length
  return tasks.map((t) => {
    if (t.status === 'queued' && running < limit) {
      running++
      return { ...t, status: 'running' }
    }
    return t
  })
}

function reducer(state, action) {
  const { limit, duration } = state
  switch (action.type) {
    case 'add': {
      const tasks = [...state.tasks, { id: nextId++, progress: 0, status: 'queued' }]
      return { ...state, tasks: fillSlots(tasks, limit, state.paused) }
    }
    case 'tick': {
      if (state.paused) return state
      const inc = (action.delta / duration) * 100
      let changed = false
      const tasks = state.tasks.map((t) => {
        if (t.status !== 'running') return t
        changed = true
        const progress = Math.min(100, t.progress + inc)
        return { ...t, progress, status: progress >= 100 ? 'done' : 'running' }
      })
      return changed ? { ...state, tasks: fillSlots(tasks, limit, false) } : state
    }
    case 'pause':
      return { ...state, paused: true }
    case 'resume':
      return { ...state, paused: false, tasks: fillSlots(state.tasks, limit, false) }
    case 'cancel': {
      const tasks = state.tasks.filter((t) => t.id !== action.id)
      return { ...state, tasks: fillSlots(tasks, limit, state.paused) }
    }
    case 'clearDone':
      return { ...state, tasks: state.tasks.filter((t) => t.status !== 'done') }
    default:
      return state
  }
}

export function ProgressBars({ limit = 3, duration = 2000 }) {
  const [state, dispatch] = useReducer(reducer, { tasks: [], paused: false, limit, duration })
  const { tasks, paused } = state

  const running = tasks.filter((t) => t.status === 'running').length
  const queued = tasks.filter((t) => t.status === 'queued').length
  const done = tasks.filter((t) => t.status === 'done').length
  const active = running > 0 && !paused

  // One rAF loop for all bars, only while something is running
  const last = useRef(0)
  useEffect(() => {
    if (!active) return
    let raf
    last.current = performance.now()
    const loop = (now) => {
      dispatch({ type: 'tick', delta: now - last.current })
      last.current = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)   // pause / unmount / nothing running
  }, [active])

  return (
    <div className="bars">
      <div className="bars__toolbar">
        <button onClick={() => dispatch({ type: 'add' })}>Add</button>
        {paused
          ? <button onClick={() => dispatch({ type: 'resume' })}>Resume</button>
          : <button onClick={() => dispatch({ type: 'pause' })} disabled={!running}>Pause all</button>}
        <button onClick={() => dispatch({ type: 'clearDone' })} disabled={!done}>Clear finished</button>
        <span>Running {running} · Queued {queued} · Done {done}</span>
      </div>
      <ul>
        {tasks.map((t) => (
          <li key={t.id} className="bars__row">
            <div
              className="track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(t.progress)}
              aria-label={`Task ${t.id}`}
            >
              <div className="fill" style={{ transform: `scaleX(${t.progress / 100})` }} />
            </div>
            <span className="bars__label">
              {t.status === 'queued' ? 'Queued' : t.status === 'done' ? 'Done ✓' : `${Math.round(t.progress)}%${paused ? ' (paused)' : ''}`}
            </span>
            {t.status !== 'done' && (
              <button aria-label={`Cancel task ${t.id}`} onClick={() => dispatch({ type: 'cancel', id: t.id })}>✕</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```
```css
.bars__row { display: grid; grid-template-columns: 1fr 110px 32px; gap: 8px; align-items: center; margin: 6px 0; }
.track { height: 12px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.fill { height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); transform-origin: left; }
```

Why this design is strong:
- **State machine per task** (`queued → running → done`, plus global pause) — every transition is explicit in the reducer.
- **Scheduling lives in one place** (`fillSlots`) and runs after every action, so the invariant `running ≤ limit` always holds and FIFO order is preserved by array order.
- **One rAF loop** for all bars (not N intervals), active only while needed; using real elapsed time (`delta`) makes progress accurate even when frames drop or the tab throttles.
- Pause stops the loop; progress is kept in state, so resume continues exactly where it left off.
- Fill uses `scaleX` (compositor); `role="progressbar"` with `aria-valuenow`.
- Follow-ups: per-bar pause; real async tasks (uploads) instead of timers — replace `tick` with progress events from `XMLHttpRequest.upload.onprogress`; retry failed tasks; priority queue; persisting the queue.
:::

## The same idea without UI

The pure JavaScript version of this problem — "run async tasks with max N concurrency" — is a top FE3 question. Here's the shape:

```js
function runWithLimit(tasks, limit) {
  return new Promise((resolve) => {
    const results = []
    let started = 0, finished = 0
    if (!tasks.length) return resolve(results)
    const launch = () => {
      if (started >= tasks.length) return
      const i = started++
      Promise.resolve().then(tasks[i]).then(
        (v) => (results[i] = { status: 'fulfilled', value: v }),
        (e) => (results[i] = { status: 'rejected', reason: e })
      ).finally(() => {
        if (++finished === tasks.length) resolve(results)
        else launch()
      })
    }
    for (let k = 0; k < Math.min(limit, tasks.length); k++) launch()
  })
}
```

:::challenge
difficulty: medium
### Async pool
Implement `asyncPool(limit, items, iteratorFn)` that calls `iteratorFn(item)` (returns a promise) for every item with at most `limit` in flight, and resolves to an array of results **in input order**. Reject as soon as any call rejects.
@@@starter
```js
function asyncPool(limit, items, iteratorFn) {
  // your code
}
```
@@@tests
```js
const wait = (v, ms) => new Promise((r) => setTimeout(() => r(v), ms))
test('preserves order', async () => {
  const out = await asyncPool(2, [30, 10, 20], (ms) => wait(ms, ms))
  expect(out).toEqual([30, 10, 20])
})
test('respects the limit', async () => {
  let running = 0, max = 0
  await asyncPool(2, [1, 2, 3, 4, 5], async () => {
    running++; max = Math.max(max, running)
    await wait(null, 15)
    running--
  })
  expect(max).toBe(2)
})
test('rejects on failure', async () => {
  let msg = ''
  try { await asyncPool(2, [1, 2, 3], (x) => (x === 2 ? Promise.reject(new Error('boom')) : wait(x, 5))) }
  catch (e) { msg = e.message }
  expect(msg).toBe('boom')
})
test('empty input', async () => {
  expect(await asyncPool(3, [], (x) => x)).toEqual([])
})
```
@@@solution
```js
async function asyncPool(limit, items, iteratorFn) {
  const results = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const i = next++                  // claim an index synchronously — no two workers get the same one
      results[i] = await iteratorFn(items[i], i)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)            // rejects as soon as any worker throws
  return results
}
```
The **worker pool** pattern: start `limit` workers that each pull the next index from a shared counter until the queue is empty. JavaScript is single-threaded, so `next++` is atomic — no locks needed. Results are written by index, preserving order. Time: total work / limit; memory: O(n) results.
:::

## Quick check

:::quiz
### Why use one rAF loop for all progress bars instead of one setInterval per bar?
- [ ] setInterval doesn't work in React
- [x] Fewer timers, frame-aligned updates batched into one render, and it stops when idle
- [ ] rAF runs faster than 60fps
- [ ] Intervals can't be cleared
@@@explain
N independent timers cause N state updates at unaligned times; one loop batches them per frame.
:::

:::quiz
### In the worker-pool solution, why is `const i = next++` safe without locks?
- [ ] Promises are atomic
- [x] JavaScript runs on a single thread; the increment can't be interleaved with another worker's
- [ ] Because of await
- [ ] Arrays are thread-safe
@@@explain
Workers only interleave at await points; synchronous code between awaits runs to completion.
:::
