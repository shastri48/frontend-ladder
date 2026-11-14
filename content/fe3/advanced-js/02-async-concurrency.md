---
title: Async Schedulers & Concurrency Limits
summary: Run many async tasks without overwhelming the browser or the server — promise pools, mapAsyncLimit, a Scheduler class with max concurrency, priorities and cancellation.
minutes: 22
---

## The problem: "fire everything" doesn't scale

```js
// 500 image uploads
await Promise.all(files.map(upload))
```

This starts **500 requests at once**. Consequences:

- Browsers cap connections per origin (about 6 for HTTP/1.1). The other 494 queue inside the network stack, but they still each allocate memory, `FormData`, and file readers.
- The server sees a burst and may rate-limit you (HTTP 429) or fall over.
- You lose control: you can't prioritise, cancel or show meaningful progress.
- With HTTP/2 the connection limit disappears, which makes it *worse* — now all 500 truly hit the backend at once.

What we want is a **pool**: at most `N` tasks in flight; as soon as one finishes, the next one starts.

:::visual concurrency-limit
:::

:::callout analogy Checkout counters
A supermarket with 3 counters doesn't send all 50 shoppers to the counters at once. There's a single queue; whenever a counter frees up, the next shopper walks over. Throughput stays at 3 at a time, and nobody waits longer than necessary.
:::

## Tasks are functions, not promises

The most common mistake is passing *promises* into a limiter:

```js
limit([fetch('/a'), fetch('/b'), fetch('/c')], 2) // ❌ all three already started!
```

A promise represents work that **has already started**. To control *when* work starts, you need a function that starts it — a **task**: `() => fetch('/a')`. Every concurrency utility takes thunks for this reason.

## The worker-loop pattern

The cleanest mental model: start `limit` "workers". Each worker repeatedly grabs the next index from a shared counter until there's nothing left.

```js
async function promisePool(tasks, limit) {
  const results = new Array(tasks.length)
  let next = 0

  async function worker() {
    while (next < tasks.length) {
      const i = next++           // claim an index (safe: JS is single-threaded)
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker)
  await Promise.all(workers)
  return results
}
```

Why is `next++` safe without locks? Because JavaScript runs one piece of code at a time on the event loop. Between `const i = next++` and the `await`, no other worker can run. Races in JS only happen **across `await` points**, never inside a synchronous run.

Behaviour:

- Results are stored by index → output order equals input order.
- If any task rejects, the `await` inside that worker throws, `Promise.all(workers)` rejects → fail-fast. Other workers keep running their current task but you've already been told about the failure. (Add a `failed` flag to stop them picking new tasks.)

## The callback pattern (no async/await)

Some interviewers ask you to do it without `async` functions to see that you understand the mechanics:

```js
function promisePool(tasks, limit) {
  return new Promise((resolve, reject) => {
    const results = new Array(tasks.length)
    let started = 0, finished = 0, failed = false
    if (tasks.length === 0) return resolve(results)

    function launch() {
      if (failed || started >= tasks.length) return
      const i = started++
      Promise.resolve()
        .then(tasks[i])            // also catches sync throws inside the task
        .then((value) => {
          results[i] = value
          finished++
          if (finished === tasks.length) resolve(results)
          else launch()            // a slot freed up → start the next task
        }, (err) => { failed = true; reject(err) })
    }

    for (let k = 0; k < Math.min(limit, tasks.length); k++) launch()
  })
}
```

Note `Promise.resolve().then(tasks[i])`: if a task throws *synchronously* (instead of returning a rejected promise), this still turns it into a rejection rather than crashing the loop.

## A reusable Scheduler (queue + `add`)

Pools take a fixed array. In real apps, tasks arrive over time (user drops more files, components request thumbnails as they scroll). So we want an object:

