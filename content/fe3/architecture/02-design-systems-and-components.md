---
title: Design Systems and Reusable Component APIs
summary: Component-driven architecture, designing a Button with variants and sizes, designing a reusable Select, composition patterns, and choosing a styling approach (CSS Modules, CSS-in-JS, Tailwind).
minutes: 24
---

## Component-driven architecture

**Component-driven development** builds UIs bottom-up from isolated, reusable components — atoms (Button, Input) → molecules (SearchField) → organisms (Header, DataTable) → templates → pages. A **design system** is the shared, versioned product made of:

- **Design tokens** (colour, spacing, typography, radii, motion) — the single source of truth for both Figma and code.
- **Components** with documented APIs, states and accessibility behaviour.
- **Guidelines** (when to use what, content style, patterns).
- **Tooling**: Storybook for docs and visual testing, Chromatic/Playwright for visual regression, versioned npm package.

Why companies invest: consistency, speed (teams stop rebuilding dropdowns), accessibility and performance fixed once, and a shared language between designers and engineers.

## Principles of a good component API

1. **Familiar** — mirror native HTML props (`disabled`, `type`, `onChange`, `value`), forward `ref`, spread remaining props onto the root element.
2. **Constrained** — variants via enums (`variant="primary" | "secondary" | "ghost" | "danger"`) instead of arbitrary colours.
3. **Composable** — accept `children`, slots (`leftIcon`), and compound components for complex widgets.
4. **Controlled and uncontrolled** — support `value`/`onChange` *and* `defaultValue`.
5. **Accessible by default** — correct semantics, keyboard support, focus styles, ARIA wiring hidden from consumers.
6. **Escape hatches** — `className`/`style` merge, `asChild`/polymorphic `as` prop, but no "styles override everything" chaos.
7. **Stable** — semver, deprecation warnings, codemods for breaking changes.

## Challenge-style walkthrough: a Button with variants and sizes (like MUI)

```tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import styles from './Button.module.css'
import { Spinner } from '../Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth, leftIcon, rightIcon,
    disabled, className, children, type = 'button', ...rest },
  ref
) {
  const cls = [styles.btn, styles[variant], styles[size], fullWidth && styles.full, className]
    .filter(Boolean).join(' ')
  return (
    <button
      ref={ref}
      type={type}                                  // avoid accidental form submits
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner aria-hidden="true" className={styles.spinner} /> : leftIcon}
      <span className={styles.label}>{children}</span>
      {!loading && rightIcon}
    </button>
  )
})
```

```css
/* Button.module.css — tokens via CSS variables, so theming is free */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:.5rem;
  font-weight:600; border-radius:var(--radius-md); border:1px solid transparent;
  cursor:pointer; transition:background-color .15s, box-shadow .15s; }
.btn:focus-visible { outline:3px solid var(--color-focus); outline-offset:2px; }
.btn:disabled { opacity:.55; cursor:not-allowed; }
.sm { height:2rem;  padding:0 .75rem; font-size:.875rem; }
.md { height:2.5rem; padding:0 1rem;   font-size:1rem; }
.lg { height:3rem;  padding:0 1.25rem; font-size:1.125rem; }
.primary   { background:var(--color-primary); color:var(--color-on-primary); }
.primary:hover:not(:disabled) { background:var(--color-primary-hover); }
.secondary { background:transparent; color:var(--color-primary); border-color:var(--color-primary); }
.ghost     { background:transparent; color:var(--color-text); }
.ghost:hover:not(:disabled) { background:var(--color-surface-hover); }
.danger    { background:var(--color-danger); color:white; }
.full { width:100%; }
```

Discussion points: icon-only buttons require `aria-label` (enforce via TypeScript overloads), links styled as buttons (polymorphic `as="a"` or `asChild`), loading state keeps width stable, minimum target size 24–44 px, and variants map to tokens so themes/brands just swap variables. Libraries like `cva` (class-variance-authority) formalise variant → class mapping.

## Designing a reusable Select (system-design style)

Impact Analytics asked "Design a reusable Select component"; CRED asked to build a multi-select from scratch. Approach it like a mini system design:

### 1. Requirements
- Single and multi select; searchable (combobox) option; async options; grouped options; disabled options; custom option rendering; clearable; placeholder; form integration (name, required, validation states); controlled & uncontrolled; RTL; mobile-friendly; virtualization for 10k options; accessible (WAI-ARIA combobox/listbox patterns).

