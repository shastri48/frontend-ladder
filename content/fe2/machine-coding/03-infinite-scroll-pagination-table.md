---
title: Infinite Scroll, Pagination and Data Tables
summary: Loading more on scroll without tanking performance (IntersectionObserver vs scroll + throttle), a reusable pagination component, and a sortable, filterable data table.
minutes: 20
---

## Infinite scroll: the questions behind the question

"How do you load more data on scroll without tanking performance? Throttling, debouncing, state sync — what's your approach?"

Things to get right:

1. **Detecting the bottom** efficiently.
2. **Not firing duplicate requests** while one is in flight.
3. **Knowing when to stop** (`hasMore`).
4. **State sync**: appending pages in order, deduping items, resetting on filter change, aborting stale requests.
5. **Performance** with thousands of items: virtualization, stable keys, memoized rows.
6. **UX & a11y**: loading indicator, error with retry, a "Load more" button fallback, preserving scroll on back navigation, keyboard users can reach the footer.

### Option A: scroll listener + throttle (old way)

```js
const onScroll = throttle(() => {
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300
  if (nearBottom && !loading && hasMore) loadMore()
}, 200)
window.addEventListener('scroll', onScroll, { passive: true })
```

Works, but runs JS on scroll events and reads layout (`offsetHeight`) repeatedly — must be throttled (not debounced: debounce would wait until scrolling *stops*, which feels laggy).

### Option B: IntersectionObserver (preferred)

Put an invisible **sentinel** element after the list. The browser tells you (asynchronously, off the hot path) when it enters the viewport — no scroll handlers, no layout reads.

```js
const io = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) loadMore()
}, { rootMargin: '400px' })   // start loading 400px before the user reaches the end
io.observe(sentinel)
```

:::challenge
difficulty: medium
companies: Impact Analytics, Tekion
### Implement infinite scroll in React
Build `<Feed />` that loads posts from `fetchPosts(cursor)` → `Promise<{ items, nextCursor }>` (`nextCursor` null at the end).
- Load the first page on mount, more when the user nears the bottom.
- Never fire two requests at once; stop at the end.
- Show loading and error-with-retry at the bottom.
- Extract the logic into a reusable `useInfiniteScroll` hook.
@@@hint
Store `loading` and `hasMore` in refs (or read them inside the observer callback via refs) so the observer doesn't see stale values. Re-observe when the sentinel element changes — a callback ref is a neat way.
@@@solution
```jsx
import { memo, useCallback, useEffect, useRef, useState } from 'react'

function useInfiniteList(fetchPage) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(undefined)
  const [status, setStatus] = useState('idle')   // idle | loading | error | done
  const inFlight = useRef(false)

  const loadMore = useCallback(async () => {
    if (inFlight.current || status === 'done') return
    inFlight.current = true
    setStatus('loading')
    try {
      const { items: page, nextCursor } = await fetchPage(cursor)
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id))          // dedupe across pages
        return [...prev, ...page.filter((p) => !seen.has(p.id))]
      })
      setCursor(nextCursor)
      setStatus(nextCursor == null ? 'done' : 'idle')
    } catch {
      setStatus('error')
    } finally {
      inFlight.current = false
    }
  }, [cursor, status, fetchPage])

  return { items, status, loadMore }
}

function useOnVisible(callback, { rootMargin = '400px', enabled = true } = {}) {
  const cbRef = useRef(callback)
  cbRef.current = callback                                // always call the latest callback
  const observer = useRef(null)

  // Callback ref: (re)attach whenever the sentinel node mounts/unmounts
  return useCallback((node) => {
    observer.current?.disconnect()
    if (!node || !enabled) return
    observer.current = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && cbRef.current(),
      { rootMargin }
    )
    observer.current.observe(node)
  }, [rootMargin, enabled])
}

export function Feed({ fetchPosts }) {
  const { items, status, loadMore } = useInfiniteList(fetchPosts)
  const sentinelRef = useOnVisible(loadMore, { enabled: status === 'idle' })

  useEffect(() => { loadMore() }, [])   // first page  (eslint-disable-line react-hooks/exhaustive-deps)

  return (
    <div>
      <ul className="feed">
        {items.map((post) => <PostCard key={post.id} post={post} />)}
      </ul>

      {status === 'idle' && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
      {status === 'loading' && <p role="status">Loading more…</p>}
      {status === 'error' && (
        <p role="alert">Couldn’t load more. <button onClick={loadMore}>Retry</button></p>
      )}
      {status === 'done' && <p>You’re all caught up 🎉</p>}
    </div>
  )
}

const PostCard = memo(function PostCard({ post }) {
  return <li className="card"><h3>{post.title}</h3><p>{post.body}</p></li>
})
```

