---
title: Memory Leaks in SPAs and React
summary: How garbage collection works, the usual leak suspects in long-lived single-page apps, and a step-by-step heap-snapshot workflow to find and fix them.
minutes: 20
---

## Why SPAs leak

A traditional multi-page site throws away the whole JavaScript heap on every navigation, so small leaks never matter. A single-page app lives for hours — dashboards, email clients, trading terminals. A leak of 2 MB per route change becomes 400 MB after a working day, the tab slows down from GC pressure and eventually crashes ("Aw, Snap!").

"Your React application consumes more memory every time users navigate between pages" is a standard senior question (Walmart, Coinbase, the "24 real-time questions" list).

## How garbage collection decides what to keep

JavaScript engines use **reachability**: starting from **roots** (the global object, the current call stack, active closures, DOM tree, pending timers/listeners), the GC marks everything reachable; the rest is swept.

```text
 roots: window, stack, active timers, event listeners, DOM tree
   │
   ├── window.cache ──▶ Map ──▶ 50k objects        (reachable → kept forever)
   ├── setInterval callback ──▶ closure ──▶ bigData (kept while interval runs)
   └── document ──▶ body ──▶ div#app ...           (attached DOM)
```

**A leak is memory that's still reachable but no longer needed.** The GC can't read your intent; if something references an object, it lives.

:::callout analogy The coat check
Every reference is a coat-check ticket. The cloakroom (GC) only throws away coats whose tickets have all been returned. A forgotten ticket in an old pocket (a global array, a listener never removed) keeps the coat forever.
:::

## The usual suspects

| Leak | Example | Fix |
|---|---|---|
| **Uncleared timers** | `setInterval` in `useEffect` without cleanup; closure keeps state & props alive | Return `() => clearInterval(id)` |
| **Global/window listeners** | `window.addEventListener('resize', handler)` on mount, never removed | Remove in cleanup; use `AbortController` signal |
| **Subscriptions** | WebSocket, EventEmitter, Redux store `subscribe`, RxJS without unsubscribe | Unsubscribe/close in cleanup |
| **Detached DOM nodes** | JS holds references to DOM elements removed from the document (e.g. cached in an array or a 3rd-party widget) | Null references; destroy widget instances (`chart.destroy()`) |
| **Unbounded caches** | Module-level `Map` memoising every request forever | LRU/TTL limits, `WeakMap` keyed by objects |
| **Closures capturing big data** | A small callback stored globally that closes over a 50 MB array | Narrow what's captured; release references |
| **Async work after unmount** | Fetch resolves and stores into a ref/global; promise chains hold component scope | `AbortController`; ignore results after cleanup |
| **Third-party libraries** | Map/chart/editor instances not destroyed | Call their `destroy`/`dispose` in cleanup |
| **Console logs** | `console.log(hugeObject)` in production keeps it referenced by DevTools | Strip logs in prod builds |
| **Growing stores** | Redux/global state accumulating every visited entity, undo history without a limit | Normalise and evict |

```jsx
// ❌ leaks on every mount: listener + interval + late setState
function Ticker() {
  const [price, setPrice] = useState(0)
  useEffect(() => {
    window.addEventListener('resize', onResize)
    setInterval(async () => setPrice(await fetchPrice()), 1000)
  }, [])
}

// ✅ every resource has an owner and a cleanup
function Ticker() {
  const [price, setPrice] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    window.addEventListener('resize', onResize, { signal: controller.signal }) // auto-removed on abort
    const id = setInterval(async () => {
      try {
        const p = await fetchPrice({ signal: controller.signal })
        setPrice(p)
      } catch (e) { if (e.name !== 'AbortError') throw e }
    }, 1000)
    return () => { controller.abort(); clearInterval(id) }
  }, [])
}
```

:::callout tip StrictMode is a leak detector
In development, React 18+ `StrictMode` mounts, unmounts and re-mounts every component once. If you see double subscriptions, two intervals ticking, or doubled WebSocket connections, your effect lacks a correct cleanup — exactly the bug that leaks in production on navigation.
:::

## Finding leaks: the three-snapshot technique

1. Open DevTools → **Memory**. Load the page, perform the suspect action once (warm-up so lazy chunks and caches exist).
2. Click the **trash-can (collect garbage)**, take **Snapshot 1**.
3. Repeat the action N times (e.g. navigate to the page and back 5 times). GC. Take **Snapshot 2**.
4. Repeat N more times, GC, take **Snapshot 3**.
5. View Snapshot 3 in **Comparison** mode against Snapshot 2, or "Objects allocated between Snapshot 1 and 2" in Summary. Objects that grow by a multiple of N are your leak.
6. Filter by **"Detached"** to find detached DOM trees (`Detached HTMLDivElement`).
7. Select an object and read the **Retainers** panel bottom-up: it shows the reference chain from a GC root to the leaked object — e.g. `Window → listeners → onResize → closure (context) → props → hugeList`. That chain tells you exactly which reference to break.

Other tools:
- **Performance monitor** (DevTools → More tools): live JS heap size, DOM node count, listener count. A staircase that never comes down after GC = leak.
- **Allocation instrumentation on timeline**: blue bars that stay blue are allocations still alive.
- `performance.memory` (Chrome) / `measureUserAgentSpecificMemory()` for RUM.
- **MemLab** (Meta) automates "navigate → back → diff heap" leak detection in CI.
- React DevTools: make sure unmounted components don't stay in the tree via portals or caches.

## WeakMap, WeakRef and FinalizationRegistry

