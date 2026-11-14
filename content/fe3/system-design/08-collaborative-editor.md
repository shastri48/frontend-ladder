---
title: Design Google Docs (Collaborative Editing)
summary: Real-time co-editing — document model, operations, Operational Transformation vs CRDTs, presence and cursors, offline editing, versioning, and the rendering/performance challenges of a rich-text editor.
minutes: 26
---

## The prompt

> "Design Google Docs: multiple users edit the same document at the same time and see each other's changes and cursors in real time."

It's the "boss fight" of frontend design (listed in the doc under messaging & real-time collaboration, and in the Meta/Google list). You're not expected to implement OT in 45 minutes; you are expected to explain **why concurrent editing is hard** and the standard solutions.

## Requirements

**Functional**: rich text (headings, bold, lists, links, images), multiple concurrent editors, live remote cursors/selections with names, comments, version history, sharing permissions (view/comment/edit), offline editing that syncs later.

**Non-functional**: local edits apply instantly (< 16ms), remote edits appear within ~100–500ms, **all replicas converge** to the same document, intent is preserved (my insertion lands where I meant it), no data loss, large documents (100+ pages) stay smooth.

## Why it's hard: the concurrency problem

Document `"ABC"`. Alice inserts `X` at index 1 → `"AXBC"`. At the same time Bob deletes index 2 (`C`) → `"AB"`. Each applies their own op locally, then receives the other's:

```text
Alice: "AXBC" + Bob's delete(2)  → deletes "B"  → "AXC"   ✗
Bob:   "AB"   + Alice's insert(1,'X')          → "AXB"   ✗
```

They **diverge**, and Alice wrongly deleted `B`. Positions in an operation are relative to the document state the author saw. We need a way to apply concurrent operations so that everyone **converges** and intent is preserved.

## Solution 1: Operational Transformation (OT)

Before applying a remote op, **transform** it against concurrent ops that were already applied locally, adjusting positions.

```js
// transform op a so it can apply after op b (both made against the same base state)
function transform(a, b) {
  if (a.type === 'insert' && b.type === 'insert') {
    if (b.pos < a.pos || (b.pos === a.pos && b.site < a.site)) return { ...a, pos: a.pos + b.text.length }
    return a
  }
  if (a.type === 'delete' && b.type === 'insert') {
    return b.pos <= a.pos ? { ...a, pos: a.pos + b.text.length } : a
  }
  if (a.type === 'insert' && b.type === 'delete') {
    return b.pos < a.pos ? { ...a, pos: a.pos - 1 } : a
  }
  // delete vs delete
  if (b.pos < a.pos) return { ...a, pos: a.pos - 1 }
  if (b.pos === a.pos) return null // already deleted
  return a
}
```

In the example, Bob's `delete(2)` transformed against Alice's `insert(1,'X')` becomes `delete(3)` → `"AXB"` on both sides. ✓

How Google Docs-style OT works in practice:
- A **central server** is the source of truth and defines a single global order of operations (each op gets a revision number).
- A client sends an op tagged with the revision it was based on; the server transforms it against any ops committed since, applies it, broadcasts it.
- Each client keeps at most **one op in flight** plus a buffer of local pending ops; incoming server ops are transformed against in-flight/buffered ops (the Jupiter / Google Wave algorithm).
- Pros: compact ops, proven at scale (Google Docs). Cons: transform functions get very complex for rich text (formatting ranges, tables), needs a central server, correctness is notoriously tricky.

## Solution 2: CRDTs (Conflict-free Replicated Data Types)

Instead of positions, give every character a **unique, stable identifier** and define ordering so that merging is **commutative, associative and idempotent** — replicas can apply operations in any order and still converge, with no central server needed.

```text
"ABC" as a sequence CRDT:
  A(id: 1@alice) → B(id: 2@alice) → C(id: 3@alice)
Alice inserts X "after 1@alice"  → X(id: 1@bob?) … no index involved
Bob deletes 3@alice              → tombstone, by id
Merge in any order → "AXB"
```

Insertions reference neighbours by id ("insert after A"), deletions mark ids as tombstones; ties are broken deterministically (e.g. by site id). Libraries: **Yjs**, **Automerge**. Used by Figma-like tools (Figma uses a server-authoritative CRDT-inspired model), Notion-style apps, local-first software.

| | OT | CRDT |
|---|---|---|
| Server | Needs central ordering server | Optional — peer-to-peer & offline-friendly |
| Metadata | Small ops | Per-character ids/tombstones (memory overhead; mitigated by compression, GC) |
| Complexity | Transform functions per op pair | Data structure design; easier to reason about convergence |
| Offline | Hard (long divergence → many transforms) | Natural |
| Examples | Google Docs, CKEditor 5 | Yjs, Automerge, Apple Notes-style sync |

A strong answer: "I'd use a proven CRDT library like Yjs with a WebSocket provider, persisting updates server-side; OT is the classic alternative used by Google Docs, with a central server ordering ops."

## Architecture

```text
┌──────────────────────────── Client ─────────────────────────────┐
│ Editor view (ProseMirror / Lexical / Slate)                     │
│   ⇅ binding                                                     │
│ Document model (CRDT doc or OT client state)                    │
│   ⇅ local ops / remote ops                                      │
│ Sync provider (WebSocket)    Awareness (cursors, presence)      │
│ IndexedDB persistence (offline edits, fast reload)              │
└─────────────────────────────────────────────────────────────────┘
          ⇅ ops / updates (binary, batched)
  Collaboration server (per-document room, sticky) ─ op log / snapshots (DB) ─ auth/permissions
```

