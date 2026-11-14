---
title: Functions, Arrow Functions & Closures (Intro)
summary: Declarations vs expressions, default/rest/spread, arrow vs normal functions, a first look at `this`, and the closure idea that powers React hooks.
minutes: 18
---

## Functions are values

In JavaScript, functions are **first-class**: they're objects you can store in variables, put in arrays, pass as arguments and return from other functions. That one fact is behind callbacks, event handlers, promises, array methods and React components.

```js
const shout = (s) => s.toUpperCase() + "!"
const actions = [shout, (s) => s + "?"]
function apply(fn, value) { return fn(value) }   // fn is a parameter
apply(shout, "hi") // "HI!"
```

A function that takes or returns a function is a **higher-order function** (`map`, `filter`, `setTimeout`, `addEventListener` are all higher-order).

## Ways to create a function

```js
// 1. Declaration — hoisted with its body
function add(a, b) { return a + b }

// 2. Function expression (can be anonymous or named)
const sub = function (a, b) { return a - b }
const fact = function f(n) { return n <= 1 ? 1 : n * f(n - 1) } // name visible inside only

// 3. Arrow function
const mul = (a, b) => a * b          // implicit return
const square = x => x * x            // one param: parens optional
const makeUser = (name) => ({ name }) // return an object: wrap in ()
const log = () => { console.log("hi") } // block body: needs explicit return

// 4. Method shorthand
const calc = { double(x) { return x * 2 } }
```

## Parameters: defaults, rest, spread

```js
function greet(name = "friend", greeting = `Hello`) {
  return `${greeting}, ${name}`
}
greet()            // "Hello, friend"
greet(undefined, "Hi") // defaults apply only for undefined (not null)

function sum(...nums) {          // rest: collects remaining args into a real array
  return nums.reduce((a, b) => a + b, 0)
}
sum(1, 2, 3) // 6

const values = [4, 5, 6]
Math.max(...values)              // spread: expands an iterable into arguments
const merged = [...values, 7]    // spread into arrays
const clone = { ...{ a: 1 }, b: 2 } // spread into objects
```

Old code used the `arguments` object — array-like, not a real array, and **not available in arrow functions**. Use rest parameters instead.

## Arrow functions vs normal functions

Arrow functions aren't just shorter syntax. They behave differently:

| Feature | Normal function | Arrow function |
|---|---|---|
| Own `this` | Yes — decided by **how** it's called | No — uses `this` of the surrounding scope (lexical) |
| `arguments` object | Yes | No |
| Can be used with `new` | Yes (constructor) | No — TypeError |
| `prototype` property | Yes | No |
| Hoisting | Declarations are hoisted | Follows the variable (`const` → TDZ) |
| Good as object methods | Yes | Usually no |
| Good as callbacks | Need care with `this` | Yes |

### `this` at a beginner level

For a **normal function**, `this` is set at call time:

```js
const user = {
  name: "Asha",
  hello() { return "Hi " + this.name },
}
user.hello()            // "Hi Asha" — called as user.hello → this = user
const fn = user.hello
fn()                    // "Hi undefined" (or TypeError in strict mode) — plain call → this = undefined/window
```

An **arrow function** doesn't have its own `this`; it captures it from where it was *defined*:

```js
const timer = {
  seconds: 0,
  start() {
    setInterval(() => {
      this.seconds++         // `this` is timer, borrowed from start()
    }, 1000)
  },
}
```

With a normal function inside `setInterval`, `this` would be `undefined`/`window`. Before arrows, people wrote `const self = this` or used `.bind(this)`.

The flip side — **don't use arrows as object methods** when you need `this`:

```js
const counter = {
  count: 0,
  inc: () => this.count++, // `this` is the outer scope (module: undefined), NOT counter
}
```

:::callout interview The rules of `this` (preview)
1. `new Fn()` → the new object. 2. `fn.call/apply/bind(obj)` → `obj`. 3. `obj.fn()` → `obj`. 4. plain `fn()` → `undefined` in strict mode (`window` in sloppy). Arrows ignore all four and use the enclosing `this`. FE2 covers this in depth.
:::

## Closures: a first look

A **closure** is a function together with the variables from the scope where it was created. Functions "remember" their birthplace.

```js
function makeCounter() {
  let count = 0              // private variable
  return function () {
    count++
    return count
  }
}

const next = makeCounter()
next() // 1
next() // 2
const other = makeCounter()
other() // 1 — separate closure, separate count
```

After `makeCounter()` returns, its local `count` would normally be garbage-collected. But the returned function still **references** it, so it stays alive. Each call to `makeCounter` creates a fresh scope, hence independent counters.

:::visual scope-chain
:::

Where you already use closures:

- **Event handlers** reading variables from the surrounding function.
- **setTimeout callbacks** (the var-in-loop trap is a closure story).
- **Data privacy** — module pattern, "private" variables.
- **Function factories** — `const add5 = makeAdder(5)`.
- **React hooks** — every render's handlers close over that render's state. That's why "stale closures" exist.

```js
function makeAdder(x) {
  return (y) => x + y
}
const add5 = makeAdder(5)
add5(10) // 15
```

## Pure functions and side effects

A **pure function** returns the same output for the same input and doesn't change anything outside itself. `(a, b) => a + b` is pure; a function that writes to `localStorage`, mutates its argument or reads `Date.now()` is not. Pure functions are easy to test and reason about — React components are expected to be pure with respect to props and state.

