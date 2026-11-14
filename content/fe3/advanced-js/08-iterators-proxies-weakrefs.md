---
title: Iterators, Generators, Proxies and Weak References
summary: The metaprogramming toolkit behind modern frameworks — iteration protocols, generators, Proxy/Reflect reactivity (how Vue and MobX work), and WeakMap/WeakRef/FinalizationRegistry for leak-free caches.
minutes: 24
---

## Why these matter at senior level

These features rarely appear in feature code, but they power the tools you use daily:

- **Iterators/generators** → `for...of`, spread, `Array.from`, async iteration over streams, Redux-Saga, React's old scheduler ideas, lazy pipelines.
- **Proxy/Reflect** → Vue 3 and MobX reactivity, Immer drafts, validation layers, API mocks.
- **WeakMap/WeakRef** → caches and metadata that don't cause memory leaks (React uses WeakMaps internally; `WeakMap` is how private data and memoization by object work safely).

Interviewers use them to probe whether you understand *protocols* — contracts the language calls into — rather than just APIs.

## The iteration protocols

An object is **iterable** if it has a `[Symbol.iterator]()` method returning an **iterator**: an object with `next()` that returns `{ value, done }`.

```js
const range = {
  from: 1,
  to: 4,
  [Symbol.iterator]() {
    let current = this.from
    const last = this.to
    return {
      next: () => (current <= last ? { value: current++, done: false } : { value: undefined, done: true }),
      [Symbol.iterator]() { return this }, // iterators are usually iterable themselves
    }
  },
}

[...range]            // [1, 2, 3, 4]
for (const n of range) console.log(n)
```

Everything that consumes iterables — `for...of`, spread, destructuring, `Array.from`, `new Map(iterable)`, `Promise.all(iterable)` — calls this protocol. That's why you can `Promise.all(new Set(promises))`.

## Generators: iterators without the boilerplate

A generator function (`function*`) returns an iterator whose body **pauses at each `yield`**:

```js
function* range(from, to, step = 1) {
  for (let n = from; n <= to; n += step) yield n
}
[...range(0, 10, 5)] // [0, 5, 10]
```

What makes generators special:

- **Lazy**: values are computed on demand. `function* naturals() { let n = 0; while (true) yield n++ }` is an infinite sequence that costs nothing until you pull.
- **Two-way**: `it.next(x)` sends `x` *into* the generator as the result of the paused `yield`.
- **Cooperative pausing**: a generator is a function that can be suspended and resumed — the conceptual basis of `async/await` (which is generators + promises: `co`, Babel's regenerator transform).

```js
// Lazy pipeline: only processes as many items as needed
function* map(it, fn) { for (const x of it) yield fn(x) }
function* filter(it, pred) { for (const x of it) if (pred(x)) yield x }
function* take(it, n) { for (const x of it) { if (n-- <= 0) return; yield x } }

const firstThreeEvenSquares = [...take(filter(map(naturals(), (n) => n * n), (n) => n % 2 === 0), 3)]
// [0, 4, 16] — works on an infinite source
```

### Async iteration

```js
async function* paginate(url) {
  let next = url
  while (next) {
    const res = await fetch(next)
    const { items, nextUrl } = await res.json()
    yield* items
    next = nextUrl
  }
}

for await (const item of paginate('/api/orders')) render(item)
```

`ReadableStream` is async-iterable too: `for await (const chunk of response.body)` streams a download.

## Proxy and Reflect: intercepting operations

A `Proxy` wraps an object and lets **traps** intercept fundamental operations: `get`, `set`, `has`, `deleteProperty`, `ownKeys`, `apply`, `construct`… `Reflect` exposes the default behaviour of each, so traps can do "something extra, then the normal thing".

```js
const user = new Proxy({ name: 'Ada', age: 36 }, {
  set(target, key, value, receiver) {
    if (key === 'age' && (!Number.isInteger(value) || value < 0)) throw new TypeError('Invalid age')
    return Reflect.set(target, key, value, receiver)
  },
})
user.age = -1 // TypeError
```

Why `Reflect.set(..., receiver)` instead of `target[key] = value`? It preserves correct behaviour with getters/setters and inheritance (`this` inside a setter should be the proxy, not the raw target).

### How Vue 3 reactivity works

The core idea fits in 30 lines:

1. **Track**: when an effect reads `state.count` (the `get` trap), record "this effect depends on `state.count`".
2. **Trigger**: when someone writes `state.count` (the `set` trap), re-run every effect that depends on it.

```js
let activeEffect = null
const deps = new WeakMap() // target -> Map(key -> Set(effects))

function track(target, key) {
  if (!activeEffect) return
  let keyMap = deps.get(target)
  if (!keyMap) deps.set(target, (keyMap = new Map()))
  let effects = keyMap.get(key)
  if (!effects) keyMap.set(key, (effects = new Set()))
  effects.add(activeEffect)
}

function trigger(target, key) {
  deps.get(target)?.get(key)?.forEach((fn) => fn())
}

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      return typeof value === 'object' && value !== null ? reactive(value) : value // deep, lazily
    },
    set(target, key, value, receiver) {
      const old = target[key]
      const ok = Reflect.set(target, key, value, receiver)
      if (old !== value) trigger(target, key)
      return ok
    },
  })
}

function effect(fn) {
  const run = () => {
    activeEffect = run
    try { fn() } finally { activeEffect = null }
  }
  run()
}

const state = reactive({ count: 0 })
effect(() => console.log('count is', state.count)) // logs 0
state.count++                                      // logs 1 automatically
```

This is **fine-grained reactivity**: only effects that read `count` re-run — no virtual DOM diff of the whole component needed. Signals (Solid, Preact, Angular, the TC39 proposal) are the same idea with explicit getter functions instead of proxies. Real implementations also clean up stale dependencies before each run, batch triggers, and cache the proxy per object (in a WeakMap!).

## WeakMap, WeakSet, WeakRef, FinalizationRegistry

A `Map` holding an object as a key keeps it **alive forever** — even after the rest of the app forgot it. That's a classic SPA memory leak (caches keyed by DOM nodes or component instances).

A **`WeakMap`** holds keys **weakly**: if nothing else references the key object, it can be garbage collected and its entry disappears. Consequences: keys must be objects (or non-registered symbols), and WeakMaps are **not iterable** and have no `size` (contents depend on GC timing).

```js
const cache = new WeakMap()
function getLayoutInfo(element) {
  if (!cache.has(element)) cache.set(element, expensiveMeasure(element))
  return cache.get(element)
}
// When the element is removed from the DOM and dropped by your code, its cache entry goes too.
```

Common uses: memoizing by object identity, attaching metadata to DOM nodes or third-party objects without mutating them, private instance data (pre-`#private`), and reactivity dependency maps.

**`WeakRef`** holds a weak reference to a *value* you might still want: `ref.deref()` returns the object or `undefined` if it was collected. **`FinalizationRegistry`** lets you run a callback *sometime after* an object is collected (e.g. remove its key from a Map of WeakRefs). Both are explicitly non-deterministic — never use them for program correctness, only for optional caches.

```js
class WeakValueCache {
  #map = new Map()
  #registry = new FinalizationRegistry((key) => {
    if (this.#map.get(key)?.deref() === undefined) this.#map.delete(key)
  })
  set(key, value) { this.#map.set(key, new WeakRef(value)); this.#registry.register(value, key) }
  get(key) { return this.#map.get(key)?.deref() }
}
```

## Interview questions

:::question
difficulty: medium
### What's the difference between an iterable and an iterator?
An **iterable** has a `[Symbol.iterator]()` method that *produces* an iterator (arrays, strings, Maps, Sets, NodeLists, generators). An **iterator** is the stateful cursor with `next()` returning `{ value, done }`. You can iterate an array many times because each `for...of` asks for a fresh iterator; a generator object is both iterable and its own iterator, so it can be consumed only **once**.
:::

:::question
difficulty: hard
companies: Meta
### How does Vue 3 (or MobX) know which component to re-render?
Reactive objects are wrapped in a `Proxy`. While a component's render function (an effect) runs, every property read goes through the `get` trap, which records a dependency `target.key → effect` (stored in a `WeakMap<target, Map<key, Set<effect>>>`). When a property is written, the `set` trap looks up the effects that depend on exactly that key and schedules them. So updates are fine-grained and automatic — no manual `setState`, no need to re-render components that didn't read the changed property.
:::

:::question
difficulty: medium
### When would you use a WeakMap instead of a Map?
When the key's lifetime should control the entry's lifetime — you're attaching data to objects you don't own (DOM nodes, component instances, request objects) and don't want your cache to keep them alive. Examples: memoizing a function by object argument, storing per-element measurements, private data. Use a regular `Map` when you need iteration, `size`, primitive keys, or you intentionally own the lifetime (and then bound it, e.g. LRU).
:::

:::question
difficulty: medium
### How are async/await and generators related?
An `async` function is conceptually a generator that yields promises, driven by a runner that calls `next(resolvedValue)` when each promise resolves (or `throw(error)` when it rejects). Before native `async/await`, libraries like `co` did exactly this, and Babel/regenerator still compile async functions to generator-style state machines for older targets.
:::

## Challenges

:::challenge
difficulty: medium
### Make a lazy `chunk` generator and a `zip` over iterables
Implement two generator functions:

- `chunk(iterable, size)` yields arrays of up to `size` items (last chunk may be shorter). Must work with **infinite** iterables when consumed partially.
- `zip(...iterables)` yields arrays `[a, b, ...]` until the **shortest** iterable is exhausted.
@@@starter
```js
function* chunk(iterable, size) {}
function* zip(...iterables) {}
```
@@@tests
```js
test('chunk', () => {
  expect([...chunk([1, 2, 3, 4, 5], 2)]).toEqual([[1, 2], [3, 4], [5]])
  expect([...chunk([], 3)]).toEqual([])
})

test('chunk is lazy on infinite input', () => {
  function* naturals() { let n = 0; while (true) yield n++ }
  const it = chunk(naturals(), 3)
  expect(it.next().value).toEqual([0, 1, 2])
  expect(it.next().value).toEqual([3, 4, 5])
})

test('zip stops at shortest and accepts any iterable', () => {
  expect([...zip([1, 2, 3], 'ab', new Set([true, false, null]))]).toEqual([[1, 'a', true], [2, 'b', false]])
  expect([...zip()]).toEqual([])
})
```
@@@solution
```js
function* chunk(iterable, size) {
  let buf = []
  for (const item of iterable) {
    buf.push(item)
    if (buf.length === size) {
      yield buf
      buf = []
    }
  }
  if (buf.length) yield buf
}

function* zip(...iterables) {
  if (iterables.length === 0) return
  const iterators = iterables.map((it) => it[Symbol.iterator]())
  while (true) {
    const results = iterators.map((it) => it.next())
    if (results.some((r) => r.done)) {
      // politely close the others (lets generators run their finally blocks)
      iterators.forEach((it, i) => !results[i].done && it.return?.())
      return
    }
    yield results.map((r) => r.value)
  }
}
```

- `chunk` only pulls from the source as the consumer pulls from it — that's why it works on an infinite generator.
- `zip` drives the iterators manually via the protocol. Calling `return()` on unfinished iterators is the polite thing `for...of` does on `break` — it lets generators clean up (close files, release locks).
:::

:::challenge
difficulty: hard
companies: Meta
### Implement reactive() and effect() with Proxy (Vue-style)
Implement:

- `reactive(obj)` → a Proxy. Reading a property inside a running effect registers that effect as a dependency of that property. Writing a **different** value re-runs every effect that depends on that property. Nested objects must be reactive too (when read through the proxy).
- `effect(fn)` → runs `fn` immediately and re-runs it whenever its dependencies change.

Only effects that read a property should re-run when it changes.
@@@starter
```js
function reactive(obj) {}
function effect(fn) {}
```
@@@tests
```js
test('re-runs on change', () => {
  const s = reactive({ count: 0 })
  const seen = []
  effect(() => seen.push(s.count))
  s.count = 1
  s.count = 2
  expect(seen).toEqual([0, 1, 2])
})

test('fine-grained: unrelated keys do not trigger', () => {
  const s = reactive({ a: 1, b: 1 })
  let runsA = 0, runsB = 0
  effect(() => { s.a; runsA++ })
  effect(() => { s.b; runsB++ })
  s.a = 5
  expect(runsA).toBe(2)
  expect(runsB).toBe(1)
})

test('same value does not trigger', () => {
  const s = reactive({ x: 1 })
  let runs = 0
  effect(() => { s.x; runs++ })
  s.x = 1
  expect(runs).toBe(1)
})

test('nested objects are reactive', () => {
  const s = reactive({ user: { name: 'Ada' } })
  const names = []
  effect(() => names.push(s.user.name))
  s.user.name = 'Grace'
  expect(names).toEqual(['Ada', 'Grace'])
})

test('reads outside effects are not tracked', () => {
  const s = reactive({ v: 1 })
  s.v
  let runs = 0
  effect(() => { runs++ })
  s.v = 2
  expect(runs).toBe(1)
})
```
@@@solution
```js
let activeEffect = null
const targetMap = new WeakMap() // target -> Map(key -> Set(effect))
const proxyCache = new WeakMap() // target -> proxy (same object => same proxy)

function track(target, key) {
  if (!activeEffect) return
  let keyMap = targetMap.get(target)
  if (!keyMap) targetMap.set(target, (keyMap = new Map()))
  let effects = keyMap.get(key)
  if (!effects) keyMap.set(key, (effects = new Set()))
  effects.add(activeEffect)
}

function trigger(target, key) {
  const effects = targetMap.get(target)?.get(key)
  if (effects) [...effects].forEach((run) => run())
}

function reactive(obj) {
  if (proxyCache.has(obj)) return proxyCache.get(obj)
  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      return value !== null && typeof value === 'object' ? reactive(value) : value
    },
    set(target, key, value, receiver) {
      const old = target[key]
      const ok = Reflect.set(target, key, value, receiver)
      if (!Object.is(old, value)) trigger(target, key)
      return ok
    },
  })
  proxyCache.set(obj, proxy)
  return proxy
}

function effect(fn) {
  const run = () => {
    const prev = activeEffect
    activeEffect = run
    try {
      fn()
    } finally {
      activeEffect = prev // supports nested effects
    }
  }
  run()
  return run
}
```

- `track` records dependencies only while an effect is running (`activeEffect`).
- `trigger` copies the effect set before running, because re-running an effect re-tracks and would mutate the set during iteration.
- Nested objects become reactive lazily on read; `proxyCache` ensures one proxy per raw object.
- Restoring the previous `activeEffect` supports nested effects (like components rendering children).

**Missing vs real Vue:** cleaning stale deps before each run (conditional reads), batching/scheduling (`nextTick`), arrays (`length`, iteration via `ownKeys` trap), `computed`, and `ref` for primitives.
:::

:::challenge
difficulty: medium
### memoizeByObject(fn) using WeakMap
Implement `memoizeByObject(fn)` for functions that take a **single object argument**. Cache results by object identity using a `WeakMap`, so cached entries don't prevent garbage collection. Calling with the same object returns the cached result without calling `fn`; a different object (even with equal contents) calls `fn` again. Non-object arguments must throw a `TypeError`.
@@@starter
```js
function memoizeByObject(fn) {}
```
@@@tests
```js
test('caches by identity', () => {
  let calls = 0
  const area = memoizeByObject((r) => { calls++; return r.w * r.h })
  const a = { w: 2, h: 3 }
  expect(area(a)).toBe(6)
  expect(area(a)).toBe(6)
  expect(calls).toBe(1)
  expect(area({ w: 2, h: 3 })).toBe(6)
  expect(calls).toBe(2)
})

test('caches undefined results too', () => {
  let calls = 0
  const f = memoizeByObject(() => { calls++ })
  const o = {}
  f(o); f(o)
  expect(calls).toBe(1)
})

test('rejects primitives', () => {
  const f = memoizeByObject((x) => x)
  expect(() => f(1)).toThrow()
})
```
@@@solution
```js
function memoizeByObject(fn) {
  const cache = new WeakMap()
  return function (obj) {
    if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
      throw new TypeError('memoizeByObject expects an object argument')
    }
    if (cache.has(obj)) return cache.get(obj) // has() so undefined results are cached too
    const result = fn.call(this, obj)
    cache.set(obj, result)
    return result
  }
}
```

Because the cache is a `WeakMap`, once the caller drops all references to an argument object, both the key and its cached result become collectable. This is the pattern Reselect-style selectors and React internals use to cache per-object derived data without leaks. Using `cache.has` (not `if (cache.get(obj))`) avoids recomputing falsy results.
:::

## Quick check

:::quiz
### Why can't you iterate a WeakMap?
- [ ] It's a bug in the spec
- [x] Its contents depend on garbage collection, which would make iteration non-deterministic
- [ ] Keys are encrypted
- [ ] Iteration would be too slow
@@@explain
Entries can vanish at any time when keys are collected, so iteration and `size` are deliberately not exposed.
:::

:::quiz
### What does `it.next(42)` do in a generator paused at `const x = yield 1`?
- [ ] Restarts the generator with 42
- [x] Resumes it, making the paused `yield` expression evaluate to 42
- [ ] Yields 42 to the caller
- [ ] Throws, because next takes no arguments
@@@explain
Values passed to `next` become the result of the `yield` the generator was paused on.
:::
