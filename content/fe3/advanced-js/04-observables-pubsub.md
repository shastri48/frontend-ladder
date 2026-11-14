---
title: Observables & Pub/Sub From Scratch
summary: Push-based streams of values — build an Observable with subscribe/unsubscribe, teardown, map/filter operators, and a typed pub/sub bus; know when to use streams vs promises.
minutes: 20
---

## Pull vs push

| | Single value | Many values |
|---|---|---|
| **Pull** (consumer asks) | function call | iterator / generator |
| **Push** (producer tells) | Promise | **Observable** |

A Promise delivers **one** value, eagerly, and can't be cancelled. Many frontend sources produce **many values over time**: clicks, keystrokes, WebSocket messages, scroll positions, price ticks, geolocation updates. An **Observable** is a lazy, cancellable, push-based collection of values over time. It's the core of RxJS, Angular's `HttpClient`/`EventEmitter`, and a big influence on signals and state libraries.

:::callout analogy Newsletter subscription
A promise is a parcel delivery: one item, it arrives once. An observable is a newsletter: nothing is printed for you until you subscribe (lazy), issues keep arriving (many values), the publisher may announce the final issue (complete) or go bankrupt (error), and you can unsubscribe at any time — after which they stop sending and clean up your address (teardown).
:::

## The contract

An **observer** is an object with three optional callbacks:

```js
{ next(value) {}, error(err) {}, complete() {} }
```

Rules (the "Observable grammar"):

```text
next*  (error | complete)?
```

- Zero or more `next`, then **at most one** of `error` or `complete`.
- After `error`/`complete`/`unsubscribe`, **nothing** more is delivered.
- `subscribe` returns a **subscription** with `unsubscribe()`, which runs the producer's **teardown** (clear the interval, remove the listener, close the socket).

## Building it

```js
class Observable {
  constructor(subscribeFn) {
    this._subscribeFn = subscribeFn // called once per subscriber (lazy, unicast)
  }

  subscribe(observerOrNext) {
    const observer =
      typeof observerOrNext === 'function' ? { next: observerOrNext } : observerOrNext || {}

    let closed = false
    let teardown = null

    const cleanup = () => {
      if (typeof teardown === 'function') teardown()
      else if (teardown && typeof teardown.unsubscribe === 'function') teardown.unsubscribe()
      teardown = null
    }

    const subscriber = {
      next: (v) => { if (!closed) observer.next?.(v) },
      error: (e) => { if (!closed) { closed = true; observer.error?.(e); cleanup() } },
      complete: () => { if (!closed) { closed = true; observer.complete?.(); cleanup() } },
      get closed() { return closed },
    }

    try {
      teardown = this._subscribeFn(subscriber)
    } catch (err) {
      subscriber.error(err)
    }
    if (closed) cleanup() // completed synchronously during subscribe

    return {
      unsubscribe() {
        if (closed) return
        closed = true
        cleanup()
      },
    }
  }
}
```

Things to notice:

- **Lazy**: creating an Observable does nothing. Each `subscribe` runs `subscribeFn` again (unicast — like calling a function twice).
- The `subscriber` wrapper **enforces the grammar** with a `closed` flag, so producers can't violate it accidentally.
- Teardown runs on complete, error *or* unsubscribe — the single place where resources are released. This is why observables are great at avoiding leaks: the producer knows how to clean up after itself.
- If the producer completes synchronously inside `subscribe`, teardown wasn't assigned yet when `complete` ran; the `if (closed) cleanup()` line handles it.

### Producers

```js
const interval = (ms) =>
  new Observable((subscriber) => {
    let i = 0
    const id = setInterval(() => subscriber.next(i++), ms)
    return () => clearInterval(id) // teardown
  })

const fromEvent = (target, type) =>
  new Observable((subscriber) => {
    const handler = (e) => subscriber.next(e)
    target.addEventListener(type, handler)
    return () => target.removeEventListener(type, handler)
  })

const of = (...values) =>
  new Observable((subscriber) => {
    values.forEach((v) => subscriber.next(v))
    subscriber.complete()
  })
```

## Operators: functions from Observable to Observable

An operator subscribes to the source and re-emits transformed values. Because the outer observable's teardown unsubscribes from the source, cancellation **propagates upstream** automatically.

