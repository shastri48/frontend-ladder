---
title: Array & Function Polyfills — map, filter, reduce, flat, bind, call, apply
summary: Rebuild the built-ins you use every day to prove you understand callbacks, `this`, sparse arrays and the prototype chain.
minutes: 18
---

## What's a polyfill?

A **polyfill** is code that implements a standard feature on environments that don't support it natively — e.g. adding `Array.prototype.flat` for an old browser. In interviews, "write a polyfill for X" really means *"show me you understand exactly how X behaves"*.

Rules of a good polyfill:

1. **Attach to the right prototype** (`Array.prototype`, `Function.prototype`) so it works on every instance via the prototype chain.
2. **Use `this`** — inside `Array.prototype.myMap`, `this` is the array it was called on. That's why you must use a regular `function`, not an arrow.
3. **Match the spec's signature and edge cases** — callback args `(element, index, array)`, `thisArg`, sparse arrays ("holes"), errors for non-functions.
4. In real polyfills, guard with `if (!Array.prototype.flat)` and define with `Object.defineProperty(..., { enumerable: false })` so it doesn't show up in `for...in`. In interviews, a `myX` name is fine.

## Sparse arrays and `in`

`[1, , 3]` has a **hole** at index 1 — not `undefined`, but *no property at all*. Built-ins like `map`, `filter`, `forEach`, `reduce` **skip holes**. Check with `i in arr`:

```js
const sparse = [1, , 3]
1 in sparse            // false
sparse.map((x) => x * 2) // [2, empty, 6]
```

## map

```js
Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function')
  const result = new Array(this.length)
  for (let i = 0; i < this.length; i++) {
    if (i in this) result[i] = callback.call(thisArg, this[i], i, this)
  }
  return result
}
```

## filter

```js
Array.prototype.myFilter = function (callback, thisArg) {
  const result = []
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) result.push(this[i])
  }
  return result
}
```

## reduce — the tricky one

`reduce(callback, initialValue)` has two modes:

- **With** `initialValue`: accumulator starts as it, iteration starts at index 0.
- **Without**: accumulator starts as the **first present element**, iteration starts after it. On an **empty array without initial value → TypeError**.

Detect "no initial value" with `arguments.length < 2`, *not* `initialValue === undefined` — because `undefined` is a legitimate initial value.

## flat

`arr.flat(depth = 1)` flattens nested arrays up to `depth` levels and removes holes. `flat(Infinity)` flattens everything.

## call, apply, bind

The trick for `call`/`apply` without using the built-ins: **temporarily make the function a method of the target object**, so implicit binding sets `this`:

```js
Function.prototype.myCall = function (ctx, ...args) {
  ctx = ctx ?? globalThis          // null/undefined → global (sloppy semantics)
  ctx = Object(ctx)                // box primitives: 'abc' → String object
  const key = Symbol('fn')         // unique key, no collisions
  ctx[key] = this                  // `this` is the function being called
  const result = ctx[key](...args) // implicit binding: this === ctx
  delete ctx[key]
  return result
}
```

`bind` returns a new function that pre-fills `this` and leading args. A complete `bind` also supports being called with `new` (then `this` should be the new instance, not the bound context).

## Interview questions

:::question
difficulty: easy
### Why must polyfill methods use `function` instead of an arrow?
Prototype methods rely on dynamic `this` — `[1,2].myMap(fn)` calls `myMap` with `this` = the array. Arrow functions capture `this` lexically from where they're defined (the module/global scope), so `this` would never be the array.
:::

:::question
difficulty: medium
### What's the difference between `map` and `forEach`? Can you break out of `forEach`?
`map` returns a new array of callback results (same length); `forEach` returns `undefined` and is used for side effects. You can't `break` out of `forEach` (short of throwing); use `for...of`, `some`/`every` (which stop early when the callback returns true/false) or `find`. Neither awaits async callbacks.
:::

## Challenges

