---
title: Reflow, Repaint and Compositing
summary: What each CSS change costs, why transform and opacity win for animation, layout thrashing, and how requestAnimationFrame fits in.
minutes: 14
---

## Three kinds of updates

After the first render, every change you make to the page re-enters the pipeline at a different point:

```text
JavaScript → Style → Layout → Paint → Composite
                     └reflow┘  └repaint┘ └composite┘
```

| Change | Example properties | Pipeline work | Cost |
|---|---|---|---|
| **Layout (reflow)** | `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`, `display`, adding/removing nodes, changing text | Style → **Layout** → Paint → Composite | Highest |
| **Paint only (repaint)** | `color`, `background-color`, `box-shadow`, `border-radius`, `visibility`, `outline` | Style → **Paint** → Composite | Medium |
| **Composite only** | `transform`, `opacity` (on a promoted layer), `filter` in many cases | Style → **Composite** | Lowest — can run on the compositor thread |

:::visual rendering-pipeline
:::

**Reflow** is expensive because geometry is connected: changing one element's width can move its siblings, its parent's height, and everything below. Browsers try to limit the scope (layout boundaries), but often a large part of the tree is recalculated.

**Repaint** redraws pixels without changing geometry.

**Composite-only** changes just move/fade already-painted layers on the GPU.

## Why `transform` is preferred for CSS animations

```css
/* Bad: layout every frame */
.box { transition: left 300ms; }
.box.moved { left: 200px; }

/* Good: composite only */
.box { transition: transform 300ms; }
.box.moved { transform: translateX(200px); }
```

- `left` changes geometry → layout + paint on the **main thread** every frame (60×/sec). If JS is busy, the animation stutters.
- `transform` doesn't affect layout (the element's layout box stays put; it's visually moved). The compositor thread can animate it alone, even when the main thread is blocked.
- Same for `opacity` vs `visibility`/`display` transitions.

### Layers and `will-change`

```css
.drawer { will-change: transform; }
```

`will-change` hints the browser to promote the element to its own compositor layer ahead of time, avoiding a repaint when the animation starts. Use it sparingly: every layer costs GPU memory, and promoting hundreds of elements ("layer explosion") makes things slower. Add it shortly before animating and remove it afterwards when possible.

## Layout thrashing (forced synchronous layout)

Browsers are lazy: when you write styles, they mark layout as **dirty** and recalculate it once before the next frame. But if you **read** a geometric property (`offsetHeight`, `getBoundingClientRect()`, `scrollTop`, `getComputedStyle`) after a write, the browser must run layout **right now** to give you an accurate answer.

Doing read → write → read → write in a loop forces a layout on each iteration:

```js
// ❌ Thrashing: N forced layouts
for (const el of items) {
  const h = el.offsetHeight          // READ  → forces layout (dirty from previous write)
  el.style.height = h * 2 + 'px'     // WRITE → invalidates layout
}

// ✅ Batch reads, then writes: 1 layout
const heights = items.map((el) => el.offsetHeight)   // all reads
items.forEach((el, i) => { el.style.height = heights[i] * 2 + 'px' })  // all writes
```

DevTools Performance panel flags this as purple "Layout" blocks with a warning: *Forced reflow is a likely performance bottleneck*.

Properties that force layout when read include: `offsetTop/Left/Width/Height`, `clientWidth/Height`, `scrollWidth/Height/Top`, `getBoundingClientRect()`, `getComputedStyle()` (for layout-dependent values), `innerText`, `focus()`, `window.innerHeight`, `scrollIntoView()`.

## requestAnimationFrame

`requestAnimationFrame(cb)` runs `cb` **right before the browser's next style/layout/paint**, at the display's refresh rate, and pauses in background tabs.

```js
// Smooth JS-driven animation
function animate(el) {
  const start = performance.now()
  function frame(now) {
    const t = Math.min((now - start) / 500, 1)
    el.style.transform = `translateX(${t * 300}px)`
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
```

Why not `setTimeout(fn, 16)`? Timers aren't aligned with frames: some frames get two updates (wasted work), some get none (jank), and timers keep running in background tabs.

rAF is also the tool for **batching DOM writes** from frequent events:

```js
let scheduled = false
window.addEventListener('scroll', () => {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    header.classList.toggle('compact', window.scrollY > 80)
    scheduled = false
  })
}, { passive: true })
```

`{ passive: true }` tells the browser the handler won't call `preventDefault()`, so scrolling can start immediately on the compositor without waiting for your JS.

## Other ways to reduce reflow cost

- Change **classes** rather than many individual inline styles.
- Build big DOM fragments off-document (`DocumentFragment`, or `display:none` container) and insert once.
- Use `contain: layout paint` or `content-visibility: auto` to isolate subtrees — the browser can skip rendering offscreen sections.
- Avoid table layouts for big dynamic data (a single cell change can relayout the table).
- Use `position: absolute/fixed` for elements that animate size so they don't push siblings.
- Use `ResizeObserver` instead of polling sizes.

## Interview questions

