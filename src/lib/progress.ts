import { useSyncExternalStore } from 'react'

export interface ProgressState {
  xp: number
  lessons: Record<string, number> // lessonKey -> completed timestamp
  understood: Record<string, true> // theory question qid
  solved: Record<string, 'tests' | 'self'> // challenge qid
  quizzes: Record<string, boolean> // quiz qid -> answered correctly first try
  bookmarks: Record<string, true> // qid or lessonKey
  days: Record<string, number> // yyyy-mm-dd -> xp earned that day
  lastLesson?: string
  dailyGoal: number
}

const KEY = 'fl-progress-v1'
const EMPTY: ProgressState = {
  xp: 0,
  lessons: {},
  understood: {},
  solved: {},
  quizzes: {},
  bookmarks: {},
  days: {},
  dailyGoal: 100,
}

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return { ...EMPTY }
}

let state = load()
const listeners = new Set<() => void>()
type XpListener = (amount: number, reason: string) => void
const xpListeners = new Set<XpListener>()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function set(next: ProgressState) {
  state = next
  save()
  listeners.forEach((l) => l())
}

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function award(next: ProgressState, amount: number, reason: string) {
  const t = today()
  next.xp += amount
  next.days = { ...next.days, [t]: (next.days[t] || 0) + amount }
  queueMicrotask(() => xpListeners.forEach((l) => l(amount, reason)))
  return next
}

export const progress = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  onXp(l: XpListener) {
    xpListeners.add(l)
    return () => {
      xpListeners.delete(l)
    }
  },
  completeLesson(key: string, xp: number) {
    if (state.lessons[key]) return
    set(award({ ...state, lessons: { ...state.lessons, [key]: Date.now() } }, xp, 'Lesson complete'))
  },
  uncompleteLesson(key: string) {
    const lessons = { ...state.lessons }
    delete lessons[key]
    set({ ...state, lessons })
  },
  markUnderstood(qid: string, xp: number) {
    if (state.understood[qid]) {
      const u = { ...state.understood }
      delete u[qid]
      set({ ...state, understood: u })
      return
    }
    set(award({ ...state, understood: { ...state.understood, [qid]: true } }, xp, 'Concept understood'))
  },
  markSolved(qid: string, how: 'tests' | 'self', xp: number) {
    if (state.solved[qid] === 'tests' || state.solved[qid] === how) return
    const already = !!state.solved[qid]
    const next = { ...state, solved: { ...state.solved, [qid]: how } }
    set(already ? next : award(next, xp, how === 'tests' ? 'All tests passed' : 'Challenge solved'))
  },
  answerQuiz(qid: string, correct: boolean, xp: number) {
    if (qid in state.quizzes) return
    const next = { ...state, quizzes: { ...state.quizzes, [qid]: correct } }
    set(correct ? award(next, xp, 'Correct answer') : next)
  },
  toggleBookmark(id: string) {
    const b = { ...state.bookmarks }
    if (b[id]) delete b[id]
    else b[id] = true
    set({ ...state, bookmarks: b })
  },
  setLastLesson(key: string) {
    if (state.lastLesson === key) return
    set({ ...state, lastLesson: key })
  },
  setDailyGoal(n: number) {
    set({ ...state, dailyGoal: n })
  },
  reset() {
    set({ ...EMPTY })
  },
  export: () => JSON.stringify(state, null, 2),
  import(json: string) {
    set({ ...EMPTY, ...JSON.parse(json) })
  },
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(progress.subscribe, progress.get, progress.get)
}

/** Consecutive days (ending today or yesterday) with any XP. */
export function streak(days: Record<string, number>): number {
  let n = 0
  const d = new Date()
  if (!days[today(d)]) d.setDate(d.getDate() - 1)
  while (days[today(d)]) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export const RANKS = [
  { min: 0, name: 'Curious Coder' },
  { min: 200, name: 'HTML Apprentice' },
  { min: 600, name: 'CSS Wrangler' },
  { min: 1200, name: 'JS Explorer' },
  { min: 2200, name: 'Component Crafter' },
  { min: 3600, name: 'Async Whisperer' },
  { min: 5400, name: 'Render Tamer' },
  { min: 7600, name: 'Performance Hunter' },
  { min: 10500, name: 'Frontend Architect' },
  { min: 14000, name: 'Staff Wizard' },
]

export function rankFor(xp: number) {
  let i = 0
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].min) i++
  const cur = RANKS[i]
  const next = RANKS[i + 1]
  return {
    index: i,
    name: cur.name,
    next,
    pct: next ? (xp - cur.min) / (next.min - cur.min) : 1,
  }
}
