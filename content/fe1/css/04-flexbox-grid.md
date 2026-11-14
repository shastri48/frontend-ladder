---
title: Flexbox & Grid
summary: The two modern layout systems — how flex distributes space along one axis, how grid places items in two dimensions, and when to use which.
minutes: 20
---

## Two tools, two jobs

- **Flexbox** is **one-dimensional**: it lays items out along a single axis (a row *or* a column) and distributes space between them. Content drives the layout.
- **Grid** is **two-dimensional**: you define rows *and* columns, then place items into the grid. The layout drives the content.

Experiment as you read:

:::visual layout-playground
:::

## Flexbox

```css
.toolbar {
  display: flex;
  flex-direction: row;        /* main axis: row (default) | column */
  justify-content: space-between; /* along the MAIN axis */
  align-items: center;        /* along the CROSS axis */
  gap: 12px;                  /* space between items */
  flex-wrap: wrap;            /* allow multiple lines */
}
```

```text
flex-direction: row
main axis  ─────────────────────────────▶   justify-content
┌────┐ ┌──────┐ ┌──┐                ▲
│ A  │ │  B   │ │C │   cross axis   │       align-items
└────┘ └──────┘ └──┘                ▼
```

With `flex-direction: column`, the axes swap — `justify-content` becomes vertical. This trips everyone up at least once.

### Container properties

| Property | Values |
|---|---|
| `flex-direction` | `row`, `row-reverse`, `column`, `column-reverse` |
| `justify-content` | `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly` |
| `align-items` | `stretch` (default), `flex-start`, `center`, `flex-end`, `baseline` |
| `flex-wrap` | `nowrap` (default), `wrap` |
| `align-content` | Distributes the *lines* when wrapping |
| `gap` | Space between items (no margin hacks needed) |

### Item properties: `flex-grow`, `flex-shrink`, `flex-basis`

```css
.item { flex: 1 1 200px; } /* grow shrink basis */
```

1. **`flex-basis`** — the starting size along the main axis (like `width` in a row). `auto` = use the item's width/content.
2. Add up all bases. If there's **leftover space**, distribute it in proportion to **`flex-grow`**.
3. If there's **not enough space**, shrink items in proportion to **`flex-shrink` × basis**.

Common shorthands:

| Shorthand | Means | Use |
|---|---|---|
| `flex: 1` | `1 1 0%` | Equal-width columns regardless of content |
| `flex: auto` | `1 1 auto` | Grow/shrink but start from content size |
| `flex: none` | `0 0 auto` | Fixed; never grow or shrink (icons, avatars) |
| `flex: 0 0 250px` | Fixed 250px | Sidebars |

Other item props: `align-self` (override cross alignment for one item), `order` (visual order — beware, keyboard/screen-reader order still follows the DOM).

:::callout tip The `min-width: 0` gotcha
Flex items default to `min-width: auto`, meaning they won't shrink smaller than their content. A long URL or a `pre` block inside a flex child can blow out the layout. Fix: `min-width: 0` (or `overflow: hidden`) on the flex item.
:::

### Classic flex patterns

```css
/* Perfect centering */
.center { display: flex; justify-content: center; align-items: center; }

/* Push last item to the right (e.g. logout in a nav) */
.nav { display: flex; gap: 1rem; }
.nav .logout { margin-left: auto; }

/* Sticky footer: footer at bottom on short pages */
body { min-height: 100svh; display: flex; flex-direction: column; }
main { flex: 1; }

/* Media object: avatar + text */
.media { display: flex; gap: 12px; align-items: flex-start; }
.media img { flex: none; }
.media .body { flex: 1; min-width: 0; }
```

## Grid

```css
.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* 3 equal columns */
  grid-auto-rows: 200px;
  gap: 16px;
}
```

- **Tracks** = rows and columns. **Lines** are numbered starting at 1 (negative numbers count from the end: `-1` is the last line).
- **`fr`** = a fraction of the remaining free space.
- **`repeat()`**, **`minmax(min, max)`**.

### The most useful line of CSS: responsive cards without media queries

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
  gap: 1rem;
}
```

"Fit as many columns of at least 240px as possible; stretch them to fill." On a phone: 1 column. Tablet: 2–3. Desktop: 4–5. (`auto-fit` collapses empty tracks so few items stretch to fill the row; `auto-fill` keeps empty tracks.)

### Placing items

```css
.feature { grid-column: 1 / 3; }      /* from line 1 to line 3 = span 2 columns */
.feature { grid-column: span 2; grid-row: span 2; }
.full    { grid-column: 1 / -1; }     /* full width */
```

### Named areas — layouts you can read

```css
.page {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  min-height: 100svh;
}
header  { grid-area: header; }
aside   { grid-area: sidebar; }
main    { grid-area: main; }
footer  { grid-area: footer; }

