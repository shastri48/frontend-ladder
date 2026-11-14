---
title: Lists, Keys, Conditional Rendering & Fragments
summary: Render arrays, why keys matter, what goes wrong with index keys, conditional patterns and Fragments.
minutes: 15
---

## Rendering lists

JSX can render arrays of elements, so `map` is how you render lists:

```jsx
function LevelList({ levels }) {
  return (
    <ul>
      {levels.map((level) => (
        <li key={level.id}>{level.code} — {level.title}</li>
      ))}
    </ul>
  )
}
```

Filter, sort and slice **before** mapping:

```jsx
{products
  .filter((p) => p.inStock)
  .toSorted((a, b) => a.price - b.price)
  .map((p) => <ProductCard key={p.id} product={p} />)}
```

## The key prop

When a list changes, React must match each element in the new list with one in the old list to decide: update it, move it, create it or destroy it. The **key** is the element's identity for that matching.

:::visual vdom-diff
:::

```text
Old:  [key=a] [key=b] [key=c]
New:  [key=z] [key=a] [key=b] [key=c]   ← inserted at top

With stable keys: React sees a, b, c unchanged → creates only z and inserts it.
```

Rules:

- Keys must be **unique among siblings** (not globally).
- Keys must be **stable** — the same item gets the same key on every render.
- Use IDs from your data (`user.id`). Generate IDs when *creating* items (`crypto.randomUUID()`), never during render.
- `key` is not passed to the component as a prop. If the child needs the id, pass it separately.

### What goes wrong with array indices as keys?

Index keys work only if the list is **static**: never reordered, filtered or inserted into except at the end.

When you insert at the top, delete from the middle, or sort, indices shift — the item that *was* at index 0 is now at index 1 — so React **pairs the wrong old and new elements**:

```jsx
// Each row holds its own uncontrolled input / local state
{todos.map((todo, index) => (
  <li key={index}>
    {todo.text} <input placeholder="note" />
  </li>
))}
```

Type "urgent" into the first row's input, then add a todo **at the top**. With `key={index}`:

```text
Before:  key=0 "Buy milk"  [input: urgent]
         key=1 "Call mom"  [input: ]

After adding "Pay bills" at top:
         key=0 "Pay bills" [input: urgent]   ← state stayed with key 0!
         key=1 "Buy milk"  [input: ]
         key=2 "Call mom"  [input: ]          ← new DOM created at the end
```

Consequences:

1. **State/DOM attached to the wrong item** — input values, focus, checkbox state, animations, component state in children.
2. **Performance** — every row's content changes instead of one insertion, so React re-renders and patches all rows.
3. **Bugs with memoised children** — props change for every row.

Random keys (`key={Math.random()}`) are even worse: every render destroys and recreates every element, losing all state and focus.

:::callout tip Keys can reset components
Changing a component's key forces React to unmount the old instance and mount a fresh one. `<ProfileForm key={userId} />` is the idiomatic way to reset a form when switching users.
:::

## Conditional rendering

```jsx
// 1. Early return
if (status === "loading") return <Spinner />
if (error) return <ErrorMessage error={error} />

// 2. Ternary — either/or
{isLoggedIn ? <Dashboard /> : <Login />}

// 3. && — show or nothing (watch out for 0!)
{unread > 0 && <Badge count={unread} />}

// 4. Lookup object for many cases
const views = { grid: <GridView />, list: <ListView />, map: <MapView /> }
return views[mode] ?? null

// 5. null renders nothing
function Banner({ message }) {
  if (!message) return null
  return <div className="banner">{message}</div>
}
```

Hiding vs not rendering: `{show && <Modal />}` **unmounts** the modal (its state is lost). `<Modal hidden={!show} />` or CSS keeps it mounted (state preserved, but still in the DOM).

## Fragments

A component must return a single node, but adding wrapper `<div>`s pollutes the DOM and can break layouts (flex/grid children, table rows, `<dl>` lists).

```jsx
function Row({ name, value }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </>
  )
}
```

`<>...</>` is shorthand for `<React.Fragment>`. Use the long form when you need a **key** (fragments in a list):

```jsx
{glossary.map((term) => (
  <React.Fragment key={term.id}>
    <dt>{term.word}</dt>
    <dd>{term.meaning}</dd>
  </React.Fragment>
))}
```

