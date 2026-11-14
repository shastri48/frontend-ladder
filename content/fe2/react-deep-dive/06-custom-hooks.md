---
title: Custom Hooks, forwardRef & useImperativeHandle
summary: Extracting reusable stateful logic — useDebounce, useWindowSize with throttle, useLocalStorage, useCounter — plus exposing imperative APIs.
minutes: 20
---

## What a custom hook really is

A custom hook is **just a function whose name starts with `use` and that calls other hooks**. That's it. No registration, no magic.

Key facts interviewers check:

- Each component that calls a custom hook gets its **own independent state** — hooks share *logic*, not *state*.
- The `use` prefix is a convention the linter relies on to enforce the rules of hooks inside it.
- A custom hook can return anything: a value, a tuple `[value, setter]`, an object `{ data, error, refetch }`.
- If a function doesn't call any hooks, it shouldn't be a hook — make it a plain utility.

:::callout tip Tuple or object?
Return a **tuple** when there are 1–2 values and callers will want to rename them (`const [open, setOpen] = useToggle()`). Return an **object** when there are many values or most callers use only a few (`const { data, isLoading } = useQuery(...)`).
:::

## useCounter — the classic warm-up

```jsx
function useCounter(initial = 0, { min = -Infinity, max = Infinity, step = 1 } = {}) {
  const [count, setCount] = useState(initial)
  const clamp = n => Math.min(max, Math.max(min, n))
  const increment = useCallback(() => setCount(c => clamp(c + step)), [step, min, max])
  const decrement = useCallback(() => setCount(c => clamp(c - step)), [step, min, max])
  const reset = useCallback(() => setCount(initial), [initial])
  return { count, increment, decrement, reset, set: setCount }
}

function CounterApp() {
  const { count, increment, decrement, reset } = useCounter(0, { min: 0, max: 10 })
  return (
    <div>
      <button onClick={decrement} aria-label="decrement">-</button>
      <output>{count}</output>
      <button onClick={increment} aria-label="increment">+</button>
      <button onClick={reset}>Reset</button>
    </div>
  )
}
```

## useDebounce — debouncing a value

```jsx
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id) // every new value cancels the pending update
  }, [value, delay])
  return debounced
}

function Search() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 400)
  const results = useSearch(debouncedQ) // only fires 400ms after typing stops
  return <input value={q} onChange={e => setQ(e.target.value)} />
}
```

The effect cleanup is the debounce: each keystroke clears the previous timer.

### useDebouncedCallback — debouncing a function

Sometimes you want to debounce the *call* rather than the value (e.g. autosave):

```jsx
function useDebouncedCallback(fn, delay) {
  const fnRef = useRef(fn)
  useLayoutEffect(() => { fnRef.current = fn }) // always call the latest fn (no stale closure)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), []) // cleanup on unmount
  return useCallback((...args) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fnRef.current(...args), delay)
  }, [delay])
}
```

Note the pattern: stable returned function + ref to the latest callback + cleanup on unmount.

## useWindowSize with throttling

A real Housing.com interview question. `resize` fires dozens of times per second; re-rendering on each is wasteful.

```jsx
function throttle(fn, wait) {
  let last = 0, timer = null
  return (...args) => {
    const now = Date.now()
    const remaining = wait - (now - last)
    if (remaining <= 0) {
      clearTimeout(timer); timer = null
      last = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => {          // trailing call so we always end on the final size
        last = Date.now(); timer = null
        fn(...args)
      }, remaining)
    }
  }
}

function getSize() {
  return typeof window === 'undefined'
    ? { width: 0, height: 0 }             // SSR-safe
    : { width: window.innerWidth, height: window.innerHeight }
}

function useWindowSize(wait = 200) {
  const [size, setSize] = useState(getSize)
  useEffect(() => {
    const onResize = throttle(() => setSize(getSize()), wait)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [wait])
  return size
}
```

Discussion points:
- **Trailing call** ensures the final size is captured after resizing stops.
- **Cleanup** removes the listener (a classic leak source).
- **SSR** — `window` doesn't exist on the server.
- Alternatives: `matchMedia` listeners if you only care about breakpoints (fires only on crossing), `ResizeObserver` for an element's size, or `useSyncExternalStore` for tear-free subscription.

## useLocalStorage

```jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw !== null ? JSON.parse(raw) : initialValue
    } catch {
      return initialValue // private mode, quota, bad JSON
    }
  })

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore quota */ }
  }, [key, value])

  // sync across tabs
  useEffect(() => {
    const onStorage = e => {
      if (e.key === key) setValue(e.newValue !== null ? JSON.parse(e.newValue) : initialValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return [value, setValue]
}
```

## forwardRef and useImperativeHandle

Refs aren't props: `<MyInput ref={r} />` on a function component historically didn't pass `ref` through. Two tools:

- **`forwardRef`** lets a component receive a `ref` and attach it to a DOM node inside. (In **React 19**, `ref` is a normal prop for function components and `forwardRef` is no longer needed.)
- **`useImperativeHandle(ref, () => api, deps)`** customises what the parent receives — a **limited imperative API** instead of the raw DOM node.

```jsx
const VideoPlayer = forwardRef(function VideoPlayer({ src }, ref) {
  const videoRef = useRef(null)
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current.play(),
    pause: () => videoRef.current.pause(),
    seek: t => { videoRef.current.currentTime = t },
  }), [])
  return <video ref={videoRef} src={src} />
})

function Lesson() {
  const player = useRef(null)
  return (
    <>
      <VideoPlayer ref={player} src="/intro.mp4" />
      <button onClick={() => player.current.seek(0)}>Restart</button>
    </>
  )
}
```

