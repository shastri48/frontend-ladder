---
title: Choosing Frameworks and Leading Migrations
summary: React vs Vue vs Angular (and Svelte/Solid) as an architecture decision, how to write the decision down, and how to migrate Angular (or any legacy stack) to React without stopping delivery.
minutes: 18
---

## Framework choice is a business decision

"Compare the pros and cons of React vs Vue vs Angular for a new project" and "Why migrate from Angular to React? What challenges did you face?" are not trivia questions. Interviewers want to see that you evaluate **team, product, ecosystem and risk**, not personal taste.

:::callout analogy Choosing a vehicle
A truck, an SUV and a sports car are all "good cars". The right one depends on what you carry, who drives, the roads and the maintenance budget. Frameworks are the same.
:::

## The big three (plus challengers)

| | React | Vue | Angular |
|---|---|---|---|
| What it is | UI **library**; you assemble routing, data, forms | Progressive **framework**; official router (Vue Router) and store (Pinia) | Full **platform**: router, forms, HTTP, DI, i18n, testing, CLI |
| Rendering model | Virtual DOM + reconciliation; concurrent rendering; Server Components | Virtual DOM with compiler-optimised templates + fine-grained reactivity (refs/proxies); Vapor mode (no VDOM) emerging | Change detection (zone.js historically) → **Signals** + zoneless in modern versions |
| Language | JS/TS + JSX | Templates (SFC) or JSX, TS supported | TypeScript first, decorators, templates |
| State | useState/useReducer + ecosystem (Redux, Zustand, React Query) | `ref`/`reactive`, Pinia | Services + RxJS, Signals, NgRx |
| Learning curve | Small core, large ecosystem decisions | Gentlest | Steepest (DI, RxJS, modules/standalone) |
| Meta-frameworks | Next.js, Remix/React Router, Expo for mobile | Nuxt | Angular SSR (built in) |
| Strengths | Largest ecosystem & hiring pool, React Native, RSC, flexibility | Approachable, great docs, cohesive official tooling | Consistency at enterprise scale, batteries included, opinionated structure |
| Weaknesses | Decision fatigue, many ways to do things, re-render pitfalls | Smaller enterprise ecosystem in some regions | Verbosity, bundle size historically, upgrade discipline |

Challengers: **Svelte** (compiler, no VDOM, tiny output, runes), **SolidJS** (fine-grained signals, React-like JSX, top performance), **Qwik** (resumability, near-zero hydration). Their ideas — **signals** and compile-time optimisation — are influencing all the big three.

### How to decide

1. **Team & hiring**: what do people know; who can you hire in your market?
2. **Product needs**: SEO/SSR (meta-framework maturity), mobile code sharing (React Native), offline, realtime, heavy forms.
3. **Ecosystem**: design-system libraries, charts, maps, auth SDKs, testing tools.
4. **Org scale & governance**: Angular's conventions help large, rotating teams; React needs internal conventions (ADRs, templates).
5. **Performance budget**: target devices; hydration cost; bundle size.
6. **Longevity & risk**: backing, release cadence, upgrade story, community health.
7. **Existing investment**: shared libraries, micro-frontend constraints.

Write it as an **ADR (Architecture Decision Record)**: context, options considered, decision, consequences. Future engineers will understand *why*.

```markdown
# ADR-012: Frontend framework for the merchant dashboard
Status: Accepted · Date: 2025-03-04
Context: 6 squads, existing React Native app, SSR needed for public pages, design system in React.
Options: React + Next.js, Vue + Nuxt, Angular.
Decision: React + Next.js (App Router).
Consequences: share components/tokens with RN; must define state/data conventions (React Query, Zustand);
invest in internal templates and lint rules to prevent fragmentation.
```

## Why companies migrate from Angular(JS) to React

