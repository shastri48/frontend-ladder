---
title: Dynamic Forms and Multi-Step Wizards
summary: Adding/removing inputs dynamically, controlled vs uncontrolled inputs, a validation strategy that scales, and a multi-step form with shared state and step-wise validation.
minutes: 20
---

## Forms are where React apps get messy

Forms combine everything hard: lots of state, validation timing, async submission, accessibility and performance. Interviewers love them because there's no single trick — it's all design.

## Controlled vs uncontrolled

```jsx
// Controlled: React state is the single source of truth
const [email, setEmail] = useState('')
<input value={email} onChange={(e) => setEmail(e.target.value)} />

// Uncontrolled: the DOM holds the value; read it when needed
const ref = useRef(null)
<input defaultValue="" ref={ref} />
// on submit: ref.current.value   — or new FormData(form)
```

| | Controlled | Uncontrolled |
|---|---|---|
| Source of truth | React state | DOM |
| Re-render per keystroke | Yes | No |
| Instant validation / formatting / conditional fields | Easy | Harder |
| Code | More | Less |
| Performance on huge forms | Can lag | Fast |
| Examples | Formik | **React Hook Form** (uncontrolled + refs), native `FormData`, React 19 form actions |

A sensible strategy: controlled for small forms or fields with live behaviour (masking, dependent fields), uncontrolled/React Hook Form for large forms. Never switch a field between controlled and uncontrolled (`value={undefined}` → `value="x"` triggers a warning).

## Validation strategy

Decide on four things:

1. **Where rules live** — a schema (Zod/Yup) shared with the backend beats ad-hoc `if`s scattered in handlers.
2. **When to validate** — on blur for the first time ("touched"), then on change once a field is invalid; always on submit. Validating on every keystroke from the start is hostile ("Invalid email" after typing one letter).
3. **How to show errors** — next to the field, linked with `aria-describedby`, `aria-invalid="true"`; on submit, focus the first invalid field and optionally show a summary.
4. **Server errors** — map API validation errors back onto fields; disable the submit button while submitting (prevent double submits) but keep it enabled otherwise so users discover errors.

```js
// A tiny schema-like validator
const rules = {
  name: (v) => (!v.trim() ? 'Name is required' : null),
  email: (v) => (!/^\S+@\S+\.\S+$/.test(v) ? 'Enter a valid email' : null),
  age: (v) => (v && (+v < 18 || +v > 120) ? 'Age must be 18–120' : null),
}
const validate = (values) =>
  Object.fromEntries(Object.entries(rules).map(([k, rule]) => [k, rule(values[k] ?? '')]).filter(([, e]) => e))
```

## Dynamic forms: add/remove inputs

:::challenge
difficulty: medium
companies: Uber, Flipkart
### Dynamic list of inputs with validation
Build a form "Team members": each row has `name` and `email`. Users can add rows, remove rows (minimum 1), and submit. Validate required name, valid email and **no duplicate emails**. Show errors only after a field is touched or after a submit attempt. On submit, log the clean data.
@@@hint
Store rows as an array of objects with a stable generated `id` (never use the array index as the key — removing a row would shift state into the wrong inputs). Derive errors from values on every render.
@@@solution
```jsx
import { useMemo, useRef, useState } from 'react'

const newRow = () => ({ id: crypto.randomUUID(), name: '', email: '' })
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRows(rows) {
  const errors = {}
  const seen = new Map()
  rows.forEach((r) => {
    const e = {}
    if (!r.name.trim()) e.name = 'Name is required'
    if (!EMAIL.test(r.email)) e.email = 'Enter a valid email'
    const key = r.email.trim().toLowerCase()
    if (key && seen.has(key)) e.email = 'Duplicate email'
    seen.set(key, r.id)
    if (Object.keys(e).length) errors[r.id] = e
  })
  return errors
}

export function TeamForm({ onSubmit = console.log }) {
  const [rows, setRows] = useState([newRow()])
  const [touched, setTouched] = useState({})          // `${id}.${field}` → true
  const [submitted, setSubmitted] = useState(false)
  const formRef = useRef(null)

  const errors = useMemo(() => validateRows(rows), [rows])   // derived, never stored
  const showError = (id, field) => (submitted || touched[`${id}.${field}`]) && errors[id]?.[field]

  const update = (id, field, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  const add = () => setRows((rs) => [...rs, newRow()])
  const remove = (id) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs))
  const touch = (id, field) => setTouched((t) => ({ ...t, [`${id}.${field}`]: true }))

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) {
      // focus first invalid field
      formRef.current.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    onSubmit(rows.map(({ name, email }) => ({ name: name.trim(), email: email.trim().toLowerCase() })))
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <fieldset>
        <legend>Team members</legend>
        {rows.map((row, i) => (
          <div className="row" key={row.id}>
            {['name', 'email'].map((field) => {
              const err = showError(row.id, field)
              const id = `${field}-${row.id}`
              return (
                <div key={field} className="field">
                  <label htmlFor={id}>{field === 'name' ? 'Name' : 'Email'} {i + 1}</label>
                  <input
                    id={id}
                    type={field === 'email' ? 'email' : 'text'}
                    value={row[field]}
                    onChange={(e) => update(row.id, field, e.target.value)}
                    onBlur={() => touch(row.id, field)}
                    aria-invalid={err ? 'true' : 'false'}
                    aria-describedby={err ? `${id}-err` : undefined}
                  />
                  {err && <span id={`${id}-err`} className="error">{err}</span>}
                </div>
              )
            })}
            <button type="button" onClick={() => remove(row.id)} disabled={rows.length === 1}
              aria-label={`Remove member ${i + 1}`}>✕</button>
          </div>
        ))}
      </fieldset>
      <button type="button" onClick={add}>+ Add member</button>
      <button type="submit">Save team</button>
    </form>
  )
}
```

