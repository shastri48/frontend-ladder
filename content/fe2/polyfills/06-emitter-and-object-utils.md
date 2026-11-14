---
title: EventEmitter, classnames, get/set by Path & Deep Merge
summary: The observer pattern from scratch, plus the object utilities that show up in real codebases and interviews — classnames, lodash get, building nested objects from "a.b.c" paths, a correct deep merge, and getElementsByStyle.
minutes: 20
---

## The observer (pub/sub) pattern

An **EventEmitter** lets parts of an app communicate without knowing about each other: publishers `emit` named events, subscribers register handlers with `on`. It's the backbone of:

- DOM events (`addEventListener` is an emitter on every node)
- Node.js (`EventEmitter` class, streams, servers)
- State libraries (Redux `subscribe`, Zustand, MobX), WebSocket wrappers, analytics buses
- Micro-frontend communication

```text
            on('login', fnA)      emit('login', user)
Component A ───────────┐        ┌──────────────── Auth module
Component B ───────┐   ▼        ▼
                   └─► { login: [fnA, fnB] } ── calls fnA(user), fnB(user)
```

### Design decisions that interviewers grade

1. **Data structure**: `Map<eventName, Array<listener>>` (array keeps insertion order and allows the same listener twice like Node) or `Set` (dedupes).
2. **`off`** must remove the exact function reference — which is why `on(evt, () => …)` with an inline arrow can never be removed unless you return an unsubscribe function.
3. **`once`**: wrap the listener so it removes itself after the first call — but `off(evt, original)` should still work, so remember the original on the wrapper.
4. **Emit safely**: iterate over a **copy** of the listener list; a listener that removes itself (or adds new ones) during emit shouldn't break iteration.
5. **Memory**: forgetting `off` is the #1 memory leak in pub/sub ("many leak memory here"). Return an unsubscribe function, clean up in `useEffect`, and consider a max-listeners warning like Node.
6. **Errors**: should one throwing listener stop the others? Node lets it throw; robust buses catch and report.

## classnames

Builds a `className` string from strings, objects (`{ active: isActive }`) and nested arrays, skipping falsy values. Used in nearly every React codebase (`clsx` is the tiny modern equivalent).

## get / set by path

`get(obj, 'a.b[0].c', defaultValue)` safely reads nested data. Today optional chaining (`obj?.a?.b?.[0]?.c ?? default`) covers static paths, but **dynamic paths** (form field names, config keys, table column accessors) still need `get`. The reverse — building nested objects from a path — powers form libraries (`name="address.city"`) and the Razorpay question "convert `a.b.c` into `{ a: { b: { c: value } } }`".

## Deep merge

Merging config objects, default options, or API patches requires a **deep** merge: plain objects merge recursively, arrays concatenate (or replace — define it!), and on conflict the second value wins.

The reference doc includes a candidate's `merge_dicts` implementation. It passes the four given test cases, but has subtle bugs worth spotting:

```js
if (!v1) {            // ❌ treats 0, '', false, null as "missing"
  result[key] = v2
} else if (!v2) {     // ❌ if obj2 explicitly sets 0/false/'', obj1's value wins
  result[key] = v1    // ❌ and v1 is not cloned → result shares nested objects with obj1
}
```

So `merge_dicts({ a: 1 }, { a: 0 })` returns `{ a: 1 }` — but "second overwrites" says it should be `{ a: 0 }`. Same for `{ enabled: true }` merged with `{ enabled: false }` — a real feature-flag bug. The fix: check **key presence** (`Object.hasOwn(obj, key)`), not truthiness, and clone values that come only from one side.

## getElementsByStyle

"Build `getElementsByStyle(root, property, value)`" tests DOM traversal and how browsers compute styles. The catch: `element.style` only shows **inline** styles; the real, final value comes from `getComputedStyle`, which returns **normalised** values (`red` → `rgb(255, 0, 0)`, `1em` → `16px`). So you must normalise the target value the same way before comparing.

## Interview questions

:::question
difficulty: medium
### Why should `on()` return an unsubscribe function?
Because removing a listener requires the exact same function reference. With inline handlers (`on('x', () => …)`) callers often don't keep a reference, so they can't call `off`, leading to leaks and duplicate handlers (e.g. a React effect that re-subscribes every render). Returning `() => off(event, handler)` closes over the reference and makes cleanup trivial: `useEffect(() => bus.on('x', handler), [])`.
:::

:::question
difficulty: medium
### Why iterate over a copy of the listeners when emitting?
If a listener calls `off` on itself (as `once` wrappers do) during iteration, removing it from the array shifts the remaining elements and the next listener gets skipped. Copying (`[...listeners]`) freezes the list for that emit. It also means listeners added during an emit run on the next emit, not this one — predictable semantics.
:::

