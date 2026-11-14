---
title: Multi-Select Dropdown, Nested Checkboxes and File Explorer
summary: CRED's no-library multi-select with full keyboard navigation, tri-state nested checkboxes, and a recursive file explorer — the tree and widget problems of machine coding.
minutes: 22
---

## Why these three

They test the same core skills from different angles:

- **Widgets with keyboard + ARIA** (the multi-select) — can you build what component libraries hide from you?
- **Recursive data and derived state** (nested checkboxes, file explorer) — can you model trees cleanly and update them immutably?

CRED's SDE-2 machine-coding round bans component libraries entirely: "you build a real multi-select dropdown from scratch, keyboard navigation and all."

## Multi-select dropdown (combobox)

Requirements to clarify up front:

- Search/filter options by typing? (Usually yes.)
- Selected items shown as removable **chips**?
- Keyboard: ArrowUp/Down to move, Enter to toggle, Escape to close, Backspace on empty input removes the last chip, Tab leaves.
- Close on outside click; max selections; async options?

ARIA pattern: an `<input role="combobox" aria-expanded aria-controls aria-activedescendant>` with a `<ul role="listbox" aria-multiselectable="true">` of `<li role="option" aria-selected>`. Focus **stays in the input**; the "active" option is communicated with `aria-activedescendant` (virtual focus).

