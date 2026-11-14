---
title: Virtual DOM & Components From Scratch
summary: Build a tiny virtual DOM — h(), render, diff and patch with keys — and React-like class components in pure ES5 with setState, lifecycle and shouldComponentUpdate.
minutes: 28
---

## What a virtual DOM really is

A **virtual DOM** is just a tree of plain JavaScript objects describing what the UI *should* look like:

```js
{ type: 'ul', props: { class: 'list' }, children: [
  { type: 'li', props: { key: 'a' }, children: ['Apple'] },
  { type: 'li', props: { key: 'b' }, children: ['Banana'] },
]}
```

The library's job, every time state changes:

1. Call your render function → get a **new** tree.
2. **Diff** it against the previous tree.
3. Apply the **minimal set of real DOM operations** (patches).

Why bother? Real DOM operations aren't slow per se, but *uncoordinated* DOM writes interleaved with reads cause layout thrashing, and hand-writing "update just what changed" code for every state transition is error-prone. The virtual DOM lets you write UI as `f(state)` — re-render everything conceptually — while the library figures out the cheap update. It's a **developer-experience** win with acceptable performance, not magic speed (Svelte and Solid skip the VDOM entirely with compile-time or fine-grained reactivity).

:::visual vdom-diff
:::

## Step 1: `h` — creating vnodes

JSX compiles to calls like `h('li', { key: 'a' }, 'Apple')` (React calls it `createElement` / `jsx`).

```js
function h(type, props, ...children) {
  return {
    type,
    props: props || {},
    key: props?.key ?? null,
    children: children
      .flat(Infinity)                                   // allow arrays from .map()
      .filter((c) => c !== null && c !== false && c !== undefined && c !== true)
      .map((c) => (typeof c === 'object' ? c : String(c))), // text nodes as strings
  }
}
```

## Step 2: render — vnode → real DOM

```js
function createDom(vnode) {
  if (typeof vnode === 'string') return document.createTextNode(vnode)
  const el = document.createElement(vnode.type)
  setProps(el, {}, vnode.props)
  vnode.children.forEach((child) => el.appendChild(createDom(child)))
  return el
}

function setProps(el, oldProps, newProps) {
  for (const name in { ...oldProps, ...newProps }) {
    if (name === 'key') continue
    const oldVal = oldProps[name], newVal = newProps[name]
    if (oldVal === newVal) continue
    if (name.startsWith('on')) {
      const evt = name.slice(2).toLowerCase()
      if (oldVal) el.removeEventListener(evt, oldVal)
      if (newVal) el.addEventListener(evt, newVal)
    } else if (newVal == null || newVal === false) {
      el.removeAttribute(name)
    } else {
      el.setAttribute(name, newVal)
    }
  }
}
```

## Step 3: diff & patch — the reconciliation heuristics

A general tree diff is O(n³). React's insight: real UIs rarely move subtrees between parents, so use two heuristics to get O(n):

1. **Different type → replace the whole subtree.** `<div>` → `<span>`? Don't try to morph; destroy and recreate.
2. **Children are matched by `key`** (or by index when there are no keys).

```js
function patch(parent, oldV, newV, index = 0) {
  const el = parent.childNodes[index]
  if (oldV === undefined) return parent.appendChild(createDom(newV))   // added
  if (newV === undefined) return parent.removeChild(el)                // removed
  if (changed(oldV, newV)) return parent.replaceChild(createDom(newV), el) // type/text change
  if (typeof newV === 'string') return
  setProps(el, oldV.props, newV.props)                                 // same element: update props
  patchChildren(el, oldV.children, newV.children)
}

const changed = (a, b) =>
  typeof a !== typeof b ||
  (typeof a === 'string' && a !== b) ||
  (typeof a === 'object' && (a.type !== b.type || a.key !== b.key))
```

### Why keys matter

Without keys, children are compared **by position**. Insert "Cherry" at the start of `[Apple, Banana]`:

```text
index diff (no keys):            keyed diff:
  0: Apple  → Cherry  (update)     Cherry: new → create 1 node
  1: Banana → Apple   (update)     Apple:  same key → keep (move)
  2: —      → Banana  (create)     Banana: same key → keep
  = 2 text updates + 1 create      = 1 create, DOM nodes reused
```

Worse than wasted work: if those `<li>`s contain **inputs or component state**, the index approach attaches Apple's state to Cherry's row. That's the "why not use index as key" bug — state follows position instead of identity. Keyed diffing builds a `key → old child` map, reuses matching nodes (moving them), creates new ones and removes leftovers. React additionally uses a "last placed index" trick to minimise moves; Vue uses the longest increasing subsequence.

A simplified keyed children patch:

```js
function patchChildren(el, oldCh, newCh) {
  const keyed = oldCh.every((c) => typeof c === 'object' && c.key != null) &&
                newCh.every((c) => typeof c === 'object' && c.key != null)
  if (!keyed) {
    const max = Math.max(oldCh.length, newCh.length)
    for (let i = max - 1; i >= 0; i--) patch(el, oldCh[i], newCh[i], i) // reverse so removals don't shift indices
    return
  }
  const oldMap = new Map(oldCh.map((c, i) => [c.key, { vnode: c, dom: el.childNodes[i] }]))
  newCh.forEach((child, i) => {
    const match = oldMap.get(child.key)
    let dom
    if (match && match.vnode.type === child.type) {
      dom = match.dom
      setProps(dom, match.vnode.props, child.props)
      patchChildren(dom, match.vnode.children, child.children)
      oldMap.delete(child.key)
    } else {
      dom = createDom(child)
    }
    const current = el.childNodes[i]
    if (current !== dom) el.insertBefore(dom, current || null) // move or insert
  })
  oldMap.forEach(({ dom }) => el.removeChild(dom)) // leftovers were deleted
}
```

## React-like class components in ES5

The reference doc asks to "build React-like class components from scratch (ES5)". ES5 means no `class` keyword: constructor functions + prototypes. This tests prototype inheritance as much as UI knowledge.

```js
function Component(props) {
  this.props = props || {}
  this.state = {}
  this._container = null
}

Component.prototype.setState = function (partial) {
  var prevState = this.state
  var update = typeof partial === 'function' ? partial(prevState, this.props) : partial
  var nextState = Object.assign({}, prevState, update) // shallow merge, like React
  if (this.shouldComponentUpdate && !this.shouldComponentUpdate(this.props, nextState)) {
    this.state = nextState // state still updates, but no re-render
    return
  }
  this.state = nextState
  this._update(prevState)
}

Component.prototype._update = function (prevState) {
  this._container.innerHTML = this.render()
  if (this.componentDidUpdate) this.componentDidUpdate(this.props, prevState)
}

function mount(Ctor, props, container) {
  var instance = new Ctor(props)
  instance._container = container
  container.innerHTML = instance.render()
  if (instance.componentDidMount) instance.componentDidMount()
  return instance
}

// A user component, ES5 style:
function Counter(props) {
  Component.call(this, props)        // "super(props)"
  this.state = { count: props.start || 0 }
}
Counter.prototype = Object.create(Component.prototype) // inherit methods
Counter.prototype.constructor = Counter
Counter.prototype.render = function () {
  return '<button>' + this.props.label + ': ' + this.state.count + '</button>'
}
```

Key points to narrate:

- `Component.call(this, props)` is what `super(props)` does — runs the parent constructor on the new object.
- `Object.create(Component.prototype)` links `Counter.prototype → Component.prototype`, so instances find `setState` via the **prototype chain**. Resetting `constructor` keeps `instance.constructor === Counter`.
- `setState` **merges** shallowly, supports the functional form `(prev, props) => partial` (needed when updates depend on previous state), honours `shouldComponentUpdate`, then re-renders and calls `componentDidUpdate(prevProps, prevState)`.
- Real React **batches** multiple `setState` calls in one event into a single render; we could queue updates and flush them in a microtask.

