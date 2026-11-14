import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Award, Bookmark, Download, Flame, Lock, RotateCcw, Trophy, Upload, Zap } from 'lucide-react'
import { allLessons, allQuestions, levels, lessonPath } from '../lib/content'
import { iconFor } from '../lib/icons'
import { progress, rankFor, RANKS, streak, today, useProgress } from '../lib/progress'
import { Bar, Ring } from '../components/ui'

function Heatmap({ days }: { days: Record<string, number> }) {
  const weeks = 18
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - (weeks * 7 - 1) - end.getDay())
  const cells: { d: string; v: number }[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    if (d > end) break
    cells.push({ d: today(d), v: days[today(d)] || 0 })
  }
  const lvl = (v: number) => (v === 0 ? 'bg-surface-3' : v < 30 ? 'bg-violet-500/30' : v < 80 ? 'bg-violet-500/55' : v < 150 ? 'bg-violet-500/80' : 'bg-fuchsia-500')
  return (
    <div className="overflow-x-auto">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
        {cells.map((c) => (
          <div key={c.d} title={`${c.d}: ${c.v} XP`} className={`h-3.5 w-3.5 rounded-[4px] ${lvl(c.v)}`} />
        ))}
      </div>
    </div>
  )
}

export default function ProgressPage() {
  const p = useProgress()
  const rank = rankFor(p.xp)
  const st = streak(p.days)
  const file = useRef<HTMLInputElement>(null)
  const theory = allQuestions.filter((q) => q.kind === 'question')
  const chall = allQuestions.filter((q) => q.kind === 'challenge')
  const understood = theory.filter((q) => p.understood[q.qid]).length
  const solved = chall.filter((q) => p.solved[q.qid]).length
  const quizzes = Object.values(p.quizzes)
  const bookmarked = allQuestions.filter((q) => p.bookmarks[q.qid])

  const exportJson = () => {
    const blob = new Blob([progress.export()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'frontend-ladder-progress.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="card relative overflow-hidden p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/15 via-transparent to-orange-500/10" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Ring value={rank.pct} size={110} stroke={9}>
            <Trophy className="text-amber-500" size={34} />
          </Ring>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-faint">Rank {rank.index + 1} of {RANKS.length}</div>
            <h1 className="text-3xl font-extrabold tracking-tight">{rank.name}</h1>
            <div className="mt-1 text-muted">
              <b className="text-ink">{p.xp.toLocaleString()} XP</b>
              {rank.next && (
                <>
                  {' '}
                  · {(rank.next.min - p.xp).toLocaleString()} XP to <b className="text-ink">{rank.next.name}</b>
                </>
              )}
            </div>
            <Bar value={rank.pct} className="mt-3 max-w-md" />
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <Flame className={`mx-auto ${st ? 'text-orange-500' : 'text-faint'}`} fill={st ? 'currentColor' : 'none'} />
              <div className="text-2xl font-extrabold">{st}</div>
              <div className="text-xs text-faint">day streak</div>
            </div>
            <div className="text-center">
              <Zap className="mx-auto text-amber-500" />
              <div className="text-2xl font-extrabold">{p.days[today()] || 0}</div>
              <div className="text-xs text-faint">XP today</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: 'Lessons completed', v: `${Object.keys(p.lessons).length}/${allLessons.length}` },
          { l: 'Concepts understood', v: `${understood}/${theory.length}` },
          { l: 'Challenges solved', v: `${solved}/${chall.length}` },
          { l: 'Quiz accuracy', v: quizzes.length ? `${Math.round((quizzes.filter(Boolean).length / quizzes.length) * 100)}%` : '—' },
        ].map((s) => (
          <div key={s.l} className="card p-4">
            <div className="text-2xl font-extrabold">{s.v}</div>
            <div className="text-xs text-muted">{s.l}</div>
          </div>
        ))}
      </div>

      <section className="card mt-4 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Activity</h2>
          <label className="flex items-center gap-2 text-sm text-muted">
            Daily goal
            <select value={p.dailyGoal} onChange={(e) => progress.setDailyGoal(+e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-sm">
              {[50, 100, 150, 250, 400].map((n) => (
                <option key={n} value={n}>
                  {n} XP
                </option>
              ))}
            </select>
          </label>
        </div>
        <Heatmap days={p.days} />
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Award className="text-violet-500" /> Module badges
        </h2>
        <p className="text-sm text-muted">Complete every lesson in a module to unlock its badge.</p>
        {levels.map((lv) => (
          <div key={lv.id} className="mt-4">
            <div className="mb-2 text-sm font-semibold">
              {lv.code} · {lv.title}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {lv.modules.map((m) => {
                const Icon = iconFor(m.icon)
                const done = m.lessons.filter((l) => p.lessons[l.key]).length
                const unlocked = m.lessons.length > 0 && done === m.lessons.length
                return (
                  <div key={m.id} title={`${m.title}: ${done}/${m.lessons.length}`} className="flex flex-col items-center gap-1.5 text-center">
                    <div
                      className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${
                        unlocked ? `bg-gradient-to-br text-white shadow-lg ${lv.gradient}` : 'bg-surface-2 text-faint ring-1 ring-line'
                      }`}
                    >
                      <Icon size={24} />
                      {!unlocked && <Lock size={12} className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5" />}
                    </div>
                    <span className="line-clamp-2 text-[10.5px] leading-tight text-muted">{m.title}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Bookmark className="text-amber-500" /> Bookmarked for revision
        </h2>
        {bookmarked.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Tap the bookmark icon on any question to save it here.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {bookmarked.map((q) => (
              <li key={q.qid}>
                <Link to={`${lessonPath(q.lesson)}#${q.qid.split('#')[1]}`} className="card block p-3 text-sm transition hover:-translate-y-0.5">
                  <span className="font-medium">{q.title.replace(/`/g, '')}</span>
                  <span className="block text-xs text-faint">{q.lesson.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
        <button onClick={exportJson} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium">
          <Download size={15} /> Export progress
        </button>
        <button onClick={() => file.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium">
          <Upload size={15} /> Import
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              progress.import(await f.text())
            } catch {
              alert('That file could not be read.')
            }
          }}
        />
        <button
          onClick={() => confirm('Reset all progress? This cannot be undone.') && progress.reset()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-500 hover:bg-rose-500/10"
        >
          <RotateCcw size={15} /> Reset progress
        </button>
      </section>
    </div>
  )
}
