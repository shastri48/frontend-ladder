---
title: Props, State & useState
summary: The two kinds of data in React, how re-rendering works, why you must never mutate state, and stateless vs stateful components.
minutes: 17
---

## Two kinds of data

Every value in a React component is one of:

- **Props** — inputs passed **from the parent**. Read-only for the child.
- **State** — data the component **owns and changes over time** (via `useState`/`useReducer`).

Everything else (like `const total = price * qty`) is **derived** during render.

```jsx
function Counter({ step = 1 }) {          // step: prop
  const [count, setCount] = useState(0)  // count: state
  const isBig = count > 10               // derived value
  return (
    <button onClick={() => setCount(count + step)}>
      {count} {isBig && "🔥"}
    </button>
  )
}
```

| | Props | State |
|---|---|---|
| Owned by | Parent | The component itself |
| Can the component change it? | No (read-only) | Yes, via its setter |
| Changing it causes | Re-render of the child (because the parent re-rendered) | Re-render of the component and its children |
| Analogy | Function arguments | Variables with memory |

:::callout analogy Props are arguments, state is memory
A component is like a function called on every render. Props are the arguments you pass in. State is like a variable that survives between calls — React stores it for you, keyed by the component's position in the tree.
:::

## Data flows one way: down

React has **one-way data flow**: parents pass data down through props; children talk back up by calling **functions** passed as props.

```jsx
function Parent() {
  const [name, setName] = useState("Asha")
  return <NameInput value={name} onChange={setName} />
}

function NameInput({ value, onChange }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />
}
```

The child never mutates `props.value`. It asks the parent to change it.

## useState in depth

```jsx
const [value, setValue] = useState(initialValue)
```

- Returns the **current value** and a **setter**.
- The initial value is used only on the **first render**.
- Calling the setter **schedules a re-render** with the new value. It doesn't change `value` in the currently running function.

### What a re-render really is

When state changes, React **calls your component function again**. Every variable inside is recreated. `useState` returns the latest stored value. React then compares the new JSX with the previous one and updates only what changed in the DOM.

```jsx
function Demo() {
  const [n, setN] = useState(0)
  console.log("render with", n)

  function handleClick() {
    setN(n + 1)
    console.log("after set:", n) // still the OLD value — this render's snapshot
  }
  return <button onClick={handleClick}>{n}</button>
}
```

State behaves like a **snapshot**: each render has its own constant `n`. The handler created during that render sees that render's `n`.

### Functional updates

Because of snapshots, this only adds 1:

```jsx
function addThree() {
  setN(n + 1) // n is 0 → schedule 1
  setN(n + 1) // n is still 0 → schedule 1
  setN(n + 1) // → 1
}
```

When the next value depends on the previous one, pass a **function**:

```jsx
function addThree() {
  setN((prev) => prev + 1)
  setN((prev) => prev + 1)
  setN((prev) => prev + 1) // → 3
}
```

React queues the updater functions and applies them in order. Multiple `setState` calls in one event are **batched** into a single re-render (and since React 18, batching also applies in timeouts and promises).

### Lazy initial state

```jsx
const [todos, setTodos] = useState(() => JSON.parse(localStorage.getItem("todos") ?? "[]"))
```

Passing a function means the expensive read runs only on the first render, not on every render.

## Never mutate state

React decides whether to re-render by comparing the old and new state with `Object.is` — i.e. **by reference** for objects and arrays.

```jsx
const [user, setUser] = useState({ name: "Asha", age: 28 })

// ❌ Mutation: same object reference → React may skip the update; bugs
user.age = 29
setUser(user)

// ✅ New object
setUser({ ...user, age: 29 })
setUser((u) => ({ ...u, age: u.age + 1 }))
```

Array patterns:

```jsx
setItems([...items, newItem])                            // add
setItems(items.filter((i) => i.id !== id))               // remove
setItems(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i))) // update
setItems([...items].sort(byName))                        // sort a copy
```

Why React recommends immutability:

1. **Change detection** is a cheap reference check (`prev !== next`) instead of a deep comparison.
2. `React.memo`, `useMemo`, `useEffect` dependencies all rely on references changing.
3. **Predictability** — old renders keep their snapshot; time-travel debugging and undo become trivial.
4. Concurrent rendering can safely prepare multiple versions of the UI.

## Stateless vs stateful components

- A **stateless** (presentational) component has no state of its own; it renders purely from props. Easy to test and reuse.
- A **stateful** (container) component owns state and passes data/handlers down.

```jsx
// Stateless
function PriceTag({ amount, currency }) {
  return <span>{new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount)}</span>
}

// Stateful
function Cart() {
  const [items, setItems] = useState([])
  const total = items.reduce((s, i) => s + i.price, 0)
  return <PriceTag amount={total} currency="INR" />
}
```

