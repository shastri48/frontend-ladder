---
title: Choosing & Designing State Architecture
summary: Context vs Redux vs Zustand vs MobX vs Recoil, useSyncExternalStore, and redesigning tangled state in a multi-team app.
minutes: 20
---

## The landscape

| Tool | Model | Re-render granularity | Boilerplate | Great for |
|---|---|---|---|---|
| `useState`/`useReducer` | Local | Component | None | Most UI state |
| Context | Dependency injection of a value | All consumers on any change | Low | Theme, locale, auth user, DI of services |
| Redux Toolkit | Single store, actions, reducers | Selector-based | Medium | Large apps, complex workflows, many teams, DevTools/time-travel |
| Zustand | Small hook-based store | Selector-based | Very low | Global client state without ceremony |
| Jotai / Recoil | Atoms (bottom-up graph) | Per atom | Low | Fine-grained derived state, many independent pieces |
| MobX | Observable objects, auto-tracking | Per observed field | Low | OOP-style domain models, highly reactive UIs |
| TanStack Query / RTK Query / SWR | Server-state cache | Per query | Low | Anything fetched from an API |
| URL | Router search params | Route consumers | Low | Filters, pagination, shareable views |

:::callout info Recoil status
Recoil (by Meta) is no longer actively maintained (archived in 2025). Jotai offers the same atom model and is the usual recommendation.
:::

## Context vs Redux — the classic question

They solve **different problems**:

- **Context** is a *transport*: it makes a value available to a subtree without props. It has no opinion on how that value is updated and **no selective subscription** — every consumer re-renders when the value changes.
- **Redux** is a *state management architecture*: centralised store, predictable updates through actions, middleware for side effects, selectors for fine-grained subscriptions, DevTools with time-travel, and a strong convention for large teams.

Use **Context** when: values change rarely (theme, locale, current user, feature flags), or you're injecting dependencies (an API client, a store instance).

Use **Redux (RTK)** / Zustand when: global state changes frequently, many components subscribe to different slices, update logic is complex, multiple teams need conventions and debugging tools, or you need middleware (undo, sync, analytics).

And for server data: **neither** — use a server-state library.

## Zustand in 10 lines

```js
import { create } from 'zustand'

export const useCart = create((set, get) => ({
  items: [],
  add: item => set(s => ({ items: [...s.items, item] })),
  remove: id => set(s => ({ items: s.items.filter(i => i.id !== id) })),
  total: () => get().items.reduce((t, i) => t + i.price, 0),
}))

// component subscribes only to what it selects
const count = useCart(s => s.items.length)
const add = useCart(s => s.add)
```

No provider needed; selectors give fine-grained re-renders.

## How external stores plug into React: useSyncExternalStore

```js
function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    getState: () => state,
    setState: fn => { state = fn(state); listeners.forEach(l => l()) },
    subscribe: l => { listeners.add(l); return () => listeners.delete(l) },
  }
}

const store = createStore({ count: 0, user: null })

function useStore(selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}

const count = useStore(s => s.count) // re-renders only when count changes
```

`useSyncExternalStore` (React 18) is how Redux, Zustand and others subscribe safely under concurrent rendering, avoiding **tearing** (different components showing different versions of the store in the same render). Note: the selector must return a stable value (primitive or memoised) or it will loop.

## Redesigning tangled state

> Your application uses Redux, Context API and local state, creating synchronisation bugs. How would you redesign state management?

Typical symptoms: the same user object in Redux **and** in a Context **and** copied into local state; effects that sync one copy to another; stale data after mutations; components showing different values.

A step-by-step approach:

1. **Inventory**: list every piece of state, where it lives, who writes it, who reads it.
2. **Classify** each item: server state, global client state, local UI state, URL state, form state, derived state.
3. **Assign one owner per item** (single source of truth):
   - Server state → TanStack Query / RTK Query. Delete hand-written Redux "entities + loading flags" and Context copies. Mutations invalidate queries.
   - Global client state (theme, sidebar, cart draft) → one store (RTK or Zustand) with selectors, or small contexts if low-frequency.
   - URL state (filters, page, tab) → search params; read them, don't copy them into Redux.
   - Local UI state → colocated `useState`.
   - Derived state → selectors / computed in render. Never stored.
4. **Remove sync effects** (`useEffect(() => setLocal(reduxValue), [reduxValue])`) — they're the bugs.
5. **Define module boundaries for teams**: each feature owns its slice and exposes selectors/hooks (`useCartCount()`), not raw store shape. Lint rule: no cross-feature reaching into internals.
6. **Migrate incrementally** behind those hooks — consumers don't change when the implementation moves from Context to a query.
7. **Guard with tests and DevTools**: reducer/selector tests, integration tests with MSW.

:::callout interview What interviewers listen for
Classification of state types, "single source of truth", "derive don't sync", server state ≠ client state, fine-grained subscriptions, team-level conventions and an incremental migration plan — not "I'd use library X".
:::

## Managing global state with multiple teams

