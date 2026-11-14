---
title: How to Win a Machine-Coding Round
summary: A repeatable process for 60–90 minute UI builds, plus warm-ups — a reusable Button with variants and sizes, an expand/collapse list, tabs and an accordion.
minutes: 18
---

## What the round actually tests

In a machine-coding round (Flipkart, CRED, Swiggy, Housing.com, Tekion, Razorpay…) you build a working feature in 60–120 minutes. Interviewers grade:

1. **Does it work?** Core requirements first, end to end.
2. **Code structure** — components with clear responsibilities, sensible state placement, no copy-paste.
3. **State design** — minimal state, derived values computed, not stored.
4. **Edge cases** — empty, loading, error, long text, rapid clicks.
5. **Extensibility** — can you add a requirement in 5 minutes when asked?
6. **Communication** — you narrate trade-offs while coding.
7. Bonus: accessibility, performance, tests.

"Prioritize clarity and structure over hacks. Readable code wins interviews." — from a Housing.com SDE-1 experience.

## The process (time-boxed for 90 minutes)

| Time | Step |
|---|---|
| 0–5 min | **Clarify**: list requirements, ask about scope (data source? mobile? libraries allowed?). Write them as a checklist. |
| 5–10 min | **Design**: sketch the component tree and the state shape. Decide where each piece of state lives. |
| 10–60 min | **Build the happy path** end to end with minimal styling. Commit to working software early. |
| 60–75 min | **Edge cases**: loading/error/empty, validation, keyboard support. |
| 75–85 min | **Polish**: styling, refactor duplicated code, extract hooks. |
| 85–90 min | **Walk through**: explain decisions, what you'd do with more time (tests, perf, a11y). |

:::callout interview Talk while you type
"I'll keep `selectedId` in the parent because both the list and the details panel need it." Interviewers can only reward reasoning they hear.
:::

### State design checklist

- What is the **minimal** state? Everything else is derived during render (filtered lists, counts, `isValid`).
- Who **owns** it? The closest common parent of all components that need it (lift state up). Global (context/store) only if it's truly app-wide.
- Is it **server state** (fetched — cache it, handle loading/error) or **UI state** (open/closed, input values)?
- Normalize nested data when you need to update deep items (`byId` maps).

### Folder structure for a round

```text
src/
  components/   Button.jsx, Modal.jsx …   (generic, reusable)
  features/
    comments/   CommentList.jsx, Comment.jsx, useComments.js, comments.css
  hooks/        useDebounce.js, useFetch.js
  utils/        api.js, format.js
  App.jsx
```

## Warm-up 1: Reusable Button (Tekion)

A real Tekion question: "Create a reusable Button component with variants and sizes (like MUI)".

:::challenge
difficulty: easy
companies: Tekion
### Build a reusable Button with variants and sizes
Requirements:
- `variant`: `contained` | `outlined` | `text`; `color`: `primary` | `danger`; `size`: `sm` | `md` | `lg`.
- Supports `disabled`, `loading` (shows spinner, disables clicks), `startIcon`/`endIcon`, `fullWidth`.
- Passes through any native button props (`type`, `onClick`, `aria-*`), and forwards refs.
- Accessible: correct `type` default, focus ring, `aria-busy` while loading.
@@@hint
Spread `...rest` onto the native `<button>`. Build the class list from props. Default `type="button"` so it doesn't accidentally submit forms.
@@@solution
```jsx
import { forwardRef } from 'react'
import './Button.css'

const cx = (...classes) => classes.filter(Boolean).join(' ')

export const Button = forwardRef(function Button(
  {
    variant = 'contained',
    color = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    startIcon,
    endIcon,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'btn',
        `btn--${variant}`,
        `btn--${color}`,
        `btn--${size}`,
        fullWidth && 'btn--full',
        loading && 'btn--loading',
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : startIcon}
      <span className="btn__label">{children}</span>
      {!loading && endIcon}
    </button>
  )
})
```

