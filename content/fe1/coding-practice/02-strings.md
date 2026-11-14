---
title: Warm-ups — Strings
summary: Reverse words, palindromes, first non-repeating character, anagrams and capitalisation — the string problems that open most interviews.
minutes: 20
---

## Strings: what to remember

- Strings are **immutable**: build a new string or work on an array (`split` → transform → `join`).
- `str.split("")` breaks emoji and some accented characters into halves (UTF-16 surrogate pairs). `[...str]` or `Array.from(str)` splits by **code points** — mention this; it shows maturity.
- Concatenating in a loop is fine in modern engines, but `array.join` is clearer for building output.
- Normalise before comparing: `toLowerCase()`, remove non-alphanumerics with `replace(/[^a-z0-9]/gi, "")`.
- Character counting → `Map`/object. "First unique" → **two passes**: count, then scan in order.

## Challenges

:::challenge
difficulty: easy
### Reverse the words in a sentence
Reverse the order of words. Collapse multiple spaces and trim.
```js
reverseWords("  the sky   is blue ") // "blue is sky the"
```
@@@starter
```js
function reverseWords(s) {
  // your code
}
```
@@@tests
```js
test('basic', () => { expect(reverseWords('the sky is blue')).toBe('blue is sky the') })
test('extra spaces', () => { expect(reverseWords('  hello   world  ')).toBe('world hello') })
test('single', () => { expect(reverseWords('a')).toBe('a') })
test('empty', () => { expect(reverseWords('   ')).toBe('') })
```
@@@solution
```js
function reverseWords(s) {
  return s.trim().split(/\s+/).filter(Boolean).reverse().join(' ')
}
```
`split(/\s+/)` splits on any run of whitespace; `trim` first avoids empty strings at the ends; `filter(Boolean)` covers the all-spaces case. O(n). Follow-up "reverse each word but keep order": `s.split(' ').map(w => [...w].reverse().join('')).join(' ')`. Follow-up "in-place with O(1) space": that's for mutable char arrays — reverse the whole array, then reverse each word.
:::

:::challenge
difficulty: easy
companies: Common
### Valid palindrome
Return `true` if the string reads the same forwards and backwards, ignoring case and non-alphanumeric characters.
```js
isPalindrome("A man, a plan, a canal: Panama") // true
```
@@@starter
```js
function isPalindrome(s) {
  // your code
}
```
@@@tests
```js
test('sentence', () => { expect(isPalindrome('A man, a plan, a canal: Panama')).toBe(true) })
test('not', () => { expect(isPalindrome('race a car')).toBe(false) })
test('empty', () => { expect(isPalindrome('')).toBe(true) })
test('digits', () => { expect(isPalindrome('12321')).toBe(true) })
```
@@@solution
```js
function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '')
  let left = 0
  let right = clean.length - 1
  while (left < right) {
    if (clean[left] !== clean[right]) return false
    left++
    right--
  }
  return true
}
```
Two pointers meeting in the middle: O(n) time, O(n) for the cleaned copy (could be O(1) by skipping non-alphanumerics in place). The one-liner `clean === [...clean].reverse().join('')` is fine to mention but allocates more and never exits early.
:::

:::challenge
difficulty: easy
companies: Reddit, Common
### First non-repeating character
Return the index of the first character that appears exactly once, or `-1`.
```js
firstUnique("leetcode")     // 0  ('l')
firstUnique("loveleetcode") // 2  ('v')
```
@@@starter
```js
function firstUnique(s) {
  // your code
}
```
@@@tests
```js
test('first', () => { expect(firstUnique('leetcode')).toBe(0) })
test('middle', () => { expect(firstUnique('loveleetcode')).toBe(2) })
test('none', () => { expect(firstUnique('aabb')).toBe(-1) })
test('empty', () => { expect(firstUnique('')).toBe(-1) })
```
@@@solution
```js
function firstUnique(s) {
  const counts = new Map()
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1) // pass 1: count
  for (let i = 0; i < s.length; i++) {                           // pass 2: first with count 1
    if (counts.get(s[i]) === 1) return i
  }
  return -1
}
```
Two passes over the string → O(n) time, O(k) space for k distinct characters (bounded by alphabet size, so effectively O(1)). The naive `s.indexOf(c) === s.lastIndexOf(c)` per character is O(n²). This exact "two-pass counting with a Map" pattern is listed in Reddit's phone screen.
:::

