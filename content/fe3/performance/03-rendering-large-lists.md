---
title: Rendering 10,000+ Rows — Virtualization and Beyond
summary: Why big lists are slow, how windowing works, building your own virtualizer, and the techniques that go beyond virtualization.
minutes: 22
---

## Why 10,000 rows hurt

"Your React app becomes extremely slow when rendering 10,000+ records" — this shows up in Tekion, Walmart, Impact Analytics and almost every senior loop. Let's understand **where** the cost actually is before reaching for a library.

Rendering 10k rows with 6 cells each creates ~70,000 DOM nodes. The costs stack up:

| Phase | Cost with 10k rows |
|---|---|
| React render | 10k component function calls, 10k elements diffed on every parent update |
| Commit | 70k `createElement`/`appendChild` calls on mount |
| Style recalculation | Selector matching for 70k nodes |
| Layout | Geometry for 70k boxes — and any later DOM read can force it again |
| Paint & memory | Large layers, tens of MB of memory |

A good rule: keep the DOM under ~1,500 nodes for smooth interaction. The user can only *see* ~20–40 rows anyway.

:::callout analogy The train window
Sitting on a train, you only see the scenery that passes your window. The countryside doesn't need to exist all at once — it only needs to be there when the window gets to it. Virtualization renders only the window.
:::

## How windowing works

:::visual virtual-list
:::

```text
 scroll container (height: 600px, overflow: auto)
 ┌──────────────────────────────┐
 │ spacer / transform offset    │  ← represents rows 0..149 (not rendered)
 │ ┌──────────────────────────┐ │
 │ │ row 150                  │ │  ← overscan above
 │ │ row 151  ◀ visible ▶     │ │
 │ │ ...                      │ │
 │ │ row 165                  │ │
 │ │ row 166                  │ │  ← overscan below
 │ └──────────────────────────┘ │
 │ total height = 10,000 × 40px │  ← inner element keeps the scrollbar honest
 └──────────────────────────────┘
```

1. An inner element is given the **total height** (`count × rowHeight`) so the scrollbar is correct.
2. On scroll, compute `start = floor(scrollTop / rowHeight)` and `end = start + ceil(viewportHeight / rowHeight)`.
3. Render only rows `start - overscan … end + overscan`, absolutely positioned (or translated) to `index × rowHeight`.
4. **Overscan** renders a few extra rows so fast scrolling doesn't show blank space.

Libraries: **TanStack Virtual** (headless, supports dynamic sizes), **react-window** (small, fixed/variable sizes), **react-virtuoso** (auto-measuring, grouped lists, chat-style reverse lists).

## Variable row heights

Fixed heights make the math O(1). With variable heights you:

- Use an **estimated** height to size the scroll area initially.
- **Measure** rows after render (`ResizeObserver` or `getBoundingClientRect`) and cache the real heights.
- Keep a **prefix-sum array of offsets**; find the start index with **binary search** over offsets (O(log n)).
- Adjust scroll position when rows above the viewport change height, otherwise content jumps.

## Beyond virtualization

Virtualization fixes DOM size, but it is not the only lever — and interviewers specifically ask "beyond just virtualization":

1. **Do less work per row** — `React.memo` rows, stable `key`s (IDs, never index), stable callbacks with `useCallback`, pass primitives instead of new objects. Otherwise scrolling re-renders every visible row on every parent update.
2. **Pagination / infinite loading** — don't fetch 10k rows if users look at 50. Server-side sort/filter.
3. **`content-visibility: auto`** — let the browser skip rendering of off-screen sections while keeping them in the DOM (find-in-page and accessibility still work):

```css
.section {
  content-visibility: auto;
  contain-intrinsic-size: auto 800px; /* placeholder size so scrollbar is stable */
}
```

4. **Move heavy computation off the main thread** — sorting/filtering/grouping 100k records in a **Web Worker**.
5. **Time slicing / concurrent rendering** — `useDeferredValue` or `startTransition` so typing into a filter stays responsive while the list recalculates.
6. **Incremental rendering** — render the first 50 rows immediately, then append chunks during idle time (`requestIdleCallback`/`scheduler.yield`).
7. **Cheaper DOM** — fewer wrapper divs, avoid expensive CSS (large box-shadows, filters) on every row, use `transform` for positioning.
8. **Canvas/WebGL** — for truly huge grids (spreadsheets, trading UIs), draw cells on a canvas (Google Sheets, Figma do this) and keep an accessible fallback.

