---
title: Effects & Refs — useEffect, useLayoutEffect, useRef
summary: Synchronising with the outside world, dependency arrays, cleanup, StrictMode double-invoke, layout effects and refs.
minutes: 22
---

## What an effect is for

Rendering must be pure. But apps need to talk to things outside React: the network, timers, subscriptions, `document.title`, third-party widgets, analytics. **Effects** run *after* React has committed to the DOM, letting you **synchronise** a component with an external system.

```jsx
useEffect(() => {
  // setup: connect, subscribe, start timer
  return () => {
    // cleanup: disconnect, unsubscribe, clear timer
  }
}, [dependencies])
```

:::callout analogy Effects are synchronisation, not lifecycle
Don't think "run on mount". Think "keep **this** external thing in sync with **these** values". If `roomId` changes, disconnect from the old room and connect to the new one. React handles when.
:::

## The dependency array

| Form | Runs |
|---|---|
| `useEffect(fn)` | after **every** commit |
| `useEffect(fn, [])` | after the first commit only (and cleanup on unmount) |
| `useEffect(fn, [a, b])` | after the first commit and whenever `a` or `b` changed (`Object.is`) |

Sequence for a dependency change: **cleanup with old values → setup with new values**.

### Referential equality traps

Dependencies are compared by reference. Objects, arrays and functions created during render are **new every time**:

```jsx
function Search({ query }) {
  const options = { query, limit: 10 }       // new object each render
  useEffect(() => { fetchResults(options) }, [options]) // runs every render!
}
```

Fixes, in order of preference:

1. Depend on **primitives**: `[query]` and build the object inside the effect.
2. Move static objects/functions **outside** the component.
3. `useMemo` / `useCallback` to stabilise identity when you truly need an object.

:::callout warn Never lie about dependencies
Omitting a value the effect uses gives you a **stale closure**: the effect keeps reading values from the render it was created in. Trust `react-hooks/exhaustive-deps`. If including a dependency causes too many runs, restructure (functional updates, reducers, `useEffectEvent`/refs), don't silence the linter.
:::

## Why fetch inside useEffect?

Data fetching is a side effect: it talks to the network and sets state asynchronously. Putting it in the render body would fire a request **every render** and cause an infinite loop (fetch → setState → render → fetch...). In an effect it runs after commit and only when its inputs change.

```jsx
useEffect(() => {
  const controller = new AbortController()
  setStatus('loading')
  fetch(`/api/users/${id}`, { signal: controller.signal })
    .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
    .then(data => { setUser(data); setStatus('success') })
    .catch(err => { if (err.name !== 'AbortError') { setError(err); setStatus('error') } })
  return () => controller.abort() // cancel on id change / unmount → no stale results
}, [id])
```

Note: the effect callback itself can't be `async` (it must return a cleanup function or nothing, not a promise) — define an async function inside and call it.

In production apps prefer a data library (TanStack Query, SWR, RTK Query) or framework loaders — they add caching, deduping and retries. See **State & Data → Server State**.

## StrictMode's double invoke

In development, `<StrictMode>` (React 18+) **mounts, unmounts and re-mounts** every component once, so each effect runs **setup → cleanup → setup**. It also double-calls render functions and reducers.

This is intentional: it surfaces effects that are missing cleanup (duplicate subscriptions, two network connections, leaking intervals). If your app breaks under StrictMode, your effect is not resilient — production features like Fast Refresh, Offscreen/Activity and route caching will hit the same bug. It does **not** happen in production builds.

## useLayoutEffect vs useEffect

```text
render → commit DOM mutations → useLayoutEffect (sync) → browser paints → useEffect (async)
```

| | `useEffect` | `useLayoutEffect` |
|---|---|---|
| When | After paint (usually) | After DOM mutation, **before paint** |
| Blocks paint? | No | Yes |
| Use for | Fetching, subscriptions, logging, most things | Measuring layout and synchronously re-positioning (tooltips, popovers), avoiding visual flicker |
| SSR | Fine | Warns (no layout on server) |

```jsx
function Tooltip({ anchorRect, children }) {
  const ref = useRef(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const { height } = ref.current.getBoundingClientRect()
    setTop(anchorRect.top - height - 8) // re-render happens before paint → no flicker
  }, [anchorRect])
  return <div ref={ref} style={{ position: 'absolute', top }}>{children}</div>
}
```

