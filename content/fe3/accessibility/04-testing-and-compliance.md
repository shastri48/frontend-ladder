---
title: Testing Accessibility and Building a Compliance Culture
summary: Automated vs manual a11y testing, screen-reader testing basics, accessible forms and errors, and how to make WCAG/regulatory compliance a team habit rather than an audit panic.
minutes: 14
---

## Automated tools catch about a third

Automated checkers are fast and great at catching **objective** failures: missing alt attributes, missing form labels, insufficient contrast, invalid ARIA, duplicate IDs, missing `lang`. Studies (e.g. by Deque and GOV.UK) estimate they catch roughly **30–40%** of WCAG issues. They can't tell whether alt text is *meaningful*, focus order is *logical*, or a custom widget *works* with a keyboard.

So a mature strategy is a **pyramid**:

```text
            ▲  Testing with disabled users (periodic)
           ▲▲▲ Manual screen reader passes on key journeys (per release)
          ▲▲▲▲▲ Manual keyboard testing (per feature)
        ▲▲▲▲▲▲▲▲ Automated: lint + unit (jest-axe) + E2E (axe in Playwright) + Lighthouse CI
```

## Automated layer

```bash
npm i -D eslint-plugin-jsx-a11y jest-axe @axe-core/playwright
```

```jsx
// Component test with jest-axe
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'

test('Checkout form has no detectable a11y violations', async () => {
  const { container } = render(<CheckoutForm />)
  expect(await axe(container)).toHaveNoViolations()
})
```

```js
// Playwright E2E
import AxeBuilder from '@axe-core/playwright'
test('home page is accessible', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(results.violations).toEqual([])
})
```

Also: **React Testing Library's** philosophy helps — querying by role and name (`getByRole('button', { name: /pay/i })`) fails if your controls aren't accessible, so tests double as a11y checks.

## Manual keyboard pass (5 minutes per feature)

1. Unplug the mouse. Tab through the whole flow.
2. Is focus **always visible**? Does the order match the visual order?
3. Can you **operate** everything (menus, date pickers, sliders, drag-and-drop alternatives)?
4. Are there **keyboard traps** (can't Tab out of an embedded widget)?
5. Do dialogs move focus in, trap, close with Escape, and return focus?
6. After async actions (save, delete, route change), where does focus land?
7. Zoom to 200% and 400% (reflow), and test at 320 px width.

## Screen reader basics

| Platform | Screen reader | Start |
|---|---|---|
| macOS/iOS | VoiceOver | Cmd+F5 / triple-click side button |
| Windows | NVDA (free), JAWS | Ctrl+Alt+N |
| Android | TalkBack | Volume keys shortcut |

What to check: page title announced; headings list is logical (VoiceOver rotor: Ctrl+Opt+U); landmarks exist; every control has name + role + state ("Subscribe, checkbox, not checked"); images have meaningful alt; form errors are announced; dynamic updates are announced via live regions; nothing is read that shouldn't be (decorative icons).

## Accessible forms and errors

Forms are where money is made — checkout, signup, payments — and where most a11y failures cluster.

```jsx
<form noValidate onSubmit={handleSubmit}>
  {errors.length > 0 && (
    <div role="alert" tabIndex={-1} ref={summaryRef}>
      <h2>There are {errors.length} problems with your payment details</h2>
      <ul>{errors.map(e => <li key={e.field}><a href={`#${e.field}`}>{e.message}</a></li>)}</ul>
    </div>
  )}

  <label htmlFor="upi">UPI ID</label>
  <input
    id="upi"
    name="upi"
    autoComplete="off"
    aria-invalid={!!fieldErrors.upi}
    aria-describedby={fieldErrors.upi ? 'upi-error upi-hint' : 'upi-hint'}
  />
  <p id="upi-hint">For example, name@bank</p>
  {fieldErrors.upi && <p id="upi-error" className="error">Enter a UPI ID like name@bank</p>}
