---
title: Design Real-time Notifications and a Scalable Dashboard
summary: Two real-time designs — an in-app notification system (bell, toasts, badges, push) and a data-heavy dashboard (YouTube Studio / Uber ops) with large tables, live updates, filters that don't lag, and dynamic theming.
minutes: 28
---

## Part 1 — Real-time notification system

> "Design a notification system for real-time updates" (reference doc, frontend system design list).

### Requirements

**Functional**: bell icon with unread badge; dropdown/panel listing notifications (newest first, infinite scroll); mark one/all as read; toasts for important events while the app is open; deep links to the related object; browser/OS push when the app is closed (opt-in); per-type preferences.

**Non-functional**: delivered within seconds; consistent unread count across tabs and devices; no notification storms (aggregate "Ada and 12 others liked your post"); minimal battery/network; accessible announcements.

### Architecture

```text
event sources (likes, comments, orders) ─▶ Kafka ─▶ notification service
   (dedupe, aggregate, preferences, fan-out) ─▶ store (per-user inbox) ─┬─▶ realtime gateway (SSE/WS) ─▶ open tabs
                                                                        └─▶ push service (Web Push / APNs / FCM) ─▶ service worker

Client:
  NotificationsProvider (store: items, unreadCount, cursor)
   ├─ <Bell badge/>  ├─ <NotificationPanel/> (virtualized list)  └─ <ToastHost/>
  RealtimeClient (SSE)   BroadcastChannel (sync across tabs)   ServiceWorker (push)
```

**Transport**: notifications flow server → client only, so **SSE** is ideal (simple HTTP, automatic reconnect, `Last-Event-ID` to resume missed events). If the app already holds a WebSocket (chat), multiplex onto it.

### Data model & API

```ts
type Notification = {
  id: string
  type: 'like' | 'comment' | 'mention' | 'order_shipped' | 'system'
  actorIds: string[]          // aggregated actors
  actorCount: number
  target: { kind: 'post' | 'order'; id: string; url: string }
  text: string                // server-rendered, localised, plain text
  createdAt: string
  read: boolean
  priority: 'low' | 'normal' | 'high'
}
```

```http
GET  /notifications?cursor=…&limit=20     → { items, nextCursor, unreadCount }
POST /notifications/read  { ids } | { upTo: "<id>" }   → { unreadCount }
SSE  /notifications/stream                 event: notification | unread_count
POST /push/subscriptions { endpoint, keys } (Web Push)
```

The server is the **source of truth for `unreadCount`** and sends it with every relevant event, so drift between tabs/devices self-heals.

### Deep dives

- **Toasts**: only for `high` priority or when the panel is closed; queue them (max 3 visible), auto-dismiss after ~5s but pause on hover/focus; never steal focus; announce via `role="status"` (polite) or `role="alert"` for urgent errors only.
- **Multiple tabs**: one tab can hold the SSE connection (leader election via `BroadcastChannel`/Web Locks) and broadcast to others, or each tab connects; "mark as read" in one tab is broadcast so badges update everywhere.
- **Aggregation & rate limiting**: server collapses bursts ("12 people liked…"), client throttles toast frequency.
- **Push when closed**: service worker receives `push` events and shows `self.registration.showNotification()`; clicking focuses an existing tab or opens the URL. Ask for permission **contextually** (after the user does something that benefits), never on page load.
- **Offline/reconnect**: on reconnect use `Last-Event-ID` or refetch the first page and merge by id.
- **Performance**: the panel is lazy-loaded (code split) — most page views never open it; virtualize long lists; the badge count is a tiny piece of state outside heavy contexts so it doesn't re-render the app.
- **Accessibility**: bell is a button with `aria-label="Notifications, 3 unread"`, panel is a dialog/popover with focus management, Esc closes.

## Part 2 — Scalable dashboard with large tables and real-time updates

> "How would you design a scalable dashboard (like YouTube or Uber)?" · "Design a highly performant web app that renders large data tables with real-time updates" (Walmart) · "A complex dashboard is lagging when users apply filters — how do you profile and optimise it?" (Walmart).

### Requirements

**Functional**: KPI cards, charts (time series), a large table (10k–1M rows: trips, videos, orders) with sorting, filtering, column resize/reorder, row selection, export; live updates (new trips, changing statuses); saved views; drill-down.

