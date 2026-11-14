---
title: Closures in Depth
summary: How functions remember the scope they were born in, why the var-in-setTimeout trap happens, and where closures power real code (private state, once, memoization, React hooks).
minutes: 18
---

## The one-sentence definition

A **closure** is a function together with a reference to the lexical environment it was created in. Because the function keeps that reference, it can read and update the outer variables **even after the outer function has returned**.

Every function in JavaScript is a closure. We only *notice* it when a function outlives the scope that created it.

:::callout analogy A backpack
When a function is created, it packs a backpack containing a pointer to its surrounding scope. Wherever the function travels — returned, passed as a callback, stored in an object — it carries that backpack. It doesn't pack *copies* of the variables; it packs a link to the live variables.
:::

## How it works internally

From the execution-context lesson: each function call creates a lexical environment, and each function object stores an internal `[[Environment]]` slot pointing to the environment where it was **defined**.

```js
function makeCounter() {
  let count = 0              // lives in makeCounter's environment
  return function increment() {
    count += 1               // looked up via increment.[[Environment]]
    return count
  }
}

const counter = makeCounter() // makeCounter's EC is popped off the stack...
counter() // 1                 // ...but its environment is still reachable
counter() // 2
```

Normally, when a function returns, its environment becomes unreachable and the garbage collector frees it. Here, `increment.[[Environment]]` still points to it, so it stays alive. That's the whole trick.

:::visual scope-chain
:::

```text
counter ──► increment function object
              [[Environment]] ──► { count: 2 }   (makeCounter call #1)
                                       outer ──► Global { makeCounter, counter }
```

### Each call creates a new environment

```js
const a = makeCounter()
const b = makeCounter()
a(); a()     // 1, 2
b()          // 1  — separate `count`
```

### Closures capture variables, not values

```js
function make() {
  let x = 1
  const get = () => x
  x = 2
  return get
}
make()() // 2, not 1
```

The closure sees the variable's **current** value at the time it reads it.

## The classic `var` in `setTimeout` trap

This is probably the most-asked closure question (CRED, Accenture and nearly everyone else).

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100)
}
// 3 3 3
```

Why:

1. `var i` is function-scoped — there is **one** `i` for the whole loop.
2. The three arrow functions all close over that same `i`.
3. The callbacks run ~100ms later, after the loop finished and `i === 3`.

### Three fixes

```js
// 1. let: a fresh binding per iteration
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100) // 0 1 2
}

// 2. IIFE: create a new scope per iteration (pre-ES6 solution)
for (var i = 0; i < 3; i++) {
  ;(function (j) {
    setTimeout(() => console.log(j), 100)
  })(i)
}

// 3. Pass the value as an argument to setTimeout
for (var i = 0; i < 3; i++) {
  setTimeout((j) => console.log(j), 100, i)
}
```

`let` in a `for` header is special: the spec copies the binding into a new environment for each iteration, so each closure gets its own `i`.

## Real-world uses

### 1. Private state (module pattern / data hiding)

```js
function createBankAccount(initial) {
  let balance = initial // truly private: no way to reach it from outside
  return {
    deposit(amount) { balance += amount; return balance },
    withdraw(amount) {
      if (amount > balance) throw new Error('Insufficient funds')
      balance -= amount
      return balance
    },
    get balance() { return balance },
  }
}
const acc = createBankAccount(100)
acc.deposit(50) // 150
acc.balance     // 150
acc.balance = 0 // ignored (getter only)
```

Modern classes have `#private` fields, but closures were (and still are) the classic way.

### 2. `once`

```js
function once(fn) {
  let called = false
  let result
  return function (...args) {
    if (!called) {
      called = true
      result = fn.apply(this, args)
    }
    return result
  }
}
const init = once(() => console.log('init!'))
init(); init() // logs once
```

### 3. Memoization

```js
function memoize(fn) {
  const cache = new Map() // survives between calls thanks to the closure
  return function (n) {
    if (cache.has(n)) return cache.get(n)
    const value = fn(n)
    cache.set(n, value)
    return value
  }
}
```

### 4. Function factories and partial application

```js
const multiplier = (factor) => (n) => n * factor
const double = multiplier(2)
const triple = multiplier(3)
double(5) // 10
```