@media (max-width: 700px) {
  .page {
    grid-template-columns: 1fr;
    grid-template-areas: "header" "main" "sidebar" "footer";
  }
}
```

### Alignment in grid

`justify-items` / `align-items` align items inside their cells (inline / block axis); `justify-content` / `align-content` align the whole grid inside the container; `place-items: center` is shorthand for both. `display: grid; place-items: center;` is the shortest way to center a single child.

### Subgrid

`grid-template-columns: subgrid` lets a nested grid reuse its parent's tracks — perfect for card lists where titles, images and buttons must line up across cards.

## Flexbox vs Grid: when to use which

| Situation | Choose |
|---|---|
| Items in a single row/column, sizes driven by content (navbar, toolbar, button group, tags) | **Flexbox** |
| Distribute space between a few items, push one to the end | **Flexbox** |
| Two-dimensional page layout (header/sidebar/main/footer) | **Grid** |
| Card galleries where columns must line up across rows | **Grid** |
| Overlapping elements (text on top of an image) without absolute positioning | **Grid** (place both in the same cell) |
| Unknown number of items that should wrap but stay aligned in columns | **Grid** (`auto-fill` + `minmax`) |

They combine naturally: grid for the page skeleton, flex inside components.

:::question
difficulty: easy
companies: Meta, Google
### Explain CSS Grid vs Flexbox and when to use each.
Flexbox is a one-dimensional layout model: it arranges items along a main axis and distributes free space with `flex-grow/shrink/basis`; layout is content-driven. Grid is two-dimensional: you define row and column tracks (`fr`, `minmax`, `repeat`, named areas) and place items into them; layout is container-driven, and items align in both directions. Use flex for components and one-direction arrangements (navbars, toolbars, centering, media objects); use grid for page layouts, galleries/card lists with aligned columns, and overlapping content. They're complementary — grid for structure, flex within cells.
:::

:::question
difficulty: medium
### What do `flex-grow`, `flex-shrink` and `flex-basis` do? What does `flex: 1` mean?
`flex-basis` is the item's initial main-axis size before free space is distributed. If the container has extra space, it's handed out proportionally to `flex-grow`. If items overflow, they shrink proportionally to `flex-shrink` weighted by their basis. `flex: 1` = `flex: 1 1 0%`: start from zero and grow equally — so items get equal widths regardless of content. `flex: auto` = `1 1 auto` starts from the content size, so wider content gets wider columns.
:::

:::question
difficulty: easy
### How many ways can you center a div?
- Flex: `display:flex; justify-content:center; align-items:center;` on the parent.
- Grid: `display:grid; place-items:center;` on the parent.
- Flex/grid child: `margin: auto` (centers both axes inside a flex/grid container).
- Absolute: `position:absolute; inset:0; margin:auto;` with a fixed size, or `top:50%; left:50%; transform:translate(-50%,-50%)`.
- Horizontal only (block with width): `margin-inline: auto`. Text/inline content: `text-align: center`.
:::

:::question
difficulty: medium
### What's the difference between `auto-fill` and `auto-fit`?
Both create as many tracks as fit. With `auto-fill`, leftover empty tracks are kept, so a row with few items leaves empty columns. With `auto-fit`, empty tracks collapse to zero, so the existing items stretch (when using `1fr` max) to fill the row. They only differ when there are fewer items than columns that would fit.
:::

:::challenge
difficulty: easy
companies: Google
### Center a div — both axes, any size
Center a `.modal` box horizontally and vertically inside the viewport, with a dark backdrop, without knowing the modal's size. Give two solutions.
@@@solution
**Grid (shortest):**
```css
.backdrop {
  position: fixed;
  inset: 0;                     /* top/right/bottom/left: 0 */
  background: rgb(0 0 0 / 0.5);
  display: grid;
  place-items: center;
  padding: 1rem;                /* breathing room on phones */
}
.modal { max-width: 480px; width: 100%; max-height: 100%; overflow: auto; }
```
**Flex:**
```css
.backdrop {
  position: fixed; inset: 0;
  display: flex; justify-content: center; align-items: center;
}
```
**Without flex/grid (legacy):**
```css
.modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); }
```
`transform` percentages refer to the element's own size, which is why this works for unknown sizes — but it can produce blurry text on half-pixels, and a tall modal can overflow the top of the screen. Grid/flex + `max-height` + `overflow: auto` is the robust choice.
:::

:::challenge
difficulty: medium
### Holy grail layout
Build the "holy grail" layout: header, footer, a main column with a left nav and a right aside. Requirements: footer sticks to the bottom on short pages; nav 200px, aside 250px, main fluid; on screens < 768px everything stacks (header, nav, main, aside, footer). Use semantic HTML.
@@@solution
```html
<body class="page">
  <header>Header</header>
  <nav>Nav</nav>
  <main>Main content</main>
  <aside>Aside</aside>
  <footer>Footer</footer>
</body>
```
```css
.page {
  min-height: 100svh;
  margin: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 250px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header header"
    "nav    main   aside"
    "footer footer footer";
}
header { grid-area: header; }
nav    { grid-area: nav; }
main   { grid-area: main; }
aside  { grid-area: aside; }
footer { grid-area: footer; }

@media (max-width: 767px) {
  .page {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr auto auto;
    grid-template-areas: "header" "nav" "main" "aside" "footer";
  }
}
```
Why it works:
- `grid-template-rows: auto 1fr auto` + `min-height: 100svh` → the middle row takes all leftover space, so the footer sits at the bottom even with little content.
- `minmax(0, 1fr)` instead of `1fr` lets the main column shrink below its content's min size (prevents overflow from long words/code).
- Named areas make the responsive change a readable re-mapping. DOM order (nav before main) stays logical for keyboard and screen-reader users; only the visual placement changes.
:::

:::quiz
### With `flex-direction: column`, which property centers items vertically?
- [x] `justify-content: center`
- [ ] `align-items: center`
- [ ] `text-align: center`
@@@explain
In a column, the main axis is vertical, and `justify-content` works on the main axis.
:::

:::quiz
### What does `grid-column: 1 / -1` do?
- [ ] Places the item in the last column
- [x] Spans from the first to the last grid line — full width
- [ ] Hides the item
@@@explain
Negative line numbers count from the end; `-1` is the final line.
:::

:::quiz
### A long URL makes your flex child overflow. The fix is usually…
- [ ] `flex-shrink: 0`
- [x] `min-width: 0` on the flex item
- [ ] `display: block`
@@@explain
Flex items default to `min-width: auto` (don't shrink below content). Setting it to 0 allows shrinking and wrapping.
:::
