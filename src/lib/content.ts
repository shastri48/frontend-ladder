import { useEffect, useState } from 'react'
import { lessons as INDEX, loaders } from 'virtual:content-index'
import { LEVELS, type LevelId, type LevelMeta, type ModuleMeta } from '../content/curriculum'
import type { Block, Difficulty } from './parser'

export interface QuestionMeta {
  id: string
  kind: 'question' | 'challenge'
  title: string
  difficulty: Difficulty
  companies: string[]
  hasTests: boolean
}

export interface LessonMeta {
  key: string // fe1/css/box-model
  level: LevelId
  moduleId: string
  slug: string
  order: number
  title: string
  summary: string
  minutes: number
  counts: { questions: number; challenges: number; quizzes: number; visuals: number }
  toc: { id: string; text: string }[]
  questions: QuestionMeta[]
}
export type Lesson = LessonMeta

export interface Module extends ModuleMeta {
  level: LevelId
  key: string
  lessons: Lesson[]
}

export interface Level extends Omit<LevelMeta, 'modules'> {
  modules: Module[]
  lessons: Lesson[]
}

export interface QuestionRef {
  qid: string // lessonKey#blockId
  kind: 'question' | 'challenge'
  title: string
  difficulty: Difficulty
  companies: string[]
  lesson: Lesson
  hasTests: boolean
}

function build() {
  const byModule = new Map<string, Lesson[]>()
  for (const l of INDEX as Lesson[]) {
    const mk = `${l.level}/${l.moduleId}`
    if (!byModule.has(mk)) byModule.set(mk, [])
    byModule.get(mk)!.push(l)
  }
  const levels: Level[] = LEVELS.map((lv) => {
    const modules: Module[] = lv.modules.map((mod) => ({
      ...mod,
      level: lv.id,
      key: `${lv.id}/${mod.id}`,
      lessons: (byModule.get(`${lv.id}/${mod.id}`) || []).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)),
    }))
    return { ...lv, modules, lessons: modules.flatMap((m) => m.lessons) }
  })
  const allLessons = levels.flatMap((l) => l.lessons)
  const questions: QuestionRef[] = allLessons.flatMap((lesson) =>
    lesson.questions.map((q) => ({
      qid: `${lesson.key}#${q.id}`,
      kind: q.kind,
      title: q.title,
      difficulty: q.difficulty,
      companies: q.companies,
      lesson,
      hasTests: q.hasTests,
    })),
  )
  return { levels, allLessons, questions }
}

const DATA = build()

export const levels = DATA.levels
export const allLessons = DATA.allLessons
export const allQuestions = DATA.questions

export const getLevel = (id: string) => levels.find((l) => l.id === id)
export const getModule = (level: string, moduleId: string) => getLevel(level)?.modules.find((m) => m.id === moduleId)
export const getLesson = (key: string) => allLessons.find((l) => l.key === key)

export function neighbours(key: string) {
  const i = allLessons.findIndex((l) => l.key === key)
  return { prev: i > 0 ? allLessons[i - 1] : undefined, next: i >= 0 ? allLessons[i + 1] : undefined }
}

export const lessonPath = (l: Pick<Lesson, 'key'>) => `/learn/${l.key}`

export const allCompanies = Array.from(new Set(allQuestions.flatMap((q) => q.companies))).sort((a, b) => a.localeCompare(b))

/** XP the platform awards. Kept in one place so the UI can explain it. */
export const XP = { lesson: 50, challenge: 30, selfSolved: 15, quiz: 10, understood: 5 }

/* ---------------- lazy lesson bodies ---------------- */

const cache = new Map<string, Block[]>()
const pending = new Map<string, Promise<Block[]>>()

export function loadBlocks(key: string): Promise<Block[]> {
  const hit = cache.get(key)
  if (hit) return Promise.resolve(hit)
  let p = pending.get(key)
  if (!p) {
    const load = loaders[key]
    p = load
      ? load().then((m) => {
          cache.set(key, m.default)
          pending.delete(key)
          return m.default
        })
      : Promise.resolve([])
    pending.set(key, p)
  }
  return p
}

export function useLessonBlocks(key: string | undefined): Block[] | null {
  const [blocks, setBlocks] = useState<Block[] | null>(() => (key && cache.get(key)) || null)
  useEffect(() => {
    if (!key) return
    let live = true
    const hit = cache.get(key)
    if (hit) setBlocks(hit)
    else {
      setBlocks(null)
      loadBlocks(key).then((b) => live && setBlocks(b))
    }
    return () => {
      live = false
    }
  }, [key])
  return blocks
}

/** Finds one question/challenge block, loading its lesson if needed. */
export function useQuestionBlock(q: QuestionRef | undefined) {
  const blocks = useLessonBlocks(q?.lesson.key)
  if (!q || !blocks) return null
  const id = q.qid.split('#')[1]
  return blocks.find((b) => 'id' in b && b.id === id) ?? null
}
