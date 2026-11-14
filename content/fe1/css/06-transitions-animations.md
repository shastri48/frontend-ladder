---
title: Transitions, Transforms & Animations
summary: Make interfaces feel alive — transitions, keyframe animations, transforms, timing functions, and why transform/opacity animate smoothly while width/top don't.
minutes: 14
---

## Motion with purpose

Good motion explains change: a menu slides from the button that opened it, a toast fades in, a card lifts on hover. Bad motion is slow, janky, or makes people dizzy. CSS gives you three tools: **transforms** (move/scale/rotate without affecting layout), **transitions** (animate between two states), and **keyframe animations** (multi-step, can loop and run on their own).

## Transforms

```css
.card:hover { transform: translateY(-4px) scale(1.02); }
.icon { transform: rotate(45deg); }
.flip { transform: scaleX(-1); }
.tilt { transform: perspective(600px) rotateY(15deg); }
```

- `translate(x, y)`, `scale()`, `rotate()`, `skew()` and their 3D versions.
- Percentages in `translate` refer to the **element's own size** (`translate(-50%, -50%)` centering trick).
- `transform-origin` sets the pivot (`top left`, `center`).
- Transforms **don't affect layout** — neighbours don't move. That's precisely why they're cheap.
- Individual properties exist too: `translate: 0 -4px; scale: 1.02; rotate: 45deg;`.

## Transitions

A transition animates a property when its value **changes** (hover, class toggle, JS):

```css
.button {
  background: #6366f1;
  transform: translateY(0);
  transition: background-color 150ms ease, transform 150ms ease;
}
.button:hover { background: #4f46e5; transform: translateY(-2px); }
```

`transition: <property> <duration> <timing-function> <delay>`. Avoid `transition: all` — it animates things you didn't intend (and can be expensive).

### Timing functions

| Function | Feel | Use |
|---|---|---|
| `linear` | Robotic | Progress bars, spinners |
| `ease` (default) | Gentle | General |
| `ease-out` | Fast start, soft landing | Elements **entering** (feels responsive) |
| `ease-in` | Slow start, fast end | Elements **leaving** |
| `ease-in-out` | Smooth both ends | Moving between positions |
| `cubic-bezier(.2,.8,.2,1)` | Custom | Brand motion |
| `steps(4)` | Discrete jumps | Sprite animations, typewriter |

Durations: 100–200ms for small UI feedback (hover, toggles), 200–400ms for larger movements (modals, drawers). Anything over ~500ms feels sluggish.

### Can't transition `display` or `height: auto`?

Historically you couldn't animate to `height: auto` or from `display: none`. Workarounds: animate `grid-template-rows: 0fr → 1fr`, or `max-height`. Modern CSS adds `interpolate-size: allow-keywords`, `transition-behavior: allow-discrete` and `@starting-style` for enter animations.

```css
/* Accordion height animation trick */
.panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 250ms ease; }
.panel.open { grid-template-rows: 1fr; }
.panel > .inner { overflow: hidden; }
```

## Keyframe animations

```css
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.1); opacity: 0.7; }
}
.live-dot { animation: pulse 1.5s ease-in-out infinite; }

@keyframes spin { to { transform: rotate(360deg); } }
.spinner { animation: spin 0.8s linear infinite; }

@keyframes slide-up {
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.toast { animation: slide-up 250ms ease-out both; }
```

`animation: name duration timing delay iteration-count direction fill-mode play-state`. `fill-mode: both/forwards` keeps the end state after finishing. JS can listen to `animationend` / `transitionend`.

## Why `transform` and `opacity` are preferred for animation

To understand this you need the rendering pipeline (covered deeply in FE2):

```text
JavaScript → Style → Layout → Paint → Composite
```

| Animating… | Triggers | Cost per frame |
|---|---|---|
| `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size` | **Layout** (reflow) → paint → composite | Expensive; other elements may move; main thread |
| `color`, `background`, `box-shadow`, `border-radius` | **Paint** → composite | Medium |
| `transform`, `opacity` (and `filter` in many cases) | **Composite only** | Cheap; can run on the **compositor thread/GPU** even if the main thread is busy |