</form>
```

- Visible labels, hints linked by `aria-describedby`, `autocomplete` tokens (helps cognitive and motor users).
- Validate on submit (or on blur), not on every keystroke screaming errors.
- Error summary that receives focus + inline errors with `aria-invalid`.
- Error text says **how to fix**, not just "Invalid".
- Don't disable the submit button without explanation; don't use time limits without the option to extend.
- OTP/captcha: support paste and autofill (`autocomplete="one-time-code"`), offer non-visual alternatives (WCAG 2.2 *Accessible Authentication*).

## Compliance as culture (including regulated industries)

Banks, payment companies and government services are increasingly expected by regulators and laws (EAA in Europe, ADA in the US, RPwD Act and sector regulators' digital-accessibility expectations in India) to make digital journeys accessible. The winning approach is **shift-left**:

1. **Policy**: "WCAG 2.2 AA" written into the definition of done and design reviews.
2. **Design system**: accessible primitives, tokens with compliant contrast, documented keyboard behaviour — fixing a11y once in `<Select>` fixes it in 200 screens.
3. **Automation in CI**: lint + axe gates on PRs for critical journeys.
4. **Manual audits** per release for checkout/login/KYC flows; external audit annually; VPAT/ACR documentation for enterprise customers.
5. **Training & ownership**: a11y champions per team; bugs triaged by severity (blockers = can't complete a journey).
6. **Feedback loop**: an accessibility statement and a contact channel for users.

:::question
difficulty: medium
### How do you test accessibility in a React application?
Layered: (1) **lint** with eslint-plugin-jsx-a11y during development; (2) **unit/integration tests** with React Testing Library queries by role/name plus `jest-axe`; (3) **E2E** with Playwright/Cypress + axe on critical journeys, and Lighthouse CI; (4) **manual keyboard testing** for every feature (focus visibility, order, traps, dialogs); (5) **screen reader** passes with VoiceOver/NVDA/TalkBack on key flows each release; (6) zoom/reflow and reduced-motion checks; (7) periodic expert audits and usability testing with disabled users. Automated tools catch only a third of issues, so manual testing is non-negotiable.
:::

:::question
difficulty: medium
### What makes form errors accessible?
Associate each error with its field (`aria-describedby` + `aria-invalid="true"`), use text (and optionally an icon) rather than colour alone, explain how to fix it, and on submit provide an error summary that gets focus (or a `role="alert"`) with links to each invalid field. Keep labels visible, don't clear user input on error, and avoid validating aggressively on every keystroke.
:::

:::challenge
difficulty: medium
companies: Walmart
### Create an a11y quality gate for a team of 40 engineers
Your company signs an enterprise contract requiring WCAG 2.2 AA in 6 months. The app has 150 screens and no a11y practice. Propose a plan.
@@@solution
**Month 0–1: Baseline**
- Automated scan (axe crawler) of all routes → issue inventory grouped by component; manual audit of the top 5 journeys (login, onboarding/KYC, checkout/payments, settings, support).
- Prioritise: blockers (can't complete a journey) → high-traffic screens → long tail.

**Month 1–3: Fix at the source**
- Fix design-system primitives first (Button, Input, Select/Combobox, Dialog, Tabs, Toast, Table, DatePicker) — one fix propagates everywhere.
- Contrast-compliant design tokens; global `:focus-visible` style; skip link; route-change focus management; live-region utility.

**Month 1 onwards: Prevent regressions**
- eslint-plugin-jsx-a11y as error; jest-axe in component tests; Playwright + axe on journeys in CI as a PR gate.
- PR checklist: keyboard pass done, labels, focus management, screen reader smoke test for new widgets.

**People**
- Two-hour training for engineers and designers; a11y champion per squad; office hours.
- Designers annotate focus order, headings and labels in Figma.

**Month 5–6: Verify & document**
- External audit, fix findings, publish ACR/VPAT and accessibility statement with a feedback channel.
- Track a11y KPIs: violations per release, journeys passing manual audit.
:::

:::quiz
### Roughly what share of WCAG issues can automated tools detect?
- [ ] Nearly 100%
- [ ] About 80%
- [x] Around 30–40%
- [ ] Under 5%
@@@explain
Automated tools catch objective issues; meaning, order and widget behaviour need humans.
:::

:::quiz
### Which RTL query encourages accessible markup?
- [ ] getByTestId
- [ ] container.querySelector
- [x] getByRole('button', { name: 'Pay' })
- [ ] getByClassName
@@@explain
Querying by role and accessible name fails if the element isn't exposed correctly to assistive tech.
:::
