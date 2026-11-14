---
title: Race Conditions & Stale Closures
summary: The five async bugs every React app hits — stale responses, duplicate requests, out-of-order mutations, unmount during async, stale intervals — and how to fix each.
minutes: 24
---

## Why async + React = subtle bugs

React renders are **snapshots**: each render has its own props, state and the functions that close over them. Async work started in one render may **finish in the future**, when the snapshot it captured is outdated. Two families of bugs follow:

1. **Race conditions** — multiple async operations complete in an unexpected order.
2. **Stale closures** — a callback keeps reading values from the render where it was created.

## Scenario 1 — Search API race (stale responses)

> User types "React", then "Redux". The Redux request finishes first, but the React response arrives later and overwrites the results.

```text
t=0   type "React"   → request A ─────────────────────► (slow) arrives t=900 ✗ overwrites!
t=200 type "Redux"   → request B ─────► arrives t=500 ✓ shows Redux results
```

### Fix A: ignore stale results (effect cleanup flag)

```jsx
useEffect(() => {
  if (!query) return
  let active = true
  search(query).then(results => { if (active) setResults(results) })
  return () => { active = false } // runs when query changes → previous request is ignored
}, [query])
```

### Fix B: actually cancel with AbortController

```jsx
useEffect(() => {
  if (!query) return
  const controller = new AbortController()
  fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
    .then(r => r.json())
    .then(setResults)
    .catch(e => { if (e.name !== 'AbortError') setError(e) })
  return () => controller.abort()
}, [query])
```

Abort saves bandwidth and server work, and the promise rejects with `AbortError` so no stale `setResults` can run.

### Fix C: request id / sequence number (outside effects)

```js
let latestId = 0
async function onSearch(q) {
  const id = ++latestId
  const data = await search(q)
  if (id === latestId) setResults(data) // only the newest request may write
}
```

Combine with **debouncing** (fewer requests) — but debouncing alone does **not** fix races: a slow earlier request can still land after a later one. Libraries (TanStack Query) solve it by keying results by `queryKey` — "React" results are stored under `['search','React']` and never shown for "Redux".

## Scenario 2 — Duplicate requests on mount/unmount/remount

> A component mounts, triggers an API call, is unmounted and mounted again. How do you prevent unnecessary requests and handle cleanup?

Causes: StrictMode's dev double-mount, tabs/route switches, conditional rendering, two components needing the same data.

Fixes:
- **Abort in cleanup** so the first request doesn't waste resources or set state.
- **Dedupe in-flight requests by key** — share the same promise (`inflight` map) instead of firing a second request.
- **Cache with a stale time** — the remount reads cached data; refetch only if stale.
- **Lift fetching out of the component** — route loaders or prefetching start the request before render.
- Don't "fix" StrictMode with a `useRef(false)` "has fetched" flag — it hides a real resilience bug; use cleanup + cache instead.

## Scenario 3 — Out-of-order mutations

> A user rapidly changes a setting. Two API updates are sent, but the older request finishes last. How do you keep UI and server state consistent?

```text
toggle ON  → PUT {enabled:true}  ────────────────────► server applies last ✗ (ends ON)
toggle OFF → PUT {enabled:false} ─────► applied first
UI shows OFF, server ends up ON.
```

Strategies:
1. **Serialise mutations per resource** — queue them; send the next only after the previous completes (TanStack Query `scope` for mutations, or your own promise chain).
2. **Coalesce** — debounce the save and send only the latest desired state.
3. **Cancel or ignore earlier requests** — but the server may already have applied them; client-side cancel doesn't undo server effects.
4. **Versioning / optimistic concurrency** — send a version or `If-Match: <ETag>`; the server rejects outdated writes (409/412) and the client refetches.
5. **Make the server authoritative** — after the last mutation settles, refetch (invalidate) and reconcile the UI with the server response.

