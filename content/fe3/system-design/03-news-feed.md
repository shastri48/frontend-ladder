---
title: Design a News Feed (Facebook / Twitter)
summary: A complete RADIO walkthrough — infinite scrolling feed with cursor pagination, normalised cache, optimistic likes, real-time new-post banners, virtualization, media performance and accessibility.
minutes: 28
---

## The prompt

> "Design the news feed for a social network like Facebook or Twitter (X). Users scroll an infinite list of posts, can like and comment, and create new posts."

This is the most common frontend system design question (Meta, Google, Walmart's "large data with real-time updates", "infinite scrolling at scale"). We'll go through RADIO.

## Requirements

**Functional (in scope)**
1. Show a personalised feed of posts (text, images, video, link previews).
2. Infinite scroll — load more as the user scrolls.
3. Like / unlike, view comment count, open comments.
4. Create a post (text + images).
5. See that new posts are available (without the list jumping).

**Out of scope**: ranking algorithm, stories, DMs, ads auction (but leave a slot for ads).

**Non-functional**
- Fast first load on mobile (LCP < 2.5s on 4G mid-range Android).
- Smooth 60fps scrolling after thousands of posts.
- Works on flaky networks; likes should feel instant.
- Accessible (screen readers, keyboard), i18n (RTL), dark mode.
- Feed page is behind login → SEO not required; individual post permalinks *are* public → SSR them.

## Architecture

```text
┌──────────────────────────────── Browser ─────────────────────────────────┐
│ <FeedPage>                                                               │
│   <Composer/>         <NewPostsBanner/>    <FeedList (virtualized)>      │
│                                              <FeedPost id/>  × N         │
│                                                <PostHeader/> <PostBody/> │
│                                                <MediaGrid/>  <ActionBar/>│
│ ─────────────────────────────────────────────────────────────────────── │
│ Normalised store: posts{}, users{}, feed{ ids[], cursor, hasMore }       │
│ Data layer: API client (dedupe, retry)   Realtime client (SSE/WS)        │
└──────────────────────────────────────────────────────────────────────────┘
          │ GET /feed   POST /posts   PUT/DELETE /posts/:id/like   SSE /stream
          ▼
     API gateway / BFF ──▶ feed service, post service, media service ── CDN (images/video)
```

**Rendering strategy**: the app shell can be static (CDN), the first page of the feed server-rendered or streamed for fast LCP, then client-side rendering for subsequent pages. A simpler acceptable answer: CSR shell + first-page data inlined in HTML to avoid an extra round trip.

**Component responsibilities**

| Component | Owns | Notes |
|---|---|---|
| `FeedList` | cursor, loading state, sentinel, virtualization | Single source of pagination truth |
| `FeedPost` | nothing — reads `post` by id from store | `memo`; re-renders only when its post changes |
| `ActionBar` | optimistic like handling | Dispatches like/unlike |
| `Composer` | draft text, attachments, upload progress | Persists draft to localStorage |
| `NewPostsBanner` | count of pending new posts | Clicking prepends them and scrolls to top |

## Data model

```ts
type User = { id: string; name: string; handle: string; avatarUrl: string }

type Post = {
  id: string
  authorId: string            // normalised: look up in users
  createdAt: string
  text: string
  media: { type: 'image' | 'video'; url: string; width: number; height: number; blurhash?: string }[]
  likeCount: number
  commentCount: number
  viewerHasLiked: boolean
}

type FeedState = {
  postIds: string[]           // order of the feed
  nextCursor: string | null
  hasMore: boolean
  status: 'idle' | 'loading' | 'error'
  pendingNewIds: string[]     // arrived via real-time, not yet shown
}
```

Why **normalise**? The same post can appear in the feed, a profile, and an open modal. Likes update `posts[id]` once and every view reflects it. Lists hold ids, so appending a page doesn't re-create existing objects (and memoised rows don't re-render).

`width`/`height` for media let us **reserve space** before images load → no layout shift (CLS).

## Interface (API)

```http
GET /feed?cursor=<opaque>&limit=10
200 {
  "posts": [Post], "users": [User],          // side-loaded, de-duplicated
  "nextCursor": "eyJ0IjoxNzAwfQ" | null
}

POST /posts           { clientId, text, mediaIds[] }  → 201 Post
PUT  /posts/:id/like  → 204    (idempotent: repeated PUT is harmless)
DELETE /posts/:id/like → 204
GET  /stream (SSE)    event: post.created  data: { postId, authorId }
                      event: post.stats    data: { postId, likeCount, commentCount }
```