Talking points:
- **Stable ids as keys** — with index keys, deleting row 1 would make row 2's DOM input (and its focus/uncontrolled state) appear in the wrong place.
- **Errors are derived** from values, not stored → can't get out of sync. Only *visibility* (`touched`, `submitted`) is state.
- Immutable updates with `map`/`filter`.
- Cross-field rule (duplicates) is easy because validation sees the whole form.
- A11y: labels per input, `aria-invalid` + `aria-describedby`, focus first error, `fieldset/legend`.
- Scale: with 200 rows, extract a memoized `<Row>` and pass stable callbacks (`useCallback` + id), or switch to React Hook Form's `useFieldArray`.
:::

## Multi-step form with global state

"How do you persist data across steps? Handle step-wise validation and navigation?"

Design:

- **One source of truth** for all steps' data, owned above the steps: a `useReducer` in a `<Wizard>` component exposed through context (or a small store like Zustand). Individual steps stay dumb.
- **Per-step schemas** — validate only the current step on "Next"; validate everything on final submit.
- **Navigation** — Back never validates (and never loses data); Next validates the current step; optionally allow jumping to completed steps.
- **Persistence** — sync to `sessionStorage` (survives refresh, per tab) or the server as a draft; put the step in the URL (`/signup/address`) so refresh and the browser Back button work.
- **Unmounting steps** — since data lives in the parent, steps can unmount freely.

:::challenge
difficulty: hard
companies: Razorpay, Intuit
### Build a 3-step signup wizard
Steps: (1) Account — email, password; (2) Profile — name, phone; (3) Review — show all data, Submit. Requirements: Next validates the current step, Back keeps data, a progress indicator, state survives a page refresh (sessionStorage), and submit is disabled while sending.
@@@solution
```jsx
import { createContext, useContext, useEffect, useReducer, useState } from 'react'

const STEPS = [
  {
    id: 'account', title: 'Account',
    validate: (d) => ({
      ...(!/^\S+@\S+\.\S+$/.test(d.email) && { email: 'Valid email required' }),
      ...(d.password.length < 8 && { password: 'Min 8 characters' }),
    }),
  },
  {
    id: 'profile', title: 'Profile',
    validate: (d) => ({
      ...(!d.name.trim() && { name: 'Name required' }),
      ...(!/^\d{10}$/.test(d.phone) && { phone: '10-digit phone required' }),
    }),
  },
  { id: 'review', title: 'Review', validate: () => ({}) },
]

const initial = { step: 0, data: { email: '', password: '', name: '', phone: '' }, errors: {} }
const STORAGE_KEY = 'signup-wizard'

function reducer(state, action) {
  switch (action.type) {
    case 'change':
      return { ...state, data: { ...state.data, [action.field]: action.value },
               errors: { ...state.errors, [action.field]: undefined } }
    case 'next': {
      const errors = STEPS[state.step].validate(state.data)
      if (Object.keys(errors).length) return { ...state, errors }
      return { ...state, step: Math.min(state.step + 1, STEPS.length - 1), errors: {} }
    }
    case 'back':
      return { ...state, step: Math.max(state.step - 1, 0), errors: {} }
    case 'goto':
      return action.step < state.step ? { ...state, step: action.step, errors: {} } : state
    case 'reset':
      return initial
    default:
      throw new Error(`Unknown action ${action.type}`)
  }
}

function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    // never persist the password
    return saved ? { ...initial, ...saved, data: { ...initial.data, ...saved.data } } : initial
  } catch { return initial }
}

const WizardContext = createContext(null)
const useWizard = () => useContext(WizardContext)

export function SignupWizard() {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    const { password, ...safe } = state.data
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step: state.step, data: safe })) } catch {}
  }, [state.step, state.data])

  const Step = [AccountStep, ProfileStep, ReviewStep][state.step]

  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      <ol className="progress" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === state.step ? 'step' : undefined} className={i < state.step ? 'done' : ''}>
            <button type="button" onClick={() => dispatch({ type: 'goto', step: i })} disabled={i >= state.step}>
              {i + 1}. {s.title}
            </button>
          </li>
        ))}
      </ol>
      <form onSubmit={(e) => { e.preventDefault(); dispatch({ type: 'next' }) }} noValidate>
        <h2>{STEPS[state.step].title}</h2>
        <Step />
      </form>
    </WizardContext.Provider>
  )
}

function Field({ name, label, type = 'text' }) {
  const { state, dispatch } = useWizard()
  const error = state.errors[name]
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} type={type} value={state.data[name]}
        onChange={(e) => dispatch({ type: 'change', field: name, value: e.target.value })}
        aria-invalid={!!error} aria-describedby={error ? `${name}-err` : undefined} />
      {error && <span id={`${name}-err`} role="alert">{error}</span>}
    </div>
  )
}

function Nav({ last }) {
  const { state, dispatch } = useWizard()
  return (
    <div className="nav">
      {state.step > 0 && <button type="button" onClick={() => dispatch({ type: 'back' })}>Back</button>}
      {!last && <button type="submit">Next</button>}
    </div>
  )
}

function AccountStep() {
  return (<><Field name="email" label="Email" type="email" /><Field name="password" label="Password" type="password" /><Nav /></>)
}
function ProfileStep() {
  return (<><Field name="name" label="Full name" /><Field name="phone" label="Phone" type="tel" /><Nav /></>)
}
function ReviewStep() {
  const { state, dispatch } = useWizard()
  const [status, setStatus] = useState('idle')
  async function submit() {
    // final full validation in case data was edited via storage
    const allErrors = STEPS.reduce((acc, s) => ({ ...acc, ...s.validate(state.data) }), {})
    if (Object.keys(allErrors).length) return alert('Please fix earlier steps')
    setStatus('sending')
    try {
      await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.data) })
      sessionStorage.removeItem(STORAGE_KEY)
      setStatus('done')
    } catch { setStatus('error') }
  }
  if (status === 'done') return <p>🎉 Account created!</p>
  const { password, ...shown } = state.data
  return (
    <>
      <dl>{Object.entries(shown).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
      {status === 'error' && <p role="alert">Submission failed, try again.</p>}
      <Nav last />
      <button type="button" onClick={submit} disabled={status === 'sending'}>
        {status === 'sending' ? 'Submitting…' : 'Submit'}
      </button>
    </>
  )
}
```

