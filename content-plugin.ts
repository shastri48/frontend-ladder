// Vite plugin: turns /content/**/*.md into
//   virtual:content-index  → lightweight metadata for every lesson (titles, TOC, question index)
//   virtual:lesson/<key>   → the parsed blocks of one lesson, loaded lazily
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'
import { parseLesson, slugify } from './src/lib/parser.ts'

const INDEX_ID = 'virtual:content-index'
const LESSON_PREFIX = 'virtual:lesson/'

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.md')) out.push(p)
  }
  return out
}

function headings(md: string) {
  const out: { id: string; text: string }[] = []
  let fence = false
  for (const line of md.split('\n')) {
    if (/^\s{0,3}(```|~~~)/.test(line)) fence = !fence
    if (fence) continue
    const m = line.match(/^##\s+(.+)$/)
    if (m) out.push({ id: slugify(m[1].trim()), text: m[1].replace(/`/g, '').replace(/\*\*/g, '').trim() })
  }
  return out
}

export default function contentPlugin(root: string): Plugin {
  const dir = join(root, 'content')
  const fileFor = new Map<string, string>()

  function build() {
    fileFor.clear()
    const lessons = []
    for (const file of walk(dir)) {
      const m = relative(dir, file).match(/^(fe[123])\/([^/]+)\/(?:(\d+)[-_])?([^/]+)\.md$/)
      if (!m) continue
      const [, level, moduleId, ord, slug] = m
      const key = `${level}/${moduleId}/${slug}`
      fileFor.set(key, file)
      const { frontmatter: fm, blocks } = parseLesson(readFileSync(file, 'utf8'))
      const counts = { questions: 0, challenges: 0, quizzes: 0, visuals: 0 }
      const questions = []
      const toc = []
      let words = 0
      for (const b of blocks) {
        words += JSON.stringify(b).split(/\s+/).length
        if (b.type === 'md') toc.push(...headings(b.text))
        else if (b.type === 'visual') counts.visuals++
        else if (b.type === 'quiz') counts.quizzes++
        else if (b.type === 'question' || b.type === 'challenge') {
          if (b.type === 'question') counts.questions++
          else counts.challenges++
          questions.push({
            id: b.id,
            kind: b.type,
            title: b.title,
            difficulty: b.meta.difficulty,
            companies: b.meta.companies,
            hasTests: b.type === 'challenge' && !!b.tests,
          })
        }
      }
      lessons.push({
        key,
        level,
        moduleId,
        slug,
        order: ord ? parseInt(ord, 10) : 999,
        title: fm.title || slug.replace(/-/g, ' '),
        summary: fm.summary || '',
        minutes: parseInt(fm.minutes || '', 10) || Math.max(3, Math.round(words / 220)),
        counts,
        toc,
        questions,
      })
    }
    return lessons
  }

  return {
    name: 'frontend-ladder-content',
    resolveId(id) {
      if (id === INDEX_ID || id.startsWith(LESSON_PREFIX)) return '\0' + id
    },
    load(id) {
      if (id === '\0' + INDEX_ID) {
        const lessons = build()
        for (const f of fileFor.values()) this.addWatchFile(f)
        const loaders = lessons.map((l) => `${JSON.stringify(l.key)}: () => import(${JSON.stringify(LESSON_PREFIX + l.key)})`).join(',\n')
        return `export const lessons = ${JSON.stringify(lessons)};\nexport const loaders = {\n${loaders}\n};`
      }
      if (id.startsWith('\0' + LESSON_PREFIX)) {
        const key = id.slice(1 + LESSON_PREFIX.length)
        if (!fileFor.size) build()
        const file = fileFor.get(key)
        if (!file) return 'export default []'
        this.addWatchFile(file)
        return `export default ${JSON.stringify(parseLesson(readFileSync(file, 'utf8')).blocks)}`
      }
    },
    handleHotUpdate(ctx) {
      if (ctx.file.startsWith(dir) && ctx.file.endsWith('.md')) {
        const mods = [...ctx.server.moduleGraph.idToModuleMap.values()].filter((m) => m.id?.startsWith('\0virtual:'))
        mods.forEach((m) => ctx.server.moduleGraph.invalidateModule(m))
        ctx.server.ws.send({ type: 'full-reload' })
        return []
      }
    },
  }
}
