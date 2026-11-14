---
title: Server State & Data Fetching
summary: Loading, error and retry states, building a useFetch hook with caching and refetch, and why TanStack Query exists.
minutes: 24
---

## Server state is different

Data that lives on the server (users, orders, products) has properties your local state doesn't:

- It's **owned remotely** — your copy is a *cache* that can go stale.
- It's **async** — loading and error states are unavoidable.
- It's **shared** — several components want the same data; they shouldn't each fetch it.
- It **changes without you** — other users, other tabs.

Putting server data into Redux/Context by hand means re-implementing a cache: dedupe, invalidation, refetch, retries, garbage collection, pagination. That's what **server-state libraries** (TanStack Query, SWR, RTK Query, Apollo) do.

## The three states of every request

Every fetch has at least: **loading**, **success**, **error** (plus often idle/empty). Model them explicitly:

```jsx
function Users() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/users', { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`) // fetch doesn't reject on 4xx/5xx!
        return res.json()
      })
      .then(data => setState({ status: 'success', data, error: null }))
      .catch(error => {
        if (error.name === 'AbortError') return
        setState({ status: 'error', data: null, error })
      })
    return () => controller.abort()
  }, [])

  if (state.status === 'loading') return <Skeleton rows={5} />
  if (state.status === 'error') return <ErrorMessage error={state.error} />
  if (state.data.length === 0) return <EmptyState />
  return <ul>{state.data.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}
```

:::callout warn fetch() only rejects on network failure
A 404 or 500 is a *successful* fetch from the Promise's point of view. Always check `res.ok`. Axios, by contrast, rejects on non-2xx statuses.
:::

## Retries with exponential backoff

Transient failures (network blips, 502/503/429) deserve retries; client errors (400, 401, 404) usually don't.

```js
async function fetchWithRetry(url, { retries = 3, baseDelay = 300, signal, ...init } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal })
      if (res.ok) return res
      const retryable = res.status >= 500 || res.status === 429
      if (!retryable || attempt >= retries) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
    } catch (err) {
      if (err.name === 'AbortError' || attempt >= retries || err.status) throw err
    }
    const delay = baseDelay * 2 ** attempt + Math.random() * 100 // backoff + jitter
    await new Promise(r => setTimeout(r, delay))
  }
}
```

- **Exponential backoff** avoids hammering a struggling server; **jitter** avoids thousands of clients retrying in sync (thundering herd).
- Only retry **idempotent** requests automatically (GET, PUT, DELETE). Retrying a POST "create payment" can double-charge — use idempotency keys.
- Respect `Retry-After` headers for 429.

## A custom useFetch hook with caching and refetch

A frequent interview task: "Build a custom hook for data fetching with caching + refetch logic."

```jsx
const cache = new Map()     // key → { data, timestamp }
const inflight = new Map()  // key → Promise (dedupe concurrent requests)

function fetchJSON(url, signal) {
  if (inflight.has(url)) return inflight.get(url)
  const p = fetch(url, { signal })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
    .finally(() => inflight.delete(url))
  inflight.set(url, p)
  return p
}

export function useFetch(url, { staleTime = 30_000, enabled = true } = {}) {
  const cached = cache.get(url)
  const [state, setState] = useState(() => ({
    data: cached?.data,
    error: null,
    status: cached ? 'success' : 'loading',
  }))
  const [version, setVersion] = useState(0)
  const refetch = useCallback(() => setVersion(v => v + 1), [])

  useEffect(() => {
    if (!enabled || !url) return
    const entry = cache.get(url)
    const fresh = entry && Date.now() - entry.timestamp < staleTime
    if (fresh && version === 0) {
      setState({ data: entry.data, error: null, status: 'success' })
      return
    }

    let ignore = false
    // stale-while-revalidate: show cached data while fetching in the background
    setState(s => ({ ...s, data: entry?.data ?? s.data, status: entry ? 'refreshing' : 'loading' }))

    fetchJSON(url)
      .then(data => {
        cache.set(url, { data, timestamp: Date.now() })
        if (!ignore) setState({ data, error: null, status: 'success' })
      })
      .catch(error => { if (!ignore) setState(s => ({ ...s, error, status: 'error' })) })

    return () => { ignore = true }
  }, [url, enabled, staleTime, version])

  return { ...state, isLoading: state.status === 'loading', refetch }
}
```

What this demonstrates:
- **Cache by key** (URL) shared across components.
- **Stale time**: fresh cached data is served without a request.
- **Stale-while-revalidate**: show old data immediately, refresh in the background.
- **In-flight dedupe**: two components mounting together send one request.
- **Race protection** with an `ignore` flag (the latest URL wins).
- **Manual refetch** through a version counter.

Missing pieces a real library adds: cache garbage collection, refetch on window focus / reconnect, retries, pagination/infinite queries, mutations with invalidation and optimistic updates, SSR hydration, DevTools.

## TanStack Query in practice

```jsx
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
})