## Challenges

:::challenge
difficulty: medium
companies: Meta, Apple, Microsoft, OpenAI
### Create an EventEmitter
Implement `class EventEmitter` with:
- `on(event, listener)` — register; returns an **unsubscribe function**.
- `off(event, listener)` — remove (works for `once` listeners too, by original reference).
- `once(event, listener)` — runs at most once; returns an unsubscribe function.
- `emit(event, ...args)` — calls listeners in registration order with args; returns `true` if there were listeners, otherwise `false`.
@@@starter
```js
class EventEmitter {
  // your code
}
```
@@@tests
```js
test('on + emit with args', () => {
  const e = new EventEmitter()
  const got = []
  e.on('msg', (a, b) => got.push(a + b))
  expect(e.emit('msg', 1, 2)).toBe(true)
  expect(got).toEqual([3])
})
test('emit with no listeners returns false', () => {
  expect(new EventEmitter().emit('nothing')).toBe(false)
})
test('off and unsubscribe', () => {
  const e = new EventEmitter()
  let n = 0
  const fn = () => n++
  e.on('x', fn)
  const unsub = e.on('y', fn)
  e.off('x', fn)
  unsub()
  e.emit('x'); e.emit('y')
  expect(n).toBe(0)
})
test('once runs a single time', () => {
  const e = new EventEmitter()
  let n = 0
  e.once('x', () => n++)
  e.emit('x'); e.emit('x')
  expect(n).toBe(1)
})
test('off removes a once listener by original reference', () => {
  const e = new EventEmitter()
  let n = 0
  const fn = () => n++
  e.once('x', fn)
  e.off('x', fn)
  e.emit('x')
  expect(n).toBe(0)
})
test('removing during emit does not skip others', () => {
  const e = new EventEmitter()
  const order = []
  e.once('x', () => order.push('a'))
  e.on('x', () => order.push('b'))
  e.emit('x')
  expect(order).toEqual(['a', 'b'])
})
```
@@@solution
```js
class EventEmitter {
  #events = new Map() // event -> array of listeners

  on(event, listener) {
    if (!this.#events.has(event)) this.#events.set(event, [])
    this.#events.get(event).push(listener)
    return () => this.off(event, listener)
  }

  off(event, listener) {
    const list = this.#events.get(event)
    if (!list) return
    const index = list.findIndex((l) => l === listener || l.original === listener)
    if (index !== -1) list.splice(index, 1)
    if (list.length === 0) this.#events.delete(event) // free memory
  }

  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper)
      listener.apply(this, args)
    }
    wrapper.original = listener // so off(event, listener) finds it
    return this.on(event, wrapper)
  }

  emit(event, ...args) {
    const list = this.#events.get(event)
    if (!list || list.length === 0) return false
    for (const listener of [...list]) {   // copy: safe against removal mid-emit
      listener.apply(this, args)
    }
    return true
  }
}
```
**Complexity:** `on` O(1), `off` O(k), `emit` O(k) for k listeners. **Follow-ups:** wildcard events, async listeners (`await Promise.all`), error isolation (try/catch per listener), max-listeners warning, typed events in TypeScript.
:::

:::challenge
difficulty: easy
companies: OpenAI, Meta
### Implement classnames
`classNames(...args)` accepts strings, numbers, objects (`{ cls: condition }`) and arrays (nested), and returns a space-separated string of the truthy class names.
@@@starter
```js
function classNames(...args) {
  // your code
}
```
@@@tests
```js
test('strings and objects', () => {
  expect(classNames('btn', { active: true, disabled: false })).toBe('btn active')
})
test('nested arrays and falsy values', () => {
  expect(classNames('a', ['b', ['c', null]], undefined, 0, '', false, { d: 1 })).toBe('a b c d')
})
test('numbers are included', () => {
  expect(classNames(1, 'x')).toBe('1 x')
})
test('empty', () => {
  expect(classNames()).toBe('')
})
```
@@@solution
```js
function classNames(...args) {
  const classes = []
  const add = (arg) => {
    if (!arg) return                                  // skips '', 0, null, undefined, false
    if (typeof arg === 'string' || typeof arg === 'number') classes.push(arg)
    else if (Array.isArray(arg)) arg.forEach(add)     // recurse into arrays
    else if (typeof arg === 'object') {
      for (const key of Object.keys(arg)) if (arg[key]) classes.push(key)
    }
  }
  args.forEach(add)
  return classes.join(' ')
}
```
O(total inputs). A real-world bonus: dedupe with a `Set` (the `classnames/dedupe` variant).
:::