With `useEffect` here, the user would briefly see the tooltip at `top: 0`, then jump. Use `useLayoutEffect` sparingly — it delays paint. (`useInsertionEffect` exists for CSS-in-JS libraries to inject styles even earlier.)

## useRef

`useRef(initial)` returns a mutable object `{ current: initial }` that **persists across renders** and whose mutation **does not trigger a render**.

Two use cases:

1. **DOM access** — `<input ref={inputRef} />` then `inputRef.current.focus()`.
2. **Instance variables** — timer ids, previous values, latest callback, "is mounted" flags, WebSocket instances, counters that shouldn't re-render.

```jsx
function Stopwatch() {
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)
  const start = () => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }
  const stop = () => { clearInterval(intervalRef.current); intervalRef.current = null }
  useEffect(() => stop, [])
  return <p>{elapsed}s <button onClick={start}>Start</button><button onClick={stop}>Stop</button></p>
}
```

| `useState` | `useRef` |
|---|---|
| Changing it re-renders | Changing it doesn't re-render |
| Value is a snapshot per render | `.current` is always the latest value |
| Use for anything shown on screen | Use for values the render output doesn't depend on |

:::callout danger Don't read or write ref.current during render
Except for lazy initialisation, touching refs in render makes output depend on mutable data and breaks purity. Read/write refs in effects and event handlers.
:::

### The "latest value" ref pattern

```jsx
function useLatest(value) {
  const ref = useRef(value)
  useLayoutEffect(() => { ref.current = value })
  return ref
}
```
Effects/intervals read `latestRef.current` to see fresh values without re-subscribing. React's experimental `useEffectEvent` formalises this.

## You might not need an effect

Common effect misuse:

- **Deriving state**: `useEffect(() => setFullName(first + ' ' + last), [first, last])` → just compute `const fullName = first + ' ' + last` during render.
- **Expensive derivation** → `useMemo`.
- **Responding to a user event** (submit, click) → do it in the event handler, not in an effect that watches state.
- **Resetting state when a prop changes** → use a `key`.

:::question
difficulty: easy
companies: Accenture
### What is useEffect?
`useEffect(setup, deps?)` runs side effects after React commits a render to the screen — data fetching, subscriptions, timers, manual DOM work, logging. The setup can return a cleanup function, which React calls before re-running the effect (when dependencies change) and on unmount. The dependency array controls when it re-runs: omitted → every render, `[]` → only after mount, `[a, b]` → when `a` or `b` change by `Object.is`. Conceptually it synchronises a component with an external system.
:::

:::question
difficulty: medium
companies: Accenture, Intuit
### What does the dependency array of useEffect affect, and how does referential equality matter?
It decides when the effect re-runs. React compares each dependency with its previous value using `Object.is`. Primitives compare by value, but objects, arrays and functions compare by **reference** — so an object literal or inline function created during render is "different" every render, causing the effect to re-run every time (possibly infinite fetch loops). Fix by depending on primitive fields, hoisting constants outside the component, or memoising with `useMemo`/`useCallback`. Omitting used values causes stale closures.
:::

:::question
difficulty: medium
companies: CRED, Accenture
### What is the difference between useEffect and useLayoutEffect? When does each fire?
Both run after React mutates the DOM. `useLayoutEffect` runs **synchronously before the browser paints**, so you can measure layout (`getBoundingClientRect`) and update state without visible flicker — at the cost of blocking paint. `useEffect` runs **after paint** (asynchronously), so it doesn't block the screen and is right for almost everything: fetching, subscriptions, analytics. Use `useLayoutEffect` only for measure-then-reposition logic like tooltips, popovers or scroll restoration. It warns during SSR since there's no layout on the server.
:::

:::question
difficulty: medium
companies: Coinbase
### What is useRef and what does it give you that useState cannot?
`useRef` returns a stable mutable container `{ current }` that persists for the component's lifetime. Writing to `.current` does **not** cause a re-render and the value is always the latest (not a per-render snapshot). That makes it ideal for DOM references, timer/interval ids, WebSocket or AbortController instances, previous values, and the "latest callback" pattern that avoids stale closures. `useState` triggers renders and gives you a snapshot; use it for anything displayed.
:::

