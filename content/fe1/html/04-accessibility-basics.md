---
title: Accessibility Basics
summary: Who uses assistive technology, the accessibility tree, keyboard access, ARIA's first rule, colour contrast and quick wins you can apply today.
minutes: 14
---

## Accessibility is for everyone

**Accessibility (a11y)** means people can perceive, understand, navigate and interact with your site regardless of ability or device. It covers:

- **Visual** — blind users (screen readers like NVDA, JAWS, VoiceOver, TalkBack), low vision (zoom to 200–400%), colour blindness (~8% of men).
- **Motor** — keyboard-only users, switch devices, voice control, tremors (need big targets).
- **Auditory** — deaf/hard-of-hearing (captions).
- **Cognitive** — clear language, consistent navigation, no time pressure.
- **Situational** — bright sunlight, a broken trackpad, one hand holding a baby.

It's also a **legal requirement** in many countries (ADA in the US, EAA in the EU, RPwD Act in India), and accessible sites tend to have better SEO and usability for everyone.

## WCAG in one minute

The **Web Content Accessibility Guidelines** organize requirements under four principles — **POUR**:

| Principle | Meaning | Examples |
|---|---|---|
| **Perceivable** | Users can perceive content | Alt text, captions, contrast ≥ 4.5:1 |
| **Operable** | Users can operate the UI | Everything works by keyboard, visible focus, no seizure-inducing flashes |
| **Understandable** | Content and UI are predictable | Labels, clear errors, consistent nav, `lang` set |
| **Robust** | Works with assistive tech | Valid semantic HTML, correct ARIA |

Levels: **A** (minimum), **AA** (the usual legal/industry target), **AAA** (enhanced).

## The accessibility tree

Browsers build an **accessibility tree** from the DOM: each node has a **role** (button, link, heading, textbox), a **name** ("Add to cart"), a **state** (expanded, checked, disabled) and a **value**. Screen readers read this tree, not your pixels.

```html
<button aria-expanded="false" aria-controls="menu">Menu</button>
```
→ role: button · name: "Menu" · state: collapsed.

Semantic HTML populates the tree correctly for free. A `<div>` has role *generic* and no name — invisible to assistive tech as a control.

## Keyboard accessibility

Try your site with only **Tab**, **Shift+Tab**, **Enter**, **Space**, **Arrow keys** and **Esc**.

- Everything interactive must be reachable and operable by keyboard.
- **Focus order** follows DOM order — keep the DOM in a logical order and don't use positive `tabindex` values.
- `tabindex="0"` adds a custom element to the tab order; `tabindex="-1"` makes it focusable by script only (e.g. a modal container or an error summary).
- **Never remove focus outlines** (`outline: none`) without a visible replacement. Use `:focus-visible` to show rings for keyboard users but not on mouse click:

```css
button:focus-visible {
  outline: 3px solid #6366f1;
  outline-offset: 2px;
}
```

- Add a **skip link** so keyboard users can bypass the header:

```html
<a class="skip-link" href="#main">Skip to content</a>
…
<main id="main">…</main>
```

## ARIA: powerful, but rule #1 is "don't"

ARIA (Accessible Rich Internet Applications) attributes adjust the accessibility tree when HTML alone can't express something (custom tabs, comboboxes, live regions).

1. **If a native element exists, use it.** `<button>` beats `<div role="button">`.
2. Don't change native semantics unnecessarily (`<h2 role="tab">` is wrong).
3. All interactive ARIA controls must be keyboard operable — ARIA doesn't add behaviour.
4. Don't hide focusable elements with `aria-hidden="true"`.
5. Every interactive element needs an accessible name.

Common, useful ARIA:

| Attribute | Use |
|---|---|
| `aria-label` | Name for an element with no visible text (icon button: `aria-label="Close"`) |
| `aria-labelledby` / `aria-describedby` | Point at other elements for name/description |
| `aria-expanded` | Disclosure state of menus/accordions |
| `aria-current="page"` | Current link in navigation |
| `aria-live="polite"` / `role="status"` | Announce dynamic updates ("3 results found", "Saved") |
| `role="alert"` | Urgent message, announced immediately |
| `aria-hidden="true"` | Hide decorative icons from screen readers |

> "No ARIA is better than bad ARIA" — pages using ARIA have on average *more* detected errors, because it's easy to misuse.

## Colour and contrast

- Normal text needs a contrast ratio of at least **4.5:1** against its background; large text (≥ 24px, or 18.66px bold) **3:1**; UI components and focus indicators **3:1** (WCAG AA).
- Never convey information by colour alone (red borders for errors → also add an icon/text).
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

## Quick wins checklist

