---
title: Events, Bubbling & Capturing
summary: How events travel through the DOM in three phases, and how preventDefault, stopPropagation, once and passive actually work.
minutes: 14
---

## Events: the browser telling you something happened

Clicks, key presses, form submissions, scrolling, images loading — each is an **event**. You subscribe with `addEventListener`:

```js
const button = document.querySelector("#save")

function handleClick(event) {
  console.log("clicked", event.target)
}

button.addEventListener("click", handleClick)
button.removeEventListener("click", handleClick) // needs the SAME function reference
```

Prefer `addEventListener` over `onclick = ...` properties: you can attach many listeners to the same event, and you control options.

### The event object

Every handler receives an `Event` object:

| Property | Meaning |
|---|---|
| `type` | `"click"`, `"keydown"`, ... |
| `target` | The element where the event **originated** (e.g. the inner `<span>` clicked) |
| `currentTarget` | The element whose listener is **currently running** |
| `eventPhase` | 1 capture, 2 at target, 3 bubble |
| `key`, `code` | Keyboard events |
| `clientX/Y` | Mouse position |
| `preventDefault()` | Cancel the browser's default action |
| `stopPropagation()` | Stop the event travelling further |

## The three phases of propagation

When you click a `<button>` inside a `<div>` inside `<body>`, the event doesn't just fire on the button. It makes a round trip:

1. **Capturing phase** — travels **down** from `window` → `document` → `html` → `body` → `div` → toward the target.
2. **Target phase** — reaches the element that was clicked.
3. **Bubbling phase** — travels back **up** from the target to `window`.

:::visual event-propagation
:::

```text
            window
              │  ▲
   capture ▼  │  │ bubble
           document
              │  ▲
             div
              │  ▲
           button   ← target
```

By default, listeners run in the **bubbling** phase. Pass `{ capture: true }` (or `true`) to listen during capture:

```js
div.addEventListener("click", () => console.log("div capture"), { capture: true })
div.addEventListener("click", () => console.log("div bubble"))
button.addEventListener("click", () => console.log("button"))
// Clicking the button logs:
// div capture
// button
// div bubble
```

:::callout analogy A letter in an office building
Capturing is the mail being carried from the lobby down the corridors to your desk. Bubbling is your reply travelling back up through each manager to the CEO. Anyone along the way can read it — or stop it.
:::

### Events that don't bubble

`focus`, `blur`, `mouseenter`, `mouseleave`, `load` (on elements), `scroll` (on elements, partly) don't bubble. Use the bubbling alternatives `focusin`/`focusout` and `mouseover`/`mouseout` when you need delegation.

## preventDefault vs stopPropagation

These are often confused. They do completely different things:

- **`preventDefault()`** stops the **browser's default behaviour** for that event: following a link, submitting a form and reloading the page, checking a checkbox, scrolling on wheel. The event still propagates.
- **`stopPropagation()`** stops the event from **reaching other elements** in the propagation path. Default behaviour still happens.
- **`stopImmediatePropagation()`** also stops other listeners **on the same element** from running.

```js
form.addEventListener("submit", (e) => {
  e.preventDefault()          // no page reload — handle with JS
  sendData(new FormData(form))
})

modal.addEventListener("click", (e) => {
  e.stopPropagation()         // clicks inside the modal don't reach the overlay's "close" handler
})
```

:::callout warn Use stopPropagation sparingly
It breaks analytics, "click outside to close" logic and event delegation higher up. Often a better approach is to check `event.target` in the outer handler (e.g. `if (e.target === overlay) close()`).
:::

## Listener options

```js
el.addEventListener("click", handler, {
  once: true,      // auto-removed after first call
  capture: false,  // listen in bubble phase (default)
  passive: true,   // promise not to call preventDefault → smoother scrolling
  signal: controller.signal, // remove via AbortController
})

const controller = new AbortController()
window.addEventListener("resize", onResize, { signal: controller.signal })
window.addEventListener("scroll", onScroll, { signal: controller.signal })
controller.abort() // removes both listeners at once
```

`passive: true` matters for `touchstart`/`wheel`: the browser can start scrolling immediately instead of waiting to see if you'll cancel it.

## Keyboard and form events

```js
input.addEventListener("input", (e) => console.log(e.target.value))  // every change
input.addEventListener("change", ...)  // when committed (blur / Enter for text)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal()
  if ((e.metaKey || e.ctrlKey) && e.key === "k") openSearch()
})
```

## Custom events

You can create and dispatch your own events — great for decoupled components:

```js
const evt = new CustomEvent("cart:add", { detail: { id: 42 }, bubbles: true })
button.dispatchEvent(evt)
document.addEventListener("cart:add", (e) => console.log(e.detail.id))
```

## Memory: removing listeners

