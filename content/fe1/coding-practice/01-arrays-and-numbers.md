---
title: Warm-ups — Arrays & Numbers
summary: FizzBuzz, frequency counts, missing number, two sum, chunking and de-duplication — with the thinking process interviewers want to hear.
minutes: 25
---

## How to approach a coding question

Junior interviews rarely test obscure algorithms. They test whether you can **turn a problem into clean code while thinking out loud**. Use the same five steps every time:

1. **Clarify** — restate the problem; ask about input size, empty input, duplicates, negative numbers, what to return when nothing is found.
2. **Examples** — write 2–3 small inputs and expected outputs, including an edge case.
3. **Brute force first** — say the simplest correct approach and its complexity.
4. **Optimise** — usually by trading memory for time with a **hash map / Set**, or by sorting, or with two pointers.
5. **Code, then test** — walk through your examples line by line; mention complexity.

:::callout tip The hash-map reflex
Whenever you hear "find", "count", "duplicate", "pair", or "seen before", reach for a `Map`, `Set` or object. Lookups are O(1) on average, which often turns O(n²) nested loops into O(n).
:::

### Big-O in one table

| Complexity | Name | Example |
|---|---|---|
| O(1) | constant | `arr[i]`, `map.get(k)` |
| O(log n) | logarithmic | binary search |
| O(n) | linear | one loop |
| O(n log n) | linearithmic | sorting |
| O(n²) | quadratic | nested loops over the same array |

Every challenge below has a playground: write your code, run the tests, then compare with the solution.

## Challenges

:::challenge
difficulty: easy
companies: Common
### FizzBuzz
Return an array of strings for numbers 1..n: `"FizzBuzz"` for multiples of 3 and 5, `"Fizz"` for multiples of 3, `"Buzz"` for multiples of 5, otherwise the number as a string.
@@@starter
```js
function fizzBuzz(n) {
  // your code
}
```
@@@tests
```js
test('first 15', () => {
  expect(fizzBuzz(15)).toEqual(['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz'])
})
test('zero', () => {
  expect(fizzBuzz(0)).toEqual([])
})
```
@@@solution
```js
function fizzBuzz(n) {
  const out = []
  for (let i = 1; i <= n; i++) {
    let s = ''
    if (i % 3 === 0) s += 'Fizz'
    if (i % 5 === 0) s += 'Buzz'
    out.push(s || String(i))
  }
  return out
}
```
Building the string avoids a separate `% 15` check, and extends nicely if the interviewer adds "Bazz for 7". O(n) time. The classic bug is checking `% 3` before `% 15` in an if/else chain.
:::

:::challenge
difficulty: easy
companies: Common
### Frequency of elements in an array
Return an object mapping each element to how many times it appears.
```js
frequency([1, 2, 2, 3, 3, 3]) // { 1: 1, 2: 2, 3: 3 }
```
Bonus: return the most frequent element.
@@@starter
```js
function frequency(arr) {
  // your code
}
function mostFrequent(arr) {
  // your code
}
```
@@@tests
```js
test('counts numbers', () => {
  expect(frequency([1, 2, 2, 3, 3, 3])).toEqual({ 1: 1, 2: 2, 3: 3 })
})
test('counts strings', () => {
  expect(frequency(['a', 'b', 'a'])).toEqual({ a: 2, b: 1 })
})
test('empty', () => {
  expect(frequency([])).toEqual({})
})
test('most frequent', () => {
  expect(mostFrequent(['x', 'y', 'y', 'z', 'y'])).toBe('y')
})
```
@@@solution
```js
function frequency(arr) {
  const counts = {}
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1
  }
  return counts
}

function mostFrequent(arr) {
  const counts = new Map()
  let best, bestCount = 0
  for (const item of arr) {
    const c = (counts.get(item) ?? 0) + 1
    counts.set(item, c)
    if (c > bestCount) { best = item; bestCount = c }
  }
  return best
}
```
O(n) time, O(k) space for k distinct values. A plain object converts keys to strings (`1` and `"1"` collide); a `Map` keeps original types — mention this trade-off. Reduce version: `arr.reduce((acc, x) => ({ ...acc, [x]: (acc[x] ?? 0) + 1 }), {})` is elegant but O(n²) because of spreading every step — say so.
:::

:::challenge
difficulty: easy
companies: Common
### Find the missing number
An array contains `n` distinct numbers taken from `1..n+1` (one is missing). Find it in O(n) time and O(1) extra space.
```js
missingNumber([3, 7, 1, 2, 8, 4, 5]) // 6
```
@@@hint
What's the sum of 1..m? Or think XOR.
@@@starter
```js
function missingNumber(arr) {
  // your code
}
```
@@@tests
```js
test('middle', () => { expect(missingNumber([3, 7, 1, 2, 8, 4, 5])).toBe(6) })
test('last', () => { expect(missingNumber([1, 2, 3])).toBe(4) })
test('first', () => { expect(missingNumber([2])).toBe(1) })
test('empty', () => { expect(missingNumber([])).toBe(1) })
```
@@@solution
```js
function missingNumber(arr) {
  const m = arr.length + 1                 // numbers should be 1..m
  const expected = (m * (m + 1)) / 2       // Gauss: sum of 1..m
  const actual = arr.reduce((s, x) => s + x, 0)
  return expected - actual
}

// XOR variant — no overflow risk for huge n
function missingNumberXor(arr) {
  let x = 0
  for (let i = 1; i <= arr.length + 1; i++) x ^= i
  for (const v of arr) x ^= v
  return x                                  // pairs cancel (a ^ a = 0), the missing one remains
}
```
Both O(n) time, O(1) space. Sorting would be O(n log n); a Set would be O(n) space. XOR works because `a ^ a = 0` and `a ^ 0 = a` — the reference doc lists XOR/shift operators, so be ready to explain them: `^` XOR, `<<` left shift (×2), `>>` right shift (÷2, sign-preserving).
:::

