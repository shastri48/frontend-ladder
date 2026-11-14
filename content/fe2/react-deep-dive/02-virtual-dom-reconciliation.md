---
title: Virtual DOM & Reconciliation
summary: How React turns two element trees into the minimum set of DOM changes, and why keys matter so much.
minutes: 18
---

## Why a Virtual DOM at all?

Touching the real DOM is not slow by itself — what is slow is touching it **carelessly**: reading layout in the middle of writes, rebuilding big subtrees with `innerHTML`, or updating nodes that did not need to change. Every change can trigger style recalculation, layout and paint.

The "Virtual DOM" is simply React's in-memory tree of elements (today, a tree of **fiber** objects). Instead of you deciding which DOM nodes to change, React:

1. Renders your components to produce a new element tree.
2. **Diffs** it against the previous tree (this is *reconciliation*).
3. Applies only the necessary DOM operations in one batch during commit.

:::callout info The real benefit is the programming model
The Virtual DOM is not magically faster than hand-written DOM code — a perfect manual update will always win. The win is that you write declarative code (`UI = f(state)`) and still get *reasonably minimal* DOM updates automatically, without bugs from forgotten updates.
:::

## The diffing problem

Comparing two arbitrary trees optimally is O(n³) — for 1,000 nodes that is a billion operations. React uses an **O(n) heuristic** based on two assumptions:

1. **Elements of different types produce different trees.** If `<div>` becomes `<span>`, or `<Profile>` becomes `<Settings>`, React does not try to match their children — it unmounts the whole old subtree (destroying state) and mounts a new one.
2. **Keys identify children across renders.** Within a list of siblings, the developer tells React which child is which via a stable `key`.

## Rule by rule

### Same type, DOM element

```jsx
<div className="a" title="x" />  →  <div className="b" title="x" />
```
React keeps the same DOM node and only updates the changed attribute (`className`). Then it recurses into children.

### Same type, component

The component instance (and its state, hooks) is kept. React re-renders it with new props and recurses into its output.

### Different type

```jsx
<Counter />  →  <span><Counter /></span>
```
Even though `Counter` still appears, its *position* in the tree changed under a new parent type. The old `Counter` unmounts (state lost) and a new one mounts.

:::callout warn Component defined inside a component
```jsx
function Parent() {
  function Child() { return <input /> } // new function every render!
  return <Child />
}
```
Every render creates a *new* `Child` type, so React sees a different type each time, unmounts and remounts — the input loses focus and value on every keystroke. Always define components at module level.
:::

### Lists and keys

Without keys (or with index keys), React matches children **by position**:

```text
old:  [A, B, C]
new:  [Z, A, B, C]      ← inserted at the start

by index:   0:A→Z  1:B→A  2:C→B  3:+C     → 3 updates + 1 insert (and state goes to wrong items!)
by key:     A,B,C untouched, insert Z      → 1 insert
```

:::visual vdom-diff
:::

## The index-as-key bug

Using `index` as the key is fine **only** when the list is static: never reordered, filtered or inserted into from anything but the end. Otherwise, state attached to a position gets attached to the wrong item:

```jsx
{items.map((item, i) => (
  <li key={i}>
    {item.name} <input placeholder="note" />
  </li>
))}
```

Type a note next to "Apple", then insert "Banana" at the top. The note stays at index 0 — now next to Banana. The DOM input and component state were reused for the wrong data. Also, every item after the insertion point re-renders because its props changed.

Good keys are: **stable** (same item → same key across renders), **unique among siblings**, and **derived from data** (database id, slug). `Math.random()` or `Date.now()` as keys are the worst option: every render looks like a brand new list, so everything remounts.

:::callout tip Keys as a reset button
Because a changed key means "different element", you can deliberately reset a component's state: `<ProfileForm key={userId} />` gives each user a fresh form without any effect-based syncing.
:::

## Reconciliation, step by step

When `setState` runs on component `C`:

1. React marks `C`'s fiber (and its ancestors' "child has work" flags).
2. Starting from the root, React walks down, **skipping** subtrees without work.
3. At `C`, it calls the component function to get new children.
4. For each child, `reconcileChildren` compares old fiber vs new element: same type + same key → update (reuse fiber); otherwise delete old + create new. For arrays, it builds a map of keys to match moved items.
5. Effects (Placement, Update, Deletion) are collected on fibers.
6. Commit applies them to the DOM.

This is covered at a much deeper level in **FE3 → React Internals → Fiber**.

## Virtual DOM vs Shadow DOM

| | Virtual DOM | Shadow DOM |
|---|---|---|
| What | In-memory JS representation used by libraries | Browser feature for encapsulated DOM subtrees |
| Purpose | Efficient declarative updates | Style/markup encapsulation for Web Components |
| Provided by | React, Vue, Preact... | The browser (`element.attachShadow`) |