```js
const map = (fn) => (source) =>
  new Observable((subscriber) => {
    const sub = source.subscribe({
      next: (v) => subscriber.next(fn(v)),
      error: (e) => subscriber.error(e),
      complete: () => subscriber.complete(),
    })
    return () => sub.unsubscribe()
  })

const filter = (pred) => (source) =>
  new Observable((subscriber) => {
    const sub = source.subscribe({
      next: (v) => pred(v) && subscriber.next(v),
      error: (e) => subscriber.error(e),
      complete: () => subscriber.complete(),
    })
    return () => sub.unsubscribe()
  })

Observable.prototype.pipe = function (...ops) {
  return ops.reduce((src, op) => op(src), this)
}

// usage
interval(100).pipe(filter((n) => n % 2 === 0), map((n) => n * 10))
  .subscribe((v) => console.log(v)) // 0, 20, 40, ...
```

### Why streams shine: typeahead in 6 lines

```js
fromEvent(input, 'input').pipe(
  map((e) => e.target.value.trim()),
  debounceTime(300),
  distinctUntilChanged(),
  filter((q) => q.length > 1),
  switchMap((q) => ajax(`/search?q=${q}`)), // cancels previous request automatically!
).subscribe(renderResults)
```

`switchMap` unsubscribes from the previous inner request when a new value arrives — which (because teardown aborts the request) solves the **race condition** problem declaratively. That's the killer feature.

## Hot vs cold, unicast vs multicast

- **Cold**: the producer is created per subscriber (our `interval` — two subscribers get two timers, each starting at 0). HTTP requests are cold: subscribe twice, request twice.
- **Hot**: the producer exists independently and subscribers tap into it (DOM events, a WebSocket you share). Late subscribers miss earlier values.
- A **Subject** is both an observable and an observer: it keeps a list of observers and multicasts each `next` to all of them — essentially an event emitter that follows the observable contract. `BehaviorSubject` also remembers the latest value and replays it to new subscribers — a minimal state store.

## Pub/Sub (event bus)

Pub/sub decouples publishers from subscribers through **topics**:

```js
function createPubSub() {
  const topics = new Map() // topic -> Set<handler>

  return {
    subscribe(topic, handler) {
      if (!topics.has(topic)) topics.set(topic, new Set())
      topics.get(topic).add(handler)
      return () => {
        const set = topics.get(topic)
        set?.delete(handler)
        if (set && set.size === 0) topics.delete(topic) // don't leak empty topics
      }
    },
    publish(topic, payload) {
      // copy so handlers that unsubscribe during publish don't break iteration
      ;[...(topics.get(topic) ?? [])].forEach((h) => {
        try { h(payload) } catch (err) { console.error(err) } // one bad handler can't stop others
      })
    },
  }
}
```

Use it for cross-cutting events in micro-frontends (`cart:updated`), analytics, toasts. Beware: global buses make data flow **invisible** — prefer explicit props/state for anything that is truly application state.

| | Event emitter / pub-sub | Observable |
|---|---|---|
| Laziness | Eager — emits whether anyone listens | Lazy — producer starts on subscribe |
| Completion / error | No standard concept | `complete` / `error` built in |
| Cleanup | Manual `off` | Teardown returned by producer |
| Composition | Manual | Operators (`map`, `switchMap`, …) |

## Interview questions

:::question
difficulty: medium
companies: Meta
### What is the difference between a Promise and an Observable?
- **Values:** Promise resolves once; Observable can emit 0..∞ values.
- **Eagerness:** a Promise's executor runs immediately on creation; an Observable does nothing until subscribed (lazy).
- **Cancellation:** a Promise can't be cancelled (you can only ignore its result or use `AbortController` on the underlying work); unsubscribing from an Observable runs teardown and stops the work.
- **Sharing:** one Promise is shared by all `.then` callers (multicast, cached). A cold Observable re-executes per subscriber.
- **Timing:** Promise callbacks are always async (microtask); Observables can emit synchronously.

Use Promises for one-shot request/response; Observables for streams (events, sockets, typeahead with `switchMap`).
:::

:::question
difficulty: medium
### Why should `publish` iterate over a copy of the handler list?
If a handler unsubscribes itself (common with `once`) or subscribes a new handler during `publish`, mutating the collection you're iterating over can skip handlers or call newly added ones in the same cycle. Copying (`[...set]`) gives a stable snapshot. Also wrap each handler in `try/catch` so one throwing listener doesn't prevent others from running.
:::

:::question
difficulty: hard
### How do observables help prevent memory leaks in SPAs?
The producer returns its own teardown (remove listeners, clear timers, close sockets) and operators chain teardown upstream. So a single `subscription.unsubscribe()` — e.g. in a React effect cleanup or Angular `ngOnDestroy`/`takeUntilDestroyed` — releases the whole pipeline. Leaks happen when people subscribe and never unsubscribe; operators like `take(1)`, `takeUntil(destroy$)` make completion automatic.
:::

