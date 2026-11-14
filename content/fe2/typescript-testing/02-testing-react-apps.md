---
title: Testing React Apps with Jest and React Testing Library
summary: The testing pyramid/trophy, what to test, RTL queries and user-event, async UI, mocking fetch and modules, and avoiding brittle tests.
minutes: 17
---

## Why and what to test

Tests let you change code with confidence. The goal isn't 100% coverage; it's **catching regressions in the behaviour users and other code depend on**.

```text
            ▲  E2E (Playwright/Cypress)  — few, slow, highest confidence, full stack
           ███
          █████  Integration (RTL: a page/feature with mocked network) — the sweet spot
         ███████
        █████████  Unit (pure functions, hooks, reducers) — many, fast
       ███████████  Static (TypeScript, ESLint) — free, always on
```

Kent C. Dodds' **testing trophy** emphasises **integration tests** for frontends: render a feature as the user sees it, mock only the network, and assert on what's on screen.

> "The more your tests resemble the way your software is used, the more confidence they can give you." — the guiding principle of React Testing Library.

## The tools

- **Jest** or **Vitest** — test runner + assertions + mocking. Vitest is Jest-compatible and faster in Vite projects.
- **jsdom** — a simulated DOM in Node (no real layout or rendering).
- **React Testing Library (RTL)** — renders components and queries the DOM **the way users find things**: by role, label, text.
- **@testing-library/user-event** — realistic user interactions (typing fires keydown/keypress/input/keyup, focus, etc.).
- **@testing-library/jest-dom** — matchers like `toBeInTheDocument`, `toBeDisabled`, `toHaveValue`.
- **MSW (Mock Service Worker)** — intercepts network requests at the network layer, so your real fetch code runs.

## A first test

```tsx
// Counter.tsx
export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <>
      <p>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </>
  )
}
```

```tsx
// Counter.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Counter } from './Counter'

test('increments the count', async () => {
  const user = userEvent.setup()
  render(<Counter />)

  expect(screen.getByText('Count: 0')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /increment/i }))
  expect(screen.getByText('Count: 1')).toBeInTheDocument()
})
```

Structure: **Arrange** (render) → **Act** (user events) → **Assert** (what the user sees).

## Queries — choose by priority

| Priority | Query | Why |
|---|---|---|
| 1 | `getByRole('button', { name: 'Save' })` | Matches how assistive tech sees the page; also tests accessibility |
| 2 | `getByLabelText('Email')` | Form fields |
| 3 | `getByPlaceholderText`, `getByText`, `getByDisplayValue` | Visible text |
| 4 | `getByAltText`, `getByTitle` | Images, titles |
| last | `getByTestId('cart-total')` | When nothing user-visible identifies it |

Variants:

| | Throws if not found? | Async? | Use when |
|---|---|---|---|
| `getBy…` | Yes | No | Element should be there now |
| `queryBy…` | No (returns null) | No | Asserting something is **absent** |
| `findBy…` | Yes (after timeout) | **Yes** (returns promise) | Element appears after async work |
| `getAllBy…` etc. | | | Multiple matches |

```tsx
expect(screen.queryByRole('alert')).not.toBeInTheDocument()
expect(await screen.findByText('Welcome, Ada')).toBeInTheDocument()
```

## Async UI and mocking the network

```tsx
// UserList.tsx
export function UserList() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load'))))
      .then(setUsers)
      .catch((e) => setError(e.message))
  }, [])
  if (error) return <p role="alert">{error}</p>
  if (!users) return <p>Loading…</p>
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>
}
```

**Option A — MSW (recommended)**:

```tsx
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/users', () => HttpResponse.json([{ id: 1, name: 'Ada' }]))
)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('shows users', async () => {
  render(<UserList />)
  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(await screen.findByText('Ada')).toBeInTheDocument()
})

test('shows an error', async () => {
  server.use(http.get('/api/users', () => new HttpResponse(null, { status: 500 })))
  render(<UserList />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load')
})
```

**Option B — mock fetch directly**:

```tsx
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 1, name: 'Ada' }] })
})
```

MSW is better because it doesn't couple tests to *how* you fetch (fetch vs axios vs React Query) and the same handlers power Storybook and local dev.

### Mocking modules and timers

```ts
jest.mock('./analytics', () => ({ track: jest.fn() }))
import { track } from './analytics'
expect(track).toHaveBeenCalledWith('checkout', { total: 42 })

jest.useFakeTimers()
// with user-event: userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
jest.advanceTimersByTime(300)   // fast-forward debounce
```

## Testing forms