Why it's robust:
- `inFlight` **ref** blocks duplicate requests synchronously (state updates are async, so a state flag alone can let two calls through).
- The sentinel only renders when `status === 'idle'`; after each page loads it **re-mounts**, so if the page is still short (sentinel still visible), the observer fires again and fills the screen.
- Dedupe by id handles overlapping pages; cursor pagination avoids duplicates when new posts are inserted.
- Error state stops auto-loading (avoids hammering a failing API) and offers retry.
- `memo` rows + stable keys → appending doesn't re-render existing rows.

Scaling further:
- **Virtualize** (react-window / TanStack Virtual) once you have thousands of rows — DOM size, not fetching, becomes the bottleneck.
- Keep pages in a cache (React Query `useInfiniteQuery`) so back navigation restores the list and scroll position.
- Cap memory: drop far-away pages and re-fetch if the user scrolls back.
- Reset (`items=[]`, `cursor=undefined`) and abort when filters change.
- Offer a "Load more" button for accessibility and for footers users need to reach.
:::

## Pagination component

:::challenge
difficulty: medium
companies: Razorpay
### Build a reusable Pagination component
`<Pagination page={5} totalPages={20} onChange={fn} siblingCount={1} />` renders: Prev, first page, ellipsis, siblings around current, ellipsis, last page, Next. E.g. page 5 of 20 → `‹ 1 … 4 5 6 … 20 ›`. Write the range logic as a pure function and make it accessible.
@@@solution
```jsx
export function getPageRange(page, totalPages, siblingCount = 1) {
  const totalSlots = siblingCount * 2 + 5          // first, last, current, 2 ellipses, siblings
  if (totalPages <= totalSlots) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const left = Math.max(page - siblingCount, 1)
  const right = Math.min(page + siblingCount, totalPages)
  const showLeftDots = left > 3
  const showRightDots = right < totalPages - 2
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

  if (!showLeftDots && showRightDots) {
    return [...range(1, 3 + 2 * siblingCount), '…', totalPages]
  }
  if (showLeftDots && !showRightDots) {
    return [1, '…', ...range(totalPages - (2 + 2 * siblingCount), totalPages)]
  }
  return [1, '…', ...range(left, right), '…', totalPages]
}

export function Pagination({ page, totalPages, onChange, siblingCount = 1 }) {
  if (totalPages <= 1) return null
  const pages = getPageRange(page, totalPages, siblingCount)
  return (
    <nav aria-label="Pagination">
      <ul className="pagination">
        <li>
          <button onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
        </li>
        {pages.map((p, i) =>
          p === '…' ? (
            <li key={`dots-${i}`} aria-hidden="true">…</li>
          ) : (
            <li key={p}>
              <button
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={p === page ? 'active' : undefined}
              >
                {p}
              </button>
            </li>
          )
        )}
        <li>
          <button onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Next page">›</button>
        </li>
      </ul>
    </nav>
  )
}
```

`getPageRange(5, 20)` → `[1, '…', 4, 5, 6, '…', 20]`; `getPageRange(2, 20)` → `[1, 2, 3, 4, 5, '…', 20]`; `getPageRange(3, 5)` → `[1, 2, 3, 4, 5]`.

Points: the range logic is **pure** (unit-testable) and separate from rendering; the component is **controlled** (`page` + `onChange`) so the parent can sync with the URL (`?page=5`), which makes pages shareable and back-button friendly. Constant item count (no jumping widths). `aria-current="page"` marks the current page. Follow-ups: page-size selector, "Go to page" input, keyboard shortcuts, server vs client pagination, cursor pagination doesn't support page numbers.
:::

