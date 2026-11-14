---
title: WCAG Principles and Semantic HTML First
summary: Who accessibility is for, WCAG's POUR principles and conformance levels, the accessibility tree, and why native HTML elements beat custom widgets.
minutes: 16
---

## Who accessibility is for

Accessibility (a11y) means people can perceive, understand, navigate and interact with your product regardless of ability or circumstance:

- **Visual**: blindness (screen readers), low vision (zoom, high contrast), colour blindness (~8% of men).
- **Motor**: keyboard-only users, switch devices, voice control, tremors (large hit targets).
- **Auditory**: deaf/hard of hearing (captions, transcripts).
- **Cognitive**: dyslexia, ADHD, memory (clear language, predictable UI, no time pressure).
- **Situational**: a broken arm, bright sunlight, a baby in one arm, a slow phone.

It's also often a **legal requirement** — ADA (US), the European Accessibility Act (2025), Section 508, and in India the RPwD Act plus sectoral guidance (e.g. regulators expecting digital banking/payment interfaces to be accessible). Enterprises frequently require **WCAG 2.1/2.2 AA** in contracts.

:::callout analogy Curb cuts
Sidewalk ramps were built for wheelchair users, and now parents with strollers, travellers with suitcases and delivery workers use them every day. Captions, keyboard shortcuts and clear focus styles help everyone the same way.
:::

## WCAG in one picture — POUR

The **Web Content Accessibility Guidelines** are organised under four principles:

| Principle | Meaning | Examples |
|---|---|---|
| **Perceivable** | Users can perceive the content | Alt text, captions, contrast ≥ 4.5:1, don't rely on colour alone, text resizes to 200% |
| **Operable** | Users can operate the UI | Everything works by keyboard, visible focus, no keyboard traps, enough time, no seizure-inducing flashes, target size ≥ 24×24px (2.2) |
| **Understandable** | Content and behaviour are understandable | Language set (`<html lang>`), labels & instructions, helpful error messages, consistent navigation |
| **Robust** | Works with assistive tech now and later | Valid semantics, correct name/role/value for every control |

**Conformance levels**: **A** (minimum), **AA** (the standard legal/industry target), **AAA** (enhanced, not required site-wide). WCAG 2.2 (2023) added criteria like *Focus Not Obscured*, *Target Size (Minimum)*, *Dragging Movements* (provide non-drag alternatives) and *Accessible Authentication* (no cognitive tests like transcribing codes without alternatives such as paste/autofill).

## The accessibility tree

Browsers build an **accessibility tree** parallel to the DOM and expose it to assistive technologies through OS APIs. Each node has:

- **Role** — button, link, checkbox, heading (level 2), textbox, dialog…
- **Name** — what it's called ("Submit order"), computed from content, `<label>`, `alt`, `aria-label`, `aria-labelledby`.
- **State/value** — checked, expanded, disabled, selected, current value.
- **Description** — extra help (`aria-describedby`).

A screen reader announces "Submit order, button". A `<div onclick>` announces just "Submit order" (or nothing focusable at all). You can inspect the tree in DevTools → Elements → Accessibility pane.

## Semantic HTML first

Native elements give you role, name, keyboard behaviour, focusability and state **for free**:

```html
<!-- ❌ div soup: not focusable, no role, no Enter/Space, no disabled state -->
<div class="btn" onclick="save()">Save</div>

<!-- ✅ -->
<button type="button" onclick="save()">Save</button>
```

What `<button>` gives you: Tab focus, Enter **and** Space activation, `disabled` semantics, role announced, form submission behaviour, works with voice control ("click Save").

Core semantic toolkit:

| Need | Use |
|---|---|
| Navigates to a URL | `<a href>` (not a button) |
| Performs an action | `<button>` |
| Page structure | `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, `<section aria-labelledby>`, `<article>` — screen reader users jump between these landmarks |
| Headings | `<h1>`–`<h6>` in logical order — the #1 way screen reader users skim a page |
| Form controls | `<label for>` + `<input>`, `<fieldset>` + `<legend>` for groups, `<select>`, native validation attributes |
| Lists | `<ul>/<ol>/<li>` ("list, 5 items") |
| Data | `<table>` with `<th scope>` and `<caption>` |
| Disclosure | `<details>/<summary>` |
| Modal | `<dialog>` with `showModal()` (built-in focus handling, Esc, inert background) |

```html
<form>
  <label for="email">Email</label>
  <input id="email" type="email" autocomplete="email" required aria-describedby="email-hint" />
  <p id="email-hint">We'll send the receipt here.</p>

  <fieldset>
    <legend>Payment method</legend>
    <label><input type="radio" name="pm" value="upi" /> UPI</label>
    <label><input type="radio" name="pm" value="card" /> Card</label>
  </fieldset>
