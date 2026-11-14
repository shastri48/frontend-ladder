import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Brain, CornerDownLeft, Search, Swords } from 'lucide-react'
import { allLessons, allQuestions, lessonPath } from '../lib/content'
import { LEVELS } from '../content/curriculum'

interface Hit {
  kind: 'lesson' | 'question' | 'challenge'
  title: string
  sub: string
  to: string
  score: number
}

const norm = (s: string) => s.toLowerCase().replace(/[`*_]/g, '')

function score(text: string, terms: string[]) {
  const t = norm(text)
  let s = 0
  for (const term of terms) {
    const i = t.indexOf(term)
    if (i === -1) return 0
    s += i === 0 ? 3 : t[i - 1] === ' ' ? 2 : 1
  }
  return s
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    input.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const hits = useMemo<Hit[]>(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean)
    const code = (lv: string) => LEVELS.find((l) => l.id === lv)?.code ?? ''
    if (!terms.length) {
      return allLessons.slice(0, 8).map((l) => ({ kind: 'lesson', title: l.title, sub: `${code(l.level)} · ${l.summary}`, to: lessonPath(l), score: 1 }))
    }
    const out: Hit[] = []
    for (const l of allLessons) {
      const s = score(l.title, terms) * 3 || score(l.title + ' ' + l.summary + ' ' + l.moduleId, terms)
      if (s) out.push({ kind: 'lesson', title: l.title, sub: `${code(l.level)} · ${l.summary}`, to: lessonPath(l), score: s + 4 })
    }
    for (const x of allQuestions) {
      const s = score(x.title, terms) * 2 || score(x.title + ' ' + x.companies.join(' '), terms)
      if (s)
        out.push({
          kind: x.kind,
          title: x.title,
          sub: `${code(x.lesson.level)} · ${x.lesson.title}${x.companies.length ? ' · ' + x.companies.join(', ') : ''}`,
          to: `${lessonPath(x.lesson)}#${x.qid.split('#')[1]}`,
          score: s,
        })
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 40)
  }, [q])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    list.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const go = (h?: Hit) => {
    if (!h) return
    onClose()
    nav(h.to)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-[10vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="animate-pop w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(hits.length - 1, s + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(0, s - 1))
              } else if (e.key === 'Enter') go(hits[sel])
              else if (e.key === 'Escape') onClose()
            }}
            placeholder="Search: event loop, debounce, CORS, Google, useMemo…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          <kbd className="rounded-md border border-line px-1.5 font-mono text-[10px] text-faint">esc</kbd>
        </div>
        <div ref={list} id="palette-list" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {hits.length === 0 && <div className="p-6 text-center text-sm text-faint">No matches. Try fewer words.</div>}
          {hits.map((h, i) => (
            <button
              key={h.to + i}
              data-i={i}
              role="option"
              aria-selected={i === sel}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(h)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === sel ? 'bg-surface-2' : ''}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  h.kind === 'lesson' ? 'bg-violet-500/15 text-violet-500' : h.kind === 'question' ? 'bg-sky-500/15 text-sky-500' : 'bg-fuchsia-500/15 text-fuchsia-500'
                }`}
              >
                {h.kind === 'lesson' ? <BookOpen size={16} /> : h.kind === 'question' ? <Brain size={16} /> : <Swords size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{h.title.replace(/`/g, '')}</span>
                <span className="block truncate text-xs text-faint">{h.sub}</span>
              </span>
              {i === sel && <CornerDownLeft size={14} className="text-faint" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
