---
title: Tokenizers & Tries — Syntax Highlighter and T9
summary: Design a regex101-style syntax highlighter (tokenizer → tokens → safe rendering → incremental updates) and build tries for autocomplete and T9 predictive text over contacts.
minutes: 24
---

## Two "algorithmic UI" design questions

The reference doc includes two questions that sit between DSA and frontend design:

- **"Design a syntax highlighter (similar to regex101)"** — asked in a Senior React system-design round.
- **"Design T9 predictive text: a trie, modified to search contacts, then the schema to productionise it"** — Sprinklr.

Both reward the same skill: pick the right data structure, then think about **performance on every keystroke** and **rendering safely**.

## Part 1: The syntax highlighter

### Requirements (clarify first)

- Input: a code editor (or regex + test string). Output: coloured tokens, updating on every keystroke.
- Languages: one (JS) or pluggable grammars?
- Size: a 20-line regex or a 10,000-line file? This decides whether you need incremental tokenizing and virtualization.
- Extras for regex101: highlight **matches** and **capture groups** in the test string, explain each token, show errors for invalid patterns.

### Architecture

```text
 keystroke ─▶ text (source of truth)
                │  debounce ~16–50ms / requestIdleCallback for big docs
                ▼
          tokenizer (pure function: text → tokens)   ◀── run in a Web Worker for large files
                │
                ▼
          tokens [{type, start, end}]  ── cache per line
                │
                ▼
          renderer: <span class="tok-keyword">…</span> (escaped!)   ◀── virtualize lines for huge docs
```

### The tokenizer

A tokenizer (lexer) scans text left to right and splits it into typed chunks. A clean approach is an **ordered list of sticky regex rules**; at each position, try rules in priority order and take the first match.