```js
class Scheduler {
  constructor(limit) {
    this.limit = limit
    this.running = 0
    this.queue = []
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this._next()
    })
  }

  _next() {
    while (this.running < this.limit && this.queue.length) {
      const { task, resolve, reject } = this.queue.shift()
      this.running++
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          this.running--
          this._next()
        })
    }
  }
}
```

Each `add` returns a promise for **that task's** result, so callers can `await scheduler.add(() => upload(file))` independently.

### The classic output question

```js
const timeout = (ms) => new Promise((r) => setTimeout(r, ms))
const scheduler = new Scheduler(2)
const addTask = (ms, label) => scheduler.add(() => timeout(ms)).then(() => console.log(label))

addTask(1000, '1')
addTask(500, '2')
addTask(300, '3')
addTask(400, '4')
// logs: 2 3 1 4
```

Timeline: t=0 tasks 1 and 2 start (limit 2). t=500 task 2 ends → log `2`, task 3 starts (ends t=800). t=800 log `3`, task 4 starts (ends t=1200). t=1000 log `1`. t=1200 log `4`.

## Production features

| Feature | How |
|---|---|
| **Priority** | Keep the queue sorted by priority (or use several queues) and `shift` from the highest. Visible thumbnails > prefetch. |
| **Cancellation** | Give each task an `AbortSignal`; if aborted while queued, remove it and reject with `AbortError`; if running, the task itself listens to the signal. |
| **Pause/resume** | A `paused` flag checked in `_next`. |
| **Retry** | Wrap the task in a retry helper (see the API client lesson). |
| **Rate limit** (N per second, not N at a time) | Token bucket: refill tokens on an interval; a task may start only when a token is available. Concurrency limit ≠ rate limit. |
| **Progress** | Emit events on start/finish; `finished / total` for a progress bar. |

:::callout tip Concurrency vs rate limiting
"At most 3 in flight" (concurrency) and "at most 10 per second" (rate) are different constraints. A fast API with a 3-concurrency limit could still exceed 10 req/s. Many APIs need both.
:::

## Where you'll use this in a frontend

- Bulk uploads with a progress UI (Google Drive / Photos style).
- Prefetching images or routes without starving user-initiated requests.
- Concurrent progress bars (Groww machine-coding question): a list of tasks rendered as progress bars where at most N fill at once.
- Migrating/syncing data from IndexedDB to the server in batches.
- Node scripts: crawling, batch API calls, image processing.

## Interview questions

:::question
difficulty: medium
companies: Tekion
### Why do concurrency-limiting utilities take functions (`() => promise`) instead of promises?
A promise is the *result* of work that has already started. Once you've called `fetch(url)`, the request is in flight; a limiter can't delay it. Passing a function (a "thunk" or task) lets the limiter decide **when** to call it, which is the whole point. This is the same reason `p-limit`, `async.parallelLimit` and React Query's `queryFn` all take functions.
:::

:::question
difficulty: medium
### In the worker pattern, why is `const i = next++` safe without a lock?
JavaScript executes on a single thread with run-to-completion semantics. A worker reads and increments `next` synchronously; no other code can run until it hits an `await` (or returns). So two workers can never claim the same index. Data races in JS happen only between `await` points — e.g. if you read `next`, `await` something, and *then* increment, another worker could interleave.
:::

:::question
difficulty: hard
### How would you add cancellation to a Scheduler?
Accept an `AbortSignal` in `add(task, { signal })`:

1. If `signal.aborted` already → reject immediately with an `AbortError`.
2. While queued, listen for `abort`: remove the entry from the queue and reject.
3. When the task starts, pass the signal into the task (`task(signal)`) so it can forward it to `fetch`, which aborts the network request.
4. Clean up the listener once the task settles to avoid leaks.

```js
add(task, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const entry = { task: () => task(signal), resolve, reject }
    const onAbort = () => {
      const idx = this.queue.indexOf(entry)
      if (idx !== -1) { this.queue.splice(idx, 1); reject(signal.reason) }
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    entry.cleanup = () => signal?.removeEventListener('abort', onAbort)
    this.queue.push(entry)
    this._next()
  })
}
```
:::

