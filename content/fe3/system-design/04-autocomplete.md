---
title: Design Autocomplete / Typeahead
summary: Design a search-as-you-type component used across a product — debouncing, cancellation, race conditions, client cache, keyboard and screen-reader support, and the backend that serves suggestions fast.
minutes: 24
---

## The prompt

> "Design an autocomplete (typeahead) component like Google Search suggestions or the search box on an e-commerce site. It should be reusable by other teams."

It looks small, yet it tests nearly everything: async correctness, performance on every keystroke, caching, accessibility and component API design. CRED asked candidates to build "search bar with debounce, implemented live, with edge cases, stale responses and cancellation"; Google/Meta ask the design version.

## Requirements

**Functional**
- As the user types, show up to N suggestions matching the query.
- Select with mouse, touch or keyboard; selection fills the input and triggers `onSelect`.
- Highlight the matched part of each suggestion.
- Show recent searches when the input is focused and empty (optional).
- Support custom rendering (product rows with images, people with avatars).

**Non-functional**
- Feels instant: suggestions within ~100–200ms of the user pausing.
- Don't overload the server: not one request per keystroke burst.
- Correct under slow/out-of-order responses.
- Fully keyboard and screen-reader accessible (combobox pattern).
- Works on mobile (virtual keyboard, small screens).

## Architecture

```text
<Autocomplete>
 ├─ <input role="combobox">         ← controlled input value
 ├─ <Listbox role="listbox"> (portal, positioned)
 │    └─ <Option role="option"> × N (renderItem)
 └─ <LiveRegion aria-live="polite"> "5 suggestions available"

Controller (useAutocomplete hook):
  inputValue ─▶ debounce ─▶ normalise ─▶ cache lookup ─hit─▶ results
                                         └─miss─▶ fetch (AbortController) ─▶ cache ─▶ results (latest-wins)
```

Make it **headless-first**: `useAutocomplete()` owns behaviour (state, keyboard, fetching) and returns prop getters; a default styled `<Autocomplete>` uses it. Teams with unusual UIs reuse behaviour without forking.

### Component API

```tsx
<Autocomplete<Product>
  fetchSuggestions={(query, { signal }) => api.search(query, { signal })}
  // or: source={staticArray} for client-side filtering
  getItemLabel={(p) => p.title}
  renderItem={(p, { highlighted, query }) => <ProductRow product={p} query={query} active={highlighted} />}
  onSelect={(p) => navigate(`/p/${p.id}`)}
  minChars={2}
  debounceMs={200}
  maxResults={8}
  cacheTtlMs={60_000}
  placeholder="Search products"
  aria-label="Search products"
/>
```

## Data model

```ts
type State<T> = {
  inputValue: string
  isOpen: boolean
  highlightedIndex: number      // -1 when nothing highlighted
  status: 'idle' | 'loading' | 'success' | 'error'
  results: T[]
}
// cache: Map<normalisedQuery, { results: T[]; expires: number }> — LRU bounded (e.g. 100 entries)
```

**Normalise queries** (trim, lowercase, collapse spaces) for cache keys so `"iPhone "` and `"iphone"` hit the same entry.

## Interface (server)

```http
GET /suggest?q=iph&limit=8&locale=en-IN
200 { "query": "iph", "items": [{ "id": "p1", "title": "iPhone 16", "type": "product", "thumb": "…" }] }
Cache-Control: public, max-age=60
```

Echoing `query` in the response is a cheap extra guard against stale responses. Public, short-lived caching lets the CDN serve hot prefixes ("i", "ip", "iph") for everyone.

## Deep dive 1: debounce vs throttle

:::visual debounce-throttle
:::

- **Debounce** (wait until typing pauses ~150–300ms) — fewer requests; standard for search APIs.
- **Throttle** (at most once per X ms while typing) — gives feedback *during* fast typing; good for local filtering.
- Many products: show **cached/local** results immediately on every keystroke, debounce **network** calls.

## Deep dive 2: race conditions (stale responses)

User types `re` → request A; then `react` → request B. If A returns after B, the list shows results for `re` while the input says `react`. Defences (use more than one):

1. **Abort** the previous request with `AbortController` when a new one starts (saves bandwidth too).
2. **Latest-wins guard**: tag requests with an incrementing id; ignore responses whose id isn't the latest.
3. Compare the response's `query` with the current normalised input.

