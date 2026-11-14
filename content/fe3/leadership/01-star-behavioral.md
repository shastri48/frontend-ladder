---
title: Behavioural Rounds with STAR — Example Answers
summary: The STAR method done well, plus worked answers to the behavioural questions that appear again and again for senior frontend roles — deadlines, disagreements, production incidents, explaining metrics, legacy refactors and framework migrations.
minutes: 22
---

## Why behavioural rounds decide senior offers

Several stories in the reference doc end with "rejected in the hiring manager round" despite strong technical rounds (Intuit, CRED, Coinbase). At senior levels, the bar shifts from *can you build it* to *can we trust you to own outcomes, work through ambiguity, and make the people around you better*. Hiring managers probe this with behavioural questions, and they grade **evidence**, not opinions.

## The STAR method

| | What to say | Share of time |
|---|---|---|
| **S**ituation | Context in 2–3 sentences: product, team, stakes | ~10% |
| **T**ask | *Your* responsibility or goal, with the constraint | ~10% |
| **A**ction | What **you** did, step by step, and *why* — decisions, trade-offs, how you influenced others | ~60% |
| **R**esult | Measurable outcome + what you learned / changed afterwards | ~20% |

Rules that separate good answers from great ones:

- **"I", not "we"**, for actions. Interviewers need to know your contribution. Credit the team in the result.
- **Numbers**: "LCP from 4.2s to 2.1s", "shipped in 9 days instead of 3 weeks", "error rate from 2% to 0.1%".
- **Trade-offs**: what you didn't do and why. Seniority = judgement.
- **Reflection**: what you'd do differently. It signals self-awareness, not weakness.
- Keep each story to **2–3 minutes**; let them dig deeper with follow-ups.
- Prepare **6–8 stories** that can flex across questions: a delivery under pressure, a conflict, a failure/incident, a technical decision you drove, mentoring someone, an ambiguous project, a time you pushed back, a cross-team initiative.

:::callout tip Build a story bank
Write each story as bullet points (not a script) with: context, your role, 3–4 key actions, metrics, learning. Tag each with the questions it can answer. Rehearse out loud — timing matters.
:::

## Worked answers

These are illustrative — replace the details with your own experience, keeping the structure.

### "Tell me about a time you delivered a frontend feature under a tight deadline. How did you prioritise?" (Walmart)

**S** — Our payments team had to launch a new UPI checkout flow before a festival sale; a regulatory change moved the date up by two weeks, leaving 10 working days for ~4 weeks of planned work.

**T** — I was the frontend lead, responsible for shipping a flow that was reliable on day one; failure meant lost transactions during our highest-traffic week.

**A** —
- I split the scope with the PM into **must-have** (intent flow on Android, collect flow, status polling, error states) and **later** (QR on desktop, saved VPAs, animations). We wrote that list in the ticket so trade-offs were explicit.
- I front-loaded the riskiest part — the status-polling state machine and bank timeouts — and built it first with mocked APIs (MSW) so we weren't blocked by backend.
- I parallelised: I defined the component contracts and state machine, and two engineers built UI pieces against them.
- Daily 10-minute risk check with backend and QA; I put the feature behind a flag and agreed on a 5% → 50% → 100% rollout with success-rate dashboards as the gate.
- I cut a nice-to-have animation library that would have added 40KB to the bundle.

**R** — We launched two days before the sale at 5%, hit 100% the next day. Payment success rate for the new flow was 1.8 points higher than the old one, and there were zero P1 incidents during the sale. Two deferred items shipped the following sprint. Learning: making scope trade-offs **visible in writing** early prevented last-minute debates; I now do this for every deadline-driven project.

### "How do you handle a disagreement with a designer or backend developer?" (Walmart)

**S** — A designer proposed a custom dropdown with animated, nested menus for a settings page used by enterprise admins.

**T** — I believed it would hurt accessibility and performance and take a week, but I didn't want to just say no — the design intent (faster navigation) was valid.

