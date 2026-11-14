---
title: CI/CD, Observability, Feature Flags and Cross-Browser Consistency
summary: Shipping safely (pipelines, previews, Vercel), monitoring production frontends (Sentry, SigNoz, RUM), feature flags, and ensuring consistent rendering across browsers and devices.
minutes: 20
---

## Shipping is part of engineering

Senior frontend engineers own the path to production: how code is verified, deployed, observed and rolled back. A good pipeline makes the safe thing the easy thing.

## A modern frontend CI/CD pipeline

```text
PR opened
  ├─ install (npm ci, cached) ─ lint ─ typecheck ─ unit tests (Vitest/Jest + RTL)
  ├─ build ─ bundle-size budget (size-limit) ─ a11y checks (axe)
  ├─ preview deployment (unique URL per PR) ─ E2E (Playwright) against preview
  ├─ visual regression (Chromatic/Playwright screenshots) ─ Lighthouse CI budgets
  └─ review + CODEOWNERS approval
merge to main
  ├─ build once, tag release, upload source maps to Sentry
  ├─ deploy to staging → smoke tests → production (atomic, immutable deploys)
  └─ progressive rollout via feature flags; monitor errors & vitals; instant rollback
```

### Vercel (and similar platforms: Netlify, Cloudflare Pages, Amplify)

- **Git-integrated**: every push gets a build; every PR gets a **preview URL** — designers and PMs review real deployments.
- **Atomic, immutable deployments**: each deploy has its own URL; "production" is an alias pointing at one. **Rollback = re-pointing the alias** (instant).
- **Edge network/CDN** for static assets, **serverless and edge functions** for APIs/SSR, ISR for Next.js.
- **Environment variables** per environment (Production / Preview / Development) stored as encrypted secrets.
- SPA routing needs a rewrite so deep links serve `index.html`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Version skew

After a deploy, users with an old tab still run old JS that may request **chunks that no longer exist** (`ChunkLoadError`) or call changed APIs. Mitigations: keep old assets available for a while (immutable hashed files on the CDN), catch chunk-load failures and reload once, make APIs backward compatible for a release, and show "a new version is available" prompts.

```js
window.addEventListener('vite:preloadError', () => window.location.reload())  // Vite
```

## Observability: knowing what users experience

Backend teams have logs and metrics for every request; frontends run on millions of uncontrolled devices. You need:

1. **Error monitoring** — Sentry (or Datadog, Bugsnag, SigNoz): captures exceptions with stack traces (source-mapped), breadcrumbs (clicks, navigations, requests before the error), release, user/session, browser/OS. Error boundaries report React render errors; `unhandledrejection` catches async ones.
2. **RUM (Real User Monitoring)** — Core Web Vitals and custom timings from real sessions (`web-vitals` → your backend, Sentry Performance, Datadog RUM, Vercel Speed Insights).
3. **Tracing** — propagate a trace header (`traceparent`) from frontend requests so a slow checkout can be followed through API gateway → services (OpenTelemetry; SigNoz is an open-source OTel-native APM for traces, metrics and logs).
4. **Session replay** (privacy-masked) to see what led to an error.
5. **Product analytics** to understand behaviour (separate from reliability metrics).
6. **Alerting & dashboards**: error rate by release, new issue alerts, p75 vitals, API failure rates; owners per feature.

```js
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,          // DSNs are designed to be public
  release: import.meta.env.VITE_RELEASE,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true })],
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) { return scrubPII(event) },   // never send card numbers, tokens, emails
})
```

Tagging errors with **feature/owner** (e.g. via `Sentry.setTag('feature', 'refunds')`) routes alerts to the right team — essential with many teams or micro-frontends.

## Feature flags

Flags decouple **deploy** (code is in production) from **release** (users see it).

Uses: trunk-based development with unfinished features hidden, **progressive rollouts** (1% → 10% → 50% → 100%) watching error rates and vitals, A/B experiments, kill switches for risky features, per-merchant/enterprise entitlements.

```jsx
function Checkout() {
  const newFlow = useFlag('checkout-v2')      // LaunchDarkly, Unleash, GrowthBook, Statsig, homegrown
  return newFlow ? <CheckoutV2 /> : <CheckoutV1 />
}
```

Good practice: evaluate flags server-side or bootstrap them with the HTML to avoid flicker; default to safe values when the flag service is down; give flags owners and expiry dates; delete flags after rollout (flag debt is real); lazy-load the new variant so users on the old path don't download it.

## Consistent rendering across browsers and devices

"What's your approach to ensure consistent rendering and layout across different browsers and devices?" (Walmart)

**Foundations**
- Define a **support matrix** (browsers/versions/devices) from analytics, encoded in `browserslist`.
- **Normalise defaults**: a modern CSS reset/normalize; `box-sizing: border-box` globally; set `line-height`, font smoothing, form control styles explicitly.
- **Autoprefixer** + modern CSS features guarded with `@supports`; transpile JS and polyfill APIs for the matrix.
- **Responsive by design**: mobile-first CSS, fluid layouts with Flexbox/Grid, relative units (`rem`, `%`, `clamp()`), container queries for components, `srcset` images, meta viewport, safe-area insets for notches (`env(safe-area-inset-*)`), `dvh` instead of `100vh` on mobile.
- **Fonts**: self-hosted with fallback metrics to keep layout identical while loading.
- **Progressive enhancement**: core flows work without advanced features.

