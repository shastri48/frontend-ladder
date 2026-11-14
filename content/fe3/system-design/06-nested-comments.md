---
title: Design Reddit-style Nested Comments
summary: Model a deep comment tree, choose between nested and flat (normalised) data, paginate replies ("load more", "continue thread"), collapse threads, vote optimistically and stream new replies.
minutes: 24
---

## The prompt

> "Design (and/or build) a Reddit-like nested comments section: users can reply to any comment, vote, collapse threads, and threads can be thousands of comments deep and wide."

Asked as HLD (Senior React round in the doc) and as machine coding (Impact Analytics: "Build a Reddit-like comments feature using React").

## Requirements

**Functional**: view threaded comments sorted (best/top/new), reply at any depth, edit/delete own comment, up/down vote, collapse/expand a thread, "load more replies", "continue this thread" beyond a max depth, permalink to a single comment.

**Non-functional**: posts can have 10k+ comments → never load all at once; fast first render of the top comments (SSR for SEO — comment pages are public and indexable); accessible tree navigation; real-time new replies (nice to have).

## Data model: nested vs flat

**Nested** (what the UI looks like):

```json
{ "id": "c1", "text": "…", "replies": [ { "id": "c2", "replies": [ … ] } ] }
```

Easy to render recursively, but updates are painful: to change a vote 6 levels deep you must walk and copy every ancestor immutably, and the same comment can't be addressed directly.

**Flat / normalised** (what the client should store):

```ts
type Comment = {
  id: string
  parentId: string | null   // null = top-level
  postId: string
  authorId: string
  body: string              // sanitised markdown → rendered safely
  score: number
  viewerVote: -1 | 0 | 1
  createdAt: string
  depth: number
  replyCount: number        // total direct replies on the server
  deleted: boolean          // keep placeholder "[deleted]" so children stay attached
}

type CommentsState = {
  byId: Record<string, Comment>
  childrenIds: Record<string /* parentId or 'root' */, string[]>
  cursors: Record<string, string | null> // per-parent pagination cursor
  collapsed: Record<string, boolean>
}
```

Updates are O(1) (`byId[id].score++`), each comment component selects only its own data, and new replies are appended to `childrenIds[parentId]`. Building the tree is just "render children of id X".

```js
function normalise(nested, parentId = null, out = { byId: {}, childrenIds: { root: [] } }) {
  for (const c of nested) {
    const { replies = [], ...rest } = c
    out.byId[c.id] = { ...rest, parentId }
    ;(out.childrenIds[parentId ?? 'root'] ??= []).push(c.id)
    normalise(replies, c.id, out)
  }
  return out
}
```

## API

```http
GET /posts/:postId/comments?sort=best&limit=50&depth=4
 → { comments: Comment[] (flat, depth-limited), more: [{ parentId, cursor, remaining }] }

GET /comments/:id/replies?cursor=…&limit=20       → "load more replies"
GET /comments/:id/thread?depth=4                  → "continue this thread" / permalink
POST /posts/:postId/comments { parentId, body, clientId } → Comment
PUT  /comments/:id/vote { value: -1 | 0 | 1 }     → { score }
```

The server returns a **depth- and breadth-limited** tree (e.g. top 50 top-level comments, max depth 4, max 5 replies per node) plus "more" markers. This is how Reddit keeps pages fast.

On the backend, comments are typically stored with `parent_id` and a **materialised path** (`/c1/c7/c42`) or closure table so a subtree can be fetched with one indexed query; scores are cached and sorted with "best" (Wilson score) ranking.

## Component tree

```text
<CommentsSection postId>
  <SortSelect/> <CommentComposer parentId={null}/>
  <CommentList parentId="root">
    <CommentNode id>            ← memo, selects byId[id]
      <Votes/> <Meta/> <Body/> <Actions reply/edit/delete/>
      {replying && <CommentComposer parentId={id}/>}
      {!collapsed && <CommentList parentId={id}/>}   ← recursion
      <LoadMoreReplies parentId={id}/>               ← if replyCount > loaded
```