Key design decisions to explain:
- **Reducer + context** = single source of truth; steps are presentational and can unmount without losing data.
- **Per-step validation** inside the `next` action; Back never validates.
- `goto` only allows going back to completed steps.
- Persistence to **sessionStorage**, deliberately excluding the password (sensitive data shouldn't be stored). On a password-less refresh the user re-enters only that field — or keep the password in memory only.
- The `<form onSubmit>` makes Enter key = Next.
- Final submit re-validates all steps, guards against double submit, handles errors and clears the draft on success.
- Follow-ups: URL-based steps (`/signup/:step`) with route guards, async validation (email already taken) with debounce, dynamic steps based on answers, `beforeunload` warning for unsaved changes.
:::

## Interview questions

:::question
difficulty: easy
companies: Groww, Accenture
### Controlled vs uncontrolled components?
A **controlled** input's value lives in React state and is passed via `value` + `onChange`; React is the source of truth, enabling instant validation, formatting and conditional UI at the cost of a re-render per keystroke. An **uncontrolled** input keeps its value in the DOM (`defaultValue`), read via a ref or `FormData` on submit — less code and faster for large forms (React Hook Form uses this approach). Choose controlled for interactive fields, uncontrolled for simple or very large forms; never switch between the two for one field.
:::

:::question
difficulty: medium
companies: Accenture
### How do you handle forms and manage form state efficiently?
Keep minimal state (values, touched, submit status) and **derive** errors/validity. Use a schema (Zod) for rules shared with the backend. Validate on blur, then on change after the first error, and fully on submit. For big forms use React Hook Form (uncontrolled, isolated re-renders) or split into memoized field components. Handle async submission (disable while sending, show server errors per field, prevent double submit). Make it accessible (labels, `aria-invalid`, `aria-describedby`, focus first error). Persist drafts if losing input would hurt.
:::

:::question
difficulty: medium
### How would you optimize a complex form with hundreds of fields?
- Avoid one giant state object re-rendering everything per keystroke: use **uncontrolled inputs** (React Hook Form) or field-level subscriptions (`useWatch`, Final Form), or split into memoized sections that receive only their slice.
- Debounce expensive validation and async checks; run heavy validation on blur/submit.
- Lazy-render sections (accordion/steps) and virtualize huge repeated lists of rows.
- Keep derived computations memoized.
- Profile with React DevTools Profiler ("highlight updates") to confirm only the edited field re-renders.
:::

## Quick check

:::quiz
### Why is using the array index as key a bug in a dynamic form with removable rows?
- [ ] Indices aren't strings
- [x] After removing a row, remaining rows shift indices and React reuses the wrong DOM/state for them
- [ ] React warns about it in production
- [ ] It breaks form submission
@@@explain
Keys identify items across renders. Index keys tie identity to position, which changes on removal or reordering.
:::

:::quiz
### Where should multi-step form data live?
- [ ] In each step's local state
- [x] In a parent (reducer/context or store) above all steps
- [ ] In the URL query string
- [ ] In refs inside each input
@@@explain
Steps unmount on navigation; data owned above them survives and is the single source of truth.
:::
