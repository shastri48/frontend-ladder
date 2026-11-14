---
title: Numbers, JSON & Modules — The Sharp Edges
summary: Why 0.1 + 0.2 !== 0.3, BigInt vs Number for money, what JSON.stringify's replacer and reviver can do, and ES modules vs CommonJS.
minutes: 15
---

## Numbers: IEEE 754 doubles

Every `number` in JavaScript is a **64-bit floating point** value (IEEE 754 double precision): 1 sign bit, 11 exponent bits, 52 fraction bits. That gives:

- About **15–17 significant decimal digits** of precision.
- Exact integers only up to `Number.MAX_SAFE_INTEGER` = 2^53 − 1 = `9007199254740991`.
- Special values: `Infinity`, `-Infinity`, `NaN`, and even `-0`.

### Why `0.1 + 0.2 !== 0.3`

Just as 1/3 can't be written exactly in decimal (0.3333…), 0.1 can't be written exactly in **binary** (0.0001100110011…₂ repeating). The stored values are the nearest representable doubles, and their sum lands on a slightly different nearest double:

```js
0.1 + 0.2            // 0.30000000000000004
0.1 + 0.2 === 0.3    // false
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON // true — compare with a tolerance
(0.1 + 0.2).toFixed(2) // "0.30" — for display only
```

### Beyond safe integers

```js
2 ** 53 === 2 ** 53 + 1                    // true!
Number.isSafeInteger(9007199254740993)     // false
JSON.parse('{"id": 9007199254740993}').id  // 9007199254740992 — silently wrong
```

That last one bites real apps: 64-bit IDs from a backend (Twitter/X, Snowflake IDs, payment references) lose precision when parsed. Send them as **strings**.

## Money: BigInt vs Number (Coinbase question)

"Floats betray you" with money:

```js
0.07 * 100       // 7.000000000000001
1.005.toFixed(2) // "1.00" (!) because 1.005 is really 1.00499999999999989…
```

Options, best first:

1. **Integer minor units.** Store paise/cents as integers: ₹10.50 → `1050`. Addition/subtraction are exact as long as you stay within the safe range (±9 quadrillion paise is plenty for most apps).
2. **`BigInt`** when amounts can exceed 2^53 or you need exact large integer math — common in crypto where amounts are in the smallest unit (wei = 10^-18 ETH):
   ```js
   const wei = 1500000000000000000n // 1.5 ETH
   const fee = 21000n * 30000000000n
   wei - fee // exact
   ```
   BigInt caveats: can't mix with `number` (`1n + 1` → TypeError), no decimals (division truncates: `7n / 2n === 3n`), not supported by `JSON.stringify` (TypeError) or `Math.*`, and slower.
3. **Decimal libraries** (`decimal.js`, `big.js`, `dinero.js`) for arbitrary-precision decimals, rounding modes and currency handling.
4. **Format with `Intl.NumberFormat`** — never with string concatenation:
   ```js
   new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(1050 / 100)
   // "₹10.50"
   ```

Rule: do the math in integers (minor units/BigInt) and only convert to a decimal for **display**.

## Other number gotchas

```js
NaN === NaN              // false — use Number.isNaN(x)
isNaN('abc')             // true (coerces) vs Number.isNaN('abc') // false
0 === -0                 // true; Object.is(0, -0) // false
parseInt('08')           // 8; always pass a radix: parseInt(x, 10)
parseInt(0.0000005)      // 5 (!) because String(0.0000005) is "5e-7"
[10, 9, 1].sort()        // [1, 10, 9] — default sort is lexicographic
[10, 9, 1].sort((a, b) => a - b) // [1, 9, 10]
```

## JSON.stringify: more than you think

`JSON.stringify(value, replacer, space)`

### What gets dropped or changed

| Value | In an object | In an array | Top level |
|---|---|---|---|
| `undefined`, function, Symbol | **key omitted** | becomes `null` | returns `undefined` |
| `NaN`, `Infinity` | `null` | `null` | `"null"` |
| `Date` | ISO string (via `toJSON`) | same | same |
| `Map`, `Set` | `{}` | `{}` | `"{}"` |
| `BigInt` | **TypeError** | TypeError | TypeError |
| Circular reference | **TypeError** | TypeError | — |

