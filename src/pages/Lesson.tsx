import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Brain, ChevronRight, CircleCheck, Clock, Eye, List, PartyPopper, Swords, X } from 'lucide-react'
import { getLesson, getLevel, getModule, lessonPath, neighbours, useLessonBlocks, XP, type Lesson } from '../lib/content'
import type { Block } from '../lib/parser'
import { progress, useProgress } from '../lib/progress'
import { Markdown } from '../components/Markdown'
import { Callout, ChallengeCard, QuestionCard, QuizCard } from '../components/Cards'
import { Visual } from '../visuals'
import { fireConfetti, useScrollProgress } from '../components/ui'

function Blocks({ lesson, blocks }: { lesson: Lesson; blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        const qid = 'id' in b ? `${lesson.key}#${b.id}` : ''
        switch (b.type) {
          case 'md':
            return <Markdown key={i} text={b.text} />
          case 'visual':
            return <Visual key={i} id={b.id} />
          case 'callout':
            return <Callout key={i} {...b} />
          case 'question':
            return <QuestionCard key={i} block={b} qid={qid} />
          case 'challenge':
            return <ChallengeCard key={i} block={b} qid={qid} />
          case 'quiz':
            return <QuizCard key={i} block={b} qid={qid} />
          default:
            return <Fragment key={i} />
        }
      })}
    </>
  )
}

function useActiveHeading(ids: string[], ready: boolean) {
  const [active, setActive] = useState<string>('')
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: '-80px 0px -70% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [ids, ready])
  return active
}

