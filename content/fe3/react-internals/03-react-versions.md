---
title: React 16 → 17 → 18 → 19 — What Changed and Why
summary: Fiber, hooks, the new JSX transform, concurrent React, automatic batching, transitions, Actions, use() and the React Compiler.
minutes: 20
---

## The timeline at a glance

```text
2017  React 16    Fiber reconciler, fragments, portals, error boundaries
2018  16.3–16.6   new context API, forwardRef, React.memo, lazy + Suspense (code splitting)
2019  16.8        HOOKS
2020  React 17    "no new features": gradual upgrades, new JSX transform, event delegation to root
2022  React 18    concurrent rendering, createRoot, automatic batching, transitions, Suspense SSR streaming
2024  React 19    Actions, useActionState, useOptimistic, use(), ref as prop, Server Components stable, metadata
2025  Compiler    React Compiler 1.0: automatic memoisation
```

## React 16 — the Fiber rewrite

- **Fiber** reconciler: incremental rendering foundation (see Fiber lesson).
- **Return arrays/strings/fragments** from render.
- **Portals**: `createPortal(child, domNode)` renders outside the parent DOM (modals, tooltips) while keeping React event bubbling through the React tree.
- **Error boundaries**: `componentDidCatch`; uncaught errors now unmount the tree.
- 16.3: new **Context API** (`createContext`), `getDerivedStateFromProps`, `UNSAFE_` lifecycles, `createRef`, `forwardRef`, StrictMode.
- 16.6: `React.memo`, `React.lazy`, `<Suspense>` for code splitting, `static contextType`.
- 16.8: **Hooks**.

## React 17 — the stepping stone

- **No new developer-facing features** — designed to make upgrading gradual (multiple React versions on one page).
- **Event delegation moved** from `document` to the **root container** — makes nesting React apps and micro-frontends safer, and `e.stopPropagation()` interacts correctly with non-React handlers.
- **Event pooling removed** — you can read `e.target` asynchronously.
- **New JSX transform** — `react/jsx-runtime`; no need to `import React` in every file.
- Effect cleanup timing: `useEffect` cleanups run asynchronously.

## React 18 — concurrent React

The big one. Concurrency is **opt-in per update**, enabled by the new root API.

```jsx
// before
ReactDOM.render(<App />, container)
// React 18
import { createRoot } from 'react-dom/client'
createRoot(container).render(<App />)
// SSR hydration
hydrateRoot(container, <App />)
```

| Feature | What it does |
|---|---|
| `createRoot` | Enables concurrent features; legacy `render` keeps 17 behaviour |
| **Automatic batching** | Batches updates in timeouts, promises, native events |
| `startTransition` / `useTransition` | Mark updates as non-urgent and interruptible; `isPending` flag |
| `useDeferredValue` | Render a lagging copy of a value at low priority |
| **Suspense improvements** | Works with transitions (keeps old UI instead of fallback), SSR support |
| **Streaming SSR** | `renderToPipeableStream` / `renderToReadableStream` stream HTML with Suspense boundaries |
| **Selective hydration** | Hydrate parts independently; prioritise what the user interacts with |
| `useId` | Stable unique ids that match between server and client (a11y attributes) |
| `useSyncExternalStore` | Tear-free subscriptions for external stores |
| `useInsertionEffect` | For CSS-in-JS libraries to inject styles before layout |
| StrictMode | Dev double-mount (mount → unmount → mount) to surface effect bugs |

:::callout info Concurrent rendering is an implementation detail
There's no "concurrent mode" flag anymore. React renders concurrently **only for updates you mark** (transitions, deferred values, Suspense). Everything else behaves synchronously like before — which is why most apps upgraded with almost no changes.
:::

## React 19 — Actions and the server

- **Actions**: pass async functions to transitions and `<form action={fn}>`. React manages pending state, errors and optimistic updates.
- **`useActionState(action, initial)`**: returns `[state, dispatchAction, isPending]` for form submissions.
- **`useFormStatus()`**: child components read the parent form's pending status (e.g. a submit button).
- **`useOptimistic(state, updateFn)`**: show the expected result immediately; React reverts if the action fails.
- **`use(resource)`**: read a promise (suspends until resolved) or a context — and it **can be called conditionally**.
- **`ref` as a prop** for function components; `forwardRef` no longer needed. Ref callbacks can return a cleanup.
- **`<Context>` as provider** (`<ThemeContext value="dark">`).
- **Document metadata**: `<title>`, `<meta>`, `<link>` rendered anywhere are hoisted to `<head>`.
- **Resource APIs**: `preload`, `preinit`, stylesheet precedence, async script dedupe.
- **Server Components & Server Actions** stable (framework-level: Next.js App Router).
- Better hydration error messages; `propTypes` and string refs removed; legacy context removed.

