---
title: The Cascade, Selectors & Specificity
summary: How the browser decides which CSS rule wins — origin, layers, specificity, source order, inheritance — and every selector you need.
minutes: 16
---

## CSS is a conflict-resolution system

Several rules usually target the same element. The **cascade** is the algorithm that decides which declaration wins. Learn it once and "why isn't my style applying?" stops being a mystery.

```css
p { color: black; }
.intro { color: navy; }
#hero p { color: teal; }
```

For `<section id="hero"><p class="intro">Hi</p></section>`, the text is **teal**. Here's why.

## The cascade order (highest priority first)

When declarations conflict for the same property, the browser compares, in order:

1. **Origin & importance** — browser defaults < user styles < author (your) styles; `!important` flips the order for important declarations. Transitions and animations also sit in this ladder.
2. **Context** — Shadow DOM encapsulation.
3. **Element-attached styles** — the `style=""` attribute beats any selector.
4. **Cascade layers** (`@layer`) — later-declared layers win; unlayered styles beat layered ones.
5. **Specificity** — the more specific selector wins.
6. **Source order** — if everything else ties, the **last** declared wins.

In day-to-day work, it's mostly **specificity → source order**.

## Specificity

Specificity is a score with three columns **(ID, CLASS, TYPE)**, compared left to right — like version numbers, not decimal sums. One ID beats any number of classes.

| Selector part | Column |
|---|---|
| `#id` | ID (a) |
| `.class`, `[attr]`, `:hover`, `:nth-child()` (pseudo-classes) | CLASS (b) |
| `div`, `p`, `::before` (pseudo-elements) | TYPE (c) |
| `*`, combinators (`>`, `+`, `~`, space) | nothing |
| `:where(...)` | **always zero** |
| `:is(...)`, `:not(...)`, `:has(...)` | specificity of their most specific argument |

Examples:

| Selector | Score |
|---|---|
| `p` | (0,0,1) |
| `.intro` | (0,1,0) |
| `p.intro` | (0,1,1) |
| `nav ul li a:hover` | (0,1,4) |
| `#hero p` | (1,0,1) |
| `#hero .intro:first-child` | (1,2,0) |
| `:where(#hero) p` | (0,0,1) |
| `style="..."` | beats all selectors |

Try your own:

:::visual specificity
:::

:::callout warn Avoid the specificity arms race
Using IDs and long chains for styling makes overriding painful, which leads to `!important`, which leads to more `!important`. Prefer **single-class selectors** (BEM-style `.card__title--active`, CSS Modules, or utility classes) so everything has roughly equal, low specificity and source order is predictable. Use `:where()` in resets/libraries to keep specificity at zero.
:::

### `!important`

`!important` jumps an entire tier above normal declarations. Legit uses: utility classes that must always win (`.hidden { display: none !important }`), overriding third-party inline styles. Otherwise it's a smell.

## Inheritance

Some properties **inherit** from parent to child by default — mostly text-related ones: `color`, `font-*`, `line-height`, `letter-spacing`, `text-align`, `visibility`, `cursor`, and custom properties (`--x`). Most box-related ones don't: `margin`, `padding`, `border`, `width`, `background`, `display`, `position`.

That's why you set `font-family` on `body` once and it flows everywhere. Inherited values have **no specificity** — any rule that directly targets an element beats a value inherited from its parent, even `#id` on the parent:

```css
#parent { color: red; }
span { color: blue; } /* span inside #parent is BLUE */
```

Keywords to control it: `inherit`, `initial` (spec default), `unset` (inherit if inheritable else initial), `revert` (back to browser default).

## Selectors cheat sheet

```css
/* basic */
*            /* everything */
p            /* type */
.card        /* class */
#app         /* id */
[type="email"]   [href^="https"]   [href$=".pdf"]   [class*="btn"]

/* combinators */
nav a        /* descendant */
ul > li      /* direct child */
h2 + p       /* the p immediately after an h2 */
h2 ~ p       /* all following sibling ps */

/* pseudo-classes: state */
a:hover  a:focus  button:focus-visible  input:checked  input:disabled
input:invalid  input:user-invalid  a:visited  :target

/* pseudo-classes: structure */
li:first-child  li:last-child  li:nth-child(2n+1)  li:nth-child(odd)
p:first-of-type  :not(.active)  :empty

/* modern */
:is(h1, h2, h3) a     /* group */
:where(ul, ol) li     /* group with 0 specificity */
.card:has(img)        /* parent selector! card containing an img */
form:has(input:invalid) button { opacity: .5; }

/* pseudo-elements */
p::first-line  ::before  ::after  ::placeholder  ::selection  ::marker
```

### How browsers match selectors: right to left

The browser reads `nav ul li a` from the **rightmost** part: find every `a`, then check whether it has an `li` ancestor, etc. So the right-most part (the **key selector**) matters most for performance. In practice modern engines are extremely fast, and selector performance rarely matters — readability matters more.

## Cascade layers (`@layer`)

Layers let you control priority by **group** rather than specificity:

```css
@layer reset, base, components, utilities;

@layer reset { * { margin: 0; } }
@layer components { .btn { padding: 8px 16px; } }
@layer utilities { .p-0 { padding: 0; } } /* wins over .btn even with same specificity, because later layer */
```

