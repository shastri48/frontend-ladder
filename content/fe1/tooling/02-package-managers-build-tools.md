---
title: npm, Yarn, pnpm & Build Tools
summary: package.json, semver, lockfiles, dependencies vs devDependencies, npm vs yarn vs pnpm, and what bundlers, transpilers and polyfills actually do.
minutes: 16
---

## Why package managers exist

Modern apps depend on hundreds of open-source packages (React, date libraries, test runners). A **package manager** downloads them from a **registry** (npmjs.com), resolves their own dependencies, and records exactly what was installed so every developer and CI machine gets the same thing.

## `package.json`

```json
{
  "name": "shop-web",
  "version": "1.4.2",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "typescript": "~5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": { "node": ">=20" }
}
```

| Field | Meaning |
|---|---|
| `dependencies` | Needed at runtime by your app (shipped/bundled) |
| `devDependencies` | Only needed to develop/build/test (bundler, linters, types) |
| `peerDependencies` | For libraries: "the host app must provide this" (e.g. a React component library peers on `react`) |
| `scripts` | Commands run with `npm run <name>`; `node_modules/.bin` is on the PATH inside them |

## Semantic versioning (semver)

`MAJOR.MINOR.PATCH` — e.g. `18.3.1`.

- **MAJOR**: breaking changes
- **MINOR**: new features, backward-compatible
- **PATCH**: bug fixes

Ranges in package.json:

| Range | Allows | Example `^1.4.2` / `~1.4.2` |
|---|---|---|
| `^1.4.2` (caret, npm default) | Same major | `>=1.4.2 <2.0.0` |
| `~1.4.2` (tilde) | Same minor | `>=1.4.2 <1.5.0` |
| `1.4.2` | Exact | only 1.4.2 |
| `*` / `latest` | Anything | 😬 |

Note: for `0.x` versions, caret is stricter (`^0.3.1` → `<0.4.0`) because pre-1.0 minors may break.

## Lockfiles: the actual source of truth

Ranges mean two installs a week apart could get different versions. The **lockfile** (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) records the **exact** resolved version and integrity hash of every package in the tree.

- **Commit the lockfile** for apps.
- In CI use `npm ci` (or `pnpm install --frozen-lockfile` / `yarn install --immutable`): installs exactly what's in the lockfile, fails if it doesn't match package.json, and is faster.
- `npm install` may update the lockfile; `npm update` bumps within ranges.

## npm vs Yarn vs pnpm

| | npm | Yarn (classic v1 / Berry v2+) | pnpm |
|---|---|---|---|
| Ships with Node | ✅ | ❌ (via Corepack) | ❌ (via Corepack) |
| Lockfile | `package-lock.json` | `yarn.lock` | `pnpm-lock.yaml` |
| `node_modules` layout | Flat (hoisted) | Flat (v1) / Plug'n'Play option (v2+) | **Content-addressable store + symlinks** |
| Disk usage | Copies per project | Copies per project (v1) | Each version stored **once** globally, hard-linked |
| Strictness | Can import undeclared "phantom" deps (hoisting) | Same (v1); PnP strict | **Strict** — only declared deps resolvable |
| Workspaces / monorepos | ✅ | ✅ (historically pioneered) | ✅ (excellent, very popular) |
| Speed | Good (much improved) | Fast | Usually fastest |

History: Yarn appeared in 2016 because npm was slow and non-deterministic (no lockfile then). npm caught up (lockfiles in v5, `npm ci`, workspaces in v7). pnpm's symlinked store solved disk usage and phantom dependencies.

**In practice:** use whatever the project uses (look at the lockfile); don't mix them in one repo. `npx <pkg>` runs a package binary without installing it globally (`pnpm dlx`, `yarn dlx` are equivalents). Corepack (`corepack enable`) pins the package manager version via the `packageManager` field.

:::callout warn Supply-chain hygiene
Every dependency is code you run. Prefer well-maintained packages, review what you add, run `npm audit`, keep lockfiles committed, and be wary of `postinstall` scripts and typo-squatted names.
:::

