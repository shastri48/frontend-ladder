---
title: useEffect, Data Fetching & Your First Custom Hooks
summary: What effects are for, how the dependency array works, cleanup, why fetch lives in useEffect, the rules of hooks and building useCounter.
minutes: 18
---

## Rendering must be pure; effects handle the rest

A component's body should be a **pure calculation**: props + state in, JSX out. No network calls, no subscriptions, no DOM mutations during render — React may call your function multiple times, or render and throw the result away.

But apps must talk to the outside world: fetch data, subscribe to WebSockets, set timers, change `document.title`, integrate a chart library. These are **side effects**, and `useEffect` is where they go. It runs **after** React has committed the render to the screen.

```jsx
useEffect(() => {
  // effect: runs after render
  return () => {
    // cleanup: runs before the next effect run, and on unmount
  }
}, [dependencies])
```

:::callout analogy Effects synchronise
Think of an effect as "keep this external thing in sync with my state". `document.title` should match `count`; the chat connection should match `roomId`. The dependency array lists what the sync depends on.
:::

## The dependency array

| Form | Runs |
|---|---|
| `useEffect(fn)` | After **every** render |
| `useEffect(fn, [])` | Once after the first render (mount); cleanup on unmount |
| `useEffect(fn, [a, b])` | After the first render, and after any render where `a` or `b` changed (`Object.is` comparison) |

```jsx
function Title({ count }) {
  useEffect(() => {
    document.title = `${count} new messages`
  }, [count]) // re-sync only when count changes
}
```

Rule: **every reactive value used inside the effect** (props, state, values derived from them, functions defined in the component) must be in the array. The `eslint-plugin-react-hooks` `exhaustive-deps` rule checks this for you. Lying about dependencies leads to effects reading **stale** values.

Objects/arrays/functions created during render are new on **every render**, so listing them makes the effect run every time — move them inside the effect, or memoise them (FE2).

## Cleanup

Anything you start, you stop:

```jsx
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)          // stop on unmount
  }, [])
  return <time>{now.toLocaleTimeString()}</time>
}

function WindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return <p>{width}px</p>
}
```

Without cleanup you leak timers and listeners: they keep running after the component is gone, calling `setState` on an unmounted component and holding memory.

In development with `<StrictMode>`, React **mounts, unmounts and re-mounts** every component once to surface missing cleanups. If your effect runs twice in dev, that's intentional — make it resilient (cleanup properly), don't hack around it.

## Why is fetch used inside useEffect?

1. **Render must stay pure** — calling `fetch` in the component body would fire on every render, and setting state from it would cause an infinite loop.
2. **Timing** — effects run after the UI is painted, so the user sees a loading state immediately.
3. **Dependencies** — re-fetch exactly when inputs (e.g. `userId`) change.
4. **Cleanup** — cancel or ignore stale requests when inputs change or the component unmounts.

```jsx
function UserProfile({ userId }) {
  const [state, setState] = useState({ status: "loading", user: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: "loading", user: null, error: null })

    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((user) => setState({ status: "success", user, error: null }))
      .catch((err) => {
        if (err.name !== "AbortError") setState({ status: "error", user: null, error: err.message })
      })

    return () => controller.abort() // userId changed or unmounted → cancel old request
  }, [userId])

  if (state.status === "loading") return <p>Loading…</p>
  if (state.status === "error") return <p role="alert">{state.error}</p>
  return <h2>{state.user.name}</h2>
}
```

The cleanup prevents a **race condition**: if `userId` changes from 1 to 2 quickly and request 1 returns last, it would overwrite user 2's data. Aborting request 1 fixes that.

:::callout info In real apps
Effects-based fetching works, but production apps usually use a data library (TanStack Query, SWR, RTK Query) or framework loaders / Server Components (Next.js) which add caching, deduplication, retries and background refresh. You'll learn these in FE2/FE3 — but you must understand the effect version first.
:::

## You might not need an effect

Common mistakes:

```jsx
// ❌ Derived state via effect: extra render, can drift
const [fullName, setFullName] = useState("")
useEffect(() => setFullName(first + " " + last), [first, last])

// ✅ Just compute it
const fullName = first + " " + last
```

```jsx
// ❌ Responding to a user action in an effect
useEffect(() => { if (submitted) api.save(form) }, [submitted])

// ✅ Do it in the event handler
function handleSubmit() { api.save(form) }
```

Effects are for synchronising with **external systems**, not for transforming data or reacting to events.

## Rules of hooks

1. **Only call hooks at the top level** — not in conditions, loops, nested functions or after an early return.
2. **Only call hooks from React function components or custom hooks** — not from regular functions or classes.

Why: React stores hook state in an **ordered list** per component. On each render it matches the 1st `useState` call with slot 1, the 2nd with slot 2, and so on. If a hook is skipped conditionally, every later hook reads the wrong slot.

```jsx
// ❌
if (isLoggedIn) { const [name, setName] = useState("") }

// ✅ hook always called; condition inside
const [name, setName] = useState("")
if (!isLoggedIn) return null
```

## Benefits of hooks

Before hooks (2019), state and lifecycle needed classes. Hooks brought:

- **Reusable stateful logic** via custom hooks — no more HOC/render-prop "wrapper hell".
- **Related logic together** — one effect subscribes *and* unsubscribes, instead of splitting it across `componentDidMount`/`componentWillUnmount`.
- **No `this`** binding confusion; less code.
- Better minification and tree-shaking, easier typing with TypeScript.

## Custom hooks

A custom hook is a function whose name starts with `use` and that calls other hooks. It lets you **extract and reuse stateful logic**. Each component that calls it gets its **own** independent state.

```jsx
function useCounter(initial = 0, { min = -Infinity, max = Infinity, step = 1 } = {}) {
  const [count, setCount] = useState(initial)

  const increment = () => setCount((c) => Math.min(c + step, max))
  const decrement = () => setCount((c) => Math.max(c - step, min))
  const reset = () => setCount(initial)

  return { count, increment, decrement, reset, setCount }
}

function CartItem() {
  const { count, increment, decrement } = useCounter(1, { min: 1, max: 10 })
  return (
    <div>
      <button onClick={decrement} disabled={count === 1}>−</button>
      <span aria-live="polite">{count}</span>
      <button onClick={increment} disabled={count === 10}>+</button>
    </div>
  )
}
```

More examples you'll write: `useWindowSize`, `useLocalStorage`, `useDebounce`, `useFetch`, `useOnClickOutside`, `usePrevious`.

```jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }, [key, value])
  return [value, setValue]
}
```

## Interview questions

:::question
difficulty: easy
companies: Common
### What does the dependency array of useEffect affect?
It decides **when** the effect re-runs. No array → after every render. Empty array → only after mount (cleanup on unmount). With values → after mount and whenever any listed value changes by `Object.is`. It must include every reactive value the effect reads, otherwise the effect captures stale values. Objects/functions created during render change identity every render, so they cause re-runs unless moved inside the effect or memoised.
:::

:::question
difficulty: easy
companies: Accenture
### Why is fetch commonly used inside useEffect?
Because data fetching is a side effect, and component rendering must be pure. Putting fetch in the render body would run on every render and setting state from it would loop infinitely. `useEffect` runs after paint, lets you re-fetch when dependencies (like an id) change, and provides a cleanup to abort or ignore stale responses when the id changes or the component unmounts. In production, data libraries or framework loaders usually wrap this.
:::

:::question
difficulty: easy
companies: Common
### What are the rules of React hooks, and why do they exist?
1) Call hooks only at the top level — never inside conditions, loops or nested functions. 2) Call them only from function components or custom hooks. React identifies each hook by its **call order** within a component; conditional calls change the order between renders and make hooks read the wrong state. The ESLint plugin enforces both rules.
:::

:::question
difficulty: easy
### What are the benefits of using hooks?
They let function components have state and lifecycle features; allow reusing stateful logic through custom hooks without HOCs/render props; group related logic (subscribe + cleanup) in one place instead of splitting across lifecycle methods; remove `this` confusion; produce less code; and work better with TypeScript and minifiers.
:::

