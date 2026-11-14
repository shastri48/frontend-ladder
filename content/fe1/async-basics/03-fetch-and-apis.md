---
title: Fetching Data — fetch, JSON & Loading/Error States
summary: Talk to APIs with fetch, handle HTTP errors correctly, show loading and error UI, and understand JSON.
minutes: 15
---

## The request/response cycle

Your frontend rarely owns the data. It asks a **server** through an **API** (usually HTTP + JSON). Every call follows the same cycle:

```text
 Browser                                     Server
   │  GET /api/products?page=2               │
   │  Accept: application/json               │
   │ ──────────────────────────────────────► │
   │                                         │  look up data
   │  200 OK                                  │
   │  Content-Type: application/json          │
   │  [{"id":1,"name":"iPhone"}, ...]         │
   │ ◄────────────────────────────────────── │
```

- **Method**: `GET` (read), `POST` (create), `PUT`/`PATCH` (update), `DELETE`.
- **Status code**: `2xx` success, `3xx` redirect, `4xx` your request is wrong (401 unauthenticated, 403 forbidden, 404 not found, 422 validation), `5xx` server failed.
- **Headers**: metadata (`Content-Type`, `Authorization`, caching).
- **Body**: the payload, usually JSON.

## JSON in 30 seconds

JSON (JavaScript Object Notation) is a **text** format. It looks like JS objects but has strict rules: double-quoted keys and strings, no functions, no `undefined`, no comments, no trailing commas.

```js
const text = JSON.stringify({ id: 1, tags: ["a"], skip: undefined })
// '{"id":1,"tags":["a"]}'   — undefined is dropped

JSON.parse('{"id":1}').id   // 1
JSON.parse("{id:1}")        // SyntaxError — keys must be quoted
```

`JSON.stringify(value, replacer, space)` — the `replacer` can be a function `(key, value) => newValue` (to filter or transform fields) or an array of allowed keys; `space` pretty-prints.

## fetch basics

```js
const response = await fetch("https://api.example.com/products")
const products = await response.json()
```

Two awaits because there are two stages: **headers arrive** (the response object), then the **body streams in** (`.json()`, `.text()`, `.blob()` read it).

### The big gotcha: fetch doesn't reject on HTTP errors

`fetch` only rejects on **network failure** (offline, DNS failure, CORS blocked, aborted). A `404` or `500` is a *successful* fetch of an error response! You must check `response.ok` (true for 200–299):

```js
async function getJSON(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  return res.json()
}
```

### Sending data

```js
const created = await getJSON("/api/todos", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Learn fetch", done: false }),
})
```

### Query strings

```js
const params = new URLSearchParams({ q: "react hooks", page: "2" })
await fetch(`/api/search?${params}`) // properly encoded: q=react+hooks&page=2
```

## Loading, success and error states

Every data-fetching UI has (at least) these states. Model them explicitly:

```js
const ui = { status: "idle", data: null, error: null } // idle | loading | success | error

async function loadProducts() {
  render({ status: "loading", data: null, error: null })
  try {
    const data = await getJSON("/api/products")
    render({ status: "success", data, error: null })
  } catch (err) {
    render({ status: "error", data: null, error: err.message })
  }
}

function render(state) {
  if (state.status === "loading") root.textContent = "Loading…"
  else if (state.status === "error") root.textContent = `Something went wrong: ${state.error}`
  else if (state.status === "success" && state.data.length === 0) root.textContent = "No products yet"
  else if (state.status === "success") root.replaceChildren(...state.data.map(productCard))
}
```

Good UX checklist: a loading indicator (skeletons beat spinners), an **empty** state, a friendly error with a **retry** button, and disabling submit buttons while saving.

## Cancelling a request

When the user types fast into a search box or navigates away, old requests should be cancelled. `AbortController` does this:

```js
let controller

async function search(q) {
  controller?.abort()                       // cancel the previous request
  controller = new AbortController()
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
    renderResults(await res.json())
  } catch (err) {
    if (err.name === "AbortError") return   // expected, ignore
    showError(err)
  }
}
```

This also prevents **race conditions** — an older, slower response overwriting newer results. FE2 goes deep on this.

## fetch vs axios (preview)

