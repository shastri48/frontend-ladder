---
title: Promises & async/await in Depth
summary: Promise states, chaining rules, error propagation, the four combinators, how Promise.all preserves order, and what async/await compiles down to.
minutes: 20
---

## From callbacks to promises

Before promises, async code used callbacks — and nested callbacks became **callback hell**: deeply indented code, error handling repeated at every level, and *inversion of control* (you hand your continuation to a library and trust it to call it once, with the right args, and not swallow errors).

```js
getUser(id, (err, user) => {
  if (err) return handle(err)
  getOrders(user, (err, orders) => {
    if (err) return handle(err)
    getInvoice(orders[0], (err, invoice) => {
      if (err) return handle(err)
      render(invoice)
    })
  })
})
```

A **Promise** is an object representing the eventual result of an async operation. Instead of passing a callback *in*, you get a value *out* that you can chain, compose and pass around.

```js
getUser(id)
  .then(getOrders)
  .then((orders) => getInvoice(orders[0]))
  .then(render)
  .catch(handle) // one place for errors from any step
```

## States and settling

```text
               resolve(value)
           ┌──────────────────► fulfilled (value)
 pending ──┤
           └──────────────────► rejected (reason)
               reject(err) / throw
```

- A promise starts **pending** and settles **once** — to *fulfilled* or *rejected*. Later `resolve`/`reject` calls are ignored.
- "Resolved" ≠ "fulfilled": resolving with another promise (a *thenable*) makes it **follow** that promise's eventual state.
- Reactions (`then/catch/finally` callbacks) are **always** called asynchronously as microtasks, even if the promise is already settled — this guarantees consistent ordering.

```js
const p = new Promise((resolve, reject) => {
  // executor runs synchronously, right now
  setTimeout(() => resolve('done'), 100)
})
```

## The chaining rules (memorise these)

`p.then(onFulfilled, onRejected)` **always returns a new promise** `p2`. What `p2` becomes depends on what the handler does:

| Handler… | `p2` becomes |
|---|---|
| returns a plain value `v` | fulfilled with `v` |
| returns a promise/thenable | follows it (adopts its state) |
| throws `e` | rejected with `e` |
| is missing (not a function) | passes the value/rejection through unchanged |

```js
Promise.resolve(1)
  .then((x) => x + 1)                 // 2
  .then((x) => { throw new Error('boom') })
  .then(() => console.log('skipped')) // skipped: no onRejected here
  .catch((e) => { console.log(e.message); return 'recovered' })
  .then((v) => console.log(v))        // "recovered"
  .finally(() => console.log('cleanup'))
```

- `.catch(fn)` is just `.then(undefined, fn)`.
- After a `.catch` that returns normally, the chain is back to fulfilled.
- `.finally(fn)` receives no argument and passes through the original value/reason (unless `fn` throws or returns a rejected promise).

:::callout danger The forgotten return
`then(() => { fetchMore() })` doesn't return the inner promise, so the chain doesn't wait for it and its errors become *unhandled rejections*. Always `return` inner promises (or use `async/await`).
:::

### `.then(a, b)` vs `.then(a).catch(b)`

In `.then(a, b)`, `b` does **not** catch errors thrown by `a`. In `.then(a).catch(b)`, it does. Prefer the latter.

## `Promise.resolve` with non-promises (Intuit question)

`Promise.resolve(x)`:

- If `x` is a **native promise** (same constructor), it returns `x` itself: `Promise.resolve(p) === p`.
- If `x` is a **thenable** (has a `then` method), it creates a new promise that calls `x.then` asynchronously to adopt its state.
- Otherwise (number, object, `undefined`…), it returns a promise **already fulfilled** with `x`.

```js
Promise.resolve(42).then(console.log)             // 42
const thenable = { then(res) { res('from thenable') } }
Promise.resolve(thenable).then(console.log)       // "from thenable"
```

This is how `await 42` works — `await` wraps its operand with `Promise.resolve`.

## The four combinators

:::visual promise-combinators
:::

| Combinator | Resolves when | Rejects when | Result |
|---|---|---|---|
| `Promise.all(ps)` | **all** fulfil | **any** rejects (fail-fast) | Array of values **in input order** |
| `Promise.allSettled(ps)` | all settle (never rejects) | — | `[{status:'fulfilled', value} \| {status:'rejected', reason}]` |
| `Promise.race(ps)` | the **first to settle** fulfils | the first to settle rejects | That value/reason |
| `Promise.any(ps)` | the **first to fulfil** | **all** reject | Value, or `AggregateError` with `.errors` |

### How does `Promise.all` preserve result order? (Intuit)

It doesn't store results in completion order — it stores each result at **its input index**:

```js
results[index] = value
if (--remaining === 0) resolve(results)
```

Completion order doesn't matter; the slot does. It also wraps every input with `Promise.resolve`, so non-promise values are allowed: `Promise.all([1, fetchX()])`. An empty array resolves immediately with `[]`.

Note: `Promise.all` does **not** cancel the other operations when one rejects — they keep running; only the aggregate promise settles early.

