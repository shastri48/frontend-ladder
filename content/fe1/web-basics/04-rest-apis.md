---
title: REST APIs and JSON
summary: How frontends talk to backends — resources, endpoints, JSON, pagination, errors and a first look at REST vs GraphQL.
minutes: 13
---

## What is an API?

An **API (Application Programming Interface)** is a contract: "send me *this* shaped request, I'll send you *that* shaped response". On the web, most APIs are HTTP endpoints that return **JSON**.

```json
{
  "id": 42,
  "name": "Mechanical Keyboard",
  "price": 4999,
  "inStock": true,
  "tags": ["electronics", "office"],
  "seller": { "id": 7, "name": "KeyCo" }
}
```

JSON supports strings, numbers, booleans, `null`, arrays and objects — not `undefined`, functions, `Date` or `BigInt`. Dates travel as ISO strings (`"2026-11-14T10:00:00Z"`) and must be parsed on the client.

```js
const text = JSON.stringify({ a: 1, when: new Date(0) }) // '{"a":1,"when":"1970-01-01T00:00:00.000Z"}'
const obj = JSON.parse(text)                              // when is now a string!
```

## REST in plain words

**REST (Representational State Transfer)** is a style for designing APIs around **resources** (nouns) manipulated with HTTP **methods** (verbs):

| Action | Method + path | Success status |
|---|---|---|
| List products | `GET /products` | 200 |
| Get one | `GET /products/42` | 200 / 404 |
| Create | `POST /products` | 201 + `Location` |
| Replace | `PUT /products/42` | 200 / 204 |
| Update fields | `PATCH /products/42` | 200 |
| Delete | `DELETE /products/42` | 204 |
| Nested resource | `GET /products/42/reviews` | 200 |

REST principles:

- **Stateless** — each request carries all needed info (auth token, params).
- **Uniform interface** — predictable URLs and methods.
- **Cacheable** — GET responses can be cached by browsers and CDNs using HTTP headers.
- **Client–server separation** — frontend and backend evolve independently.

:::callout tip Good URL design
Use plural nouns (`/users`), not verbs (`/getUsers`). Filters, sorting and pagination go in the query string: `GET /products?category=books&sort=-price&page=2&limit=20`.
:::

## Pagination

Large lists are never returned in one response.

| Style | Request | Pros | Cons |
|---|---|---|---|
| **Offset** | `?page=3&limit=20` (or `offset=40`) | Simple, jump to any page | Slow on huge tables; items shift when new ones are inserted → duplicates/skips in feeds |
| **Cursor** | `?after=eyJpZCI6MTAwfQ&limit=20` | Stable for live feeds, fast | Can't jump to page 50; opaque |

Infinite scroll on a feed that's constantly updated (Twitter, Reddit) should use **cursor** pagination.

## Errors

A well-designed API returns a meaningful status and a consistent error body:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Email is invalid", "field": "email" } }
```

On the frontend, map errors to UI: 400/422 → inline field errors; 401 → re-login; 403 → permission message; 404 → not-found page; 429 → back off and retry later; 5xx → "Something went wrong, try again" with a retry button.

## Using an API from the browser

```js
async function loadProducts(page = 1) {
  const params = new URLSearchParams({ page, limit: 20 })
  const res = await fetch(`/api/products?${params}`)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return res.json() // { items: [...], nextPage: 2 }
}
```

The UI around any request has (at least) **three states**: loading, success, error. Often a fourth: empty.

## A first look at GraphQL

**GraphQL** is an alternative where the client sends a query describing exactly the shape it needs, to a single endpoint:

```graphql
query {
  product(id: 42) {
    name
    price
    seller { name }
  }
}
```

| | REST | GraphQL |
|---|---|---|
| Endpoints | Many (`/products`, `/users/7`) | One (`/graphql`) |
| Response shape | Decided by server | Decided by client query |
| Over/under-fetching | Common (extra fields, or N extra calls) | Avoided |
| HTTP caching | Easy (GET + URL) | Harder (POST); needs client cache (Apollo, urql, Relay) |
| Errors | HTTP status codes | Usually 200 with an `errors` array |
| Tooling | Simple, universal | Strong typing, schema introspection, codegen |

Neither is "better" — REST is simpler and cache-friendly; GraphQL shines for complex, nested data used by many different clients.

:::question
difficulty: easy
### What is a REST API?
A REST API exposes **resources** at URLs and uses standard HTTP methods to act on them (GET read, POST create, PUT/PATCH update, DELETE remove), returning standard status codes and typically JSON. It is stateless (every request is self-contained, with auth in headers/cookies), cacheable via HTTP caching headers, and keeps client and server decoupled.
:::

:::question
difficulty: medium
companies: Intuit
### Explain the difference between REST APIs and GraphQL.
REST has many resource endpoints with server-defined response shapes; GraphQL has one endpoint and a typed schema, and the client asks for exactly the fields it needs (avoiding over-fetching and multiple round trips). REST leverages HTTP caching and status codes naturally; GraphQL usually needs a normalized client cache and returns errors in the body. GraphQL adds complexity on the server (resolvers, N+1 problems — solved with DataLoader, query cost limits). Choose REST for simple CRUD and public cacheable APIs; GraphQL when many clients need different shapes of deeply related data.
:::

:::question
difficulty: medium
companies: Reddit
### Cursor vs offset pagination — which would you use for a moving feed?
Cursor. With offset (`page=2`), if 5 new posts are inserted at the top while the user scrolls, page 2 now starts 5 items earlier and the user sees duplicates (or misses items on deletion). A cursor encodes "give me items after this specific item" (e.g. after id/timestamp), so the window stays stable. Cursor queries also use indexes efficiently (`WHERE id < ? LIMIT 20`) while large offsets force the DB to scan and discard rows. Offset is fine for admin tables where users jump to page N.
:::

:::challenge
difficulty: easy
### Build a query string
Write `buildQuery(params)` that turns an object into a query string starting with `?`. Skip keys whose value is `null`, `undefined` or `''`. Arrays become repeated keys. Return `''` when nothing remains.

`buildQuery({ q: 'red shoes', page: 2, tag: ['a', 'b'], empty: '' })` → `?q=red+shoes&page=2&tag=a&tag=b`
@@@starter
```js
function buildQuery(params) {
  // your code
}
```
@@@tests
```js
test('basic', () => {
  expect(buildQuery({ q: 'red shoes', page: 2, tag: ['a', 'b'], empty: '' })).toBe('?q=red+shoes&page=2&tag=a&tag=b')
})
test('empty', () => {
  expect(buildQuery({ a: null, b: undefined })).toBe('')
})
```
@@@solution
```js
function buildQuery(params) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) value.forEach(v => sp.append(key, v))
    else sp.append(key, String(value))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
```
`URLSearchParams` handles encoding (spaces become `+`, `&` and `=` get escaped). Hand-concatenating strings is a classic source of bugs when a value contains `&`.
:::

:::quiz
### Which status code best fits a successful `POST /users` that created a user?
- [ ] 200 OK
- [x] 201 Created
- [ ] 204 No Content
@@@explain
201 Created, ideally with a `Location` header pointing to the new resource.
:::

:::quiz
### What does `JSON.parse(JSON.stringify({ d: new Date() })).d` give you?
- [ ] A Date object
- [x] An ISO date string
- [ ] undefined
@@@explain
Dates serialize to ISO strings via `toJSON` and are not revived automatically.
:::
