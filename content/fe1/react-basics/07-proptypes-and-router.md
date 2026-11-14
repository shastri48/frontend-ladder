---
title: PropTypes, Routing & Building Your First Mini-Apps
summary: Validating props, client-side routing with React Router (relative vs absolute paths, navigation), plus todo list and accordion challenges.
minutes: 18
---

## PropTypes: runtime prop validation

Before TypeScript became the norm, `prop-types` was how React components documented and checked their inputs.

```jsx
import PropTypes from "prop-types"

function Avatar({ src, name, size }) {
  return <img src={src} alt={name} width={size} height={size} />
}

Avatar.propTypes = {
  src: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  size: PropTypes.oneOf([24, 40, 64]),
  onClick: PropTypes.func,
  user: PropTypes.shape({ id: PropTypes.number, name: PropTypes.string }),
  tags: PropTypes.arrayOf(PropTypes.string),
  children: PropTypes.node,
}
```

What PropTypes do:

- Check props **at runtime, in development only**, logging console warnings for wrong types or missing required props.
- Act as **documentation** of a component's API.

Limitations: no compile-time errors, no editor autocomplete, stripped in production, and React 19 **removed** built-in `propTypes` checking (the package still exists but React no longer calls it). Today use **TypeScript**:

```tsx
type AvatarProps = {
  src: string
  name: string
  size?: 24 | 40 | 64
  onClick?: () => void
}

function Avatar({ src, name, size = 40 }: AvatarProps) { /* ... */ }
```

