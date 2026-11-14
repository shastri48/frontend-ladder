---
title: Objects, Arrays & Essential Methods
summary: Working with data like a pro — map, filter, reduce, find, sort, flat, string methods, destructuring and optional chaining.
minutes: 18
---

## Objects: key-value bags

```js
const user = {
  id: 7,
  name: "Asha",
  "favourite-color": "teal",     // keys with dashes need quotes
  address: { city: "Pune" },
  greet() { return `Hi, ${this.name}` },
}

user.name                // dot access
user["favourite-color"]  // bracket access (any string / computed key)
const key = "id"
user[key]                // 7

user.age = 28            // add
delete user.age          // remove
"name" in user           // true
Object.hasOwn(user, "name") // true (own property, not inherited)
```

Iterating:

```js
Object.keys(user)     // ["id", "name", ...]
Object.values(user)
Object.entries(user)  // [["id", 7], ["name", "Asha"], ...]
for (const [k, v] of Object.entries(user)) console.log(k, v)

Object.fromEntries([["a", 1], ["b", 2]]) // { a: 1, b: 2 }
```

**Computed keys and shorthand:**

```js
const field = "email"
const value = "a@b.com"
const obj = { [field]: value, value }  // { email: "a@b.com", value: "a@b.com" }
```

## Destructuring

Pull values out of objects/arrays into variables.

```js
const { name, address: { city }, role = "viewer" } = user
// name = "Asha", city = "Pune", role = "viewer" (default)

const { name: userName } = user  // rename

const [first, second, ...rest] = [10, 20, 30, 40]
const [, , third] = [1, 2, 3]    // skip
let a = 1, b = 2;
[a, b] = [b, a]                  // swap

function render({ title, items = [] }) { /* params destructuring */ }
```

React props, `useState` and hook return values all lean on destructuring.

## Optional chaining and nullish coalescing

```js
const city = user?.address?.city        // undefined instead of throwing
const firstTag = post.tags?.[0]
const result = api.onDone?.()           // call only if it exists
const label = user.nickname ?? user.name // fallback only on null/undefined
```

`?.` short-circuits: if the left side is `null` or `undefined`, the whole expression returns `undefined`.

## Arrays and the methods you'll use daily

Arrays are ordered lists (objects with numeric keys and a `length`).

### Mutating vs non-mutating

This matters enormously in React, where you must never mutate state.

| Mutates the array | Returns a new array/value |
|---|---|
| `push`, `pop`, `shift`, `unshift` | `map`, `filter`, `slice`, `concat` |
| `splice`, `sort`, `reverse`, `fill` | `flat`, `flatMap`, spread `[...a]` |
| | `toSorted`, `toReversed`, `toSpliced`, `with` (ES2023) |

### map, filter, reduce

```js
const products = [
  { id: 1, name: "iPhone",  category: "Mobile", price: 900 },
  { id: 2, name: "MacBook", category: "Laptop", price: 1800 },
  { id: 3, name: "Pixel",   category: "Mobile", price: 700 },
]

products.map(p => p.name)               // ["iPhone", "MacBook", "Pixel"]
products.filter(p => p.price < 1000)    // iPhone, Pixel
products.reduce((sum, p) => sum + p.price, 0) // 3400
```

- **map** — transform each item → same length.
- **filter** — keep items where the callback returns truthy → same or shorter.
- **reduce** — fold the array into **one value** (number, object, array…). Takes `(accumulator, item, index, array)` and an initial value.

```text
reduce((acc, p) => acc + p.price, 0)
 acc:   0 ──+900──► 900 ──+1800──► 2700 ──+700──► 3400
```

Always pass the initial value; without it, reduce uses the first element and throws on empty arrays.

**Grouping with reduce** (a very common interview task):

```js
const byCategory = products.reduce((groups, p) => {
  (groups[p.category] ??= []).push(p)
  return groups
}, {})
// { Mobile: [iPhone, Pixel], Laptop: [MacBook] }

// Modern built-in (ES2024):
Object.groupBy(products, p => p.category)
```

### find, findIndex, some, every, includes

