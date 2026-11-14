---
title: Keyboard Navigation and Focus Management
summary: Tab order, tabindex, focus traps for modals, roving tabindex for composite widgets, SPA route focus, and building an accessible dialog and tabs.
minutes: 18
---

## Why keyboard support is the foundation

Screen reader users, switch users, voice-control users and power users all rely on **keyboard focus**. If something works with a mouse but not a keyboard, it's broken for a large group of people (WCAG 2.1.1 *Keyboard*, level A).

Basic keyboard contract on the web:

| Key | Expected behaviour |
|---|---|
| Tab / Shift+Tab | Move between interactive elements (links, buttons, inputs, widgets) |
| Enter | Activate links and buttons, submit forms |
| Space | Activate buttons, toggle checkboxes, scroll the page |
| Arrow keys | Move **within** a composite widget (tabs, radio group, menu, listbox, grid) |
| Escape | Close dialogs, menus, popovers |
| Home / End | First/last item in a widget |

:::callout analogy Rooms and hallways
Tab moves you between **rooms** (widgets). Arrow keys move you around **inside** a room. A tab list with 8 tabs is one room — you shouldn't have to Tab 8 times to get past it.
:::

## tabindex

- `tabindex="0"` — make a non-native element focusable in natural DOM order (for custom widgets).
- `tabindex="-1"` — focusable programmatically (`el.focus()`) but not via Tab (headings you move focus to, inactive items in roving tabindex).
- **Positive tabindex (1, 2, 3…)** — overrides DOM order. **Never use it**; fix the DOM order instead. Visual order (CSS `order`, `flex-direction: row-reverse`, grid placement) should match DOM order too.

## Visible focus

```css
/* Show rings for keyboard users, not on mouse click */
button:focus-visible, a:focus-visible, [tabindex]:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
```

WCAG 2.2 adds *Focus Not Obscured* — sticky headers/cookie banners mustn't cover the focused element (`scroll-padding-top` helps).

## Focus management patterns

### 1. Modal dialogs

A modal must:
1. **Move focus into** the dialog when it opens (first focusable element or the dialog heading).
2. **Trap focus** — Tab cycles within the dialog.
3. Make the background **inert** (not focusable, hidden from screen readers).
4. **Close on Escape**.
5. **Return focus** to the element that opened it.
6. Have `role="dialog"`, `aria-modal="true"`, and an accessible name (`aria-labelledby` the title).

The native `<dialog>` with `showModal()` does 1, 2 (via inertness), 3, 4 and gives the top layer; you mainly handle returning focus (which browsers increasingly do too) and naming.

```jsx
function Modal({ open, onClose, title, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()      // focus moves in, background inert
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} aria-labelledby="modal-title" onClose={onClose} onCancel={onClose}>
      <h2 id="modal-title">{title}</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </dialog>
  )
}
```

Building it manually (when you can't use `<dialog>`):

```js
function trapFocus(container, e) {
  if (e.key !== 'Tab') return
  const focusables = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusables[0], last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
```

### 2. Roving tabindex (tabs, toolbars, radio groups, menus)

Only **one** item in the widget has `tabindex="0"`; the rest have `-1`. Arrow keys move focus and update which item is "roving".

```jsx
function Tabs({ tabs }) {
  const [active, setActive] = useState(0)
  const refs = useRef([])

  function onKeyDown(e) {
    const last = tabs.length - 1
    const next =
      e.key === 'ArrowRight' ? (active === last ? 0 : active + 1) :
      e.key === 'ArrowLeft'  ? (active === 0 ? last : active - 1) :
      e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (next === null) return
    e.preventDefault()
    setActive(next)               // automatic activation; or move focus only (manual activation)
    refs.current[next].focus()
  }

  return (
    <>
      <div role="tablist" aria-label="Account settings" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={el => (refs.current[i] = el)}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={i === active}
            aria-controls={`panel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={i !== active} tabIndex={0}>
          {t.content}
        </div>
      ))}
    </>
  )
}
```

The alternative to roving tabindex is **`aria-activedescendant`**: focus stays on a container/input, and an attribute points at the "virtually focused" option — common for comboboxes where focus must stay in the text input.

### 3. SPA route changes

In a multi-page site, navigation resets focus to the top and screen readers announce the new title. In SPAs nothing happens — the user's focus stays on the clicked link (which may no longer exist). After a route change:
- Update `document.title`.
- Move focus to the new page's `<h1>` (with `tabIndex={-1}`) or a skip-link target, or announce via a live region.
- Provide a **"Skip to main content"** link as the first focusable element.

### 4. Deleting/removing items

When the focused element disappears (deleting a row, closing a toast), focus falls back to `<body>`, and keyboard users are lost. Move focus to a sensible neighbour (next item, the list heading).

:::question
difficulty: medium
### How do you build an accessible modal dialog?
Prefer native `<dialog>` + `showModal()`. Requirements: `role="dialog"` (implicit), `aria-modal="true"`, accessible name via `aria-labelledby`; move focus inside on open; trap focus within; make background inert; close with Escape and a visible close button; return focus to the trigger on close; prevent background scroll; announce content correctly (don't put the entire dialog in a live region). For destructive confirmations use `role="alertdialog"` and focus the least destructive action.
:::

:::question
difficulty: medium
### What is roving tabindex and when do you use it?
A focus-management technique for composite widgets (tabs, toolbars, radio groups, menus, listboxes, grids): exactly one item has `tabindex="0"` so the whole widget is a single Tab stop; all others have `tabindex="-1"`; arrow keys (plus Home/End) move focus between items by updating which one has `0` and calling `.focus()`. This matches native widget behaviour (like a radio group) and keeps Tab navigation efficient. Alternative: `aria-activedescendant` when DOM focus must stay on one element (e.g. a combobox input).
:::

:::question
difficulty: easy
### Why is positive tabindex considered harmful?
It creates a separate tab sequence that runs **before** all naturally ordered elements, regardless of DOM position, which quickly becomes confusing and fragile as the page changes (and breaks across components owned by different teams). Fix the DOM order to match the visual order instead and use only `0` and `-1`.
:::

:::challenge
difficulty: hard
companies: CRED
### Build a keyboard-accessible multi-select dropdown from scratch
No component libraries. Requirements: a button shows selected count; opening shows a list of options with checkboxes; full keyboard support (open with Enter/Space/ArrowDown, navigate with arrows, Home/End, toggle with Space/Enter, close with Escape returning focus to the button, type-ahead optional); click outside closes; screen readers understand selection.
@@@hint
Model it as a button that controls a `listbox` with `aria-multiselectable="true"`, use `aria-activedescendant` (focus stays on the listbox) or roving tabindex across options.
@@@solution
```jsx
import { useState, useRef, useEffect, useId } from 'react'

