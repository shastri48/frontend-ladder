---
title: Complexity & Hash Maps — The 80% Toolkit
summary: Big-O without the maths anxiety, how hash tables give O(1) lookups, and the hash-map problems frontend interviews ask most — two sum, three sum, pairs, frequency, top-k and first unique.
minutes: 20
---

## Why frontend engineers need DSA

Frontend DSA rounds (Groww, Tekion, PhonePe, Intuit, Uber, Reddit, Noon) rarely ask exotic algorithms. They ask **practical** problems: counting, grouping, searching, de-duplicating, walking trees (the DOM is a tree!), and grids (a game board, a spreadsheet). Master hash maps, two pointers, sliding window, trees and BFS/DFS and you cover most of them.

And it matters in real UI work: filtering 50,000 rows with a nested `.includes()` (O(n²)) can freeze a page for seconds; the same with a `Set` (O(n)) takes milliseconds.

## Big-O in one page

Big-O describes how work **grows** as input size `n` grows, ignoring constants.

| Big-O | Name | Example | n = 10,000 → ops |
|---|---|---|---|
| O(1) | Constant | `map.get(k)`, `arr[i]` | 1 |
| O(log n) | Logarithmic | Binary search, balanced tree lookup | ~14 |
| O(n) | Linear | One loop, `arr.includes`, `indexOf` | 10,000 |
| O(n log n) | Linearithmic | `arr.sort()` | ~140,000 |
| O(n²) | Quadratic | Nested loops over the same array | 100,000,000 |
| O(2ⁿ) | Exponential | Naive recursive fibonacci, all subsets | astronomical |

Rules of thumb:

- Sequential steps **add**: O(n) + O(n) = O(n). Nested steps **multiply**: a loop inside a loop is O(n·m).
- Drop constants and lower-order terms: O(2n + 5) → O(n).
- **Space complexity** counts extra memory (new arrays, maps, recursion stack depth).
- Hidden costs in JS: `arr.includes`, `indexOf`, `splice`, `shift`/`unshift`, spreading `[...arr]`, `Object.keys(obj)` are all O(n). Calling them inside a loop makes it O(n²).

:::callout interview How to talk through a problem
1. Restate and clarify (input size? duplicates? negative numbers? sorted?).
2. Give the brute force and its complexity.
3. Find the bottleneck and the data structure that removes it (usually a hash map or sorting).
4. Code it cleanly, then walk through an example and edge cases (empty, one element, duplicates).
5. State time and space complexity.
:::

## How hash tables stay O(1) on average

Reddit asks this directly. A hash table (JS `Map`, `Set`, and plain objects in practice) stores entries in an array of **buckets**:

```text
key "apple" ──hash()──► 2_847_331 ──% 8──► bucket 3 ──► [("apple", 5)]
key "kiwi"  ──hash()──► 1_002_114 ──% 8──► bucket 2 ──► [("kiwi", 1)]
key "plum"  ──hash()──► 9_550_019 ──% 8──► bucket 3 ──► [("apple",5), ("plum",2)]  ← collision
```

1. A **hash function** turns the key into a number quickly and spreads keys uniformly.
2. `hash % capacity` picks a bucket — direct array indexing is O(1).
3. **Collisions** (two keys in one bucket) are handled by chaining (a small list per bucket) or open addressing (probe the next slot).
4. The table tracks its **load factor** (entries / buckets). When it gets too high (~0.75), it **resizes** (doubles) and rehashes everything — O(n) once, but rare, so the *amortised* cost per insert stays O(1).

Worst case is O(n) (every key colliding), but with a good hash function and resizing, the **average** is O(1).

### Map vs Object vs Set in JS

| | `Map` | Plain object | `Set` |
|---|---|---|---|
| Key types | Any (objects, numbers, NaN) | Strings & Symbols (numbers coerced) | Any (values) |
| Order | Insertion order | Mostly insertion (integer-like keys sorted first!) | Insertion |
| Size | `map.size` O(1) | `Object.keys(o).length` O(n) | `set.size` |
| Prototype keys | None | Inherits (`'toString' in {}`) — use `Object.create(null)` | None |
| Frequent add/delete | Optimised | Slower | Optimised |

