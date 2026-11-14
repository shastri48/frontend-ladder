---
title: Values, Types & References
summary: The 8 types in JavaScript, why primitives are copied but objects are shared, and the typeof quirks every interviewer loves.
minutes: 14
---

## Why types matter even in a "dynamic" language

JavaScript lets you write `let x = 5` and later `x = "hello"`. Variables don't have types — **values** do. Every value you will ever touch in JavaScript belongs to one of exactly **eight types**. Knowing which type you are holding explains a huge class of bugs: why `[] === []` is `false`, why changing an object inside a function changes it outside, why `typeof null` says `"object"`.

:::callout analogy Labels vs boxes
Think of a variable as a **label on a string**, not a box. The label points at a value. Primitive values are like numbers written on a sticky note — if you copy them you get a new note. Objects are like a house — copying the variable copies the *address*, not the house.
:::

## The eight types

| Category | Type | Example | `typeof` result |
|---|---|---|---|
| Primitive | `number` | `42`, `3.14`, `NaN`, `Infinity` | `"number"` |
| Primitive | `bigint` | `9007199254740993n` | `"bigint"` |
| Primitive | `string` | `"hi"`, `'hi'`, `` `hi ${name}` `` | `"string"` |
| Primitive | `boolean` | `true`, `false` | `"boolean"` |
| Primitive | `undefined` | `undefined` | `"undefined"` |
| Primitive | `null` | `null` | `"object"` (historic bug!) |
| Primitive | `symbol` | `Symbol("id")` | `"symbol"` |
| Reference | `object` | `{}`, `[]`, functions, dates, maps | `"object"` / `"function"` |

Seven primitives and one structural type — **object**. Arrays, functions, dates, regexes, `Map`, `Set`, class instances: all objects.

### Primitives are immutable

You cannot change a primitive, only replace it:

```js
let s = "cat"
s[0] = "b"         // silently ignored
console.log(s)     // "cat"
s = "bat"          // the variable now points to a NEW string
```

`s.toUpperCase()` doesn't change `s` either — it returns a new string. This is why string methods always return something.

### `number` is a 64-bit float

There is only one number type for integers and decimals (IEEE-754 double). Consequences:

```js
0.1 + 0.2                 // 0.30000000000000004
0.1 + 0.2 === 0.3         // false
Number.MAX_SAFE_INTEGER   // 9007199254740991 (2^53 - 1)
9007199254740992 === 9007199254740993 // true (!) precision lost
```

For money, work in the smallest unit (paise/cents as integers) or use `BigInt` for very large integers. Compare decimals with a tolerance: `Math.abs(a - b) < Number.EPSILON`.

`NaN` ("not a number") is a number value that is **not equal to itself**: `NaN === NaN` is `false`. Use `Number.isNaN(x)`.

## Primitives vs references: copying and comparing

This is the single most important idea in this lesson.

```js
// Primitives: copied by value
let a = 10
let b = a
b++
console.log(a, b) // 10 11

// Objects: the variable holds a reference (address)
const user = { name: "Asha" }
const admin = user        // same object, two labels
admin.name = "Ravi"
console.log(user.name)    // "Ravi"
```

```text
 Stack (variables)          Heap (objects)
 ┌──────────┐
 │ a  = 10  │
 │ b  = 11  │
 │ user ────┼──────┐
 │ admin ───┼──────┤
 └──────────┘      └──►  { name: "Ravi" }
```

**Comparison** follows the same rule. `===` on objects compares *references* (identity), not contents:

```js
[] === []                  // false — two different arrays
{ a: 1 } === { a: 1 }      // false
const x = {}; x === x      // true
```

This is exactly why React needs you to create a **new** object/array when updating state: React compares by reference to detect change.

### Passing to functions

JavaScript is always **pass-by-value** — but for objects, the value being passed *is a reference*. So a function can mutate the object you passed, but cannot make your variable point somewhere else:

```js
function rename(u) { u.name = "Zoya" }        // mutates shared object
function replace(u) { u = { name: "New" } }   // only rebinds local label

const p = { name: "Asha" }
rename(p);  console.log(p.name) // "Zoya"
replace(p); console.log(p.name) // "Zoya" (unchanged)
```