A listener keeps its handler (and everything its closure references) alive. If you add listeners to `window`/`document` from a component that gets removed, remove them too — otherwise you leak memory and handlers keep firing. In React this is what the `useEffect` cleanup function is for.

## Interview questions

:::question
difficulty: easy
companies: Tekion
### Explain event bubbling vs capturing
Events propagate in three phases. **Capturing**: from `window` down through ancestors to the target. **Target**: listeners on the target itself run. **Bubbling**: back up from the target through each ancestor to `window`. `addEventListener(type, fn)` listens in the bubbling phase by default; pass `{ capture: true }` to listen during capture. Bubbling is what makes event delegation possible. Some events (`focus`, `blur`, `mouseenter`) don't bubble.
:::

:::question
difficulty: easy
### Difference between event.target and event.currentTarget?
`target` is the deepest element where the event originated (what the user actually clicked, e.g. an `<svg>` icon inside a button). `currentTarget` is the element whose listener is executing right now (the button you attached to). In delegation you read `target` (often with `.closest()`); `currentTarget` is always the element you called `addEventListener` on.
:::

:::question
difficulty: easy
### preventDefault vs stopPropagation?
`preventDefault()` cancels the browser's default action (link navigation, form submit, checkbox toggle) but the event keeps propagating. `stopPropagation()` stops the event from moving to further elements in the capture/bubble path but the default action still happens. They're independent; you might need both, one, or neither.
:::

:::question
difficulty: medium
### What does `passive: true` do and why does it improve scrolling?
For touch and wheel events, the browser must wait for your handler to finish before scrolling, in case you call `preventDefault()`. Marking the listener passive promises you won't, so the browser scrolls immediately on the compositor thread. Chrome makes `touchstart`/`touchmove`/`wheel` listeners on window/document passive by default.
:::

## Challenges

:::challenge
difficulty: medium
### Output: propagation order
```html
<div id="outer">
  <div id="inner"><button id="btn">Go</button></div>
</div>
```
```js
const log = (m) => () => console.log(m)
outer.addEventListener("click", log("outer bubble"))
outer.addEventListener("click", log("outer capture"), true)
inner.addEventListener("click", log("inner bubble"))
inner.addEventListener("click", (e) => { console.log("inner capture"); }, true)
btn.addEventListener("click", log("btn"))
```
What's logged when the button is clicked? What changes if `inner`'s bubble listener calls `e.stopPropagation()`?
@@@solution
```text
outer capture
inner capture
btn
inner bubble
outer bubble
```

Capture listeners run top-down, then the target, then bubble listeners bottom-up.

If `inner bubble` calls `stopPropagation()`, the output ends after `inner bubble` — `outer bubble` never runs. Capture phase already happened, so `outer capture` still logs first.
:::

:::challenge
difficulty: medium
### Sequential unbind/bind click
A "Pay" button must not trigger a second payment while the first is in progress. Implement `bindSequential(button, task)` where `task` returns a Promise: on click, unbind (or ignore) further clicks until the task settles, then re-enable. Also reflect state in the UI (`disabled`, `aria-busy`).
@@@solution
```js
function bindSequential(button, task) {
  async function onClick(event) {
    // 1. Unbind immediately so rapid double-clicks are ignored
    button.removeEventListener("click", onClick)
    button.disabled = true
    button.setAttribute("aria-busy", "true")
    try {
      await task(event)
    } catch (err) {
      console.error("Task failed", err)
    } finally {
      // 2. Rebind once the work finishes — success or failure
      button.disabled = false
      button.removeAttribute("aria-busy")
      button.addEventListener("click", onClick)
    }
  }
  button.addEventListener("click", onClick)
  return () => button.removeEventListener("click", onClick) // cleanup
}

// usage
bindSequential(document.querySelector("#pay"), () =>
  fetch("/api/pay", { method: "POST" })
)
```

Why it works: `removeEventListener` requires the same function reference, so we keep `onClick` as a named function. `finally` guarantees rebinding even on errors. A simpler alternative is a closure flag (`let busy = false; if (busy) return;`) — mention both. Setting `disabled` also gives visual and accessible feedback. On the server, an idempotency key is still required — the UI guard alone isn't enough for payments.
:::

:::quiz
### By default, addEventListener handlers run in which phase?
- [ ] Capturing
- [x] Bubbling
- [ ] Both
- [ ] Neither — only at target
@@@explain
Default `capture` is `false`, so listeners on ancestors run on the way up.
:::

:::quiz
### Which call stops a link from navigating?
- [x] event.preventDefault()
- [ ] event.stopPropagation()
- [ ] return true
- [ ] event.stopImmediatePropagation()
@@@explain
Navigation is the default action; only `preventDefault` cancels it.
:::
