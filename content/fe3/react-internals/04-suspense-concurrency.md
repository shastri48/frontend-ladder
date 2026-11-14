---
title: Suspense, Transitions & Concurrent Rendering
summary: How Suspense works by throwing promises, useTransition and useDeferredValue, and designing loading states that don't flicker.
minutes: 22
---

## The problem concurrent rendering solves

JavaScript runs on one main thread. If rendering a filtered list of 10,000 items takes 300 ms, every keystroke freezes the input for 300 ms. Debouncing helps but adds artificial delay. **Concurrent rendering** lets React:

- Keep the **urgent** update (the input's value) instant,
- Render the **expensive** update (the list) in the background in small slices,
- **Abandon** that background render if the user types again,
- Keep showing the **old UI** until the new one is ready (no flashing spinners).

React doesn't do things *in parallel* — it **interleaves** them, yielding every few milliseconds so the browser can paint and handle input.

## useTransition

```jsx
function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(allItems)
  const [isPending, startTransition] = useTransition()

  function onChange(e) {
    const q = e.target.value
    setQuery(q)                                 // urgent: input stays responsive
    startTransition(() => {
      setResults(allItems.filter(i => i.includes(q))) // non-urgent: interruptible
    })
  }

  return (
    <>
      <input value={query} onChange={onChange} />
      {isPending && <Spinner small />}
      <div style={{ opacity: isPending ? 0.6 : 1 }}><List items={results} /></div>
    </>
  )
}
```

- Updates inside `startTransition` get a **transition lane**.
- If a new urgent update arrives, React **interrupts** the transition render, handles the urgent one, then restarts the transition with the latest state.
- `isPending` lets you show inline feedback while the old UI stays visible.
- Transitions are for **state updates**, not for controlling text inputs (`setQuery` inside a transition would make typing laggy).
- React 19: the callback can be **async** (Actions), and `isPending` stays true until it resolves.
- There's also a standalone `startTransition` import for code outside components (routers use it).

## useDeferredValue

When you don't own the state update (e.g. the value comes as a prop), defer the *value* instead:

```jsx
function Results({ query }) {
  const deferredQuery = useDeferredValue(query)
  const stale = query !== deferredQuery
  const list = useMemo(() => expensiveFilter(deferredQuery), [deferredQuery])
  return <div style={{ opacity: stale ? 0.6 : 1 }}><List items={list} /></div>
}
```

React first re-renders with the **old** deferred value (cheap, since `list` is memoised — memoise or `memo` the heavy child, otherwise you gain nothing), then attempts a background render with the new value. It's like built-in, adaptive debouncing: on a fast device it updates almost instantly; on a slow one it lags gracefully, and no fixed delay is imposed.

| | `useTransition` | `useDeferredValue` |
|---|---|---|
| You wrap | The state **update** | The **value** you read |
| Use when | You control the setter | Value comes from props/parent/library |
| Gives you | `isPending` | Compare value vs deferred for "stale" |

## Suspense: declarative loading states

```jsx
<Suspense fallback={<FeedSkeleton />}>
  <Feed />
</Suspense>
```

**How it works**: when a component isn't ready (lazy code not loaded, data not fetched), it **throws a promise** during render (React 19's `use(promise)` does this for you). React catches it at the nearest `<Suspense>` boundary, shows the fallback, and retries rendering when the promise resolves.

What can suspend:
- `React.lazy` components (code).
- `use(promise)` with a cached promise (React 19).
- Suspense-enabled data libraries: TanStack Query `useSuspenseQuery`, Relay, Apollo, SWR (`suspense: true`), framework loaders, Server Components.

:::callout warn Don't create promises in render
`use(fetch(url))` creates a new promise every render → infinite suspend loop. The promise must be cached (by a library, a parent, or a Server Component passing it down).
:::

### Boundaries design

```jsx
<Suspense fallback={<PageShell />}>          {/* outer: whole page */}
  <Header />
  <Suspense fallback={<ChartSkeleton />}>    {/* inner: independent widgets */}
    <RevenueChart />
  </Suspense>
  <Suspense fallback={<TableSkeleton />}>
    <Orders />
  </Suspense>
</Suspense>
```

- Siblings inside **one** boundary are revealed together (avoids a "popcorn" effect).
- **Nested** boundaries reveal progressively, outer first.
- Place boundaries where a loading state is meaningful to the user, mirroring the layout to avoid CLS.
- Pair with **error boundaries** for failed loads.

### Suspense + transitions: no flashing fallbacks

If an update inside a **transition** causes an already-visible boundary to suspend, React **keeps showing the old content** (with `isPending`) instead of replacing it with a fallback. Routers wrap navigation in transitions for exactly this reason: clicking a link keeps the current page visible until the next page is ready, rather than flashing a skeleton. Fallbacks are only shown for *new* boundaries.

React also **throttles** reveal of fallbacks→content (~300 ms) so boundaries resolving close together appear at once instead of flickering.

### Suspense on the server

With streaming SSR, React sends HTML for everything outside suspended boundaries immediately, streams the fallback, and later streams the real HTML (with a tiny inline script to swap it in) as data resolves. Each boundary also becomes a unit of **selective hydration**. See Rendering Strategies.