```js
// serialise per key
const queues = new Map()
function enqueue(key, task) {
  const prev = queues.get(key) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(task)
  queues.set(key, next)
  return next
}
// enqueue('settings', () => api.updateSetting({ enabled }))
```

## Scenario 4 — Unmount during async operations

> User navigates away while an API request is still running.

- Abort the request in effect cleanup (`AbortController`) — frees the network and prevents stale updates.
- For non-cancellable work (third-party SDK promises), use an `ignore` flag.
- Clean up **everything** started: timers, intervals, subscriptions, WebSockets, event listeners, observers.
- React 18 removed the "Can't perform a React state update on an unmounted component" warning because setting state after unmount is a no-op — but the **wasted work** and **logic that runs after** (navigation, toasts, analytics) are still bugs.

## Scenario 5 — Stale closures

> An interval inside useEffect keeps reading the initial state.

```jsx
function Timer() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1) // `count` is captured from the FIRST render: always 0 → stays at 1
    }, 1000)
    return () => clearInterval(id)
  }, []) // effect never re-runs, so the closure is never refreshed
  return <p>{count}</p>
}
```

The interval callback was created during the first render, so its `count` is forever `0`.

### Fix 1: functional update (best when you only need the previous state)

```jsx
setInterval(() => setCount(c => c + 1), 1000)
```

### Fix 2: include the dependency (re-creates the interval each change — okay but resets timing)

```jsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000)
  return () => clearInterval(id)
}, [count])
```

### Fix 3: a ref holding the latest value/callback (when you need fresh props/state inside a long-lived callback)

```jsx
function useInterval(callback, delay) {
  const saved = useRef(callback)
  useLayoutEffect(() => { saved.current = callback }) // always latest
  useEffect(() => {
    if (delay == null) return
    const id = setInterval(() => saved.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

// usage — reads fresh `step` without resetting the interval
useInterval(() => setCount(c => c + step), 1000)
```

| Use | When |
|---|---|
| Functional updater | Next state only depends on previous state |
| Add deps | Re-subscribing is cheap and acceptable |
| Ref to latest | Long-lived subscription must read changing props/state |
| `useReducer` | Many values; `dispatch` is stable and reducer always sees latest state |

Stale closures also appear in event listeners added once (`window.addEventListener` in a `[]` effect), debounced callbacks created with `useMemo(() => debounce(fn), [])`, and WebSocket `onmessage` handlers.

:::visual debounce-throttle
:::

:::question
difficulty: hard
companies: Razorpay, Walmart
### How do you prevent API race conditions in a search box?
Make sure only the response for the latest query can update the UI: abort previous requests with `AbortController` in the effect cleanup (or ignore results via a cleanup flag / incrementing request id), and debounce input to reduce request volume. Better still, key cached results by query (TanStack Query `queryKey: ['search', q]`), so a late response for an old query is stored under its own key and never displayed for the current one. Debouncing alone is not enough — a slow older request can still resolve last.
:::

:::question
difficulty: medium
companies: CRED
### What does a stale closure inside setInterval look like and how do you fix it?
An interval created in `useEffect(..., [])` closes over the state from the first render, so `setCount(count + 1)` always computes `0 + 1`. Fixes: use the functional updater `setCount(c => c + 1)`; add the state to dependencies so the interval is recreated; or store the latest callback/value in a `useRef` (the `useInterval` pattern) so the long-lived interval always calls fresh code. `useReducer`'s stable `dispatch` is another option.
:::

:::question
difficulty: hard
### How do you keep UI and server consistent with rapid, out-of-order mutations?
Client-side cancellation can't undo a write the server already applied, so: serialise mutations per resource (queue), or coalesce/debounce to send only the latest desired state; include a version/ETag so the server rejects stale writes (optimistic concurrency); apply optimistic UI updates with rollback on error; and after mutations settle, invalidate/refetch so the server is the source of truth. TanStack Query's `onMutate`/`onError`/`onSettled` and mutation scopes implement this pattern.
:::