- [ ] `lang` on `<html>`, unique `<title>` per page
- [ ] One `<h1>`, logical heading levels
- [ ] Landmarks: `header`, `nav`, `main`, `footer`
- [ ] Every image has appropriate `alt`
- [ ] Every input has a `<label>`; errors linked with `aria-describedby`
- [ ] Buttons are `<button>`, links are `<a href>`
- [ ] Visible focus styles; logical tab order; skip link
- [ ] Contrast ≥ 4.5:1
- [ ] Modals trap focus and restore it on close; Esc closes
- [ ] Touch targets ≥ 24×24px (44×44 recommended)
- [ ] Test: keyboard-only, a screen reader (VoiceOver: Cmd+F5), Lighthouse / axe DevTools

:::question
difficulty: easy
companies: Walmart, Agoda
### How would you make sure a web app meets accessibility standards (ARIA roles, keyboard navigation, screen-reader support)?
1. **Semantic HTML first** — native buttons, links, inputs with labels, landmarks, headings, tables with headers.
2. **Keyboard** — every interaction works with Tab/Enter/Space/Arrows/Esc; logical focus order; visible `:focus-visible` styles; focus management for modals and route changes; skip links.
3. **Screen readers** — meaningful alt text, accessible names for icon buttons (`aria-label`), states (`aria-expanded`, `aria-checked`), live regions for async updates, errors linked via `aria-describedby`.
4. **Visual** — WCAG AA contrast, don't rely on colour alone, support zoom to 200%+ and reduced motion.
5. **Process** — target WCAG 2.2 AA; lint (eslint-plugin-jsx-a11y), automated checks (axe, Lighthouse) in CI — they catch ~30–40% of issues — plus manual keyboard and screen-reader testing; accessible components in the design system so teams get it right by default.
:::

:::question
difficulty: medium
### What is the first rule of ARIA and why?
"If you can use a native HTML element or attribute with the semantics and behaviour you need already built in, do so instead of re-purposing an element and adding ARIA." Native elements come with roles, names, states, focusability and keyboard behaviour implemented and tested across browsers and assistive tech. ARIA only changes what is *announced*; it adds no behaviour, so a `role="button"` div still needs `tabindex`, Enter and Space handlers.
:::

:::question
difficulty: easy
### What's the difference between `aria-label`, `aria-labelledby` and `aria-describedby`?
- `aria-label="Close"` — gives an accessible **name** directly as a string (for elements without visible text).
- `aria-labelledby="id1 id2"` — the name is taken from the text of other element(s); preferred when visible text exists. Overrides `aria-label`.
- `aria-describedby="hint-id"` — adds a supplementary **description** read after the name and role (hints, error messages).
:::

:::question
difficulty: medium
### What should happen to focus when a modal dialog opens and closes?
On open, move focus into the dialog (first focusable element, or the dialog itself with `tabindex="-1"`); **trap** Tab/Shift+Tab inside it; make the background inert (`inert` attribute or `aria-modal="true"`); Esc closes it. On close, **return focus** to the element that opened it. The native `<dialog>` element with `showModal()` handles most of this for you.
:::

:::challenge
difficulty: medium
### Make this icon button and toggle accessible
```html
<div class="icon" onclick="toggleMenu()"><svg>…hamburger…</svg></div>
<div id="menu" style="display:none">…links…</div>
```
Rewrite it so it's keyboard accessible, has a name, announces its open/closed state, and write the `toggleMenu` function.
@@@solution
```html
<button type="button" class="icon" aria-label="Menu"
        aria-expanded="false" aria-controls="menu">
  <svg aria-hidden="true" focusable="false">…</svg>
</button>
<nav id="menu" hidden>…links…</nav>

<script>
  const btn = document.querySelector('.icon')
  const menu = document.getElementById('menu')
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true'
    btn.setAttribute('aria-expanded', String(!open))
    menu.hidden = open
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      btn.click()
      btn.focus()
    }
  })
</script>
```
- `<button>` → focusable, Enter/Space work, announced as a button.
- `aria-label="Menu"` → accessible name (the SVG has no text).
- `aria-expanded` → screen readers announce "Menu, button, collapsed/expanded".
- `aria-hidden` on the SVG → decorative icon is skipped.
- `hidden` attribute instead of inline display toggling: clear semantics, removed from the a11y tree when closed.
- Esc closes and returns focus — expected behaviour for menus.
:::

:::quiz
### What is the minimum WCAG AA contrast ratio for normal body text?
- [ ] 3:1
- [x] 4.5:1
- [ ] 7:1
@@@explain
4.5:1 for normal text (3:1 for large text and UI components); 7:1 is AAA.
:::

:::quiz
### Which is the correct way to hide a decorative icon from screen readers?
- [x] `aria-hidden="true"`
- [ ] `tabindex="-1"`
- [ ] `role="button"`
@@@explain
`aria-hidden="true"` removes it from the accessibility tree. `tabindex=-1` only affects keyboard focus.
:::