:::visual prototype-chain
:::

## Interview questions

:::question
difficulty: medium
companies: Meta, Walmart
### Is the virtual DOM faster than the real DOM?
Not inherently — it *adds* work (building trees and diffing) on top of the DOM operations that still have to happen. Its value is that you can describe UI declaratively as a function of state and let the library compute a near-minimal set of DOM mutations, batched together, avoiding layout thrashing and manual bookkeeping. Hand-optimised DOM code can beat it; compile-time frameworks (Svelte) and fine-grained signals (Solid) avoid the diff entirely. The honest answer: "fast enough by default, with a much better programming model."
:::

:::question
difficulty: medium
### What are the two heuristics that make React's diff O(n)?
1. Elements of **different types** produce different trees — React tears down the old subtree and builds a new one instead of trying to transform it.
2. Developers hint at **stable identity among siblings with `key`**, so React can match children across renders even when they're reordered, inserted or removed.
With these, React compares level by level and never tries to detect subtrees moving between parents — reducing the theoretical O(n³) tree-edit distance to O(n).
:::

:::question
difficulty: medium
companies: Tekion
### What problems do index keys cause?
When items are inserted, removed or reordered, an item's index changes, so React matches the wrong old element to the new item:
- Component state (input text, checkbox, expanded state) and DOM state (focus, scroll) stick to the **position**, so they appear on the wrong item.
- More DOM updates than needed (every shifted row updates its text).
- Animations/transitions glitch.
Index keys are fine only for static lists that never reorder and have no state. Use stable IDs from data.
:::

## Challenges

:::challenge
difficulty: medium
companies: Meta
### Implement h() and renderToString(vnode)
Implement:

- `h(type, props, ...children)` → `{ type, props, children }`. Flatten nested arrays of children; drop `null`, `undefined`, `true`, `false`; convert numbers to strings. `props` defaults to `{}`.
- `renderToString(vnode)` → HTML string. Strings are escaped (`&`, `<`, `>`, `"`). Props become attributes (`className` → `class`); skip `key`, functions (event handlers), and `false`/`null` values; `true` renders a bare attribute. Void elements (`br`, `img`, `input`, `hr`, `meta`, `link`) have no closing tag.
@@@starter
```js
function h(type, props, ...children) {}
function renderToString(vnode) {}
```
@@@tests
```js
test('h flattens and cleans children', () => {
  const v = h('ul', null, [h('li', { key: 1 }, 'a'), [h('li', null, 2)]], null, false, 'x')
  expect(v.props).toEqual({})
  expect(v.children.length).toBe(3)
  expect(v.children[1].children).toEqual(['2'])
  expect(v.children[2]).toBe('x')
})

test('renders nested markup with attributes', () => {
  const v = h('div', { className: 'card', id: 'c1', onClick: () => {}, hidden: false, key: 'k' },
    h('h2', null, 'Title'), h('p', { 'data-x': 5 }, 'Body'))
  expect(renderToString(v)).toBe('<div class="card" id="c1"><h2>Title</h2><p data-x="5">Body</p></div>')
})

test('escapes text and attributes', () => {
  expect(renderToString(h('p', { title: 'a"b' }, '<script>&'))).toBe('<p title="a&quot;b">&lt;script&gt;&amp;</p>')
})

test('void elements and boolean attributes', () => {
  expect(renderToString(h('div', null, h('input', { disabled: true, value: 'x' }), h('br')))).toBe('<div><input disabled value="x"><br></div>')
})
```
@@@solution
```js
function h(type, props, ...children) {
  return {
    type,
    props: props || {},
    children: children
      .flat(Infinity)
      .filter((c) => c !== null && c !== undefined && c !== true && c !== false)
      .map((c) => (typeof c === 'object' ? c : String(c))),
  }
}

const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link'])

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderToString(vnode) {
  if (typeof vnode === 'string' || typeof vnode === 'number') return escapeHtml(vnode)
  let attrs = ''
  for (const [name, value] of Object.entries(vnode.props)) {
    if (name === 'key' || typeof value === 'function' || value === false || value == null) continue
    const attr = name === 'className' ? 'class' : name
    attrs += value === true ? ` ${attr}` : ` ${attr}="${escapeHtml(value)}"`
  }
  if (VOID.has(vnode.type)) return `<${vnode.type}${attrs}>`
  const inner = vnode.children.map(renderToString).join('')
  return `<${vnode.type}${attrs}>${inner}</${vnode.type}>`
}
```

