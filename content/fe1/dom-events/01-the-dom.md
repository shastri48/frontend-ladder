---
title: The DOM — Reading & Changing the Page
summary: What the Document Object Model really is, how to find elements, walk the tree and create or update elements efficiently.
minutes: 14
---

## What is the DOM?

When the browser loads HTML, it doesn't keep it as text. It **parses** it into a tree of JavaScript objects called the **Document Object Model**. Every tag becomes an *element node*, text becomes *text nodes*, and they're linked as parents, children and siblings.

```html
<body>
  <h1 class="title">Ladder</h1>
  <ul id="levels">
    <li>FE1</li>
    <li>FE2</li>
  </ul>
</body>
```

```text
document
 └── html
      └── body
           ├── h1.title
           │    └── "Ladder"            (text node)
           └── ul#levels
                ├── li ── "FE1"
                └── li ── "FE2"
```

The DOM is the **live, programmable representation** of the page. Change it with JavaScript and the browser re-renders the screen. HTML is the blueprint; the DOM is the building you can renovate.

:::callout info DOM ≠ HTML source
"View source" shows the original HTML. The Elements panel in DevTools shows the **current DOM** — after scripts ran, after the parser auto-fixed bad markup (e.g. inserting a `<tbody>`). They often differ.
:::

## Node vs Element

Everything in the tree is a **Node** (elements, text, comments, the document itself). **Elements** are the subset that are tags. That's why there are two families of properties:

| All nodes | Elements only |
|---|---|
| `childNodes` (includes text/whitespace) | `children` |
| `firstChild`, `lastChild` | `firstElementChild`, `lastElementChild` |
| `nextSibling`, `previousSibling` | `nextElementSibling`, `previousElementSibling` |
| `parentNode` | `parentElement` |

Whitespace between tags becomes text nodes, which is why `firstChild` is often a surprise `"\n  "`. Prefer the element versions.

## Finding elements

```js
document.getElementById("levels")              // single element or null
document.querySelector(".title")               // first match of any CSS selector
document.querySelectorAll("#levels li")        // static NodeList of all matches
document.getElementsByClassName("title")       // LIVE HTMLCollection
document.getElementsByTagName("li")            // LIVE HTMLCollection

const list = document.querySelector("#levels")
list.querySelector("li:last-child")            // search inside an element
list.closest("body")                           // nearest ancestor matching selector (incl. itself)
el.matches(".active")                          // does el match this selector?
```

**Static vs live:** `querySelectorAll` returns a snapshot; `getElementsBy*` return live collections that update as the DOM changes (looping and removing from a live collection can skip items).

`NodeList` has `forEach` but not `map`; convert with `[...nodeList]` or `Array.from(nodeList)`.

## Walking the tree (traversal)

```js
const ul = document.getElementById("levels")
ul.parentElement            // <body>
ul.children                 // HTMLCollection [li, li]
ul.firstElementChild        // first <li>
ul.firstElementChild.nextElementSibling // second <li>
```