## Challenges

:::challenge
difficulty: hard
companies: Meta
### Implement an Observable with subscribe, unsubscribe, map and filter
Implement `class Observable`:

- `new Observable(subscriber => teardown?)`. The function runs on each `subscribe` and may return a teardown function.
- `subscribe(observer)` accepts either a function (treated as `next`) or an object `{ next, error, complete }` and returns `{ unsubscribe() }`.
- After `complete`, `error` or `unsubscribe`, no further callbacks fire, and the teardown runs exactly once.
- Errors thrown inside the subscribe function are delivered to `error`.
- `pipe(...operators)` and two operator factories `map(fn)` and `filter(pred)` (standalone functions).
@@@starter
```js
class Observable {
  constructor(subscribeFn) {}
  subscribe(observer) {}
  pipe(...ops) {}
}
function map(fn) {}
function filter(pred) {}
```
@@@tests
```js
test('emits values and completes', () => {
  const got = []
  let done = false
  new Observable((s) => { s.next(1); s.next(2); s.complete(); s.next(3) })
    .subscribe({ next: (v) => got.push(v), complete: () => { done = true } })
  expect(got).toEqual([1, 2])
  expect(done).toBe(true)
})

test('function observer and lazy execution', () => {
  let runs = 0
  const o = new Observable((s) => { runs++; s.next('x') })
  expect(runs).toBe(0)
  const got = []
  o.subscribe((v) => got.push(v))
  o.subscribe((v) => got.push(v))
  expect(runs).toBe(2)
  expect(got).toEqual(['x', 'x'])
})

test('unsubscribe stops delivery and runs teardown once', async () => {
  let torn = 0
  const got = []
  const o = new Observable((s) => {
    let i = 0
    const id = setInterval(() => s.next(i++), 5)
    return () => { torn++; clearInterval(id) }
  })
  const sub = o.subscribe((v) => got.push(v))
  await sleep(28)
  sub.unsubscribe()
  sub.unsubscribe()
  const len = got.length
  await sleep(20)
  expect(got.length).toBe(len)
  expect(len).toBeGreaterThan(1)
  expect(torn).toBe(1)
})

test('thrown errors go to error and teardown runs on complete', () => {
  let err, torn = false
  new Observable(() => { throw new Error('boom') }).subscribe({ error: (e) => { err = e.message } })
  expect(err).toBe('boom')
  new Observable((s) => { s.complete(); return () => { torn = true } }).subscribe({})
  expect(torn).toBe(true)
})

test('pipe with map and filter', () => {
  const got = []
  new Observable((s) => { [1, 2, 3, 4, 5].forEach((n) => s.next(n)); s.complete() })
    .pipe(filter((n) => n % 2 === 1), map((n) => n * 10))
    .subscribe((v) => got.push(v))
  expect(got).toEqual([10, 30, 50])
})
```
@@@solution
```js
class Observable {
  constructor(subscribeFn) {
    this._subscribeFn = subscribeFn
  }

  subscribe(observerOrNext) {
    const observer =
      typeof observerOrNext === 'function' ? { next: observerOrNext } : observerOrNext || {}
    let closed = false
    let teardown = null

    const cleanup = () => {
      const t = teardown
      teardown = null
      if (typeof t === 'function') t()
      else if (t && typeof t.unsubscribe === 'function') t.unsubscribe()
    }

    const subscriber = {
      next: (v) => { if (!closed && observer.next) observer.next(v) },
      error: (e) => {
        if (closed) return
        closed = true
        if (observer.error) observer.error(e)
        cleanup()
      },
      complete: () => {
        if (closed) return
        closed = true
        if (observer.complete) observer.complete()
        cleanup()
      },
    }

    try {
      teardown = this._subscribeFn(subscriber)
    } catch (err) {
      subscriber.error(err)
    }
    if (closed) cleanup() // completed/errored synchronously before teardown was set

    return {
      unsubscribe() {
        if (closed) return
        closed = true
        cleanup()
      },
    }
  }

  pipe(...ops) {
    return ops.reduce((source, op) => op(source), this)
  }
}

function map(fn) {
  return (source) =>
    new Observable((s) => {
      const sub = source.subscribe({
        next: (v) => s.next(fn(v)),
        error: (e) => s.error(e),
        complete: () => s.complete(),
      })
      return () => sub.unsubscribe()
    })
}

function filter(pred) {
  return (source) =>
    new Observable((s) => {
      const sub = source.subscribe({
        next: (v) => { if (pred(v)) s.next(v) },
        error: (e) => s.error(e),
        complete: () => s.complete(),
      })
      return () => sub.unsubscribe()
    })
}
```

