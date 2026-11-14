import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Code, Flame, House, Layers, Moon, Search, Sun, Swords, Trophy, Zap } from 'lucide-react'
import { progress, rankFor, streak, today, useProgress } from '../lib/progress'
import { CommandPalette } from './CommandPalette'
import { Ring } from './ui'

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const d = !dark
    setDark(d)
    document.documentElement.classList.toggle('dark', d)
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', d ? '#0a0c16' : '#f7f8fc')
    try {
      localStorage.setItem('fl-theme', d ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }
  return { dark, toggle }
}

function XpToasts() {
  const [toasts, setToasts] = useState<{ id: number; amount: number; reason: string }[]>([])
  useEffect(
    () =>
      progress.onXp((amount, reason) => {
        const id = Math.random()
        setToasts((t) => [...t.slice(-2), { id, amount, reason }])
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200)
      }),
    [],
  )
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 md:bottom-6 md:items-end md:pr-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-pop flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-xl shadow-violet-500/30"
        >
          <Zap size={16} fill="currentColor" className="text-amber-300" /> +{t.amount} XP
          <span className="font-normal opacity-80">· {t.reason}</span>
        </div>
      ))}
    </div>
  )
}

const NAV = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: Swords },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/playground', label: 'Playground', icon: Code },
]

export default function Layout() {
  const { dark, toggle } = useTheme()
  const p = useProgress()
  const [palette, setPalette] = useState(false)
  const loc = useLocation()
  const st = streak(p.days)
  const todayXp = p.days[today()] || 0
  const rank = rankFor(p.xp)

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((v) => !v)
      } else if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,[contenteditable]')) {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  useEffect(() => {
    if (!loc.hash) window.scrollTo({ top: 0 })
  }, [loc.pathname, loc.hash])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="hidden sm:inline">
              Frontend<span className="bg-gradient-to-r from-violet-500 to-cyan-400 bg-clip-text text-transparent">Ladder</span>
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.slice(1).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => setPalette(true)}
            className="ml-auto flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm text-faint transition hover:text-ink sm:min-w-56"
            aria-label="Search"
          >
            <Search size={15} />
            <span className="hidden sm:inline">Search lessons & questions</span>
            <kbd className="ml-auto hidden rounded-md border border-line px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
          </button>
          <Link
            to="/progress"
            className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-surface-2"
            title={`${rank.name} · ${todayXp}/${p.dailyGoal} XP today`}
          >
            <span className={`flex items-center gap-0.5 text-sm font-bold ${st > 0 ? 'text-orange-500' : 'text-faint'}`}>
              <Flame size={17} fill={st > 0 ? 'currentColor' : 'none'} /> {st}
            </span>
            <Ring value={todayXp / p.dailyGoal} size={32} stroke={3.5}>
              <Trophy size={13} className="text-amber-500" />
            </Ring>
            <span className="hidden text-sm font-bold lg:inline">{p.xp.toLocaleString()} XP</span>
          </Link>
          <button onClick={toggle} className="rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="pb-24 md:pb-10">
        <Outlet />
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium ${isActive ? 'text-violet-500' : 'text-faint'}`
              }
            >
              <n.icon size={20} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <XpToasts />
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  )
}