:::challenge
difficulty: hard
companies: CRED
### Build a multi-select dropdown from scratch
`<MultiSelect options={[{value, label}]} value={selectedValues} onChange={fn} placeholder="Pick fruits" />`
- Typing filters options (case-insensitive); the list opens on focus/typing.
- Up/Down move the highlighted option (wrapping), Enter toggles it, Escape closes, Backspace on empty input removes the last chip.
- Click an option to toggle; click a chip's ✕ to remove; click outside closes.
- Highlighted option scrolls into view. Accessible with ARIA combobox/listbox roles.
@@@solution
```jsx
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './MultiSelect.css'

export function MultiSelect({ options, value, onChange, placeholder = 'Select…', label = 'Options' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)          // index into `filtered`
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const id = useId()

  const selected = useMemo(() => new Set(value), [value])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  // keep active index valid when the filtered list changes
  useEffect(() => { setActive(0) }, [query])

  // close on outside click
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // scroll highlighted option into view
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const toggle = (opt) => {
    onChange(selected.has(opt.value) ? value.filter((v) => v !== opt.value) : [...value, opt.value])
    setQuery('')
    inputRef.current.focus()
  }
  const remove = (v) => onChange(value.filter((x) => x !== v))

  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) return setOpen(true)
        setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0))
        break
      case 'Enter':
        if (open && filtered[active]) { e.preventDefault(); toggle(filtered[active]) }
        break
      case 'Escape':
        setOpen(false)
        break
      case 'Backspace':
        if (!query && value.length) remove(value[value.length - 1])
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  const labelFor = (v) => options.find((o) => o.value === v)?.label ?? v
  const listId = `${id}-listbox`
  const optId = (i) => `${id}-opt-${i}`

  return (
    <div className="ms" ref={rootRef}>
      <label htmlFor={`${id}-input`} className="ms__label">{label}</label>
      <div className="ms__control" onClick={() => { inputRef.current.focus(); setOpen(true) }}>
        {value.map((v) => (
          <span className="ms__chip" key={v}>
            {labelFor(v)}
            <button type="button" aria-label={`Remove ${labelFor(v)}`}
              onClick={(e) => { e.stopPropagation(); remove(v) }}>✕</button>
          </span>
        ))}
        <input
          id={`${id}-input`}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? optId(active) : undefined}
          value={query}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && (
        <ul className="ms__list" id={listId} role="listbox" aria-multiselectable="true" ref={listRef}>
          {filtered.length === 0 && <li className="ms__empty">No matches</li>}
          {filtered.map((opt, i) => {
            const isSel = selected.has(opt.value)
            return (
              <li
                key={opt.value}
                id={optId(i)}
                data-index={i}
                role="option"
                aria-selected={isSel}
                className={`ms__option ${i === active ? 'is-active' : ''} ${isSel ? 'is-selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}     // keep focus in the input
                onClick={() => toggle(opt)}
              >
                <span aria-hidden="true">{isSel ? '☑' : '☐'}</span> {opt.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

```css
.ms { position: relative; width: 320px; font: inherit; }
.ms__control { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; border: 1px solid #94a3b8; border-radius: 8px; cursor: text; }
.ms__control:focus-within { outline: 2px solid #6366f1; }
.ms__chip { display: inline-flex; gap: 4px; align-items: center; background: #eef2ff; border-radius: 999px; padding: 2px 8px; }
.ms__chip button { border: 0; background: none; cursor: pointer; }
.ms__control input { flex: 1; min-width: 80px; border: 0; outline: 0; }
.ms__list { position: absolute; inset-inline: 0; top: 100%; margin-top: 4px; max-height: 220px; overflow: auto;
  background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px; list-style: none; z-index: 10; }
.ms__option { padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.ms__option.is-active { background: #e0e7ff; }
.ms__option.is-selected { font-weight: 600; }
```

Usage:
```jsx
const [fruits, setFruits] = useState(['apple'])
<MultiSelect label="Fruits" options={[{value:'apple',label:'Apple'},{value:'banana',label:'Banana'},{value:'cherry',label:'Cherry'}]}
  value={fruits} onChange={setFruits} />
```

What to highlight:
- **Controlled API** (`value`/`onChange`) so parents own the selection — works in forms, URL sync, etc.
- **Virtual focus** via `aria-activedescendant`; real focus never leaves the input, so typing keeps working.
- `onMouseDown preventDefault` on options stops the input from blurring before the click registers — a classic dropdown bug.
- Outside click via `pointerdown` on `document` + `contains`.
- `scrollIntoView({ block: 'nearest' })` keeps the active option visible.
- `useId` for unique, SSR-safe ids.
- Follow-ups: async options with debounce + loading state; "Select all"; max selections; grouping; virtualization for 10k options; portal to escape `overflow: hidden` parents; positioning near viewport edges (flip up).
:::

## Nested checkboxes (tri-state)

Rules:
- Checking a parent checks all descendants; unchecking unchecks all.
- A parent is **checked** if all children are checked, **indeterminate** if some are, unchecked if none.

The key insight: **store only leaf states** (or a Set of checked leaf ids). Parent states are **derived** — storing them too creates sync bugs.

:::challenge
difficulty: medium
### Nested checkboxes with indeterminate state
Given a tree `{ id, label, children? }[]`, render nested checkboxes with the rules above. `indeterminate` can only be set via a DOM property (no HTML attribute) — handle that.
@@@solution
```jsx
import { useEffect, useMemo, useRef, useState } from 'react'

const TREE = [
  { id: 'fruits', label: 'Fruits', children: [
    { id: 'apple', label: 'Apple' },
    { id: 'citrus', label: 'Citrus', children: [{ id: 'orange', label: 'Orange' }, { id: 'lemon', label: 'Lemon' }] },
  ]},
  { id: 'veg', label: 'Vegetables', children: [{ id: 'carrot', label: 'Carrot' }, { id: 'pea', label: 'Pea' }] },
]

// collect leaf ids under a node (memoized per node)
function leavesOf(node) {
  return node.children ? node.children.flatMap(leavesOf) : [node.id]
}

function Checkbox({ checked, indeterminate, ...props }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.indeterminate = indeterminate }, [indeterminate])
  return <input type="checkbox" ref={ref} checked={checked} aria-checked={indeterminate ? 'mixed' : checked} {...props} />
}

function Node({ node, checkedLeaves, setLeaves }) {
  const leaves = useMemo(() => leavesOf(node), [node])
  const count = leaves.filter((id) => checkedLeaves.has(id)).length
  const checked = count === leaves.length
  const indeterminate = count > 0 && !checked

  const onChange = () => setLeaves(leaves, !checked)

  return (
    <li>
      <label>
        <Checkbox checked={checked} indeterminate={indeterminate} onChange={onChange} /> {node.label}
      </label>
      {node.children && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.id} node={c} checkedLeaves={checkedLeaves} setLeaves={setLeaves} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function NestedCheckboxes({ tree = TREE }) {
  const [checkedLeaves, setChecked] = useState(() => new Set())
  const setLeaves = (ids, value) =>
    setChecked((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (value ? next.add(id) : next.delete(id)))
      return next
    })
  return (
    <ul className="tree">
      {tree.map((n) => <Node key={n.id} node={n} checkedLeaves={checkedLeaves} setLeaves={setLeaves} />)}
    </ul>
  )
}
```
- State = Set of checked **leaf** ids. Every parent's checked/indeterminate is **computed** from its leaves → consistent by construction, both downward (check all) and upward propagation are free.
- `indeterminate` is a DOM property only, so a small wrapper sets it in an effect; `aria-checked="mixed"` for screen readers.
- Complexity: each node scans its leaves — O(n·depth). For huge trees precompute parent→leaves once, or store counts.
- Follow-ups: "select all" at the top, persisted selection, search filtering that keeps ancestors visible, lazy-loaded children.
:::

## File explorer

:::challenge
difficulty: medium
### Recursive file explorer
Render a folder tree from JSON (`{ id, name, isFolder, children? }`). Folders expand/collapse on click; show folders before files, sorted by name. Bonus: add "New file"/"New folder" inside a folder and delete nodes — with immutable tree updates.
@@@solution
```jsx
import { useState } from 'react'

const initial = {
  id: 'root', name: 'project', isFolder: true, children: [
    { id: '1', name: 'src', isFolder: true, children: [
      { id: '2', name: 'App.jsx', isFolder: false },
      { id: '3', name: 'components', isFolder: true, children: [{ id: '4', name: 'Button.jsx', isFolder: false }] },
    ]},
    { id: '5', name: 'package.json', isFolder: false },
  ],
}

// Immutable tree helpers
function insertNode(tree, parentId, node) {
  if (tree.id === parentId) return { ...tree, children: [...(tree.children ?? []), node] }
  if (!tree.children) return tree
  return { ...tree, children: tree.children.map((c) => insertNode(c, parentId, node)) }
}
function deleteNode(tree, id) {
  if (!tree.children) return tree
  return { ...tree, children: tree.children.filter((c) => c.id !== id).map((c) => deleteNode(c, id)) }
}
const sortChildren = (children = []) =>
  [...children].sort((a, b) => (a.isFolder === b.isFolder ? a.name.localeCompare(b.name) : a.isFolder ? -1 : 1))

function TreeNode({ node, depth, onAdd, onDelete }) {
  const [open, setOpen] = useState(depth === 0)
  const [adding, setAdding] = useState(null)   // 'file' | 'folder' | null

  if (!node.isFolder) {
    return (
      <li role="treeitem" style={{ paddingLeft: depth * 16 }}>
        📄 {node.name} <button aria-label={`Delete ${node.name}`} onClick={() => onDelete(node.id)}>🗑</button>
      </li>
    )
  }

  return (
    <li role="treeitem" aria-expanded={open}>
      <div style={{ paddingLeft: depth * 16 }}>
        <button onClick={() => setOpen((o) => !o)}>{open ? '📂' : '📁'} {node.name}</button>
        <button onClick={() => { setOpen(true); setAdding('file') }}>+📄</button>
        <button onClick={() => { setOpen(true); setAdding('folder') }}>+📁</button>
        {depth > 0 && <button aria-label={`Delete ${node.name}`} onClick={() => onDelete(node.id)}>🗑</button>}
      </div>
      {open && (
        <ul role="group">
          {adding && (
            <li style={{ paddingLeft: (depth + 1) * 16 }}>
              <input
                autoFocus
                placeholder={`New ${adding} name`}
                onBlur={() => setAdding(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setAdding(null)
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    onAdd(node.id, {
                      id: crypto.randomUUID(),
                      name: e.currentTarget.value.trim(),
                      isFolder: adding === 'folder',
                      ...(adding === 'folder' && { children: [] }),
                    })
                    setAdding(null)
                  }
                }}
              />
            </li>
          )}
          {sortChildren(node.children).map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} onAdd={onAdd} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function FileExplorer() {
  const [tree, setTree] = useState(initial)
  return (
    <ul role="tree" aria-label="Files" className="explorer">
      <TreeNode
        node={tree}
        depth={0}
        onAdd={(parentId, node) => setTree((t) => insertNode(t, parentId, node))}
        onDelete={(id) => setTree((t) => deleteNode(t, id))}
      />
    </ul>
  )
}
```
Discussion:
- A **recursive component** mirrors the recursive data.
- Expand state is local to each node (UI state); the tree data is owned at the top and updated **immutably** with recursive helpers — only the path to the changed node gets new objects, so memoized siblings can skip re-rendering.
- For big trees or frequent updates, **normalize**: `{ nodes: { [id]: { name, isFolder, childIds } } }` → O(1) updates without recursion.
- Sorting is derived at render (`[...children].sort` — don't mutate).
- A11y: `role="tree"`, `treeitem`, `group`, `aria-expanded`; a full implementation adds arrow-key navigation (Right expands, Left collapses/moves to parent).
- Follow-ups: rename, drag-and-drop to move, lazy loading children from an API, virtualizing very large trees (flatten visible nodes into a list).
:::

## Quick check

:::quiz
### In a combobox, why prevent default on an option's mousedown?
- [ ] To stop text selection only
- [x] So the input doesn't blur (closing the list) before the click handler runs
- [ ] To prevent form submission
- [ ] To improve performance
@@@explain
Blur fires on mousedown elsewhere; if blur closes the list, the option unmounts before `click` fires.
:::

:::quiz
### In nested checkboxes, what's the best thing to store in state?
- [ ] Checked state of every node
- [x] Only checked leaf ids; derive parent state
- [ ] Indeterminate flags per parent
- [ ] Nothing — read it from the DOM
@@@explain
Derived parent state can never go out of sync with its children.
:::