At 60fps you have ~16ms per frame. Animating `left` re-runs layout for possibly the whole page every frame → dropped frames ("jank"). Animating `transform: translateX()` just moves an already-painted layer on the GPU.

:::visual rendering-pipeline
:::

```css
/* ❌ janky */
.drawer { left: -300px; transition: left 300ms; }
.drawer.open { left: 0; }

/* ✅ smooth */
.drawer { transform: translateX(-100%); transition: transform 300ms ease-out; }
.drawer.open { transform: translateX(0); }
```

`will-change: transform` hints the browser to promote the element to its own layer ahead of time. Use it sparingly (each layer costs GPU memory) — add it right before an animation, not on hundreds of elements.

## Respect reduced motion

Some users get nausea or migraines from motion (vestibular disorders). Honour their OS setting:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## JavaScript-driven animation

For animations that depend on runtime values, use the **Web Animations API** (`el.animate(keyframes, options)`) or `requestAnimationFrame` — never `setInterval`, which isn't synced to the display's refresh and keeps running in background tabs.

```js
el.animate(
  [{ transform: 'scale(0.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
  { duration: 200, easing: 'ease-out', fill: 'both' }
)
```

:::question
difficulty: medium
companies: Tekion
### Why is `transform` preferred for CSS animations over `top`/`left`/`width`?
Changing `top/left/width` affects geometry, so every frame the browser must recalculate **layout** (reflow) and then **repaint** — on the main thread, possibly for many elements. `transform` (and `opacity`) only affect **compositing**: the element is painted once into a layer and the GPU/compositor thread moves, scales or fades it. That keeps frames under the 16ms budget and stays smooth even when JavaScript is busy on the main thread. `will-change: transform` can promote the layer in advance, but overusing it wastes memory.
:::

:::question
difficulty: easy
### What is the difference between a CSS transition and a CSS animation?
A **transition** interpolates a property between two states when its value changes (needs a trigger like `:hover` or a class change) and runs once. An **animation** uses `@keyframes` with any number of steps, can start on its own (on page load), loop (`infinite`), alternate direction, pause, and hold end states with `fill-mode`. Use transitions for state changes, animations for loading spinners, attention cues and entrance effects.
:::

:::question
difficulty: medium
### How do you animate an element to `height: auto`?
Options: (1) animate `grid-template-rows` from `0fr` to `1fr` on a grid wrapper with `overflow: hidden` on the child — clean and fully CSS; (2) animate `max-height` to a value larger than the content (imprecise timing); (3) measure `scrollHeight` with JS and animate to that pixel value, or use the Web Animations API; (4) in modern browsers, `interpolate-size: allow-keywords` lets you transition to `auto` directly. Note: height animations trigger layout each frame; for big content consider a `transform`-based reveal.
:::

:::challenge
difficulty: easy
### Build a CSS-only loading spinner
Create a 40px circular spinner (grey ring with a coloured quarter) that rotates smoothly, is announced to screen readers as "Loading", and stops spinning for users who prefer reduced motion.
@@@solution
```html
<div class="spinner" role="status">
  <span class="sr-only">Loading…</span>
</div>
```
```css
.spinner {
  width: 40px;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 4px solid #e2e8f0;
  border-top-color: #6366f1;          /* the coloured quarter */
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .spinner { animation-duration: 2.4s; } /* or replace with a pulsing/static indicator */
}

.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
```
- Rotation uses `transform` → compositor-only, smooth even under main-thread load.
- `linear` timing: rotation shouldn't ease.
- `role="status"` + visually hidden text makes it announce politely without being visible.
:::

:::quiz
### Which property is the cheapest to animate?
- [ ] `left`
- [ ] `box-shadow`
- [x] `opacity`
@@@explain
`opacity` and `transform` are composite-only.
:::

:::quiz
### An element is entering the screen. Which easing usually feels best?
- [x] `ease-out`
- [ ] `ease-in`
- [ ] `linear`
@@@explain
Fast start then deceleration feels responsive for entrances; `ease-in` suits exits.
:::
