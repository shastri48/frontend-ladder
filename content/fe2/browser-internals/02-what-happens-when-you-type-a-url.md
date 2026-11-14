---
title: What Happens When You Type a URL
summary: The classic interview question, answered end to end — URL parsing, DNS, TCP, TLS, HTTP/1.1 vs 2 vs 3, the response, parsing and first paint.
minutes: 18
---

## The most-asked web fundamentals question

"What happens when you type `https://www.example.com` and hit Enter?" shows up at CRED, Housing.com, Reddit, Razorpay and almost every product company. Interviewers use it to see **how deep your mental model goes**. A junior lists five steps. A strong mid-level engineer can go deep on any step on request and connect it to performance.

:::visual url-journey
:::

Let's walk the whole journey.

## 1. The browser interprets what you typed

The **browser process** (UI thread) decides: is this a URL or a search query? `example.com` → URL; `best pizza` → search. It also:

- Adds the scheme if missing and checks the **HSTS preload list** — if the domain is HSTS, the browser upgrades `http://` to `https://` before sending anything.
- Fires `beforeunload` on the current page if it has a handler.
- May already have **pre-connected** or even **prerendered** the page if you typed a familiar prefix (speculative loading).

## 2. DNS lookup: name → IP address

Computers connect to IP addresses, not names. The browser checks a chain of caches, stopping at the first hit:

```text
Browser DNS cache → OS cache (and /etc/hosts) → Router cache
  → ISP / configured recursive resolver (e.g. 1.1.1.1, 8.8.8.8)
       → Root server ("who handles .com?")
       → TLD server ("who handles example.com?")
       → Authoritative name server ("www.example.com = 93.184.215.14")
```

- The answer has a **TTL**; it is cached for that long.
- Modern browsers may use **DNS over HTTPS (DoH)** for privacy.
- A **CNAME** might point the name at a CDN, which returns the IP of the edge server closest to you.

Performance hooks: `<link rel="dns-prefetch" href="//api.example.com">` resolves early; `<link rel="preconnect">` does DNS + TCP + TLS early.

## 3. TCP connection: the three-way handshake

```text
Client                          Server
  │ ── SYN (seq=x) ────────────► │
  │ ◄──────── SYN-ACK (seq=y, ack=x+1)
  │ ── ACK (ack=y+1) ──────────► │
  │      connection established   │
```

One full **round trip (RTT)** before any data. On a mobile network with 100 ms RTT, that's 100 ms of nothing. TCP also does **slow start** — it starts sending few packets and ramps up — which is why the first ~14 KB of HTML matters ("the 14 KB rule" for critical content).

## 4. TLS handshake: making it secure

For HTTPS, the client and server agree on encryption:

1. **ClientHello** — supported TLS versions, cipher suites, a random value, key share (TLS 1.3).
2. **ServerHello** + **certificate** — the server proves its identity with a certificate signed by a trusted Certificate Authority.
3. The browser **verifies the certificate chain** (valid, not expired, matches domain, not revoked).
4. Both sides derive the same **session keys** (Diffie–Hellman key exchange) — symmetric encryption from now on.

TLS 1.3 needs **1 RTT** (TLS 1.2 needed 2), and resumed sessions can use **0-RTT**.

## 5. HTTP request and response

```http
GET / HTTP/2
Host: www.example.com
Accept: text/html
Accept-Encoding: gzip, br
Cookie: session=abc123
User-Agent: Mozilla/5.0 ...
```

The server (or CDN edge) responds:

```http
HTTP/2 200
Content-Type: text/html; charset=utf-8
Content-Encoding: br
Cache-Control: no-cache
Set-Cookie: theme=dark; Secure; HttpOnly
```

Possible detours: a **301/302 redirect** (another round trip — avoid redirect chains!), a **304 Not Modified** if revalidating a cached copy, or a response served straight from the **HTTP cache** or a **Service Worker** without touching the network at all.

:::visual http-anatomy
:::

### HTTP/1.1 vs HTTP/2 vs HTTP/3

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Transport | TCP | TCP | **QUIC over UDP** |
| Requests per connection | One at a time (browsers open ~6 connections per host) | **Multiplexed** streams on one connection | Multiplexed streams |
| Head-of-line blocking | Yes (per connection) | At TCP level — one lost packet stalls all streams | **No** — streams are independent |
| Headers | Plain text, repeated | **HPACK** compressed | **QPACK** compressed |
| Handshake | TCP + TLS (2–3 RTT) | TCP + TLS | **Combined, 1 RTT** (0-RTT resume) |
| Connection migration | No | No | **Yes** (Wi-Fi → 4G keeps the connection) |