- `WeakMap`/`WeakSet` hold keys weakly: if the key object becomes unreachable elsewhere, the entry disappears. Perfect for caching metadata about DOM nodes or objects.
- `WeakRef` lets you hold an object without preventing GC (check `deref()`); `FinalizationRegistry` notifies after collection. Use rarely — GC timing is non-deterministic.

```js
const sizeCache = new WeakMap()
function getSize(el) {
  if (!sizeCache.has(el)) sizeCache.set(el, el.getBoundingClientRect())
  return sizeCache.get(el)  // entry vanishes when el is garbage-collected
}
```

:::question
difficulty: hard
companies: Walmart, Coinbase
### You notice a memory leak in a React app — how would you debug and fix it?
**Confirm**: Performance monitor shows JS heap / DOM nodes / listeners climbing after repeated navigation, not returning after forced GC.

**Locate**: Memory panel three-snapshot technique — warm up, snapshot, repeat the action N times, snapshot, compare; filter "Detached" for detached DOM; inspect the **retainer chain** of growing objects to find which root (window listener, timer, global cache, store subscription, third-party instance) keeps them alive. MemLab can automate this.

**Fix** typical causes:
- Effects without cleanup → return cleanup that clears intervals/timeouts, removes listeners (or `AbortController` signal), closes sockets, unsubscribes stores.
- Async results after unmount → abort fetches.
- Unbounded caches/global arrays → LRU/TTL or `WeakMap`.
- Third-party widgets → call `destroy()` in cleanup.
- Large closures held by long-lived callbacks → narrow captures.

**Prevent**: StrictMode in dev (double mount surfaces missing cleanups), lint rules (`react-hooks/exhaustive-deps`), MemLab in CI on key journeys, RUM memory sampling.
:::

:::question
difficulty: medium
companies: Coinbase
### What does a memory leak look like in a long-lived SPA?
Heap size forms a rising staircase that doesn't drop after garbage collection; DOM node and event-listener counts grow with every navigation; the app gets progressively slower (longer and more frequent GC pauses, janky scrolling), and eventually the tab crashes on low-memory devices. In heap snapshots you see growing counts of the same constructor (e.g. component closures, `Detached HTMLDivElement`, duplicate store subscribers) between snapshots taken after repeating the same action.
:::

:::question
difficulty: medium
### What is a detached DOM node and how does it leak?
An element removed from the document tree but still referenced from JavaScript (an array, a closure, a cache, a third-party library instance). Because it's reachable, the GC keeps it — **and its entire subtree and any data attached to it**. Common in jQuery-style code, manual caches of elements, and wrappers around non-React widgets that never get destroyed. Find them by filtering "Detached" in a heap snapshot and fix by removing the JS references.
:::

:::question
difficulty: medium
companies: Myntra
### How do you detect and fix memory leaks in a large JavaScript codebase?
Combine **process** and **tools**: (1) RUM monitoring of heap size per session duration to know it exists and where; (2) reproduce a user journey and use heap snapshot comparisons + retainer chains; (3) automate with MemLab/Puppeteer journeys in CI that fail when retained objects grow; (4) code conventions — every subscription returns an unsubscribe, effects always clean up, `AbortController` for listeners and fetches, bounded caches, no module-level mutable arrays, `WeakMap` for object-keyed metadata; (5) lint rules and code review checklists.
:::

:::challenge
difficulty: medium
### Find the three leaks
```jsx
const cache = {}

function UserCard({ userId }) {
  const [user, setUser] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(u => {
      cache[userId] = { user: u, el: ref.current }
      setUser(u)
    })
    const onScroll = () => console.log(window.scrollY, user)
    window.addEventListener('scroll', onScroll)
  }, [userId])

  return <div ref={ref}>{user?.name}</div>
}
```
@@@solution
1. **Global unbounded cache holding DOM nodes** — `cache[userId] = { el: ref.current }` keeps every `UserCard` element alive after unmount (detached DOM) and grows forever. Store only data, bound the cache (LRU/TTL), or use a `WeakMap`; never store DOM nodes globally.
2. **Scroll listener never removed** — every mount (and every `userId` change) adds another listener whose closure retains the component's scope. Return a cleanup: `return () => window.removeEventListener('scroll', onScroll)` (and use `{ passive: true }`).
3. **Fetch not cancelled** — after unmount or a fast `userId` change, the promise still resolves, writes into the cache and calls `setUser` (stale data / race condition). Use `AbortController` and abort in cleanup.

Bonus bug: `onScroll` captures a **stale** `user` (from the render when the effect ran).

```jsx
useEffect(() => {
  const ac = new AbortController()
  fetch(`/api/users/${userId}`, { signal: ac.signal })
    .then(r => r.json())
    .then(u => { userCache.set(userId, u); setUser(u) })
    .catch(e => { if (e.name !== 'AbortError') throw e })
  window.addEventListener('scroll', onScroll, { passive: true, signal: ac.signal })
  return () => ac.abort()
}, [userId])
```
:::

:::quiz
### What makes an object eligible for garbage collection?
- [ ] It hasn't been used for 60 seconds
- [x] It's no longer reachable from any GC root
- [ ] It was declared with let
- [ ] Its component unmounted
@@@explain
Modern GCs use reachability (mark-and-sweep). Unmounting doesn't free anything still referenced.
:::

:::quiz
### Which structure lets cached entries disappear when their key object is collected?
- [ ] Map
- [ ] Object
- [x] WeakMap
- [ ] Set
@@@explain
WeakMap holds keys weakly, so it doesn't keep them alive.
:::
