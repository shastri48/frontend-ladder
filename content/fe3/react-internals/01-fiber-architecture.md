---
title: React Fiber Architecture
summary: Fiber nodes, the work loop, double buffering, render and commit phases, and how lanes prioritise updates.
minutes: 25
---

## Why React rewrote its core

Before React 16, the reconciler (now called the **Stack reconciler**) walked the component tree **recursively**. Once an update started, it ran to completion on the JS call stack — you couldn't pause a recursive function. A big update could block the main thread for 100+ ms: typing lagged, animations stuttered.

**Fiber** (React 16, 2017) re-implemented reconciliation so that rendering work can be:

- **Split** into small units,
- **Paused** and resumed,
- **Prioritised** (urgent typing before a slow list),
- **Aborted** and restarted when newer data arrives,
- **Reused** where already done.

These capabilities are the foundation of everything "concurrent": transitions, Suspense, `useDeferredValue`, selective hydration.

:::callout analogy A chef with tickets instead of one long recipe
The stack reconciler was a chef who had to finish a 40-step banquet once started, ignoring a customer who just wanted water. Fiber breaks the banquet into tickets; between tickets the chef checks if something more urgent came in.
:::

## What is a fiber?

A fiber is a **plain JS object representing a unit of work** — one per component instance, DOM element, fragment, etc. It is a virtual stack frame that React manages itself (on the heap), instead of relying on the JS call stack.

```js
{
  tag: FunctionComponent | HostComponent | ...,  // what kind of node
  type: Button | 'div',
  key: 'item-3',
  stateNode: domNode | classInstance | null,      // link to the real thing
  // tree pointers (a linked list, not arrays)
  return: parentFiber,
  child: firstChildFiber,
  sibling: nextSiblingFiber,
  // data
  pendingProps, memoizedProps,
  memoizedState,       // for function components: the hooks linked list
  updateQueue,         // pending state updates / effects
  // scheduling
  lanes, childLanes,   // pending work priority on this fiber / its subtree
  // effects
  flags, subtreeFlags, // Placement, Update, Deletion, Passive (useEffect), Layout...
  deletions,
  alternate,           // the twin fiber in the other tree
}
```

The `child` / `sibling` / `return` pointers let React traverse the tree **iteratively** with a simple loop and resume from any fiber — which recursion couldn't do.

```text
        App
         │ child
        Layout ──sibling──► Footer
         │ child
       Header ──sibling──► Main
                            │ child
                           List
   (every node also has .return → parent)
```

## Double buffering: current and work-in-progress

React keeps **two trees**:

- **current** — what's on screen now.
- **workInProgress (WIP)** — the tree being built for the next render.

Each fiber's `alternate` points to its twin. During render React builds/updates the WIP tree (cloning from current where possible). At commit, React simply **swaps the root pointer**: WIP becomes current. Like a game engine's back buffer — you never see a half-drawn frame. If a render is abandoned, the WIP tree is thrown away and the current tree is untouched.

## The work loop

```js
// simplified from ReactFiberWorkLoop
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress)
  }
}

function performUnitOfWork(fiber) {
  const next = beginWork(fiber)        // render component / diff children → returns child
  if (next) workInProgress = next
  else completeUnitOfWork(fiber)       // no child: complete this node, go to sibling or back up
}
```

- **`beginWork`** — on the way down: call the component function (or class `render`), reconcile its children (create/reuse child fibers, mark flags). If a fiber has no pending work and props are unchanged (`memoizedProps === pendingProps` and no context change), React **bails out** and can skip the whole subtree if `childLanes` is empty.
- **`completeWork`** — on the way up: for host components, create DOM nodes (off-screen) or compute the attribute diff; bubble `subtreeFlags` up so commit can skip clean subtrees.
- **`shouldYield()`** — the Scheduler checks whether the ~5 ms time slice is used up or a higher-priority event is waiting. If so, React returns control to the browser (to paint, handle input) and resumes later via a `MessageChannel` macrotask.

Synchronous renders (`workLoopSync`) run the same loop without `shouldYield`.