## Concurrent features recap

| Feature | Purpose |
|---|---|
| Time slicing | Long renders yield to the browser every ~5 ms |
| Transitions | Mark updates interruptible & non-blocking |
| Deferred values | Lagging copy of a value rendered at low priority |
| Suspense | Declarative loading boundaries; keep old UI during transitions |
| Selective hydration | Hydrate boundaries independently, prioritising user interaction |
| `<Activity>` (19.2) | Pre-render / keep hidden UI alive at low priority |

:::question
difficulty: hard
companies: Walmart
### What are Suspense and Concurrent Rendering?
**Concurrent rendering** (React 18) lets React prepare multiple versions of the UI and interrupt, pause or abandon rendering work based on priority: urgent updates (typing, clicks) pre-empt non-urgent ones marked with `startTransition`/`useDeferredValue`, and long renders are time-sliced so the main thread stays responsive. **Suspense** lets components declare they're waiting (by throwing a promise — lazy code, `use(promise)`, suspense-enabled data libraries); the nearest `<Suspense>` boundary shows a fallback and retries when ready. Together: transitions keep existing content visible instead of showing fallbacks again, and on the server Suspense enables streaming HTML and selective hydration.
:::

:::question
difficulty: medium
### What is the difference between useTransition and useDeferredValue?
Both mark work as low-priority. `useTransition` wraps the **state update** (`startTransition(() => setResults(...))`) and returns `isPending`; use it when you own the setter. `useDeferredValue(value)` returns a version of a **value** that lags behind during heavy renders; use it when the value comes from props or a library. Neither should be used for controlled input values themselves, and the expensive child must be memoised for `useDeferredValue` to help.
:::

:::question
difficulty: medium
### Why doesn't my Suspense fallback show when navigating?
If the navigation is wrapped in a transition (routers do this), React keeps displaying the already-revealed content instead of replacing it with a fallback, and exposes `isPending` for a subtle indicator. This avoids jarring flashes. Fallbacks show only for boundaries mounting for the first time, or for updates not in a transition. Add a `key` to force a new boundary if you deliberately want the fallback.
:::

:::challenge
difficulty: hard
### Make the tab switch responsive
```jsx
function App() {
  const [tab, setTab] = useState('about')
  return (
    <>
      <TabButton onClick={() => setTab('about')}>About</TabButton>
      <TabButton onClick={() => setTab('posts')}>Posts (slow: 500 items, each 1ms)</TabButton>
      <TabButton onClick={() => setTab('contact')}>Contact</TabButton>
      {tab === 'about' && <About />}
      {tab === 'posts' && <SlowPosts />}
      {tab === 'contact' && <Contact />}
    </>
  )
}
```
Clicking "Posts" then quickly "Contact" freezes the UI for half a second. Fix it so the user can switch away immediately and see feedback.
@@@solution
```jsx
function App() {
  const [tab, setTab] = useState('about')
  const [isPending, startTransition] = useTransition()

  function selectTab(next) {
    startTransition(() => setTab(next)) // interruptible render
  }

  return (
    <>
      <TabButton onClick={() => selectTab('about')}>About</TabButton>
      <TabButton onClick={() => selectTab('posts')}>Posts</TabButton>
      <TabButton onClick={() => selectTab('contact')}>Contact</TabButton>
      <div style={{ opacity: isPending ? 0.7 : 1 }}>
        {tab === 'about' && <About />}
        {tab === 'posts' && <SlowPosts />}
        {tab === 'contact' && <Contact />}
      </div>
    </>
  )
}
```
Rendering `SlowPosts` now happens in a transition lane: React yields every ~5 ms, so the click on "Contact" is processed immediately; React abandons the half-done Posts render and renders Contact. The old tab stays visible (dimmed) while pending. Further improvements: virtualise the posts list, memoise items, and show the pending state on the clicked tab button.
:::

:::challenge
difficulty: medium
### Which is better and why?
```jsx
// A
const [q, setQ] = useState('')
const debouncedQ = useDebounce(q, 300)
<HeavyList filter={debouncedQ} />

// B
const [q, setQ] = useState('')
const deferredQ = useDeferredValue(q)
<MemoHeavyList filter={deferredQ} />
```
@@@solution
It depends on the bottleneck.

- If the cost is **rendering** (CPU-bound list filtering/rendering on the client), **B** is better: no fixed delay, adapts to device speed, background renders are interruptible so typing never blocks, and on fast machines results update immediately. `MemoHeavyList` must be memoised for it to work.
- If the cost is **network requests** (each filter change hits an API), **A** is better: `useDeferredValue` doesn't reduce the number of requests; debouncing does. You might combine both: debounce the request, defer the rendering.
:::

:::quiz
### How does a component tell Suspense it's not ready?
- [ ] It returns null
- [x] It throws a promise during render (directly or via use()/a library)
- [ ] It calls setLoading(true)
@@@explain
React catches the thrown promise at the nearest boundary and retries when it settles.
:::

:::quiz
### Should a controlled input's own value update be wrapped in startTransition?
- [ ] Yes, always
- [x] No — the input value must update urgently or typing will lag
@@@explain
Keep the input update urgent; transition only the expensive derived update.
:::
