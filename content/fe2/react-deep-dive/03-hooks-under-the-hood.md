---
title: Hooks Under the Hood — useState, useReducer, useContext
summary: Why the rules of hooks exist, how React stores hook state, batching, functional updates, reducers and context.
minutes: 20
---

## Why hooks exist

Before 2019, state and lifecycle lived only in classes. Sharing logic meant HOCs and render props, which produced "wrapper hell" in DevTools, and related logic was split across `componentDidMount` / `componentDidUpdate` / `componentWillUnmount`. Hooks let you:

- Use state and effects in **function components**.
- **Group code by concern** (subscription setup and teardown live together) instead of by lifecycle method.
- **Extract and reuse stateful logic** with custom hooks — plain functions, no extra components in the tree.
- Avoid `this` binding confusion, and enable better minification and compiler optimisations.

## How React stores hooks: a linked list per component

A function component has no instance to keep data on. So where does `useState` keep its value? On the component's **fiber**: `fiber.memoizedState` points to a **linked list of hook objects**, one per hook call, in call order.

```text
fiber (Counter)
  memoizedState ─► { state: 0, queue, next } ─► { deps, effect, next } ─► { current: ref, next } ─► null
                    useState #1                  useEffect #2              useRef #3
```

During a render, React keeps a pointer `workInProgressHook`. Each time you call a hook, React moves to the next node. The hook does not know its "name" — it is identified **only by its position**.

That is the entire reason for the rules of hooks:

1. **Only call hooks at the top level** — not inside conditions, loops or nested functions. If a condition skips hook #2 on one render, hook #3 would read #2's data.
2. **Only call hooks from React functions** — components or custom hooks (whose name starts with `use`, so the linter can check them).

```jsx
function Bad({ loggedIn }) {
  const [name, setName] = useState('')
  if (loggedIn) {
    useEffect(() => {}) // ❌ order changes when loggedIn flips
  }
  const [age, setAge] = useState(0) // reads the effect's slot when loggedIn changes!
}
```

:::callout info React 19's `use()` is the exception
`use(promise)` / `use(context)` may be called conditionally because it does not keep per-position state in the same way. Every other hook follows the rules.
:::

## useState in depth

```jsx
const [value, setValue] = useState(initial)
```

- **Lazy initialisation**: `useState(() => expensiveParse(localStorage.data))` runs the function only on the first render. `useState(expensiveParse(...))` would compute it on every render and throw it away.
- **Bail-out**: if the new value is `Object.is` equal to the current, React skips rendering children (it may still call your component once).
- **Functional updates**: `setValue(prev => next)` — use whenever the new state depends on the old one, especially in async callbacks, intervals and when calling setState multiple times.
- **setState identity is stable** — safe to omit from dependency arrays.

### Batching

React groups multiple state updates into **one** re-render.

```jsx
function handle() {
  setA(1)
  setB(2)
  setC(3) // → one render, not three
}
```

Before React 18 batching only happened inside React event handlers; updates in `setTimeout`, promises or native listeners rendered separately. **React 18 introduced automatic batching everywhere** (with `createRoot`). To opt out for one update, use `flushSync` (see FE3 → Scheduling).

## useReducer

When state has several sub-values that change together, or the next state depends on complex logic, move it to a reducer:

```jsx
const initial = { status: 'idle', data: null, error: null }

function reducer(state, action) {
  switch (action.type) {
    case 'start':   return { ...state, status: 'loading', error: null }
    case 'success': return { status: 'success', data: action.data, error: null }
    case 'error':   return { ...state, status: 'error', error: action.error }
    default:        throw new Error(`Unknown action ${action.type}`)
  }
}

function useFetchState() {
  const [state, dispatch] = useReducer(reducer, initial)
  return [state, dispatch]
}
```

Benefits:

- **Impossible states become impossible** — you can't have `loading: true` and `error` set at once by accident.
- **Logic is testable** — a reducer is a pure function you can unit-test without React.
- **`dispatch` is stable**, so passing it deep (or through context) doesn't break memoisation.
- Event handlers describe **what happened** (`dispatch({type:'added'})`) rather than how to update.

| Prefer `useState` when | Prefer `useReducer` when |
|---|---|
| Independent primitive values | Several values change together |
| Simple toggles, inputs | Next state depends on previous in complex ways |
| Few update paths | Many event types / you want a state machine |

## useContext

Context solves **prop drilling**: passing a value through many layers that don't use it.

```jsx
const ThemeContext = createContext('light')

function App() {
  const [theme, setTheme] = useState('dark')
  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return (
    <ThemeContext.Provider value={value}>
      <Page />
    </ThemeContext.Provider>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext)
  return <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme}</button>
}
```

How it works: every consumer subscribes to the nearest Provider above it. When the Provider's `value` changes (by reference), **every** consumer re-renders — even if it uses only part of the value, and even if intermediate components are memoised.

Pitfalls (covered fully in **State & Data → Context API**):

- Passing a new object literal as `value` each render re-renders all consumers. Memoise it.
- One giant context for everything → any change re-renders everyone. Split by concern / by update frequency (e.g. separate `StateContext` and `DispatchContext`).
- Context is a **transport**, not a state manager — it has no selectors.

