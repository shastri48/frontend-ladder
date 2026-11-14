---
title: State Update Scheduling, Batching & flushSync
summary: What actually happens between setState and the screen — update queues, priorities, batching and when to force a synchronous flush.
minutes: 20
---

## setState is a request, not an assignment

`setState(x)` does **not** change state immediately. It:

1. Creates an **update object** `{ lane, action: x, next }`.
2. Appends it to the hook's (or class's) circular **update queue**.
3. Marks the fiber and its ancestors as having pending work in that lane.
4. Asks React to **schedule** a render for the root.

The new state is calculated **during the next render**, when React processes the queue for that hook in order. That's why reading state right after `setState` gives the old value, and why updater functions compose: `prev => prev + 1` receives the result of the previous queued update.

:::callout info "State scheduling" in interviews
When asked "what is state scheduling?", the answer is this: React **queues** updates, **assigns each a priority (lane)** based on where it came from, **batches** updates of the same priority into one render, and **decides when** to render — synchronously for discrete user input, interruptibly for transitions — instead of re-rendering immediately on every call.
:::

## Eager state and bail-outs

If the fiber has no pending updates, React can compute the new state **eagerly** at `setState` time. If it's `Object.is` equal to the current state, React may skip scheduling entirely. Otherwise it renders, and if the component's result shows no change, it bails out of the children.

## Priorities by origin

| Where the update came from | Priority |
|---|---|
| `flushSync(() => ...)` | Sync — render immediately |
| Discrete events: click, keydown, input, submit | Sync lane (processed in a microtask at end of event) |
| Continuous events: mousemove, scroll, pointermove, drag | Continuous lane |
| Everything else: `setTimeout`, promises, network callbacks | Default lane |
| `startTransition` / `useTransition` | Transition lane (interruptible) |
| `useDeferredValue` | Deferred render in a transition lane |

## Batching

**Batching** = combining multiple updates into a single render + commit.

### React 17 and earlier

Only updates inside React-managed event handlers were batched:

```jsx
handleClick() {          // batched → 1 render
  setA(1); setB(2)
}
setTimeout(() => {       // NOT batched → 2 renders
  setA(1); setB(2)
}, 0)
fetch(url).then(() => {  // NOT batched → 2 renders
  setA(1); setB(2)
})
```

(`ReactDOM.unstable_batchedUpdates` was the escape hatch.)

### React 18+: automatic batching

With `createRoot`, **all** updates scheduled in the same tick at the same priority are batched — in timeouts, promises, native event listeners, anywhere. Fewer renders, consistent intermediate states never shown.

Implementation sketch: updates are queued and React schedules **one** render task for the root. Since the task runs later (microtask for sync lane, scheduler task for default), all `setState` calls in the current synchronous code are already in the queue when rendering starts.

## flushSync: opting out

Sometimes you must have the DOM updated **right now**, before the next line runs:

```jsx
import { flushSync } from 'react-dom'

function addMessage(text) {
  flushSync(() => {
    setMessages(m => [...m, text])
  })
  // DOM now contains the new message
  listRef.current.lastElementChild.scrollIntoView()
}
```

Other use cases: focusing an element that the update just rendered, measuring layout after an update, integrating with third-party code that reads the DOM synchronously, `window.print()` after rendering print content.

| | Normal update | `flushSync` |
|---|---|---|
| When rendered | Later, batched with other updates | Immediately, before `flushSync` returns |
| Priority | From context (sync/default/transition) | Sync lane |
| Batching | Combined with siblings | Forces pending updates to flush now |
| Cost | Efficient | Can hurt performance; breaks concurrent benefits; may force Suspense fallbacks |

:::callout warn Use flushSync rarely
It's a de-optimisation. Prefer `useLayoutEffect` for "after this render, read the DOM" logic, or a ref callback. Calling `flushSync` inside render or inside an effect logs a warning.
:::

## How updates are processed during render

For each hook, React walks the queue and applies updates whose lane is included in the current render's lanes, **skipping** lower-priority ones (keeping them for a later render) while preserving order:

