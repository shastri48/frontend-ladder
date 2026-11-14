---
title: CSRF, CORS and Clickjacking
summary: Why browsers attach cookies to cross-site requests, how SameSite and CSRF tokens stop forged actions, what CORS does (and doesn't) protect, and how framing attacks work.
minutes: 18
---

## CSRF — Cross-Site Request Forgery

XSS runs attacker code **inside** your site. CSRF is different: the attacker's code runs on **their** site but makes the victim's browser send a request **to yours** — and the browser helpfully attaches your cookies.

```html
<!-- on evil.example -->
<form action="https://bank.com/transfer" method="POST" id="f">
  <input name="to" value="attacker" /><input name="amount" value="50000" />
</form>
<script>document.getElementById('f').submit()</script>
```

If `bank.com` authenticates with a session cookie and does nothing else, the transfer succeeds: the request is real, the cookie is real — only the **intent** is forged. Note the attacker **can't read the response**; CSRF is about *causing state changes*.

:::callout analogy The signed blank cheque
Your cookie is like a signature the bank recognises. CSRF is someone slipping a pre-filled cheque into your pile of papers; you "sign" it automatically because your browser signs everything addressed to the bank.
:::

### Defences

1. **`SameSite` cookies** (the modern baseline):
   - `SameSite=Lax` (Chrome's default): cookies are **not** sent on cross-site subresource requests or POSTs, only on top-level GET navigations. Blocks the classic form-POST attack.
   - `SameSite=Strict`: never sent cross-site (even clicking a link from email arrives logged-out).
   - `SameSite=None; Secure`: always sent — needed for legit cross-site embeds, and must be paired with other CSRF defences.
2. **Anti-CSRF tokens** — a random token tied to the session, embedded in forms or sent as a header; the server rejects requests without it. The attacker can't read it due to the same-origin policy. Variants: synchronizer token (stored server-side), **double-submit cookie** (token in a cookie and echoed in a header).
3. **Custom headers on API calls** — e.g. `X-Requested-With` or `Authorization: Bearer`. Cross-site forms can't set custom headers, and cross-site `fetch` with custom headers triggers a CORS preflight the server will reject.
4. **Check `Origin`/`Sec-Fetch-Site` headers** server-side — reject state-changing requests whose origin isn't yours.
5. **Never change state with GET.**
6. Re-authentication / step-up for sensitive actions (payments, password change).

| Auth style | CSRF risk |
|---|---|
| Cookie session | Yes — needs SameSite + token/origin checks |
| `Authorization: Bearer` from JS memory | No CSRF (browser doesn't auto-attach), but token is exposed to XSS |

## CORS — a relaxation, not a protection

The **same-origin policy (SOP)** stops scripts on `evil.com` from **reading** responses from `api.bank.com`. **CORS (Cross-Origin Resource Sharing)** is how a server **opts in** to letting specific other origins read its responses.

:::visual cors-preflight
:::

- **Simple requests** (GET/HEAD/POST with simple headers and form/text content types) are sent directly; the browser then checks `Access-Control-Allow-Origin` before exposing the response to JS.
- **Preflighted requests** (PUT/DELETE/PATCH, JSON content type, custom headers) first send an `OPTIONS` request; the server must answer with allowed methods/headers/origin.
- **Credentials**: with `fetch(url, { credentials: 'include' })` the server must reply `Access-Control-Allow-Credentials: true` and a **specific** origin — `*` isn't allowed with credentials.

```http
Access-Control-Allow-Origin: https://app.myshop.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 600
Vary: Origin
```

### Why CORS doesn't stop CSRF

CORS controls **reading the response** in the browser. A simple cross-site POST (like the form above) is **still sent** and still executes on the server; the browser just hides the response from the attacker. So "we have CORS configured" is not a CSRF defence. Preflights do block *non-simple* requests from being sent, which is why JSON APIs requiring `Content-Type: application/json` + server-side content-type enforcement get some protection — but rely on SameSite/tokens explicitly.

Common CORS mistakes:
- Reflecting any `Origin` back with `Allow-Credentials: true` — lets any site read authenticated data.
- Allowing `null` origin (sandboxed iframes, file://).
- Regex allow-lists like `/bank\.com$/` matching `evilbank.com`.
- Thinking CORS errors are frontend bugs — the fix is always on the server (or via a same-origin proxy in dev).

## Clickjacking

The attacker loads your site in an invisible `<iframe>` on top of a decoy page ("Click to win!"); the user's click actually lands on your "Delete account" or "Confirm payment" button.

Defences:
- `Content-Security-Policy: frame-ancestors 'none'` (or `'self'`/specific partners).
- Legacy: `X-Frame-Options: DENY` / `SAMEORIGIN`.
- `SameSite` cookies also mean the framed page is logged-out in many cases.

## Other headers worth knowing

| Header | Purpose |
|---|---|
| `Strict-Transport-Security` | Force HTTPS for future visits (HSTS) |
| `X-Content-Type-Options: nosniff` | Stop MIME sniffing (e.g. treating an upload as script) |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limit URL leakage (tokens in query strings!) |
| `Permissions-Policy` | Disable camera/mic/geolocation for your page and iframes |
| `Cross-Origin-Opener-Policy` | Isolate your window from cross-origin popups (Spectre, tabnabbing) |

Also: open links to external sites with `rel="noopener noreferrer"` (modern browsers default `noopener` for `target=_blank`), and validate `event.origin` in `postMessage` handlers.

:::question
difficulty: medium
companies: Walmart, Razorpay
### How do you prevent CSRF attacks?
- Session cookies with `SameSite=Lax` (or `Strict`), `Secure`, `HttpOnly`.
- Anti-CSRF tokens (synchronizer or double-submit) on every state-changing request, sent as a header by the SPA's API client.
- Verify `Origin`/`Referer`/`Sec-Fetch-Site` on the server for unsafe methods.
- No state changes via GET; require JSON content type and custom headers so cross-site forms can't produce valid requests.
- Re-authentication for critical actions.
Token-in-header (Bearer) auth isn't vulnerable to CSRF since browsers don't attach it automatically — but then you must protect the token from XSS.
:::

:::question
difficulty: medium
### Does configuring CORS protect against CSRF?
No. CORS only decides whether the browser lets JavaScript on another origin **read** a response. A simple cross-site request (form POST, image GET) is still **sent** with cookies, and the server still performs the action. CSRF defences are SameSite cookies, CSRF tokens and origin checks. CORS misconfiguration can, however, *add* risk — e.g. reflecting arbitrary origins with credentials lets attacker sites read private data.
:::

:::question
difficulty: easy
companies: Housing.com
### What is CORS and why do we get CORS errors?
Browsers enforce the same-origin policy: JS from origin A (scheme + host + port) can't read responses from origin B. CORS is a set of response headers (`Access-Control-Allow-Origin` and friends) with which origin B explicitly allows A. A CORS error means the server didn't send the right headers for this origin/method/headers combination (or failed the preflight `OPTIONS`). Fix it on the server, or use a same-origin proxy (dev server proxy, BFF). It's enforced only by browsers — curl and servers don't care.
:::

:::challenge
difficulty: hard
### Review this server config and frontend call
```js
// server (Express)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  next()
})
app.get('/api/account/delete', requireSession, deleteAccount)

// login sets: Set-Cookie: sid=abc; Path=/
```
List the vulnerabilities and fixes.
@@@solution
1. **Reflected origin + credentials**: any website can make credentialed requests and **read** responses (account data, CSRF tokens). Fix: allow-list exact origins, add `Vary: Origin`.
2. **State change via GET**: `/api/account/delete` can be triggered by `<img src="https://site/api/account/delete">` from anywhere. Fix: use `DELETE`/`POST` with CSRF protection and re-authentication.
3. **Cookie flags missing**: `sid` lacks `HttpOnly` (readable by XSS), `Secure` (sent over HTTP), `SameSite` (older browsers / explicit intent). Fix: `Set-Cookie: sid=…; Path=/; HttpOnly; Secure; SameSite=Lax`.
4. **No CSRF token/origin check** on unsafe methods. Fix: double-submit token header + `Origin` validation.
5. Consider `frame-ancestors 'none'` so a "delete" confirmation can't be clickjacked.
:::

:::quiz
### With `credentials: 'include'`, which Access-Control-Allow-Origin value is invalid?
- [ ] https://app.example.com
- [x] *
- [ ] The request's exact origin from an allow-list
- [ ] It depends on the method
@@@explain
Browsers reject wildcard origins on credentialed responses.
:::

:::quiz
### Which cookie attribute is the primary modern CSRF defence?
- [ ] HttpOnly
- [ ] Secure
- [x] SameSite
- [ ] Domain
@@@explain
SameSite controls whether cookies are attached to cross-site requests. HttpOnly is about XSS reading the cookie.
:::
