---
title: Testing Hooks, E2E with Playwright/Cypress, and Storybook
summary: Testing custom hooks with renderHook, end-to-end testing of critical journeys, and component-driven development with Storybook.
minutes: 13
---

## Testing custom hooks

Most hooks are best tested **through a component that uses them**. But reusable hooks (a `useDebounce`, `useFetch`, `useLocalStorage`) deserve direct tests with `renderHook`:

```tsx
// useCounter.ts
export function useCounter(initial = 0, step = 1) {
  const [count, setCount] = useState(initial)
  const increment = useCallback(() => setCount((c) => c + step), [step])
  const decrement = useCallback(() => setCount((c) => c - step), [step])
  const reset = useCallback(() => setCount(initial), [initial])
  return { count, increment, decrement, reset }
}
```

```tsx
import { renderHook, act } from '@testing-library/react'

test('increments and resets', () => {
  const { result } = renderHook(() => useCounter(5, 2))
  act(() => result.current.increment())
  expect(result.current.count).toBe(7)
  act(() => result.current.reset())
  expect(result.current.count).toBe(5)
})

test('reacts to changing props', () => {
  const { result, rerender } = renderHook(({ step }) => useCounter(0, step), {
    initialProps: { step: 1 },
  })
  rerender({ step: 10 })
  act(() => result.current.increment())
  expect(result.current.count).toBe(10)
})
```

- `result.current` always holds the latest return value — don't destructure it once and reuse.
- Wrap state-changing calls in `act()` (renderHook doesn't have user-event to do it for you).
- For async hooks: `await waitFor(() => expect(result.current.data).toEqual(...))`.
- Hooks needing context: pass `{ wrapper: Providers }`.

```tsx
test('useFetch loads data', async () => {
  server.use(http.get('/api/todos', () => HttpResponse.json([{ id: 1 }])))
  const { result } = renderHook(() => useFetch('/api/todos'))
  expect(result.current.status).toBe('loading')
  await waitFor(() => expect(result.current.status).toBe('success'))
  expect(result.current.data).toEqual([{ id: 1 }])
})
```

## End-to-end testing

E2E tests drive a **real browser** against your running app — clicking, typing, navigating — and catch problems no unit test can: routing, real network integration, auth cookies, CSS hiding a button, a broken build.

### Playwright

```ts
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test'

test('user can add to cart and check out', async ({ page }) => {
  await page.goto('/products')
  await page.getByRole('button', { name: 'Add iPhone to cart' }).click()
  await expect(page.getByTestId('cart-count')).toHaveText('1')

  await page.getByRole('link', { name: 'Cart' }).click()
  await page.getByRole('button', { name: 'Checkout' }).click()
  await page.getByLabel('Card number').fill('4242 4242 4242 4242')
  await page.getByRole('button', { name: 'Pay' }).click()

  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible()
})
```

### Cypress

```js
describe('login', () => {
  it('logs in', () => {
    cy.intercept('POST', '/api/login', { fixture: 'user.json' }).as('login')
    cy.visit('/login')
    cy.findByLabelText(/email/i).type('ada@example.com')
    cy.findByLabelText(/password/i).type('secret')
    cy.findByRole('button', { name: /sign in/i }).click()
    cy.wait('@login')
    cy.url().should('include', '/dashboard')
  })
})
```

| | Playwright | Cypress | Selenium |
|---|---|---|---|
| Browsers | Chromium, Firefox, WebKit | Chromium-family, Firefox (WebKit experimental) | All (WebDriver) |
| Architecture | Out-of-process via CDP/protocols, async API | Runs inside the browser, chained commands | WebDriver protocol |
| Multiple tabs / origins | ✅ | Limited | ✅ |
| Parallelism | Built-in, free | Paid dashboard / plugins | Grid |
| Auto-wait | ✅ | ✅ | Manual waits |
| DX | Trace viewer, codegen, UI mode | Time-travel debugger, great UX | Older, verbose |

### Keeping E2E reliable

- Test **critical journeys** only (signup, login, checkout, the money path).
- Use resilient selectors (role/label/test ids), never CSS paths.
- Rely on auto-waiting assertions, **never fixed sleeps**.
- Seed/reset test data via API calls, not the UI; each test independent.
- Run against a production build; record traces/videos on failure; retry flaky tests at most once and fix them.

## Storybook and component-driven development

**Component-driven development (CDD)**: build UIs bottom-up — atoms (Button, Input) → molecules (SearchBar) → organisms (Header) → pages — developing each component **in isolation** with all its states.

**Storybook** is the workshop for that:

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  component: Button,
  args: { children: 'Save' },
  argTypes: { variant: { control: 'select', options: ['primary', 'secondary', 'ghost'] } },
}
export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { variant: 'primary' } }
export const Loading: Story = { args: { loading: true } }
export const Disabled: Story = { args: { disabled: true } }