```js
const RULES = [
  ['comment', /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
  ['string', /'(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?|`(?:\\[\s\S]|[^`\\])*`?/y],
  ['number', /\b(?:0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/iy],
  ['keyword', /\b(?:const|let|var|function|return|if|else|for|while|class|new|import|export|from|await|async|true|false|null|undefined)\b/y],
  ['identifier', /[A-Za-z_$][\w$]*/y],
  ['whitespace', /\s+/y],
  ['punctuation', /[{}()[\];,.]/y],
  ['operator', /[+\-*/%=!<>&|^~?:]+/y],
]

function tokenize(src) {
  const tokens = []
  let pos = 0
  outer: while (pos < src.length) {
    for (const [type, re] of RULES) {
      re.lastIndex = pos
      const m = re.exec(src)
      if (m && m[0].length > 0) {
        tokens.push({ type, value: m[0] })
        pos += m[0].length
        continue outer
      }
    }
    tokens.push({ type: 'unknown', value: src[pos++] }) // never get stuck
  }
  return tokens
}
```

Design notes worth saying out loud:

- **Order matters**: comments and strings before operators (so `//` isn't two divisions), keywords before identifiers.
- The **sticky flag `y`** anchors the match at `lastIndex`, so we don't scan ahead — O(n) overall.
- **Never get stuck**: an "unknown" fallback consumes one character. Unterminated strings/comments match to the end (users type `"` before closing it!).
- **Lossless**: concatenating token values reproduces the source exactly — essential for editors (cursor positions map 1:1).
- Real highlighters (Prism, highlight.js) use this approach; editors (CodeMirror 6, Monaco) use **incremental parsers** (Lezer, TextMate grammars with per-line state) so a keystroke only re-tokenizes the changed region.

### Rendering safely and fast

- **Never** build HTML by concatenating raw token text — escape `<`, `&`, `>`; a test string containing `<img onerror=...>` is an XSS. In React, rendering `<span>{token.value}</span>` escapes for you.
- The classic trick for a highlighted editor: a transparent `<textarea>` on top of a `<pre>` with coloured spans, identical font metrics and scroll sync. The textarea keeps native editing, IME, undo, accessibility; the `<pre>` only draws colours.
- **Incremental updates**: cache tokens per line keyed by `(lineText, startState)`; only re-tokenize lines whose text or entry state (e.g. "inside a block comment") changed.
- **Large files**: virtualize lines (render only the visible ~50 lines), tokenize in a Web Worker, use `requestIdleCallback` to highlight off-screen lines.
- **regex101 specifics**: compile the user's regex in a `try/catch` (invalid patterns show an error), run matching in a **Worker with a timeout** (catastrophic backtracking like `(a+)+$` can freeze the main thread — you can terminate a worker, not a main-thread loop), and highlight match ranges with `matchAll` + `d` flag (`indices`) for capture-group positions.

## Part 2: Tries

A **trie** (prefix tree) stores strings character by character; every path from the root spells a prefix.

```text
            (root)
           /      \
          c        d
          |        |
          a        o
         / \       |
        r*  t*     g*
        |
        t*
  * = end of a word. Words: car, cart, cat, dog
```

Operations cost **O(L)** where L is the word length — independent of how many words you store. That's why tries power autocomplete, spell-checkers, IP routing tables and T9.

```js
class TrieNode {
  constructor() {
    this.children = new Map()
    this.isWord = false
    this.count = 0 // frequency, for ranking suggestions
  }
}

class Trie {
  constructor() { this.root = new TrieNode() }

  insert(word, count = 1) {
    let node = this.root
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode())
      node = node.children.get(ch)
    }
    node.isWord = true
    node.count += count
  }

  #find(prefix) {
    let node = this.root
    for (const ch of prefix) {
      node = node.children.get(ch)
      if (!node) return null
    }
    return node
  }

  search(word) { return this.#find(word)?.isWord ?? false }
  startsWith(prefix) { return this.#find(prefix) !== null }
}
```

For **ranked suggestions** you collect all words under the prefix node (DFS) and take the top-k by frequency. To make that O(k) at query time in production, store a precomputed **top-k list at each node** (updated on insert) — classic for search autocomplete at scale.

## Part 3: T9 predictive text over contacts

Old phone keypads map digits to letters:

```text
2: abc   3: def   4: ghi   5: jkl
6: mno   7: pqrs  8: tuv   9: wxyz
```

Typing `2 2 7` should suggest contacts starting with any of `aap, abr, car, ...` — e.g. "Carl", "Barbara". Two approaches:

1. **Letter trie + branching search**: from each node follow *all* letters of the current digit. Branching factor 3–4 per keystroke → can explode for long inputs.
2. **Digit trie (better)**: convert each contact name to its digit sequence (`carl` → `2275`) and insert into a trie keyed by **digits**; each node stores the contacts that pass through it. Lookup is a straight O(L) walk.

```js
const KEYMAP = { a: 2, b: 2, c: 2, d: 3, e: 3, f: 3, g: 4, h: 4, i: 4, j: 5, k: 5, l: 5, m: 6, n: 6, o: 6,
  p: 7, q: 7, r: 7, s: 7, t: 8, u: 8, v: 8, w: 9, x: 9, y: 9, z: 9 }

const toDigits = (name) => [...name.toLowerCase()].map((ch) => KEYMAP[ch] ?? '').join('')
```

Matching on **every word** of the name (first name *or* surname), plus the phone number itself (digits match digits directly), makes it feel like real phone search.

### Productionising it (the "schema" part)

- **Client side** (phone contacts, < ~10k entries): build the digit trie on load (in a Worker if big), keep it in memory, persist contacts in IndexedDB. Ranking: frequency of calls, recency, favourites.
- **Server side** (company directory, millions of users): store `contact(id, name, phone, …)` plus an index table `t9_prefix(prefix_digits, contact_id, score)` or an Elasticsearch field with an **edge n-gram** analyzer over the digit-encoded name. Cap prefixes (e.g. first 10 digits), shard by tenant/user, cache hot prefixes, return top-k by score. The frontend debounces, cancels stale requests and caches prefix results (typing `22` after `2` can filter the `2` results client-side).

## Interview questions

:::question
difficulty: hard
### How would you design a regex101-like tester's frontend?
- **State:** pattern, flags, test string — the source of truth. Derived: compiled regex (or error), matches with group indices, an explanation tree.
- **Computation:** compile in `try/catch`; run matching in a **Web Worker** with a timeout, since catastrophic backtracking can hang — a worker can be terminated. Use `matchAll` with the `d` flag for group indices. Debounce input ~100ms.
- **Rendering:** highlight the pattern with a tokenizer (groups, quantifiers, classes, escapes) and the test string with match ranges as non-overlapping spans (alternating colours, nested group colours). Escape text. Overlay technique: textarea over a highlighted `<pre>`.
- **Performance:** incremental tokenizing, virtualized rendering for large test strings, cap the number of displayed matches.
- **UX/a11y:** error messages with positions, keyboard-accessible match list, shareable URL (state encoded in URL/hash or saved via API), flavours (PCRE vs JS).
:::

:::question
difficulty: medium
### Why use a trie for autocomplete instead of filtering an array?
Filtering is O(N·L) per keystroke — every word is checked. A trie walks only the prefix (O(L)) and then enumerates matching words under one node; with per-node cached top-k lists, a query is O(L + k). Tries also share common prefixes (memory-efficient for large dictionaries with shared prefixes) and support incremental search naturally (keep the current node as the user types). For small lists (< few thousand) a simple filter is fine — say so.
:::

:::question
difficulty: medium
companies: Sprinklr
### How would you implement T9 search over contacts efficiently?
Pre-encode each contact's name words into digit strings via the keypad mapping and insert them into a **digit trie**, storing contact ids at each node (or at least at terminal nodes, collecting via DFS). A typed digit sequence becomes a single O(L) walk — no branching over letter combinations. Also index the phone number itself. Rank by call frequency/recency. For a server-side version use an edge-n-gram index over digit-encoded names with top-k per prefix and caching of hot prefixes.
:::

## Challenges

:::challenge
difficulty: hard
companies: Senior React rounds
### Write a lossless JavaScript tokenizer
Implement `tokenize(src)` returning `[{ type, value }]` where `type` is one of `comment`, `string`, `number`, `keyword`, `identifier`, `whitespace`, `punctuation`, `operator`, `unknown`.

- Comments: `// ...` to end of line, `/* ... */` (unterminated runs to end of input).
- Strings: single, double or backtick quotes, with backslash escapes; an unterminated string runs to the end of the line (or input for backticks).
- Numbers: integers, decimals, hex (`0x1f`).
- Keywords: `const let var function return if else for while class new import export from await async true false null undefined`.
- Punctuation: `{ } ( ) [ ] ; , .` — operators: runs of `+ - * / % = ! < > & | ^ ~ ? :`.
- Concatenating all values must equal the input exactly.
@@@starter
```js
function tokenize(src) {
  // your code
}
```
@@@tests
```js
const types = (s) => tokenize(s).filter((t) => t.type !== 'whitespace').map((t) => t.type + ':' + t.value)

test('basic statement', () => {
  expect(types('const x = 42;')).toEqual(['keyword:const', 'identifier:x', 'operator:=', 'number:42', 'punctuation:;'])
})

test('comments are not operators', () => {
  expect(types('a // hi\n/* b */ c')).toEqual(['identifier:a', 'comment:// hi', 'comment:/* b */', 'identifier:c'])
})

test('strings with escapes and unterminated', () => {
  expect(types(`"a\\"b" 'x`)).toEqual(['string:"a\\"b"', "string:'x"])
})