Recursion is natural, but **cap visual depth**: beyond depth ~8, show "Continue this thread →" which navigates to the subtree permalink (deep indentation is unreadable on mobile).

## Deep dives

**Performance with thousands of comments**
- Load progressively (server limits + "load more"), collapse low-score threads by default.
- `memo` each `CommentNode`; select by id so a vote re-renders one comment, not the whole tree.
- For extremely long threads, virtualize a **flattened** visible list (pre-order traversal of non-collapsed nodes with depth for indentation) — virtualizing a recursive DOM is hard; flattening makes it a normal list.
- `content-visibility: auto` on top-level threads is a cheap middle ground.

**Optimistic interactions**
- Voting: update `score`/`viewerVote` immediately, send `PUT` with the final value (idempotent), roll back on error, serialise rapid clicks.
- Posting a reply: insert a temporary comment with `clientId` and "sending…" state; replace with the server comment; on failure keep the text and show Retry.

**Deleted comments**: keep a placeholder so children remain attached ("[deleted]").

**Real-time**: subscribe (SSE/WS) to the post; new replies to *collapsed or off-screen* threads increase a "N new replies" counter instead of being injected; replies to the user's own comment can be inserted directly.

**Security**: render markdown with a safe renderer + sanitiser (DOMPurify) — comments are user-generated HTML risk; rate-limit posting; spoiler/NSFW handling.

**Accessibility**: the WAI-ARIA `tree` pattern is an option but heavy; a common accessible approach is nested `<ul>/<li>` with each comment as an `<article>` labelled by author, collapse buttons with `aria-expanded` and `aria-controls`, and headings or landmarks so screen-reader users can jump between comments. Announce posting results in a live region.

## Interview questions

:::question
difficulty: medium
### Why store comments flat (normalised) rather than as a nested tree in the client?
Updates and lookups become O(1) by id, immutable updates don't need to copy every ancestor, each component can subscribe to just its comment (fewer re-renders), pagination per parent is easy (`childrenIds[parentId]` + cursor), and the same comment can be referenced from multiple places (permalinks, notifications). The tree is reconstructed at render time by following `childrenIds`.
:::

:::question
difficulty: medium
### How do you handle a thread with 5,000 replies?
Never render it all: the API returns a depth- and breadth-limited slice with "more" markers; the UI shows "Load N more replies" per parent (cursor-paginated) and "Continue this thread" beyond a max depth. Collapse low-ranked branches by default. If still large, flatten visible nodes into a list and virtualize. Memoise nodes and keep votes/replies as localised state updates.
:::

## Practice

