import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ExternalLink, RotateCcw, Shuffle, X } from 'lucide-react'
import { allQuestions, lessonPath, levels, useQuestionBlock, XP } from '../lib/content'
import { progress, useProgress } from '../lib/progress'
import { Markdown } from '../components/Markdown'
import { DifficultyBadge } from '../components/Cards'
import { Bar } from '../components/ui'

function shuffle<T>(a: T[]) {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export default function Flashcards() {
  const p = useProgress()
  const [level, setLevel] = useState('all')
  const [moduleId, setModuleId] = useState('all')
  const [kind, setKind] = useState<'question' | 'challenge' | 'all'>('question')
  const [seed, setSeed] = useState(0)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [score, setScore] = useState({ knew: 0, again: 0 })

  const modules = level === 'all' ? [] : levels.find((l) => l.id === level)!.modules.filter((m) => m.lessons.length)

  const deck = useMemo(() => {
    void seed
    return shuffle(
      allQuestions.filter(
        (q) =>
          (level === 'all' || q.lesson.level === level) &&
          (moduleId === 'all' || q.lesson.moduleId === moduleId) &&
          (kind === 'all' || q.kind === kind),
      ),
    )
  }, [level, moduleId, kind, seed])

  useEffect(() => {
    setI(0)
    setFlipped(false)
    setScore({ knew: 0, again: 0 })
  }, [deck])

  const card = deck[i]
  const block = useQuestionBlock(card)
  const answer = block?.type === 'question' ? block.body : block?.type === 'challenge' ? `${block.prompt}\n\n---\n\n**Answer**\n\n${block.solution}` : ''

  const next = useCallback(
    (knew: boolean) => {
      if (!card) return
      if (knew) {
        if (card.kind === 'question' && !p.understood[card.qid]) progress.markUnderstood(card.qid, XP.understood)
      }
      setScore((s) => (knew ? { ...s, knew: s.knew + 1 } : { ...s, again: s.again + 1 }))
      setFlipped(false)
      setI((x) => x + 1)
    },
    [card, p.understood],
  )

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea')) return
      if (e.key === ' ') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === 'ArrowRight' && flipped) next(true)
      else if (e.key === 'ArrowLeft' && flipped) next(false)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [flipped, next])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Interview flashcards</h1>
      <p className="mt-1 text-muted">Say your answer out loud first, then flip. Be honest — “Review again” is how it sticks.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <select value={level} onChange={(e) => { setLevel(e.target.value); setModuleId('all') }} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium" aria-label="Level">
          <option value="all">All levels</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} · {l.title}
            </option>
          ))}
        </select>
        {modules.length > 0 && (
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium" aria-label="Module">
            <option value="all">All modules</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        )}
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium" aria-label="Type">
          <option value="question">Theory questions</option>
          <option value="challenge">Challenges</option>
          <option value="all">Both</option>
        </select>
        <button onClick={() => setSeed((s) => s + 1)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium hover:text-ink">
          <Shuffle size={15} /> Shuffle
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3 text-sm">
        <Bar value={deck.length ? i / deck.length : 0} className="flex-1" />
        <span className="font-mono text-xs text-faint">
          {Math.min(i + 1, deck.length)}/{deck.length}
        </span>
      </div>

      {card ? (
        <div className="mt-5">
          <div className="card relative min-h-[18rem] overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500" />
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md bg-gradient-to-r px-1.5 py-0.5 text-[10px] font-black text-white ${levels.find((l) => l.id === card.lesson.level)!.gradient}`}>
                  {levels.find((l) => l.id === card.lesson.level)!.code}
                </span>
                <DifficultyBadge d={card.difficulty} />
                {card.companies.slice(0, 3).map((c) => (
                  <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
                    {c}
                  </span>
                ))}
                <span className="text-xs text-faint">{card.lesson.title}</span>
              </div>
              <h2 className="mt-4 text-xl font-bold leading-snug sm:text-2xl">{card.title.replace(/`/g, '')}</h2>

              {!flipped ? (
                <button
                  onClick={() => setFlipped(true)}
                  className="mt-10 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line py-8 text-faint transition hover:border-violet-500/50 hover:text-ink"
                >
                  <RotateCcw />
                  <span className="text-sm font-semibold">Tap to reveal the answer</span>
                  <kbd className="rounded border border-line px-1.5 font-mono text-[10px]">space</kbd>
                </button>
              ) : (
                <div className="animate-reveal mt-5 max-h-[55vh] overflow-y-auto rounded-xl border border-line bg-bg/40 p-4">
                  {block ? <Markdown text={answer} compact /> : <div className="h-32 animate-pulse rounded-lg bg-surface-2" />}
                </div>
              )}
            </div>
          </div>

          {flipped && (
            <div className="animate-pop mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => next(false)} className="flex items-center justify-center gap-2 rounded-2xl bg-rose-500/12 py-3.5 font-semibold text-rose-600 ring-1 ring-rose-500/30 hover:bg-rose-500/20 dark:text-rose-300">
                <X size={18} /> Review again <kbd className="hidden font-mono text-[10px] opacity-60 sm:inline">←</kbd>
              </button>
              <button onClick={() => next(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white hover:bg-emerald-400">
                <Check size={18} /> I knew it <kbd className="hidden font-mono text-[10px] opacity-70 sm:inline">→</kbd>
              </button>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-faint">
              ✅ {score.knew} · 🔁 {score.again}
            </span>
            <Link to={`${lessonPath(card.lesson)}#${card.qid.split('#')[1]}`} className="inline-flex items-center gap-1 font-semibold text-violet-500">
              Study in lesson <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="card mt-6 p-8 text-center">
          <div className="text-4xl">🎉</div>
          <div className="mt-2 text-xl font-bold">{deck.length ? 'Deck complete!' : 'No cards here yet'}</div>
          {deck.length > 0 && (
            <p className="mt-1 text-muted">
              You knew {score.knew} of {deck.length}. {score.again > 0 ? 'Shuffle and go again to lock in the rest.' : 'Flawless.'}
            </p>
          )}
          <button onClick={() => setSeed((s) => s + 1)} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 font-semibold text-white">
            Go again <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
