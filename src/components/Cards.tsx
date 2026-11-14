import { lazy, Suspense, useState, type ReactNode } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  Brain,
  Check,
  CircleCheck,
  Code,
  Eye,
  EyeOff,
  Info,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  OctagonAlert,
  Sparkles,
  Swords,
  TriangleAlert,
} from 'lucide-react'
import { Markdown } from './Markdown'
import { renderInline } from '../lib/markdown'
import type { Block, Difficulty, QMeta } from '../lib/parser'
import { progress, useProgress } from '../lib/progress'
import { XP } from '../lib/content'

const Playground = lazy(() => import('./Playground'))

const DIFF: Record<Difficulty, string> = {
  easy: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30',
  medium: 'bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/30',
  hard: 'bg-rose-500/12 text-rose-600 dark:text-rose-300 ring-rose-500/30',
}

export function DifficultyBadge({ d }: { d: Difficulty }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${DIFF[d]}`}>{d}</span>
  )
}

function MetaRow({ meta, kind }: { meta: QMeta; kind: 'question' | 'challenge' }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
          kind === 'question'
            ? 'bg-sky-500/12 text-sky-600 dark:text-sky-300'
            : 'bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-300'
        }`}
      >
        {kind === 'question' ? <Brain size={12} /> : <Swords size={12} />}
        {kind === 'question' ? 'Interview Q' : 'Challenge'}
      </span>
      <DifficultyBadge d={meta.difficulty} />
      {meta.companies.map((c) => (
        <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">
          {c}
        </span>
      ))}
    </div>
  )
}