Historically "stateless" meant "function component" and "stateful" meant "class component" — hooks removed that distinction. Today it's about whether the component holds state.

Aim for **few stateful components and many stateless ones**: keep state as low as possible but as high as necessary.

## What should be state?

Ask:
1. Does it change over time? If not → constant or prop.
2. Is it passed from a parent? → prop.
3. Can you compute it from other state/props? → **derive it**, don't store it.

```jsx
// ❌ Redundant state that can go out of sync
const [items, setItems] = useState([])
const [count, setCount] = useState(0)

// ✅ Derived
const count = items.length
```

## Interview questions

:::question
difficulty: easy
companies: Common
### Explain the difference between props and state
Props are read-only inputs passed from a parent; state is private data a component owns and updates with a setter. Changing state re-renders the component (and its subtree); props change when the parent re-renders with new values. Props flow down; to change parent data, a child calls a callback prop. Both are snapshots for a given render.
:::

:::question
difficulty: easy
### Why does React recommend against mutating state?
React detects changes by reference comparison (`Object.is`). Mutating an object keeps the same reference, so React may skip re-rendering, and memoized children/effects won't see a change. Mutation also corrupts previous snapshots that other code (or concurrent renders) still holds, making bugs hard to trace. Creating new objects/arrays keeps updates predictable and enables cheap change detection, memoization and undo/time-travel.
:::

:::question
difficulty: easy
### What are stateless and stateful components?
A stateless component renders purely from its props — no internal state — making it predictable and reusable (presentational). A stateful component owns state via `useState`/`useReducer` (or `this.state` in classes) and usually coordinates data for children. Prefer pushing state up into a few stateful containers and keeping most components stateless.
:::

:::question
difficulty: medium
### Why does `setCount(count + 1)` three times only add one?
Each render captures a snapshot of `count`. All three calls read the same `count` (say 0) and schedule "set to 1". React batches them into one render with 1. Use the updater form `setCount(c => c + 1)` so each call receives the result of the previous queued update.
:::

## Challenges

:::challenge
difficulty: easy
### Fix the bugs
This shopping list doesn't update when adding or toggling. Find and fix every problem.
```jsx
function ShoppingList() {
  const [items, setItems] = useState([])
  const [text, setText] = useState("")

  function add() {
    items.push({ id: Date.now(), text, bought: false })
    setItems(items)
  }
  function toggle(id) {
    const item = items.find((i) => i.id === id)
    item.bought = !item.bought
    setItems(items)
  }
  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={add}>Add</button>
      <ul>
        {items.map((i) => (
          <li onClick={() => toggle(i.id)}>{i.bought ? <s>{i.text}</s> : i.text}</li>
        ))}
      </ul>
    </>
  )
}
```
@@@solution
Problems: (1) `push` and setting the same array → same reference → React bails out. (2) Toggling mutates the item object. (3) Missing `key` on list items. (4) Input not cleared; empty items allowed.

```jsx
function ShoppingList() {
  const [items, setItems] = useState([])
  const [text, setText] = useState("")

  function add() {
    const trimmed = text.trim()
    if (!trimmed) return
    setItems((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed, bought: false }])
    setText("")
  }
  function toggle(id) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, bought: !i.bought } : i)))
  }
  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={add}>Add</button>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <button onClick={() => toggle(i.id)} aria-pressed={i.bought}>
              {i.bought ? <s>{i.text}</s> : i.text}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
```
Also swapped the clickable `<li>` for a `<button>` so it's keyboard accessible.
:::

:::challenge
difficulty: easy
### Predict the count
```jsx
function C() {
  const [n, setN] = useState(0)
  function onClick() {
    setN(n + 5)
    setN((p) => p + 1)
    setN(n + 1)
    setN((p) => p * 2)
  }
  return <button onClick={onClick}>{n}</button>
}
```
What is shown after one click (starting from 0)?
@@@solution
**2**. React processes the queue in order starting from 0: `n + 5` → 5; `p + 1` → 6; `n + 1` (n is the snapshot 0) → 1; `p * 2` → 2. Plain values replace; updater functions use the latest queued value.
:::

:::quiz
### A child wants to change data owned by its parent. It should…
- [ ] Mutate props directly
- [x] Call a function the parent passed as a prop
- [ ] Use document.querySelector
- [ ] Copy the prop into a global
@@@explain
Data flows down; events flow up via callback props.
:::

:::quiz
### Which update correctly adds an item?
- [ ] items.push(x); setItems(items)
- [x] setItems(prev => [...prev, x])
- [ ] setItems(items.push(x))
- [ ] items[items.length] = x
@@@explain
Create a new array so the reference changes.
:::
