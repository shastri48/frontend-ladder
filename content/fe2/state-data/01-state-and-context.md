---
title: Where State Lives — Lifting, Prop Drilling & Context
summary: Kinds of state, lifting state up, prop drilling, and implementing Context correctly without re-render storms.
minutes: 20
---

## Not all state is the same

The first question for any piece of state is **"what kind is it?"** — the answer decides where it lives.

| Kind | Examples | Best home |
|---|---|---|
| **Local UI state** | input text, open/closed, hover, current tab | `useState` in the component |
| **Shared UI state** | selected item used by list + detail panel | lifted to nearest common parent |
| **Global client state** | theme, locale, auth user, cart, feature flags | Context (low-frequency) or a store (Redux, Zustand) |
| **Server state** | users, products, orders — data owned by the backend | TanStack Query / RTK Query / SWR cache |
| **URL state** | filters, page, search query, selected tab | the URL (`useSearchParams`) |
| **Form state** | field values, touched, errors | form library or local state |
| **Derived state** | filtered list, totals, fullName | **compute during render** — never store |

:::callout tip The golden rule
Keep state **as close as possible** to where it's used, and **don't duplicate** it. Most "state management problems" are actually server state mistakenly stored in a global client store, or derived state stored instead of computed.
:::

## Lifting state up

When two siblings need the same data, move the state to their **closest common parent** and pass it down as props, with callbacks to change it. That gives one **source of truth**.

```jsx
function TemperatureConverter() {
  const [celsius, setCelsius] = useState(0)          // single source of truth
  const fahrenheit = celsius * 9 / 5 + 32            // derived, not stored
  return (
    <>
      <TempInput label="°C" value={celsius} onChange={setCelsius} />
      <TempInput label="°F" value={fahrenheit} onChange={f => setCelsius((f - 32) * 5 / 9)} />
    </>
  )
}

function TempInput({ label, value, onChange }) {
  return <label>{label}<input type="number" value={value} onChange={e => onChange(+e.target.value)} /></label>
}
```

Why necessary? If each input kept its own state, they'd drift out of sync and you'd need effects to copy values back and forth — the classic source of bugs. Data flows **down** via props; changes flow **up** via callbacks (*one-way data flow*).

Parent-to-child communication is props. Child-to-parent is calling a function the parent passed as a prop.

## Prop drilling

Lifting too high causes **prop drilling**: passing props through components that don't use them, just to reach a deep descendant.

```text
App (user) → Layout (user) → Sidebar (user) → Menu (user) → Avatar (user)   ← only Avatar needs it
```

Problems: noisy intermediate components, painful refactors, accidental re-renders of everything in the chain.

Solutions, roughly in order:

1. **Component composition** — pass the *rendered* thing instead of the data: `<Layout sidebar={<Sidebar avatar={<Avatar user={user}/>} />} />`. Intermediate components just place `children`/slots.
2. **Context** — for values many components at different depths need.
3. **External store** — for complex, frequently-updated global state with selectors.

## Context API — implementation done right

```jsx
// auth-context.jsx
const AuthStateContext = createContext(null)
const AuthActionsContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  // actions never change identity → consumers of actions never re-render because of user changes
  const actions = useMemo(() => ({
    login: async creds => setUser(await api.login(creds)),
    logout: async () => { await api.logout(); setUser(null) },
  }), [])

  return (
    <AuthActionsContext.Provider value={actions}>
      <AuthStateContext.Provider value={user}>
        {children}
      </AuthStateContext.Provider>
    </AuthActionsContext.Provider>
  )
}

export function useAuthUser() {
  const ctx = useContext(AuthStateContext)
  return ctx
}
export function useAuthActions() {
  const ctx = useContext(AuthActionsContext)
  if (!ctx) throw new Error('useAuthActions must be used inside <AuthProvider>')
  return ctx
}
```

Patterns used here:

- **Custom hook per context** — hides `useContext`, gives a helpful error outside the provider.
- **Split state and actions** — a `LogoutButton` that only needs `logout` won't re-render when `user` changes.
- **Memoised value** — no new object per render.
- **Provider wraps `children`** — elements passed as children aren't re-created when the provider's state changes, so only consumers re-render.

### Context pitfalls