Common real reasons:
- **AngularJS (1.x) end of life** (Jan 2022) — security and hiring risk; Angular 2+ was effectively a rewrite anyway.
- **Hiring pool** and ecosystem breadth in React.
- **Unifying stacks** with React Native or an existing React design system.
- **Performance/bundle** concerns in older Angular versions, or SSR/RSC needs (Next.js).
- **Developer experience** and incremental adoption flexibility.

Bad reasons: hype, "React is faster" without measurement, or one engineer's preference. Modern Angular (standalone components, signals, zoneless) is a strong framework — a migration must pay for itself.

## How to migrate without stopping the business

Big-bang rewrites usually fail: the old app keeps changing, the new app chases a moving target, and value arrives only at the end. Use the **strangler fig pattern**:

```text
            ┌──────────────── Shell / router (decides who renders a route) ────────────────┐
  /reports  │  Angular (legacy)                                                            │
  /orders   │  React (migrated)  ← new routes and rewritten routes go here                 │
  /settings │  Angular → migrating next                                                    │
            └───────────────────────────────────────────────────────────────────────────────┘
```

**Integration options**
1. **Route-level split**: a reverse proxy/edge or a shell (single-spa, Module Federation) sends some routes to React, others to Angular. Cleanest boundaries.
2. **Component-level embedding**: mount React components inside Angular views (a wrapper directive calling `createRoot(el).render(...)`), or expose React components as **Web Components** consumed by Angular. Useful for shared widgets during transition.
3. **Shared design tokens** (CSS variables) so both look identical while coexisting.

```ts
// Angular wrapper that hosts a React component
@Component({ selector: 'react-order-table', template: '<div #host></div>', standalone: true })
export class ReactOrderTableComponent implements OnChanges, OnDestroy, AfterViewInit {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>
  @Input() orders: Order[] = []
  @Output() select = new EventEmitter<string>()
  private root?: Root
  ngAfterViewInit() { this.root = createRoot(this.host.nativeElement); this.render() }
  ngOnChanges() { this.render() }
  ngOnDestroy() { this.root?.unmount() }                    // avoid leaks
  private render() { this.root?.render(<OrderTable orders={this.orders} onSelect={id => this.select.emit(id)} />) }
}
```

**Plan**
1. **Inventory & prioritise** routes by business value, change frequency and complexity. Migrate frequently changed, high-value areas first; leave stable, rarely touched screens for last (or never).
2. **Foundations**: React app skeleton, design system parity, API client and auth shared (cookie/session works for both; or a shared auth module), routing shell, telemetry.
3. **Freeze new features in Angular**: every new feature is built in React.
4. **Migrate route by route** with feature flags and A/B comparison of metrics.
5. **Shared state across frameworks**: keep the server as the source of truth (both apps fetch via the same API client), use the URL and browser events for cross-app communication; avoid sharing in-memory stores.
6. **Testing**: E2E tests (Playwright) written against user behaviour — they survive the migration and prove parity.
7. **Remove** Angular once the last route moves; track bundle size since running two frameworks costs bytes during the transition.

**Challenges you should be ready to discuss**
- Two frameworks in one page: bundle size, duplicated design components, CSS conflicts.
- **Mental-model shift**: two-way binding and DI/services/RxJS → one-way data flow, hooks and explicit state; RxJS streams → React Query/hooks.
- Routing/auth/session coordination between apps.
- Feature parity bugs (validation rules, edge cases hidden in old code).
- Team upskilling and keeping morale while maintaining legacy.
- Stakeholder communication: showing incremental value (faster delivery, better vitals) each quarter.

:::question
difficulty: medium
companies: Microsoft
### Compare React, Vue and Angular for a new web app.
React is a flexible UI library with the largest ecosystem and hiring pool, React Native for mobile, and modern capabilities like concurrent rendering and Server Components via Next.js — but you must choose and standardise routing, data and state libraries. Vue is a progressive framework with an approachable template syntax, fine-grained reactivity and cohesive official tooling (Vue Router, Pinia, Nuxt) — fast to learn and productive, with a somewhat smaller enterprise ecosystem in some markets. Angular is a complete TypeScript platform (DI, router, forms, HTTP, testing, CLI) with strong conventions that suit large enterprise teams; it has a steeper learning curve and more ceremony, though signals and standalone components modernised it. I'd decide based on team skills and hiring, product needs (SSR, mobile, ecosystem), org scale and governance, performance constraints and long-term support, and record the decision in an ADR.
:::

