---
title: Hydration & Hydration Mismatches
summary: What hydration really does, why mismatches happen, how to fix them, and how selective hydration changed the game.
minutes: 18
---

## What is hydration?

With server-side rendering, the server sends **fully rendered HTML**. The user sees content quickly, but it's inert: buttons don't respond, no state, no effects. **Hydration** is the process where React, running in the browser:

1. Renders the component tree again (in memory) with the same props/data,
2. **Walks the existing DOM** instead of creating new nodes, matching each element to a fiber,
3. **Attaches event listeners** and sets up state, refs and effects,
4. Runs effects — now the app is interactive.

```jsx
// server
const html = renderToString(<App data={data} />)
// client
import { hydrateRoot } from 'react-dom/client'
hydrateRoot(document.getElementById('root'), <App data={window.__DATA__} />)
```

:::callout analogy Watering dry noodles
The server ships dried instant noodles (HTML: right shape, not edible). Hydration adds water (JS, listeners, state) to the noodles already in the bowl — rather than cooking a new bowl from scratch (client-side render).
:::

## The uncanny valley

Between **FCP** (HTML visible) and **hydration finishing**, the page *looks* ready but isn't. Users click buttons that do nothing ("rage clicks"). Hydration cost grows with the amount of JS and the size of the component tree — the whole app must be downloaded, parsed, executed and rendered once more. On slow phones this can take seconds, hurting **INP/TTI**.

Mitigations: ship less JS (code splitting, Server Components), stream and hydrate selectively, progressive enhancement (forms that work without JS), and partial hydration / islands (next lesson track).

## Hydration mismatches

React expects the client's first render to produce **exactly** the same markup as the server. If not:

```text
Warning: Text content did not match. Server: "10:31:04" Client: "10:31:05"
Hydration failed because the server rendered HTML didn't match the client.
```

In React 18+, a mismatch causes React to **throw away the server HTML** for the nearest Suspense boundary (or the whole root) and client-render it — losing SSR's benefit and possibly flashing. Text mismatches in attributes may be left unpatched (inconsistent UI).

### Common causes

| Cause | Example |
|---|---|
| Time / randomness | `new Date().toLocaleTimeString()`, `Math.random()`, `crypto.randomUUID()` for ids |
| Browser-only APIs in render | `typeof window !== 'undefined' ? A : B`, `localStorage`, `window.innerWidth`, `matchMedia` |
| Locale / timezone differences | `toLocaleDateString()` on a UTC server vs IST browser |
| Invalid HTML nesting | `<p><div/></p>`, `<a>` inside `<a>`, `<tr>` directly inside `<table>` — the browser's parser "fixes" the DOM |
| Different data | Client fetches fresher data before hydrating instead of using the serialised server data |
| Browser extensions | Injected attributes/elements (Grammarly, translators) |
| Conditional rendering on auth/cookies only known on one side | |

### Fixes

1. **Render the same thing first, then update in an effect**:

```jsx
function LocalTime({ iso }) {
  const [text, setText] = useState(() => formatUTC(iso)) // same on server & client
  useEffect(() => { setText(new Date(iso).toLocaleTimeString()) }, [iso]) // client-only refinement
  return <time dateTime={iso}>{text}</time>
}
```

2. A `useIsClient` / `useHydrated` hook for client-only components:

```jsx
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false)
function ThemeIcon() {
  const hydrated = useHydrated()
  if (!hydrated) return <span className="icon-placeholder" />
  return localStorage.theme === 'dark' ? <Moon /> : <Sun />
}
```

3. `suppressHydrationWarning` on a single element whose text legitimately differs (timestamps) — one level deep only, use sparingly.
4. `useId` for ids instead of random generators.
5. **Serialise server data** into the page (`window.__DATA__`, framework does this) and hydrate with exactly that data.
6. Fix invalid HTML nesting.
7. Pass locale/timezone explicitly (`Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })`).
8. Client-only components via dynamic import with `ssr: false` (Next.js) for widgets that can't render on the server.

:::callout tip Dark mode without flash or mismatch
Put a tiny inline script in `<head>` that reads the saved theme and sets `class="dark"` on `<html>` **before** paint; render theme-dependent icons only after hydration. That avoids both the white flash and the mismatch.
:::

## Selective hydration (React 18)

