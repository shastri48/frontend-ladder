---
title: TypeScript Essentials for React Developers
summary: Types vs interfaces, unions and narrowing, generics, utility types, and typing props, state, hooks, events and API responses.
minutes: 18
---

## Why TypeScript

TypeScript is JavaScript plus a **static type system** that's erased at build time. It catches whole categories of bugs before runtime — typos in property names, `undefined` access, wrong argument types — and makes refactoring large codebases safe. Your editor becomes a precise documentation tool.

Important mental model: **types don't exist at runtime**. TypeScript can't validate an API response for you; it only checks what you claim. Data crossing a trust boundary (network, localStorage, user input) should be validated at runtime (e.g. with **Zod**).

## The basics

```ts
let count: number = 0
let name = 'Ada'                 // inferred as string — prefer inference for locals
const role = 'admin'             // literal type 'admin' (const)
let ids: number[] = [1, 2]
let pair: [string, number] = ['age', 30]   // tuple
let anything: unknown            // safe "any": must narrow before use
let escape: any                  // turns checking off — avoid
function fail(msg: string): never { throw new Error(msg) }
```

`unknown` vs `any`: both accept any value, but `unknown` forces you to check before using it; `any` silently disables the type checker and spreads.

## type vs interface

```ts
interface User {
  id: string
  name: string
  email?: string          // optional
  readonly createdAt: Date
}

type Status = 'idle' | 'loading' | 'success' | 'error'   // union — only `type` can do this
type Point = { x: number; y: number }
type WithId<T> = T & { id: string }                       // intersection
```

| | `interface` | `type` |
|---|---|---|
| Object shapes | ✅ | ✅ |
| Unions, tuples, primitives, mapped/conditional types | ❌ | ✅ |
| `extends` | ✅ `interface B extends A` | via `&` |
| Declaration merging (reopen to add fields) | ✅ | ❌ |
| Error messages / perf for big hierarchies | Slightly better | Fine |

Practical rule: use `interface` for public object shapes you may extend (and library augmentation), `type` for unions and everything else — and be consistent within a codebase.

## Unions and narrowing

```ts
function format(input: string | number) {
  if (typeof input === 'string') return input.toUpperCase()   // narrowed to string
  return input.toFixed(2)                                     // narrowed to number
}
```

Narrowing tools: `typeof`, `instanceof`, `in`, equality checks, truthiness, and **discriminated unions**:

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

function render(state: RequestState<User[]>) {
  switch (state.status) {
    case 'success': return state.data.length     // data exists only here
    case 'error':   return state.error.message
    case 'idle':
    case 'loading': return null
    default: {
      const _exhaustive: never = state           // compile error if a case is missing
      return _exhaustive
    }
  }
}
```

Discriminated unions make **impossible states impossible** — you can't have `data` and `error` at the same time, unlike `{ loading: boolean; data?: T; error?: Error }`.

Custom type guards:

```ts
function isUser(x: unknown): x is User {
  return typeof x === 'object' && x !== null && 'id' in x && 'name' in x
}
```

## Generics

Generics are **type parameters** — functions and types that work for many types while preserving the relationship between input and output.

```ts
function first<T>(arr: T[]): T | undefined { return arr[0] }
first([1, 2])        // number | undefined
first(['a'])         // string | undefined

// Constraints
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key] }
pluck({ id: 1, name: 'Ada' }, 'name')   // string
pluck({ id: 1 }, 'nope')                // ❌ error

// Generic API helper
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.statusText)
  return res.json() as Promise<T>       // a claim — validate with Zod for real safety
}
const users = await getJSON<User[]>('/api/users')
```

## Utility types you'll use daily

| Utility | Result |
|---|---|
| `Partial<T>` | All props optional (update payloads) |
| `Required<T>` | All props required |
| `Readonly<T>` | All props readonly |
| `Pick<T, 'a' \| 'b'>` | Only those props |
| `Omit<T, 'password'>` | All except those |
| `Record<K, V>` | Object with keys K and values V |
| `ReturnType<typeof fn>` | The function's return type |
| `Parameters<typeof fn>` | Tuple of param types |
| `Awaited<P>` | Unwrapped promise type |
| `NonNullable<T>` | Removes null/undefined |
| `Exclude<U, X>` / `Extract<U, X>` | Filter union members |

```ts
type UserUpdate = Partial<Omit<User, 'id' | 'createdAt'>>
const byId: Record<string, User> = {}
```

Also: `keyof`, `typeof` (type of a value), indexed access `T['key']`, `as const` for literal tuples/objects, and the `satisfies` operator (check a value matches a type without widening it):

```ts
const routes = {
  home: '/',
  profile: '/u/:id',
} satisfies Record<string, string>
routes.home   // type is '/' (not just string), and typos in keys still error
```

## Typing React

### Props

```tsx
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
} & React.ComponentPropsWithoutRef<'button'>   // inherit all native button props