## Interview questions

:::question
difficulty: easy
companies: Tekion, Groww
### Difference between arrow functions and normal functions?
- **`this`**: arrows don't have their own `this`; they use the enclosing lexical `this`. Normal functions get `this` from how they are called.
- **`arguments`**: arrows don't have it; use rest params.
- **Constructors**: arrows can't be called with `new` and have no `prototype`.
- **Syntax**: concise body with implicit return.
- **Hoisting**: arrow functions are always expressions, so they aren't hoisted like declarations.

Use arrows for callbacks (especially inside methods, where you want the outer `this`); use normal functions/method shorthand for object methods and anything called with `new`.
:::

:::question
difficulty: easy
companies: Accenture, Groww
### What is a closure? Give a real-world example.
A closure is a function bundled with references to the variables of its lexical scope, so it can access them even after the outer function has returned.

Real-world uses: a `once` or `debounce` utility storing a timer/flag privately; a counter or ID generator with private state; event handlers in a loop capturing the right item; React hooks where handlers close over current props/state.

```js
function createIdGenerator(prefix) {
  let id = 0
  return () => `${prefix}-${++id}`
}
const nextOrderId = createIdGenerator("order")
nextOrderId() // "order-1"
```
:::

:::question
difficulty: easy
### What is a higher-order function?
A function that takes one or more functions as arguments and/or returns a function. Examples: `Array.prototype.map`, `setTimeout`, `addEventListener`, `debounce`, React HOCs. They let you abstract over *behaviour*, not just data.
:::

:::question
difficulty: medium
### What's the difference between rest and spread? They look the same.
Same `...` syntax, opposite jobs. **Rest** appears where values are *received* (function parameters, destructuring) and *collects* many values into one array/object: `function f(...args)`, `const [first, ...others] = arr`. **Spread** appears where values are *provided* (call arguments, array/object literals) and *expands* one iterable/object into many: `f(...arr)`, `[...a, ...b]`, `{...obj}`.
:::

## Challenges

:::challenge
difficulty: easy
companies: Meta
### Implement once(fn)
Return a function that calls `fn` only the first time it is invoked, and returns that first result on every later call.
@@@hint
Store a flag and the result in a closure.
@@@starter
```js
function once(fn) {
  // your code
}
```
@@@tests
```js
test('calls fn only once', () => {
  let calls = 0
  const init = once(() => ++calls)
  init(); init(); init()
  expect(calls).toBe(1)
})
test('returns first result each time', () => {
  const f = once((a, b) => a + b)
  expect(f(1, 2)).toBe(3)
  expect(f(10, 20)).toBe(3)
})
test('preserves this', () => {
  const obj = { v: 7, get: once(function () { return this.v }) }
  expect(obj.get()).toBe(7)
})
```
@@@solution
```js
function once(fn) {
  let called = false
  let result
  return function (...args) {
    if (!called) {
      called = true
      result = fn.apply(this, args) // forward `this` and arguments
    }
    return result
  }
}
```

The returned function closes over `called` and `result`. We use a normal `function` (not an arrow) so the caller's `this` is forwarded via `apply`. Bonus: set `fn = null` after the first call to let it be garbage-collected.
:::

:::challenge
difficulty: easy
### Output: this in arrow vs method
```js
const obj = {
  name: "ladder",
  regular() { return this.name },
  arrow: () => typeof this,
  nested() {
    const inner = () => this.name
    return inner()
  },
}
console.log(obj.regular())
console.log(obj.arrow())
console.log(obj.nested())
const r = obj.regular
console.log(r?.call({ name: "other" }))
```
(Assume this runs as an ES module.)
@@@solution
```text
ladder
undefined
ladder
other
```

- `obj.regular()` — method call, `this` is `obj`.
- `arrow` takes `this` from module scope, which is `undefined`, so `typeof this` is `"undefined"`.
- `inner` is an arrow defined inside `nested`, so it borrows `nested`'s `this` (`obj`).
- `.call` sets `this` explicitly for a normal function.
:::

:::challenge
difficulty: easy
### Build a private counter with closures
Write `createCounter(start = 0)` that returns `{ increment, decrement, reset, value }` where `value()` returns the current count. The count must not be accessible directly.
@@@starter
```js
function createCounter(start = 0) {
  // your code
}
```
@@@tests
```js
test('counts', () => {
  const c = createCounter(5)
  c.increment(); c.increment(); c.decrement()
  expect(c.value()).toBe(6)
  c.reset()
  expect(c.value()).toBe(5)
})
test('is private and independent', () => {
  const a = createCounter(); const b = createCounter()
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
    reset: () => (count = start),
    value: () => count,
  }
}
```
All four functions share one closure over `count`. Each `createCounter` call creates a new scope, so counters are independent. This is the classic **module pattern**.
:::

:::quiz
### What does an arrow function use as `this`?
- [ ] The object it's called on
- [ ] Always `window`
- [x] The `this` of the scope where it was defined
- [ ] A new empty object
@@@explain
Arrows have lexical `this` — they don't bind their own.
:::

:::quiz
### What can a closure access after its outer function has returned?
- [ ] Nothing — locals are destroyed
- [x] The outer function's variables it references
- [ ] Only global variables
- [ ] Only its own parameters
@@@explain
References from the inner function keep the outer variables alive.
:::