TypeScript catches errors **before** running, in the editor, across the whole codebase. For data from the network (which TypeScript can't verify), add runtime validation with a schema library like Zod.

## Client-side routing

A **single-page application** loads one HTML page and swaps views with JavaScript as the URL changes — no full page reloads. The router keeps the URL and UI in sync and makes back/forward buttons and deep links work, using the browser **History API** (`history.pushState`, `popstate`).

React Router (v6/v7) is the standard library:

```jsx
import { createBrowserRouter, RouterProvider, Outlet, Link, NavLink } from "react-router-dom"

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },                  // "/"
      { path: "courses", element: <Courses /> },           // "/courses"
      { path: "courses/:level", element: <Level /> },      // "/courses/fe1"
      { path: "courses/:level/:lessonId", element: <Lesson /> },
      { path: "*", element: <NotFound /> },
    ],
  },
])

createRoot(root).render(<RouterProvider router={router} />)

function Layout() {
  return (
    <>
      <nav>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/courses">Courses</NavLink>   {/* gets .active automatically */}
      </nav>
      <Outlet />  {/* child route renders here */}
    </>
  )
}
```

Use `<Link to>` instead of `<a href>` for internal links — `<a>` reloads the whole page and loses state.

### Reading URL data

```jsx
import { useParams, useSearchParams, useLocation } from "react-router-dom"

function Lesson() {
  const { level, lessonId } = useParams()               // /courses/fe1/closures
  const [searchParams, setSearchParams] = useSearchParams() // ?tab=quiz
  const tab = searchParams.get("tab") ?? "read"
  return <h1>{level} / {lessonId} — {tab}</h1>
}
```

Put shareable UI state (filters, page, tab, search query) in the URL — users can bookmark and share it.

### Relative vs absolute paths

- **Absolute** paths start with `/` and resolve from the root: `<Link to="/courses/fe2">` always goes to `/courses/fe2`.
- **Relative** paths don't start with `/` and resolve **relative to the current route** (the route hierarchy, not the URL string):

```jsx
// Inside the route "courses/:level" (URL: /courses/fe1)
<Link to="closures">       // → /courses/fe1/closures   (child)
<Link to="..">             // → /courses                (parent route)
<Link to="../fe2">         // → /courses/fe2            (sibling)
```

Relative links make nested route trees portable: move the whole subtree under a new prefix and the internal links still work. Route `path`s in a `children` array are relative too (`"courses"`, not `"/courses"`).

### Programmatic navigation

```jsx
const navigate = useNavigate()

async function handleSubmit() {
  await save()
  navigate("/courses")                 // push
  navigate("/login", { replace: true }) // replace history entry (no back to this page)
  navigate(-1)                          // go back
}
```

Use cases: redirect after login/logout or form submit, wizard steps, "go back". Declarative alternative: `<Navigate to="/login" replace />` when rendering (e.g. in a route guard).

### Protecting routes (preview)

```jsx
function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}
```

After login, read `location.state.from` to send the user back. (Token handling and expiry are covered in FE2.)

### Deploying an SPA

The server must return `index.html` for **every** route (e.g. `/courses/fe1`), otherwise refreshing a deep link gives a 404. On Vercel/Netlify you add a rewrite rule.

## Interview questions

:::question
difficulty: easy
### What is the role of PropTypes in React?
PropTypes declare the expected types and required-ness of a component's props and validate them at runtime in development, logging warnings on mismatches. They serve as documentation and catch integration bugs. They don't run in production, give no compile-time safety, and React 19 dropped built-in support — TypeScript (plus runtime schema validation like Zod for external data) is the modern replacement.
:::

:::question
difficulty: medium
companies: Accenture
### Explain React Router, relative vs absolute paths, and navigation use cases
React Router maps URL paths to components using the History API so the SPA can change views without reloading. Routes nest: a parent renders `<Outlet />` where children appear. **Absolute** paths start with `/` and resolve from the root; **relative** paths resolve against the current route in the hierarchy (`"edit"` → child, `".."` → parent route), making nested route modules portable. Navigation is declarative with `<Link>/<NavLink>` (and `<Navigate>` for redirects while rendering) or imperative with `useNavigate()` for redirects after login, form submission, wizard steps, or `navigate(-1)` for back; `{ replace: true }` avoids leaving the page in history.
:::

:::question
difficulty: easy
### Why use `<Link>` instead of `<a href>` in a React app?
`<a href>` triggers a full page load: the browser requests the HTML again, re-downloads/re-evaluates JS and loses all in-memory state. `<Link>` intercepts the click, updates the URL with `history.pushState` and lets the router render the new view instantly. Use `<a>` for external links.
:::

## Challenges

:::challenge
difficulty: medium
companies: Common
### React todo list
Build a todo app with add, toggle, delete, edit-on-double-click, filters (All / Active / Done) and a remaining-count. State should persist to `localStorage`.
@@@solution
```jsx
import { useEffect, useState } from "react"

const FILTERS = {
  all: () => true,
  active: (t) => !t.done,
  done: (t) => t.done,
}

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue]
}

export function TodoApp() {
  const [todos, setTodos] = useLocalStorage("todos", [])
  const [filter, setFilter] = useState("all")
  const [text, setText] = useState("")

  const add = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setTodos((ts) => [...ts, { id: crypto.randomUUID(), text: t, done: false }])
    setText("")
  }
  const toggle = (id) => setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const remove = (id) => setTodos((ts) => ts.filter((t) => t.id !== id))
  const rename = (id, newText) => setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, text: newText } : t)))

  const visible = todos.filter(FILTERS[filter])
  const remaining = todos.filter(FILTERS.active).length

  return (
    <div>
      <form onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task" aria-label="New task" />
        <button>Add</button>
      </form>

      <ul>
        {visible.map((todo) => (
          <TodoItem key={todo.id} todo={todo} onToggle={toggle} onRemove={remove} onRename={rename} />
        ))}
      </ul>

      <footer>
        <span>{remaining} left</span>
        {Object.keys(FILTERS).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </footer>
    </div>
  )
}

function TodoItem({ todo, onToggle, onRemove, onRename }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.text)

  const commit = () => {
    const t = draft.trim()
    if (t) onRename(todo.id, t)
    else setDraft(todo.text)
    setEditing(false)
  }

  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} aria-label={`Mark ${todo.text} done`} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") { setDraft(todo.text); setEditing(false) }
          }}
        />
      ) : (
        <span onDoubleClick={() => setEditing(true)} style={{ textDecoration: todo.done ? "line-through" : "none" }}>
          {todo.text}
        </span>
      )}
      <button onClick={() => onRemove(todo.id)} aria-label={`Delete ${todo.text}`}>×</button>
    </li>
  )
}
```
Talking points: single source of truth in the parent; immutable updates; stable ids generated at creation; derived `visible` and `remaining` (never stored); filter functions in a lookup object; edit state local to each item; Enter/Escape/blur handling; custom `useLocalStorage` hook. Follow-ups: "clear completed", drag-to-reorder, syncing with an API (optimistic updates).
:::

:::challenge
difficulty: easy
companies: Common
### Accordion component
Build `<Accordion items={[{ id, title, content }]} allowMultiple={false} />`. Clicking a header toggles its panel; when `allowMultiple` is false, opening one closes the others. It must be keyboard accessible.
@@@solution
```jsx
import { useState } from "react"

export function Accordion({ items, allowMultiple = false }) {
  const [open, setOpen] = useState(() => new Set())

  function toggle(id) {
    setOpen((prev) => {
      const isOpen = prev.has(id)
      const next = allowMultiple ? new Set(prev) : new Set()
      if (!isOpen) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div className="accordion">
      {items.map(({ id, title, content }) => {
        const expanded = open.has(id)
        const headerId = `acc-h-${id}`
        const panelId = `acc-p-${id}`
        return (
          <div key={id}>
            <h3>
              <button id={headerId} aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(id)}>
                <span aria-hidden>{expanded ? "−" : "+"}</span> {title}
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={headerId} hidden={!expanded}>
              {content}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```
Real `<button>`s give Enter/Space handling and focus for free; `aria-expanded` + `aria-controls` + `role="region"` describe the relationship to assistive tech; `hidden` keeps closed panels out of the tab order. Storing a `Set` of open ids supports both modes with one code path. Follow-ups: animate height (CSS `grid-template-rows: 0fr → 1fr` trick), controlled mode (`openIds` + `onChange` props), arrow-key navigation between headers.
:::

:::quiz
### From route `courses/:level` (URL /courses/fe1), `<Link to="..">` goes to
- [ ] /
- [x] /courses
- [ ] /courses/fe1/..
- [ ] /fe1
@@@explain
Relative links resolve against the route hierarchy; `..` is the parent route.
:::

:::quiz
### What's the modern replacement for PropTypes?
- [ ] Flow comments
- [x] TypeScript (plus runtime schemas like Zod for external data)
- [ ] defaultProps
- [ ] React.memo
@@@explain
TypeScript checks at compile time across the codebase; PropTypes only warned at runtime in dev.
:::

:::quiz
### Refreshing /courses/fe1 on a deployed SPA returns 404. Why?
- [ ] React Router is misconfigured
- [x] The server has no file at that path and must be told to serve index.html for all routes
- [ ] The browser cache is stale
- [ ] Links must use <a>
@@@explain
Client-side routes don't exist on the server; add a rewrite to index.html.
:::