</form>
```

## Visual essentials

- **Contrast**: 4.5:1 for normal text, 3:1 for large text (≥ 24px, or 18.66px bold) and for UI components/focus indicators.
- **Don't rely on colour alone**: error fields need an icon/text, not just red borders; charts need patterns or labels.
- **Visible focus**: never `outline: none` without a replacement; use `:focus-visible` to show rings for keyboard users.
- **Zoom & reflow**: content must work at 200% zoom and 320px width without horizontal scrolling; use relative units.
- **Motion**: honour `prefers-reduced-motion`.
- **Images**: meaningful `alt`; decorative images `alt=""` so they're skipped.

```css
:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```

:::question
difficulty: medium
companies: Walmart, Agoda
### How would you ensure accessibility and WCAG compliance in your frontend application?
- **Target** WCAG 2.2 AA explicitly and make it part of the definition of done.
- **Design**: accessible colour tokens (contrast-checked), focus styles, target sizes, motion preferences, content patterns in the design system.
- **Build**: semantic HTML first; accessible primitives in the shared component library (dialog, menu, combobox, tabs) following WAI-ARIA Authoring Practices — so product teams get a11y by default; labels for every input, error messages linked via `aria-describedby`, live regions for async updates, logical heading/landmark structure, `lang` attribute, keyboard support everywhere.
- **Test**: eslint-plugin-jsx-a11y, axe/jest-axe in unit tests, Playwright + axe in CI, Lighthouse a11y, **manual keyboard pass and screen-reader testing** (VoiceOver, NVDA, TalkBack) for key journeys, and ideally testing with disabled users.
- **Govern**: audits before major releases, an accessibility statement and feedback channel, and tracking a11y bugs with severity like any other defect.
:::

:::question
difficulty: easy
companies: Microsoft, Google
### What's the difference between semantic and non-semantic HTML, and why does it matter for accessibility and SEO?
Semantic elements (`<nav>`, `<main>`, `<article>`, `<button>`, `<h2>`, `<label>`) describe **meaning**; non-semantic ones (`<div>`, `<span>`) describe nothing. Browsers map semantics to the accessibility tree, so screen readers announce roles and let users jump by headings, landmarks, links and form controls; native interactive elements also bring keyboard and focus behaviour. Search engines use the same structure to understand content hierarchy (headings, articles, nav vs main content), and semantic markup improves rich results and readability for crawlers. Bonus: it's easier to maintain and style.
:::

:::question
difficulty: easy
### What are the WCAG POUR principles?
**Perceivable** (information can be seen/heard: alt text, captions, contrast), **Operable** (UI can be used: keyboard access, enough time, no traps, visible focus), **Understandable** (predictable behaviour, clear labels and errors, readable language), **Robust** (works across browsers and assistive technologies through valid semantics and correct name/role/value). Success criteria are graded A, AA and AAA; AA is the usual target.
:::

:::challenge
difficulty: easy
### Fix the accessibility issues
```html
<div class="header">
  <img src="logo.png">
  <div class="nav"><span onclick="go('/home')">Home</span> <span onclick="go('/cart')">Cart</span></div>
</div>
<div class="title" style="font-size:32px;font-weight:bold">Checkout</div>
<input placeholder="Email">
<div class="btn" onclick="pay()" style="color:#aaa;background:#fff">Pay now</div>
<p style="color:red">Card number is invalid</p>
```
@@@solution
```html
<header>
  <a href="/"><img src="logo.png" alt="ShopCo home"></a>
  <nav aria-label="Main">
    <ul>
      <li><a href="/home">Home</a></li>
      <li><a href="/cart">Cart</a></li>
    </ul>
  </nav>
</header>
<main>
  <h1>Checkout</h1>
  <label for="email">Email</label>
  <input id="email" type="email" autocomplete="email" required>

  <label for="card">Card number</label>
  <input id="card" inputmode="numeric" autocomplete="cc-number" aria-invalid="true" aria-describedby="card-err">
  <p id="card-err" class="error"><span aria-hidden="true">⚠</span> Card number is invalid</p>

  <button type="button" onclick="pay()">Pay now</button>
</main>
```
Fixes: landmarks (`header`, `nav`, `main`), real links for navigation, alt text, a real `<h1>`, a visible `<label>` (placeholder isn't a label), `type`/`autocomplete`, a `<button>` with sufficient contrast (#aaa on white is ~2.3:1 → fails), error linked with `aria-describedby` + `aria-invalid`, and error communicated with text/icon, not colour alone.
:::

:::quiz
### What's the minimum contrast ratio for normal body text at WCAG AA?
- [ ] 3:1
- [x] 4.5:1
- [ ] 7:1
- [ ] 2:1
@@@explain
4.5:1 for normal text, 3:1 for large text and UI components; 7:1 is AAA.
:::

:::quiz
### Which element should you use for something that navigates to another page?
- [ ] <button>
- [x] <a href>
- [ ] <div role="button">
- [ ] <span onclick>
@@@explain
Links navigate; buttons act. Links get middle-click, copy-link, and are announced as links.
:::