## Challenges

:::challenge
difficulty: easy
companies: Common
### Build a useCounter hook and a counter app
Create `useCounter(initial, { min, max, step })` returning `{ count, increment, decrement, reset }` and use it in a `Counter` component with −, reset and + buttons that disable at the bounds.
@@@solution
```jsx
import { useState, useCallback } from "react"

export function useCounter(initial = 0, { min = -Infinity, max = Infinity, step = 1 } = {}) {
  const [count, setCount] = useState(initial)
  const increment = useCallback(() => setCount((c) => Math.min(c + step, max)), [step, max])
  const decrement = useCallback(() => setCount((c) => Math.max(c - step, min)), [step, min])
  const reset = useCallback(() => setCount(initial), [initial])
  return { count, increment, decrement, reset }
}

export function Counter() {
  const { count, increment, decrement, reset } = useCounter(0, { min: 0, max: 5 })
  return (
    <div>
      <button onClick={decrement} disabled={count <= 0} aria-label="Decrease">−</button>
      <output aria-live="polite">{count}</output>
      <button onClick={increment} disabled={count >= 5} aria-label="Increase">+</button>
      <button onClick={reset}>Reset</button>
    </div>
  )
}
```
Updater functions avoid stale state on rapid clicks. `useCallback` keeps handler identities stable (useful if passed to memoised children). Two `Counter`s each get independent state — custom hooks share **logic**, not state.
:::

:::challenge
difficulty: medium
### Find the bugs in this effect
```jsx
function Search({ query }) {
  const [results, setResults] = useState([])
  useEffect(async () => {
    const res = await fetch(`/api/search?q=${query}`)
    setResults(await res.json())
  })
  return <ul>{results.map((r) => <li>{r.title}</li>)}</ul>
}
```
@@@solution
Bugs:
1. **Async effect function** — an `async` function returns a promise, but an effect must return nothing or a cleanup function. React warns.
2. **No dependency array** → runs after every render; since it sets state, it fetches in an **infinite loop**.
3. **No race-condition handling / cleanup** → older responses can overwrite newer ones.
4. **No error handling or `res.ok` check**.
5. **Query not URL-encoded**.
6. **Missing keys**.

```jsx
function Search({ query }) {
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!query) { setResults([]); return }
    const controller = new AbortController()
    async function run() {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setResults(await res.json())
        setError(null)
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message)
      }
    }
    run()
    return () => controller.abort()
  }, [query])

  if (error) return <p role="alert">{error}</p>
  return <ul>{results.map((r) => <li key={r.id}>{r.title}</li>)}</ul>
}
```
:::

:::challenge
difficulty: medium
### useWindowSize hook
Write `useWindowSize()` returning `{ width, height }` that updates on resize and cleans up properly.
@@@solution
```jsx
import { useEffect, useState } from "react"

export function useWindowSize() {
  const [size, setSize] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }))

  useEffect(() => {
    let frame = 0
    function onResize() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>          // at most once per frame
        setSize({ width: window.innerWidth, height: window.innerHeight })
      )
    }
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return size
}
```
`typeof window` guard keeps it SSR-safe; `requestAnimationFrame` throttles updates to the display refresh rate (resize can fire dozens of times per second). Interviewers (Housing.com) often ask for a **throttled** version — you could also use a `throttle(fn, 200)` utility (FE2).
:::

:::quiz
### `useEffect(fn, [])` runs…
- [ ] Before every render
- [x] After the first render only (plus cleanup on unmount)
- [ ] After every render
- [ ] Never
@@@explain
An empty dependency array means nothing can change, so it only runs on mount.
:::

:::quiz
### Why can't hooks be called inside an if?
- [ ] It's slower
- [x] React tracks hooks by call order, which would change between renders
- [ ] JavaScript doesn't allow it
- [ ] It's allowed in React 19
@@@explain
Conditional calls shift the order and hooks read the wrong state slot.
:::
