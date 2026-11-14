---
title: Warm-ups — Objects & Data Transformation
summary: Group by, path strings to nested objects, safe get, merging and the influencer (celebrity) matrix — everyday frontend data wrangling.
minutes: 25
---

## Why data transformation questions are so common

Frontend work is mostly **reshaping data**: API responses into view models, flat lists into groups, form values into nested payloads, query strings into objects. Interviewers (Razorpay, Tekion and many product companies) love these questions because they reveal fluency with `reduce`, objects, recursion and edge-case thinking — the same skills you use daily.

Patterns to keep handy:

```js
// group
arr.reduce((acc, x) => ((acc[key(x)] ??= []).push(x), acc), {})
// index by id
Object.fromEntries(arr.map((x) => [x.id, x]))
// transform values
Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))
// walk a path
path.split('.').reduce((o, k) => o?.[k], obj)
```

## Challenges

:::challenge
difficulty: easy
companies: Common
### Group products by category
Implement `groupBy(items, keyOrFn)` where the second argument is either a property name or a function returning the group key.
```js
groupBy(products, "category")
groupBy([1.2, 1.8, 2.1], Math.floor) // { 1: [1.2, 1.8], 2: [2.1] }
```
@@@starter
```js
function groupBy(items, keyOrFn) {
  // your code
}
```
@@@tests
```js
const products = [
  { id: 1, category: 'Mobile', name: 'iPhone' },
  { id: 2, category: 'Laptop', name: 'MacBook' },
  { id: 3, category: 'Mobile', name: 'Pixel' },
]
test('by property', () => {
  const g = groupBy(products, 'category')
  expect(g.Mobile.map(p => p.name)).toEqual(['iPhone', 'Pixel'])
  expect(g.Laptop.length).toBe(1)
})
test('by function', () => {
  expect(groupBy([1.2, 1.8, 2.1], Math.floor)).toEqual({ 1: [1.2, 1.8], 2: [2.1] })
})
```
@@@solution
```js
function groupBy(items, keyOrFn) {
  const getKey = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn]
  return items.reduce((groups, item) => {
    const key = getKey(item)
    if (!Object.hasOwn(groups, key)) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})
}
```
Normalising the second argument into a function keeps the loop simple. O(n). Discuss: preserving order (objects order integer-like keys numerically — use a `Map` if order matters), and the built-in `Object.groupBy` / `Map.groupBy` (ES2024).
:::

:::challenge
difficulty: medium
companies: Razorpay
### Convert "a.b.c" into a nested object
Write `setPath(obj, path, value)` that creates nested objects as needed, then use it to build `toNested("a.b.c", 1)` → `{ a: { b: { c: 1 } } }`. Bonus: `unflatten({ "a.b": 1, "a.c": 2, "d": 3 })` → `{ a: { b: 1, c: 2 }, d: 3 }`.
@@@starter
```js
function setPath(obj, path, value) {
  // mutate obj and return it
}
function toNested(path, value) {
  // your code
}
function unflatten(flat) {
  // your code
}
```
@@@tests
```js
test('toNested', () => {
  expect(toNested('a.b.c', 1)).toEqual({ a: { b: { c: 1 } } })
  expect(toNested('x', 'y')).toEqual({ x: 'y' })
})
test('setPath keeps siblings', () => {
  const o = { a: { keep: true } }
  setPath(o, 'a.b', 2)
  expect(o).toEqual({ a: { keep: true, b: 2 } })
})
test('unflatten', () => {
  expect(unflatten({ 'a.b': 1, 'a.c': 2, d: 3 })).toEqual({ a: { b: 1, c: 2 }, d: 3 })
})
```
@@@solution
```js
function setPath(obj, path, value) {
  const keys = path.split('.')
  let node = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {} // create missing levels
    node = node[k]
  }
  node[keys[keys.length - 1]] = value
  return obj
}

const toNested = (path, value) => setPath({}, path, value)

function unflatten(flat) {
  const result = {}
  for (const [path, value] of Object.entries(flat)) setPath(result, path, value)
  return result
}

// Elegant alternative for toNested using reduceRight:
const toNested2 = (path, value) =>
  path.split('.').reduceRight((acc, key) => ({ [key]: acc }), value)
```
`reduceRight` builds from the innermost key outwards: `1 → {c:1} → {b:{c:1}} → {a:...}`. The iterative `setPath` is what you need for merging many paths. Edge cases to mention: array indices (`"a.0.b"` — create arrays when the next key is numeric), keys containing dots, and guarding `__proto__`/`constructor` to avoid prototype pollution.
:::

