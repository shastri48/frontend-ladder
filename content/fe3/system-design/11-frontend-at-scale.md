---
title: Frontend for 1M+ Users and the "HLD of Your Project" Round
summary: Designing a production-grade frontend architecture — delivery, rendering, routing, state, modularity, quality gates, observability and team scaling — plus a template to present the high-level design of a project you built.
minutes: 26
---

## The prompt(s)

> "Design a production-grade frontend architecture for an application serving 1 million+ users. How would you handle scalability, performance, routing, state management and maintainability?"
>
> "Discuss the HLD of your current or past frontend project — modules, component hierarchy, API contracts, caching, performance, and non-functional requirements like response time and availability." (Tekion)

Both are open-ended and test **architectural judgement**, not a specific product. The trick: "1M users" barely stresses the frontend itself — the browser runs on the user's device. What scales is **delivery** (CDN, caching, bundle size), **backend calls**, **reliability**, and **the codebase and teams**.

## 1. Delivery: getting bytes to a million devices

- **Static assets on a CDN** with content-hashed filenames and `Cache-Control: public, max-age=31536000, immutable`. HTML: short cache or `no-cache` + ETag, or ISR at the edge.
- **Compression** (Brotli), HTTP/2/3, preconnect to API and image origins.
- **Image CDN** (resize, AVIF/WebP), font subsetting, `font-display: swap`.
- **Multi-region / edge**: static and SSR at the edge keeps TTFB low worldwide.
- **Deploys are atomic and reversible**: immutable builds, instant rollback, canary or percentage rollouts, feature flags to decouple deploy from release.
- **Version skew**: users keep old tabs open for days. Keep old chunks available after deploys (don't delete previous builds immediately), handle `ChunkLoadError` by prompting a reload, version APIs compatibly.

## 2. Rendering & performance

- Choose per route: SSG/ISR for marketing/content, SSR/streaming for SEO + dynamic pages, CSR for authenticated app areas. Server components to cut JS.
- **Route-based code splitting**, lazy-load heavy widgets (editors, charts, maps), prefetch likely next routes.
- **Performance budgets** in CI (e.g. ≤170KB gzipped JS for initial route, LCP < 2.5s on a mid-tier phone profile) — fail the build when exceeded.
- Third-party scripts governed (loaded after interaction/idle, via a tag manager with review, or in a web worker with Partytown).
- RUM for Core Web Vitals segmented by device/country/route.

## 3. Routing

- File-system or config-based routes, each a code-split boundary with its own data loaders (fetch in parallel with code, avoid waterfalls).
- Nested layouts so shells don't re-render on navigation; route-level error boundaries and not-found handling.
- URL as state for anything shareable (filters, tabs, pagination); auth guards at route level (redirect to login with return URL), with the **server** enforcing authorization.

## 4. State management that survives growth

The source of most "sync bugs" (reference: "Your application uses Redux, Context API and local state, creating synchronization bugs. How would you redesign?"):

| Kind of state | Tool | Rule |
|---|---|---|
| Server state | React Query / RTK Query / Apollo | Single cache keyed by query; no copying API data into other stores |
| URL state | Router | Filters, pagination, selected ids |
| Global client state | Small store (Zustand/Redux) | Truly global UI: auth session, theme, feature flags |
| Local state | `useState`/`useReducer` | Default; lift only when needed |
| Form state | React Hook Form / form library | Isolated, validated with schemas (Zod) |
| Derived state | Selectors / `useMemo` | Never store what you can compute |

Redesign steps: inventory every piece of state and its owner; delete duplicated copies (derive instead); move fetched data into the query cache with invalidation on mutations; keep Context for low-frequency dependency injection (theme, session), not for fast-changing data (context re-renders all consumers).

## 5. Maintainability: codebase structure for many teams

```text
src/
  app/                 routing, providers, app shell
  features/            ← organise by domain, not by file type
    checkout/
      components/  hooks/  api/  state/  tests/  index.ts   (public API of the feature)
    search/
  shared/
    ui/                design system components (or a separate package)
    lib/               utilities, api client, analytics
    config/
```

- **Feature-based (vertical) modules** with explicit public APIs; lint rules (eslint-plugin-boundaries / dependency-cruiser) forbid deep imports across features.
- **Design system** package with tokens, accessible primitives, Storybook docs, visual regression tests.
- **Monorepo** (Turborepo/Nx/pnpm workspaces) for shared packages, consistent tooling, affected-only builds and tests.
- **Micro-frontends** only when org scale demands independent deploys (multiple teams, separate release cadences): module federation or route-level composition. Costs: duplicate dependencies, shared state/contracts, consistency, performance. Most products at 1M users don't need them.
- TypeScript strict mode, generated API types from OpenAPI/GraphQL schemas (contracts enforced at compile time).

## 6. Quality gates

Testing pyramid: unit (pure logic), component (React Testing Library), integration with MSW-mocked APIs, a thin layer of E2E (Playwright) for critical journeys (login, checkout), visual regression for the design system, accessibility checks (axe) in CI, Lighthouse CI budgets. Code review with ownership (CODEOWNERS), preview deployments per PR.

## 7. Reliability & observability

- Error tracking (Sentry) with source maps, release tagging, and user/session context; alert on new error spikes after deploys.
- RUM: Web Vitals, API latency/error rates from the client, custom business events (checkout success).
- Error boundaries per route/widget, retry with backoff, offline/degraded modes, timeouts.
- Feature flags + kill switches; gradual rollouts watching error/latency dashboards.
- Security: CSP, dependency scanning, secrets never in client bundles, httpOnly cookies for sessions, input sanitisation.

## 8. Accessibility and i18n at scale

Accessible design-system primitives (so product teams get it by default), automated + manual audits, keyboard/screen-reader test plans. i18n: externalised strings (ICU message format), locale-aware formatting with `Intl`, RTL via logical CSS properties, lazy-loaded locale bundles.

## The "HLD of your project" template

Interviewers want to see that you **understood and owned** the system, not just your tickets. Prepare one project using this structure (10–15 minutes, with a diagram):

1. **Context (1 min)** — what the product does, users, scale (MAU, requests/day, team size), your role.
2. **Requirements** — key functional flows; NFRs with numbers (p95 page load, availability target, devices, SEO, compliance like PCI/RBI).
3. **Architecture diagram** — client app(s), rendering strategy, BFF/gateway, key services, CDN, third parties (payments, analytics).
4. **Frontend modules & component hierarchy** — main routes, shared design system, state ownership.
5. **API contracts** — 2–3 representative endpoints, pagination, error format, versioning, how contracts are typed and validated.
6. **Data & caching** — client cache strategy, HTTP caching, CDN, invalidation.
7. **Performance** — what you measured, what you changed, the before/after numbers.
8. **Reliability** — error handling, retries, monitoring/alerting, incident you handled.
9. **Trade-offs & alternatives** — what you chose not to do and why ("we kept a monolith SPA instead of micro-frontends because…").
10. **What you'd change** with hindsight / one more quarter.

:::callout interview Make it concrete
Numbers and decisions beat adjectives: "We cut LCP from 4.1s to 2.2s on p75 mobile by server-rendering the order summary and preloading the hero image" is far stronger than "I optimised performance."
:::

## Interview questions

:::question
difficulty: hard
### Design a frontend architecture for 1M+ users — what are the key areas you'd cover?
Delivery (CDN, immutable hashed assets, edge/ISR HTML, compression, safe deploys with rollbacks and feature flags, version skew handling); rendering (per-route SSR/SSG/CSR, streaming, code splitting, budgets); routing (nested layouts, parallel data loading, route error boundaries, URL state); state (server cache vs URL vs global vs local, no duplication); maintainability (feature modules with boundaries, design system, monorepo, typed API contracts, optional micro-frontends); quality (test pyramid, a11y and perf checks in CI); reliability/observability (Sentry, RUM, Web Vitals, alerting); security (CSP, cookies, dependency scanning); i18n/a11y by default. Emphasise that user count scales the backend and delivery; the frontend scales mainly with code and teams.
:::

:::question
difficulty: medium
companies: Walmart
### How would you structure and optimise a large-scale React codebase for scalability and readability?
Organise by feature/domain with clear public APIs and enforced import boundaries; a shared design system and utilities layer; strict TypeScript and generated API types; consistent conventions via ESLint/Prettier and templates; colocate tests, stories and styles with components; server-state library instead of hand-written fetching in Redux; route-level code splitting; CODEOWNERS for ownership; monorepo tooling for shared packages and affected builds; documentation via ADRs and Storybook. Refactor incrementally with codemods rather than big-bang rewrites.
:::

:::question
difficulty: medium
### When are micro-frontends worth it?
When many autonomous teams need to build, test and deploy parts of one product independently, possibly with different release cadences or even frameworks (e.g. large e-commerce or enterprise portals, migrations from Angular to React piece by piece). Costs: larger total bundles and duplicate dependencies, runtime integration complexity, cross-app state and routing contracts, UX consistency, and harder performance work. For a single team or a few teams, a well-modularised monolith with a monorepo is simpler and faster.
:::

## Practice

:::challenge
difficulty: hard
### Present the HLD of a payment checkout frontend you worked on
Using the template, outline a 10-minute HLD presentation for a hosted payment checkout page (merchant redirects users to your page to pay by card/UPI/netbanking). Include NFRs, architecture, API contracts, caching, performance and reliability.
@@@solution
**1. Context** — Hosted checkout used by thousands of merchants; ~X million sessions/month, 70% mobile, India-first (UPI). I owned the frontend architecture and performance.

**2. Requirements** — Functional: load order details, show payment methods eligible for the order, collect payment details securely, handle 3DS/OTP/UPI intent/collect, show success/failure and redirect to merchant. NFRs: p75 LCP < 2s on 4G mid-tier Android; availability 99.95%; PCI-DSS scope minimised; WCAG AA; localisation (English/Hindi); merchant branding.

**3. Architecture**
```text
Merchant → redirect → checkout.example.com/session/:id
  CDN (static assets, hashed) → SSR edge (renders order summary + method list from session API)
  Client islands: method selector, card form (PCI iframe), UPI flow, status poller
  BFF → session service, eligibility service, payment orchestration, risk
  Payment status via polling with backoff (webhook-driven backend), redirect to merchant callback
```

**4. Modules** — `session` (load/expiry), `methods` (cards/UPI/netbanking/wallets), `payment-flow` state machine (idle → submitting → authenticating → polling → success/failure), `branding` (theme tokens from merchant config), shared design system.

**5. API contracts**
```http
GET  /sessions/:id            → { order, merchant:{ name, logo, theme }, methods:[…], expiresAt }
POST /sessions/:id/payments   { method, payload, idempotencyKey } → { paymentId, nextAction: { type: 'redirect'|'upi_intent'|'poll', … } }
GET  /payments/:id/status     → { status: 'pending'|'success'|'failed', reason }
```
Errors use a typed envelope `{ code, message, retryable }`.

**6. Caching** — static assets immutable at CDN; merchant branding cached per merchant (short TTL); session data never cached (`no-store`); method icons sprite cached.

**7. Performance** — SSR of order summary + first method (LCP text), JS split per payment method (UPI code not loaded for card payers), preconnect to bank/3DS domains on method selection, fonts system-default. Result: LCP 3.4s → 1.8s p75, JS 410KB → 160KB.

**8. Reliability** — idempotency keys on payment creation; status polling with backoff and max duration, never auto-retrying a submitted payment; graceful "payment processing — we'll notify the merchant" state on timeouts; error boundaries; Sentry with session ids; RUM dashboards per merchant; feature flags for new methods; kill switch per bank.

**9. Trade-offs** — SSR at edge vs pure CSR (chose SSR for LCP; cost: server infra); iframe-hosted card fields vs native inputs (chose iframe for PCI scope; cost: styling constraints); polling vs WebSocket for status (polling is simpler and enough for a single short-lived wait).

**10. Next** — move to streaming SSR, prefetch eligibility on merchant side, more granular RUM by bank.
:::

## Quick check

:::quiz
### What is "version skew" in frontend deployments?
- [ ] Different React versions in node_modules
- [x] Users running an old client build against new servers/assets after a deploy
- [ ] CSS specificity conflicts
- [ ] Browser version differences
@@@explain
Long-lived tabs keep old JS; deleting old chunks or breaking APIs causes failures. Keep old assets and handle chunk load errors.
:::

:::quiz
### Context API is a poor fit for…
- [ ] Theme and locale
- [ ] Authenticated user session
- [x] Rapidly changing data read by many components, like a live table or form state
- [ ] Dependency injection of services
@@@explain
Every consumer re-renders when the context value changes; use a store with selectors for high-frequency state.
:::
