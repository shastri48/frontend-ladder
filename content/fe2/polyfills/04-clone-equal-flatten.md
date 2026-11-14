---
title: Deep Clone, Deep Equal & Flattening Objects
summary: Recursion over nested data structures — copying them safely (circular references, Dates, Maps, Sets), comparing them structurally, and flattening objects into dot-path keys.
minutes: 20
---

## Values vs references

Primitives (`string`, `number`, `boolean`, `null`, `undefined`, `symbol`, `bigint`) are copied **by value**. Objects (including arrays, functions, Dates, Maps) are passed around **by reference** — the variable holds a pointer to the object in the heap.

```js
const a = { user: { name: 'Ana' } }
const b = a            // same object
const c = { ...a }     // NEW outer object, but c.user === a.user (shared!)
c.user.name = 'Bo'
a.user.name            // "Bo" — shallow copy shared the nested object
```

| Copy | How | Nested objects |
|---|---|---|
| Assignment | `b = a` | Same object entirely |
| Shallow copy | `{...a}`, `Object.assign({}, a)`, `[...arr]`, `arr.slice()` | **Shared** |
| Deep copy | `structuredClone(a)`, custom recursion | Independent |

This matters a lot in React/Redux, where state must be updated **immutably**: you shallow-copy each level you change (`{...state, user: {...state.user, name}}`) rather than deep-cloning everything.

## Ways to deep clone

### `JSON.parse(JSON.stringify(obj))` — the quick hack

Works for plain JSON data only. It **loses or breaks**: `undefined`, functions and Symbols (dropped), `Date` (becomes a string), `Map`/`Set` (become `{}`), `NaN`/`Infinity` (become `null`), `BigInt` (throws), **circular references (throws)**, class instances (lose their prototype).

### `structuredClone(obj)` — the modern built-in

Supports Dates, Maps, Sets, RegExps, typed arrays, Blobs, **circular references**. Doesn't support functions, DOM nodes, or class prototypes (instances come back as plain objects). This is what `postMessage` uses. In an interview, mention it — then implement your own because they asked "without JSON methods".

### Custom recursive clone

The core algorithm:

1. If the value is a primitive (or function), return it.
2. If we've already cloned this object (circular/shared reference), return the existing clone — tracked in a **`WeakMap` from original → clone**.
3. Handle special types: `Date`, `RegExp`, `Map`, `Set`, arrays.
4. Create the clone **and register it in the map before recursing** (that's what makes cycles work).
5. Recursively clone each own key (including Symbol keys, if you want to be thorough), preserving the prototype.

```text
original: A ──► B ──► A (cycle)

clone(A): seen = { A → A' }
  clone(B): seen = { A → A', B → B' }
    clone(A): found in seen → return A'   ✔ cycle preserved, no infinite loop
```

## Deep equal

`===` compares references for objects. **Deep equality** compares structure:

1. If `Object.is(a, b)` → equal (handles `NaN === NaN` and same reference).
2. If either isn't an object (or is null) → not equal.
3. Different prototypes/types (array vs object, Date vs object) → not equal.
4. Dates: compare `getTime()`. RegExps: compare `source` + `flags`. Maps/Sets: compare sizes and entries.
5. Same set of own keys, and every key's values deep-equal (recurse).
6. Handle cycles by tracking visited pairs.

Where it's used: `React.memo`/`useMemo` custom comparators, test assertions (`toEqual`), cache keys, form "is dirty?" checks. Deep comparison is O(size of data) — that's why React uses shallow comparison by default.

## Flattening an object

Turn `{ a: { b: { c: 1 } }, d: [1, 2] }` into `{ 'a.b.c': 1, 'd.0': 1, 'd.1': 2 }`. Asked in Senior React rounds ("flatten a deeply nested object into key-value pairs"). Used for form libraries (field paths), i18n keys, analytics properties and query strings.

## Interview questions

:::question
difficulty: easy
### Shallow copy vs deep copy?
A shallow copy duplicates only the top level; nested objects are still shared references, so mutating them affects both. A deep copy recursively duplicates every nested object so the copies are fully independent. Spread/`Object.assign`/`slice` are shallow; `structuredClone` or a custom recursive function is deep. JSON round-trip is deep but lossy.
:::

:::question
difficulty: medium
### What are the limitations of JSON.parse(JSON.stringify(obj)) for cloning?
Drops `undefined`, functions and Symbol-keyed/-valued properties; converts Dates to strings; Maps/Sets to `{}`; `NaN`/`Infinity` to `null`; throws on BigInt and circular references; loses prototypes (class instances become plain objects); slow for large data. Use `structuredClone` or a custom clone.
:::

## Challenges

:::challenge
difficulty: hard
companies: Meta, Google
### Deep clone without JSON (with circular references)
Implement `deepClone(value)`:
- Primitives and functions are returned as-is.
- Arrays and plain objects are cloned recursively, preserving the prototype.
- `Date`, `RegExp`, `Map` and `Set` are cloned properly (Map/Set contents deep-cloned).
- Circular and shared references are preserved (the clone has the same shape of references).
@@@hint
Use a `WeakMap` from original to clone. Register the clone in the map **before** recursing into children.
@@@starter
```js
function deepClone(value, seen = new WeakMap()) {
  // your code
}
```
@@@tests
```js
test('clones nested objects independently', () => {
  const a = { x: 1, nested: { y: [1, { z: 2 }] } }
  const b = deepClone(a)
  expect(b).toEqual(a)
  b.nested.y[1].z = 99
  expect(a.nested.y[1].z).toBe(2)
})
test('handles circular references', () => {
  const a = { name: 'a' }
  a.self = a
  const b = deepClone(a)
  expect(b.self).toBe(b)
  expect(b === a).toBe(false)
})
test('preserves shared references', () => {
  const shared = { s: 1 }
  const b = deepClone({ p: shared, q: shared })
  expect(b.p).toBe(b.q)
  expect(b.p === shared).toBe(false)
})
test('clones Date, RegExp, Map, Set', () => {
  const d = new Date(0)
  const src = { d, r: /ab+c/gi, m: new Map([['k', { v: 1 }]]), s: new Set([1, 2]) }
  const c = deepClone(src)
  expect(c.d instanceof Date && c.d.getTime() === 0 && c.d !== d).toBe(true)
  expect(c.r.source).toBe('ab+c')
  expect(c.r.flags).toBe('gi')
  expect(c.m.get('k')).toEqual({ v: 1 })
  expect(c.m.get('k') === src.m.get('k')).toBe(false)
  expect([...c.s]).toEqual([1, 2])
})
test('keeps prototype of class instances', () => {
  class P { hi() { return 'hi' } }
  const p = new P()
  expect(deepClone(p).hi()).toBe('hi')
})
test('primitives and functions pass through', () => {
  const fn = () => 1
  expect(deepClone(5)).toBe(5)
  expect(deepClone(null)).toBe(null)
  expect(deepClone(fn)).toBe(fn)
})
```
@@@solution
```js
function deepClone(value, seen = new WeakMap()) {
  // 1. primitives & functions
  if (value === null || typeof value !== 'object') return value

  // 2. already cloned (cycles / shared refs)
  if (seen.has(value)) return seen.get(value)

  // 3. special built-ins
  if (value instanceof Date) return new Date(value.getTime())
  if (value instanceof RegExp) return new RegExp(value.source, value.flags)

  if (value instanceof Map) {
    const copy = new Map()
    seen.set(value, copy)
    value.forEach((v, k) => copy.set(deepClone(k, seen), deepClone(v, seen)))
    return copy
  }
  if (value instanceof Set) {
    const copy = new Set()
    seen.set(value, copy)
    value.forEach((v) => copy.add(deepClone(v, seen)))
    return copy
  }

  // 4. arrays & objects: create, register, then recurse
  const copy = Array.isArray(value)
    ? new Array(value.length)
    : Object.create(Object.getPrototypeOf(value))
  seen.set(value, copy)

  for (const key of Reflect.ownKeys(value)) {   // string + symbol keys
    copy[key] = deepClone(value[key], seen)
  }
  return copy
}
```
**Complexity:** O(n) time and space for n reachable values. **Follow-ups:** property descriptors/getters (`Object.getOwnPropertyDescriptors`), typed arrays, very deep structures (iterative version with an explicit stack), and simply using `structuredClone`.
:::

:::challenge
difficulty: hard
companies: Google, Meta
### Deep equal (lodash isEqual)
Implement `deepEqual(a, b)` that returns `true` if values are structurally equal. Handle primitives (`NaN` equals `NaN`), arrays, plain objects (key order doesn't matter), `Date`, `Map`, `Set` and circular references.
@@@starter
```js
function deepEqual(a, b) {
  // your code
}
```
@@@tests
```js
test('primitives', () => {
  expect(deepEqual(1, 1)).toBe(true)
  expect(deepEqual('a', 'b')).toBe(false)
  expect(deepEqual(NaN, NaN)).toBe(true)
  expect(deepEqual(null, undefined)).toBe(false)
})
test('objects regardless of key order', () => {
  expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true)
  expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
})
test('arrays vs objects', () => {
  expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
  expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true)
  expect(deepEqual([1, 2], [2, 1])).toBe(false)
})
test('dates, maps and sets', () => {
  expect(deepEqual(new Date(5), new Date(5))).toBe(true)
  expect(deepEqual(new Map([['a', { x: 1 }]]), new Map([['a', { x: 1 }]]))).toBe(true)
  expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true)
  expect(deepEqual(new Set([1]), new Set([2]))).toBe(false)
})
test('circular references', () => {
  const a = { v: 1 }; a.self = a
  const b = { v: 1 }; b.self = b
  expect(deepEqual(a, b)).toBe(true)
})
```
@@@solution
```js
function deepEqual(a, b, seen = new WeakMap()) {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false

  // cycle guard: if we're already comparing a with b, assume equal
  if (seen.get(a) === b) return true
  seen.set(a, b)

  if (a instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof RegExp) return a.source === b.source && a.flags === b.flags

  if (a instanceof Map) {
    if (a.size !== b.size) return false
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k), seen)) return false
    }
    return true
  }

  if (a instanceof Set) {
    if (a.size !== b.size) return false
    for (const v of a) {
      if (b.has(v)) continue
      // object members: look for any deep-equal member
      let found = false
      for (const w of b) {
        if (deepEqual(v, w, seen)) { found = true; break }
      }
      if (!found) return false
    }
    return true
  }

  const keysA = Reflect.ownKeys(a)
  const keysB = Reflect.ownKeys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!deepEqual(a[key], b[key], seen)) return false
  }
  return true
}
```
- `Object.is` covers identical references, `NaN`, and distinguishes `+0`/`-0` (lodash treats them as equal — mention the choice).
- Prototype check distinguishes arrays from objects and different classes.
- The `seen` map handles cycles.
- Arrays are handled by the generic key comparison (indices + `length`).

**Complexity:** O(n) for most data; Sets of objects are O(n²) in the worst case.
:::

:::challenge
difficulty: medium
### Flatten a nested object into key-value pairs
Implement `flattenObject(obj, prefix = '')` producing dot-separated keys. Arrays use indices as keys. Empty objects/arrays should be kept as values (so information isn't lost).
@@@starter
```js
function flattenObject(obj, prefix = '') {
  // your code
}
```
@@@tests
```js
test('flattens nested objects', () => {
  expect(flattenObject({ a: { b: { c: 1 } }, d: 2 })).toEqual({ 'a.b.c': 1, d: 2 })
})
test('flattens arrays with indices', () => {
  expect(flattenObject({ list: [1, { x: 2 }] })).toEqual({ 'list.0': 1, 'list.1.x': 2 })
})
test('keeps null, empty objects and arrays', () => {
  expect(flattenObject({ a: null, b: {}, c: [] })).toEqual({ a: null, b: {}, c: [] })
})
test('supports a prefix', () => {
  expect(flattenObject({ x: { y: 1 } }, 'root')).toEqual({ 'root.x.y': 1 })
})
```
@@@solution
```js
function flattenObject(obj, prefix = '') {
  const result = {}

  const walk = (value, path) => {
    const isContainer = value !== null && typeof value === 'object' && !(value instanceof Date)
    const keys = isContainer ? Object.keys(value) : []

    if (!isContainer || keys.length === 0) {
      result[path] = value
      return
    }
    for (const key of keys) {
      walk(value[key], path ? `${path}.${key}` : key)
    }
  }

  if (obj !== null && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      walk(obj[key], prefix ? `${prefix}.${key}` : key)
    }
  }
  return result
}
```
Depth-first walk carrying the current path. Leaves (primitives, null, Dates, empty containers) are written to the result. **Follow-ups:** the inverse (`unflatten` / set by path — see the utilities lesson), custom separators, bracket notation for arrays (`list[0].x`), and cycle detection with a `WeakSet`.
:::

:::challenge
difficulty: easy
companies: Meta
### Flatten a deeply nested array (no built-in flat)
Implement `flatten(arr)` that fully flattens an arbitrarily nested array without using `Array.prototype.flat`.
@@@starter
```js
function flatten(arr) {
  // your code
}
```
@@@tests
```js
test('flattens deeply', () => {
  expect(flatten([1, [2, [3, [4, [5]]]], 6])).toEqual([1, 2, 3, 4, 5, 6])
})
test('handles empty nested arrays', () => {
  expect(flatten([[], [[]], 1])).toEqual([1])
})
test('does not mutate input', () => {
  const input = [1, [2]]
  flatten(input)
  expect(input).toEqual([1, [2]])
})
```
@@@solution
```js
function flatten(arr) {
  return arr.reduce(
    (acc, item) => (Array.isArray(item) ? acc.concat(flatten(item)) : (acc.push(item), acc)),
    []
  )
}
```
Or iteratively (safe for extreme depth):
```js
function flatten(arr) {
  const stack = [...arr]
  const out = []
  while (stack.length) {
    const item = stack.pop()
    if (Array.isArray(item)) stack.push(...item)
    else out.push(item)
  }
  return out.reverse()
}
```
O(n) in total elements. Mention a generator version (`function* flat(arr) { for (const x of arr) Array.isArray(x) ? yield* flat(x) : yield x }`) for lazy consumption.
:::

## Quick check

:::quiz
### Which cloning approach handles circular references and Dates out of the box?
- [ ] JSON.parse(JSON.stringify(x))
- [ ] Spread `{...x}`
- [x] structuredClone(x)
- [ ] Object.assign({}, x)
@@@explain
structuredClone implements the structured clone algorithm with cycle support and many built-in types.
:::

:::quiz
### In deepClone, why register the clone in the WeakMap before recursing?
- [ ] For performance only
- [x] So a cycle pointing back to the original finds the clone instead of recursing forever
- [ ] Because WeakMap requires it
- [ ] To preserve key order
@@@explain
Children that reference the parent need to find the parent's clone in the map while it's still being filled.
:::