- `flat(Infinity)` supports `children` produced by `.map()` (arrays) and nested arrays.
- Escape `&` **first**, otherwise you'd double-escape the entities you create. Escaping is what makes SSR safe from XSS when rendering user content.
- Event handlers are skipped on the server; on the client, **hydration** attaches them to the existing markup.

This is essentially what `ReactDOMServer.renderToString` does (plus components, hooks and streaming).
:::

:::challenge
difficulty: hard
companies: Meta
### Implement diff(oldVNode, newVNode) returning a list of patches
Vnodes are strings (text) or `{ type, props, children }` (children may have `props.key`). Return an array of patch objects describing how to turn old into new, using a `path` array of child indices from the root:

- `{ op: 'replace', path, node }` — types differ, or text differs, or old is a string and new isn't (or vice versa).
- `{ op: 'props', path, set: {...}, remove: [...] }` — same element type; only when something changed. `remove` lists removed prop names sorted alphabetically.
- `{ op: 'insert', path, node }` — new child at `path` (path ends with its index in the **new** children).
- `{ op: 'remove', path }` — old child at `path` (index in the **old** children).

Children are compared **by index** (no key matching needed). Emit patches in this order for an element: its own `props` patch, then children from index 0 upward (recursive patches, inserts, removes).
@@@starter
```js
function diff(oldV, newV, path = []) {
  // your code
}
```
@@@tests
```js
const el = (type, props, ...children) => ({ type, props: props || {}, children })

test('identical trees produce no patches', () => {
  const t = el('div', { id: 'a' }, el('p', null, 'hi'))
  expect(diff(t, el('div', { id: 'a' }, el('p', null, 'hi')))).toEqual([])
})

test('text change and type change replace', () => {
  expect(diff(el('p', null, 'a'), el('p', null, 'b'))).toEqual([{ op: 'replace', path: [0], node: 'b' }])
  expect(diff(el('p'), el('span'))).toEqual([{ op: 'replace', path: [], node: el('span') }])
})

test('props set and remove', () => {
  expect(diff(el('a', { href: '/x', title: 't', id: 'i' }), el('a', { href: '/y', id: 'i', target: '_blank' }))).toEqual([
    { op: 'props', path: [], set: { href: '/y', target: '_blank' }, remove: ['title'] },
  ])
})

test('insert and remove children', () => {
  const a = el('ul', null, el('li', null, '1'), el('li', null, '2'), el('li', null, '3'))
  const b = el('ul', null, el('li', null, '1'))
  expect(diff(a, b)).toEqual([{ op: 'remove', path: [1] }, { op: 'remove', path: [2] }])
  expect(diff(b, a)).toEqual([
    { op: 'insert', path: [1], node: el('li', null, '2') },
    { op: 'insert', path: [2], node: el('li', null, '3') },
  ])
})

test('nested paths', () => {
  const a = el('div', null, el('section', null, el('p', { class: 'x' }, 'hi')))
  const b = el('div', null, el('section', null, el('p', { class: 'y' }, 'hi')))
  expect(diff(a, b)).toEqual([{ op: 'props', path: [0, 0], set: { class: 'y' }, remove: [] }])
})
```
@@@solution
```js
function diff(oldV, newV, path = []) {
  const patches = []
  const isText = (v) => typeof v === 'string'

  if (isText(oldV) || isText(newV)) {
    if (oldV !== newV) patches.push({ op: 'replace', path, node: newV })
    return patches
  }
  if (oldV.type !== newV.type) {
    patches.push({ op: 'replace', path, node: newV })
    return patches
  }

  // props
  const set = {}
  const remove = []
  for (const k of Object.keys(newV.props)) {
    if (oldV.props[k] !== newV.props[k]) set[k] = newV.props[k]
  }
  for (const k of Object.keys(oldV.props)) {
    if (!(k in newV.props)) remove.push(k)
  }
  remove.sort()
  if (Object.keys(set).length || remove.length) patches.push({ op: 'props', path, set, remove })

  // children by index
  const oldCh = oldV.children || []
  const newCh = newV.children || []
  const max = Math.max(oldCh.length, newCh.length)
  for (let i = 0; i < max; i++) {
    const childPath = [...path, i]
    if (i >= oldCh.length) patches.push({ op: 'insert', path: childPath, node: newCh[i] })
    else if (i >= newCh.length) patches.push({ op: 'remove', path: childPath })
    else patches.push(...diff(oldCh[i], newCh[i], childPath))
  }
  return patches
}
```

