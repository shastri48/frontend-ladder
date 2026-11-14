---
title: CSS Units, rem vs em & Custom Properties
summary: Absolute vs relative units, why rem is usually right, viewport units on mobile, clamp() for fluid type, and CSS variables for theming.
minutes: 14
---

## Absolute vs relative units

| Unit | Relative to | Use for |
|---|---|---|
| `px` | A "CSS pixel" (1/96 inch at standard density, not a device pixel) | Borders, shadows, small fixed details |
| `%` | Parent's corresponding size (width → parent width; padding/margin % → parent **width**, even vertical!) | Fluid widths |
| `em` | The element's **own** `font-size` (for `font-size` itself: the parent's) | Spacing that should scale with a component's text (button padding, icon size) |
| `rem` | The **root** (`html`) font-size, default 16px | Font sizes, spacing, media queries — consistent and respects user settings |
| `vw` / `vh` | 1% of viewport width / height | Full-screen sections, fluid type |
| `svh` / `lvh` / `dvh` | Small / large / dynamic viewport height | Mobile full-height layouts |
| `ch` | Width of the "0" character | Readable line length: `max-width: 65ch` |
| `fr` | Fraction of free space in a grid | Grid tracks |
| `cqw` / `cqi` | Container query container size | Component-responsive sizing |

## rem vs em — the classic interview question

Both are relative to a font-size. The difference is **which** font-size:

- **`rem`** = "root em" → always relative to `html`'s font-size. `1.5rem` is 24px everywhere (with a 16px root).
- **`em`** → relative to the **current element's** font-size, which itself may be inherited — so **em compounds** when nested.

```html
<style>
  html { font-size: 16px; }
  .em  { font-size: 1.2em; }
  .rem { font-size: 1.2rem; }
</style>
<div class="em">16 × 1.2 = 19.2px
  <div class="em">19.2 × 1.2 = 23.04px
    <div class="em">23.04 × 1.2 = 27.65px 😱</div>
  </div>
</div>
<div class="rem">19.2px <div class="rem">19.2px <div class="rem">19.2px ✅</div></div></div>
```

:::visual rem-em
:::

### When to use which

- **rem** for font sizes and most spacing — predictable, and it respects the user's browser font-size setting (accessibility!). Someone who sets their default to 20px gets everything scaled.
- **em** for things that should scale **with the component's own text**: a button's padding (`padding: 0.5em 1em`) so a large button has proportionally larger padding; icon sizes next to text (`width: 1em`); media queries (`@media (min-width: 40em)` — em and rem behave the same in media queries, both based on the initial font-size).
- **px** for hairline borders and things that shouldn't scale.

:::callout danger Don't set `html { font-size: 62.5% }` blindly — and never in px
Setting `html { font-size: 16px }` overrides the user's preferred size. If you need a different base, use a percentage. Avoid font sizes in `px` for body text for the same reason.
:::

## Viewport units and the mobile `100vh` bug

On mobile, browser UI (address bar) appears and disappears while scrolling. `100vh` equals the **largest** viewport, so a `height: 100vh` hero gets cut off behind the toolbar. Modern fix:

```css
.hero { min-height: 100svh; } /* small viewport: always fully visible */
/* or 100dvh: dynamic, changes as toolbars show/hide (can cause jank) */
```

## Fluid sizing with `min()`, `max()`, `clamp()`

```css
h1 { font-size: clamp(1.75rem, 1rem + 3vw, 3rem); }  /* min, preferred, max */
.container { width: min(100% - 2rem, 1200px); margin-inline: auto; }
.sidebar { width: max(250px, 20%); }
```

`clamp()` gives you fluid typography without media queries. Keep a `rem` component in the preferred value so zoom still works.

## `calc()`

Mix units at runtime: `height: calc(100svh - var(--header-h));`, `width: calc(50% - 1rem);`. Spaces around `+` and `-` are required.

## CSS custom properties (variables)

```css
:root {
  --brand: #6366f1;
  --radius: 12px;
  --space-2: 0.5rem;
}
.btn {
  background: var(--brand);
  border-radius: var(--radius);
  padding: var(--space-2) calc(var(--space-2) * 2);
  color: var(--btn-text, white); /* fallback value */
}
```

Unlike Sass variables (compiled away at build time), custom properties are **live at runtime**:

- They **cascade and inherit** — redefine them on any element to theme a subtree.
- They can be changed with JS: `document.documentElement.style.setProperty('--brand', '#e11d48')`.
- They work with media queries and `prefers-color-scheme`.

### Theming (light/dark) with variables

```css
:root {
  --bg: #ffffff;
  --text: #0f172a;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0b1020; --text: #e2e8f0; }
}
:root[data-theme='dark'] { --bg: #0b1020; --text: #e2e8f0; } /* manual toggle wins */

body { background: var(--bg); color: var(--text); }
```

```js
document.documentElement.dataset.theme = 'dark'
```

Switching a theme is now one attribute change — no re-rendering of components, no runtime CSS-in-JS cost. This is how large apps implement **dynamic theming without performance issues** (a FE3 interview topic).

:::question
difficulty: easy
companies: Groww
### What is the difference between rem and em units?
Both are font-relative. `rem` is relative to the root (`<html>`) font-size, so it's the same everywhere in the page. `em` is relative to the font-size of the element itself (for the `font-size` property, its parent), so nested `em` values **compound** (1.2em inside 1.2em = 1.44× root). Use `rem` for typography and global spacing (predictable, respects user font settings); use `em` when sizing should scale with the component's own font size, like button padding or inline icons.
:::

:::question
difficulty: medium
### Why should you avoid setting font sizes in px?
Users can change their browser's default font size (low-vision users often do). Sizes in `rem`/`em` scale with that preference; `px` sizes ignore it (browser zoom still works, but the default font setting doesn't). Setting `html { font-size: 16px }` overrides the preference for the entire site. WCAG requires text to be resizable to 200% without loss of content.
:::

:::question
difficulty: medium
### How are CSS custom properties different from Sass variables?
Sass variables are resolved at **compile time** — the output CSS contains plain values, they can't change at runtime or per element. CSS custom properties exist at **runtime** in the browser: they cascade and inherit through the DOM, can be overridden per component/subtree or in media queries, and can be read/written from JavaScript. That makes them ideal for theming, design tokens and component variants.
:::

:::question
difficulty: easy
### What does a percentage in `padding-top` refer to?
The **width** of the containing block, not its height (all margin and padding percentages are based on width). This is the basis of the old "aspect-ratio box" trick (`padding-top: 56.25%` for 16:9). Today you'd just use `aspect-ratio: 16 / 9`.
:::

:::challenge
difficulty: easy
### Compute nested em sizes
Write `computeFontSizes(rootPx, values)` where `values` is an array of font-size strings for elements nested inside each other (first is the outermost, a direct child of `html`). Each value is `'<n>em'`, `'<n>rem'` or `'<n>px'`. Return the computed pixel sizes rounded to 2 decimals.
@@@starter
```js
function computeFontSizes(rootPx, values) {
  // your code
}
```
@@@tests
```js
test('em compounds', () => {
  expect(computeFontSizes(16, ['1.2em', '1.2em', '1.2em'])).toEqual([19.2, 23.04, 27.65])
})
test('rem resets', () => {
  expect(computeFontSizes(16, ['2em', '1rem', '0.5em'])).toEqual([32, 16, 8])
})
test('px', () => {
  expect(computeFontSizes(20, ['10px', '2em'])).toEqual([10, 20])
})
```
@@@solution
```js
function computeFontSizes(rootPx, values) {
  let parent = rootPx
  return values.map((v) => {
    const n = parseFloat(v)
    let px
    if (v.endsWith('rem')) px = n * rootPx
    else if (v.endsWith('em')) px = n * parent
    else px = n
    parent = px
    return Math.round(px * 100) / 100
  })
}
```
Check `rem` **before** `em` (since `'rem'` also ends with `'em'`). The running `parent` mirrors inheritance: each element's computed font-size becomes the base for its child's `em`.
:::

:::quiz
### `html` is 16px. A div has `font-size: 2em`; its child has `font-size: 1.5em`. The child's font size is…
- [ ] 24px
- [x] 48px
- [ ] 32px
@@@explain
Parent = 16 × 2 = 32px; child = 32 × 1.5 = 48px. With rem it would be 24px.
:::

:::quiz
### Which unit avoids the mobile address-bar "100vh" problem?
- [ ] `vh`
- [x] `svh`
- [ ] `vmax`
@@@explain
`svh` is the small viewport height — the area visible even when the browser toolbars are expanded.
:::