test('hex, decimals and keywords vs identifiers', () => {
  expect(types('0x1F 3.14 constant returnValue return')).toEqual(['number:0x1F', 'number:3.14', 'identifier:constant', 'identifier:returnValue', 'keyword:return'])
})

test('lossless round trip including unknown chars', () => {
  const src = 'if (a >= b) { s = `t${1}`; } # @\n'
  expect(tokenize(src).map((t) => t.value).join('')).toBe(src)
  expect(tokenize(src).some((t) => t.type === 'unknown')).toBe(true)
})
```
@@@solution
```js
const RULES = [
  ['comment', /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
  ['string', /'(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?|`(?:\\[\s\S]|[^`\\])*`?/y],
  ['number', /(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w$])/y],
  ['keyword', /(?:const|let|var|function|return|if|else|for|while|class|new|import|export|from|await|async|true|false|null|undefined)(?![\w$])/y],
  ['identifier', /[A-Za-z_$][\w$]*/y],
  ['whitespace', /\s+/y],
  ['punctuation', /[{}()[\];,.]/y],
  ['operator', /[+\-*/%=!<>&|^~?:]+/y],
]

function tokenize(src) {
  const tokens = []
  let pos = 0
  outer: while (pos < src.length) {
    for (const [type, re] of RULES) {
      re.lastIndex = pos
      const m = re.exec(src)
      if (m && m[0].length > 0) {
        tokens.push({ type, value: m[0] })
        pos += m[0].length
        continue outer
      }
    }
    tokens.push({ type: 'unknown', value: src[pos] })
    pos++
  }
  return tokens
}
```

- Sticky (`y`) regexes match exactly at `pos`, so the scan is linear.
- Rule order resolves ambiguity: comment > string > number > keyword > identifier > … The `(?![\w$])` lookahead stops `constant` from matching keyword `const` (identifier wins), and stops `3abc` from being a number.
- Each string alternative allows an optional closing quote (`'?`), so unterminated strings still tokenize while the user is typing.
- `unknown` consumes one char, guaranteeing progress and losslessness.

**Limitations to mention:** regex literals vs division (`a / b / c` vs `/re/g`) need context (previous token); template-literal `${}` nesting needs a state stack; incremental re-tokenizing needs per-line start state.
:::

:::challenge
difficulty: medium
companies: Google, Sprinklr
### Autocomplete trie with top-k suggestions
Implement `class Autocomplete` with:

- `insert(word, weight = 1)` — adds weight if the word already exists.
- `suggest(prefix, k)` — up to `k` words starting with `prefix`, sorted by weight descending, ties alphabetically. Unknown prefix → `[]`. Matching is case-sensitive.
@@@starter
```js
class Autocomplete {
  insert(word, weight = 1) {}
  suggest(prefix, k) {}
}
```
@@@tests
```js
test('ranks by weight then alphabetically', () => {
  const ac = new Autocomplete()
  ac.insert('react', 10)
  ac.insert('redux', 5)
  ac.insert('remix', 5)
  ac.insert('rust', 50)
  ac.insert('re', 1)
  expect(ac.suggest('re', 3)).toEqual(['react', 'redux', 'remix'])
  expect(ac.suggest('r', 2)).toEqual(['rust', 'react'])
})

test('accumulates weight', () => {
  const ac = new Autocomplete()
  ac.insert('vue', 3)
  ac.insert('vite', 2)
  ac.insert('vite', 2)
  expect(ac.suggest('v', 5)).toEqual(['vite', 'vue'])
})

test('unknown prefix and exact word', () => {
  const ac = new Autocomplete()
  ac.insert('svelte')
  expect(ac.suggest('x', 3)).toEqual([])
  expect(ac.suggest('svelte', 3)).toEqual(['svelte'])
  expect(ac.suggest('', 3)).toEqual(['svelte'])
})
```
@@@solution
```js
class Autocomplete {
  constructor() {
    this.root = { children: new Map(), weight: 0, isWord: false }
  }

  insert(word, weight = 1) {
    let node = this.root
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, { children: new Map(), weight: 0, isWord: false })
      node = node.children.get(ch)
    }
    node.isWord = true
    node.weight += weight
  }

  suggest(prefix, k) {
    let node = this.root
    for (const ch of prefix) {
      node = node.children.get(ch)
      if (!node) return []
    }
    const found = []
    const dfs = (n, path) => {
      if (n.isWord) found.push([path, n.weight])
      for (const [ch, child] of n.children) dfs(child, path + ch)
    }
    dfs(node, prefix)
    found.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    return found.slice(0, k).map(([w]) => w)
  }
}
```

- Walk the prefix: O(L). Collect words under that node with DFS: O(size of subtree). Sort: O(m log m).
- **Scaling up:** keep a bounded min-heap of size k during DFS (O(m log k)), or cache a top-k list at each node updated on insert so `suggest` becomes O(L + k). That's what large-scale search suggestion services do (plus a CDN/edge cache for hot prefixes).
:::

:::challenge
difficulty: hard
companies: Sprinklr
### T9 contact search with a digit trie
Implement `createT9(contacts)` where `contacts` is an array of names. Return `search(digits)` that returns all contact names where **any word** of the name starts with letters that map to `digits` on a phone keypad (2=abc, 3=def, 4=ghi, 5=jkl, 6=mno, 7=pqrs, 8=tuv, 9=wxyz). Case-insensitive. Each contact appears at most once, results in the original contact order. Empty `digits` → `[]`.
@@@starter
```js
function createT9(contacts) {
  return function search(digits) {
    // your code
  }
}
```
@@@tests
```js
const contacts = ['Carl Sagan', 'Barbara Liskov', 'Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus']

test('matches first names', () => {
  const search = createT9(contacts)
  expect(search('227')).toEqual(['Carl Sagan', 'Barbara Liskov'])
})

test('matches any word (surname) without duplicates', () => {
  const search = createT9(contacts)
  expect(search('5')).toEqual(['Barbara Liskov', 'Ada Lovelace', 'Linus'])
  expect(search('4')).toEqual(['Grace Hopper'])
})

test('longer sequences narrow results', () => {
  const search = createT9(contacts)
  expect(search('2')).toEqual(['Carl Sagan', 'Barbara Liskov', 'Ada Lovelace', 'Alan Turing'])
  expect(search('2526')).toEqual(['Alan Turing'])
  expect(search('999')).toEqual([])
  expect(search('')).toEqual([])
})
```
@@@solution
```js
const KEYS = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz' }
const LETTER_TO_DIGIT = {}
for (const [d, letters] of Object.entries(KEYS)) for (const ch of letters) LETTER_TO_DIGIT[ch] = d

function createT9(contacts) {
  const root = { children: new Map(), ids: new Set() }

  contacts.forEach((name, id) => {
    for (const word of name.toLowerCase().split(/\s+/)) {
      let node = root
      for (const ch of word) {
        const d = LETTER_TO_DIGIT[ch]
        if (!d) break // stop at characters without a key (digits, punctuation)
        if (!node.children.has(d)) node.children.set(d, { children: new Map(), ids: new Set() })
        node = node.children.get(d)
        node.ids.add(id) // every prefix node knows which contacts pass through it
      }
    }
  })

  return function search(digits) {
    if (!digits) return []
    let node = root
    for (const d of digits) {
      node = node.children.get(d)
      if (!node) return []
    }
    return [...node.ids].sort((a, b) => a - b).map((id) => contacts[id])
  }
}
```

- Names are converted letter → digit as they're inserted, so the trie is keyed by **digits**; search is a single O(L) walk with no branching.
- Storing contact ids in a `Set` at every prefix node makes results instant and de-duplicates contacts whose several words share a prefix. Trade-off: memory O(total characters) ids — fine for phone-sized lists; for huge directories store ids only at terminal nodes and DFS, or cap per-node lists to top-k by score.
- Sorting ids preserves original contact order (in production, order by call frequency/recency instead).
:::

## Quick check

:::quiz
### Why use the sticky `y` flag in a regex-based tokenizer?
- [ ] It makes the regex case-insensitive
- [x] It forces the match to start exactly at `lastIndex`, avoiding scanning ahead
- [ ] It enables Unicode
- [ ] It makes matching global
@@@explain
Without `y` (or anchoring), `exec` could find a match later in the string and silently skip characters.
:::

:::quiz
### Lookup cost for a word of length L in a trie with N words?
- [x] O(L)
- [ ] O(N)
- [ ] O(N·L)
- [ ] O(log N)
@@@explain
You follow one edge per character; N doesn't matter.
:::
