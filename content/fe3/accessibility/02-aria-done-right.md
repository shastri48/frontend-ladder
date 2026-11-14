---
title: ARIA Done Right — Roles, States, Properties and Live Regions
summary: What ARIA can and can't do, the five rules of ARIA, accessible names, common state attributes, and announcing dynamic updates with live regions.
minutes: 15
---

## What ARIA is

**ARIA (Accessible Rich Internet Applications)** is a set of HTML attributes that change how elements are exposed in the **accessibility tree**. It lets you describe custom widgets (tabs, comboboxes, tree views) that HTML has no native element for.

Crucially, ARIA **only changes semantics**. It adds **no behaviour**: `role="button"` doesn't make a div focusable, doesn't make Enter or Space work, and doesn't add styles.

:::callout analogy A name tag, not a skill
ARIA is like pinning a "Doctor" badge on someone. Everyone will now treat them as a doctor — but the badge doesn't teach them medicine. If the behaviour isn't there, the badge makes things worse.
:::

## The five rules of ARIA

1. **Use native HTML** if an element with the semantics and behaviour exists. `<button>` beats `<div role="button">`.
2. **Don't change native semantics** unless you really must (`<h2 role="tab">` is wrong; wrap instead).
3. **All interactive ARIA controls must be keyboard operable.**
4. **Don't use `role="presentation"` or `aria-hidden="true"` on focusable elements** — you'd create a focusable "ghost".
5. **All interactive elements need an accessible name.**

And the summary everyone quotes: **"No ARIA is better than bad ARIA."** WebAIM's annual survey of the top million home pages consistently finds pages with ARIA have *more* detected errors than pages without — misuse is common.

## Roles, states and properties

- **Roles**: what it is — `button`, `tab`/`tablist`/`tabpanel`, `dialog`/`alertdialog`, `combobox`/`listbox`/`option`, `menu`/`menuitem`, `switch`, `tree`, `grid`, landmarks (`navigation`, `main`, `search`, `region`), `status`, `alert`.
- **States** (change with interaction): `aria-expanded`, `aria-selected`, `aria-checked`, `aria-pressed`, `aria-disabled`, `aria-invalid`, `aria-busy`, `aria-current`.
- **Properties** (mostly static relationships): `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-haspopup`, `aria-activedescendant`, `aria-required`, `aria-live`, `aria-modal`.

```jsx
// Toggle button: native button + one state attribute
<button aria-pressed={isBold} onClick={() => setBold(b => !b)}>Bold</button>

// Disclosure: native button + expanded state + relationship
<button aria-expanded={open} aria-controls="faq-1" onClick={() => setOpen(o => !o)}>
  Shipping details
</button>
<div id="faq-1" hidden={!open}>…</div>

// Icon-only button needs a name
<button aria-label="Close dialog"><XIcon aria-hidden="true" /></button>

// Current page in nav
<a href="/orders" aria-current="page">Orders</a>
```

## Accessible names — how they're computed

Priority (simplified): `aria-labelledby` → `aria-label` → native label (`<label>`, `alt`, `<caption>`, `<legend>`) → text content (for roles that allow it) → `title`/`placeholder` (last resort, unreliable).

- Prefer **visible labels** — voice-control users say what they see ("click Search"). If the visible text is "Go" but `aria-label="Submit search"`, "click Go" may fail (WCAG *Label in Name*).
- `aria-labelledby` can concatenate multiple IDs: `aria-labelledby="card-title price"`.
- `aria-describedby` is for supplementary info (hints, errors), announced after the name.

## Hiding things correctly

| Technique | Visually | Screen readers |
|---|---|---|
| `display:none` / `hidden` | hidden | hidden |
| `aria-hidden="true"` | visible | hidden (use for decorative icons) |
| `.sr-only` (visually-hidden class) | hidden | announced |
| `inert` attribute | visible | hidden **and** not focusable/clickable (great for background behind modals) |