A recursive walk visits every element — the basis of many interview tasks (e.g. `getElementsByStyle`, which you'll do in FE2):

```js
function walk(node, visit) {
  visit(node)
  for (const child of node.children) walk(child, visit)
}
walk(document.body, el => console.log(el.tagName))
```

## Reading and changing content

```js
const h1 = document.querySelector("h1")

h1.textContent = "Frontend Ladder"   // safe: sets text, escapes HTML
h1.innerHTML = "<em>Hi</em>"         // parses HTML — XSS risk with user input!
h1.innerText                         // like textContent but layout-aware (triggers reflow)
```

:::callout danger Never put user input into innerHTML
`el.innerHTML = userComment` lets an attacker inject `<img src=x onerror="steal()">`. Use `textContent`, or build elements with `createElement`. (Security is covered in depth in FE3.)
:::

## Attributes, classes and styles

```js
const link = document.querySelector("a")
link.getAttribute("href")
link.setAttribute("target", "_blank")
link.removeAttribute("title")
link.href                     // property (resolved absolute URL)

el.dataset.userId             // reads data-user-id="..."

el.classList.add("active")
el.classList.remove("hidden")
el.classList.toggle("open")   // add if missing, remove if present
el.classList.contains("open")

el.style.backgroundColor = "teal" // inline style (camelCase)
getComputedStyle(el).fontSize     // final computed value
```

Prefer toggling **classes** over setting many inline styles — styling stays in CSS.

## Creating, inserting and removing elements

```js
const li = document.createElement("li")
li.textContent = "FE3"
li.className = "level"

const ul = document.getElementById("levels")
ul.append(li)                 // add at end (accepts nodes and strings)
ul.prepend(li)                // add at start
ul.firstElementChild.before(li) // insert before a sibling
li.after(document.createElement("hr"))
li.replaceWith(newNode)
li.remove()

ul.insertAdjacentHTML("beforeend", "<li>FE4</li>") // positions: beforebegin, afterbegin, beforeend, afterend
```

### Batch inserts with a DocumentFragment

Each insertion into a live document can trigger layout work. When adding many nodes, build them off-DOM first:

```js
const frag = document.createDocumentFragment()
for (const name of ["a", "b", "c", /* … 1000 items */]) {
  const li = document.createElement("li")
  li.textContent = name
  frag.append(li)
}
ul.append(frag) // one insertion into the live DOM
```

(`ul.append(...nodes)` or building one string for `innerHTML` with **trusted** data also work.)

## When can scripts touch the DOM?

A script in `<head>` runs before `<body>` is parsed — `querySelector` returns `null`. Options:

- Put scripts at the end of `<body>`.
- Use `<script defer>` (runs after parsing, in order) — the modern default.
- Listen for `DOMContentLoaded` (HTML parsed) vs `load` (all images/styles loaded too).

```js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("h1").textContent = "Ready"
})
```

## Interview questions

:::question
difficulty: easy
### What is the DOM?
The Document Object Model is the browser's in-memory tree representation of an HTML document. Each element, text and comment is a node object with properties and methods. JavaScript reads and modifies this tree via the DOM API, and the browser re-renders to reflect changes. It's language-independent and live — not the same as the HTML source.
:::

:::question
difficulty: easy
### Difference between textContent, innerText and innerHTML?
- `textContent` — raw text of all descendant text nodes, including hidden ones; setting it escapes HTML. Fast and safe.
- `innerText` — the *rendered* text (respects CSS like `display:none`, line breaks); reading it forces layout, so it's slower.
- `innerHTML` — the HTML markup inside the element; setting it parses HTML (XSS risk with untrusted input) and destroys existing child nodes and their listeners.
:::

:::question
difficulty: easy
### querySelectorAll vs getElementsByClassName?
`querySelectorAll` takes any CSS selector and returns a **static** `NodeList` (snapshot). `getElementsByClassName` only matches class names and returns a **live** `HTMLCollection` that updates automatically when the DOM changes. Live collections can cause bugs when you remove items while iterating.
:::

:::question
difficulty: medium
### Difference between DOMContentLoaded and load?
`DOMContentLoaded` fires when the HTML has been fully parsed and deferred scripts have run — the DOM is ready, but images, stylesheets of some kinds, and iframes may still be loading. `load` fires on `window` when *everything*, including images and subresources, has loaded. Use `DOMContentLoaded` (or `defer`) to wire up UI as early as possible.
:::

## Challenges

:::challenge
difficulty: easy
### Build a list from data without innerHTML
Given `const items = ["HTML", "CSS", "JS"]` and an empty `<ul id="skills">`, render one `<li>` per item, each with a `data-index` attribute and the text, inserting into the DOM only **once**.
@@@solution
```js
const items = ["HTML", "CSS", "JS"]
const ul = document.getElementById("skills")
const frag = document.createDocumentFragment()

items.forEach((text, i) => {
  const li = document.createElement("li")
  li.textContent = text        // safe — no HTML parsing
  li.dataset.index = String(i) // data-index="0"
  frag.append(li)
})

ul.append(frag)                // single live-DOM insertion
```
Why: `textContent` avoids XSS; the fragment means one reflow instead of N. `ul.replaceChildren(frag)` would also clear old content first.
:::

:::challenge
difficulty: medium
### Find all elements with a given computed style
Write `getElementsByStyle(root, property, value)` returning every element under `root` (inclusive) whose **computed** style `property` equals `value`.
@@@solution
```js
function getElementsByStyle(root, property, value) {
  const result = []
  // Normalise the expected value via a temp element so "red" == "rgb(255, 0, 0)"
  const probe = document.createElement("div")
  probe.style[property] = value
  document.body.append(probe)
  const expected = getComputedStyle(probe)[property]
  probe.remove()

  function walk(el) {
    if (getComputedStyle(el)[property] === expected) result.push(el)
    for (const child of el.children) walk(child)
  }
  walk(root)
  return result
}

getElementsByStyle(document.body, "color", "red")
```
Key points interviewers look for: recursive (or stack-based iterative) DFS over `children`, using `getComputedStyle` not `el.style` (inline only), normalising values (colors compute to `rgb()`), and awareness that `getComputedStyle` can force style recalculation — expensive on huge trees. An iterative version with an explicit stack avoids recursion limits.
:::

:::quiz
### Which returns a LIVE collection?
- [ ] querySelectorAll
- [x] getElementsByTagName
- [ ] Array.from(document.body.children)
- [ ] querySelector
@@@explain
`getElementsBy*` return live `HTMLCollection`s.
:::

:::quiz
### Safest way to show a user's comment text?
- [ ] el.innerHTML = comment
- [x] el.textContent = comment
- [ ] el.outerHTML = comment
- [ ] document.write(comment)
@@@explain
`textContent` never parses HTML, so injected tags render as plain text.
:::
