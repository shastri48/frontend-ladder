---
title: Sync vs Async & Callbacks
summary: Why JavaScript needs async code, how callbacks work, what callback hell is, and a first friendly look at the event loop.
minutes: 14
---

## One thread, many jobs

JavaScript in the browser runs your code on **one main thread**. That thread also handles rendering and user input. If your code takes 3 seconds, the page is frozen for 3 seconds — no clicks, no scrolling, no animations.

But apps constantly wait on slow things: network requests, timers, reading files, user clicks. If JavaScript *waited* (blocked) for each of these, every page would freeze constantly.

The solution is **asynchronous** programming: start the slow operation, hand it off to the browser, keep running other code, and get **called back** when the result is ready.

:::callout analogy The restaurant
A synchronous waiter takes your order, walks to the kitchen, **stands there** until the food is cooked, brings it, and only then serves the next table. An asynchronous waiter hands the order to the kitchen and serves other tables; when the kitchen rings the bell, the waiter brings your food. JavaScript is one waiter. The kitchen is the browser (network stack, timers).
:::

## Synchronous vs asynchronous functions

**Synchronous** code runs line by line; each line finishes before the next starts:

```js
console.log("1")
const total = [1, 2, 3].reduce((a, b) => a + b) // runs right now
console.log("2", total)
```

**Asynchronous** code starts something now and finishes later:

```js
console.log("A")
setTimeout(() => console.log("B"), 0)
console.log("C")
// A, C, B
```

Even with a 0 ms delay, `B` prints last. `setTimeout` doesn't run the callback — it asks the browser to **queue** it after at least 0 ms. The queue is only processed once the current code has finished.

| | Synchronous | Asynchronous |
|---|---|---|
| Returns | The result | Immediately — result comes later (callback/promise) |
| Blocks the thread? | Yes, while running | No, while waiting |
| Examples | Math, array methods, `JSON.parse` | `setTimeout`, `fetch`, events, `FileReader` |

### Blocking the main thread

```js
button.addEventListener("click", () => {
  const end = Date.now() + 3000
  while (Date.now() < end) {} // busy loop — UI frozen for 3s, spinners stop
})
```

Heavy CPU work is still synchronous even inside an async function. To keep the UI responsive, break the work into chunks or move it to a **Web Worker** (FE3).

## A first look at the event loop

How does "later" actually work? Three pieces:

1. **Call stack** — where your functions run, one at a time.
2. **Web APIs** — browser features (timers, network, DOM events) that work *outside* the JS thread.
3. **Task queue** — callbacks waiting to run when their operation is done.

The **event loop** is a simple rule: *when the call stack is empty, take the next callback from the queue and run it.*

:::visual event-loop
:::

Walking through `A, C, B`:

1. `console.log("A")` runs on the stack → prints A.
2. `setTimeout` hands the callback to the browser's timer and returns immediately.
3. `console.log("C")` → prints C. The script finishes; the stack is empty.
4. The timer is done, so its callback is waiting in the queue. The event loop moves it to the stack → prints B.

(In FE2 you'll learn there are actually two queues — microtasks for promises and macrotasks for timers — and exactly how they're prioritised.)

## Callbacks

A **callback** is a function you pass to another function to be called later. Callbacks aren't inherently async — `[1,2].map(cb)` calls it synchronously — but they were JavaScript's original async mechanism:

```js
function loadUser(id, callback) {
  setTimeout(() => {
    callback(null, { id, name: "Asha" })   // Node-style: (error, result)
  }, 500)
}

loadUser(1, (err, user) => {
  if (err) return console.error(err)
  console.log(user.name)
})
```

The **error-first callback** convention `(err, result)` comes from Node.js: always check the error before using the result.

## Callback hell

When async steps depend on each other, callbacks nest:

```js
getUser(userId, (err, user) => {
  if (err) return handle(err)
  getOrders(user.id, (err, orders) => {
    if (err) return handle(err)
    getOrderDetails(orders[0].id, (err, details) => {
      if (err) return handle(err)
      getShipping(details.shippingId, (err, shipping) => {
        if (err) return handle(err)
        render(user, orders, details, shipping)
      })
    })
  })
})
```

This "pyramid of doom" has real problems beyond looks:

- **Readability** — logic flows rightward and is hard to follow.
- **Error handling** — must be repeated at every level; easy to forget one.
- **Inversion of control** — you trust a third-party function to call your callback exactly once, not twice, not never, not synchronously sometimes.
- **Composition** — running things in parallel and waiting for all of them, or adding timeouts, is clumsy.