export function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const rootRef = useRef(null)
  const id = useId()

  const toggleOption = (opt) =>
    onChange(value.includes(opt.value) ? value.filter(v => v !== opt.value) : [...value, opt.value])

  const openList = (index = 0) => { setOpen(true); setActiveIndex(index) }
  const close = () => { setOpen(false); buttonRef.current?.focus() }

  useEffect(() => { if (open) listRef.current?.focus() }, [open])

  useEffect(() => {                                       // click outside
    if (!open) return
    const onDown = (e) => { if (!rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {                                       // keep active option visible
    if (open) document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, id])

  function onButtonKeyDown(e) {
    if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(0) }
    if (e.key === 'ArrowUp') { e.preventDefault(); openList(options.length - 1) }
  }

  function onListKeyDown(e) {
    const last = options.length - 1
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActiveIndex(i => Math.min(i + 1, last)); break
      case 'ArrowUp':   e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); break
      case 'Home':      e.preventDefault(); setActiveIndex(0); break
      case 'End':       e.preventDefault(); setActiveIndex(last); break
      case ' ':
      case 'Enter':     e.preventDefault(); toggleOption(options[activeIndex]); break
      case 'Escape':    e.preventDefault(); close(); break
      case 'Tab':       setOpen(false); break
      default: {                                          // type-ahead
        const ch = e.key.toLowerCase()
        if (ch.length === 1) {
          const idx = options.findIndex((o, i) => i > activeIndex && o.label.toLowerCase().startsWith(ch))
          const wrap = options.findIndex(o => o.label.toLowerCase().startsWith(ch))
          const target = idx !== -1 ? idx : wrap
          if (target !== -1) setActiveIndex(target)
        }
      }
    }
  }

  const summary = value.length === 0 ? 'None selected' : `${value.length} selected`

  return (
    <div ref={rootRef} className="ms">
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-btn`}
        id={`${id}-btn`}
        onClick={() => (open ? setOpen(false) : openList(0))}
        onKeyDown={onButtonKeyDown}
      >
        {summary}
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-opt-${activeIndex}`}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="ms__list"
        >
          {options.map((opt, i) => {
            const selected = value.includes(opt.value)
            return (
              <li
                key={opt.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={selected}
                className={i === activeIndex ? 'ms__opt is-active' : 'ms__opt'}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => toggleOption(opt)}
              >
                <span aria-hidden="true" className="ms__check">{selected ? '☑' : '☐'}</span>
                {opt.label}
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
.ms { position: relative; display: inline-block; }
.ms__list { position: absolute; z-index: 10; max-height: 240px; overflow: auto; margin: 4px 0 0; padding: 4px; list-style: none; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; min-width: 100%; }
.ms__opt { display: flex; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.ms__opt.is-active { background: var(--color-primary); color: white; }   /* visual focus for activedescendant */
.ms__list:focus-visible { outline: 2px solid var(--color-focus); }
```
**Design notes to discuss**
- `aria-activedescendant` keeps DOM focus on the listbox while announcing the active option; the active option gets a strong visual style since it never receives real focus.
- `aria-selected` on options + `aria-multiselectable` conveys multi-selection; the button summary updates the count.
- Escape returns focus to the trigger; Tab closes without trapping.
- Controlled API (`value`, `onChange`) so parents own state; extend with search filtering (then it becomes a combobox), "Select all", chips with remove buttons, virtualization for long lists, and positioning that flips when near the viewport edge (Floating UI).
:::

:::quiz
### In a tab list using roving tabindex, how many tabs are in the Tab sequence?
- [ ] All of them
- [x] One — the active tab
- [ ] None
- [ ] Only the first and last
@@@explain
The widget is a single Tab stop; arrow keys move between tabs.
:::

:::quiz
### After a modal closes, where should focus go?
- [ ] The top of the page
- [ ] The body element
- [x] Back to the element that opened the modal
- [ ] The first link in the nav
@@@explain
Returning focus to the trigger preserves the user's place.
:::
