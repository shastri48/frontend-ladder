---
title: Secrets, Crypto and Supply-Chain Security
summary: Why there are no secrets in frontend bundles, handling env vars, integrating with APIs securely, Web Crypto (crypto.subtle) vs plain hashes, and protecting against malicious dependencies.
minutes: 16
---

## There are no secrets in the frontend

Everything you ship to a browser — JS bundles, source maps, environment variables baked at build time, network requests — is **public**. Minification is not protection.

```js
// vite.config / .env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...   // ✅ designed to be public
VITE_STRIPE_SECRET_KEY=sk_live_...        // ❌ now in every user's bundle
```

Build tools expose only prefixed variables (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`) precisely to make this explicit: **anything with the prefix is public.**

:::callout danger Real incidents
Leaked secret keys in bundles and public repos are scanned by bots within minutes. Cloud bills of thousands of dollars and data breaches have started with a single `.env` committed or an admin token inlined into JS.
:::

### How to handle things that need secrets

- Call third-party APIs that need secret keys **from your server or a BFF / serverless function**, which adds the key and enforces rate limits and auth.
- Use **public, restricted keys** where vendors offer them (Maps keys restricted by HTTP referrer, publishable payment keys).
- Store real secrets in the deployment platform's secret manager (Vercel/AWS/GCP), never in the repo. Add `.env*.local` to `.gitignore` and run **secret scanning** (GitHub secret scanning, gitleaks) in CI.
- **Source maps**: upload them privately to your error tracker (Sentry) and don't serve them publicly if your code reveals internal endpoints or logic you'd rather not expose.
- **Different config per environment** (dev/staging/prod) via build-time env or a runtime `/config.json` fetched at startup (useful when one build artifact is promoted across environments).

## Integrating with backend APIs securely

- **HTTPS everywhere** + HSTS; no mixed content.
- **Server-side validation** of every input; the client validates for UX only.
- **Least privilege** — scopes/roles in tokens; the frontend shouldn't receive fields the user can't see (filter on server, not with CSS).
- **Avoid leaking data in URLs** (tokens/PII in query strings end up in logs, history and `Referer` headers).
- **Rate limiting & bot protection** on sensitive endpoints (OTP, login).
- **Idempotency keys** for payments so retries don't double charge.
- **Error messages** shouldn't reveal stack traces or whether an email exists.
- **CORS** allow-list exact origins; prefer same-origin APIs via a reverse proxy/BFF.
- **Validate responses** too (zod schemas) — defends against unexpected shapes and some injection paths.

## crypto.subtle vs a plain hash function

`crypto.subtle` (the **Web Crypto API**) provides native, audited, constant-time cryptographic primitives: SHA-256/384/512 digests, HMAC, AES-GCM encryption, RSA/ECDSA signatures, key derivation (PBKDF2, HKDF), and secure random numbers via `crypto.getRandomValues()` / `crypto.randomUUID()`. It's asynchronous (Promise-based), works only in **secure contexts** (HTTPS), and can mark keys **non-extractable** so JS can't read the raw key material.

```js
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
```

A "plain hash function" — like the classic djb2 / Java `hashCode` you write for hash maps — is fast and fine for **bucketing, cache keys and checksums against accidental change**, but it's **not cryptographic**: collisions are easy to create, it's predictable, and it can't detect tampering. `Math.random()` is likewise not cryptographically secure.

| Use case | Use |
|---|---|
| Cache key, hash map bucket, dedupe | Plain fast hash (djb2, murmur) |
| Integrity check of a downloaded file | SHA-256 via `crypto.subtle.digest` (or SRI attribute) |
| Random IDs, nonces, PKCE verifier | `crypto.getRandomValues` / `crypto.randomUUID` |
| PKCE code challenge | SHA-256 via `crypto.subtle` |
| Encrypt data at rest in IndexedDB | AES-GCM with a non-extractable key |
| Password hashing | **Server-side** (bcrypt/argon2), never only on the client |

Caveat: client-side crypto can't protect against an attacker who controls the page (XSS) — they can call the same APIs. It's useful for integrity, end-to-end encryption designs and protocol steps like PKCE.

## Supply-chain risk

A typical React app pulls in 1,000+ transitive npm packages. Any of them can run code at **install time** (`postinstall`) on developer/CI machines, or ship malicious code into your **bundle** that runs in users' browsers (skimming card details — the Magecart pattern — or stealing tokens).

Mitigations:
- **Lockfiles committed** and `npm ci` in CI for reproducible installs.
- **Audit**: `npm audit`, Dependabot/Renovate, Snyk/Socket for malicious-package detection.
- **Minimise dependencies** — do you need a package for `left-pad`?
- **Pin & review** upgrades; watch for maintainer changes and typosquats (`reacct-dom`).
- Disable install scripts where possible (`npm config set ignore-scripts true` with an allow-list) or use pnpm's `onlyBuiltDependencies`.
- **Subresource Integrity (SRI)** for third-party scripts from CDNs:

```html
<script src="https://cdn.example.com/lib@3.2.1/lib.min.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

- **CSP** limiting where scripts load from and where data can be sent (`connect-src`) — reduces exfiltration even if a dependency is compromised.
- **Isolate payment fields** in iframes from the payment provider (Stripe Elements, hosted fields) so your page's JS never touches card data — this also reduces PCI scope.
- Generate an **SBOM** and track licences.

:::question
difficulty: medium
### How do you manage environment variables and secrets in a frontend project?
Separate **public config** (API base URL, publishable keys, feature flags) from **secrets**. Only public values go into the build via prefixed env vars (`VITE_`, `NEXT_PUBLIC_`), and everyone on the team should treat them as public. Secrets stay on the server/BFF/serverless functions, stored in the platform's secret manager, never committed (`.gitignore`, secret scanning in CI). Use per-environment configuration (build-time env per deploy or a runtime config endpoint when promoting one artifact through environments), and keep source maps private.
:::

:::question
difficulty: medium
companies: Coinbase
### crypto.subtle vs a plain hash function — when would you use each?
`crypto.subtle` is the browser's Web Crypto API: native, secure implementations of SHA-2 digests, HMAC, AES-GCM, ECDSA/RSA, PBKDF2/HKDF, with non-extractable keys and async APIs, only in secure contexts. Use it whenever **security** matters: integrity checks, PKCE challenges, signatures, encryption. A plain hash (djb2, FNV, murmur) is fast and fine for hash tables, cache keys and change detection, but trivially collidable and predictable, so never use it for anything adversarial. Similarly, use `crypto.getRandomValues`, not `Math.random`, for tokens and nonces.
:::

:::question
difficulty: medium
### What is a supply-chain attack and how do frontend teams defend against it?
An attacker compromises something you depend on — an npm package (malicious update, hijacked maintainer account, typosquat), a CDN-hosted script, a build tool or a CI action — so their code runs on dev machines/CI (install scripts) or in users' browsers (bundled code). Defences: lockfiles + `npm ci`, minimal dependencies, automated audits and malicious-package detection, reviewed/pinned upgrades, ignoring install scripts by default, SRI for CDN scripts, strict CSP (`script-src`, `connect-src`) to limit execution and exfiltration, isolating sensitive inputs in provider iframes, and least-privilege CI tokens.
:::

:::challenge
difficulty: medium
### Generate a PKCE pair with Web Crypto
Write `async function createPkcePair()` that returns `{ verifier, challenge }` where `verifier` is a 64-character random string using URL-safe characters, and `challenge` is `BASE64URL(SHA-256(verifier))` without padding.
@@@solution
```js
function base64url(bytes) {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function createPkcePair() {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const random = crypto.getRandomValues(new Uint8Array(64))
  // modulo bias is negligible here because 256 % 66 is small; a stricter version uses rejection sampling
  const verifier = Array.from(random, b => charset[b % charset.length]).join('')

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64url(new Uint8Array(digest))
  return { verifier, challenge }
}
```
**Notes**: `crypto.getRandomValues` (not `Math.random`) for unpredictability; `crypto.subtle` only exists in secure contexts (HTTPS/localhost); store the verifier in `sessionStorage` across the redirect and delete it after the token exchange; also generate and verify a random `state` to prevent login CSRF.
:::

:::quiz
### A `VITE_API_SECRET` env var is used in a React component. Who can read it?
- [ ] Only the build server
- [ ] Only logged-in users
- [x] Anyone who loads the app — it's inlined into the public bundle
- [ ] Nobody, because it's minified
@@@explain
Prefixed env vars are embedded at build time into client code.
:::

:::quiz
### What does Subresource Integrity (SRI) protect against?
- [ ] XSS in your own code
- [x] A third-party script file being modified on the CDN
- [ ] CSRF
- [ ] Slow CDN responses
@@@explain
The browser refuses to execute a resource whose hash doesn't match the integrity attribute.
:::
