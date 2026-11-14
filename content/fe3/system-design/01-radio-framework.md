---
title: The RADIO Framework for Frontend System Design
summary: A repeatable way to run a 45–60 minute frontend system design interview — Requirements, Architecture, Data model, Interface (API), Optimisations — with timings, checklists and what interviewers grade.
minutes: 18
---

## What a frontend system design round is (and isn't)

In a backend design round you draw load balancers and databases. In a **frontend** design round (Meta, Google, Airbnb, Uber, Tekion, Walmart, CRED, …) the "system" is the **client application**:

- How the UI is decomposed into components and who owns which state.
- How data flows from the server to the screen and back (API shape, pagination, real-time).
- How the app stays fast (rendering, network, caching), accessible, resilient and maintainable at scale.

You may touch backend pieces (CDN, WebSocket gateway), but the depth is expected on the client. Typical prompts: *design a news feed, autocomplete, Pinterest grid, chat app, Google Docs, an e-commerce site, a dashboard, a reusable Select component, Reddit comments.*

The biggest failure mode isn't lack of knowledge — it's **lack of structure**: jumping into component code, spending 25 minutes on one detail, and never discussing performance. RADIO fixes that.

:::visual radio-framework
:::

## R — Requirements (≈ 5–8 min)

Turn an ambiguous prompt into a scoped problem. Ask, then **write the answers down** where the interviewer can see them.

**Functional** — what can the user do?
- Core flows only (3–5). "View feed, create post, like, comment, infinite scroll." Explicitly park the rest: "DMs and stories are out of scope."

**Non-functional** — how well must it work?
- **Devices**: mobile web? desktop? both (responsive)? low-end Android on 3G?
- **Scale**: number of items (10 or 10 million?), update frequency, concurrent users.
- **Performance targets**: LCP < 2.5s, INP < 200ms, 60fps scrolling.
- **Offline / real-time** needs.
- **Accessibility, i18n (RTL?), SEO** (public pages → SSR).
- **Security / privacy** constraints.

:::callout tip Useful clarifying questions
"Who are the users and on what devices?" · "Is SEO important?" · "Do updates need to be real-time?" · "How large can lists get?" · "Should it work offline?" · "Do we build the component library or use an existing design system?"
:::

## A — Architecture (≈ 10 min)

Draw the high-level pieces and how data moves between them:

```text
┌──────────────────────────── Client ────────────────────────────┐
│  View layer (components)                                       │
│     ▲ props / selectors        │ user events                   │
│  Client store (UI state + normalised server cache)             │
│     ▲                          │ actions                       │
│  Data layer: API client (fetch, retries, dedupe) + WS client   │
└──────────▲───────────────────────────────┬─────────────────────┘
           │ HTTP/JSON, GraphQL, WS/SSE     │
     CDN (static assets, images) ─── API gateway / BFF ─── services
```

Then the **component tree** for the main screen with responsibilities:

```text
<FeedPage>
  <Composer/>            ← local form state, optimistic create
  <FeedList>             ← owns pagination cursor, virtualization
    <FeedItem>           ← memoised, reads post by id from store
      <MediaGrid/> <Reactions/> <CommentPreview/>
  <NewPostsToast/>       ← fed by real-time channel
```

Decide and justify: **rendering strategy** (CSR / SSR / SSG / streaming), **routing** (code-split per route), **state ownership** (server cache vs global UI state vs local state).

## D — Data model (≈ 5–8 min)

Two kinds of state — say this explicitly, interviewers love it:

| State | Examples | Where it lives |
|---|---|---|
| **Server state** (cached copy of backend data) | posts, users, comments | Normalised cache (React Query / RTK Query / Apollo / custom store) |
| **Client/UI state** | draft text, open modal, selected tab, scroll position | Component state, URL, small global store |

Define the entities with the fields the UI needs:

```ts
type Post = { id: string; authorId: string; text: string; media: Media[]; createdAt: string; likeCount: number; viewerHasLiked: boolean }
type User = { id: string; name: string; avatarUrl: string }
type FeedState = { postIds: string[]; cursor: string | null; hasMore: boolean; status: 'idle' | 'loading' | 'error' }
```