### race vs any (Coinbase question)

- `race` = first to **settle** wins, even if it's a rejection. Classic use: **timeouts**.
- `any` = first to **succeed** wins; rejections are ignored unless all fail. Classic use: fetching from multiple mirrors/CDNs and taking whichever responds successfully first.

```js
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), ms))
const data = await Promise.race([fetch('/api'), timeout(5000)])

const fastest = await Promise.any([fetch(cdnA), fetch(cdnB), fetch(cdnC)])
```

## async/await

`async` functions always return a promise. `await` pauses the function (not the thread!) until the promise settles, then resumes it as a microtask.

```js
async function loadInvoice(id) {
  try {
    const user = await getUser(id)
    const orders = await getOrders(user)
    return await getInvoice(orders[0])
  } catch (err) {
    report(err)
    throw err
  } finally {
    hideSpinner()
  }
}
```

Conceptually, the engine turns this into a state machine (like a generator driven by promises):

```js
function loadInvoice(id) {
  return getUser(id)
    .then((user) => getOrders(user))
    .then((orders) => getInvoice(orders[0]))
}
```

### Sequential vs parallel — a common performance bug

```js
// ❌ Sequential: ~ t(a) + t(b)
const a = await fetchA()
const b = await fetchB()

// ✅ Parallel: ~ max(t(a), t(b))
const [a2, b2] = await Promise.all([fetchA(), fetchB()])
```

`await` inside `forEach` doesn't wait — `forEach` ignores returned promises. Use `for...of` (sequential) or `Promise.all(arr.map(...))` (parallel).

### Promises vs async/await (Groww question)

| | Promises (`.then`) | async/await |
|---|---|---|
| Underlying mechanism | Same | Same (sugar over promises) |
| Readability | Chains; nesting for dependent values | Looks synchronous, easy to read |
| Error handling | `.catch` | `try/catch/finally` |
| Parallelism | Natural with `Promise.all` | Need `Promise.all` explicitly; easy to accidentally serialise |
| Debugging | Stack traces less clear | Better async stack traces, breakpoints line by line |
| Top-level | Anywhere | `await` only in async functions or top-level of ES modules |

## Unhandled rejections

A rejected promise without a handler fires `unhandledrejection` on `window` (and crashes Node by default). Always end chains with `.catch`, or `await` inside `try/catch`. Monitoring tools like Sentry hook into this event.

## Interview questions

:::question
difficulty: easy
companies: Accenture
### Explain callback hell and how Promises or async/await solve it.
Callback hell is deeply nested callbacks for dependent async steps: hard to read, error handling duplicated at every level, and you lose control by handing continuations to other code. Promises flatten it into a chain with a single `.catch`, make results first-class values you can compose (`Promise.all`), and guarantee callbacks are called once, asynchronously. `async/await` goes further and lets you write the chain as sequential code with `try/catch`.
:::

:::question
difficulty: medium
companies: Coinbase, Impact Analytics
### How does Promise.race differ from Promise.any?
`race` settles with the first promise to **settle** — fulfilled or rejected. `any` fulfils with the first promise to **fulfil**, ignoring rejections, and only rejects (with an `AggregateError`) if every promise rejects. Use `race` for timeouts, `any` for redundancy (first successful mirror).
:::

:::question
difficulty: medium
companies: Intuit
### How does Promise.all preserve result order?
Each input is tagged with its index; when it fulfils, its value is stored at `results[index]`, and a counter tracks how many are still pending. When the counter hits zero, `results` is resolved. So the output order matches the input order regardless of completion order. Inputs are passed through `Promise.resolve`, so plain values are allowed, and the first rejection rejects the whole thing immediately.
:::

:::question
difficulty: medium
companies: Intuit
### What does Promise.resolve() do with non-promise values?
It returns a promise already fulfilled with that value. If given a native promise, it returns the same promise; if given a thenable, it adopts the thenable's state by calling its `then` asynchronously. `await value` uses the same logic.
:::

:::question
difficulty: medium
companies: Housing.com
### How do you handle promise chaining in complex UI flows?
Return promises from every step so the chain waits; keep steps small and named; run independent requests in parallel with `Promise.all`/`allSettled` (allSettled when partial failure is OK, e.g. dashboard widgets); centralise error handling with `.catch` or `try/catch` and map errors to UI states; cancel stale work with `AbortController` when inputs change or the component unmounts; and guard against out-of-order responses (request IDs / latest-only). In React, prefer a data library (React Query) for caching, retries and dedupe.
:::

## Output prediction challenges

:::challenge
difficulty: medium
companies: Impact Analytics
### Predict the output
```js
Promise.resolve(1)
  .then((x) => { throw x + 1 })
  .then((x) => console.log('then', x))
  .catch((e) => { console.log('catch', e); return e * 10 })
  .then((x) => console.log('after', x))
  .finally(() => console.log('finally'))
```
@@@solution
```text
catch 2
after 20
finally
```
Throwing `2` rejects the chain; the next `.then` has no rejection handler, so the rejection passes through to `.catch`, which logs and **returns** 20 — the chain is fulfilled again. `.finally` runs last and passes the value through.
:::

