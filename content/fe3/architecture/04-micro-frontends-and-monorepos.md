---
title: Micro-Frontends and Monorepos
summary: What micro-frontends solve, composition techniques (build-time, Module Federation, iframes, web components), shared dependencies, the real costs, and when a monorepo is the better answer.
minutes: 18
---

## The organisational problem

Micro-frontends are an **organisational** pattern before they are a technical one. When 10+ teams ship to one frontend, a single repo and single deploy pipeline become a bottleneck: one team's broken test blocks everyone's release, upgrades require coordinating every team, and ownership blurs.

**Micro-frontends** split a frontend into independently developed, tested and **deployed** applications, each owned by one team end-to-end (often aligned with a backend domain), composed into one product for the user.

:::callout analogy A shopping mall
A mall has one building, one entrance and shared corridors (the shell), but each store is run independently — its own staff, stock and opening of new displays — without asking the other stores. The mall still enforces common signage and fire rules (the design system and contracts).
:::

## Composition approaches

| Approach | How | Pros | Cons |
|---|---|---|---|
| **Build-time packages** | Each MFE is an npm package, the shell installs them | Simple, type-safe, single bundle optimisation | Not independently deployable (need shell redeploy) — arguably not "micro-frontends" |
| **Runtime: Module Federation** (webpack 5 / Rspack / Vite plugin) | Shell loads `remoteEntry.js` from each remote at runtime; shared deps negotiated | Independent deploys, shared React singleton, good DX | Version skew risk, runtime failures, complex config |
| **Route-based / server composition** | Reverse proxy/edge routes `/payments/*` to app A, `/settings/*` to app B | Strongest isolation, simple | Full page loads between apps, shared state/UI consistency harder |
| **iframes** | Each MFE in an iframe | Total isolation (security, CSS, JS) | Poor UX (sizing, focus, routing, a11y), heavy |
| **Web Components** | MFEs exposed as custom elements | Framework-agnostic | SSR, React interop and styling complexities |
| **Edge-side/server includes** | Server stitches HTML fragments | Good for content-heavy SSR sites | Interactivity/hydration complexity |

### Module Federation in a nutshell

```js
// payments (remote) — webpack.config.js
new ModuleFederationPlugin({
  name: 'payments',
  filename: 'remoteEntry.js',
  exposes: { './PaymentsApp': './src/PaymentsApp' },
  shared: { react: { singleton: true, requiredVersion: '^18.3.0' }, 'react-dom': { singleton: true } },
})

// shell (host)
new ModuleFederationPlugin({
  name: 'shell',
  remotes: { payments: 'payments@https://cdn.example.com/payments/remoteEntry.js' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

```jsx
const PaymentsApp = lazy(() => import('payments/PaymentsApp'))

<ErrorBoundary fallback={<RemoteUnavailable name="Payments" />}>
  <Suspense fallback={<PageSkeleton />}>
    <PaymentsApp basePath="/payments" user={user} />
  </Suspense>
</ErrorBoundary>
```

## Design rules that make micro-frontends work

1. **Split by business domain**, not by technical layer (not "header team" vs "footer team").
2. **Thin shell**: routing, auth bootstrap, layout, global error handling, design-system tokens.
3. **Contracts, not shared internals**: MFEs communicate via props from the shell, URL, browser events (`CustomEvent`), or a tiny typed event bus — never by importing each other's stores.
4. **Shared dependencies as singletons** (React, router, design system) with a clear version policy; avoid sharing too much, or you recreate a monolith with extra steps.
5. **Shared design system** for visual consistency; CSS isolation via CSS Modules/prefixes/Shadow DOM.
6. **Resilience**: each remote behind an error boundary and timeout; the product degrades gracefully if one remote fails.
7. **Independent CI/CD** with contract tests and a staging integration environment; versioned remote URLs and fast rollback.
8. **Performance budget per MFE** — duplicate libraries across remotes are the classic regression.
9. **Observability** tagged by MFE (release, owner) in Sentry/RUM.

## The costs — and when NOT to use them

- Larger total payloads and duplicated dependencies if not governed.
- Runtime integration failures (version skew of shared libs, CSS collisions).
- Harder end-to-end testing, local development (running multiple apps) and debugging.
- UX inconsistency risk; cross-app state (cart, auth) becomes a distributed systems problem.
- Platform team needed to maintain the shell, tooling and governance.

**Don't** adopt micro-frontends for a single team, a small app, or to fix a messy codebase — fix modularity first. Many organisations get 90% of the benefits from a **modular monolith in a monorepo** with enforced boundaries, CODEOWNERS and affected-only CI.

## Monorepos

A monorepo holds multiple apps and libraries in one repository (Nx, Turborepo, pnpm/yarn workspaces, Rush).

```text
apps/
  merchant-dashboard/
  checkout/
  admin/
