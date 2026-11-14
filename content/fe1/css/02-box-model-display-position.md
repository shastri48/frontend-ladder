---
title: Box Model, Display & Positioning
summary: Every element is a box. Learn content/padding/border/margin, box-sizing, margin collapse, display types, positioning, stacking contexts and z-index.
minutes: 18
---

## Everything is a box

The browser draws every element as a rectangle made of four layers:

```text
┌──────────────── margin (transparent, outside) ────────────────┐
│  ┌───────────── border ─────────────────────────────────────┐ │
│  │  ┌────────── padding (inside, has background) ─────────┐ │ │
│  │  │                                                     │ │ │
│  │  │                 content (width × height)            │ │ │
│  │  │                                                     │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

- **Content** — text, images, children.
- **Padding** — space *inside* the border; the background colour shows through it.
- **Border** — the edge line.
- **Margin** — space *outside*, between this box and its neighbours; always transparent.

Play with it:

:::visual box-model
:::

## `box-sizing`: the property you set once

By default (`content-box`), `width` sets the **content** width only. Padding and border are **added**:

```css
.box { width: 200px; padding: 20px; border: 5px solid; }
/* content-box: rendered width = 200 + 20*2 + 5*2 = 250px  😬 */
/* border-box:  rendered width = 200px; content shrinks to 150px ✅ */
```

Almost every project starts with:

```css
*, *::before, *::after { box-sizing: border-box; }
```

so `width: 50%` means 50% — padding included. Much easier to reason about.

## Margin collapsing

**Vertical** margins of adjacent block elements **collapse** into a single margin equal to the larger one:

```css
h2 { margin-bottom: 24px; }
p  { margin-top: 16px; }
/* gap between them = 24px, not 40px */
```

It also happens between a parent and its first/last child if nothing (padding, border, inline content) separates them — the child's margin "leaks" out of the parent. Margins **don't** collapse in flex or grid containers, for horizontal margins, or for floated/absolutely positioned elements. Many teams avoid the issue by using `gap` in flex/grid layouts and only `margin-bottom` (one direction) elsewhere.

## Display types

`display` controls two things: how the box behaves **outside** (participates in its parent's flow) and how it lays out its **children** inside.

| Value | Behaviour |
|---|---|
| `block` | Starts on a new line, takes full available width, respects width/height/margins (`div`, `p`, `h1`, `section`) |
| `inline` | Flows within text; **width/height ignored**, vertical margins don't push lines (`span`, `a`, `strong`) |
| `inline-block` | Flows inline but respects width/height/padding/margins (good for badges, buttons) |
| `flex` / `inline-flex` | Children laid out along one axis |
| `grid` / `inline-grid` | Children laid out in rows and columns |
| `none` | Removed from layout and accessibility tree entirely |
| `contents` | The element's box disappears; children act as children of its parent |

### Hiding things — compare

| Technique | Takes space? | Clickable? | Screen readers? | Triggers layout on toggle? |
|---|---|---|---|---|
| `display: none` | No | No | Hidden | Yes |
| `visibility: hidden` | Yes | No | Hidden | No (repaint only) |
| `opacity: 0` | Yes | **Yes** | Still read | No (composite only) |
| `.sr-only` (visually hidden) | No (1px) | — | **Read** | — |

```css
/* visible only to screen readers */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
```

## Positioning

`position` decides how an element is placed relative to normal flow:

| Value | In normal flow? | Positioned relative to | Typical use |
|---|---|---|---|
| `static` (default) | Yes | — (`top/left` ignored) | Everything |
| `relative` | Yes (original space kept) | Its own normal position | Nudging; making a **containing block** for absolute children |
| `absolute` | **No** | Nearest **positioned** ancestor (non-static), else the initial containing block | Badges, dropdowns, tooltips |
| `fixed` | No | The **viewport** (unless an ancestor has `transform`/`filter`!) | Sticky headers, FABs, modals |
| `sticky` | Yes, until threshold | Scroll container; acts relative then "sticks" at `top: 0` | Table headers, section titles |

```css
.card { position: relative; }           /* the anchor */
.card .badge {
  position: absolute; top: 8px; right: 8px; /* relative to .card */
}
```

:::callout warn Sticky not sticking?
`position: sticky` fails when an ancestor has `overflow: hidden/auto/scroll` (it sticks inside that scroll container instead), when you forgot `top`, or when the parent is no taller than the element.
:::

## z-index and stacking contexts

`z-index` only works on positioned elements (and flex/grid children). But the real gotcha is **stacking contexts**: z-index values are only compared **within the same stacking context**. A new context is created by e.g. `position` + `z-index` (not auto), `opacity < 1`, `transform`, `filter`, `will-change`, `isolation: isolate`, `position: fixed/sticky`.

```html
<div class="a" style="position:relative; z-index:1">
  <div class="modal" style="position:fixed; z-index:9999">I'm trapped!</div>
