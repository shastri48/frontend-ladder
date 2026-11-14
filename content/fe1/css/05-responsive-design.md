---
title: Responsive Design & Mobile-First
summary: Viewport, fluid layouts, media queries, mobile-first CSS, container queries, responsive images and the hamburger navbar challenge.
minutes: 18
---

## One codebase, every screen

**Responsive design** means the same HTML adapts its layout to the screen: phone, tablet, laptop, ultra-wide, even a watch or TV. The three original ingredients (Ethan Marcotte, 2010) still hold:

1. **Fluid grids** — relative widths (`%`, `fr`, `minmax`) instead of fixed pixels.
2. **Flexible media** — `img { max-width: 100%; height: auto; }`.
3. **Media queries** — change layout at breakpoints.

Plus the modern additions: Flexbox/Grid, `clamp()` fluid type, container queries and user-preference queries.

## Step zero: the viewport meta tag

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

Without it, mobile browsers pretend to be ~980px wide and zoom out, and your media queries never fire. Never add `maximum-scale=1` / `user-scalable=no` — it blocks pinch-zoom for low-vision users.

## Media queries

```css
/* Base styles: mobile */
.grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }

/* Tablet and up */
@media (min-width: 48em) {   /* 768px */
  .grid { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop and up */
@media (min-width: 64em) {   /* 1024px */
  .grid { grid-template-columns: repeat(4, 1fr); }
}
```

Modern range syntax is cleaner: `@media (48em <= width < 64em) { … }`.

Beyond width, query **capabilities and preferences**:

```css
@media (hover: hover) and (pointer: fine) { .card:hover { transform: translateY(-2px); } } /* real mouse */
@media (pointer: coarse) { button { min-height: 44px; } }   /* touch */
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
@media (prefers-color-scheme: dark) { :root { --bg: #0b1020; } }
@media (orientation: landscape) { … }
@media print { nav, .ads { display: none; } }
```

## Mobile-first vs desktop-first

| | Mobile-first | Desktop-first |
|---|---|---|
| Base CSS | Phone layout | Desktop layout |
| Queries | `min-width` adds complexity as screens grow | `max-width` removes/overrides for smaller screens |
| Result | Phones download and parse the simplest CSS; progressive enhancement | Phones carry desktop CSS and lots of overrides |

**Mobile-first is the recommended default**: the small-screen layout is usually simpler (one column), so you add rather than undo. It also forces content prioritization — what really matters?

### Choosing breakpoints

Don't pick breakpoints from device lists ("iPhone 15 = 393px"). Make the window narrower until the design **breaks** (lines too long, cards squashed) and put a breakpoint there. Common ballpark: ~40em, ~48em, ~64em, ~80em. Using `em` in media queries makes them respect the user's font size setting.

## Container queries: responsive components

Media queries look at the **viewport**. But a card might be in a wide main column on one page and a narrow sidebar on another. **Container queries** let a component respond to **its container's** size:

```css
.card-wrapper { container-type: inline-size; container-name: card; }

.card { display: grid; gap: 1rem; }
@container card (min-width: 400px) {
  .card { grid-template-columns: 150px 1fr; } /* side-by-side when there's room */
}
```

This is the future of design-system components: they're responsive wherever you drop them.

## Fluid everything

```css
:root {
  --step-0: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --step-3: clamp(1.75rem, 1.2rem + 2.5vw, 3rem);
  --gutter: clamp(1rem, 4vw, 2rem);
}
body { font-size: var(--step-0); }
h1 { font-size: var(--step-3); }
.container { width: min(100% - 2 * var(--gutter), 72rem); margin-inline: auto; }
```

Fewer breakpoints, smoother scaling.

## Responsive images recap

- `max-width: 100%; height: auto;` so images never overflow.
- `srcset` + `sizes` for resolution switching; `<picture>` for art direction.
- `aspect-ratio` / `object-fit: cover` for consistent thumbnails.

## Touch and mobile UX

