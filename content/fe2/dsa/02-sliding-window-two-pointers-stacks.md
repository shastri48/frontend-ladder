---
title: Sliding Window, Two Pointers & Stacks
summary: Three patterns that turn O(n²) brute force into O(n) — the variable-size sliding window (longest substring without repeating characters), two pointers on arrays and strings, and stacks for matching problems.
minutes: 20
---

## Pattern 1: Sliding window

Many problems ask about a **contiguous** subarray or substring: "longest substring without repeats", "max sum of k consecutive elements", "smallest subarray with sum ≥ S". Brute force checks every start × every end = O(n²) (or O(n³) with an inner check).

A **sliding window** keeps two indices, `left` and `right`, that define the current window. `right` moves forward one step at a time to grow the window; `left` moves forward only when the window becomes invalid. Each index moves at most `n` times → **O(n)**.

```text
s = "a b c a b c b b"
     L     R            window "abc" valid, length 3
       L     R          'a' repeated → move L past the old 'a' → "bca"
```

Two flavours:

| Fixed-size window | Variable-size window |
|---|---|
| Window length is given (k) | Window grows/shrinks based on a condition |
| Add `arr[right]`, remove `arr[right - k]` | Expand `right`; while invalid, shrink `left` |
| Max sum of k consecutive elements, moving averages | Longest substring without repeats, min window substring |

A UI analogy: a moving average of the last 10 FPS samples is a fixed sliding window.

## Pattern 2: Two pointers

Two indices moving through the data, usually:

- **From both ends towards the middle** — palindromes, reversing, pair sums in a **sorted** array, container with most water.
- **Slow/fast in the same direction** — removing duplicates in place, partitioning, cycle detection in linked lists (Floyd's tortoise and hare).

They give O(n) time with O(1) extra space.

## Pattern 3: Stack (LIFO)

A **stack** is last-in, first-out: `push` and `pop` at the end of an array are O(1). Reach for it when the most recent unmatched item matters:

- Matching brackets/tags (is this HTML well-formed?)
- Undo/redo (two stacks!)
- Browser back/forward history
- The call stack itself; converting recursion to iteration (DFS)
- "Next greater element" problems (monotonic stack)

A **queue** (FIFO) is the counterpart for BFS, task scheduling and rate limiting. Beware: `array.shift()` is O(n) in JS — for large queues use an index pointer or a linked list.

## Interview questions

:::question
difficulty: medium
companies: Groww
### How do you recognise a sliding window problem?
Keywords: contiguous subarray/substring, "longest/shortest/maximum/minimum … that satisfies …", a condition that can be maintained incrementally as you add an element on the right and remove one on the left (a count map, a running sum, a set of seen characters). If the brute force re-computes overlapping windows from scratch, a sliding window can reuse the previous window's state.
:::

## Challenges

:::challenge
difficulty: medium
companies: Uber, Groww
### Longest Substring Without Repeating Characters
Return the length of the longest substring of `s` with all distinct characters.
@@@hint
Keep a Map of character → last index seen. When you see a repeat **inside** the current window, jump `left` to one past its previous index.
@@@starter
```js
function lengthOfLongestSubstring(s) {
  // your code
}
```
@@@tests
```js
test('examples', () => {
  expect(lengthOfLongestSubstring('abcabcbb')).toBe(3)
  expect(lengthOfLongestSubstring('bbbbb')).toBe(1)
  expect(lengthOfLongestSubstring('pwwkew')).toBe(3)
})
test('edge cases', () => {
  expect(lengthOfLongestSubstring('')).toBe(0)
  expect(lengthOfLongestSubstring(' ')).toBe(1)
  expect(lengthOfLongestSubstring('abba')).toBe(2)
  expect(lengthOfLongestSubstring('dvdf')).toBe(3)
})
```
@@@solution
```js
function lengthOfLongestSubstring(s) {
  let maxLength = 0
  let left = 0
  const lastSeen = new Map() // char -> last index

  for (let right = 0; right < s.length; right++) {
    const char = s[right]
    // repeat inside the current window → shrink from the left
    if (lastSeen.has(char) && lastSeen.get(char) >= left) {
      left = lastSeen.get(char) + 1
    }
    lastSeen.set(char, right)
    maxLength = Math.max(maxLength, right - left + 1)
  }
  return maxLength
}
```
This matches the implementation in the reference doc. The `>= left` check is crucial: in `"abba"`, when we reach the final `a`, its last index (0) is **outside** the window (left = 2), so we must not move `left` backwards.

**O(n) time**, O(k) space for k distinct characters. Walkthrough of `"pwwkew"`: windows `p`, `pw`, `w` (repeat), `wk`, `wke` (3), `kew` (3) → 3.
:::

:::challenge
difficulty: easy
### Maximum sum of k consecutive elements
Return the maximum sum of any `k` consecutive elements (fixed-size window). Return `null` if `arr.length < k`.
@@@starter
```js
function maxSumK(arr, k) {
  // your code
}
```
@@@tests
```js
test('examples', () => {
  expect(maxSumK([2, 1, 5, 1, 3, 2], 3)).toBe(9)
  expect(maxSumK([-1, -2, -3], 2)).toBe(-3)
})
test('too short', () => {
  expect(maxSumK([1], 2)).toBe(null)
})
```
@@@solution
```js
function maxSumK(arr, k) {
  if (arr.length < k) return null
  let windowSum = 0
  for (let i = 0; i < k; i++) windowSum += arr[i]
  let best = windowSum
  for (let right = k; right < arr.length; right++) {
    windowSum += arr[right] - arr[right - k] // slide: add new, drop oldest
    best = Math.max(best, windowSum)
  }
  return best
}
```
O(n) instead of O(n·k). Initialise `best` with the first window (not 0) so all-negative inputs work.
:::

:::challenge
difficulty: medium
### Smallest subarray with sum ≥ target
Given positive integers and a target, return the minimal length of a contiguous subarray whose sum is ≥ target, or 0 if none.
@@@starter
```js
function minSubArrayLen(target, nums) {
  // your code
}
```
@@@tests
```js
test('examples', () => {
  expect(minSubArrayLen(7, [2, 3, 1, 2, 4, 3])).toBe(2)
  expect(minSubArrayLen(4, [1, 4, 4])).toBe(1)
  expect(minSubArrayLen(11, [1, 1, 1, 1])).toBe(0)
})
```
@@@solution
```js
function minSubArrayLen(target, nums) {
  let left = 0
  let sum = 0
  let best = Infinity
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right]
    while (sum >= target) {          // valid → try to shrink
      best = Math.min(best, right - left + 1)
      sum -= nums[left++]
    }
  }
  return best === Infinity ? 0 : best
}
```
The canonical variable window: expand right, shrink left while the condition holds. Works because all numbers are positive (shrinking always decreases the sum). O(n).
:::

:::challenge
difficulty: easy
### Valid palindrome (two pointers)
Return `true` if `s` is a palindrome considering only alphanumeric characters and ignoring case.
@@@starter
```js
function isPalindrome(s) {
  // your code
}
```
@@@tests
```js
test('examples', () => {
  expect(isPalindrome('A man, a plan, a canal: Panama')).toBe(true)
  expect(isPalindrome('race a car')).toBe(false)
  expect(isPalindrome('')).toBe(true)
})
```
@@@solution
```js
function isPalindrome(s) {
  const isAlnum = (c) => /[a-z0-9]/i.test(c)
  let i = 0
  let j = s.length - 1
  while (i < j) {
    if (!isAlnum(s[i])) { i++; continue }
    if (!isAlnum(s[j])) { j--; continue }
    if (s[i].toLowerCase() !== s[j].toLowerCase()) return false
    i++
    j--
  }
  return true
}
```
O(n) time, O(1) space — better than building a cleaned, reversed copy (O(n) space), which is fine to mention as the first approach.
:::

:::challenge
difficulty: easy
### Remove duplicates from a sorted array in place
Modify the sorted array so the first `k` elements are the unique values in order, and return `k`. O(1) extra space.
@@@starter
```js
function removeDuplicates(nums) {
  // your code
}
```
@@@tests
```js
test('dedupes in place', () => {
  const a = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4]
  const k = removeDuplicates(a)
  expect(k).toBe(5)
  expect(a.slice(0, k)).toEqual([0, 1, 2, 3, 4])
})
test('empty', () => {
  expect(removeDuplicates([])).toBe(0)
})
```
@@@solution
```js
function removeDuplicates(nums) {
  if (nums.length === 0) return 0
  let slow = 0
  for (let fast = 1; fast < nums.length; fast++) {
    if (nums[fast] !== nums[slow]) {
      slow++
      nums[slow] = nums[fast]
    }
  }
  return slow + 1
}
```
Slow/fast pointers: `slow` marks the end of the unique prefix, `fast` scans. O(n) time, O(1) space. For unsorted arrays: `[...new Set(arr)]`.
:::

:::challenge
difficulty: easy
### Valid parentheses (stack)
Return `true` if every bracket in `s` (`()[]{}`) is closed by the same type in the correct order. Ignore other characters.
@@@starter
```js
function isValid(s) {
  // your code
}
```
@@@tests
```js
test('valid', () => {
  expect(isValid('()[]{}')).toBe(true)
  expect(isValid('{[()]}')).toBe(true)
  expect(isValid('fn(a[0]) { return x }')).toBe(true)
})
test('invalid', () => {
  expect(isValid('(]')).toBe(false)
  expect(isValid('([)]')).toBe(false)
  expect(isValid('((')).toBe(false)
  expect(isValid(')')).toBe(false)
})
```
@@@solution
```js
function isValid(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' }
  const stack = []
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch)
    } else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false // empty stack pops undefined → false
    }
  }
  return stack.length === 0
}
```
The most recent unmatched opener must match the next closer — exactly what a stack gives. O(n) time and space. Same idea validates HTML/JSX tag nesting and powers syntax highlighters' bracket matching.
:::

:::challenge
difficulty: medium
### Next greater element (monotonic stack)
For each element, return the next element to its right that is greater, or `-1`.
@@@starter
```js
function nextGreater(nums) {
  // your code
}
```
@@@tests
```js
test('examples', () => {
  expect(nextGreater([4, 5, 2, 25])).toEqual([5, 25, 25, -1])
  expect(nextGreater([13, 7, 6, 12])).toEqual([-1, 12, 12, -1])
  expect(nextGreater([])).toEqual([])
})
```
@@@solution
```js
function nextGreater(nums) {
  const result = new Array(nums.length).fill(-1)
  const stack = [] // indices waiting for their next greater element (values decreasing)
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[i] > nums[stack[stack.length - 1]]) {
      result[stack.pop()] = nums[i]
    }
    stack.push(i)
  }
  return result
}
```
Each index is pushed and popped at most once → O(n). Monotonic stacks also solve "daily temperatures", "stock span" and the "maximal rectangle in a histogram" building block of the *maximal rectangle in a binary matrix* problem.
:::

## Quick check

:::quiz
### Why is the sliding window O(n) even though there's a nested while loop?
- [ ] The while loop runs at most once
- [x] Each pointer only moves forward, at most n times in total
- [ ] JavaScript optimises it
- [ ] It's actually O(n²)
@@@explain
Amortised analysis: left and right each advance n times overall.
:::

:::quiz
### Which data structure fits undo/redo?
- [ ] Queue
- [x] Two stacks
- [ ] Hash set
- [ ] Binary tree
@@@explain
Undo pops from the history stack and pushes onto the redo stack, and vice versa.
:::