:::question
difficulty: medium
companies: Accenture, Tekion, Walmart
### What is reconciliation in React?
Reconciliation is the algorithm React uses to compare the new element tree produced by a render with the previous one and decide the minimal set of changes to apply to the DOM. It relies on two heuristics to stay O(n): elements of **different types** produce entirely different subtrees (so React replaces rather than diffing them), and **keys** identify list children across renders. Same type → reuse the DOM node / component instance and update props; different type → unmount old subtree (state lost) and mount new. The output of reconciliation is a list of effects applied during the commit phase. Since React 16 this work is done by the **Fiber** reconciler, which can split it into interruptible units.
:::

:::question
difficulty: easy
companies: Accenture
### What is the Virtual DOM and how does it improve performance?
The Virtual DOM is a lightweight in-memory tree of plain JS objects describing the UI. On each update React builds a new tree, diffs it against the old one and applies only the differences to the real DOM in a single batch. This avoids unnecessary DOM writes and layout thrashing and lets developers write declarative code. It isn't inherently faster than optimal manual DOM manipulation — its value is giving "good enough" minimal updates automatically while keeping code simple.
:::

:::question
difficulty: easy
companies: CRED, Accenture
### What is the purpose of the key prop?
Keys give list children a stable identity so React can match them across renders. With keys, React can tell that an item moved, was inserted or was removed, instead of assuming everything shifted by position. This keeps component state and DOM nodes (like focused inputs) attached to the right item and minimises DOM operations. Keys must be unique among siblings and stable — typically an id from your data.
:::

:::question
difficulty: medium
companies: CRED
### What is the consequence of using array indices as keys?
When the list is reordered, filtered or an item is inserted anywhere but the end, indices shift. React then matches items by position, so:
- **State and DOM get attached to the wrong item** (an uncontrolled input's text, a checkbox, an expanded state "jumps" to another row).
- **Performance suffers** — every item after the change gets new props and re-renders, instead of a single insert.
- Animations and focus behave incorrectly.

Index keys are only safe for static lists that never change order. Use stable ids instead; never use `Math.random()`, which remounts every item every render.
:::

:::question
difficulty: medium
### Why does defining a component inside another component cause bugs?
Each render of the parent creates a new function, so the inner component has a **new type** every time. React's diffing sees a different type at that position, unmounts the old subtree and mounts a fresh one — losing state, focus and DOM, and wasting work. Define components at module scope and pass data via props.
:::

:::challenge
difficulty: medium
### Which list re-uses DOM nodes best?
Given 1,000 rows where users can sort by any column, compare:

```jsx
// A
rows.map((r, i) => <Row key={i} row={r} />)
// B
rows.map(r => <Row key={r.id} row={r} />)
// C
rows.map(r => <Row key={Math.random()} row={r} />)
```
Rank them for correctness and performance after a sort, and explain why.
@@@solution
**B > A > C.**

- **B (stable id)**: React matches each row by id, moves existing DOM nodes and does not re-render memoised rows whose `row` prop is unchanged. Component state stays with the right row.
- **A (index)**: after sorting, position 0 now holds a different row. React reuses the DOM nodes in place but every `Row` gets new props and re-renders; any local state (expanded, inline edit) stays at the old position — a correctness bug.
- **C (random)**: every key is new each render, so React unmounts all 1,000 rows and mounts 1,000 new ones on *every* render, even unrelated ones. Worst performance and all state is lost.
:::

:::challenge
difficulty: easy
### Reset a form when the selected user changes — without useEffect
You have `<EditUser user={selectedUser} />` with internal `useState` for form fields initialised from `user`. When `selectedUser` changes, the old values remain. Fix it with one prop.
@@@solution
```jsx
<EditUser key={selectedUser.id} user={selectedUser} />
```
A different key tells React this is a different element, so it unmounts the old `EditUser` and mounts a new one whose `useState` initialisers read the new user. This is cleaner than an effect that copies props into state.
:::

:::quiz
### `<div><Counter/></div>` re-renders as `<section><Counter/></section>`. What happens to Counter's state?
- [ ] It is preserved because Counter's type didn't change
- [x] It is lost — the parent type changed, so the whole subtree remounts
- [ ] React throws an error
@@@explain
Different element type at the same position → React tears down the subtree, including its child components and their state.
:::

:::quiz
### What is the time complexity of React's diffing heuristic?
- [ ] O(n³)
- [ ] O(n log n)
- [x] O(n)
@@@explain
By assuming different types → different trees and using keys for lists, React compares trees level by level in linear time.
:::
