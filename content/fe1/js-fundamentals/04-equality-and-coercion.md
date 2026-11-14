---
title: Equality, Coercion & Truthiness
summary: == vs ===, how JavaScript converts types behind your back, and the 8 falsy values you must memorise.
minutes: 12
---

## Type coercion in one sentence

**Coercion** is JavaScript automatically converting a value from one type to another when an operator or context needs a different type. It can be **explicit** (`Number("5")`, `String(5)`, `Boolean(x)`) or **implicit** (`"5" * 2`, `if (x)`, `a == b`).

Most "JavaScript is weird" memes are implicit coercion. Once you know the three conversions — **ToNumber**, **ToString**, **ToBoolean** — the weirdness becomes predictable.

## The three conversions

### ToBoolean — truthy and falsy

There are exactly **8 falsy values**. Everything else is truthy.

| Falsy value | Type |
|---|---|
| `false` | boolean |
| `0`, `-0` | number |
| `0n` | bigint |
| `""` (empty string) | string |
| `null` | null |
| `undefined` | undefined |
| `NaN` | number |

Truthy surprises: `"0"`, `"false"`, `" "` (a space), `[]`, `{}`, `function(){}`, `new Boolean(false)` are all **truthy**.

```js
if ([]) console.log("arrays are truthy, even empty ones")
if ("0") console.log("non-empty strings are truthy")
```

### ToNumber

| Value | Number |
|---|---|
| `""`, `" "` | `0` |
| `"42"`, `" 42 "` | `42` |
| `"42px"` | `NaN` |
| `true` / `false` | `1` / `0` |
| `null` | `0` |
| `undefined` | `NaN` |
| `[]` | `0` (via `""`) |
| `[5]` | `5` |
| `[1,2]` | `NaN` |
| `{}` | `NaN` |

### ToString

`String(null)` → `"null"`, `String([1,2])` → `"1,2"`, `String({})` → `"[object Object]"`.

Objects convert to primitives by calling `valueOf()` and/or `toString()` (or `Symbol.toPrimitive` if defined).

## The `+` operator is special

`+` does **string concatenation if either side is a string** (after converting objects to primitives); otherwise numeric addition. Other arithmetic operators (`-`, `*`, `/`) always convert to numbers.

```js
1 + "2"      // "12"
"3" - 1      // 2
"3" * "4"    // 12
1 + true     // 2
[] + []      // ""  (both become "")
[] + {}      // "[object Object]"
"5" + 1 - 1  // 50  ("51" - 1)
+"42"        // 42  (unary plus = ToNumber)
```

## `==` vs `===`

- `===` **strict equality**: no coercion. Different types → `false`. Same type → compare values (objects by reference).
- `==` **loose equality**: if types differ, coerce using a set of rules, then compare.

The simplified `==` algorithm:

1. Same type → behave like `===`.
2. `null == undefined` → `true` (and they equal nothing else).
3. Number vs string → convert the string to a number.
4. Boolean vs anything → convert the boolean to a number first.
5. Object vs primitive → convert the object to a primitive, then retry.

```js
0 == ""            // true  ("" → 0)
"1" == 1           // true
true == 1          // true
true == "1"        // true  (true → 1, "1" → 1)
null == undefined  // true
null == 0          // false (null only == undefined)
[] == false        // true  (false → 0, [] → "" → 0)
[] == ![]          // true  (![] is false, then as above)
NaN == NaN         // false
```

:::callout tip Rule of thumb
Always use `===` and `!==`. The single idiomatic exception is `x == null`, which checks for **both** `null` and `undefined` in one go.
:::

### Object.is

`Object.is(a, b)` is like `===` but fixes two edge cases: `Object.is(NaN, NaN)` is `true` and `Object.is(0, -0)` is `false`. React uses `Object.is` to decide whether state changed.

## Logical operators return values, not booleans

`||` and `&&` return one of their operands:

```js
"" || "default"     // "default"  — first truthy, or last value
"Asha" || "default" // "Asha"
0 && "never"        // 0          — first falsy, or last value
user && user.name   // guard
```

**Nullish coalescing `??`** only falls back on `null`/`undefined` — not on `0` or `""`:

```js
const qty = 0
qty || 10  // 10  ← bug if 0 is a valid quantity
qty ?? 10  // 0   ← correct
```

## Interview questions

:::question
difficulty: easy
companies: Accenture
### What is the difference between == and ===?
`===` (strict equality) compares without type conversion: if the types differ the result is `false`. `==` (loose equality) first coerces operands to a common type using the abstract equality rules — e.g. strings vs numbers become numbers, booleans become numbers, `null == undefined` is true, objects become primitives — and then compares.

```js
"5" == 5   // true
"5" === 5  // false
null == undefined  // true
null === undefined // false
```

Use `===` everywhere except `x == null` as a shorthand for "null or undefined".
:::

:::question
difficulty: easy
### What are the falsy values in JavaScript?
`false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. (Browsers also have the legacy `document.all`.) Everything else — including `"0"`, `"false"`, `[]` and `{}` — is truthy.
:::

:::question
difficulty: medium
### What's the difference between `||` and `??`?
`a || b` returns `b` when `a` is any **falsy** value (`0`, `""`, `false`, `NaN`, null, undefined). `a ?? b` returns `b` only when `a` is **nullish** (`null` or `undefined`). Use `??` for defaults when `0`, `""` or `false` are valid values (e.g. a quantity of 0 or an empty search string).
:::

:::question
difficulty: medium
### Why is `[] == ![]` true?
1. `![]` — arrays are truthy, so `![]` is `false`.
2. `[] == false` — boolean is converted to number: `false → 0`.
3. `[] == 0` — object vs number: `[]` → primitive `""` → number `0`.
4. `0 == 0` → `true`.
:::

## Challenges

:::challenge
difficulty: medium
### Predict the coercion outputs
```js
console.log(1 + "1" - 1)
console.log("b" + "a" + +"a" + "a")
console.log(true + true + "3")
console.log([] + null + 1)
console.log([1, 2] + [3])
console.log("10" / "2")
console.log(null + 1, undefined + 1)
```
@@@solution
```text
10
baNaNa
23
null1
1,23
5
1 NaN
```

- `1 + "1"` → `"11"`, then `"11" - 1` → `10`.
- `+"a"` is `NaN`, concatenated: `"ba" + NaN + "a"` → `"baNaNa"`.
- `true + true` → `2`, then `2 + "3"` → `"23"`.
- `[] + null` → `"" + "null"` → `"null"`, then `+ 1` → `"null1"`.
- Arrays stringify: `"1,2" + "3"` → `"1,23"`.
- `/` converts to numbers → `5`.
- `null → 0`, `undefined → NaN`.
:::

:::challenge
difficulty: easy
### Implement isFalsy without using `!`
Return `true` for the 8 falsy values and `false` for everything else, without using `!`, `Boolean()` or `if (x)` directly on the value.
@@@starter
```js
function isFalsy(value) {
  // your code
}
```
@@@tests
```js
test('falsy values', () => {
  ;[false, 0, -0, 0n, '', null, undefined, NaN].forEach(v => expect(isFalsy(v)).toBe(true))
})
test('truthy values', () => {
  ;['0', 'false', [], {}, 1, -1, ' ', () => {}].forEach(v => expect(isFalsy(v)).toBe(false))
})
```
@@@solution
```js
function isFalsy(value) {
  return value ? false : true // ternary uses ToBoolean
}

// or, enumerating explicitly:
function isFalsyExplicit(v) {
  return v === false || v === 0 || v === 0n || v === '' ||
         v === null || v === undefined || Number.isNaN(v)
}
```
Note `v === 0` is `true` for `-0` too, and `NaN` must be checked with `Number.isNaN` since `NaN !== NaN`.
:::

:::quiz
### Which value is truthy?
- [ ] 0
- [ ] ""
- [x] "0"
- [ ] NaN
@@@explain
Any non-empty string is truthy, including `"0"` and `"false"`.
:::

:::quiz
### `const n = 0; n ?? 5` evaluates to
- [x] 0
- [ ] 5
- [ ] undefined
- [ ] false
@@@explain
`??` only falls back on null/undefined; 0 is kept.
:::
