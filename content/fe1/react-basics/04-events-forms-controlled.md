---
title: Events, Forms & Controlled vs Uncontrolled
summary: Handling events in React, building forms, the controlled vs uncontrolled decision, and a practical validation strategy.
minutes: 17
---

## Events in React

```jsx
function LikeButton() {
  const [liked, setLiked] = useState(false)
  return (
    <button onClick={() => setLiked((l) => !l)} aria-pressed={liked}>
      {liked ? "♥ Liked" : "♡ Like"}
    </button>
  )
}
```

- Event props are **camelCase**: `onClick`, `onChange`, `onSubmit`, `onKeyDown`.
- Pass a **function**, don't call it: `onClick={handleClick}`, not `onClick={handleClick()}` (that would run during render).
- Need arguments? Wrap it: `onClick={() => remove(item.id)}`.
- React gives you a **SyntheticEvent** — a cross-browser wrapper with the same API as native events (`e.target`, `e.preventDefault()`, `e.stopPropagation()`). The native event is at `e.nativeEvent`.
- React attaches listeners at the **root** and dispatches internally (delegation).

## Controlled components

A **controlled** input's value lives in React state. React is the single source of truth: the input displays `value` and reports changes via `onChange`.

```jsx
function NameField() {
  const [name, setName] = useState("")
  return (
    <label>
      Name
      <input value={name} onChange={(e) => setName(e.target.value)} />
    </label>
  )
}
```

```text
 keystroke → onChange → setName → re-render → input shows new value
```

Because every keystroke flows through your code, you can:

- **Validate instantly** (show "too short" as they type).
- **Transform input** (`setName(e.target.value.toUpperCase())`, strip non-digits from a phone field).
- **Conditionally disable** submit until valid.
- **Reset or prefill** the form by setting state.

Each field type uses a different prop:

| Element | Value prop | Read from event |
|---|---|---|
| `<input type="text">`, `<textarea>`, `<select>` | `value` | `e.target.value` |
| `<input type="checkbox">` | `checked` | `e.target.checked` |
| `<input type="radio">` | `checked={selected === v}` | `e.target.value` |
| `<input type="file">` | always uncontrolled | `e.target.files` |

:::callout warn The read-only warning
`<input value={x} />` without `onChange` makes a field you can't type in — React warns you. Use `defaultValue` for uncontrolled, or add `onChange`. Also avoid switching between `value={undefined}` and a string: start with `""`.
:::

## Uncontrolled components

An **uncontrolled** input keeps its value **in the DOM**, like plain HTML. You read it when you need it — on submit, via a ref or `FormData`.

```jsx
function SubscribeForm() {
  const emailRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    console.log(emailRef.current.value)
    // or: Object.fromEntries(new FormData(e.currentTarget))
  }

  return (
    <form onSubmit={handleSubmit}>
      <input ref={emailRef} name="email" type="email" defaultValue="" required />
      <button>Subscribe</button>
    </form>
  )
}
```

`defaultValue` / `defaultChecked` set the initial value only.

## Controlled vs uncontrolled — when to use which

| | Controlled | Uncontrolled |
|---|---|---|
| Source of truth | React state | DOM |
| Re-render per keystroke | Yes | No |
| Instant validation / formatting | Easy | Harder |
| Code | More | Less |
| Performance on huge forms | Can lag without care | Fast |
| Good for | Dynamic forms, dependent fields, live search | Simple forms, file inputs, integrating non-React widgets |

Libraries like **React Hook Form** use uncontrolled inputs + refs under the hood for performance and give you controlled-like validation APIs. **Formik** is controlled.

## Forms: a practical pattern

One state object, one change handler driven by `name`:

```jsx
const initial = { name: "", email: "", plan: "free", agree: false }

function SignupForm() {
  const [values, setValues] = useState(initial)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const errors = validate(values)              // derived, not stored
  const isValid = Object.keys(errors).length === 0

  function handleChange(e) {
    const { name, type, value, checked } = e.target
    setValues((v) => ({ ...v, [name]: type === "checkbox" ? checked : value }))
  }

  function handleBlur(e) {
    setTouched((t) => ({ ...t, [e.target.name]: true }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({ name: true, email: true, agree: true })
    if (!isValid) return
    setSubmitting(true)
    try {
      await api.signup(values)
      setValues(initial)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label>
        Name
        <input name="name" value={values.name} onChange={handleChange} onBlur={handleBlur}
               aria-invalid={!!(touched.name && errors.name)} aria-describedby="name-err" />
      </label>
      {touched.name && errors.name && <p id="name-err" role="alert">{errors.name}</p>}

      <label>
        Email
        <input name="email" type="email" value={values.email} onChange={handleChange} onBlur={handleBlur} />
      </label>
      {touched.email && errors.email && <p role="alert">{errors.email}</p>}

      <select name="plan" value={values.plan} onChange={handleChange}>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>

      <label>
        <input type="checkbox" name="agree" checked={values.agree} onChange={handleChange} />
        I agree to the terms
      </label>

      <button disabled={submitting}>{submitting ? "Signing up…" : "Sign up"}</button>
    </form>
  )
}

function validate(v) {
  const e = {}
  if (v.name.trim().length < 2) e.name = "Name must be at least 2 characters"
  if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Enter a valid email"
  if (!v.agree) e.agree = "You must accept the terms"
  return e
}
```

