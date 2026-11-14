---
title: LRU Cache, Tries (T9 & Autocomplete) and Logic Puzzles
summary: Design-flavoured DSA — an O(1) LRU cache with Map, a trie for prefix search and T9 predictive text, and the classic "10 bags, 1 abnormal" weighing puzzle.
minutes: 20
---

## Data structures that design rounds lean on

Sprinklr's DSA round opens with "write a full working LRU cache, every operation O(1)", then pushes into scale. T9 predictive text and autocomplete are favourite system-design warm-ups because they start with a **trie**. These three topics bridge DSA and frontend system design: caching API responses, search-as-you-type, and contact search.

## LRU cache

A cache with limited capacity must decide what to **evict** when full. **Least Recently Used (LRU)** evicts the entry that hasn't been read or written for the longest time — a good approximation of "least likely to be needed again". Browsers' memory caches, React Query's garbage collection, CDN edge caches and image caches all use LRU-like policies.

Requirements: `get(key)` and `put(key, value)` in **O(1)**.

### Classic implementation: hash map + doubly linked list

```text
map: key → node                  most recent                         least recent
                                 HEAD ⇄ [C] ⇄ [A] ⇄ [D] ⇄ [B] ⇄ TAIL
get(A): move A's node to the front           → O(1) with prev/next pointers
put(E) when full: remove node before TAIL (B), delete from map, insert E at front
```

The map gives O(1) lookup; the doubly linked list gives O(1) reordering and eviction.

### JavaScript shortcut: `Map` keeps insertion order

A JS `Map` iterates in insertion order and `delete` + `set` moves a key to the end in O(1). So:

- **Most recently used = last** in the map, **least recently used = first** (`map.keys().next().value`).
- On `get`: delete and re-set the key to move it to the end.

Mention both in an interview: the Map trick is idiomatic JS, but the interviewer may ask you to build the linked list to prove you understand why it's O(1).

## Tries (prefix trees)

A **trie** stores strings character by character along paths from the root. Every node represents a prefix; words sharing a prefix share nodes.

```text
            (root)
           /      \
          c        d
          |        |
          a        o
        /   \      |
       t*    r*    g*         * = end of word
       |
       s*
words: cat, cats, car, dog
```

| Operation | Trie | Array of words |
|---|---|---|
| Insert | O(L) | O(1) |
| Exact search | O(L) | O(N·L) |
| All words with prefix p | O(p + results) | O(N·L) |

(L = word length, N = number of words.) Autocomplete, spell check, IP routing tables and T9 keyboards all use tries.

### T9 predictive text

Old phone keypads mapped letters to digits: `2=abc, 3=def, 4=ghi, 5=jkl, 6=mno, 7=pqrs, 8=tuv, 9=wxyz`. Typing `4663` could mean "good", "home", "gone". To search contacts by digits, build a trie **keyed by digits**: convert each name to its digit sequence and insert it, storing the names at the nodes. A digit prefix then walks down the trie and collects all names below.

Productionising it (the Sprinklr follow-up): rank results by frequency/recency (store counts at nodes, keep top-k per node), persist the trie or a serialised form, update incrementally when contacts change, debounce input, and for huge datasets move search to a Web Worker or server.

## Puzzles

Puzzles (Stable Money asked the "10 bags" one) test structured thinking more than knowledge. Technique: identify what a **single measurement** can encode, and design the experiment so each possible answer yields a **different** measurement.

## Interview questions

:::question
difficulty: medium
companies: Sprinklr
### Why does an LRU cache need both a hash map and a doubly linked list?
The hash map gives O(1) access to any entry by key, but has no notion of recency order. A doubly linked list keeps entries ordered by recency and allows O(1) removal and insertion **given a node reference** (prev/next pointers, no traversal). The map stores key → list node, so `get` finds the node in O(1) and moves it to the front in O(1); `put` evicts the tail in O(1). A singly linked list wouldn't allow O(1) removal of an arbitrary node. In JS, a `Map`'s insertion order gives the same behaviour with less code.
:::