- **Document model**: a tree (paragraphs → text runs with marks), not raw HTML. The editor framework maps it to `contenteditable` DOM.
- **Batching**: coalesce keystrokes into ops sent every ~50–100ms.
- **Snapshots + op log**: store periodic snapshots and the ops since, so loading a doc doesn't replay a year of history. Version history = named snapshots.
- **Awareness** (cursors, selections, user colours, "Ada is viewing") is ephemeral state — broadcast, not persisted. Remote cursor positions must be expressed relative to the document model (CRDT relative positions) so they move correctly as text changes.
- **Permissions** enforced on the server for every op (a viewer's ops are rejected).

## Rendering and performance

- `contenteditable` is hard: IME composition (Chinese/Japanese input), spellcheck, selection, mobile keyboards. Use a mature editor framework rather than building from scratch.
- Large docs: render paginated/virtualized pages (Google Docs moved to **canvas-based rendering** for consistent layout and performance), lazy-load images, avoid re-rendering the whole document per keystroke (the model diff touches only changed nodes).
- Remote updates applied in batches inside `requestAnimationFrame`.
- Undo/redo must be **local**: undo only *my* operations (selective undo), transformed against later remote ops.

## Offline

Edits apply to the local model and are persisted in IndexedDB; when the connection returns, the client syncs (CRDT: exchange state vectors and missing updates; OT: rebase pending ops onto server history). Show sync status ("Saving…", "All changes saved", "Offline — changes will sync").

## Interview questions

:::question
difficulty: hard
companies: Google, Meta
### Explain OT vs CRDT in an interview-friendly way.
Both solve concurrent edits converging. **OT** keeps operations position-based ("insert X at 5") and, when ops are concurrent, *transforms* one against the other to adjust positions; it typically relies on a central server to order operations — that's Google Docs' approach. **CRDTs** give every element a unique id and design merge rules that are commutative and idempotent, so replicas converge regardless of order — no central coordinator, great for offline/peer-to-peer, at the cost of extra metadata (ids, tombstones). In practice I'd use Yjs (CRDT) or a hosted service, and focus my design on sync transport, persistence, awareness and permissions.
:::

:::question
difficulty: medium
### How do you show other users' cursors correctly while text changes?
Cursors are ephemeral "awareness" state broadcast over the same real-time channel, throttled (~10–20 updates/s). Positions must be stored as **relative positions** anchored to document elements (CRDT item ids, or positions transformed through OT ops), not absolute indexes, so when someone inserts text above, the remote cursor shifts correctly. Render them as overlays (absolutely positioned carets + name labels) computed from the editor's coordinate mapping; expire them when a user disconnects.
:::

:::question
difficulty: medium
### Why should undo only undo your own changes in a collaborative editor?
If Ctrl+Z reverted the last operation globally, you could undo a collaborator's typing, which is surprising and destructive. Collaborative editors keep a per-user undo stack of the user's own operations and, when undoing, compute an inverse operation transformed against all later operations (OT) or use the CRDT's undo manager scoped to the local origin.
:::

## Practice

:::challenge
difficulty: hard
### Transform concurrent text operations so replicas converge
Two users start from `"HELLO"`. Alice performs `insert(5, "!")`. Concurrently Bob performs `delete(0)` (removes `H`) and then `insert(0, "J")`. Show the transformed operations each side must apply and the final converged text.
@@@solution
**Local results first**
- Alice: `"HELLO!"`.
- Bob: `delete(0)` → `"ELLO"`, `insert(0,'J')` → `"JELLO"`.

**Alice receives Bob's ops** (they were made against `"HELLO"`, concurrent with her `insert(5,'!')`):
- `delete(0)` vs Alice's `insert(5)`: the insert is after the delete position → unchanged → `delete(0)`: `"ELLO!"`.
- `insert(0,'J')` (made after Bob's delete) vs Alice's insert, whose position must first be shifted by Bob's delete (5 → 4): 0 < 4 → unchanged → `"JELLO!"`.

**Bob receives Alice's op** `insert(5,'!')`, transformed against his `delete(0)` → position 4, then against his `insert(0,'J')` → position 5: `"JELLO"` → insert at 5 → `"JELLO!"`.

**Converged:** both have `"JELLO!"` and Alice's "!" is still at the end, as she intended. The key mechanic: every op is transformed against all concurrent ops in the *same order* on every replica (the server's order in OT), adjusting indexes for inserts/deletes that happened "before" it.
:::

## Quick check

:::quiz
### What property lets CRDT replicas converge without a central server?
- [ ] Operations are always sent in order
- [x] Merges are commutative, associative and idempotent
- [ ] Every client uses the same clock
- [ ] Each document has one editor at a time
@@@explain
Applying the same set of updates in any order (even twice) yields the same state.
:::

:::quiz
### Which state is ephemeral and shouldn't be persisted in the document history?
- [ ] Paragraph text
- [ ] Comments
- [x] Remote cursor positions and presence
- [ ] Version snapshots
@@@explain
Awareness state is broadcast live and dropped when users disconnect.
:::