Prefer `Map`/`Set` for algorithmic work.

## Pattern: "have I seen the complement?"

Two Sum is the canonical example: instead of checking every pair (O(n²)), store what you've seen in a map and ask "is `target - x` already there?" — O(n).

## Pattern: counting with a Map

Frequency counts power "first unique", "top-k", "anagram", "majority element" and "duplicates" questions:

```js
const freq = new Map()
for (const x of arr) freq.set(x, (freq.get(x) ?? 0) + 1)
```

## Interview questions

:::question
difficulty: medium
companies: Reddit
### How do hash-table lookups stay O(1) on average?
A hash function maps a key to an integer, which is reduced modulo the bucket array size to get an index — array indexing is constant time. Collisions are resolved via chaining or probing; as long as the hash spreads keys uniformly and the table resizes when the load factor grows (amortised O(1) rehashing), each bucket holds O(1) entries on average. The worst case (all keys colliding) degrades to O(n), which is why good hash functions (and randomised seeds against hash-flooding attacks) matter.
:::

:::question
difficulty: easy
### When would you use a Set instead of an array?
When you need fast membership checks (`has` is O(1) vs `includes` O(n)), de-duplication (`[...new Set(arr)]`), or set operations (union/intersection/difference — now built in via `set.union`, `set.intersection`). Arrays are better for ordered, indexed, duplicate-allowing data.
:::

## Challenges

