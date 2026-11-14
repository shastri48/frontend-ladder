---
title: Inside a Modern Browser
summary: Processes, threads, the renderer's main thread, the compositor, the GPU and how V8 turns your JavaScript into machine code.
minutes: 16
---

## Why you should care

Most "mysterious" frontend bugs — janky scrolling, a frozen UI after an API call, an animation that stutters only on low-end phones — are not mysteries once you know **which thread is doing what**. A browser is not one program running your page. It is a small operating system: several processes, each with several threads, cooperating through messages.

:::callout analogy A restaurant
The **browser process** is the front-of-house manager: it owns the tabs, address bar, network and disk. Each **renderer process** is a kitchen dedicated to one site. Inside the kitchen there is exactly **one head chef — the main thread** — who parses HTML, runs JavaScript, computes styles and layout. Helpers (the **compositor** and **raster** threads) plate and deliver dishes. If the head chef is busy with one giant order (a long JavaScript task), nobody else's order gets cooked.
:::

## The multi-process architecture

Chrome (and Edge, Brave, Opera — all Chromium) splits work like this. Firefox and Safari use similar ideas with different names.

| Process | Responsibility |
|---|---|
| **Browser process** | UI chrome (tabs, URL bar, back button), navigation, permissions, coordinating other processes |
| **Network service** | DNS, sockets, HTTP, caching, cookies |
| **Storage service** | IndexedDB, Cache Storage, localStorage backing |
| **Renderer process** (one per site, roughly) | Everything inside the tab: HTML parsing, CSS, JavaScript, layout, paint |
| **GPU process** | Talks to the graphics card; draws composited frames to the screen |
| **Utility / plugin processes** | Audio, video decoding, extensions |

Why so many processes?

- **Stability** — if a renderer crashes ("Aw, Snap!") only that tab dies.
- **Security** — renderers run in a **sandbox** with almost no OS access. **Site Isolation** puts different sites in different processes, which is the main defence against Spectre-style attacks that read memory across origins.
- **Performance** — processes run in parallel on multiple cores.

The cost is memory: each process carries its own copy of the JS engine heap and data structures. That is why Chrome may merge same-site tabs into one renderer when memory is tight.

## Inside the renderer process

```text
Renderer process
├── Main thread        → parse HTML, build DOM, style, layout, paint records,
│                        run ALL your JavaScript, event handlers, rAF, React
├── Compositor thread  → takes layers, handles scrolling & transform/opacity
│                        animations, produces frames — even if main is busy
├── Raster threads     → turn paint records into pixels (tiles), often on GPU
└── Worker threads     → Web Workers / Service Workers (your own JS, no DOM)
```

The **main thread** is the bottleneck of the web. The DOM is not thread-safe, so every DOM read and write, every event handler and every framework render happens there, one task at a time.

The **compositor thread** is the hero. It can scroll the page and run `transform` and `opacity` animations **without the main thread**. This is why a CSS `transform` animation keeps running smoothly even when JavaScript is stuck in a long loop — and why animating `top`/`left` (which requires layout on the main thread) does not.

:::visual rendering-pipeline
:::

## How a frame is produced

At 60 Hz the browser has roughly **16.7 ms** per frame (8.3 ms at 120 Hz). A typical frame:

1. **Input events** (scroll, click, keypress) dispatched.
2. **JavaScript** — timers, event handlers that are due.
3. **requestAnimationFrame** callbacks.
4. **Style** — recalculate which CSS rules apply.
5. **Layout** — compute geometry (positions, sizes).
6. **Paint** — record draw commands per layer.
7. **Composite** — compositor thread assembles layers, raster threads produce tiles, GPU process puts pixels on the screen.

If steps 1–6 take longer than the frame budget, the frame is **dropped** and the user sees jank.

## The JavaScript engine (V8)

Each renderer embeds a JS engine: **V8** in Chromium, **SpiderMonkey** in Firefox, **JavaScriptCore** in Safari. They share the same high-level pipeline:

```text
source code
   │  scanner (tokens) + parser
   ▼
AST (abstract syntax tree)
   │  Ignition — bytecode generator & interpreter
   ▼
bytecode  ──runs immediately, collects type feedback──┐
   │                                                   │
   │  "hot" function?                                  │
   ▼                                                   │
Sparkplug / Maglev (fast, baseline/mid-tier compilers) │
   ▼                                                   │
TurboFan — optimizing JIT → machine code  ◄────────────┘
   │
   └─ assumption broken (e.g. a new type appears) → DEOPTIMIZE back to bytecode
```

Key ideas:

- **Lazy parsing** — V8 only pre-parses functions that aren't called yet; full parsing happens on first call. Shipping less JS still matters: parse + compile time on a mid-range phone is very real.
- **JIT (Just-In-Time) compilation** — code starts interpreted (fast startup) and hot code is compiled to optimized machine code (fast execution).
- **Hidden classes (shapes) and inline caches** — objects created with the same properties in the same order share a hidden class, which makes property access as fast as a struct field read. Adding properties in different orders, or `delete`-ing properties, creates new shapes and slows things down.
- **Deoptimization** — the optimizer speculates ("this function always receives numbers"). If you later pass a string, V8 throws away the optimized code.

```js
// Monomorphic — same shape every time, fast
function area(p) { return p.w * p.h }
area({ w: 1, h: 2 })
area({ w: 3, h: 4 })

// Polymorphic/megamorphic — different shapes, slower inline caches
area({ h: 2, w: 1 })          // different property order → different shape
area({ w: 1, h: 2, d: 3 })
```

- **Garbage collection** — V8's **Orinoco** GC is generational: a fast "scavenger" for young objects (most die young) and a concurrent/incremental mark-and-sweep for old objects. GC can still cause pauses, which is why allocating millions of short-lived objects in a hot loop hurts.

## Where Web APIs live

`setTimeout`, `fetch`, DOM events and `IntersectionObserver` are **not part of JavaScript** — they're provided by the browser (the "host environment"). The engine executes your code; the browser schedules **tasks** onto the main thread's **event loop** when timers fire or network responses arrive. Node.js has a different host (libuv) but the same idea.

## Workers: getting off the main thread

| | Web Worker | Service Worker | Worklet |
|---|---|---|---|
| Purpose | Heavy computation | Network proxy, offline, push | Hooks into rendering/audio pipeline |
| DOM access | No | No | No |
| Lifetime | As long as the page | Independent of pages, event-driven | Tied to pipeline |
| Communication | `postMessage` | `postMessage`, `fetch` events | Specific APIs |

Use a Web Worker for parsing huge JSON, image processing, diffing, search indexing — anything that would block the main thread for more than ~50 ms.

```js
// main.js
const worker = new Worker(new URL('./sort.worker.js', import.meta.url), { type: 'module' })
worker.postMessage(bigArray)
worker.onmessage = (e) => render(e.data)

// sort.worker.js
self.onmessage = (e) => {
  const sorted = e.data.toSorted((a, b) => a.score - b.score)
  self.postMessage(sorted)
}
```

## Interview questions

:::question
difficulty: medium
### Why does Chrome use multiple processes? What is site isolation?
Chrome splits the browser into a **browser process**, **renderer processes**, a **GPU process**, a **network service** and utility processes.

- **Stability**: a crash or infinite loop in one renderer kills one tab, not the browser.
- **Security**: renderers are sandboxed and cannot touch the file system or OS directly; they must ask the browser process via IPC.
- **Site isolation**: pages (and cross-site iframes) from different *sites* run in different renderer processes, so even a memory-reading exploit (Spectre) in one renderer cannot see another site's data.
- **Parallelism**: multiple cores are used.

The trade-off is higher memory use.

**In an interview, say:** "Multi-process buys crash isolation and a security sandbox; site isolation makes the process boundary the security boundary between origins, at the cost of memory."
:::

:::question
difficulty: medium
companies: Tekion
### What is the main thread and why does a long JavaScript task freeze the page?
The renderer's **main thread** does HTML parsing, style calculation, layout, paint recording, **and** runs all JavaScript including event handlers. It processes one task at a time from the event loop.

If a task runs for 2 seconds, then for 2 seconds the browser cannot handle clicks, run other handlers, recalculate layout or paint new frames. The page looks frozen. Scrolling and `transform`/`opacity` animations can sometimes continue because the **compositor thread** handles them independently — but anything needing the main thread waits.

Fixes: split work into chunks (`setTimeout`, `scheduler.yield()`, `requestIdleCallback`), move computation to a **Web Worker**, virtualize huge lists, and avoid synchronous layout in loops.
:::

:::question
difficulty: hard
### How does V8 execute JavaScript? What is JIT compilation?
1. The **parser** turns source into an **AST** (lazily — inner functions are only pre-parsed until called).
2. **Ignition** compiles the AST to compact **bytecode** and interprets it, collecting **type feedback** (what shapes/types each operation sees).
3. Hot functions are compiled by faster tiers (**Sparkplug**, **Maglev**) and finally by **TurboFan**, an optimizing **JIT** compiler that produces machine code specialized for the observed types.
4. If a speculation fails (a different type shows up), V8 **deoptimizes** and falls back to bytecode.