| | `fetch` | axios |
|---|---|---|
| Built in | Yes | Library (~13 kB) |
| JSON | Manual `res.json()` + `JSON.stringify` | Automatic |
| HTTP errors (4xx/5xx) | Resolves — check `res.ok` | Rejects automatically |
| Interceptors | No (wrap it yourself) | Yes (auth headers, refresh) |
| Timeout | Via `AbortSignal.timeout(ms)` | `timeout` option |
| Upload progress | No (streams only) | Yes |

## Interview questions

:::question
difficulty: easy
### Why doesn't fetch reject on a 404 or 500?
Because from fetch's point of view the request succeeded: it reached the server and got a valid HTTP response. Fetch only rejects on network-level failures (no connection, DNS error, CORS failure, abort). You check `response.ok` (status 200–299) or `response.status` and throw yourself.
:::

:::question
difficulty: easy
companies: Accenture
### How do you integrate APIs and manage loading/error states?
Wrap fetch in a helper that checks `res.ok` and parses JSON. Model the UI as an explicit state machine — `idle → loading → success | error` (plus empty). Set loading before the request, success with data or error with a message after, and always clear loading in `finally`. Cancel stale requests with `AbortController`, show retry on error, and avoid updating UI for a component/page that's gone. In React this becomes a custom hook or a library like React Query.
:::

:::question
difficulty: medium
companies: Intuit
### What can the replacer in JSON.stringify do?
The second argument controls serialisation. As a **function** `(key, value) => ...` it's called for every key (starting with `""` for the root): return a transformed value, or `undefined` to drop the key — useful for removing secrets, converting `Map`/`BigInt`, or handling circular refs. As an **array** of strings, only those keys are included.
```js
JSON.stringify({ name: "A", password: "x" }, (k, v) => (k === "password" ? undefined : v))
// '{"name":"A"}'
JSON.stringify({ a: 1, b: 2, c: 3 }, ["a", "c"]) // '{"a":1,"c":3}'
```
:::

:::question
difficulty: easy
### What is the difference between PUT and PATCH?
`PUT` replaces the whole resource with the body you send (idempotent — sending it twice has the same effect). `PATCH` applies a partial update to specific fields. `POST` creates (or triggers an action) and is not idempotent.
:::

## Challenges

:::challenge
difficulty: medium
### Build a resilient getJSON helper
Write `getJSON(url, { timeout = 5000, ...options })` that: throws on non-2xx with the status in the message, aborts after `timeout` ms with an error message `"Request timed out"`, and returns parsed JSON (or `null` for a 204).
@@@solution
```js
async function getJSON(url, { timeout = 5000, ...options } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...options.headers },
      ...options,
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
    }
    if (res.status === 204) return null
    return await res.json()
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out")
    throw err
  } finally {
    clearTimeout(timer)
  }
}
```
Notes: `finally` always clears the timer; we include part of the error body for debugging; 204 No Content has no body so `.json()` would throw. Modern browsers can also use `AbortSignal.timeout(ms)` and combine signals with `AbortSignal.any([...])`.
:::

:::challenge
difficulty: easy
### Load users and render with all states (vanilla)
Fetch `https://jsonplaceholder.typicode.com/users` and render names into `#users`. Show "Loading…", an error message with a Retry button, and "No users" if the list is empty.
@@@solution
```js
const root = document.getElementById("users")

async function loadUsers() {
  root.textContent = "Loading…"
  try {
    const res = await fetch("https://jsonplaceholder.typicode.com/users")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const users = await res.json()
    if (users.length === 0) {
      root.textContent = "No users"
      return
    }
    const ul = document.createElement("ul")
    for (const u of users) {
      const li = document.createElement("li")
      li.textContent = `${u.name} — ${u.email}`
      ul.append(li)
    }
    root.replaceChildren(ul)
  } catch (err) {
    const msg = document.createElement("p")
    msg.textContent = `Could not load users (${err.message}).`
    const retry = document.createElement("button")
    retry.textContent = "Retry"
    retry.addEventListener("click", loadUsers, { once: true })
    root.replaceChildren(msg, retry)
  }
}

loadUsers()
```
Every branch updates the UI, errors are recoverable, and text is set with `textContent` for safety.
:::

:::quiz
### fetch() rejects when the server returns 500.
- [ ] True
- [x] False
@@@explain
HTTP error statuses resolve normally; check `res.ok`.
:::

:::quiz
### Which cancels an in-flight fetch?
- [ ] clearTimeout
- [x] AbortController.abort()
- [ ] Promise.reject()
- [ ] response.cancel()
@@@explain
Pass `controller.signal` to fetch, then call `controller.abort()`.
:::
