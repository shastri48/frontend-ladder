---
title: Prototypes, Inheritance & Classes
summary: How property lookup walks the prototype chain, what `new` and `class` really do, and a real-world inheritance example (not just theory).
minutes: 16
---

## Objects delegate, they don't copy

In class-based languages (Java, C#), an object is stamped from a class blueprint. JavaScript works differently: every object has a hidden link, `[[Prototype]]`, to **another object**. When you read a property that the object doesn't have, the engine follows that link and looks there — and keeps going until it finds the property or hits `null`.

This chain of links is the **prototype chain**, and it's how inheritance, methods on arrays (`[].map`), and `class` all work.

:::callout analogy Asking your manager
If you don't know an answer, you ask your manager; if they don't know, they ask theirs, up to the CEO. If the CEO doesn't know, the answer is "undefined". Nobody copies the CEO's knowledge into your head — you just *delegate*.
:::

:::visual prototype-chain
:::

```js
const animal = { eats: true, walk() { return `${this.name} walks` } }
const dog = Object.create(animal) // dog.[[Prototype]] = animal
dog.name = 'Rex'
dog.barks = true

dog.barks   // true  — own property
dog.eats    // true  — found on animal
dog.walk()  // "Rex walks" — method found on animal, `this` is still dog
dog.toString // found on Object.prototype
dog.fly     // undefined — chain ended at null
```

```text
dog { name, barks }
  └─[[Prototype]]→ animal { eats, walk }
        └─[[Prototype]]→ Object.prototype { toString, hasOwnProperty, ... }
              └─[[Prototype]]→ null
```

## `prototype` vs `__proto__` vs `[[Prototype]]`

These three names confuse everyone:

| Name | What it is |
|---|---|
| `[[Prototype]]` | The internal link every object has. |
| `obj.__proto__` | Legacy getter/setter that exposes `[[Prototype]]`. Prefer `Object.getPrototypeOf(obj)` / `Object.setPrototypeOf`. |
| `Fn.prototype` | A normal property that exists on **functions** (not arrows). It's the object that will become the `[[Prototype]]` of instances created with `new Fn()`. |

```js
function User(name) { this.name = name }
User.prototype.sayHi = function () { return `Hi, ${this.name}` }

const u = new User('Ana')
Object.getPrototypeOf(u) === User.prototype // true
u.sayHi() // "Hi, Ana" — found on User.prototype
User.prototype.constructor === User         // true
```

Methods live **once** on the prototype and are shared by every instance — that's memory-efficient compared to defining functions inside the constructor.

## Reading vs writing

- **Reading** walks the chain.
- **Writing** (`obj.x = 1`) creates/updates an **own** property on `obj` — it doesn't modify the prototype (unless a setter exists up the chain). That's called *shadowing* a prototype property.

```js
const base = { greeting: 'hello' }
const child = Object.create(base)
child.greeting = 'hi'     // own property on child
base.greeting             // still "hello"
delete child.greeting
child.greeting            // "hello" again (from base)
```

Arrays/objects on prototypes are a trap: mutating (`child.list.push(x)`) reads `list` from the prototype and mutates the **shared** array.

## `class` is syntax over prototypes

```js
class Animal {
  #id                         // truly private field
  static count = 0            // on the constructor itself
  constructor(name) {
    this.name = name
    this.#id = ++Animal.count
  }
  speak() { return `${this.name} makes a sound` } // goes on Animal.prototype
  get id() { return this.#id }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name)               // must call before using `this`
    this.breed = breed
  }
  speak() { return `${super.speak()} — woof` }  // override + call parent
}

const d = new Dog('Rex', 'Lab')
d.speak() // "Rex makes a sound — woof"
```

Under the hood:

```text
d ─→ Dog.prototype { speak, constructor: Dog }
       ─→ Animal.prototype { speak, id getter, constructor: Animal }
             ─→ Object.prototype ─→ null

Dog ─→ Animal   (static inheritance: Dog.count reads Animal.count)
```

Differences from constructor functions: classes are always strict, are in the TDZ until defined (not hoisted like function declarations), can't be called without `new`, and methods are non-enumerable.

## A real-world example: a reusable UI widget hierarchy

Interviewers (e.g. "Explain prototype inheritance with a real example, not theory") want to see you use it to share behaviour.

```js
// Base: anything that can emit events
class Emitter {
  #handlers = new Map()
  on(evt, fn) {
    if (!this.#handlers.has(evt)) this.#handlers.set(evt, new Set())
    this.#handlers.get(evt).add(fn)
    return () => this.#handlers.get(evt).delete(fn)
  }
  emit(evt, payload) {
    this.#handlers.get(evt)?.forEach((fn) => fn(payload))
  }
}

// Mid: a component with a root element and lifecycle
class Component extends Emitter {
  constructor(root) {
    super()
    this.root = root
  }
  mount() { this.render(); this.emit('mounted') }
  render() { throw new Error('render() must be implemented') }
}

// Leaf: concrete widgets only implement what's different
class Toggle extends Component {
  on = false
  render() {
    this.root.textContent = this.on ? 'ON' : 'OFF'
    this.root.onclick = () => { this.on = !this.on; this.render(); this.emit('change', this.on) }
  }
}
```

`toggle.emit` is found two levels up — one copy of `emit` shared by every widget type. That's the point of the chain: **shared behaviour via delegation**.

The same idea in ES5 (asked as "build React-like class components from scratch" at Tekion):

```js
function Component(props) { this.props = props; this.state = {} }
Component.prototype.setState = function (partial) {
  this.state = Object.assign({}, this.state, partial)
  this.render()
}

function Counter(props) {
  Component.call(this, props)            // "super(props)"
  this.state = { count: 0 }
}
Counter.prototype = Object.create(Component.prototype) // inherit methods
Counter.prototype.constructor = Counter                // fix constructor
Counter.prototype.render = function () {
  console.log('count:', this.state.count)
}

const c = new Counter({})
c.setState({ count: 1 }) // "count: 1"
```

## Composition over inheritance

Deep hierarchies get brittle (the "gorilla holding the banana and the whole jungle" problem). In modern frontend code you'll mostly compose: small functions, mixins (`Object.assign(Target.prototype, mixin)`), hooks and components. Use inheritance for genuinely "is-a" relationships with a shallow depth (e.g. custom `Error` subclasses, Web Components extending `HTMLElement`).

```js
class ValidationError extends Error {
  constructor(field, message) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}
```

## Interview questions

:::question
difficulty: medium
### Explain how prototype inheritance works with a real example.
Every object has a `[[Prototype]]` link. Property reads that miss on the object walk up this chain until found or `null`. Constructor functions and classes set instances' `[[Prototype]]` to `Fn.prototype`, so methods defined there are shared. `extends` links `Child.prototype` to `Parent.prototype`, giving multi-level delegation.

Real example: a `Component` base class with `setState`/`mount` that concrete widgets (`Toggle`, `Modal`) extend — they only implement `render`, and every instance shares one copy of the base methods via the chain. Same for built-ins: `[1,2].map` is found on `Array.prototype`.
:::

:::question
difficulty: easy
### What's the difference between `__proto__` and `prototype`?
`prototype` is a property of functions — the object that becomes the `[[Prototype]]` of instances created with `new`. `__proto__` is an accessor on every object exposing its own `[[Prototype]]`. So `new User().__proto__ === User.prototype`. Use `Object.getPrototypeOf/setPrototypeOf/create` instead of `__proto__`.
:::

:::question
difficulty: medium
### What does the `new` keyword do, step by step?
1. Create a new empty object.
2. Link its `[[Prototype]]` to `Constructor.prototype`.
3. Call the constructor with `this` bound to the new object and the given arguments.
4. If the constructor returns an object, that's the result; otherwise return the new object.

```js
function myNew(Ctor, ...args) {
  const obj = Object.create(Ctor.prototype)
  const result = Ctor.apply(obj, args)
  return result !== null && (typeof result === 'object' || typeof result === 'function') ? result : obj
}
```
:::

:::question
difficulty: medium
### Are JavaScript classes "real" classes?
They're syntactic sugar over prototypes with some real differences: always strict, TDZ until declared, must be called with `new`, non-enumerable methods, `super` and `#private` fields, static blocks. The underlying model is still prototype delegation — `typeof SomeClass === 'function'`.
:::

## Challenges

:::challenge
difficulty: medium
### Implement `myNew`
Implement `myNew(Ctor, ...args)` that behaves like `new Ctor(...args)`.
@@@starter
```js
function myNew(Ctor, ...args) {
  // your code
}
```
@@@tests
```js
test('creates instance with prototype methods', () => {
  function Person(name) { this.name = name }
  Person.prototype.hi = function () { return 'hi ' + this.name }
  const p = myNew(Person, 'Ana')
  expect(p.hi()).toBe('hi Ana')
  expect(p instanceof Person).toBe(true)
})
test('respects object returned from constructor', () => {
  function F() { this.a = 1; return { b: 2 } }
  expect(myNew(F)).toEqual({ b: 2 })
})
test('ignores primitive return values', () => {
  function G() { this.a = 1; return 5 }
  expect(myNew(G).a).toBe(1)
})
```
@@@solution
```js
function myNew(Ctor, ...args) {
  const obj = Object.create(Ctor.prototype)
  const result = Ctor.apply(obj, args)
  const isObject = result !== null && (typeof result === 'object' || typeof result === 'function')
  return isObject ? result : obj
}
```
`Object.create` sets up the prototype link, `apply` runs the constructor with the new object as `this`, and the return rule mirrors the spec.
:::

:::challenge
difficulty: medium
### Implement `myInstanceOf`
Implement `myInstanceOf(obj, Ctor)` that walks the prototype chain like `instanceof`.
@@@starter
```js
function myInstanceOf(obj, Ctor) {
  // your code
}
```
@@@tests
```js
test('direct and inherited instances', () => {
  class A {}
  class B extends A {}
  const b = new B()
  expect(myInstanceOf(b, B)).toBe(true)
  expect(myInstanceOf(b, A)).toBe(true)
  expect(myInstanceOf(b, Object)).toBe(true)
})
test('non-instances and primitives', () => {
  class A {}
  expect(myInstanceOf({}, A)).toBe(false)
  expect(myInstanceOf(5, Number)).toBe(false)
  expect(myInstanceOf(null, Object)).toBe(false)
})
```
@@@solution
```js
function myInstanceOf(obj, Ctor) {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) return false
  let proto = Object.getPrototypeOf(obj)
  while (proto !== null) {
    if (proto === Ctor.prototype) return true
    proto = Object.getPrototypeOf(proto)
  }
  return false
}
```
Primitives aren't instances (`5 instanceof Number` is `false`). Otherwise walk the chain comparing each link to `Ctor.prototype`. O(depth).
:::

:::challenge
difficulty: medium
### What gets logged?
```js
function Car() {}
Car.prototype.wheels = 4
Car.prototype.tags = []

const a = new Car()
const b = new Car()
a.wheels = 3
a.tags.push('fast')

console.log(b.wheels, b.tags)
console.log(a.hasOwnProperty('wheels'), a.hasOwnProperty('tags'))
```
@@@solution
```text
4 [ 'fast' ]
true false
```
`a.wheels = 3` **writes** an own property on `a`, shadowing the prototype's — `b` still reads 4. But `a.tags.push(...)` **reads** `tags` (found on the prototype) and mutates that shared array, so `b` sees it too. Never put mutable state on prototypes.
:::

## Quick check

:::quiz
### Where does `[1, 2, 3].map` come from?
- [ ] Each array gets its own copy of map
- [x] `Array.prototype`, reached through the array's prototype chain
- [ ] `Object.prototype`
- [ ] The global scope
@@@explain
Arrays delegate to `Array.prototype`, which delegates to `Object.prototype`.
:::

:::quiz
### What is at the end of every ordinary prototype chain?
- [ ] `Object`
- [ ] `undefined`
- [x] `null`
- [ ] `Function.prototype`
@@@explain
`Object.getPrototypeOf(Object.prototype) === null`.
:::