### 2. API options

**Config API** (simple, less flexible):
```tsx
<Select
  label="Country"
  options={countries}               // { value, label, disabled?, group? }[]
  value={country}
  onChange={setCountry}
  searchable
  multiple={false}
  renderOption={(o) => <Flag code={o.value} />}
/>
```

**Compound components** (flexible composition):
```tsx
<Select value={country} onValueChange={setCountry}>
  <Select.Label>Country</Select.Label>
  <Select.Trigger placeholder="Choose a country" />
  <Select.Content>
    <Select.Group label="Asia">
      <Select.Option value="in">India</Select.Option>
      <Select.Option value="sg">Singapore</Select.Option>
    </Select.Group>
  </Select.Content>
</Select>
```

Compound components share state through context; this is how Radix, Headless UI and Reach UI work. Many design systems offer both: a headless core (`useSelect` hook with state machine + ARIA props, à la Downshift) and styled wrappers.

### 3. Architecture

```text
useSelect (headless hook)
  ├─ state machine: closed → open → (navigating, typing) → selecting → closed
  ├─ controlled/uncontrolled value (useControllableState)
  ├─ keyboard handling, type-ahead, active descendant
  ├─ returns prop getters: getTriggerProps(), getListboxProps(), getOptionProps(i)
  └─ async source: debounced query, abort stale requests, loading/empty/error states
Styled layer
  ├─ Trigger, Popover (portal + Floating UI positioning, flip/shift, collision)
  ├─ Listbox (virtualized when > ~100 options)
  └─ Option renderer, chips for multi
```

### 4. Controlled vs uncontrolled helper

```ts
function useControllableState<T>({ value, defaultValue, onChange }: {
  value?: T; defaultValue: T; onChange?: (v: T) => void
}) {
  const [internal, setInternal] = useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : internal
  const setValue = useCallback((next: T) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }, [isControlled, onChange])
  return [current, setValue] as const
}
```

### 5. Non-functional concerns
Accessibility (combobox pattern, `aria-expanded`, `aria-activedescendant`, announcements of result counts), performance (virtualization, memoised options, debounced search), mobile (native `<select>` fallback is often the best UX), i18n/RTL, theming via tokens, testing (RTL role queries, keyboard tests, visual regression), documentation (Storybook with all states), and versioning.

## Styling approaches

| Approach | Pros | Cons | Fits |
|---|---|---|---|
| **CSS Modules** | Real CSS, scoped class names, zero runtime, works with SSR/RSC | Variant logic in JS class maps, no dynamic styles without CSS vars | Design systems, most apps |
| **Runtime CSS-in-JS** (styled-components, Emotion) | Co-location, props-driven styles, theming | Runtime cost (style serialisation/injection), bigger bundles, friction with React Server Components and streaming | Legacy apps; declining for new ones |
| **Zero-runtime CSS-in-JS** (vanilla-extract, Linaria, Panda) | Type-safe styles, extracted to static CSS | Build setup | TS-heavy design systems |
| **Utility-first** (Tailwind) | Fast iteration, tiny CSS (only used classes), consistent tokens, no naming | Verbose markup, needs `cva`/components to avoid duplication | Product teams, rapid UI |
| **Plain CSS / BEM** | No tooling | Global namespace, discipline-dependent | Small sites |

Whatever you choose, put **tokens in CSS variables** so themes and brands don't require re-rendering.

:::question
difficulty: medium
companies: Tekion
### How would you create a reusable Button component with variants and sizes (like MUI)?
Extend native button props (`ButtonHTMLAttributes`), `forwardRef`, spread the rest onto `<button>`, and default `type="button"`. Expose constrained enums `variant` (primary/secondary/ghost/danger) and `size` (sm/md/lg) mapped to classes that use design tokens (CSS variables), plus `loading` (disables, shows spinner, `aria-busy`, keeps width), `fullWidth`, `leftIcon`/`rightIcon`, and `className` merging. Ensure focus-visible styles, sufficient contrast per variant, minimum target size, and require `aria-label` for icon-only usage. Support rendering as a link via `as`/`asChild`. Document every state in Storybook and cover with visual regression tests.
:::