:::visual fiber-phases
:::

## Render phase vs commit phase (internals)

**Render phase** (interruptible in concurrent mode):
- `beginWork` / `completeWork` across the tree.
- Pure: no DOM mutations, no effects. May be called **multiple times** for one commit → why render must be pure and why `UNSAFE_componentWillMount` etc. were deprecated.

**Commit phase** (synchronous, never interrupted), three sub-phases:
1. **Before mutation** — `getSnapshotBeforeUpdate` (read DOM before changes).
2. **Mutation** — insert/update/delete DOM nodes; detach old refs; run layout-effect cleanups.
3. **Layout** — swap `root.current = finishedWork`; attach refs; run `useLayoutEffect` setups and `componentDidMount/Update`.

After commit, **passive effects** (`useEffect`) are flushed asynchronously after paint (or synchronously before the next render if another update comes first).

## Lanes: priorities as bitmasks

Every update gets a **lane** — a bit in a 31-bit mask, where lower bits are higher priority:

| Lane (simplified) | Source |
|---|---|
| `SyncLane` | `flushSync`, legacy sync mode |
| `InputContinuousLane` | continuous events: mousemove, scroll, drag |
| `DefaultLane` | normal updates: clicks, setTimeout, fetch callbacks (discrete events get `SyncLane` in React 18) |
| `TransitionLanes` (16) | `startTransition`, `useDeferredValue` |
| `RetryLanes` | Suspense retries |
| `IdleLane` | very low priority |
| `OffscreenLane` | hidden content (Activity) |

Why bitmasks? Cheap set operations: merge pending work (`a | b`), check inclusion (`(lanes & lane) !== 0`), pick the highest priority (`lanes & -lanes`). Each fiber tracks `lanes` (own pending work) and `childLanes` (work somewhere below) so the work loop can skip clean subtrees.

When a higher-priority update arrives during a transition render, React can **interrupt** the transition, render the urgent update, commit it, and then **restart** the transition from the new state. Lanes also handle **entanglement** (updates that must render together) and **starvation prevention** (a low-priority update that waits too long gets promoted to sync).

## The Scheduler