:::question
difficulty: medium
companies: Tekion
### What is the difference between reflow and repaint? When do they happen?
- **Reflow (layout)**: recalculating the position and size of elements. Triggered by geometry changes — width/height/margin/padding/font-size, adding/removing elements, changing text, resizing the window, and also by **reading** layout properties after a write (forced synchronous layout).
- **Repaint**: redrawing pixels when visual appearance changes without geometry — color, background, box-shadow, visibility.

Every reflow is followed by a repaint, but a repaint doesn't need a reflow. Compositor-only changes (transform, opacity) need neither. Minimize reflows by batching reads/writes, changing classes instead of many styles, using transforms for movement and containing layout with `contain`/`content-visibility`.
:::

:::question
difficulty: medium
companies: Tekion
### Why is transform preferred for CSS animations?
`transform` (and `opacity`) don't affect layout or require repainting the element's content. The element is placed on its own compositor layer, and the **compositor thread** (with the GPU) can move, scale or rotate that layer every frame **without involving the main thread**. Animating `top/left/width` triggers layout and paint on the main thread each frame — expensive and vulnerable to jank whenever JavaScript is busy. Bonus: transforms allow sub-pixel smooth movement.
:::

:::question
difficulty: medium
### What is layout thrashing and how do you fix it?
Interleaving DOM writes and layout reads in a loop so the browser must recalculate layout synchronously on every read. Fix by **batching**: read everything first, then write everything; or schedule writes in `requestAnimationFrame`; libraries like **fastdom** formalize the read/write split. In React, prefer measuring in `useLayoutEffect` once and avoid reading layout in render loops.
:::

:::question
difficulty: easy
### Why use requestAnimationFrame instead of setTimeout for animations?
rAF runs right before each frame is painted, synchronized to the display refresh rate, so there's exactly one update per frame — no wasted or missed frames. It also pauses in hidden tabs (battery) and gives a high-resolution timestamp. `setTimeout` drifts, isn't frame-aligned and keeps running in the background.
:::

## Challenges

:::challenge
difficulty: medium
### Fix the janky accordion
This expands panels by animating `height`, and it's janky on mobile:

```css
.panel { height: 0; overflow: hidden; transition: height 300ms; }
.panel.open { height: 400px; }
```
Suggest two better approaches.
@@@solution
1. **Animate `transform` (scaleY) or `clip-path`/`opacity` instead of height** — composite-friendly. Combined with a FLIP technique you can animate siblings moving too:
   - **F**irst: measure starting positions.
   - **L**ast: apply the final layout.
   - **I**nvert: apply a `transform` that makes elements look like they're still in the first position.
   - **P**lay: transition the transform back to `none`.
2. **Use `grid-template-rows`** trick (still layout, but no magic number and smooth on modern browsers):
```css
.panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms; }
.panel.open { grid-template-rows: 1fr; }
.panel > .inner { overflow: hidden; }
```
3. If height animation is unavoidable, keep the animated element `contain: layout` / position it so it doesn't reflow the rest of the page, and keep the panel's content light.

Also respect `prefers-reduced-motion`.
:::

:::challenge
difficulty: medium
### Find the forced layouts
```js
function resizeAll(cards) {
  cards.forEach((card) => {
    card.style.width = card.parentElement.offsetWidth / 3 + 'px'
    card.querySelector('.title').style.fontSize =
      card.getBoundingClientRect().width / 10 + 'px'
  })
}
```
How many forced layouts does this cause for 100 cards, and how do you fix it?
@@@solution
Each iteration: reading `offsetWidth` after the previous iteration's write forces a layout, then `getBoundingClientRect()` after writing `width` forces another → roughly **2 layouts per card ≈ 200 layouts**.

Fix — read once, compute, write in a batch:

```js
function resizeAll(cards) {
  const parentWidth = cards[0].parentElement.offsetWidth   // 1 read
  const cardWidth = parentWidth / 3
  requestAnimationFrame(() => {
    cards.forEach((card) => {
      card.style.width = cardWidth + 'px'
      card.querySelector('.title').style.fontSize = cardWidth / 10 + 'px'
    })
  })
}
```

Even better: express it in CSS (`width: calc(100% / 3)`; `font-size` via container query units `cqw`) and drop JS entirely.
:::

## Quick check

:::quiz
### Which property change can be handled by the compositor alone?
- [ ] width
- [ ] background-color
- [x] opacity
- [ ] margin-left
@@@explain
`opacity` and `transform` are compositor-friendly. Background color needs a repaint; width and margin need layout.
:::

:::quiz
### Which of these READS can force a synchronous layout?
- [ ] el.dataset.id
- [x] el.getBoundingClientRect()
- [ ] el.classList.contains('x')
- [ ] el.getAttribute('href')
@@@explain
Geometry reads need up-to-date layout. Attribute/class/dataset reads don't.
:::

:::quiz
### What does `{ passive: true }` on a scroll/touch listener do?
- [ ] Makes the listener run less often
- [x] Promises you won't call preventDefault, so scrolling doesn't wait for your handler
- [ ] Runs the handler on the compositor thread
- [ ] Debounces the handler
@@@explain
Passive listeners let the compositor scroll immediately instead of waiting to see if JS cancels the scroll.
:::
