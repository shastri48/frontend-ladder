import { useMemo, useState } from 'react'
import { Btn, Frame, Slider } from './Frame'

/* ------------------------------------------------------------------ */
/* Box model                                                            */
/* ------------------------------------------------------------------ */

export function BoxModel() {
  const [margin, setMargin] = useState(20)
  const [border, setBorder] = useState(6)
  const [padding, setPadding] = useState(18)
  const [width, setWidth] = useState(160)
  const [borderBox, setBorderBox] = useState(false)

  const rendered = borderBox ? width : width + 2 * padding + 2 * border
  const content = borderBox ? Math.max(0, width - 2 * padding - 2 * border) : width

  return (
    <Frame
      title="The CSS box model"
      subtitle="Every element is a box: content → padding → border → margin."
      controls={
        <>
          <Btn active={!borderBox} onClick={() => setBorderBox(false)}>
            content-box
          </Btn>
          <Btn active={borderBox} onClick={() => setBorderBox(true)}>
            border-box
          </Btn>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <div className="flex items-center justify-center overflow-x-auto rounded-xl bg-surface-2/50 p-3">
          <div className="relative bg-amber-400/25" style={{ padding: margin }}>
            <span className="absolute left-1 top-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">margin {margin}</span>
            <div className="relative bg-slate-500" style={{ padding: border }}>
              <div className="relative bg-emerald-400/40" style={{ padding }}>
                <span className="absolute left-1 top-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">padding {padding}</span>
                <div className="flex h-20 items-center justify-center bg-sky-500/70 text-xs font-bold text-white" style={{ width: Math.max(10, content) }}>
                  {content}px
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          <Slider label="width" value={width} min={80} max={260} onChange={setWidth} suffix="px" />
          <Slider label="padding" value={padding} min={0} max={40} onChange={setPadding} suffix="px" />
          <Slider label="border" value={border} min={0} max={20} onChange={setBorder} suffix="px" />
          <Slider label="margin" value={margin} min={0} max={40} onChange={setMargin} suffix="px" />
          <div className="rounded-xl bg-[#0b0e1c] p-3 font-mono text-[12px] leading-6 text-slate-200">
            <div>
              <span className="text-sky-300">box-sizing</span>: {borderBox ? 'border-box' : 'content-box'};
            </div>
            <div>
              visible width = {borderBox ? <b className="text-emerald-300">{width}</b> : <>{width} + 2×{padding} + 2×{border} = <b className="text-emerald-300">{rendered}</b></>}px
            </div>
            <div className="text-slate-500">+ {margin}px margin each side (outside the box)</div>
          </div>
          <p className="text-xs text-muted">
            With <code>border-box</code>, <code>width</code> includes padding + border, so layouts are predictable. That's why most resets use <code>*, *::before, *::after {'{ box-sizing: border-box }'}</code>.
          </p>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Specificity                                                          */
/* ------------------------------------------------------------------ */

function specificity(sel: string): [number, number, number] {
  let s = sel.replace(/::?(not|is|has)\(([^)]*)\)/g, ' $2 ').replace(/:where\([^)]*\)/g, '')
  const ids = (s.match(/#[\w-]+/g) || []).length
  s = s.replace(/#[\w-]+/g, ' ')
  const pseudoEl = (s.match(/::[\w-]+|:(before|after|first-line|first-letter)\b/g) || []).length
  s = s.replace(/::[\w-]+|:(before|after|first-line|first-letter)\b/g, ' ')
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g) || []).length
  s = s.replace(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g, ' ')
  const els = (s.match(/(^|[\s>+~(])([a-zA-Z][\w-]*)/g) || []).length
  return [ids, classes, els + pseudoEl]
}

const SPEC_EXAMPLES = ['p', '.card p', '#main .card > p:first-child', 'nav ul li a:hover', 'button.primary[disabled]', 'a::before', ':where(.x) p', 'div:not(.active)']

export function Specificity() {
  const [a, setA] = useState('#main .card > p:first-child')
  const [b, setB] = useState('nav ul li a:hover')
  const sa = useMemo(() => specificity(a), [a])
  const sb = useMemo(() => specificity(b), [b])
  const cmp = sa[0] - sb[0] || sa[1] - sb[1] || sa[2] - sb[2]

  const Score = ({ s }: { s: [number, number, number] }) => (
    <div className="flex gap-1.5">
      {[['ID', s[0], 'bg-rose-500'], ['CLASS', s[1], 'bg-amber-500'], ['TYPE', s[2], 'bg-sky-500']].map(([l, v, c]) => (
        <div key={l as string} className="flex flex-col items-center">
          <div className={`flex h-10 w-12 items-center justify-center rounded-lg text-lg font-bold text-white ${c}`}>{v}</div>
          <span className="mt-0.5 text-[10px] font-bold text-faint">{l}</span>
        </div>
      ))}
    </div>
  )

  return (
    <Frame title="Specificity calculator" subtitle="Compared column by column, left to right — like version numbers. Inline styles beat all three; !important beats inline.">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [a, setA, sa],
          [b, setB, sb],
        ].map(([v, set, s], i) => (
          <div key={i} className={`rounded-xl border-2 p-3 ${(i === 0 ? cmp > 0 : cmp < 0) ? 'border-emerald-500/60 bg-emerald-500/[0.05]' : 'border-line'}`}>
            <input
              value={v as string}
              onChange={(e) => (set as (x: string) => void)(e.target.value)}
              className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-violet-500"
              aria-label={`Selector ${i + 1}`}
            />
            <div className="flex items-center justify-between">
              <Score s={s as [number, number, number]} />
              {(i === 0 ? cmp > 0 : cmp < 0) && <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">wins ✓</span>}
            </div>
          </div>
        ))}
      </div>
      {cmp === 0 && <p className="mt-2 text-sm text-muted">Tie → the rule that appears <b>later</b> in the stylesheet wins.</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SPEC_EXAMPLES.map((x) => (
          <button key={x} onClick={() => setB(x)} className="rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted ring-1 ring-line hover:text-ink">
            {x}
          </button>
        ))}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Flexbox & Grid playground                                            */
/* ------------------------------------------------------------------ */

export function LayoutPlayground() {
  const [mode, setMode] = useState<'flex' | 'grid'>('flex')
  const [dir, setDir] = useState('row')
  const [justify, setJustify] = useState('flex-start')
  const [align, setAlign] = useState('stretch')
  const [wrap, setWrap] = useState('nowrap')
  const [gap, setGap] = useState(8)
  const [cols, setCols] = useState('repeat(3, 1fr)')
  const [count, setCount] = useState(5)

  const Select = ({ label, value, set, opts }: { label: string; value: string; set: (s: string) => void; opts: string[] }) => (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-mono text-muted">{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-xs">
        {opts.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )

  const style: React.CSSProperties =
    mode === 'flex'
      ? { display: 'flex', flexDirection: dir as React.CSSProperties['flexDirection'], justifyContent: justify, alignItems: align, flexWrap: wrap as React.CSSProperties['flexWrap'], gap }
      : { display: 'grid', gridTemplateColumns: cols, gap, justifyItems: align === 'stretch' ? 'stretch' : align.replace('flex-', ''), alignItems: align.replace('flex-', '') }

  const css =
    mode === 'flex'
      ? `.container {\n  display: flex;\n  flex-direction: ${dir};\n  justify-content: ${justify};\n  align-items: ${align};\n  flex-wrap: ${wrap};\n  gap: ${gap}px;\n}`
      : `.container {\n  display: grid;\n  grid-template-columns: ${cols};\n  gap: ${gap}px;\n  align-items: ${align.replace('flex-', '')};\n}`

  return (
    <Frame
      title="Flexbox & Grid playground"
      subtitle="Flexbox = one dimension (a row OR a column). Grid = two dimensions (rows AND columns)."
      controls={
        <>
          <Btn active={mode === 'flex'} onClick={() => setMode('flex')}>
            Flexbox
          </Btn>
          <Btn active={mode === 'grid'} onClick={() => setMode('grid')}>
            Grid
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {mode === 'flex' ? (
              <>
                <Select label="flex-direction" value={dir} set={setDir} opts={['row', 'row-reverse', 'column', 'column-reverse']} />
                <Select label="justify-content" value={justify} set={setJustify} opts={['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']} />
                <Select label="align-items" value={align} set={setAlign} opts={['stretch', 'flex-start', 'center', 'flex-end', 'baseline']} />
                <Select label="flex-wrap" value={wrap} set={setWrap} opts={['nowrap', 'wrap', 'wrap-reverse']} />
              </>
            ) : (
              <>
                <Select label="grid-template-columns" value={cols} set={setCols} opts={['repeat(3, 1fr)', '1fr 2fr', '200px 1fr', 'repeat(auto-fill, minmax(80px, 1fr))', '1fr 1fr 1fr 1fr']} />
                <Select label="align-items" value={align} set={setAlign} opts={['stretch', 'flex-start', 'center', 'flex-end']} />
              </>
            )}
          </div>
          <Slider label="gap" value={gap} min={0} max={32} onChange={setGap} suffix="px" />
          <Slider label="items" value={count} min={1} max={10} onChange={setCount} />
          <pre className="rounded-xl bg-[#0b0e1c] p-3 font-mono text-[12px] leading-5 text-slate-200">{css}</pre>
        </div>
        <div className="min-h-64 rounded-xl border-2 border-dashed border-violet-500/40 bg-violet-500/[0.04] p-2" style={style}>
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 font-bold text-white shadow"
              style={{ minWidth: 44, minHeight: 36 + (i % 3) * 14, padding: '6px 10px' }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* rem vs em                                                            */
/* ------------------------------------------------------------------ */

export function RemEm() {
  const [root, setRoot] = useState(16)
  const [scale, setScale] = useState(1.2)
  const levels = [0, 1, 2, 3]
  return (
    <Frame title="rem vs em" subtitle="em is relative to the parent's font-size (it compounds). rem is relative to the root <html> font-size.">
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <Slider label="html font" value={root} min={12} max={22} onChange={setRoot} suffix="px" />
        <Slider label="each level" value={scale} min={0.8} max={1.5} step={0.05} onChange={setScale} suffix="" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(['em', 'rem'] as const).map((unit) => (
          <div key={unit} className="rounded-xl border border-line p-3">
            <div className="mb-2 font-mono text-xs text-muted">
              every nested div: font-size: {scale}
              {unit}
            </div>
            <div style={{ fontSize: root }}>
              {levels.reduceRight<React.ReactNode>((inner, lv) => {
                const px = unit === 'em' ? root * Math.pow(scale, lv + 1) : root * scale
                return (
                  <div className="mt-1 rounded-lg border border-line/80 px-2 py-1" style={{ fontSize: unit === 'em' ? `${scale}em` : root * scale }}>
                    <span className="font-semibold">L{lv + 1}</span> <span className="font-mono text-[11px] text-faint">= {px.toFixed(1)}px</span>
                    {inner}
                  </div>
                )
              }, null)}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        Use <b className="text-ink">rem</b> for font sizes and spacing scales (predictable, respects the user's browser font setting). Use <b className="text-ink">em</b> when something should scale with its own text — e.g. button padding or icon size.
      </p>
    </Frame>
  )
}
