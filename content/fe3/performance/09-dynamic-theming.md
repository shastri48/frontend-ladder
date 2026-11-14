---
title: Dynamic Theming Without Performance Problems
summary: Implementing light/dark and brand themes in large apps with CSS custom properties, no flash of the wrong theme, and no app-wide re-renders.
minutes: 14
---

## The question

> "How would you implement dynamic theming (light/dark mode) in a large web application without performance issues?" — Walmart, round 2

The trap answer: "Put `theme` in React Context and read colours in every component." Toggling the theme then re-renders **every** themed component — thousands of them — and CSS-in-JS libraries regenerate and re-inject styles at runtime. On a big app this is a 300–800 ms long task.

The senior answer: **themes are a CSS concern.** Let the browser's style engine swap values; React shouldn't re-render at all.

:::callout analogy Changing the lighting, not repainting the walls
A theatre changes mood by switching the stage lights (one switch, everything updates) — not by repainting every prop. CSS variables are the lighting rig.
:::

## Design tokens → CSS custom properties

Define **semantic tokens** (what a colour is *for*) instead of raw values in components:

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f6f7f9;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-primary: #4f46e5;
  --color-border: #e5e7eb;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.06);
  color-scheme: light;
}

[data-theme='dark'] {
  --color-bg: #0b0f19;
  --color-surface: #111827;
  --color-text: #f3f4f6;
  --color-text-muted: #9ca3af;
  --color-primary: #818cf8;
  --color-border: #1f2937;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.6);
  color-scheme: dark;     /* native scrollbars, form controls, canvas colours */
}

.card {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}
```

Switching themes is now **one attribute change** on `<html>`:

```js
document.documentElement.dataset.theme = 'dark'
```

The browser recalculates styles (one style recalc + repaint) — no JavaScript re-render, no new stylesheets. Components never import the theme.

Layers of tokens scale to large orgs: **primitive** tokens (`--blue-500`) → **semantic** tokens (`--color-primary`) → optional **component** tokens (`--button-bg`). Multi-brand (white-label) apps swap the semantic layer per brand.

## Respect the system preference

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { /* dark tokens */ }
}
```

Three states: `light`, `dark`, `system`. Store the explicit choice; default to system.

```js
const mq = window.matchMedia('(prefers-color-scheme: dark)')
mq.addEventListener('change', () => { if (getPref() === 'system') applyTheme() })
```

## Kill the flash of the wrong theme (FOUC)

If you read the preference in React after hydration, users with dark mode see a white flash first. Run a tiny **blocking inline script in `<head>`** before any paint:

```html
<script>
  (function () {
    try {
      var pref = localStorage.getItem('theme') || 'system';
      var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    } catch (e) {}
  })();
</script>
```

It's < 300 bytes and runs before first paint, so the first frame is already themed. With SSR, you can also store the theme in a **cookie** and render `data-theme` on the server.

Also add `<meta name="color-scheme" content="light dark">` and `<meta name="theme-color">` for browser chrome.

## Where React fits

React still needs the *preference* for the toggle UI — but only the toggle reads it:

```jsx
function useTheme() {
  const [pref, setPref] = useState(() => localStorage.getItem('theme') || 'system')
  useEffect(() => {
    localStorage.setItem('theme', pref)
    const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [pref])
  return [pref, setPref]
}
```

If you must expose theme values to JS (canvas charts, Maps SDKs), read the computed CSS variable (`getComputedStyle(document.documentElement).getPropertyValue('--color-primary')`) in those few components, or keep a small context consumed only by them.

## Performance details

- **Avoid transitioning everything**: `* { transition: background .3s }` makes every element animate on theme switch — expensive. Temporarily disable transitions during the switch, or use the **View Transitions API** for a single cross-fade:

```js
function toggleTheme(next) {
  if (!document.startViewTransition) return apply(next)
  document.startViewTransition(() => apply(next))
}
```

- **Runtime CSS-in-JS** (styled-components/Emotion `ThemeProvider`) re-renders consumers and re-serialises styles on change; prefer CSS variables inside them (`color: var(--color-text)`) or zero-runtime solutions (vanilla-extract, Linaria, Tailwind with `dark:` + CSS variables).
- **Images & illustrations**: use `<picture>` with `media="(prefers-color-scheme: dark)"`, SVGs with `currentColor`, or CSS filters sparingly.
- **Contrast**: both themes must meet WCAG contrast ratios (4.5:1 for body text). Dark mode isn't inverted light mode — reduce pure white text, raise surfaces with lighter greys instead of shadows.

:::question
difficulty: hard
companies: Walmart
### How would you implement dynamic theming in a large web app without performance issues?
Define semantic design tokens as **CSS custom properties** on `:root` and override them under `[data-theme="dark"]` (and per brand if needed). Components use only `var(--token)`, never theme objects from React. Switching theme sets one attribute on `<html>` → the browser does a single style recalc/paint; zero React re-renders. Respect `prefers-color-scheme` with a light/dark/system preference stored in localStorage (or a cookie for SSR). Prevent the flash of the wrong theme with a tiny blocking inline script in `<head>` that sets `data-theme` before first paint. Set `color-scheme` for native controls. Avoid global transitions (use View Transitions), avoid runtime CSS-in-JS ThemeProviders that re-render the tree, and verify both themes for contrast.
:::

:::question
difficulty: medium
### Why is the "theme in React Context" approach slow in big apps?
Every component that consumes the context re-renders when the theme value changes. In a large app that's thousands of components rendering in one synchronous update, plus runtime CSS-in-JS libraries regenerating class names and injecting new style rules — a long task that hurts INP and can cause visible jank. CSS variables move the change into the style engine, which is far cheaper and requires no JS work beyond setting one attribute.
:::

:::challenge
difficulty: medium
### Fix the theme flash
A Next.js/SPA app reads `localStorage.theme` inside a `useEffect` in `<App>` and then sets `className="dark"` on `<body>`. Dark-mode users see a white flash on every load, and the toggle causes a 400 ms freeze. Explain both problems and the fix.
@@@solution
**Flash**: `useEffect` runs after the first paint (and after JS downloads/hydrates), so the first frames render with default light styles. Fix: inline blocking script in `<head>` (before CSS paints) that reads the preference/`matchMedia` and sets `document.documentElement.dataset.theme`; for SSR, persist the theme in a cookie and render the attribute server-side. Add `<meta name="color-scheme" content="light dark">`.

**Freeze**: the toggle likely updates a React context that hundreds of styled components consume, re-rendering the app and regenerating CSS-in-JS styles; possibly also `* { transition: all .3s }`. Fix: move colours to CSS variables keyed off `data-theme`, so the toggle only sets an attribute; restrict transitions or use `document.startViewTransition`; keep a theme context only for the toggle button and canvas-based components.
:::

:::quiz
### What's the cheapest way to switch an app's theme at runtime?
- [ ] Re-render all components with a new theme prop
- [x] Change a data attribute on <html> that swaps CSS custom property values
- [ ] Load a second CSS bundle and remove the first
- [ ] Reload the page
@@@explain
One attribute change triggers only a style recalc and repaint, no React work.
:::

:::quiz
### What does the CSS `color-scheme: dark` declaration do?
- [ ] Inverts all colours on the page
- [x] Tells the browser to render native UI (form controls, scrollbars, default canvas) in dark style
- [ ] Enables prefers-color-scheme queries
- [ ] Sets the text colour to white
@@@explain
It adapts UA-provided UI to the theme; your own colours still come from your CSS.
:::
