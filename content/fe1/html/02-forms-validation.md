---
title: Forms, Inputs, Validation & Submission
summary: Build forms that work with and without JavaScript — labels, input types, native validation, the Constraint Validation API and FormData.
minutes: 17
---

## Forms are the web's original app

Before React, a `<form>` could already collect data, validate it, and send it to a server — with zero JavaScript. Understanding native form behaviour makes your JS-powered forms simpler and more accessible.

```html
<form action="/signup" method="post">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required autocomplete="email" />

  <label for="pw">Password</label>
  <input id="pw" name="password" type="password" minlength="8" required
         autocomplete="new-password" aria-describedby="pw-hint" />
  <p id="pw-hint">At least 8 characters.</p>

  <button>Create account</button>
</form>
```

When submitted, the browser:

1. Runs **validation** on every field (`required`, `type`, `minlength`, `pattern`…). If any fail, it shows a message and stops.
2. Collects every field that has a **`name`** into key/value pairs (fields without `name` are ignored!).
3. Sends them using `method` (`get` → query string, `post` → body as `application/x-www-form-urlencoded`, or `multipart/form-data` for files with `enctype`) to `action`.
4. Navigates to the response.

## Labels: the most important accessibility feature of forms

Every input needs an accessible name. The best way is a `<label>`:

```html
<!-- explicit -->
<label for="city">City</label>
<input id="city" name="city" />

<!-- implicit (wrapping) -->
<label>City <input name="city" /></label>
```

A label: is read by screen readers when the input is focused, and **enlarges the click target** (clicking the label focuses the input / toggles the checkbox). A `placeholder` is **not** a label — it disappears when typing, often has poor contrast, and isn't reliably announced.

Group related controls (radio buttons!) with `<fieldset>` + `<legend>`:

```html
<fieldset>
  <legend>Delivery speed</legend>
  <label><input type="radio" name="speed" value="std" checked /> Standard</label>
  <label><input type="radio" name="speed" value="exp" /> Express</label>
</fieldset>
```

Radios with the same `name` form one group: only one can be selected, and arrow keys move between them.

## Input types

The `type` attribute gives you validation, the right mobile keyboard, and built-in pickers:

| type | What you get |
|---|---|
| `text` | Plain text |
| `email` | Validates `x@y` format; `@` keyboard on mobile |
| `tel` | Phone keypad (no validation — formats vary) |
| `url` | Validates URL |
| `number` | Spinner, numeric keyboard, `min`/`max`/`step` (avoid for card numbers/OTPs — use `inputmode="numeric"` on a text input) |
| `password` | Masked |
| `date`, `time`, `datetime-local`, `month` | Native pickers |
| `checkbox`, `radio` | Toggles |
| `range` | Slider |
| `file` | File picker (`accept="image/*"`, `multiple`) |
| `search` | Clear button on some platforms |
| `color` | Colour picker |
| `hidden` | Sent with the form, not shown |

Other helpful attributes: `autocomplete` (`email`, `name`, `one-time-code`, `current-password`, `new-password`, `cc-number`…) lets browsers and password managers autofill correctly; `inputmode` picks the virtual keyboard; `enterkeyhint` labels the Enter key.

## Native validation

Constraint attributes:

| Attribute | Rule |
|---|---|
| `required` | Must not be empty |
| `minlength` / `maxlength` | String length |
| `min` / `max` / `step` | Numbers and dates |
| `pattern` | Regex the **whole** value must match, e.g. `pattern="[0-9]{6}"` for a PIN code |
| `type` | email/url format |

CSS can style validity: `input:invalid`, `input:valid`, `:user-invalid` (only after the user interacted — avoids yelling red before typing), `:required`, `:placeholder-shown`.

```css
input:user-invalid { border-color: crimson; }
```

### The Constraint Validation API

```js
const email = document.querySelector('#email')
email.validity.valueMissing   // true if required and empty
email.validity.typeMismatch   // true if not an email
email.validationMessage       // browser's localized message
email.checkValidity()         // boolean, fires 'invalid' event
email.reportValidity()        // boolean + shows the bubble
email.setCustomValidity('That email is already taken') // '' to clear
```

Use `novalidate` on the form when you want to render your own error UI but still use the API:

```js
form.addEventListener('submit', (e) => {
  if (!form.checkValidity()) {
    e.preventDefault()
    showErrors(form) // read each field's validity / validationMessage
  }
})
```

:::callout warn Client-side validation is UX, not security
Anyone can bypass browser validation (DevTools, curl). The server **must** validate everything again. Client validation exists to give fast, friendly feedback.
:::

## Submitting with JavaScript

```js
const form = document.querySelector('form')
form.addEventListener('submit', async (e) => {
  e.preventDefault()                    // stop page navigation
  const data = new FormData(form)       // reads all named fields (files too)
  const body = Object.fromEntries(data) // { email: '...', password: '...' }

  const btn = form.querySelector('button')
  btn.disabled = true                   // prevent double submit
  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
  } finally {
    btn.disabled = false
  }
})
```