## What build tools do

Browsers can run plain JS/CSS — so why the build step?

| Tool type | Job | Examples |
|---|---|---|
| **Transpiler / compiler** | Convert TS/JSX/modern syntax to JS browsers understand | Babel, SWC, esbuild, `tsc` |
| **Bundler** | Follow imports from the entry, combine modules into a few optimized files, code-split, handle CSS/images | Webpack, Rollup, Vite (esbuild + Rollup/Rolldown), Parcel, Turbopack, Rspack |
| **Minifier** | Remove whitespace/comments, shorten names | Terser, esbuild, SWC |
| **CSS tools** | Autoprefixer, PostCSS, Sass, Tailwind | — |
| **Dev server** | Serve files locally with **HMR** (hot module replacement) | Vite, webpack-dev-server |
| **Linters/formatters** | Catch bugs and enforce style | ESLint, Prettier, Biome, oxlint |

Key optimizations bundlers perform:

- **Tree shaking** — drop exports you never import (needs ES modules: `import`/`export`).
- **Code splitting** — dynamic `import()` creates separate chunks loaded on demand.
- **Content hashing** — `app.3f9c2a.js` filenames so files can be cached forever and changed filenames bust the cache.
- **Asset handling** — inline small images, optimize others.

### Transpiling vs polyfilling

- **Transpiling** rewrites **syntax**: `a?.b` → `a == null ? void 0 : a.b`; arrow functions → functions; JSX → `React.createElement`/`jsx()` calls.
- **Polyfilling** adds missing **APIs** at runtime: `Array.prototype.at`, `Promise.allSettled`, `structuredClone`. Syntax can't be polyfilled, and APIs can't be transpiled. Babel + `core-js` with a **Browserslist** target (`"> 0.5%, last 2 versions, not dead"`) decides what's needed.

### Vite vs Webpack (preview — FE3 goes deeper)

Webpack bundles your whole app before the dev server can serve it, so startup gets slow as apps grow. **Vite** serves source files as native ES modules during development (the browser requests modules on demand) and pre-bundles dependencies with esbuild, so dev startup is near-instant and HMR is fast regardless of app size. For production it bundles with Rollup (Rolldown in newer versions). Webpack remains extremely configurable with a huge plugin ecosystem (Module Federation for micro-frontends).

## Environment variables

Build tools inject config at **build time**: `import.meta.env.VITE_API_URL` (Vite) or `process.env.NEXT_PUBLIC_API_URL` (Next.js). Only variables with the public prefix are exposed to the browser bundle — and anything in the bundle is **public**. Never put secrets (DB passwords, private API keys) in frontend env vars; keep them on the server.

:::question
difficulty: easy
companies: Agoda
### Explain the difference between npm and yarn (and pnpm).
All three install packages from the npm registry and manage lockfiles, scripts and workspaces. npm ships with Node (`package-lock.json`, `npm ci` for CI). Yarn was created for speed and deterministic installs when npm lacked a lockfile (`yarn.lock`); Yarn 2+ adds Plug'n'Play (no node_modules). pnpm stores every package version once in a global content-addressable store and symlinks it into `node_modules`, saving disk space, installing fastest, and preventing access to undeclared ("phantom") dependencies. Today the differences are mostly performance, disk usage, strictness and monorepo ergonomics; pick one per project and stick to its lockfile.
:::

:::question
difficulty: easy
### What is the difference between dependencies and devDependencies?
`dependencies` are needed for the app/library to run in production (React, a date library). `devDependencies` are only needed during development and build (TypeScript, Vite, ESLint, test runners, `@types/*`). For a bundled frontend app the distinction mostly affects install time and auditing (everything imported gets bundled either way); for libraries and Node servers, `npm install --production` skips devDependencies, so it matters a lot.
:::