## Challenges

:::challenge
difficulty: medium
companies: Tekion, Google
### Implement promisePool(tasks, limit)
`tasks` is an array of functions that return promises. Run them with at most `limit` running at the same time. Resolve with the results **in input order**. If any task rejects, reject with that error (fail fast). An empty array resolves to `[]`.
@@@hint
Start `min(limit, tasks.length)` workers. Each worker loops: claim the next index, await the task, store the result at that index.
@@@starter
```js
function promisePool(tasks, limit) {
  // your code
}
```
@@@tests
```js
const makeTask = (value, ms, stats) => () => {
  stats.active++
  stats.max = Math.max(stats.max, stats.active)
  return new Promise((r) => setTimeout(() => { stats.active--; r(value) }, ms))
}

test('respects the limit and keeps order', async () => {
  const stats = { active: 0, max: 0 }
  const tasks = [makeTask('a', 30, stats), makeTask('b', 10, stats), makeTask('c', 20, stats), makeTask('d', 5, stats), makeTask('e', 15, stats)]
  const res = await promisePool(tasks, 2)
  expect(res).toEqual(['a', 'b', 'c', 'd', 'e'])
  expect(stats.max).toBe(2)
})

test('limit larger than tasks', async () => {
  const stats = { active: 0, max: 0 }
  const res = await promisePool([makeTask(1, 5, stats), makeTask(2, 5, stats)], 10)
  expect(res).toEqual([1, 2])
})

test('empty array', async () => {
  expect(await promisePool([], 3)).toEqual([])
})

test('rejects on failure', async () => {
  let err
  try {
    await promisePool([() => Promise.resolve(1), () => Promise.reject(new Error('bad')), () => Promise.resolve(3)], 2)
  } catch (e) { err = e }
  expect(err.message).toBe('bad')
})
```
@@@solution
```js
async function promisePool(tasks, limit) {
  const results = new Array(tasks.length)
  let next = 0
  let failed = false

  async function worker() {
    while (!failed && next < tasks.length) {
      const i = next++
      try {
        results[i] = await tasks[i]()
      } catch (err) {
        failed = true
        throw err
      }
    }
  }

  const count = Math.min(limit, tasks.length)
  await Promise.all(Array.from({ length: count }, worker))
  return results
}
```

- `count` workers run concurrently → at most `limit` tasks in flight.
- Each worker claims an index synchronously, so no index is run twice.
- Results are stored by index → input order.
- On failure, `failed` stops other workers from starting new tasks, and the thrown error rejects `Promise.all`.

**Complexity:** O(n) bookkeeping. Total time ≈ the makespan of greedy scheduling across `limit` slots.

**Follow-ups:** return `allSettled`-style results instead of failing fast; add progress callbacks; make `limit` dynamic (e.g. lower it when the server returns 429).
:::

:::challenge
difficulty: medium
companies: Google
### Implement mapAsyncLimit(items, limit, asyncFn)
Like `Array.prototype.map` but `asyncFn(item, index)` is async and at most `limit` calls run at once. Resolve with mapped results in order.
@@@starter
```js
function mapAsyncLimit(items, limit, asyncFn) {
  // your code
}
```
@@@tests
```js
test('maps in order with limit', async () => {
  let active = 0, max = 0
  const res = await mapAsyncLimit([1, 2, 3, 4, 5, 6], 3, async (x, i) => {
    active++; max = Math.max(max, active)
    await sleep(10 + (6 - x) * 3)
    active--
    return x * 10 + i
  })
  expect(res).toEqual([10, 21, 32, 43, 54, 65])
  expect(max).toBe(3)
})

test('works with an iterable like a Set', async () => {
  const res = await mapAsyncLimit(new Set(['a', 'b']), 1, async (s) => s.toUpperCase())
  expect(res).toEqual(['A', 'B'])
})
```
@@@solution
```js
async function mapAsyncLimit(items, limit, asyncFn) {
  const list = Array.from(items)
  const results = new Array(list.length)
  let next = 0

  async function worker() {
    while (next < list.length) {
      const i = next++
      results[i] = await asyncFn(list[i], i)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker))
  return results
}
```

