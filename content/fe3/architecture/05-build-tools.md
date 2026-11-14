---
title: Build Tools — Webpack vs Vite, Babel, Polyfills and Source Maps
summary: What bundlers actually do, how Webpack and Vite differ in dev and production, transpilation vs polyfills, tree shaking, code splitting, source maps and environment builds.
minutes: 20
---

## Why we need build tools at all

Browsers can run modern JS and ES modules natively, so why bundle? Because production apps need:

- **Fewer, smaller requests** — thousands of modules → a few optimised chunks.
- **Dependency resolution** — `import React from 'react'` (bare specifiers) resolved from `node_modules`.
- **Transforms** — TypeScript, JSX, CSS Modules, Sass, PostCSS, image imports.
- **Optimisation** — minification, tree shaking, code splitting, content hashing for caching.
- **Compatibility** — transpile syntax and add polyfills for target browsers.
- **DX** — dev server, hot module replacement (HMR), error overlays.

## How Webpack works

Webpack is a **bundle-first** tool, in dev and prod:

```text
entry ──▶ build dependency graph (resolve every import)
        ──▶ run loaders on each module (babel-loader, css-loader, ts-loader…)
        ──▶ plugins hook into the compilation (HtmlWebpackPlugin, MiniCssExtract, DefinePlugin)
        ──▶ chunking (splitChunks), tree shaking, minification (Terser)
        ──▶ emit bundles with a small runtime that loads modules/chunks
```

- **Loaders** transform files; **plugins** hook into the whole compilation lifecycle.
- In **dev**, webpack-dev-server still builds the whole graph into in-memory bundles before serving; HMR rebuilds affected modules but startup time grows with app size (minutes on big apps).
- Extremely configurable and mature: Module Federation, every edge case has a plugin.

## How Vite works

Vite splits dev and prod:

**Dev — unbundled native ESM**
```text
browser requests /src/main.tsx
  └─▶ Vite transforms just that file (esbuild: TS/JSX → JS, very fast) and serves it as an ES module
      browser parses imports → requests /src/App.tsx → transformed on demand …
node_modules dependencies are pre-bundled once with esbuild (CJS → ESM, many files → one)
```
- Server starts instantly (no full bundle); only the modules the current page imports are transformed.
- HMR is precise and fast regardless of app size because it invalidates a module and its importers over native ESM.

**Prod — bundled with Rollup** (and increasingly **Rolldown**, a Rust-based Rollup-compatible bundler) for optimised chunks, tree shaking and CSS splitting. (Bundling is still needed in production to avoid request waterfalls of hundreds of modules.)

| | Webpack | Vite |
|---|---|---|
| Dev server startup | Bundles everything first — slow on big apps | Near-instant, on-demand transforms |
| HMR | Slows as the graph grows | Fast, near-constant |
| Prod bundler | Webpack | Rollup / Rolldown |
| Config | Powerful, verbose (loaders + plugins) | Sensible defaults, Rollup-style plugins |
| Ecosystem | Largest, very mature, Module Federation native | Large and growing; MF via plugin |
| Transpiler | Babel/SWC/esbuild via loaders | esbuild (dev), Rollup + plugins (prod), SWC for React plugin option |
| Dev/prod parity | Same pipeline | Different pipelines (rare inconsistencies) |
| Best fit | Complex legacy builds, exotic requirements | New apps, libraries, fast DX |

Other players: **Rspack** (Rust, webpack-compatible API — drop-in speedups), **Turbopack** (Next.js), **esbuild** (ultra-fast bundler/transformer), **Parcel** (zero config).

## Babel, transpilation and polyfills

- **Transpilation** rewrites **syntax** the target can't parse: optional chaining `a?.b`, class fields, JSX, TypeScript types. Done by Babel, SWC, esbuild or tsc.
- **Polyfills** add missing **runtime APIs**: `Promise.allSettled`, `Array.prototype.at`, `structuredClone`, `fetch`. Syntax can't be polyfilled; APIs can't be transpiled.

```js
// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: '> 0.5%, last 2 versions, not dead',   // or read from .browserslistrc
      useBuiltIns: 'usage',  // inject only the core-js polyfills your code uses
      corejs: 3,
      modules: false,        // keep ES modules so the bundler can tree shake
    }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
}
```