```css
.btn {
  --c: #4f46e5; --c-hover: #4338ca; --c-soft: #eef2ff;
  display: inline-flex; align-items: center; justify-content: center; gap: .5em;
  border: 1px solid transparent; border-radius: 8px; font: inherit; font-weight: 600;
  cursor: pointer; transition: background .15s, border-color .15s, color .15s;
}
.btn--danger { --c: #dc2626; --c-hover: #b91c1c; --c-soft: #fef2f2; }
.btn--sm { padding: .25rem .6rem; font-size: .85rem; }
.btn--md { padding: .5rem 1rem; font-size: 1rem; }
.btn--lg { padding: .75rem 1.4rem; font-size: 1.1rem; }
.btn--contained { background: var(--c); color: #fff; }
.btn--contained:hover:not(:disabled) { background: var(--c-hover); }
.btn--outlined { background: transparent; color: var(--c); border-color: var(--c); }
.btn--outlined:hover:not(:disabled), .btn--text:hover:not(:disabled) { background: var(--c-soft); }
.btn--text { background: transparent; color: var(--c); }
.btn--full { width: 100%; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn:focus-visible { outline: 3px solid var(--c); outline-offset: 2px; }
.btn__spinner { width: 1em; height: 1em; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
```

Usage:
```jsx
<Button variant="outlined" color="danger" size="sm" onClick={remove}>Delete</Button>
<Button loading fullWidth type="submit">Save</Button>
```

Talking points:
- **Composition**: props map to CSS modifier classes; CSS custom properties make adding a color a 1-line change.
- **API design**: sensible defaults, `...rest` passthrough, `forwardRef` (focus management, tooltips). In React 19 `ref` is a regular prop and `forwardRef` is optional.
- `type="button"` default avoids accidental form submits.
- Loading keeps the button's width stable (label stays, spinner replaces icon) to avoid layout shift.
- Follow-ups: `as`/polymorphic prop (render as `<a>` for links), icon-only buttons need `aria-label`, theming via tokens, TypeScript props extending `ComponentPropsWithoutRef<'button'>`.
:::

## Warm-up 2: Expand/collapse list (Tekion)

:::challenge
difficulty: easy
companies: Tekion
### Build a list with collapse/expand
Render a list of sections (title + content). Clicking a title toggles its content. Add "Expand all" / "Collapse all" buttons and a prop `allowMultiple` — when false, opening one section closes the others.
@@@solution
```jsx
import { useState } from 'react'

const SECTIONS = [
  { id: 'a', title: 'What is React?', body: 'A library for building UIs.' },
  { id: 'b', title: 'What is JSX?', body: 'Syntax sugar for React.createElement.' },
  { id: 'c', title: 'What are hooks?', body: 'Functions that let components use state and effects.' },
]

export function CollapsibleList({ sections = SECTIONS, allowMultiple = true }) {
  // Set of open ids — derived booleans per row
  const [openIds, setOpenIds] = useState(() => new Set())

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = allowMultiple ? new Set(prev) : new Set()
      if (prev.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const expandAll = () => setOpenIds(new Set(sections.map((s) => s.id)))
  const collapseAll = () => setOpenIds(new Set())

  return (
    <div>
      <div className="toolbar">
        {allowMultiple && <button onClick={expandAll}>Expand all</button>}
        <button onClick={collapseAll}>Collapse all</button>
      </div>
      <ul className="sections">
        {sections.map(({ id, title, body }) => {
          const open = openIds.has(id)
          return (
            <li key={id}>
              <h3>
                <button
                  aria-expanded={open}
                  aria-controls={`panel-${id}`}
                  id={`header-${id}`}
                  onClick={() => toggle(id)}
                >
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span> {title}
                </button>
              </h3>
              <div id={`panel-${id}`} role="region" aria-labelledby={`header-${id}`} hidden={!open}>
                {body}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```
