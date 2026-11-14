# Content authoring guide

All learning content lives in `content/<level>/<module-id>/NN-slug.md`.
`<level>` is `fe1 | fe2 | fe3`; `<module-id>` must match a module `id` in
`src/content/curriculum.ts`. Lessons are ordered by the `NN-` filename prefix.
The lesson id (used in URLs) is the filename without the prefix and extension,
so slugs must be unique **within a module**.

## Frontmatter (required)

```
---
title: The Event Loop
summary: How JavaScript runs async code on a single thread — call stack, microtasks, macrotasks.
minutes: 15
---
```

## Body

Normal GitHub-flavoured Markdown (headings `##`/`###`, lists, tables, fenced code with a
language: `js`, `ts`, `tsx`, `jsx`, `html`, `css`, `bash`, `json`, `text`). Use `##` for the
lesson's main sections — they become the table of contents. Never use `#` (the title is
rendered from frontmatter).

Inline HTML is allowed but avoid it. ASCII diagrams go in ```` ```text ```` blocks.

Custom blocks start with a line `:::<kind> ...` and end with a line that is exactly `:::`.
They cannot be nested. Lines inside fenced code blocks are never treated as directives.

### Interactive visual

```
:::visual event-loop
:::
```

Available visual ids (built as React components — use only these):

| id | what it shows |
|---|---|
| `url-journey` | Step-by-step animation: URL typed → DNS → TCP → TLS → HTTP → parse → render |
| `http-anatomy` | Anatomy of an HTTP request/response (method, headers, status, body) |
| `rendering-pipeline` | DOM + CSSOM → render tree → layout → paint → composite; what reflow/repaint/composite-only changes trigger |
| `script-loading` | Timeline of `<script>` vs `async` vs `defer` vs `type=module` against HTML parsing |
| `box-model` | Interactive box model with margin/border/padding sliders and box-sizing toggle |
| `specificity` | Specificity calculator — type a selector, see (inline, id, class, element) score |
| `layout-playground` | Flexbox & Grid playground with live controls |
| `rem-em` | Nested elements showing how `em` compounds and `rem` doesn't |
| `scope-chain` | Nested lexical scopes / closure retaining variables |
| `execution-context` | Creation vs execution phase, hoisting, TDZ, call stack frames, stepper |
| `event-loop` | Interactive stepper: call stack, Web APIs, microtask queue, macrotask queue, console |
| `prototype-chain` | Object → Constructor.prototype → Object.prototype → null lookup |
| `event-propagation` | Capture → target → bubble animation on nested elements |
| `promise-combinators` | Promise.all / allSettled / race / any racing the same promises |
| `debounce-throttle` | Live: raw events vs debounced vs throttled on a timeline |
| `storage-compare` | Cookies vs localStorage vs sessionStorage vs IndexedDB vs Cache Storage |
| `cache-layers` | Request path through memory cache, service worker, disk/HTTP cache, CDN, origin |
| `cors-preflight` | Sequence diagram of a simple vs preflighted CORS request |
| `vdom-diff` | Old vs new virtual DOM tree, diff and minimal DOM patches; keys vs index |
| `react-rerender` | Component tree; trigger state changes and see which components re-render, toggle memo |
| `auth-flow` | JWT access + refresh token flow, expiry and silent refresh |
| `concurrency-limit` | Task runner with max-N concurrency lanes |
| `virtual-list` | 10,000 rows with only the visible window mounted (shows DOM node count) |
| `fiber-phases` | Fiber work loop: render phase (interruptible) vs commit phase, priority lanes |
| `rendering-strategies` | CSR vs SSR vs SSG vs ISR vs streaming timelines (TTFB, FCP, TTI) |
| `web-vitals` | LCP / INP / CLS / FCP / TTFB gauges with good / needs-improvement / poor thresholds |
| `radio-framework` | RADIO framework for frontend system design interviews |

### Callout

```
:::callout tip Optional title here
Markdown content.
:::
```
Kinds: `tip`, `info`, `warn`, `danger`, `analogy` (real-world analogy), `interview` (what interviewers look for).

### Theory question — answer is always visible (read-to-learn)

```
:::question
difficulty: easy
companies: Tekion, Groww
### What is the difference between var, let and const?
Answer in Markdown. Be complete: explanation, example code, gotchas,
and a crisp "In an interview, say:" one-liner at the end when useful.
:::
```
`difficulty` is `easy | medium | hard`. `companies` is optional (only where the reference doc
or well-known public reports tie the question to a company).

### Challenge — solve it first, answer hidden behind "Show answer"

```
:::challenge
difficulty: medium
companies: Google, Meta
### Implement debounce(fn, wait)
Problem statement in Markdown (requirements, examples, edge cases).
@@@hint
Optional hint (revealed separately).
@@@starter
```js
function debounce(fn, wait) {
  // your code
}
```
@@@tests
```js
test('calls once after the wait', async () => {
  let n = 0
  const d = debounce(() => n++, 50)
  d(); d(); d()
  await sleep(80)
  expect(n).toBe(1)
})
```
@@@solution
Full solution in Markdown: code block(s) + explanation + complexity + follow-ups.
:::
```

- `@@@starter` and `@@@tests` are optional and only make sense for **plain JavaScript**
  challenges that can run in the browser playground. When present, the user gets a
  "Try it" editor that runs the tests.
- Tests run in an isolated iframe after the user's code. Available globals:
  `test(name, fn)` (fn may be async), `expect(x).toBe(y)`, `.toEqual(y)` (deep),
  `.toBeTruthy()`, `.toBeFalsy()`, `.toThrow()`, `.toBeGreaterThan(n)`, `.toBeLessThan(n)`,
  `.toContain(x)`, `sleep(ms)` and `console.log`. No DOM tests, no imports. Keep timers small (< 300ms).
- React / UI machine-coding challenges: no starter/tests; put a complete, working solution
  (component code + CSS if needed) and a walkthrough of the approach, state design,
  edge cases, accessibility and follow-up questions interviewers ask.
- Output-prediction questions ("what does this log?") are challenges too: the code goes in the
  prompt, the answer + step-by-step reasoning goes in `@@@solution`.

### Quiz (multiple choice, self-check)

```
:::quiz
### Which runs first?
- [ ] setTimeout(cb, 0)
- [x] Promise.resolve().then(cb)
- [ ] requestAnimationFrame(cb)
@@@explain
Microtasks drain before the next macrotask.
:::
```
Exactly one `[x]`. 2–3 quizzes per lesson end the lesson nicely.

## Style

- Teach first, then test. Each lesson: intuition / analogy → how it really works (with
  visuals or ASCII diagrams) → code examples → common pitfalls → interview questions →
  challenges → quizzes.
- Write so that someone reading only this site gains a **core, durable understanding**.
  Prefer depth and "why" over lists of facts.
- Keep paragraphs short. Use tables for comparisons. Code must be correct and modern
  (ES2022+, React 18/19 function components unless a question is about classes).
- Tone: friendly, confident, precise. No filler, no emojis in headings.