`scheduler` is a separate package that runs tasks by priority with time slicing:
- Uses a min-heap task queue keyed by expiration time.
- Schedules via `MessageChannel` (a macrotask without `setTimeout`'s 4 ms clamping) so it yields to the browser between slices.
- Each slice is ~5 ms; between slices the browser can paint and process input.

## Putting it together: what happens on setState

1. `setCount(1)` → creates an update object, enqueues it on the hook's queue, assigns a lane (based on the current event/transition context).
2. `scheduleUpdateOnFiber` marks lanes on the fiber and `childLanes` up to the root.
3. `ensureRootIsScheduled` asks the Scheduler for a task at that priority (or a microtask for SyncLane).
4. The work loop renders from the root, bailing out of untouched subtrees, re-rendering the updated component and its children.
5. Commit applies DOM changes, runs layout effects, swaps trees.
6. Passive effects run after paint.

:::question
difficulty: hard
companies: Walmart, Housing.com
### How does React's reconciliation algorithm (Fiber) work internally, and how does it improve rendering performance?
Fiber represents each element as a fiber node — a heap-allocated unit of work linked by `child`, `sibling` and `return` pointers — so React can walk the tree iteratively and pause/resume at any node instead of recursing to completion. Rendering is split into a **render phase** (beginWork/completeWork building a work-in-progress tree, pure and interruptible, yielding to the browser every ~5 ms via the Scheduler) and a **commit phase** (synchronous DOM mutations, refs, layout effects, then root pointer swap — double buffering). Updates carry **lanes** (bitmask priorities) so urgent updates like typing can interrupt and pre-empt low-priority transitions; abandoned work is discarded without affecting the screen. It improves *responsiveness* more than raw throughput: long renders no longer block input and painting, enabling transitions, Suspense and selective hydration.
:::

:::question
difficulty: hard
### What is double buffering in React Fiber?
React maintains two fiber trees: `current` (on screen) and `workInProgress` (being rendered). Each fiber's `alternate` points to its counterpart, so React reuses objects instead of allocating new ones each render. All changes are prepared in the WIP tree; when commit finishes, React swaps `root.current` to the WIP tree. If a render is interrupted or thrown away, the current tree is untouched, so users never see inconsistent UI.
:::

:::question
difficulty: hard
### What are lanes in React?
Lanes are React's priority model: each update gets a bit in a 31-bit mask (SyncLane, InputContinuous, Default, 16 Transition lanes, Retry, Idle, Offscreen). Fibers track pending `lanes` and `childLanes`. Bitwise operations make merging, checking and selecting the highest-priority work cheap. The work loop renders the highest-priority lanes first, can interrupt lower-priority (transition) work for urgent input, batches updates in the same lane together, and promotes starved lanes to avoid indefinite delays.
:::

:::question
difficulty: hard
companies: Housing.com
### Why can't the render phase have side effects?
In concurrent React the render phase may be paused, restarted or discarded, and StrictMode intentionally double-invokes it. Side effects there (network calls, subscriptions, mutations of external objects) could run multiple times or for UI that never commits, causing duplicate requests, leaks and inconsistent state. Side effects belong in event handlers or effects, which run once per commit.
:::

:::challenge
difficulty: hard
### Implement a toy fiber work loop
Given a tree of plain nodes `{ name, children: [] }`, convert it into fiber-like objects with `child`, `sibling`, `return` pointers, then write an **iterative** `walk(rootFiber, visit)` that visits every node depth-first in the same order a recursive pre-order traversal would — without recursion, so it could be paused between nodes.
@@@starter
```js
function toFiber(node, parent = null) {
  // return { name, child, sibling, return }
}

function walk(root, visit) {
  // iterative depth-first using child/sibling/return
}
```
@@@tests
```js
const tree = { name: 'App', children: [
  { name: 'Header', children: [{ name: 'Logo', children: [] }] },
  { name: 'Main', children: [{ name: 'List', children: [] }, { name: 'Aside', children: [] }] },
  { name: 'Footer', children: [] },
]}
test('visits in pre-order', () => {
  const order = []
  walk(toFiber(tree), f => order.push(f.name))
  expect(order).toEqual(['App','Header','Logo','Main','List','Aside','Footer'])
})
test('return pointers', () => {
  const root = toFiber(tree)
  expect(root.child.child.return.name).toBe('Header')
  expect(root.child.sibling.name).toBe('Main')
})
```
@@@solution
```js
function toFiber(node, parent = null) {
  const fiber = { name: node.name, child: null, sibling: null, return: parent }
  let prev = null
  for (const childNode of node.children) {
    const childFiber = toFiber(childNode, fiber)
    if (!prev) fiber.child = childFiber
    else prev.sibling = childFiber
    prev = childFiber
  }
  return fiber
}

function walk(root, visit) {
  let node = root
  while (node) {
    visit(node)                       // "beginWork"
    if (node.child) { node = node.child; continue }
    while (node && !node.sibling) {   // "completeWork" as we climb
      if (node === root) return
      node = node.return
    }
    if (!node || node === root) return
    node = node.sibling
  }
}
```
The loop's state is a single pointer (`node`), so React can store it in `workInProgress`, stop when `shouldYield()` is true, and continue later from exactly that fiber — impossible with the JS call stack of a recursive walk.
:::

:::quiz
### What lets Fiber pause and resume rendering?
- [ ] Web Workers
- [x] Representing work as linked fiber objects traversed iteratively instead of recursion
- [ ] requestIdleCallback with generators
@@@explain
Fibers are heap-allocated stack frames; a pointer to the next unit of work is all the state needed to resume.
:::

:::quiz
### Which phase runs useLayoutEffect?
- [ ] Render phase
- [x] Commit phase (layout sub-phase), before paint
- [ ] After paint, with passive effects
@@@explain
Layout effects run synchronously after DOM mutation; passive effects (useEffect) run after paint.
:::
