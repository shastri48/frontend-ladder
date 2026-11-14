---
title: Functional Utilities — memoize, curry, once, pipe & method chaining
summary: Higher-order functions that show off closures — caching results, currying (including the infinite sum(1)(2)(3)() puzzle), run-once wrappers, composition and fluent chaining APIs.
minutes: 18
---

## Higher-order functions

A **higher-order function** either takes functions as arguments or returns a function. Every utility in this lesson is one — and all of them work because of **closures**: the returned function remembers state (a cache, a flag, collected arguments) between calls.

> "React hooks? Built on closures. State management? Event patterns. API optimisation? Debounce and throttle." — these utilities are the building blocks of every framework you use.

## memoize

Memoization caches a function's result for given inputs so repeated calls are instant. It trades **memory for speed** and only works correctly for **pure** functions (same input → same output, no side effects).

```text
fib(40) without memo: ~330 million calls
fib(40) with memo:    41 calls
```

Design decisions interviewers probe:

| Question | Options |
|---|---|
| What's the cache key? | Single primitive arg → use it directly. Multiple args → `JSON.stringify(args)` (slow, breaks for functions/cycles) or a custom `resolver`, or a nested `Map` trie keyed by each argument (supports object identity). |
| Unbounded growth? | Add LRU eviction / max size / TTL; `WeakMap` for object keys. |
| `this`? | Use `fn.apply(this, args)`. |
| Async functions? | Cache the **promise** so concurrent calls dedupe; delete it on rejection so failures aren't cached. |

React's `useMemo`, `React.memo` and reselect selectors are all memoization with a cache size of one.

## curry

**Currying** transforms `f(a, b, c)` into `f(a)(b)(c)`. A practical curry accepts any grouping: `f(a, b)(c)`, `f(a)(b, c)`… and calls the original once it has collected `fn.length` arguments.

```js
const add3 = (a, b, c) => a + b + c
const curried = curry(add3)
curried(1)(2)(3)   // 6
curried(1, 2)(3)   // 6
curried(1)(2, 3)   // 6
```

Use cases: partial application (`const getById = curry(fetchEntity)('users')`), point-free composition, configuring functions step by step.

### The infinite curry: `sum(1)(2)(3)()`

Asked in Senior React rounds. There's no fixed arity — keep collecting until called with **no arguments**:

```js
function sum(a) {
  return function next(b) {
    if (b === undefined) return a
    return sum(a + b)
  }
}
sum(1)(2)(3)() // 6
```

Variant without the trailing `()`: return a function whose `valueOf`/`toString` returns the total, so `+sum(1)(2)(3)` or template literals work. Mention it, but it's hacky.

## once

Runs the wrapped function only on the first call; later calls return the first result. Useful for initialisation (analytics SDK, websocket connection), "submit once" buttons, lazy singletons.

## pipe & compose

