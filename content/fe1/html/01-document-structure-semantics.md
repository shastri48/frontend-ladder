---
title: HTML Structure & Semantic Markup
summary: How an HTML document is built, why semantic tags matter for accessibility and SEO, and how to pick the right element.
minutes: 15
---

## HTML describes meaning, not looks

HTML (HyperText Markup Language) gives content **structure and meaning**. CSS decides how it looks; JavaScript decides how it behaves. Keeping these roles separate is the foundation of maintainable frontend code.

A minimal, correct document:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Keyboards — KeyCo</title>
    <meta name="description" content="Hand-built mechanical keyboards." />
    <link rel="stylesheet" href="/styles.css" />
    <script src="/app.js" defer></script>
  </head>
  <body>
    <h1>Mechanical keyboards</h1>
    <p>Built to last.</p>
  </body>
</html>
```

| Line | Why it's there |
|---|---|
| `<!DOCTYPE html>` | Puts the browser in **standards mode** (without it: quirks mode, with legacy box-model bugs) |
| `lang="en"` | Screen readers pick the right pronunciation; search engines and translators use it |
| `charset="UTF-8"` | Characters like ₹, é, 你 render correctly; must be in the first 1024 bytes |
| `viewport` meta | Without it, mobile browsers render at ~980px wide and zoom out — your responsive CSS won't work |
| `<title>` | Tab title, bookmark name, search result headline |
| `defer` | Download in parallel, run after parsing — doesn't block the page |

## Elements, attributes, nesting

```html
<a href="/cart" class="btn" aria-label="Cart, 3 items">🛒 3</a>
```

- **Element** = start tag + content + end tag. Some are **void** (no closing tag): `<img>`, `<input>`, `<br>`, `<meta>`, `<link>`.
- **Attributes** configure elements. Global ones work everywhere: `id`, `class`, `style`, `title`, `hidden`, `tabindex`, `data-*`, `aria-*`, `lang`.
- **Block vs inline** (default display): `<div>`, `<p>`, `<h1>`, `<section>` start on new lines; `<span>`, `<a>`, `<strong>`, `<img>` flow inside text.

`data-*` attributes store custom data you can read in JS:

```html
<button data-product-id="42">Add</button>
<script>
  document.querySelector('button').dataset.productId // "42"
</script>
```

## Semantic vs non-semantic elements

A **non-semantic** element (`<div>`, `<span>`) says nothing about its content. A **semantic** element tells browsers, assistive technologies and search engines *what the content is*.

```html
<!-- Div soup -->
<div class="header">
  <div class="nav">…</div>
</div>
<div class="main">
  <div class="post">
    <div class="title">Hello</div>
  </div>
</div>
<div class="footer">…</div>

<!-- Semantic -->
<header>
  <nav aria-label="Primary">…</nav>
</header>
<main>
  <article>
    <h1>Hello</h1>
    <p>Published <time datetime="2026-11-14">14 Nov</time></p>
  </article>
</main>
<footer>…</footer>
```

### The page-level (landmark) elements

```text
┌──────────────────────── <header> ─────────────────────────┐
│ logo            <nav> Home · Shop · About                 │
├───────────────────────────────────────────┬──────────────┤
│ <main>                                    │ <aside>      │
│   <article>                               │ related      │
│     <h1> … <section><h2> … </section>      │ links, ads   │
│   </article>                              │              │
├───────────────────────────────────────────┴──────────────┤
│ <footer> © 2026 · Privacy                                 │
└───────────────────────────────────────────────────────────┘
```

| Element | Use for |
|---|---|
| `<header>` | Intro content for the page or a section (logo, heading, nav) |
| `<nav>` | Major navigation blocks |
| `<main>` | The unique main content — **one per page** |
| `<article>` | Self-contained content that makes sense alone (post, product card, comment) |
| `<section>` | A thematic group of content, usually with a heading |
| `<aside>` | Tangential content (sidebar, callouts) |
| `<footer>` | Footer for page or section |
| `<figure>` + `<figcaption>` | Image/diagram/code with a caption |
| `<time datetime>` | Machine-readable dates |
| `<mark>`, `<strong>`, `<em>` | Highlight, importance, stress emphasis (vs `<b>`/`<i>` which are stylistic) |
| `<button>` vs `<a>` | Button = performs an **action**; link = **navigates** to a URL |

### Why semantics matters

1. **Accessibility** — Screen readers expose landmarks ("main", "navigation") so users can jump around. A `<button>` is focusable, activates with Enter *and* Space, and is announced as "button" for free. A `<div onclick>` gets none of that.
2. **SEO** — Search engines understand headings, articles and links better, which helps ranking and rich results.
3. **Maintainability** — `<nav>` is self-documenting; `<div class="x12">` isn't.
4. **Default behaviour for free** — forms submit, links are crawlable and can open in new tabs, `<details>` toggles without JS.

:::callout danger The div-button anti-pattern
```html
<div class="btn" onclick="save()">Save</div>
```
Not focusable with Tab, not announced as a button, doesn't respond to Enter/Space. To "fix" it you'd need `role="button" tabindex="0"` plus key handlers — or just use `<button>`. **First rule of ARIA: don't use ARIA if a native element does the job.**
:::

## Headings form an outline

Headings `<h1>`…`<h6>` create the document outline that screen-reader users navigate (pressing **H** jumps between headings). Rules:

- One `<h1>` describing the page.
- Don't skip levels (`h2` → `h4`) just for size — style with CSS instead.
- Never pick a heading level because of its default font size.

## Lists, tables and other content

- `<ul>` unordered, `<ol>` ordered, `<dl>`/`<dt>`/`<dd>` term-definition pairs. Navigation menus are typically `<nav><ul><li><a>`.
- Use `<table>` **for tabular data only** (never layout), with `<caption>`, `<thead>`, `<th scope="col">` so screen readers can announce headers for each cell.
- `<details><summary>` gives you an accessible disclosure/accordion with zero JS.

```html
<details>
  <summary>Shipping info</summary>
  <p>Ships in 2 days.</p>