**A** —
- I asked what problem they wanted to solve; it was "admins can't find settings quickly".
- I built a 2-hour prototype of both: their design and a searchable command-palette variant using our accessible design-system primitives, and tested both with a screen reader and keyboard.
- I shared a short comparison (a11y issues, effort, bundle impact) and proposed we test both with 5 internal admins.
- I explicitly said I'd commit fully to whichever won.

**R** — Users found settings 40% faster with the search variant; the designer championed it and added it to the design system. The relationship improved — they started involving engineering earlier in explorations. Learning: disagree with **data and prototypes**, focus on the shared goal, and separate the problem from the proposed solution.

*(Backend variant: negotiating an API shape — propose the contract from the UI's needs, show the extra round trips the alternative causes, agree on a BFF or GraphQL field, and document the contract in OpenAPI.)*

### "Describe a time your production build caused a major UI issue. What did you do?" (Walmart)

**S** — After a release, our dashboard showed a blank screen for ~8% of users — Safari 14 users, it turned out.

**T** — I was the release owner that week; my job was to mitigate fast, find the root cause and prevent recurrence.

**A** —
- **Mitigate first**: Sentry alerted on a spike of `SyntaxError`; I rolled back to the previous build within 12 minutes (immutable deploys made this one click) and posted updates in the incident channel.
- **Diagnose**: the error pointed to optional-chaining assignment syntax in a new dependency that our Babel config didn't transpile because `node_modules` was excluded and our browserslist had drifted.
- **Fix**: updated browserslist to match our support policy, transpiled that dependency, and added a CI step that runs the built bundle through `es-check` for our minimum ES target.
- **Prevent**: wrote a blameless post-mortem, added Safari to our Playwright smoke tests, and set up an error-rate gate on canary deploys.

**R** — No recurrence in the following year; canary gating caught two other issues before full rollout. Learning: **rollback first, debug second**, and every incident should leave behind an automated guard.

### "How do you explain performance metrics like TTI, FCP and CLS to non-technical stakeholders?" (Walmart)

Use analogies tied to user experience and business outcomes:

- **FCP / LCP** — "How long until the customer sees *something* / sees the *main thing* (the product photo). Like how long before a shop opens its doors vs. when you see the product you came for."
- **TTI / INP** — "How long until the page actually responds when you tap. A store that's open but the cashier ignores you for 3 seconds."
- **CLS** — "How much the page jumps while loading — when you go to tap 'Buy' and an ad pushes it down, so you tap the wrong thing."

Then connect to money: "Our LCP is 4.1s at the 75th percentile on mobile; Google considers above 2.5s 'poor', and our own data shows conversion drops ~7% for sessions over 4s. Fixing images and render-blocking scripts is about two sprints." Show a filmstrip/video comparison — visuals land better than numbers.

### "Tell me about refactoring legacy code."

**S** — A 6-year-old jQuery + Backbone admin panel where every change took days and caused regressions; no tests.

**T** — I proposed and led modernisation without stopping feature work.

**A** — I rejected a big-bang rewrite (high risk, months without value). Instead: added characterisation tests (Playwright) around the 10 most-used flows; mounted React islands inside Backbone views for new features (**strangler fig pattern**); built a shared adapter for the legacy event bus; migrated page by page by traffic and pain; tracked progress on a dashboard; removed jQuery plugins as their last usages disappeared.

**R** — Over 3 quarters, 80% of screens migrated, lead time for changes dropped from ~5 days to 1–2, regressions reported by support fell by more than half, and bundle size dropped 35%. Learning: incremental migration with tests as a safety net beats rewrites; measure and communicate progress to keep stakeholder buy-in.

### "Why migrate from Angular to React? What challenges did you face?"

Answer with **reasons tied to outcomes** (not "React is better"): AngularJS end-of-life and security risk, hiring pool, ecosystem/design-system alignment with other teams, performance or SSR needs. Challenges and how you handled them:
- **Coexistence**: ran both via route-level micro-frontends / web components during migration; shared auth and routing via a shell.
- **State and services**: Angular services + RxJS → React Query for server state, small stores for client state; wrapped some RxJS streams with hooks temporarily.
- **Dependency injection & two-way binding habits**: training sessions, code review guidelines, a migration playbook.
- **Testing**: kept E2E tests framework-agnostic so they validated both versions.
- **Bundle size** during coexistence (two frameworks loaded): migrated highest-traffic routes first and lazy-loaded the legacy app only when needed.
- **Result**: measurable — page load, developer velocity, bug counts.

### "Tell me about owning deliverables across multiple products" (Park+ style ownership)

Show how you **prioritise across stakeholders** (impact vs effort, aligning with PMs on a shared roadmap), **communicate proactively** (weekly status notes with risks), build **shared components** to avoid duplicate work, and **close the loop** (monitoring after launch, following up on bugs without being asked).

## Interview questions

:::question
difficulty: easy
### What's the most common mistake in STAR answers?
Spending most of the time on Situation and Task and describing what "we" did, leaving the Action vague and the Result unquantified. Interviewers can't assess *your* judgement. Flip it: brief context, detailed personal actions with reasoning and trade-offs, measurable results and a reflection.
:::

:::question
difficulty: medium
### How do you answer "Tell me about a failure"?
Pick a real failure with meaningful stakes (not a disguised strength), own your part without blaming others, explain what you did to recover, and spend real time on what you changed afterwards — a process, a check, a habit — ideally with evidence the change worked. Interviewers look for accountability and learning, not perfection.
:::

:::question
difficulty: medium
### How do you prioritise when everything is urgent?
Clarify the goal and the real deadline; list work and estimate impact vs effort/risk; separate must-haves from nice-to-haves *with* the PM in writing; do the riskiest unknowns first; parallelise via clear contracts; protect quality with flags and staged rollout; communicate trade-offs and risks early instead of silently cutting corners.
:::

## Practice

:::challenge
difficulty: medium
### Rewrite a weak answer using STAR
Weak answer to "Tell me about a challenging project": *"We had a really tough project last year with performance problems. The team worked hard and we used lazy loading and memoization and things got better. It was a great learning experience."* Rewrite it as a strong STAR answer.
@@@solution
**S** — Last year our analytics dashboard (used daily by ~3,000 sales managers) became unusable on laptops: applying a filter froze the UI for 3–4 seconds and support tickets about "the app hanging" tripled in a quarter.

**T** — As the senior frontend engineer on the team, I owned diagnosing the problem and getting filter interactions under 200ms without a rewrite, within one quarter.

**A** —
- I profiled with the Performance panel and React Profiler under CPU throttling and found three causes: a single context held filters *and* 20k rows, so every filter change re-rendered all 14 widgets; rows weren't virtualized (~60k DOM nodes); and each chart re-computed aggregates on the main thread.
- I split state: filters moved to the URL, server data into React Query keyed by filters, so each widget re-rendered only for its own query.
- I virtualized the table (DOM dropped to ~600 nodes) and moved aggregation into a Web Worker.
- I wrapped the table update in `useTransition` so typing in the filter stayed responsive.
- I added a performance budget test in CI (interaction trace with Playwright) so regressions would fail the build, and wrote a short guide for the team.

**R** — p75 filter INP dropped from ~3,400ms to ~150ms, memory use fell by 60%, and "app hangs" tickets went to near zero the next month. Two other teams reused the virtualized grid. With hindsight I'd have added RUM INP tracking earlier — we only noticed the problem through support tickets.

Why it's better: specific context and stakes, clear personal ownership, diagnosis before solutions, concrete actions with reasons, measurable results, team impact and a reflection.
:::

## Quick check

:::quiz
### In STAR, which part should take the most time?
- [ ] Situation
- [ ] Task
- [x] Action
- [ ] Result
@@@explain
Actions reveal your judgement and contribution; keep context brief and results crisp.
:::

:::quiz
### A production release breaks the UI for some users. What's the right first move?
- [ ] Start debugging the root cause in production
- [x] Mitigate impact (rollback/feature flag off) and communicate, then investigate
- [ ] Wait for more user reports to confirm
- [ ] Hotfix forward immediately without investigation
@@@explain
Restore service first; root-cause analysis comes after impact is contained.
:::