// Interaction test inside Storybook
export const ClickFlow: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button'))
    // expect(args.onClick).toHaveBeenCalled()
  },
}
```

Why teams use it:

- Develop hard-to-reach states (error, empty, loading, very long text, RTL) without clicking through the app.
- **Living documentation** of the design system for designers, PMs and other teams (autodocs).
- Testing: interaction tests (`play`), **accessibility** checks (a11y addon/axe), **visual regression** (Chromatic/Percy screenshots each story and diffs).
- MSW addon to mock APIs per story.

Pair with design tools (Figma) and collaboration boards (Miro) for design handoff and workshops — the doc's job listings mention "experience with Storybook and Miro" for exactly this workflow.

## Interview questions

:::question
difficulty: medium
### How do you test a custom hook?
If it's only used by one component, test it through that component with RTL. For reusable hooks, use `renderHook` from `@testing-library/react`: read values from `result.current`, wrap state updates in `act`, use `rerender` with new props, `waitFor` for async results, and a `wrapper` for providers. Mock network with MSW, timers with fake timers. Assert on the hook's public return values, not its internals.
:::

:::question
difficulty: medium
### Explain end-to-end testing with Cypress or Selenium/Playwright.
E2E tests automate a real browser against the running application to verify complete user journeys across frontend, backend and integrations. Tools: **Selenium** (WebDriver, any browser, older and more verbose), **Cypress** (runs in the browser, great DX, time-travel debugging), **Playwright** (multi-browser incl. WebKit, auto-waits, parallel, trace viewer). Keep the suite small (critical paths), use accessible selectors, seed data via API, avoid sleeps, run in CI on preview deployments, and capture traces on failure.
:::

:::question
difficulty: easy
companies: Agoda
### What is Storybook used for?
Developing, documenting and testing UI components in isolation. Each "story" renders a component in a specific state; controls let you tweak props live. Teams use it as the design-system catalogue, for interaction tests, accessibility audits and visual-regression testing, and to collaborate with designers. It enables component-driven development.
:::

:::question
difficulty: medium
### What is component-driven architecture?
Structuring a UI as a hierarchy of reusable, encapsulated components — each owning its markup, styles, behaviour and tests — composed upward into features and pages. Benefits: reuse, consistency (design system), parallel development, isolated testing, easier reasoning. Practices: clear props APIs, composition over configuration, presentational vs container separation where useful, Storybook for isolation, and colocating component files (`Button.tsx`, `Button.test.tsx`, `Button.stories.tsx`, `Button.module.css`).
:::

## Challenges

:::challenge
difficulty: medium
### Test a useDebounce hook
`useDebounce(value, delay)` returns `value` only after it stopped changing for `delay` ms. Write a test using `renderHook`, `rerender` and fake timers.
@@@solution
```tsx
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

test('returns the latest value after the delay', () => {
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
    initialProps: { v: 'a' },
  })
  expect(result.current).toBe('a')

  rerender({ v: 'ab' })
  rerender({ v: 'abc' })
  act(() => { jest.advanceTimersByTime(299) })
  expect(result.current).toBe('a')          // not yet

  act(() => { jest.advanceTimersByTime(1) })
  expect(result.current).toBe('abc')        // only the final value
})
```
The hook under test:
```tsx
export function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
```
Timer advances are wrapped in `act` because they trigger a state update.
:::

## Quick check

:::quiz
### Why shouldn't you destructure `result.current` once at the top of a hook test?
- [ ] It's a syntax error
- [x] You'd keep a stale snapshot; result.current is replaced after each render
- [ ] It triggers an extra render
- [ ] act() requires the full object
@@@explain
Always read `result.current` after acting to get the latest values.
:::

:::quiz
### Which E2E practice reduces flakiness the most?
- [ ] Adding sleep(2000) before assertions
- [x] Using auto-waiting assertions and resetting test data per test
- [ ] Testing every feature end-to-end
- [ ] Using long CSS selectors
@@@explain
Fixed waits are both slow and flaky; deterministic data and auto-waiting assertions are the fix.
:::
