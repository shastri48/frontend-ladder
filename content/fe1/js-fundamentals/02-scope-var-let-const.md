---
title: Scope, var, let & const
summary: Global, function and block scope; why let/const replaced var; and the classic var-in-a-loop trap.
minutes: 14
---

## What is scope?

**Scope** answers one question: *"From this line of code, which variables can I see?"*

JavaScript uses **lexical scope** (also called static scope): visibility is decided by **where you write** the code, not where you call it. Look at the curly braces and function bodies in the source file — that's your scope map.

:::callout analogy Rooms in a house
Each function or block is a room. From inside a room you can see everything in that room **and through the windows into the rooms that contain it**, all the way out to the street (global scope). But people on the street cannot see inside your room.
:::

There are three kinds of scope you'll meet daily:

| Scope | Created by | Who lives there |
|---|---|---|
| Global | The script / module itself | Top-level declarations |
| Function | Every function | `var`, `let`, `const`, params, inner functions |
| Block | Any `{ }`: `if`, `for`, `while`, plain blocks | `let`, `const`, `class` (**not** `var`) |

(ES modules add **module scope**: top-level variables in a module are private to that file unless exported.)

:::visual scope-chain
:::

## The scope chain

When you reference a variable, the engine looks in the current scope; if it's not there, it goes to the outer scope, then the next, up to global. If it's still missing → `ReferenceError`.

```js
const app = "Ladder"            // global

function outer() {
  const level = "FE1"           // outer's scope
  function inner() {
    const lesson = "scope"      // inner's scope
    console.log(app, level, lesson) // all visible via the chain
  }
  inner()
  // console.log(lesson)        // ReferenceError — can't look *inward*
}
outer()
```

Lookup only goes **outward**, never inward or sideways.

### Shadowing

An inner variable with the same name **shadows** the outer one:

```js
let x = "outer"
function f() {
  let x = "inner"
  console.log(x) // "inner"
}
f()
console.log(x)   // "outer"
```

## var vs let vs const

| | `var` | `let` | `const` |
|---|---|---|---|
| Scope | Function | Block | Block |
| Hoisted? | Yes, initialised to `undefined` | Yes, but uninitialised (TDZ) | Yes, but uninitialised (TDZ) |
| Re-declare in same scope | Allowed | SyntaxError | SyntaxError |
| Reassign | Allowed | Allowed | Not allowed |
| Global var creates `window` property | Yes | No | No |

### var ignores blocks

```js
if (true) {
  var a = 1
  let b = 2
}
console.log(a) // 1   — var leaked out of the block
console.log(b) // ReferenceError
```

`var` only respects **function** boundaries. This leaking was a constant source of bugs before ES2015.

### Re-declaration

```js
var count = 1
var count = 2   // fine with var — easy to clobber accidentally

let total = 1
let total = 2   // SyntaxError: Identifier 'total' has already been declared
```

### const means "constant binding"

```js
const PI = 3.14
PI = 3            // TypeError: Assignment to constant variable.

const user = { name: "Asha" }
user.name = "Ravi" // allowed — the object is mutable
user = {}          // TypeError
```

`const` must also be initialised at declaration: `const x;` is a SyntaxError.

:::callout tip Rule of thumb
Use `const` by default. Use `let` only when you will reassign (counters, accumulators). Don't use `var` in new code.
:::

## The classic `var` in a loop + setTimeout trap

This is one of the most-asked interview snippets (CRED, Accenture and many others ask it in some form).

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0)
}
// prints: 3 3 3
```

Why? There is **one** `i` for the whole function (var is function-scoped). The callbacks run *after* the loop finishes (they are queued as macrotasks), and by then `i` is `3`. All three closures share that single variable.

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0)
}
// prints: 0 1 2
```

With `let`, the spec creates a **fresh binding of `i` for each iteration**, so each callback closes over its own copy.

Pre-ES6 fix using an IIFE (immediately invoked function expression) to create a new function scope per iteration:

```js
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0)
  })(i)
}
```

## Globals and `window`

In a classic (non-module) script:

```js
var a = 1
let b = 2
console.log(window.a) // 1
console.log(window.b) // undefined
```