:::question
difficulty: hard
companies: Impact Analytics
### Design a reusable Select component — what decisions matter?
Requirements (single/multi, searchable, async, grouped, custom rendering, forms), API style (config props vs compound components vs headless hook — often a headless core plus styled wrappers), state model (controlled/uncontrolled via `useControllableState`, a small state machine for open/navigation/typing), accessibility (WAI-ARIA listbox/combobox patterns, keyboard, focus, live announcements), positioning (portal + collision-aware popover), performance (virtualization, debounced async search with request cancellation), mobile fallback to native select, theming via tokens, testing and documentation, and versioning/deprecation for consumers.
:::

:::question
difficulty: medium
### styled-components vs CSS Modules vs Tailwind — how do you choose?
Consider runtime cost, SSR/RSC compatibility, team skills and design-system needs. CSS Modules: zero runtime, real CSS, scoped — a safe default. Runtime CSS-in-JS: great DX and dynamic props but adds runtime work and fights React Server Components/streaming — avoid for new performance-critical apps or move to zero-runtime alternatives. Tailwind: fastest iteration with tokens baked in and tiny CSS output, best paired with component abstractions (`cva`) to avoid repeated class soup. In all cases, put theme values in CSS variables.
:::

:::question
difficulty: medium
### What are compound components and why do design systems use them?
A set of components that work together and share implicit state via context, e.g. `<Tabs><Tabs.List><Tabs.Trigger/></Tabs.List><Tabs.Panel/></Tabs>`. They let consumers compose structure and markup freely (reorder, wrap, add custom elements) without an explosion of configuration props, while the parent manages state and accessibility wiring (IDs, ARIA relationships, keyboard). Radix, Headless UI and Reach UI use this pattern.
:::

:::challenge
difficulty: medium
companies: Tekion
### Build a React list with collapse/expand
Render a nested list (`{ id, label, children? }[]`) where each item with children can be expanded/collapsed. Support "Expand all"/"Collapse all", keep it accessible, and make expansion state survive re-fetching the data.
@@@solution
```jsx
import { useState, useCallback } from 'react'

export function CollapsibleList({ items }) {
  const [expanded, setExpanded] = useState(() => new Set())   // keyed by id → survives refetch

  const toggle = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const allIds = collectIds(items)
  return (
    <div>
      <div className="toolbar">
        <button type="button" onClick={() => setExpanded(new Set(allIds))}>Expand all</button>
        <button type="button" onClick={() => setExpanded(new Set())}>Collapse all</button>
      </div>
      <Tree items={items} expanded={expanded} onToggle={toggle} />
    </div>
  )
}

function Tree({ items, expanded, onToggle }) {
  return (
    <ul>
      {items.map(item => {
        const hasChildren = item.children?.length > 0
        const isOpen = expanded.has(item.id)
        return (
          <li key={item.id}>
            {hasChildren ? (
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`group-${item.id}`}
                onClick={() => onToggle(item.id)}
                className="row"
              >
                <span aria-hidden="true" className={isOpen ? 'chev open' : 'chev'}>▸</span>
                {item.label}
              </button>
            ) : (
              <span className="row leaf">{item.label}</span>
            )}
            {hasChildren && (
              <div id={`group-${item.id}`} hidden={!isOpen}>
                {isOpen && <Tree items={item.children} expanded={expanded} onToggle={onToggle} />}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function collectIds(items, acc = []) {
  for (const i of items) if (i.children?.length) { acc.push(i.id); collectIds(i.children, acc) }
  return acc
}
```
```css
.chev { display:inline-block; transition: transform .15s; }
.chev.open { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
```
**Talking points**: state keyed by stable IDs (not indexes) so refetches don't reset it; children rendered lazily only when open (performance for huge trees); `aria-expanded` + `aria-controls` disclosure pattern; for a full tree widget with arrow-key navigation use `role="tree"`/`treeitem` with roving tabindex; persist expansion in URL or storage if needed; virtualize flattened visible nodes for 10k+ items.
:::

:::quiz
### Why should a design-system Button default to `type="button"`?
- [ ] It improves styling
- [x] Inside a form, the default type is submit, causing accidental submissions
- [ ] It's required for accessibility
- [ ] It enables keyboard support
@@@explain
A <button> without type inside a form submits it.
:::

:::quiz
### Which styling approach has notable friction with React Server Components?
- [ ] CSS Modules
- [ ] Tailwind
- [x] Runtime CSS-in-JS (e.g. styled-components with context-based theming)
- [ ] Plain CSS
@@@explain
Runtime CSS-in-JS relies on client-side context and style injection at render time.
:::
