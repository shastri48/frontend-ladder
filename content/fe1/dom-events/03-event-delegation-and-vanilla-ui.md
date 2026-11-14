---
title: Event Delegation & Building UI in Vanilla JS
summary: One listener to rule them all — delegation, plus hands-on tabs, todo list and accordion built without any framework.
minutes: 16
---

## The problem delegation solves

Imagine a list with 1,000 items, each with a "delete" button. The naive approach attaches 1,000 listeners. That's memory-hungry, slow to set up, and — worse — any item added later has **no listener** unless you remember to attach one.

**Event delegation** flips it: attach **one** listener to a common ancestor and let bubbling bring every click to it. Then figure out which child was clicked using `event.target`.

```html
<ul id="todo-list">
  <li data-id="1">Learn DOM <button class="delete">×</button></li>
  <li data-id="2">Learn events <button class="delete">×</button></li>
</ul>
```

```js
const list = document.getElementById("todo-list")

list.addEventListener("click", (event) => {
  const button = event.target.closest("button.delete")
  if (!button || !list.contains(button)) return   // click wasn't on a delete button
  const li = button.closest("li")
  console.log("delete", li.dataset.id)
  li.remove()
})
```

:::callout tip Why closest()?
`event.target` might be an icon `<svg>` or `<span>` **inside** the button. `target.closest("button.delete")` walks up from the target to find the nearest matching ancestor (or itself). Checking `list.contains(button)` guards against matches outside the delegated container.
:::

### Benefits

- **One listener** instead of N → less memory, faster setup.
- **Dynamic content works automatically** — new items are covered.
- **Simpler cleanup** — remove one listener.

### Limitations

- Only works for events that bubble (use `focusin`/`focusout` instead of `focus`/`blur`).
- Handler runs for every click inside the container — keep the matching logic cheap.
- `stopPropagation()` inside children breaks it.

React itself uses delegation: it attaches listeners at the **root container** and dispatches to your components' `onClick` props (its "synthetic event" system).

## Data attributes as glue

Delegation pairs naturally with `data-*` attributes to know *what* to act on:

```html
<div class="toolbar">
  <button data-action="bold">B</button>
  <button data-action="italic">I</button>
  <button data-action="undo">↶</button>
</div>
```

```js
const actions = {
  bold: () => format("bold"),
  italic: () => format("italic"),
  undo: () => history.undo(),
}
document.querySelector(".toolbar").addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action
  actions[action]?.()
})
```

## Building UI without a framework

Interviewers (CRED, Razorpay, many others) often ask you to "build a small UI in vanilla JS" to check you understand what frameworks do for you. The pattern is always the same:

1. **State** — a plain JS object/array that is the source of truth.
2. **Render** — a function that turns state into DOM.
3. **Events** — handlers update state, then call render.

```js
const state = { todos: [], filter: "all" }

function setState(patch) {
  Object.assign(state, patch)
  render()
}
```

This is the mental model React automates (with smarter, minimal DOM updates).

## Challenges

:::challenge
difficulty: easy
### Implement event delegation helper
Write `delegate(parent, eventType, selector, handler)` that calls `handler(event, matchedElement)` whenever an event of `eventType` happens on an element inside `parent` matching `selector`. Return a function that removes the listener.
@@@solution
```js
function delegate(parent, eventType, selector, handler) {
  function listener(event) {
    const match = event.target.closest(selector)
    if (match && parent.contains(match)) {
      handler.call(match, event, match)
    }
  }
  parent.addEventListener(eventType, listener)
  return () => parent.removeEventListener(eventType, listener)
}

// usage
const off = delegate(document.body, "click", "[data-action='like']", (e, el) => {
  el.classList.toggle("liked")
})
```
`closest` handles clicks on nested children; `contains` prevents matching an ancestor *outside* the parent (e.g. `body` itself matching). Returning an unsubscribe function is the idiomatic cleanup API. Edge: for `focus`, map to `focusin` since focus doesn't bubble.
:::

:::challenge
difficulty: medium
companies: Infosys, TCS
### Vanilla JS tabbed interface
Using only HTML, CSS and vanilla JS, build tabs: clicking a tab shows its panel and hides the others. Must be keyboard-accessible (Arrow keys move between tabs) and use proper ARIA roles.
@@@solution
```html
<div class="tabs">
  <div role="tablist" aria-label="Levels">
    <button role="tab" id="tab-1" aria-controls="panel-1" aria-selected="true">FE1</button>
    <button role="tab" id="tab-2" aria-controls="panel-2" aria-selected="false" tabindex="-1">FE2</button>
    <button role="tab" id="tab-3" aria-controls="panel-3" aria-selected="false" tabindex="-1">FE3</button>
  </div>
  <section role="tabpanel" id="panel-1" aria-labelledby="tab-1">Foundations</section>
  <section role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>Mid level</section>
  <section role="tabpanel" id="panel-3" aria-labelledby="tab-3" hidden>Senior</section>
</div>
```

```css
[role="tab"] { padding: 8px 16px; border: 0; background: none; border-bottom: 2px solid transparent; }
[role="tab"][aria-selected="true"] { border-color: teal; font-weight: 600; }
```

