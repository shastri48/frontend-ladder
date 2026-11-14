---
title: Real-Time — Polling, SSE and WebSockets
summary: How servers push data to browsers, the trade-offs between short polling, long polling, Server-Sent Events and WebSockets, and building a resilient WebSocket client.
minutes: 13
---

## The problem

HTTP is **request → response**: the client always asks first. But chat messages, stock prices, notifications, live scores and collaborative cursors need the **server to push**. Four techniques, from oldest to newest:

```text
Short polling     C→S "anything?"  S→C "no"   (every N s)  C→S "anything?" S→C "yes: …"
Long polling      C→S "anything?" ……server holds the request open…… S→C "yes: …"  C→S (immediately re-ask)
SSE               C→S GET /stream   S→C event … event … event …   (one long HTTP response, server→client only)
WebSocket         C⇄S Upgrade handshake, then a persistent full-duplex TCP channel: messages both ways
```

## Short polling

```js
setInterval(async () => {
  const res = await fetch('/api/notifications?since=' + lastId)
  render(await res.json())
}, 5000)
```

- Dead simple, works everywhere, stateless servers.
- Wasteful (most responses are empty), latency up to the interval, lots of requests at scale.
- Fine for low-frequency data (job status every 10 s).

## Long polling

The server holds the request until there's data (or a timeout ~30 s), then the client immediately reconnects.

- Near-real-time with plain HTTP; works through any proxy.
- Each message costs a full request/response cycle; servers hold many open connections; ordering/duplicate handling is on you.

## Server-Sent Events (SSE)

A standard for **server → client** streaming over a single long-lived HTTP response with `Content-Type: text/event-stream`.

```js
const es = new EventSource('/api/prices', { withCredentials: true })
es.onmessage = (e) => updatePrice(JSON.parse(e.data))
es.addEventListener('trade', (e) => addTrade(JSON.parse(e.data)))
es.onerror = () => console.log('connection lost, browser will retry')
```

Server sends plain text:

```text
id: 1042
event: trade
data: {"symbol":"BTC","price":64000}

```

- **Auto-reconnect** built in, resumes with the `Last-Event-ID` header.
- Plain HTTP → works with HTTP/2 multiplexing, auth cookies, proxies, CDNs.
- One-way only (client sends via normal fetch), text only, `EventSource` can't set custom headers (use cookies or a fetch-based SSE client). Under HTTP/1.1 limited to ~6 connections per domain across tabs.
- Great for: notifications, live feeds, progress updates, **LLM token streaming**.

## WebSockets

A WebSocket starts as an HTTP request that **upgrades** the connection:

```http
GET /chat HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
```
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
```

After that, both sides send **frames** (text or binary) at any time over the same TCP connection, with tiny overhead (2–14 bytes per frame vs hundreds of bytes of HTTP headers).

```js
const ws = new WebSocket('wss://example.com/chat')
ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: 'general' }))
ws.onmessage = (e) => handle(JSON.parse(e.data))
ws.onclose = (e) => console.log('closed', e.code, e.reason)
ws.onerror = () => {}  // onclose follows
```

- **Full-duplex**, low latency, low overhead — chat, multiplayer games, collaborative editing, trading.
- **No** built-in reconnection, heartbeats, message acknowledgement, rooms or auth — you build these (or use Socket.IO / a managed service).
- Stateful connections are harder to scale (sticky sessions or a pub/sub backplane like Redis), and some corporate proxies interfere.
- Auth: cookies are sent on the handshake (check `Origin` server-side to prevent cross-site WebSocket hijacking), or send a token in the first message / short-lived ticket in the URL.

## Comparison

| | Short poll | Long poll | SSE | WebSocket |
|---|---|---|---|---|
| Direction | C→S pull | C→S pull | S→C push | Both |
| Latency | Interval | Low | Low | Lowest |
| Overhead | High | Medium | Low | Lowest |
| Reconnect | N/A | Manual | **Automatic** | Manual |
| Binary | Yes | Yes | No | Yes |
| Infra | Any | Any | HTTP | Needs WS support |
| Use for | Rare updates | Fallback | Feeds, notifications, AI streaming | Chat, games, collaboration, trading |

## A resilient WebSocket client

```js
export function createSocket(url, { onMessage, onStatus }) {
  let ws, retries = 0, heartbeat, closedByUser = false
  const queue = []   // messages sent while offline

  function connect() {
    ws = new WebSocket(url)
    onStatus?.('connecting')
    ws.onopen = () => {
      retries = 0
      onStatus?.('open')
      while (queue.length) ws.send(queue.shift())
      heartbeat = setInterval(() => ws.send('{"type":"ping"}'), 25_000)
    }
    ws.onmessage = (e) => onMessage(JSON.parse(e.data))
    ws.onclose = () => {
      clearInterval(heartbeat)
      if (closedByUser) return
      onStatus?.('reconnecting')
      const delay = Math.min(30_000, 500 * 2 ** retries++) + Math.random() * 500   // backoff + jitter
      setTimeout(connect, delay)
    }
  }
  connect()

  return {
    send(msg) {
      const data = JSON.stringify(msg)
      ws.readyState === WebSocket.OPEN ? ws.send(data) : queue.push(data)
    },
    close() { closedByUser = true; ws.close() },
  }
}
```

Also: reconnect on `online` event, pause on `visibilitychange` if appropriate, re-subscribe to channels after reconnect, and dedupe messages by id (at-least-once delivery).

## Throttling high-frequency updates (Coinbase-style)

A price feed may push 50 updates/second. Rendering a chart on every message wastes the main thread. Buffer and flush once per frame (or every N ms):

```js
let latest = new Map()
let scheduled = false
socket.onmessage = (e) => {
  const tick = JSON.parse(e.data)
  latest.set(tick.symbol, tick)          // keep only the newest per symbol
  if (!scheduled) {
    scheduled = true
    requestAnimationFrame(() => {
      chart.update([...latest.values()])
      latest = new Map()
      scheduled = false
    })
  }
}
```

In React, keep the buffer in a `useRef` and commit to state at most every ~100–250 ms (humans can't read faster), or update the chart imperatively via a ref.

## Interview questions

:::question
difficulty: easy
### What is a WebSocket?
A protocol (`ws://`/`wss://`) providing a **persistent, full-duplex** connection between browser and server over a single TCP connection. It begins as an HTTP request with `Upgrade: websocket` and a `101 Switching Protocols` response; afterwards both sides can send messages at any time with minimal framing overhead. Used for chat, live collaboration, games and trading. You must handle reconnection, heartbeats, auth and scaling yourself.
:::