`var` at the top level becomes a property of the global object, so it can collide with browser globals (try `var name = 5` and then `window.name` — it's a string because `window.name` is special!). `let`/`const` live in a separate declarative record and don't pollute `window`.

Forgetting a declaration entirely (`total = 5` with no keyword) creates an accidental global in sloppy mode and throws in strict mode. ES modules and classes are always strict.

## Interview questions

:::question
difficulty: easy
companies: Accenture, Tekion
### Explain the difference between var, let and const (with scope)
- **`var`** is function-scoped, hoisted and initialised to `undefined`, can be redeclared and reassigned, and at the top level of a script it becomes a property of `window`.
- **`let`** is block-scoped, hoisted but uninitialised until its declaration runs (Temporal Dead Zone), cannot be redeclared in the same scope, can be reassigned.
- **`const`** is like `let` but must be initialised and cannot be reassigned. The value it holds (e.g. an object) can still be mutated.

```js
function demo() {
  if (true) { var a = 1; let b = 2; const c = 3 }
  console.log(a)       // 1
  console.log(typeof b) // "undefined" — b not visible here
}
```

**In an interview, say:** "Prefer const, use let when reassigning, avoid var because it's function-scoped and leaks out of blocks."
:::

:::question
difficulty: easy
### What is lexical scope?
Lexical scope means a variable's visibility is determined by its position in the source code. An inner function can access variables of the functions that physically contain it, regardless of where the inner function is later called. This is what makes closures possible.
:::

:::question
difficulty: medium
### What is variable shadowing? Is it illegal anywhere?
Shadowing is declaring a variable in an inner scope with the same name as one in an outer scope; the inner one hides the outer within its block. It's legal, with one exception: you cannot shadow a `let`/`const` with a `var` in a way that would hoist the `var` into the same scope:

```js
let x = 1
{
  var x = 2 // SyntaxError: Identifier 'x' has already been declared
}
```

The `var` hoists to the function/global scope where `let x` already exists. Shadowing a `var` with `let` in an inner block is fine.
:::

## Challenges

:::challenge
difficulty: easy
companies: CRED, Accenture
### Output: var in setTimeout
What's printed, and how many different ways can you fix it to print `0 1 2`?
```js
for (var i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i)
  }, 100)
}
```
@@@solution
Prints `3 3 3`.

There's one function-scoped `i`. The loop finishes synchronously (i becomes 3), then the three timer callbacks run and all read the same `i`.

Fixes:

```js
// 1. let — new binding per iteration
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i), 100)

// 2. IIFE creates a scope per iteration
for (var i = 0; i < 3; i++) {
  (function (j) { setTimeout(() => console.log(j), 100) })(i)
}

// 3. setTimeout passes extra args to the callback
for (var i = 0; i < 3; i++) setTimeout(console.log, 100, i)

// 4. bind
for (var i = 0; i < 3; i++) setTimeout(console.log.bind(null, i), 100)
```
:::

:::challenge
difficulty: medium
### Output: shadowing and blocks
```js
var a = 1
let b = 2
{
  var a = 10
  let b = 20
  console.log(a, b)
}
console.log(a, b)

function f() {
  console.log(c)
  if (false) { var c = 5 }
}
f()
```
@@@solution
```text
10 20
10 2
undefined
```

- Inside the block, `var a = 10` is the **same** `a` as the global one (var ignores blocks) so it overwrites it. `let b = 20` is a new block-scoped `b`.
- After the block, `a` is `10`, the global `b` is still `2`.
- In `f`, `var c` is hoisted to the top of the function even though the `if` never runs, so `c` exists and is `undefined`.
:::

:::quiz
### Which declaration is block-scoped AND reassignable?
- [ ] var
- [x] let
- [ ] const
- [ ] function
@@@explain
`let` is block-scoped and can be reassigned; `const` is block-scoped but cannot.
:::

:::quiz
### `for (let i = 0; i < 3; i++) setTimeout(() => console.log(i))` prints
- [ ] 3 3 3
- [x] 0 1 2
- [ ] undefined ×3
- [ ] 0 0 0
@@@explain
`let` in a `for` header gets a fresh binding per iteration, so each callback captures its own `i`.
:::