## Data table with sort and filter

:::challenge
difficulty: medium
### Sortable, filterable data table
Build `<DataTable rows={users} columns={columns} />`:
- Click a header to sort (asc → desc → none); numbers and strings sort correctly.
- A global text filter across columns; per-page pagination (10 rows).
- Keep the original data untouched; derive everything.
@@@solution
```jsx
import { useMemo, useState } from 'react'

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'age', label: 'Age', numeric: true },
  { key: 'city', label: 'City' },
]

export function DataTable({ rows, columns, pageSize = 10 }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: null, dir: null })   // dir: 'asc' | 'desc' | null
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => columns.some((c) => String(r[c.key]).toLowerCase().includes(q)))
  }, [rows, columns, query])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const col = columns.find((c) => c.key === sort.key)
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {              // copy — never mutate props
      const x = a[sort.key], y = b[sort.key]
      const cmp = col.numeric ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })
      return cmp * factor
    })
  }, [filtered, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, totalPages)
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize)

  const toggleSort = (key) =>
    setSort((s) =>
      s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: null }
    )

  return (
    <div>
      <input
        type="search"
        aria-label="Filter rows"
        placeholder="Filter…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(1) }}
      />
      <table>
        <thead>
          <tr>
            {columns.map((c) => {
              const dir = sort.key === c.key ? sort.dir : null
              return (
                <th key={c.key} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
                  <button onClick={() => toggleSort(c.key)}>
                    {c.label} {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {visible.length ? (
            visible.map((r) => (
              <tr key={r.id}>{columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
            ))
          ) : (
            <tr><td colSpan={columns.length}>No matching rows</td></tr>
          )}
        </tbody>
      </table>
      <Pagination page={current} totalPages={totalPages} onChange={setPage} />
    </div>
  )
}
```
Key ideas: **derived state** chain `rows → filtered → sorted → visible` with `useMemo`; minimal state (query, sort, page); reset page on filter change; `localeCompare` with `numeric` for natural string sort; `aria-sort` on headers. For 100k rows: debounce/defer the filter (`useDeferredValue`), virtualize rows, or move sorting/filtering server-side. For real-time updates (Walmart question: "large data tables with real-time updates") batch incoming updates per frame, update rows by id in a normalized map, and memoize rows so only changed rows re-render.
:::

## Interview questions

:::question
difficulty: medium
### Throttle or debounce for infinite scroll — and why IntersectionObserver is better?
**Throttle** — you want periodic checks *during* scrolling; debounce would only check after scrolling stops, so loading starts late. But both still run JS on the main thread and read layout. **IntersectionObserver** is better: the browser computes intersections asynchronously and calls you only when the sentinel crosses the threshold, with no layout thrashing; `rootMargin` lets you prefetch early.
:::

:::question
difficulty: medium
### How would you build infinite scrolling at scale?
Cursor-based API; IntersectionObserver sentinel with `rootMargin` prefetch; in-flight guard and `hasMore`; dedupe by id; cache pages (React Query `useInfiniteQuery`) for back navigation; **virtualize** the list so DOM size stays constant; memoized rows with stable keys; image lazy-loading with fixed aspect ratios (no CLS); evict far-off pages to bound memory; error/retry and a "Load more" fallback; restore scroll position; and a "new items" pill for live feeds instead of shifting content.
:::

## Quick check

:::quiz
### Why use a ref (not only state) to block duplicate loadMore calls?
- [ ] Refs are faster to read
- [x] Ref updates are synchronous; state updates apply on the next render, so two quick calls could both see loading=false
- [ ] State can't hold booleans
- [ ] IntersectionObserver requires refs
@@@explain
A ref acts as an immediate lock between two calls in the same tick.
:::

:::quiz
### What's wrong with `rows.sort(...)` directly inside a component?
- [ ] sort is slow
- [x] It mutates the props array in place
- [ ] It doesn't work on objects
- [ ] React forbids sort
@@@explain
Array.prototype.sort mutates. Copy first (`[...rows].sort`) or use `toSorted`.
:::