### Copying objects

```js
const original = { name: "A", address: { city: "Pune" } }
const shallow = { ...original }          // or Object.assign({}, original)
shallow.address.city = "Goa"
console.log(original.address.city)       // "Goa" — nested object is shared!

const deep = structuredClone(original)   // real deep copy (modern browsers)
```

A **shallow copy** copies the top level only. A **deep copy** recursively copies everything. `JSON.parse(JSON.stringify(obj))` works for plain data but drops functions, `undefined`, turns dates into strings, and throws on circular references. Prefer `structuredClone`.

## `typeof` and its quirks

```js
typeof 42            // "number"
typeof "x"           // "string"
typeof undefined     // "undefined"
typeof undeclaredVar // "undefined" — no ReferenceError!
typeof null          // "object"   ← bug from 1995, never fixed
typeof []            // "object"
typeof function(){}  // "function" (functions are callable objects)
typeof NaN           // "number"
typeof Symbol()      // "symbol"
typeof 10n           // "bigint"
```

Reliable checks:

| Want to know | Use |
|---|---|
| Is it an array? | `Array.isArray(x)` |
| Is it null? | `x === null` |
| Is it null or undefined? | `x == null` (the one good use of `==`) |
| Is it NaN? | `Number.isNaN(x)` |
| Is it a plain object? | `x !== null && typeof x === "object" && !Array.isArray(x)` |
| Exact built-in type | `Object.prototype.toString.call(x)` → `"[object Date]"` |

## `null` vs `undefined`

- `undefined` — "no value has been assigned". Default for uninitialised variables, missing properties, missing arguments, functions without `return`.
- `null` — "intentionally empty". You set it on purpose.

```js
let a;            // undefined
const o = {};
o.missing         // undefined
function f(x) { return x } f() // undefined
let selected = null // deliberately "nothing selected"
```

## Wrapper objects: why `"abc".length` works

Primitives have no properties, yet `"abc".length` and `(5).toFixed(2)` work. JavaScript temporarily wraps the primitive in an object (`String`, `Number`, `Boolean`), looks up the method, then throws the wrapper away. Never create wrappers yourself (`new String("a")`) — `typeof new String("a")` is `"object"` and it's truthy even for `new Boolean(false)`.

:::callout warn Common pitfall
`const` does not make objects immutable. `const arr = []; arr.push(1)` is perfectly legal. `const` only prevents **reassigning the label**. Use `Object.freeze` (shallow) if you need immutability.
:::

## Interview questions

:::question
difficulty: easy
### What are the data types in JavaScript?
There are **8 types**: seven primitives — `number`, `bigint`, `string`, `boolean`, `undefined`, `null`, `symbol` — and `object`. Arrays, functions, dates, maps and sets are all objects.

Primitives are immutable and compared/copied by value. Objects are mutable and the variable holds a reference, so copying the variable shares the same object and `===` compares identity.

**In an interview, say:** "Seven primitives plus object; primitives are copied by value, objects are passed around by reference-value."
:::

:::question
difficulty: easy
### Why does `typeof null` return "object"?
It's a bug from the first JavaScript implementation (1995). Values were stored with a type tag; objects had tag `0`, and `null` was represented as the NULL pointer (all zeros), so it got read as an object. Fixing it would break existing websites, so it was kept. Check for null with `x === null`.
:::

:::question
difficulty: easy
### What is the difference between null and undefined?
`undefined` means a value was never assigned (default for variables, missing properties, missing params, functions without return). `null` is an explicit "empty" value set by the programmer. `typeof undefined` is `"undefined"`, `typeof null` is `"object"`. `null == undefined` is `true` but `null === undefined` is `false`. In arithmetic `null` becomes `0` and `undefined` becomes `NaN`.
:::

:::question
difficulty: medium
### Is JavaScript pass-by-value or pass-by-reference?
Always **pass-by-value**. For objects, the value copied into the parameter is a *reference*. So inside the function you can mutate the object (the caller sees it), but reassigning the parameter does not affect the caller's variable. This is sometimes called "pass by sharing".

```js
function f(o) { o.x = 1; o = { x: 2 } }
const obj = {}
f(obj)
obj.x // 1
```
:::

