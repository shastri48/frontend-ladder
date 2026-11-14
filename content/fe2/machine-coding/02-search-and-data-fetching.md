---
title: Live Search, useFetch and Chained API Calls
summary: Debounced live search with filtering and stale-response protection, a reusable useFetch hook with cancellation, and the Coinbase-style four-step React task.
minutes: 20
---

## The three bugs every search box has

A naive search box looks like this:

```jsx
<input onChange={(e) => fetch(`/api/search?q=${e.target.value}`).then(r => r.json()).then(setResults)} />
```

It has three classic bugs:

1. **Too many requests** — typing "react" fires 5 requests. → **debounce**.
2. **Race condition / stale responses** — the user types "React" then "Redux". The "Redux" request finishes first, then the slower "React" response arrives and **overwrites** the newer results. → **cancel** previous requests (AbortController) or **ignore** stale ones.
3. **Setting state after unmount / navigating away** — wasted work and stale results. → **cleanup** in `useEffect`.

Plus UX gaps: no loading/empty/error states, no keyboard support, no highlighting.

## Debounce, briefly

Debounce = "wait until the user stops for N ms, then act once". (Full implementation is in the Polyfills module.)

:::visual debounce-throttle
:::

```jsx
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)          // new keystroke → cancel the pending update
  }, [value, delay])
  return debounced
}
```

## Large datasets

If the data is local (e.g. 50,000 products already loaded):

- Debounce the **filter computation**, or use `useDeferredValue(query)` so typing stays responsive while the filtered list renders at lower priority.
- `useMemo` the filtered result; pre-compute a lowercase search key per item once.
- **Virtualize** the result list.
- For fuzzy search over huge sets, build an index (Fuse.js, FlexSearch) — in a **Web Worker** if indexing is slow.
- If data is remote and huge: server-side search with pagination, limit results (top 10 suggestions), cache queries client-side (a `Map` of query → results).

:::challenge
difficulty: medium
companies: CRED, Flipkart, Uber
### Live search with filters, debounce and no stale results
Build `<ProductSearch />`:
- Text input; results fetched from `GET /api/products?q=…&category=…` (use the fake API below).
- A category `<select>` filter (all / mobile / laptop).
- Debounce typing by 300 ms (category changes apply immediately).
- Show loading, error (with retry) and empty states.
- **Never** show results for an outdated query; cancel in-flight requests.
- Cache results per query+category so going back to a previous query is instant.

```js
// Fake API for the exercise
const DB = [
  { id: 1, name: 'iPhone 16', category: 'mobile' },
  { id: 2, name: 'Pixel 9', category: 'mobile' },
  { id: 3, name: 'MacBook Air', category: 'laptop' },
  { id: 4, name: 'ThinkPad X1', category: 'laptop' },
]
function searchApi(q, category, { signal }) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      resolve(DB.filter((p) =>
        p.name.toLowerCase().includes(q.toLowerCase()) &&
        (category === 'all' || p.category === category)))
    }, 200 + Math.random() * 800)  // random latency → races!
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
  })
}
```
@@@hint
Separate the raw input value (updates every keystroke) from the debounced query (drives fetching). Put the fetch in a `useEffect` keyed on `[debouncedQuery, category]` and abort in its cleanup.
@@@solution
```jsx
import { useEffect, useRef, useState } from 'react'

function useDebounce(value, delay) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

function highlight(text, q) {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return text
  return (
    <>
      {text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}
    </>
  )
}

export function ProductSearch() {
  const [input, setInput] = useState('')
  const [category, setCategory] = useState('all')
  const query = useDebounce(input.trim(), 300)

  const [state, setState] = useState({ status: 'idle', data: [], error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const cache = useRef(new Map())

  useEffect(() => {
    const key = `${query}|${category}`
    if (cache.current.has(key)) {
      setState({ status: 'success', data: cache.current.get(key), error: null })
      return
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, status: 'loading', error: null }))   // keep old data visible while loading

    searchApi(query, category, { signal: controller.signal })
      .then((data) => {
        cache.current.set(key, data)
        setState({ status: 'success', data, error: null })
      })
      .catch((err) => {
        if (err.name === 'AbortError') return            // superseded — ignore
        setState({ status: 'error', data: [], error: err })
      })

    return () => controller.abort()   // query/category changed or unmounted → cancel
  }, [query, category, reloadKey])

  return (
    <div className="search">
      <div className="search__controls">
        <label htmlFor="q" className="sr-only">Search products</label>
        <input
          id="q"
          type="search"
          placeholder="Search products…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
        />
        <label htmlFor="cat" className="sr-only">Category</label>
        <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All</option>
          <option value="mobile">Mobile</option>
          <option value="laptop">Laptop</option>
        </select>
      </div>

      <div aria-live="polite" className="search__status">
        {state.status === 'loading' && 'Searching…'}
        {state.status === 'success' && `${state.data.length} results`}
      </div>

      {state.status === 'error' ? (
        <div role="alert">
          Something went wrong. <button onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
        </div>
      ) : state.status === 'success' && state.data.length === 0 ? (
        <p>No products match “{query}”.</p>
      ) : (
        <ul className={state.status === 'loading' ? 'results results--stale' : 'results'}>
          {state.data.map((p) => (
            <li key={p.id}>{highlight(p.name, query)} <small>{p.category}</small></li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Walkthrough:
- **Two values**: `input` (controlled, instant) and `query` (debounced, drives effects). Category isn't debounced because a select change is a deliberate single action.
- **Race-proof**: each effect run owns an `AbortController`; when deps change, cleanup aborts the old request, and aborted promises are ignored. Even if a slow response arrives, its promise rejected with AbortError — it can't overwrite newer data.
- **Cache** in a ref (doesn't need to trigger renders). For production, React Query gives caching, dedupe, retries and staleness for free (`useQuery({ queryKey: ['products', query, category], queryFn, placeholderData: keepPreviousData })`).
- **UX**: keep previous results visible but dimmed while loading (no flicker), `aria-live` announces counts, an explicit empty state, retry button.
- Edge cases: trim whitespace, encode the query in real URLs (`encodeURIComponent`), minimum length (e.g. ≥2 chars), and IME composition.
- Follow-ups: keyboard navigation of suggestions (combobox pattern: `role="combobox"`, `aria-activedescendant`), sync query to the URL (`?q=`) so it's shareable, infinite scroll of results.
:::

## A reusable useFetch hook

Real interview prompt: "Custom useFetch hook — how do you manage loading, success and error states? Cleanup, cancellation, reusability?"

:::challenge
difficulty: medium
companies: Housing.com
### Implement useFetch(url, options)
Return `{ data, error, status, refetch }` where status is `'idle' | 'loading' | 'success' | 'error'`. Requirements:
- Cancels the request when the component unmounts or `url` changes.
- Never sets state for a stale request.
- `refetch()` re-runs the request.
- Skip fetching when `url` is null (conditional fetching).
- Optional `transform` and in-memory cache with `cacheTime`.
@@@solution
```jsx
import { useCallback, useEffect, useRef, useState } from 'react'

