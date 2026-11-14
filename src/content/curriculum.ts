// Curriculum skeleton: levels → modules. Lessons live as Markdown files in
// /content/<level>/<module-id>/<NN-lesson-slug>.md and are ordered by filename.

export type LevelId = 'fe1' | 'fe2' | 'fe3'

export interface ModuleMeta {
  id: string // must equal the folder name under /content/<level>/
  title: string
  icon: string // lucide icon name (see src/lib/icons.ts)
  blurb: string
}

export interface LevelMeta {
  id: LevelId
  code: string
  title: string
  tagline: string
  description: string
  gradient: string
  modules: ModuleMeta[]
}

export const LEVELS: LevelMeta[] = [
  {
    id: 'fe1',
    code: 'FE1',
    title: 'Foundations',
    tagline: 'From zero to job-ready junior',
    description:
      'How the web works, HTML, CSS, JavaScript fundamentals, the DOM, async basics, first steps in React and the tooling every developer uses daily.',
    gradient: 'from-emerald-400 via-teal-400 to-cyan-500',
    modules: [
      { id: 'web-basics', title: 'How the Web Works', icon: 'Globe', blurb: 'Clients, servers, HTTP, DNS and what a browser actually is.' },
      { id: 'html', title: 'HTML & Semantics', icon: 'FileCode', blurb: 'Semantic markup, forms, validation, SEO and accessibility basics.' },
      { id: 'css', title: 'CSS & Layout', icon: 'Palette', blurb: 'Box model, cascade, specificity, units, Flexbox, Grid, responsive design.' },
      { id: 'js-fundamentals', title: 'JavaScript Fundamentals', icon: 'Braces', blurb: 'Types, scope, hoisting, functions, arrays, objects and equality.' },
      { id: 'dom-events', title: 'DOM & Events', icon: 'MousePointerClick', blurb: 'Traversing and changing the page, events, bubbling and delegation.' },
      { id: 'async-basics', title: 'Async JavaScript Basics', icon: 'Timer', blurb: 'Callbacks, promises, async/await and fetch.' },
      { id: 'react-basics', title: 'React Basics', icon: 'Atom', blurb: 'Components, JSX, props, state, lists, keys, forms and hooks 101.' },
      { id: 'tooling', title: 'Git & Tooling', icon: 'GitBranch', blurb: 'Git workflows, npm/yarn, DevTools and debugging.' },
      { id: 'coding-practice', title: 'Coding Practice (Easy)', icon: 'Swords', blurb: 'Warm-up problems asked in junior interviews.' },
    ],
  },
  {
    id: 'fe2',
    code: 'FE2',
    title: 'Mid-Level Mastery',
    tagline: 'Understand how things work under the hood',
    description:
      'Execution context, closures, prototypes and the event loop; browser internals; networking, storage and caching; React in depth; polyfills and machine-coding rounds.',
    gradient: 'from-violet-500 via-fuchsia-500 to-pink-500',
    modules: [
      { id: 'js-deep-dive', title: 'JavaScript Deep Dive', icon: 'Cpu', blurb: 'Execution context, closures, this, prototypes, event loop, memory.' },
      { id: 'polyfills', title: 'Polyfills & Utilities', icon: 'Wrench', blurb: 'Debounce, throttle, Promise.all, deep clone, curry, emitters and more.' },
      { id: 'browser-internals', title: 'How Browsers Work', icon: 'Monitor', blurb: 'URL to pixels, critical rendering path, reflow, repaint, compositing.' },
      { id: 'network-storage', title: 'Networking, Storage & Caching', icon: 'Network', blurb: 'HTTP caching, service workers, CORS, storage, REST vs GraphQL, WebSockets.' },
      { id: 'react-deep-dive', title: 'React In Depth', icon: 'Atom', blurb: 'Hooks deep dive, reconciliation, re-renders, context, error boundaries.' },
      { id: 'state-data', title: 'State & Data Fetching', icon: 'Database', blurb: 'Redux/RTK, Context, React Query, race conditions, stale closures, auth.' },
      { id: 'typescript-testing', title: 'TypeScript & Testing', icon: 'ShieldCheck', blurb: 'TS for React devs, Jest, React Testing Library, E2E.' },
      { id: 'machine-coding', title: 'Machine Coding Rounds', icon: 'Hammer', blurb: 'Build real UI components the way interviews expect.' },
      { id: 'dsa', title: 'DSA for Frontend', icon: 'Binary', blurb: 'The data-structure problems frontend interviews actually ask.' },
    ],
  },
  {
    id: 'fe3',
    code: 'FE3',
    title: 'Senior & Staff',
    tagline: 'Architect, optimise and lead',
    description:
      'React internals (Fiber, concurrency, RSC), rendering strategies, performance engineering, security, accessibility, frontend architecture, system design and leadership.',
    gradient: 'from-amber-400 via-orange-500 to-rose-500',
    modules: [
      { id: 'react-internals', title: 'React Internals & Concurrency', icon: 'Layers', blurb: 'Fiber, scheduling, batching, Suspense, transitions, React 18/19.' },
      { id: 'rendering-strategies', title: 'Rendering Strategies & Next.js', icon: 'Server', blurb: 'CSR, SSR, SSG, ISR, streaming, hydration, Server Components.' },
      { id: 'performance', title: 'Performance Engineering', icon: 'Gauge', blurb: 'Core Web Vitals, profiling, bundles, 10k rows, memory leaks, workers.' },
      { id: 'security', title: 'Frontend Security', icon: 'Lock', blurb: 'XSS, CSRF, CSP, CORS, tokens, cookies and secure auth.' },
      { id: 'accessibility', title: 'Accessibility (a11y)', icon: 'Accessibility', blurb: 'WCAG, ARIA, keyboard navigation, focus management.' },
      { id: 'architecture', title: 'Frontend Architecture & Tooling', icon: 'Building2', blurb: 'Codebase structure, design systems, micro-frontends, Webpack vs Vite.' },
      { id: 'advanced-js', title: 'Advanced JS Challenges', icon: 'Flame', blurb: 'Promise from scratch, schedulers, Redux clone, virtual DOM, observables.' },
      { id: 'system-design', title: 'Frontend System Design', icon: 'Workflow', blurb: 'RADIO framework, feeds, autocomplete, chat, docs, dashboards.' },
      { id: 'leadership', title: 'Leadership & Behavioral', icon: 'Users', blurb: 'STAR answers, ownership, mentoring, trade-offs and influence.' },
    ],
  },
]
