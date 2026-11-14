---
title: Design a Pinterest-like Masonry Grid (and Photo Carousel)
summary: Masonry layout algorithms, infinite scroll with cursor pagination, image loading strategy, virtualization of a multi-column grid, responsive columns, and an accessible image carousel/lightbox.
minutes: 26
---

## The prompt

> "Design a Pinterest-like grid UI. Discuss component breakdown, data flow and how you'd handle large datasets efficiently."

This was asked repeatedly in the reference doc (Tekion HLD rounds, GreatFrontEnd's Pinterest question). It's a feed design with a twist: **items have different heights and are laid out in columns**, and it's image-heavy. We'll also cover the related **image carousel / photo viewer** question.

## Requirements

**Functional**
- Grid of pins (image + title + author), variable heights, ordered roughly left-to-right, top-to-bottom.
- Infinite scroll.
- Click a pin → detail view (modal on desktop, page on mobile) with a carousel of related images; back returns to the same scroll position.
- Save/like a pin.

**Non-functional**
- Smooth scroll with thousands of pins; low memory on mobile.
- Fast LCP (first row of images), zero layout shift.
- Responsive: 2 columns on phones → 6+ on wide screens.
- Accessible: keyboard navigation, alt text, focus management in the modal.

## Architecture

```text
<HomePage>
  <SearchBar/>
  <MasonryGrid items columns gap onLoadMore>
     <PinCard pin/>  (absolutely positioned, memoised)
     <Sentinel/>     (IntersectionObserver → load next page)
  <PinModal route="/pin/:id"> (rendered over the grid; grid stays mounted)
     <ImageCarousel images/> <PinDetails/> <RelatedPins/>
```

Data layer: normalised `pins: Record<id, Pin>`, `feed: { ids, cursor, hasMore }`, an API client with de-dupe/retry, a CDN image service that resizes on the fly.

## Data model & API

```ts
type Pin = {
  id: string
  title: string
  author: { id: string; name: string; avatar: string }
  image: { url: string; width: number; height: number; dominantColor: string; alt: string }
  saved: boolean
}
```

```http
GET /pins?cursor=…&limit=30   → { pins: Pin[], nextCursor }
GET /pins/:id                 → Pin & { related: Pin[], images: Image[] }
PUT /pins/:id/save            → 204
```

The crucial field: **image `width` and `height`** (or aspect ratio). Without them you can't place an item until its image loads, which causes the whole grid to reflow — the #1 masonry bug.

## Deep dive 1: the masonry algorithm

CSS Grid lays items out in rows; masonry needs columns where each item goes to the **shortest column**. Algorithm:

```js
function layoutMasonry(items, { columnCount, columnWidth, gap }) {
  const heights = new Array(columnCount).fill(0)
  const positions = items.map((item) => {
    const col = heights.indexOf(Math.min(...heights))           // shortest column
    const h = Math.round(columnWidth * (item.image.height / item.image.width)) + 56 // + caption area
    const pos = { id: item.id, x: col * (columnWidth + gap), y: heights[col], width: columnWidth, height: h }
    heights[col] += h + gap
    return pos
  })
  return { positions, totalHeight: Math.max(...heights) }
}
```

- Placing each item in the shortest column keeps columns balanced and preserves approximate reading order.
- Because heights are computed **from data**, the layout is deterministic before any image loads.
- Items are `position: absolute` with `transform: translate(x, y)` inside a container with `height: totalHeight`.
- Appending a page only lays out **new** items (keep `heights` from the previous run) — O(new items × columns), or O(new items × log columns) with a min-heap.
- On resize, recompute columns (`ResizeObserver` on the container, debounced) and re-layout everything.

Alternatives and their trade-offs:

| Approach | Pros | Cons |
|---|---|---|
| CSS `columns: 4` | Zero JS | Order goes top→bottom per column (wrong for feeds); appending reshuffles everything |
| Flex columns (N column divs) | Simple, no absolute positioning | Must distribute items to columns in JS anyway; resize redistributes |
| CSS Grid `grid-template-rows: masonry` | Native, future | Limited browser support (behind flags / new `display: grid-lanes` proposals) |
| **JS absolute positioning** | Full control, enables virtualization | More code; must handle resize |

## Deep dive 2: virtualization in two dimensions

With absolute positions known, virtualization is straightforward: render only items whose `[y, y + height]` intersects `[scrollTop - overscan, scrollTop + viewportHeight + overscan]`.

```js
const visible = positions.filter((p) => p.y + p.height > scrollTop - 600 && p.y < scrollTop + viewport + 600)
```

For large lists, keep positions sorted per column so you can binary-search the first visible item. The container keeps the full `totalHeight` so the scrollbar is correct. This keeps the DOM at ~50–100 cards regardless of how far you scroll.

:::visual virtual-list
:::

## Deep dive 3: images

Images are the heaviest part of this product:

- **Responsive sizes** via an image CDN: `srcset="…?w=236 236w, …?w=474 474w, …?w=736 736w" sizes="(max-width: 600px) 50vw, 236px"`. Phones download small images; retina screens get 2x.
- **Modern formats**: AVIF/WebP with JPEG fallback (`<picture>` or CDN `Accept`-based negotiation).
- **Lazy loading**: `loading="lazy"` + `decoding="async"` below the fold; the first row gets `fetchpriority="high"` (it's the LCP).
- **Placeholders**: background = `dominantColor` (or a tiny blurhash) with the exact aspect ratio → no CLS, pleasant progressive load.
- **Preconnect** to the image CDN domain in `<head>`.
- Error state: a neutral tile with the title; retry on reconnect.

## Deep dive 4: modal routing and scroll restoration

Clicking a pin should feel instant and back should return to the exact spot:
- Use a **route-driven modal**: navigate to `/pin/:id` but render the modal *over* the still-mounted grid (keep a "background location" in router state). Deep links/refreshes render the full pin page instead.
- Pre-populate the modal from the already-loaded pin data (instant), fetch the detail in the background.
- Because the grid stays mounted, scroll position is preserved. If the grid unmounts (mobile full page), store feed state and scroll anchor in the store/sessionStorage and restore.

## Deep dive 5: image carousel / lightbox

Common standalone machine-coding question ("build an image carousel"). Requirements: prev/next, dots, swipe on touch, keyboard, optional autoplay, lazy load neighbours.

```jsx
function Carousel({ images, label = 'Photos' }) {
  const [index, setIndex] = useState(0)
  const count = images.length
  const go = (i) => setIndex((i + count) % count)
  const startX = useRef(null)

  return (
    <section aria-roledescription="carousel" aria-label={label}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(index + 1); if (e.key === 'ArrowLeft') go(index - 1) }}>
      <div className="viewport"
        onPointerDown={(e) => { startX.current = e.clientX }}
        onPointerUp={(e) => {
          const dx = e.clientX - startX.current
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
        }}>
        <div className="track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {images.map((img, i) => (
            <div key={img.id} className="slide" role="group" aria-roledescription="slide"
                 aria-label={`${i + 1} of ${count}`} aria-hidden={i !== index}>
              {Math.abs(i - index) <= 1 && <img src={img.url} alt={img.alt} draggable={false} />}
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => go(index - 1)} aria-label="Previous photo">‹</button>
      <button onClick={() => go(index + 1)} aria-label="Next photo">›</button>
      <div aria-live="polite" className="sr-only">Photo {index + 1} of {count}</div>
    </section>
  )
}
```

```css
.viewport { overflow: hidden; touch-action: pan-y; }
.track { display: flex; transition: transform 300ms ease; }
.slide { flex: 0 0 100%; aspect-ratio: 4 / 3; display: grid; place-items: center; }
@media (prefers-reduced-motion: reduce) { .track { transition: none; } }
```

Key points: animate with `transform` (compositor-only, smooth), render only the current ± 1 images (lazy), swipe via pointer events with a threshold, keyboard arrows, live region, pause autoplay on hover/focus and provide a pause button (WCAG 2.2.2). For a lightbox: trap focus inside the dialog, Esc closes, restore focus to the clicked thumbnail.

## Accessibility for the grid

- Each pin is a link with an accessible name (`aria-label="Pin: Minimal desk setup, by Ada"`) and meaningful `alt`.
- Visual order should match DOM order as much as possible (masonry by shortest column keeps them close). Absolute positioning doesn't change tab order — DOM order is the reading order.
- Visible focus rings; skip link to bypass the grid.

## Interview questions

:::question
difficulty: medium
companies: Tekion
### How would you handle large datasets efficiently in a Pinterest-like grid?
1. **Pagination** with cursors, prefetching the next page before the user hits the bottom.
2. **Deterministic layout from data** — aspect ratios in the API so positions are computed without waiting for images.
3. **Virtualization** — only render cards intersecting the viewport (+ overscan), keeping DOM size constant.
4. **Image strategy** — CDN resizing with `srcset`, AVIF/WebP, lazy loading, placeholders.
5. **Memory** — normalised store, memoised cards, evict far-away pages in very long sessions.
6. **Main-thread hygiene** — layout calculation for new items only; debounce resize; `transform` positioning.
:::

:::question
difficulty: medium
### Why not just use CSS `columns` for masonry?
CSS multi-column flows content **top-to-bottom within each column**, so item 2 appears under item 1 rather than next to it — wrong reading order for a ranked feed. Appending new items also re-balances the columns, making existing items jump between columns. It's fine for static content where order doesn't matter, not for an infinitely loading feed.
:::

## Practice

:::challenge
difficulty: medium
companies: Tekion, Pinterest
### Implement the masonry layout function
Write `layoutMasonry(items, containerWidth, { minColumnWidth = 236, gap = 16 })` where each item has `{ id, width, height }` (image intrinsic size). Compute the number of columns that fit, the column width, and each item's `{ id, x, y, w, h }` by placing it in the shortest column (ties → leftmost). Return `{ columns, positions, height }`.
@@@solution
```js
function layoutMasonry(items, containerWidth, { minColumnWidth = 236, gap = 16 } = {}) {
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)))
  const colWidth = (containerWidth - gap * (columns - 1)) / columns
  const heights = new Array(columns).fill(0)

  const positions = items.map((item) => {
    let col = 0
    for (let c = 1; c < columns; c++) if (heights[c] < heights[col]) col = c // shortest, leftmost on tie
    const h = colWidth * (item.height / item.width)
    const pos = { id: item.id, x: col * (colWidth + gap), y: heights[col], w: colWidth, h }
    heights[col] += h + gap
    return pos
  })

  return { columns, positions, height: Math.max(0, ...heights) - (items.length ? gap : 0) }
}
```

- `columns` = how many `minColumnWidth` columns plus gaps fit; the column width then stretches to fill the container exactly.
- Each item goes to the shortest column; strict `<` keeps the leftmost on ties.
- Height scales from the intrinsic aspect ratio, so no image needs to load first.
- Complexity O(n·columns); use a min-heap keyed by (height, column) for O(n log columns).

In React: store positions in state computed from `items` + container width (`ResizeObserver`), render `<div style={{ position: 'relative', height }}>` with absolutely positioned cards using `transform: translate(x, y)`, and filter by viewport for virtualization.
:::

## Quick check

:::quiz
### What single API field most prevents layout shift in a masonry grid?
- [ ] Image file size
- [x] Image width/height (aspect ratio)
- [ ] Author name
- [ ] Image format
@@@explain
Known aspect ratios let you size and position every card before images load.
:::

:::quiz
### Why animate a carousel with `transform: translateX` instead of `left`?
- [ ] `left` isn't supported on flex items
- [x] Transforms can be composited on the GPU without triggering layout on every frame
- [ ] Transforms are required for swipe events
- [ ] `left` breaks accessibility
@@@explain
`left` changes layout each frame; `transform` changes only compositing.
:::
