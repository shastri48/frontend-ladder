---
title: Patterns, Class Lifecycle & Error Boundaries
summary: HOCs, render props vs hooks, the class lifecycle mapped to hooks, and building a robust error-handling system.
minutes: 22
---

## Reusing logic: three generations

### 1. Higher-Order Components (HOCs)

A HOC is a **function that takes a component and returns a new component** with extra props or behaviour.

```jsx
function withAuth(Component) {
  return function WithAuth(props) {
    const user = useUser()
    if (!user) return <Navigate to="/login" />
    return <Component {...props} user={user} />
  }
}
const ProtectedDashboard = withAuth(Dashboard)
```

Famous examples: Redux's `connect()`, React Router v5's `withRouter`, `React.memo` itself.

Problems:
- **Wrapper hell** — `withA(withB(withC(Comp)))` creates deep trees in DevTools.
- **Prop collisions** — two HOCs injecting `data` overwrite each other.
- **Opaque** — it's unclear which HOC provides which prop.
- Must forward refs and hoist statics manually; never create HOCs inside render.

Still useful for cross-cutting concerns applied at module level (auth guards, analytics, feature flags), especially when wrapping third-party components.

### 2. Render props

A component receives a **function as a prop (or child)** and calls it with data:

```jsx
<MouseTracker>
  {({ x, y }) => <Cursor x={x} y={y} />}
</MouseTracker>
```

