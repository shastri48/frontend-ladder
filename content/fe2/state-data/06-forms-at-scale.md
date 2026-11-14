---
title: Forms at Scale
summary: Controlled vs uncontrolled inputs, validation strategy, dynamic fields, multi-step wizards with global state, and optimising big forms.
minutes: 22
---

## Controlled vs uncontrolled

**Controlled**: React state is the source of truth; the input displays `value` and reports changes via `onChange`.

```jsx
const [email, setEmail] = useState('')
<input value={email} onChange={e => setEmail(e.target.value)} />
```

**Uncontrolled**: the DOM holds the value; React reads it when needed via a ref or `FormData`.

```jsx
function Signup() {
  function handleSubmit(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    api.signup(data)
  }
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" defaultValue="" required />
      <button>Sign up</button>
    </form>
  )
}
```

| | Controlled | Uncontrolled |
|---|---|---|
| Source of truth | React state | DOM |
| Re-render per keystroke | Yes (the owner) | No |
| Instant validation / formatting / conditional fields | Easy | Harder |
| Code | More | Less |
| Perf on huge forms | Can lag if state lives high | Fast |
| File inputs | Always uncontrolled | ✓ |

Rule of thumb: controlled when the UI must react to each change (live validation, dependent fields, masks); uncontrolled for simple submit-only forms and very large forms. React Hook Form is built on uncontrolled inputs + refs for performance. React 19's `<form action={fn}>` and `useActionState` lean into the `FormData` approach.

:::callout warn Switching modes
`value={undefined}` makes an input uncontrolled; changing it later to a string triggers the "changing an uncontrolled input to be controlled" warning. Initialise with `''`, not `undefined`/`null`.
:::

## Validation strategy

Think in layers:

1. **Native HTML constraints** — `required`, `type="email"`, `minLength`, `pattern`, `min/max`. Free, accessible, works without JS.
2. **Schema validation** — a single schema (Zod, Yup, Valibot) shared between client and server: `z.object({ email: z.string().email(), age: z.number().min(18) })`.
3. **Async validation** — "username taken?" debounced, cancellable.
4. **Server validation** — always; map server field errors back into the form.