## Challenges

:::challenge
difficulty: medium
companies: Sprinklr
### LRU cache with O(1) operations
Implement `class LRUCache` with `constructor(capacity)`, `get(key)` (returns value or `-1`, marks as recently used) and `put(key, value)` (inserts/updates, marks as recently used, evicts the least recently used entry when over capacity).
@@@starter
```js
class LRUCache {
  constructor(capacity) {
    // your code
  }
  get(key) {
    // your code
  }
  put(key, value) {
    // your code
  }
}
```
@@@tests
```js
test('classic sequence', () => {
  const c = new LRUCache(2)
  c.put(1, 1)
  c.put(2, 2)
  expect(c.get(1)).toBe(1)   // 1 is now most recent
  c.put(3, 3)                // evicts 2
  expect(c.get(2)).toBe(-1)
  c.put(4, 4)                // evicts 1
  expect(c.get(1)).toBe(-1)
  expect(c.get(3)).toBe(3)
  expect(c.get(4)).toBe(4)
})
test('updating a key refreshes recency', () => {
  const c = new LRUCache(2)
  c.put('a', 1)
  c.put('b', 2)
  c.put('a', 10)             // a is most recent now
  c.put('c', 3)              // evicts b
  expect(c.get('b')).toBe(-1)
  expect(c.get('a')).toBe(10)
})
test('capacity 1', () => {
  const c = new LRUCache(1)
  c.put(1, 1)
  c.put(2, 2)
  expect(c.get(1)).toBe(-1)
  expect(c.get(2)).toBe(2)
})
```
@@@solution
**Idiomatic JS with `Map`:**
```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity
    this.map = new Map() // iteration order = recency order (oldest first)
  }
  get(key) {
    if (!this.map.has(key)) return -1
    const value = this.map.get(key)
    this.map.delete(key)  // move to the end (most recent)
    this.map.set(key, value)
    return value
  }
  put(key, value) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value // first key = least recently used
      this.map.delete(oldest)
    }
  }
}
```

**Explicit doubly linked list** (what the interviewer may ask for next):
```js
class Node {
  constructor(key, value) { this.key = key; this.value = value; this.prev = this.next = null }
}

class LRUCacheDLL {
  constructor(capacity) {
    this.capacity = capacity
    this.map = new Map()
    this.head = new Node() // sentinel: head.next = most recent
    this.tail = new Node() // sentinel: tail.prev = least recent
    this.head.next = this.tail
    this.tail.prev = this.head
  }
  #remove(node) {
    node.prev.next = node.next
    node.next.prev = node.prev
  }
  #addFront(node) {
    node.next = this.head.next
    node.prev = this.head
    this.head.next.prev = node
    this.head.next = node
  }
  get(key) {
    const node = this.map.get(key)
    if (!node) return -1
    this.#remove(node)
    this.#addFront(node)
    return node.value
  }
  put(key, value) {
    let node = this.map.get(key)
    if (node) {
      node.value = value
      this.#remove(node)
    } else {
      node = new Node(key, value)
      this.map.set(key, node)
    }
    this.#addFront(node)
    if (this.map.size > this.capacity) {
      const lru = this.tail.prev
      this.#remove(lru)
      this.map.delete(lru.key)
    }
  }
}
```
Sentinel head/tail nodes remove all null checks. Both versions are O(1) per operation, O(capacity) space.

**Scale follow-ups (Sprinklr style):** TTL per entry, size-in-bytes capacity instead of count, thread safety/concurrency (not an issue on the JS main thread, but across workers), distributed caches (Redis with `maxmemory-policy allkeys-lru`), and LFU when frequency matters more than recency.
:::