Before React 18 hydration was **all-or-nothing**: the entire app had to load and hydrate before anything was interactive, and it ran in one long blocking task.

With `hydrateRoot` + Suspense boundaries:

- Each `<Suspense>` boundary hydrates **independently**, as soon as its code and HTML are available.
- Hydration is **interruptible** — time-sliced like concurrent renders.
- If the user **clicks** a not-yet-hydrated boundary, React **prioritises hydrating that boundary** synchronously, then replays the event.
- Combined with streaming SSR, slow parts don't block fast parts from either rendering or becoming interactive.

```jsx
<Layout>
  <NavBar />
  <Suspense fallback={<Spinner />}><Comments /></Suspense>  {/* hydrates on its own */}
  <Suspense fallback={<Spinner />}><Sidebar /></Suspense>
</Layout>
```

:::question
difficulty: medium
companies: Accenture
### What is hydration in React?
Hydration is when React, on the client, attaches to HTML that was rendered on the server: it re-renders the component tree in memory, matches it against the existing DOM nodes instead of creating new ones, and attaches event handlers, state and effects so the static page becomes interactive. It's done with `hydrateRoot`. The client's first render must match the server HTML; otherwise React reports a hydration mismatch and falls back to client rendering for that part.
:::

:::question
difficulty: hard
### What causes hydration mismatches and how do you fix them?
Mismatches occur when the client's first render differs from server HTML: using `Date`, `Math.random`, or random ids during render; branching on `window`/`localStorage`/screen size; locale and timezone differences; invalid HTML nesting rewritten by the browser parser; client using different data than the server; browser extensions. Fix by making the first render deterministic (same data, `useId`, explicit locale/timezone), moving client-only values into `useEffect`/a hydrated flag, `suppressHydrationWarning` for unavoidable text differences, fixing HTML nesting, and rendering client-only widgets with dynamic imports (`ssr: false`).
:::

:::question
difficulty: hard
### What is selective hydration?
In React 18, Suspense boundaries split the page into independently hydrated units. With streaming SSR, each boundary can hydrate as soon as its HTML and code arrive, without waiting for the whole app. Hydration is interruptible, and if the user interacts with a not-yet-hydrated part, React raises its priority, hydrates it first and replays the event. This cuts time-to-interactive for important parts on slow devices.
:::

:::challenge
difficulty: medium
### Find the hydration bugs
```jsx
export default function Header() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const id = Math.random().toString(36).slice(2)
  return (
    <p>
      <label htmlFor={id}>Search</label>
      <input id={id} />
      <div>{isMobile ? <MobileMenu /> : <DesktopMenu />}</div>
      <span>Last updated {new Date().toLocaleTimeString()}</span>
    </p>
  )
}
```
@@@solution
Four problems:
1. `isMobile` is `false` on the server and may be `true` on the client → different trees. Use CSS media queries to show/hide, or decide after hydration (`useHydrated` / `useEffect` + `matchMedia`).
2. `Math.random()` ids differ → use `const id = useId()`.
3. `<div>` inside `<p>` is invalid HTML; the browser closes the `<p>` early, so the DOM structure differs from React's expectation → use a `<div>` wrapper.
4. `toLocaleTimeString()` differs by time and timezone → render a fixed, server-provided timestamp formatted with an explicit timezone, or update in an effect (with `suppressHydrationWarning` on the `<time>` if you render the time text directly).

```jsx
export default function Header({ updatedAt }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id}>Search</label>
      <input id={id} />
      <nav className="menu-mobile"><MobileMenu /></nav>   {/* hidden via CSS on desktop */}
      <nav className="menu-desktop"><DesktopMenu /></nav> {/* hidden via CSS on mobile */}
      <span>Last updated <LocalTime iso={updatedAt} /></span>
    </div>
  )
}
```
:::

:::quiz
### In React 18, what happens on a hydration mismatch in a Suspense boundary?
- [ ] React silently keeps the server HTML
- [x] React discards the server HTML for that boundary and client-renders it
- [ ] The page crashes
@@@explain
React recovers by client rendering the nearest boundary (or root), logging an error.
:::

:::quiz
### A user clicks a component that hasn't hydrated yet in React 18. React…
- [ ] Ignores the click
- [x] Prioritises hydrating that boundary, then replays the event
- [ ] Reloads the page
@@@explain
Selective hydration raises the priority of the interacted boundary.
:::