```jsx
function SearchableList({ items }) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)  // list updates at lower priority
  const filtered = useMemo(
    () => items.filter(i => i.name.toLowerCase().includes(deferredQuery.toLowerCase())),
    [items, deferredQuery]
  )
  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <VirtualList items={filtered} />
    </>
  )
}
```

## Trade-offs of virtualization

- **Find-in-page (Ctrl+F)** can't find rows that aren't in the DOM.
- **Accessibility**: screen readers see only rendered rows — set `aria-rowcount`/`aria-rowindex` (grids) or `aria-setsize`/`aria-posinset` (lists).
- **Scroll restoration** and "jump to row" need explicit APIs.
- **Variable heights** add complexity and can cause jank if estimates are bad.
- **SEO**: content not rendered isn't indexed — server-render the first page.

:::question
difficulty: medium
companies: Tekion, Walmart, Impact Analytics
### Your React app is slow rendering 10,000+ records. How do you identify the bottleneck and optimise?
**Identify**: Record with React Profiler (is it render time? which components?) and the Performance panel (is it scripting, style/layout, or paint?). Check DOM node count (`document.querySelectorAll('*').length`) and memory.

**Optimise**:
1. **Virtualize** — render only visible rows (TanStack Virtual/react-window), with overscan.
2. **Memoise rows** — `React.memo`, stable keys and callbacks, so parent updates don't re-render every row.
3. **Fetch less** — server-side pagination/filter/sort, or infinite loading.
4. **Keep input responsive** — `useDeferredValue`/`startTransition` for filtering, debounce search.
5. **Offload** — sort/filter/aggregate in a Web Worker.
6. **Cheaper DOM/CSS** — flatten markup, `content-visibility: auto` for sections.
7. **Verify** with the same profile; watch trade-offs (Ctrl+F, a11y, scroll restoration).
:::

:::question
difficulty: medium
companies: Impact Analytics
### What is list virtualization, why is it needed, and how does it work?
It's rendering only the subset of a long list that intersects the viewport (plus a small overscan), while a sized container preserves the full scroll height. It's needed because DOM nodes are expensive: each costs memory, style, layout and paint, and React must reconcile each element. Implementation: listen to scroll, compute the start index from `scrollTop / rowHeight` (or binary search over measured offsets for variable heights), render that slice absolutely positioned at its offset. Trade-offs: Ctrl+F, accessibility attributes, scroll restoration and dynamic heights need extra care.
:::

:::question
difficulty: hard
### What does `content-visibility: auto` do, and when is it better than virtualization?
It tells the browser to skip style, layout and paint for an element's contents while it's off-screen, keeping nodes in the DOM. `contain-intrinsic-size` gives a placeholder size so the scrollbar doesn't jump. It's better when the list is **moderately** large (hundreds of complex sections, long articles, settings pages), when you need **find-in-page, anchor links and accessibility** to keep working, and when you can't afford virtualization's complexity. It does not reduce React render cost or DOM memory, so for 100k rows virtualization is still required.
:::

:::challenge
difficulty: hard
companies: Impact Analytics, Tekion
### Implement a fixed-height virtualized list in React
Build `<VirtualList items={items} rowHeight={40} height={400} renderRow={(item, index) => ...} overscan={5} />` without libraries. It must keep the scrollbar accurate, render only visible rows + overscan, and stay smooth at 100,000 items.
@@@hint
You need one piece of state: `scrollTop`. Everything else (start, end, offset) is derived. The inner element's height is `items.length * rowHeight`.
@@@solution
```jsx
import { useState, useRef, useCallback, memo } from 'react'

export function VirtualList({ items, rowHeight, height, renderRow, overscan = 5 }) {
  const [scrollTop, setScrollTop] = useState(0)
  const rafRef = useRef(0)

  // Coalesce scroll events to one state update per frame
  const onScroll = useCallback((e) => {
    const top = e.currentTarget.scrollTop
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setScrollTop(top))
  }, [])

  const total = items.length
  const visibleCount = Math.ceil(height / rowHeight)
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const end = Math.min(total, Math.floor(scrollTop / rowHeight) + visibleCount + overscan)

  const rows = []
  for (let i = start; i < end; i++) {
    rows.push(
      <Row key={items[i].id ?? i} top={i * rowHeight} height={rowHeight}>
        {renderRow(items[i], i)}
      </Row>
    )
  }

  return (
    <div
      onScroll={onScroll}
      style={{ height, overflowY: 'auto', position: 'relative', willChange: 'transform' }}
      role="list"
      aria-label="Results"
    >
      {/* sizer keeps the scrollbar honest */}
      <div style={{ height: total * rowHeight, position: 'relative' }}>{rows}</div>
    </div>
  )
}

const Row = memo(function Row({ top, height, children }) {
  return (
    <div
      role="listitem"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, transform: `translateY(${top}px)` }}
    >
      {children}
    </div>
  )
})
```

