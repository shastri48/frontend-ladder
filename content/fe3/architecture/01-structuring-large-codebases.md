---
title: Structuring a Large-Scale React Codebase
summary: Feature-based folders, layering and dependency rules, public APIs between modules, and conventions that keep a 500k-line frontend readable for 50 engineers.
minutes: 20
---

## The problem with "components / hooks / utils"

Most apps start like this:

```text
src/
  components/   (180 files)
  hooks/        (60 files)
  services/
  utils/
  redux/
    actions/ reducers/ selectors/
```

It's organised by **technical type**. At 10 screens it's fine. At 150 screens, changing "Refunds" means touching six folders, nobody knows which `utils` are safe to change, everything imports everything, and deleting a feature is archaeology.

"How would you structure and optimise a large-scale React codebase to maintain scalability and readability?" (Walmart) is really asking: **how do you keep change cheap as the team and code grow?**

:::callout analogy Departments, not job titles
A company isn't organised as "all accountants in one room, all engineers in another" for every product. It's organised into product teams that each contain the skills they need, with clear contracts between teams. Codebases scale the same way.
:::

## Organise by feature (domain), layer inside

```text
src/
  app/                    # bootstrapping: providers, router, global styles, error boundary
    providers.tsx
    routes.tsx
  pages/ (or routes/)     # thin route components composing features
    orders/
  features/               # vertical slices of business capability
    orders/
      api/                # data fetching (React Query hooks, API client calls)
      components/         # UI used only by this feature
      hooks/
      model/              # state, types, selectors, business rules (pure TS)
      lib/                # feature-specific helpers
      index.ts            # ⭐ public API of the feature
    refunds/
    auth/
  entities/               # shared business objects used by many features (User, Merchant)
  shared/                 # generic, business-agnostic code
    ui/                   # design-system components (Button, Modal, Select)
    lib/                  # date, money, http client, logger
    config/
    types/
```

This is close to **Feature-Sliced Design** and similar to how Nx/Turborepo monorepos split libraries.

### Dependency rules (the part that actually matters)

```text
app  →  pages  →  features  →  entities  →  shared
            (imports only flow downward / rightward)
```

- `shared` knows nothing about the business.
- A feature **must not import another feature's internals**; it uses the other feature's `index.ts` public API, or communication goes up through the page/composition layer.
- Enforce with tooling, not code review: `eslint-plugin-boundaries`, `eslint-plugin-import` `no-restricted-paths`, Nx module boundary tags, or `dependency-cruiser` in CI.

```js
// .eslintrc excerpt
'no-restricted-imports': ['error', {
  patterns: [{ group: ['@/features/*/*'], message: 'Import from the feature public API (index.ts) only.' }],
}],
```

### Public APIs

```ts
// features/refunds/index.ts
export { RefundButton } from './components/RefundButton'
export { useRefundStatus } from './api/useRefundStatus'
export type { Refund } from './model/types'
// everything else is private
```

The payoff: you can refactor internals freely, delete a feature by deleting a folder, and assign ownership with `CODEOWNERS` per folder.

## Separation of concerns inside a feature

Keep **business logic pure and framework-free** (in `model/`), data fetching in hooks (`api/`), and components mostly presentational:

```ts
// model/refund.ts — pure, unit-testable, no React
export function canRefund(order: Order, now = new Date()): boolean {
  return order.status === 'captured' && differenceInDays(now, order.capturedAt) <= 180
}
```

```tsx
// components/RefundButton.tsx
export function RefundButton({ order }: { order: Order }) {
  const mutation = useCreateRefund()
  if (!canRefund(order)) return null
  return <Button onClick={() => mutation.mutate(order.id)} loading={mutation.isPending}>Refund</Button>
}
```

## Conventions that scale

- **TypeScript strict mode**; API types generated from OpenAPI/GraphQL schemas (no hand-written drift).
- **Path aliases** (`@/features/...`) instead of `../../../../`.
- **Colocation**: tests, stories and styles next to the component (`Button.tsx`, `Button.test.tsx`, `Button.stories.tsx`).
- **One way to do things**: one data-fetching library, one form library, one styling approach, documented in an ADR (Architecture Decision Record).
- **Server state ≠ client state**: React Query/RTK Query for server cache; small client stores for UI state.
- **Route-level code splitting** aligned with features.
- **Barrel files with care**: a feature `index.ts` is good; deep re-export chains hurt tree shaking and create cycles.
- **Generators/templates** (Plop, Nx generators) so new features start with the right structure.
- **Quality gates**: lint, typecheck, unit tests, bundle-size budget, and a11y checks per PR.
- **Documentation**: README per feature, Storybook for UI, ADRs for decisions.

## Refactoring legacy code toward this