- `compose(f, g, h)(x)` = `f(g(h(x)))` — right to left (math notation; Redux's `compose`).
- `pipe(f, g, h)(x)` = `h(g(f(x)))` — left to right, reads like a pipeline.

```js
const slugify = pipe(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/[^a-z0-9]+/g, '-'),
)
slugify('  Hello World! ') // "hello-world-"
```

Both are a single `reduce` over the functions.

## sleep

```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
await sleep(500)
```

Promisifying a callback API is the core idea behind `util.promisify` too.

## Method chaining (fluent APIs)

`calculate.add(2).mul(4).subs(1).value` — each method returns **`this`** (the same object), so the next method can be called on the result. jQuery, Lodash `_.chain`, Knex, Cypress and builder patterns all work this way.

```js
const calculate = {
  value: 0,
  add(n) { this.value += n; return this },
  mul(n) { this.value *= n; return this },
}
```

Caveat: a single shared object accumulates state across chains. A better design returns a **new** object each time (immutable, like `Array.prototype.map`) or provides a factory.

## Interview questions

:::question
difficulty: medium
### What's your approach to optimising expensive computations using memoization?
First confirm the function is pure and actually hot (profile). Then cache results keyed by inputs: a `Map` for primitive keys, a resolver function or nested Maps for multiple args, `WeakMap` for object keys so entries can be collected. Bound the cache (LRU/TTL) to avoid memory leaks. For async calls, cache the in-flight promise to dedupe concurrent requests and evict on failure. In React use `useMemo` for expensive derived values, `React.memo`/`useCallback` to keep props referentially stable, and selector memoization (reselect) for store-derived data — but avoid memoizing cheap things, since memoization has its own cost.
:::

:::question
difficulty: easy
### What is currying and why is it useful?
Currying converts a function of N arguments into a chain of unary (or partially applied) functions. It enables partial application (pre-configuring functions), reuse (`const logError = log('error')`), and composition in pipelines where each step takes one input. It relies on closures to remember already-supplied arguments.
:::

## Challenges

:::challenge
difficulty: medium
companies: Meta, Google, Intuit
### Implement memoize(fn, resolver?)
Return a memoized version of `fn`. By default the cache key is the first argument; if a `resolver` is given, the key is `resolver(...args)`. Preserve `this`. Expose the cache as `memoized.cache` (a `Map`).
@@@starter
```js
function memoize(fn, resolver) {
  // your code
}
```
@@@tests
```js
test('caches by first argument', () => {
  let calls = 0
  const sq = memoize((n) => { calls++; return n * n })
  expect(sq(4)).toBe(16)
  expect(sq(4)).toBe(16)
  expect(calls).toBe(1)
})
test('uses resolver for multiple args', () => {
  let calls = 0
  const add = memoize((a, b) => { calls++; return a + b }, (a, b) => `${a},${b}`)
  add(1, 2); add(1, 2); add(2, 1)
  expect(calls).toBe(2)
})
test('preserves this', () => {
  const obj = { base: 10, f: null }
  obj.f = memoize(function (n) { return this.base + n })
  expect(obj.f(1)).toBe(11)
})
test('exposes cache', () => {
  const f = memoize((x) => x)
  f('a')
  expect(f.cache.has('a')).toBe(true)
})
test('caches undefined results too', () => {
  let calls = 0
  const f = memoize(() => { calls++; return undefined })
  f(1); f(1)
  expect(calls).toBe(1)
})
```
@@@solution
```js
function memoize(fn, resolver) {
  function memoized(...args) {
    const key = resolver ? resolver.apply(this, args) : args[0]
    if (memoized.cache.has(key)) return memoized.cache.get(key)
    const result = fn.apply(this, args)
    memoized.cache.set(key, result)
    return result
  }
  memoized.cache = new Map()
  return memoized
}
```
Use `cache.has` rather than checking `cache.get(key) !== undefined`, so `undefined` results are cached. This is the exact lodash API. **Follow-ups:** LRU limit; async version caching promises; `WeakMap` for object keys; memoized recursive functions (fib) must call the memoized version recursively.
:::

:::challenge
difficulty: medium
companies: Meta, Google
### Implement curry(fn)
`curry(fn)` returns a function that collects arguments across calls (any grouping) and calls `fn` once at least `fn.length` arguments are collected.
@@@starter
```js
function curry(fn) {
  // your code
}
```
@@@tests
```js
const add3 = (a, b, c) => a + b + c
test('one at a time', () => {
  expect(curry(add3)(1)(2)(3)).toBe(6)
})
test('any grouping', () => {
  const c = curry(add3)
  expect(c(1, 2)(3)).toBe(6)
  expect(c(1)(2, 3)).toBe(6)
  expect(c(1, 2, 3)).toBe(6)
})
test('partials are reusable', () => {
  const c = curry(add3)
  const add1 = c(1)
  expect(add1(2)(3)).toBe(6)
  expect(add1(10)(10)).toBe(21)
})
test('preserves this', () => {
  const obj = { k: 1, f: null }
  obj.f = curry(function (a, b) { return this.k + a + b })
  expect(obj.f(2, 3)).toBe(6)
})
```
@@@solution
```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args)
    }
    return (...more) => curried.apply(this, [...args, ...more])
  }
}
```
Each partial call returns a new closure holding the arguments so far — that's why `add1` can be reused independently. `fn.length` counts parameters before the first default/rest parameter, so curry doesn't work for variadic functions (→ infinite curry below).
:::

:::challenge
difficulty: medium
### Infinite curried sum: sum(1)(2)(3)...()
Implement `sum` so that `sum(1)(2)(3)()` returns `6`, `sum(5)()` returns `5`, and each call can also take multiple arguments: `sum(1, 2)(3)()` returns `6`.
@@@starter
```js
function sum(...args) {
  // your code
}
```
@@@tests
```js
test('chained single args', () => {
  expect(sum(1)(2)(3)()).toBe(6)
})
test('single call', () => {
  expect(sum(5)()).toBe(5)
})
test('multiple args per call', () => {
  expect(sum(1, 2)(3)(4, 5)()).toBe(15)
})
test('independent chains', () => {
  const base = sum(10)
  expect(base(1)()).toBe(11)
  expect(base(2)()).toBe(12)
})
```
@@@solution
```js
function sum(...args) {
  const total = args.reduce((a, b) => a + b, 0)
  return function next(...more) {
    if (more.length === 0) return total
    return sum(total, ...more)
  }
}
```
Each call returns a fresh function closing over the running `total`, so chains are independent (`base(1)` doesn't affect `base(2)`). An empty call terminates the chain. **Follow-up:** support `+sum(1)(2)` by adding `next.valueOf = () => total`.
:::

:::challenge
difficulty: easy
### Implement once(fn)
Return a function that calls `fn` only the first time (with that call's `this` and args) and returns the first result for every subsequent call.
@@@starter
```js
function once(fn) {
  // your code
}
```
@@@tests
```js
test('runs only once and caches the result', () => {
  let n = 0
  const init = once((x) => { n++; return x * 2 })
  expect(init(2)).toBe(4)
  expect(init(10)).toBe(4)
  expect(n).toBe(1)
})
test('preserves this', () => {
  const o = { v: 3, f: null }
  o.f = once(function () { return this.v })
  expect(o.f()).toBe(3)
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
      result = fn.apply(this, args)
      fn = null // release the reference so fn's closure can be GC'd
    }
    return result
  }
}
```
Setting `called` *before* invoking guards against re-entrancy (fn calling the wrapper again). Releasing `fn` is a nice memory touch.
:::

:::challenge
difficulty: easy
### Implement pipe and compose
`pipe(...fns)` returns a function applying fns left to right; `compose(...fns)` right to left. With no functions they return the input unchanged.
@@@starter
```js
function pipe(...fns) {
  // your code
}
function compose(...fns) {
  // your code
}
```
@@@tests
```js
const inc = (x) => x + 1
const dbl = (x) => x * 2
test('pipe is left to right', () => {
  expect(pipe(inc, dbl)(3)).toBe(8)
})
test('compose is right to left', () => {
  expect(compose(inc, dbl)(3)).toBe(7)
})
test('identity when empty', () => {
  expect(pipe()(5)).toBe(5)
  expect(compose()(5)).toBe(5)
})
```
@@@solution
```js
function pipe(...fns) {
  return (input) => fns.reduce((acc, fn) => fn(acc), input)
}
function compose(...fns) {
  return (input) => fns.reduceRight((acc, fn) => fn(acc), input)
}
```
Async version: `(input) => fns.reduce((p, fn) => p.then(fn), Promise.resolve(input))`.
:::

:::challenge
difficulty: easy
### Implement sleep(ms)
Return a promise that resolves after `ms` milliseconds (optionally with a value).
@@@starter
```js
function mySleep(ms, value) {
  // your code
}
```
@@@tests
```js
test('waits roughly ms', async () => {
  const t = Date.now()
  await mySleep(50)
  expect(Date.now() - t).toBeGreaterThan(40)
})
test('resolves with value', async () => {
  expect(await mySleep(5, 'done')).toBe('done')
})
```
@@@solution
```js
function mySleep(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
```
Follow-up: cancellable sleep using an `AbortSignal` that clears the timer and rejects with an `AbortError`.
:::

:::challenge
difficulty: medium
### Method chaining calculator
Implement `calculate` so that `calculate.add(2).mul(4).subs(1).value` is `7`. Requirements: methods `add`, `subs`, `mul`, `div`; `value` holds the current result; **each chain must start from 0** (so a second `calculate.add(1).value` is `1`, not `8`).
@@@hint
Make `calculate` a getter-less object whose methods return a **new** calculator object, or make the first call on `calculate` create a fresh instance.
@@@starter
```js
const calculate = {
  // your code
}
```
@@@tests
```js
test('chains operations', () => {
  expect(calculate.add(2).mul(4).subs(1).value).toBe(7)
})
test('each chain starts fresh', () => {
  calculate.add(100)
  expect(calculate.add(1).value).toBe(1)
})
test('div works', () => {
  expect(calculate.add(10).div(4).value).toBe(2.5)
})
test('intermediate results are reusable', () => {
  const two = calculate.add(2)
  expect(two.mul(3).value).toBe(6)
  expect(two.add(1).value).toBe(3)
})
```
@@@solution
```js
function createCalc(value = 0) {
  return {
    value,
    add: (n) => createCalc(value + n),
    subs: (n) => createCalc(value - n),
    mul: (n) => createCalc(value * n),
    div: (n) => createCalc(value / n),
  }
}

const calculate = createCalc(0)
```
Each operation returns a **new immutable** calculator, so chains never leak state into each other and intermediate results can be branched (`two.mul(3)` and `two.add(1)` are independent).

The classic mutable version returns `this`:
```js
const calculateMutable = {
  value: 0,
  add(n) { this.value += n; return this },
  subs(n) { this.value -= n; return this },
  mul(n) { this.value *= n; return this },
}
```
It satisfies the first line but leaks state across chains — a great point to raise in the interview, then offer the immutable design (like how `map`/`filter` return new arrays).
:::

## Quick check

:::quiz
### Memoization is only safe for functions that are…
- [ ] async
- [x] pure (same input → same output, no side effects)
- [ ] recursive
- [ ] arrow functions
@@@explain
Caching an impure function's result would skip its side effects or return stale data.
:::

:::quiz
### What makes method chaining possible?
- [ ] Arrow functions
- [x] Each method returns an object that has the next method (often `this`)
- [ ] Prototypes
- [ ] Getters
@@@explain
`obj.a().b()` calls `b` on whatever `a()` returned.
:::