:::challenge
difficulty: medium
companies: Meta
### Implement lodash get
`get(obj, path, defaultValue)` where `path` is a string like `'a.b[0].c'` or an array `['a', 'b', 0, 'c']`. Return `defaultValue` if the resolved value is `undefined`.
@@@starter
```js
function get(obj, path, defaultValue) {
  // your code
}
```
@@@tests
```js
const data = { a: { b: [{ c: 3 }], n: null, z: 0 } }
test('dot and bracket paths', () => {
  expect(get(data, 'a.b[0].c')).toBe(3)
  expect(get(data, 'a.b.0.c')).toBe(3)
})
test('array paths', () => {
  expect(get(data, ['a', 'b', 0, 'c'])).toBe(3)
})
test('default for missing', () => {
  expect(get(data, 'a.x.y', 'def')).toBe('def')
  expect(get(null, 'a', 'def')).toBe('def')
})
test('null and falsy values are returned, not defaulted', () => {
  expect(get(data, 'a.n', 'def')).toBe(null)
  expect(get(data, 'a.z', 'def')).toBe(0)
})
```
@@@solution
```js
function get(obj, path, defaultValue) {
  const keys = Array.isArray(path)
    ? path
    : String(path).replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean)

  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue
    current = current[key]
  }
  return current === undefined ? defaultValue : current
}
```
The regex turns `b[0]` into `b.0`. Only `undefined` triggers the default (lodash semantics) — `null` and `0` are real values.
:::

:::challenge
difficulty: medium
companies: Razorpay
### Convert "a.b.c" into a nested object
Implement:
- `pathToObject(path, value)` → `'a.b.c', 1` gives `{ a: { b: { c: 1 } } }`.
- `set(obj, path, value)` → sets a nested value in an existing object (mutating it), creating missing objects, or **arrays** when the next key is a number; returns `obj`.
@@@starter
```js
function pathToObject(path, value) {
  // your code
}
function set(obj, path, value) {
  // your code
}
```
@@@tests
```js
test('pathToObject', () => {
  expect(pathToObject('a.b.c', 'value')).toEqual({ a: { b: { c: 'value' } } })
  expect(pathToObject('x', 1)).toEqual({ x: 1 })
})
test('set into existing object', () => {
  const o = { a: { keep: true } }
  set(o, 'a.b.c', 5)
  expect(o).toEqual({ a: { keep: true, b: { c: 5 } } })
})
test('set creates arrays for numeric keys', () => {
  const o = {}
  set(o, 'list[0].name', 'x')
  expect(Array.isArray(o.list)).toBe(true)
  expect(o.list[0].name).toBe('x')
})
test('reduce many paths into one object', () => {
  const flat = { 'user.name': 'Ana', 'user.address.city': 'Pune' }
  const out = {}
  for (const [k, v] of Object.entries(flat)) set(out, k, v)
  expect(out).toEqual({ user: { name: 'Ana', address: { city: 'Pune' } } })
})
```
@@@solution
```js
function pathToObject(path, value) {
  return path
    .split('.')
    .reduceRight((acc, key) => ({ [key]: acc }), value)
}

function set(obj, path, value) {
  const keys = String(path).replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean)
  let current = obj
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      current[key] = value
      return
    }
    const nextIsIndex = /^\d+$/.test(keys[i + 1])
    if (current[key] === null || typeof current[key] !== 'object') {
      current[key] = nextIsIndex ? [] : {}
    }
    current = current[key]
  })
  return obj
}
```
`reduceRight` builds from the innermost key outwards: `c → {c: v} → {b: {c: v}} → {a: …}`. `set` walks down, creating containers as needed. Together with `flattenObject` (previous lesson) you get **unflatten**. Watch out for prototype pollution in real code: reject keys like `__proto__`, `constructor`, `prototype` when paths come from user input.
:::

