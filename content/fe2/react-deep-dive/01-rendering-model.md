---
title: React's Rendering Model
summary: What a render really is, what triggers one, render vs commit, and why you must never mutate state.
minutes: 18
---

## The one sentence that explains React

React's whole model fits in one line: **UI = f(state)**. You describe what the screen should look like for a given state, and React figures out how to make the real DOM match that description. You never say "add this class" or "remove that node" — you change state, and React re-runs your component function to get a fresh description.

:::callout analogy Think of a restaurant order
Your component is a recipe. State is the list of ingredients on hand. A **render** is the chef reading the recipe and writing down what the dish should look like. The **commit** is the waiter actually carrying the plate to the table. Reading a recipe is cheap; walking to the table is what the customer sees. React tries hard to make as few trips to the table as possible.
:::

## Nodes, elements and components

Three words get mixed up constantly — interviewers love this question.

| Term | What it is | Example |
|---|---|---|
| **Component** | A function (or class) that returns UI | `function Button(props) { ... }` |
| **Element** | A plain, immutable object describing *what* to render | `{ type: Button, props: { label: 'Hi' }, key: null }` |
| **Node** (ReactNode) | Anything React can render: elements, strings, numbers, arrays, `null`, `false`, portals | `'hello'`, `<div/>`, `[<li/>, <li/>]` |

JSX is just sugar for `React.createElement` (or the newer `jsx()` runtime):

```jsx
const el = <Button label="Hi" />
// compiles to
const el = jsx(Button, { label: 'Hi' })
// which returns roughly
// { $$typeof: Symbol(react.element), type: Button, props: { label: 'Hi' }, key: null, ref: null }
```

An element is a **snapshot description**, not a DOM node and not a component instance. Creating one costs almost nothing — it is just an object.

## What triggers a render?

A component renders for exactly these reasons:

1. **Initial mount** — `root.render(<App />)`.
2. **Its own state changed** — `setState` / `dispatch` with a value that is not `Object.is`-equal to the current one.
3. **Its parent re-rendered** — by default, every child of a re-rendering component re-renders too, *whether or not its props changed*.
4. **A context it consumes changed** — `useContext(Ctx)` subscribes to the nearest Provider's `value`.
5. **An external store it subscribes to changed** — e.g. Redux's `useSelector` or `useSyncExternalStore` returning a new snapshot.

:::callout warn The most misunderstood rule
"Props changed" is **not** a trigger. A child re-renders because its *parent rendered*. Props changing is just what usually happens at the same time. `React.memo` is what makes React compare props and skip the child.
:::

## Render phase vs commit phase

Every update goes through two phases:

```text
 setState()  ──►  RENDER PHASE  ──────────────►  COMMIT PHASE  ──► browser paints
                  • call component functions      • apply DOM mutations
                  • build new element tree        • set refs
                  • diff against previous tree    • run useLayoutEffect (sync)
                  • pure, may be paused/restarted • schedule useEffect (after paint)
```

- **Render phase** is pure computation. React calls your function, compares the result with last time (reconciliation) and computes a list of changes. In concurrent React this phase can be interrupted, thrown away and restarted — which is why render must have **no side effects**.
- **Commit phase** is where React touches the DOM. It is synchronous and never interrupted, so the user never sees a half-updated UI.

A render does **not** necessarily mean a DOM update. If the output is identical, the commit finds nothing to change. That is why "my component re-rendered" is not automatically a performance problem — the expensive part is usually commit + layout + paint.

## State is a snapshot

Inside one render, state is a constant. Calling `setCount` does not change `count` — it schedules a new render where `count` will be the new value.

```jsx
function Counter() {
  const [count, setCount] = useState(0)
  function handleClick() {
    setCount(count + 1)
    setCount(count + 1)
    setCount(count + 1)
    console.log(count) // still 0 in this render
  }
  // after the click count becomes 1, not 3
}
```

Each `setCount(count + 1)` means "set to 0 + 1". To build on the previous value, use an **updater function**: `setCount(c => c + 1)` three times gives 3, because React queues the updaters and runs them in order.

## Why you must never mutate state

```jsx
const [todos, setTodos] = useState([{ id: 1, done: false }])

// ❌ mutation
todos[0].done = true
setTodos(todos) // same array reference → Object.is(old, new) === true → bail out, NO re-render

// ✅ immutable update
setTodos(todos.map(t => (t.id === 1 ? { ...t, done: true } : t)))
```

