---
title: Execution Context, Call Stack & Hoisting
summary: What the JavaScript engine actually does before and while your code runs — creation phase, execution phase, hoisting, the TDZ and shadowing.
minutes: 18
---

## Why this matters

Almost every "tricky" JavaScript interview question — hoisting, the Temporal Dead Zone, closures, `this`, shadowing — becomes obvious once you understand one idea: **before the engine runs a piece of code, it first sets up an *execution context* for it.** Interviewers at Tekion, Accenture and Groww routinely open with "Explain how JavaScript execution context, async behaviour and the event loop work." This lesson is the foundation for that answer.

:::callout analogy A kitchen before service
Before a restaurant opens, the chef does *mise en place*: every ingredient the menu mentions gets a labelled bowl on the counter, even if the bowl is still empty. Then service starts and dishes are cooked top to bottom. The **creation phase** is mise en place (variables and functions get their "bowls"), the **execution phase** is service (lines run one by one and fill the bowls).
:::

## What is an execution context?

An execution context (EC) is the internal record the engine keeps for "the code currently running". There are three kinds:

| Kind | Created when | Notes |
|---|---|---|
| Global EC | Script starts | One per program/realm. Creates the global object binding (`window`/`globalThis`) and the global `this`. |
| Function EC | Each time a function is **called** | A new one per call — recursion creates many. |
| Eval / module EC | `eval(...)` or an ES module is evaluated | Modules are always strict and have their own top-level scope. |

Each execution context holds:

1. **Lexical Environment** — a record of identifiers declared in this scope (`let`, `const`, `class`, function declarations, parameters) plus a pointer to the **outer** lexical environment. This chain of pointers is the *scope chain*.
2. **Variable Environment** — historically where `var` declarations live (in modern specs it's a separate environment record used for `var` and function declarations at function level).
3. **`this` binding** — decided by *how* the function was called (covered in the `this` lesson).

## The two phases

Every execution context goes through two phases.

### 1. Creation phase (a.k.a. "memory phase")

The engine scans the code of that scope (without running it) and:

- For each **function declaration**: creates the binding *and* assigns the full function object. That's why you can call a function declaration before the line it appears on.
- For each **`var`**: creates the binding and initialises it to `undefined`.
- For each **`let` / `const` / `class`**: creates the binding but leaves it **uninitialised**. Touching it throws a `ReferenceError`. The period between the start of the scope and the declaration line is the **Temporal Dead Zone (TDZ)**.
- Determines `this` and links the outer environment.

### 2. Execution phase

Code runs line by line. Assignments fill in values, functions get called (each call pushes a new EC), expressions are evaluated.

:::visual execution-context
:::

```js
console.log(a)        // undefined   (var: hoisted + initialised to undefined)
console.log(greet())  // "hi"        (function declaration: hoisted with body)
console.log(b)        // ReferenceError: Cannot access 'b' before initialization (TDZ)

var a = 1
let b = 2
function greet() { return 'hi' }
```

During creation the memory looks like this:

```text
Global Environment Record
┌──────────┬──────────────────────────┐
│ a        │ undefined                │  ← var
│ greet    │ ƒ greet() {...}          │  ← function declaration
│ b        │ <uninitialized> (TDZ)    │  ← let
└──────────┴──────────────────────────┘
outer → null
```

## Hoisting — what's really happening

"Hoisting" is not the engine physically moving lines to the top. It's a side effect of the creation phase: declarations are registered before any code runs. What differs is **what value the binding has** before its line executes.

| Declaration | Hoisted? | Initial value | Scope |
|---|---|---|---|
| `var x` | Yes | `undefined` | Function (or global) |
| `let x` / `const x` | Yes (binding exists) | Uninitialised — TDZ | Block |
| `class X` | Yes | Uninitialised — TDZ | Block |
| `function f(){}` | Yes | The function itself | Function (block in strict mode) |
| `var f = function(){}` | Only `f` | `undefined` | Function |
| `const f = () => {}` | Only `f` | TDZ | Block |

:::callout warn Function expressions are not hoisted like declarations
`var f = function () {}` only hoists the `var f` (as `undefined`). Calling `f()` before that line throws `TypeError: f is not a function` — not a ReferenceError, because `f` exists, it's just `undefined`.
:::

### Proof that `let` *is* hoisted

If `let` weren't hoisted, this would print the outer `x`:

```js
let x = 'outer'
{
  console.log(x) // ReferenceError — not "outer"!
  let x = 'inner'
}
```

The inner block's `x` binding was created in the block's creation phase and shadows the outer one — but it's in the TDZ, so reading it throws.

## The call stack

The engine keeps execution contexts on a **stack** (LIFO). Calling a function pushes its EC; returning pops it. The global EC sits at the bottom.

```js
function multiply(a, b) { return a * b }
function square(n) { return multiply(n, n) }
function printSquare(n) { console.log(square(n)) }
printSquare(4)
```

```text
            ┌─────────────┐
            │ multiply    │  ← top (running)
            ├─────────────┤
            │ square      │
            ├─────────────┤
            │ printSquare │
            ├─────────────┤
            │ global      │
            └─────────────┘
```

- **Stack overflow**: infinite recursion keeps pushing until the engine throws `RangeError: Maximum call stack size exceeded`.
- **Single-threaded**: there is one call stack. While it's busy, nothing else on the main thread runs — no clicks handled, no paint. That's why long synchronous work freezes the UI (more in the event loop lesson).
- **Error stack traces** are literally a snapshot of this stack.

## Scope and the scope chain

Each lexical environment points to its **outer** environment — the one where the function was **defined**, not where it was called. This is *lexical (static) scoping*.

```js
const name = 'global'
function outer() {
  const name = 'outer'
  function inner() { console.log(name) }
  return inner
}
const fn = outer()
fn() // "outer" — resolved through inner → outer → global
```

Identifier lookup walks up the chain until it finds the name; if it reaches `null`, you get `ReferenceError` (or, for assignment in sloppy mode, an accidental global).

## Shadowing

An inner scope can declare a variable with the same name as an outer one; the inner one **shadows** the outer inside that scope.

```js
let count = 1
function f() {
  let count = 2      // shadows outer count
  if (true) {
    let count = 3    // shadows again, block-scoped
    console.log(count) // 3
  }
  console.log(count) // 2
}
f()
console.log(count)   // 1
```

**Illegal shadowing**: you can't shadow a `let` with a `var` in an inner *block* of the same function, because `var` would hoist to the function scope and collide:

```js
function g() {
  let a = 1
  {
    var a = 2 // SyntaxError: Identifier 'a' has already been declared
  }
}
```

The reverse (`var` outside, `let` inside a block) is fine.

## Block scope vs function scope

```js
for (var i = 0; i < 3; i++) {}
console.log(i) // 3 — var leaks out of the block

for (let j = 0; j < 3; j++) {}
console.log(j) // ReferenceError — j only lives in the loop
```

With `let` in a `for` loop, the spec creates a **fresh binding per iteration**, which is why closures inside the loop capture different values (see the closures lesson).

## Strict mode effects worth knowing

- Assigning to an undeclared variable throws instead of creating a global.
- `this` inside a plain function call is `undefined` instead of the global object.
- Function declarations inside blocks are block-scoped.
- ES modules and `class` bodies are always strict.

## Interview questions

:::question
difficulty: easy
companies: Accenture, Groww, Tekion
### What is hoisting and how does it work internally?
Hoisting is the observable effect of the engine's **creation phase**: before running a scope, the engine registers all declarations in it.

- `var` bindings are created and initialised to `undefined`.
- Function declarations are created and initialised with the whole function, so they can be called before their line.
- `let`, `const` and `class` bindings are created but **not initialised** — accessing them before the declaration throws a `ReferenceError` (the TDZ).

Nothing is physically moved; the code just runs against an environment that already knows every name in that scope.

**In an interview, say:** "Declarations are processed in the creation phase of the execution context; `var` starts as `undefined`, functions start fully defined, and `let/const/class` exist but are uninitialised until their line — that window is the TDZ."
:::

:::question
difficulty: easy
companies: Accenture
### What is the Temporal Dead Zone (TDZ)?
The TDZ is the time between entering a scope and executing the `let`/`const`/`class` declaration for a binding. During it the binding exists (so it shadows outer variables) but is uninitialised; reading or writing it throws `ReferenceError: Cannot access 'x' before initialization`.

```js
function demo() {
  // TDZ for `value` starts here
  const getValue = () => value // fine to *reference* inside a function...
  // console.log(value)        // ...but reading now would throw
  const value = 42             // TDZ ends
  return getValue()            // 42
}
```

`typeof` is not safe either: `typeof x` on a TDZ binding throws, while `typeof undeclaredVar` returns `"undefined"`.

Why it exists: to catch bugs where you use a variable before it's meaningfully set, and to make `const` sensible (a `const` that could be observed as `undefined` and later as a value would not be constant).
:::

:::question
difficulty: easy
companies: Accenture
### Difference between var, let and const (with scope explanation)
| | `var` | `let` | `const` |
|---|---|---|---|
| Scope | Function | Block | Block |
| Hoisting | `undefined` | TDZ | TDZ |
| Re-declare in same scope | Allowed | SyntaxError | SyntaxError |
| Re-assign | Yes | Yes | No |
| Creates property on `window` at top level | Yes | No | No |
| Fresh binding per loop iteration | No | Yes | Yes (for-of / for-in) |

`const` makes the **binding** immutable, not the value: `const arr = []; arr.push(1)` is fine.

Default to `const`, use `let` when you need to reassign, avoid `var` in modern code.
:::

:::question
difficulty: medium
companies: Tekion
### Explain how a JavaScript execution context and the call stack work together.
When a script starts the engine creates the **global execution context** and pushes it on the call stack. Each function call creates a new **function execution context** that goes through a creation phase (declarations registered, `this` decided, outer scope linked) and an execution phase (code runs). It's pushed on top of the stack; when the function returns, it's popped and control returns to the context below.

Because there's only one stack, JS runs one thing at a time. Async work (timers, network, events) is handled outside the stack by the host (browser/Node) and its callbacks are queued; the **event loop** pushes them onto the stack only when it is empty.
:::

:::question
difficulty: medium
### What is the scope chain and how is it different from the call stack?
The **scope chain** is the chain of lexical environments a function can see, fixed by *where the function was written*. The **call stack** is the runtime order of *active calls*. A function called from deep inside another call stack still resolves variables through its own lexical chain:

```js
const x = 'global'
function log() { console.log(x) }
function run() { const x = 'run'; log() }
run() // "global" — log's scope chain is log → global, regardless of caller
```

If JS used dynamic scoping, this would print `"run"`.
:::

## Output prediction challenges

:::challenge
difficulty: easy
companies: Accenture
### What gets logged? (var vs function hoisting)
```js
console.log(typeof foo)
var foo = 'bar'
function foo() {}
console.log(typeof foo)
```
@@@solution
```text
function
string
```
In the creation phase both declarations target the same name. Function declarations win over a `var` declaration without a value, so `foo` starts as the function → `typeof foo` is `"function"`. Then the execution phase runs `foo = 'bar'` (the `var` is just an assignment now), so the second log is `"string"`. The `function foo(){}` line does nothing at execution time.
:::

:::challenge
difficulty: easy
### What gets logged? (shadowing + hoisting)
```js
var x = 1
function test() {
  console.log(x)
  var x = 2
  console.log(x)
}
test()
console.log(x)
```
@@@solution
```text
undefined
2
1
```
Inside `test`, `var x` is hoisted to the top of the function and initialised to `undefined`. It **shadows** the global `x`, so the first log reads the local `undefined`, not `1`. After the assignment it's `2`. The global `x` was never touched.
:::

:::challenge
difficulty: medium
### What gets logged? (TDZ inside a block)
```js
let a = 10
function run() {
  console.log(a)
  if (true) {
    console.log(a)
    let a = 20
  }
}
run()
```
@@@solution
```text
10
ReferenceError: Cannot access 'a' before initialization
```
The first log is in `run`'s scope, which has no `a`, so it resolves to the global `10`. The `if` block declares its own `let a`, which is hoisted to the top of the block in the TDZ. The second `console.log(a)` refers to the block's `a` (not the global), and it's still uninitialised → ReferenceError.
:::

:::challenge
difficulty: medium
### What gets logged? (function expression vs declaration)
```js
console.log(sum(2, 3))
console.log(mul)
console.log(mul(2, 3))

function sum(a, b) { return a + b }
var mul = function (a, b) { return a * b }
```
@@@solution
```text
5
undefined
TypeError: mul is not a function
```
`sum` is a function declaration → hoisted with its body. `mul` is a `var` holding a function **expression**, so only `var mul` is hoisted (value `undefined`). Calling `undefined(2, 3)` is a `TypeError`.
:::

:::challenge
difficulty: hard
### What gets logged? (block-level function declarations)
```js
'use strict'
{
  function hello() { return 'inner' }
}
console.log(typeof hello)
```
@@@solution
```text
undefined
```
In **strict mode**, function declarations inside blocks are block-scoped (like `let`). Outside the block, `hello` doesn't exist, and `typeof` on an undeclared identifier returns `"undefined"` without throwing.

In sloppy mode, browsers apply legacy "Annex B" semantics and you'd get `"function"`. This is one reason to avoid declaring functions inside blocks — use `const hello = () => ...` instead.
:::

:::challenge
difficulty: medium
### Predict the error
```js
function outer() {
  let a = 1
  {
    var a = 2
  }
  return a
}
console.log(outer())
```
@@@solution
It's a **SyntaxError** at parse time — nothing runs: `Identifier 'a' has already been declared`.

`var a` inside the block hoists to the function scope, where `let a` already exists. That's *illegal shadowing*. Swap them (`var` outside, `let` inside the block) and it works, returning the outer value.
:::

## Quick check

:::quiz
### What is the value of a `let` variable before its declaration line runs?
- [ ] `undefined`
- [ ] `null`
- [x] It's uninitialised — accessing it throws a ReferenceError
- [ ] It doesn't exist until that line
@@@explain
The binding exists from the start of the block (it's hoisted and shadows outer names), but it's uninitialised — that window is the Temporal Dead Zone.
:::

:::quiz
### How is a variable's scope chain determined in JavaScript?
- [x] By where the function is written in the source (lexical scoping)
- [ ] By which function called it (dynamic scoping)
- [ ] By the value of `this`
- [ ] By the order functions are pushed onto the call stack
@@@explain
JavaScript uses lexical scope: the outer environment reference is set when the function is created, not when it's called.
:::

:::quiz
### `typeof notDeclaredAnywhere` returns…
- [x] "undefined"
- [ ] It throws a ReferenceError
- [ ] "object"
- [ ] null
@@@explain
`typeof` is special-cased for completely undeclared identifiers. It *does* throw for a `let/const` binding in its TDZ.
:::
