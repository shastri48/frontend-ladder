---
title: Redux, Redux Toolkit & useSelector
summary: The Redux data flow, middleware, how useSelector decides to re-render, and modern Redux Toolkit with RTK Query.
minutes: 24
---

## The Redux mental model

Redux is a **predictable state container**: one store holds the global state, and the only way to change it is to **dispatch an action** that a **pure reducer** turns into new state.

```text
         ┌──────────── UI ◄────────────────────┐
         │ dispatch({type:'cart/added', ...})   │ subscribers re-render
         ▼                                      │
   middleware (thunk, logger, ...)              │
         ▼                                      │
   reducer(state, action) → newState ───► store ┘
```

Three principles:
1. **Single source of truth** — one store.
2. **State is read-only** — changes happen only through actions (plain objects describing *what happened*).
3. **Changes are made with pure functions** — reducers: `(state, action) => newState`, no side effects, no mutation.

Benefits: predictable updates, **time-travel debugging** (Redux DevTools replays actions), easy logging/undo, testable reducers, a clear place for cross-cutting logic (middleware).

## Redux from scratch (what's really inside)

```js
function createStore(reducer, preloadedState) {
  let state = preloadedState
  let listeners = []
  function getState() { return state }
  function subscribe(listener) {
    listeners.push(listener)
    return () => { listeners = listeners.filter(l => l !== listener) }
  }
  function dispatch(action) {
    state = reducer(state, action)
    listeners.forEach(l => l())
    return action
  }
  dispatch({ type: '@@INIT' })
  return { getState, subscribe, dispatch }
}
```

That's the whole core: ~20 lines. Building a Redux clone (with `combineReducers` and `applyMiddleware`) is an FE3 challenge in **Advanced JS Challenges**.

## Middleware

Middleware wraps `dispatch` to intercept actions — the place for async logic, logging, analytics:

```js
const logger = store => next => action => {
  console.log('dispatching', action)
  const result = next(action)
  console.log('next state', store.getState())
  return result
}

// redux-thunk in its entirety:
const thunk = store => next => action =>
  typeof action === 'function' ? action(store.dispatch, store.getState) : next(action)
```

## Connecting to React: useSelector and useDispatch

```jsx
function CartBadge() {
  const count = useSelector(state => state.cart.items.length)
  return <span>{count}</span>
}
function AddButton({ product }) {
  const dispatch = useDispatch()
  return <button onClick={() => dispatch(added(product))}>Add</button>
}
```

### How useSelector triggers renders

1. The component **subscribes** to the store (via `useSyncExternalStore` in React-Redux v8+).
2. After **every** dispatched action, React-Redux runs your selector with the new state.
3. It compares the new result with the previous result using **strict reference equality (`===`)** by default.
4. If different → the component re-renders. If same → nothing happens.

Consequences:

```jsx
// ❌ returns a new array every time → re-renders after EVERY action in the app
const done = useSelector(s => s.todos.filter(t => t.done))

// ✅ options
const doneCount = useSelector(s => s.todos.filter(t => t.done).length) // primitive
const selectDone = createSelector([s => s.todos], todos => todos.filter(t => t.done)) // memoised (reselect)
const done2 = useSelector(selectDone)
const { a, b } = useSelector(s => ({ a: s.a, b: s.b }), shallowEqual) // shallow compare
```

Because the selector runs on every action, keep it cheap — or memoise it with `createSelector`. Subscribing narrowly is what makes Redux scale better than a single Context.

## Redux Toolkit (RTK) — the modern way

Classic Redux needed lots of boilerplate: action type constants, action creators, switch statements, immutable spreads, manual store setup with thunk and DevTools. **Redux Toolkit** is the official, recommended way to write Redux.

