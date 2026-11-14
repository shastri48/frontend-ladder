---
title: Mentoring and Raising Engineering Quality
summary: How senior and staff frontend engineers multiply their impact — effective code review, RFCs and ADRs, standards and tooling, mentoring juniors, and leading technical initiatives without formal authority.
minutes: 18
---

## From "great coder" to "force multiplier"

Job descriptions for senior/staff frontend roles (see the reference doc: *"proven track record of mentoring engineers, scaling teams, and improving engineering practices"*, *"ability to influence stakeholders"*) describe impact that goes beyond your own pull requests. Interviewers check for it with questions like:

- "How do you mentor junior engineers?"
- "How do you review code?"
- "Tell me about a technical decision you drove across teams."
- "How have you improved engineering quality on your team?"

The underlying idea: at senior levels, **your output = your work + the improved output of everyone you influence**.

## Code review that teaches

Good reviews optimise for **correctness, maintainability and learning**, not for winning.

**What to look at, in order of importance**
1. **Does it solve the right problem?** Read the ticket/PR description first. Is the approach sound?
2. **Correctness & edge cases**: loading/error/empty states, race conditions, cleanup in effects, accessibility, security (XSS via `dangerouslySetInnerHTML`, secrets in client code).
3. **Design**: component boundaries, state ownership, API contracts, reuse of design-system components.
4. **Tests**: do they test behaviour (by role/text) rather than implementation details?
5. **Performance**: unnecessary re-renders, bundle impact (new heavy dependency?), unvirtualized long lists.
6. **Readability**: naming, comments explaining *why*.
7. Style nits — ideally automated away by Prettier/ESLint, not humans.

**How to write comments**
- Label severity: `blocking:`, `suggestion:`, `nit:`, `question:` — authors know what must change.
- Explain *why* and link to docs: "This effect needs a cleanup — otherwise a slow response for the old `id` can overwrite the new one (race). See our data-fetching guide."
- Ask questions instead of commanding: "What happens if `items` is empty here?"
- Praise good things specifically — it reinforces patterns.
- Big disagreements → move to a call; record the outcome in the PR.
- Keep turnaround fast (same day); review small PRs; encourage stacked PRs for big changes.

## RFCs and ADRs

**RFC (Request for Comments)** — a proposal *before* building something significant: a new state management approach, migrating to Vite, introducing micro-frontends, a design-system change.

```markdown
# RFC: Move server state from Redux to React Query
## Context / problem      — what hurts today, with evidence (bug counts, boilerplate, stale data incidents)
## Goals / non-goals
## Proposal               — design, examples, migration plan
## Alternatives considered — RTK Query, SWR, status quo — with trade-offs
## Risks & mitigations
## Rollout plan & success metrics
## Open questions
```

**ADR (Architecture Decision Record)** — a short, immutable note *after* a decision: context, decision, consequences. Stored in the repo (`docs/adr/0007-use-react-query.md`). Future engineers learn **why** things are the way they are, which prevents re-litigating decisions and helps onboarding.

## Raising quality through systems, not heroics

Durable improvements are encoded in tooling and defaults:

| Problem | Systemic fix |
|---|---|
| Style debates in reviews | Prettier + ESLint in pre-commit and CI |
| Repeated a11y bugs | Accessible design-system primitives + `eslint-plugin-jsx-a11y` + axe in CI |
| Performance regressions | Bundle size and Lighthouse budgets in CI, RUM dashboards |
| Flaky releases | Preview deployments per PR, E2E smoke tests, canary + feature flags |
| Inconsistent API handling | Shared API client + generated types from OpenAPI |
| Knowledge silos | ADRs, Storybook docs, runbooks, pairing rotations |
| Slow onboarding | One-command setup, "good first issues", onboarding buddy, architecture tour doc |

## Mentoring

Effective mentoring is **intentional and tailored**:

- **Understand goals**: where does the mentee want to be in a year? Map gaps (e.g. "comfortable with async JS, not with system design").
- **Stretch assignments**: give ownership of a slightly-too-big task with a safety net (design review before coding, checkpoints).
- **Teach thinking, not answers**: ask "how would you debug this?" before showing; pair-program on hard problems with them driving.
- **Feedback**: timely, specific, behaviour-focused (SBI: Situation–Behaviour–Impact). Praise publicly, correct privately.
- **Visibility**: let them present their work in demos/design reviews; credit them.
- **Measure progress**: they lead a feature end-to-end, review others' code, write an RFC.

