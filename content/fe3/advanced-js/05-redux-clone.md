---
title: Build a Redux Clone
summary: Implement createStore, subscribe, combineReducers, applyMiddleware (thunk + logger) and a React binding with useSyncExternalStore — and understand every design decision behind Redux.
minutes: 25
---

## Why build Redux yourself?

"Build a Redux clone from scratch" was asked in a Senior React round in the reference doc, and it's popular because Redux is tiny (the core is ~200 lines) yet it encodes a lot of architecture:

- **Single source of truth** — one state tree.
- **State is read-only** — the only way to change it is to dispatch an **action** (a plain object describing *what happened*).
- **Changes are pure functions** — a **reducer** `(state, action) => newState` with no side effects.
- **Subscriptions** — the store is an observable; the UI re-renders when state changes.
- **Middleware** — a pipeline around `dispatch` for async work, logging, analytics.

If you can build it, you can explain why Redux code looks the way it does — and when you *don't* need it.

```text
         ┌──────────── dispatch(action) ◀──────────── UI event
         ▼
   middleware chain (thunk → logger → ...)
         ▼
   reducer(state, action) ──▶ new state ──▶ notify subscribers ──▶ UI re-renders with selectors
```

## Step 1: createStore

```js
function createStore(reducer, preloadedState, enhancer) {
  if (typeof preloadedState === 'function' && enhancer === undefined) {
    enhancer = preloadedState
    preloadedState = undefined
  }
  if (enhancer) return enhancer(createStore)(reducer, preloadedState)

  let state = preloadedState
  let listeners = new Set()
  let isDispatching = false

  function getState() {
    if (isDispatching) throw new Error('Cannot call getState while reducing')
    return state
  }

  function subscribe(listener) {
    listeners.add(listener)
    let subscribed = true
    return function unsubscribe() {
      if (!subscribed) return
      subscribed = false
      listeners.delete(listener)
    }
  }

  function dispatch(action) {
    if (typeof action !== 'object' || action === null || typeof action.type === 'undefined') {
      throw new Error('Actions must be plain objects with a type')
    }
    if (isDispatching) throw new Error('Reducers may not dispatch actions')
    try {
      isDispatching = true
      state = reducer(state, action)
    } finally {
      isDispatching = false
    }
    ;[...listeners].forEach((l) => l()) // snapshot
    return action
  }

  dispatch({ type: '@@redux/INIT' }) // let reducers return their initial state
  return { getState, dispatch, subscribe }
}
```

Design decisions explained:

- **`@@redux/INIT`**: reducers declare defaults via `state = initialState`. Dispatching a dummy action at creation makes every reducer return its initial slice.
- **No dispatch inside reducers**: reducers must be pure; dispatching would make state transitions re-entrant and unpredictable.
- **Listeners get no arguments**: they call `getState()` themselves. This keeps the API simple and lets bindings compare previous vs next selected values.
- **Snapshot of listeners**: subscribing/unsubscribing during notification doesn't affect the current round.
- **Notify on every dispatch**: Redux does *not* diff. It's the UI binding's job to check whether the slice it cares about changed (by reference). That's why **immutability** matters: `prev !== next` is an O(1) change check.

## Step 2: combineReducers

Large apps split state into slices, each owned by a reducer:

```js
function combineReducers(reducers) {
  const keys = Object.keys(reducers)
  return function combination(state = {}, action) {
    let hasChanged = false
    const next = {}
    for (const key of keys) {
      const prevSlice = state[key]
      const nextSlice = reducers[key](prevSlice, action)
      if (nextSlice === undefined) throw new Error(`Reducer "${key}" returned undefined`)
      next[key] = nextSlice
      hasChanged = hasChanged || nextSlice !== prevSlice
    }
    return hasChanged || keys.length !== Object.keys(state).length ? next : state
  }
}
```

Every action goes to **every** slice reducer; each ignores actions it doesn't care about by returning the same reference. If no slice changed, we return the **same root object**, so `useSelector` comparisons stay cheap and nothing re-renders.

## Step 3: middleware

Middleware wraps `dispatch`. The signature looks scary but each arrow has a purpose:

```js
const logger = (store) => (next) => (action) => {
  console.log('dispatching', action.type)
  const result = next(action)        // call the next middleware (or the real dispatch)
  console.log('next state', store.getState())
  return result
}

const thunk = (store) => (next) => (action) =>
  typeof action === 'function'
    ? action(store.dispatch, store.getState) // run async logic, let it dispatch later
    : next(action)
```

- `store =>` — called once at setup; gives access to `getState` and `dispatch`.
- `next =>` — called once when composing; `next` is the following middleware's dispatch.
- `action =>` — called on every dispatch.