- Touch targets ≥ 44×44px with spacing.
- Don't rely on hover to reveal essential actions.
- Use appropriate input types (`email`, `tel`, `inputmode`).
- Avoid horizontal scrolling; test at 320px width.
- Watch out for `position: fixed` + on-screen keyboard; use `dvh`/`svh`.

## Testing

- DevTools device toolbar (Cmd/Ctrl + Shift + M) — also throttle CPU/network.
- Real devices: at least one iPhone (Safari/WebKit) and one Android.
- Zoom to 200% and check nothing breaks.

:::question
difficulty: easy
companies: Walmart
### How do you implement responsive design in a modern web app?
Viewport meta tag; mobile-first CSS with fluid layouts (Flexbox, Grid with `auto-fill/minmax`, `%`/`fr` units); content-driven breakpoints with `min-width` media queries (in `em`); fluid typography and spacing with `clamp()`; responsive images (`max-width: 100%`, `srcset`/`sizes`, `<picture>`); container queries for reusable components; preference queries (`prefers-reduced-motion`, `prefers-color-scheme`, `pointer: coarse`); adequate touch targets; and testing on real devices and at 200% zoom.
:::

:::question
difficulty: easy
### What is mobile-first design and why is it preferred?
Writing base styles for the smallest screens and layering enhancements with `min-width` media queries. Benefits: simpler base CSS (single column), phones don't download/parse desktop overrides, it encourages content prioritization and progressive enhancement, and it matches where most traffic comes from.
:::

:::question
difficulty: medium
### What's the difference between media queries and container queries?
Media queries respond to the **viewport/device** (width, orientation, preferences). Container queries respond to the size (or style) of a **specific ancestor container** marked with `container-type`. Use media queries for page-level layout; container queries for components that may be placed in containers of different widths (sidebar vs main), making them truly reusable.
:::

:::question
difficulty: medium
companies: Agoda
### How would you design a layout for mobile, tablet and desktop? What would you check?
Start mobile-first with a single column and a clear content hierarchy. Use a grid such as `repeat(auto-fill, minmax(min(16rem, 100%), 1fr))` for cards, named grid areas for the page (stack on mobile, sidebar on tablet+, extra column on desktop), and flex for components. Check: no horizontal scroll at 320px, line length ≤ ~75ch, touch targets, readable font sizes without zoom, images not overflowing or distorted, hover-only interactions have touch equivalents, fixed headers don't eat small screens, landscape phones, 200% zoom, and keyboard focus order still matches visual order.
:::

:::challenge
difficulty: medium
companies: Walmart, Meta
### Responsive navbar that collapses into a hamburger menu
Write HTML + CSS (+ minimal JS) for a navbar with a logo and 4 links. On screens ≥ 768px the links are in a row on the right. Below 768px, the links are hidden behind an accessible hamburger button that toggles a vertical menu. Requirements: keyboard accessible, announces state to screen readers, closes with Escape, no layout jump, works mobile-first.
@@@solution
```html
<header class="site-header">
  <nav class="nav" aria-label="Primary">
    <a href="/" class="logo">KeyCo</a>

    <button class="nav-toggle" type="button"
            aria-expanded="false" aria-controls="nav-menu" aria-label="Open menu">
      <span class="bar" aria-hidden="true"></span>
      <span class="bar" aria-hidden="true"></span>
      <span class="bar" aria-hidden="true"></span>
    </button>

    <ul id="nav-menu" class="nav-menu">
      <li><a href="/shop" aria-current="page">Shop</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/blog">Blog</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </nav>
</header>
```

