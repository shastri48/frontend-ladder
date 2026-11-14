---
title: HTTP and HTTPS
summary: The language browsers and servers speak — methods, status codes, headers, cookies, HTTP versions and how TLS keeps it private.
minutes: 18
---

## HTTP is a text conversation

**HTTP (HyperText Transfer Protocol)** is a request/response protocol. The client sends a **request**; the server sends back exactly one **response**. Strip away the tooling and it's surprisingly readable:

```text
GET /api/products/42 HTTP/1.1
Host: shop.example.com
Accept: application/json
Authorization: Bearer eyJhbGciOi...
Cookie: theme=dark
```

```text
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: max-age=60
Content-Length: 58

{"id":42,"name":"Mechanical Keyboard","price":4999}
```

:::visual http-anatomy
:::

Every request has:

1. A **method** (what you want to do)
2. A **path** (which resource)
3. **Headers** (metadata: who you are, what formats you accept, caching rules…)
4. An optional **body** (data for POST/PUT/PATCH)

Every response has a **status code**, headers and an optional body.

## Methods

| Method | Purpose | Has body? | Safe? | Idempotent? |
|---|---|---|---|---|
| `GET` | Read a resource | No | Yes | Yes |
| `POST` | Create / trigger an action | Yes | No | **No** |
| `PUT` | Replace a resource entirely | Yes | No | Yes |
| `PATCH` | Partially update | Yes | No | Not guaranteed |
| `DELETE` | Remove | Rarely | No | Yes |
| `HEAD` | Like GET, headers only | No | Yes | Yes |
| `OPTIONS` | Ask what's allowed (CORS preflight) | No | Yes | Yes |

- **Safe** = doesn't change server state.
- **Idempotent** = doing it once or ten times leaves the server in the same state. `DELETE /cart/5` twice → item still deleted. `POST /orders` twice → **two orders**. That's why double-clicking "Pay" is dangerous and why payment APIs use *idempotency keys*.

## Status codes

The first digit tells you the category:

| Range | Meaning | Common ones |
|---|---|---|
| 1xx | Informational | 101 Switching Protocols (WebSocket upgrade) |
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirection | 301 Moved Permanently, 302 Found, 304 Not Modified |
| 4xx | **Client** made a mistake | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Too Many Requests |
| 5xx | **Server** failed | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

