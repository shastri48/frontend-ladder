import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

export function Frame({
  title,
  subtitle,
  children,
  controls,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  controls?: ReactNode
}) {
  return (
    <figure className="not-prose card my-8 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-gradient-to-r from-violet-500/[0.08] via-cyan-500/[0.05] to-transparent px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
            <Sparkles size={13} /> Interactive visual
          </div>
          <figcaption className="text-[1.02rem] font-semibold tracking-tight">{title}</figcaption>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </figure>
  )
}

export function Btn({
  children,
  onClick,
  active,
  disabled,
  primary,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  primary?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
        primary
          ? 'bg-violet-600 text-white hover:bg-violet-500'
          : active
            ? 'bg-ink text-bg'
            : 'bg-surface-2 text-muted ring-1 ring-line hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = '',
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (n: number) => void
  suffix?: string
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-500"
      />
      <span className="w-14 shrink-0 text-right font-mono text-xs">
        {value}
        {suffix}
      </span>
    </label>
  )
}

export function Stepper({
  step,
  total,
  setStep,
  playing,
  setPlaying,
}: {
  step: number
  total: number
  setStep: (n: number) => void
  playing?: boolean
  setPlaying?: (b: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Btn onClick={() => setStep(0)} disabled={step === 0} title="Restart">
        ⟲
      </Btn>
      <Btn onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
        ← Prev
      </Btn>
      {setPlaying && (
        <Btn onClick={() => setPlaying(!playing)} active={playing}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </Btn>
      )}
      <Btn primary onClick={() => setStep(Math.min(total - 1, step + 1))} disabled={step >= total - 1}>
        Next →
      </Btn>
      <span className="font-mono text-xs text-faint">
        {step + 1}/{total}
      </span>
    </div>
  )
}