**Non-functional**: filters respond < 100ms (INP), live updates without jank, works for analysts with huge screens and ops staff on laptops, role-based access, shareable URLs.

### Architecture

```text
<DashboardPage>  (route-level code split; widgets lazy-loaded)
  <FilterBar/>   ← state in the URL (?status=active&city=blr&range=7d)
  <KpiRow/>      ← small aggregated queries
  <ChartPanel/>  ← aggregated time series (server-side buckets)
  <DataGrid/>    ← virtualized rows & columns, server-driven pagination/sort/filter
Data layer: query cache (React Query) keyed by filters; WebSocket/SSE for deltas
Heavy client compute → Web Worker
```

### Key decisions

1. **Push work to the server.** Don't download 1M rows to filter in JS. The API takes filters/sort/page and returns aggregates and a page of rows. Charts request **pre-aggregated buckets** (per minute/hour), not raw events. A BFF can shape data per widget.
2. **Filter state in the URL** → shareable, back/forward works, single source of truth. Each widget derives its query key from it.
3. **Independent widgets**: each fetches its own data with its own loading/error state and **error boundary**, so one slow or failing widget doesn't block the page. Load above-the-fold widgets first; lazy-load the rest.
4. **Virtualized grid**: render only visible rows *and columns* (wide tables). Fixed row height makes it trivial; sticky header/first column via CSS `position: sticky`.

```text
Viewport shows rows 1200–1240 of 1,000,000:
 [ top spacer: 1200 × 36px ] [ 40 real <tr> ] [ bottom spacer ]   → DOM stays ~40 rows
```

### Real-time updates without jank

