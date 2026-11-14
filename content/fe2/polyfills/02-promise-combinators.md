---
title: Promise.all, allSettled, race & any from Scratch
summary: Implement the four promise combinators the way the spec does — preserving order, handling non-promise values, empty inputs and the first rejection.
minutes: 18
---

## Why interviewers love this

"Implement `Promise.all`" is one of the most common frontend coding questions (Meta, Google, OpenAI, Uber, Tekion…). It looks easy but quietly tests whether you understand:

- that promises settle **asynchronously** and in **any order**,
- how to collect results **in input order**,
- that inputs may be **plain values**, not just promises,
- what happens with an **empty** input,
- that a promise can only settle **once** (so extra `resolve`/`reject` calls are harmless).

Revisit the visual below, then build all four.

:::visual promise-combinators
:::

## The shared skeleton

Every combinator follows the same shape:

```js
function combinator(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable)  // accept any iterable (Set, generator…)
    if (items.length === 0) { /* edge case */ }
    items.forEach((item, index) => {
      Promise.resolve(item)             // normalise values & thenables
        .then(
          (value) => { /* record success at index */ },
          (reason) => { /* record failure */ }
        )
    })
  })
}
```

Three non-negotiables:

1. **`Promise.resolve(item)`** — so `myAll([1, fetchX()])` works and thenables are adopted.
2. **Store by index, not by push** — completion order ≠ input order.
3. **Count completions with a counter** — don't check `results.length` (assigning `results[5]` first makes `length` 6 immediately!).

:::callout warn The `results.length` trap
```js
const results = []
results[2] = 'c'
results.length // 3 — even though slots 0 and 1 are empty
```
That's why we keep a separate `remaining`/`completed` counter.
:::

## Promise.all

- Fulfils with an array of values in input order when **all** fulfil.
- Rejects with the **first** rejection reason (fail-fast).
- Empty input → fulfils with `[]` immediately.

## Promise.allSettled

- Never rejects. Waits for all.
- Each result is `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`.
- Perfect for dashboards with independent widgets — one failing API shouldn't blank the page.

## Promise.race

- Settles like the **first** input to settle, either way.
- Empty input → **stays pending forever** (per spec).
- Common use: timeouts.

## Promise.any

- Fulfils with the **first** fulfilment.
- Rejects only if **all** reject, with an `AggregateError` whose `errors` array is in input order.
- Empty input → rejects immediately with an `AggregateError`.

## Interview questions

:::question
difficulty: medium
### Does Promise.all cancel the other promises when one rejects?
No. Promises aren't cancellable; `Promise.all` just stops caring — its returned promise rejects immediately, but the other operations keep running and their results are ignored. To actually cancel network work, pass a shared `AbortController.signal` to every `fetch` and call `abort()` when one fails.
:::

:::question
difficulty: medium
### When would you choose allSettled over all?
When the operations are independent and partial success is useful: loading several dashboard widgets, sending analytics batches, validating many fields remotely, bulk uploads where you report per-item status. `all` is for "all-or-nothing" dependencies, e.g. you need user + permissions + config before rendering a page.
:::

## Challenges

:::challenge
difficulty: medium
companies: Meta, Google, OpenAI, Tekion
### Implement Promise.all
Implement `promiseAll(iterable)` that behaves like `Promise.all`.
@@@hint
Wrap each item with `Promise.resolve`, store the value at its index, and resolve when a counter of completed items equals the total. Handle the empty case up front.
@@@starter
```js
function promiseAll(iterable) {
  // your code
}
```
@@@tests
```js
const wait = (v, ms, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(v) : res(v)), ms))
test('resolves values in input order', async () => {
  expect(await promiseAll([wait('a', 50), wait('b', 10), wait('c', 30)])).toEqual(['a', 'b', 'c'])
})
test('accepts plain values', async () => {
  expect(await promiseAll([1, Promise.resolve(2), 3])).toEqual([1, 2, 3])
})
test('empty input resolves to []', async () => {
  expect(await promiseAll([])).toEqual([])
})
test('rejects with the first rejection', async () => {
  let error
  try {
    await promiseAll([wait(1, 50), wait('bad', 10, true), wait('worse', 30, true)])
  } catch (e) { error = e }
  expect(error).toBe('bad')
})
test('works with any iterable', async () => {
  expect(await promiseAll(new Set([1, 2]))).toEqual([1, 2])
})
```
@@@solution
```js
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable)
    const results = new Array(items.length)
    let completed = 0

    if (items.length === 0) {
      resolve([])
      return
    }

    items.forEach((item, index) => {
      Promise.resolve(item).then(
        (value) => {
          results[index] = value
          completed += 1
          if (completed === items.length) resolve(results)
        },
        reject // first rejection wins; later calls are ignored
      )
    })
  })
}
```
**Complexity:** O(n) time and space.

**Talking points:** order by index; counter instead of `results.length`; `Promise.resolve` for plain values/thenables; calling `reject` multiple times is harmless because a promise settles once; other operations aren't cancelled.
:::