Listen to the form's **`submit`** event, not the button's `click` — `submit` also fires when the user presses Enter in a field. Uploading files: pass the `FormData` directly as `body` (don't set `Content-Type`; the browser adds the multipart boundary).

## Accessible error messages

```html
<label for="pin">PIN code</label>
<input id="pin" name="pin" inputmode="numeric" pattern="[0-9]{6}"
       aria-invalid="true" aria-describedby="pin-err" />
<p id="pin-err" role="alert">PIN code must be 6 digits.</p>
```

- `aria-invalid="true"` tells screen readers the field is invalid.
- `aria-describedby` links the message so it's read with the field.
- Don't rely on red colour alone — use text and/or an icon.
- On submit failure, move focus to the first invalid field (or an error summary).

:::question
difficulty: easy
### Why must form inputs have a `name` attribute?
Only controls with a `name` are included in the form submission data (and in `new FormData(form)`). The `id` is for labels and scripting; the `name` is the key sent to the server. Radio buttons also use `name` to form a mutually-exclusive group.
:::

:::question
difficulty: easy
### Why isn't a placeholder a substitute for a label?
It disappears once the user types, so they lose context (bad for memory/cognitive load); it often has low contrast; screen-reader support is inconsistent; and it doesn't enlarge the click target. Use a visible `<label>`, and use placeholders only for format hints (e.g. "DD/MM/YYYY") if at all.
:::

:::question
difficulty: medium
### How does HTML5 form validation work, and when would you add custom validation?
Browsers check constraint attributes (`required`, `type`, `min/max`, `minlength/maxlength`, `pattern`, `step`) on submit; invalid fields block submission and show a native message; CSS pseudo-classes (`:invalid`, `:user-invalid`) style them; JS can inspect `element.validity` and call `checkValidity()`/`reportValidity()`/`setCustomValidity()`.

Add custom validation for: cross-field rules (password confirmation, date ranges), async checks (username taken), consistent branded error UI (use `novalidate` + the Constraint API), and complex formats. Always re-validate on the server.
:::

:::question
difficulty: medium
### What's the difference between `GET` and `POST` form submissions?
`method="get"` appends fields to the URL as a query string — good for search/filter forms (shareable, bookmarkable, cacheable), bad for sensitive or large data. `method="post"` sends fields in the body — use for creating/changing data, passwords, and files (with `enctype="multipart/form-data"`).
:::

:::challenge
difficulty: medium
### Validate a signup form object
Write `validateSignup({ email, password, confirm, age })` that returns an object of field → error message for invalid fields (empty object when valid):
- `email` required and must match `something@something.something`
- `password` at least 8 characters, containing a number
- `confirm` must equal password
- `age` must be a number ≥ 18
Messages: `'Email is required'`, `'Email is invalid'`, `'Password must be 8+ chars with a number'`, `'Passwords do not match'`, `'You must be 18+'`.
@@@starter
```js
function validateSignup({ email, password, confirm, age }) {
  const errors = {}
  // your code
  return errors
}
```
@@@tests
```js
test('valid', () => {
  expect(validateSignup({ email: 'a@b.co', password: 'secret12', confirm: 'secret12', age: 20 })).toEqual({})
})
test('all invalid', () => {
  expect(validateSignup({ email: 'nope', password: 'short', confirm: 'x', age: 12 })).toEqual({
    email: 'Email is invalid', password: 'Password must be 8+ chars with a number',
    confirm: 'Passwords do not match', age: 'You must be 18+',
  })
})
test('missing email', () => {
  expect(validateSignup({ email: '', password: 'secret12', confirm: 'secret12', age: 30 }).email).toBe('Email is required')
})
```
@@@solution
```js
function validateSignup({ email, password, confirm, age }) {
  const errors = {}
  if (!email) errors.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email is invalid'

  if (!password || password.length < 8 || !/\d/.test(password))
    errors.password = 'Password must be 8+ chars with a number'

  if (confirm !== password) errors.confirm = 'Passwords do not match'

  if (typeof age !== 'number' || Number.isNaN(age) || age < 18) errors.age = 'You must be 18+'
  return errors
}
```
Returning a **map of field → message** (rather than throwing on the first error) lets the UI show all errors at once and bind each one to its field via `aria-describedby`. The same pure function can run on input blur, on submit, and in unit tests — and libraries like Zod/Yup are just more powerful versions of this idea.
:::

:::quiz
### Which event should you listen to for form submission?
- [ ] `click` on the submit button
- [x] `submit` on the form
- [ ] `change` on each input
@@@explain
`submit` also fires on Enter key presses and programmatic `requestSubmit()`.
:::

:::quiz
### Which input setup is best for a 6-digit OTP on mobile?
- [ ] `type="number"`
- [x] `type="text" inputmode="numeric" autocomplete="one-time-code"`
- [ ] `type="password"`
@@@explain
`type=number` strips leading zeros and adds spinners; `inputmode` gives a numeric keypad, and `one-time-code` enables SMS autofill.
:::
