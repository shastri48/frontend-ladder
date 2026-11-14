---
title: Lifting State, Component Communication & Prop Drilling
summary: How components share data — parent to child, child to parent, siblings via lifted state — and what to do when props drill too deep.
minutes: 16
---

## Communication patterns at a glance

```text
            ┌──────────── Parent (owns state) ─────────────┐
   props ▼  │                                              │  ▼ props
         ChildA ──── calls onChange(value) ───►  Parent ───► ChildB
         (child → parent via callback)          (sibling sync via lifted state)
```

| Direction | Mechanism |
|---|---|
| Parent → child | Props |
| Child → parent | Callback props (`onSomething`) |
| Sibling ↔ sibling | Lift state to the nearest common parent |
| Far-apart components | Context, or a state library (Redux, Zustand) |
| Parent calling a child's method | Refs + `useImperativeHandle` (rare) |

## Parent → child: props

```jsx
function Dashboard() {
  const user = { name: "Asha", plan: "pro" }
  return <Header user={user} theme="dark" />
}

function Header({ user, theme }) {
  return <header className={theme}>Hi {user.name}</header>
}
```

You can pass anything as a prop: strings, numbers, objects, arrays, functions, JSX (`icon={<StarIcon />}`) and children.

### children

Content between tags arrives as `props.children`:

```jsx
function Card({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

<Card title="Progress">
  <ProgressBar value={40} />
</Card>
```

This **composition** pattern is one of the best ways to avoid prop drilling (see below).

## Child → parent: callbacks

A child can't modify the parent's state directly. The parent passes a function; the child calls it.

```jsx
function SearchPage() {
  const [query, setQuery] = useState("")
  return (
    <>
      <SearchBox onSearch={setQuery} />
      <Results query={query} />
    </>
  )
}

function SearchBox({ onSearch }) {
  const [text, setText] = useState("")
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSearch(text) }}>
      <input value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  )
}
```

Naming convention: props are `onX` (`onSearch`, `onClose`), handlers inside are `handleX`.

## Lifting state up

When two components need the **same** changing data, move ("lift") the state to their **closest common ancestor** and pass it down. Classic example — two temperature inputs that must stay in sync:

```jsx
function Converter() {
  const [celsius, setCelsius] = useState(0)    // single source of truth
  return (
    <>
      <TempInput label="°C" value={celsius} onChange={setCelsius} />
      <TempInput
        label="°F"
        value={(celsius * 9) / 5 + 32}
        onChange={(f) => setCelsius(((f - 32) * 5) / 9)}
      />
    </>
  )
}

function TempInput({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
```

Why it's necessary:

- **Single source of truth** — if each input had its own state, they'd drift apart and you'd need fragile syncing effects.
- **Predictable data flow** — anyone reading the code knows exactly where the data lives and who can change it.
- **Derived values** — the °F value is computed, not stored.

The cost: the parent re-renders on each change, and you pass more props. Keep state **as low as possible, as high as necessary**.

## The two-button parent/child task

A common interview prompt (from the reference list):

> Create two components where the parent passes a function as a prop and the child calls it. Button 1 increases the **child's** state. Button 2 (in the parent) shows the current child state value.

Two good answers — the interviewer wants to see you discuss both.

**Approach A (idiomatic): lift the state to the parent.** If the parent needs to read the value, the parent should own it.

```jsx
function Parent() {
  const [count, setCount] = useState(0)
  const [shown, setShown] = useState(null)
  return (
    <div>
      <Child count={count} onIncrement={() => setCount((c) => c + 1)} />
      <button onClick={() => setShown(count)}>Show child value</button>
      {shown !== null && <p>Child value is {shown}</p>}
    </div>
  )
}

function Child({ count, onIncrement }) {
  return <button onClick={onIncrement}>Increase ({count})</button>
}
```

**Approach B: child keeps its state and reports it up through a callback.** The parent passes a function; the child calls it whenever its value changes.

```jsx
function Parent() {
  const latest = useRef(0)
  const [shown, setShown] = useState(null)
  return (
    <div>
      <Child onValueChange={(v) => (latest.current = v)} />
      <button onClick={() => setShown(latest.current)}>Show child value</button>
      {shown !== null && <p>Child value is {shown}</p>}
    </div>
  )
}

function Child({ onValueChange }) {
  const [count, setCount] = useState(0)
  function increase() {
    const next = count + 1
    setCount(next)
    onValueChange(next)        // tell the parent
  }
  return <button onClick={increase}>Increase ({count})</button>
}
```

(The rare third option — parent pulls the value with a ref and `useImperativeHandle` — is covered in FE2.) Mention that A is preferred because it keeps one source of truth.

## Prop drilling

**Prop drilling** is passing props through components that don't use them, only to reach a deeply nested child.

```jsx
<App user={user}>
  <Layout user={user}>          // doesn't need user
    <Sidebar user={user}>       // doesn't need user
      <UserMenu user={user} />  // the only one that does
```

Problems: noisy intermediate components, painful refactors (rename a prop → change 5 files), and every intermediate component re-renders when the value changes.

Two or three levels is fine and often clearest. Beyond that, fixes:

1. **Composition** — pass the *element* instead of the data:
   ```jsx
   <Layout sidebar={<Sidebar menu={<UserMenu user={user} />} />} />
   ```
   Intermediate components just render `{sidebar}` / `{children}` without knowing about `user`.
2. **Context** — `createContext` + `useContext` makes a value available to any descendant (theme, current user, locale). Covered in depth in FE2.
3. **State libraries** — Redux Toolkit, Zustand, Jotai for app-wide state with fine-grained subscriptions.
4. **Server-state libraries** — React Query / SWR: any component can call `useQuery(['user'])` and share the cached result.

:::callout tip Don't reach for context first
Context is great for low-frequency, widely-needed values. For everything else, try composition first — it's simpler and doesn't cause wide re-renders.
:::

## Interview questions

:::question
difficulty: easy
companies: Common
### How would you lift state up and why is it necessary?
Move the state from the child components into their nearest common parent, then pass the value down as props and pass setter callbacks for children to request changes. It's necessary when multiple components need to read or change the same data: a single owner prevents copies from drifting out of sync, keeps data flow one-directional and predictable, and lets other values be derived instead of duplicated.
:::

:::question
difficulty: easy
companies: Common
### How do you send data from a parent to a child, and back?
Parent → child via props (including functions and JSX/children). Child → parent by calling a callback prop the parent passed in, e.g. `onChange(value)`. Siblings communicate by lifting state to their common parent. For deeply nested or distant components, use context or a state management library.
:::

:::question
difficulty: easy
companies: Accenture, Common
### What is prop drilling and how do you solve it?
Prop drilling is passing data through several layers of components that don't need it just to reach a deeply nested one. It makes code verbose and brittle and causes unnecessary re-renders of intermediates. Solutions: component composition (pass elements/children so intermediates don't need the data), the Context API for global-ish values (theme, auth, locale), state libraries (Redux Toolkit, Zustand) with selective subscriptions, and server-state caches (React Query). Shallow prop passing is fine — don't over-engineer.
:::

## Challenges

:::challenge
difficulty: easy
### Sync two siblings
Build `ColorPicker` (a list of color buttons) and `Preview` (a box showing the selected color) as siblings. Selecting a color in the picker updates the preview. Neither child may own the selected color.
@@@solution
```jsx
const COLORS = ["teal", "tomato", "gold", "slateblue"]

function ThemeBuilder() {
  const [color, setColor] = useState(COLORS[0])   // lifted to the common parent
  return (
    <>
      <ColorPicker colors={COLORS} selected={color} onSelect={setColor} />
      <Preview color={color} />
    </>
  )
}

function ColorPicker({ colors, selected, onSelect }) {
  return (
    <div role="radiogroup" aria-label="Color">
      {colors.map((c) => (
        <button key={c} role="radio" aria-checked={c === selected}
                style={{ background: c, outline: c === selected ? "3px solid black" : "none" }}
                onClick={() => onSelect(c)}>
          {c}
        </button>
      ))}
    </div>
  )
}

function Preview({ color }) {
  return <div style={{ background: color, height: 80 }}>Preview: {color}</div>
}
```
Both children are stateless; the parent is the single source of truth.
:::

:::challenge
difficulty: medium
### Remove the prop drilling
Refactor so `Page` and `Sidebar` no longer receive `user`:
```jsx
function App() {
  const user = useCurrentUser()
  return <Page user={user} />
}
function Page({ user }) { return <main><Sidebar user={user} /><Content /></main> }
function Sidebar({ user }) { return <aside><Avatar user={user} /></aside> }
function Avatar({ user }) { return <img src={user.photo} alt={user.name} /> }
```
Show both a composition solution and a context solution.
@@@solution
**Composition** — lift the element creation up:
```jsx
function App() {
  const user = useCurrentUser()
  return <Page sidebar={<Sidebar><Avatar user={user} /></Sidebar>} />
}
function Page({ sidebar }) { return <main>{sidebar}<Content /></main> }
function Sidebar({ children }) { return <aside>{children}</aside> }
```

**Context** — make `user` available anywhere below a provider:
```jsx
const UserContext = createContext(null)

function App() {
  const user = useCurrentUser()
  return (
    <UserContext.Provider value={user}>
      <Page />
    </UserContext.Provider>
  )
}
function Page() { return <main><Sidebar /><Content /></main> }
function Sidebar() { return <aside><Avatar /></aside> }
function Avatar() {
  const user = useContext(UserContext)
  return <img src={user.photo} alt={user.name} />
}
```
Composition keeps components decoupled and avoids context re-render fan-out; context is better when many scattered components need the value.
:::

:::quiz
### Two sibling components need the same changing value. Best first move?
- [ ] Duplicate the state in both and sync with useEffect
- [x] Lift the state to their common parent
- [ ] Use a global variable
- [ ] Use localStorage
@@@explain
One owner, passed down via props.
:::

:::quiz
### Which technique avoids prop drilling WITHOUT context?
- [ ] useEffect
- [x] Component composition via children/element props
- [ ] Index keys
- [ ] Fragments
@@@explain
Passing pre-built elements lets intermediates render them without knowing the data.
:::