Use it for genuinely imperative things — focus, scroll, play/pause, animations, opening a modal from outside. Don't use it to bypass the normal props flow for data.

:::question
difficulty: medium
companies: Accenture
### What are custom hooks and how do you create one?
A custom hook is a function whose name starts with `use` and that calls other hooks to encapsulate reusable stateful logic — e.g. `useFetch`, `useDebounce`, `useWindowSize`. Each component using it gets its own isolated state; only the logic is shared. You create one by moving hook calls out of a component into a `useX` function and returning what the component needs. The naming lets the linter enforce rules of hooks inside it.
:::

:::question
difficulty: medium
### What is the purpose of the useImperativeHandle hook?
`useImperativeHandle(ref, createHandle, deps)` customises the value a parent receives through a `ref` to a child component. Instead of exposing the whole DOM node, the child exposes a small, intentional API like `{ focus, scrollToBottom, play }`. It's used with `forwardRef` (or the `ref` prop in React 19). Use sparingly for imperative actions; data should flow through props.
:::

:::question
difficulty: medium
### Do two components using the same custom hook share state?
No. Hooks share **logic**, not state. Each call to a custom hook creates its own `useState`/`useEffect` slots on the calling component's fiber. To share state, lift it into a common parent, put it in context, or use an external store (Zustand, Redux) that the hook subscribes to.
:::

:::challenge
difficulty: easy
### Create a custom hook for a counter app
Write `useCounter(initial)` returning `{ count, increment, decrement, reset }` and use it in a component with +, −, Reset buttons. Count must never go below 0.
@@@solution
```jsx
function useCounter(initial = 0) {
  const [count, setCount] = useState(initial)
  const increment = useCallback(() => setCount(c => c + 1), [])
  const decrement = useCallback(() => setCount(c => Math.max(0, c - 1)), [])
  const reset = useCallback(() => setCount(initial), [initial])
  return { count, increment, decrement, reset }
}

export default function Counter() {
  const { count, increment, decrement, reset } = useCounter(0)
  return (
    <div>
      <button onClick={decrement} disabled={count === 0} aria-label="Decrease">−</button>
      <span aria-live="polite">{count}</span>
      <button onClick={increment} aria-label="Increase">+</button>
      <button onClick={reset}>Reset</button>
    </div>
  )
}
```
Points interviewers like: functional updates (no stale state on rapid clicks), stable callbacks, disabled state at the boundary, `aria-live` for screen readers.
:::

:::challenge
difficulty: medium
### Parent reads child state via a function prop
Create a Parent with two buttons and a Child that owns a counter. Button 1 increases the child's value; Button 2 shows (alerts) the child's current value. The parent passes a function as a prop that the child calls.
@@@solution
Two idiomatic answers.

**A — child reports to parent via callback (lifting data up):**
```jsx
function Child({ onChange, increaseSignal }) {
  const [value, setValue] = useState(0)
  useEffect(() => { if (increaseSignal) setValue(v => v + 1) }, [increaseSignal])
  useEffect(() => { onChange(value) }, [value, onChange])
  return <p>Child value: {value}</p>
}
function Parent() {
  const latest = useRef(0)
  const [signal, setSignal] = useState(0)
  const handleChange = useCallback(v => { latest.current = v }, [])
  return (
    <>
      <button onClick={() => setSignal(s => s + 1)}>Increase child</button>
      <button onClick={() => alert(latest.current)}>Show child value</button>
      <Child onChange={handleChange} increaseSignal={signal} />
    </>
  )
}
```

**B — imperative handle (cleanest for "parent commands child"):**
```jsx
const Child = forwardRef(function Child(_, ref) {
  const [value, setValue] = useState(0)
  useImperativeHandle(ref, () => ({
    increase: () => setValue(v => v + 1),
    getValue: () => value,
  }), [value])
  return <p>Child value: {value}</p>
})
function Parent() {
  const child = useRef(null)
  return (
    <>
      <button onClick={() => child.current.increase()}>Increase child</button>
      <button onClick={() => alert(child.current.getValue())}>Show child value</button>
      <Child ref={child} />
    </>
  )
}
```
Mention: the most "React" answer is usually to **lift the state into the parent** and pass `value` + `onIncrease` down; options A/B exist when the child must own the state.
:::

:::challenge
difficulty: medium
companies: Housing.com
### Build useWindowSize with throttling
Return `{ width, height }`, update at most once every `wait` ms while resizing, always capture the final size, clean up properly and be SSR-safe.
@@@solution
See the full implementation in this lesson's "useWindowSize with throttling" section. Checklist of what makes it complete:
1. Lazy `useState(getSize)` that guards `typeof window === 'undefined'`.
2. Throttle with **leading + trailing** calls so the last resize isn't lost.
3. Listener created inside the effect, removed in cleanup (and pending timer cleared — add `onResize.cancel?.()` if your throttle supports it).
4. Effect depends on `wait` only.
5. Follow-ups: `useSyncExternalStore` for concurrent-safe subscriptions; `matchMedia` when only breakpoints matter; `ResizeObserver` for element size.
:::

:::quiz
### A function `formatPrice()` that calls no hooks — should it be named `useFormatPrice`?
- [ ] Yes, all helpers in React should start with use
- [x] No, only functions that call hooks should be hooks
- [ ] Yes, otherwise it can't be used in components
@@@explain
The use prefix signals "this follows the rules of hooks". A plain function can be called anywhere, including conditionally.
:::

:::quiz
### In React 19, how does a function component receive a ref?
- [ ] Only through forwardRef
- [x] As a regular `ref` prop
- [ ] It can't
@@@explain
React 19 passes ref as a prop to function components; forwardRef is no longer required.
:::