```js
function compose(...fns) {
  if (fns.length === 0) return (x) => x
  return fns.reduce((a, b) => (...args) => a(b(...args)))
}

function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState)
    let dispatch = () => { throw new Error('Dispatching while constructing middleware') }
    const api = { getState: store.getState, dispatch: (...args) => dispatch(...args) }
    const chain = middlewares.map((mw) => mw(api))
    dispatch = compose(...chain)(store.dispatch)
    return { ...store, dispatch }
  }
}
```

Note `api.dispatch` is a **wrapper** that calls the final, fully composed `dispatch`. So when a thunk calls `dispatch(otherThunk)`, it goes through the whole chain again (otherwise nested thunks wouldn't work).

```text
dispatch(action)
   └▶ thunk(action)  ── function? run it : next ──▶ logger(action) ── next ──▶ store.dispatch(action)
```

## Step 4: binding to React

Modern React bindings use `useSyncExternalStore`, which is built for exactly this: subscribing to an external mutable source without **tearing** (different components seeing different versions of the store during a concurrent render).

```jsx
import { createContext, useContext, useSyncExternalStore, useRef, useCallback } from 'react'

const StoreContext = createContext(null)

export function Provider({ store, children }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useSelector(selector, isEqual = Object.is) {
  const store = useContext(StoreContext)
  const lastRef = useRef({ hasValue: false, value: undefined })

  const getSelection = useCallback(() => {
    const next = selector(store.getState())
    const last = lastRef.current
    if (last.hasValue && isEqual(last.value, next)) return last.value // keep reference stable
    lastRef.current = { hasValue: true, value: next }
    return next
  }, [store, selector, isEqual])

  return useSyncExternalStore(store.subscribe, getSelection, getSelection)
}

export const useDispatch = () => useContext(StoreContext).dispatch
```

How re-rendering works (the doc asked "Redux useSelector and how rendering happens"): every dispatch notifies all subscribers. Each `useSelector` runs its selector against the new state and compares with the previous result. **Only if the selected value changed** (by `Object.is` or your equality function) does React re-render that component. That's why:

- Selectors should return **stable references** — `state => state.todos.filter(...)` returns a new array each time and re-renders on *every* dispatch. Memoize with `createSelector` (Reselect) or select primitives.
- Immutable updates make the "did it change?" check a cheap reference comparison.

## Redux Toolkit: what it adds on top

| Pain in classic Redux | RTK solution |
|---|---|
| Action type constants + action creators + switch statements | `createSlice` generates them |
| Immutable update boilerplate (`...spread` 4 levels deep) | Immer: write "mutating" code on a draft, get an immutable result |
| Store setup (thunk, devtools, combineReducers) | `configureStore` with good defaults |
| Data fetching + caching | RTK Query (`createApi`) — cache, dedupe, invalidation tags |
| Accidental mutations | Dev-only immutability and serializability checks |

:::callout tip When not to use Redux
Server state (data from APIs) is usually better in React Query/RTK Query. Local UI state belongs in components. Redux shines for complex client state shared across distant parts of the app with many update paths, where time-travel debugging and an explicit event log pay off.
:::

## Interview questions

:::question
difficulty: medium
companies: Groww
### Why must reducers be pure and state immutable?
- **Predictability:** same `(state, action)` → same result, so behaviour is reproducible, testable and replayable (time-travel debugging, action logs for bug reports).
- **Cheap change detection:** subscribers detect changes with `prev !== next`. If you mutate in place, the reference doesn't change and connected components won't re-render — or worse, memoized selectors return stale results.
- **No hidden side effects:** effects (API calls, timers) belong in middleware/thunks; putting them in reducers breaks replays and SSR.
:::

:::question
difficulty: medium
### Explain the middleware signature `store => next => action => {}`.
It's currying to separate three lifetimes:
1. `store =>` runs once when the middleware is applied — it captures `getState`/`dispatch`.
2. `next =>` runs once when the chain is composed — `next` is the dispatch of the next middleware (or the base `store.dispatch`).
3. `action =>` runs on every dispatch — the actual logic: inspect/transform the action, call `next(action)` to pass it on, or don't (to swallow it), or do something async and dispatch later (thunk).
Composition works like onion layers via `compose(...chain)(store.dispatch)`.
:::

:::question
difficulty: hard
### Why does react-redux use `useSyncExternalStore`?
With concurrent rendering React may pause a render halfway. If the store changes during that pause, components rendered before and after the change would show different store versions — **tearing**. `useSyncExternalStore(subscribe, getSnapshot)` lets React detect that the snapshot changed during render and re-render synchronously for consistency. It also handles subscription timing correctly (no missed updates between render and effect) and supports server snapshots for SSR.
:::

## Challenges

:::challenge
difficulty: hard
companies: Senior React rounds
### Implement createStore and combineReducers
Implement:

- `createStore(reducer, preloadedState?)` returning `{ getState, dispatch, subscribe }`. It must dispatch an init action so reducers produce initial state. `dispatch` returns the action, throws for non-object actions or actions without `type`, and throws if called from inside a reducer. `subscribe` returns an idempotent unsubscribe; listeners are notified after each dispatch (snapshot of listeners at dispatch time).
- `combineReducers(map)` returning a reducer that delegates each key to its reducer and returns the **same state object** when no slice changed.
@@@starter
```js
function createStore(reducer, preloadedState) {
  // your code
}
function combineReducers(reducers) {
  // your code
}
```
@@@tests
```js
const counter = (state = 0, action) => (action.type === 'inc' ? state + 1 : action.type === 'dec' ? state - 1 : state)
const todos = (state = [], action) => (action.type === 'add' ? [...state, action.text] : state)

test('initial state from reducers', () => {
  const store = createStore(combineReducers({ counter, todos }))
  expect(store.getState()).toEqual({ counter: 0, todos: [] })
})

test('preloaded state wins', () => {
  const store = createStore(counter, 10)
  store.dispatch({ type: 'inc' })
  expect(store.getState()).toBe(11)
})

test('subscribe / unsubscribe', () => {
  const store = createStore(counter)
  let calls = 0
  const off = store.subscribe(() => calls++)
  store.dispatch({ type: 'inc' })
  off(); off()
  store.dispatch({ type: 'inc' })
  expect(calls).toBe(1)
  expect(store.getState()).toBe(2)
})

test('combineReducers keeps reference when nothing changes', () => {
  const store = createStore(combineReducers({ counter, todos }))
  const before = store.getState()
  store.dispatch({ type: 'unknown' })
  expect(store.getState() === before).toBe(true)
  store.dispatch({ type: 'add', text: 'x' })
  expect(store.getState() === before).toBe(false)
  expect(store.getState().counter).toBe(0)
})

test('invalid actions and dispatch in reducer throw', () => {
  const store = createStore(counter)
  expect(() => store.dispatch('inc')).toThrow()
  expect(() => store.dispatch({})).toThrow()
  let s
  const bad = (state = 0, action) => { if (action.type === 'go') s.dispatch({ type: 'x' }); return state }
  s = createStore(bad)
  expect(() => s.dispatch({ type: 'go' })).toThrow()
})

test('dispatch returns the action', () => {
  const store = createStore(counter)
  const a = { type: 'inc' }
  expect(store.dispatch(a) === a).toBe(true)
})
```
@@@solution
```js
function createStore(reducer, preloadedState) {
  let state = preloadedState
  const listeners = new Set()
  let isDispatching = false

  const getState = () => state

  function subscribe(listener) {
    // wrap so the same function can be subscribed twice
    const entry = () => listener()
    listeners.add(entry)
    let active = true
    return () => {
      if (!active) return
      active = false
      listeners.delete(entry)
    }
  }

  function dispatch(action) {
    if (typeof action !== 'object' || action === null || Array.isArray(action)) {
      throw new Error('Actions must be plain objects')
    }
    if (action.type === undefined) throw new Error('Actions must have a type')
    if (isDispatching) throw new Error('Reducers may not dispatch actions')
    try {
      isDispatching = true
      state = reducer(state, action)
    } finally {
      isDispatching = false
    }
    for (const l of [...listeners]) l()
    return action
  }

  dispatch({ type: '@@redux/INIT' + Math.random().toString(36).slice(2) })
  return { getState, dispatch, subscribe }
}

function combineReducers(reducers) {
  const keys = Object.keys(reducers)
  return function combination(state = {}, action) {
    let changed = false
    const next = {}
    for (const key of keys) {
      const prev = state[key]
      const slice = reducers[key](prev, action)
      if (slice === undefined) throw new Error(`Reducer "${key}" returned undefined`)
      next[key] = slice
      if (slice !== prev) changed = true
    }
    if (Object.keys(state).length !== keys.length) changed = true
    return changed ? next : state
  }
}
```

- The init action type is randomised (as real Redux does) so no reducer accidentally handles it.
- `try/finally` ensures `isDispatching` resets even if a reducer throws.
- Listeners are iterated over a copy, giving snapshot semantics.
- `combineReducers` tracks whether any slice reference changed; if not, the old root object is returned — this is what keeps `useSelector(state => state)` from re-rendering on unrelated actions.
:::

:::challenge
difficulty: hard
### Implement applyMiddleware with compose, plus thunk
Implement `compose(...fns)`, `applyMiddleware(...middlewares)` (an enhancer: `applyMiddleware(...)(createStore)(reducer)`), and a `thunk` middleware. Middleware has the signature `({ getState, dispatch }) => next => action => any`. Calls to `dispatch` from inside middleware/thunks must go through the full chain. A minimal `createStore` is provided in the starter — keep it.
@@@starter
```js
function createStore(reducer) {
  let state = reducer(undefined, { type: '@@INIT' })
  const listeners = []
  return {
    getState: () => state,
    dispatch(action) { state = reducer(state, action); listeners.forEach((l) => l()); return action },
    subscribe(l) { listeners.push(l); return () => listeners.splice(listeners.indexOf(l), 1) },
  }
}

function compose(...fns) {}
function applyMiddleware(...middlewares) {}
const thunk = null // your middleware
```
@@@tests
```js
const reducer = (state = { n: 0, log: [] }, a) =>
  a.type === 'add' ? { ...state, n: state.n + a.by } : state

test('compose', () => {
  const f = compose((x) => x + 1, (x) => x * 2)
  expect(f(5)).toBe(11)
  expect(compose()(7)).toBe(7)
})

test('middleware order and next', () => {
  const calls = []
  const a = () => (next) => (action) => { calls.push('a>'); const r = next(action); calls.push('<a'); return r }
  const b = () => (next) => (action) => { calls.push('b>'); const r = next(action); calls.push('<b'); return r }
  const store = applyMiddleware(a, b)(createStore)(reducer)
  store.dispatch({ type: 'add', by: 2 })
  expect(calls).toEqual(['a>', 'b>', '<b', '<a'])
  expect(store.getState().n).toBe(2)
})

test('thunk with nested dispatch through chain', async () => {
  const seen = []
  const spy = () => (next) => (action) => { if (typeof action === 'object') seen.push(action.type); return next(action) }
  const store = applyMiddleware(thunk, spy)(createStore)(reducer)
  const addLater = (by) => async (dispatch, getState) => {
    await sleep(5)
    dispatch({ type: 'add', by })
    return getState().n
  }
  const both = () => (dispatch) => Promise.all([dispatch(addLater(1)), dispatch(addLater(2))])
  await store.dispatch(both())
  expect(store.getState().n).toBe(3)
  expect(seen).toEqual(['add', 'add'])
})
```
@@@solution
```js
function createStore(reducer) {
  let state = reducer(undefined, { type: '@@INIT' })
  const listeners = []
  return {
    getState: () => state,
    dispatch(action) { state = reducer(state, action); listeners.forEach((l) => l()); return action },
    subscribe(l) { listeners.push(l); return () => listeners.splice(listeners.indexOf(l), 1) },
  }
}

function compose(...fns) {
  if (fns.length === 0) return (x) => x
  if (fns.length === 1) return fns[0]
  return fns.reduce((a, b) => (...args) => a(b(...args)))
}

function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloaded) => {
    const store = createStore(reducer, preloaded)
    let dispatch = () => {
      throw new Error('Cannot dispatch while constructing middleware')
    }
    const api = {
      getState: store.getState,
      dispatch: (action, ...rest) => dispatch(action, ...rest), // always the final dispatch
    }
    const chain = middlewares.map((mw) => mw(api))
    dispatch = compose(...chain)(store.dispatch)
    return { ...store, dispatch }
  }
}

const thunk = ({ dispatch, getState }) => (next) => (action) =>
  typeof action === 'function' ? action(dispatch, getState) : next(action)
```

- `compose(f, g)(x) === f(g(x))`. With middlewares `[a, b]`, `compose(a, b)(base)` = `a(b(base))`: `a` receives `b`'s dispatch as `next`, and `b` receives the base dispatch — so actions flow a → b → reducer and unwind b → a (onion model).
- `api.dispatch` closes over the variable `dispatch`, which is reassigned to the composed chain after setup. That's why a thunk's `dispatch(otherThunk)` goes through `thunk` again.
- The thunk returns whatever the function returns (often a promise), which lets callers `await store.dispatch(fetchUser())`.
:::

## Quick check

:::quiz
### A component uses `useSelector(s => s.items.filter(i => i.done))`. What happens on unrelated dispatches?
- [ ] Nothing — Redux only notifies relevant components
- [x] It re-renders on every dispatch because `filter` returns a new array
- [ ] It throws an error
- [ ] It re-renders only when `items` changes
@@@explain
`useSelector` compares by reference. A new array every time looks like a change. Memoize with `createSelector` or use `shallowEqual`.
:::

:::quiz
### What does Redux Toolkit use to allow "mutating" syntax in reducers?
- [ ] Proxy-free deep cloning
- [x] Immer, which records changes on a draft and produces a new immutable state
- [ ] Object.freeze
- [ ] Structured clone
@@@explain
Immer wraps state in a Proxy draft; your mutations are recorded and replayed into a new object with structural sharing.
:::