You rarely get a greenfield. Strategy (asked in Housing.com techno-managerial rounds):

1. Add **guardrails first**: TypeScript (allowJs), lint rules, tests around critical behaviour.
2. **Strangler fig**: new code goes into the new structure; move old code feature by feature when you touch it.
3. Introduce boundaries as **warnings**, then errors when the count reaches zero.
4. Measure progress (number of cross-feature violations, % TS) and share it.
5. Don't stop product delivery: tie refactors to features on the roadmap.

:::question
difficulty: hard
companies: Walmart
### How would you structure and optimise a large-scale React codebase for scalability and readability?
Organise by **feature/domain** (vertical slices) rather than by technical type: `app` (bootstrapping), `pages/routes`, `features/*` (each with api, components, hooks, model and a public `index.ts`), `entities` (shared business objects), and `shared` (design system, utilities). Enforce **one-directional dependencies** and "public API only" imports with lint/boundary tooling; assign **CODEOWNERS** per feature. Keep business logic in pure TS modules, server state in React Query, UI state local. Standardise via ADRs, generators, strict TypeScript, generated API types, colocated tests/stories, a shared design system in Storybook. Optimise with route-level code splitting aligned to features and bundle budgets. For multiple teams, consider a monorepo with libraries (Nx/Turborepo) before micro-frontends.
:::

:::question
difficulty: medium
companies: Housing.com
### How do you refactor legacy frontend code safely?
Start with safety nets (characterisation tests around current behaviour, TypeScript, linting), then refactor incrementally using the strangler pattern — new code in the new architecture, old modules migrated when touched for features. Keep changes small and reviewable, behind feature flags when behaviour changes, measure progress, and communicate the business value (fewer bugs, faster delivery). Avoid big-bang rewrites, which stall delivery and usually re-create old bugs.
:::

:::question
difficulty: medium
### Why is "organise by type" (components/, hooks/, utils/) a problem at scale?
Because change is usually **per feature**, not per type: a feature's code is scattered across many folders, so changes touch many places, ownership is unclear, and coupling grows silently (any component can import any util or other feature's internals). Deleting or extracting a feature becomes hard. Feature-based structure keeps related code together, makes boundaries explicit and aligns with team ownership.
:::

:::challenge
difficulty: medium
### Design the folder structure and boundaries for a payments dashboard
Features: auth, transactions list with filters, refunds, settlements, payment links, settings (team members, API keys). Shared: design system, money/date formatting, HTTP client. Three squads own different features. Show the structure, public APIs and the rule that prevents squads from coupling.
@@@solution
```text
src/
  app/            providers.tsx, router.tsx, ErrorBoundary.tsx, queryClient.ts
  pages/
    TransactionsPage.tsx      # composes transactions + refunds features
    SettlementsPage.tsx
    SettingsPage.tsx
  features/
    auth/          api/ model/ components/ index.ts        (squad: platform)
    transactions/  api/ model/ components/ index.ts        (squad: payments)
    refunds/       api/ model/ components/ index.ts        (squad: payments)
    settlements/   api/ model/ components/ index.ts        (squad: finance)
    payment-links/ api/ model/ components/ index.ts        (squad: growth)
    settings/      api/ model/ components/ index.ts        (squad: platform)
  entities/
    merchant/  transaction/  (types, small shared UI like <TxnStatusBadge>)
  shared/
    ui/ (Button, Table, Select, Dialog…)  lib/money.ts  lib/date.ts  api/httpClient.ts  config/
```
**Composition**: `TransactionsPage` renders `<TransactionsTable onRowAction={...}>` and `<RefundDrawer>` — the page wires them; `transactions` doesn't import `refunds` internals. Refund success invalidates the query key `['transactions']`, which is exported from `transactions/index.ts`.

**Rules**
- ESLint boundaries: `shared` → nothing; `entities` → `shared`; `features` → `entities`, `shared`; `pages` → `features`; deep imports into another feature are errors.
- `CODEOWNERS`: `/src/features/settlements/ @finance-squad`.
- Each feature has a README and Storybook stories; API types generated from OpenAPI into `shared/api/generated`.
- Route-level lazy loading per page; bundle budget per route chunk in CI.
:::

:::quiz
### In feature-sliced architecture, how should feature A use something from feature B?
- [ ] Import any file from B directly
- [x] Through B's public API (index.ts) or via composition at the page level
- [ ] Copy B's code into A
- [ ] Put everything into shared/
@@@explain
Public APIs and composition keep internals private and coupling explicit.
:::

:::quiz
### What's the best way to enforce module boundaries?
- [ ] A wiki page
- [ ] Code review only
- [x] Lint/dependency rules that fail CI
- [ ] Naming conventions
@@@explain
Automated rules scale; humans forget.
:::