Consequence: HTTP/1.1-era tricks like **domain sharding** and aggressive **bundling into one file** are less important (even counterproductive) under HTTP/2/3.

## 6. The browser decides what to do with the response

The network service sniffs the `Content-Type`. HTML → hand to a **renderer process** (site isolation decides which). A ZIP → download manager. Once the renderer is ready, the browser **commits the navigation**: the address bar updates, history is updated, and the old page is unloaded.

## 7. Parsing and rendering

This is the **critical rendering path** (next lesson in depth):

1. **HTML → DOM**: bytes → characters → tokens → nodes → DOM tree. Parsing is incremental — the browser renders as data streams in.
2. The **preload scanner** runs ahead to discover `<link>`, `<script>`, `<img>` and start downloading them early.
3. **CSS → CSSOM**: CSS is **render-blocking** — no pixels until the CSSOM is ready.
4. **Synchronous `<script>`** is **parser-blocking**: parsing stops, the script downloads and runs (it may `document.write` or query styles).
5. **Render tree** (visible nodes + computed styles) → **Layout** (geometry) → **Paint** → **Composite**.
6. Events: `DOMContentLoaded` (DOM built, deferred scripts run) and `load` (all subresources, images included).

## 8. After the first paint

- Subresources keep loading; images decode; web fonts swap in.
- JavaScript hydrates the app (SPAs: fetch data, render the UI).
- The connection stays open (**keep-alive**) for subsequent requests.
- Metrics: **TTFB** (time to first byte), **FCP**, **LCP**, **INP**, **CLS**.

## Interview questions

:::question
difficulty: medium
companies: CRED, Housing.com, Reddit, Razorpay
### What happens when you type a URL and press Enter? (concise version)
1. **Parse input** — URL vs search; HSTS may force HTTPS; check for a Service Worker or cached response.
2. **DNS** — browser cache → OS → resolver → root → TLD → authoritative; get an IP (often a CDN edge).
3. **TCP** handshake (SYN, SYN-ACK, ACK) — 1 RTT.
4. **TLS** handshake — certificate validation and key exchange (1 RTT in TLS 1.3). HTTP/3 merges transport + crypto handshakes over QUIC/UDP.
5. **HTTP request** — method, headers, cookies; server/CDN responds with status, headers, body (maybe redirect/304).
6. **Renderer** — parse HTML into DOM, CSS into CSSOM, preload scanner fetches subresources, scripts execute (blocking unless async/defer).
7. **Render tree → layout → paint → composite** → pixels on screen.
8. Further JS, images, fonts load; `DOMContentLoaded` then `load` fire.

**In an interview, say:** "Want me to go deeper into any step — DNS caching, TLS, or the rendering pipeline?" Showing you can zoom in is the point.
:::

:::question
difficulty: medium
### What is the difference between DNS prefetch, preconnect, preload and prefetch?
| Hint | What it does | Use for |
|---|---|---|
| `dns-prefetch` | Resolves DNS only | Many third-party origins, cheap |
| `preconnect` | DNS + TCP + TLS | 1–3 critical origins (API, CDN, fonts) |
| `preload` | Fetches a resource for **this** page at high priority | Hero image, critical font, late-discovered CSS/JS |
| `prefetch` | Fetches a resource likely needed for the **next** navigation, low priority | Next route's chunk |
| `modulepreload` | Preloads + parses an ES module | Critical module graph |

```html
<link rel="preconnect" href="https://api.example.com" crossorigin>
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="prefetch" href="/checkout.chunk.js">
```

Overusing preload competes with genuinely critical resources — preload only what you'll use in the first seconds.
:::

:::question
difficulty: hard
### Why was HTTP/3 created if HTTP/2 already multiplexes requests?
HTTP/2 multiplexes many streams over **one TCP connection**. TCP guarantees in-order delivery for the **whole connection**, so a single lost packet blocks *all* streams until it's retransmitted — **TCP head-of-line blocking**. On lossy mobile networks HTTP/2 can be worse than HTTP/1.1's multiple connections.