:::challenge
difficulty: easy
companies: Meta, Apple, Microsoft
### Implement Array.prototype.myMap
Implement `myMap(callback, thisArg)` matching `Array.prototype.map`, including skipping holes and passing `(element, index, array)`.
@@@starter
```js
Array.prototype.myMap = function (callback, thisArg) {
  // your code
}
```
@@@tests
```js
test('maps values', () => {
  expect([1, 2, 3].myMap((x) => x * 2)).toEqual([2, 4, 6])
})
test('passes index and array', () => {
  const arr = ['a', 'b']
  expect(arr.myMap((x, i, a) => x + i + a.length)).toEqual(['a02', 'b12'])
})
test('respects thisArg', () => {
  const ctx = { k: 10 }
  expect([1].myMap(function (x) { return x + this.k }, ctx)).toEqual([11])
})
test('skips holes', () => {
  let calls = 0
  const out = [1, , 3].myMap((x) => { calls++; return x })
  expect(calls).toBe(2)
  expect(1 in out).toBe(false)
  expect(out.length).toBe(3)
})
test('throws for non-function', () => {
  expect(() => [1].myMap(null)).toThrow()
})
```
@@@solution
```js
Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== 'function') {
    throw new TypeError(`${callback} is not a function`)
  }
  const len = this.length
  const result = new Array(len)
  for (let i = 0; i < len; i++) {
    if (i in this) {
      result[i] = callback.call(thisArg, this[i], i, this)
    }
  }
  return result
}
```
`new Array(len)` creates a sparse array of the right length so holes stay holes. Length is read once, like the spec (elements appended during iteration aren't visited).
:::

:::challenge
difficulty: easy
### Implement Array.prototype.myFilter
@@@starter
```js
Array.prototype.myFilter = function (callback, thisArg) {
  // your code
}
```
@@@tests
```js
test('filters values', () => {
  expect([1, 2, 3, 4].myFilter((x) => x % 2 === 0)).toEqual([2, 4])
})
test('passes index', () => {
  expect(['a', 'b', 'c'].myFilter((_, i) => i !== 1)).toEqual(['a', 'c'])
})
test('skips holes', () => {
  expect([1, , 3].myFilter(() => true)).toEqual([1, 3])
})
```
@@@solution
```js
Array.prototype.myFilter = function (callback, thisArg) {
  if (typeof callback !== 'function') throw new TypeError(`${callback} is not a function`)
  const result = []
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      result.push(this[i])
    }
  }
  return result
}
```
Truthiness of the callback's return decides inclusion; the output is dense (no holes).
:::

:::challenge
difficulty: medium
companies: Meta, Apple, Microsoft
### Implement Array.prototype.myReduce
Support both modes (with/without initial value), skip holes, and throw a `TypeError` for an empty array with no initial value.
@@@hint
Use `arguments.length` to know whether an initial value was passed — `undefined` can be a valid initial value.
@@@starter
```js
Array.prototype.myReduce = function (callback, initialValue) {
  // your code
}
```
@@@tests
```js
test('sums with initial value', () => {
  expect([1, 2, 3].myReduce((a, b) => a + b, 10)).toBe(16)
})
test('sums without initial value', () => {
  expect([1, 2, 3].myReduce((a, b) => a + b)).toBe(6)
})
test('passes index and array', () => {
  const idx = []
  ;[5, 6, 7].myReduce((acc, x, i) => { idx.push(i); return acc }, 0)
  expect(idx).toEqual([0, 1, 2])
})
test('without initial starts at index 1', () => {
  const idx = []
  ;[5, 6, 7].myReduce((acc, x, i) => { idx.push(i); return acc })
  expect(idx).toEqual([1, 2])
})
test('empty array without initial throws', () => {
  expect(() => [].myReduce((a, b) => a + b)).toThrow()
})
test('empty array with initial returns it', () => {
  expect([].myReduce((a, b) => a + b, 'init')).toBe('init')
})
test('undefined is a valid initial value', () => {
  expect([1].myReduce((acc) => acc, undefined)).toBe(undefined)
})
test('group by category', () => {
  const products = [
    { id: 1, category: 'Mobile', name: 'iPhone' },
    { id: 2, category: 'Laptop', name: 'MacBook' },
    { id: 3, category: 'Mobile', name: 'Pixel' },
  ]
  const grouped = products.myReduce((acc, p) => {
    ;(acc[p.category] ??= []).push(p.name)
    return acc
  }, {})
  expect(grouped).toEqual({ Mobile: ['iPhone', 'Pixel'], Laptop: ['MacBook'] })
})
```
@@@solution
```js
Array.prototype.myReduce = function (callback, initialValue) {
  if (typeof callback !== 'function') throw new TypeError(`${callback} is not a function`)
  const len = this.length
  let i = 0
  let acc

  if (arguments.length >= 2) {
    acc = initialValue
  } else {
    // find the first present element
    while (i < len && !(i in this)) i++
    if (i >= len) throw new TypeError('Reduce of empty array with no initial value')
    acc = this[i]
    i++
  }

  for (; i < len; i++) {
    if (i in this) acc = callback(acc, this[i], i, this)
  }
  return acc
}
```
The "group products by category" test is a real interview question (reduce + object manipulation, O(n)). Modern JS also has `Object.groupBy(products, (p) => p.category)`.
:::

:::challenge
difficulty: medium
companies: Meta, Google, Apple, Microsoft
### Implement Array.prototype.myFlat(depth = 1)
Flatten nested arrays up to `depth` levels. `Infinity` flattens fully. Holes are removed.
@@@starter
```js
Array.prototype.myFlat = function (depth = 1) {
  // your code
}
```
@@@tests
```js
test('flattens one level by default', () => {
  expect([1, [2, [3, [4]]]].myFlat()).toEqual([1, 2, [3, [4]]])
})
test('flattens to depth 2', () => {
  expect([1, [2, [3, [4]]]].myFlat(2)).toEqual([1, 2, 3, [4]])
})
test('flattens fully with Infinity', () => {
  expect([1, [2, [3, [4, [5]]]]].myFlat(Infinity)).toEqual([1, 2, 3, 4, 5])
})
test('depth 0 returns a shallow copy', () => {
  const inner = [2]
  const out = [1, inner].myFlat(0)
  expect(out).toEqual([1, [2]])
  expect(out[1]).toBe(inner)
})
test('removes holes', () => {
  expect([1, , [2, , 3]].myFlat()).toEqual([1, 2, 3])
})
```
@@@solution
Recursive:
```js
Array.prototype.myFlat = function (depth = 1) {
  const result = []
  const flatten = (arr, d) => {
    for (let i = 0; i < arr.length; i++) {
      if (!(i in arr)) continue                  // skip holes
      const item = arr[i]
      if (Array.isArray(item) && d > 0) flatten(item, d - 1)
      else result.push(item)
    }
  }
  flatten(this, depth)
  return result
}
```
Iterative with a stack (no recursion limit for very deep arrays):
```js
function flatDeep(arr) {
  const stack = [...arr]
  const result = []
  while (stack.length) {
    const next = stack.pop()
    if (Array.isArray(next)) stack.push(...next)
    else result.push(next)
  }
  return result.reverse()
}
```
Complexity: O(n) over total elements. The stack version is a common follow-up for "what if nesting is 100,000 levels deep?" (recursion would overflow the call stack).
:::

:::challenge
difficulty: medium
### Implement Function.prototype.myCall and myApply
Implement `myCall(ctx, ...args)` and `myApply(ctx, argsArray)` without using the built-in `call`, `apply` or `bind`.
@@@hint
Temporarily store the function on `ctx` under a unique `Symbol` key, call it as a method, then delete it.
@@@starter
```js
Function.prototype.myCall = function (ctx, ...args) {
  // your code
}
Function.prototype.myApply = function (ctx, args) {
  // your code
}
```
@@@tests
```js
function intro(greeting, punct) { return `${greeting}, ${this.name}${punct}` }
test('myCall sets this and args', () => {
  expect(intro.myCall({ name: 'Ana' }, 'Hi', '!')).toBe('Hi, Ana!')
})
test('myApply takes an array', () => {
  expect(intro.myApply({ name: 'Bo' }, ['Hey', '?'])).toBe('Hey, Bo?')
})
test('does not leave properties on ctx', () => {
  const ctx = { name: 'C' }
  intro.myCall(ctx, 'a', 'b')
  expect(Object.getOwnPropertySymbols(ctx).length).toBe(0)
  expect(Object.keys(ctx)).toEqual(['name'])
})
test('works with primitives as this', () => {
  function len() { return this.length }
  expect(len.myCall('abcd')).toBe(4)
})
test('myApply with no args', () => {
  function f() { return arguments.length }
  expect(f.myApply({})).toBe(0)
})
```
@@@solution
```js
Function.prototype.myCall = function (ctx, ...args) {
  if (typeof this !== 'function') throw new TypeError('myCall must be called on a function')
  ctx = ctx === null || ctx === undefined ? globalThis : Object(ctx)
  const key = Symbol('fn')
  ctx[key] = this
  try {
    return ctx[key](...args)
  } finally {
    delete ctx[key]
  }
}

Function.prototype.myApply = function (ctx, args) {
  return this.myCall(ctx, ...(args ?? []))
}
```
- `Object(ctx)` boxes primitives so we can attach a property (`'abcd'` → `String {'abcd'}`), and `this.length` works.
- A `Symbol` key can't collide with existing properties and isn't enumerable via `Object.keys`.
- `try/finally` removes the property even if the function throws.
:::

:::challenge
difficulty: hard
### Implement Function.prototype.myBind
Implement `myBind(ctx, ...presetArgs)` returning a function that calls the original with `this = ctx` and `presetArgs` followed by call-time args. Bonus: when the bound function is called with `new`, `this` must be the new instance and instances should still be `instanceof` the original function.
@@@starter
```js
Function.prototype.myBind = function (ctx, ...presetArgs) {
  // your code
}
```
@@@tests
```js
test('binds this', () => {
  function getX() { return this.x }
  expect(getX.myBind({ x: 5 })()).toBe(5)
})
test('partial application', () => {
  function add(a, b, c) { return a + b + c }
  expect(add.myBind(null, 1, 2)(3)).toBe(6)
})
test('cannot be rebound', () => {
  function getX() { return this.x }
  const b = getX.myBind({ x: 1 })
  expect(b.call({ x: 2 })).toBe(1)
})
test('works with new', () => {
  function Point(x, y) { this.x = x; this.y = y }
  const BoundPoint = Point.myBind({ ignored: true }, 1)
  const p = new BoundPoint(2)
  expect(p.x).toBe(1)
  expect(p.y).toBe(2)
  expect(p instanceof Point).toBe(true)
  expect(p.ignored).toBe(undefined)
})
```
@@@solution
```js
Function.prototype.myBind = function (ctx, ...presetArgs) {
  if (typeof this !== 'function') throw new TypeError('Bind must be called on a function')
  const original = this

  function bound(...laterArgs) {
    // If called with `new`, `this` is an instance of `bound` → ignore ctx
    const isNew = this instanceof bound
    return original.apply(isNew ? this : ctx, [...presetArgs, ...laterArgs])
  }

  // Instances created via `new bound()` should inherit from original.prototype
  if (original.prototype) {
    bound.prototype = Object.create(original.prototype)
  }
  return bound
}
```
- Bound `this` can't be changed later because `bound` ignores its own `this` (except under `new`).
- `new` detection: when `new bound()` runs, `this` is an object whose prototype is `bound.prototype`, so `this instanceof bound` is true. (In modern code you could check `new.target`.)
- Linking `bound.prototype` to `original.prototype` makes `instanceof Point` work.
:::

## Quick check

:::quiz
### `[1, 2, 3].reduce((a, b) => a + b)` starts with…
- [ ] acc = 0, index 0
- [x] acc = 1, index 1
- [ ] acc = undefined, index 0
- [ ] acc = 3, index 2
@@@explain
Without an initial value, the first element becomes the accumulator and iteration starts at index 1.
:::

:::quiz
### How do you know if reduce was called without an initial value?
- [ ] `initialValue === undefined`
- [x] `arguments.length < 2`
- [ ] `typeof initialValue === 'undefined'`
- [ ] `this.length === 0`
@@@explain
`undefined` can be explicitly passed as a valid initial value; only the argument count tells them apart.
:::