const cache = new Map()   // url → { data, at }

export function useFetch(url, { transform = (x) => x, cacheTime = 0, init } = {}) {
  const [state, setState] = useState(() => {
    const hit = url && cache.get(url)
    return hit && Date.now() - hit.at < cacheTime
      ? { status: 'success', data: hit.data, error: null }
      : { status: url ? 'loading' : 'idle', data: undefined, error: null }
  })
  const [nonce, setNonce] = useState(0)

  // Keep latest transform/init without making them effect dependencies
  const optsRef = useRef({ transform, init })
  optsRef.current = { transform, init }

  useEffect(() => {
    if (!url) { setState({ status: 'idle', data: undefined, error: null }); return }

    const hit = cache.get(url)
    if (nonce === 0 && hit && Date.now() - hit.at < cacheTime) {
      setState({ status: 'success', data: hit.data, error: null })
      return
    }

    const controller = new AbortController()
    setState((s) => ({ ...s, status: 'loading', error: null }))

    ;(async () => {
      try {
        const res = await fetch(url, { ...optsRef.current.init, signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const data = optsRef.current.transform(json)
        if (cacheTime) cache.set(url, { data, at: Date.now() })
        setState({ status: 'success', data, error: null })
      } catch (error) {
        if (error.name === 'AbortError') return
        setState({ status: 'error', data: undefined, error })
      }
    })()

    return () => controller.abort()
  }, [url, nonce, cacheTime])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, refetch, isLoading: state.status === 'loading' }
}
```

Usage:
```jsx
function UserCard({ id }) {
  const { data: user, status, error, refetch } = useFetch(id ? `/api/users/${id}` : null, {
    transform: (u) => ({ ...u, fullName: `${u.first} ${u.last}` }),
    cacheTime: 60_000,
  })
  if (status === 'loading') return <Skeleton />
  if (status === 'error') return <ErrorBox error={error} onRetry={refetch} />
  if (!user) return null
  return <h2>{user.fullName}</h2>
}
```

Design notes:
- **Single state object** keeps status/data/error consistent (no impossible combos); a reducer works too.
- **AbortController in cleanup** = cancellation on unmount/url change, and stale responses can't land.
- `optsRef` avoids the "inline object/function in deps → infinite loop" trap.
- `refetch` via a nonce dependency.
- In React 18 StrictMode (dev), effects run twice on mount — the first request is aborted by cleanup, which is exactly correct behaviour.
- Limits: no request dedupe across components, no background revalidation, no retries — that's why teams adopt **React Query/SWR** in production. Say so in the interview.
:::

## Coinbase's 4-step React phone screen

One task that grows four times in an hour. The point is how cleanly your code absorbs each new requirement.

:::challenge
difficulty: medium
companies: Coinbase
### Render → add via form → fetch → chained call
1. Render a list of assets (`[{ id, symbol, amount }]`) from a constant.
2. Add a form to add an asset (symbol + amount, validated).
3. Replace the constant with `GET /api/assets`.
4. For each asset, call `GET /api/prices/:symbol` (depends on step 3's result) and show its USD value and the portfolio total. Handle loading/error per row.
@@@solution
```jsx
import { useEffect, useMemo, useState } from 'react'

const api = {
  async assets(signal) {
    const r = await fetch('/api/assets', { signal })
    if (!r.ok) throw new Error('Failed to load assets')
    return r.json()
  },
  async price(symbol, signal) {
    const r = await fetch(`/api/prices/${encodeURIComponent(symbol)}`, { signal })
    if (!r.ok) throw new Error(`No price for ${symbol}`)
    return (await r.json()).usd        // { usd: 64000.12 }
  },
}

export function Portfolio() {
  const [assets, setAssets] = useState([])
  const [status, setStatus] = useState('loading')
  const [prices, setPrices] = useState({})        // symbol → { status, value?, error? }

  // Step 3: fetch assets
  useEffect(() => {
    const c = new AbortController()
    api.assets(c.signal)
      .then((a) => { setAssets(a); setStatus('success') })
      .catch((e) => e.name !== 'AbortError' && setStatus('error'))
    return () => c.abort()
  }, [])

  // Step 4: chained calls — prices depend on assets; fetch only missing symbols, in parallel
  const symbols = useMemo(() => [...new Set(assets.map((a) => a.symbol))], [assets])
  useEffect(() => {
    const c = new AbortController()
    const missing = symbols.filter((s) => !prices[s])
    if (!missing.length) return
    setPrices((p) => ({ ...p, ...Object.fromEntries(missing.map((s) => [s, { status: 'loading' }])) }))
    missing.forEach((s) =>
      api.price(s, c.signal)
        .then((value) => setPrices((p) => ({ ...p, [s]: { status: 'success', value } })))
        .catch((e) => e.name !== 'AbortError' &&
          setPrices((p) => ({ ...p, [s]: { status: 'error', error: e.message } })))
    )
    return () => c.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `prices` read only to skip known symbols
  }, [symbols])

  const total = assets.reduce((sum, a) => {
    const p = prices[a.symbol]
    return p?.status === 'success' ? sum + p.value * a.amount : sum
  }, 0)

  // Step 2: add via form
  const addAsset = (asset) => setAssets((prev) => [...prev, { ...asset, id: crypto.randomUUID() }])

  if (status === 'loading') return <p>Loading portfolio…</p>
  if (status === 'error') return <p role="alert">Couldn’t load your assets.</p>

  return (
    <section>
      <AddAssetForm onAdd={addAsset} />
      <table>
        <thead><tr><th>Asset</th><th>Amount</th><th>Value (USD)</th></tr></thead>
        <tbody>
          {assets.map((a) => {
            const p = prices[a.symbol]
            return (
              <tr key={a.id}>
                <td>{a.symbol}</td>
                <td>{a.amount}</td>
                <td>
                  {!p || p.status === 'loading' ? '…'
                    : p.status === 'error' ? <span title={p.error}>—</span>
                    : (p.value * a.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p><strong>Total:</strong> {total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
    </section>
  )
}

function AddAssetForm({ onAdd }) {
  const [symbol, setSymbol] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    const n = Number(amount)
    if (!/^[A-Z]{2,6}$/.test(symbol)) return setError('Symbol must be 2–6 capital letters')
    if (!Number.isFinite(n) || n <= 0) return setError('Amount must be a positive number')
    onAdd({ symbol, amount: n })
    setSymbol(''); setAmount(''); setError('')
  }

  return (
    <form onSubmit={submit} noValidate>
      <label>Symbol <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} /></label>
      <label>Amount <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <button type="submit">Add</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

Discussion points interviewers grade:
- **Chained** (dependent) requests: prices wait for assets, but individual price calls run **in parallel** (not a serial loop with `await` in `for`).
- Per-row status — one failed price doesn't break the table.
- Dedupe symbols; don't refetch known prices when an asset is added.
- Money: floats lose precision (`0.1 + 0.2`). For real financial amounts use integer minor units or `BigInt`/a decimal library, and format with `Intl.NumberFormat`.
- `Promise.all` vs `Promise.allSettled`: with `all`, one rejection fails everything; `allSettled` gives per-item results — matches our per-row UX.
- Extensibility: extracting `api`, `AddAssetForm`, and per-row `PriceCell` made each step a small diff.
:::

## Quick check

:::quiz
### The user types "React" then quickly "Redux". Which approach guarantees "React" results never overwrite "Redux"?
- [ ] Debouncing by 300 ms
- [x] Aborting/ignoring the previous request when the query changes
- [ ] Using async/await instead of then
- [ ] Wrapping setResults in useCallback
@@@explain
Debounce reduces requests but doesn't eliminate races — two requests can still be in flight. Cancellation or a latest-request check does.
:::

:::quiz
### Why is `fetch` commonly placed inside `useEffect`?
- [ ] Hooks can't be async otherwise
- [x] Fetching is a side effect that must run after render and be cleaned up when deps change or on unmount
- [ ] useEffect makes fetch faster
- [ ] React forbids fetch in event handlers
@@@explain
Render must be pure; effects synchronize with external systems and provide cleanup. (User-triggered fetches belong in event handlers; framework loaders/React Query are often better than raw effects.)
:::