```js
// features/cart/cartSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

export const checkout = createAsyncThunk('cart/checkout', async (_, { getState, rejectWithValue }) => {
  try { return await api.checkout(getState().cart.items) }
  catch (e) { return rejectWithValue(e.message) }
})

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], status: 'idle', error: null },
  reducers: {
    added(state, action) {
      state.items.push(action.payload) // "mutation" is safe: Immer produces an immutable update
    },
    removed(state, action) {
      state.items = state.items.filter(i => i.id !== action.payload)
    },
  },
  extraReducers: builder => {
    builder
      .addCase(checkout.pending, state => { state.status = 'loading' })
      .addCase(checkout.fulfilled, state => { state.status = 'idle'; state.items = [] })
      .addCase(checkout.rejected, (state, action) => { state.status = 'error'; state.error = action.payload })
  },
})

export const { added, removed } = cartSlice.actions
export default cartSlice.reducer
```

```js
// app/store.js
import { configureStore } from '@reduxjs/toolkit'
import cart from '../features/cart/cartSlice'
import { api } from '../services/api'

export const store = configureStore({
  reducer: { cart, [api.reducerPath]: api.reducer },
  middleware: getDefault => getDefault().concat(api.middleware),
})
```

```jsx
// main.jsx
<Provider store={store}><App /></Provider>
```

`configureStore` automatically adds thunk, Redux DevTools, and dev-only checks for accidental mutation and non-serialisable values.

### RTK Query — server state inside Redux

```js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Todo'],
  endpoints: build => ({
    getTodos: build.query({ query: () => 'todos', providesTags: ['Todo'] }),
    addTodo: build.mutation({
      query: body => ({ url: 'todos', method: 'POST', body }),
      invalidatesTags: ['Todo'], // refetch the list automatically
    }),
  }),
})
export const { useGetTodosQuery, useAddTodoMutation } = api

// component
const { data, isLoading, error } = useGetTodosQuery()
```

It handles caching, request deduplication, loading/error state, polling, refetch on focus and cache invalidation — no hand-written thunks for data fetching.

## Redux vs Redux Toolkit

| | Classic Redux | Redux Toolkit |
|---|---|---|
| Boilerplate | Action types, creators, switch reducers | `createSlice` generates actions + reducer |
| Immutability | Manual spreads | Immer — write "mutating" code |
| Store setup | `createStore` + `applyMiddleware` + DevTools enhancer | `configureStore` with good defaults |
| Async | Add `redux-thunk`/saga yourself | `createAsyncThunk` built in |
| Data fetching | Hand-rolled | RTK Query |
| Safety checks | None | Mutation & serialisability checks in dev |
| Status | Legacy (`createStore` deprecated) | Official recommended approach |

:::question
difficulty: medium
companies: Groww
### Explain the implementation of Redux Toolkit.
Create slices with `createSlice({ name, initialState, reducers })` — it generates action creators and a reducer, and uses Immer so reducers can "mutate" a draft safely. Combine slices in `configureStore({ reducer: {...} })`, which sets up thunk, DevTools and dev checks. Wrap the app in `<Provider store={store}>`. Read state with `useSelector(selector)`, dispatch with `useDispatch()`. Async logic uses `createAsyncThunk` (pending/fulfilled/rejected handled in `extraReducers`), and server data is best handled by RTK Query's `createApi`, which generates hooks with caching and invalidation.
:::

:::question
difficulty: medium
companies: Groww
### What is the difference between Redux and Redux Toolkit?
Redux is the core library and pattern (store, actions, reducers, middleware). Redux Toolkit is the official opinionated toolset on top of it that removes boilerplate: `createSlice` (auto-generated actions and reducers with Immer), `configureStore` (thunk + DevTools + safety checks by default), `createAsyncThunk`, `createEntityAdapter` and RTK Query for data fetching and caching. Same underlying Redux, far less code and fewer mistakes. Plain `createStore` is now deprecated in favour of RTK.
:::

