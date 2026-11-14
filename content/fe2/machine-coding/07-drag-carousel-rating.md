---
title: Draggable Lists, Image Carousel and Star Rating
summary: Reordering items with HTML5 drag-and-drop and pointer events (plus keyboard), an accessible auto-playing carousel, and a star rating with hover preview and half stars.
minutes: 20
---

## Interaction-heavy components

These three components test **event handling**: which events to listen to, where to put listeners, how to avoid needless re-renders while the user drags or hovers, and how to keep everything usable from a keyboard.

## Draggable (reorderable) list

"How do you reorder items cleanly? Event handling + performance optimizations?"

Two approaches:

| | HTML5 Drag and Drop API | Pointer events |
|---|---|---|
| Events | `dragstart`, `dragover`, `drop`, `dragend` | `pointerdown`, `pointermove`, `pointerup` |
| Touch devices | ❌ Not supported on most mobile browsers | ✅ Mouse, touch, pen unified |
| Custom drag preview / animation | Limited (ghost image) | Full control |
| Drag between windows / files | ✅ | ❌ |
| Effort | Low | Medium |

Clean reordering = a **pure** `move(array, from, to)` function plus state for "what's being dragged" and "where it would drop".

```js
function move(arr, from, to) {
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}
```

:::challenge
difficulty: medium
### Reorderable list with HTML5 DnD + keyboard
Build `<SortableList items onChange />`. Users can drag items to reorder; a drop indicator shows the target position. Keyboard users can focus an item and press Alt+ArrowUp/ArrowDown to move it. Announce moves to screen readers.
@@@solution
```jsx
import { useState } from 'react'

function move(arr, from, to) {
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

export function SortableList({ items, onChange, getLabel = (x) => x.label }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [announcement, setAnnouncement] = useState('')

  const commit = (from, to) => {
    if (from === to || to < 0 || to >= items.length) return
    onChange(move(items, from, to))
    setAnnouncement(`${getLabel(items[from])} moved to position ${to + 1} of ${items.length}`)
  }

  return (
    <>
      <ul className="sortable" role="list">
        {items.map((item, i) => (
          <li
            key={item.id}
            draggable
            tabIndex={0}
            aria-roledescription="sortable item"
            className={[
              'sortable__item',
              dragIndex === i && 'is-dragging',
              overIndex === i && dragIndex !== null && dragIndex !== i && 'is-over',
            ].filter(Boolean).join(' ')}
            onDragStart={(e) => {
              setDragIndex(i)
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(i))   // Firefox needs data set
            }}
            onDragOver={(e) => {
              e.preventDefault()            // REQUIRED to allow dropping
              if (overIndex !== i) setOverIndex(i)   // avoid re-rendering on every dragover tick
            }}
            onDrop={(e) => {
              e.preventDefault()
              commit(dragIndex, i)
            }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
            onKeyDown={(e) => {
              if (!e.altKey) return
              if (e.key === 'ArrowUp') { e.preventDefault(); commit(i, i - 1) }
              if (e.key === 'ArrowDown') { e.preventDefault(); commit(i, i + 1) }
            }}
          >
            <span aria-hidden="true" className="handle">⠿</span> {getLabel(item)}
          </li>
        ))}
      </ul>
      <p aria-live="assertive" className="sr-only">{announcement}</p>
    </>
  )
}
```
```css
.sortable__item { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 6px 0; background: #fff; cursor: grab; }
.sortable__item.is-dragging { opacity: .4; }
.sortable__item.is-over { border-top: 3px solid #6366f1; }
.sortable__item:focus-visible { outline: 2px solid #6366f1; }
```

Explain:
- `dragover` must call `preventDefault()` or `drop` never fires.
- `dragover` fires continuously (every ~50 ms) — only set state when the target **changes**.
- Reordering is a pure function; the parent owns the order (controlled) and can persist it (send the new order or a fractional index for the moved item to the API — optimistic update + rollback).
- Stable `key={item.id}` so React moves DOM nodes rather than recreating them.
- Keyboard alternative + live region announcement — DnD alone isn't accessible.
- HTML5 DnD doesn't work on touch. For mobile, use pointer events (below) or a library like **dnd-kit** (sensors for pointer/touch/keyboard, collision detection, accessibility built in).
:::