```text
queue: [ +1 (Default), ×2 (Transition), +10 (Default) ]
urgent render (Default lanes):  applies +1, skips ×2, applies +10   → shows base + 11 (temporarily)
                                (+10 is kept in the queue because an earlier update was skipped)
transition render (all lanes):  rebases from base: ((base + 1) × 2) + 10  → final, correct order
```

React keeps a **base state** and re-applies skipped updates in order later, so the final state is the same as if all updates were processed in order — like a git rebase. This is how urgent updates can "jump the queue" without breaking correctness.

## Class components: setState callback

`this.setState(partial, callback)` — the callback runs after the update is committed (like `componentDidUpdate`). Function components don't have this; use `useEffect` reacting to the state, or `flushSync`.

## Reading state "right after" setState — options

```jsx
// ❌ old value
setCount(count + 1); console.log(count)

// ✅ compute the next value yourself
const next = count + 1
setCount(next); console.log(next)

// ✅ react to the committed value
useEffect(() => { console.log(count) }, [count])
```

:::question
difficulty: hard
companies: Groww
### What is state scheduling in React?
State updates aren't applied immediately. Each `setState` enqueues an update on the fiber's hook queue with a **lane** (priority) derived from its origin — sync for discrete events/flushSync, continuous for mousemove/scroll, default for timers/network, transition for `startTransition`. React then schedules a render for the root through its Scheduler, **batches** same-priority updates into one render, processes urgent lanes first, can interrupt transition renders, and rebases skipped updates so final state is consistent. Effects and paint happen after the commit.
:::

:::question
difficulty: medium
companies: CRED
### flushSync vs a normal state update?
A normal update is queued and rendered later, batched with others, at a priority determined by context. `flushSync(() => setX(v))` forces React to synchronously render and commit that update (and any pending ones) before returning, so the DOM is updated on the next line — useful to scroll to/focus/measure newly-rendered content or for third-party integrations. It defeats batching and concurrent scheduling, so use it sparingly; prefer layout effects or ref callbacks.
:::

:::question
difficulty: medium
### Why do multiple setState calls in a setTimeout cause one render in React 18 but two in React 17?
React 17 only batched updates inside its own event handler scope; in a timeout each `setState` triggered a synchronous render. React 18's `createRoot` enables automatic batching: updates are queued and React schedules a single render task for the root, so all updates in the same tick (timeouts, promises, native listeners) render together.
:::

:::challenge
difficulty: hard
### Scroll to the new message
```jsx
function Chat() {
  const [messages, setMessages] = useState([])
  const listRef = useRef(null)
  function send(text) {
    setMessages(m => [...m, { id: crypto.randomUUID(), text }])
    listRef.current.lastElementChild?.scrollIntoView({ behavior: 'smooth' })
  }
  // ...
}
```
It always scrolls to the *previous* last message. Why? Give two fixes and compare.
@@@solution
`setMessages` only queues the update; the DOM still contains the old list when `scrollIntoView` runs.

**Fix 1 — flushSync:**
```jsx
function send(text) {
  flushSync(() => setMessages(m => [...m, { id: crypto.randomUUID(), text }]))
  listRef.current.lastElementChild.scrollIntoView({ behavior: 'smooth' })
}
```
Simple, imperative, but forces a synchronous render (skips batching).

**Fix 2 — layout effect reacting to new messages:**
```jsx
useLayoutEffect(() => {
  listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' })
}, [messages.length])
```
Keeps updates batched and also handles messages arriving from a WebSocket, not only from `send`. Usually preferred; add a "user is scrolled up" check so incoming messages don't yank the view.
:::

:::quiz
### In React 18 with createRoot, how many renders: `fetch().then(() => { setA(1); setB(2); setC(3) })`?
- [x] 1
- [ ] 3
- [ ] 2
@@@explain
Automatic batching groups all three updates.
:::

:::quiz
### Which update gets the lowest priority?
- [ ] onClick setState
- [ ] flushSync setState
- [x] setState inside startTransition
@@@explain
Transitions are interruptible, low-priority lanes.
:::