:::challenge
difficulty: easy
### Safe deep get (lodash.get)
Implement `get(obj, path, defaultValue)` where `path` is `"a.b[0].c"` or an array of keys. Return `defaultValue` when the resolved value is `undefined`.
@@@starter
```js
function get(obj, path, defaultValue) {
  // your code
}
```
@@@tests
```js
const data = { a: { b: [{ c: 3 }], n: null } }
test('dot and bracket', () => { expect(get(data, 'a.b[0].c')).toBe(3) })
test('array path', () => { expect(get(data, ['a', 'b', '0', 'c'])).toBe(3) })
test('missing → default', () => { expect(get(data, 'a.x.y', 'def')).toBe('def') })
test('null is a value', () => { expect(get(data, 'a.n', 'def')).toBe(null) })
```
@@@solution
```js
function get(obj, path, defaultValue) {
  const keys = Array.isArray(path)
    ? path
    : path.replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean) // a.b[0].c → a.b.0.c
  let node = obj
  for (const key of keys) {
    if (node == null) return defaultValue   // null or undefined: can't go deeper
    node = node[key]
  }
  return node === undefined ? defaultValue : node
}
```
Normalise bracket notation with a regex, then walk. Only `undefined` triggers the default (matching lodash) — `null` is a legitimate value. Optional chaining does this for static paths; `get` is for dynamic ones (form libraries, table column accessors).
:::

:::challenge
difficulty: medium
companies: Stable Money
### Find the influencer (celebrity problem)
`follows[i][j] === 1` means user `i` follows user `j` (everyone follows themselves). An **influencer** is followed by every other user and follows no one else. Return the influencer's index, or `-1`.
```js
influencer([[1, 1, 0],
            [0, 1, 0],
            [0, 1, 1]]) // 1
```
@@@hint
Can you eliminate one candidate with every comparison? If `a` follows `b`, `a` can't be the influencer; otherwise `b` can't be.
@@@starter
```js
function influencer(follows) {
  // your code
}
```
@@@tests
```js
test('example', () => { expect(influencer([[1,1,0],[0,1,0],[0,1,1]])).toBe(1) })
test('none', () => { expect(influencer([[1,1],[1,1]])).toBe(-1) })
test('single user', () => { expect(influencer([[1]])).toBe(0) })
test('last', () => { expect(influencer([[1,0,1],[0,1,1],[0,0,1]])).toBe(2) })
```
@@@solution
```js
function influencer(follows) {
  const n = follows.length
  // Phase 1: eliminate candidates — O(n)
  let candidate = 0
  for (let i = 1; i < n; i++) {
    if (follows[candidate][i] === 1) candidate = i  // candidate follows i → candidate isn't the influencer
    // else i doesn't get followed by candidate → i isn't the influencer
  }
  // Phase 2: verify — O(n)
  for (let i = 0; i < n; i++) {
    if (i === candidate) continue
    if (follows[candidate][i] === 1 || follows[i][candidate] !== 1) return -1
  }
  return candidate
}
```
Brute force checks every row and column: O(n²). The elimination trick needs only n−1 comparisons to find the single possible candidate, then 2(n−1) checks to verify → **O(n) time, O(1) space**. Verification is required because the survivor might not actually qualify. A stack-based version (push all, pop two, push the survivor) is equivalent.
:::

