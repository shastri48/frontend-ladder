---
title: Nested Comments Like Reddit
summary: Modelling threaded comments (tree vs normalized), recursive rendering, replying, editing, deleting, voting, collapsing threads and performance for big discussions.
minutes: 18
---

## The problem

"Build a Reddit-like comments feature in React" (Impact Analytics) and "High-level design for Reddit comments" (a senior React interview) are two sides of one problem: **arbitrarily deep, mutable trees in UI state**.

Features usually requested:

- Show comments with nested replies (indented, with thread lines).
- Reply to any comment; edit and delete your own.
- Upvote/downvote with a score; sort by top/new.
- Collapse/expand a thread.
- "Load more replies" for deep or long threads.

## Data model: nested vs normalized

**Nested** (as many APIs return it):

```js
[{ id: 'c1', text: 'Great post', children: [{ id: 'c2', text: 'Agreed', children: [] }] }]
```

Easy to render recursively, but **updating** a deep comment means walking the tree and cloning the whole path.

**Normalized** (how you should store it in state):

```js
{
  byId: {
    c1: { id: 'c1', parentId: null, text: 'Great post', author: 'ada', score: 12, childIds: ['c2'], createdAt: … },
    c2: { id: 'c2', parentId: 'c1', text: 'Agreed', author: 'bob', score: 3, childIds: [], createdAt: … },
  },
  rootIds: ['c1'],
}
```

- O(1) lookup and update of any comment.
- Each `<Comment id>` can subscribe to just its own record → with `memo`, voting on one comment re-renders only that comment.
- Same idea as Redux's `createEntityAdapter` or a GraphQL normalized cache.

The API can still send/receive nested JSON; normalize once on load.

:::challenge
difficulty: hard
companies: Impact Analytics
### Build nested comments
Implement a comments section with: recursive rendering, reply at any depth, edit, delete (soft delete — keep "[deleted]" if it has replies, otherwise remove), up/down votes, collapse thread with reply count, and sort siblings by score. Use a normalized `useReducer` state.
@@@solution
```jsx
import { createContext, memo, useContext, useReducer, useState } from 'react'

// ---------- state ----------
let seq = 100
const now = () => Date.now()

function normalize(list, parentId = null, state = { byId: {}, rootIds: [] }) {
  for (const c of list) {
    state.byId[c.id] = { ...c, parentId, childIds: (c.children ?? []).map((x) => x.id), deleted: false }
    delete state.byId[c.id].children
    if (parentId === null) state.rootIds.push(c.id)
    normalize(c.children ?? [], c.id, state)
  }
  return state
}

function reducer(state, action) {
  switch (action.type) {
    case 'add': {
      const id = `c${++seq}`
      const comment = { id, parentId: action.parentId, text: action.text, author: 'you', score: 1, childIds: [], deleted: false, createdAt: now() }
      const byId = { ...state.byId, [id]: comment }
      if (action.parentId) {
        const parent = byId[action.parentId]
        byId[action.parentId] = { ...parent, childIds: [id, ...parent.childIds] }
        return { ...state, byId }
      }
      return { byId, rootIds: [id, ...state.rootIds] }
    }
    case 'edit':
      return { ...state, byId: { ...state.byId, [action.id]: { ...state.byId[action.id], text: action.text } } }
    case 'vote': {
      const c = state.byId[action.id]
      const prev = c.myVote ?? 0
      const next = prev === action.dir ? 0 : action.dir          // clicking again removes the vote
      return { ...state, byId: { ...state.byId, [action.id]: { ...c, myVote: next, score: c.score - prev + next } } }
    }
    case 'delete': {
      const c = state.byId[action.id]
      if (c.childIds.length) {
        // soft delete keeps the thread structure
        return { ...state, byId: { ...state.byId, [action.id]: { ...c, deleted: true, text: '[deleted]' } } }
      }
      const byId = { ...state.byId }
      delete byId[action.id]
      if (c.parentId) {
        const p = byId[c.parentId]
        byId[c.parentId] = { ...p, childIds: p.childIds.filter((x) => x !== action.id) }
        return { ...state, byId }
      }
      return { byId, rootIds: state.rootIds.filter((x) => x !== action.id) }
    }
    default:
      return state
  }
}

const CommentsCtx = createContext(null)
const useComments = () => useContext(CommentsCtx)

function countDescendants(byId, id) {
  return byId[id].childIds.reduce((n, cid) => n + 1 + countDescendants(byId, cid), 0)
}
const sortByScore = (byId, ids) => [...ids].sort((a, b) => byId[b].score - byId[a].score)

// ---------- components ----------
export function CommentsSection({ initial }) {
  const [state, dispatch] = useReducer(reducer, initial, normalize)
  return (
    <CommentsCtx.Provider value={{ state, dispatch }}>
      <section aria-label="Comments">
        <ReplyForm onSubmit={(text) => dispatch({ type: 'add', parentId: null, text })} placeholder="What are your thoughts?" />
        <CommentList ids={state.rootIds} depth={0} />
      </section>
    </CommentsCtx.Provider>
  )
}

function CommentList({ ids, depth }) {
  const { state } = useComments()
  return (
    <ul className="comments" style={{ marginLeft: depth ? 16 : 0 }}>
      {sortByScore(state.byId, ids).map((id) => <Comment key={id} id={id} depth={depth} />)}
    </ul>
  )
}

const Comment = memo(function Comment({ id, depth }) {
  const { state, dispatch } = useComments()
  const c = state.byId[id]
  const [collapsed, setCollapsed] = useState(false)
  const [mode, setMode] = useState(null)   // 'reply' | 'edit' | null
  if (!c) return null
  const replies = countDescendants(state.byId, id)

  return (
    <li className="comment">
      <div className="comment__meta">
        <button className="comment__collapse" onClick={() => setCollapsed((x) => !x)}
          aria-expanded={!collapsed} aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}>
          {collapsed ? '[+]' : '[–]'}
        </button>
        <strong>{c.deleted ? '[deleted]' : c.author}</strong> · {c.score} points
        {collapsed && replies > 0 && <span> ({replies} {replies === 1 ? 'reply' : 'replies'})</span>}
      </div>

      {!collapsed && (
        <>
          {mode === 'edit' ? (
            <ReplyForm initial={c.text} submitLabel="Save"
              onSubmit={(text) => { dispatch({ type: 'edit', id, text }); setMode(null) }}
              onCancel={() => setMode(null)} />
          ) : (
            <p className="comment__body">{c.text}</p>
          )}

          {!c.deleted && (
            <div className="comment__actions">
              <button aria-pressed={c.myVote === 1} aria-label="Upvote" onClick={() => dispatch({ type: 'vote', id, dir: 1 })}>▲</button>
              <button aria-pressed={c.myVote === -1} aria-label="Downvote" onClick={() => dispatch({ type: 'vote', id, dir: -1 })}>▼</button>
              <button onClick={() => setMode(mode === 'reply' ? null : 'reply')}>Reply</button>
              {c.author === 'you' && <button onClick={() => setMode('edit')}>Edit</button>}
              {c.author === 'you' && <button onClick={() => dispatch({ type: 'delete', id })}>Delete</button>}
            </div>
          )}

          {mode === 'reply' && (
            <ReplyForm autoFocus submitLabel="Reply"
              onSubmit={(text) => { dispatch({ type: 'add', parentId: id, text }); setMode(null) }}
              onCancel={() => setMode(null)} />
          )}

          {c.childIds.length > 0 && <CommentList ids={c.childIds} depth={depth + 1} />}
        </>
      )}
    </li>
  )
})

function ReplyForm({ onSubmit, onCancel, initial = '', submitLabel = 'Comment', placeholder, autoFocus }) {
  const [text, setText] = useState(initial)
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSubmit(text.trim()); setText('') } }}>
      <textarea aria-label={submitLabel} value={text} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)} rows={3} />
      <div>
        <button type="submit" disabled={!text.trim()}>{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
```

