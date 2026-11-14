---
title: Design a Chat App (WhatsApp / Messenger)
summary: Real-time messaging on the web — WebSocket connection management, message lifecycle (sending → sent → delivered → read), ordering and de-duplication, offline outbox, bidirectional pagination, typing indicators and presence.
minutes: 26
---

## The prompt

> "Design the frontend of a chat application like WhatsApp Web or Facebook Messenger."

It's the canonical **real-time** design question (also "design a collaboration tool for team communication" / Slack).

## Requirements

**Functional**: conversation list (sorted by latest message, unread counts), open a conversation and see message history, send text/images, delivery & read receipts, typing indicator, online presence, receive messages in real time, works across multiple tabs/devices.

**Non-functional**: messages appear instantly for the sender (optimistic), arrive within ~100ms–1s for recipients, **no lost or duplicated messages**, correct ordering, works on flaky mobile networks and offline (queue and send later), handles conversations with 100k messages, accessible, end-to-end encryption awareness.

## Architecture

```text
┌──────────────────────────────── Browser tab ────────────────────────────────┐
│ <ChatApp>                                                                   │
│   <ConversationList/>      <ConversationView id>                            │
│                               <MessageList (virtualized, bottom-anchored)/> │
│                               <TypingIndicator/> <Composer/>                │
│ Store: conversations{}, messages{ [convId]: { ids[], byId{} } }, outbox[]   │
│ RealtimeClient (WebSocket): connect, heartbeat, reconnect, resume           │
│ Persistence: IndexedDB (history cache, outbox)                              │
└─────────────────────────────────────────────────────────────────────────────┘
          ▲  WebSocket (events)          │ REST (history pages, uploads)
   Gateway (sticky by connection) ─ pub/sub backplane (Redis/Kafka) ─ message service ─ DB
```

**Why WebSocket here** (vs SSE): traffic is bi-directional and frequent (messages, typing, receipts, presence). Use REST for **history** (cacheable, paginated) and **uploads** (pre-signed URLs to object storage).

## Data model

```ts
type Message = {
  id: string | null          // server id, null until acknowledged
  clientId: string           // generated on the client (uuid) — idempotency + de-dupe key
  conversationId: string
  senderId: string
  body: string
  attachments?: Attachment[]
  createdAt: string          // client time, for display while pending
  serverSeq?: number         // monotonic per conversation, assigned by server → ordering
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
}

type Conversation = {
  id: string; title: string; participantIds: string[]
  lastMessagePreview: string; lastActivityAt: string; unreadCount: number
  lastReadSeq: number        // my read cursor
}
```

**Ordering**: don't sort by client clocks (they're wrong). The server assigns a per-conversation **sequence number**; the UI orders by `serverSeq`, with pending messages appended at the end.

## Protocol (WebSocket events)

```text
client → server
  { type: "send", clientId, conversationId, body }
  { type: "typing", conversationId, isTyping }
  { type: "read", conversationId, upToSeq }
  { type: "resume", lastSeqByConversation: { c1: 1042, … } }

server → client
  { type: "ack", clientId, id, serverSeq, createdAt }       // my message persisted
  { type: "message", message }                              // new message from anyone
  { type: "receipt", conversationId, userId, deliveredUpToSeq?, readUpToSeq? }
  { type: "typing", conversationId, userId, isTyping }
  { type: "presence", userId, online, lastSeen }
```

## Deep dive 1: message lifecycle and optimistic sending

```text
user hits Enter
  └─ add {clientId, status:'pending'} to store + outbox (IndexedDB) → UI shows clock icon
       └─ socket.send({type:'send', clientId, …})
            ├─ ack {clientId, id, serverSeq}  → status 'sent' (✓), remove from outbox
            │     ├─ receipt delivered        → '✓✓'
            │     └─ receipt read             → blue '✓✓'
            └─ no ack within 10s / socket down → keep in outbox, retry on reconnect
                                                → after N failures: status 'failed' + Retry
```