:::challenge
difficulty: hard
companies: Impact Analytics
### Build nested comments in React (machine coding)
Build a comments section where users can add top-level comments, reply to any comment (unlimited depth), collapse/expand any thread, and delete a comment (its replies stay, shown under "[deleted]"). Use a normalised state shape and a reducer.
@@@solution
```jsx
import { memo, useReducer, useState } from 'react'

let nextId = 1
const initial = { byId: {}, childrenIds: { root: [] }, collapsed: {} }

function reducer(state, action) {
  switch (action.type) {
    case 'add': {
      const id = String(nextId++)
      const parentKey = action.parentId ?? 'root'
      return {
        ...state,
        byId: { ...state.byId, [id]: { id, parentId: action.parentId, text: action.text, deleted: false, createdAt: Date.now() } },
        childrenIds: { ...state.childrenIds, [parentKey]: [...(state.childrenIds[parentKey] ?? []), id] },
      }
    }
    case 'delete':
      return { ...state, byId: { ...state.byId, [action.id]: { ...state.byId[action.id], deleted: true, text: '' } } }
    case 'toggle':
      return { ...state, collapsed: { ...state.collapsed, [action.id]: !state.collapsed[action.id] } }
    default:
      return state
  }
}

function Composer({ onSubmit, autoFocus, onCancel, label = 'Add a comment' }) {
  const [text, setText] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        onSubmit(text.trim())
        setText('')
      }}
    >
      <label className="sr-only" htmlFor={label}>{label}</label>
      <textarea id={label} value={text} autoFocus={autoFocus} onChange={(e) => setText(e.target.value)} placeholder={label} />
      <button type="submit" disabled={!text.trim()}>Post</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
    </form>
  )
}

const CommentNode = memo(function CommentNode({ id, state, dispatch }) {
  const c = state.byId[id]
  const [replying, setReplying] = useState(false)
  const children = state.childrenIds[id] ?? []
  const collapsed = !!state.collapsed[id]

  return (
    <li>
      <article aria-label={`Comment ${id}`}>
        {children.length > 0 && (
          <button aria-expanded={!collapsed} onClick={() => dispatch({ type: 'toggle', id })}>
            {collapsed ? `[+] ${children.length} replies` : '[–]'}
          </button>
        )}
        <p>{c.deleted ? <em>[deleted]</em> : c.text}</p>
        {!c.deleted && (
          <div className="actions">
            <button onClick={() => setReplying((r) => !r)}>Reply</button>
            <button onClick={() => dispatch({ type: 'delete', id })}>Delete</button>
          </div>
        )}
        {replying && (
          <Composer
            label={`Reply to comment ${id}`}
            autoFocus
            onCancel={() => setReplying(false)}
            onSubmit={(text) => { dispatch({ type: 'add', parentId: id, text }); setReplying(false) }}
          />
        )}
      </article>
      {!collapsed && children.length > 0 && (
        <ul className="replies">
          {children.map((cid) => <CommentNode key={cid} id={cid} state={state} dispatch={dispatch} />)}
        </ul>
      )}
    </li>
  )
})

export default function Comments() {
  const [state, dispatch] = useReducer(reducer, initial)
  return (
    <section aria-label="Comments">
      <Composer onSubmit={(text) => dispatch({ type: 'add', parentId: null, text })} />
      <ul className="comments">
        {state.childrenIds.root.map((id) => <CommentNode key={id} id={id} state={state} dispatch={dispatch} />)}
      </ul>
    </section>
  )
}
```

```css
.comments, .replies { list-style: none; padding-left: 0; }
.replies { margin-left: 16px; padding-left: 12px; border-left: 2px solid #ddd; }
.actions button { background: none; border: 0; color: #555; cursor: pointer; }
```

**Walkthrough**
- Normalised state (`byId`, `childrenIds`, `collapsed`) managed by a reducer; adding a reply is O(1) and doesn't copy the tree.
- `CommentNode` renders itself and recursively its children; collapse hides the subtree but keeps state.
- Delete is a soft delete so replies keep their parent.
- Accessible: real buttons, `aria-expanded` on collapse toggles, labelled textareas, semantic lists/articles.

**Improvement to mention:** passing the whole `state` defeats `memo` (every node re-renders on any change). In production, use a store with per-id selectors (`useSelector(s => s.byId[id])`, Zustand, or context + `useSyncExternalStore`) so only affected nodes re-render. Also add votes, timestamps, max depth with "continue thread", and persistence/API calls with optimistic updates.
:::

## Quick check

:::quiz
### Why soft-delete a comment that has replies?
- [ ] To save database space
- [x] So its replies stay attached to the thread
- [ ] For SEO
- [ ] Because hard deletes are impossible
@@@explain
Removing the parent would orphan its subtree; a "[deleted]" placeholder keeps the structure.
:::

:::quiz
### What's the easiest way to virtualize a deep comment tree?
- [ ] Virtualize each nested list separately
- [x] Flatten visible (non-collapsed) nodes in pre-order with a depth value and virtualize that list
- [ ] Use CSS columns
- [ ] It can't be virtualized
@@@explain
A flattened list with indentation by depth turns the tree into a normal virtualizable list.
:::
