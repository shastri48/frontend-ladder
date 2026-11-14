---
title: Promises & async/await
summary: Promise states, chaining, error handling, running things in parallel, and writing clean async/await with try/catch.
minutes: 18
---

## What is a Promise?

A **Promise** is an object representing a value that will be available **later** — or an error explaining why it won't be. It's an IOU.

:::callout analogy The buzzer at a food court
You order and get a buzzer (the promise). You can walk away and do other things. Eventually it buzzes — your food is ready (**fulfilled**) — or the counter tells you they're out of stock (**rejected**). A buzzer only goes off once.
:::

### The three states

```text
                ┌──── resolve(value) ───► FULFILLED (value)
   PENDING ─────┤
                └──── reject(reason) ───► REJECTED  (reason)
```

- **pending** — initial state, not done yet.
- **fulfilled** — finished successfully, has a **value**.
- **rejected** — failed, has a **reason** (usually an `Error`).

Once fulfilled or rejected, a promise is **settled** and **can never change again**. Calling `resolve` twice, or `reject` after `resolve`, does nothing.

## Creating promises

Most of the time you *consume* promises (`fetch` returns one). To create one, wrap a callback-based operation:

```js
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}
```

The function you pass to `new Promise` (the **executor**) runs **synchronously, immediately**. Only the `.then` callbacks are async.

Shortcuts: `Promise.resolve(value)` and `Promise.reject(error)` create already-settled promises.

## Consuming: then, catch, finally

```js
loadImage("/logo.png")
  .then((img) => {
    document.body.append(img)
    return img.width          // value passed to the next .then
  })
  .then((width) => console.log("width", width))
  .catch((err) => console.error(err))   // catches errors from ANY step above
  .finally(() => hideSpinner())         // runs either way, no args
```

### Chaining is the superpower

Every `.then()` returns a **new promise** that resolves to whatever its callback returns:

- Return a **value** → next `.then` gets that value.
- Return a **promise** → the chain waits for it, and the next `.then` gets its result.
- **Throw** → the chain jumps to the next `.catch`.

```js
fetch("/api/user")
  .then((res) => res.json())               // returns a promise → chain waits
  .then((user) => fetch(`/api/orders/${user.id}`))
  .then((res) => res.json())
  .then((orders) => console.log(orders))
  .catch(console.error)
```

Flat, not nested — that's how promises cure callback hell.

:::callout warn Always return inside then
`.then(() => { fetch(url) })` (with braces and no `return`) starts the fetch but the chain doesn't wait for it, and its errors aren't caught. With braces you must write `return fetch(url)`.
:::

## async/await

`async/await` is **syntax sugar over promises** that lets you write async code that reads top-to-bottom.

- An `async` function **always returns a promise**. `return x` resolves it with `x`; `throw e` rejects it.
- `await promise` **pauses that function** (not the whole thread!) until the promise settles, then gives you the value — or throws the rejection reason.

```js
async function showOrders() {
  try {
    showSpinner()
    const userRes = await fetch("/api/user")
    const user = await userRes.json()
    const ordersRes = await fetch(`/api/orders/${user.id}`)
    const orders = await ordersRes.json()
    render(orders)
  } catch (err) {
    showError(err.message)
  } finally {
    hideSpinner()
  }
}
```

While `showOrders` is paused at an `await`, the rest of the page keeps working — the event loop runs other tasks.

### Promises vs async/await

| | `.then()` chains | `async/await` |
|---|---|---|
| Underlying mechanism | Promises | Promises (same thing) |
| Readability | Good for short pipelines | Reads like sync code |
| Errors | `.catch()` | `try/catch` |
| Conditionals / loops | Awkward | Natural (`if`, `for`) |
| Top level | Anywhere | `await` needs an `async` function (or ES module top level) |

They're interchangeable — you can `await` any promise and `.then()` the result of any async function.

## Sequential vs parallel

A very common mistake is awaiting independent requests one after the other:

```js
// Sequential: ~2 seconds if each takes 1s
const user = await getUser()
const settings = await getSettings()

// Parallel: ~1 second
const [user2, settings2] = await Promise.all([getUser(), getSettings()])
```

`Promise.all` starts nothing itself — the promises are already running once you call the functions. It waits for all to fulfill and gives an array **in the same order** as the input. If **any** rejects, it rejects immediately with that error.

Other combinators (detailed in FE2):

| Method | Resolves when | Rejects when |
|---|---|---|
| `Promise.all` | all fulfill (array of values) | any rejects |
| `Promise.allSettled` | all settle (array of `{status, value/reason}`) | never |
| `Promise.race` | first settles (fulfill or reject) | first settles with reject |
| `Promise.any` | first fulfills | all reject (`AggregateError`) |

## Error handling pitfalls

- **Unhandled rejections** — a rejected promise with no `.catch` triggers an `unhandledrejection` event and a console error. Always handle.
- **`forEach` doesn't wait** — `arr.forEach(async x => await save(x))` fires all and returns immediately. Use `for...of` (sequential) or `Promise.all(arr.map(...))` (parallel).
- **`try/catch` only catches awaited promises** — `try { fetchData() } catch {}` without `await` won't catch the rejection.

```js
// ❌ doesn't wait
items.forEach(async (item) => await save(item))
console.log("done?") // logs before saves finish

// ✅ sequential
for (const item of items) await save(item)

// ✅ parallel
await Promise.all(items.map(save))
```