**When to show errors** (UX):
- Validate on **blur** first (don't yell while the user is typing), then on **change** once a field has been touched/has an error, and on **submit** for everything.
- On submit failure, focus the first invalid field and announce errors.
- Accessibility: `aria-invalid="true"`, `aria-describedby` linking the error text, visible labels, errors in text not just colour.

## A small useForm hook

```jsx
function useForm({ initialValues, validate, onSubmit }) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const errors = useMemo(() => validate(values), [values, validate]) // derived, not stored

  const register = name => ({
    name,
    value: values[name] ?? '',
    onChange: e => {
      const { type, checked, value } = e.target
      setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }))
    },
    onBlur: () => setTouched(t => ({ ...t, [name]: true })),
    'aria-invalid': touched[name] && !!errors[name],
  })

  const handleSubmit = async e => {
    e.preventDefault()
    setTouched(Object.fromEntries(Object.keys(values).map(k => [k, true])))
    if (Object.keys(errors).length) return
    setSubmitting(true)
    try { await onSubmit(values) } finally { setSubmitting(false) }
  }

  return { values, errors, touched, register, handleSubmit, submitting }
}
```

## Dynamic forms: add/remove inputs

```jsx
function PhoneNumbers() {
  const [phones, setPhones] = useState([{ id: crypto.randomUUID(), value: '' }])

  const add = () => setPhones(p => [...p, { id: crypto.randomUUID(), value: '' }])
  const remove = id => setPhones(p => p.filter(x => x.id !== id))
  const update = (id, value) => setPhones(p => p.map(x => (x.id === id ? { ...x, value } : x)))

  return (
    <fieldset>
      <legend>Phone numbers</legend>
      {phones.map((p, i) => (
        <div key={p.id}>
          <label htmlFor={p.id}>Phone {i + 1}</label>
          <input id={p.id} value={p.value} onChange={e => update(p.id, e.target.value)} />
          {phones.length > 1 && <button type="button" onClick={() => remove(p.id)} aria-label={`Remove phone ${i + 1}`}>✕</button>}
        </div>
      ))}
      <button type="button" onClick={add}>+ Add phone</button>
    </fieldset>
  )
}
```

Essentials: each row has a **stable id** used as `key` (never index — removing row 2 would shift values), `type="button"` so add/remove don't submit, immutable updates. For schema-driven forms (field config from an API), render from a config array and map `type` to components. React Hook Form's `useFieldArray` provides this with good performance.

## Multi-step forms with global state

Requirements: persist data across steps, validate step-by-step, allow back/forward, survive refresh, submit once at the end.

```jsx
const WizardContext = createContext(null)

const steps = [
  { id: 'account', Component: AccountStep, schema: accountSchema },
  { id: 'address', Component: AddressStep, schema: addressSchema },
  { id: 'review',  Component: ReviewStep },
]

function wizardReducer(state, action) {
  switch (action.type) {
    case 'update': return { ...state, data: { ...state.data, ...action.data } }
    case 'next':   return { ...state, step: Math.min(state.step + 1, steps.length - 1) }
    case 'back':   return { ...state, step: Math.max(state.step - 1, 0) }
    case 'goto':   return action.step <= state.maxReached ? { ...state, step: action.step } : state
    default: return state
  }
}

function Wizard() {
  const [state, dispatch] = useReducer(wizardReducer, undefined, () =>
    JSON.parse(sessionStorage.getItem('wizard') ?? 'null') ?? { step: 0, maxReached: 0, data: {} })

  useEffect(() => { sessionStorage.setItem('wizard', JSON.stringify(state)) }, [state]) // survive refresh

  const { Component, schema } = steps[state.step]
  const next = stepData => {
    const result = schema?.safeParse(stepData)
    if (result && !result.success) return result.error.flatten().fieldErrors // stay on step
    dispatch({ type: 'update', data: stepData })
    dispatch({ type: 'next' })
  }

  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      <Stepper current={state.step} steps={steps} onSelect={i => dispatch({ type: 'goto', step: i })} />
      <Component defaultValues={state.data} onNext={next} onBack={() => dispatch({ type: 'back' })} />
    </WizardContext.Provider>
  )
}
```

(Track `maxReached` by updating it in `next`.) Design decisions to talk through:

- **Where state lives**: a reducer at the wizard root (or Zustand/Redux if steps are separate routes). Each step keeps **local draft state** and commits to the wizard on "Next" — so typing doesn't re-render every step.
- **Step-wise validation**: per-step schema; final submit validates the combined schema again (and the server validates again).
- **Navigation**: allow going back freely; going forward only to steps already reached; optionally sync step to the URL (`/signup/address`) for browser back support.
- **Persistence**: sessionStorage for refresh (don't persist passwords or card data); server-side drafts for long forms.
- **Accessibility**: move focus to the step heading on step change, announce "Step 2 of 3".

## Optimising complex forms

- **Isolate re-renders**: field-level subscriptions (React Hook Form, Final Form) instead of one big `values` object at the top re-rendering 200 fields per keystroke.
- **Uncontrolled inputs** where possible.
- **Memoise field components** and give them stable props.
- **Debounce** expensive validation and async checks; validate on blur.
- **Split** long forms into sections/steps; lazy-render collapsed sections.
- **Virtualise** huge repeating field arrays.
- **Avoid deriving heavy data on every keystroke**; use `useDeferredValue` for previews.

:::question
difficulty: easy
companies: Accenture, Groww
### What is the difference between controlled and uncontrolled components?
In a **controlled** component the form value lives in React state and the input is driven by `value` + `onChange`; React is the single source of truth, enabling instant validation, formatting and conditional UI. In an **uncontrolled** component the DOM keeps the value; you set an initial `defaultValue` and read the current value through a ref or `FormData` when needed. Controlled = more control and re-renders per keystroke; uncontrolled = less code and better performance for large or simple forms. File inputs are always uncontrolled.
:::

:::question
difficulty: medium
companies: Accenture
### How do you handle forms and manage form state efficiently in React?
Choose controlled inputs where the UI reacts to every change and uncontrolled ones (refs/`FormData`) otherwise. For non-trivial forms use React Hook Form (uncontrolled, field-level subscriptions → minimal re-renders) with a schema validator like Zod shared with the backend. Validate on blur/submit then on change after touch, show accessible errors, disable double submits, keep server validation, and handle dynamic field arrays with stable ids. Keep derived values computed, not stored.
:::

:::question
difficulty: medium
### How do you add/remove inputs dynamically and what's your validation strategy?
Keep an array of field objects with stable unique ids in state; add with `[...prev, newField]`, remove with `filter`, update with `map` — and use the id as `key` so removing a row doesn't shift values to other rows. Buttons inside the form get `type="button"`. Validate each row with a schema (e.g. Zod array schema), show errors per row, and validate the whole array on submit. With React Hook Form, `useFieldArray` handles registration and performance.
:::

:::challenge
difficulty: hard
### Multi-step form with global state
Build a 3-step signup (Account → Profile → Review) where data persists across steps and refreshes, each step validates before continuing, Back keeps entered data, and Review submits everything once. Describe architecture and write the key code.
@@@solution
Architecture:
- `useReducer` at the wizard root holding `{ step, maxReached, data }`, exposed through context so any step can read data (e.g. Review).
- Each step owns **local draft state** initialised from `data`, validates with its own schema on Next, then dispatches `update` + `next`.
- Persist reducer state to `sessionStorage` (excluding passwords).
- Final submit on Review validates the combined schema and calls the API, disabling the button while submitting.

```jsx
function AccountStep({ defaultValues, onNext }) {
  const [form, setForm] = useState({ email: defaultValues.email ?? '', password: '' })
  const [errors, setErrors] = useState({})
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const errs = onNext(form) // returns field errors or undefined
      if (errs) setErrors(errs)
    }}>
      <h2 tabIndex={-1} ref={el => el?.focus()}>Step 1 of 3: Account</h2>
      <label>Email <input type="email" value={form.email}
        aria-invalid={!!errors.email} aria-describedby="email-err"
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
      {errors.email && <p id="email-err" role="alert">{errors.email[0]}</p>}
      <label>Password <input type="password" value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></label>
      <button>Next</button>
    </form>
  )
}

function ReviewStep({ onBack }) {
  const { state } = useContext(WizardContext)
  const [submitting, setSubmitting] = useState(false)
  async function submit() {
    setSubmitting(true)
    try { await api.signup(state.data); sessionStorage.removeItem('wizard') }
    finally { setSubmitting(false) }
  }
  return (
    <section>
      <h2>Review</h2>
      <dl>{Object.entries(state.data).filter(([k]) => k !== 'password')
        .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>
      <button onClick={onBack}>Back</button>
      <button onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Create account'}</button>
    </section>
  )
}
```
Plus the `Wizard` reducer from the lesson (with `maxReached = Math.max(maxReached, step + 1)` on next). Follow-ups: URL-synced steps, server-side drafts, analytics on drop-off per step, not persisting sensitive fields.
:::

:::quiz
### Why use a stable id instead of the index as key for dynamic form rows?
- [ ] Index keys are slower to compute
- [x] Removing a middle row would shift DOM inputs/state to the wrong rows
- [ ] React doesn't allow numeric keys
@@@explain
Keys tie component and DOM state to data identity.
:::

:::quiz
### React Hook Form is fast mainly because…
- [ ] It uses Web Workers
- [x] It relies on uncontrolled inputs and field-level subscriptions
- [ ] It skips validation
@@@explain
Typing doesn't re-render the whole form, only subscribers of the changed field.
:::