Promises (next lesson) fix these by giving async results a **value** you can return, chain and combine. `async/await` then makes that chain read like synchronous code:

```js
try {
  const user = await getUser(userId)
  const orders = await getOrders(user.id)
  const details = await getOrderDetails(orders[0].id)
  const shipping = await getShipping(details.shippingId)
  render(user, orders, details, shipping)
} catch (err) {
  handle(err) // one place for all errors
}
```

## Interview questions

:::question
difficulty: easy
companies: Accenture
### Difference between synchronous and asynchronous functions?
A synchronous function runs to completion and returns its result before the next line executes; while it runs, the thread is blocked. An asynchronous function starts an operation and returns immediately (often a Promise), and the result is delivered later via a callback, promise resolution, or event — leaving the thread free for other work like rendering and user input. JavaScript is single-threaded, so async I/O is how it stays responsive.
:::

:::question
difficulty: easy
companies: Accenture
### What is callback hell, and how do Promises or async/await solve it?
Callback hell is deeply nested callbacks needed to sequence dependent async operations. It hurts readability, forces repetitive error handling at each level, and hands control of your continuation to other code (inversion of control).

Promises represent a future value as an object: you can `return` and **chain** with `.then()`, handle all errors once with `.catch()`, and combine with `Promise.all`. A promise settles only once, fixing "called twice / never" issues. `async/await` is syntax over promises that lets you write the sequence top-to-bottom with `try/catch`.
:::

:::question
difficulty: easy
### Is JavaScript single-threaded? Then how does async work?
The JavaScript engine executes your code on a single thread with one call stack. Async works because the **host environment** (the browser or Node) provides APIs — timers, networking, I/O — that run outside that thread. When they finish, they queue callbacks; the **event loop** runs each queued callback once the call stack is empty.
:::

:::question
difficulty: easy
### Why does `setTimeout(fn, 0)` not run immediately?
`setTimeout` only schedules `fn` as a task after *at least* the given delay. Tasks run only when the call stack is empty and after pending microtasks (promise callbacks). So all remaining synchronous code runs first. Browsers also clamp nested timers to ≥ 4ms.
:::

## Challenges

:::challenge
difficulty: easy
### Output: setTimeout ordering
```js
console.log(1)
setTimeout(() => console.log(2), 100)
setTimeout(() => console.log(3), 0)
console.log(4)
setTimeout(() => console.log(5), 0)
```
@@@solution
```text
1
4
3
5
2
```
Synchronous logs (1, 4) first. Then timers in order of expiry: the two 0ms timers in the order they were scheduled (3, 5), then the 100ms one (2).
:::

:::challenge
difficulty: medium
### Promisify a callback API
Write `promisify(fn)` that converts a Node-style function `fn(...args, callback(err, result))` into one that returns a Promise.
@@@starter
```js
function promisify(fn) {
  // your code
}
```
@@@tests
```js
function add(a, b, cb) { setTimeout(() => cb(null, a + b), 10) }
function fail(cb) { setTimeout(() => cb(new Error('nope')), 10) }

test('resolves with result', async () => {
  const addAsync = promisify(add)
  expect(await addAsync(2, 3)).toBe(5)
})
test('rejects with error', async () => {
  const failAsync = promisify(fail)
  let msg = ''
  try { await failAsync() } catch (e) { msg = e.message }
  expect(msg).toBe('nope')
})
```
@@@solution
```js
function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
  }
}
```
We append our own callback to the arguments and translate `(err, result)` into `reject`/`resolve`. Using `fn.call(this, …)` preserves `this` for methods. Node ships this as `util.promisify`.
:::

:::quiz
### What does the event loop do?
- [ ] Runs JavaScript on multiple threads
- [x] Moves queued callbacks onto the call stack when it's empty
- [ ] Speeds up synchronous loops
- [ ] Executes timers exactly on time
@@@explain
It waits for an empty stack and then runs the next queued task.
:::

:::quiz
### Which statement about callbacks is true?
- [ ] Callbacks are always asynchronous
- [x] A callback is any function passed to another function to be called by it
- [ ] Callbacks can't handle errors
- [ ] Callbacks are deprecated
@@@explain
`map`'s callback is synchronous; `setTimeout`'s is async. Callback just means "passed in to be called".
:::