Sample data:
```js
const data = [
  { id: 'c1', author: 'ada', text: 'React 19 actions are great', score: 10, createdAt: 1, children: [
    { id: 'c2', author: 'bob', text: 'Agreed!', score: 4, createdAt: 2, children: [
      { id: 'c3', author: 'cy', text: 'Same here', score: 1, createdAt: 3 },
    ]},
  ]},
  { id: 'c4', author: 'dee', text: 'Still prefer Redux', score: 2, createdAt: 4 },
]
// <CommentsSection initial={data} />
```

Walkthrough points:
- **Normalized reducer**: every action is O(1) on `byId` (except counting descendants for the collapsed label).
- **Recursion** through `CommentList` ↔ `Comment`; `depth` drives indentation (cap visual indent at ~8 levels and show "Continue this thread →" beyond, like Reddit).
- **Soft delete** keeps orphaned replies meaningful.
- **Optimistic voting**: update score immediately; in a real app send the API call and roll back on failure.
- Local UI state (collapsed, reply box open) lives in each comment; shared data lives in the reducer.
- Note: since the whole `state` is in context, every comment re-renders on any change despite `memo`. For big threads, use a store with selectors (Zustand/Redux `useSelector(s => s.byId[id])`) so each comment subscribes only to its own record.
:::

## Frontend design: Reddit comments at scale

:::question
difficulty: hard
### Design the frontend for Reddit comments (thousands of comments, deep threads).
**Requirements**: view sorted threads (top/new/controversial), reply/edit/delete/vote, collapse, deep links to a single comment, real-time-ish updates, fast on mobile.

**API**: `GET /posts/:id/comments?sort=top&limit=200&depth=6` returns a partial tree plus "more" stubs (`{ kind: 'more', parentId, childIds: [...], count }`); `GET /comments/more?ids=…` expands them; `POST /comments` (reply), `PATCH`, `DELETE`, `POST /comments/:id/vote`. Cursor-based for top-level pagination.

**Client state**: normalized `byId` + `childIds` per comment + `rootIds`; a store with **per-comment selectors** so votes re-render one row. Server cache (React Query/Apollo) keyed by post + sort.

**Rendering**: recursive components with `memo`; initially render top N roots and limited depth; "load more replies" stubs; "Continue this thread" beyond depth ~8; **virtualize** the flattened visible tree (convert tree → array of visible rows with depth) for huge threads; lazy render collapsed subtrees (don't mount them).

**Interactions**: optimistic updates for votes/replies with rollback; debounce rapid vote toggles; client-side IDs for pending replies that are swapped for server IDs.

**Real-time**: SSE/WebSocket for new comments on hot posts — but don't shift content under the reader: show "3 new comments" and merge on click.

**Performance/UX**: skeletons; SSR the first screen for SEO; sanitize Markdown (XSS); collapse heavily downvoted comments by default; accessibility with headings/landmarks and keyboard navigation between comments.
:::

## Quick check

:::quiz
### Why normalize nested comments in client state?
- [ ] JSON can't represent trees
- [x] Updates become O(1) by id and only the changed comment's object changes
- [ ] React can't render recursive components
- [ ] It reduces API size
@@@explain
With a nested tree, updating a deep comment means cloning every ancestor along the path.
:::

:::quiz
### A comment with replies is deleted. Best UX?
- [ ] Remove it and all its replies
- [x] Soft delete: show "[deleted]" and keep the replies
- [ ] Block deletion
- [ ] Move replies to the root
@@@explain
Replies lose context if removed or re-parented; soft delete preserves the thread.
:::