:::challenge
difficulty: medium
### Implement Promise.allSettled
Implement `promiseAllSettled(iterable)`.
@@@starter
```js
function promiseAllSettled(iterable) {
  // your code
}
```
@@@tests
```js
test('reports every outcome in order', async () => {
  const res = await promiseAllSettled([
    Promise.resolve(1),
    Promise.reject('no'),
    3,
  ])
  expect(res).toEqual([
    { status: 'fulfilled', value: 1 },
    { status: 'rejected', reason: 'no' },
    { status: 'fulfilled', value: 3 },
  ])
})
test('never rejects and handles empty', async () => {
  expect(await promiseAllSettled([])).toEqual([])
})
test('waits for slow ones', async () => {
  const slow = new Promise((r) => setTimeout(() => r('slow'), 40))
  const res = await promiseAllSettled([slow, Promise.reject(new Error('x'))])
  expect(res[0]).toEqual({ status: 'fulfilled', value: 'slow' })
  expect(res[1].status).toBe('rejected')
})
```
@@@solution
```js
function promiseAllSettled(iterable) {
  return new Promise((resolve) => {
    const items = Array.from(iterable)
    const results = new Array(items.length)
    let settled = 0

    if (items.length === 0) return resolve([])

    const done = (index, outcome) => {
      results[index] = outcome
      settled += 1
      if (settled === items.length) resolve(results)
    }

    items.forEach((item, index) => {
      Promise.resolve(item).then(
        (value) => done(index, { status: 'fulfilled', value }),
        (reason) => done(index, { status: 'rejected', reason })
      )
    })
  })
}
```
Alternative one-liner built on `Promise.all`: map every input to a promise that never rejects:
```js
const allSettled = (ps) =>
  Promise.all(Array.from(ps, (p) =>
    Promise.resolve(p).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason })
    )))
```
:::

:::challenge
difficulty: easy
### Implement Promise.race
Implement `promiseRace(iterable)`.
@@@starter
```js
function promiseRace(iterable) {
  // your code
}
```
@@@tests
```js
const wait = (v, ms, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(v) : res(v)), ms))
test('first fulfilment wins', async () => {
  expect(await promiseRace([wait('slow', 50), wait('fast', 10)])).toBe('fast')
})
test('first rejection wins if it is first', async () => {
  let err
  try { await promiseRace([wait('slow', 50), wait('boom', 10, true)]) } catch (e) { err = e }
  expect(err).toBe('boom')
})
test('plain values win immediately', async () => {
  expect(await promiseRace([wait('x', 20), 'now'])).toBe('now')
})
```
@@@solution
```js
function promiseRace(iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) {
      Promise.resolve(item).then(resolve, reject)
    }
  })
}
```
Whoever calls `resolve`/`reject` first settles the promise; the rest are ignored. With an empty iterable the promise stays pending forever, matching the spec.

**Use it for timeouts:**
```js
const withTimeout = (p, ms) =>
  promiseRace([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), ms))])
```
:::

:::challenge
difficulty: medium
companies: Coinbase
### Implement Promise.any
Implement `promiseAny(iterable)`. If all reject, reject with an `AggregateError` whose `errors` are in input order. Empty input rejects immediately.
@@@starter
```js
function promiseAny(iterable) {
  // your code
}
```
@@@tests
```js
const wait = (v, ms, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(v) : res(v)), ms))
test('first fulfilment wins, rejections ignored', async () => {
  expect(await promiseAny([wait('e1', 5, true), wait('ok', 30), wait('later', 50)])).toBe('ok')
})
test('all rejected gives AggregateError in input order', async () => {
  let err
  try { await promiseAny([wait('a', 30, true), wait('b', 10, true)]) } catch (e) { err = e }
  expect(err instanceof AggregateError).toBe(true)
  expect(err.errors).toEqual(['a', 'b'])
})
test('empty rejects', async () => {
  let err
  try { await promiseAny([]) } catch (e) { err = e }
  expect(err instanceof AggregateError).toBe(true)
})
```
@@@solution
```js
function promiseAny(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable)
    const errors = new Array(items.length)
    let rejected = 0

    if (items.length === 0) {
      reject(new AggregateError([], 'All promises were rejected'))
      return
    }

    items.forEach((item, index) => {
      Promise.resolve(item).then(resolve, (reason) => {
        errors[index] = reason
        rejected += 1
        if (rejected === items.length) {
          reject(new AggregateError(errors, 'All promises were rejected'))
        }
      })
    })
  })
}
```
It's the mirror image of `Promise.all`: success short-circuits, failures are collected by index.
:::

:::challenge
difficulty: medium
### Implement promiseTimeout
Write `promiseTimeout(promise, ms)` that resolves/rejects like `promise` if it settles within `ms`, otherwise rejects with `new Error('Timeout')`. Clear the timer when the promise settles first.
@@@starter
```js
function promiseTimeout(promise, ms) {
  // your code
}
```
@@@tests
```js
test('resolves if fast enough', async () => {
  const p = new Promise((r) => setTimeout(() => r('ok'), 10))
  expect(await promiseTimeout(p, 50)).toBe('ok')
})
test('rejects on timeout', async () => {
  const p = new Promise((r) => setTimeout(() => r('late'), 80))
  let err
  try { await promiseTimeout(p, 20) } catch (e) { err = e }
  expect(err.message).toBe('Timeout')
})
```
@@@solution
```js
function promiseTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
```
`finally` clears the timer either way so no stray timer keeps running. Remember: the original operation isn't cancelled — for `fetch`, use `AbortSignal.timeout(ms)` to actually abort it.
:::

## Quick check

:::quiz
### Why must you use a counter instead of `results.length` in Promise.all?
- [ ] Arrays can't hold promises
- [x] Assigning a high index first makes length jump even though earlier slots are empty
- [ ] length is read-only
- [ ] Counters are faster
@@@explain
`arr[4] = x` sets length to 5 instantly, so you'd resolve too early.
:::

:::quiz
### What does Promise.race([]) do?
- [ ] Resolves with undefined
- [ ] Rejects immediately
- [x] Stays pending forever
- [ ] Throws synchronously
@@@explain
With no contenders, nothing ever settles it.
:::