:::challenge
difficulty: easy
companies: Intuit
### Two Sum
Given an array of numbers and a target, return the **indices** `[i, j]` (i < j) of the two numbers that add up to the target. Assume exactly one solution; you may not use the same element twice.
@@@starter
```js
function twoSum(nums, target) {
  // your code
}
```
@@@tests
```js
test('basic', () => {
  expect(twoSum([2, 7, 11, 15], 9)).toEqual([0, 1])
})
test('unsorted with negatives', () => {
  expect(twoSum([3, -1, 4, 6], 5)).toEqual([1, 3])
})
test('duplicates', () => {
  expect(twoSum([3, 3], 6)).toEqual([0, 1])
})
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
One pass: for each number, check if its complement was seen earlier. Store **after** checking so an element isn't paired with itself. **O(n) time, O(n) space** vs brute force O(n²).

Follow-ups: sorted input → two pointers with O(1) space; return all pairs; return values instead of indices.
:::

:::challenge
difficulty: medium
companies: PhonePe
### Find all pairs with a given sum
Return all **unique** value pairs `[a, b]` (a ≤ b) from `arr` that sum to `target`, sorted ascending by `a`. Each pair appears once even if values repeat.
@@@starter
```js
function pairsWithSum(arr, target) {
  // your code
}
```
@@@tests
```js
test('finds unique pairs', () => {
  expect(pairsWithSum([1, 5, 7, -1, 5], 6)).toEqual([[-1, 7], [1, 5]])
})
test('pair of equal values needs two occurrences', () => {
  expect(pairsWithSum([3, 3, 4], 6)).toEqual([[3, 3]])
  expect(pairsWithSum([3, 4], 6)).toEqual([])
})
test('empty', () => {
  expect(pairsWithSum([], 1)).toEqual([])
})
```
@@@solution
```js
function pairsWithSum(arr, target) {
  const seen = new Set()
  const pairs = new Map() // "a,b" -> [a, b], dedupes pairs
  for (const x of arr) {
    const y = target - x
    if (seen.has(y)) {
      const a = Math.min(x, y)
      const b = Math.max(x, y)
      pairs.set(`${a},${b}`, [a, b])
    }
    seen.add(x)
  }
  return [...pairs.values()].sort((p, q) => p[0] - q[0])
}
```
O(n) to find pairs (+ O(p log p) to sort the output). A value can pair with itself only if it occurred earlier, so `[3, 4]` with target 6 doesn't produce `[3, 3]`. Counting **index** pairs instead (e.g. `[1,5,7,-1,5]` → 3 pairs) needs a frequency map: add `freq.get(y)` to the count before incrementing `freq[x]`.
:::

:::challenge
difficulty: medium
companies: Intuit, PhonePe
### Three Sum (all unique triplets)
Return all unique triplets `[a, b, c]` (sorted within each triplet, a ≤ b ≤ c) where `a + b + c === target` (default 0). Output triplets sorted lexicographically.
@@@hint
Sort first. Fix `i`, then run two pointers on the rest. Skip duplicates at every level.
@@@starter
```js
function threeSum(nums, target = 0) {
  // your code
}
```
@@@tests
```js
test('classic', () => {
  expect(threeSum([-1, 0, 1, 2, -1, -4])).toEqual([[-1, -1, 2], [-1, 0, 1]])
})
test('custom target', () => {
  expect(threeSum([1, 2, 3, 4, 5], 9)).toEqual([[1, 3, 5], [2, 3, 4]])
})
test('all zeros once', () => {
  expect(threeSum([0, 0, 0, 0])).toEqual([[0, 0, 0]])
})
test('none', () => {
  expect(threeSum([1, 2])).toEqual([])
})
```
@@@solution
```js
function threeSum(nums, target = 0) {
  const a = [...nums].sort((x, y) => x - y)
  const result = []
  for (let i = 0; i < a.length - 2; i++) {
    if (i > 0 && a[i] === a[i - 1]) continue        // skip duplicate anchors
    let lo = i + 1
    let hi = a.length - 1
    while (lo < hi) {
      const sum = a[i] + a[lo] + a[hi]
      if (sum === target) {
        result.push([a[i], a[lo], a[hi]])
        while (lo < hi && a[lo] === a[lo + 1]) lo++ // skip duplicates
        while (lo < hi && a[hi] === a[hi - 1]) hi--
        lo++
        hi--
      } else if (sum < target) {
        lo++
      } else {
        hi--
      }
    }
  }
  return result
}
```
Sorting enables two pointers: if the sum is too small, move `lo` right (bigger); too big, move `hi` left. **O(n²) time**, O(1) extra space (besides output and the sorted copy). Results are naturally in lexicographic order because we scan sorted values.
:::

:::challenge
difficulty: easy
### Frequency of elements in an array
Return a `Map` of each element to its count, preserving first-seen order. Then use it to return the element with the highest count (`mostFrequent`), ties broken by first occurrence.
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
test('counts', () => {
  const f = frequency(['a', 'b', 'a', 'c', 'a', 'b'])
  expect([...f.entries()]).toEqual([['a', 3], ['b', 2], ['c', 1]])
})
test('most frequent', () => {
  expect(mostFrequent([1, 2, 2, 3, 3])).toBe(2)
})
test('empty', () => {
  expect(frequency([]).size).toBe(0)
  expect(mostFrequent([])).toBe(undefined)
})
```
@@@solution
```js
function frequency(arr) {
  const freq = new Map()
  for (const x of arr) freq.set(x, (freq.get(x) ?? 0) + 1)
  return freq
}

function mostFrequent(arr) {
  let best
  let bestCount = 0
  for (const [value, count] of frequency(arr)) {
    if (count > bestCount) { best = value; bestCount = count } // strict > keeps first on ties
  }
  return best
}
```
O(n) time, O(k) space for k distinct values. Using a `Map` (not an object) keeps types (`1` vs `'1'`) and insertion order. The `reduce` one-liner: `arr.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())`.
:::

