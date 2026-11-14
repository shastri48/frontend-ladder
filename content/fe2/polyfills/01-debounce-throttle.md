---
title: Debounce & Throttle
summary: The two rate-limiting utilities every frontend interview asks for — what they are, when to use which, and how to build them from scratch with leading/trailing options and cancellation.
minutes: 20
---

## The problem: events fire too often

Some browser events fire dozens or hundreds of times per second: `input` while typing, `scroll`, `resize`, `mousemove`, `pointermove`. If each one triggers an API call, a heavy calculation or a re-render, the app drowns.

Two classic fixes:

- **Debounce** — "wait until they stop". Run the function only after the events have **paused** for `wait` ms. Every new event resets the timer.
- **Throttle** — "at most once every `wait` ms". Run immediately (or at the start), then ignore events until the interval passes — guarantees a steady maximum rate.

:::visual debounce-throttle
:::

:::callout analogy Elevator vs metronome
**Debounce** is an elevator door: every time someone walks in, the door waits again. It only closes once nobody has arrived for a few seconds. **Throttle** is a metronome or a bus timetable: it ticks at a fixed rate no matter how many people are waiting.
:::

| Use case | Choose | Why |
|---|---|---|
| Search-as-you-type / autocomplete | Debounce | Only care about the final query after the user pauses |
| Form validation while typing | Debounce | Validate after they pause |
| Window resize → recompute layout | Debounce (or throttle) | Final size matters most |
| Infinite scroll "near bottom" check | Throttle | Need regular checks while scrolling |
| Scroll-spy / progress bar | Throttle (or rAF) | Continuous feedback at a capped rate |
| Mouse move / drag tracking | Throttle (rAF) | Smooth, bounded update rate |
| Button double-submit prevention | Debounce with leading edge, or disable the button | Fire on first click, ignore the burst |
| WebSocket price ticks → chart | Throttle | Coinbase-style: render at most N times/sec |

## How debounce works

Debounce is a textbook closure: the returned function remembers a `timer` between calls.

```text
events:   x  x x   x            x x
time:     ─────────────────────────────────►
debounce:              ▲(wait after last x)    ▲
```

```js
function debounce(fn, wait) {
  let timer
  return function (...args) {
    clearTimeout(timer)                       // cancel the previous pending call
    timer = setTimeout(() => {
      fn.apply(this, args)                    // keep `this` and latest args
    }, wait)
  }
}
```

Key details interviewers check:

1. **`clearTimeout` before setting a new timer** — that's what makes it "reset".
2. **Preserve `this`** — use a regular `function` for the wrapper and an arrow inside `setTimeout` (arrow inherits the wrapper's `this`), then `fn.apply(this, args)`. Matters when the debounced function is used as a method or DOM handler.
3. **Use the latest arguments** — the last call's args win.
4. **Cancellation** — expose `.cancel()` so components can clear pending calls on unmount.

### Leading vs trailing edge

- **Trailing** (default): run after the pause, with the last args.
- **Leading**: run on the **first** call of a burst, then ignore until things go quiet.
- **Both**: run at the start, and again at the end *only if* more calls came in during the burst.

## How throttle works

```text
events:   x x x x x x x x x x x
time:     ─────────────────────────────────►
throttle: ▲     ▲     ▲     ▲      (once per `wait`)
```

Two common implementations:

**Timestamp version** (leading edge only):

```js
function throttle(fn, wait) {
  let last = 0
  return function (...args) {
    const now = Date.now()
    if (now - last >= wait) {
      last = now
      fn.apply(this, args)
    }
  }
}
```

**Timer version with trailing call** — ensures the *final* event isn't lost (important: if the user stops scrolling mid-window, you still want the final position handled). See the challenge below.

## Using them in React

The most common React bug: creating a new debounced function on every render, so the timer is never shared.

```jsx
// ❌ new debounce each render → every keystroke fires after 300ms
function Search() {
  const [q, setQ] = useState('')
  const search = debounce((value) => fetchResults(value), 300)
  return <input value={q} onChange={(e) => { setQ(e.target.value); search(e.target.value) }} />
}
```

Two good patterns:

```jsx
// ✅ 1. Debounce the *value* with a hook
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id) // reset on every change + cleanup on unmount
  }, [value, delay])
  return debounced
}

function Search() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 300)
  useEffect(() => {
    if (!debouncedQ) return
    const controller = new AbortController()
    fetch(`/api/search?q=${encodeURIComponent(debouncedQ)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setResults)
      .catch((e) => { if (e.name !== 'AbortError') setError(e) })
    return () => controller.abort() // cancel stale request when query changes
  }, [debouncedQ])
  return <input value={q} onChange={(e) => setQ(e.target.value)} />
}