```js
products.find(p => p.id === 2)       // the MacBook object (or undefined)
products.findIndex(p => p.id === 2)  // 1 (or -1)
products.some(p => p.price > 1500)   // true  — at least one
products.every(p => p.price > 500)   // true  — all
[1, 2, NaN].includes(NaN)            // true  (indexOf would return -1)
products.at(-1)                      // last item
```

`some`/`every`/`find` **short-circuit** — they stop at the first decisive item.

### sort — the gotcha

```js
[10, 9, 1, 100].sort()                 // [1, 10, 100, 9] — compares as STRINGS
[10, 9, 1, 100].sort((a, b) => a - b)  // [1, 9, 10, 100]
products.toSorted((a, b) => a.price - b.price) // non-mutating
names.sort((a, b) => a.localeCompare(b))
```

The comparator returns negative (a first), positive (b first) or zero.

### flat and flatMap

```js
[1, [2, [3, [4]]]].flat()          // [1, 2, [3, [4]]]
[1, [2, [3, [4]]]].flat(Infinity)  // [1, 2, 3, 4]
["a b", "c"].flatMap(s => s.split(" ")) // ["a", "b", "c"]
```

### forEach vs map

`forEach` returns `undefined` — use it for side effects. `map` returns a new array — use it to transform. You can't `break` out of `forEach`; use `for...of`, `some` or `find` instead.

### Chaining

```js
const cheapMobileNames = products
  .filter(p => p.category === "Mobile")
  .filter(p => p.price < 800)
  .map(p => p.name)                  // ["Pixel"]
```

## String methods

Strings are immutable — every method returns a new string.

```js
const s = "  Hello, Frontend Ladder  "
s.trim()                    // "Hello, Frontend Ladder"
s.toLowerCase()
s.includes("Ladder")        // true
s.startsWith("  He")        // true
s.indexOf("o")              // 6
s.slice(2, 7)               // "Hello"
s.split(",")                // ["  Hello", " Frontend Ladder  "]
"a-b-c".replaceAll("-", "/")// "a/b/c"
"5".padStart(3, "0")        // "005"
"ha".repeat(3)              // "hahaha"
[..."héllo"].reverse().join("") // reverse a string
`Total: ${2 + 3}`           // template literal
```

## Maps and Sets (quick intro)

```js
const seen = new Set([1, 2, 2, 3])   // {1, 2, 3}
[...new Set(arr)]                    // dedupe an array

const counts = new Map()
counts.set("a", 1).get("a")          // 1
// Map keys can be any type (objects too) and preserve insertion order
```

Use a `Map` for frequent add/remove and non-string keys; a plain object for fixed-shape records/JSON.

## Interview questions

:::question
difficulty: easy
### What's the difference between map, filter, reduce and forEach?
- `map(fn)` → new array of the same length with each item transformed.
- `filter(fn)` → new array with only items where `fn` is truthy.
- `reduce(fn, init)` → a single accumulated value of any type.
- `forEach(fn)` → runs `fn` for side effects, returns `undefined`, cannot be chained or broken out of.

None of them mutate the original array (though your callback could).
:::

:::question
difficulty: easy
### Why does `[10, 1, 3].sort()` give `[1, 10, 3]`?
Without a comparator, `sort` converts items to strings and compares UTF-16 code units, so `"10"` comes before `"3"`. Pass a comparator: `arr.sort((a, b) => a - b)`. Also remember `sort` mutates; use `toSorted` or `[...arr].sort()` for a copy.
:::

:::question
difficulty: easy
### What is optional chaining?
`a?.b` returns `undefined` instead of throwing if `a` is `null` or `undefined`. Works for properties (`a?.b`), computed access (`a?.[key]`) and calls (`fn?.()`). It short-circuits the rest of the chain. Don't overuse it to hide data you expect to exist — that hides bugs.
:::

:::question
difficulty: medium
### Which array methods mutate the original array?
`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`. Non-mutating alternatives: spread/`concat` instead of push, `slice` instead of splice, `toSorted`, `toReversed`, `toSpliced`, `with(index, value)`. In React state updates, always use the non-mutating versions.
:::

## Challenges

