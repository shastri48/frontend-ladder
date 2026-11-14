---
title: Real-Time Data & Infinite Scrolling at Scale
summary: Rendering live tables and charts from WebSockets without melting the main thread, and building infinite scroll that survives 100k items.
minutes: 20
---

## The real-time problem

"How would you design a highly performant web app that renders large data tables with **real-time updates**?" (Walmart) and "Throttling WebSocket price updates for a chart" (Coinbase) are the same problem: **data arrives faster than humans can see and faster than the browser can render.**

A crypto ticker can push 200 messages/second. If every message calls `setState`, React renders 200 times a second — but the screen only paints 60 times a second, and humans can't read a number that changes more than a few times a second. Everything above that is wasted work that steals main-thread time from scrolling and clicks.

:::callout analogy The newspaper editor
A newsroom receives thousands of wire updates an hour, but the paper is printed once a day. The editor batches the news, keeps only the latest version of each story, and prints. Your UI should be the editor, not a printing press that runs per wire message.
:::

## Pattern: buffer → coalesce → flush per frame

```text
 WebSocket ──msg──msg──msg──msg──msg──msg──▶ buffer (Map: symbol → latest tick)
                                              │
                         requestAnimationFrame / every 250ms
                                              ▼
                                   one setState with a snapshot
                                              ▼
                                   React renders changed rows only
```

```jsx
function useThrottledTicker(url, intervalMs = 250) {
  const [prices, setPrices] = useState(() => new Map())
  const buffer = useRef(new Map())

  useEffect(() => {
    const ws = new WebSocket(url)
    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data)          // { symbol, price, ts }
      buffer.current.set(tick.symbol, tick)    // coalesce: keep only latest per symbol
    }

    const id = setInterval(() => {
      if (buffer.current.size === 0) return
      const updates = buffer.current
      buffer.current = new Map()
      setPrices(prev => {
        const next = new Map(prev)
        for (const [sym, tick] of updates) next.set(sym, tick)
        return next
      })
    }, intervalMs)

    return () => { clearInterval(id); ws.close() }
  }, [url, intervalMs])

  return prices
}
```

Key ideas:

- **Coalesce by key** — 50 updates to BTC in 250 ms collapse into one.
- **Flush on a cadence** — `requestAnimationFrame` (max once per frame) for visual smoothness or a fixed interval (4 Hz is plenty for numbers; charts may use rAF).
- **Keep the raw stream outside React state** (`useRef`, an external store) so incoming messages don't render.
- **Row-level subscriptions** — with an external store + `useSyncExternalStore` and a selector per row, only rows whose price changed re-render.
- **Parse off-thread** if the volume is huge: receive the WebSocket in a **Web Worker**, coalesce there, and `postMessage` a compact snapshot.
- **Update charts imperatively** — most chart libraries (or a canvas) can append a point without a React re-render of the whole chart.
- **Backpressure** — tell the server what you're viewing (subscribe only to visible symbols), and ask for throttled/conflated streams server-side.

```js
// External store with per-key subscriptions
function createTickerStore() {
  const prices = new Map()
  const listeners = new Map() // symbol -> Set<fn>
  return {
    get: (s) => prices.get(s),
    set(batch) {
      for (const [s, t] of batch) {
        prices.set(s, t)
        listeners.get(s)?.forEach(fn => fn())
      }
    },
    subscribe(s, fn) {
      if (!listeners.has(s)) listeners.set(s, new Set())
      listeners.get(s).add(fn)
      return () => listeners.get(s).delete(fn)
    },
  }
}

function PriceCell({ store, symbol }) {
  const tick = useSyncExternalStore(cb => store.subscribe(symbol, cb), () => store.get(symbol))
  return <td className={tick?.dir === 'up' ? 'up' : 'down'}>{tick?.price.toFixed(2)}</td>
}
```

### Rendering the table itself

- **Virtualize** the rows (only ~30 rows mounted).
- **Memoised rows**, stable keys (symbol/ID).
- Flash animations via CSS class toggles using `opacity`/`background-color` — keep them cheap, or use `transform`/`opacity` only.
- Use `font-variant-numeric: tabular-nums` so changing digits don't jitter layout.
- For money, never use floating point arithmetic for totals — use integer minor units or `BigInt`/decimal libraries (Coinbase asked "BigInt vs Number for financial amounts").

### Connection robustness

Reconnect with **exponential backoff + jitter**, heartbeats/ping to detect dead connections, resubscribe after reconnect, sequence numbers to detect gaps (then refetch a snapshot), and pause or reduce subscriptions when `document.visibilityState === 'hidden'`.

## Infinite scrolling at scale

Infinite scroll = paginated fetching triggered by proximity to the end. The naive version (scroll listener + `scrollTop + clientHeight >= scrollHeight`) works for 200 items and falls over at 20,000.