Explicit about what is shared, but leads to nested "callback pyramids". Still used by headless libraries (Downshift, Formik's `<Field>`), and for components that need to control *what* is rendered (virtualised lists: `renderItem`).

### 3. Hooks

```jsx
const { x, y } = useMousePosition()
```

Flat, composable, no extra components in the tree, no prop collisions. **Hooks replace most HOCs and render props** for sharing logic. Use HOCs/render props when you need to wrap rendering itself.

## Class component lifecycle

You'll still meet class components in legacy codebases and interviews.

```text
MOUNTING        constructor → static getDerivedStateFromProps → render → componentDidMount
UPDATING        getDerivedStateFromProps → shouldComponentUpdate → render
                → getSnapshotBeforeUpdate → componentDidUpdate
UNMOUNTING      componentWillUnmount
ERRORS          static getDerivedStateFromError → componentDidCatch
```

### Mapping to hooks

| Class | Hooks equivalent |
|---|---|
| `constructor` / `this.state` | `useState` / `useReducer` (lazy initialiser) |
| `componentDidMount` | `useEffect(fn, [])` |
| `componentDidUpdate(prevProps)` | `useEffect(fn, [deps])` (use `usePrevious` for prev values) |
| `componentWillUnmount` | cleanup returned from `useEffect` |
| `shouldComponentUpdate` / `PureComponent` | `React.memo` |
| `getSnapshotBeforeUpdate` | `useLayoutEffect` (approximately) |
| `getDerivedStateFromProps` | compute during render / `key` to reset |
| `componentDidCatch`, `getDerivedStateFromError` | **no hook equivalent** — still requires a class |
| instance fields (`this.timer`) | `useRef` |

:::callout info Deprecated lifecycles
`componentWillMount`, `componentWillReceiveProps` and `componentWillUpdate` were renamed `UNSAFE_*` in React 16.3 because they run during the render phase, which async rendering may call multiple times — making side effects there unsafe.
:::

## Error boundaries

Without them, **a JavaScript error during rendering unmounts the entire React tree** (since React 16) — users get a blank page. An error boundary is a class component that catches errors thrown while rendering its children and shows a fallback.

```jsx
class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error } // render phase: switch to fallback UI
  }

  componentDidCatch(error, info) {
    // commit phase: side effects allowed
    reportToSentry(error, { componentStack: info.componentStack })
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return this.props.fallback
        ? this.props.fallback({ error: this.state.error, reset: this.reset })
        : <p role="alert">Something went wrong.</p>
    }
    return this.props.children
  }
}
```

Usage:

```jsx
<ErrorBoundary fallback={({ reset }) => <WidgetError onRetry={reset} />}>
  <RevenueChart />
</ErrorBoundary>
```

### What error boundaries do NOT catch

| Not caught | How to handle |
|---|---|
| Errors in **event handlers** | `try/catch` in the handler, set error state |
| **Async code** (`setTimeout`, promises, `fetch`) | catch and set state — or re-throw during render: `setState(() => { throw err })` |
| **Server-side rendering** errors | framework error handling |
| Errors **in the boundary itself** | a boundary higher up |

:::callout tip Throwing async errors into a boundary
```jsx
const [, setState] = useState()
const showBoundary = err => setState(() => { throw err })
```
Throwing inside a state updater makes the error happen during render, so the nearest boundary catches it. `react-error-boundary`'s `useErrorBoundary().showBoundary` does exactly this.
:::

### Designing a global error-handling system

Good apps layer boundaries by granularity:

```text
<AppErrorBoundary>                 ← last resort: "Something broke, reload" + report
  <Router>
    <RouteErrorBoundary>           ← per page: keeps nav/header alive, retry button
      <Layout>
        <WidgetErrorBoundary>      ← per widget: one failing chart doesn't kill the dashboard
          <RevenueChart/>
```

Plus a parallel path for **API errors**:

1. **HTTP client layer** (fetch wrapper / axios interceptors): normalise errors into a typed `ApiError { status, code, message, retryable }`, handle 401 → refresh token → retry, log with request id.
2. **Data layer** (React Query/RTK Query): retries with backoff for retryable errors; `throwOnError` (or `useErrorBoundary`) to route fatal errors to the nearest boundary; inline error states for recoverable ones.
3. **UI**: toasts for transient action failures, inline messages for form/field errors, boundaries for render crashes.
4. **Global listeners**: `window.addEventListener('error')` and `'unhandledrejection'` to report anything that escaped.
5. **Reset**: boundaries reset on route change (`resetKeys={[location.pathname]}`) or a retry button that also refetches (`QueryErrorResetBoundary`).

:::question
difficulty: medium
### Explain higher-order components (HOCs).
A HOC is a function that takes a component and returns a new enhanced component, e.g. `withAuth(Dashboard)` or Redux's `connect(mapState)(Component)`. It's a pattern for reusing cross-cutting logic by wrapping. Downsides: wrapper nesting, prop-name collisions, unclear prop origins, and needing to forward refs/hoist statics. Hooks have largely replaced HOCs for logic reuse, but HOCs remain useful for wrapping components declaratively (auth guards, analytics, feature flags).
:::

:::question
difficulty: medium
companies: Tekion, Accenture
### Explain the React class component lifecycle and how it maps to hooks.
Mounting: `constructor` → `getDerivedStateFromProps` → `render` → `componentDidMount`. Updating: `getDerivedStateFromProps` → `shouldComponentUpdate` → `render` → `getSnapshotBeforeUpdate` → `componentDidUpdate`. Unmounting: `componentWillUnmount`. Errors: `getDerivedStateFromError` and `componentDidCatch`.

Hooks: state → `useState`; did-mount/did-update/will-unmount → `useEffect` with deps and cleanup; `shouldComponentUpdate` → `React.memo`; snapshot-before-update → `useLayoutEffect`; instance variables → `useRef`. Error boundary lifecycles have no hook equivalent.
:::

:::question
difficulty: medium
companies: Groww
### What are error boundaries? Explain the implementation.
Error boundaries are class components that catch JavaScript errors thrown during rendering, in lifecycle methods and constructors of their **child tree**, log them and render a fallback instead of unmounting the whole app. They implement `static getDerivedStateFromError(error)` to update state and render the fallback, and `componentDidCatch(error, info)` for side effects like reporting to Sentry. They don't catch errors in event handlers, async code, SSR or the boundary itself. Place them at app, route and widget levels; libraries like `react-error-boundary` add reset keys and hooks.
:::

:::question
difficulty: hard
companies: Groww, Walmart
### How do you handle errors in React applications?
Layer it:
- **Render errors**: error boundaries at app, route and widget granularity with retry/reset.
- **Event handler & async errors**: `try/catch`, set error state, show inline errors or toasts; route fatal ones into a boundary (`showBoundary`).
- **API errors**: centralised HTTP client that normalises errors, handles auth refresh, retries idempotent requests with exponential backoff, and attaches correlation ids; data layer (React Query) with retry policies and `throwOnError` for fatal cases.
- **Global safety net**: `window.onerror` / `unhandledrejection` handlers.
- **Observability**: report everything (Sentry etc.) with component stacks, user/session context and release version.
- **UX**: meaningful messages, never a blank screen, preserve user input.
:::

:::challenge
difficulty: hard
### Implement a global error boundary system for API & UI failures
Design an `<ErrorBoundary>` that: shows a fallback with a Retry button, resets automatically when `resetKeys` change, reports to a logger, and can be triggered from async code via a hook `useErrorHandler()`.
@@@solution
```jsx
const ErrorCtx = createContext(null)

export class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info)
  }

  componentDidUpdate(prevProps) {
    const { resetKeys = [] } = this.props
    const prev = prevProps.resetKeys ?? []
    if (this.state.error && resetKeys.some((k, i) => !Object.is(k, prev[i]))) {
      this.reset()
    }
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (error) {
      const Fallback = this.props.FallbackComponent ?? DefaultFallback
      return <Fallback error={error} resetErrorBoundary={this.reset} />
    }
    return this.props.children
  }
}

function DefaultFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Something went wrong: {error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  )
}

// Route async errors into the nearest boundary
export function useErrorHandler() {
  const [, setState] = useState()
  return useCallback(err => setState(() => { throw err }), [])
}
```

Usage:
```jsx
<ErrorBoundary
  resetKeys={[location.pathname]}
  onError={(e, info) => logger.error(e, info.componentStack)}
  onReset={() => queryClient.resetQueries()}
>
  <Routes>...</Routes>
</ErrorBoundary>

function SaveButton() {
  const handleError = useErrorHandler()
  return <button onClick={() => api.save().catch(handleError)}>Save</button>
}
```
Talk through: layered placement (app/route/widget), API client normalisation + 401 refresh, retries for idempotent requests, toasts for recoverable errors, `unhandledrejection` listener, and reporting with release + user context.
:::

:::challenge
difficulty: medium
### Will this error boundary catch the error?
```jsx
function BuyButton() {
  return <button onClick={() => { throw new Error('boom') }}>Buy</button>
}
<ErrorBoundary><BuyButton /></ErrorBoundary>
```
@@@solution
**No.** The error is thrown inside an **event handler**, which runs outside React's render phase. Error boundaries only catch errors during rendering, lifecycle methods and constructors of descendants. The error propagates to `window.onerror` and the UI stays as is.

Fix: catch it in the handler and set state, or forward it into the boundary:
```jsx
const handleError = useErrorHandler() // setState(() => { throw err })
<button onClick={() => { try { buy() } catch (e) { handleError(e) } }}>Buy</button>
```
:::

:::quiz
### Which of these can be implemented with a hook today?
- [ ] componentDidCatch
- [x] componentWillUnmount
- [ ] getDerivedStateFromError
@@@explain
Cleanup functions from useEffect replace componentWillUnmount. Error boundaries still need class components.
:::

:::quiz
### An uncaught render error with no error boundary in React 18 results in…
- [ ] Only the failing component disappearing
- [x] The whole React tree being unmounted
- [ ] A yellow warning box in production
@@@explain
Since React 16, leaving corrupted UI was deemed worse than removing it, so the root unmounts.
:::
