---
title: The `this` Keyword, call/apply/bind & Arrow Functions
summary: The five rules that decide `this`, how call, apply and bind change it, and exactly how arrow functions differ from normal functions.
minutes: 16
---

## `this` is decided at call time

For normal functions, `this` is **not** about where a function is written — it's about **how it is called**. (Arrow functions are the exception: they don't have their own `this`.) That's the opposite of variable scope, which is lexical. Mixing the two up is the source of most `this` bugs.

:::callout analogy The word "here"
The word "here" means a different place depending on who says it and where they're standing. `this` is the same: the function's code is fixed, but `this` is filled in by whoever calls it.
:::

## The rules, in priority order

When a normal function runs, the engine picks `this` using the **first** rule that applies:

| # | Call style | `this` is | Example |
|---|---|---|---|
| 1 | `new Fn()` | The newly created object | `new User('a')` |
| 2 | Explicit: `call`, `apply`, `bind` | The object you passed | `fn.call(obj)` |
| 3 | Implicit: method call `obj.fn()` | The object left of the dot | `user.greet()` |
| 4 | Default: plain call `fn()` | `undefined` in strict mode, `globalThis` in sloppy mode | `greet()` |
| — | Arrow function | Inherits `this` from the enclosing scope (lexical) — ignores all rules above | `() => this` |

### 1. Default binding

```js
'use strict'
function show() { return this }
show() // undefined (strict) — in sloppy scripts it would be window/globalThis
```

### 2. Implicit binding — the dot matters at *call* time

```js
const user = {
  name: 'Asha',
  greet() { return `Hi, ${this.name}` },
}
user.greet()              // "Hi, Asha"

const greet = user.greet  // pulls the function off the object
greet()                   // TypeError in strict mode (this is undefined) / "Hi, undefined"
```

This **"lost `this`"** problem appears whenever you pass a method as a callback:

```js
setTimeout(user.greet, 100)          // this is lost
button.addEventListener('click', user.greet) // this = the button element!
```

DOM event listeners (non-arrow) are called with `this` set to `event.currentTarget`.

### 3. Explicit binding

```js
function introduce(greeting, punctuation) {
  return `${greeting}, I'm ${this.name}${punctuation}`
}
const person = { name: 'Ravi' }

introduce.call(person, 'Hello', '!')     // args one by one
introduce.apply(person, ['Hello', '!'])  // args as an array
const bound = introduce.bind(person, 'Hey') // returns a NEW function, partially applied
bound('?')                               // "Hey, I'm Ravi?"
```

| | Invokes immediately? | Arguments | Returns |
|---|---|---|---|
| `call` | Yes | Comma separated | Function's result |
| `apply` | Yes | Array (or array-like) | Function's result |
| `bind` | No | Comma separated, pre-filled (partial application) | A new bound function |

A bound function's `this` **cannot be re-bound** — calling `.bind` or `.call` on it again doesn't change `this` (only `new` overrides it).

### 4. `new` binding

`new Fn(args)`:

1. Creates a new empty object.
2. Sets its `[[Prototype]]` to `Fn.prototype`.
3. Calls `Fn` with `this` = that object.
4. Returns the object (unless `Fn` explicitly returns another object).

```js
function User(name) { this.name = name }
const u = new User('Meera') // this → the new object
```

## Arrow functions vs normal functions

Arrow functions are **not** just shorter syntax. They differ in several ways that interviewers love (Tekion, Groww, Intuit):

| Feature | Normal function | Arrow function |
|---|---|---|
| `this` | Dynamic (call-site) | Lexical — taken from surrounding scope, fixed forever |
| `arguments` object | Yes | No (use rest `...args`) |
| Can be used with `new` | Yes | No — `TypeError: x is not a constructor` |
| `prototype` property | Yes | No |
| `call/apply/bind` change `this` | Yes | No (they can still pass arguments) |
| Can be a generator | Yes (`function*`) | No |
| Hoisting | Declarations hoisted with body | Behave like the variable they're assigned to |
| Duplicate param names (sloppy) | Allowed | SyntaxError |

### Where arrows shine: callbacks inside methods

```js
const timer = {
  seconds: 0,
  start() {
    setInterval(() => {
      this.seconds++ // `this` is the timer — arrow inherits from start()
    }, 1000)
  },
}
```

With a normal `function` callback, `this` would be `undefined`/`window`. Pre-ES6 code used `const self = this` or `.bind(this)`.

### Where arrows bite: object methods and prototype methods

```js
const counter = {
  count: 0,
  inc: () => { this.count++ }, // `this` is the module/global this — NOT counter
}
```

Object literals don't create a scope for `this`, so the arrow takes `this` from wherever the object literal is written.

## bind vs arrow for `this` (Intuit question)

Both solve "lost `this`" in callbacks, e.g. React class components:

```jsx
class Toggle extends React.Component {
  constructor(props) {
    super(props)
    this.state = { on: false }
    this.handleClick = this.handleClick.bind(this) // option A: bind once in constructor
  }
  handleClick() { this.setState((s) => ({ on: !s.on })) }