export function Button({ variant = 'primary', size = 'md', loading, children, ...rest }: ButtonProps) {
  return (
    <button className={`btn btn-${variant} btn-${size}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? 'Loading…' : children}
    </button>
  )
}
```

`children` type: `React.ReactNode` (anything renderable). Avoid `React.FC` — it's fine today but plain function signatures are simpler and the community default.

### State and refs

```tsx
const [user, setUser] = useState<User | null>(null)     // explicit when initial value is narrower
const [items, setItems] = useState<string[]>([])
const inputRef = useRef<HTMLInputElement>(null)          // DOM ref
const timer = useRef<number | undefined>(undefined)      // mutable value
```

### Events

```tsx
function Search() {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => console.log(e.target.value)
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault() }
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') {/*…*/} }
  return <form onSubmit={onSubmit}><input onChange={onChange} onKeyDown={onKey} /></form>
}
```

Tip: hover over `onChange` in your editor to see the exact event type.

### Generic components and hooks

```tsx
type ListProps<T> = {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => React.ReactNode
}
function List<T>({ items, getKey, renderItem }: ListProps<T>) {
  return <ul>{items.map((it) => <li key={getKey(it)}>{renderItem(it)}</li>)}</ul>
}

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue] as const        // tuple, not (T | Dispatch)[]
}
```

### Context

```tsx
type Auth = { user: User | null; login: (u: User) => void }
const AuthContext = createContext<Auth | null>(null)
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx                              // narrowed to Auth
}
```

## Interview questions

:::question
difficulty: easy
### type vs interface — which do you use?
Both describe object shapes. `interface` supports declaration merging and `extends`, and is conventional for public object contracts. `type` aliases can express **unions, intersections, tuples, primitives, mapped and conditional types**. I use `type` for unions/utility compositions and either for objects, consistently per codebase. Interfaces can be augmented (e.g. extending a library's `Window`), types cannot.
:::

:::question
difficulty: medium
### What are generics and why use them?
Type parameters that let a function, type or component work with many types while keeping type relationships — e.g. `first<T>(arr: T[]): T`. Without generics you'd use `any` and lose safety. Constraints (`<K extends keyof T>`) limit what's accepted. In React: generic `List<T>`, `useFetch<T>`, typed context, `useState<T>`.
:::

:::question
difficulty: medium
### any vs unknown vs never?
- `any`: opts out of type checking; anything goes, errors propagate silently.
- `unknown`: top type that's safe — you must narrow (`typeof`, guards, Zod) before using it. Use for untrusted data and catch-clause errors.
- `never`: the empty type — a value that can't exist. Return type of functions that throw/never return, and used for **exhaustiveness checks** in switch statements over discriminated unions.
:::

:::question
difficulty: medium
### What is a discriminated union and why is it useful for UI state?
A union of object types that share a literal "tag" property (e.g. `status`). Checking the tag narrows to the specific member, giving access only to fields valid in that state. It models UI states (idle/loading/success/error) so invalid combinations (loading with an error and data) can't be represented, and `never`-based exhaustiveness checks force you to handle every state.
:::

## Challenges

:::challenge
difficulty: medium
### Type a generic groupBy
Write a TypeScript signature and implementation for `groupBy(items, keyFn)` that returns `Record<K, T[]>`, where `K` is inferred from `keyFn`'s return type (string or number keys).
@@@solution
```ts
function groupBy<T, K extends PropertyKey>(items: readonly T[], keyFn: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const key = keyFn(item)
    ;(out[key] ??= []).push(item)
  }
  return out
}

const products = [
  { id: 1, category: 'Mobile' as const, name: 'iPhone' },
  { id: 2, category: 'Laptop' as const, name: 'MacBook' },
]
const grouped = groupBy(products, (p) => p.category)
// Record<'Mobile' | 'Laptop', { id: number; category: 'Mobile' | 'Laptop'; name: string }[]>
```
`PropertyKey` is `string | number | symbol`. Note modern JS has `Object.groupBy(items, fn)` built in, typed as `Partial<Record<K, T[]>>`.
:::

:::challenge
difficulty: hard
### Make impossible state impossible
This props type allows nonsense like `{ loading: true, error: 'x', data: [...] }`. Rewrite it so each state only carries the fields that make sense, and write a component that renders it with exhaustive handling.
```ts
type Props = { loading: boolean; error?: string; data?: string[] }
```
@@@solution
```tsx
type Props =
  | { status: 'loading' }
  | { status: 'error'; error: string; onRetry: () => void }
  | { status: 'success'; data: string[] }

function assertNever(x: never): never {
  throw new Error('Unhandled state: ' + JSON.stringify(x))
}

function Results(props: Props) {
  switch (props.status) {
    case 'loading':
      return <p aria-busy="true">Loading…</p>
    case 'error':
      return (
        <div role="alert">
          {props.error} <button onClick={props.onRetry}>Retry</button>
        </div>
      )
    case 'success':
      return props.data.length ? (
        <ul>{props.data.map((d) => <li key={d}>{d}</li>)}</ul>
      ) : (
        <p>No results</p>
      )
    default:
      return assertNever(props)
  }
}
```
Adding a new state (e.g. `'empty'`) without handling it now fails to compile at `assertNever`.
:::

## Quick check

:::quiz
### Which can only be expressed with `type`, not `interface`?
- [ ] An object with optional fields
- [x] A union like 'sm' | 'md' | 'lg'
- [ ] A shape that extends another shape
- [ ] A readonly property
@@@explain
Interfaces describe object shapes only; unions require a type alias.
:::

:::quiz
### What does `res.json() as Promise<User>` guarantee at runtime?
- [ ] The response is validated to match User
- [x] Nothing — it's only a compile-time assertion
- [ ] It throws if fields are missing
- [ ] It strips extra fields
@@@explain
Types are erased; use runtime validation (Zod, Valibot) for data from the network.
:::