It's the same worker pattern; we just build the task on the fly from `items[i]`. `Array.from` lets callers pass any iterable.

An alternative that's handy in interviews: implement it in one line on top of `promisePool`: `promisePool(list.map((x, i) => () => asyncFn(x, i)), limit)`.
:::

:::challenge
difficulty: hard
companies: Tekion
### Implement a Scheduler class with max concurrency
`new Scheduler(limit)` exposes `add(task)`, where `task` is a function returning a promise. `add` returns a promise resolving/rejecting with that task's result. At most `limit` tasks run at once; queued tasks start in FIFO order as slots free up. A failing task must not block the queue.
@@@starter
```js
class Scheduler {
  constructor(limit) {}
  add(task) {}
}
```
@@@tests
```js
test('classic 2 3 1 4 order', async () => {
  const s = new Scheduler(2)
  const log = []
  const t = (ms, label) => s.add(() => sleep(ms)).then(() => log.push(label))
  t(100, '1'); t(50, '2'); t(30, '3'); t(40, '4')
  await sleep(180)
  expect(log).toEqual(['2', '3', '1', '4'])
})

test('returns task values and errors without blocking', async () => {
  const s = new Scheduler(1)
  const a = s.add(() => Promise.reject(new Error('x')))
  const b = s.add(() => Promise.resolve('ok'))
  let err
  try { await a } catch (e) { err = e.message }
  expect(err).toBe('x')
  expect(await b).toBe('ok')
})

test('never exceeds limit', async () => {
  const s = new Scheduler(3)
  let active = 0, max = 0
  const job = () => { active++; max = Math.max(max, active); return sleep(10).then(() => { active-- }) }
  await Promise.all(Array.from({ length: 10 }, () => s.add(job)))
  expect(max).toBe(3)
})
```
@@@solution
```js
class Scheduler {
  constructor(limit) {
    this.limit = limit
    this.running = 0
    this.queue = []
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this._next()
    })
  }

  _next() {
    while (this.running < this.limit && this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift()
      this.running++
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          this.running--
          this._next()
        })
    }
  }
}
```

- `add` enqueues and immediately tries to start work.
- `_next` fills free slots in FIFO order.
- `.then(resolve, reject)` forwards the task's outcome to the caller; because the error is *handled* there, the chain continues and `finally` always frees the slot — one failure never blocks the queue.
- `Promise.resolve().then(task)` converts synchronous throws into rejections.

**Follow-ups:** priorities (sorted insertion or a heap), `AbortSignal` support, `onIdle()` that resolves when queue and running are both empty, and dynamic limits.
:::

## Quick check

:::quiz
### `Promise.all(urls.map(u => fetch(u)))` with 200 URLs over HTTP/2 — what's the main risk?
- [ ] The browser refuses to send more than 6
- [x] All 200 requests hit the server at once; there's no back-pressure
- [ ] Results come back out of order
- [ ] `Promise.all` can't handle more than 100 promises
@@@explain
HTTP/2 multiplexes everything over one connection, so there's no client-side queueing; you need your own limiter. `Promise.all` preserves order.
:::

:::quiz
### In a Scheduler with limit 2, tasks of 1000ms, 500ms, 300ms, 400ms are added in order. What's the completion order?
- [ ] 1 2 3 4
- [x] 2 3 1 4
- [ ] 3 2 4 1
- [ ] 2 1 3 4
@@@explain
t=500 task 2 ends (3 starts), t=800 task 3 ends (4 starts), t=1000 task 1 ends, t=1200 task 4 ends.
:::