- Text nodes: equal strings → nothing; otherwise replace (also covers text ↔ element).
- Different element type → replace the whole subtree; we don't descend (React heuristic #1).
- Same type → compute prop changes, then recurse into children by index.
- Complexity O(n) in the number of nodes.

**Applying patches** to the real DOM: remove patches must be applied in **reverse index order** (otherwise earlier removals shift later indices). **Follow-up:** add keyed matching — build a map from key to old child and emit `move` patches.
:::

:::challenge
difficulty: hard
companies: Tekion
### Build React-like class components in ES5
Using **ES5 only** for the base (constructor function + prototype), implement:

- `Component(props)` — sets `this.props` (default `{}`) and `this.state = {}`.
- `Component.prototype.setState(partial)` — `partial` is an object or `(prevState, props) => object`. Shallow-merge into a **new** state object. If the instance defines `shouldComponentUpdate(nextProps, nextState)` and it returns `false`, update `this.state` but don't re-render. Otherwise set the state, re-render into the container (`container.innerHTML = this.render()`) and call `componentDidUpdate(prevProps, prevState)` if defined.
- `mount(Ctor, props, container)` — instantiate, render into `container.innerHTML`, call `componentDidMount()` if defined, return the instance.

Containers in tests are plain objects with an `innerHTML` property.
@@@starter
```js
function Component(props) {}
Component.prototype.setState = function (partial) {}
function mount(Ctor, props, container) {}
```
@@@tests
```js
function Counter(props) {
  Component.call(this, props)
  this.state = { count: props.start, clicks: 0 }
}
Counter.prototype = Object.create(Component.prototype)
Counter.prototype.constructor = Counter
Counter.prototype.render = function () {
  return '<b>' + this.props.label + ':' + this.state.count + '</b>'
}

test('mount renders and calls didMount', () => {
  let mounted = false
  Counter.prototype.componentDidMount = function () { mounted = true }
  const box = { innerHTML: '' }
  const c = mount(Counter, { start: 3, label: 'n' }, box)
  expect(box.innerHTML).toBe('<b>n:3</b>')
  expect(mounted).toBe(true)
  expect(c instanceof Component).toBe(true)
  expect(c.constructor === Counter).toBe(true)
  delete Counter.prototype.componentDidMount
})

test('setState merges and re-renders', () => {
  const box = { innerHTML: '' }
  const c = mount(Counter, { start: 0, label: 'x' }, box)
  const before = c.state
  c.setState({ count: 5 })
  expect(box.innerHTML).toBe('<b>x:5</b>')
  expect(c.state).toEqual({ count: 5, clicks: 0 })
  expect(c.state === before).toBe(false)
})

test('functional setState and componentDidUpdate', () => {
  const box = { innerHTML: '' }
  let prev
  Counter.prototype.componentDidUpdate = function (prevProps, prevState) { prev = prevState }
  const c = mount(Counter, { start: 1, label: 'y' }, box)
  c.setState((s) => ({ count: s.count + 1 }))
  c.setState((s) => ({ count: s.count + 1 }))
  expect(box.innerHTML).toBe('<b>y:3</b>')
  expect(prev.count).toBe(2)
  delete Counter.prototype.componentDidUpdate
})

test('shouldComponentUpdate false skips render', () => {
  const box = { innerHTML: '' }
  Counter.prototype.shouldComponentUpdate = function (p, next) { return next.count % 2 === 0 }
  const c = mount(Counter, { start: 0, label: 'z' }, box)
  c.setState({ count: 1 })
  expect(box.innerHTML).toBe('<b>z:0</b>')
  expect(c.state.count).toBe(1)
  c.setState({ count: 2 })
  expect(box.innerHTML).toBe('<b>z:2</b>')
  delete Counter.prototype.shouldComponentUpdate
})
```
@@@solution
```js
function Component(props) {
  this.props = props || {}
  this.state = {}
  this._container = null
}

Component.prototype.setState = function (partial) {
  var prevState = this.state
  var update = typeof partial === 'function' ? partial(prevState, this.props) : partial
  var nextState = Object.assign({}, prevState, update)

  if (typeof this.shouldComponentUpdate === 'function' &&
      this.shouldComponentUpdate(this.props, nextState) === false) {
    this.state = nextState
    return
  }

  this.state = nextState
  if (this._container) this._container.innerHTML = this.render()
  if (typeof this.componentDidUpdate === 'function') {
    this.componentDidUpdate(this.props, prevState)
  }
}

function mount(Ctor, props, container) {
  var instance = new Ctor(props || {})
  instance._container = container
  container.innerHTML = instance.render()
  if (typeof instance.componentDidMount === 'function') instance.componentDidMount()
  return instance
}
```