:::question
difficulty: easy
companies: Accenture
### What are the benefits of using hooks in React?
Hooks let function components hold state and side effects, so you no longer need classes. They group related logic together (setup and cleanup side by side), make **stateful logic reusable** through custom hooks without wrapper components (no HOC/render-prop nesting), remove `this` confusion, produce smaller and more optimisable code, and are the foundation of modern features (concurrent rendering, Suspense, the React Compiler).
:::

:::question
difficulty: medium
companies: Accenture
### What are the rules of hooks, and why do they exist?
1. Call hooks only at the **top level** of a component or custom hook — never inside conditions, loops, nested functions or after an early return.
2. Call hooks only from **React function components or custom hooks**.

React stores hook data in a linked list on the component's fiber and identifies each hook purely by **call order**. If the order changes between renders, hooks read each other's state, causing bugs or the "Rendered fewer hooks than expected" error. The `eslint-plugin-react-hooks` rule enforces this.
:::

:::question
difficulty: medium
### What is the purpose of the useReducer hook?
`useReducer(reducer, initialState)` manages state through a pure function `(state, action) => newState`. It shines when multiple values change together or transitions are complex (forms, fetch status, wizards). It centralises update logic, makes it unit-testable, prevents inconsistent states and returns a stable `dispatch` you can pass deeply without breaking memoisation. It is also how you model a small state machine in a component.
:::

:::question
difficulty: easy
### What is the purpose of the useContext hook?
`useContext(MyContext)` reads the value from the nearest `<MyContext.Provider>` above the component and subscribes the component to changes. It removes prop drilling for app-wide values like theme, locale, current user or feature flags. Every consumer re-renders whenever the provider's `value` changes by reference, so memoise the value and split contexts by concern.
:::

:::question
difficulty: medium
### Explain automatic batching.
Batching combines multiple state updates into a single re-render. In React 17, only updates inside React synthetic event handlers were batched; updates inside `setTimeout`, promises or native event listeners each caused a separate render. React 18 (with `createRoot`) batches **all** updates regardless of where they originate. `flushSync(() => setX(1))` forces a synchronous, unbatched render when you must read the DOM right after an update.
:::

:::challenge
difficulty: medium
### Predict renders: batching across async boundaries
```jsx
function App() {
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  console.log('render', a, b)
  async function onClick() {
    setA(1); setB(1)
    await Promise.resolve()
    setA(2); setB(2)
  }
  return <button onClick={onClick}>go</button>
}
```
How many times does "render" log after one click in React 17 (legacy `ReactDOM.render`) vs React 18 (`createRoot`)?
@@@solution
- **React 17:** 3 renders. The first two updates are inside the event handler → batched into one render (`1 1`). After `await`, we're outside React's batching scope → `setA(2)` renders (`2 1`), then `setB(2)` renders (`2 2`).
- **React 18:** 2 renders. Automatic batching groups `setA(1); setB(1)` → `1 1`, then the two updates after the await are batched together → `2 2`.

Key point: React 18 batches updates in promises, timeouts and native handlers too.
:::

:::challenge
difficulty: medium
### Convert a messy useState component to useReducer
```jsx
function Checkout() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)
  async function pay() {
    setLoading(true); setError(null)
    try { setOrder(await api.pay()) }
    catch (e) { setError(e) }
    finally { setLoading(false) }
  }
}
```
Refactor so that it's impossible to be loading and errored at the same time.
@@@solution
```jsx
const initial = { status: 'idle', order: null, error: null }

function reducer(state, action) {
  switch (action.type) {
    case 'pay':     return { status: 'loading', order: null, error: null }
    case 'paid':    return { status: 'success', order: action.order, error: null }
    case 'failed':  return { status: 'error', order: null, error: action.error }
    case 'reset':   return initial
    default: return state
  }
}

function Checkout() {
  const [state, dispatch] = useReducer(reducer, initial)
  async function pay() {
    dispatch({ type: 'pay' })
    try { dispatch({ type: 'paid', order: await api.pay() }) }
    catch (error) { dispatch({ type: 'failed', error }) }
  }
  if (state.status === 'loading') return <Spinner />
  // ...
}
```
A single `status` field (a tiny state machine) replaces three booleans that could contradict each other. The reducer is pure and unit-testable, and the component reads like a list of events.
:::

:::quiz
### Why must hooks not be called inside an if statement?
- [ ] Hooks are slow inside conditionals
- [x] React identifies hooks by call order, which would change between renders
- [ ] JavaScript doesn't allow functions inside if blocks
@@@explain
Hook state lives in an ordered linked list on the fiber; skipping one shifts every subsequent hook.
:::

:::quiz
### `useState(computeInitial())` vs `useState(() => computeInitial())` — difference?
- [ ] No difference
- [x] The function form runs computeInitial only on the first render
- [ ] The function form runs it on every render
@@@explain
Lazy initialisers avoid recomputing an expensive initial value whose result React ignores after mount.
:::
