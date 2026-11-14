---
title: CORS and the Same-Origin Policy
summary: What an origin is, why the same-origin policy exists, simple vs preflighted requests, credentials, and how to debug every CORS error you'll see.
minutes: 14
---

## The same-origin policy

An **origin** is the triple **scheme + host + port**:

| URL | Same origin as `https://app.example.com`? |
|---|---|
| `https://app.example.com/page` | ✅ yes (path doesn't matter) |
| `http://app.example.com` | ❌ different scheme |
| `https://api.example.com` | ❌ different host (subdomain) |
| `https://app.example.com:8443` | ❌ different port |

The **same-origin policy (SOP)** is the browser's core security rule: a script from origin A **can't read** responses or DOM from origin B. Without it, any website you visit could `fetch('https://yourbank.com/account')` — your cookies would be attached — and read your balance.

Note what SOP restricts: **reading**. Embedding cross-origin images, scripts, stylesheets and submitting forms has always been allowed (which is exactly why CSRF exists — see FE3 security).

## CORS: a controlled relaxation

**Cross-Origin Resource Sharing** lets a **server** say "these other origins may read my responses". It's enforced by the **browser**, configured on the **server**.

:::callout info Key insight
CORS is not a security feature that protects your server — it protects **users** from malicious sites reading data with the user's credentials. `curl`, Postman and your backend ignore CORS completely. A CORS error means "the browser blocked *your page* from reading the response", and the request often **did** reach the server.
:::

:::visual cors-preflight
:::

## Simple requests

A request is "simple" (no preflight) when:

- Method is `GET`, `HEAD` or `POST`, and
- Only "safelisted" headers (`Accept`, `Accept-Language`, `Content-Language`, `Content-Type`, `Range`), and
- `Content-Type` is only `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`.

These are requests an HTML form could already send, so allowing them doesn't add new risk. The browser sends it with an `Origin` header and checks the response:

```http
GET /data HTTP/1.1
Origin: https://app.example.com
```
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.example.com
```

If `Access-Control-Allow-Origin` doesn't match, the browser **hides the response** from your JS and throws a `TypeError: Failed to fetch` plus a console CORS error.

## Preflighted requests

Anything else — `PUT`/`DELETE`/`PATCH`, `Content-Type: application/json`, custom headers like `Authorization` or `X-Request-Id` — triggers a **preflight**: the browser first asks permission with an `OPTIONS` request.

```http
OPTIONS /api/orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type, authorization
```
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 600
```

Only if the preflight passes does the browser send the real `PUT`. `Access-Control-Max-Age` caches the preflight result so you don't pay an extra round trip every time.

## Credentials (cookies)

By default cross-origin `fetch` doesn't send cookies. To send them:

```js
fetch('https://api.example.com/me', { credentials: 'include' })   // axios: withCredentials: true
```

and the server must respond with:

```http
Access-Control-Allow-Origin: https://app.example.com    ← must be explicit, NOT *
Access-Control-Allow-Credentials: true
Vary: Origin
```

The wildcard `*` is **not allowed** with credentials. Servers that support several origins check the incoming `Origin` against an allowlist and echo it back (and send `Vary: Origin` so caches don't mix responses).

Also: cookies must have `SameSite=None; Secure` to be sent on cross-site requests.

## Reading response headers

By default JS can only read "simple" response headers. Expose others:

```http
Access-Control-Expose-Headers: X-Total-Count, X-Request-Id
```

## Fixing CORS errors

| Error message says… | Fix (server-side) |
|---|---|
| No `Access-Control-Allow-Origin` header | Add it for your origin |
| Wildcard `*` with credentials | Echo the exact origin + `Allow-Credentials: true` |
| Method not allowed in preflight | Add to `Access-Control-Allow-Methods` |
| Header not allowed in preflight | Add to `Access-Control-Allow-Headers` |
| Preflight returned 401/404/500 | The server must answer `OPTIONS` with 2xx **without requiring auth** |
| Redirect not allowed for preflight | Fix the URL (trailing slash / http→https redirect) |

Frontend-only workarounds:

- **Dev proxy**: Vite `server.proxy` or CRA `proxy` make API calls same-origin during development.
- **Backend-for-frontend (BFF)** / reverse proxy under the same domain (`/api` → backend) in production. Avoids CORS entirely.
- `mode: 'no-cors'` does **not** fix anything: you get an **opaque** response you can't read.

```js
// vite.config.js
export default {
  server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } },
}
```

## Related headers

- **CORP** (`Cross-Origin-Resource-Policy`), **COOP**, **COEP**: opt-in isolation headers (needed for `SharedArrayBuffer`).
- `<img crossorigin>` / `<script crossorigin>`: request in CORS mode so you can read pixels from canvas or get full error details from scripts.

## Interview questions

:::question
difficulty: medium
companies: Housing.com
### What is CORS and why does it exist?
The browser's **same-origin policy** blocks scripts from reading responses from a different origin (scheme+host+port), protecting users' authenticated data from malicious sites. **CORS** is a header-based protocol letting a server opt in: it responds with `Access-Control-Allow-Origin` (and related headers) naming origins allowed to read its responses. For non-simple requests the browser sends an `OPTIONS` **preflight** first. It's enforced by browsers only; servers, curl and Postman don't care.
:::

:::question
difficulty: medium
### What triggers a preflight request?
Any request that isn't "simple": a method other than GET/HEAD/POST; a `Content-Type` other than `text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded` (so **JSON bodies** trigger it); or custom/non-safelisted headers like `Authorization`. The browser sends `OPTIONS` with `Access-Control-Request-Method/Headers`; the server must reply with matching `Allow-*` headers. `Access-Control-Max-Age` caches the result.
:::

:::question
difficulty: easy
### Can you fix a CORS error from the frontend?
Not really — the **server** must send the right headers. From the frontend you can avoid the cross-origin call: a dev-server proxy, or serving the API under the same origin via a reverse proxy/BFF. `mode: 'no-cors'` only gives an unreadable opaque response. Browser extensions that disable CORS are for debugging only.
:::

:::question
difficulty: hard
### Why can't you use `Access-Control-Allow-Origin: *` with credentials?
With `*`, any website could make credentialed requests (carrying the user's cookies) and read the responses — precisely the attack the same-origin policy prevents. So the spec requires an **explicit** origin when `Access-Control-Allow-Credentials: true`, forcing the server to consciously allowlist trusted origins. Echoing back any `Origin` blindly reintroduces the same vulnerability.
:::

## Challenges

:::challenge
difficulty: medium
### Diagnose the request
Your SPA at `https://shop.com` calls:
```js
fetch('https://api.shop.com/cart', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
  body: JSON.stringify(item),
})
```
The server responds to everything with `Access-Control-Allow-Origin: *`. List every reason this fails and the headers the server must send.
@@@solution
- JSON content type + `Authorization` header → **preflight** `OPTIONS` is sent. The server must respond 2xx to OPTIONS (without requiring the bearer token) with:
  - `Access-Control-Allow-Origin: https://shop.com` (explicit — `*` is invalid with credentials)
  - `Access-Control-Allow-Credentials: true`
  - `Access-Control-Allow-Methods: POST` (or a list)
  - `Access-Control-Allow-Headers: Content-Type, Authorization`
  - optionally `Access-Control-Max-Age: 600`
- The actual POST response must also include `Access-Control-Allow-Origin: https://shop.com` and `Access-Control-Allow-Credentials: true`, plus `Vary: Origin`.
- Cookies must be `SameSite=None; Secure` if the API is cross-*site* — but `shop.com` and `api.shop.com` are **same-site** (same registrable domain), so `Lax` cookies still work; it's cross-origin, not cross-site.
:::

## Quick check

:::quiz
### Which request will be preflighted?
- [ ] GET with an Accept header
- [ ] POST with Content-Type: application/x-www-form-urlencoded
- [x] POST with Content-Type: application/json
- [ ] HEAD request
@@@explain
`application/json` is not a CORS-safelisted content type.
:::

:::quiz
### `https://app.site.com` and `https://api.site.com` are…
- [ ] Same origin and same site
- [x] Different origins but the same site
- [ ] Different sites
- [ ] Same origin, different site
@@@explain
Origin includes the full host; "site" is the scheme + registrable domain (site.com).
:::