function ModuleNav({ lesson, onPick }: { lesson: Lesson; onPick?: () => void }) {
  const p = useProgress()
  const lv = getLevel(lesson.level)!
  return (
    <nav className="space-y-5 text-sm">
      {lv.modules
        .filter((m) => m.lessons.length)
        .map((m) => (
          <div key={m.id}>
            <div className={`mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wider ${m.id === lesson.moduleId ? 'text-ink' : 'text-faint'}`}>{m.title}</div>
            {(
              <ul className="space-y-0.5">
                {m.lessons.map((l) => (
                  <li key={l.key}>
                    <Link
                      to={lessonPath(l)}
                      onClick={onPick}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                        l.key === lesson.key ? 'bg-violet-500/12 font-semibold text-violet-700 dark:text-violet-300' : 'text-muted hover:bg-surface-2 hover:text-ink'
                      }`}
                    >
                      {p.lessons[l.key] ? (
                        <CircleCheck size={14} className="shrink-0 text-emerald-500" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-line" />
                      )}
                      <span className="truncate">{l.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
    </nav>
  )
}

export default function LessonPage() {
  const { level = '', module = '', lesson: slug = '' } = useParams()
  const key = `${level}/${module}/${slug}`
  const lesson = getLesson(key)
  const p = useProgress()
  const loc = useLocation()
  const nav = useNavigate()
  const scroll = useScrollProgress()
  const [drawer, setDrawer] = useState(false)
  const blocks = useLessonBlocks(lesson?.key)
  const toc = useMemo(() => lesson?.toc ?? [], [lesson])
  const tocIds = useMemo(() => toc.map((t) => t.id), [toc])
  const active = useActiveHeading(tocIds, !!blocks)

  useEffect(() => {
    if (lesson) progress.setLastLesson(lesson.key)
  }, [lesson])

  useEffect(() => {
    if (!loc.hash) return
    const id = decodeURIComponent(loc.hash.slice(1))
    let tries = 0
    const t = setInterval(() => {
      const el = document.getElementById(id)
      if (el || ++tries > 20) {
        clearInterval(t)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        el?.classList.add('ring-2', 'ring-violet-500')
        setTimeout(() => el?.classList.remove('ring-2', 'ring-violet-500'), 2000)
      }
    }, 100)
    return () => clearInterval(t)
  }, [loc.hash, key, !!blocks])

  if (!lesson) {
    const m = getModule(level, module)
    if (m?.lessons[0]) return <Navigate to={lessonPath(m.lessons[0])} replace />
    return <Navigate to={getLevel(level) ? `/learn/${level}` : '/learn'} replace />
  }

  const lv = getLevel(lesson.level)!
  const mod = getModule(lesson.level, lesson.moduleId)!
  const { prev, next } = neighbours(lesson.key)
  const done = !!p.lessons[lesson.key]
  const idxInModule = mod.lessons.indexOf(lesson)

  const complete = () => {
    if (!done) {
      progress.completeLesson(lesson.key, XP.lesson)
      fireConfetti()
    }
    if (next) setTimeout(() => nav(lessonPath(next)), done ? 0 : 900)
  }

  return (
    <div>
      <div className="fixed inset-x-0 top-14 z-30 h-0.5 bg-transparent">
        <div className={`h-full bg-gradient-to-r ${lv.gradient}`} style={{ width: `${scroll * 100}%` }} />
      </div>

      <div className="mx-auto grid max-w-[90rem] gap-8 px-4 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
        {/* Left: module navigation */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto py-8 pr-2 lg:block">
          <Link to={`/learn/${lv.id}`} className="mb-5 flex items-center gap-2">
            <span className={`rounded-lg bg-gradient-to-r px-2 py-0.5 text-xs font-black text-white ${lv.gradient}`}>{lv.code}</span>
            <span className="text-sm font-semibold">{lv.title}</span>
          </Link>
          <ModuleNav lesson={lesson} />
        </aside>

        {/* Content */}
        <article className="min-w-0 py-8">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center gap-1 text-xs text-faint">
              <Link to={`/learn/${lv.id}`} className="font-semibold hover:text-ink">
                {lv.code}
              </Link>
              <ChevronRight size={12} />
              <span>{mod.title}</span>
              <ChevronRight size={12} />
              <span>
                Lesson {idxInModule + 1} of {mod.lessons.length}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.6rem]">{lesson.title}</h1>
            {lesson.summary && <p className="mt-3 text-lg leading-relaxed text-muted">{lesson.summary}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-muted ring-1 ring-line">
                <Clock size={13} /> {lesson.minutes} min
              </span>
              {lesson.counts.visuals > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-600 dark:text-violet-300">
                  <Eye size={13} /> {lesson.counts.visuals} visual{lesson.counts.visuals > 1 ? 's' : ''}
                </span>
              )}
              {lesson.counts.questions > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-600 dark:text-sky-300">
                  <Brain size={13} /> {lesson.counts.questions} questions
                </span>
              )}
              {lesson.counts.challenges > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-600 dark:text-fuchsia-300">
                  <Swords size={13} /> {lesson.counts.challenges} challenges
                </span>
              )}
              {done && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 font-semibold text-emerald-600 dark:text-emerald-300">
                  <CircleCheck size={13} /> Completed
                </span>
              )}
            </div>

            <div className="mt-8">
              {blocks ? (
                <Blocks lesson={lesson} blocks={blocks} />
              ) : (
                <div className="space-y-4">
                  {[90, 75, 95, 60, 85].map((w, i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
                  ))}
                  <div className="card h-56 animate-pulse" />
                </div>
              )}
            </div>

            {/* Completion */}
            <div className="card mt-14 overflow-hidden">
              <div className={`h-1 bg-gradient-to-r ${lv.gradient}`} />
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <PartyPopper className="text-violet-500" />
                <div className="text-lg font-bold">{done ? 'Lesson complete!' : 'Finished reading?'}</div>
                <p className="max-w-md text-sm text-muted">
                  {done ? 'Nice work. Keep the streak alive with the next lesson.' : `Mark it complete to earn +${XP.lesson} XP and move on.`}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={complete}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-violet-500/25 hover:brightness-110"
                  >
                    <CircleCheck size={18} /> {done ? (next ? 'Next lesson' : 'All done') : next ? 'Complete & continue' : 'Complete'}
                  </button>
                  {done && (
                    <button onClick={() => progress.uncompleteLesson(lesson.key)} className="rounded-2xl px-3 py-2.5 text-sm text-faint hover:text-ink">
                      Mark as not done
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {prev ? (
                <Link to={lessonPath(prev)} className="card group p-4 transition hover:-translate-y-0.5">
                  <div className="flex items-center gap-1 text-xs text-faint">
                    <ArrowLeft size={13} /> Previous
                  </div>
                  <div className="mt-1 truncate font-semibold">{prev.title}</div>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link to={lessonPath(next)} className="card group p-4 text-right transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-end gap-1 text-xs text-faint">
                    Next <ArrowRight size={13} />
                  </div>
                  <div className="mt-1 truncate font-semibold">{next.title}</div>
                </Link>
              )}
            </div>
          </div>
        </article>

        {/* Right: TOC */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto py-8 xl:block">
          {toc.length > 0 && (
            <>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">On this page</div>
              <ul className="space-y-1 border-l border-line text-[13px]">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className={`-ml-px block border-l-2 py-1 pl-3 transition ${active === t.id ? 'border-violet-500 font-medium text-ink' : 'border-transparent text-faint hover:text-ink'}`}
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {/* Mobile lesson drawer */}
      <button
        onClick={() => setDrawer(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-bg shadow-xl lg:hidden"
      >
        <List size={16} /> Lessons
      </button>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="animate-pop absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 safe-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-bold">
                {lv.code} · {lv.title}
              </span>
              <button onClick={() => setDrawer(false)} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <ModuleNav lesson={lesson} onPick={() => setDrawer(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
