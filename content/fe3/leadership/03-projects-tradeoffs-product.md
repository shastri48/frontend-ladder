---
title: Talking About Projects, Trade-offs and Product Sense
summary: Ace project deep dives and craft-demonstration rounds (Intuit style) — present your work, defend decisions, extend code live, discuss what you'd refactor — and show product sense when collaborating with design, PM, backend and QA.
minutes: 20
---

## The rounds this prepares you for

- **Project deep dive** — "Walk me through a project you're proud of." Then follow-ups that "keep pushing until you find the real bottleneck" (Sprinklr), "explain the why behind your decisions" (Housing.com), "past projects and the trade-offs you made" (Razorpay HM round).
- **Craft demonstration** (Intuit SDE-2): you build an app from a rough spec the day before (e.g. Meeting Rooms with React + GraphQL), then review your own code with the interviewer, extend it live, explain structure, state, persistence and testing, defend trade-offs, and say what you'd refactor with one more day.
- **Product/behavioural hybrids** — "Expected a product sense round, but it turned into a deep dive into my past projects" (reference doc). Be ready for both.

## Structuring a project deep dive

Use a **zoom-in** structure: start at 10,000 feet, then let the interviewer choose where to dive.

1. **One-line pitch**: "A merchant dashboard used by 50k businesses to track payments and refunds."
2. **Why it mattered**: the user problem and business impact.
3. **Your role**: scope you owned, team size, timeline.
4. **Architecture sketch**: rendering strategy, main modules, data flow, key integrations (draw it).
5. **The hardest problem** you solved — with depth: options considered, decision, trade-offs, results.
6. **Outcome** with numbers.
7. **Retrospective**: what you'd change.

:::callout interview Know your numbers and your "why"
Be ready for: users/traffic, bundle size, Core Web Vitals before/after, error rates, test coverage approach, deployment frequency — and for every major choice, "why X over Y?" If you don't know a number, say how you'd measure it rather than guessing.
:::

### Talking about trade-offs

A trade-off answer has four parts: **the options, the criteria, the choice, the cost you accepted.**

> "For state we had Redux everywhere. I proposed React Query for server state (options: keep Redux + thunks, RTK Query, React Query). Criteria: caching/invalidation built in, less boilerplate, team familiarity, bundle size. We chose React Query because most of our Redux code was hand-rolled fetching and caching. The cost: two patterns coexisting during migration and some learning curve — we mitigated with a guide and lint rules banning new thunks."

Common trade-off axes in frontend: SSR vs CSR (TTFB/SEO vs server cost/complexity), monolith vs micro-frontends (simplicity vs team autonomy), build vs buy (control vs time), abstraction vs duplication (premature generalisation risk), consistency vs availability for live data, performance vs developer experience, polish vs time-to-market.

### Handling "keep pushing" follow-ups

Interviewers deliberately escalate: "What if traffic grows 100×?", "What if the API takes 5s?", "Where's the bottleneck now?" Strategies:

- Think out loud and **reason from first principles** (where is time spent? what resource saturates first?).
- Distinguish **frontend** limits (main thread, bundle, DOM size, memory) from **backend** ones (DB queries, fan-out, cache hit rate).
- It's fine to say "I didn't work on that part; here's how I'd approach it."

## Craft-demonstration rounds

You have a day to build something small but production-quality. What gets graded:

**Before the interview**
- **Clarify scope** in a README: assumptions, what's done, what's intentionally left out.
- **Structure** the code by feature: `features/rooms/{components, hooks, api, types}`; shared UI separate.
- **Types**: TypeScript with types for API responses (generated from the GraphQL schema if possible).
- **State**: server state via Apollo/React Query (GraphQL: Apollo's normalised cache), local UI state in components, filters in the URL.
- **States**: loading, empty, error, success for every data view; optimistic updates where natural (booking a room).
- **Accessibility**: semantic HTML, labelled forms, keyboard support.
- **Tests**: a few meaningful component tests (RTL) and a test for the trickiest logic (e.g. time-slot overlap); explain your testing strategy even if coverage is partial.
- **Commits**: small, well-named — they show your process.

**During the interview**
- Give a 3-minute tour: run it, show the structure, point out one decision you're proud of and one you'd change.
- **Extending live** (e.g. "add a capacity filter" or "add a field to bookings"): narrate. Start from the data (schema/type) → API/query → state → UI → test. Keep it small and working; ask clarifying questions.
- **Refactor with one more day**: have an honest list ready — extract a reusable component, add pagination, improve error handling, add E2E tests, accessibility audit, performance (memoisation of heavy lists), persistence.
- Accept critique gracefully: "Good point — I'd change that to …" beats defending a weak choice.

### Example: meeting rooms app data model (GraphQL)

```graphql
type Room { id: ID!, name: String!, capacity: Int!, floor: Int!, amenities: [String!]! }
type Booking { id: ID!, roomId: ID!, title: String!, start: DateTime!, end: DateTime!, organizer: User! }

type Query {
  rooms(filter: RoomFilter): [Room!]!
  availability(roomId: ID!, date: Date!): [Booking!]!
}
type Mutation { bookRoom(input: BookRoomInput!): BookRoomPayload! }
```

The core logic interviewers like to see tested — **interval overlap**:

```js
// two bookings [s1, e1) and [s2, e2) overlap if each starts before the other ends
const overlaps = (s1, e1, s2, e2) => s1 < e2 && s2 < e1
```

## Product sense for frontend engineers

Product sense = understanding **who** the user is, **what** they're trying to do, and **how to measure** success — then making engineering decisions that serve that.

- Ask about the **user and the goal** before the solution. "Who books meeting rooms — everyone, or office admins? On phones walking between rooms?"
- Think in **states and edge cases**: first-time use (empty state), errors, slow networks, permissions, very long names, many items, i18n.
- Propose **metrics**: task success rate, time to complete, conversion, error rate, Web Vitals, support tickets.
- Suggest **small experiments**: feature flags, A/B tests, prototypes with 5 users.
- Balance **polish vs speed**: ship the core, measure, iterate.

## Collaborating with design, PM, backend and QA

| Partner | How you add value |
|---|---|
| **Design** | Involve early on feasibility; build with design tokens/system components; flag accessibility and responsive edge cases; prototype interactions; push back with data, not taste |
| **PM** | Clarify requirements and success metrics; estimate with risks; propose scope trade-offs; surface technical opportunities ("we can prefetch this for instant navigation") |
| **Backend** | Co-design API contracts from UI needs (pagination, error shapes, idempotency); agree on OpenAPI/GraphQL schema; mock with MSW to work in parallel |
| **QA** | Share test plans and risky areas; make features testable (stable `data-testid`/roles, feature flags); automate regression of critical flows |

## Interview questions

:::question
difficulty: medium
companies: Intuit
### In a craft demo, the interviewer asks what you'd refactor with one more day. How do you answer?
Have a prioritised, honest list tied to impact: e.g. (1) extract the booking form into a reusable, tested component; (2) handle concurrent booking conflicts from the server with a clear UI message; (3) add pagination/virtualization for large room lists; (4) improve error handling with retries and an error boundary; (5) add E2E tests for the booking flow; (6) accessibility audit with a screen reader. Explain *why* each matters and what you deliberately skipped under time constraints. This shows judgement and self-awareness.
:::

:::question
difficulty: medium
companies: Razorpay
### "Tell me about the trade-offs you made in a past project." What makes a strong answer?
Name the decision, the alternatives considered, the criteria (performance, team skill, time, risk, cost), the choice and the **cost you knowingly accepted**, plus how you mitigated it and whether it worked out. Bonus: what you'd decide differently today with new information. Avoid answers where there was no real downside — every real decision has one.
:::

:::question
difficulty: easy
### How do you handle a vague requirement from a PM?
Ask about the user problem and success metric, list assumptions and open questions in writing, propose a minimal first version with explicit scope, identify risks and dependencies (APIs, design), and agree on how you'll validate it (flag + metrics). Then iterate rather than waiting for a perfect spec.
:::

## Practice

:::challenge
difficulty: medium
companies: Intuit
### Extend live: add a "minimum capacity" filter to a rooms list
You have `rooms` (array of `{ id, name, capacity }`) rendered by a `RoomList` component and a `Filters` component with a "floor" select. The interviewer asks you to add a "minimum capacity" filter that persists in the URL. Describe your steps and write the key code.
@@@solution
**Steps (narrate them):** 1) Confirm behaviour: numeric input, empty = no filter, combine with floor filter (AND). 2) Store in the URL as `?minCapacity=6` so it's shareable. 3) Derive filtered rooms with `useMemo`. 4) Add the input with a label. 5) Add a test.