:::challenge
difficulty: easy
### Group products by category
Given an array of products, return an object keyed by category whose values are arrays of products in that category. Use `reduce`.
```js
groupBy([
  { id: 1, category: "Mobile", name: "iPhone" },
  { id: 2, category: "Laptop", name: "MacBook" },
  { id: 3, category: "Mobile", name: "Pixel" },
])
// { Mobile: [{id:1...}, {id:3...}], Laptop: [{id:2...}] }
```
@@@starter
```js
function groupBy(products) {
  // your code
}
```
@@@tests
```js
test('groups by category', () => {
  const out = groupBy([
    { id: 1, category: 'Mobile', name: 'iPhone' },
    { id: 2, category: 'Laptop', name: 'MacBook' },
    { id: 3, category: 'Mobile', name: 'Pixel' },
  ])
  expect(out.Mobile.map(p => p.id)).toEqual([1, 3])
  expect(out.Laptop.map(p => p.id)).toEqual([2])
})
test('empty input', () => {
  expect(groupBy([])).toEqual({})
})
```
@@@solution
```js
function groupBy(products) {
  return products.reduce((acc, product) => {
    const key = product.category
    if (!acc[key]) acc[key] = []
    acc[key].push(product)
    return acc
  }, {})
}
```
Time O(n), space O(n). Generalise it with a key function: `groupBy(arr, item => item.category)`. Modern runtimes ship `Object.groupBy(arr, fn)`.
:::

:::challenge
difficulty: easy
### Implement your own `map` and `filter` on Array.prototype
Write `Array.prototype.myMap` and `Array.prototype.myFilter` that behave like the originals (callback receives `item, index, array`; second argument is `thisArg`).
@@@starter
```js
Array.prototype.myMap = function (callback, thisArg) {
  // your code
}
Array.prototype.myFilter = function (callback, thisArg) {
  // your code
}
```
@@@tests
```js
test('myMap', () => {
  expect([1, 2, 3].myMap(x => x * 2)).toEqual([2, 4, 6])
  expect(['a', 'b'].myMap((x, i) => x + i)).toEqual(['a0', 'b1'])
})
test('myFilter', () => {
  expect([1, 2, 3, 4].myFilter(x => x % 2 === 0)).toEqual([2, 4])
})
test('thisArg', () => {
  const ctx = { k: 10 }
  expect([1].myMap(function (x) { return x + this.k }, ctx)).toEqual([11])
})
```
@@@solution
```js
Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function')
  const result = new Array(this.length)
  for (let i = 0; i < this.length; i++) {
    if (i in this) result[i] = callback.call(thisArg, this[i], i, this) // skip holes
  }
  return result
}

Array.prototype.myFilter = function (callback, thisArg) {
  const result = []
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) result.push(this[i])
  }
  return result
}
```
`this` inside the method is the array it's called on, so we must use a normal `function`, not an arrow. `i in this` mimics the spec's handling of sparse arrays. (FE2 covers `reduce` and more polyfills.)
:::

:::challenge
difficulty: easy
### Remove duplicates and count
Given an array of strings, return `{ unique: [...], counts: { word: n } }` preserving first-seen order.
@@@starter
```js
function analyze(words) {
  // your code
}
```
@@@tests
```js
test('analyze', () => {
  const r = analyze(['a', 'b', 'a', 'c', 'b', 'a'])
  expect(r.unique).toEqual(['a', 'b', 'c'])
  expect(r.counts).toEqual({ a: 3, b: 2, c: 1 })
})
```
@@@solution
```js
function analyze(words) {
  const counts = {}
  for (const w of words) counts[w] = (counts[w] ?? 0) + 1
  return { unique: [...new Set(words)], counts }
}
```
A `Set` preserves insertion order, so spreading it gives first-seen order. One pass for counts → O(n).
:::

:::quiz
### Which method returns a single value built from all items?
- [ ] map
- [ ] filter
- [x] reduce
- [ ] forEach
@@@explain
`reduce` folds the array into one accumulator of any type.
:::

:::quiz
### Which of these does NOT mutate the array?
- [ ] sort
- [ ] splice
- [x] slice
- [ ] reverse
@@@explain
`slice` returns a copy of a section; `splice` changes the array in place.
:::

:::quiz
### `const { a: { b } = {} } = { }` — what is `b`?
- [ ] Throws TypeError
- [x] undefined
- [ ] {}
- [ ] null
@@@explain
`a` is missing so it defaults to `{}`, and `b` from `{}` is `undefined`.
:::
