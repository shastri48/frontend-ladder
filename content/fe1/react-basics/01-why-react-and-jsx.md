---
title: Why React, JSX & Components
summary: The problem React solves, what JSX compiles to, and the precise difference between a React Node, Element and Component.
minutes: 15
---

## The problem: keeping UI in sync with data

In the vanilla todo app you wrote, every change meant: update state → figure out which DOM nodes to change → change them. With a few features that's fine. With hundreds of interacting pieces (a dashboard, a checkout flow), manually syncing the DOM becomes the main source of bugs — a counter here forgot to update, a list there duplicated an item.

React's core idea:

> **UI = f(state)**. You describe what the UI should look like *for the current state*. When state changes, React figures out the minimal DOM changes for you.

You write **declarative** code ("the button is disabled when saving") instead of **imperative** code ("on save start, find the button, set disabled; on save end, find it again, unset disabled").

```jsx
function SaveButton({ saving }) {
  return <button disabled={saving}>{saving ? "Saving…" : "Save"}</button>
}
```

Other wins: **components** (reusable, composable pieces), a huge ecosystem, and one mental model for web (React DOM) and mobile (React Native).

## JSX: HTML-looking JavaScript

JSX is a **syntax extension**. Browsers don't understand it; a compiler (Babel, SWC, esbuild — built into Vite/Next) turns it into function calls:

```jsx
const el = <h1 className="title">Hello, {name}</h1>
```

compiles to (modern "automatic runtime"):

```js
import { jsx as _jsx } from "react/jsx-runtime"
const el = _jsx("h1", { className: "title", children: ["Hello, ", name] })
```

or with the classic runtime:

```js
const el = React.createElement("h1", { className: "title" }, "Hello, ", name)
```

### JSX rules

- **One root** per return — wrap siblings in a parent or a Fragment `<>...</>`.
- **Close every tag**: `<img />`, `<input />`.
- **camelCase attributes**: `className` (not `class`), `htmlFor` (not `for`), `onClick`, `tabIndex`. `aria-*` and `data-*` stay dashed.
- **`{}` embeds any JS expression**: `{user.name}`, `{items.length}`, `{isOpen ? "Close" : "Open"}`. Not statements (`if`, `for`).
- **`style` takes an object**: `style={{ marginTop: 8, color: "teal" }}`.
- **Components start with a capital letter**: `<Card />` is your component; `<card />` would be treated as an HTML tag.
- `{false}`, `{null}`, `{undefined}`, `{true}` render **nothing** — but `{0}` renders "0"!
- JSX **escapes** values automatically: `{"<script>"}` renders as text, protecting you from XSS (unless you use `dangerouslySetInnerHTML`).

## Components

A component is a **function that returns UI** (JSX). It receives **props** (an object) as its argument.

```jsx
function Avatar({ src, name, size = 40 }) {
  return <img src={src} alt={name} width={size} height={size} className="avatar" />
}

function UserCard({ user }) {
  return (
    <div className="card">
      <Avatar src={user.photo} name={user.name} />
      <h3>{user.name}</h3>
    </div>
  )
}
```

Components compose like LEGO: small pieces (`Avatar`) inside bigger ones (`UserCard`) inside pages. Each should do one thing well.

## Node vs Element vs Component — precisely

This is a common interview question because the words are often used loosely.

| Term | What it is | Example |
|---|---|---|
| **Component** | A function (or class) that *returns* elements. The blueprint. | `function Button(props) { ... }` |
| **Element** | A plain, immutable **object** describing what to render: `{ type, props, key, ref }`. Created by JSX / `createElement`. Cheap. | `<Button label="Hi" />` |
| **Node** | Anything React can render: an element, string, number, array of nodes, `null`, `undefined`, boolean, a portal. The type of `children`. | `"hi"`, `42`, `[<li/>, <li/>]`, `null` |

```jsx
function Greeting({ name }) {                 // Component
  return <p>Hello {name}</p>
}

const element = <Greeting name="Asha" />      // Element: an object
console.log(element)
// { type: Greeting, props: { name: "Asha" }, key: null, ... }

const node1 = "plain text"                    // Node
const node2 = [<li key="a">A</li>, null, 7]   // Node (array of nodes)
```

Writing `<Greeting />` does **not** call `Greeting`. It creates an element object that says "React, please render `Greeting` with these props here." React decides *when* to call your function. That's why you should never call components as functions (`{Greeting({name})}`) — you'd bypass React's hooks and reconciliation.