## Interview questions

:::question
difficulty: easy
companies: Groww
### Compare and contrast Promises and async/await
Both handle asynchronous results; `async/await` is syntactic sugar built on promises. Promise chains use `.then/.catch/.finally` and are good for simple pipelines and combinators. `async/await` lets you write the same flow top-to-bottom using normal control flow (`if`, loops) and `try/catch`. An `async` function always returns a promise; `await` pauses only that function until the promise settles. Under the hood, the code after `await` runs as a microtask continuation. For parallelism you still use `Promise.all` with either style.
:::

:::question
difficulty: easy
### What are the states of a Promise?
`pending`, `fulfilled` and `rejected`. A promise starts pending and settles exactly once into fulfilled (with a value) or rejected (with a reason). Once settled it's immutable — later `resolve`/`reject` calls are ignored.
:::

:::question
difficulty: medium
companies: Intuit
### What does `Promise.resolve()` do with a non-promise value? And with a promise?
With a non-promise value (`Promise.resolve(5)`) it returns a promise already fulfilled with that value. With a native promise it returns **the same promise** (`Promise.resolve(p) === p`). With a "thenable" (an object with a `then` method) it adopts its state by calling `then`. This is how `await 5` works — the value is wrapped with `Promise.resolve`.
:::

:::question
difficulty: medium
### Does the Promise executor run synchronously?
Yes. `new Promise(executor)` calls `executor(resolve, reject)` immediately and synchronously. Only the reactions (`.then`/`.catch` callbacks) are asynchronous — they're queued as microtasks when the promise settles.
```js
console.log(1)
new Promise((r) => { console.log(2); r() }).then(() => console.log(4))
console.log(3)
// 1 2 3 4
```
:::

## Challenges

:::challenge
difficulty: medium
### Output: promise chain values
```js
Promise.resolve(1)
  .then((x) => x + 1)
  .then((x) => { throw new Error("boom " + x) })
  .then((x) => console.log("never", x))
  .catch((e) => { console.log(e.message); return 10 })
  .then((x) => console.log("after catch", x))
  .finally(() => console.log("finally"))
```
@@@solution
```text
boom 2
after catch 10
finally
```
`1 → 2`, then throw rejects the chain; the next `.then` is skipped; `.catch` handles it and **returns 10**, which turns the chain back into a fulfilled one; the next `.then` receives 10; `finally` runs at the end.
:::

:::challenge
difficulty: easy
### Implement sleep and a timeout wrapper
1. `sleep(ms)` returns a promise that resolves after `ms`.
2. `withTimeout(promise, ms)` resolves/rejects like `promise`, but rejects with `Error("Timeout")` if it takes longer than `ms`.
@@@starter
```js
function sleep(ms) {
  // your code
}
function withTimeout(promise, ms) {
  // your code
}
```
@@@tests
```js
test('sleep waits', async () => {
  const t = Date.now()
  await sleep(50)
  expect(Date.now() - t).toBeGreaterThan(40)
})
test('withTimeout resolves fast promise', async () => {
  expect(await withTimeout(Promise.resolve('ok'), 50)).toBe('ok')
})
test('withTimeout rejects slow promise', async () => {
  let msg = ''
  try { await withTimeout(sleep(200), 30) } catch (e) { msg = e.message }
  expect(msg).toBe('Timeout')
})
```
@@@solution
```js
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
```
`Promise.race` settles with whichever settles first. Clearing the timer in `finally` avoids leaving a pending timer around. Note: the original operation keeps running — to truly cancel a `fetch`, use an `AbortController` (FE2).
:::

:::challenge
difficulty: medium
### Retry a failing async function
Write `retry(fn, retries)` that calls async `fn()`; if it rejects, try again up to `retries` more times; resolve with the first success or reject with the last error.
@@@starter
```js
async function retry(fn, retries) {
  // your code
}
```
@@@tests
```js
test('succeeds after failures', async () => {
  let attempts = 0
  const flaky = async () => { attempts++; if (attempts < 3) throw new Error('fail'); return 'ok' }
  expect(await retry(flaky, 3)).toBe('ok')
  expect(attempts).toBe(3)
})
test('gives up', async () => {
  let attempts = 0
  const bad = async () => { attempts++; throw new Error('fail ' + attempts) }
  let msg = ''
  try { await retry(bad, 2) } catch (e) { msg = e.message }
  expect(msg).toBe('fail 3')
  expect(attempts).toBe(3)
})
```
@@@solution
```js
async function retry(fn, retries) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()           // `return await` so the catch below sees rejections
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
```
Total calls = 1 + retries. Note `return await` inside `try` — plain `return fn()` would skip the `catch`. In production add **exponential backoff** (`await sleep(2 ** attempt * 100)`), jitter, and only retry on retryable errors (network/5xx, not 4xx). FE2 covers the advanced version.
:::

:::quiz
### What does an async function return?
- [ ] Whatever you return, directly
- [x] Always a Promise
- [ ] undefined
- [ ] A generator
@@@explain
Return values are wrapped in a resolved promise; thrown errors become rejections.
:::

:::quiz
### Two independent requests, fastest way to get both?
- [ ] await a; await b
- [x] await Promise.all([a(), b()])
- [ ] a().then(b)
- [ ] arr.forEach(async ...)
@@@explain
Start both, then wait for both together.
:::