Frameworks like Tailwind v4 use layers so utilities reliably override components.

:::question
difficulty: easy
companies: Reddit
### Explain CSS specificity and the order: inline, ID, class, element.
Specificity decides which conflicting rule applies. It's compared as a tuple: **inline style** beats everything in stylesheets; then the count of **IDs**; then **classes, attributes and pseudo-classes**; then **elements and pseudo-elements**. Columns are compared left to right, so `#a` (1,0,0) beats `.a.b.c.d.e` (0,5,0). If specificity ties, the later rule in source order wins. `!important` overrides normal declarations; `:where()` contributes zero; `:is()/:not()/:has()` take their most specific argument.
:::

:::question
difficulty: medium
### What is the CSS cascade? List the factors in order.
The cascade resolves conflicting declarations for the same property on the same element, considering: (1) origin and importance (user-agent, user, author; `!important` reverses), (2) encapsulation context (shadow DOM), (3) inline `style` attribute, (4) cascade layers, (5) specificity, (6) source order. Values not set by any rule are **inherited** (for inheritable properties) or fall back to the property's **initial** value.
:::

:::question
difficulty: easy
### Which CSS properties are inherited?
Mostly typography and text-related: `color`, `font` and its sub-properties, `line-height`, `letter-spacing`, `word-spacing`, `text-align`, `text-indent`, `text-transform`, `white-space`, `visibility`, `cursor`, `list-style`, and CSS custom properties. Box-model and layout properties (`margin`, `padding`, `border`, `width`, `height`, `background`, `display`, `position`) are not. Force it with `inherit`.
:::

:::challenge
difficulty: easy
### Predict the colour
```html
<div id="box" class="card">
  <p class="text">Hello</p>
</div>
```
```css
#box { color: red; }
.card .text { color: green; }
div p { color: blue; }
p.text { color: purple; }
```
What colour is "Hello"? What if we remove `.card .text`?
@@@solution
**Green.** The rules that *directly target* the `<p>`: `.card .text` (0,2,0), `div p` (0,0,2), `p.text` (0,1,1). Highest is (0,2,0) → green. `#box { color: red }` targets the div — the `p` would only inherit red if no rule targeted it directly; inherited values have no specificity.

Without `.card .text`: compare (0,1,1) vs (0,0,2) → `p.text` wins → **purple**.
:::

:::challenge
difficulty: easy
### Calculate specificity
Write `specificity(selector)` returning `[ids, classes, types]` for simple selectors made of type, `#id`, `.class`, `[attr]`, `:pseudo-class`, `::pseudo-element` and combinators (space, `>`, `+`, `~`). Ignore `:is/:where/:not`.
@@@starter
```js
function specificity(selector) {
  // your code
}
```
@@@tests
```js
test('simple', () => { expect(specificity('p')).toEqual([0, 0, 1]) })
test('mix', () => { expect(specificity('#hero .intro:first-child')).toEqual([1, 2, 0]) })
test('chain', () => { expect(specificity('nav ul > li a:hover')).toEqual([0, 1, 4]) })
test('attr and pseudo-element', () => { expect(specificity('a[href^="x"]::before')).toEqual([0, 1, 2]) })
test('universal', () => { expect(specificity('* + *')).toEqual([0, 0, 0]) })
```
@@@solution
```js
function specificity(selector) {
  let s = selector
  let a = 0, b = 0, c = 0
  const count = (re) => { const m = s.match(re) || []; s = s.replace(re, ' '); return m.length }
  b += count(/\[[^\]]*\]/g)          // attributes (remove first: may contain . or #)
  c += count(/::[\w-]+/g)            // pseudo-elements
  a += count(/#[\w-]+/g)             // ids
  b += count(/\.[\w-]+/g)            // classes
  b += count(/:[\w-]+(\([^)]*\))?/g) // pseudo-classes
  c += count(/(^|[\s>+~])[a-zA-Z][\w-]*/g) // type selectors
  return [a, b, c]
}
```
Order matters: strip attributes first (their values can contain `.` or `#`), then `::pseudo-elements` before `:pseudo-classes`. Type selectors are identifiers at the start or right after a combinator. A real implementation (like the one in the visual above) tokenizes properly and handles `:is()`, `:not()` and `:where()`.
:::

:::quiz
### Which wins: `.a.b.c.d.e.f.g.h.i.j.k` or `#x`?
- [ ] The 11 classes, 11 > 1
- [x] `#x`
- [ ] Whichever comes last
@@@explain
Specificity columns don't overflow; one ID beats any number of classes.
:::

:::quiz
### What is the specificity of `:where(#nav .link) a`?
- [x] (0,0,1)
- [ ] (1,1,1)
- [ ] (0,1,1)
@@@explain
`:where()` always contributes zero, so only `a` counts.
:::

:::quiz
### A parent has `#wrap { color: red }` and a child `<span>` matches `span { color: blue }`. The span is…
- [ ] red, IDs win
- [x] blue
@@@explain
Inherited values lose to any rule that targets the element directly.
:::