### Pointer-events version (works on touch)

```jsx
function usePointerDrag({ onMove, onEnd }) {
  return (e) => {
    const startY = e.clientY
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)            // keep receiving events even if pointer leaves the element
    const move = (ev) => onMove(ev.clientY - startY)
    const up = (ev) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      onEnd(ev.clientY - startY)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }
}
```

Performance for pointer-driven dragging:
- Move the dragged element with `transform: translateY(...)` (compositor only), not `top`.
- Update the transform **directly via a ref** inside `requestAnimationFrame`, not React state, during the drag; commit the final order to state once on drop.
- Measure item heights once at drag start (avoid layout reads on every move).
- Add `touch-action: none` on the handle so the browser doesn't scroll instead of dragging.

## Image carousel

:::challenge
difficulty: medium
### Accessible image carousel
`<Carousel images={[{src, alt}]} autoPlay interval={4000} />`
- Prev/Next buttons (wrap around), dot indicators, keyboard Left/Right.
- Auto-play that **pauses on hover/focus** and when the tab is hidden; respects `prefers-reduced-motion`.
- Smooth sliding via `transform`; lazy-load non-adjacent images.
- Swipe on touch.
@@@solution
```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import './Carousel.css'

export function Carousel({ images, autoPlay = true, interval = 4000 }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef(null)
  const n = images.length

  const go = useCallback((i) => setIndex(((i % n) + n) % n), [n])   // wrap both ways
  const next = useCallback(() => setIndex((i) => (i + 1) % n), [n])
  const prev = useCallback(() => setIndex((i) => (i - 1 + n) % n), [n])

  const reduceMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Auto-play; restarts the timer whenever index changes (manual navigation resets the countdown)
  useEffect(() => {
    if (!autoPlay || paused || reduceMotion || n < 2) return
    const id = setTimeout(next, interval)
    return () => clearTimeout(id)
  }, [index, autoPlay, paused, reduceMotion, interval, next, n])

  // Pause when the tab is hidden
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <section
      className="carousel"
      aria-roledescription="carousel"
      aria-label="Product images"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') next()
        if (e.key === 'ArrowLeft') prev()
      }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) (dx < 0 ? next : prev)()
        touchX.current = null
      }}
    >
      <div className="carousel__viewport">
        <ul
          className="carousel__track"
          style={{ transform: `translateX(-${index * 100}%)`, transition: reduceMotion ? 'none' : undefined }}
          aria-live={autoPlay && !paused ? 'off' : 'polite'}
        >
          {images.map((img, i) => {
            const near = Math.abs(i - index) <= 1 || (index === 0 && i === n - 1) || (index === n - 1 && i === 0)
            return (
              <li key={img.src} className="carousel__slide" role="group" aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}`} aria-hidden={i !== index}>
                <img src={img.src} alt={img.alt} loading={near ? 'eager' : 'lazy'} draggable="false" />
              </li>
            )
          })}
        </ul>
      </div>

      <button className="carousel__btn carousel__btn--prev" onClick={prev} aria-label="Previous slide">‹</button>
      <button className="carousel__btn carousel__btn--next" onClick={next} aria-label="Next slide">›</button>

      <div className="carousel__dots" role="tablist" aria-label="Choose slide">
        {images.map((_, i) => (
          <button key={i} role="tab" aria-selected={i === index} aria-label={`Slide ${i + 1}`}
            className={i === index ? 'active' : ''} onClick={() => go(i)} />
        ))}
      </div>
    </section>
  )
}
```
```css
.carousel { position: relative; max-width: 720px; }
.carousel__viewport { overflow: hidden; border-radius: 12px; }
.carousel__track { display: flex; margin: 0; padding: 0; list-style: none; transition: transform .45s ease; }
.carousel__slide { flex: 0 0 100%; aspect-ratio: 16 / 9; }      /* reserve space → no layout shift */
.carousel__slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
.carousel__btn { position: absolute; top: 50%; translate: 0 -50%; border: 0; border-radius: 50%; width: 40px; height: 40px; background: #fff9; font-size: 24px; cursor: pointer; }
.carousel__btn--prev { left: 8px } .carousel__btn--next { right: 8px }
.carousel__dots { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }
.carousel__dots button { width: 10px; height: 10px; border-radius: 50%; border: 0; background: #cbd5e1; }
.carousel__dots button.active { background: #4f46e5; }
```

Points to mention:
- Sliding the whole **track with `transform`** is compositor-only → smooth.
- `setTimeout` keyed on `index` (instead of `setInterval`) avoids drift and naturally resets after manual navigation — no stale closures.
- Pausing on hover/focus/hidden tab and honouring reduced motion are WCAG requirements for auto-moving content (2.2.2 Pause, Stop, Hide).
- `aspect-ratio` reserves space (no CLS); lazy-load far slides; preload the next one.
- Follow-ups: infinite loop without the visual "rewind" (clone first/last slides), thumbnails, CSS scroll-snap version (`scroll-snap-type: x mandatory`) which gets native swipe for free.
:::

## Star rating

:::challenge
difficulty: easy
### Star rating with hover preview
`<StarRating value onChange max={5} readOnly />`
- Hovering previews the rating; leaving restores the selected value; clicking sets it (clicking the current value clears it).
- Keyboard accessible; works as a form control for screen readers.
- Bonus: read-only mode displays fractional ratings (e.g. 3.6).
@@@solution
Accessible approach: a **radio group** — native keyboard support (arrow keys) and correct semantics for free.

```jsx
import { useId, useState } from 'react'
import './StarRating.css'

export function StarRating({ value = 0, onChange, max = 5, readOnly = false, label = 'Rating' }) {
  const [hover, setHover] = useState(0)
  const name = useId()

  if (readOnly) {
    const pct = (Math.max(0, Math.min(value, max)) / max) * 100
    return (
      <span className="stars stars--ro" role="img" aria-label={`${value.toFixed(1)} out of ${max} stars`}>
        <span className="stars__bg">{'★'.repeat(max)}</span>
        <span className="stars__fg" style={{ width: `${pct}%` }}>{'★'.repeat(max)}</span>
      </span>
    )
  }

  const shown = hover || value
  return (
    <fieldset className="stars" onMouseLeave={() => setHover(0)}>
      <legend className="sr-only">{label}</legend>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1
        return (
          <label key={n} className={n <= shown ? 'star star--on' : 'star'} onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange?.(n)}
              onClick={() => value === n && onChange?.(0)}   // click again to clear
            />
            <span aria-hidden="true">★</span>
            <span className="sr-only">{n} star{n > 1 ? 's' : ''}</span>
          </label>
        )
      })}
    </fieldset>
  )
}
```
```css
.stars { border: 0; padding: 0; display: inline-flex; gap: 2px; font-size: 28px; }
.star { color: #cbd5e1; cursor: pointer; transition: transform .1s, color .1s; }
.star--on { color: #f59e0b; }
.star:hover { transform: scale(1.15); }
.star:has(input:focus-visible) { outline: 2px solid #6366f1; border-radius: 4px; }
.stars--ro { position: relative; display: inline-block; color: #cbd5e1; }
.stars__fg { position: absolute; inset: 0 auto 0 0; overflow: hidden; white-space: nowrap; color: #f59e0b; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```
Notes: hover is **transient UI state**, value is controlled by the parent; radios give arrow-key navigation and screen-reader announcements; the read-only fractional display overlays a clipped gold layer (width %) over grey stars. Follow-ups: half-star input (two radios per star or pointer x-position), labels like "Excellent" on hover, larger touch targets on mobile.
:::

## Quick check

:::quiz
### Why must a dragover handler call preventDefault()?
- [ ] To stop event bubbling
- [x] Elements are not drop targets by default; preventDefault signals that dropping is allowed
- [ ] To improve performance
- [ ] To show the drag ghost image
@@@explain
Without it, the drop event never fires.
:::

:::quiz
### What's the best way to move an element smoothly during a pointer drag?
- [ ] setState with top/left on every pointermove
- [x] Update transform via a ref inside requestAnimationFrame, commit to state on drop
- [ ] Re-render the whole list on each move
- [ ] Use setInterval polling of the mouse
@@@explain
Transform is compositor-friendly and bypassing React during the gesture avoids re-render cost per event.
:::
