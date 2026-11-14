---
title: CDNs and Pagination Patterns
summary: How a CDN works and what to cache at the edge, then offset vs cursor pagination — and why a moving feed needs cursors.
minutes: 11
---

## How a CDN works

A **Content Delivery Network** is a fleet of servers (**edges** / Points of Presence) spread across the world that cache and serve your content close to users.

```text
User in Mumbai ──► DNS (CNAME → cdn) ──► nearest edge (Mumbai)
                                           │ cache HIT  → respond in ~20 ms
                                           │ cache MISS → regional/shield cache → ORIGIN (us-east-1) → store → respond
```

1. **Routing**: DNS-based geo routing or **anycast** (the same IP announced from many locations; the network routes you to the nearest).
2. **Caching**: the edge obeys `Cache-Control` (`s-maxage` for shared caches), keyed by URL (+ `Vary` headers).
3. **Origin shield**: a mid-tier cache that collapses many edge misses into one origin request.
4. **Invalidation**: purge by URL/tag when content changes — or avoid purges entirely with hashed filenames.

What a CDN gives you: lower latency (shorter RTT for TCP/TLS too — TLS terminates at the edge), offloaded origin, resilience (serve stale if origin is down), DDoS protection, HTTP/3, compression (Brotli), and image optimization on the fly.

**Edge computing** (Cloudflare Workers, Vercel/Netlify Edge Functions, Lambda@Edge) runs code at the edge: redirects, A/B tests, auth checks, personalization, even SSR.

What to put on a CDN:

- Always: hashed static assets (JS, CSS, fonts, images, video).
- Often: HTML for static/SSG pages; SSR HTML with short `s-maxage` + `stale-while-revalidate`.
- Carefully: API responses that are public and identical for everyone.
- Never cache: personalized responses without `private` — or you'll serve user A's data to user B.

## Pagination: offset vs cursor

### Offset (page-number) pagination

```http
GET /api/posts?limit=20&offset=40      (page 3)
```
```sql
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 40;
```

- ✅ Simple; jump to any page; show "Page 3 of 50".
- ❌ **Slow for deep pages** — the database still scans and discards `offset` rows.
- ❌ **Unstable with changing data**: if 5 new posts are inserted while the user reads page 1, page 2 now starts 5 items earlier → the user sees **duplicates**. If items are deleted, they **skip** items.

### Cursor (keyset) pagination