:::challenge
difficulty: medium
### Implement a Trie with autocomplete
`class Trie` with `insert(word)`, `search(word)` (exact), `startsWith(prefix)` and `suggest(prefix, limit = 5)` returning up to `limit` words with that prefix in **lexicographic** order.
@@@starter
```js
class Trie {
  constructor() {
    // your code
  }
  insert(word) {}
  search(word) {}
  startsWith(prefix) {}
  suggest(prefix, limit = 5) {}
}
```
@@@tests
```js
test('insert and search', () => {
  const t = new Trie()
  ;['cat', 'cats', 'car', 'dog'].forEach((w) => t.insert(w))
  expect(t.search('cat')).toBe(true)
  expect(t.search('ca')).toBe(false)
  expect(t.startsWith('ca')).toBe(true)
  expect(t.startsWith('x')).toBe(false)
})
test('suggest is lexicographic and limited', () => {
  const t = new Trie()
  ;['card', 'care', 'car', 'cat', 'dog', 'cart'].forEach((w) => t.insert(w))
  expect(t.suggest('car')).toEqual(['car', 'card', 'care', 'cart'])
  expect(t.suggest('ca', 2)).toEqual(['car', 'card'])
  expect(t.suggest('z')).toEqual([])
})
```
@@@solution
```js
class Trie {
  constructor() {
    this.root = { children: new Map(), end: false }
  }

  #walk(prefix) {
    let node = this.root
    for (const ch of prefix) {
      node = node.children.get(ch)
      if (!node) return null
    }
    return node
  }

  insert(word) {
    let node = this.root
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, { children: new Map(), end: false })
      node = node.children.get(ch)
    }
    node.end = true
  }

  search(word) {
    return this.#walk(word)?.end === true
  }

  startsWith(prefix) {
    return this.#walk(prefix) !== null
  }

  suggest(prefix, limit = 5) {
    const start = this.#walk(prefix)
    const results = []
    const dfs = (node, path) => {
      if (results.length >= limit) return
      if (node.end) results.push(path)
      const keys = [...node.children.keys()].sort() // alphabetical DFS → lexicographic output
      for (const ch of keys) dfs(node.children.get(ch), path + ch)
    }
    if (start) dfs(start, prefix)
    return results
  }
}
```
Pre-order DFS with sorted children yields words in lexicographic order, and a word comes before its extensions (`car` before `card`). Stopping at `limit` keeps it fast. For ranking by popularity, store a `count` per word and keep a precomputed top-k list per node.
:::

:::challenge
difficulty: hard
companies: Sprinklr
### T9 contact search
Implement `createT9Index(contacts)` returning a `search(digits)` function. A contact matches if the T9 digit encoding of its name (lowercase letters only; ignore spaces/other characters) **starts with** `digits`. Return matching names in the original contact order. Use a trie keyed by digits.
Keypad: `2 abc, 3 def, 4 ghi, 5 jkl, 6 mno, 7 pqrs, 8 tuv, 9 wxyz`.
@@@starter
```js
function createT9Index(contacts) {
  // your code
}
```
@@@tests
```js
const contacts = ['Good Food', 'Home', 'Gone Girl', 'Ink', 'Hood']
test('multiple matches for the same digits', () => {
  const search = createT9Index(contacts)
  expect(search('4663')).toEqual(['Good Food', 'Home', 'Gone Girl', 'Hood'])
})
test('prefix narrowing', () => {
  const search = createT9Index(contacts)
  expect(search('46')).toEqual(['Good Food', 'Home', 'Gone Girl', 'Ink', 'Hood'])
  expect(search('465')).toEqual(['Ink'])
  expect(search('9')).toEqual([])
})
```
@@@solution
```js
function createT9Index(contacts) {
  const keypad = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz' }
  const letterToDigit = {}
  for (const [digit, letters] of Object.entries(keypad)) {
    for (const ch of letters) letterToDigit[ch] = digit
  }
  const encode = (name) =>
    [...name.toLowerCase()].map((ch) => letterToDigit[ch] ?? '').join('')

  // digit trie: each node keeps the indices of contacts passing through it
  const root = { children: new Map(), ids: [] }
  contacts.forEach((name, id) => {
    let node = root
    for (const d of encode(name)) {
      if (!node.children.has(d)) node.children.set(d, { children: new Map(), ids: [] })
      node = node.children.get(d)
      node.ids.push(id)
    }
  })

  return function search(digits) {
    let node = root
    for (const d of digits) {
      node = node.children.get(d)
      if (!node) return []
    }
    return node.ids.map((id) => contacts[id])
  }
}
```
Storing contact ids on every node makes a prefix query O(len(digits) + results) — no subtree walk needed — at the cost of O(total characters) extra memory. Ids are pushed in contact order, so results keep the original order.

