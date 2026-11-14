---
title: Build a Mini React — Elements, Render & Hooks
summary: Implement createElement, a renderer, useState with a hooks array and a simple diff — the mental model behind React.
minutes: 25
---

## Why build one?

Senior interviews increasingly ask "how would you build React?", "build a virtual DOM", or "how are hooks stored?" Writing a 100-line version cements the mental model: elements are data, rendering is a function call, hooks are slots indexed by order, and reconciliation patches the DOM.

## Step 1 — createElement

JSX `<div id="a">hi</div>` compiles to `createElement('div', { id: 'a' }, 'hi')`.

```js
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.flat().map(child =>
        typeof child === 'object' && child !== null ? child : createTextElement(child)
      ),
    },
  }
}

function createTextElement(text) {
  return { type: 'TEXT', props: { nodeValue: text ?? '', children: [] } }
}
```

## Step 2 — rendering elements to the DOM

```js
function createDom(element) {
  const dom = element.type === 'TEXT'
    ? document.createTextNode('')
    : document.createElement(element.type)
  updateDomProps(dom, {}, element.props)
  return dom
}

const isEvent = k => k.startsWith('on')
const isProp = k => k !== 'children' && !isEvent(k)

function updateDomProps(dom, prev, next) {
  // remove old / changed listeners
  for (const k of Object.keys(prev).filter(isEvent)) {
    if (prev[k] !== next[k]) dom.removeEventListener(k.slice(2).toLowerCase(), prev[k])
  }
  // remove old props
  for (const k of Object.keys(prev).filter(isProp)) if (!(k in next)) dom[k] = ''
  // set new / changed props
  for (const k of Object.keys(next).filter(isProp)) if (prev[k] !== next[k]) dom[k] = next[k]
  // add new listeners
  for (const k of Object.keys(next).filter(isEvent)) {
    if (prev[k] !== next[k]) dom.addEventListener(k.slice(2).toLowerCase(), next[k])
  }
}
```

## Step 3 — function components and a hooks array

Function components are just functions called with props. To support `useState`, we need per-component storage indexed by call order — exactly what React does with its hook linked list.

```js
let currentInstance = null // the component instance currently rendering
let hookIndex = 0

function useState(initial) {
  const inst = currentInstance
  const i = hookIndex++
  if (inst.hooks.length <= i) {
    inst.hooks[i] = typeof initial === 'function' ? initial() : initial
  }
  const setState = action => {
    const prev = inst.hooks[i]
    const next = typeof action === 'function' ? action(prev) : action
    if (Object.is(prev, next)) return
    inst.hooks[i] = next
    scheduleRerender(inst)
  }
  return [inst.hooks[i], setState]
}
```

Why order matters is now obvious: hook `i` is just `hooks[i]`. Call `useState` conditionally and indices shift.

## Step 4 — a tiny reconciler

We keep a tree of **instances** `{ element, dom, childInstances, hooks }` and diff new elements against them.

```js
function reconcile(parentDom, instance, element) {
  if (instance == null) {                         // mount
    const newInstance = instantiate(element)
    parentDom.appendChild(newInstance.dom)
    return newInstance
  }
  if (element == null) {                          // unmount
    parentDom.removeChild(instance.dom)
    return null
  }
  if (instance.element.type !== element.type) {  // different type → replace
    const newInstance = instantiate(element)
    parentDom.replaceChild(newInstance.dom, instance.dom)
    return newInstance
  }
  if (typeof element.type === 'string' || element.type === 'TEXT') { // same host type → patch
    updateDomProps(instance.dom, instance.element.props, element.props)
    instance.childInstances = reconcileChildren(instance, element)
    instance.element = element
    return instance
  }
  // same component type → re-render it, reconcile its output
  instance.element = element
  const childElement = renderComponent(instance, element)
  const child = reconcile(parentDom, instance.childInstance, childElement)
  instance.childInstance = child
  instance.dom = child?.dom
  return instance
}

function reconcileChildren(instance, element) {
  const dom = instance.dom
  const oldChildren = instance.childInstances
  const nextElements = element.props.children
  const result = []
  const count = Math.max(oldChildren.length, nextElements.length)
  for (let i = 0; i < count; i++) {               // index-based (no keys) for brevity
    const child = reconcile(dom, oldChildren[i], nextElements[i])
    if (child) result.push(child)
  }
  return result
}

function renderComponent(instance, element) {
  currentInstance = instance
  hookIndex = 0
  const out = element.type(element.props)        // call the function component
  currentInstance = null
  return out
}

function instantiate(element) {
  if (typeof element.type === 'function') {
    const instance = { element, hooks: [], childInstance: null, dom: null }
    const childElement = renderComponent(instance, element)
    instance.childInstance = instantiate(childElement)
    instance.dom = instance.childInstance.dom
    return instance
  }
  const dom = createDom(element)
  const childInstances = element.props.children.map(instantiate)
  childInstances.forEach(c => dom.appendChild(c.dom))
  return { element, dom, childInstances }
}

function scheduleRerender(instance) {
  queueMicrotask(() => {                          // naive batching: one re-render per tick
    const parentDom = instance.dom.parentNode
    reconcile(parentDom, instance, instance.element)
  })
}

function render(element, container) {
  container.textContent = ''
  return reconcile(container, null, element)
}
```

Usage:

```js
/** @jsx createElement */
function Counter() {
  const [n, setN] = useState(0)
  return createElement('button', { onClick: () => setN(c => c + 1) }, 'Clicked ', n, ' times')
}
render(createElement(Counter), document.getElementById('root'))
```

## What real React adds

| Mini React | Real React |
|---|---|
| Recursive reconcile (can't pause) | Fiber work loop, interruptible, prioritised by lanes |
| Index-based children | Key-based matching with move detection |
| `hooks` array on instance | Linked list on fiber, update queues per hook, dispatcher swapping mount/update implementations |
| Re-render in microtask | Scheduler with batching across updates and priorities |
| Immediate DOM writes | Separate render and commit phases, double buffering |
| No effects | Passive/layout effects, cleanup ordering, StrictMode |
| Direct listeners | Synthetic event system delegated at the root |

React also swaps the **hooks dispatcher**: during mount, `useState` points to `mountState` (creates hook), during update to `updateState` (reads hook), and outside rendering to a dispatcher that throws "Invalid hook call" — that's how React detects hooks called outside components.

:::question
difficulty: hard
companies: Housing.com
### How are hooks stored internally in React?
Each function component's fiber has `memoizedState`, a **linked list of hook objects** in call order. Each hook object stores its state (`memoizedState`), a queue of pending updates, and a `next` pointer; effect hooks store `{ create, destroy, deps }` and are also linked in the fiber's effect list. On each render React walks the list in step with hook calls, using separate dispatcher implementations for mount (create nodes) and update (read nodes). Because identity is purely positional, hooks must be called in the same order every render.
:::

:::question
difficulty: hard
### Why does React throw "Invalid hook call" when a hook is called outside a component?
React sets `ReactCurrentDispatcher.current` to the mount or update dispatcher only while rendering a component. Outside a render it points to a dispatcher whose methods throw. A hook called from a regular function, a class, or from a duplicate copy of React (two `react` packages in the bundle, each with its own dispatcher) hits that throwing dispatcher.
:::

:::challenge
difficulty: hard
companies: Meta
### Build a virtual DOM: createElement + render to string
Implement `h(type, props, ...children)` returning `{ type, props, children }` (children flattened, `null/false/undefined` removed, numbers converted to strings) and `renderToString(vnode)` that supports function components, attributes (skip `on*` handlers, map `className` → `class`), escapes text, and renders void elements (`br`, `img`, `input`) without closing tags.
@@@starter
```js
function h(type, props, ...children) {
  // your code
}

function renderToString(vnode) {
  // your code
}
```
@@@tests
```js
test('simple element', () => {
  expect(renderToString(h('div', { id: 'a', className: 'box' }, 'hi'))).toBe('<div id="a" class="box">hi</div>')
})
test('nested, numbers, falsy children', () => {
  const v = h('ul', null, h('li', null, 1), false, null, h('li', null, 'two'))
  expect(renderToString(v)).toBe('<ul><li>1</li><li>two</li></ul>')
})
test('function components and events skipped', () => {
  const Btn = ({ label }) => h('button', { onClick: () => {} }, label)
  expect(renderToString(h(Btn, { label: 'Go' }))).toBe('<button>Go</button>')
})
test('escapes text and handles void elements', () => {
  expect(renderToString(h('p', null, '<b>&', h('br')))).toBe('<p>&lt;b&gt;&amp;<br></p>')
})
test('array children', () => {
  expect(renderToString(h('ol', null, ['a', 'b'].map(x => h('li', null, x))))).toBe('<ol><li>a</li><li>b</li></ol>')
})
```
@@@solution
```js
function h(type, props, ...children) {
  const flat = children
    .flat(Infinity)
    .filter(c => c !== null && c !== undefined && c !== false && c !== true)
    .map(c => (typeof c === 'number' ? String(c) : c))
  return { type, props: props || {}, children: flat }
}

const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link'])
const escape = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function renderToString(vnode) {
  if (typeof vnode === 'string') return escape(vnode)
  if (typeof vnode.type === 'function') {
    return renderToString(vnode.type({ ...vnode.props, children: vnode.children }))
  }
  const attrs = Object.entries(vnode.props)
    .filter(([k, v]) => !k.startsWith('on') && k !== 'children' && v != null && v !== false)
    .map(([k, v]) => {
      const name = k === 'className' ? 'class' : k === 'htmlFor' ? 'for' : k
      return v === true ? ` ${name}` : ` ${name}="${escape(v)}"`
    })
    .join('')
  if (VOID.has(vnode.type)) return `<${vnode.type}${attrs}>`
  return `<${vnode.type}${attrs}>${vnode.children.map(renderToString).join('')}</${vnode.type}>`
}
```
Escaping is the security point: unescaped text is an XSS hole — the reason React escapes by default and names its escape hatch `dangerouslySetInnerHTML`. Follow-ups: implement `render(vnode, container)` for the DOM and a `diff(old, new)` that returns patches.
:::

:::quiz
### In a mini React with a hooks array, what breaks if useState is called inside an if?
- [x] Later hooks read the wrong index
- [ ] Nothing
- [ ] The component won't render at all
@@@explain
State identity is the array index (or linked-list position), so skipping a call shifts every later hook.
:::

:::quiz
### Why does React keep a separate commit phase instead of writing DOM during diffing?
- [ ] DOM APIs are async
- [x] So rendering can be interrupted/discarded without leaving a half-updated UI
- [ ] Browsers forbid DOM writes during JS execution
@@@explain
Separating pure computation from mutation enables concurrency and consistency.
:::