### The building blocks

1. **Trigger with `IntersectionObserver`**, not scroll events — no layout reads on every scroll, fires off the main loop:

```jsx
function useInfiniteLoader(loadMore, { hasMore, isLoading, rootMargin = '600px' }) {
  const sentinelRef = useRef(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isLoading) loadMore()
    }, { rootMargin })                       // prefetch before the user hits the end
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, hasMore, isLoading, rootMargin])
  return sentinelRef
}
```

2. **Cursor-based pagination** for feeds that change (`?after=post_123&limit=20`) instead of offset (`?page=7`). With offsets, new items inserted at the top shift everything and you get duplicates or skipped items. (Reddit asked "cursor vs offset pagination for a moving feed".)
3. **Deduplicate** by ID when merging pages.
4. **Guard concurrent loads** — only one in-flight request; ignore the trigger while loading; abort on unmount.
5. **Virtualize** once the list grows — otherwise you're back to 10k DOM nodes.
6. **Cap memory** — for truly endless feeds, drop pages far above the viewport (and re-fetch if the user scrolls back), or keep data but not DOM.
7. **Preserve scroll position** on back navigation (store the cursor and offset; React Query's `useInfiniteQuery` caches pages).
8. **Accessibility & UX** — a "Load more" button fallback, `aria-busy`/live region announcements, reachable footer (or avoid footers on infinite pages), and a way to share/bookmark position.
9. **Errors** — show an inline retry at the bottom instead of silently stopping.

```jsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['feed'],
  queryFn: ({ pageParam, signal }) => fetchFeed({ cursor: pageParam, signal }),
  initialPageParam: null,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
})
```

| Concern | Offset pagination | Cursor pagination |
|---|---|---|
| Jump to page N | Easy | Hard |
| Stable with inserts/deletes | No (dupes/skips) | Yes |
| DB performance deep in list | `OFFSET 100000` is slow | Index seek, fast |
| Best for | Admin tables with page numbers | Feeds, chats, infinite scroll |

:::question
difficulty: hard
companies: Walmart
### How would you design a highly performant web app that renders large data tables with real-time updates?
- **Data layer**: WebSocket (or SSE) feeding an external store, not React state directly. Coalesce updates by row key and flush on a cadence (rAF or 250 ms). For very high volume, receive and coalesce in a Web Worker.
- **Subscriptions**: server-side subscribe only to visible rows/symbols; resubscribe on scroll; conflated streams.
- **Rendering**: virtualized table, memoised rows with stable keys, per-row subscription via `useSyncExternalStore` selectors so only changed rows re-render; cheap CSS (`tabular-nums`, opacity/transform flashes).
- **Interactions**: sorting/filtering on live data in a worker or on the server; `startTransition` for re-sorts; freeze sorting while the user hovers/edits to avoid rows jumping.
- **Reliability**: reconnect with backoff + jitter, heartbeats, sequence numbers and snapshot recovery, pause when tab hidden.
- **Correctness**: integer/decimal money, timestamps from server.
- **Observability**: monitor dropped frames/INP, message lag (server ts vs client receive).
:::

:::question
difficulty: medium
companies: Reddit
### Cursor vs offset pagination for a moving feed?
Offset pagination (`page=3&size=20`) addresses items by position; when new posts are inserted at the top between requests, positions shift — the next page repeats items (or skips them after deletions), and large offsets are slow for databases. Cursor pagination (`after=<id or timestamp>`) addresses items relative to the last one seen, so it's stable under inserts/deletes and uses an index seek. Use cursors for feeds, chats and infinite scroll; offsets for admin tables where users need "jump to page 37".
:::

:::question
difficulty: medium
companies: Coinbase
### Why shouldn't you use JavaScript `Number` for financial amounts?
`Number` is an IEEE-754 double: decimal fractions like 0.1 can't be represented exactly (`0.1 + 0.2 !== 0.3`), and integers are only exact up to 2^53 − 1. Sums, fees and conversions accumulate rounding errors. Represent money in **integer minor units** (paise/cents) for display-level work, or use **`BigInt`** for large integer quantities (e.g. wei in crypto), or a decimal library (`decimal.js`, `big.js`) for arbitrary precision arithmetic. Format with `Intl.NumberFormat` only at the edges.
:::

:::challenge
difficulty: hard
companies: Coinbase
### Throttle WebSocket price updates for a chart
A WebSocket emits ~300 ticks/second across 50 symbols. The chart shows one symbol; a sidebar shows latest prices for all 50. Today each tick calls `setState` and the page drops to 8 fps. Design and code the fix.
@@@solution
**Design**
1. Keep incoming ticks **outside React**: a `useRef` buffer or an external store.
2. **Coalesce**: sidebar needs only the latest price per symbol (a `Map`); the chart needs all points for **one** symbol, appended in batches.
3. **Flush per frame** with `requestAnimationFrame` (chart) and a slower cadence (e.g. 4 Hz) for sidebar numbers.
4. Update the chart **imperatively** via its API (`series.update(point)`) instead of re-rendering the chart component.
5. Optionally parse/coalesce in a Web Worker if JSON parsing itself is heavy.

```jsx
function useTicks(url, activeSymbol, chartRef) {
  const [latest, setLatest] = useState({})
  const latestBuf = useRef({})
  const chartBuf = useRef([])

  useEffect(() => {
    const ws = new WebSocket(url)
    ws.onmessage = (e) => {
      const t = JSON.parse(e.data)
      latestBuf.current[t.symbol] = t.price
      if (t.symbol === activeSymbol) chartBuf.current.push({ time: t.ts, value: t.price })
    }

    let raf
    const frame = () => {
      if (chartBuf.current.length) {
        const pts = chartBuf.current; chartBuf.current = []
        pts.forEach(p => chartRef.current?.update(p))    // imperative, no React render
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const iv = setInterval(() => {
      const snap = latestBuf.current
      if (Object.keys(snap).length) { latestBuf.current = {}; setLatest(prev => ({ ...prev, ...snap })) }
    }, 250)

    return () => { ws.close(); cancelAnimationFrame(raf); clearInterval(iv) }
  }, [url, activeSymbol, chartRef])

  return latest
}
```
**Result**: ≤ 60 chart updates/s regardless of tick rate, 4 sidebar renders/s, rows memoised so only changed prices re-render. Further: subscribe server-side only to visible symbols; pause when `document.hidden`.
:::

:::challenge
difficulty: medium
companies: Impact Analytics
### Implement infinite scroll in React
Build a feed that loads 20 posts at a time from `fetchPosts(cursor) → { items, nextCursor }`, triggers loading before the user reaches the bottom, never fires duplicate requests, handles errors with retry, and doesn't leak on unmount.
@@@solution
```jsx
import { useState, useRef, useEffect, useCallback } from 'react'

export function Feed() {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [status, setStatus] = useState('idle') // idle | loading | error
  const loadingRef = useRef(false)
  const abortRef = useRef(null)
  const sentinelRef = useRef(null)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return       // guard duplicates
    loadingRef.current = true
    setStatus('loading')
    abortRef.current = new AbortController()
    try {
      const { items: page, nextCursor } = await fetchPosts(cursor, { signal: abortRef.current.signal })
      setItems(prev => {
        const seen = new Set(prev.map(p => p.id))
        return [...prev, ...page.filter(p => !seen.has(p.id))]   // dedupe
      })
      setCursor(nextCursor)
      setHasMore(Boolean(nextCursor))
      setStatus('idle')
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('error')
    } finally {
      loadingRef.current = false
    }
  }, [cursor, hasMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '800px 0px' }                 // prefetch early
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore])

  useEffect(() => () => abortRef.current?.abort(), []) // cancel on unmount

  return (
    <div aria-busy={status === 'loading'}>
      <ul>{items.map(p => <li key={p.id}><PostCard post={p} /></li>)}</ul>
      {status === 'error' && <button onClick={loadMore}>Couldn't load more — Retry</button>}
      {hasMore ? <div ref={sentinelRef} style={{ height: 1 }} /> : <p>You're all caught up</p>}
      <div role="status" className="sr-only">{status === 'loading' ? 'Loading more posts' : ''}</div>
    </div>
  )
}
```
**Discussion points**: cursor pagination (stable under inserts); `loadingRef` prevents races between observer callbacks; `rootMargin` prefetch hides latency; switch to a virtualized list when items exceed a few hundred; keep scroll restoration via a cache (React Query `useInfiniteQuery`); provide a "Load more" button for keyboard users and to reach the footer.
:::

:::quiz
### What's the best trigger for infinite scroll loading?
- [ ] A scroll listener computing offsetHeight every event
- [x] IntersectionObserver on a sentinel element with rootMargin
- [ ] setInterval checking scrollTop
- [ ] A MutationObserver on the list
@@@explain
IntersectionObserver is asynchronous, avoids forced layout, and rootMargin enables prefetching.
:::

:::quiz
### 200 WebSocket ticks per second arrive. What's the most sensible maximum render rate for a price grid?
- [ ] 200 renders/s — one per tick
- [x] Coalesce and render at most once per frame (or a few times per second for numbers)
- [ ] Render once per minute
- [ ] Render only on user scroll
@@@explain
The screen paints ~60 times/s and humans can't read faster updates; coalesce by key and flush per frame or interval.
:::