1. **Unmemoised object value**: `<Ctx.Provider value={{ user, setUser }}>` creates a new object every render → every consumer re-renders whenever the provider's parent renders.
2. **One mega-context**: `AppContext` with user, theme, cart, notifications → updating notifications re-renders every theme consumer. Split by domain and update frequency.
3. **No selectors**: a consumer re-renders on *any* change to the value, even fields it doesn't read. You can't subscribe to `ctx.cart.count` only (without `use-context-selector` or a store).
4. **High-frequency updates** (mouse position, form keystrokes, live prices) through context cause re-render storms — use a store or local state.
5. **`memo` doesn't help** — `React.memo` components still re-render when a context they consume changes.

:::callout info Context is a transport, not a state manager
Context just makes a value available to a subtree. The state itself still lives in `useState`/`useReducer`. Context + `useReducer` gives you a mini-Redux, without middleware, DevTools or selectors.
:::

:::question
difficulty: easy
companies: Accenture
### How would you lift state up and why is it necessary?
Move the state to the closest common ancestor of the components that need it, pass the value down as props and pass setter callbacks for children to request changes. It's necessary to keep a **single source of truth**: if siblings kept separate copies they'd go out of sync and you'd need fragile effects to synchronise them. It also enables one-way data flow, which makes data changes predictable and debuggable.
:::

:::question
difficulty: easy
companies: Accenture
### What is prop drilling, and how do you solve it?
Prop drilling is passing props through intermediate components that don't use them just to reach deeply nested children. It makes components noisy, coupling them to data they don't care about, and hurts refactoring. Solutions: component composition (pass rendered elements/children instead of raw data), Context for widely-needed low-frequency values (theme, user, locale), or an external store (Redux, Zustand) with selectors for complex global state.
:::

:::question
difficulty: easy
### How do you send data from parent to child, and from child to parent?
Parent → child: **props**. Child → parent: the parent passes a **callback function** as a prop and the child calls it with data (`onSelect(id)`). Between siblings: lift state to the common parent. Across distant components: context or a store. Parent calling child imperatively: refs + `useImperativeHandle` (rarely).
:::

:::question
difficulty: medium
companies: Groww
### Explain the implementation of the Context API.
1. `const Ctx = createContext(defaultValue)`.
2. Wrap a subtree with `<Ctx.Provider value={value}>` — the value usually comes from `useState`/`useReducer` in a provider component.
3. Consume with `useContext(Ctx)` in any descendant; it reads the nearest provider's value and subscribes.
4. Expose it via a custom hook (`useAuth()`) that throws if used outside the provider.

Best practices: memoise the value object, split state and dispatch/actions into separate contexts, split unrelated domains into separate providers, and avoid high-frequency updates through context because every consumer re-renders on any change (there are no selectors).
:::

:::question
difficulty: medium
### What is the difference between props and state?
**Props** are inputs passed from a parent — read-only for the receiving component, like function arguments. **State** is data a component owns and can change over time with a setter, triggering re-renders. A value is often state in one component and props in its children. If a value can be computed from props or other state, it's neither — compute it during render.
:::

:::challenge
difficulty: medium
### Fix the re-render storm
```jsx
const AppContext = createContext()
function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('light')
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = e => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  return <AppContext.Provider value={{ user, setUser, theme, setTheme, cursor }}>{children}</AppContext.Provider>
}
```
Every component using `useContext(AppContext)` re-renders on every mouse move. Redesign it.
@@@solution
Problems: one context mixes slow-changing (user, theme) and very fast-changing (cursor) data; the value is a new object each render; consumers can't select fields.

```jsx
const UserContext = createContext(null)
const ThemeContext = createContext(null)

function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('light')
  const userValue = useMemo(() => ({ user, setUser }), [user])
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme])
  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
    </UserContext.Provider>
  )
}

// cursor moves to a hook used only where needed (or a store with selectors)
function useCursor() {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = e => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  return pos
}
```
Now theme consumers re-render only on theme changes, and mouse tracking re-renders only the component that needs it. If many components need the cursor, use a store (`useSyncExternalStore`/Zustand) with selectors and throttle via `requestAnimationFrame`.
:::

:::quiz
### A component wrapped in React.memo consumes a context whose value changes. Does it re-render?
- [x] Yes
- [ ] No, memo prevents it
@@@explain
memo only compares props; context changes always re-render consumers.
:::

:::quiz
### Where should a "filtered list" derived from `items` and `query` live?
- [ ] In its own useState, updated by an effect
- [x] Computed during render (optionally memoised)
- [ ] In Context
@@@explain
Derived state stored separately can go stale; compute it from the source of truth.
:::