**Normalise** (`posts: { [id]: Post }`, lists hold ids) so that updating a post (a like) updates it everywhere it appears, and lists stay cheap to re-render.

## I — Interface / API (≈ 5–10 min)

Define the contracts between client and server **and** between key components.

```http
GET /feed?cursor=abc&limit=20
→ 200 { items: Post[], users: User[], nextCursor: "def" | null }

POST /posts { text, mediaIds, clientId }        → 201 Post
POST /posts/:id/like  (idempotent: PUT /posts/:id/like) → 204
WS   /realtime  ← { type: "post.created", post } | { type: "post.liked", postId, likeCount }
```

Discuss:
- **REST vs GraphQL** (over/under-fetching, one round trip per screen, caching complexity).
- **Pagination**: **cursor-based** for feeds that change while you scroll (offset pagination duplicates or skips items when new posts are inserted at the top); offset for jump-to-page tables.
- **Real-time**: polling vs long-polling vs **SSE** (server→client, simple, auto-reconnect) vs **WebSocket** (bi-directional).
- **Component APIs**: props of the reusable pieces (`<Autocomplete fetchSuggestions onSelect renderItem debounceMs />`).

## O — Optimisations & deep dives (≈ 15–20 min)

This is where seniority shows. Pick the 3–4 that matter **for this product** and go deep rather than listing everything:

- **Network**: caching (HTTP + client cache, stale-while-revalidate), request de-duplication, prefetching next page/route, batching, compression, HTTP/2, CDN for media, image formats/sizes (`srcset`, AVIF/WebP).
- **Rendering**: virtualization for long lists, code splitting, lazy loading below-the-fold, memoisation, avoiding layout shift (reserved aspect ratios), SSR/streaming for first paint.
- **Perceived performance**: skeletons, optimistic updates, instant navigation.
- **Resilience**: retries with backoff, offline queue, error boundaries per widget, graceful degradation.
- **Accessibility**: semantic roles, keyboard navigation, focus management, live regions for new content, reduced motion.
- **Security**: XSS (sanitise user HTML), CSRF, auth tokens in httpOnly cookies, CSP.
- **i18n**, **observability** (RUM: Web Vitals, error tracking), **testing strategy**.

## Running the clock

```text
00–07  Requirements (write them down, agree scope)
07–17  Architecture + component tree
17–25  Data model + API
25–45  Deep dives / optimisations (let the interviewer steer)
45–50  Wrap-up: trade-offs, what you'd do next, risks
```

:::callout interview What interviewers actually grade
1. **Structure** — did you drive the conversation?  2. **Trade-offs** — "I chose X over Y because…, the downside is…".  3. **Depth** in at least two areas.  4. **Product sense** — empty/loading/error states, edge cases.  5. **Communication** — checking in, adapting when hinted.
:::

## Interview questions

:::question
difficulty: medium
### Why is cursor-based pagination preferred for feeds?
With offset pagination (`?offset=20&limit=20`), if new items are inserted at the top between requests, every item shifts down: page 2 now repeats the last items of page 1 (duplicates), and deletions cause skipped items. A **cursor** (an opaque pointer to the last item seen, e.g. its `createdAt`+`id`) asks "give me 20 items after this one", which is stable under inserts/deletes. Cursors also map to efficient indexed queries (`WHERE created_at < ? ORDER BY created_at DESC LIMIT 20`) instead of `OFFSET 10000`, which scans and discards rows. Use offset when users need to jump to an arbitrary page number (admin tables, search results).
:::

:::question
difficulty: medium
### What's the difference between server state and client state, and why separate them?
**Server state** is a cached snapshot of data owned by the backend: it can go stale, be shared across users, needs fetching, caching, de-duplication, background refetch and invalidation. **Client state** is owned by the browser session: form drafts, UI toggles, selection. Mixing them (e.g. copying API data into Redux and hand-managing loading flags) leads to stale data and sync bugs. Use a server-cache library (React Query, RTK Query, Apollo, SWR) for server state and keep client state local or in a small store.
:::