**Why it works**
- Only `end - start` (≈ 10 + 2×overscan) rows exist in the DOM regardless of `items.length`.
- `requestAnimationFrame` coalesces bursts of scroll events into one render per frame.
- `transform: translateY` positions rows on the compositor and avoids re-layout of siblings.
- Rows are memoised; `renderRow` should be stable (`useCallback`) for this to pay off.

**Complexity**: O(visible) per scroll; memory O(visible).

**Follow-ups interviewers ask**
- *Variable heights*: keep an `offsets` prefix-sum array, measure rows with `ResizeObserver`, binary-search the start index, and compensate `scrollTop` when rows above change size.
- *Accessibility*: `aria-setsize={total}` and `aria-posinset={i + 1}` on items so screen readers know the true size.
- *Scroll to index*: `containerRef.current.scrollTop = index * rowHeight`.
- *Infinite loading*: when `end > total - threshold`, call `loadMore()`.
- *Horizontal/grid virtualization*: apply the same math to columns.
:::

:::challenge
difficulty: medium
### Why is this list still slow after virtualization?
```jsx
function Table({ rows, onSelect, selectedId }) {
  return (
    <VirtualList
      items={rows}
      rowHeight={36}
      height={600}
      renderRow={(row) => (
        <TableRow row={row} style={{ padding: 8 }} onClick={() => onSelect(row.id)} selected={row.id === selectedId} />
      )}
    />
  )
}
const TableRow = React.memo(function TableRow(props) { /* expensive cells */ })
```
@@@solution
`React.memo` compares props shallowly. On every render of `Table`:

- `renderRow` is a **new function**, so the list re-renders all rows.
- `style={{ padding: 8 }}` is a **new object** each time → memo fails.
- `onClick={() => onSelect(row.id)}` is a **new function** each time → memo fails.

So every visible row re-renders on every scroll frame and every selection change.

Fix:
```jsx
const rowStyle = { padding: 8 }                    // hoisted constant

function Table({ rows, onSelect, selectedId }) {
  const renderRow = useCallback(
    (row) => <TableRow row={row} style={rowStyle} onSelect={onSelect} selected={row.id === selectedId} />,
    [onSelect, selectedId]
  )
  return <VirtualList items={rows} rowHeight={36} height={600} renderRow={renderRow} />
}

const TableRow = React.memo(function TableRow({ row, onSelect, selected, style }) {
  return <div style={style} onClick={() => onSelect(row.id)} aria-selected={selected}>…</div>
})
```
Now only the two rows whose `selected` flag changed re-render on selection (as long as `onSelect` is stable in the parent).
:::

:::quiz
### What keeps the scrollbar accurate in a virtualized list?
- [ ] Rendering hidden rows with display:none
- [x] An inner element sized to the total height of all rows
- [ ] Setting overflow: hidden
- [ ] IntersectionObserver on every row
@@@explain
The sizer element represents all rows' height even though only a window is mounted.
:::

:::quiz
### Which is a real downside of virtualization?
- [ ] It increases DOM node count
- [x] Browser find-in-page cannot find unrendered rows
- [ ] It prevents memoisation
- [ ] It only works with fixed heights
@@@explain
Unmounted rows aren't in the DOM, so Ctrl+F and some assistive tech can't see them.
:::