:::challenge
difficulty: medium
### Predict the output
```js
const p1 = new Promise((res) => setTimeout(() => res('p1'), 200))
const p2 = new Promise((_, rej) => setTimeout(() => rej('p2 failed'), 100))
const p3 = new Promise((res) => setTimeout(() => res('p3'), 300))

Promise.race([p1, p2, p3]).then(console.log, (e) => console.log('race:', e))
Promise.any([p1, p2, p3]).then((v) => console.log('any:', v))
Promise.allSettled([p1, p2]).then((r) => console.log(r.map((x) => x.status)))
```
@@@solution
```text
race: p2 failed       (~100ms)
any: p1               (~200ms)
[ 'fulfilled', 'rejected' ]   (~200ms, right after any)
```
`race` takes the first to settle — p2's rejection at 100ms. `any` ignores the rejection and takes the first fulfilment, p1 at 200ms. `allSettled` waits for both p1 and p2 (200ms) and never rejects. `any` logs before `allSettled` because its reaction to p1 was registered first.
:::

:::challenge
difficulty: hard
### Predict the output
```js
async function f() {
  try {
    return Promise.reject(new Error('oops'))
  } catch (e) {
    console.log('caught inside')
  }
}
async function g() {
  try {
    return await Promise.reject(new Error('oops'))
  } catch (e) {
    console.log('caught inside g')
  }
}
f().catch(() => console.log('caught outside f'))
g().then(() => console.log('g resolved'))
```
@@@solution
```text
caught inside g
g resolved
caught outside f
```
In `f`, `return somePromise` without `await` exits the `try` immediately — the rejection happens *after* the function returned, so the local `catch` never sees it; the caller's `.catch` does. In `g`, `return await` waits **inside** the `try`, so the local `catch` handles it and `g` resolves with `undefined`.

Why this order (microtask ticks):
1. Tick 1: `f`'s async promise must *adopt* the returned promise — a "resolve thenable" job runs and calls `rejected.then(...)`. In the same tick, `g` resumes from `await`, logs `caught inside g`, and fulfils — queuing `g resolved`.
2. Tick 2: `f`'s promise finally becomes rejected (queuing its `.catch`); `g resolved` logs.
3. Tick 3: `caught outside f`.

Returning a promise from an `async` function costs extra ticks. The key lesson, though, is correctness: use `return await` inside `try/catch`.
:::

:::challenge
difficulty: medium
### Run requests with sequential vs parallel timing
Implement `fetchAllParallel(fns)` which takes an array of functions returning promises and resolves with all results in order, running them **in parallel**. Then implement `fetchAllSequential(fns)` that runs them one after another.
@@@starter
```js
async function fetchAllParallel(fns) {
  // your code
}
async function fetchAllSequential(fns) {
  // your code
}
```
@@@tests
```js
const delay = (v, ms) => () => new Promise((r) => setTimeout(() => r(v), ms))
test('parallel keeps order', async () => {
  expect(await fetchAllParallel([delay('a', 60), delay('b', 10)])).toEqual(['a', 'b'])
})
test('parallel is faster than sum of delays', async () => {
  const t = Date.now()
  await fetchAllParallel([delay(1, 80), delay(2, 80), delay(3, 80)])
  expect(Date.now() - t).toBeLessThan(200)
})
test('sequential runs one at a time', async () => {
  let active = 0, maxActive = 0
  const task = (v) => async () => {
    active++; maxActive = Math.max(maxActive, active)
    await sleep(10)
    active--
    return v
  }
  expect(await fetchAllSequential([task(1), task(2), task(3)])).toEqual([1, 2, 3])
  expect(maxActive).toBe(1)
})
```
@@@solution
```js
async function fetchAllParallel(fns) {
  return Promise.all(fns.map((fn) => fn()))
}

async function fetchAllSequential(fns) {
  const results = []
  for (const fn of fns) {
    results.push(await fn())
  }
  return results
}
```
Calling every `fn()` up front starts all operations at once; `Promise.all` waits for all and keeps input order. `for...of` with `await` starts the next only after the previous finishes. Follow-up: a limited-concurrency version (`mapLimit`) — see the advanced JS module.
:::

## Quick check

:::quiz
### `.then()` always returns…
- [ ] The same promise it was called on
- [x] A new promise
- [ ] The handler's return value
- [ ] undefined
@@@explain
Every `then/catch/finally` returns a new promise whose state depends on the handler's outcome.
:::

:::quiz
### What does `Promise.all([])` do?
- [x] Resolves immediately with `[]`
- [ ] Never settles
- [ ] Rejects with TypeError
- [ ] Resolves with undefined
@@@explain
With nothing to wait for, it fulfils right away with an empty array.
:::

:::quiz
### Which combinator never rejects?
- [ ] Promise.all
- [ ] Promise.any
- [ ] Promise.race
- [x] Promise.allSettled
@@@explain
`allSettled` always fulfils with an array of outcome objects.
:::
