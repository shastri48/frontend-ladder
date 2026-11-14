---
title: Authentication, Tokens, Cookies and OAuth
summary: AuthN vs AuthZ, sessions vs JWTs, where to store tokens, refresh flows, route protection and OAuth 2.0 / OIDC with PKCE for SPAs.
minutes: 22
---

## Authentication vs authorisation

- **Authentication (AuthN)** — *who are you?* Login, passwords, OTP, passkeys, SSO.
- **Authorisation (AuthZ)** — *what are you allowed to do?* Roles, permissions, ownership checks.

```text
 401 Unauthorized  → not authenticated (actually "unauthenticated"): log in
 403 Forbidden     → authenticated, but not allowed
```

:::callout danger The golden rule
The frontend can **hide** things (a disabled "Refund" button, a protected route) but it can never **enforce** anything. Anyone can open DevTools and call your API directly. **Every authorisation check must happen on the server.** Frontend checks are UX.
:::

## Sessions vs tokens

| | Server session (cookie) | JWT (self-contained token) |
|---|---|---|
| What the client holds | Opaque session ID cookie | Signed token with claims (`sub`, `exp`, `roles`) |
| Server state | Session store (Redis/DB) | Stateless verification by signature |
| Revocation | Delete the session — instant | Hard; needs short expiry + denylist/rotation |
| CSRF | Risk (cookies auto-sent) → SameSite + tokens | No risk if sent via header |
| XSS | `HttpOnly` cookie can't be read | Token readable if stored in JS-accessible storage |
| Scale/microservices | Shared session store | Easy to verify anywhere |

A JWT is `base64url(header).base64url(payload).signature`. It's **signed, not encrypted** — anyone can decode the payload, so never put secrets in it. The frontend may decode it for display (`exp`, name) but must not trust it for security decisions.

## Where should an SPA store tokens?