:::callout warn 401 vs 403
**401 Unauthorized** really means *unauthenticated* — "I don't know who you are" (missing/expired token → redirect to login or refresh the token). **403 Forbidden** means "I know who you are, and you're not allowed" (don't retry, show a permission message).
:::

:::callout info fetch() doesn't reject on 404/500
`fetch` only rejects on **network** failures. A 404 or 500 resolves normally — you must check `response.ok` (true for 200–299) yourself.
:::

## Headers you'll meet every day

**Request headers**

- `Host` — which site (one IP can host many sites).
- `Accept` — formats the client wants (`application/json`, `text/html`).
- `Content-Type` — format of the *body you're sending*.
- `Authorization` — credentials, e.g. `Bearer <token>`.
- `Cookie` — cookies the browser attaches automatically for that domain.
- `Origin` / `Referer` — where the request came from.
- `If-None-Match` / `If-Modified-Since` — conditional requests for caching.

**Response headers**

- `Content-Type` — what the body is.
- `Set-Cookie` — ask the browser to store a cookie.
- `Cache-Control`, `ETag`, `Last-Modified` — caching rules.
- `Location` — where to go for redirects (3xx) or the URL of a created resource (201).
- `Access-Control-Allow-Origin` — CORS permission.
- Security headers: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`.

## HTTP is stateless — cookies add memory

The server doesn't remember you between requests. To keep you "logged in", it sends:

```text
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
```

and from then on the browser automatically adds `Cookie: session=abc123` to every request to that domain.

| Attribute | Meaning |
|---|---|
| `HttpOnly` | JavaScript can't read it (`document.cookie` won't show it) → protects against XSS stealing it |
| `Secure` | Only sent over HTTPS |
| `SameSite=Lax/Strict/None` | Controls sending on cross-site requests → CSRF protection |
| `Max-Age` / `Expires` | Lifetime; without it it's a *session cookie* |
| `Domain` / `Path` | Scope |

## HTTP versions in one table

| Version | Key idea | Problem it solved |
|---|---|---|
| HTTP/1.0 | One request per TCP connection | — |
| HTTP/1.1 (1997) | Keep-alive connections, `Host` header | Reconnecting for every file. But one request at a time per connection → browsers open ~6 connections per origin |
| HTTP/2 (2015) | **Multiplexing** many requests over one connection, binary framing, header compression (HPACK) | Head-of-line blocking at the HTTP level; made "bundle everything into one file" less necessary |
| HTTP/3 (2022) | Runs over **QUIC (UDP)** | TCP-level head-of-line blocking; faster handshakes, survives network switches (Wi-Fi → 4G) |

## HTTPS = HTTP + TLS

Plain HTTP is readable by anyone on the path (public Wi-Fi, ISP). **HTTPS** wraps HTTP inside **TLS** (Transport Layer Security), giving:

1. **Encryption** — eavesdroppers see gibberish.
2. **Integrity** — data can't be modified in transit.
3. **Authentication** — you're really talking to `bank.com`, proven by a **certificate** signed by a trusted Certificate Authority (CA).

The TLS 1.3 handshake (simplified):

```text
Client                                   Server
  | ClientHello (supported ciphers,         |
  |   key share, random)  ----------------> |
  |                                         |
  | <-------------- ServerHello (key share, |
  |        certificate, signature, Finished)|
  | verify certificate chain against        |
  | trusted CAs; derive shared keys         |
  | Finished  ----------------------------> |
  | ======= encrypted HTTP traffic ======== |
```

Both sides use **asymmetric** crypto (public/private keys, Diffie–Hellman) just to agree on a shared secret, then switch to fast **symmetric** encryption (AES/ChaCha20) for the actual data. TLS 1.3 needs only **one round trip** (and 0-RTT on resumption).

:::callout tip Why frontend devs care
Modern browser features — service workers, geolocation, camera, clipboard, HTTP/2 in practice, `Secure` cookies — require a **secure context** (HTTPS or localhost). HSTS (`Strict-Transport-Security`) tells browsers to never use plain HTTP for your domain again.
:::

## Calling HTTP from JavaScript

```js
// GET
const res = await fetch('/api/products?page=2')
if (!res.ok) throw new Error(`HTTP ${res.status}`)
const data = await res.json()

// POST JSON
await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productId: 42, qty: 1 }),
})
```

:::question
difficulty: easy
companies: Accenture
### What is the difference between GET and POST?
| | GET | POST |
|---|---|---|
| Purpose | Retrieve data | Send data / create / trigger action |
| Data location | URL query string | Request body |
| Cached by browsers/CDNs | Yes (by default) | No |
| Bookmarkable / in history | Yes | No |
| Idempotent | Yes | No |
| Length limits | URL length limits (~2–8 KB practical) | Large bodies fine |

Never put secrets or passwords in a GET query — URLs end up in logs, history and Referer headers. Note: GET is not "less secure" because of visibility alone; *both* are only private over HTTPS.
:::

:::question
difficulty: easy
### What does "idempotent" mean and why should frontend developers care?
An operation is idempotent if performing it multiple times has the same effect as performing it once. GET, PUT, DELETE are idempotent; POST is not.

Frontend impact: retries. If a network blip happens, it's safe to automatically retry a GET or PUT, but retrying a POST may create duplicate orders/payments. Mitigations: disable the submit button while pending, and send an **idempotency key** header so the server can de-duplicate.
:::

:::question
difficulty: medium
companies: Razorpay
### What is the difference between authentication and authorization? What do 401 and 403 mean?
- **Authentication (AuthN)** — *who are you?* Proving identity (password, OTP, OAuth, token).
- **Authorization (AuthZ)** — *what are you allowed to do?* Permissions/roles checked on every request.

`401 Unauthorized` = not authenticated (missing/invalid/expired credentials) → log in or refresh the token. `403 Forbidden` = authenticated but not permitted → show an access-denied message; retrying won't help.

Auth state travels in **cookies** (sent automatically, can be `HttpOnly`) or **tokens** (e.g. JWT in an `Authorization: Bearer` header, set manually by your code). Authorization must always be enforced on the server; hiding a button on the client is UX, not security.
:::

:::question
difficulty: medium
### How does HTTPS keep data secure?
HTTPS is HTTP over TLS. During the TLS handshake the server presents a **certificate** (its public key signed by a trusted Certificate Authority); the browser verifies the chain, which authenticates the server. Client and server then use a key-exchange (ECDHE) to derive a shared secret without ever sending it, and switch to symmetric encryption for the session. Result: confidentiality (encrypted), integrity (tamper detection via MACs/AEAD) and authenticity (certificate). TLS 1.3 does this in one round trip.
:::

:::question
difficulty: medium
### What are the main differences between HTTP/1.1, HTTP/2 and HTTP/3?
HTTP/1.1 processes one request at a time per TCP connection, so browsers open ~6 parallel connections per origin and developers used tricks like bundling and sprites. HTTP/2 **multiplexes** many streams over one connection with binary framing and header compression, so many small files are cheap. But a single lost TCP packet still stalls all streams (TCP head-of-line blocking). HTTP/3 moves to **QUIC over UDP**, where each stream is independent, handshakes are faster (TLS built in) and connections survive IP changes.
:::

:::challenge
difficulty: easy
### Write a safe JSON fetch helper
Write `async function getJSON(fetchFn, url)` that calls `fetchFn(url)`, throws an `Error` with message `HTTP <status>` when the response is not ok, and otherwise returns the parsed JSON. (`fetchFn` is passed in so it can be tested without a network.)
@@@starter
```js
async function getJSON(fetchFn, url) {
  // your code
}
```
@@@tests
```js
const fakeFetch = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })
test('returns data on 200', async () => {
  expect(await getJSON(fakeFetch(200, { a: 1 }), '/x')).toEqual({ a: 1 })
})
test('throws on 404', async () => {
  let msg = ''
  try { await getJSON(fakeFetch(404, null), '/x') } catch (e) { msg = e.message }
  expect(msg).toBe('HTTP 404')
})
```
@@@solution
```js
async function getJSON(fetchFn, url) {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
```
The key insight is that `fetch` **resolves** for 4xx/5xx — only network errors (DNS failure, offline, CORS block) reject. Checking `res.ok` turns HTTP errors into exceptions your `try/catch` or React Query/SWR error state can handle. In real code you'd also attach the status and body to the error object for better UI messages.
:::

:::quiz
### A user's token expired and the API returns a status code. Which is correct?
- [x] 401 — authenticate again (or refresh the token)
- [ ] 403 — they're not allowed
- [ ] 404 — the resource is gone
- [ ] 500 — the server crashed
@@@explain
401 means "not authenticated". 403 means authenticated but forbidden.
:::

:::quiz
### Which cookie attribute stops JavaScript from reading a cookie?
- [ ] Secure
- [x] HttpOnly
- [ ] SameSite
- [ ] Max-Age
@@@explain
HttpOnly cookies are invisible to `document.cookie`, so an XSS attack can't steal them.
:::

:::quiz
### What was the headline feature of HTTP/2?
- [ ] Running over UDP
- [x] Multiplexing many requests over a single connection
- [ ] Adding the Host header
@@@explain
Multiplexing. UDP/QUIC is HTTP/3; the Host header came with HTTP/1.1.
:::