Points to mention:
- State is a **Set of open ids** — scales to any mode; `allowMultiple=false` simply starts from an empty set.
- Functional updates avoid stale state on rapid clicks; we create a **new** Set (immutability) so React re-renders.
- A11y: real `<button>` inside a heading, `aria-expanded`, `aria-controls`, `hidden` attribute.
- Follow-ups: nested sections (recursive component), animate height (grid-template-rows trick), persist open state in URL/localStorage, lazy-render bodies.
:::

## Warm-up 3: Tabs (vanilla JS and React)

"Using vanilla JavaScript (no frameworks), implement a dynamic tabbed interface" is a common screening question.

:::challenge
difficulty: medium
### Accessible tabs in vanilla JS
Build tabs from this markup with no framework. Clicking a tab shows its panel. Support Left/Right/Home/End keys (WAI-ARIA tabs pattern).
```html
<div class="tabs">
  <div role="tablist" aria-label="Settings">
    <button role="tab" aria-selected="true" aria-controls="p1" id="t1">Profile</button>
    <button role="tab" aria-selected="false" aria-controls="p2" id="t2" tabindex="-1">Billing</button>
    <button role="tab" aria-selected="false" aria-controls="p3" id="t3" tabindex="-1">Security</button>
  </div>
  <section role="tabpanel" id="p1" aria-labelledby="t1">Profile settings…</section>
  <section role="tabpanel" id="p2" aria-labelledby="t2" hidden>Billing settings…</section>
  <section role="tabpanel" id="p3" aria-labelledby="t3" hidden>Security settings…</section>
</div>
```
@@@solution
```js
function initTabs(root) {
  const tablist = root.querySelector('[role="tablist"]')
  const tabs = [...tablist.querySelectorAll('[role="tab"]')]

  function select(tab) {
    tabs.forEach((t) => {
      const selected = t === tab
      t.setAttribute('aria-selected', String(selected))
      t.tabIndex = selected ? 0 : -1          // roving tabindex: only active tab is tabbable
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected
    })
    tab.focus()
  }

  // Event delegation: one listener for all tabs
  tablist.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]')
    if (tab) select(tab)
  })

  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement)
    if (i === -1) return
    const map = {
      ArrowRight: (i + 1) % tabs.length,
      ArrowLeft: (i - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }
    if (e.key in map) {
      e.preventDefault()
      select(tabs[map[e.key]])
    }
  })
}

document.querySelectorAll('.tabs').forEach(initTabs)
```
Discussion: **event delegation** (one listener, works for dynamically added tabs), **roving tabindex** (Tab moves into the tablist once, arrows move within), ARIA roles/states, `hidden` panels. Follow-ups: lazy-load panel content on first activation, sync the active tab to `location.hash`, make it a reusable class/web component.
:::

## Warm-up 4: Accordion in React

:::question
difficulty: easy
### How is an accordion different from the expand/collapse list?
Functionally they're the same widget family. An "accordion" usually implies **single-open** behaviour (opening one closes others) — implemented with a single `openId` state instead of a Set — and follows the WAI-ARIA accordion pattern: header buttons with `aria-expanded`/`aria-controls`, optional arrow-key navigation between headers. Prefer a generic component with an `allowMultiple` prop, or composable parts (`<Accordion><Accordion.Item>…`) using context so consumers control markup.
:::

## Quick check

:::quiz
### In the first 10 minutes of a machine-coding round you should…
- [ ] Set up Redux and a design system
- [x] Clarify requirements and sketch component tree + state
- [ ] Write unit tests
- [ ] Style the header
@@@explain
A few minutes of design prevents an expensive restructure at minute 60.
:::

:::quiz
### Why default a custom Button's `type` to "button"?
- [ ] For styling
- [x] A `<button>` inside a form defaults to type="submit" and would submit unexpectedly
- [ ] Screen readers require it
- [ ] React warns otherwise
@@@explain
The native default is "submit"; generic buttons inside forms would trigger submissions.
:::