:::callout analogy Recipe, order, plate
The **component** is the recipe. An **element** is an order slip ("one Greeting, name Asha") — lightweight, just a description. A **node** is anything that can go on the plate: a dish, a garnish, nothing at all.
:::

## createElement and cloneElement

```js
React.createElement(type, props, ...children)
```

- `type`: a tag string (`"div"`) or a component.
- Returns a new element object.

```js
React.cloneElement(element, extraProps, ...newChildren)
```

- Takes an **existing element** and returns a copy with merged props (and optionally new children). `key` and `ref` are preserved unless overridden.
- Used by component libraries to inject props into children (e.g. a `RadioGroup` adding `name` and `checked` to each `Radio`). Modern code prefers context or render props because `cloneElement` is implicit and fragile.

```jsx
function Toolbar({ children }) {
  return React.Children.map(children, (child) =>
    React.cloneElement(child, { size: "small" })
  )
}
```

## How a React app starts

```jsx
// main.jsx
import { createRoot } from "react-dom/client"
import App from "./App"

createRoot(document.getElementById("root")).render(<App />)
```

React takes over the `#root` div and renders your tree into it. From then on, you never touch the DOM directly (except through refs for focus, measurements, third-party widgets).

## Interview questions

:::question
difficulty: easy
companies: Common
### What is the difference between a React Node, Element and Component?
A **Component** is a function or class that accepts props and returns what to render. An **Element** is the immutable plain object (`{ type, props, key, ref }`) produced by JSX or `React.createElement` that describes a piece of UI — it's what components return. A **Node** is anything renderable: elements, strings, numbers, arrays/fragments of nodes, portals, `null`/`undefined`/booleans (render nothing). `children` is typed as `ReactNode`.
:::

:::question
difficulty: easy
### What is JSX and is it required?
JSX is a syntax extension that lets you write HTML-like markup in JavaScript. A compiler turns it into `jsx()`/`React.createElement()` calls that produce element objects. It's not required — you could call `createElement` directly — but it's far more readable. JSX expressions escape embedded values, which protects against XSS by default.
:::

:::question
difficulty: medium
### What's the difference between createElement and cloneElement?
`createElement(type, props, ...children)` builds a **new** element from a type. `cloneElement(element, props, ...children)` takes an **existing element** and returns a copy with props shallowly merged and optionally new children, preserving its `key` and `ref`. `cloneElement` is used to inject props into children you didn't create; it's considered a legacy pattern compared to context or render props because the data flow is implicit.
:::

:::question
difficulty: easy
### Why do component names need to start with a capital letter?
JSX uses the case to decide the element type: lowercase (`<div>`) compiles to a string tag `"div"`, capitalised (`<Card>`) compiles to a reference to the variable `Card`. A lowercase component would be treated as an unknown HTML element.
:::

## Challenges

:::challenge
difficulty: easy
### What renders?
```jsx
function List({ items }) {
  return (
    <div>
      {items.length && <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>}
      {false}{null}{undefined}{true}
      {"<b>bold?</b>"}
    </div>
  )
}
<List items={[]} />
```
@@@solution
It renders `<div>0&lt;b&gt;bold?&lt;/b&gt;</div>` — i.e. the text **"0"** followed by the literal text `<b>bold?</b>`.

- `items.length && ...` evaluates to `0` when the array is empty, and React renders the number 0. Fix with `items.length > 0 && ...` or a ternary.
- `false`, `null`, `undefined`, `true` render nothing.
- Strings are escaped, so HTML tags appear as text, not markup.
:::

:::challenge
difficulty: easy
### Rewrite without JSX
Convert this JSX to `React.createElement` calls:
```jsx
<section className="hero">
  <h1>Learn {topic}</h1>
  <Button variant="primary" onClick={start}>Start</Button>
</section>
```
@@@solution
```js
React.createElement(
  "section",
  { className: "hero" },
  React.createElement("h1", null, "Learn ", topic),
  React.createElement(Button, { variant: "primary", onClick: start }, "Start")
)
```
Note the string `"section"` vs the variable `Button` — that's the lowercase/uppercase rule in action. Children are passed as extra arguments (they end up in `props.children`).
:::

:::quiz
### What does `<Card title="x" />` produce?
- [ ] It calls Card immediately and returns DOM
- [x] An element object describing Card with props
- [ ] A DOM node
- [ ] A string of HTML
@@@explain
JSX creates element descriptions; React later decides when to call the component.
:::

:::quiz
### Which renders nothing?
- [ ] {0}
- [ ] {"false"}
- [x] {false}
- [ ] {NaN}
@@@explain
Booleans, null and undefined render nothing; numbers (including 0 and NaN) and strings render.
:::
