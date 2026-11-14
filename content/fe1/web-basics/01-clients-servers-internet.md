---
title: Clients, Servers and the Internet
summary: What actually happens between your laptop and a website — IP addresses, packets, ports, DNS and the client–server model.
minutes: 14
---

## The big picture

Every time you open a website, two computers talk to each other:

- A **client** — the program asking for something. Usually your browser, but it can be a mobile app, `curl`, or another server.
- A **server** — a program (running on some machine) that listens for requests and sends back responses.

That's the **client–server model**. The client *always* starts the conversation; the server waits and answers. A web page is the result of many of these conversations: one for the HTML, then more for every CSS file, script, image, font and API call the HTML references.

:::callout analogy Restaurant analogy
You (client) look at the menu and tell the waiter your order (request). The kitchen (server) prepares it and the waiter brings back a plate (response). You never walk into the kitchen — you only know the "interface": the menu and the waiter. On the web, the menu is the URL + HTTP, and the plate is HTML, JSON, images…
:::

A frontend developer writes code that runs **on the client** (in the browser). A backend developer writes code that runs **on the server**. The two sides agree on a contract — usually HTTP endpoints returning HTML or JSON.

## The internet is a network of networks

The internet is not a single cable — it is millions of networks (your home Wi‑Fi, your ISP, a company's data centre, an undersea cable operator) connected by **routers**. Routers do one job: look at where a piece of data is going and forward it one hop closer.

### IP addresses

Every device on the internet is reachable through an **IP address**:

| Version | Example | Notes |
|---|---|---|
| IPv4 | `142.250.183.110` | 4 numbers 0–255, ~4.3 billion addresses — ran out years ago |
| IPv6 | `2404:6800:4009:82b::200e` | 128-bit, practically unlimited |

Your laptop usually has a **private** address (like `192.168.1.7`) inside your home network; your router shares one **public** address with the outside world (NAT — Network Address Translation).

### Packets

Data is not sent as one big blob. It is chopped into small **packets** (roughly 1.5 KB each). Each packet carries the destination IP, and packets may take different routes and arrive out of order. Something has to put them back together reliably — that's TCP.

### TCP, UDP and ports

```text
 Application   HTTP, WebSocket, DNS ...      ← what the data *means*
 Transport     TCP (reliable) / UDP (fast)    ← ordering, retries, ports
 Internet      IP                             ← addressing + routing
 Link          Wi-Fi, Ethernet, fibre         ← physical bits
```

- **TCP** guarantees delivery and order: lost packets are re-sent, out-of-order packets are reassembled. It starts with a **3-way handshake** (`SYN → SYN-ACK → ACK`) before any data flows. HTTP/1.1 and HTTP/2 use TCP.
- **UDP** just fires packets — no handshake, no guarantees. Great for video calls, games, DNS lookups. HTTP/3 runs over **QUIC**, which is built on UDP and re-implements reliability more efficiently.

A **port** identifies *which program* on a machine should receive the data. The IP gets you to the building; the port gets you to the apartment.

| Port | Used by |
|---|---|
| 80 | HTTP |
| 443 | HTTPS |
| 53 | DNS |
| 22 | SSH |
| 3000 / 5173 / 8080 | Typical local dev servers |

So `http://localhost:5173` means "the program listening on port 5173 on my own machine (`localhost` = `127.0.0.1`)".

## DNS — the internet's phonebook

Humans remember `google.com`; routers need `142.250.183.110`. **DNS (Domain Name System)** converts one into the other.

When you type `www.example.com`:

1. **Browser cache** — did we look this up recently?
2. **OS cache** (and the `hosts` file).
3. **Recursive resolver** — usually run by your ISP, or public ones like `8.8.8.8` (Google) / `1.1.1.1` (Cloudflare). If it doesn't know, it asks:
4. **Root server** → "for `.com`, ask these TLD servers"
5. **TLD server (`.com`)** → "for `example.com`, ask its authoritative nameserver"
6. **Authoritative nameserver** → "`www.example.com` is `93.184.215.14`"

The answer is cached at every level for its **TTL** (time to live), which is why DNS changes can take time to "propagate".

Common DNS record types:

| Record | Meaning |
|---|---|
| `A` | name → IPv4 address |
| `AAAA` | name → IPv6 address |
| `CNAME` | name → another name (alias) |
| `MX` | mail servers for the domain |
| `TXT` | arbitrary text (domain verification, SPF) |

:::callout tip Performance link
A DNS lookup can cost 20–120 ms on a cold cache. That's why sites add `<link rel="dns-prefetch" href="https://cdn.example.com">` or `<link rel="preconnect">` for third-party origins they know they'll need.
:::

## URLs, origins and domains

```text
https://shop.example.com:443/products/42?color=red#reviews
└─┬─┘   └──────┬───────┘ └┬┘ └────┬────┘ └───┬───┘ └──┬──┘
scheme       host        port    path       query   fragment
```

- **Scheme** — protocol (`https`, `http`, `ws`, `wss`, `file`…).
- **Host** — the domain name (or IP). `shop` is a subdomain of `example.com`.
- **Port** — optional; defaults to 443 for https, 80 for http.
- **Path** — which resource on the server.
- **Query string** — key/value parameters, read in JS with `new URLSearchParams(location.search)`.
- **Fragment (hash)** — never sent to the server; used by the browser to scroll to `id="reviews"` or by client-side routers.

The **origin** is `scheme + host + port`. Two URLs are *same-origin* only if all three match. This matters a lot later (CORS, cookies, storage are all origin-scoped).

## Where frontend code fits

```text
Browser (client)                       Server(s)
┌──────────────────────┐   HTTP    ┌──────────────────────┐
│ HTML  → structure     │ ───────▶ │ Web server / CDN     │
│ CSS   → presentation  │ ◀─────── │ returns files        │
│ JS    → behaviour     │          ├──────────────────────┤
│ fetch() → API calls   │ ───────▶ │ API server (JSON)    │
└──────────────────────┘ ◀─────── │ Database             │
                                   └──────────────────────┘
```

Static files (HTML/CSS/JS/images) are often served from a **CDN** (Content Delivery Network) — servers spread around the world that cache your files close to the user, so someone in Mumbai doesn't wait for a round trip to Virginia.

:::question
difficulty: easy
### What is the client–server model?
It is an architecture where a **client** (browser, app) initiates requests and a **server** listens and responds. The client handles presentation and user interaction; the server owns data, business logic and persistence. Communication on the web happens over HTTP(S).

Key properties:
- The client always initiates (except with push technologies like WebSockets/SSE, which still start with a client request).
- Many clients can talk to one server; servers can scale horizontally behind a load balancer.
- HTTP itself is **stateless** — every request must carry what the server needs (cookies, tokens) to identify the user.

**In an interview, say:** "Clients request, servers respond; HTTP is stateless, so identity travels with each request via cookies or tokens."
:::

:::question
difficulty: easy
companies: Razorpay
### What is DNS and how does a lookup work?
DNS maps human-readable domain names to IP addresses. A lookup checks the browser cache → OS cache → recursive resolver; on a miss, the resolver walks the hierarchy: **root** servers → **TLD** servers (`.com`) → the domain's **authoritative** nameserver, which returns the record (e.g. an `A` record). Every level caches the answer for its TTL.

Frontend relevance: DNS adds latency to the first request to every new origin. Reduce it with fewer third-party origins and `dns-prefetch` / `preconnect` hints.
:::

:::question
difficulty: medium
### What is the difference between TCP and UDP? Which does the web use?
| | TCP | UDP |
|---|---|---|
| Connection | Handshake first (SYN, SYN-ACK, ACK) | None |
| Reliability | Retransmits lost packets, guarantees order | Fire-and-forget |
| Overhead | Higher | Lower |
| Used by | HTTP/1.1, HTTP/2, SSH, email | DNS, video calls, games, QUIC/HTTP/3 |

The classic web (HTTP/1.1 and HTTP/2) runs over TCP. HTTP/3 runs over **QUIC**, a UDP-based protocol that adds its own reliability and encryption, avoids TCP's head-of-line blocking, and sets up connections faster.
:::

:::question
difficulty: easy
### What is an "origin" and why does it matter?
An origin is the triple **scheme + host + port**. `https://a.com` and `https://a.com:8443` are different origins; so are `http://a.com` and `https://a.com`, and `a.com` vs `api.a.com`.

The browser's **same-origin policy** isolates origins: a script from one origin cannot read responses, DOM or storage of another unless the other explicitly allows it (CORS for network requests). localStorage, IndexedDB and service workers are all scoped per origin.
:::

:::challenge
difficulty: easy
### Parse a URL into its parts
Write `parseUrl(str)` that returns `{ protocol, host, port, path, query, hash }` where `query` is an object of key → value. Use the built-in `URL` API. If no port is present, return the default (`'443'` for https, `'80'` for http).
@@@hint
`new URL(str)` gives you `protocol`, `hostname`, `port`, `pathname`, `searchParams`, `hash`. `port` is an empty string when it's the default.
@@@starter
```js
function parseUrl(str) {
  // your code
}
```
@@@tests
```js
test('parses a full URL', () => {
  expect(parseUrl('https://shop.example.com:8443/p/42?color=red&size=m#reviews')).toEqual({
    protocol: 'https', host: 'shop.example.com', port: '8443', path: '/p/42',
    query: { color: 'red', size: 'm' }, hash: 'reviews',
  })
})
test('default ports', () => {
  expect(parseUrl('https://a.com/').port).toBe('443')
  expect(parseUrl('http://a.com/').port).toBe('80')
})
test('no query or hash', () => {
  const r = parseUrl('https://a.com/x')
  expect(r.query).toEqual({})
  expect(r.hash).toBe('')
})
```
@@@solution
```js
function parseUrl(str) {
  const u = new URL(str)
  const protocol = u.protocol.replace(':', '')
  const defaults = { https: '443', http: '80' }
  return {
    protocol,
    host: u.hostname,
    port: u.port || defaults[protocol] || '',
    path: u.pathname,
    query: Object.fromEntries(u.searchParams),
    hash: u.hash.replace('#', ''),
  }
}
```
`URL` does all the hard parsing (encoding, edge cases) for you — never parse URLs with regex in production. `Object.fromEntries(searchParams)` keeps the *last* value for repeated keys; use `searchParams.getAll(key)` when a key can repeat (`?tag=a&tag=b`).
:::

:::quiz
### Which part of a URL is never sent to the server?
- [ ] The query string
- [ ] The path
- [x] The fragment (`#...`)
- [ ] The port
@@@explain
The fragment is handled entirely by the browser (scrolling to an anchor, client-side routing). The query string and path are part of the HTTP request line.
:::

:::quiz
### `https://app.site.com` and `https://site.com` are…
- [ ] The same origin, because the domain is the same
- [x] Different origins, because the host differs
- [ ] The same origin, because both use https
@@@explain
Origin = scheme + host + port. A subdomain is a different host, so it is a different origin.
:::

:::quiz
### What does a recursive DNS resolver do on a cache miss?
- [ ] Asks the website's web server for its IP
- [x] Queries root → TLD → authoritative nameservers in turn
- [ ] Broadcasts the name to every router
@@@explain
The resolver walks the DNS hierarchy and caches every answer according to its TTL.
:::