Decisions to justify:
- **Cursor pagination** — new posts constantly arrive at the top; offset pagination would duplicate/skip items.
- **Side-loading users** avoids repeating author data on every post.
- **Idempotent like endpoints** (PUT/DELETE instead of a toggle POST) make retries safe and avoid "double toggle" races.
- **SSE** is enough: real-time is server → client only; it reconnects automatically. (WebSocket if we also had typing indicators/chat.)
- **GraphQL** would let each client request exactly the fields it needs — a valid alternative (Facebook uses Relay with fragments colocated in components).

## Deep dive 1: infinite scrolling

Use an `IntersectionObserver` on a **sentinel** element near the bottom — not a scroll listener (which fires constantly on the main thread and needs throttling).

```jsx
function useInfiniteScroll(onLoadMore, { enabled, rootMargin = '800px' }) {
  const sentinelRef = useRef(null)
  useEffect(() => {
    if (!enabled || !sentinelRef.current) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore() },
      { rootMargin }, // start loading ~1–2 screens before the end
    )
    io.observe(sentinelRef.current)
    return () => io.disconnect()
  }, [enabled, onLoadMore, rootMargin])
  return sentinelRef
}
```

Guard against duplicate requests: don't fetch while `status === 'loading'` or `!hasMore`; de-dupe by cursor. On error, show an inline "Couldn't load more · Retry" row instead of silently stopping.

## Deep dive 2: virtualization

After 500 posts the DOM has tens of thousands of nodes: memory grows, style/layout get slow, scrolling janks. **Virtualize**: render only posts in (and near) the viewport and use spacers for the rest.

:::visual virtual-list
:::

Feed posts have **variable heights** (text length, media). Approaches:
- Estimate heights, measure actual size after render (`ResizeObserver`), and correct positions (TanStack Virtual, react-virtuoso do this).
- Keep scroll position stable when content above the viewport changes size (anchor to the first visible item).
- Alternative for simpler needs: CSS `content-visibility: auto` + `contain-intrinsic-size` lets the browser skip rendering off-screen posts while keeping them in the DOM (find-in-page and accessibility still work).

Keep in mind **restoring scroll position** when the user opens a post and comes back: keep the feed state in the store (not unmounted component state) and save the scroll offset/anchor item id.

## Deep dive 3: optimistic likes

Likes must feel instant even on slow networks:

```js
async function toggleLike(postId) {
  const prev = store.posts[postId]
  const liked = !prev.viewerHasLiked
  // 1. optimistic update
  store.updatePost(postId, { viewerHasLiked: liked, likeCount: prev.likeCount + (liked ? 1 : -1) })
  try {
    await api[liked ? 'put' : 'delete'](`/posts/${postId}/like`)
  } catch (e) {
    // 2. rollback + tell the user
    store.updatePost(postId, { viewerHasLiked: prev.viewerHasLiked, likeCount: prev.likeCount })
    toast('Couldn’t like post. Try again.')
  }
}
```

Rapid double-tap? Serialise per post (ignore clicks while a request is pending, or coalesce to the final desired state) so out-of-order responses can't leave the server and UI disagreeing.

## Deep dive 4: real-time new posts without jumping

If you insert new posts at the top while the user is reading, the content they're looking at moves — terrible UX. Instead:
1. Real-time events add ids to `pendingNewIds`.
2. Show a "↑ 5 new posts" pill.
3. On click, prepend them and scroll to top (or if the user is already at the top, prepend directly).

For live **stats** (like counts), batch updates (e.g. apply at most once per second) and only for posts currently visible to avoid wasted renders.

## Deep dive 5: media performance

- Serve images from a CDN with resizing: `srcset`/`sizes` so a phone downloads a 400px image, not 2000px. Modern formats (AVIF/WebP).
- `loading="lazy"` for below-the-fold images; `fetchpriority="high"` for the first post's image (likely the LCP element).
- Placeholder with blurhash/dominant colour and fixed aspect ratio → no CLS.
- Videos: don't autoload; use a poster image; autoplay muted only when ≥50% visible (IntersectionObserver), pause when scrolled away.

## Deep dive 6: creating posts

- Upload images **directly to object storage** with pre-signed URLs, in parallel with a concurrency limit, showing progress; create the post with returned `mediaIds`.
- Optimistically insert the new post at the top with a "Posting…" state; replace with the server version (matched by `clientId`) on success.
- Persist the draft so an accidental refresh doesn't lose it.
- **Sanitise** on the server and render user text as text (never `innerHTML`) to prevent XSS; linkify safely.

## Accessibility