```css
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
```

## Live regions — announcing dynamic changes

Screen readers announce what has focus. Content that changes elsewhere — "3 results found", "Saved", "Item added to cart", toast notifications, validation errors after submit — is silent unless placed in a **live region**.

```jsx
// Must exist in the DOM *before* the text changes
<div role="status" aria-live="polite" className="sr-only">{message}</div>

// For urgent, interrupting messages
<div role="alert">{error}</div>   // implicit aria-live="assertive"
```

- `polite` waits until the user is idle; `assertive` interrupts — use sparingly (errors).
- Inject the region on page load and change its text; regions added at the same time as their content are often not announced.
- Debounce announcements during typing ("12 results" only after the user pauses).

:::question
difficulty: medium
### Explain "No ARIA is better than bad ARIA."
ARIA overrides what assistive technology is told about an element but adds no behaviour. Misused ARIA actively misleads users: `role="button"` on a non-focusable div that ignores Enter; `aria-hidden="true"` on a focused element; `role="menu"` on site navigation (making screen readers expect arrow-key menu behaviour that doesn't exist); `aria-label` that contradicts visible text. Without ARIA, a native element would at least expose honest semantics. So: native HTML first, ARIA only to fill genuine gaps, following WAI-ARIA Authoring Practices, and always with the matching keyboard behaviour.
:::

:::question
difficulty: medium
### How do you make dynamic updates (search results count, toasts) accessible?
Use **live regions**: a container with `role="status"`/`aria-live="polite"` (or `role="alert"` for urgent errors) that exists in the DOM from the start; update its text content when something happens. Keep messages short and meaningful ("8 results for 'shoes'"), debounce while typing, and avoid `assertive` for non-critical info. For major view changes (route navigation, opening a panel), **move focus** to the new content's heading instead.
:::

:::question
difficulty: easy
### What's the difference between aria-label, aria-labelledby and aria-describedby?
`aria-label` provides an accessible name as a string (invisible). `aria-labelledby` points to one or more element IDs whose text becomes the name — preferred when visible text exists, and it overrides other naming. `aria-describedby` points to elements providing extra description (hints, error messages), announced after the name and role. Names say *what it is*; descriptions say *more about it*.
:::

:::challenge
difficulty: medium
### What's wrong with this "accessible" toggle?
```jsx
<div role="switch" aria-label="Dark mode" onClick={toggle} className={on ? 'on' : ''}>
  <span className="knob" />
</div>
```
@@@solution
- Not **focusable** — needs `tabIndex={0}` (or better, be a `<button>`).
- No **keyboard** support — switches toggle with Space (and Enter); `onClick` on a div doesn't fire on keys.
- Missing **state** — needs `aria-checked={on}`; the class is invisible to AT.
- Visible label missing — sighted voice-control users can't target it; use visible text.

Better:
```jsx
<button type="button" role="switch" aria-checked={on} onClick={toggle} className="switch">
  <span className="switch__label">Dark mode</span>
  <span className="switch__knob" aria-hidden="true" />
</button>
```
A `<button>` brings focus and Enter/Space activation; `role="switch"` + `aria-checked` communicate on/off. Alternatively, a native `<input type="checkbox" role="switch">` with a `<label>`.
:::

:::quiz
### Does `role="button"` make a div respond to the Enter key?
- [ ] Yes
- [x] No — ARIA adds semantics only; you must add tabindex and key handlers
- [ ] Only in Chrome
- [ ] Only with aria-pressed
@@@explain
ARIA never adds behaviour; native <button> does.
:::

:::quiz
### Which attribute hides background content from both screen readers and keyboard focus while a modal is open?
- [ ] aria-hidden="true"
- [ ] display: contents
- [x] inert
- [ ] tabindex="-1" on body
@@@explain
inert removes elements from the accessibility tree and makes them non-interactive and non-focusable.
:::