:::challenge
difficulty: easy
companies: Intuit, PhonePe
### Two Sum
Given an array of numbers and a target, return the indices `[i, j]` of the two numbers that add up to the target (exactly one solution exists; don't use the same element twice).
@@@starter
```js
function twoSum(nums, target) {
  // your code
}
```
@@@tests
```js
test('basic', () => { expect(twoSum([2, 7, 11, 15], 9)).toEqual([0, 1]) })
test('unsorted', () => { expect(twoSum([3, 2, 4], 6)).toEqual([1, 2]) })
test('duplicates', () => { expect(twoSum([3, 3], 6)).toEqual([0, 1]) })
```
@@@solution
```js
function twoSum(nums, target) {
  const seen = new Map() // value -> index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i]
    if (seen.has(need)) return [seen.get(need), i]
    seen.set(nums[i], i)
  }
  return null
}
```
Brute force checks every pair: O(n²). The hash map remembers what we've seen, so for each number we ask in O(1) "have I seen its complement?" → O(n) time, O(n) space. Checking **before** inserting prevents using the same element twice (`[3,3]` works). Follow-ups: "all pairs with a given sum" (PhonePe) — collect instead of returning, and handle duplicates by counting; "sorted input" → two pointers, O(1) space.
:::

:::challenge
difficulty: medium
companies: PhonePe
### All pairs with a given sum
Return all **unique** value pairs `[a, b]` (with `a <= b`) from the array that add up to `target`, sorted by `a`.
```js
pairsWithSum([1, 5, 7, -1, 5], 6) // [[-1, 7], [1, 5]]
```
@@@starter
```js
function pairsWithSum(nums, target) {
  // your code
}
```
@@@tests
```js
test('basic', () => { expect(pairsWithSum([1, 5, 7, -1, 5], 6)).toEqual([[-1, 7], [1, 5]]) })
test('same number twice', () => { expect(pairsWithSum([3, 3, 3], 6)).toEqual([[3, 3]]) })
test('none', () => { expect(pairsWithSum([1, 2], 10)).toEqual([]) })
```
@@@solution
```js
function pairsWithSum(nums, target) {
  const seen = new Set()
  const pairs = new Map()                  // "a,b" -> [a, b] to dedupe
  for (const n of nums) {
    const need = target - n
    if (seen.has(need)) {
      const a = Math.min(n, need), b = Math.max(n, need)
      pairs.set(`${a},${b}`, [a, b])
    }
    seen.add(n)
  }
  return [...pairs.values()].sort((x, y) => x[0] - y[0])
}
```
O(n) to find + O(p log p) to sort the output. Alternative: sort the input and use two pointers moving inward, skipping duplicates — O(n log n) time, O(1) extra space. The "triplets with a given sum" follow-up fixes one element and runs two-pointer on the rest: O(n²).
:::

:::challenge
difficulty: easy
### Chunk an array
Split an array into groups of `size`. The last chunk may be smaller.
```js
chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
```
@@@starter
```js
function chunk(arr, size) {
  // your code
}
```
@@@tests
```js
test('even split', () => { expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]) })
test('remainder', () => { expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]) })
test('size bigger than array', () => { expect(chunk([1, 2], 5)).toEqual([[1, 2]]) })
test('empty', () => { expect(chunk([], 3)).toEqual([]) })
```
@@@solution
```js
function chunk(arr, size) {
  if (size < 1) throw new RangeError('size must be >= 1')
  const out = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}
```
Step the index by `size` and `slice` — `slice` handles the short last chunk automatically. O(n). Real-world uses: pagination, batching API calls, grid rows.
:::

:::challenge
difficulty: easy
### Remove duplicates (keep order)
Return a new array without duplicates, preserving first occurrence order. Then do it for objects by `id`.
@@@starter
```js
function unique(arr) {
  // your code
}
function uniqueBy(arr, key) {
  // your code
}
```
@@@tests
```js
test('primitives', () => { expect(unique([3, 1, 3, 2, 1])).toEqual([3, 1, 2]) })
test('NaN once', () => { expect(unique([NaN, NaN]).length).toBe(1) })
test('by key', () => {
  expect(uniqueBy([{ id: 1, v: 'a' }, { id: 2 }, { id: 1, v: 'b' }], 'id').map(o => o.id)).toEqual([1, 2])
})
```
@@@solution
```js
const unique = (arr) => [...new Set(arr)]

function uniqueBy(arr, key) {
  const seen = new Set()
  return arr.filter((item) => {
    const k = item[key]
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
```
`Set` uses SameValueZero equality, so `NaN` is deduped correctly (unlike `indexOf`, which can't find `NaN`). The `filter + indexOf` approach (`arr.filter((x, i) => arr.indexOf(x) === i)`) is O(n²) — mention why the Set is better: O(n).
:::

:::quiz
### Two Sum with a hash map runs in…
- [ ] O(n²)
- [x] O(n)
- [ ] O(log n)
- [ ] O(1)
@@@explain
One pass, with O(1) average lookups for the complement.
:::

:::quiz
### What is `5 ^ 5` in JavaScript?
- [ ] 3125
- [ ] 25
- [x] 0
- [ ] 10
@@@explain
`^` is bitwise XOR, not exponent (`**`). Any number XOR itself is 0.
:::
