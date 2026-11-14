# Frontend Ladder

A learning platform for frontend engineers, from beginner to staff level, in three courses:

| Level | Course | Covers |
|---|---|---|
| **FE1** | Foundations | How the web works, HTML, CSS & layout, JS fundamentals, DOM & events, async basics, React basics, Git & tooling, easy coding practice |
| **FE2** | Mid-Level Mastery | JS internals (execution context, closures, `this`, prototypes, event loop, memory), polyfills, browser internals, networking/storage/caching, React in depth, state & data fetching, TypeScript & testing, machine-coding rounds, DSA for frontend |
| **FE3** | Senior & Staff | React internals (Fiber, concurrency), rendering strategies & Next.js, performance engineering, security, accessibility, architecture & tooling, advanced JS builds, frontend system design, leadership |

## Features

- **Read**: long-form lessons that explain *why*, with analogies, diagrams and code.
- **See**: 27 interactive visuals, e.g. the event loop stepper, rendering pipeline, box model, specificity calculator, CORS preflight, Fiber phases, virtualization and re-render visualiser.
- **Understand**: interview questions with full answers shown inline.
- **Solve**: challenges with hints, a "Show answer" button, and an in-browser editor that runs tests in a sandboxed iframe.
- **Stick with it**: XP, daily goal, streaks, ranks, module badges, flashcards, bookmarks and a ⌘K search. Progress is stored in `localStorage`, with export and import.
- Mobile-first responsive layout, light and dark themes, lazy-loaded lessons.

## Develop

```bash
npm install
npm run dev
```

```bash
npm run build && npm run preview
```

## Adding content

Lessons are Markdown files in `content/<fe1|fe2|fe3>/<module-id>/NN-slug.md`. Modules are declared in
`src/content/curriculum.ts`. The authoring format covers questions, challenges with tests, quizzes, callouts and visuals; see [CONTENT_GUIDE.md](CONTENT_GUIDE.md).

At build time, `content-plugin.ts` turns the Markdown into a small index (titles, TOC, question list) and one lazy chunk per lesson.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, choose **New Project** and import the repo. The framework is detected as **Vite**: build command `npm run build`, output `dist`.
3. `vercel.json` already rewrites all routes to `index.html` for client-side routing.
