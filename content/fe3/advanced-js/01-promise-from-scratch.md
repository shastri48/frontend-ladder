---
title: Build a Promise From Scratch
summary: Implement a Promises/A+-style Promise — states, then-chaining, the resolution procedure, catch, finally and the static helpers — and understand why each rule exists.
minutes: 25
---

## Why interviewers love this question

"Write a Promise polyfill" (Tekion, Meta, many product companies) is not about memorising code. It checks whether you understand four things that most developers only *use*:

1. A promise is a **state machine** that settles exactly once.
2. `then` **always returns a new promise**, which is what makes chaining work.
3. Callbacks run **asynchronously as microtasks**, even if the promise is already settled.
4. Returning a promise (or any *thenable*) from a `then` callback makes the outer promise **adopt** its state. This is the "resolution procedure".

If you can explain those four ideas while you type, you pass, even with a small bug.

:::callout analogy A restaurant pager
You order food and get a pager (the promise). The pager starts *pending*. Later it buzzes once, either "food ready" (fulfilled with your meal) or "sorry, kitchen closed" (rejected with a reason). It can never buzz twice, and it can never switch from "ready" to "closed". Anyone can ask "tell me when it buzzes" (`then`), even after it already buzzed. They still get told, just not *instantly in the middle of their sentence* — they get told as soon as they finish talking (a microtask).
:::

## The state machine

```text
             resolve(value)            
  pending ─────────────────────▶ fulfilled (value)     
     │                                                  
     │  reject(reason) / executor throws                
     └─────────────────────────▶ rejected (reason)      

  Once settled, state and value are frozen forever.
```

Three rules come straight from the diagram:

- Calls to `resolve`/`reject` after the first one are **ignored**.
- If the executor **throws**, the promise rejects with the thrown error.
- `then` handlers registered **before** settlement are queued; handlers registered **after** settlement are scheduled right away (still asynchronously).

## `then` returns a new promise

This is the single most important design decision. Consider:

```js
fetchUser()
  .then(user => user.id)          // returns a number
  .then(id => fetchOrders(id))    // returns a promise
  .then(orders => render(orders))
  .catch(showError)
```

Each `.then` creates **promise2**. What promise2 settles with depends on what the handler does:

| Handler does | promise2 becomes |
|---|---|
| returns a plain value `v` | fulfilled with `v` |
| returns a promise / thenable `p` | follows `p` (adopts its eventual state) |
| throws `e` | rejected with `e` |
| handler missing (not a function) | passes the parent's state through unchanged |

That last row is why `.catch()` at the end of a chain catches errors from *any* earlier step: rejections "fall through" `then`s that have no `onRejected`, and values fall through `catch`es.

## The resolution procedure (adopting thenables)

When we resolve promise2 with some value `x`:

1. If `x === promise2` → reject with `TypeError` (a promise can't wait on itself — it would deadlock).
2. If `x` is an object or function, read `x.then` **once** (a getter could throw or change).
3. If `then` is a function, call it with `x` as `this` and two one-shot callbacks. Whatever `x` reports, we report. Guard with a `called` flag because foreign thenables might call both callbacks or call them twice.
4. Otherwise fulfill with `x`.

The "thenable" rule is why promises from different libraries (jQuery Deferreds, Bluebird, native) interoperate: we don't check `instanceof Promise`, we duck-type on `.then`.

## Why callbacks must be asynchronous

```js
let ready = false
promise.then(() => console.log(ready))
ready = true
```

If `promise` were already fulfilled and `then` ran the callback synchronously, this would log `false`; if it was still pending it would log `true`. Code that behaves differently based on timing you can't see is called **Zalgo**. The spec removes it: handlers *always* run in a later microtask. We use `queueMicrotask` (native promises use the same queue).

:::visual event-loop
:::

## The full implementation

```js
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

class MyPromise {
  constructor(executor) {
    this.state = PENDING
    this.value = undefined
    this.handlers = []

    let done = false // resolve/reject passed to the executor are one-shot
    const resolve = (v) => { if (!done) { done = true; this._resolve(v) } }
    const reject = (r) => { if (!done) { done = true; this._settle(REJECTED, r) } }

    try {
      executor(resolve, reject)
    } catch (err) {
      reject(err)
    }
  }

  // The Promise Resolution Procedure
  _resolve(x) {
    if (x === this) {
      return this._settle(REJECTED, new TypeError('Chaining cycle detected'))
    }
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
      let then
      try {
        then = x.then // read once
      } catch (err) {
        return this._settle(REJECTED, err)
      }
      if (typeof then === 'function') {
        let called = false
        try {
          then.call(
            x,
            (y) => { if (!called) { called = true; this._resolve(y) } },
            (r) => { if (!called) { called = true; this._settle(REJECTED, r) } },
          )
        } catch (err) {
          if (!called) { called = true; this._settle(REJECTED, err) }
        }
        return
      }
    }
    this._settle(FULFILLED, x)
  }

  _settle(state, value) {
    if (this.state !== PENDING) return
    this.state = state
    this.value = value
    this.handlers.forEach((h) => this._schedule(h))
    this.handlers = []
  }

  _schedule({ onFulfilled, onRejected, resolve, reject }) {
    queueMicrotask(() => {
      const cb = this.state === FULFILLED ? onFulfilled : onRejected
      if (typeof cb !== 'function') {
        // pass-through: value or rejection falls to the next link
        return this.state === FULFILLED ? resolve(this.value) : reject(this.value)
      }
      try {
        resolve(cb(this.value))
      } catch (err) {
        reject(err)
      }
    })
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const handler = { onFulfilled, onRejected, resolve, reject }
      if (this.state === PENDING) this.handlers.push(handler)
      else this._schedule(handler)
    })
  }

  catch(onRejected) {
    return this.then(undefined, onRejected)
  }

  finally(onFinally) {
    return this.then(
      (value) => MyPromise.resolve(onFinally()).then(() => value),
      (reason) => MyPromise.resolve(onFinally()).then(() => { throw reason }),
    )
  }

  static resolve(value) {
    return value instanceof MyPromise ? value : new MyPromise((res) => res(value))
  }

  static reject(reason) {
    return new MyPromise((_, rej) => rej(reason))
  }
}
```

Walk through what happens with `MyPromise.resolve(1).then(x => x + 1).then(console.log)`:

1. `resolve(1)` settles synchronously to fulfilled(1).
2. The first `then` creates promise2; parent is settled so we `_schedule` → queued microtask.
3. The second `then` is called on promise2 (still pending) → its handler is pushed to `promise2.handlers`.
4. Script ends. Microtask runs: `cb(1)` returns 2 → `promise2` resolves with 2 → settles → schedules its handler → logs `2`.

### `finally` semantics worth stating

- `onFinally` receives **no arguments** — it doesn't know whether you succeeded.
- It **passes through** the original value/reason.
- If `onFinally` throws or returns a rejected promise, *that* rejection wins.
- If it returns a promise, the chain **waits** for it (great for "hide spinner after the animation finishes").

## Static combinators

```js
MyPromise.all = function (iterable) {
  return new MyPromise((resolve, reject) => {
    const items = Array.from(iterable)
    const results = new Array(items.length)
    let remaining = items.length
    if (remaining === 0) return resolve(results)
    items.forEach((item, i) => {
      MyPromise.resolve(item).then((value) => {
        results[i] = value          // index, not push → order preserved
        if (--remaining === 0) resolve(results)
      }, reject)                    // first rejection wins
    })
  })
}
```

Two classic follow-ups: *"How does `Promise.all` preserve order?"* (Intuit) — we write to `results[i]`, never `push`, so completion order doesn't matter. *"What does `Promise.resolve(5)` do with a non-promise?"* — wraps it in an already-fulfilled promise; non-promise entries in `Promise.all` are therefore allowed.

:::visual promise-combinators
:::

## Real use cases for a hand-rolled promise

You'll rarely ship your own Promise class, but the *patterns* show up constantly:

- **Deferred**: expose `resolve`/`reject` outside the executor — e.g. resolve when a modal closes, when a WebSocket receives an ack, when an iframe posts a message.
- **Promisify** callback APIs (`fs.readFile`, `geolocation.getCurrentPosition`).
- **Thenable adapters**: objects with a `then` method can be `await`ed. Query builders (Knex, Mongoose) use this — `await db.users.where(...)` triggers the query.

```js
function createDeferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
// ES2024 ships this natively as Promise.withResolvers()
```

:::callout interview What separates a strong answer
State the three states and "settle once" before coding. Mention microtasks and Zalgo. Implement then-chaining with pass-through. Mention the thenable resolution procedure and the self-resolution `TypeError`, even if you implement a simplified version. Finish with `catch`/`finally` as one-liners over `then`.
:::

## Interview questions

:::question
difficulty: medium
companies: Tekion
### Why does `then` return a new promise instead of `this`?
Because each step of a chain can produce a **different** outcome. If `then` returned `this`, every handler would see the original value and you couldn't transform data (`.then(r => r.json())`) or recover from errors (`.catch(() => fallback)`). A new promise per `then` lets each link settle independently based on its handler's return value or thrown error.

It also preserves immutability: the original promise is still fulfilled with the original value, so other consumers that attached their own `then` are unaffected.

**In an interview, say:** "`then` returns a fresh promise resolved with the handler's result, which is what makes chaining, transformation and error recovery possible."
:::

:::question
difficulty: medium
### What is the "resolution procedure" and why does it check for thenables instead of `instanceof Promise`?
When a promise is resolved with a value `x`, the procedure decides what to do:

- `x` is the promise itself → reject with `TypeError` (cycle).
- `x` is an object/function with a callable `then` → call it and **adopt** whatever it settles to.
- anything else → fulfill with `x`.

Duck-typing on `then` lets promises from different implementations interoperate: a native promise can adopt a Bluebird promise, a jQuery deferred, or any custom "thenable" (like a query builder). `instanceof` would fail across libraries and across realms (iframes have their own `Promise` constructor).
:::

:::question
difficulty: easy
companies: Intuit
### What does `Promise.resolve()` return for a non-promise value? And for a native promise?
- Non-promise (e.g. `Promise.resolve(42)`): a new promise already **fulfilled** with `42`.
- Thenable: a new promise that adopts the thenable's state.
- A native promise of the same constructor: **the same promise object** is returned (`Promise.resolve(p) === p`).

That's why `Promise.all([1, fetchX()])` works — every entry is normalised with `Promise.resolve`.
:::

:::question
difficulty: hard
### Why are `then` callbacks always asynchronous, even on an already-resolved promise?
To guarantee consistent ordering ("never release Zalgo"). If callbacks were sometimes sync and sometimes async, code after `.then(...)` might run before *or* after the handler depending on a timing detail invisible to the reader. Always scheduling as a microtask means: the current synchronous code always finishes first, then handlers run in registration order before the browser does anything else (rendering, timers). It also prevents stack overflows in long synchronous chains.
:::

## Challenges

:::challenge
difficulty: hard
companies: Tekion, Meta
### Implement MyPromise with then, catch, finally and static resolve/reject/all
Implement a `MyPromise` class that behaves like the native `Promise` for:

- `new MyPromise((resolve, reject) => ...)` — settles once; executor errors reject.
- `then(onFulfilled, onRejected)` — returns a new promise; supports value pass-through, error pass-through, returning promises/thenables, and throwing.
- Handlers always run asynchronously (microtasks).
- `catch`, `finally` (passes the value through; waits if it returns a promise).
- `MyPromise.resolve`, `MyPromise.reject`, `MyPromise.all` (order preserved, first rejection wins, empty input resolves to `[]`).

Do not use the native `Promise` inside your implementation (you may use `queueMicrotask`).
@@@hint
Store `{ onFulfilled, onRejected, resolve, reject }` for each `then`. When the parent settles, run the right callback in a microtask and feed its return value into the child's `resolve` — and make the child's `resolve` understand thenables.
@@@starter
```js
class MyPromise {
  constructor(executor) {
    // your code
  }
  then(onFulfilled, onRejected) {}
  catch(onRejected) {}
  finally(onFinally) {}
  static resolve(value) {}
  static reject(reason) {}
  static all(iterable) {}
}
```
@@@tests
```js
test('resolves asynchronously', async () => {
  const log = []
  MyPromise.resolve(1).then(v => log.push(v))
  log.push('sync')
  await sleep(10)
  expect(log).toEqual(['sync', 1])
})

test('chains values and adopts returned promises', async () => {
  let out
  new MyPromise(res => setTimeout(() => res(2), 10))
    .then(v => v * 2)
    .then(v => new MyPromise(res => setTimeout(() => res(v + 1), 10)))
    .then(v => { out = v })
  await sleep(60)
  expect(out).toBe(5)
})

test('settles only once', async () => {
  let out
  new MyPromise((res, rej) => { res('a'); res('b'); rej('c') }).then(v => { out = v })
  await sleep(10)
  expect(out).toBe('a')
})

test('executor throw and handler throw become rejections', async () => {
  const seen = []
  new MyPromise(() => { throw new Error('boom') }).catch(e => seen.push(e.message))
  MyPromise.resolve(1).then(() => { throw new Error('later') }).catch(e => seen.push(e.message))
  await sleep(10)
  expect(seen.sort()).toEqual(['boom', 'later'])
})

test('rejection falls through then without onRejected', async () => {
  let out
  MyPromise.reject('x').then(v => 'never').then(v => 'never2').catch(r => { out = r })
  await sleep(10)
  expect(out).toBe('x')
})

test('adopts foreign thenables', async () => {
  let out
  MyPromise.resolve({ then(res) { res(42) } }).then(v => { out = v })
  await sleep(10)
  expect(out).toBe(42)
})

test('finally passes value through', async () => {
  let out, ran = false
  MyPromise.resolve(7).finally(() => { ran = true }).then(v => { out = v })
  await sleep(10)
  expect(ran).toBe(true)
  expect(out).toBe(7)
})

test('all preserves order and rejects fast', async () => {
  let ok, err
  MyPromise.all([
    new MyPromise(r => setTimeout(() => r('slow'), 30)),
    'plain',
    new MyPromise(r => setTimeout(() => r('fast'), 5)),
  ]).then(v => { ok = v })
  MyPromise.all([MyPromise.reject('nope'), new MyPromise(() => {})]).catch(e => { err = e })
  let empty
  MyPromise.all([]).then(v => { empty = v })
  await sleep(60)
  expect(ok).toEqual(['slow', 'plain', 'fast'])
  expect(err).toBe('nope')
  expect(empty).toEqual([])
})
```
@@@solution
```js
const PENDING = 'pending', FULFILLED = 'fulfilled', REJECTED = 'rejected'

class MyPromise {
  constructor(executor) {
    this.state = PENDING
    this.value = undefined
    this.handlers = []
    let done = false
    const resolve = (v) => { if (!done) { done = true; this._resolve(v) } }
    const reject = (r) => { if (!done) { done = true; this._settle(REJECTED, r) } }
    try { executor(resolve, reject) } catch (e) { reject(e) }
  }

  _resolve(x) {
    if (x === this) return this._settle(REJECTED, new TypeError('Chaining cycle'))
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
      let then
      try { then = x.then } catch (e) { return this._settle(REJECTED, e) }
      if (typeof then === 'function') {
        let called = false
        try {
          then.call(x,
            (y) => { if (!called) { called = true; this._resolve(y) } },
            (r) => { if (!called) { called = true; this._settle(REJECTED, r) } })
        } catch (e) {
          if (!called) { called = true; this._settle(REJECTED, e) }
        }
        return
      }
    }
    this._settle(FULFILLED, x)
  }

  _settle(state, value) {
    if (this.state !== PENDING) return
    this.state = state
    this.value = value
    this.handlers.forEach((h) => this._schedule(h))
    this.handlers = []
  }

  _schedule({ onFulfilled, onRejected, resolve, reject }) {
    queueMicrotask(() => {
      const cb = this.state === FULFILLED ? onFulfilled : onRejected
      if (typeof cb !== 'function') {
        return this.state === FULFILLED ? resolve(this.value) : reject(this.value)
      }
      try { resolve(cb(this.value)) } catch (e) { reject(e) }
    })
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const h = { onFulfilled, onRejected, resolve, reject }
      if (this.state === PENDING) this.handlers.push(h)
      else this._schedule(h)
    })
  }

  catch(onRejected) { return this.then(undefined, onRejected) }

  finally(onFinally) {
    return this.then(
      (v) => MyPromise.resolve(onFinally()).then(() => v),
      (r) => MyPromise.resolve(onFinally()).then(() => { throw r }),
    )
  }

  static resolve(v) { return v instanceof MyPromise ? v : new MyPromise((res) => res(v)) }
  static reject(r) { return new MyPromise((_, rej) => rej(r)) }

  static all(iterable) {
    return new MyPromise((resolve, reject) => {
      const items = Array.from(iterable)
      const results = new Array(items.length)
      let remaining = items.length
      if (remaining === 0) return resolve(results)
      items.forEach((item, i) => {
        MyPromise.resolve(item).then((v) => {
          results[i] = v
          if (--remaining === 0) resolve(results)
        }, reject)
      })
    })
  }
}
```

**How it works**

- `done` makes the executor's `resolve`/`reject` one-shot; `_settle` also refuses to change a settled promise.
- `_resolve` is the resolution procedure: cycle check → thenable adoption (with its own `called` guard) → plain fulfil.
- Every `then` creates a child promise and stores the child's `resolve`/`reject` next to the callbacks. When the parent settles, `_schedule` runs the right callback in a microtask and pipes its result into the child. Missing callbacks pass state through — that's how `catch` at the end catches everything.
- `all` writes into `results[i]` (order preserved), counts down `remaining`, and lets the first rejection reject the whole thing (later settlements are ignored because the outer promise is already settled).

**Complexity:** `then` is O(1); settling is O(number of registered handlers).

**Follow-ups to expect:** add `allSettled`, `race`, `any` (with `AggregateError`); what happens with an unhandled rejection (native promises fire `unhandledrejection`; you'd track whether any handler was attached by the end of the microtask checkpoint).
:::

:::challenge
difficulty: medium
companies: Groww, Meta
### Implement Promise.allSettled, Promise.any and Promise.race
Using the **native** `Promise`, implement three standalone functions:

- `allSettled(iterable)` → always fulfils with `[{status:'fulfilled', value} | {status:'rejected', reason}]` in input order.
- `any(iterable)` → fulfils with the first fulfilled value; if all reject, rejects with an `AggregateError` whose `errors` are in input order. Empty input rejects.
- `race(iterable)` → settles like the first input to settle (either way). Empty input stays pending forever.

Non-promise inputs must be accepted.
@@@starter
```js
function allSettled(iterable) {}
function any(iterable) {}
function race(iterable) {}
```
@@@tests
```js
const delay = (v, ms, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(v) : res(v)), ms))

test('allSettled keeps order and shape', async () => {
  const r = await allSettled([delay('a', 20), delay('b', 5, true), 3])
  expect(r).toEqual([
    { status: 'fulfilled', value: 'a' },
    { status: 'rejected', reason: 'b' },
    { status: 'fulfilled', value: 3 },
  ])
})

test('allSettled of empty is []', async () => {
  expect(await allSettled([])).toEqual([])
})

test('any returns first fulfilled', async () => {
  expect(await any([delay('x', 5, true), delay('slow', 30), delay('fast', 10)])).toBe('fast')
})

test('any rejects with AggregateError in input order', async () => {
  let err
  try { await any([delay('e1', 20, true), delay('e2', 5, true)]) } catch (e) { err = e }
  expect(err instanceof AggregateError).toBe(true)
  expect(err.errors).toEqual(['e1', 'e2'])
})

test('race settles with the first, even a rejection', async () => {
  expect(await race([delay('a', 20), delay('b', 5)])).toBe('b')
  let err
  try { await race([delay('ok', 30), delay('bad', 5, true)]) } catch (e) { err = e }
  expect(err).toBe('bad')
})
```
@@@solution
```js
function allSettled(iterable) {
  const items = Array.from(iterable)
  return Promise.all(
    items.map((item) =>
      Promise.resolve(item).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason }),
      ),
    ),
  )
}

function any(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable)
    const errors = new Array(items.length)
    let remaining = items.length
    if (remaining === 0) return reject(new AggregateError([], 'All promises were rejected'))
    items.forEach((item, i) => {
      Promise.resolve(item).then(resolve, (reason) => {
        errors[i] = reason
        if (--remaining === 0) reject(new AggregateError(errors, 'All promises were rejected'))
      })
    })
  })
}

function race(iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) Promise.resolve(item).then(resolve, reject)
  })
}
```

**Key ideas**

- `allSettled` is `Promise.all` over promises that *never reject*: each one is converted into a status object first. Edge cases handled for free: empty input, non-promises, order.
- `any` is the mirror image of `all`: the first **success** wins, and you count down **failures**. Errors are stored by index so `AggregateError.errors` is in input order.
- `race` just forwards the first settlement; later calls to `resolve`/`reject` are no-ops because a promise settles once. With an empty iterable nothing ever calls them → pending forever (matches spec).

**Race vs any (Coinbase question):** `race` = first to *settle* (a fast failure wins); `any` = first to *succeed* (failures are ignored unless all fail). Use `race` for timeouts (`race([fetch(), timeout(5000)])`), `any` for redundant mirrors/CDNs.
:::

:::challenge
difficulty: medium
### Output prediction: promise ordering
What does this log, and why?

```js
console.log('A')
setTimeout(() => console.log('B'), 0)
Promise.resolve()
  .then(() => { console.log('C'); return Promise.resolve('D') })
  .then((v) => console.log(v))
Promise.resolve().then(() => console.log('E')).then(() => console.log('F')).then(() => console.log('G'))
console.log('H')
```
@@@solution
Output:

```text
A
H
C
E
F
G
D
B
```

Step by step:

1. Sync code: `A`, `H`. Timer callback `B` goes to the macrotask queue. Two microtasks are queued: the `C` handler and the `E` handler.
2. Microtask `C` logs `C` and **returns a promise**. Returning a native promise from a `then` handler costs **two extra microtask ticks**: one job to call `Promise.resolve('D').then(...)` (the thenable job), and one for that inner `then` to fire and resolve the outer promise.
3. Meanwhile `E` runs, queues `F`; `F` runs, queues `G`; `G` runs.
4. Only now has the outer promise adopted `'D'`, so `D` logs.
5. Microtask queue empty → event loop takes the next macrotask → `B`.

The takeaway: returning a promise from `then` is not "free" — it delays the chain by two ticks compared to returning a plain value. Interviewers use this to see whether you understand adoption, not just "microtasks before macrotasks".
:::

## Quick check

:::quiz
### What happens if a `then` handler returns the same promise that `then` returned?
- [ ] It resolves with `undefined`
- [x] It rejects with a `TypeError` (chaining cycle)
- [ ] It stays pending forever without error
- [ ] The engine throws synchronously
@@@explain
Resolving a promise with itself would wait forever, so the resolution procedure rejects it with a `TypeError`.
:::

:::quiz
### `p.finally(() => 'x')` where `p` fulfils with 1 — what does the result fulfil with?
- [x] 1
- [ ] 'x'
- [ ] undefined
- [ ] [1, 'x']
@@@explain
`finally` ignores its callback's return value (unless it throws or returns a rejected promise) and passes the original value through.
:::

:::quiz
### Why use `queueMicrotask` instead of `setTimeout(fn, 0)` in a Promise polyfill?
- [ ] `setTimeout` doesn't exist in browsers
- [x] Promise reactions must run before the next macrotask and before rendering, matching native ordering
- [ ] Microtasks run in a separate thread
- [ ] `setTimeout` can't take a function
@@@explain
Native promise jobs are microtasks. Using `setTimeout` would interleave your handlers with timers and rendering, giving different ordering than real promises.
:::