:::question
difficulty: medium
### WebSockets vs SSE vs long polling — how do you choose?
- Need **bidirectional**, frequent, low-latency messages (chat, multiplayer, collaborative editing) → **WebSocket**.
- Only **server → client** updates (notifications, live dashboards, AI token streaming) → **SSE**: simpler, plain HTTP, automatic reconnect with Last-Event-ID, works with HTTP/2.
- Infrequent updates or restrictive infrastructure → **polling** (short or long) as the simplest option or fallback.
Also consider scale: WebSockets are stateful and need sticky sessions or a pub/sub backplane.
:::

:::question
difficulty: medium
companies: Coinbase
### How would you throttle WebSocket price updates for a chart?
Don't render per message. Buffer incoming ticks (keep only the latest per symbol, or aggregate into OHLC candles) in a mutable ref/Map, then flush to the chart once per animation frame or on a fixed interval (100–250 ms). Update the chart imperatively (canvas/charting library API) rather than through React state for every point. Use `requestAnimationFrame` so updates pause in background tabs, and possibly move aggregation into a Web Worker for very high volume.
:::

## Challenges

:::challenge
difficulty: medium
### Design notifications for a web app
You need in-app notifications (new comment, mention) with a badge count, for a site with 1M daily users. Which transport would you choose and how do you handle reconnects and missed messages?
@@@solution
- **Transport**: **SSE** — notifications are server→client only; SSE works over HTTP/2 (multiplexed with other requests), passes through proxies/CDNs, authenticates with the existing session cookie and reconnects automatically. WebSockets would be justified only if the same channel also needs client→server real-time messages (e.g., chat).
- **Missed messages**: each notification has a monotonically increasing `id`. The server stores recent notifications per user. On reconnect `EventSource` sends `Last-Event-ID`, and the server replays everything after it. On cold start, fetch `/api/notifications?unread=true` via REST, then subscribe.
- **Badge count**: authoritative count from the server on load; SSE events increment it; marking read is a REST call; sync across tabs via `BroadcastChannel` (or one tab leader holds the connection).
- **Scale**: SSE servers subscribe to a pub/sub (Redis, Kafka) for user channels; connections are cheap with an event-driven server; fallback to polling every 30–60 s if streaming fails.
- **UX**: debounce toasts, group bursts ("5 new comments"), respect browser notification permission for push when the tab is closed (Web Push via Service Worker).
:::

## Quick check

:::quiz
### Which transport reconnects automatically and resumes from the last event?
- [ ] WebSocket
- [x] Server-Sent Events
- [ ] Long polling
- [ ] Short polling
@@@explain
EventSource reconnects on its own and sends Last-Event-ID so the server can replay.
:::

:::quiz
### What HTTP status code completes a WebSocket handshake?
- [ ] 200
- [ ] 204
- [x] 101
- [ ] 302
@@@explain
101 Switching Protocols — the connection is upgraded from HTTP to the WebSocket protocol.
:::