Objects can customise output with a `toJSON()` method (that's how `Date` works).

### The replacer (Intuit question: "What can the replacer function do?")

The replacer can be:

**An array** — a whitelist of keys to include:

```js
JSON.stringify({ id: 1, name: 'Ana', password: 'x' }, ['id', 'name'])
// '{"id":1,"name":"Ana"}'
```

**A function** `(key, value) => newValue`, called for every key/value **recursively**, starting with key `""` for the root (`this` is the parent object). Return `undefined` to drop a key. Uses:

```js
const data = { user: 'ana', token: 'secret', total: 10n, tags: new Set(['a']) }

JSON.stringify(data, (key, value) => {
  if (key === 'token') return undefined           // redact / drop sensitive fields
  if (typeof value === 'bigint') return value.toString() // serialise BigInt
  if (value instanceof Set) return [...value]      // serialise Set/Map
  return value
})
// '{"user":"ana","total":"10","tags":["a"]}'
```

Also: handling circular references with a `WeakSet` of seen objects, rounding numbers, renaming/transforming values, logging.

```js
function safeStringify(obj) {
  const seen = new WeakSet()
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  })
}
```

The third argument `space` pretty-prints (`2`, or a string like `'\t'`).

### The reviver in JSON.parse

```js
JSON.parse('{"at":"2026-01-01T00:00:00.000Z"}', (key, value) =>
  key === 'at' ? new Date(value) : value
)
```

## ES Modules vs CommonJS

| | ES Modules (ESM) | CommonJS (CJS) |
|---|---|---|
| Syntax | `import` / `export` | `require()` / `module.exports` |
| Loading | Static structure, async-capable loading | Synchronous, at runtime |
| Analysis | Imports known at parse time → **tree shaking** | Dynamic; hard to tree-shake |
| Bindings | **Live bindings** (importer sees updated exports) | A **copy** of `module.exports` at require time |
| `this` at top level | `undefined` | `module.exports` |
| Strict mode | Always | Opt-in |
| Top-level `await` | Yes | No |
| Browser | Native (`<script type="module">`) | Needs bundler |
| Conditional/dynamic | `import()` returns a promise | `require` anywhere |

```js
// counter.mjs
export let count = 0
export function inc() { count++ }

// main.mjs
import { count, inc } from './counter.mjs'
inc()
console.log(count) // 1 — live binding
```

With CommonJS, `const { count } = require('./counter')` would copy `0` and stay `0`.

`import()` (dynamic import) is the foundation of **code splitting** — bundlers create a separate chunk for each dynamically imported module (`React.lazy(() => import('./Page'))`).

Module scripts are **deferred by default**, execute once per URL (cached), and are fetched with CORS.

## Interview questions

:::question
difficulty: medium
companies: Coinbase
### BigInt vs Number for financial amounts — what would you use and why?
`number` is a binary floating-point double, so decimal fractions like 0.1 aren't exact and arithmetic accumulates rounding errors (`0.1 + 0.2 = 0.30000000000000004`), and integers above 2^53 − 1 lose precision. For money, do math in **integer minor units** (cents/paise) — exact with `number` within the safe range — and switch to `BigInt` when values can exceed 2^53 (crypto amounts in wei/satoshi, aggregated totals) or use a decimal library for fractional math with explicit rounding. Transfer large values as strings in JSON (BigInt isn't JSON-serialisable and `JSON.parse` would corrupt big numbers). Format only at the edge with `Intl.NumberFormat`.
:::

:::question
difficulty: medium
companies: Intuit
### What can the replacer function in JSON.stringify do?
It controls serialisation. As an **array**, it whitelists which keys are included. As a **function** `(key, value)`, it's called for every property recursively (root first with key `""`), and its return value replaces the original: return `undefined` to omit a key (redact secrets), convert unsupported types (BigInt → string, Map/Set → arrays/objects), break circular references, transform/round values. Combined with `toJSON()` on objects and `space` for pretty printing.
:::