```js
const tablist = document.querySelector('[role="tablist"]')
const tabs = [...tablist.querySelectorAll('[role="tab"]')]

function activate(tab) {
  tabs.forEach((t) => {
    const selected = t === tab
    t.setAttribute("aria-selected", String(selected))
    t.tabIndex = selected ? 0 : -1          // roving tabindex
    document.getElementById(t.getAttribute("aria-controls")).hidden = !selected
  })
  tab.focus()
}

// Delegation: one click listener for all tabs
tablist.addEventListener("click", (e) => {
  const tab = e.target.closest('[role="tab"]')
  if (tab) activate(tab)
})

tablist.addEventListener("keydown", (e) => {
  const i = tabs.indexOf(document.activeElement)
  if (i === -1) return
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
  if (next === undefined) return
  e.preventDefault()
  activate(tabs[(next + tabs.length) % tabs.length])
})
```

Points that impress: delegation instead of a listener per tab; the `hidden` attribute; ARIA `tablist`/`tab`/`tabpanel` with `aria-selected` and `aria-controls`; "roving tabindex" so Tab moves into the tablist once and arrows move within it; wrapping around with modulo.
:::

:::challenge
difficulty: medium
### Vanilla JS todo list
Build a todo app with: add (Enter key or button), toggle complete, delete, filter (All / Active / Done), item count, and persistence in `localStorage`. Use a single source of truth and event delegation.
@@@solution
```html
<form id="todo-form">
  <input id="todo-input" placeholder="What needs doing?" aria-label="New todo" required />
  <button>Add</button>
</form>
<div id="filters">
  <button data-filter="all">All</button>
  <button data-filter="active">Active</button>
  <button data-filter="done">Done</button>
</div>
<ul id="todos"></ul>
<p id="count"></p>
```

```js
const STORAGE_KEY = "todos-v1"
const state = {
  todos: JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"),
  filter: "all",
}

const form = document.getElementById("todo-form")
const input = document.getElementById("todo-input")
const list = document.getElementById("todos")
const count = document.getElementById("count")

function update(changes) {
  Object.assign(state, changes)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos))
  render()
}

function render() {
  const visible = state.todos.filter((t) =>
    state.filter === "all" ? true : state.filter === "done" ? t.done : !t.done
  )
  const frag = document.createDocumentFragment()
  for (const todo of visible) {
    const li = document.createElement("li")
    li.dataset.id = todo.id
    li.className = todo.done ? "done" : ""

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.checked = todo.done
    checkbox.dataset.action = "toggle"

    const label = document.createElement("span")
    label.textContent = todo.text          // safe from XSS

    const del = document.createElement("button")
    del.textContent = "×"
    del.dataset.action = "delete"
    del.setAttribute("aria-label", `Delete ${todo.text}`)

    li.append(checkbox, label, del)
    frag.append(li)
  }
  list.replaceChildren(frag)
  const left = state.todos.filter((t) => !t.done).length
  count.textContent = `${left} item${left === 1 ? "" : "s"} left`
  document.querySelectorAll("#filters button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.filter === state.filter))
  )
}

form.addEventListener("submit", (e) => {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  update({ todos: [...state.todos, { id: crypto.randomUUID(), text, done: false }] })
  input.value = ""
})

// One delegated listener handles toggle + delete for all current and future items
list.addEventListener("click", (e) => {
  const action = e.target.dataset.action
  const id = e.target.closest("li")?.dataset.id
  if (!action || !id) return
  if (action === "toggle") {
    update({ todos: state.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })
  } else if (action === "delete") {
    update({ todos: state.todos.filter((t) => t.id !== id) })
  }
})

document.getElementById("filters").addEventListener("click", (e) => {
  const filter = e.target.dataset.filter
  if (filter) update({ filter })
})

render()
```

Discussion points: state → render → events loop; immutable updates (`map`/`filter`) mirror React; `textContent` prevents XSS; `form` submit gives Enter-key support for free; persisting in `localStorage` with a versioned key; `replaceChildren` with a fragment for a single DOM write. Follow-ups: edit in place (dblclick), "clear completed", and only re-rendering changed items for large lists.
:::

:::challenge
difficulty: easy
### Vanilla accordion (only one open at a time)
Build an FAQ accordion where clicking a heading expands its answer and collapses any other open one. Use one listener.
@@@solution
```html
<div class="accordion" id="faq">
  <h3><button aria-expanded="false" aria-controls="a1">What is the DOM?</button></h3>
  <div id="a1" hidden>A tree of objects representing the page.</div>
  <h3><button aria-expanded="false" aria-controls="a2">What is bubbling?</button></h3>
  <div id="a2" hidden>Events travelling up through ancestors.</div>
</div>
```

```js
const faq = document.getElementById("faq")
faq.addEventListener("click", (e) => {
  const btn = e.target.closest("button[aria-controls]")
  if (!btn) return
  const willOpen = btn.getAttribute("aria-expanded") !== "true"

  faq.querySelectorAll("button[aria-controls]").forEach((b) => {
    const open = b === btn && willOpen
    b.setAttribute("aria-expanded", String(open))
    document.getElementById(b.getAttribute("aria-controls")).hidden = !open
  })
})
```
Using `<button>` inside headings gives keyboard support (Enter/Space) and screen-reader semantics for free; `aria-expanded` communicates state. To allow multiple open panels, only toggle the clicked one.
:::

:::quiz
### Event delegation relies on…
- [ ] Event capturing only
- [x] Event bubbling
- [ ] stopPropagation
- [ ] Shadow DOM
@@@explain
Events bubble up to the shared ancestor where the single listener lives.
:::

:::quiz
### Why use `event.target.closest(selector)` in a delegated handler?
- [ ] It's faster than event.target
- [x] The click may land on a nested child of the element you care about
- [ ] It prevents bubbling
- [ ] It's required by addEventListener
@@@explain
`closest` walks up from the actual clicked node to the nearest element matching your selector.
:::