</div>
<div class="b" style="position:relative; z-index:2">I'm on top of the modal</div>
```

The modal's 9999 only competes inside `.a`'s context, and `.a` (1) is below `.b` (2). Fix: render modals at the end of `<body>` (React **portals**), and keep a small z-index scale (`--z-dropdown: 10; --z-modal: 100; --z-toast: 1000`).

## Overflow

`overflow: visible | hidden | scroll | auto | clip` controls content that's bigger than its box. `overflow: auto` adds scrollbars only when needed. `text-overflow: ellipsis` needs `white-space: nowrap` + `overflow: hidden` + a width. Multi-line truncation: `-webkit-line-clamp: 3` with `display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden`.

:::question
difficulty: easy
### Explain the CSS box model and `box-sizing`.
Each element is a box of content, padding, border and margin. With the default `box-sizing: content-box`, `width`/`height` apply to the content only, so padding and border increase the rendered size. With `border-box`, `width`/`height` include padding and border, and content shrinks to fit — far more intuitive, so most projects apply `border-box` globally. Margins are always outside and never included.
:::

:::question
difficulty: medium
### What is margin collapsing?
Adjacent vertical margins of block-level boxes in normal flow combine into one margin equal to the largest (or the sum for negative + positive cases). It happens between siblings, between a parent and its first/last child when no padding/border/content separates them, and for empty blocks. It doesn't happen in flex/grid containers, with horizontal margins, floats, absolutely positioned elements, or elements that create a new block formatting context (e.g. `display: flow-root`, `overflow: hidden`).
:::

:::question
difficulty: medium
### Explain `relative`, `absolute`, `fixed` and `sticky` positioning.
- `relative`: stays in flow; `top/left` offset it visually from its normal spot; establishes a containing block for absolute children.
- `absolute`: removed from flow; positioned against the nearest ancestor whose `position` isn't `static` (or the initial containing block).
- `fixed`: removed from flow; positioned against the viewport — unless an ancestor has `transform`, `filter` or `perspective`, which becomes its containing block.
- `sticky`: in flow like relative until its scroll container scrolls past the threshold (`top: 0`), then sticks; limited by its parent's bounds and broken by `overflow` on ancestors.
:::

:::question
difficulty: medium
### Why doesn't my `z-index: 9999` put the element on top?
Either the element isn't positioned (z-index needs `position` other than static, or a flex/grid item), or — usually — it's inside a **stacking context** created by an ancestor (`opacity < 1`, `transform`, `filter`, positioned + z-index, `isolation: isolate`…). z-index only competes with siblings in the same context, so the whole ancestor group is ordered by the ancestor's z-index. Fix by moving the element out (portal to body) or adjusting the ancestor.
:::

:::question
difficulty: easy
### Difference between `display: none`, `visibility: hidden` and `opacity: 0`?
`display: none` removes the element from layout and the accessibility tree (toggling causes reflow). `visibility: hidden` keeps its space but hides it from view, clicks and screen readers. `opacity: 0` keeps space, stays clickable and is still read by screen readers — and can be animated cheaply on the compositor.
:::

:::challenge
difficulty: easy
### Calculate the rendered width
```css
.a { box-sizing: content-box; width: 300px; padding: 10px 20px; border: 2px solid; margin: 0 15px; }
.b { box-sizing: border-box;  width: 300px; padding: 10px 20px; border: 2px solid; margin: 0 15px; }
```
What is the rendered (border-box) width of each, and how much horizontal space does each take up including margin?
@@@solution
- `.a` (content-box): 300 + 20×2 padding + 2×2 border = **344px** rendered; with margins 344 + 30 = **374px** of space.
- `.b` (border-box): **300px** rendered (content is 300 − 40 − 4 = 256px); with margins **330px**.

`padding: 10px 20px` means 10px top/bottom, 20px left/right — only the horizontal values matter here.
:::

:::challenge
difficulty: easy
### Badge on a card
Place a "NEW" badge in the top-right corner of a product card, overlapping the corner by 8px, without affecting the card's layout.
@@@solution
```html
<article class="card">
  <span class="badge">NEW</span>
  <img src="k1.jpg" alt="K1 keyboard" />
  <h3>K1</h3>
</article>
```
```css
.card {
  position: relative;      /* containing block for the badge */
  border-radius: 12px;
  padding: 16px;
  background: white;
}
.badge {
  position: absolute;      /* out of flow: card layout unaffected */
  top: -8px;
  right: -8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: crimson;
  color: white;
  font: 600 12px/1.6 system-ui;
}
```
`position: relative` on the card is the key: without it, the badge would position against some far-away ancestor (or the page). If the card had `overflow: hidden`, the overlapping part would be clipped.
:::

:::quiz
### With `box-sizing: border-box; width: 200px; padding: 20px`, what's the content width?
- [ ] 200px
- [x] 160px
- [ ] 240px
@@@explain
Border-box includes padding: 200 − 20 − 20 = 160.
:::

:::quiz
### An `absolute` element is positioned relative to…
- [ ] Its parent, always
- [x] Its nearest positioned (non-static) ancestor
- [ ] The viewport
@@@explain
If no ancestor is positioned, the initial containing block (the page) is used.
:::

:::quiz
### Which one keeps the element clickable while invisible?
- [ ] `display: none`
- [ ] `visibility: hidden`
- [x] `opacity: 0`
@@@explain
Opacity only affects painting; the element still receives pointer events.
:::