React decides whether something changed by **reference comparison** (`Object.is`), not by deep comparison. Deep comparison of every state object on every update would be far too slow. Mutating breaks:

- **Bail-out detection** — same reference, so React thinks nothing changed.
- **`React.memo`, `useMemo`, `useEffect` dependencies** — all compare references.
- **Concurrent rendering** — React may hold the old state for a render it might discard; mutation corrupts it.
- **Time-travel / debugging** — Redux DevTools and undo stacks rely on old snapshots staying intact.

:::callout tip Immer makes immutability painless
`produce(state, draft => { draft[0].done = true })` lets you write "mutating" code against a proxy draft; Immer produces a new structurally-shared object. Redux Toolkit uses it under the hood.
:::

## Stateless vs stateful, pure components

- **Stateless (presentational) component**: renders purely from props. Easy to test and reuse.
- **Stateful (container) component**: owns state via `useState`/`useReducer` and passes data down.
- **Pure component**: given the same props and state, renders the same output. Historically `React.PureComponent` was a class that implemented `shouldComponentUpdate` with a shallow prop/state comparison. The function equivalent is `React.memo(Component)`.

## Fragments

A component must return a single node, but wrapper `<div>`s break layouts (flex/grid children, `<tr>` inside `<tbody>`, etc.). Fragments group children without adding a DOM node:

```jsx
function Columns() {
  return (
    <>
      <td>Name</td>
      <td>Age</td>
    </>
  )
}
// Use <React.Fragment key={id}> when you need a key inside a list.
```

## createElement vs cloneElement

- `createElement(type, props, ...children)` creates a **new** element from a type.
- `cloneElement(element, extraProps, ...children)` takes an **existing** element and returns a copy with merged props (keeping `key` and `ref` unless overridden).

```jsx
function RadioGroup({ name, children }) {
  return React.Children.map(children, child =>
    React.cloneElement(child, { name }) // inject the group name into every <Radio>
  )
}
```

`cloneElement` is considered a legacy pattern now — it couples a parent to the exact shape of its children. Prefer context or render props.

:::question
difficulty: easy
companies: Tekion
### What is the difference between a React Node, Element and Component?
A **component** is a function or class that accepts props and returns UI. An **element** is the immutable plain object a component call (or JSX) produces — `{ type, props, key, ref }` — describing what to render. A **node** (`ReactNode`) is the broadest type: anything renderable — elements, strings, numbers, booleans, `null`, arrays of nodes and portals.

```jsx
function Hello() { return <p>Hi</p> } // component
const el = <Hello />                   // element (type: Hello)
const node = ['text', 42, el, null]    // valid ReactNode
```

**In an interview, say:** "Components are the blueprints, elements are cheap immutable descriptions produced by rendering, and nodes are anything React knows how to put on screen."
:::

:::question
difficulty: easy
### What are React Fragments used for?
Fragments let a component return multiple children without adding an extra DOM node. This keeps the DOM clean, avoids breaking CSS layouts (flex/grid direct children) and lets you return valid markup in places where wrappers are illegal (e.g. multiple `<td>` inside a `<tr>`, `<li>`s inside a `<ul>`). Use the short `<>...</>` syntax, or `<Fragment key={...}>` when rendering fragments inside a list.
:::

:::question
difficulty: medium
companies: Accenture
### Why does React recommend against mutating state?
React detects changes by **reference equality** (`Object.is`). If you mutate an object and pass the same reference to `setState`, React bails out and does not re-render. Even when something else causes a render, memoised children (`React.memo`), `useMemo`, `useCallback` and `useEffect` dependency arrays all compare references, so they will see "no change" and show stale UI. Mutation also breaks concurrent rendering (React may re-use the previous state for an interrupted render), time-travel debugging and undo. Always create new objects/arrays: spread, `map`, `filter`, `structuredClone` for deep copies, or Immer.
:::

:::question
difficulty: medium
### What triggers a re-render in React?
1. The component's own state changes (and the new value is not `Object.is` equal to the old).
2. Its parent re-renders (default behaviour regardless of props).
3. A context value it reads with `useContext` changes.
4. An external store subscription (`useSyncExternalStore`, `useSelector`) returns a new snapshot.