JIT = compile at runtime using real execution data, combining fast startup (interpreter) with fast steady-state performance (optimized code).

Practical takeaways: keep object shapes consistent, avoid `delete` on hot objects, keep functions monomorphic in hot paths, and ship less JS (parse/compile cost is real).
:::

:::question
difficulty: medium
### Why can a CSS transform animation stay smooth while JavaScript is blocking, but a `left` animation cannot?
`transform` and `opacity` can be handled entirely by the **compositor thread**: the element is on its own layer, already rasterized, and the compositor only moves/fades that layer — no style, layout or paint on the main thread.

Animating `left` changes geometry, so every frame needs **layout** and **paint** on the main thread. If the main thread is busy running JS, those frames cannot be produced.
:::

:::question
difficulty: easy
### Are setTimeout and fetch part of JavaScript?
No. They're **Web APIs** provided by the host environment (the browser, or Node). The ECMAScript language defines things like Promises, functions and objects; the browser provides timers, networking, the DOM, storage and so on. The engine and the browser cooperate via the **event loop**: when a timer fires or a response arrives, the browser queues a task whose callback the engine then runs.
:::

## Challenges

:::challenge
difficulty: medium
### Predict the jank
A page has a spinner animated with `@keyframes spin { to { transform: rotate(360deg) } }` and a progress bar animated with `@keyframes grow { to { width: 100% } }`. You click a button that runs:

```js
const end = Date.now() + 3000
while (Date.now() < end) {}
```

What happens to each animation during those 3 seconds, and why?
@@@solution
- **Spinner (transform)**: usually **keeps spinning smoothly**. Transform animations declared in CSS are handed to the compositor thread, which can produce frames without the main thread.
- **Progress bar (width)**: **freezes**. Changing `width` requires layout + paint on the main thread every frame, and the main thread is stuck in the busy loop. When the loop ends, the bar jumps to wherever the animation timeline is now.
- **Clicks** during those 3s are queued and processed after the loop finishes.

Lesson: animate `transform`/`opacity`, and never block the main thread for long. If you must do heavy work, chunk it or move it to a Worker.
:::

:::challenge
difficulty: medium
### Move a heavy computation off the main thread
You need to compute prime numbers up to 5,000,000 on button click without freezing the UI. Sketch the code (main file + worker).
@@@solution
```js
// main.js
const worker = new Worker(new URL('./primes.worker.js', import.meta.url), { type: 'module' })
const btn = document.querySelector('#go')
const out = document.querySelector('#out')

btn.addEventListener('click', () => {
  out.textContent = 'Computing…'
  worker.postMessage({ limit: 5_000_000 })
})
worker.addEventListener('message', (e) => {
  out.textContent = `Found ${e.data.count} primes`
})
```

```js
// primes.worker.js — sieve of Eratosthenes
self.addEventListener('message', (e) => {
  const { limit } = e.data
  const sieve = new Uint8Array(limit + 1)
  let count = 0
  for (let i = 2; i <= limit; i++) {
    if (sieve[i]) continue
    count++
    for (let j = i * i; j <= limit; j += i) sieve[j] = 1
  }
  self.postMessage({ count })
})
```

Notes: workers have no DOM; data is **structured-cloned** (copied) across — for big binary buffers, **transfer** them (`postMessage(buf, [buf])`) to avoid copying. Libraries like Comlink make workers feel like async function calls.
:::

## Quick check

:::quiz
### Which thread runs your React components' render functions?
- [ ] The compositor thread
- [x] The renderer's main thread
- [ ] The GPU process
- [ ] A Web Worker by default
@@@explain
All JavaScript that touches (or prepares changes for) the DOM runs on the main thread. Workers have no DOM.
:::

:::quiz
### What happens when V8's speculative optimization assumption is broken?
- [ ] The page crashes
- [ ] The function is recompiled with TurboFan immediately
- [x] The function is deoptimized back to bytecode
- [ ] A TypeError is thrown
@@@explain
V8 bails out of the optimized machine code and resumes in the interpreter; it may re-optimize later with the new type feedback.
:::

:::quiz
### What is the main benefit of Site Isolation?
- [ ] Faster page loads
- [x] Different sites cannot share a process, limiting cross-site memory attacks
- [ ] Lower memory usage
- [ ] It enables Service Workers
@@@explain
Site Isolation makes the OS process boundary a security boundary between sites — key against Spectre-class attacks. It actually *increases* memory use.
:::