packages/
  ui/               # design system
  api-client/       # generated types + client
  config-eslint/
  config-tsconfig/
  utils/
```

Benefits: atomic changes across apps and libraries, one version of shared deps, code sharing without publishing, consistent tooling. Requirements at scale: **task caching** and **affected-only** builds/tests (`nx affected`, `turbo run --filter`), remote caching, module boundaries, CODEOWNERS.

| | Polyrepo | Monorepo | Micro-frontends |
|---|---|---|---|
| Deploy independence | High | Per app | Per MFE (runtime) |
| Code sharing | Publish packages | Direct | Shared libs + runtime sharing |
| Cross-cutting change | Many PRs | One PR | Many deploys |
| Tooling needs | Low | Build caching | Highest |

You can combine them: micro-frontends **developed in a monorepo** and deployed independently.

:::question
difficulty: hard
### How do you design micro-frontends?
Start from the **why** (independent team delivery at scale) and confirm a modular monolith isn't enough. Split by business domain; use a thin shell for routing/auth/layout; choose composition (Module Federation for runtime SPA composition, route-level/edge composition for strong isolation, iframes only for untrusted/legacy). Define contracts (props, URL, custom events), share singletons (React, design system) with a version policy, isolate CSS, wrap each remote in error boundaries and suspense with fallbacks, give each MFE independent CI/CD with contract tests and rollback, set per-MFE performance budgets and observability. Call out the costs: duplication, version skew, testing complexity, UX consistency and platform overhead.
:::

:::question
difficulty: medium
### When would you NOT use micro-frontends?
Small or single-team apps; when the real problem is poor modularity (fix boundaries in a monolith first); when performance budgets are tight and duplication can't be governed; when teams can't invest in a platform/shell team; and when the domain doesn't split cleanly (lots of cross-cutting UI and shared state). A monorepo with enforced module boundaries usually delivers most of the benefits at a fraction of the cost.
:::

:::question
difficulty: medium
### How do micro-frontends communicate with each other?
Prefer loose coupling: the shell passes props/callbacks (auth user, navigation), the **URL** carries shared state (selected merchant, filters), and cross-MFE notifications use browser `CustomEvent`s or a small typed pub/sub provided by the shell. Shared server data is fetched by each MFE via the same API client and cache conventions. Avoid sharing a global store instance or importing another MFE's internals — that recreates tight coupling and breaks independent deploys.
:::

:::challenge
difficulty: hard
### Plan a migration from a monolith SPA to micro-frontends
A 6-year-old merchant dashboard (React 16, Redux god store, 400k LOC) is owned by 8 teams; releases are weekly and frequently blocked. Leadership asks for micro-frontends. Write your plan, including what you'd do *before* splitting.
@@@solution
**Phase 0 — Validate and prepare (1–2 quarters)**
- Measure the pain: lead time, blocked releases, build/test duration, ownership conflicts.
- Move to a **monorepo with Nx/Turborepo**; split the code into feature libraries with enforced boundaries and CODEOWNERS; introduce affected-only CI and remote caching. Often this alone fixes blocked releases.
- Upgrade React and router to versions you'll share as singletons; extract a **design system package** and an **API client package**.
- Break the Redux god store into feature slices; move server data to RTK Query/React Query.

**Phase 1 — Shell and first remote**
- Build a thin shell (auth bootstrap, layout, routing, error boundary, telemetry).
- Pick a low-risk, well-bounded domain (e.g. Settings) as the first Module Federation remote; ship it independently with its own pipeline, contract tests and rollback.

**Phase 2 — Strangler migration**
- Route by route, move domains to remotes; the monolith becomes "just another remote" until it's empty.
- Shared singletons: react, react-dom, router, design system; everything else bundled per remote.
- Cross-domain communication via URL, shell-provided context and custom events.

**Guardrails**: per-remote performance budgets, dependency version policy with automated checks, error boundaries + fallbacks per remote, RUM/Sentry tagged by remote and release, visual consistency via the design system and visual regression tests, and an integration environment running nightly E2E across remotes.

**Exit criteria**: each team deploys independently multiple times a week, with no increase in p75 LCP/INP.
:::

:::quiz
### What's the main motivation for micro-frontends?
- [ ] Smaller bundles
- [x] Independent development and deployment by autonomous teams
- [ ] Better SEO
- [ ] Using multiple frameworks for fun
@@@explain
They trade technical complexity for organisational scalability.
:::

:::quiz
### In Module Federation, why mark React as `singleton: true`?
- [ ] To make it load faster
- [x] So host and remotes use one React instance — multiple copies break hooks and context
- [ ] To tree-shake it
- [ ] To enable SSR
@@@explain
Hooks rely on a single React dispatcher; two Reacts cause "invalid hook call" errors.
:::