- **Feature slices** with clear owners (`features/payments/state`), registered into the root store (RTK supports `combineSlices` / lazy injection for code-split features).
- **Public API per slice** — hooks and selectors exported from an index; actions named as events (`payments/refundRequested`).
- **Normalised data** (`createEntityAdapter`) to avoid duplicates and inconsistent copies.
- **Conventions documented** and enforced by lint rules and code review.
- **Avoid a global dumping ground**: most state shouldn't be global.
- In micro-frontends, prefer each app owning its state and communicating via events or a thin shared contract, not one shared store.

:::question
difficulty: medium
companies: Accenture, Walmart
### Difference between Context API and Redux — when would you use each?
Context is a built-in way to pass a value through the tree without props; every consumer re-renders when the value changes, and it doesn't prescribe how state is updated. Redux is a full state architecture: a single store, actions and pure reducers, middleware for async/side effects, selector-based subscriptions so only affected components re-render, and powerful DevTools. Use Context for low-frequency global values and dependency injection (theme, locale, auth user). Use Redux Toolkit (or Zustand) for complex, frequently-updated, widely-shared client state in larger apps and teams. Use TanStack/RTK Query for server data.
:::

:::question
difficulty: medium
companies: Accenture
### Explain state management approaches in React.
Local state (`useState`/`useReducer`) for component-specific data; lifting state to a common parent for siblings; Context for app-wide, rarely-changing values; external stores (Redux Toolkit, Zustand, Jotai, MobX) for complex or frequently-updated global client state with selective subscriptions; server-state libraries (TanStack Query, RTK Query, SWR, Apollo) for API data with caching; the URL for shareable state like filters; form libraries for form state. Pick per kind of state, keep a single source of truth and derive rather than duplicate.
:::

:::question
difficulty: hard
companies: Walmart
### How would you manage global state efficiently in a React app with multiple teams contributing?
Minimise global state first (server state in a query cache, UI state colocated, URL state in the router). For remaining global client state use one store with feature-owned slices, each exposing a public API of hooks/selectors and event-named actions; normalise entities; use memoised selectors for fine-grained re-renders; lazily inject slices for code-split features; enforce boundaries with lint rules and code owners; document conventions; use DevTools and tests. In micro-frontend setups, avoid a shared mutable store — communicate through events and contracts.
:::

:::question
difficulty: hard
### What is tearing and how does useSyncExternalStore prevent it?
With concurrent rendering, React can pause a render midway. If an external store changes during that pause, components rendered before and after the change would show different values in the same commit — "tearing". `useSyncExternalStore(subscribe, getSnapshot)` lets React read a consistent snapshot and, if the store changed during render, re-render synchronously so the UI is consistent. That's why state libraries adopted it in React 18.
:::

:::challenge
difficulty: hard
### Implement a tiny Zustand-like createStore
Write `createStore(initializer)` returning `{ getState, setState, subscribe }`, where `initializer(set, get)` returns the initial state with actions, `setState` accepts an object or updater function and shallow-merges, and listeners receive `(state, prevState)`.
@@@starter
```js
function createStore(initializer) {
  // your code
}
```
@@@tests
```js
test('initial state and actions', () => {
  const store = createStore((set) => ({ count: 0, inc: () => set(s => ({ count: s.count + 1 })) }))
  store.getState().inc()
  store.getState().inc()
  expect(store.getState().count).toBe(2)
})
test('subscribe receives state and prev, unsubscribe works', () => {
  const store = createStore(() => ({ a: 1, b: 2 }))
  const calls = []
  const unsub = store.subscribe((s, prev) => calls.push([s.a, prev.a]))
  store.setState({ a: 5 })
  unsub()
  store.setState({ a: 9 })
  expect(calls).toEqual([[5, 1]])
  expect(store.getState().b).toBe(2)
})
test('no notification when nothing changes', () => {
  const store = createStore(() => ({ a: 1 }))
  let n = 0
  store.subscribe(() => n++)
  store.setState(s => s)
  expect(n).toBe(0)
})
```
@@@solution
```js
function createStore(initializer) {
  let state
  const listeners = new Set()

  const getState = () => state
  const setState = partial => {
    const next = typeof partial === 'function' ? partial(state) : partial
    if (Object.is(next, state)) return
    const prev = state
    state = { ...state, ...next }
    listeners.forEach(l => l(state, prev))
  }
  const subscribe = listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  state = initializer(setState, getState)
  return { getState, setState, subscribe }
}
```
Hook it into React with `useSyncExternalStore(store.subscribe, () => selector(store.getState()))`. A `Set` avoids duplicate listeners and makes unsubscribe O(1).
:::

:::quiz
### Which is the best home for "current page number and filters" on a product listing?
- [ ] Redux
- [ ] Context
- [x] The URL search params
@@@explain
It makes the view shareable, bookmarkable and back-button friendly; read it from the router rather than copying it.
:::

:::quiz
### Main reason to avoid storing server data in Redux by hand?
- [ ] Redux can't hold arrays
- [x] You end up re-implementing caching, dedupe, invalidation and refetching
- [ ] It's not serialisable
@@@explain
Server-state libraries solve these problems out of the box.
:::
