---
title: Hoisting & the Temporal Dead Zone
summary: What the engine does before running your code, why var is undefined but let throws, and how function declarations "move to the top".
minutes: 13
---

## The myth and the reality

You'll often hear "hoisting moves declarations to the top of the file". Nothing actually moves. What really happens is that the JavaScript engine runs your code in **two phases**:

1. **Creation (memory) phase** — the engine scans the scope and registers every declaration in memory *before* executing a single line.
2. **Execution phase** — it runs the code top to bottom, assigning values as it reaches them.

"Hoisting" is just the observable effect of phase 1: names exist before the line that declares them.

:::visual execution-context
:::

## What gets registered, and with what value

| Declaration | Registered in creation phase? | Initial value |
|---|---|---|
| `var x` | Yes | `undefined` |
| `let x` / `const x` | Yes | **uninitialised** (TDZ) |
| `function f() {}` | Yes | **the whole function** |
| `class C {}` | Yes | uninitialised (TDZ) |
| `const f = () => {}` / `var f = function(){}` | Follows `const`/`var` rules | TDZ / `undefined` |

### var

```js
console.log(score) // undefined (not an error)
var score = 10
console.log(score) // 10
```

The engine effectively sees:

```js
var score          // creation phase: score = undefined
console.log(score) // undefined
score = 10         // execution phase assignment
console.log(score)
```

### Function declarations are fully hoisted

```js
greet() // "hi" — works before the declaration

function greet() {
  console.log("hi")
}
```

This is handy: you can put helper functions at the bottom of a file and the main logic at the top.

### Function expressions are not

```js
sayBye() // TypeError: sayBye is not a function
var sayBye = function () { console.log("bye") }

shout() // ReferenceError: Cannot access 'shout' before initialization
const shout = () => console.log("HEY")
```

With `var`, the name exists but holds `undefined` — calling `undefined()` is a TypeError. With `const`, the name is in the TDZ — a ReferenceError.

## The Temporal Dead Zone (TDZ)

`let`, `const` and `class` declarations *are* hoisted — the engine knows about them — but they're left **uninitialised**. The period from the start of the scope until the declaration line executes is the **Temporal Dead Zone**. Touching the variable in that window throws.

```js
{
  // ── TDZ for `city` starts here ──
  console.log(typeof city) // ReferenceError (even typeof!)
  let city = "Pune"        // ── TDZ ends ──
  console.log(city)        // "Pune"
}
```

Proof that `let` *is* hoisted — shadowing reveals it:

```js
let x = "outer"
function f() {
  console.log(x) // ReferenceError, NOT "outer"
  let x = "inner"
}
f()
```

If `let x` weren't hoisted, the lookup would find the outer `x`. Instead the engine already knows there's an inner `x` in this scope, and it's in its TDZ.

:::callout info Why does the TDZ exist?
It catches bugs. Reading a variable before it's set is almost always a mistake; `var` hides it by giving you `undefined`, `let`/`const` make it loud. It also makes `const` meaningful — a const should never be observed with two different values (undefined, then the real one).
:::

"Temporal" means it's about **time** (execution order), not position:

```js
function read() { return value } // refers to value, but doesn't run yet
let value = 42
read() // 42 — fine, by the time it runs the TDZ is over
```

## Hoisting priority

When a function and a `var` share a name, the function declaration wins in the creation phase, and later assignments overwrite it at execution:

```js
console.log(typeof foo) // "function"
var foo = 1
function foo() {}
console.log(typeof foo) // "number"
```

## Hoisting inside functions

Each function call creates its own execution context with its own creation phase:

```js
var name = "global"
function show() {
  console.log(name) // undefined — the local var shadows, and is hoisted
  var name = "local"
}
show()
```

This is a favourite output-based question: many people expect `"global"`.

## Interview questions