- Feed container with `role="feed"` and each post `role="article"` with `aria-labelledby` (author) and `aria-posinset`/`aria-setsize` (use `-1` for unknown size). The WAI-ARIA feed pattern supports Page Down/Up between articles.
- New posts banner is a button; announce "5 new posts" via a polite live region.
- Like button is a real `<button aria-pressed>` with an accessible label ("Like post by Ada").
- Respect `prefers-reduced-motion` for animations; all actions keyboard-reachable; visible focus.

## Edge cases checklist

Empty feed (new user → suggestions), end of feed, deleted post while viewing, blocked author, network offline (show cached feed + offline banner), very long text ("See more"), RTL text, slow images, duplicate posts across pages (de-dupe by id).

## Interview questions

:::question
difficulty: medium
companies: Walmart, Tekion
### How would you build infinite scrolling at scale?
- Cursor-based API, page size ~10–20.
- `IntersectionObserver` on a sentinel with a generous `rootMargin` to prefetch before the user reaches the end; guard against concurrent/duplicate fetches; inline retry on error.
- Normalised store so appending pages is cheap; memoised row components keyed by stable ids.
- **Virtualize** (variable heights with measurement) to keep the DOM small; keep scroll anchoring stable; restore position on back navigation.
- Lazy-load media with reserved space; cap in-memory pages (drop far-away pages' data and refetch if the user scrolls back) for very long sessions.
- Accessibility: feed role, focus management, a "Load more" button fallback.
:::

:::question
difficulty: medium
### Why use IntersectionObserver instead of a scroll event listener for infinite scroll?
Scroll events fire many times per frame on the main thread and, to know whether the sentinel is visible, you'd call `getBoundingClientRect()`, forcing layout — expensive and janky without throttling. `IntersectionObserver` is asynchronous and computed by the browser off the critical path; it only calls you when visibility crosses the threshold. It also supports `rootMargin` for prefetching and works with any scroll container.
:::

:::question
difficulty: medium
### How do you show real-time new posts without disrupting the reader?
Buffer incoming posts instead of inserting them: increment a "N new posts" pill. When the user clicks it (or is already at the top), prepend the buffered posts and scroll to top. Inserting content above the viewport otherwise shifts what they're reading (also counts as layout shift). For count updates (likes), batch them and apply only to visible posts.
:::

## Practice

:::challenge
difficulty: hard
companies: Meta
### Follow-up: the feed gets slow after an hour of scrolling. Diagnose and fix.
Users who keep the tab open and scroll for a long time report scrolling jank and the tab using 1.5GB of memory. What could be wrong and how would you fix it?
@@@solution
**Diagnose**
1. Performance panel: long tasks during scroll? Look at "Recalculate Style" and "Layout" cost — symptom of a huge DOM.
2. Memory panel: take heap snapshots a few minutes apart; compare. Look for growing counts of detached DOM nodes, `Post` objects, image bitmaps, event listeners.
3. React Profiler: are all rows re-rendering on each new page or each like update?

**Likely causes and fixes**
- **No virtualization** → thousands of posts in the DOM. Virtualize (variable heights) or `content-visibility: auto`.
- **Unbounded data in memory** → keep a window of pages in the store; evict far-away pages and refetch on demand.
- **Detached nodes / leaks**: IntersectionObservers per video not disconnected, timers per post, global listeners added in effects without cleanup, closures held by a global event bus. Fix cleanups; use one shared IntersectionObserver for all media.
- **Decoded images**: large images kept decoded. Use correctly sized images, lazy loading, and let virtualization unmount off-screen images.
- **Over-rendering**: a new page creates new arrays for every post or a context value changes on every update → memoise rows (`memo` + stable props), normalise state, select per-id.
- **Real-time stats** updating all posts each second → batch and restrict to visible posts.

**Verify**: re-record a long scroll session with CPU throttling, compare heap growth and frame rate, add production RUM for INP and long tasks.
:::

## Quick check

:::quiz
### Why include `width` and `height` for media in the post payload?
- [ ] To compress images
- [x] To reserve the correct space before the image loads, preventing layout shift
- [ ] For SEO
- [ ] To decide image format
@@@explain
Known dimensions/aspect ratio let the layout be computed up front, keeping CLS low.
:::

:::quiz
### Which like API design is safest to retry?
- [ ] POST /posts/:id/toggle-like
- [x] PUT /posts/:id/like and DELETE /posts/:id/like
- [ ] GET /posts/:id/like?toggle=true
- [ ] POST /likes with a random id
@@@explain
PUT/DELETE express the desired final state and are idempotent; repeating them doesn't flip the state.
:::