  // option B: class field arrow — `this` captured from the instance
  handleClick2 = () => { this.setState((s) => ({ on: !s.on })) }
}
```

- **`bind`** creates a bound copy; method stays on the prototype too. Good when you need a stable reference created once.
- **Arrow class field** is created **per instance** (not on the prototype), so it can't be easily overridden by subclasses or spied on via the prototype in tests, and it uses a bit more memory per instance. Very readable though.
- **Never** `bind` or create arrows inside `render` for hot paths if you rely on referential equality (memoised children) — a new function each render breaks `React.memo`.

## Interview questions

:::question
difficulty: medium
companies: Tekion, Groww, Intuit
### Difference between arrow functions and normal functions?
Arrow functions don't have their own `this`, `arguments`, `super` or `new.target`; they inherit `this` lexically from the enclosing scope and it can't be changed by `call/apply/bind`. They can't be used as constructors (`new` throws) and have no `prototype`. Use them for callbacks where you want the outer `this`; use normal functions/method shorthand for object and prototype methods and constructors.
:::

:::question
difficulty: medium
companies: Groww
### Explain the `this` keyword in JavaScript.
`this` is a binding decided by how a normal function is called. Priority: `new` (fresh object) → explicit (`call/apply/bind`) → implicit (`obj.method()` → `obj`) → default (`undefined` in strict mode, `globalThis` otherwise). Arrow functions skip these rules and use the `this` of their enclosing scope. Special cases: DOM listeners get `this = currentTarget`; class bodies are strict; at the top level of an ES module `this` is `undefined`.
:::

:::question
difficulty: easy
### Difference between call, apply and bind?
`call` and `apply` invoke the function immediately with a given `this` — `call` takes arguments individually, `apply` as an array. `bind` doesn't invoke; it returns a new function with `this` (and optionally leading arguments) permanently fixed. Classic uses: `Math.max.apply(null, arr)` (today `Math.max(...arr)`), borrowing methods `Array.prototype.slice.call(arguments)`, and fixing callbacks with `bind`.
:::

## Output prediction challenges

:::challenge
difficulty: medium
### What gets logged?
```js
'use strict'
const obj = {
  name: 'obj',
  regular() { return this?.name },
  arrow: () => this?.name,
  nested() {
    const inner = () => this.name
    return inner()
  },
}
console.log(obj.regular())
console.log(obj.arrow())
const r = obj.regular
console.log(r())
console.log(obj.nested())
```
@@@solution
```text
obj
undefined
undefined
obj
```
- `obj.regular()` — implicit binding → `obj`.
- `obj.arrow()` — arrow takes `this` from where the object literal sits (top level of a strict script/module, where `this` is `undefined` in modules or `window` in classic scripts; `window.name` is usually `''`). With `this?.name` the safest expectation in a module is `undefined`.
- `r()` — plain call in strict mode → `this` is `undefined` → `undefined?.name` → `undefined`.
- `obj.nested()` — `inner` is an arrow, so it inherits `nested`'s `this`, which is `obj`.
:::

:::challenge
difficulty: medium
### What gets logged?
```js
function greet() { return this.name }
const a = { name: 'A' }
const b = { name: 'B' }
const bound = greet.bind(a)
console.log(bound.call(b))
console.log(greet.bind(a).bind(b)())
console.log(new (function () { this.name = 'N'; return this.name }.bind(a))().name)
```
@@@solution
```text
A
A
N
```
A bound function's `this` is fixed — `call(b)` and a second `bind(b)` cannot override it. But **`new` beats `bind`**: calling a bound function with `new` creates a fresh object as `this` (the bound `this` is ignored). Returning a primitive (`'N'`) from a constructor is ignored, so the new object `{ name: 'N' }` is returned.
:::

:::challenge
difficulty: easy
### What gets logged?
```js
const user = {
  name: 'Zara',
  friends: ['Ali', 'Bo'],
  list() {
    return this.friends.map(function (f) {
      return `${this?.name} knows ${f}`
    })
  },
}
console.log(user.list())
```
@@@solution
```text
[ 'undefined knows Ali', 'undefined knows Bo' ]
```
(Assuming strict mode / module.) The `function` passed to `map` is called as a plain function, so its `this` is `undefined`. Fixes: use an arrow `(f) => \`${this.name} knows ${f}\``, or pass `this` as `map`'s second argument: `this.friends.map(function (f) {...}, this)`.
:::

:::challenge
difficulty: medium
### Use `call` to borrow a method
Write `toArray(arrayLike)` that converts an array-like object (e.g. `{0: 'a', 1: 'b', length: 2}` or `arguments`) into a real array **using `Array.prototype.slice` with `call`** (don't use `Array.from` or spread).
@@@starter
```js
function toArray(arrayLike) {
  // your code
}
```
@@@tests
```js
test('converts array-like objects', () => {
  expect(toArray({ 0: 'a', 1: 'b', length: 2 })).toEqual(['a', 'b'])
})
test('works with arguments', () => {
  function f() { return toArray(arguments) }
  expect(f(1, 2, 3)).toEqual([1, 2, 3])
})
test('returns a real array', () => {
  expect(Array.isArray(toArray({ length: 0 }))).toBe(true)
})
```
@@@solution
```js
function toArray(arrayLike) {
  return Array.prototype.slice.call(arrayLike)
}
```
`slice` only needs `this.length` and indexed access, so it works on any array-like. `call` sets `this` to our object. This "method borrowing" pattern was everywhere before `Array.from` and spread.
:::

## Quick check

:::quiz
### Which rule wins if a function is both bound with `bind(a)` and called with `new`?
- [ ] bind — `this` is `a`
- [x] new — `this` is the newly created object
- [ ] It throws a TypeError
- [ ] Default binding applies
@@@explain
`new` has the highest priority; bound functions can still be constructed, and their bound `this` is ignored.
:::

:::quiz
### What does `this` refer to inside an arrow function defined in a class method?
- [x] The class instance (inherited from the method's `this`)
- [ ] The arrow function itself
- [ ] `undefined` always
- [ ] The global object
@@@explain
Arrows capture `this` lexically from the enclosing function — here the method, called on the instance.
:::