:::question
difficulty: medium
### Why is `0.1 + 0.2 !== 0.3`?
Numbers are IEEE-754 binary floating point. 0.1 and 0.2 cannot be represented exactly in binary (like 1/3 in decimal), so tiny rounding errors appear: `0.30000000000000004`. Fixes: compare with a tolerance (`Math.abs(a-b) < Number.EPSILON`), round for display (`toFixed`), or do money in integer minor units. For huge integers, use `BigInt`.
:::

:::question
difficulty: medium
### What is the difference between a shallow copy and a deep copy?
A shallow copy (`{...obj}`, `Object.assign`, `arr.slice()`, `[...arr]`) copies only the top level — nested objects are still shared. A deep copy recursively duplicates everything so no references are shared. Use `structuredClone(obj)` for deep copies of data (handles Dates, Maps, Sets, circular refs, but not functions or DOM nodes). `JSON.parse(JSON.stringify(x))` is a lossy alternative.
:::

## Challenges

:::challenge
difficulty: easy
### Predict the output
```js
const a = { n: 1 }
const b = a
b.n = 2
let c = a.n
c = 3
console.log(a.n, b.n, c)
console.log([1, 2] === [1, 2])
console.log(typeof typeof 1)
```
@@@solution
Output:

```text
2 2 3
false
string
```

- `b` and `a` point to the same object, so `b.n = 2` changes `a.n` too.
- `c` is a **primitive copy** of `a.n` (2); reassigning `c` doesn't affect the object.
- Two array literals are two different objects → different references → `false`.
- `typeof 1` is the string `"number"`, and `typeof "number"` is `"string"`.
:::

:::challenge
difficulty: easy
### Write a reliable `getType(value)`
Return one of: `"null"`, `"undefined"`, `"array"`, `"date"`, `"object"`, `"function"`, `"number"`, `"string"`, `"boolean"`, `"symbol"`, `"bigint"`, `"map"`, `"set"`, `"regexp"`.
@@@hint
`Object.prototype.toString.call(x)` returns strings like `"[object Array]"`.
@@@starter
```js
function getType(value) {
  // your code
}
```
@@@tests
```js
test('primitives', () => {
  expect(getType(1)).toBe('number')
  expect(getType('a')).toBe('string')
  expect(getType(null)).toBe('null')
  expect(getType(undefined)).toBe('undefined')
  expect(getType(true)).toBe('boolean')
  expect(getType(10n)).toBe('bigint')
})
test('objects', () => {
  expect(getType([])).toBe('array')
  expect(getType({})).toBe('object')
  expect(getType(new Date())).toBe('date')
  expect(getType(() => {})).toBe('function')
  expect(getType(new Map())).toBe('map')
  expect(getType(/a/)).toBe('regexp')
})
```
@@@solution
```js
function getType(value) {
  return Object.prototype.toString
    .call(value)          // "[object Array]"
    .slice(8, -1)         // "Array"
    .toLowerCase()        // "array"
}
```

`Object.prototype.toString` reads the internal `[[Class]]` / `Symbol.toStringTag` of any value, including `null` (`"[object Null]"`) and `undefined`. It's the most reliable built-in type check. Note that a class instance returns `"object"` unless the class defines `Symbol.toStringTag`.
:::

:::quiz
### What does `const` prevent?
- [ ] Mutating the object it holds
- [x] Reassigning the variable to a new value
- [ ] Both
- [ ] Nothing in strict mode
@@@explain
`const` locks the binding (label), not the value. `const a = []; a.push(1)` is fine; `a = []` throws.
:::

:::quiz
### `typeof []` returns…
- [ ] "array"
- [x] "object"
- [ ] "list"
- [ ] "undefined"
@@@explain
Arrays are objects. Use `Array.isArray` to detect them.
:::

:::quiz
### Which is a correct deep copy of plain data including Dates and Maps?
- [ ] `{ ...obj }`
- [ ] `Object.assign({}, obj)`
- [x] `structuredClone(obj)`
- [ ] `obj.slice()`
@@@explain
Spread and `Object.assign` are shallow. `structuredClone` deep-copies and preserves Dates, Maps, Sets and circular references.
:::