### A validation strategy that feels good

- **Derive errors** from values with a pure `validate` function (easy to test, never out of sync).
- **Show errors after blur** ("touched") or after the first submit — not while the user is still typing their first character.
- **Validate again on submit** and focus the first invalid field.
- **Mirror server-side validation** — client checks are UX, the server is the real gate.
- Use **native attributes** too (`required`, `type="email"`, `minLength`) for free mobile keyboards and accessibility.
- Connect messages with `aria-describedby`, flag with `aria-invalid`.
- For big forms, use a schema library (Zod/Yup) + React Hook Form.

## Interview questions

:::question
difficulty: easy
companies: Groww, Accenture, Common
### What is the difference between controlled and uncontrolled components?
In a **controlled** component, form data is held in React state: the input's `value` comes from state and every change goes through `onChange` → `setState`. React is the source of truth, which enables instant validation, formatting and conditional logic, at the cost of a re-render per keystroke. In an **uncontrolled** component, the DOM holds the value; you set an initial `defaultValue` and read the current value via a ref or `FormData` when needed (e.g. on submit). Uncontrolled is simpler and faster for basic forms and required for file inputs.
:::

:::question
difficulty: medium
companies: Accenture
### How do you handle forms and manage form state efficiently?
Keep values in one state object (or a reducer) with a generic `name`-based change handler; derive errors with a pure validator instead of storing them; track `touched` to show errors at the right time; disable submit while submitting. For large forms avoid re-rendering the whole form on each keystroke: split into field components, use uncontrolled inputs with React Hook Form, or debounce expensive validation. Use schema validation (Zod/Yup) shared with the backend where possible, and always handle server errors.
:::

:::question
difficulty: easy
### Why is `onClick={handleClick()}` wrong?
It calls `handleClick` immediately during render and passes its *return value* as the handler. If the function sets state, you get an infinite render loop. Pass the reference (`onClick={handleClick}`) or an arrow (`onClick={() => handleClick(id)}`).
:::

## Challenges

:::challenge
difficulty: medium
### Dynamic form fields
Build a form for adding multiple phone numbers: an "Add number" button adds a new input, each row has a "Remove" button, each number must be 10 digits, and submit logs the array. Explain your key choice.
@@@solution
```jsx
import { useState } from "react"

const newRow = () => ({ id: crypto.randomUUID(), value: "" })

export function PhoneNumbers() {
  const [rows, setRows] = useState([newRow()])
  const [submitted, setSubmitted] = useState(false)

  const update = (id, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, value: value.replace(/\D/g, "").slice(0, 10) } : r)))
  const add = () => setRows((rs) => [...rs, newRow()])
  const remove = (id) => setRows((rs) => rs.filter((r) => r.id !== id))

  const errors = Object.fromEntries(rows.map((r) => [r.id, r.value.length === 10 ? null : "Enter 10 digits"]))
  const valid = rows.length > 0 && Object.values(errors).every((e) => e === null)

  function onSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (valid) console.log(rows.map((r) => r.value))
  }

  return (
    <form onSubmit={onSubmit}>
      {rows.map((row, i) => (
        <div key={row.id}>
          <label>
            Phone {i + 1}
            <input inputMode="numeric" value={row.value} onChange={(e) => update(row.id, e.target.value)}
                   aria-invalid={submitted && !!errors[row.id]} />
          </label>
          <button type="button" onClick={() => remove(row.id)} disabled={rows.length === 1}>Remove</button>
          {submitted && errors[row.id] && <span role="alert">{errors[row.id]}</span>}
        </div>
      ))}
      <button type="button" onClick={add}>Add number</button>
      <button type="submit">Save</button>
    </form>
  )
}
```
Key points: each row gets a **generated stable id** at creation (not the index — removing row 2 would otherwise shift typed values and focus to the wrong inputs); `type="button"` stops add/remove from submitting the form; input is sanitised in the handler (controlled component benefit); errors are derived; `inputMode="numeric"` shows a number keypad on mobile.
:::

:::challenge
difficulty: easy
### Convert controlled to uncontrolled
Rewrite this login form as uncontrolled using `FormData`, keeping the same submit behaviour.
```jsx
function Login({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  return (
    <form onSubmit={(e) => { e.preventDefault(); onLogin({ email, password }) }}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button>Log in</button>
    </form>
  )
}
```
@@@solution
```jsx
function Login({ onLogin }) {
  function handleSubmit(e) {
    e.preventDefault()
    const { email, password } = Object.fromEntries(new FormData(e.currentTarget))
    onLogin({ email, password })
  }
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" autoComplete="username" required />
      <input name="password" type="password" autoComplete="current-password" required />
      <button>Log in</button>
    </form>
  )
}
```
No state, no re-render per keystroke. `name` attributes are required for `FormData`. Native `required`/`type="email"` give basic validation. `e.currentTarget` is the form (the element the handler is attached to).
:::

:::quiz
### Which input must always be uncontrolled?
- [ ] text
- [ ] checkbox
- [x] file
- [ ] select
@@@explain
A file input's value can only be set by the user, so React can't control it.
:::

:::quiz
### Controlled checkbox uses which prop?
- [ ] value
- [x] checked
- [ ] defaultChecked
- [ ] selected
@@@explain
Checkboxes are controlled with `checked` + `onChange` reading `e.target.checked`.
:::