The `clientId` makes retries **idempotent**: if the ack was lost and we resend, the server recognises the clientId and returns the original message instead of creating a duplicate. The client de-dupes incoming `message` events by `clientId` too (the sender's other tabs receive the same message).

## Deep dive 2: connection management

A WebSocket client is mostly about the unhappy paths:

```js
class RealtimeClient {
  connect() {
    this.ws = new WebSocket(url)
    this.ws.onopen = () => {
      this.attempt = 0
      this.send({ type: 'resume', lastSeqByConversation: store.lastSeqs() }) // fill the gap
      outbox.flush()
      this.startHeartbeat()
    }
    this.ws.onmessage = (e) => dispatch(JSON.parse(e.data))
    this.ws.onclose = () => { this.stopHeartbeat(); this.scheduleReconnect() }
  }
  scheduleReconnect() {
    const delay = Math.min(30_000, 500 * 2 ** this.attempt++) * Math.random() // backoff + jitter
    setTimeout(() => this.connect(), delay)
  }
}
window.addEventListener('online', () => client.connectNow())
document.addEventListener('visibilitychange', () => { if (!document.hidden) client.ensureConnected() })
```

- **Heartbeats** (ping every ~25s) detect dead connections that never fire `close` (NAT timeouts, sleeping laptops).
- **Resume**: after reconnecting, ask for everything after the last seen `serverSeq` per conversation so no message is lost during the gap.
- **Multiple tabs**: either each tab has its own socket (simple), or one tab owns the socket and shares via `BroadcastChannel` / `SharedWorker` (fewer connections, consistent state).
- **Auth**: send the token on connect (cookie or first message — avoid tokens in URLs because they get logged), handle token expiry by reconnecting with a fresh token.

## Deep dive 3: message list UX and performance

- **Bottom-anchored list**: newest at the bottom; opening a chat scrolls to the bottom (or to the first unread with a divider "Unread messages").
- **Bidirectional pagination**: scroll up loads older pages (`GET /conversations/:id/messages?beforeSeq=…`) — when prepending, **preserve scroll position** (measure `scrollHeight` before/after and adjust `scrollTop`, or use `overflow-anchor`). Jumping to a search result loads around it (`aroundSeq`) and pages both ways.
- **Auto-scroll** on new messages only if the user is already near the bottom; otherwise show "↓ 3 new messages".
- **Virtualize** long histories (variable heights, reverse direction — react-virtuoso supports this).
- Group consecutive messages from the same sender; date separators; lazy-load images with known dimensions.
- **Cache** recent conversations in IndexedDB for instant startup and offline reading.

## Deep dive 4: typing indicators, receipts, presence

- **Typing**: send `typing: true` on first keystroke, then throttle (at most every ~3s while typing), send `false` on idle (debounced 3–5s) or send. Receivers auto-expire the indicator after ~6s with no update (in case the stop event is lost).
- **Read receipts**: when messages become visible *and* the tab is focused (IntersectionObserver + `document.visibilityState`), send `read upToSeq` — batched, monotonic (never decrease). Unread counts derive from `lastReadSeq`.
- **Presence**: server tracks connections; clients get updates only for contacts on screen (subscriptions) to avoid fan-out storms.

## Security & privacy

Render message text as text (never HTML) and linkify safely; sanitise filenames; image uploads via pre-signed URLs with size/type limits; E2E encryption (Signal protocol) means the server can't read messages — keys stored in IndexedDB, search must be client-side. Rate-limit sending.

## Accessibility

Message list as `role="log"` with `aria-live="polite"` (new messages announced), each message labelled with sender and time; composer is a labelled textarea, Enter sends, Shift+Enter newline (documented); status icons have text alternatives ("Read").

## Interview questions

:::question
difficulty: hard
### How do you guarantee no duplicates and no lost messages?
**No duplicates**: every outgoing message has a client-generated `clientId`; the server enforces uniqueness (idempotency) so resends after lost acks don't create new messages; clients de-dupe incoming events by `clientId`/`id`.
**No loss**: messages are persisted to an outbox (IndexedDB) until acknowledged and retried after reconnects; the server assigns per-conversation sequence numbers; after any reconnect the client sends its last seen sequence per conversation and the server replays the gap. Gaps in received sequences also trigger a fetch of the missing range.
:::

:::question
difficulty: medium
### WebSocket vs SSE vs long polling for chat?
Chat is bi-directional and chatty (messages, typing, receipts), so **WebSocket** fits best: one persistent full-duplex connection, minimal overhead per message. SSE is server→client only (you'd send via POST), simpler and auto-reconnecting — fine for notifications/feeds. Long polling works through any proxy but adds latency and overhead. Mention fallbacks for restrictive networks and that WebSockets require sticky load balancing plus a pub/sub backplane between gateway servers.
:::

:::question
difficulty: medium
### How do you keep scroll position stable when loading older messages at the top?
Before prepending, record `prevHeight = list.scrollHeight` and `prevTop = list.scrollTop`. After the new messages render (in `useLayoutEffect`, before paint), set `list.scrollTop = prevTop + (list.scrollHeight - prevHeight)`. Alternatively rely on CSS `overflow-anchor` (not in Safari) or a virtualized list with "first item index" support.
:::

## Practice

:::challenge
difficulty: medium
### Implement the client-side message store reducer
Write a reducer handling `optimisticSend`, `ack`, `incoming` (may be a duplicate of a message we sent, or from another user), and `fail`. Messages must be ordered by `serverSeq`, with pending messages (no seq) after all confirmed ones in send order, and never duplicated.
@@@solution
```js
function messagesReducer(state, action) {
  // state: { byClientId: { [clientId]: Message }, order: clientId[] }
  switch (action.type) {
    case 'optimisticSend': {
      const m = { ...action.message, status: 'pending' }
      return { byClientId: { ...state.byClientId, [m.clientId]: m }, order: sortOrder({ ...state.byClientId, [m.clientId]: m }) }
    }
    case 'ack': {
      const prev = state.byClientId[action.clientId]
      if (!prev) return state
      const m = { ...prev, id: action.id, serverSeq: action.serverSeq, status: 'sent' }
      const byClientId = { ...state.byClientId, [m.clientId]: m }
      return { byClientId, order: sortOrder(byClientId) }
    }
    case 'incoming': {
      const existing = state.byClientId[action.message.clientId]
      // duplicate of something we already have (e.g. our own message echoed to this tab)
      const m = existing ? { ...existing, ...action.message, status: existing.status === 'read' ? 'read' : 'sent' } : action.message
      const byClientId = { ...state.byClientId, [m.clientId]: m }
      return { byClientId, order: sortOrder(byClientId) }
    }
    case 'fail': {
      const prev = state.byClientId[action.clientId]
      if (!prev) return state
      return { ...state, byClientId: { ...state.byClientId, [prev.clientId]: { ...prev, status: 'failed' } } }
    }
    default:
      return state
  }
}

function sortOrder(byClientId) {
  return Object.values(byClientId)
    .sort((a, b) => {
      const aSeq = a.serverSeq ?? Infinity
      const bSeq = b.serverSeq ?? Infinity
      if (aSeq !== bSeq) return aSeq - bSeq
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0 // pending: send order
    })
    .map((m) => m.clientId)
}
```

- Keyed by `clientId`, so the same message arriving via ack, echo and history fetch collapses into one entry.
- Confirmed messages sort by server sequence (authoritative order); pending ones (`Infinity`) stay at the bottom in the order they were sent.
- Re-sorting the whole list is O(n log n) — fine for a page of messages; for large histories insert by binary search into the confirmed segment.
:::

## Quick check

:::quiz
### Why order chat messages by a server-assigned sequence rather than `createdAt` from the client?
- [ ] Sequences are shorter
- [x] Client clocks are unreliable and differ between devices; the server sequence is a single authoritative order
- [ ] Dates can't be sorted
- [ ] For encryption
@@@explain
Clock skew would reorder messages differently on each device.
:::

:::quiz
### What is the purpose of WebSocket heartbeats?
- [ ] To keep the CPU awake
- [x] To detect half-open/dead connections that never emit a close event
- [ ] To compress messages
- [ ] To authenticate each message
@@@explain
Without heartbeats, a silently dropped connection looks open until you try to use it.
:::