</details>
```

:::question
difficulty: easy
companies: Walmart, Meta
### Explain the difference between semantic and non-semantic HTML, and why semantics matters for accessibility and SEO.
**Semantic** elements describe the meaning of their content (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<button>`, `<time>`). **Non-semantic** elements (`<div>`, `<span>`) carry no meaning and are just generic containers.

Why it matters:
- **Accessibility:** assistive tech builds an *accessibility tree* from the DOM. Semantic elements have implicit roles (landmarks, buttons, headings) so screen-reader users can navigate by region/heading and interact with controls via keyboard by default.
- **SEO:** crawlers understand page structure — headings, articles, links, `<time>` — leading to better indexing and rich snippets.
- **Behaviour & maintainability:** native elements bring keyboard support, focus handling and form behaviour for free, and code is self-documenting.

Use `<div>`/`<span>` only when no semantic element fits (pure styling hooks).
:::

:::question
difficulty: easy
### What does `<!DOCTYPE html>` do?
It tells the browser to render in **standards mode**. Without it, browsers fall into **quirks mode**, emulating old browser bugs (e.g. a different box model where width includes padding and border, odd table and inline layout behaviour). It is not an HTML tag; it's a declaration and must be the first thing in the document.
:::

:::question
difficulty: easy
### When should you use `<button>` vs `<a>`?
Use `<a href>` when the user **navigates** somewhere (a new URL, a route, a section anchor) — it supports open-in-new-tab, copy link, history and crawling. Use `<button>` when the user triggers an **action** on the current page (submit, open modal, toggle, delete). Inside a `<form>`, a `<button>` defaults to `type="submit"`, so set `type="button"` for non-submit buttons.
:::

:::question
difficulty: medium
### What is the difference between `<section>`, `<article>` and `<div>`?
- `<article>` — self-contained, independently distributable content (blog post, product card, comment, forum post). Would make sense in an RSS feed.
- `<section>` — a thematic grouping of content inside a page or article, normally with a heading. If you can't give it a heading, it's probably a `<div>`.
- `<div>` — no meaning; a wrapper for styling or scripting.
:::

:::challenge
difficulty: easy
### Refactor div soup into semantic HTML
Convert this markup into semantic, accessible HTML:
```html
<div class="top">
  <div class="logo">KeyCo</div>
  <div class="links"><span onclick="go('/')">Home</span> <span onclick="go('/shop')">Shop</span></div>
</div>
<div class="content">
  <div class="big">Our keyboards</div>
  <div class="card"><div class="name">K1</div><img src="k1.jpg"><div class="buy" onclick="buy(1)">Buy</div></div>
</div>
<div class="bottom">© KeyCo</div>
```
@@@solution
```html
<header class="top">
  <a href="/" class="logo">KeyCo</a>
  <nav aria-label="Primary">
    <ul class="links">
      <li><a href="/">Home</a></li>
      <li><a href="/shop">Shop</a></li>
    </ul>
  </nav>
</header>

<main class="content">
  <h1>Our keyboards</h1>
  <article class="card">
    <h2>K1</h2>
    <img src="k1.jpg" alt="K1 mechanical keyboard in white" width="400" height="300" />
    <button type="button" onclick="buy(1)">Buy K1</button>
  </article>
</main>

<footer class="bottom">
  <p><small>© KeyCo</small></p>
</footer>
```
What changed and why:
- Navigation `span`s → real links (`<a href>`) — keyboard accessible, crawlable, open in new tab.
- "big" text → `<h1>`; card title → `<h2>` so the outline is correct.
- Card → `<article>` (self-contained). Image gets meaningful `alt` and dimensions (prevents layout shift).
- Clickable `div` → `<button type="button">` with a specific label ("Buy K1", not five "Buy" buttons).
- Landmarks `<header>`, `<nav>`, `<main>`, `<footer>` let screen-reader users jump straight to content.
:::

:::quiz
### How many `<main>` elements should a page have (visible at once)?
- [x] One
- [ ] One per section
- [ ] As many as needed
@@@explain
`<main>` marks the unique main content of the document; only one may be visible.
:::

:::quiz
### What is missing if a mobile browser shows your page zoomed out like a desktop site?
- [ ] `<meta charset>`
- [x] `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] `lang` attribute
@@@explain
Without the viewport meta tag, mobile browsers assume a ~980px layout viewport.
:::