:::question
difficulty: hard
companies: Razorpay
### How does useSelector decide when to re-render a component?
React-Redux subscribes the component to the store. After every dispatched action, it re-runs the selector with the latest state and compares the result to the previous one with `===` (or a custom equality function like `shallowEqual`). Only if the result changed does the component re-render. Therefore selectors returning new objects/arrays each time (`filter`, `map`, object literals) cause re-renders on every action; fix with primitive results, memoised selectors (`createSelector`) or `shallowEqual`. Since it uses `useSyncExternalStore`, it's safe from tearing in concurrent rendering.
:::

:::question
difficulty: medium
### What is middleware in Redux?
Middleware is a function chain that wraps `dispatch`: `store => next => action => ...`. Each middleware can inspect, modify, delay, dispatch extra actions or swallow an action before passing it to `next`. It's where side effects live: async (thunk, saga, listener middleware), logging, analytics, crash reporting, and RTK Query's cache management.
:::

:::challenge
difficulty: medium
### Why does this component re-render on every action?
```jsx
function UserList() {
  const admins = useSelector(state => state.users.filter(u => u.role === 'admin'))
  return admins.map(u => <User key={u.id} user={u} />)
}
```
Fix it in two different ways.
@@@solution
`filter` returns a **new array** on every call. After any action anywhere in the app, the selector reruns, returns a new reference, `===` fails and the component re-renders.

**Fix 1 — memoised selector:**
```js
const selectUsers = state => state.users
const selectAdmins = createSelector([selectUsers], users => users.filter(u => u.role === 'admin'))
const admins = useSelector(selectAdmins) // same array until state.users changes
```

**Fix 2 — select stable data and derive with useMemo:**
```js
const users = useSelector(state => state.users)
const admins = useMemo(() => users.filter(u => u.role === 'admin'), [users])
```
(`shallowEqual` also works here since the array items are the same objects, but it still runs filter on every action.)
:::

:::challenge
difficulty: medium
### Write a counter slice with RTK
Create a `counter` slice with `increment`, `decrement`, `incrementBy(amount)` and an async `incrementAsync` that waits 500ms. Show store setup and usage in a component.
@@@solution
```js
import { createSlice, createAsyncThunk, configureStore } from '@reduxjs/toolkit'

export const incrementAsync = createAsyncThunk('counter/incrementAsync', async amount => {
  await new Promise(r => setTimeout(r, 500))
  return amount
})

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0, status: 'idle' },
  reducers: {
    increment: s => { s.value += 1 },
    decrement: s => { s.value -= 1 },
    incrementBy: (s, a) => { s.value += a.payload },
  },
  extraReducers: b => {
    b.addCase(incrementAsync.pending, s => { s.status = 'loading' })
     .addCase(incrementAsync.fulfilled, (s, a) => { s.status = 'idle'; s.value += a.payload })
  },
})

export const { increment, decrement, incrementBy } = counterSlice.actions
export const store = configureStore({ reducer: { counter: counterSlice.reducer } })
```
```jsx
function Counter() {
  const value = useSelector(s => s.counter.value)
  const loading = useSelector(s => s.counter.status === 'loading')
  const dispatch = useDispatch()
  return (
    <div>
      <button onClick={() => dispatch(decrement())}>-</button>
      {value}
      <button onClick={() => dispatch(increment())}>+</button>
      <button disabled={loading} onClick={() => dispatch(incrementAsync(5))}>+5 later</button>
    </div>
  )
}
```
:::

:::quiz
### By default, useSelector compares selector results using…
- [ ] Deep equality
- [ ] Shallow equality
- [x] Strict reference equality (===)
@@@explain
Pass shallowEqual as the second argument to opt into shallow comparison.
:::

:::quiz
### Why can RTK reducers write `state.items.push(x)`?
- [ ] RTK disables immutability checks
- [x] Immer records changes to a draft and produces a new immutable state
- [ ] Redux state is mutable by design
@@@explain
createSlice wraps reducers with Immer's produce.
:::
