// Parses lesson Markdown (see CONTENT_GUIDE.md) into typed blocks.

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface QMeta {
  difficulty: Difficulty
  companies: string[]
  tags: string[]
}

export type Block =
  | { type: 'md'; text: string }
  | { type: 'visual'; id: string }
  | { type: 'callout'; kind: string; title: string; body: string }
  | { type: 'question'; id: string; title: string; body: string; meta: QMeta }
  | {
      type: 'challenge'
      id: string
      title: string
      prompt: string
      hint?: string
      starter?: string
      tests?: string
      solution: string
      meta: QMeta
    }
  | {
      type: 'quiz'
      id: string
      title: string
      options: { text: string; correct: boolean }[]
      explain: string
    }

export interface ParsedLesson {
  frontmatter: Record<string, string>
  blocks: Block[]
}

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/

/** Walks lines, reporting whether each line is inside a fenced code block. */
function fenceTracker() {
  let marker: string | null = null
  return (line: string): boolean => {
    const m = line.match(FENCE_RE)
    if (marker) {
      if (m && m[1][0] === marker[0] && m[1].length >= marker.length && line.trim() === m[1]) {
        marker = null
      }
      return true
    }
    if (m) {
      marker = m[1]
      return true
    }
    return false
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/`/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function parseFrontmatter(src: string): { fm: Record<string, string>; body: string } {
  const fm: Record<string, string> = {}
  if (!src.startsWith('---')) return { fm, body: src }
  const end = src.indexOf('\n---', 3)
  if (end === -1) return { fm, body: src }
  const raw = src.slice(3, end)
  for (const line of raw.split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) {
      let v = line.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      fm[line.slice(0, i).trim()] = v
    }
  }
  const after = src.indexOf('\n', end + 1)
  return { fm, body: after === -1 ? '' : src.slice(after + 1) }
}

/** Splits leading `key: value` lines and the `### Title` line off a block body. */
function splitHeader(lines: string[]): { meta: Record<string, string>; title: string; rest: string[] } {
  const meta: Record<string, string> = {}
  let i = 0
  let title = ''
  for (; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) continue
    const h = l.match(/^#{2,4}\s+(.*)$/)
    if (h) {
      title = h[1].trim()
      i++
      break
    }
    const kv = l.match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (kv) {
      meta[kv[1].toLowerCase()] = kv[2].trim()
      continue
    }
    break // body starts without a title
  }
  return { meta, title, rest: lines.slice(i) }
}

function toQMeta(meta: Record<string, string>): QMeta {
  const d = (meta.difficulty || 'medium').toLowerCase()
  const list = (s?: string) =>
    (s || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  return {
    difficulty: (['easy', 'medium', 'hard'].includes(d) ? d : 'medium') as Difficulty,
    companies: list(meta.companies),
    tags: list(meta.tags),
  }
}

/** Splits lines by `@@@section` markers outside code fences. */
function splitSections(lines: string[]): Record<string, string> {
  const out: Record<string, string[]> = { main: [] }
  let cur = 'main'
  const inFence = fenceTracker()
  for (const l of lines) {
    const fenced = inFence(l)
    const m = !fenced && l.match(/^@@@(\w+)\s*$/)
    if (m) {
      cur = m[1].toLowerCase()
      out[cur] = out[cur] || []
      continue
    }
    out[cur].push(l)
  }
  const res: Record<string, string> = {}
  for (const k of Object.keys(out)) res[k] = out[k].join('\n').trim()
  return res
}

/** Pulls the code out of a fenced block (or returns raw text if there is no fence). */
export function stripFence(s?: string): string | undefined {
  if (!s) return undefined
  const lines = s.trim().split('\n')
  if (lines.length && FENCE_RE.test(lines[0])) {
    lines.shift()
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    if (lines.length && FENCE_RE.test(lines[lines.length - 1])) lines.pop()
  }
  return lines.join('\n')
}

export function parseLesson(src: string): ParsedLesson {
  const { fm, body } = parseFrontmatter(src.replace(/\r\n/g, '\n'))
  const lines = body.split('\n')
  const blocks: Block[] = []
  const usedIds = new Set<string>()
  const uid = (base: string, fallback: string) => {
    let id = slugify(base) || fallback
    let n = 2
    while (usedIds.has(id)) id = `${slugify(base) || fallback}-${n++}`
    usedIds.add(id)
    return id
  }

  let md: string[] = []
  const flushMd = () => {
    const text = md.join('\n').trim()
    if (text) blocks.push({ type: 'md', text })
    md = []
  }

  const inFence = fenceTracker()
  let dir: { kind: string; arg: string; lines: string[] } | null = null
  let qCount = 0

  for (const line of lines) {
    if (dir) {
      const fenced = inFence(line)
      if (!fenced && line.trim() === ':::') {
        const { kind, arg } = dir
        const dl = dir.lines
        dir = null
        qCount++
        if (kind === 'visual') {
          blocks.push({ type: 'visual', id: arg.trim() })
        } else if (kind === 'callout') {
          const [k, ...t] = arg.trim().split(/\s+/)
          blocks.push({ type: 'callout', kind: k || 'info', title: t.join(' '), body: dl.join('\n').trim() })
        } else if (kind === 'question') {
          const { meta, title, rest } = splitHeader(dl)
          blocks.push({
            type: 'question',
            id: uid(title, `q${qCount}`),
            title: title || 'Question',
            body: rest.join('\n').trim(),
            meta: toQMeta(meta),
          })
        } else if (kind === 'challenge') {
          const { meta, title, rest } = splitHeader(dl)
          const s = splitSections(rest)
          blocks.push({
            type: 'challenge',
            id: uid(title, `c${qCount}`),
            title: title || 'Challenge',
            prompt: s.main,
            hint: s.hint || undefined,
            starter: stripFence(s.starter),
            tests: stripFence(s.tests),
            solution: s.solution || s.answer || '',
            meta: toQMeta(meta),
          })
        } else if (kind === 'quiz') {
          const { title, rest } = splitHeader(dl)
          const s = splitSections(rest)
          const options: { text: string; correct: boolean }[] = []
          const extra: string[] = []
          for (const l of s.main.split('\n')) {
            const m = l.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/)
            if (m) options.push({ text: m[2].trim(), correct: m[1].toLowerCase() === 'x' })
            else if (options.length && l.trim() && /^\s{2,}/.test(l)) options[options.length - 1].text += ' ' + l.trim()
            else extra.push(l)
          }
          const pre = extra.join('\n').trim()
          blocks.push({
            type: 'quiz',
            id: uid('quiz-' + (title || pre), `quiz${qCount}`),
            title: [title, pre].filter(Boolean).join('\n\n'),
            options,
            explain: s.explain || '',
          })
        } else {
          md.push(...dl)
        }
      } else {
        dir.lines.push(line)
      }
      continue
    }

    const fenced = inFence(line)
    const m = !fenced && line.match(/^:::([a-zA-Z]+)\s*(.*)$/)
    if (m) {
      flushMd()
      dir = { kind: m[1].toLowerCase(), arg: m[2] || '', lines: [] }
      continue
    }
    md.push(line)
  }
  if (dir) md.push(...dir.lines)
  flushMd()
  return { frontmatter: fm, blocks }
}