### 5. Debounce / throttle

Timers need to remember the pending `timeoutId` between calls — that's a closure. (See the polyfills module.)

### 6. React hooks

`useState`, `useEffect` and event handlers are closures over the **props and state of the render they were created in**. That's both why hooks work and why **stale closures** happen:

```jsx
function Timer() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1) // `count` is always 0 here — stale closure!
    }, 1000)
    return () => clearInterval(id)
  }, []) // effect created once, closes over render #1's count
  return <p>{count}</p>
}
```

The fix is a functional update `setCount(c => c + 1)` (doesn't need to read `count`), or include `count` in deps, or read from a `useRef`. CRED explicitly asks "what a stale closure looks like inside setInterval".

## Closures and memory

Because closures keep environments alive, they can keep **large objects** alive unintentionally:

```js
function attach() {
  const hugeData = new Array(1e6).fill('*')
  document.getElementById('btn').addEventListener('click', () => {
    console.log('clicked') // doesn't even use hugeData...
  })
}
```

Modern engines (V8) only keep variables that some inner function actually references, so `hugeData` here *can* be collected. But if *any* closure created in that scope references `hugeData`, it's retained as long as *any* closure from that scope lives (they share one environment). Remove listeners and clear timers when you're done.

## Interview questions

:::question
difficulty: easy
companies: Accenture, Groww, Tekion
### What is a closure, and how does it retain access to its lexical scope?
A closure is a function bundled with a reference to the environment in which it was defined. Every function object has an internal `[[Environment]]` pointer set at creation time. When the function runs, variable lookups go through that pointer, so it can read and write outer variables even after the outer function has returned — the environment stays alive because the function still references it (garbage collection only frees unreachable environments).

Real uses: private state, factories, `once`, memoization, debounce/throttle, event handlers and React hooks.

**In an interview, say:** "A function remembers the scope it was created in, not the scope it's called from. Closures capture live variables by reference, which is why `var` in a loop shares one variable but `let` gives each iteration its own."
:::

:::question
difficulty: medium
companies: CRED
### Explain the classic `var`-in-`setTimeout` trap and every way to fix it.
`for (var i = 0; i < 3; i++) setTimeout(() => console.log(i))` logs `3 3 3` because `var` creates one function-scoped `i` that every callback closes over, and the callbacks run after the loop ends.

Fixes: use `let` (new binding per iteration); wrap the body in an IIFE taking `i` as a parameter; pass `i` as the third argument of `setTimeout`; or use `.forEach((_, i) => ...)` which naturally creates a scope per call.
:::

:::question
difficulty: medium
companies: CRED
### What is a stale closure in React and how do you fix it?
A stale closure is a callback that captured state/props from an earlier render and keeps using those old values. Common in `setInterval`, event listeners added in `useEffect(..., [])`, and debounced callbacks.

Fixes:
1. **Functional updates** — `setCount(c => c + 1)` doesn't need the captured value.
2. **Correct dependencies** — include the value in the effect's deps so the effect (and closure) is recreated.
3. **Refs** — keep the latest value in `useRef` and read `ref.current` inside the long-lived callback.
4. `useEffectEvent` (React 19.2+) for event-like logic inside effects that should always see the latest props/state.
:::

:::question
difficulty: medium
### Can closures cause memory leaks? How?
Yes — a closure keeps its whole environment reachable. Leaks happen when a long-lived thing (global, DOM listener, timer, cache, subscription) holds a closure that references large data or detached DOM nodes. Typical patterns: listeners never removed, `setInterval` never cleared, caches that grow forever, closures stored on module-level arrays. Fix by cleaning up (removeEventListener, clearInterval, unsubscribe, effect cleanup) and using `WeakMap`/`WeakRef` for caches keyed by objects.
:::

## Challenges

:::challenge
difficulty: easy
### What gets logged?
```js
function outer() {
  let n = 0
  return {
    inc: () => ++n,
    get: () => n,
  }
}
const a = outer()
const b = outer()
a.inc(); a.inc(); b.inc()
console.log(a.get(), b.get())
```
@@@solution
```text
2 1
```
Each call to `outer()` creates a fresh environment with its own `n`. `a.inc` and `a.get` share the first one, `b`'s functions share the second.
:::

:::challenge
difficulty: medium
companies: CRED
### What gets logged, and when?
```js
for (var i = 1; i <= 3; i++) {
  setTimeout(function () {
    console.log(i)
  }, i * 100)
}
```
@@@solution
```text
4   (at ~100ms)
4   (at ~200ms)
4   (at ~300ms)
```
The delays use `i` **at scheduling time** (1, 2, 3 → 100, 200, 300ms) because `i * 100` is evaluated immediately in the loop. But the callbacks read `i` **later**, after the loop finished. The loop exits when `i <= 3` fails, i.e. at `i === 4`. Change `var` to `let` to log 1, 2, 3.
:::

:::challenge
difficulty: medium
### What gets logged?
```js
let x = 'global'
function makeLogger() {
  return () => console.log(x)
}
const log = makeLogger()
x = 'changed'
log()
{
  let x = 'block'
  log()
}
```
@@@solution
```text
changed
changed
```
The closure captures the **variable** `x` in the global scope (not a snapshot), so it sees `'changed'`. The block's `x` is a different variable; `log`'s scope chain was fixed where it was written, so the block's shadowing doesn't affect it (lexical, not dynamic, scope).
:::

:::challenge
difficulty: easy
### Build a counter factory with private state
Write `createCounter(start = 0)` returning `{ increment, decrement, reset, value }` where `value()` returns the current count and `reset()` goes back to `start`. The count must not be accessible directly.
@@@starter
```js
function createCounter(start = 0) {
  // your code
}
```
@@@tests
```js
test('increments and decrements', () => {
  const c = createCounter(5)
  c.increment(); c.increment(); c.decrement()
  expect(c.value()).toBe(6)
})
test('reset goes back to start', () => {
  const c = createCounter(2)
  c.increment()
  c.reset()
  expect(c.value()).toBe(2)
})
test('counters are independent and private', () => {
  const a = createCounter()
  const b = createCounter()
  a.increment()
  expect(a.value()).toBe(1)
  expect(b.value()).toBe(0)
  expect(a.count).toBe(undefined)
})
```
@@@solution
```js
function createCounter(start = 0) {
  let count = start
  return {
    increment: () => ++count,
    decrement: () => --count,
    reset: () => { count = start; return count },
    value: () => count,
  }
}
```
`count` lives in the environment of the `createCounter` call; only the four returned closures can reach it. Each call creates a fresh environment, so counters are independent.
:::

:::challenge
difficulty: medium
### Fix the loop without using `let`
Make `createHandlers()` return an array of 3 functions where `handlers[i]()` returns `i`, using `var` in the loop (you may not change it to `let`).
@@@starter
```js
function createHandlers() {
  var handlers = []
  for (var i = 0; i < 3; i++) {
    handlers.push(function () { return i })
  }
  return handlers
}
```
@@@tests
```js
test('each handler returns its own index', () => {
  const h = createHandlers()
  expect(h[0]()).toBe(0)
  expect(h[1]()).toBe(1)
  expect(h[2]()).toBe(2)
})
```
@@@solution
```js
function createHandlers() {
  var handlers = []
  for (var i = 0; i < 3; i++) {
    handlers.push(
      (function (j) {
        return function () { return j }
      })(i)
    )
  }
  return handlers
}
```
The IIFE is invoked immediately with the current `i`, creating a new scope whose parameter `j` holds that iteration's value. The returned function closes over `j`, not the shared `i`.
:::

## Quick check

:::quiz
### A closure captures…
- [ ] A copy of each outer variable's value at creation time
- [x] A live reference to the outer environment (variables, not values)
- [ ] Only the variables passed as arguments
- [ ] The call stack at creation time
@@@explain
Closures reference the environment record, so later changes to those variables are visible.
:::

:::quiz
### Why does `for (let i...)` with setTimeout log 0, 1, 2?
- [ ] `let` is not hoisted
- [x] Each iteration gets a new binding of `i`
- [ ] setTimeout copies its closure's variables
- [ ] `let` variables are stored on the stack
@@@explain
The spec creates a fresh per-iteration environment for `let` in a `for` loop header, so each closure sees its own `i`.
:::
