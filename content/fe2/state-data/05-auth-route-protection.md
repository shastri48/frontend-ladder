---
title: Auth & Route Protection
summary: Authentication vs authorization, JWTs, access/refresh tokens, where to store tokens, silent refresh and route guards.
minutes: 22
---

## Authentication vs authorization

- **Authentication (AuthN)** — *who are you?* Login with password, OAuth/SSO, passkeys, OTP. Result: a session or token proving identity.
- **Authorization (AuthZ)** — *what are you allowed to do?* Roles and permissions checked on every request: can user 42 refund order 9?

:::callout danger The frontend can't enforce security
Hiding a button or protecting a route on the client is **UX**, not security. Anyone can edit JS, call your API with curl or flip `isAdmin` in DevTools. The **server must authenticate and authorise every request**. The frontend's job: carry credentials correctly, keep them safe from theft, and give a smooth experience.
:::

## Two families: sessions vs tokens

| | Session cookie | JWT (bearer token) |
|---|---|---|
| What the client holds | Opaque session id in a cookie | Signed token containing claims |
| Server state | Session store (Redis/DB) | Stateless verification of signature |
| Sent how | Browser auto-attaches cookie | `Authorization: Bearer <jwt>` header (or cookie) |
| Revocation | Delete the session — instant | Hard until expiry → keep access tokens short-lived |
| CSRF risk | Yes (auto-sent) → SameSite, CSRF tokens | No if sent via header |
| XSS risk | Low if `HttpOnly` | High if stored in localStorage |

## What is a JWT?

`header.payload.signature`, each part base64url-encoded:

```text
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiI0MiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTcwMDAwMDkwMH0 . 5mhBHq...
   {"alg":"HS256"}         {"sub":"42","role":"admin","exp":1700000900}               HMAC(header.payload, secret)
```

- The payload is **encoded, not encrypted** — anyone can read it. Never put secrets in it.
- The **signature** lets the server verify the token wasn't tampered with.
- `exp` (expiry), `iat` (issued at), `sub` (subject/user id) are standard claims.

The client may decode the payload to read the user's name or `exp` for UX, but must never *trust* it for security decisions.

## Access + refresh tokens

Short-lived **access tokens** (5–15 minutes) limit damage if stolen. Long-lived **refresh tokens** (days) obtain new access tokens without re-login.

:::visual auth-flow
:::

```text
login ──► server returns access token (in memory) + refresh token (HttpOnly Secure SameSite cookie)
API call with access token ──► 200
... 15 minutes later ...
API call ──► 401 (expired) ──► POST /auth/refresh (cookie sent automatically)
         ◄── new access token (+ rotated refresh token) ──► replay original request ──► 200
refresh fails (revoked/expired) ──► clear state, redirect to /login?returnTo=...
```

## Where to store tokens

| Storage | XSS can steal it? | CSRF? | Survives reload? | Verdict |
|---|---|---|---|---|
| `localStorage` / `sessionStorage` | **Yes** — any injected script reads it | No | Yes | Avoid for sensitive tokens |
| JS memory (variable/state) | Harder (only while page runs) | No | **No** — refresh needed on reload | Good for access tokens |
| `HttpOnly; Secure; SameSite` cookie | **No** — JS can't read it | Mitigated by SameSite + CSRF token | Yes | Best for refresh tokens / sessions |