**Verification**
- Real devices and cloud device farms (BrowserStack, Sauce Labs, LambdaTest).
- Playwright running E2E on Chromium, Firefox and WebKit.
- **Visual regression testing** (Chromatic, Percy, Playwright `toHaveScreenshot`) across viewports.
- Monitor errors and vitals by browser in RUM — Safari-only bugs show up there first.

**Common gotchas**: Safari's flexbox `gap` history and date input differences, iOS 100vh and input zoom (font-size < 16px zooms), `position: sticky` inside overflow containers, scrollbar widths on Windows, sub-pixel rounding, default form control styling, and `:has()`/container-query support in older versions.

:::question
difficulty: medium
companies: Walmart
### What's your approach to ensuring consistent rendering and layout across different browsers and devices?
Agree on a support matrix from real analytics and encode it in browserslist; use a CSS reset, border-box sizing and explicit typography; build mobile-first, fluid layouts with Flexbox/Grid, relative units, `clamp()`, container queries and responsive images; use Autoprefixer, `@supports` feature queries, transpilation and targeted polyfills; avoid device-specific traps (`100vh` on iOS → `dvh`, input zoom, safe areas). Verify with Playwright across Chromium/Firefox/WebKit, real-device clouds, and visual regression tests at multiple viewports, then monitor RUM errors/vitals segmented by browser to catch what testing missed.
:::

:::question
difficulty: medium
### Describe a frontend CI/CD pipeline you'd set up.
On every PR: cached install, lint, typecheck, unit/component tests, production build, bundle-size budget, accessibility checks, a preview deployment with E2E tests (Playwright) and visual regression, Lighthouse CI budgets, and CODEOWNERS review. On merge: build once, tag release, upload source maps, deploy to staging with smoke tests, promote to production atomically, roll out risky changes behind feature flags, monitor error rates/vitals per release, and roll back instantly by re-pointing to the previous immutable deployment.
:::

:::question
difficulty: medium
### How do you monitor a frontend application in production?
Error tracking (Sentry/Datadog/SigNoz) with source maps, releases, breadcrumbs and ownership tags; RUM for Core Web Vitals and custom metrics segmented by page, device and release; distributed tracing (OpenTelemetry) from browser requests to backend services; session replays with PII masking; API failure-rate dashboards; alerts on error spikes and vitals regressions routed to owning teams; and privacy controls (scrubbing PII, sampling).
:::

:::question
difficulty: medium
### What are feature flags and what are the risks?
Runtime switches that control which code paths users see, decoupling deployment from release. They enable trunk-based development, gradual rollouts, experiments and kill switches. Risks: flag debt (stale flags multiplying code paths), untested combinations, flicker if flags load after render, performance cost if both variants are bundled, and outages if the flag service is a hard dependency. Mitigate with owners/expiry dates, cleanup tickets, server-side or bootstrapped evaluation, safe defaults and lazy-loaded variants.
:::

:::challenge
difficulty: medium
companies: Walmart
### Your production build caused a major UI issue. Walk through your response.
A release went out at 6 pm; at 6:20 support reports that the "Pay" button is missing on Safari for some users. Describe your incident response and the follow-up.
@@@solution
**Mitigate first**
1. Acknowledge in the incident channel, assign an incident lead, set a status update cadence.
2. Check dashboards: Sentry errors by release/browser, RUM conversion and checkout funnel by browser. Confirm Safari-specific spike since the 6 pm release.
3. **Roll back** immediately (re-point the production alias to the previous immutable deployment, or kill-switch the feature flag). Restore service before root-causing.
4. Verify recovery in RUM/Sentry and with a Safari device; update stakeholders.

**Diagnose**
- Reproduce on WebKit/real Safari; inspect the error (e.g. a new CSS feature unsupported in Safari 15, a JS API like `structuredClone` missing, or a chunk failing to load).
- Find why tests missed it: no WebKit in E2E, no visual regression for checkout, browserslist mismatch.

**Fix forward**
- Patch with `@supports` fallback/polyfill, add a Playwright WebKit test and a visual snapshot for checkout, redeploy behind a flag with gradual rollout.

**Follow-up (blameless postmortem)**
- Timeline, impact (failed payments, revenue), root cause, what went well/poorly.
- Action items with owners: WebKit in CI, browserslist audit, canary rollouts with automated rollback on error-rate spike, alert on checkout conversion drop.
:::

:::quiz
### What makes rollback instant on platforms like Vercel?
- [ ] Rebuilding the previous commit quickly
- [x] Immutable deployments — production is an alias re-pointed to an earlier deployment
- [ ] Browser caching
- [ ] Feature flags only
@@@explain
No rebuild is needed: the previous deployment still exists and the alias just moves.
:::

:::quiz
### What is "version skew" in SPAs?
- [ ] Different React versions in node_modules
- [x] Users running an old JS build that requests chunks or APIs that changed after a new deploy
- [ ] CSS specificity conflicts
- [ ] Browser version differences
@@@explain
Keep old hashed assets available and handle chunk-load errors gracefully.
:::