HTTP/3 runs over **QUIC** (on UDP), which implements reliable, ordered delivery **per stream**, so loss in one stream doesn't stall others. QUIC also merges the transport and TLS 1.3 handshakes (1 RTT, 0-RTT on resume) and supports **connection migration** when your IP changes (Wi-Fi → cellular).
:::

:::question
difficulty: easy
### What is TTFB and what affects it?
**Time To First Byte** — time from the start of navigation until the first byte of the response arrives. It includes redirects, DNS, TCP, TLS, request travel time and **server processing time**. Improve it with a CDN (shorter distance, edge caching), fewer redirects, faster backend/DB, caching rendered HTML, HTTP/2–3 and `preconnect`. Good TTFB is roughly under 800 ms.
:::

:::question
difficulty: medium
### What does a CDN do in this journey?
A **Content Delivery Network** is a globally distributed set of edge servers. DNS (often via CNAME or anycast) points the user at the nearest edge. The edge serves cached static assets (and sometimes cached HTML or edge-rendered pages) without going to the origin. Benefits: lower latency (shorter RTT), offloaded origin, DDoS protection, TLS termination close to the user, automatic compression and image optimization. Cache freshness is controlled with `Cache-Control`/`s-maxage` and purges.
:::

## Challenges

:::challenge
difficulty: medium
### Count the round trips
A user on a 100 ms RTT network opens `https://shop.com` for the first time (nothing cached). The server responds with a `301` to `https://www.shop.com`, which serves the HTML. Assume TLS 1.3 over HTTP/2, and DNS takes 1 RTT per hostname. How many RTTs before the first HTML byte arrives? How would you reduce it?
@@@solution
For **shop.com**: DNS (1) + TCP (1) + TLS 1.3 (1) + HTTP request → 301 (1) = **4 RTT**.
For **www.shop.com** (a different hostname, new connection): DNS (1) + TCP (1) + TLS (1) + HTTP request → HTML (1) = **4 RTT**.

Total ≈ **8 RTT ≈ 800 ms** before the HTML even starts — before server processing time.

Reduce it:
- Remove the redirect (link to the canonical host directly; HSTS preload avoids `http→https` redirects).
- Use a CDN so RTT is ~20 ms instead of 100 ms.
- HTTP/3 (QUIC) combines TCP+TLS into 1 RTT; 0-RTT on resumption.
- Long DNS TTLs; TLS session resumption.
:::

:::challenge
difficulty: easy
### Order the events
Put these in order for a typical page load: `load` event, DNS lookup, first contentful paint, TLS handshake, `DOMContentLoaded`, TCP handshake, CSSOM built.
@@@solution
1. DNS lookup
2. TCP handshake
3. TLS handshake
4. CSSOM built (while the DOM is being parsed)
5. First contentful paint (needs DOM-so-far + CSSOM)
6. `DOMContentLoaded` (HTML fully parsed, deferred scripts executed)
7. `load` (all images, stylesheets, iframes done)

Note: FCP and `DOMContentLoaded` can swap depending on the page — a long document streaming in can paint before parsing finishes, while a tiny page with heavy deferred scripts may fire DCL late. The order above is typical.
:::

## Quick check

:::quiz
### Which step is skipped when the response is served by a Service Worker from Cache Storage?
- [ ] HTML parsing
- [x] The DNS/TCP/TLS/network request
- [ ] Layout
- [ ] The service worker fetch event
@@@explain
The SW intercepts the fetch and answers from its cache — no network round trips. Everything after the response (parsing, layout, paint) still happens.
:::

:::quiz
### What problem does HTTP/2 multiplexing NOT solve?
- [ ] Browser's ~6 connections per host limit
- [x] TCP head-of-line blocking on packet loss
- [ ] Repeated uncompressed headers
- [ ] Needing multiple TCP handshakes
@@@explain
HTTP/2 still sits on a single TCP connection; one lost packet stalls all streams. QUIC (HTTP/3) fixes this.
:::

:::quiz
### What does the preload scanner do?
- [ ] Preloads the next page
- [x] Scans ahead in the HTML to start downloading resources while the main parser is blocked
- [ ] Prefetches DNS for all links
- [ ] Validates HTML syntax
@@@explain
When the main parser is blocked on a sync script, the preload scanner keeps reading the markup to discover CSS, JS and images early.
:::