:::challenge
difficulty: medium
### Fix merge_dicts (deep merge)
Implement `mergeDicts(obj1, obj2)` returning a **new** object (inputs untouched):
- keys present in only one object → (deep-cloned) value from that object
- both values arrays → concatenation
- both plain objects → merged recursively
- otherwise → `obj2`'s value wins, **even if it's falsy** (`0`, `false`, `''`, `null`).
@@@hint
Decide by key presence (`Object.hasOwn`), not by truthiness.
@@@starter
```js
function mergeDicts(obj1, obj2) {
  // your code
}
```
@@@tests
```js
test('simple key overwrite/merge', () => {
  expect(mergeDicts({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({ a: 1, b: 3, c: 4 })
})
test('nested object merge', () => {
  expect(mergeDicts({ a: { x: 1 } }, { a: { y: 2 } })).toEqual({ a: { x: 1, y: 2 } })
})
test('array concatenation', () => {
  expect(mergeDicts({ a: [1] }, { a: [2, 3] })).toEqual({ a: [1, 2, 3] })
})
test('conflicting types: second overwrites', () => {
  expect(mergeDicts({ a: [1] }, { a: { b: 2 } })).toEqual({ a: { b: 2 } })
})
test('falsy values from obj2 still win', () => {
  expect(mergeDicts({ a: 1, flag: true }, { a: 0, flag: false })).toEqual({ a: 0, flag: false })
})
test('does not share references with inputs', () => {
  const src = { nested: { v: 1 } }
  const out = mergeDicts(src, {})
  out.nested.v = 99
  expect(src.nested.v).toBe(1)
})
```
@@@solution
```js
const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype

function clone(v) {
  if (Array.isArray(v)) return v.map(clone)
  if (isPlainObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]))
  return v
}

function mergeDicts(obj1, obj2) {
  const result = {}
  const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])

  for (const key of keys) {
    const in1 = Object.hasOwn(obj1, key)
    const in2 = Object.hasOwn(obj2, key)
    const v1 = obj1[key]
    const v2 = obj2[key]

    if (!in2) result[key] = clone(v1)
    else if (!in1) result[key] = clone(v2)
    else if (Array.isArray(v1) && Array.isArray(v2)) result[key] = [...clone(v1), ...clone(v2)]
    else if (isPlainObject(v1) && isPlainObject(v2)) result[key] = mergeDicts(v1, v2)
    else result[key] = clone(v2)
  }
  return result
}
```
Fixes vs the original: presence checks instead of `!v1`/`!v2`, deep cloning of one-sided values, and a stricter `isPlainObject` (the original's version treats `Date`/`Map` as plain objects and would "merge" them into `{}`).
:::

:::challenge
difficulty: hard
### Build getElementsByStyle(root, property, value)
Return all elements under `root` (inclusive) whose **computed** style `property` equals `value`. E.g. `getElementsByStyle(document.body, 'color', 'red')`. No tests (needs a DOM) — write the solution and explain the edge cases.
@@@hint
`getComputedStyle` returns normalised values (`rgb(255, 0, 0)`), so normalise the target value by applying it to a temporary element first.
@@@solution
```js
function getElementsByStyle(root, property, value) {
  // 1. Normalise the target value the same way the browser will report it
  const probe = document.createElement('div')
  probe.style.setProperty(property, value)
  probe.style.display = 'none' // avoid layout impact (doesn't affect most properties)
  root.appendChild(probe)
  const target = getComputedStyle(probe).getPropertyValue(property)
  probe.remove()

  // 2. Walk the tree (DFS) using a TreeWalker — fast and skips text nodes
  const matches = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let node = walker.currentNode
  while (node) {
    if (getComputedStyle(node).getPropertyValue(property) === target) {
      matches.push(node)
    }
    node = walker.nextNode()
  }
  return matches
}
```
Manual recursive version of the traversal:
```js
function traverse(el, visit) {
  visit(el)
  for (const child of el.children) traverse(child, visit)
}
```
**Edge cases & talking points:**
- `el.style.color` only reads **inline** styles; stylesheet and inherited values need `getComputedStyle`.
- Value normalisation (`red` vs `rgb(255, 0, 0)`, `#f00`, `1em` vs `16px`) — the probe trick handles it. Properties like `display` would be overridden by the probe's own `display: none`, so for that property skip setting it.
- Performance: `getComputedStyle` can force style recalculation; read all values in one pass without interleaving DOM writes (avoid layout thrashing). O(n) elements.
- Shadow DOM: also walk `el.shadowRoot` if present. Pseudo-elements need `getComputedStyle(el, '::before')`.
:::

## Quick check

:::quiz
### In the reference doc's merge_dicts, what does `merge_dicts({ a: 1 }, { a: 0 })` return?
- [ ] `{ a: 0 }`
- [x] `{ a: 1 }` — because `!v2` treats 0 as missing
- [ ] `{ a: [1, 0] }`
- [ ] It throws
@@@explain
`!0` is true, so the code falls into the "v2 missing" branch and keeps v1. Check key presence instead of truthiness.
:::

:::quiz
### Why can't you remove a listener added as `emitter.on('x', () => {...})` with `off`?
- [ ] Arrow functions can't be listeners
- [x] You no longer have a reference to that exact function
- [ ] `off` only works for named functions
- [ ] Listeners are frozen after registration
@@@explain
Removal compares function identity. Keep a reference or use the returned unsubscribe function.
:::