```jsx
function useSuggestions(query, fetcher, { debounceMs = 200, minChars = 2 } = {}) {
  const [state, setState] = useState({ status: 'idle', results: [] })
  const cache = useRef(new Map())

  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (q.length < minChars) { setState({ status: 'idle', results: [] }); return }

    const hit = cache.current.get(q)
    if (hit) { setState({ status: 'success', results: hit }); return }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: 'loading' }))
      try {
        const results = await fetcher(q, { signal: controller.signal })
        cache.current.set(q, results)
        setState({ status: 'success', results })
      } catch (e) {
        if (e.name !== 'AbortError') setState({ status: 'error', results: [] })
      }
    }, debounceMs)

    return () => { clearTimeout(timer); controller.abort() } // cancels debounce AND in-flight request
  }, [query, fetcher, debounceMs, minChars])

  return state
}
```

The effect cleanup does double duty: it cancels the pending debounce timer and aborts the in-flight request of the previous query. Because a superseded request is aborted, its `setState` never runs — race solved.

## Deep dive 3: caching

- **Client LRU cache** keyed by normalised query: backspacing from `react` to `rea` is instant.
- **Prefix filtering**: if you have full results for `rea` (and the server returned fewer than `limit`, i.e. the complete set), you can filter them locally for `reac` without a request.
- **Prefetch** popular/initial suggestions on focus.
- **HTTP/CDN caching** for anonymous, non-personalised suggestions.
- Persist recent searches in `localStorage` (bounded, user can clear).

## Deep dive 4: accessibility (WAI-ARIA combobox)

```html
<label for="search">Search products</label>
<input id="search" role="combobox" aria-autocomplete="list"
       aria-expanded="true" aria-controls="search-listbox"
       aria-activedescendant="search-opt-2" />
<ul id="search-listbox" role="listbox">
  <li id="search-opt-0" role="option" aria-selected="false">iPhone 16</li>
  <li id="search-opt-2" role="option" aria-selected="true">iPhone 16 Pro</li>
</ul>
<div aria-live="polite" class="sr-only">8 suggestions available</div>
```