**What this demonstrates**

- **Inheritance in ES5:** `Component.call(this, props)` (super call) + `Child.prototype = Object.create(Component.prototype)` + restoring `constructor`. Instances find `setState` through the prototype chain.
- **Immutability:** `Object.assign({}, prev, update)` creates a new state object, so `prevState` handed to `componentDidUpdate` is accurate.
- **Functional updates** read the *latest* state, so two consecutive increments both apply.
- **shouldComponentUpdate** is a render gate — state still changes; only the render is skipped (this is what `PureComponent` automates with a shallow compare).

**Follow-ups:** batch updates (queue partials, flush once in `queueMicrotask`), replace `innerHTML` with the VDOM diff from earlier to preserve DOM state, and add props updates (`componentWillReceiveProps` → `getDerivedStateFromProps`).
:::

## Quick check

:::quiz
### React finds `<div>` replaced by `<section>` with identical children. What does it do?
- [ ] Changes the tag name in place
- [x] Unmounts the old subtree (and its state) and mounts a new one
- [ ] Diffs the children and keeps them
- [ ] Throws a warning
@@@explain
Different element type ⇒ different tree. Child components are unmounted and their state is lost.
:::

:::quiz
### In ES5, what does `Child.prototype = Object.create(Parent.prototype)` achieve?
- [ ] Copies Parent's methods onto Child
- [x] Makes Child's prototype delegate to Parent's prototype, so instances inherit Parent methods
- [ ] Calls the Parent constructor
- [ ] Makes Child a subclass of Object only
@@@explain
It sets up delegation through the prototype chain. The constructor call (`Parent.call(this)`) is a separate step.
:::
