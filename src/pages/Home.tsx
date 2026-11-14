import { Link } from 'react-router-dom'
import { ArrowRight, Brain, Eye, Flame, Gamepad2, Layers, Play, Sparkles, Swords, Target, Trophy, Zap } from 'lucide-react'
import { allLessons, allQuestions, levels, lessonPath, getLesson, allCompanies } from '../lib/content'
import { rankFor, streak, today, useProgress } from '../lib/progress'
import { Bar, Ring } from '../components/ui'
import { DifficultyBadge } from '../components/Cards'

function hashDay(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

export default function Home() {
  const p = useProgress()
  const rank = rankFor(p.xp)
  const st = streak(p.days)
  const todayXp = p.days[today()] || 0
  const last = p.lastLesson ? getLesson(p.lastLesson) : undefined
  const nextUp = last && p.lessons[last.key] ? allLessons[allLessons.indexOf(last) + 1] : last
  const resume = nextUp || allLessons.find((l) => !p.lessons[l.key]) || allLessons[0]
  const challenges = allQuestions.filter((q) => q.kind === 'challenge')
  const daily = challenges.length ? challenges[hashDay(today()) % challenges.length] : undefined
  const stats = [
    { n: allLessons.length, l: 'lessons' },
    { n: allQuestions.filter((q) => q.kind === 'question').length, l: 'interview Qs' },
    { n: challenges.length, l: 'challenges' },
    { n: allLessons.reduce((a, l) => a + l.counts.visuals, 0), l: 'interactive visuals' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="glow-bg relative overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 sm:pt-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-semibold text-muted backdrop-blur">
              <Sparkles size={13} className="text-violet-500" /> FE1 → FE2 → FE3 · read, visualise, solve
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Climb the <span className="text-shimmer">frontend ladder</span>
              <br className="hidden sm:block" /> from first tag to staff engineer.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
              Learn how browsers and JavaScript <i>really</i> work, master React from the inside, and practise the exact
              questions companies ask — with interactive visuals, runnable challenges and instant answers.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to={lessonPath(resume)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110"
              >
                <Play size={18} fill="currentColor" /> {p.lastLesson ? 'Continue learning' : 'Start learning'}
              </Link>
              <Link to="/practice" className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3 font-semibold transition hover:border-violet-500/50">
                <Swords size={18} /> Practice questions
              </Link>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-4 gap-3">
              {stats.map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-extrabold sm:text-3xl">{s.n}</div>
                  <div className="text-xs text-muted">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        {/* Your progress strip */}
        <section className="-mt-4 grid gap-3 md:grid-cols-3">
          <Link to={lessonPath(resume)} className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 md:col-span-2">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
              <Play size={20} fill="currentColor" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-faint">{p.lastLesson ? 'Up next' : 'Start here'}</div>
              <div className="truncate font-semibold">{resume?.title}</div>
              <div className="truncate text-sm text-muted">{resume?.summary}</div>
            </div>
            <ArrowRight className="text-faint transition group-hover:translate-x-1 group-hover:text-ink" />
          </Link>
          <Link to="/progress" className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
            <Ring value={todayXp / p.dailyGoal} size={56} stroke={5}>
              <span className="text-xs font-bold">{Math.min(100, Math.round((todayXp / p.dailyGoal) * 100))}%</span>
            </Ring>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Flame size={16} className={st ? 'text-orange-500' : 'text-faint'} fill={st ? 'currentColor' : 'none'} /> {st} day streak
              </div>
              <div className="text-xs text-muted">
                {todayXp}/{p.dailyGoal} XP today · {rank.name}
              </div>
              <Bar value={rank.pct} className="mt-2 w-32" />
            </div>
          </Link>
        </section>

        {/* Levels */}
        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Three levels. One clear path.</h2>
              <p className="mt-1 text-muted">Each level builds on the last — from fundamentals to architecture.</p>
            </div>
            <Link to="/learn" className="hidden items-center gap-1 text-sm font-semibold text-violet-500 sm:flex">
              All courses <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {levels.map((lv, i) => {
              const done = lv.lessons.filter((l) => p.lessons[l.key]).length
              const total = lv.lessons.length || 1
              return (
                <Link key={lv.id} to={`/learn/${lv.id}`} className="card group relative overflow-hidden p-5 transition hover:-translate-y-1">
                  <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition group-hover:opacity-40 ${lv.gradient}`} />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className={`rounded-xl bg-gradient-to-r px-3 py-1 text-sm font-black text-white ${lv.gradient}`}>{lv.code}</span>
                      <Ring value={done / total} size={44}>
                        <span className="text-[10px] font-bold">{Math.round((done / total) * 100)}%</span>
                      </Ring>
                    </div>
                    <h3 className="mt-4 text-xl font-bold">{lv.title}</h3>
                    <p className="text-sm font-medium text-muted">{lv.tagline}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{lv.description}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {lv.modules.slice(0, 6).map((m) => (
                        <span key={m.id} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
                          {m.title}
                        </span>
                      ))}
                      {lv.modules.length > 6 && <span className="px-1 text-[11px] text-faint">+{lv.modules.length - 6} more</span>}
                    </div>
                    <div className="mt-5 flex items-center justify-between text-sm">
                      <span className="text-faint">
                        {lv.lessons.length} lessons · step {i + 1}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-violet-500 transition group-hover:gap-2">
                        {done ? 'Continue' : 'Begin'} <ArrowRight size={15} />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Daily challenge + how it works */}
        <section className="mt-14 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          {daily && (
            <Link
              to={`${lessonPath(daily.lesson)}#${daily.qid.split('#')[1]}`}
              className="card group relative overflow-hidden p-6 transition hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fuchsia-500">
                  <Target size={15} /> Challenge of the day
                </div>
                <h3 className="mt-3 text-xl font-bold leading-snug">{daily.title.replace(/`/g, '')}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <DifficultyBadge d={daily.difficulty} />
                  {daily.companies.map((c) => (
                    <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
                      {c}
                    </span>
                  ))}
                  <span className="text-xs text-faint">from “{daily.lesson.title}”</span>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white">
                  Solve it <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Eye, t: 'See it', d: 'Interactive visuals for the event loop, rendering, reconciliation & more.' },
              { icon: Brain, t: 'Understand it', d: 'Interview questions with full answers right where you read.' },
              { icon: Gamepad2, t: 'Solve it', d: 'Challenges with hints, hidden answers and a test-running editor.' },
              { icon: Trophy, t: 'Keep at it', d: 'XP, streaks, ranks and flashcards to make it stick.' },
            ].map((f) => (
              <div key={f.t} className="card p-4">
                <f.icon size={20} className="text-violet-500" />
                <div className="mt-2 font-semibold">{f.t}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted">{f.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick modes */}
        <section className="mt-14 grid gap-3 sm:grid-cols-3">
          <Link to="/flashcards" className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
            <Layers className="text-cyan-500" />
            <div>
              <div className="font-semibold">Interview flashcards</div>
              <div className="text-sm text-muted">Rapid-fire revision before an interview</div>
            </div>
          </Link>
          <Link to="/practice?kind=challenge" className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
            <Zap className="text-amber-500" />
            <div>
              <div className="font-semibold">Coding challenges</div>
              <div className="text-sm text-muted">Polyfills, machine coding, DSA</div>
            </div>
          </Link>
          <Link to="/playground" className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
            <Play className="text-emerald-500" />
            <div>
              <div className="font-semibold">JS playground</div>
              <div className="text-sm text-muted">Test an idea instantly</div>
            </div>
          </Link>
        </section>

        {allCompanies.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-bold">Questions reported from interviews at</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {allCompanies.slice(0, 40).map((c) => (
                <Link key={c} to={`/practice?company=${encodeURIComponent(c)}`} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted transition hover:border-violet-500/50 hover:text-ink">
                  {c}
                </Link>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-16 border-t border-line py-8 text-center text-sm text-faint">
          Frontend Ladder — learn by reading, seeing and solving. Progress is saved in your browser.
        </footer>
      </div>
    </div>
  )
}
