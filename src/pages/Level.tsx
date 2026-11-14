import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, Brain, CircleCheck, Clock, Eye, Swords } from 'lucide-react'
import { getLevel, levels, lessonPath, type Level as LevelT } from '../lib/content'
import { iconFor } from '../lib/icons'
import { useProgress } from '../lib/progress'
import { Bar, Ring } from '../components/ui'

export function LearnIndex() {
  const p = useProgress()
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Courses</h1>
      <p className="mt-2 text-muted">Pick your level. Each one is a complete course you can go through in order.</p>
      <div className="mt-8 space-y-10">
        {levels.map((lv) => (
          <LevelSection key={lv.id} lv={lv} done={lv.lessons.filter((l) => p.lessons[l.key]).length} />
        ))}
      </div>
    </div>
  )
}

function LevelSection({ lv, done }: { lv: LevelT; done: number }) {
  return (
    <section>
      <Link to={`/learn/${lv.id}`} className="group flex items-center gap-3">
        <span className={`rounded-xl bg-gradient-to-r px-3 py-1 text-sm font-black text-white ${lv.gradient}`}>{lv.code}</span>
        <h2 className="text-xl font-bold">{lv.title}</h2>
        <span className="text-sm text-faint">
          {done}/{lv.lessons.length}
        </span>
        <ArrowRight size={16} className="text-faint transition group-hover:translate-x-1" />
      </Link>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lv.modules.map((m) => (
          <ModuleCard key={m.id} levelId={lv.id} moduleId={m.id} />
        ))}
      </div>
    </section>
  )
}

function ModuleCard({ levelId, moduleId }: { levelId: string; moduleId: string }) {
  const p = useProgress()
  const lv = getLevel(levelId)!
  const m = lv.modules.find((x) => x.id === moduleId)!
  const Icon = iconFor(m.icon)
  const done = m.lessons.filter((l) => p.lessons[l.key]).length
  const first = m.lessons.find((l) => !p.lessons[l.key]) || m.lessons[0]
  return (
    <Link
      to={first ? lessonPath(first) : `/learn/${levelId}`}
      className={`card group flex flex-col p-4 transition hover:-translate-y-0.5 ${m.lessons.length ? '' : 'pointer-events-none opacity-50'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${lv.gradient}`}>
          <Icon size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{m.title}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-muted">{m.blurb}</div>
        </div>
        {done === m.lessons.length && m.lessons.length > 0 && <CircleCheck size={18} className="shrink-0 text-emerald-500" />}
      </div>
      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex justify-between text-[11px] text-faint">
          <span>{m.lessons.length ? `${m.lessons.length} lessons` : 'Coming soon'}</span>
          <span>
            {done}/{m.lessons.length}
          </span>
        </div>
        <Bar value={m.lessons.length ? done / m.lessons.length : 0} gradient={lv.gradient} />
      </div>
    </Link>
  )
}

export default function LevelPage() {
  const { level } = useParams()
  const p = useProgress()
  const lv = getLevel(level || '')
  if (!lv) return <Navigate to="/learn" replace />
  const done = lv.lessons.filter((l) => p.lessons[l.key]).length
  const q = lv.lessons.reduce((a, l) => a + l.counts.questions, 0)
  const c = lv.lessons.reduce((a, l) => a + l.counts.challenges, 0)
  const v = lv.lessons.reduce((a, l) => a + l.counts.visuals, 0)
  const next = lv.lessons.find((l) => !p.lessons[l.key]) || lv.lessons[0]

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className={`absolute inset-0 bg-gradient-to-br opacity-[0.12] ${lv.gradient}`} />
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center">
          <div className="flex-1">
            <span className={`rounded-xl bg-gradient-to-r px-3 py-1 text-sm font-black text-white ${lv.gradient}`}>{lv.code}</span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">{lv.title}</h1>
            <p className="mt-1 text-lg font-medium text-muted">{lv.tagline}</p>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted">{lv.description}</p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Clock size={15} /> {Math.round(lv.lessons.reduce((a, l) => a + l.minutes, 0) / 60)} hours
              </span>
              <span className="flex items-center gap-1.5">
                <Brain size={15} /> {q} questions
              </span>
              <span className="flex items-center gap-1.5">
                <Swords size={15} /> {c} challenges
              </span>
              <span className="flex items-center gap-1.5">
                <Eye size={15} /> {v} visuals
              </span>
            </div>
            {next && (
              <Link to={lessonPath(next)} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 font-semibold text-bg transition hover:opacity-90">
                {done ? 'Continue' : 'Start'}: {next.title} <ArrowRight size={17} />
              </Link>
            )}
          </div>
          <Ring value={lv.lessons.length ? done / lv.lessons.length : 0} size={130} stroke={10}>
            <div className="text-center">
              <div className="text-2xl font-extrabold">{lv.lessons.length ? Math.round((done / lv.lessons.length) * 100) : 0}%</div>
              <div className="text-[11px] text-faint">
                {done}/{lv.lessons.length} lessons
              </div>
            </div>
          </Ring>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-10">
        <ol className="relative space-y-8 border-l-2 border-dashed border-line pl-6 sm:pl-8">
          {lv.modules.map((m, mi) => {
            const Icon = iconFor(m.icon)
            const mdone = m.lessons.filter((l) => p.lessons[l.key]).length
            return (
              <li key={m.id} className="relative">
                <span className={`absolute -left-[2.35rem] flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg sm:-left-[2.85rem] ${lv.gradient}`}>
                  <Icon size={17} />
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-bold">
                    <span className="mr-2 font-mono text-sm text-faint">{String(mi + 1).padStart(2, '0')}</span>
                    {m.title}
                  </h2>
                  <span className="shrink-0 text-xs text-faint">
                    {mdone}/{m.lessons.length}
                  </span>
                </div>
                <p className="text-sm text-muted">{m.blurb}</p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
                  {m.lessons.length === 0 && <div className="p-4 text-sm text-faint">Lessons coming soon.</div>}
                  {m.lessons.map((l) => {
                    const ok = !!p.lessons[l.key]
                    return (
                      <Link key={l.key} to={lessonPath(l)} className="group flex items-center gap-3 border-b border-line px-4 py-3 transition last:border-0 hover:bg-surface-2/60">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-emerald-500 text-white' : 'border-2 border-line'}`}>
                          {ok && <CircleCheck size={15} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.95rem] font-medium">{l.title}</span>
                          <span className="block truncate text-xs text-faint">{l.summary}</span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-3 text-xs text-faint sm:flex">
                          {l.counts.visuals > 0 && (
                            <span className="flex items-center gap-1">
                              <Eye size={13} /> {l.counts.visuals}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Brain size={13} /> {l.counts.questions + l.counts.challenges}
                          </span>
                          <span>{l.minutes} min</span>
                        </span>
                        <ArrowRight size={15} className="shrink-0 text-faint transition group-hover:translate-x-0.5" />
                      </Link>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