Changing props alone is not a trigger — props only change because the parent rendered. `React.memo` makes a component skip renders when its props are shallowly equal.
:::

:::question
difficulty: medium
### What is the difference between the render phase and the commit phase?
The **render phase** calls component functions and diffs the new element tree against the previous one to compute changes. It is pure, has no visible effect and, in concurrent mode, can be paused, aborted or restarted. The **commit phase** applies the computed changes to the DOM, attaches refs, runs `useLayoutEffect` synchronously before paint and schedules `useEffect` to run after paint. Commit is synchronous and cannot be interrupted, so users never see partial UI. A component can render without causing any commit if its output did not change.
:::

:::question
difficulty: easy
### What are stateless and stateful components?
A **stateless** component has no internal state — its output depends only on props (pure presentational component). A **stateful** component owns state with `useState`/`useReducer` (or `this.state` in classes) and usually manages data or behaviour, passing results down as props. Keeping most components stateless and pushing state into a few containers makes UIs predictable and easy to test.
:::

:::question
difficulty: medium
### What is the difference between createElement and cloneElement?
`React.createElement(type, props, ...children)` builds a brand-new element from a component type or tag name — it is what JSX compiles to. `React.cloneElement(element, props, ...children)` copies an existing element and shallow-merges new props into it, preserving its `key` and `ref`. `cloneElement` is used by parent components to inject props into children they received (e.g. a `RadioGroup` adding `name`), but it is fragile and considered legacy; prefer context or render props.
:::

:::question
difficulty: easy
### What is the role of PropTypes in React?
`prop-types` performs **runtime** validation of a component's props in development and logs a console warning when a prop has the wrong type or a required prop is missing. It has no effect in production builds. Since React 19, `propTypes` checks on function components are removed entirely — TypeScript (compile-time checking) is the modern replacement.

```jsx
Button.propTypes = { label: PropTypes.string.isRequired, onClick: PropTypes.func }
```
:::

:::challenge
difficulty: medium
companies: Accenture
### Predict the output: three setState calls
```jsx
function App() {
  const [n, setN] = useState(0)
  return (
    <button onClick={() => {
      setN(n + 1)
      setN(prev => prev + 1)
      setN(n + 5)
      setN(prev => prev * 2)
      console.log('logged', n)
    }}>{n}</button>
  )
}
```
What is logged, and what does the button show after one click?
@@@hint
State is a snapshot for the duration of the render. Updaters run in queue order against the pending value.
@@@solution
`logged 0` is printed — `n` is a constant (0) in this render.

React processes the queue in order:

| update | pending value |
|---|---|
| `setN(0 + 1)` | 1 |
| `prev => prev + 1` | 2 |
| `setN(0 + 5)` | 5 (replaces) |
| `prev => prev * 2` | 10 |

The button shows **10**. All four updates are batched into a single re-render.
:::

:::challenge
difficulty: medium
### Spot the bug: the list never updates
```jsx
function Todos() {
  const [todos, setTodos] = useState([])
  function add(text) {
    todos.push({ id: Date.now(), text })
    setTodos(todos)
  }
  // ...
}
```
Why does adding a todo not update the screen? Fix it.
@@@solution
`todos.push` mutates the existing array and `setTodos(todos)` passes the **same reference**. React compares with `Object.is`, sees no change and bails out of the render.

```jsx
function add(text) {
  setTodos(prev => [...prev, { id: crypto.randomUUID(), text }])
}
```
Using the updater form also protects against stale `todos` if `add` is called from an old closure. `crypto.randomUUID()` avoids duplicate ids from two adds in the same millisecond.
:::

:::quiz
### A parent re-renders. Its child is NOT wrapped in React.memo and receives exactly the same props. What happens?
- [ ] The child is skipped because its props did not change
- [x] The child re-renders anyway
- [ ] React throws a warning
@@@explain
By default a parent render re-renders all its children. Only `React.memo` (or `PureComponent` / `shouldComponentUpdate`) adds a props comparison.
:::

:::quiz
### Which phase can React pause and restart in concurrent rendering?
- [x] Render phase
- [ ] Commit phase
- [ ] Both
@@@explain
The render phase is pure computation and can be interrupted. Commit mutates the DOM and is always synchronous.
:::