:::challenge
difficulty: medium
companies: Tekion
### Top K frequent elements
Return the `k` most frequent elements, most frequent first (ties: earlier first occurrence first).
@@@hint
Count with a Map, then bucket sort by frequency for O(n), or sort entries for O(n log n).
@@@starter
```js
function topKFrequent(nums, k) {
  // your code
}
```
@@@tests
```js
test('basic', () => {
  expect(topKFrequent([1, 1, 1, 2, 2, 3], 2)).toEqual([1, 2])
})
test('ties keep first occurrence order', () => {
  expect(topKFrequent([4, 5, 5, 4, 6], 2)).toEqual([4, 5])
})
test('k equals distinct count', () => {
  expect(topKFrequent([7], 1)).toEqual([7])
})
```
@@@solution
Bucket sort (O(n)):
```js
function topKFrequent(nums, k) {
  const freq = new Map()
  for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1)

  // buckets[c] = values that appear exactly c times (insertion order preserved)
  const buckets = Array.from({ length: nums.length + 1 }, () => [])
  for (const [value, count] of freq) buckets[count].push(value)

  const result = []
  for (let c = buckets.length - 1; c > 0 && result.length < k; c--) {
    for (const value of buckets[c]) {
      result.push(value)
      if (result.length === k) break
    }
  }
  return result
}
```
Simpler O(n log n): `[...freq].sort((a, b) => b[1] - a[1]).slice(0, k).map(([v]) => v)` (stable sort keeps first-occurrence order on ties). With a min-heap of size k you get O(n log k) — good for streaming data.
:::

:::challenge
difficulty: easy
companies: Reddit
### First unique character (two-pass Map)
Return the **index** of the first non-repeating character in a string, or `-1`.
@@@starter
```js
function firstUniqChar(s) {
  // your code
}
```
@@@tests
```js
test('examples', () => {
  expect(firstUniqChar('leetcode')).toBe(0)
  expect(firstUniqChar('loveleetcode')).toBe(2)
  expect(firstUniqChar('aabb')).toBe(-1)
  expect(firstUniqChar('')).toBe(-1)
})
```
@@@solution
```js
function firstUniqChar(s) {
  const count = new Map()
  for (const ch of s) count.set(ch, (count.get(ch) ?? 0) + 1) // pass 1: count
  for (let i = 0; i < s.length; i++) {                          // pass 2: find
    if (count.get(s[i]) === 1) return i
  }
  return -1
}
```
Two passes, **O(n) time**, O(k) space (k = alphabet size, effectively O(1) for ASCII). The tempting `s.indexOf(c) === s.lastIndexOf(c)` per character is O(n²).
:::

:::challenge
difficulty: easy
### Find the missing number
An array contains `n` distinct numbers from `0..n` with exactly one missing. Find it in O(n) time and O(1) space.
@@@starter
```js
function missingNumber(nums) {
  // your code
}
```
@@@tests
```js
test('examples', () => {
  expect(missingNumber([3, 0, 1])).toBe(2)
  expect(missingNumber([0, 1])).toBe(2)
  expect(missingNumber([9, 6, 4, 2, 3, 5, 7, 0, 1])).toBe(8)
  expect(missingNumber([1])).toBe(0)
})
```
@@@solution
Sum formula:
```js
function missingNumber(nums) {
  const n = nums.length
  const expected = (n * (n + 1)) / 2
  return expected - nums.reduce((a, b) => a + b, 0)
}
```
XOR version (no overflow risk in other languages): `x ^ x = 0` and `x ^ 0 = x`, so XOR-ing all indices `0..n` with all values cancels everything except the missing number:
```js
function missingNumberXor(nums) {
  let x = nums.length
  for (let i = 0; i < nums.length; i++) x ^= i ^ nums[i]
  return x
}
```
Both O(n) time, O(1) space. (The reference doc mentions XOR and bit shifts — this is the classic use.)
:::

## Quick check

:::quiz
### Calling `arr.includes(x)` inside a loop over `arr` is…
- [ ] O(n)
- [x] O(n²)
- [ ] O(n log n)
- [ ] O(1)
@@@explain
`includes` is a linear scan; doing it n times multiplies. Use a Set for O(1) lookups.
:::

:::quiz
### Why is hash table insertion "amortised" O(1)?
- [ ] Because collisions never happen
- [x] Occasional O(n) resizes are spread over many cheap inserts
- [ ] Because JavaScript caches it
- [ ] Because keys are sorted
@@@explain
Doubling capacity on resize means rehash costs average out to a constant per insert.
:::