:::question
difficulty: medium
### How do you cancel previous API requests?
Create an `AbortController`, pass `controller.signal` to `fetch` (or axios), and call `controller.abort()` when the request becomes obsolete — in `useEffect` cleanup when dependencies change or the component unmounts, or before starting a new request in an event handler. The aborted fetch rejects with an `AbortError` that you ignore. `AbortSignal.timeout(ms)` adds timeouts and `AbortSignal.any([...])` combines signals. Libraries pass a `signal` to your query function automatically.
:::

:::challenge
difficulty: hard
companies: CRED
### Search bar with debounce, done live — with no stale results
Build a `<SearchBox>` that queries `/api/search?q=` 300ms after typing stops, shows loading, errors and results, cancels in-flight requests when the query changes, and never shows results for an old query.
@@@solution
```jsx
function useDebouncedValue(value, delay) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export function SearchBox() {
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query.trim(), 300)
  const [state, setState] = useState({ status: 'idle', results: [], error: null })

  useEffect(() => {
    if (!debounced) { setState({ status: 'idle', results: [], error: null }); return }
    const controller = new AbortController()
    setState(s => ({ ...s, status: 'loading', error: null }))
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(results => setState({ status: 'success', results, error: null }))
      .catch(error => { if (error.name !== 'AbortError') setState({ status: 'error', results: [], error }) })
    return () => controller.abort() // old query → aborted → can never overwrite
  }, [debounced])

  return (
    <div role="search">
      <label htmlFor="q">Search</label>
      <input id="q" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
      {state.status === 'loading' && <p aria-live="polite">Searching…</p>}
      {state.status === 'error' && <p role="alert">Something went wrong. Try again.</p>}
      {state.status === 'success' && state.results.length === 0 && <p>No results for “{debounced}”.</p>}
      <ul>{state.results.map(r => <li key={r.id}>{r.title}</li>)}</ul>
    </div>
  )
}
```
Edge cases to mention: trim/empty queries, URL encoding, minimum length, caching previous queries (Map) for instant back-spacing, keeping old results visible while loading (less flicker), keyboard navigation of results (combobox ARIA), and that debounce reduces load while abort fixes correctness.
:::

:::challenge
difficulty: medium
### Predict the output: stale closure in a click handler
```jsx
function App() {
  const [count, setCount] = useState(0)
  function handleAlert() {
    setTimeout(() => alert(count), 3000)
  }
  return (<>
    <button onClick={() => setCount(c => c + 1)}>+1</button>
    <button onClick={handleAlert}>Alert</button>
  </>)
}
```
Click "Alert", then click "+1" three times within 3 seconds. What is alerted? How would you alert the latest value?
@@@solution
It alerts **0**. `handleAlert` belongs to the render where `count` was 0; the timeout callback closes over that snapshot. The later renders create new `handleAlert` functions, but the scheduled callback is the old one.

This is usually *correct* behaviour (the alert reflects the state when you clicked). To read the latest value, use a ref:
```jsx
const countRef = useRef(count)
useEffect(() => { countRef.current = count }, [count])
function handleAlert() { setTimeout(() => alert(countRef.current), 3000) } // alerts 3
```
:::

:::quiz
### Does debouncing a search input on its own fix stale-response race conditions?
- [ ] Yes — fewer requests means no races
- [x] No — an earlier slow request can still resolve after a later one
@@@explain
Debounce reduces request count; you still need cancellation, ignore flags or keyed caches for correctness.
:::

:::quiz
### Best fix for `setInterval(() => setCount(count + 1), 1000)` inside `useEffect(..., [])`?
- [x] setCount(c => c + 1)
- [ ] Wrap setCount in useCallback
- [ ] Use useLayoutEffect instead
@@@explain
The functional updater always receives the latest state, so the interval doesn't need fresh closures.
:::