```jsx
function UpdateName() {
  const [error, submitAction, isPending] = useActionState(async (prev, formData) => {
    const err = await updateName(formData.get('name'))
    return err ?? null
  }, null)

  return (
    <form action={submitAction}>
      <input name="name" />
      <button disabled={isPending}>Update</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

## React Compiler

A build-time Babel/SWC plugin that analyses components and **auto-memoises** values, callbacks and JSX, making most manual `useMemo`/`useCallback`/`memo` unnecessary. It requires components to follow the Rules of React (pure render, no mutation of props/state, hooks rules); it skips components it can't prove safe. Lint with `eslint-plugin-react-compiler`.

## Migrating from 16/17 to 18

1. Upgrade `react` and `react-dom`; replace `ReactDOM.render` → `createRoot`, `hydrate` → `hydrateRoot`.
2. Check code relying on **non-batched** updates (reading DOM after setState in a timeout) → `flushSync` if needed.
3. Turn on **StrictMode** and fix effects without cleanup.
4. Upgrade state libraries to versions using `useSyncExternalStore`.
5. Then adopt transitions/Suspense incrementally where they help.

:::question
difficulty: hard
companies: Groww
### What is the difference between React 16 and React 18?
React 16 introduced the Fiber reconciler, fragments, portals, error boundaries, the new context API, `memo`/`lazy`, and (16.8) hooks — but rendering was still effectively synchronous. React 18 builds on Fiber to ship **concurrent rendering**: the `createRoot` API, **automatic batching** everywhere, **transitions** (`startTransition`, `useTransition`) and `useDeferredValue` for interruptible low-priority updates, Suspense that works with transitions and on the server, **streaming SSR** with **selective hydration**, and new hooks `useId`, `useSyncExternalStore`, `useInsertionEffect`. StrictMode also double-mounts components in dev to catch unsafe effects. (17 in between changed event delegation to the root and added the new JSX transform.)
:::

:::question
difficulty: medium
### What are the key features of React 19?
Actions (async functions in transitions and `<form action>`), `useActionState`, `useFormStatus`, `useOptimistic`, the `use()` API for promises and context (callable conditionally), `ref` as a regular prop and ref cleanup functions, `<Context>` as a provider, native document metadata and stylesheet/script handling, stable Server Components and Server Actions, improved hydration error reporting, and removal of legacy APIs (propTypes on functions, string refs, legacy context). The React Compiler (separately released) auto-memoises.
:::

:::question
difficulty: medium
### What does useId solve?
Generating ids with a counter or `Math.random()` produces different values on server and client, causing hydration mismatches. `useId()` produces a stable id derived from the component's position in the tree, identical on server and client, for linking labels and ARIA attributes (`htmlFor`, `aria-describedby`). It's not for list keys.
:::

:::challenge
difficulty: medium
### Upgrade this to React 18 and spot the behaviour change
```jsx
ReactDOM.render(<App />, document.getElementById('root'))

function Search() {
  const [q, setQ] = useState('')
  const [count, setCount] = useState(0)
  useEffect(() => {
    const el = document.getElementById('box')
    el.addEventListener('input', e => {
      setQ(e.target.value)
      console.log(document.getElementById('preview').textContent)
      setCount(c => c + 1)
    })
  }, [])
  return (<><input id="box" /><p id="preview">{q}</p></>)
}
```
@@@solution
```jsx
import { createRoot } from 'react-dom/client'
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
```
Behaviour changes:
1. **Batching**: in React 17 the native listener's `setQ` rendered synchronously, so the `console.log` printed the **new** text. In React 18 the updates are batched and rendered later → it logs the **old** text. If that matters, wrap in `flushSync(() => setQ(...))` — or better, don't read the DOM; use `e.target.value`.
2. **StrictMode double-mount** would add the listener **twice** (no cleanup) → two counts per input. Fix:
```jsx
useEffect(() => {
  const el = document.getElementById('box')
  const onInput = e => { setQ(e.target.value); setCount(c => c + 1) }
  el.addEventListener('input', onInput)
  return () => el.removeEventListener('input', onInput)
}, [])
```
(And idiomatically, use `onChange` on the input instead of a native listener.)
:::

:::quiz
### Which React version moved event delegation from document to the root container?
- [ ] 16
- [x] 17
- [ ] 18
@@@explain
React 17 attaches listeners to the root, enabling multiple React versions to coexist.
:::

:::quiz
### Which React 19 API can be called inside an if statement?
- [ ] useState
- [ ] useEffect
- [x] use
@@@explain
use() reads promises/context and is exempt from the top-level rule.
:::