:::question
difficulty: medium
### Why migrate from Angular to React? What challenges come up?
Legitimate drivers: AngularJS end of life, hiring/ecosystem advantages, unifying with React Native or a React design system, needing a specific meta-framework capability, or measurable performance/DX issues. Challenges: running both frameworks during a strangler migration (bundle size, duplicated components, CSS conflicts), coordinating routing/auth/session, translating patterns (DI, RxJS, two-way binding → hooks, one-way data, React Query), parity bugs hidden in legacy code, team upskilling, and keeping product delivery going. Mitigate with route-by-route migration, shared tokens and API client, E2E tests as a parity safety net, feature flags and clear milestones.
:::

:::question
difficulty: easy
### What is an Architecture Decision Record (ADR)?
A short, versioned document (usually Markdown in the repo) capturing one significant decision: context, options considered, the decision, and its consequences, plus status/date. ADRs explain *why* the system looks the way it does, reduce re-litigation of old debates, and onboard new engineers faster.
:::

:::challenge
difficulty: hard
### Your CTO asks: "Should we rewrite our AngularJS app in React?"
The app: 5 years old, AngularJS 1.7, 120 screens, revenue-critical checkout inside, 12 frontend engineers, hiring for AngularJS is hard, and a React Native app exists with its own component library. Prepare your recommendation.
@@@solution
**Recommendation: yes to moving off AngularJS, no to a big-bang rewrite — an incremental strangler migration to React over ~4 quarters.**

**Why move**: AngularJS is end-of-life (no security patches), hiring is hard, and React aligns with the existing React Native app and component library (shared tokens, logic packages, one hiring profile). Modern Angular was considered, but it is itself a rewrite from AngularJS and wouldn't give the RN synergy.

**Why not big-bang**: 120 screens including checkout; a rewrite freezes features for a year and risks parity regressions in revenue paths.

**Plan**
- Q1: Foundations — React app + shared design tokens/components with RN, API client, auth via shared cookie session, routing shell that can serve AngularJS and React routes; Playwright E2E for top journeys (parity safety net); RUM baseline.
- Q1 onwards: all **new** features in React.
- Q2–Q3: migrate high-change, high-value screens first (dashboard, orders); checkout migrated behind a feature flag with a 1% → 100% rollout and conversion monitoring.
- Q4: long tail, then remove AngularJS and its bundle.

**Risks & mitigations**: two runtimes on some pages (keep migrations route-level, watch bundle budgets); parity bugs (E2E + flags + metrics); team skills (pairing, internal training, React champions); delivery slowdown (allocate ~30% capacity, show quarterly wins: faster feature lead time, better LCP/INP).

**Success metrics**: % routes on React, lead time per feature, vitals, error rates, hiring funnel, and zero checkout conversion drop during rollout.
:::

:::quiz
### What is the strangler fig pattern?
- [ ] Rewriting the whole app before launching
- [x] Incrementally replacing parts of a legacy system while both run side by side until the old one can be removed
- [ ] Wrapping an app in an iframe
- [ ] A React performance optimisation
@@@explain
New functionality grows around the old system and gradually replaces it.
:::

:::quiz
### Which statement about modern Angular is accurate?
- [ ] It's the same as AngularJS 1.x
- [x] It's a full TypeScript platform that now offers signals and standalone components
- [ ] It has no router
- [ ] It doesn't support SSR
@@@explain
Angular 2+ is a different framework from AngularJS and has modernised significantly.
:::