:::question
difficulty: easy
companies: Accenture, Groww, Tekion
### What is hoisting and how does it work internally?
Before executing a scope, the engine runs a **creation phase** where it allocates memory for all declarations in that scope. `var` variables are initialised to `undefined`, function declarations get their full function value, and `let`/`const`/`class` are registered but left uninitialised. Then the **execution phase** runs line by line. Because names are registered first, you can reference them before their declaration line — that's hoisting. Nothing is physically moved.

**In an interview, say:** "Declarations are processed in the creation phase of the execution context; var gets undefined, functions get their body, let/const stay in the TDZ."
:::

:::question
difficulty: easy
companies: Accenture
### What is the Temporal Dead Zone (TDZ)?
The TDZ is the time between entering a scope and the execution of a `let`/`const`/`class` declaration in it. The binding exists (it's hoisted) but is uninitialised, so any access — even `typeof` — throws `ReferenceError: Cannot access 'x' before initialization`. It exists to surface use-before-define bugs and to guarantee a `const` is never seen with two values.
:::

:::question
difficulty: medium
### Are let and const hoisted?
Yes. They're registered during the creation phase but not initialised. The proof: an inner `let x` shadows an outer `x` from the very top of the block — reading `x` before the inner declaration throws a ReferenceError instead of returning the outer value.
:::

:::question
difficulty: easy
### Function declaration vs function expression — what's the hoisting difference?
A **function declaration** (`function f() {}`) is hoisted with its body, so you can call it before the line it appears on. A **function expression** (`const f = function(){}` or an arrow function) follows the rules of the variable it's assigned to: with `var` you get `undefined` (calling it → TypeError), with `let`/`const` you hit the TDZ (ReferenceError).
:::

## Challenges

:::challenge
difficulty: medium
companies: Accenture
### Output: hoisting mix
```js
console.log(a)
console.log(b())
console.log(typeof c)
var a = 1
function b() { return "b" }
var c = function () {}
console.log(typeof c)
console.log(d)
let d = 4
```
@@@solution
```text
undefined
b
undefined
function
ReferenceError: Cannot access 'd' before initialization
```

1. `var a` hoisted → `undefined`.
2. `b` is a function declaration → fully hoisted → `"b"`.
3. `var c` hoisted as `undefined` → `typeof undefined` is `"undefined"`.
4. After assignment, `c` is a function.
5. `d` is in the TDZ → throws (execution stops here).
:::

:::challenge
difficulty: medium
### Output: shadowed hoisting inside a function
```js
var x = 21
var girl = function () {
  console.log(x)
  var x = 20
}
girl()
```
@@@solution
Prints `undefined`.

When `girl` runs, its own creation phase hoists the local `var x` (initialised to `undefined`). The local `x` shadows the global one, so `console.log(x)` reads the local `x` before it's assigned. Change the inner `var` to `let` and it throws a ReferenceError instead.
:::

:::challenge
difficulty: hard
### Output: function vs var with the same name
```js
function test() {
  console.log(typeof foo)
  console.log(typeof bar)
  var foo = "hello"
  function foo() {}
  var bar = function () {}
  console.log(typeof foo)
}
test()
```
@@@solution
```text
function
undefined
string
```

In the creation phase, `function foo` is registered with its body; the `var foo` declaration doesn't override an already-declared function name. `var bar` is `undefined`. During execution, `foo = "hello"` overwrites the function, so the last log is `"string"`.
:::

:::quiz
### What does `typeof x` do inside the TDZ of `let x`?
- [ ] Returns "undefined"
- [x] Throws ReferenceError
- [ ] Returns "object"
- [ ] Returns null
@@@explain
`typeof` only protects you from *undeclared* identifiers. A `let` in its TDZ is declared but uninitialised, so access throws.
:::

:::quiz
### Which can be called before the line it is written on?
- [x] `function f() {}`
- [ ] `const f = () => {}`
- [ ] `var f = function () {}`
- [ ] `let f = function () {}`
@@@explain
Only function declarations are hoisted together with their body.
:::