// ✅ 2. Keep one debounced function in a ref / useMemo and cancel on unmount
const debouncedSave = useMemo(() => debounce(save, 500), [])
useEffect(() => () => debouncedSave.cancel(), [debouncedSave])
```

:::callout warn Debounce doesn't fix race conditions
Debounce reduces *how many* requests you send, but responses can still arrive out of order ("React" response arriving after "Redux"). Pair it with `AbortController` or a "latest request id" check. CRED asks for exactly these "edge cases, stale responses, cancellation".
:::

## Interview questions

:::question
difficulty: easy
companies: Razorpay, CRED, Noon
### What's the difference between debounce and throttle? When do you use each?
Debounce delays execution until events stop for `wait` ms (each event resets the timer) — ideal when only the final value matters: search input, validation, resize end, autosave. Throttle executes at most once per `wait` ms during a continuous stream — ideal for regular updates: scroll handlers, infinite-scroll checks, drag/mousemove, rate-limited real-time updates. Debounce can starve during a never-ending stream; throttle guarantees periodic execution.
:::

:::question
difficulty: medium
companies: CRED, Noon
### What edge cases matter when debouncing a live search?
- Preserve `this` and use the latest arguments.
- **Cancel** pending calls on unmount (`.cancel()` or effect cleanup) to avoid setState on unmounted components.
- **Stale responses**: an older request can resolve after a newer one — abort the previous request with `AbortController` or ignore responses whose query ≠ current query.
- Empty/whitespace query → clear results without calling the API.
- Leading-edge option for instant feedback, `maxWait` so updates still happen during very long typing bursts.
- Don't create a new debounced function each render in React.
- Cache previous queries; show loading/error states; minimum query length.
:::

:::question
difficulty: medium
companies: Coinbase
### How would you throttle WebSocket price updates for a chart?
Don't render on every message. Buffer the latest value(s) in a ref (or an array for tick history) as messages arrive, and flush to state at a fixed cadence — `throttle(flush, 250)` or once per animation frame with `requestAnimationFrame` (and skip when the tab is hidden). Keep the WebSocket handler cheap (parse + store), batch multiple updates into one render, and use the latest value so nothing important is lost (trailing call). For very high rates, aggregate in a Web Worker.
:::

## Challenges

:::challenge
difficulty: easy
companies: Google, Meta, OpenAI
### Implement debounce(fn, wait)
Return a debounced function that delays invoking `fn` until `wait` ms have elapsed since the last call. It must use the latest arguments and preserve `this`. Add a `.cancel()` method that clears any pending call.
@@@hint
Store the timer id in the closure. Clear it on every call. Use a normal `function` for the wrapper so `this` is dynamic.
@@@starter
```js
function debounce(fn, wait) {
  // your code
}
```
@@@tests
```js
test('calls once after the wait with the last args', async () => {
  const calls = []
  const d = debounce((x) => calls.push(x), 50)
  d(1); d(2); d(3)
  expect(calls).toEqual([])
  await sleep(80)
  expect(calls).toEqual([3])
})
test('timer resets on each call', async () => {
  let n = 0
  const d = debounce(() => n++, 50)
  d()
  await sleep(30)
  d()
  await sleep(30)
  expect(n).toBe(0)
  await sleep(40)
  expect(n).toBe(1)
})
test('preserves this', async () => {
  const obj = { v: 42, got: null, f: null }
  obj.f = debounce(function () { this.got = this.v }, 10)
  obj.f()
  await sleep(30)
  expect(obj.got).toBe(42)
})
test('cancel prevents the call', async () => {
  let n = 0
  const d = debounce(() => n++, 20)
  d()
  d.cancel()
  await sleep(40)
  expect(n).toBe(0)
})
```
@@@solution
```js
function debounce(fn, wait) {
  let timer = null

  function debounced(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(this, args) // arrow → `this` is debounced's this
    }, wait)
  }

  debounced.cancel = () => {
    clearTimeout(timer)
    timer = null
  }

  return debounced
}
```
**Why it works:** the closure holds `timer` across calls. Each call cancels the previously scheduled invocation and schedules a new one, so only a call followed by `wait` ms of silence survives.

**Complexity:** O(1) per call.

**Follow-ups:** `flush()` to run the pending call immediately; return a promise resolving with `fn`'s result; `maxWait` (lodash) to guarantee execution during endless bursts; leading edge (next challenge).
:::

:::challenge
difficulty: medium
companies: Google
### debounce with leading & trailing options
Implement `debounce(fn, wait, { leading = false, trailing = true })`.
- `leading: true` → invoke on the first call of a burst.
- `trailing: true` → invoke after the burst ends **only if** there were calls that weren't already handled by the leading invocation.
- Include `.cancel()`.
@@@starter
```js
function debounce(fn, wait, { leading = false, trailing = true } = {}) {
  // your code
}
```
@@@tests
```js
test('trailing only (default)', async () => {
  const calls = []
  const d = debounce((x) => calls.push(x), 40)
  d('a'); d('b')
  await sleep(70)
  expect(calls).toEqual(['b'])
})
test('leading only fires immediately once per burst', async () => {
  const calls = []
  const d = debounce((x) => calls.push(x), 40, { leading: true, trailing: false })
  d('a'); d('b'); d('c')
  expect(calls).toEqual(['a'])
  await sleep(70)
  expect(calls).toEqual(['a'])
  d('d')
  expect(calls).toEqual(['a', 'd'])
})
test('leading + trailing fires both ends', async () => {
  const calls = []
  const d = debounce((x) => calls.push(x), 40, { leading: true, trailing: true })
  d('a'); d('b'); d('c')
  await sleep(70)
  expect(calls).toEqual(['a', 'c'])
})
test('leading + trailing with a single call fires once', async () => {
  const calls = []
  const d = debounce((x) => calls.push(x), 40, { leading: true, trailing: true })
  d('a')
  await sleep(70)
  expect(calls).toEqual(['a'])
})
```
@@@solution
```js
function debounce(fn, wait, { leading = false, trailing = true } = {}) {
  let timer = null
  let pendingArgs = null
  let pendingThis = null

  function debounced(...args) {
    const isNewBurst = timer === null

    if (isNewBurst && leading) {
      fn.apply(this, args)       // fire immediately on the leading edge
    } else {
      pendingArgs = args         // remember for a possible trailing call
      pendingThis = this
    }

    clearTimeout(timer)
    timer = setTimeout(() => {
      if (trailing && pendingArgs) {
        fn.apply(pendingThis, pendingArgs)
      }
      timer = null
      pendingArgs = pendingThis = null
    }, wait)
  }

  debounced.cancel = () => {
    clearTimeout(timer)
    timer = null
    pendingArgs = pendingThis = null
  }

  return debounced
}
```
**Key idea:** `timer === null` means "we're not inside a burst". The leading call consumes its own args; only calls made *after* it are stored as `pendingArgs`, so a single call with both edges enabled fires exactly once.

**Follow-up:** with `leading: false, trailing: false` nothing ever fires — lodash behaves the same. Mention `maxWait`.
:::

:::challenge
difficulty: easy
companies: Google
### Implement a basic throttle(fn, wait)
Invoke `fn` immediately on the first call, then ignore calls until `wait` ms have passed since the last invocation. Preserve `this` and arguments.
@@@starter
```js
function throttle(fn, wait) {
  // your code
}
```
@@@tests
```js
test('fires immediately then ignores during wait', async () => {
  const calls = []
  const t = throttle((x) => calls.push(x), 50)
  t(1); t(2); t(3)
  expect(calls).toEqual([1])
  await sleep(70)
  t(4)
  expect(calls).toEqual([1, 4])
})
test('preserves this', () => {
  const o = { v: 7, out: 0, f: null }
  o.f = throttle(function () { this.out = this.v }, 50)
  o.f()
  expect(o.out).toBe(7)
})
```
@@@solution
```js
function throttle(fn, wait) {
  let last = -Infinity
  return function (...args) {
    const now = Date.now()
    if (now - last >= wait) {
      last = now
      fn.apply(this, args)
    }
  }
}
```
A timestamp in the closure records the last invocation. Calls within `wait` are dropped. Simple, but **drops the final call** of a burst — fixed in the next challenge with a trailing timer.
:::

:::challenge
difficulty: hard
companies: Google
### throttle with leading & trailing options
Implement `throttle(fn, wait, { leading = true, trailing = true })`:
- `leading`: invoke on the first call.
- `trailing`: if calls happen during the wait window, invoke once more at the end of the window with the **latest** args (and start a new window).
@@@starter
```js
function throttle(fn, wait, { leading = true, trailing = true } = {}) {
  // your code
}
```
@@@tests
```js
test('leading + trailing', async () => {
  const calls = []
  const t = throttle((x) => calls.push(x), 50)
  t(1); t(2); t(3)
  expect(calls).toEqual([1])
  await sleep(80)
  expect(calls).toEqual([1, 3])
})
test('trailing only', async () => {
  const calls = []
  const t = throttle((x) => calls.push(x), 40, { leading: false })
  t(1); t(2)
  expect(calls).toEqual([])
  await sleep(70)
  expect(calls).toEqual([2])
})
test('leading only drops trailing', async () => {
  const calls = []
  const t = throttle((x) => calls.push(x), 40, { trailing: false })
  t(1); t(2)
  await sleep(70)
  expect(calls).toEqual([1])
  t(3)
  expect(calls).toEqual([1, 3])
})
test('no extra call when nothing happened in the window', async () => {
  const calls = []
  const t = throttle((x) => calls.push(x), 30)
  t(1)
  await sleep(100)
  expect(calls).toEqual([1])
})
```
@@@solution
```js
function throttle(fn, wait, { leading = true, trailing = true } = {}) {
  let timer = null
  let lastArgs = null
  let lastThis = null

  function startWindow() {
    timer = setTimeout(() => {
      if (trailing && lastArgs) {
        fn.apply(lastThis, lastArgs)
        lastArgs = lastThis = null
        startWindow()            // the trailing call opens a new window
      } else {
        timer = null             // window closed, next call is "leading"
        lastArgs = lastThis = null
      }
    }, wait)
  }

  function throttled(...args) {
    if (timer === null) {
      if (leading) {
        fn.apply(this, args)
      } else {
        lastArgs = args
        lastThis = this
      }
      startWindow()
    } else {
      lastArgs = args            // keep only the latest call during the window
      lastThis = this
    }
  }

  throttled.cancel = () => {
    clearTimeout(timer)
    timer = null
    lastArgs = lastThis = null
  }

  return throttled
}
```
**Why restart the window after a trailing call?** Otherwise a call right after the trailing invocation would fire immediately as "leading", producing two calls closer than `wait` apart.

**Complexity:** O(1) per call. **Follow-ups:** rAF-based throttle for visual work; returning the last result; implementing throttle *via* debounce with `maxWait` (that's literally how lodash does it).
:::

:::challenge
difficulty: medium
### Throttle to animation frames
Implement `rafThrottle(fn, schedule = requestAnimationFrame)` which ensures `fn` runs at most once per animation frame, with the **latest** arguments. The `schedule` parameter exists so tests (and SSR) can inject a different scheduler.
@@@starter
```js
function rafThrottle(fn, schedule = (cb) => requestAnimationFrame(cb)) {
  // your code
}
```
@@@tests
```js
const fakeFrame = (cb) => setTimeout(cb, 16)
test('runs once per frame with the latest args', async () => {
  const calls = []
  const f = rafThrottle((x) => calls.push(x), fakeFrame)
  f(1); f(2); f(3)
  expect(calls).toEqual([])
  await sleep(60)
  expect(calls).toEqual([3])
})
test('schedules again after a frame ran', async () => {
  const calls = []
  const f = rafThrottle((x) => calls.push(x), fakeFrame)
  f('a')
  await sleep(50)
  f('b')
  await sleep(50)
  expect(calls).toEqual(['a', 'b'])
})
```
@@@solution
```js
function rafThrottle(fn, schedule = (cb) => requestAnimationFrame(cb)) {
  let scheduled = false
  let lastArgs, lastThis

  return function (...args) {
    lastArgs = args
    lastThis = this
    if (scheduled) return
    scheduled = true
    schedule(() => {
      scheduled = false
      fn.apply(lastThis, lastArgs)
    })
  }
}
```
Ideal for `scroll`/`pointermove` handlers that update the screen: work is aligned with the browser's paint cycle and never runs more often than the display can show. Note that rAF pauses in background tabs, which is usually what you want for visual work.
:::

## Quick check

:::quiz
### A user types "react" quickly. With a 300ms debounce on the API call, how many requests are sent?
- [ ] 5
- [x] 1 (after they stop typing for 300ms)
- [ ] 0
- [ ] One every 300ms while typing
@@@explain
Each keystroke resets the timer; only the final pause triggers the call.
:::

:::quiz
### Which fits an infinite scroll "near bottom" check best?
- [ ] Debounce with a long wait
- [x] Throttle
- [ ] Neither — run on every scroll event
- [ ] setInterval
@@@explain
You want periodic checks *while* scrolling, not only after scrolling stops. (IntersectionObserver is even better.)
:::
