import { useEffect, useRef, useState } from 'react'

export function Ring({
  value,
  size = 44,
  stroke = 4,
  className = '',
  children,
  color = 'url(#ring-grad)',
}: {
  value: number
  size?: number
  stroke?: number
  className?: string
  children?: React.ReactNode
  color?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function Bar({ value, className = '', gradient = 'from-emerald-400 via-violet-500 to-orange-400' }: { value: number; className?: string; gradient?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div
        className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  )
}

/** Tiny dependency-free confetti burst. */
export function fireConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100'
  canvas.width = window.innerWidth * devicePixelRatio
  canvas.height = window.innerHeight * devicePixelRatio
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(devicePixelRatio, devicePixelRatio)
  const colors = ['#34d399', '#8b5cf6', '#f97316', '#22d3ee', '#f43f5e', '#facc15']
  const parts = Array.from({ length: 140 }, () => ({
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.65,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 16 - 6,
    r: Math.random() * 6 + 3,
    c: colors[(Math.random() * colors.length) | 0],
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.4,
  }))
  let frame = 0
  const tick = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    for (const p of parts) {
      p.vy += 0.45
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2)
      ctx.restore()
    }
    if (++frame < 150) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

/** Fraction of the page scrolled (0..1). */
export function useScrollProgress() {
  const [p, setP] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    const on = () => {
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => {
        const h = document.documentElement.scrollHeight - window.innerHeight
        setP(h > 0 ? window.scrollY / h : 0)
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return p
}