```tsx
test('submits the login form', async () => {
  const onSubmit = jest.fn()
  const user = userEvent.setup()
  render(<LoginForm onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
  await user.type(screen.getByLabelText(/password/i), 'secret123')
  await user.click(screen.getByRole('button', { name: /sign in/i }))

  expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret123' })
})

test('shows validation error for empty email', async () => {
  const user = userEvent.setup()
  render(<LoginForm onSubmit={jest.fn()} />)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
  expect(screen.getByText(/email is required/i)).toBeInTheDocument()
})
```

## Providers: write a custom render

```tsx
function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}
```

## What NOT to do

- ❌ Test implementation details: internal state values, private methods, which hook was called, class names, component instance methods. Refactors break these tests while behaviour is unchanged.
- ❌ Snapshot everything — huge snapshots get rubber-stamped on update. Use small, targeted snapshots if at all.
- ❌ `container.querySelector('.btn-primary')` — prefer role queries.
- ❌ Wrapping things in `act()` manually — RTL and user-event already do; an "act warning" usually means you didn't `await` an async update (use `findBy` / `waitFor`).
- ❌ Arbitrary `sleep`s — use `findBy`/`waitFor`.

## Interview questions

:::question
difficulty: medium
### How do you test a React application?
Layered strategy:
1. **Static**: TypeScript + ESLint (including jsx-a11y) catch many bugs for free.
2. **Unit**: pure utilities, reducers, custom hooks (`renderHook`) with Jest/Vitest.
3. **Integration** (most value): render features with **React Testing Library**, interact with `user-event`, query by role/label/text, mock the network with **MSW**, assert on visible output — not internals.
4. **E2E**: a handful of critical journeys (login, checkout) with Playwright/Cypress against a real or staged backend.
5. **Visual/a11y**: Storybook + visual regression (Chromatic) and axe checks.
Run in CI on every PR; focus coverage on critical paths rather than a percentage.
:::

:::question
difficulty: easy
### getBy vs queryBy vs findBy?
`getBy` returns the element or **throws** immediately; `queryBy` returns `null` if not found (use to assert absence); `findBy` returns a **promise** that retries until the element appears (default 1 s) — use for async UI. All have `All` variants for multiple elements.
:::

:::question
difficulty: medium
### Why does RTL recommend querying by role?
Roles reflect how users and assistive technologies perceive the UI ("a button named Save"). Tests written this way survive refactors of markup/classes, and they double as accessibility checks: if you can't find your button by role and name, a screen-reader user can't either.
:::

:::question
difficulty: medium
### Unit vs integration vs E2E tests — trade-offs?
- **Unit**: smallest pieces in isolation; very fast, precise failure location; low confidence that the app works as a whole; can over-mock.
- **Integration**: several units together (component + hooks + state + mocked network); good confidence-to-cost ratio; the bulk of frontend tests.
- **E2E**: the real app in a real browser; highest confidence; slow, flakier, expensive to maintain; reserve for critical user journeys.
:::

## Challenges

:::challenge
difficulty: medium
### Write tests for a debounced search
A `<Search onSearch={fn} />` component calls `onSearch(query)` 300 ms after the user stops typing. Write tests that verify (1) it doesn't call immediately, (2) it calls once with the final value after typing "react".
@@@solution
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Search } from './Search'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

test('debounces the search callback', async () => {
  const onSearch = jest.fn()
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  render(<Search onSearch={onSearch} />)

  await user.type(screen.getByRole('searchbox'), 'react')
  expect(onSearch).not.toHaveBeenCalled()

  jest.advanceTimersByTime(299)
  expect(onSearch).not.toHaveBeenCalled()

  jest.advanceTimersByTime(1)
  expect(onSearch).toHaveBeenCalledTimes(1)
  expect(onSearch).toHaveBeenCalledWith('react')
})
```
Key points: fake timers make debounce tests fast and deterministic; tell user-event how to advance them; query the input by role (`<input type="search">` has role `searchbox`); assert on the public contract (callback), not internal timer state. With Vitest use `vi.useFakeTimers()` / `vi.advanceTimersByTime`.
:::

## Quick check

:::quiz
### You need to assert an error message is NOT shown. Which query?
- [ ] getByText
- [x] queryByText
- [ ] findByText
- [ ] getAllByText
@@@explain
queryBy returns null instead of throwing, so `expect(...).not.toBeInTheDocument()` works.
:::

:::quiz
### What's the main advantage of MSW over mocking fetch with jest.fn()?
- [ ] It's faster
- [x] It intercepts at the network level, so tests don't depend on how you fetch
- [ ] It works without Node
- [ ] It removes the need for async tests
@@@explain
Swap fetch for axios or React Query and MSW-based tests still pass.
:::