function useUser(id) {
  return useQuery({
    queryKey: ['user', id],                    // cache key — includes every variable
    queryFn: ({ signal }) => api.getUser(id, { signal }), // signal → auto-cancel
    enabled: !!id,
  })
}

function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.updateUser,
    onSuccess: user => {
      qc.setQueryData(['user', user.id], user)        // update cache directly
      qc.invalidateQueries({ queryKey: ['users'] })   // refetch lists
    },
  })
}
```

Key concepts:

| Concept | Meaning |
|---|---|
| `queryKey` | Identity of the data; changing it fetches/caches separately |
| `staleTime` | How long data is considered fresh (no refetch). Default 0 |
| `gcTime` | How long unused data stays in cache. Default 5 min |
| Refetch triggers | Mount, window focus, reconnect, interval — only when stale |
| `isLoading` vs `isFetching` | First load with no data vs any background fetch |
| Invalidation | Mark data stale and refetch active queries after mutations |
| Optimistic updates | Update the cache before the server confirms; roll back on error |

## fetch vs axios

| | `fetch` | axios |
|---|---|---|
| Availability | Built into browsers & Node 18+ | Library (~13 kB) |
| JSON | `res.json()` manually; `body: JSON.stringify` | Automatic parse & stringify |
| HTTP errors | Resolves on 4xx/5xx — check `res.ok` | Rejects on non-2xx |
| Interceptors | Write a wrapper | Request/response interceptors built in |
| Cancellation | `AbortController` | `AbortController` (old `CancelToken` deprecated) |
| Timeout | `AbortSignal.timeout(ms)` | `timeout` option |
| Upload progress | Not supported (streams only) | `onUploadProgress` (via XHR) |
| Streaming responses | Yes (`res.body` ReadableStream) | Limited in browser |

:::question
difficulty: medium
companies: Accenture
### How do you integrate APIs and manage loading/error states in React?
Keep a single status field (`idle | loading | success | error`) rather than independent booleans, render explicit UI for each (skeletons, error with retry, empty state, data), check `res.ok` since fetch doesn't reject on HTTP errors, cancel with `AbortController` in effect cleanup, and guard against stale responses. In production, use TanStack Query/RTK Query/SWR, which provide `isLoading`, `isError`, `error`, `refetch`, caching, dedupe and retries out of the box, and centralise HTTP concerns (base URL, auth headers, error normalisation) in an API client.
:::

:::question
difficulty: medium
companies: Accenture, Walmart
### How do you handle API errors and retries efficiently?
Normalise errors in one HTTP client layer (status, code, message, retryable). Retry only transient failures (network errors, 5xx, 429) and only idempotent requests, with exponential backoff + jitter and a cap; honour `Retry-After`. Don't retry 4xx validation/auth errors — handle 401 by refreshing the token once then replaying the request. Show user-friendly, actionable messages, keep cached data visible while retrying, provide manual retry, and report failures to monitoring. Use idempotency keys for non-idempotent mutations like payments.
:::

:::question
difficulty: easy
companies: Groww
### What is the difference between fetch and axios?
`fetch` is the native browser/Node API: promise-based, streams, `AbortController` cancellation, but you must parse JSON manually and it doesn't reject on HTTP error statuses. Axios is a library on top of XHR (browser) / http (Node) that auto-transforms JSON, rejects on non-2xx, supports interceptors, timeouts, upload/download progress and base config instances. Choose fetch for zero dependencies and streaming; axios for interceptors and convenience — or wrap fetch in a small client.
:::

:::question
difficulty: medium
### What is the difference between server state and client state?
Client state is owned by the browser (UI toggles, form inputs, theme) and is synchronous and always up to date. Server state is owned by the backend; your copy is a cache that can be stale, shared by many components and modified by others. Server state needs caching, deduplication, background refetching, invalidation after mutations and retry logic — handled best by TanStack Query/RTK Query/SWR rather than Redux or Context.
:::

:::challenge
difficulty: hard
companies: Coinbase
### 4-step React task: render, add, fetch, chained call
Build a component that (1) renders a list of watchlist symbols, (2) lets the user add a symbol through a form, (3) fetches the current price for each symbol from `/api/price?symbol=X`, (4) for a clicked symbol, fetches its company id from `/api/symbol/X` and then the company profile from `/api/company/:id` (chained). Handle loading and errors.
@@@solution
```jsx
function Watchlist() {
  const [symbols, setSymbols] = useState(['BTC', 'ETH'])
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState(null)

  function add(e) {
    e.preventDefault()
    const s = input.trim().toUpperCase()
    if (s && !symbols.includes(s)) setSymbols(prev => [...prev, s])
    setInput('')
  }

  return (
    <div>
      <form onSubmit={add}>
        <label>Symbol <input value={input} onChange={e => setInput(e.target.value)} /></label>
        <button disabled={!input.trim()}>Add</button>
      </form>
      <ul>
        {symbols.map(s => (
          <li key={s}><button onClick={() => setSelected(s)}>{s}</button> <Price symbol={s} /></li>
        ))}
      </ul>
      {selected && <CompanyProfile symbol={selected} />}
    </div>
  )
}