- The `closed` flag enforces `next* (error|complete)?`.
- `cleanup` nulls `teardown` before calling it, guaranteeing it runs once.
- If the producer completes synchronously, `teardown` is assigned *after* `complete` ran, so we run cleanup right after `subscribeFn` returns.
- Operators subscribe to the source and return a teardown that unsubscribes from it — cancellation flows upstream.

**Follow-ups:** implement `take(n)`, `debounceTime(ms)`, `switchMap(fn)` and a `Subject`.
:::

:::challenge
difficulty: medium
### Implement createPubSub() with topic subscriptions
`createPubSub()` returns `{ subscribe(topic, handler), publish(topic, payload), count(topic) }`.

- `subscribe` returns an unsubscribe function; calling it twice is safe.
- `publish` calls every handler of that topic with the payload, in subscription order. A handler that throws must not prevent the others from running.
- Handlers added during a publish are not called in that same publish; handlers removed during a publish still finish this round.
- `count(topic)` returns the number of current handlers (0 for unknown topics).
@@@starter
```js
function createPubSub() {
  // your code
}
```
@@@tests
```js
test('publish to subscribers in order', () => {
  const bus = createPubSub()
  const log = []
  bus.subscribe('a', (p) => log.push('1:' + p))
  bus.subscribe('a', (p) => log.push('2:' + p))
  bus.subscribe('b', (p) => log.push('b:' + p))
  bus.publish('a', 'x')
  expect(log).toEqual(['1:x', '2:x'])
})

test('unsubscribe and count', () => {
  const bus = createPubSub()
  const off = bus.subscribe('t', () => {})
  bus.subscribe('t', () => {})
  expect(bus.count('t')).toBe(2)
  off(); off()
  expect(bus.count('t')).toBe(1)
  expect(bus.count('nope')).toBe(0)
})

test('throwing handler does not stop others', () => {
  const bus = createPubSub()
  let ran = false
  const orig = console.error
  console.error = () => {}
  bus.subscribe('t', () => { throw new Error('bad') })
  bus.subscribe('t', () => { ran = true })
  bus.publish('t')
  console.error = orig
  expect(ran).toBe(true)
})

test('snapshot semantics during publish', () => {
  const bus = createPubSub()
  const log = []
  let offB
  bus.subscribe('t', () => { log.push('A'); offB(); bus.subscribe('t', () => log.push('C')) })
  offB = bus.subscribe('t', () => log.push('B'))
  bus.publish('t')
  expect(log).toEqual(['A', 'B'])
  log.length = 0
  bus.publish('t')
  expect(log).toContain('C')
})
```
@@@solution
```js
function createPubSub() {
  const topics = new Map() // topic -> Set of handlers (Set keeps insertion order)

  return {
    subscribe(topic, handler) {
      if (!topics.has(topic)) topics.set(topic, new Set())
      // wrap so the same function can be subscribed twice independently
      const entry = (payload) => handler(payload)
      topics.get(topic).add(entry)
      let active = true
      return () => {
        if (!active) return
        active = false
        const set = topics.get(topic)
        if (!set) return
        set.delete(entry)
        if (set.size === 0) topics.delete(topic)
      }
    },

    publish(topic, payload) {
      const set = topics.get(topic)
      if (!set) return
      for (const h of [...set]) {
        try {
          h(payload)
        } catch (err) {
          console.error(err)
        }
      }
    },

    count(topic) {
      return topics.get(topic)?.size ?? 0
    },
  }
}
```

- `Set` preserves insertion order, so handlers run in subscription order.
- Iterating over a copy gives snapshot semantics: removals and additions during publish affect only the *next* publish.
- Wrapping each handler (`entry`) means subscribing the same function twice creates two independent subscriptions, each removable on its own.
- Empty topics are deleted so a long-running app doesn't accumulate dead keys.
:::

## Quick check

:::quiz
### What does "cold observable" mean?
- [ ] It emits values slowly
- [x] Each subscriber triggers its own independent producer execution
- [ ] It has completed
- [ ] It caches its last value
@@@explain
Cold = producer created per subscription (like an HTTP request per subscribe). Hot = shared producer such as DOM events.
:::

:::quiz
### Which RxJS operator cancels the previous inner request when a new search term arrives?
- [ ] mergeMap
- [ ] concatMap
- [x] switchMap
- [ ] exhaustMap
@@@explain
`switchMap` unsubscribes from the previous inner observable — perfect for typeahead. `exhaustMap` ignores new values while busy (good for "submit" buttons).
:::