**Productionising:** store ids sorted by frequency/recency (or a top-k per node) for ranking; also index each word of a name (so "Girl" matches `4475`); rebuild incrementally on contact changes; persist in IndexedDB; debounce keypad input; for millions of entries, move to a server-side index (Elasticsearch edge n-grams) with the trie as a client cache.
:::

:::challenge
difficulty: medium
companies: Stable Money
### 10 bags, 1 abnormal bag, one weighing
You have 10 bags with unlimited coins. Normal coins weigh 1g; every coin in the abnormal bag weighs 1.1g. You may take any number of coins from any bags and weigh them together. Find the abnormal bag using the scale **once**.

Implement `findAbnormalBag(weigh)` where `weigh(counts)` takes an array of 10 coin counts (counts[i] = coins taken from bag i+1) and returns the total weight. Return the abnormal bag number (1–10). Call `weigh` exactly once.
@@@starter
```js
function findAbnormalBag(weigh) {
  // your code
}
```
@@@tests
```js
function makeScale(abnormal) {
  let uses = 0
  const weigh = (counts) => {
    uses++
    return counts.reduce((sum, n, i) => sum + n * (i + 1 === abnormal ? 1.1 : 1), 0)
  }
  return { weigh, uses: () => uses }
}
test('finds every possible bag with one weighing', () => {
  for (let bag = 1; bag <= 10; bag++) {
    const scale = makeScale(bag)
    expect(findAbnormalBag(scale.weigh)).toBe(bag)
    expect(scale.uses()).toBe(1)
  }
})
```
@@@solution
**Idea:** take a *different* number of coins from each bag so each bag leaves a unique fingerprint on the total. Take **1 coin from bag 1, 2 from bag 2, … 10 from bag 10** — 55 coins.

- If all were normal: 55g.
- Every abnormal coin adds 0.1g, and bag k contributed k coins → excess = 0.1 × k.
- So `k = (weight − 55) / 0.1`.

Example: weight 55.7g → excess 0.7g → bag 7.

```js
function findAbnormalBag(weigh) {
  const counts = Array.from({ length: 10 }, (_, i) => i + 1) // 1..10
  const expected = counts.reduce((a, b) => a + b, 0)          // 55
  const excess = weigh(counts) - expected
  return Math.round(excess / 0.1) // round away float noise (0.7000000000000028)
}
```
`Math.round` matters — floating-point arithmetic makes `55.7 - 55` equal `0.7000000000000028` (see the numbers lesson).

**Follow-ups:**
- *Unknown abnormal weight?* Use counts with a unique **ratio** signature, or use two weighings.
- *Several abnormal bags?* Take powers of two (1, 2, 4, 8, …, 512 coins): the excess in units of 0.1g is a binary number whose set bits identify every abnormal bag — the same trick as bitmasks/XOR (left shift: `1 << i`).
:::

## Quick check

:::quiz
### In a JS Map-based LRU, where is the least recently used key?
- [x] The first key in iteration order
- [ ] The last key in iteration order
- [ ] It must be tracked separately
- [ ] At a random position
@@@explain
Each access deletes and re-inserts the key at the end, so the oldest untouched key stays first.
:::

:::quiz
### Finding all words with a given prefix in a trie costs…
- [ ] O(N) in the number of stored words always
- [x] O(prefix length + number of matching results)
- [ ] O(log N)
- [ ] O(1)
@@@explain
Walk down the prefix, then enumerate only the matching subtree.
:::
