import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bookmark, Brain, ChevronDown, CircleCheck, ExternalLink, FlaskConical, Search, Swords } from 'lucide-react'
import { allCompanies, allQuestions, lessonPath, levels, useQuestionBlock, type QuestionRef } from '../lib/content'
import { useProgress } from '../lib/progress'
import { ChallengeCard, DifficultyBadge, QuestionCard } from '../components/Cards'

const PAGE = 30

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? 'bg-ink text-bg' : 'bg-surface text-muted ring-1 ring-line hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

function Body({ q }: { q: QuestionRef }) {
  const block = useQuestionBlock(q)
  if (!block) return <div className="card my-4 h-40 animate-pulse" />
  return block.type === 'question' ? <QuestionCard block={block} qid={q.qid} /> : block.type === 'challenge' ? <ChallengeCard block={block} qid={q.qid} /> : null
}

function Row({ q }: { q: QuestionRef }) {
  const [open, setOpen] = useState(false)
  const p = useProgress()
  const blockId = q.qid.split('#')[1]
  const done = q.kind === 'question' ? !!p.understood[q.qid] : !!p.solved[q.qid]
  const lv = levels.find((l) => l.id === q.lesson.level)!
  return (
    <li className="card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={open}>
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            done ? 'bg-emerald-500 text-white' : q.kind === 'question' ? 'bg-sky-500/15 text-sky-500' : 'bg-fuchsia-500/15 text-fuchsia-500'
          }`}
        >
          {done ? <CircleCheck size={16} /> : q.kind === 'question' ? <Brain size={16} /> : <Swords size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{q.title.replace(/`/g, '')}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md bg-gradient-to-r px-1.5 py-0.5 text-[10px] font-black text-white ${lv.gradient}`}>{lv.code}</span>
            <DifficultyBadge d={q.difficulty} />
            {q.hasTests && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                <FlaskConical size={11} /> runnable
              </span>
            )}
            {q.companies.slice(0, 4).map((c) => (
              <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
                {c}
              </span>
            ))}
            <span className="truncate text-[11px] text-faint">· {q.lesson.title}</span>
          </span>
        </span>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="animate-reveal border-t border-line bg-bg/40 px-2 pb-2 sm:px-4">
          <Body q={q} />
          <Link to={`${lessonPath(q.lesson)}#${blockId}`} className="mb-2 inline-flex items-center gap-1 px-1 text-xs font-semibold text-violet-500">
            Open in lesson <ExternalLink size={12} />
          </Link>
        </div>
      )}
    </li>
  )
}

export default function Practice() {
  const [sp, setSp] = useSearchParams()
  const p = useProgress()
  const [limit, setLimit] = useState(PAGE)
  const level = sp.get('level') || 'all'
  const kind = sp.get('kind') || 'all'
  const diff = sp.get('difficulty') || 'all'
  const company = sp.get('company') || ''
  const status = sp.get('status') || 'all'
  const q = sp.get('q') || ''

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    if (!v || v === 'all') n.delete(k)
    else n.set(k, v)
    setSp(n, { replace: true })
    setLimit(PAGE)
  }

  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return allQuestions.filter((x) => {
      if (level !== 'all' && x.lesson.level !== level) return false
      if (kind !== 'all' && x.kind !== kind) return false
      if (diff !== 'all' && x.difficulty !== diff) return false
      if (company && !x.companies.includes(company)) return false
      const done = x.kind === 'question' ? !!p.understood[x.qid] : !!p.solved[x.qid]
      if (status === 'todo' && done) return false
      if (status === 'done' && !done) return false
      if (status === 'saved' && !p.bookmarks[x.qid]) return false
      if (terms.length) {
        const hay = (x.title + ' ' + x.lesson.title + ' ' + x.companies.join(' ')).toLowerCase()
        if (!terms.every((t) => hay.includes(t))) return false
      }
      return true
    })
  }, [level, kind, diff, company, status, q, p])

  const doneCount = list.filter((x) => (x.kind === 'question' ? p.understood[x.qid] : p.solved[x.qid])).length

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Practice bank</h1>
      <p className="mt-1 text-muted">
        Every interview question and challenge in one place. Theory answers are open to read; challenge answers stay hidden until you ask.
      </p>

      <div className="sticky top-14 z-20 -mx-4 mt-6 space-y-2.5 bg-bg/90 px-4 py-3 backdrop-blur-xl">
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3">
          <Search size={17} className="text-faint" />
          <input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Filter by keyword, e.g. closure, debounce, cache…" className="h-11 flex-1 bg-transparent outline-none placeholder:text-faint" />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {['all', ...levels.map((l) => l.id)].map((l) => (
            <Chip key={l} on={level === l} onClick={() => set('level', l)}>
              {l === 'all' ? 'All levels' : levels.find((x) => x.id === l)!.code}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {[
            ['all', 'All types'],
            ['question', 'Theory'],
            ['challenge', 'Challenges'],
          ].map(([v, l]) => (
            <Chip key={v} on={kind === v} onClick={() => set('kind', v)}>
              {l}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {['all', 'easy', 'medium', 'hard'].map((d) => (
            <Chip key={d} on={diff === d} onClick={() => set('difficulty', d)}>
              {d === 'all' ? 'Any difficulty' : d[0].toUpperCase() + d.slice(1)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            ['all', 'All'],
            ['todo', 'To do'],
            ['done', 'Done'],
            ['saved', 'Bookmarked'],
          ].map(([v, l]) => (
            <Chip key={v} on={status === v} onClick={() => set('status', v)}>
              {v === 'saved' && <Bookmark size={11} className="mr-1 inline" />}
              {l}
            </Chip>
          ))}
          <select
            value={company}
            onChange={(e) => set('company', e.target.value)}
            className="ml-auto rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted"
            aria-label="Company"
          >
            <option value="">Any company</option>
            {allCompanies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 text-sm text-faint">
        {list.length} results · {doneCount} done
      </div>
      <ul className="mt-3 space-y-2.5">
        {list.slice(0, limit).map((x) => (
          <Row key={x.qid} q={x} />
        ))}
      </ul>
      {list.length > limit && (
        <div className="mt-6 text-center">
          <button onClick={() => setLimit((l) => l + PAGE)} className="rounded-2xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold hover:border-violet-500/50">
            Show more ({list.length - limit} left)
          </button>
        </div>
      )}
      {list.length === 0 && <div className="mt-10 text-center text-faint">Nothing matches these filters.</div>}
    </div>
  )
}