Example STAR story skeleton: *A junior engineer struggled with React effects and kept shipping race conditions → I paired on two bugs, wrote a short internal guide on data fetching with cleanup, set up a lint rule (`react-hooks/exhaustive-deps`) and moved the team to React Query → within two months they were reviewing others' effect code and gave a lunch-and-learn on it; related bugs dropped noticeably.*

## Influence without authority

Staff-level initiatives (adopting TypeScript strict mode, a design system, Web Vitals targets) need buy-in from people who don't report to you:

1. **Start with the problem and data** — incidents, metrics, developer survey results.
2. **Socialise early** with key people one-on-one before the big meeting.
3. **Make it easy**: codemods, templates, migration guides, office hours.
4. **Pilot** with one willing team, show results, then scale.
5. **Track and celebrate progress** publicly (dashboards, shout-outs).
6. **Disagree and commit** when the group decides otherwise — and document it.

## Interview questions

:::question
difficulty: medium
### How do you review a large pull request?
First ask whether it can be split; if not, read the description and design notes, then review top-down: overall approach and architecture before details. Check correctness on the riskiest parts (state, effects, async, security, a11y), run it locally or via a preview deployment, and verify tests cover behaviour. Prioritise comments with severity labels so the author knows what blocks merging; take big design disagreements offline. Turn repeated findings into lint rules, docs or shared components.
:::

:::question
difficulty: medium
### What's the difference between an RFC and an ADR?
An **RFC** is a proposal for discussion before a significant change — it explores the problem, options and trade-offs and gathers feedback. An **ADR** records a decision once it's made — context, the decision, and its consequences — kept in the repo as an immutable log (superseded by later ADRs rather than edited). RFCs drive alignment; ADRs preserve the reasoning for future engineers.
:::

:::question
difficulty: medium
### How have you improved engineering practices on your team?
Use a STAR story that shows a **systemic** change: identify a recurring problem with data (e.g. 30% of bugs were a11y or race conditions), propose a fix via RFC, implement tooling (lint rules, shared hooks, CI checks, design-system components), help the team adopt it (docs, pairing), and measure the outcome (bug rate down, review time down). Emphasise that the improvement keeps working without you.
:::

## Practice

:::challenge
difficulty: medium
### Write review comments for this snippet
A junior engineer submits this component. Write the review comments you'd leave (with severity labels and reasons).

```jsx
function UserProfile({ id }) {
  const [user, setUser] = useState()
  useEffect(() => {
    fetch('/api/users/' + id).then(r => r.json()).then(d => setUser(d))
  })
  return <div onClick={() => edit()} dangerouslySetInnerHTML={{ __html: user.bio }} />
}
```
@@@solution
- **blocking:** `useEffect` has no dependency array, so it runs after **every** render; `setUser` triggers a render → infinite fetch loop. Use `[id]`.
- **blocking:** Race condition / unmount safety — if `id` changes quickly, an older response can overwrite the newer one. Add an `AbortController` (or an `ignore` flag) and abort in the cleanup. Consider our shared `useQuery` hook instead of hand-rolled fetching.
- **blocking:** `user` is `undefined` on first render → `user.bio` throws. Render a loading state (and an error state — `fetch` doesn't reject on 404/500, so check `r.ok`).
- **blocking (security):** `dangerouslySetInnerHTML` with user-provided `bio` is an XSS vector. Render as text, or sanitise with DOMPurify if rich text is truly required (and it should be sanitised server-side too).
- **blocking (a11y):** clickable `<div>` isn't keyboard-accessible or announced as interactive. Use a `<button>` (or a link if it navigates). Also, `edit` isn't defined in this scope.
- **suggestion:** use a template literal or `encodeURIComponent(id)` when building the URL.
- **praise:** nice small, focused component — easy to test once data fetching moves to the hook.

Then offer to pair on the data-fetching pattern and link the team guide. Tone matters: specific, explained, and kind.
:::

## Quick check

:::quiz
### What's the most durable way to stop the same review comment recurring?
- [ ] Repeat it more firmly in every PR
- [x] Encode it in tooling or shared code (lint rule, CI check, design-system component, doc)
- [ ] Ask the lead to escalate
- [ ] Ignore it
@@@explain
Systems scale better than reminders; automate what can be automated.
:::

:::quiz
### An ADR should be…
- [ ] Edited whenever the decision changes
- [x] A short immutable record of a decision, its context and consequences, superseded by new ADRs when things change
- [ ] A full design document with implementation code
- [ ] Stored only in someone's notes
@@@explain
Immutability preserves history; superseding ADRs show how thinking evolved.
:::