:::challenge
difficulty: easy
### Valid anagram
Return `true` if `t` is an anagram of `s` (same letters, same counts).
@@@starter
```js
function isAnagram(s, t) {
  // your code
}
```
@@@tests
```js
test('yes', () => { expect(isAnagram('anagram', 'nagaram')).toBe(true) })
test('no', () => { expect(isAnagram('rat', 'car')).toBe(false) })
test('different length', () => { expect(isAnagram('a', 'ab')).toBe(false) })
```
@@@solution
```js
function isAnagram(s, t) {
  if (s.length !== t.length) return false
  const counts = new Map()
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  for (const ch of t) {
    const c = counts.get(ch)
    if (!c) return false          // missing or already used up
    counts.set(ch, c - 1)
  }
  return true
}
```
O(n) with one Map. Sorting both (`[...s].sort().join('') === [...t].sort().join('')`) is O(n log n) — simpler but slower. Follow-up: "group anagrams" → use the sorted string (or a count signature) as a Map key.
:::

:::challenge
difficulty: easy
### Capitalise each word & count vowels
1. `titleCase("hello frontend ladder")` → `"Hello Frontend Ladder"`.
2. `countVowels("Frontend")` → `2`.
@@@starter
```js
function titleCase(s) {
  // your code
}
function countVowels(s) {
  // your code
}
```
@@@tests
```js
test('titleCase', () => {
  expect(titleCase('hello frontend ladder')).toBe('Hello Frontend Ladder')
  expect(titleCase('hELLO')).toBe('Hello')
})
test('countVowels', () => {
  expect(countVowels('Frontend')).toBe(2)
  expect(countVowels('rhythm')).toBe(0)
  expect(countVowels('AEIOU')).toBe(5)
})
```
@@@solution
```js
function titleCase(s) {
  return s
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function countVowels(s) {
  return (s.match(/[aeiou]/gi) ?? []).length
}
```
`match` with the global flag returns all matches or `null` (hence `?? []`). Splitting on `' '` (not `/\s+/`) preserves the original spacing.
:::

:::challenge
difficulty: easy
### Compress a string
Run-length encode: `"aaabccdddd"` → `"a3b1c2d4"`. If the compressed form isn't shorter, return the original.
@@@starter
```js
function compress(s) {
  // your code
}
```
@@@tests
```js
test('compresses', () => { expect(compress('aaabccdddd')).toBe('a3b1c2d4') })
test('returns original when not shorter', () => { expect(compress('abc')).toBe('abc') })
test('empty', () => { expect(compress('')).toBe('') })
```
@@@solution
```js
function compress(s) {
  const parts = []
  for (let i = 0; i < s.length; ) {
    let j = i
    while (j < s.length && s[j] === s[i]) j++   // extend the run
    parts.push(s[i] + (j - i))
    i = j
  }
  const out = parts.join('')
  return out.length < s.length ? out : s
}
```
Two indices scan each run once → O(n). Building parts in an array and joining once keeps it clean.
:::

:::quiz
### Best way to split "héllo👋" into visible characters?
- [ ] str.split("")
- [x] [...str]
- [ ] str.chars()
- [ ] str.substring()
@@@explain
Spread iterates by code points, so emoji aren't broken into surrogate halves.
:::

:::quiz
### First unique character in O(n) needs…
- [ ] Sorting the string
- [x] Counting in a Map, then scanning in order
- [ ] indexOf/lastIndexOf for each char
- [ ] Recursion
@@@explain
Count once, then the first char with count 1 is the answer.
:::