```css
*, *::before, *::after { box-sizing: border-box; }

.site-header { background: #0f172a; color: white; }
.nav {
  display: flex;
  flex-wrap: wrap;               /* menu drops to its own line on mobile */
  align-items: center;
  justify-content: space-between;
  max-width: 72rem;
  margin-inline: auto;
  padding: 0.75rem 1rem;
}
.logo { color: inherit; font-weight: 700; text-decoration: none; font-size: 1.25rem; }

/* ---- Mobile (base) ---- */
.nav-toggle {
  display: inline-flex; flex-direction: column; justify-content: center; gap: 5px;
  width: 44px; height: 44px; padding: 10px;           /* 44px touch target */
  background: transparent; border: 0; cursor: pointer;
}
.bar { display: block; height: 2px; background: white; border-radius: 2px;
       transition: transform .2s, opacity .2s; }
.nav-toggle[aria-expanded="true"] .bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.nav-toggle[aria-expanded="true"] .bar:nth-child(2) { opacity: 0; }
.nav-toggle[aria-expanded="true"] .bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

.nav-menu {
  display: none;                 /* hidden on mobile until toggled */
  flex-basis: 100%;              /* full-width row under logo + button */
  list-style: none; margin: 0; padding: 0.5rem 0 0;
}
.nav-menu.is-open { display: block; }
.nav-menu a {
  display: block; padding: 0.75rem 0.5rem;
  color: #cbd5e1; text-decoration: none; border-radius: 6px;
}
.nav-menu a:hover, .nav-menu a[aria-current="page"] { color: white; background: #1e293b; }
.nav-menu a:focus-visible, .nav-toggle:focus-visible { outline: 3px solid #818cf8; outline-offset: 2px; }

/* ---- Tablet / desktop ---- */
@media (min-width: 48em) {
  .nav-toggle { display: none; }
  .nav-menu, .nav-menu.is-open {
    display: flex; gap: 0.25rem; flex-basis: auto; padding: 0;
  }
}

@media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
```

```js
const toggle = document.querySelector('.nav-toggle')
const menu = document.getElementById('nav-menu')

function setOpen(open) {
  toggle.setAttribute('aria-expanded', String(open))
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  menu.classList.toggle('is-open', open)
}

toggle.addEventListener('click', () => {
  setOpen(toggle.getAttribute('aria-expanded') !== 'true')
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    setOpen(false)
    toggle.focus()
  }
})

// Reset state when resizing to desktop
matchMedia('(min-width: 48em)').addEventListener('change', (e) => { if (e.matches) setOpen(false) })
```

**Design decisions to talk through in the interview**
- **Mobile-first:** base CSS is the collapsed menu; the `min-width` query upgrades to a horizontal list.
- **Semantics:** `<nav aria-label>`, a real `<ul>` of links, `aria-current="page"` for the active link.
- **The toggle is a `<button>`** with `aria-expanded` + `aria-controls`, so screen readers announce "Open menu, button, collapsed". The icon bars are `aria-hidden`.
- **`display: none`** when closed removes links from the tab order (with `visibility`/`opacity`-only hiding, keyboard users would tab into invisible links).
- **No layout jump:** `flex-wrap` + `flex-basis: 100%` drops the menu onto its own line below the header.
- **Escape closes and returns focus;** the matchMedia listener resets state on resize.
- **CSS-only alternative:** a hidden checkbox + `:checked ~ .nav-menu` works without JS, but announces as a checkbox — the button version is more accessible. A modern alternative is the Popover API (`popover` attribute).
:::

:::quiz
### What does `repeat(auto-fill, minmax(240px, 1fr))` achieve?
- [ ] Always 4 columns
- [x] As many ≥240px columns as fit, each stretching to fill the row
- [ ] One column of 240px
@@@explain
It's the classic media-query-free responsive card grid.
:::

:::quiz
### In mobile-first CSS, media queries mostly use…
- [x] `min-width`
- [ ] `max-width`
- [ ] `orientation`
@@@explain
Base styles target small screens; `min-width` queries add enhancements as space grows.
:::

:::quiz
### Why avoid `user-scalable=no` in the viewport tag?
- [ ] It breaks media queries
- [x] It prevents users with low vision from pinch-zooming
- [ ] It disables CSS Grid
@@@explain
Blocking zoom is an accessibility failure (WCAG 1.4.4 Resize Text).
:::