:::question
difficulty: easy
### What should you do in the first five minutes of a design interview?
Clarify and **write down** functional requirements (core flows), non-functional requirements (devices, scale, performance, real-time, offline, a11y, SEO, i18n) and explicit out-of-scope items. Confirm with the interviewer before designing. This prevents designing the wrong thing and gives you a checklist to refer back to in the optimisations phase.
:::

## Practice

:::challenge
difficulty: medium
companies: Impact Analytics
### Design a reusable Select / Combobox component (component-level system design)
You're asked to design a `Select` for a design system used by 30 teams: single and multi-select, searchable, async options, virtualized for 10k options, fully accessible. Walk through RADIO for a *component* (requirements, API, internal architecture, state, a11y, performance, testing).
@@@solution
**Requirements**
- Single & multi-select, search/filter, async loading, grouping, disabled options, custom option rendering, clearable, creatable (optional).
- 10k+ options smooth; works with keyboard and screen readers; controlled & uncontrolled; forms integration; RTL; theming.

**API (props)**

```tsx
<Select<Option>
  options={opts}                     // or loadOptions={(query, signal) => Promise<Option[]>}
  value={value} onChange={setValue}  // controlled; defaultValue for uncontrolled
  multiple
  getOptionLabel={(o) => o.name}
  getOptionValue={(o) => o.id}
  isOptionDisabled={(o) => o.archived}
  renderOption={(o, state) => <UserRow user={o} active={state.active} />}
  placeholder="Assign to…"
  searchable debounceMs={250}
  virtualize={{ itemHeight: 36 }}
  aria-label="Assignee"
/>
```

Prefer **headless** core (`useSelect` hook returning state + prop getters) plus a styled default — teams with special UIs reuse behaviour, not markup.

**Architecture**
- `useSelect` state machine: `closed → open → (typing) → navigating → selecting`. State: `isOpen`, `inputValue`, `highlightedIndex`, `selected`, `asyncStatus`.
- Parts: `Trigger`/`Input`, `Listbox` (rendered in a portal to escape `overflow: hidden`, positioned with Floating UI — flip/shift on viewport edges), `Option`, `Tag` chips for multi.
- Async: debounce input, `AbortController` to cancel stale requests, latest-wins, cache results per query, loading/empty/error rows.

**Accessibility (WAI-ARIA combobox pattern)**
- Input `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant` pointing to the highlighted option id (focus stays in the input).
- Listbox `role="listbox"` (`aria-multiselectable` for multi), options `role="option"` + `aria-selected`.
- Keys: ↓/↑ move, Home/End, Enter select, Esc close (and restore focus), Backspace on empty input removes last chip, type-ahead. Live region announcing result counts.

**Performance**
- Virtualize the listbox (only ~10 rows mounted); stable option ids as keys; memoize filtered list; `useDeferredValue` for filtering huge lists so typing stays responsive.
- `aria-activedescendant` works with virtualization only if the highlighted option is rendered — scroll it into view when moving.

**Testing**: RTL tests driven by roles and keyboard (`user.keyboard('{ArrowDown}{Enter}')`), axe checks, visual regression in Storybook, perf test with 10k options.

**Trade-offs to mention**: native `<select>` is the most accessible and mobile-friendly — use it when you don't need search/custom rendering; headless vs styled; portal vs inline.
:::

## Quick check

:::quiz
### In RADIO, where do virtualization, caching and code splitting belong?
- [ ] Requirements
- [ ] Data model
- [ ] Interface
- [x] Optimisations
@@@explain
They are performance deep dives, discussed once the core design is agreed.
:::

:::quiz
### A news feed gets new posts at the top every few seconds. Which pagination should the API use?
- [ ] Offset/limit
- [x] Cursor-based
- [ ] Page numbers
- [ ] No pagination
@@@explain
Cursors are stable under inserts; offsets cause duplicates and skips.
:::