Fragments render nothing to the DOM — no extra node, no styling impact, slightly less memory.

## Interview questions

:::question
difficulty: easy
companies: Accenture, CRED
### What is the purpose of the key prop in React?
Keys give list items a stable identity so React's reconciliation can match elements between renders. With keys, React knows which items were added, removed or moved and can preserve their DOM and component state, doing the minimal work. Keys must be unique among siblings and stable across renders; use data IDs.
:::

:::question
difficulty: easy
companies: CRED, Accenture
### What is the consequence of using array indices as keys?
When the list is reordered, filtered, or items are inserted anywhere but the end, indices shift, so React matches old and new items incorrectly. Component state and DOM state (input values, focus, checked boxes) end up attached to the wrong item, and React re-renders/patches every row instead of just the changed one. Index keys are acceptable only for static lists that never change order and have no item state.
:::

:::question
difficulty: easy
### What are React Fragments used for?
Fragments let a component return multiple elements without adding an extra DOM node. This keeps markup valid (e.g. `<td>`s inside `<tr>`, `<dt>/<dd>` pairs) and avoids breaking CSS layouts like flex/grid that depend on direct children. Short syntax `<>…</>`; use `<React.Fragment key={...}>` when mapping a list.
:::

:::question
difficulty: medium
### Why doesn't React just use the array index internally as identity?
That's what it does if you don't provide keys — and it warns you. Position-based matching assumes items never move. React can't know your data's identity, so it asks you to supply it via `key`; otherwise reorders become "every item changed" and state gets mismatched.
:::

## Challenges

:::challenge
difficulty: easy
### Expand / collapse list
Build a `FaqList` that renders `[{ id, question, answer }]`. Clicking a question toggles its answer. Add "Expand all" / "Collapse all" buttons. Multiple items may be open.
@@@solution
```jsx
import { useState } from "react"

export function FaqList({ items }) {
  const [openIds, setOpenIds] = useState(() => new Set())

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev)            // never mutate state
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allOpen = items.length > 0 && openIds.size === items.length

  return (
    <div>
      <button onClick={() => setOpenIds(allOpen ? new Set() : new Set(items.map((i) => i.id)))}>
        {allOpen ? "Collapse all" : "Expand all"}
      </button>
      <ul>
        {items.map((item) => {
          const open = openIds.has(item.id)
          return (
            <li key={item.id}>
              <button aria-expanded={open} aria-controls={`faq-${item.id}`} onClick={() => toggle(item.id)}>
                {open ? "▾" : "▸"} {item.question}
              </button>
              {open && <p id={`faq-${item.id}`}>{item.answer}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```
Design notes: store the **set of open ids** (not a boolean on each item) so data stays pure; copy the Set before changing it; stable `key={item.id}`; `aria-expanded` for accessibility. For "only one open" (accordion), store a single `openId` instead.
:::

:::challenge
difficulty: medium
### Nested expand/collapse (tree)
Render a nested folder tree `{ id, name, children?: [] }` where each folder can be expanded/collapsed independently, with indentation by depth.
@@@solution
```jsx
function TreeNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(false)
  const hasChildren = node.children?.length > 0
  return (
    <li>
      <div style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "📂" : "📁"} {node.name}
          </button>
        ) : (
          <span>📄 {node.name}</span>
        )}
      </div>
      {hasChildren && open && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function Tree({ data }) {
  return <ul role="tree">{data.map((n) => <TreeNode key={n.id} node={n} />)}</ul>
}
```
Recursion: a component rendering itself for children. Each `TreeNode` owns its `open` state; because children unmount when collapsed, their state resets — if you need to remember nested open state, lift it to a `Set` of open ids at the top (like the previous challenge).
:::

:::quiz
### Best key for a list of users from an API?
- [ ] The array index
- [ ] Math.random()
- [x] user.id
- [ ] JSON.stringify(user)
@@@explain
A stable, unique ID from the data.
:::

:::quiz
### `{count && <Badge />}` with count = 0 renders…
- [ ] Nothing
- [x] The text "0"
- [ ] <Badge />
- [ ] An error
@@@explain
`0 && x` is `0`, and React renders numbers. Use `count > 0 &&`.
:::