- Subscribe to **deltas** (`{ id, changes }`), not full snapshots.
- **Buffer and batch**: collect incoming updates and apply once per animation frame or every 250–1000ms (humans can't read faster). One state update per batch → one render.
- Apply updates into a **normalised map** (`rowsById`); visible rows re-render only if their row object changed (memoised row components).
- Updates to rows outside the viewport just update data (no DOM work).
- Throttle high-frequency feeds (price ticks — Coinbase's "throttling WebSocket price updates for a chart") — e.g. keep only the latest value per symbol and flush on `requestAnimationFrame`.
- Highlight changed cells briefly with a CSS animation (compositor-only properties); respect reduced motion.
- Pause live updates while the user is interacting (selecting, editing) or offer a "Live / Paused" toggle — otherwise rows jump under the cursor.

```js
const buffer = new Map()
socket.onmessage = (e) => {
  const u = JSON.parse(e.data)
  buffer.set(u.id, { ...buffer.get(u.id), ...u.changes }) // coalesce
}
function flush() {
  if (buffer.size) {
    store.applyBatch(buffer) // single state update
    buffer.clear()
  }
  requestAnimationFrame(flush)
}
requestAnimationFrame(flush)
```

### "Filters are lagging": profile, then fix

1. Record in the **Performance panel** with 4× CPU throttling; find the long task after the filter click.
2. **React Profiler**: which components re-render and why. Typical culprits: a context holding all filters + data re-rendering the entire page; un-memoised selectors creating new arrays; charts re-computing on every keystroke.
3. Fixes:
   - Debounce text filters; keep the input responsive with `useTransition`/`useDeferredValue` so the heavy table render is low priority.
   - Move filtering/sorting of large client datasets into a **Web Worker** (or better, the server).
   - Memoise derived data (`useMemo`, Reselect) and split contexts so unrelated widgets don't re-render.
   - Virtualize the table; avoid re-mounting rows (stable keys).
   - Charts: downsample (LTTB) to ~1–2k points; use canvas (not thousands of SVG nodes) for dense charts.
   - Cancel in-flight requests for superseded filters (latest-wins).
4. Measure again; add RUM INP tracking for the filter interaction.

### Dynamic theming (light/dark) without performance issues

- Define **CSS custom properties** (design tokens) on `:root` and override them under `[data-theme="dark"]` (and `prefers-color-scheme`). Switching themes changes one attribute → the browser recalculates styles once; no React re-render of the whole tree, no runtime CSS-in-JS re-injection.
- Persist the choice in `localStorage` and apply it with a tiny **inline script in `<head>`** before first paint to avoid a flash of the wrong theme (FOUC). With SSR, a cookie lets the server render the right theme.
- Charts read token values (`getComputedStyle`) or use CSS variables directly in SVG.
- Use `color-scheme: light dark` so native controls and scrollbars match.

## Interview questions

:::question
difficulty: hard
companies: Walmart
### How would you design a highly performant web app that renders large data tables with real-time updates?
Server-side filtering/sorting/pagination (or windowed fetching) so the client holds only what it needs; a virtualized grid (rows and columns) with memoised rows keyed by stable ids; normalised client store; real-time **deltas** over WebSocket/SSE, coalesced in a buffer and applied in batches per animation frame; heavy derived computations in a Web Worker; transitions/deferred values to keep interactions responsive; visual change highlighting via compositor-friendly CSS; pausing updates during interaction; error boundaries per widget; and monitoring of INP and long tasks in production.
:::

:::question
difficulty: medium
companies: Walmart
### How would you implement light/dark theming in a large app without performance issues?
Use design tokens as CSS custom properties; switch themes by toggling a `data-theme` attribute on `<html>`, so it's a single style recalculation and no React re-render. Respect `prefers-color-scheme` by default, persist the user's override, and apply it in a blocking inline script (or server-rendered from a cookie) to avoid a flash. Avoid runtime CSS-in-JS theme objects that force re-rendering every styled component. Set `color-scheme` for native UI, and make sure contrast meets WCAG in both themes.
:::

:::question
difficulty: medium
### SSE or WebSocket for notifications?
SSE: notifications are one-way (server → client), and SSE gives automatic reconnection and resume via `Last-Event-ID` over plain HTTP (works with HTTP/2 multiplexing and standard infrastructure). WebSocket is warranted if you need client → server messages over the same channel at high frequency (chat, presence) — in which case multiplex notifications onto it.
:::

## Practice

:::challenge
difficulty: medium
companies: Coinbase
### Throttle a high-frequency WebSocket price feed for a chart
A socket emits ~200 price updates per second across 50 symbols. Rendering each update freezes the UI. Write a small `createBatcher(apply)` that coalesces updates per symbol (keep the latest) and calls `apply(updatesMap)` at most once per animation frame. Explain the React integration.
@@@solution
```js
function createBatcher(apply, schedule = requestAnimationFrame) {
  let pending = new Map()
  let scheduled = false

  function flush() {
    scheduled = false
    if (pending.size === 0) return
    const batch = pending
    pending = new Map()
    apply(batch)
  }

  return {
    push(symbol, price) {
      pending.set(symbol, price) // latest value wins
      if (!scheduled) {
        scheduled = true
        schedule(flush)
      }
    },
    flushNow: flush,
  }
}

// usage
const batcher = createBatcher((batch) => {
  setPrices((prev) => {
    const next = { ...prev }
    for (const [symbol, price] of batch) next[symbol] = price
    return next
  })
})
socket.onmessage = (e) => {
  const { symbol, price } = JSON.parse(e.data)
  batcher.push(symbol, price)
}
```

- 200 messages/sec become at most 60 state updates/sec, each containing only the latest price per symbol — no wasted renders of intermediate values the eye can't see.
- `requestAnimationFrame` aligns updates with painting and pauses in background tabs (when hidden you could switch to a slower interval or stop updating the chart and catch up on visibility).
- For a chart, append points to a ring buffer outside React and redraw the canvas directly in the flush — React state for every tick is unnecessary.
- Financial amounts: keep prices as strings/integers in minor units or `BigInt`/decimal libraries — never do money math with binary floats.
:::

## Quick check

:::quiz
### Why keep dashboard filter state in the URL?
- [ ] It's faster than React state
- [x] It's shareable, survives reloads and works with back/forward navigation as a single source of truth
- [ ] Browsers cache URLs
- [ ] It avoids re-renders
@@@explain
URL state makes views linkable and navigable; widgets derive their queries from it.
:::

:::quiz
### Best way to apply 500 real-time row updates per second to a grid?
- [ ] setState for each message
- [x] Coalesce into a buffer and apply one batched update per frame (or interval)
- [ ] Re-fetch the full table every second
- [ ] Use `innerHTML` for speed
@@@explain
Batching bounds render frequency and drops intermediate values nobody can see.
:::