:::question
difficulty: easy
### Why is 0.1 + 0.2 not equal to 0.3?
Numbers are IEEE 754 binary doubles. 0.1 and 0.2 have infinite binary expansions, so they're stored as the nearest representable approximations; adding them yields a double that's not the nearest one to 0.3. Compare with a tolerance (`Math.abs(a - b) < Number.EPSILON`), round for display, or use integer arithmetic.
:::

:::question
difficulty: medium
### ES modules vs CommonJS — key differences?
ESM uses static `import/export`, is always strict, supports top-level await and async loading, exports **live bindings**, and enables tree shaking because the dependency graph is known before execution. CJS uses `require/module.exports`, loads synchronously at runtime, exports a value copy and is hard to tree-shake. Browsers run ESM natively; Node supports both (with interop rules). Use ESM for new code.
:::

## Challenges

:::challenge
difficulty: easy
### Sum money safely
Write `addMoney(...amounts)` that takes decimal rupee amounts (up to 2 decimals) and returns the sum as a number rounded correctly to 2 decimals, avoiding float errors by working in paise.
@@@starter
```js
function addMoney(...amounts) {
  // your code
}
```
@@@tests
```js
test('avoids float error', () => {
  expect(addMoney(0.1, 0.2)).toBe(0.3)
})
test('handles many values', () => {
  expect(addMoney(19.99, 5.01, 0.07)).toBe(25.07)
})
test('no args gives 0', () => {
  expect(addMoney()).toBe(0)
})
```
@@@solution
```js
function addMoney(...amounts) {
  const paise = amounts.reduce((sum, a) => sum + Math.round(a * 100), 0)
  return paise / 100
}
```
`Math.round(a * 100)` converts each amount to an exact integer number of paise (rounding away tiny binary errors like `0.07 * 100 = 7.000000000000001`). Integer addition is exact; we divide once at the end. Production code would accept and return integers (or strings) to avoid floats entirely.
:::

:::challenge
difficulty: medium
### Stringify with redaction and BigInt support
Write `serialize(obj, secretKeys)` that returns JSON where any key in `secretKeys` (at any depth) has its value replaced by `"***"`, and BigInt values are serialised as strings.
@@@starter
```js
function serialize(obj, secretKeys = []) {
  // your code
}
```
@@@tests
```js
test('redacts nested keys', () => {
  const out = serialize({ a: 1, auth: { token: 'x', user: 'u' } }, ['token'])
  expect(JSON.parse(out)).toEqual({ a: 1, auth: { token: '***', user: 'u' } })
})
test('serialises BigInt', () => {
  expect(serialize({ amount: 10n })).toBe('{"amount":"10"}')
})
```
@@@solution
```js
function serialize(obj, secretKeys = []) {
  const secrets = new Set(secretKeys)
  return JSON.stringify(obj, (key, value) => {
    if (secrets.has(key)) return '***'
    if (typeof value === 'bigint') return value.toString()
    return value
  })
}
```
The replacer runs for every key at every depth, so a single check handles nested secrets. Returning a string for BigInt avoids the `TypeError`.
:::

:::challenge
difficulty: medium
### What gets logged?
```js
console.log(JSON.stringify({ a: undefined, b: () => 1, c: NaN, d: [undefined, 1], e: new Date(0) }))
```
@@@solution
```text
{"c":null,"d":[null,1],"e":"1970-01-01T00:00:00.000Z"}
```
`undefined` and functions as object values are **omitted**; in arrays they become `null`. `NaN` becomes `null`. `Date` serialises through its `toJSON()` to an ISO string.
:::

## Quick check

:::quiz
### What's the safest representation for a 64-bit order ID from an API?
- [ ] number
- [ ] float
- [x] string
- [ ] Date
@@@explain
IDs above 2^53 lose precision as numbers; strings preserve them exactly.
:::

:::quiz
### Which module system supports tree shaking well?
- [x] ES modules, because imports/exports are static
- [ ] CommonJS, because require is synchronous
- [ ] Both equally
- [ ] Neither
@@@explain
Static import/export lets bundlers know at build time which exports are unused.
:::