- **browserslist** is the single source of truth for targets (Babel, Autoprefixer, Vite's `build.target` via plugins).
- Shipping ES5 + full polyfills to all users bloats bundles ~20–30%. Options: modern targets only, **differential serving** (`<script type="module">` modern build + `nomodule` legacy build; `@vitejs/plugin-legacy`), or polyfill services by user agent.

Writing a polyfill correctly (feature-detect, don't overwrite native):

```js
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: function (n) {
      n = Math.trunc(n) || 0
      if (n < 0) n += this.length
      return n < 0 || n >= this.length ? undefined : this[n]
    },
    writable: true, configurable: true,   // non-enumerable like native methods
  })
}
```

## Tree shaking and code splitting (bundler view)

- **Tree shaking** relies on static ESM `import`/`export`, side-effect information (`"sideEffects": false` in package.json), and minifiers removing unused code. CommonJS defeats it.
- **Code splitting** happens at dynamic `import()` boundaries; bundlers also extract shared vendor chunks (`splitChunks` in webpack, `manualChunks` in Rollup).
- **Content hashing** (`[name].[contenthash].js`) enables immutable caching.
- **Minification** (Terser/esbuild/SWC): rename identifiers, drop dead branches like `if (process.env.NODE_ENV !== 'production')`.

## Source maps

Source maps map minified/transpiled code back to original files and lines, so stack traces and debuggers show `OrderTable.tsx:42` instead of `main.8f3a.js:1:48213`.

| `devtool` / option | Use |
|---|---|
| `eval-cheap-module-source-map` | Fast dev rebuilds |
| `source-map` (separate `.map` files) | Production, upload to Sentry |
| `hidden-source-map` | Generate maps but don't reference them in bundles (no public exposure) |
| none | Smallest output, worst debugging |

Production practice: generate full maps, **upload them to your error tracker** in CI, and don't serve them publicly (or accept that your source is visible).

## Environment variables and builds

- Bundlers replace `import.meta.env.VITE_X` / `process.env.REACT_APP_X` **at build time** — the value is baked into the bundle. Only prefixed vars are exposed (and they are public!).
- `.env`, `.env.development`, `.env.production`, `.env.local` (git-ignored) layering.
- **Build once, deploy many**: if the same artifact must go to staging and prod, load runtime config (`/config.json` or injected `window.__CONFIG__` from the server) instead of baking environment-specific values.
- Dev builds keep warnings, unminified React with dev checks and fast source maps; production builds strip them (`NODE_ENV=production`).

:::question
difficulty: medium
companies: Impact Analytics
### Vite vs Webpack — differences, how they work and trade-offs?
Webpack bundles the entire dependency graph (loaders transform modules, plugins hook into compilation) in both dev and prod, so dev server startup and HMR slow down as the app grows; it's extremely configurable and mature (native Module Federation). Vite serves source as **native ES modules** in dev, transforming files on demand with esbuild and pre-bundling dependencies, so startup is near-instant and HMR stays fast; for production it bundles with Rollup/Rolldown for optimised chunks. Trade-offs: Vite has simpler config and much better DX for most apps; Webpack (or Rspack) remains strong for complex legacy setups, exotic loaders and deep Module Federation use; Vite's dev/prod pipelines differ slightly, which occasionally causes environment-specific bugs.
:::

:::question
difficulty: medium
companies: Razorpay
### What do Babel and polyfills do, and how are they different?
Babel is a compiler that **transforms syntax** — JSX, TypeScript, modern syntax like optional chaining or class fields — into syntax older targets understand. Polyfills **implement missing APIs at runtime** (e.g. `Promise.allSettled`, `Array.prototype.flat`) by feature-detecting and defining them. Babel's `preset-env` with `useBuiltIns: 'usage'` and core-js can inject only the polyfills your code needs for your browserslist targets. Syntax can't be polyfilled and APIs can't be transpiled — you often need both.
:::

:::question
difficulty: easy
companies: Razorpay
### What is Webpack and why do we use it?
A module bundler: starting from entry points it builds a dependency graph of every module (JS, CSS, images) using loaders to transform files and plugins to customise the build, then outputs optimised bundles — minified, tree-shaken, code-split into chunks with content hashes for caching — plus a dev server with HMR. It lets us write modular code with npm packages, TypeScript/JSX and CSS imports, and ship efficient assets to browsers.
:::

:::question
difficulty: medium
### What are source maps and how should you handle them in production?
Files (`.map`) that map positions in generated code back to the original sources, enabling readable stack traces and debugging. In production, generate them as separate files, upload them to the error-monitoring service (Sentry) during CI tagged with the release, and either don't deploy them publicly or use hidden source maps so bundles don't reference them — this keeps debugging power without exposing the original source to everyone.
:::

:::challenge
difficulty: medium
### Diagnose this build setup
A team's app ships 1.1 MB of JS. Their config: `@babel/preset-env` with `targets: "ie 11"`, `useBuiltIns: "entry"` and `import 'core-js'` at the top of `main.js`; `modules: "commonjs"`; `devtool: 'eval-source-map'` in production; and `.env.production` containing `REACT_APP_ANALYTICS_SECRET`. What's wrong and what would you change?
@@@solution
1. **IE 11 target** forces ES5 output (bigger, slower code: classes, async/await, spread transpiled with helpers). Use a modern browserslist (`> 0.5%, last 2 versions, not dead`) or differential serving.
2. **`useBuiltIns: "entry"` with `import 'core-js'`** includes *all* polyfills needed for the targets (hundreds of KB). Switch to `"usage"` to inject only what the code uses.
3. **`modules: "commonjs"`** converts ESM to CommonJS before webpack sees it — **tree shaking is disabled**. Use `modules: false`.
4. **`eval-source-map` in production** inlines source + maps into eval'd strings: huge bundles, slower execution and exposed source. Use `source-map`/`hidden-source-map` and upload to Sentry.
5. **Secret in `REACT_APP_` env** is baked into the public bundle — move it server-side, rotate the leaked key.
Expected: modern targets + usage polyfills + tree shaking typically cut 30–50% of JS.
:::

:::quiz
### Why is Vite's dev server fast to start even for large apps?
- [ ] It skips TypeScript
- [x] It serves source files as native ES modules and transforms them on demand
- [ ] It caches bundles in the cloud
- [ ] It uses Webpack under the hood
@@@explain
Only requested modules are transformed; dependencies are pre-bundled once with esbuild.
:::

:::quiz
### Which can be polyfilled?
- [ ] Optional chaining syntax
- [ ] Arrow functions
- [x] Promise.allSettled
- [ ] JSX
@@@explain
Runtime APIs can be polyfilled; syntax must be transpiled.
:::