```jsx
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useRoomFilters() {
  const [params, setParams] = useSearchParams()
  const floor = params.get('floor') ?? ''
  const minCapacity = Number(params.get('minCapacity') ?? 0) || 0

  const update = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 0) next.delete(key)
    else next.set(key, String(value))
    setParams(next, { replace: true }) // typing shouldn't spam history entries
  }
  return { floor, minCapacity, update }
}

export function filterRooms(rooms, { floor, minCapacity }) {
  return rooms.filter(
    (r) => (floor === '' || String(r.floor) === floor) && r.capacity >= minCapacity,
  )
}

export function Filters({ floor, minCapacity, update }) {
  return (
    <fieldset>
      <legend>Filter rooms</legend>
      {/* existing floor select … */}
      <label htmlFor="min-capacity">Minimum capacity</label>
      <input
        id="min-capacity"
        type="number"
        min={0}
        inputMode="numeric"
        value={minCapacity || ''}
        onChange={(e) => update('minCapacity', Math.max(0, Number(e.target.value) || 0))}
      />
    </fieldset>
  )
}

export function RoomsPage({ rooms }) {
  const filters = useRoomFilters()
  const visible = useMemo(() => filterRooms(rooms, filters), [rooms, filters.floor, filters.minCapacity])
  return (
    <>
      <Filters {...filters} />
      <p aria-live="polite">{visible.length} rooms</p>
      <RoomList rooms={visible} />
    </>
  )
}
```

**Test** (pure function first — fast and clear):

```js
test('filters by floor and minimum capacity', () => {
  const rooms = [{ id: 1, floor: 1, capacity: 4 }, { id: 2, floor: 1, capacity: 8 }, { id: 3, floor: 2, capacity: 10 }]
  expect(filterRooms(rooms, { floor: '1', minCapacity: 6 }).map((r) => r.id)).toEqual([2])
  expect(filterRooms(rooms, { floor: '', minCapacity: 0 }).length).toBe(3)
})
```

**Talking points:** filtering logic extracted into a pure function (testable, reusable server-side later); URL state with `replace` to avoid history spam; accessible label and live result count; if rooms came from GraphQL with many rooms, push the filter to the query variables (`rooms(filter: { minCapacity })`) instead of filtering on the client.
:::

## Quick check

:::quiz
### What's the best opening for a project deep dive?
- [ ] Start with the hardest bug you fixed
- [x] A one-line pitch, why it mattered, and your role — then an architecture sketch
- [ ] List every technology used
- [ ] Explain the company's org chart
@@@explain
Zoom in from context to detail so the interviewer can choose where to dive.
:::

:::quiz
### In a trade-off answer, which part do candidates most often omit?
- [ ] The options
- [ ] The final choice
- [x] The cost they knowingly accepted and how they mitigated it
- [ ] The technology names
@@@explain
Acknowledging the downside shows real judgement.
:::