:::question
difficulty: medium
companies: Accenture
### Why is fetch commonly placed inside useEffect?
Fetching is a side effect and setting state from its result triggers a render. In the render body it would fire on every render and loop forever. Inside `useEffect` it runs after commit and only when its dependencies (e.g. `userId`) change. The effect's cleanup lets you abort the request (`AbortController`) or ignore stale results when the dependency changes or the component unmounts. Modern apps often delegate this to TanStack Query, SWR or framework loaders for caching and deduplication.
:::

:::question
difficulty: medium
### Why does my effect run twice in development?
React 18's `<StrictMode>` simulates unmount + remount on the first mount in development, running effects as setup → cleanup → setup. This is deliberate, to expose effects that don't clean up properly (duplicate subscriptions, listeners, connections). Fix the effect by returning a proper cleanup; don't remove StrictMode. It doesn't happen in production.
:::

:::challenge
difficulty: medium
### Build usePrevious
Write a hook `usePrevious(value)` that returns the value from the previous render (undefined on the first render).
@@@solution
```jsx
function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value // runs after render is committed
  }, [value])
  return ref.current // during render, still holds the previous value
}
```
During render we return what's stored (the old value); after commit the effect stores the new one. Since updating a ref doesn't re-render, there's no loop.

Follow-up: with `[value]` as deps it returns the previous *distinct* value. Remove the deps array to track the value from the previous *render*. (A purer alternative stores `[prev, current]` in state and updates during render when value changes.)
:::

:::challenge
difficulty: hard
companies: Noon
### Case study: which implementation is better and why?
```jsx
// A
function Profile({ userId }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    fetch(`/api/u/${userId}`).then(r => r.json()).then(setUser)
  }, [])
  return <h1>{user?.name}</h1>
}

// B
function Profile({ userId }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    let ignore = false
    fetch(`/api/u/${userId}`).then(r => r.json()).then(u => { if (!ignore) setUser(u) })
    return () => { ignore = true }
  }, [userId])
  return <h1>{user?.name}</h1>
}
```
@@@solution
**B is correct; A has two bugs.**

1. **Missing dependency** — A uses `userId` but declares `[]`, so when the parent switches users the profile keeps showing the first user (stale closure).
2. **Race condition** — if `userId` changes quickly (1 → 2), the request for 1 may resolve after 2's and overwrite it. B's cleanup flips `ignore` for the previous run, so only the latest response is applied. It also avoids setting state after unmount.

Further improvements: use `AbortController` to actually cancel the network request, handle `!r.ok` and errors, show a loading state, and in real apps use TanStack Query (`useQuery({ queryKey: ['user', userId] })`) which handles caching, deduping, retries and races.
:::

:::challenge
difficulty: medium
### Fix the flicker
A popover is positioned below its button with `useEffect` that measures the button and calls `setPosition`. Users see it jump from the top-left corner. Explain and fix.
@@@solution
`useEffect` runs after the browser paints, so the first frame shows the popover at its default position, then the state update moves it. Switch to `useLayoutEffect`: it runs after DOM mutation but **before paint**, and React processes the resulting state update synchronously, so the user only ever sees the final position.

```jsx
useLayoutEffect(() => {
  const r = buttonRef.current.getBoundingClientRect()
  setPosition({ top: r.bottom + 4, left: r.left })
}, [open])
```
Libraries like Floating UI do exactly this (plus resize/scroll listeners).
:::

:::quiz
### Which runs before the browser paints?
- [ ] useEffect
- [x] useLayoutEffect
- [ ] Neither — both run after paint
@@@explain
useLayoutEffect fires synchronously after DOM mutations, blocking paint until it (and any state update it causes) finishes.
:::

:::quiz
### Mutating `ref.current` will…
- [ ] Trigger a re-render on the next tick
- [x] Not trigger a re-render
- [ ] Throw in StrictMode
@@@explain
Refs are escape hatches for values that don't affect rendering.
:::

:::quiz
### An effect has dependency `[{ id }]` written inline. What happens?
- [ ] It runs only when id changes
- [x] It runs after every render because a new object is created each time
- [ ] It never re-runs
@@@explain
Dependencies compare with Object.is; a fresh object literal is never equal to the previous one.
:::