function BookmarkBtn({ id }: { id: string }) {
  const p = useProgress()
  const on = !!p.bookmarks[id]
  return (
    <button
      onClick={() => progress.toggleBookmark(id)}
      className={`rounded-lg p-1.5 transition hover:bg-surface-2 ${on ? 'text-amber-500' : 'text-faint'}`}
      title={on ? 'Remove bookmark' : 'Bookmark for revision'}
      aria-label={on ? 'Remove bookmark' : 'Bookmark'}
    >
      {on ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
    </button>
  )
}

export function QuestionCard({
  block,
  qid,
}: {
  block: Extract<Block, { type: 'question' }>
  qid: string
}) {
  const p = useProgress()
  const done = !!p.understood[qid]
  return (
    <section id={block.id} className="card my-6 scroll-mt-20 overflow-hidden">
      <div className="border-b border-line bg-gradient-to-r from-sky-500/[0.07] to-transparent px-4 pb-3 pt-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <MetaRow meta={block.meta} kind="question" />
          <BookmarkBtn id={qid} />
        </div>
        <h3
          className="mt-2 text-[1.08rem] font-semibold leading-snug tracking-tight"
          dangerouslySetInnerHTML={{ __html: renderInline(block.title) }}
        />
      </div>
      <div className="px-4 py-4 sm:px-5">
        <Markdown text={block.body} compact />
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => progress.markUnderstood(qid, XP.understood)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              done
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                : 'bg-surface-2 text-muted ring-1 ring-line hover:text-ink'
            }`}
          >
            {done ? <CircleCheck size={16} /> : <Check size={16} />}
            {done ? 'Understood' : `Got it · +${XP.understood} XP`}
          </button>
        </div>
      </div>
    </section>
  )
}

export function ChallengeCard({
  block,
  qid,
}: {
  block: Extract<Block, { type: 'challenge' }>
  qid: string
}) {
  const p = useProgress()
  const [showAnswer, setShowAnswer] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [tryIt, setTryIt] = useState(false)
  const solved = p.solved[qid]
  const runnable = !!(block.starter || block.tests)

  return (
    <section id={block.id} className="card my-6 scroll-mt-20 overflow-hidden ring-1 ring-fuchsia-500/10">
      <div className="border-b border-line bg-gradient-to-r from-fuchsia-500/[0.08] via-violet-500/[0.04] to-transparent px-4 pb-3 pt-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <MetaRow meta={block.meta} kind="challenge" />
          <div className="flex items-center gap-1">
            {solved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                <CircleCheck size={12} /> {solved === 'tests' ? 'Passed' : 'Solved'}
              </span>
            )}
            <BookmarkBtn id={qid} />
          </div>
        </div>
        <h3
          className="mt-2 text-[1.08rem] font-semibold leading-snug tracking-tight"
          dangerouslySetInnerHTML={{ __html: renderInline(block.title) }}
        />
      </div>
      <div className="px-4 py-4 sm:px-5">
        {block.prompt && <Markdown text={block.prompt} compact />}

        <div className="mt-4 flex flex-wrap gap-2">
          {runnable && (
            <button
              onClick={() => setTryIt((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            >
              <Code size={16} /> {tryIt ? 'Hide editor' : 'Try it yourself'}
            </button>
          )}
          {block.hint && (
            <button
              onClick={() => setShowHint((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/12 px-3.5 py-2 text-sm font-semibold text-amber-700 ring-1 ring-amber-500/25 hover:bg-amber-500/20 dark:text-amber-300"
            >
              <Lightbulb size={16} /> {showHint ? 'Hide hint' : 'Hint'}
            </button>
          )}
          <button
            onClick={() => setShowAnswer((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-500"
          >
            {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />} {showAnswer ? 'Hide answer' : 'Show answer'}
          </button>
          {!solved && (
            <button
              onClick={() => progress.markSolved(qid, 'self', XP.selfSolved)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3.5 py-2 text-sm font-medium text-muted ring-1 ring-line hover:text-ink"
            >
              <Check size={16} /> I solved it
            </button>
          )}
        </div>

        {showHint && block.hint && (
          <div className="animate-reveal mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5">
            <Markdown text={block.hint} compact />
          </div>
        )}

        {tryIt && runnable && (
          <div className="animate-reveal mt-4">
            <Suspense
              fallback={
                <div className="flex h-40 items-center justify-center rounded-xl border border-line text-faint">
                  <Loader2 className="animate-spin" />
                </div>
              }
            >
              <Playground
                initial={block.starter || '// write your solution here\n'}
                tests={block.tests}
                storageKey={qid}
                onAllPass={() => progress.markSolved(qid, 'tests', XP.challenge)}
              />
            </Suspense>
            {block.tests && (
              <p className="mt-2 text-xs text-faint">
                Pass all tests to earn +{XP.challenge} XP. Your code is saved in this browser.
              </p>
            )}
          </div>
        )}

        {showAnswer && (
          <div className="animate-reveal mt-4 rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
              <Sparkles size={14} /> Answer
            </div>
            <Markdown text={block.solution || '_No solution provided._'} compact />
          </div>
        )}
      </div>
    </section>
  )
}

export function QuizCard({ block, qid }: { block: Extract<Block, { type: 'quiz' }>; qid: string }) {
  const p = useProgress()
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null
  const prior = p.quizzes[qid]
  const correctIdx = block.options.findIndex((o) => o.correct)

  const pick = (i: number) => {
    if (answered) return
    setPicked(i)
    progress.answerQuiz(qid, i === correctIdx, XP.quiz)
  }

  return (
    <section className="card my-6 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-gradient-to-r from-cyan-500/[0.08] to-transparent px-4 py-2.5 sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
          <Sparkles size={14} /> Quick check
        </span>
        {prior !== undefined && !answered && (
          <span className="text-xs text-faint">{prior ? 'You got this right before' : 'Try again'}</span>
        )}
      </div>
      <div className="px-4 py-4 sm:px-5">
        <Markdown text={block.title} compact className="font-medium" />
        <div className="mt-3 grid gap-2">
          {block.options.map((o, i) => {
            const isPicked = picked === i
            const show = answered && (o.correct || isPicked)
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={answered}
                className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[0.95rem] transition ${
                  show
                    ? o.correct
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-rose-500/50 bg-rose-500/10'
                    : 'border-line bg-surface hover:border-cyan-500/50 hover:bg-cyan-500/5'
                } ${answered && !show ? 'opacity-60' : ''}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                    show
                      ? o.correct
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-rose-500 bg-rose-500 text-white'
                      : 'border-line text-faint'
                  }`}
                >
                  {show ? (o.correct ? '✓' : '✗') : String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]" dangerouslySetInnerHTML={{ __html: renderInline(o.text) }} />
              </button>
            )
          })}
        </div>
        {answered && (
          <div className="animate-reveal mt-3">
            <div
              className={`mb-1 text-sm font-semibold ${
                picked === correctIdx ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
              }`}
            >
              {picked === correctIdx
                ? prior === undefined
                  ? `Correct! +${XP.quiz} XP`
                  : 'Correct!'
                : 'Not quite.'}
            </div>
            {block.explain && <Markdown text={block.explain} compact className="text-[0.95rem]" />}
            <button onClick={() => setPicked(null)} className="mt-2 text-xs font-medium text-faint hover:text-ink">
              Reset
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

const CALLOUTS: Record<string, { icon: ReactNode; label: string; cls: string }> = {
  tip: { icon: <Lightbulb size={16} />, label: 'Tip', cls: 'border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300' },
  info: { icon: <Info size={16} />, label: 'Note', cls: 'border-sky-500/40 bg-sky-500/[0.07] text-sky-700 dark:text-sky-300' },
  warn: { icon: <TriangleAlert size={16} />, label: 'Watch out', cls: 'border-amber-500/40 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300' },
  danger: { icon: <OctagonAlert size={16} />, label: 'Danger', cls: 'border-rose-500/40 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300' },
  analogy: { icon: <Sparkles size={16} />, label: 'Analogy', cls: 'border-violet-500/40 bg-violet-500/[0.07] text-violet-700 dark:text-violet-300' },
  interview: { icon: <MessageSquareQuote size={16} />, label: 'Interview lens', cls: 'border-fuchsia-500/40 bg-fuchsia-500/[0.07] text-fuchsia-700 dark:text-fuchsia-300' },
}

export function Callout({ kind, title, body }: { kind: string; title: string; body: string }) {
  const c = CALLOUTS[kind] || CALLOUTS.info
  return (
    <aside className={`my-6 rounded-2xl border-l-4 border-y border-r border-y-transparent border-r-transparent px-4 py-3.5 ${c.cls}`}>
      <div className="mb-1 flex items-center gap-1.5 text-sm font-bold">
        {c.icon} {title || c.label}
      </div>
      <Markdown text={body} compact className="text-[0.97rem]" />
    </aside>
  )
}