:::question
difficulty: medium
### What's the purpose of a lockfile, and why use `npm ci` in CI?
package.json uses version **ranges**, so fresh installs at different times could resolve different versions ("works on my machine"). The lockfile pins the exact version and integrity hash of every direct and transitive dependency, making installs reproducible and tamper-evident. `npm ci` deletes `node_modules`, installs exactly what the lockfile says, never modifies it, and fails if package.json and the lockfile disagree — giving fast, deterministic, verifiable CI builds.
:::

:::question
difficulty: medium
companies: Razorpay
### What are Webpack and Babel, and what is a polyfill?
**Babel** is a compiler that transforms modern JavaScript/JSX/TypeScript syntax into syntax supported by target browsers. **Webpack** is a bundler: starting from an entry file, it builds a dependency graph of all modules (JS, CSS, images via loaders), then outputs optimized bundles with code splitting, tree shaking, minification and hashed filenames. A **polyfill** is runtime code that implements a missing browser API (e.g. `Promise.allSettled`, `fetch`) so modern code works in older browsers. Babel handles syntax; polyfills (core-js) handle APIs; Browserslist tells both which browsers to target.
:::

:::challenge
difficulty: easy
### Does this version satisfy the range?
Write `satisfies(version, range)` for ranges of the form `^x.y.z`, `~x.y.z` or exact `x.y.z` (no prereleases). Remember the caret rule for `0.x` versions: `^0.y.z` allows only `0.y.*` (≥ z).
@@@starter
```js
function satisfies(version, range) {
  // your code
}
```
@@@tests
```js
test('caret', () => {
  expect(satisfies('1.9.0', '^1.4.2')).toBe(true)
  expect(satisfies('2.0.0', '^1.4.2')).toBe(false)
  expect(satisfies('1.4.1', '^1.4.2')).toBe(false)
})
test('tilde', () => {
  expect(satisfies('1.4.9', '~1.4.2')).toBe(true)
  expect(satisfies('1.5.0', '~1.4.2')).toBe(false)
})
test('caret on 0.x', () => {
  expect(satisfies('0.3.5', '^0.3.1')).toBe(true)
  expect(satisfies('0.4.0', '^0.3.1')).toBe(false)
})
test('exact', () => {
  expect(satisfies('1.2.3', '1.2.3')).toBe(true)
  expect(satisfies('1.2.4', '1.2.3')).toBe(false)
})
```
@@@solution
```js
function satisfies(version, range) {
  const parse = (s) => s.split('.').map(Number)
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
    return 0
  }
  const v = parse(version)
  const op = range[0] === '^' || range[0] === '~' ? range[0] : ''
  const base = parse(op ? range.slice(1) : range)

  if (!op) return cmp(v, base) === 0
  if (cmp(v, base) < 0) return false            // must be >= base

  let upper
  if (op === '~') upper = [base[0], base[1] + 1, 0]
  else if (base[0] > 0) upper = [base[0] + 1, 0, 0]
  else upper = [0, base[1] + 1, 0]              // ^0.y.z
  return cmp(v, upper) < 0
}
```
Every range is just a lower bound (inclusive) and an upper bound (exclusive). Caret locks the **left-most non-zero** component; tilde locks major+minor. Comparing component by component (not as strings!) avoids `'1.10.0' < '1.9.0'` bugs.
:::

:::quiz
### `^2.3.1` allows which version?
- [x] 2.9.0
- [ ] 3.0.0
- [ ] 2.3.0
@@@explain
Caret allows any version ≥ 2.3.1 and < 3.0.0.
:::

:::quiz
### Which is NOT something Babel does?
- [ ] Turn JSX into function calls
- [ ] Convert optional chaining for old browsers
- [x] Implement `Promise.allSettled` at runtime
@@@explain
That's a polyfill (e.g. core-js). Babel transforms syntax; it can inject polyfill imports, but the implementation comes from the polyfill library.
:::

:::quiz
### Is a value in `VITE_API_KEY` safe from users?
- [ ] Yes, env vars are secret
- [x] No — it's embedded in the JS bundle anyone can read
@@@explain
Anything shipped to the browser is public. Secrets belong on the server.
:::