- Focus **stays in the input**; `aria-activedescendant` tells assistive tech which option is highlighted.
- Keys: ↓/↑ move highlight (wrap around), Enter selects, Esc closes (second Esc clears), Tab selects or moves on (decide and be consistent), Home/End within the text.
- Mouse hover updates the highlight; `mousedown` + `preventDefault` on options so the input doesn't blur before the click registers.
- Highlight matches with `<mark>` (render text safely — don't `innerHTML` a server string).

## Deep dive 5: mobile and UX polish

- Full-screen search overlay on small screens; `inputmode="search"`, `enterkeyhint="search"`, `autocomplete="off"` (avoid the browser's own suggestions clashing), `autocapitalize="off"`, `spellcheck="false"`.
- Loading indicator only if the request takes >300ms (avoid flicker).
- Empty state ("No results for …") and error state with retry; keep the previous results visible while loading the next ones.

## The backend (brief, but say it)

- A **trie** with cached top-k completions per node, or a search engine (Elasticsearch **edge n-gram** / completion suggester).
- Ranking by popularity, personalisation, freshness; typo tolerance (fuzzy).
- Hot prefixes cached in Redis/CDN; results computed offline from query logs (e.g. hourly aggregation pipeline).
- Rate limit per client.

## Interview questions

:::question
difficulty: medium
companies: CRED
### How do you debounce a search input in React without bugs?
Keep the input controlled for instant feedback, and debounce the **side effect** (the request), not the state update. Implement it in an effect keyed on the query: set a `setTimeout`; in the cleanup clear it and abort any in-flight request. Alternatively create a stable debounced function with `useMemo`/`useRef` (not recreated each render — otherwise each render gets a new timer and nothing is debounced) and cancel it on unmount. Handle edge cases: min characters, empty input clears results, stale responses ignored, errors shown, and cache hits served immediately.
:::

:::question
difficulty: medium
### How do you prevent stale responses from overwriting newer results?
Abort the previous request when a new query starts (`AbortController`), and as a second line of defence only apply a response if it belongs to the latest request (incrementing request id, or compare the echoed `query` with the current input). In React, put the abort/ignore logic in the effect cleanup so it runs whenever the query changes or the component unmounts.
:::

:::question
difficulty: hard
### Why use `aria-activedescendant` instead of moving focus to the options?
Moving DOM focus into the list would take focus out of the text input, so the user couldn't keep typing, and the mobile keyboard might close. With `aria-activedescendant`, DOM focus stays in the input while assistive technology is told which option is "virtually" focused, so screen readers announce it. It also works with virtualized lists as long as the active option is rendered.
:::

## Practice

:::challenge
difficulty: hard
companies: CRED, Razorpay
### Build an accessible Autocomplete component in React
Build `<Autocomplete fetchSuggestions onSelect />`:

- Debounced fetching (250ms), cancellation of stale requests, in-memory cache.
- Loading, empty and error states.
- Keyboard: ↓/↑ to move (wrapping), Enter to select, Escape to close.
- Combobox ARIA attributes; highlight the matched substring.
@@@solution
```jsx
import { useEffect, useId, useRef, useState } from 'react'

function Highlight({ text, query }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (!query || i === -1) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}

export function Autocomplete({ fetchSuggestions, onSelect, label = 'Search', debounceMs = 250, minChars = 1 }) {
  const id = useId()
  const listId = `${id}-list`
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [{ status, items }, setResult] = useState({ status: 'idle', items: [] })
  const cache = useRef(new Map())

  useEffect(() => {
    const q = value.trim().toLowerCase()
    if (q.length < minChars) { setResult({ status: 'idle', items: [] }); return }
    if (cache.current.has(q)) { setResult({ status: 'success', items: cache.current.get(q) }); return }

    const controller = new AbortController()
    const t = setTimeout(async () => {
      setResult((r) => ({ ...r, status: 'loading' }))
      try {
        const items = await fetchSuggestions(q, { signal: controller.signal })
        cache.current.set(q, items)
        setResult({ status: 'success', items })
        setActive(-1)
      } catch (e) {
        if (e.name !== 'AbortError') setResult({ status: 'error', items: [] })
      }
    }, debounceMs)
    return () => { clearTimeout(t); controller.abort() }
  }, [value, fetchSuggestions, debounceMs, minChars])

  const select = (item) => {
    setValue(item.label)
    setOpen(false)
    setActive(-1)
    onSelect?.(item)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (items.length ? (i + 1) % items.length : -1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (items.length ? (i <= 0 ? items.length - 1 : i - 1) : -1)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); select(items[active]) }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1) }
  }

  const showList = open && value.trim().length >= minChars
  return (
    <div className="ac">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className="ac-list">
          {status === 'loading' && items.length === 0 && <li className="ac-info">Loading…</li>}
          {status === 'error' && <li className="ac-info">Something went wrong</li>}
          {status === 'success' && items.length === 0 && <li className="ac-info">No results</li>}
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => e.preventDefault()} // keep focus in input
              onMouseEnter={() => setActive(i)}
              onClick={() => select(item)}
            >
              <Highlight text={item.label} query={value.trim()} />
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite" className="sr-only">
        {status === 'success' && showList ? `${items.length} suggestions available` : ''}
      </div>
    </div>
  )
}
```

```css
.ac { position: relative; }
.ac-list { position: absolute; inset-inline: 0; top: 100%; margin: 0; padding: 4px 0; list-style: none;
  background: Canvas; border: 1px solid #ccc; border-radius: 8px; max-height: 320px; overflow: auto; z-index: 10; }
.ac-list li { padding: 8px 12px; cursor: pointer; }
.ac-list li.active { background: #e8f0fe; }
.ac-info { color: GrayText; cursor: default; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

**Walkthrough**
- The input is controlled (instant typing); fetching is a debounced effect. Cleanup clears the timer **and** aborts the request → no stale responses, no setState after unmount.
- Cache hits short-circuit the network, so backspacing is instant.
- Focus never leaves the input; `aria-activedescendant` points at the highlighted option; `onMouseDown preventDefault` stops blur from closing the list before `onClick` fires.
- `Highlight` renders text nodes (safe from XSS).
- Live region announces result counts.

**Follow-ups interviewers ask:** bound the cache (LRU), recent searches, grouping (products vs categories), virtualization for long lists, `fetchSuggestions` identity (callers should memoise it or you store it in a ref), and testing with React Testing Library by role + keyboard.
:::

## Quick check

:::quiz
### Which combination fully prevents stale results in a debounced search effect?
- [ ] Debounce only
- [ ] Throttle only
- [x] Clearing the timer and aborting the in-flight request in the effect cleanup
- [ ] Adding `async` to the effect
@@@explain
Debounce reduces requests but a slow earlier request can still resolve late; aborting/ignoring it in cleanup fixes ordering.
:::

:::quiz
### Why `onMouseDown={e => e.preventDefault()}` on options?
- [ ] To disable text selection only
- [x] So the input doesn't blur (closing the list) before the click handler runs
- [ ] To improve performance
- [ ] It's required by ARIA
@@@explain
`mousedown` → input `blur` → list closes → `click` never lands. Preventing default on mousedown keeps focus in the input.
:::