function Price({ symbol }) {
  const { data, error, isLoading } = useAsync(
    signal => getJSON(`/api/price?symbol=${encodeURIComponent(symbol)}`, signal), [symbol])
  if (isLoading) return <span>…</span>
  if (error) return <span role="alert">n/a</span>
  return <span>${data.price}</span>
}

function CompanyProfile({ symbol }) {
  const { data, error, isLoading } = useAsync(async signal => {
    const { companyId } = await getJSON(`/api/symbol/${symbol}`, signal)   // step 1
    return getJSON(`/api/company/${companyId}`, signal)                   // step 2 depends on 1
  }, [symbol])
  if (isLoading) return <p>Loading profile…</p>
  if (error) return <p role="alert">Couldn't load profile: {error.message}</p>
  return <article><h2>{data.name}</h2><p>{data.description}</p></article>
}

async function getJSON(url, signal) {
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

function useAsync(fn, deps) {
  const [state, setState] = useState({ isLoading: true, data: null, error: null })
  useEffect(() => {
    const ctrl = new AbortController()
    setState({ isLoading: true, data: null, error: null })
    fn(ctrl.signal)
      .then(data => setState({ isLoading: false, data, error: null }))
      .catch(error => { if (error.name !== 'AbortError') setState({ isLoading: false, data: null, error }) })
    return () => ctrl.abort()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}
```
Discussion: one `AbortController` cancels **both** chained requests when the user clicks another symbol (no stale profile); a symbol's price component owns its own request; with many symbols, batch prices into one request or a WebSocket and throttle updates; with TanStack Query use `enabled: !!companyId` for the dependent query.
:::

:::challenge
difficulty: medium
companies: Groww
### Write a function to find the frequency of elements in an array
`frequency(['a','b','a','c','b','a'])` → `{ a: 3, b: 2, c: 1 }`.
@@@starter
```js
function frequency(arr) {
  // your code
}
```
@@@tests
```js
test('counts strings', () => {
  expect(frequency(['a','b','a','c','b','a'])).toEqual({ a: 3, b: 2, c: 1 })
})
test('empty array', () => {
  expect(frequency([])).toEqual({})
})
test('numbers', () => {
  expect(frequency([1, 1, 2])).toEqual({ 1: 2, 2: 1 })
})
```
@@@solution
```js
function frequency(arr) {
  return arr.reduce((acc, x) => {
    acc[x] = (acc[x] ?? 0) + 1
    return acc
  }, {})
}
```
O(n) time, O(k) space for k distinct values. For non-string keys (objects, or to distinguish `1` vs `'1'`), use a `Map`:
```js
const freq = arr => arr.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())
```
:::

:::quiz
### fetch('/api') returns a 500. What happens to the promise?
- [x] It resolves; res.ok is false
- [ ] It rejects with an HTTP error
- [ ] It never settles
@@@explain
fetch only rejects for network failures or aborts.
:::

:::quiz
### In TanStack Query, what does staleTime control?
- [ ] How long unused data stays in memory
- [x] How long data is considered fresh before a refetch is triggered
- [ ] Request timeout
@@@explain
gcTime controls memory retention; staleTime controls freshness.
:::