```http
GET /api/posts?limit=20                          → { items, nextCursor: "eyJ0IjoxNjk…" }
GET /api/posts?limit=20&after=eyJ0IjoxNjk…
```
```sql
-- cursor encodes the last item's (created_at, id)
SELECT * FROM posts
WHERE (created_at, id) < ($lastCreatedAt, $lastId)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

- ✅ **Stable**: "give me 20 items older than this one" — insertions at the top don't shift anything.
- ✅ Fast at any depth (uses an index seek).
- ❌ No jumping to page 37; no total page count (usually); cursors are opaque.
- Use an **opaque** cursor (base64 of the sort key + tiebreaker id) so clients don't depend on internals.

| | Offset | Cursor |
|---|---|---|
| Jump to page N | ✅ | ❌ |
| Total pages | ✅ | Usually ❌ |
| Deep page performance | ❌ O(offset) | ✅ |
| Stable under inserts/deletes | ❌ duplicates/skips | ✅ |
| Best for | Admin tables, search results with page numbers | Infinite feeds, chat history, activity logs |

### A moving feed (Reddit/Twitter style)

Feeds get new items constantly → **cursor pagination** for scrolling down ("older than X"), and a separate "newer than first item" query to show a **"12 new posts"** pill at the top instead of shifting the list under the user's thumb.

GraphQL's **Relay connection spec** standardizes cursors: `edges { cursor node }`, `pageInfo { hasNextPage endCursor }`.

## Interview questions

:::question
difficulty: medium
companies: Reddit
### Cursor vs offset pagination for a moving feed?
Offset pagination counts positions, so new items inserted at the top shift every page — the user sees duplicates (or misses items on deletes), and deep offsets are slow because the DB must skip rows. Cursor pagination asks for "N items after this specific item" using an indexed sort key (+ id tiebreaker), so it's stable and fast regardless of depth. For a constantly changing feed use cursors; show new items via a "new posts" indicator rather than shifting the list. Offset is fine for static, page-numbered tables.
:::

:::question
difficulty: easy
companies: Razorpay
### How does a CDN work?
DNS/anycast routes users to the nearest edge server. If the edge has a fresh cached copy (per `Cache-Control`/`s-maxage`), it serves it immediately; otherwise it fetches from the origin (often via a shield cache), stores it and responds. This cuts latency, offloads the origin, adds resilience and DDoS protection, and terminates TLS close to users. Cache invalidation is via TTLs, purges, or content-hashed URLs.
:::

:::question
difficulty: medium
### How would you scale a website's frontend delivery?
Serve all static assets from a CDN with hashed names and immutable caching; pre-render/SSG what you can and cache HTML at the edge with short TTL + stale-while-revalidate; code-split to keep bundles small; compress (Brotli) and optimize images (responsive, AVIF/WebP, lazy-load); use HTTP/2–3; make the origin stateless and horizontally scalable behind a load balancer; cache API responses where safe; and monitor real-user metrics per region.
:::

## Challenges

:::challenge
difficulty: medium
### Paginate with a cursor
Implement `paginate(items, limit, cursor)` over an array sorted by `id` ascending. It returns `{ items, nextCursor }`, where `nextCursor` is the last returned item's id (or `null` when there are no more items). `cursor` is `undefined` for the first page and means "items with id greater than cursor".
@@@starter
```js
function paginate(items, limit, cursor) {
  // your code
}
```
@@@tests
```js
const data = [1, 2, 3, 4, 5].map((id) => ({ id }))
test('first page', () => {
  expect(paginate(data, 2)).toEqual({ items: [{ id: 1 }, { id: 2 }], nextCursor: 2 })
})
test('next page uses cursor', () => {
  expect(paginate(data, 2, 2)).toEqual({ items: [{ id: 3 }, { id: 4 }], nextCursor: 4 })
})
test('last page has null cursor', () => {
  expect(paginate(data, 2, 4)).toEqual({ items: [{ id: 5 }], nextCursor: null })
})
test('stable when an item is inserted at the start', () => {
  const grown = [{ id: 0 }, ...data]
  expect(paginate(grown, 2, 2).items).toEqual([{ id: 3 }, { id: 4 }])
})
```
@@@solution
```js
function paginate(items, limit, cursor) {
  const start = cursor === undefined ? 0 : items.findIndex((it) => it.id > cursor)
  if (start === -1) return { items: [], nextCursor: null }
  const page = items.slice(start, start + limit)
  const hasMore = start + limit < items.length
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null }
}
```
With a real database the `findIndex` becomes an indexed `WHERE id > $cursor ORDER BY id LIMIT $limit + 1` (fetch one extra row to know if there's a next page). The last test shows why cursors are stable: inserting `id: 0` doesn't change what comes after `2`.
:::

## Quick check

:::quiz
### A user reads page 1 of an offset-paginated feed; 3 new posts are published; they load page 2. What happens?
- [ ] They miss 3 posts
- [x] They see 3 posts again (duplicates)
- [ ] Nothing changes
- [ ] The request fails
@@@explain
Everything shifted down by 3, so the first 3 items of page 2 are the last 3 they already saw.
:::

:::quiz
### Which Cache-Control directive targets CDNs specifically?
- [ ] max-age
- [x] s-maxage
- [ ] private
- [ ] immutable
@@@explain
s-maxage applies only to shared caches and overrides max-age there.
:::