:::challenge
difficulty: easy
companies: Stable Money
### Puzzle: the abnormal bag
You have 10 bags of unlimited coins. Coins weigh 1g, except all coins in one abnormal bag weigh 1.1g. Using a digital scale **once**, find the abnormal bag.
@@@solution
Take a **different number of coins from each bag**: 1 coin from bag 1, 2 from bag 2, … 10 from bag 10. That's 55 coins. Weigh them all together once.

If all were normal the weight would be 55g. Every extra 0.1g corresponds to one coin from the abnormal bag, so:

```text
bag number = (measured weight − 55) / 0.1
e.g. 55.7g → 0.7 / 0.1 = 7 → bag 7
```

Why it works: each bag contributes a unique count, so the excess weight uniquely identifies it — the same "encode identity into a unique weight/number" idea behind checksums and bit-flags. In code: `Math.round((weight - 55) * 10)` to avoid floating-point errors (0.1 can't be represented exactly!).
:::

:::challenge
difficulty: medium
### Merge two config objects
Implement `mergeDeep(a, b)`: keys from both; when both values are plain objects merge recursively; when both are arrays concatenate; otherwise `b` wins. Don't mutate inputs.
@@@starter
```js
function mergeDeep(a, b) {
  // your code
}
```
@@@tests
```js
test('overwrite', () => { expect(mergeDeep({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({ a: 1, b: 3, c: 4 }) })
test('nested', () => { expect(mergeDeep({ a: { x: 1 } }, { a: { y: 2 } })).toEqual({ a: { x: 1, y: 2 } }) })
test('arrays concat', () => { expect(mergeDeep({ a: [1] }, { a: [2, 3] })).toEqual({ a: [1, 2, 3] }) })
test('type conflict → second wins', () => { expect(mergeDeep({ a: [1] }, { a: { b: 2 } })).toEqual({ a: { b: 2 } }) })
test('falsy values kept', () => { expect(mergeDeep({ a: 1 }, { a: 0 })).toEqual({ a: 0 }) })
test('no mutation', () => {
  const a = { n: { x: 1 } }
  mergeDeep(a, { n: { y: 2 } })
  expect(a).toEqual({ n: { x: 1 } })
})
```
@@@solution
```js
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function mergeDeep(a, b) {
  const result = { ...a }
  for (const key of Object.keys(b)) {
    const av = a[key]
    const bv = b[key]
    if (isPlainObject(av) && isPlainObject(bv)) result[key] = mergeDeep(av, bv)
    else if (Array.isArray(av) && Array.isArray(bv)) result[key] = [...av, ...bv]
    else result[key] = bv
  }
  return result
}
```
A trap in a common reference implementation: using `if (!v1)` to detect "missing" treats `0`, `''` and `false` as missing, so `merge({a:1},{a:0})` would wrongly keep `1`. Check presence with `key in obj` / `Object.hasOwn`, not truthiness. Start from a shallow copy of `a` and only recurse when both sides are objects, so inputs are never mutated.
:::

:::quiz
### `"a.b.c".split(".").reduceRight((acc, k) => ({ [k]: acc }), 1)` gives
- [ ] { c: { b: { a: 1 } } }
- [x] { a: { b: { c: 1 } } }
- [ ] ["a", "b", "c", 1]
- [ ] Throws
@@@explain
reduceRight starts from "c": {c:1} → {b:{c:1}} → {a:{b:{c:1}}}.
:::

:::quiz
### Why is `if (!value)` a bad "is it missing?" check in merges?
- [ ] It's slower
- [x] It treats 0, "" and false as missing
- [ ] It doesn't work on arrays
- [ ] It throws on undefined
@@@explain
Use `Object.hasOwn(obj, key)` or `value === undefined` instead.
:::