A common robust setup: **refresh token in an HttpOnly cookie scoped to `/auth/refresh`**, **access token in memory**. On app load, call `/auth/refresh` to get a fresh access token (silent login). Note that XSS is still game over in any setup (the attacker can make requests *as* the user while they're on the page) — so prevent XSS (see FE3 → Security).

## The API client: attach token, refresh once, replay

```js
let accessToken = null
let refreshPromise = null // single-flight: many 401s → one refresh

export const setAccessToken = t => { accessToken = t }

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch('/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('refresh failed'); return r.json() })
      .then(({ accessToken: t }) => { accessToken = t; return t })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function apiFetch(url, options = {}, retried = false) {
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, ...(accessToken && { Authorization: `Bearer ${accessToken}` }) },
  })
  if (res.status === 401 && !retried) {
    try {
      await refreshAccessToken()
      return apiFetch(url, options, true) // replay once
    } catch {
      setAccessToken(null)
      window.dispatchEvent(new Event('auth:logout'))
      throw new Error('Session expired')
    }
  }
  return res
}
```

Key details: **single-flight refresh** (ten parallel 401s trigger one refresh, not ten — and with refresh-token rotation, ten would invalidate each other), **retry once** to avoid loops, broadcast logout. Proactive refresh shortly before `exp` avoids the failed request entirely.

## Auth state in React

```jsx
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null })

  useEffect(() => {
    refreshAccessToken() // silent login on load
      .then(() => apiFetch('/api/me')).then(r => r.json())
      .then(user => setState({ status: 'authenticated', user }))
      .catch(() => setState({ status: 'anonymous', user: null }))

    const onLogout = () => setState({ status: 'anonymous', user: null })
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  const value = useMemo(() => ({
    ...state,
    login: async creds => {
      const res = await fetch('/auth/login', { method: 'POST', credentials: 'include', body: JSON.stringify(creds), headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error('Invalid credentials')
      const { accessToken, user } = await res.json()
      setAccessToken(accessToken)
      setState({ status: 'authenticated', user })
    },
    logout: async () => {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
      setAccessToken(null)
      setState({ status: 'anonymous', user: null })
    },
  }), [state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
```

## Route-level protection

```jsx
function RequireAuth({ roles }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'checking') return <FullPageSpinner />           // avoid flashing the login page
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />
  return <Outlet />
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <Dashboard /> },
      { element: <RequireAuth roles={['admin']} />, children: [{ path: '/admin', element: <Admin /> }] },
    ],
  },
])
```

Extras worth mentioning: sync logout across tabs (`BroadcastChannel` or `storage` event), idle timeout, clearing caches (React Query `queryClient.clear()`) on logout so the next user doesn't see old data, and in SSR frameworks doing the check in middleware/server so protected HTML is never sent.

:::question
difficulty: medium
companies: Razorpay
### What is the difference between authentication and authorization? How do auth tokens and cookies fit in?
Authentication verifies identity (login); authorization decides what that identity may do (permissions), checked on every server request. After authentication the server issues proof: either a **session id in a cookie** (server-side session store; browser sends it automatically; protect with `HttpOnly`, `Secure`, `SameSite` and CSRF tokens) or a **token** such as a JWT (signed, self-contained claims, usually sent in the `Authorization` header). Cookies are a *transport/storage* mechanism; tokens are a *credential format* — a JWT can be stored in a cookie too.
:::

:::question
difficulty: hard
### How do you handle JWTs, token expiry, and route-level auth in a React app?
Use short-lived access tokens kept in memory and a refresh token in an `HttpOnly; Secure; SameSite` cookie. A central API client attaches `Authorization: Bearer`, and on 401 performs a single-flight refresh, replays the request once, and logs out if refresh fails (optionally refresh proactively before `exp`). On load, silently refresh to restore the session. Auth state lives in a context/store with a `checking | authenticated | anonymous` status. Route guards (`<RequireAuth>` with `<Outlet/>`) show a spinner while checking, redirect anonymous users to `/login` with a return URL, and check roles. The server still authorises every request; on logout clear tokens and cached data and sync across tabs.
:::

:::question
difficulty: medium
### Is it safe to store a JWT in localStorage?
It's convenient but risky: any XSS vulnerability (including a compromised third-party script) can read localStorage and exfiltrate the token, giving the attacker long-term access from anywhere. Prefer HttpOnly cookies (unreadable by JS) for long-lived credentials and in-memory storage for short-lived access tokens. If you must use localStorage, keep tokens very short-lived, use a strict CSP and rigorously prevent XSS.
:::

:::challenge
difficulty: hard
### Single-flight refresh
Five API calls fire at once and all return 401. Write `getFreshToken()` so that only **one** refresh request is sent and all five calls wait for it.
@@@starter
```js
let refreshCalls = 0
async function callRefreshEndpoint() {
  refreshCalls++
  await sleep(50)
  return 'new-token'
}

let pending = null
async function getFreshToken() {
  // your code: use callRefreshEndpoint()
}
```
@@@tests
```js
test('only one refresh for concurrent callers', async () => {
  refreshCalls = 0
  const tokens = await Promise.all([1,2,3,4,5].map(() => getFreshToken()))
  expect(tokens).toEqual(['new-token','new-token','new-token','new-token','new-token'])
  expect(refreshCalls).toBe(1)
})
test('a later call after completion refreshes again', async () => {
  refreshCalls = 0
  await getFreshToken()
  await getFreshToken()
  expect(refreshCalls).toBe(2)
})
```
@@@solution
```js
let pending = null
async function getFreshToken() {
  if (!pending) {
    pending = callRefreshEndpoint().finally(() => { pending = null })
  }
  return pending
}
```
All concurrent callers receive the **same promise**. `finally` clears it once settled so a future expiry triggers a new refresh, and a failure doesn't get cached forever. This matters doubly with refresh-token rotation, where parallel refreshes would invalidate each other.
:::

:::quiz
### Which storage prevents JavaScript (and thus XSS) from reading a token?
- [ ] sessionStorage
- [x] An HttpOnly cookie
- [ ] IndexedDB
@@@explain
HttpOnly cookies are sent by the browser but never exposed to document.cookie.
:::

:::quiz
### A JWT payload is…
- [ ] Encrypted, so it's safe to put passwords in it
- [x] Base64url-encoded and readable by anyone; the signature prevents tampering
- [ ] Hashed and unreadable
@@@explain
Use JWE if you need encryption; standard JWS tokens are only signed.
:::
