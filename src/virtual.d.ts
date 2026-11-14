declare module 'virtual:content-index' {
  import type { LessonMeta } from './lib/content'
  import type { Block } from './lib/parser'
  export const lessons: Omit<LessonMeta, 'questionRefs'>[]
  export const loaders: Record<string, () => Promise<{ default: Block[] }>>
}