| Storage | XSS can steal it? | Sent automatically (CSRF)? | Survives reload? |
|---|---|---|---|
| `localStorage` / `sessionStorage` | **Yes** | No | Yes / per tab |
| JS memory (variable) | Yes while page runs (harder) | No | No |
| `HttpOnly; Secure; SameSite` cookie | **No** (can't read) | Yes → mitigate with SameSite + CSRF token | Yes |

Industry-recommended pattern (often via a **BFF — Backend-for-Frontend**):

- **Refresh token** in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to the refresh endpoint path.
- **Access token** short-lived (5–15 min), kept **in memory** (or avoided entirely by having the BFF hold tokens and the browser hold only a session cookie).
- On load or 401, call `/auth/refresh` (cookie sent automatically) to get a new access token; **rotate** refresh tokens on each use and detect reuse.

Note: XSS is game over regardless — an attacker can make authenticated requests from the page even if they can't exfiltrate an `HttpOnly` cookie. Storage choice limits *token theft* (persistent offline abuse), not XSS itself.

## Access + refresh flow

:::visual auth-flow
:::

```js
// api.js — single-flight refresh with request replay
let accessToken = null
let refreshPromise = null

async function refresh() {
  refreshPromise ??= fetch('/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(r => { if (!r.ok) throw new Error('SESSION_EXPIRED'); return r.json() })
    .then(({ token }) => { accessToken = token; return token })
    .finally(() => { refreshPromise = null })
  return refreshPromise
}

export async function api(path, options = {}, retried = false) {
  const res = await fetch(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401 && !retried) {
    try { await refresh() } catch { redirectToLogin(); throw new Error('Unauthenticated') }
    return api(path, options, true)       // replay once with the new token
  }
  return res
}
```

Key details interviewers look for:
- **Single-flight refresh** — 10 concurrent 401s must trigger **one** refresh, all waiting on the same promise.
- **Retry once**, then log out (avoid infinite loops).
- **Proactive refresh** shortly before `exp` (timer) to avoid user-visible 401s.
- **Cross-tab sync** — log out everywhere via `BroadcastChannel` or the `storage` event.
- **Clock skew** — rely on server 401s, not just client `exp` comparisons.

## Route protection in React

```jsx
function RequireAuth({ children, roles }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.some(r => user.roles.includes(r))) return <Navigate to="/403" replace />
  return children
}

<Route path="/admin" element={<RequireAuth roles={['admin']}><AdminPage /></RequireAuth>} />
```

After login, navigate back to `location.state.from`. With SSR frameworks (Next.js), protect routes in **middleware/server components** so protected HTML never reaches unauthenticated users. Also code-split admin bundles so their code isn't shipped to everyone (it's not secret, but there's no reason to expose it).

## OAuth 2.0 and OpenID Connect for SPAs

- **OAuth 2.0** — delegated **authorisation**: "let app X access my Google Drive". Produces **access tokens**.
- **OIDC** — an identity layer on top: adds an **ID token** (JWT about the user) for **authentication** ("Sign in with Google").

SPAs must use **Authorization Code flow with PKCE** (the Implicit flow is deprecated):

```text
1. App creates code_verifier (random) and code_challenge = BASE64URL(SHA256(verifier))
2. Redirect → /authorize?response_type=code&client_id=…&redirect_uri=…&code_challenge=…&state=…
3. User logs in at the identity provider, consents
4. IdP redirects → redirect_uri?code=XYZ&state=…   (check state = CSRF protection)
5. App POSTs code + code_verifier → /token
6. IdP verifies SHA256(verifier) == challenge → returns tokens
```

PKCE proves that whoever redeems the code is whoever started the flow, so an intercepted code is useless. Even better for security-sensitive apps: let a **BFF** do the token exchange so tokens never touch the browser.

:::question
difficulty: medium
companies: Razorpay
### What's the difference between authentication and authorization? How do auth tokens and cookies relate?
Authentication proves identity (login); authorisation decides permissions (roles, ownership). After authenticating, the server gives the client proof of identity: either a **session cookie** (opaque ID, server stores the session) or a **token** (often a JWT) sent in the `Authorization` header. Cookies are a *transport/storage mechanism* the browser attaches automatically; tokens are *credentials* that can be stored in a cookie or in JS. Cookies bring CSRF considerations; JS-readable tokens bring XSS-theft considerations. Authorisation is enforced server-side on every request using that identity.
:::

:::question
difficulty: hard
### Where should you store a JWT in a browser app?
Avoid `localStorage` for long-lived tokens: any XSS can read and exfiltrate them. Preferred: keep a **short-lived access token in memory** and a **refresh token in an `HttpOnly`, `Secure`, `SameSite` cookie** (rotated on use), or use a **BFF** so the browser only holds an `HttpOnly` session cookie. Cookies require CSRF defences (SameSite + token/origin checks). Whichever you choose, XSS prevention (CSP, sanitisation) remains essential because XSS can still act as the user.
:::

:::question
difficulty: medium
### How do you handle JWTs, token expiry and route-level auth in a React app?
- Auth provider holding `user`/`status`; bootstraps on load by calling `/auth/refresh` or `/me`.
- API client attaches the access token, catches 401, performs a **single-flight refresh**, replays the request once, else logs out and redirects to login with a `from` location.
- Proactive refresh before expiry; cross-tab logout via BroadcastChannel.
- `RequireAuth` wrapper / route loaders guarding routes and roles; show a loader during bootstrap to avoid flashing the login page.
- Server enforces all permissions; frontend only hides UI.
- On logout: clear memory, call server to revoke refresh token, clear query caches (so the next user doesn't see stale data).
:::

:::question
difficulty: medium
### What is PKCE and why do SPAs need it?
Proof Key for Code Exchange. SPAs are **public clients** — they can't keep a client secret. Without PKCE, an attacker who intercepts the authorization code (via a malicious app registered for the redirect, logs, or history) could exchange it for tokens. PKCE has the app generate a random `code_verifier`, send its SHA-256 hash (`code_challenge`) in the authorize request, and present the original verifier when exchanging the code. Only the party that started the flow knows the verifier, so a stolen code is useless.
:::

:::challenge
difficulty: hard
### Implement a single-flight token refresh
Ten components fire requests simultaneously right after the access token expired. Write `createAuthFetch({ getToken, refresh })` returning `authFetch(url)` such that: each request uses the current token; on a 401 response, **only one** `refresh()` call happens even with many concurrent 401s; requests replay once after refresh; if refresh fails, all waiting requests reject with `Error('LOGGED_OUT')`. Assume `fetchImpl(url, token)` resolves to `{ status }`.
@@@starter
```js
function createAuthFetch({ getToken, refresh, fetchImpl }) {
  // return async function authFetch(url) { ... }
}
```
@@@tests
```js
test('refreshes once for concurrent 401s', async () => {
  let token = 'old', refreshCalls = 0
  const fetchImpl = async (url, t) => { await sleep(5); return { status: t === 'new' ? 200 : 401, url } }
  const authFetch = createAuthFetch({
    getToken: () => token,
    refresh: async () => { refreshCalls++; await sleep(20); token = 'new' },
    fetchImpl,
  })
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => authFetch('/r' + i)))
  expect(refreshCalls).toBe(1)
  expect(results.every(r => r.status === 200)).toBe(true)
})
test('rejects all when refresh fails', async () => {
  const authFetch = createAuthFetch({
    getToken: () => 'old',
    refresh: async () => { await sleep(5); throw new Error('nope') },
    fetchImpl: async () => ({ status: 401 }),
  })
  const settled = await Promise.allSettled([authFetch('/a'), authFetch('/b')])
  expect(settled.every(s => s.status === 'rejected' && s.reason.message === 'LOGGED_OUT')).toBe(true)
})
test('does not loop forever', async () => {
  let refreshCalls = 0
  const authFetch = createAuthFetch({ getToken: () => 'x', refresh: async () => { refreshCalls++ }, fetchImpl: async () => ({ status: 401 }) })
  const res = await authFetch('/a')
  expect(res.status).toBe(401)
  expect(refreshCalls).toBe(1)
})
```
@@@solution
```js
function createAuthFetch({ getToken, refresh, fetchImpl }) {
  let inflight = null   // shared refresh promise

  function refreshOnce() {
    if (!inflight) {
      inflight = Promise.resolve()
        .then(refresh)
        .catch(() => { throw new Error('LOGGED_OUT') })
        .finally(() => { inflight = null })
    }
    return inflight
  }

  return async function authFetch(url) {
    const res = await fetchImpl(url, getToken())
    if (res.status !== 401) return res
    await refreshOnce()                 // concurrent callers await the same promise
    return fetchImpl(url, getToken())   // replay exactly once
  }
}
```
**Why it works**: the first 401 creates the refresh promise; the other nine see `inflight` and await it. `finally` resets it so a later expiry can refresh again. Replay happens once, so a persistent 401 returns instead of looping. In production also: proactive refresh before `exp`, redirect to login on `LOGGED_OUT`, and broadcast logout across tabs.
:::

:::quiz
### What HTTP status means "authenticated but not permitted"?
- [ ] 401
- [x] 403
- [ ] 404
- [ ] 419
@@@explain
401 means unauthenticated (despite its name); 403 means forbidden for this identity.
:::

:::quiz
### Is a JWT payload encrypted?
- [ ] Yes, always
- [x] No — it's base64url-encoded and signed, readable by anyone
- [ ] Only the exp claim
- [ ] Only in HTTPS
@@@explain
Signing ensures integrity, not confidentiality. Use JWE if you need encryption, and never put secrets in a JWT.
:::
