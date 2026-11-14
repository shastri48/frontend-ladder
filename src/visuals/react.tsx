import { useEffect, useMemo, useRef, useState } from 'react'
import { Btn, Frame, Stepper } from './Frame'
import { useSteps } from './useAutoplay'

/* ------------------------------------------------------------------ */
/* Virtual DOM diff + keys                                              */
/* ------------------------------------------------------------------ */

interface Item {
  id: number
  name: string
}
const START: Item[] = [
  { id: 1, name: 'Apple' },
  { id: 2, name: 'Banana' },
  { id: 3, name: 'Cherry' },
]
const NEW = ['Mango', 'Kiwi', 'Grape', 'Lemon', 'Peach']

export function VdomDiff() {
  const [mode, setMode] = useState<'index' | 'id'>('index')
  const [items, setItems] = useState<Item[]>(START)
  const [ops, setOps] = useState<string[]>([])
  const nextId = useRef(4)

  const addTop = () => {
    const name = NEW[(nextId.current - 4) % NEW.length]
    const item = { id: nextId.current++, name }
    const next = [item, ...items]
    if (mode === 'index') {
      setOps([
        ...items.map((it, i) => `UPDATE <li key=${i}> text "${it.name}" → "${next[i].name}"`),
        `INSERT <li key=${items.length}> "${next[next.length - 1].name}" at end`,
      ])
    } else {
      setOps([`INSERT <li key=${item.id}> "${item.name}" before key=${items[0]?.id}`, `(${items.length} existing <li> reused untouched)`])
    }
    setItems(next)
  }
  const reset = () => {
    setItems(START)
    setOps([])
    nextId.current = 4
  }

  return (
    <Frame
      title="Reconciliation & why keys matter"
      subtitle="Type something in the inputs, then add an item to the top."
      controls={
        <>
          <Btn active={mode === 'index'} onClick={() => { setMode('index'); reset() }}>
            key = index
          </Btn>
          <Btn active={mode === 'id'} onClick={() => { setMode('id'); reset() }}>
            key = item.id
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex gap-2">
            <Btn primary onClick={addTop}>
              + Add to top
            </Btn>
            <Btn onClick={reset}>Reset</Btn>
          </div>
          <ul className="space-y-1.5">
            {items.map((it, i) => (
              <li key={mode === 'index' ? i : it.id} className="animate-pop flex items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-2 py-1.5">
                <span className="w-16 shrink-0 font-mono text-[10px] text-faint">key={mode === 'index' ? i : it.id}</span>
                <span className="w-16 shrink-0 text-sm font-semibold">{it.name}</span>
                <input placeholder={`note for ${it.name}`} className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-violet-500" />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">DOM operations React performed</div>
          <ul className="space-y-1 font-mono text-[11.5px]">
            {ops.length === 0 && <li className="text-faint">Add an item…</li>}
            {ops.map((o, i) => (
              <li key={i} className={`animate-pop rounded px-2 py-1 ${o.startsWith('UPDATE') ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : o.startsWith('INSERT') ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'text-muted'}`}>
                {o}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {mode === 'index'
              ? 'With index keys every position "changed", so React patches every row — and uncontrolled input state stays glued to the position, not the item. Your notes now sit next to the wrong fruit!'
              : 'With stable ids React sees one new key and inserts exactly one node. Existing rows (and their input state) move with their data.'}
          </p>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Re-render visualiser                                                 */
/* ------------------------------------------------------------------ */

interface Node {
  id: string
  label: string
  children?: Node[]
}
const TREE: Node = {
  id: 'App',
  label: '<App> (theme, count)',
  children: [
    { id: 'Header', label: '<Header />' },
    {
      id: 'List',
      label: '<List onSelect={…}> (filter)',
      children: [
        { id: 'Item1', label: '<Item />' },
        { id: 'Item2', label: '<Item />' },
        { id: 'Item3', label: '<Item />' },
      ],
    },
    { id: 'Footer', label: '<Footer />' },
  ],
}

function collect(n: Node, out: Record<string, Node> = {}) {
  out[n.id] = n
  n.children?.forEach((c) => collect(c, out))
  return out
}

export function ReactRerender() {
  const [memo, setMemo] = useState(false)
  const [stableCb, setStableCb] = useState(false)
  const [flash, setFlash] = useState<Record<string, number>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [why, setWhy] = useState('Trigger a state update to see which components re-render.')

  const trigger = (source: 'App' | 'List') => {
    const rendered: string[] = []
    const visit = (n: Node, renders: boolean) => {
      if (renders) rendered.push(n.id)
      // a child re-renders with its parent unless it is memoised and its props are referentially equal
      n.children?.forEach((c) => visit(c, renders && (!memo || (c.id === 'List' && !stableCb))))
    }
    const all = collect(TREE)
    visit(all[source], true)
    const now = Date.now()
    setFlash(Object.fromEntries(rendered.map((id) => [id, now])))
    setCounts((c) => {
      const n = { ...c }
      rendered.forEach((id) => (n[id] = (n[id] || 0) + 1))
      return n
    })
    setWhy(
      `${source} state changed → ${rendered.length} component${rendered.length > 1 ? 's' : ''} rendered: ${rendered.join(', ')}. ` +
        (memo
          ? source === 'App' && !stableCb
            ? 'List is memoised but receives a NEW inline onSelect function each render, so memo fails — and its children render too.'
            : 'Memoised children with unchanged props were skipped.'
          : 'Without memo, a render cascades to EVERY descendant, whether or not their props changed.'),
    )
  }

  const render = (n: Node, depth = 0): React.ReactNode => {
    const lit = flash[n.id] && Date.now() - flash[n.id] < 1200
    return (
      <div key={n.id} className="flex flex-col items-center">
        <div
          key={flash[n.id] || 0}
          className={`relative rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] transition-colors ${lit ? 'animate-pop border-amber-400 bg-amber-400/25' : 'border-line bg-surface-2/60'}`}
        >
          {n.label.replace('<Item />', `<Item ${n.id.slice(-1)} />`)}
          {memo && n.id !== 'App' && <span className="ml-1 rounded bg-violet-500/20 px-1 text-[9px] text-violet-600 dark:text-violet-300">memo</span>}
          <span className="absolute -right-2 -top-2 rounded-full bg-ink px-1.5 text-[9px] font-bold text-bg">{counts[n.id] || 0}</span>
        </div>
        {n.children && (
          <div className="mt-3 flex gap-2 sm:gap-3">{n.children.map((c) => render(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <Frame
      title="Who re-renders?"
      subtitle="Badges count renders. Yellow flash = rendered this update."
      controls={
        <>
          <Btn active={memo} onClick={() => setMemo(!memo)}>
            React.memo {memo ? 'ON' : 'OFF'}
          </Btn>
          <Btn active={stableCb} onClick={() => setStableCb(!stableCb)}>
            useCallback(onSelect) {stableCb ? 'ON' : 'OFF'}
          </Btn>
        </>
      }
    >
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[26rem]">{render(TREE)}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn primary onClick={() => trigger('App')}>
          setCount() in App
        </Btn>
        <Btn primary onClick={() => trigger('List')}>
          setFilter() in List
        </Btn>
        <Btn onClick={() => { setCounts({}); setFlash({}) }}>Reset counts</Btn>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{why}</p>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Virtual list                                                          */
/* ------------------------------------------------------------------ */

const ROWS = 10000
const ROW_H = 36
const VIEW_H = 288

export function VirtualList() {
  const [virtual, setVirtual] = useState(true)
  const [scrollTop, setScrollTop] = useState(0)
  const [nodes, setNodes] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const overscan = 4
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - overscan)
  const end = Math.min(ROWS, Math.ceil((scrollTop + VIEW_H) / ROW_H) + overscan)
  const data = useMemo(() => Array.from({ length: ROWS }, (_, i) => i), [])

  useEffect(() => {
    setNodes(ref.current?.querySelectorAll('[data-row]').length ?? 0)
  })

  const rows = virtual ? data.slice(start, end) : data

  return (
    <Frame
      title="Virtualization (windowing)"
      subtitle="10,000 rows, but only the visible window (+ overscan) exists in the DOM."
      controls={
        <>
          <Btn active={virtual} onClick={() => setVirtual(true)}>
            Virtualized
          </Btn>
          <Btn active={!virtual} onClick={() => setVirtual(false)}>
            Render all 10k
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div ref={ref} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="relative overflow-auto rounded-xl border border-line" style={{ height: VIEW_H }}>
          <div style={{ height: ROWS * ROW_H, position: 'relative' }}>
            {rows.map((i) => (
              <div
                key={i}
                data-row
                className={`absolute inset-x-0 flex items-center gap-3 border-b border-line/60 px-3 text-sm ${i % 2 ? 'bg-surface-2/40' : ''}`}
                style={{ top: i * ROW_H, height: ROW_H }}
              >
                <span className="w-14 font-mono text-[11px] text-faint">#{i + 1}</span>
                <span className="truncate">Transaction {((i * 7919) % 100000).toString().padStart(5, '0')}</span>
                <span className="ml-auto font-mono text-xs">₹{((i * 37) % 9000) + 100}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-surface-2/60 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-faint">Row elements in DOM</div>
            <div className={`text-3xl font-bold ${nodes > 100 ? 'text-rose-500' : 'text-emerald-500'}`}>{nodes.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-[#0b0e1c] p-3 font-mono text-[11.5px] leading-5 text-slate-200">
            startIndex = floor({Math.round(scrollTop)} / {ROW_H}) − {overscan} = {start}
            <br />
            endIndex = ceil(({Math.round(scrollTop)} + {VIEW_H}) / {ROW_H}) + {overscan} = {end}
            <br />
            spacer height = {ROWS} × {ROW_H} = {(ROWS * ROW_H).toLocaleString()}px
          </div>
          <p className="text-xs leading-relaxed text-muted">A tall spacer keeps the native scrollbar honest; rows are absolutely positioned at index × rowHeight. Scroll fast and compare both modes.</p>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Fiber phases                                                          */
/* ------------------------------------------------------------------ */

const FIBERS = ['App', 'Header', 'Main', 'SearchBox', 'Results', 'Row1', 'Row2']
const PARENT: Record<string, string | null> = { App: null, Header: 'App', Main: 'App', SearchBox: 'Main', Results: 'Main', Row1: 'Results', Row2: 'Results' }

function fiberSteps(interrupt: boolean) {
  const steps: { cur?: string; phase: 'render' | 'commit' | 'yield' | 'urgent'; done: string[]; note: string }[] = []
  const order: [string, 'begin' | 'complete'][] = [
    ['App', 'begin'], ['Header', 'begin'], ['Header', 'complete'], ['Main', 'begin'], ['SearchBox', 'begin'], ['SearchBox', 'complete'],
    ['Results', 'begin'], ['Row1', 'begin'], ['Row1', 'complete'], ['Row2', 'begin'], ['Row2', 'complete'], ['Results', 'complete'], ['Main', 'complete'], ['App', 'complete'],
  ]
  const done: string[] = []
  order.forEach(([f, k], i) => {
    if (k === 'complete') done.push(f)
    steps.push({
      cur: f,
      phase: 'render',
      done: [...done],
      note:
        k === 'begin'
          ? `beginWork(${f}): call the component / diff its children, create or reuse child fibers in the work-in-progress tree.`
          : `completeWork(${f}): build/prepare DOM nodes and collect effects. Move to sibling, else back to parent.`,
    })
    if (interrupt && i === 7) {
      steps.push({ phase: 'yield', done: [...done], note: 'Time slice (~5ms) used up → React YIELDS to the browser via the scheduler. The work-in-progress tree is kept; nothing is on screen yet.' })
      steps.push({ phase: 'urgent', done: [], note: 'A keystroke arrives (SyncLane / high priority). The transition render (TransitionLane) is lower priority, so React handles the input first — then restarts the low-priority render with the latest state.' })
    }
  })
  steps.push({ phase: 'commit', done: [...FIBERS], note: 'COMMIT phase (synchronous, cannot be interrupted): apply all DOM mutations, run useLayoutEffect, swap current ↔ work-in-progress (double buffering). Then useEffect runs after paint.' })
  return steps
}

export function FiberPhases() {
  const [interrupt, setInterrupt] = useState(true)
  const steps = useMemo(() => fiberSteps(interrupt), [interrupt])
  const s = useSteps(steps.length, 1300)
  const st = steps[Math.min(s.step, steps.length - 1)]
  const depth = (f: string): number => (PARENT[f] ? 1 + depth(PARENT[f]!) : 0)

  return (
    <Frame
      title="Fiber: interruptible render, atomic commit"
      controls={
        <>
          <Btn active={interrupt} onClick={() => { setInterrupt(!interrupt); s.setStep(0) }}>
            Interrupt with input {interrupt ? 'ON' : 'OFF'}
          </Btn>
          <Stepper {...s} total={steps.length} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-1">
          {FIBERS.map((f) => (
            <div key={f} className="flex items-center" style={{ paddingLeft: depth(f) * 18 }}>
              <span
                className={`rounded-md px-2 py-1 font-mono text-[12px] transition-all ${
                  st.phase === 'commit'
                    ? 'bg-emerald-500 text-white'
                    : st.cur === f
                      ? 'bg-amber-400 text-black shadow'
                      : st.done.includes(f)
                        ? 'bg-violet-500/25 text-violet-700 dark:text-violet-200'
                        : 'bg-surface-2 text-muted'
                }`}
              >
                {f}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['render', 'yield', 'urgent', 'commit'] as const).map((p) => (
              <span key={p} className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${st.phase === p ? (p === 'commit' ? 'bg-emerald-500 text-white' : p === 'render' ? 'bg-violet-600 text-white' : p === 'yield' ? 'bg-sky-500 text-white' : 'bg-rose-500 text-white') : 'bg-surface-2 text-faint'}`}>
                {p === 'urgent' ? 'urgent update' : p}
              </span>
            ))}
          </div>
          <p className="text-sm leading-relaxed">{st.note}</p>
          <p className="text-xs text-muted">Render phase = pure, can pause/restart/discard. Commit phase = side effects, all at once, so the UI never shows a half-updated tree.</p>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* RADIO framework                                                       */
/* ------------------------------------------------------------------ */

const RADIO = [
  { l: 'R', name: 'Requirements', pct: 12, c: 'from-rose-500 to-orange-500', pts: ['Clarify functional scope: core features vs nice-to-have', 'Non-functional: devices, offline, perf targets, a11y, i18n, scale', 'Ask: who are the users? what does success look like?'] },
  { l: 'A', name: 'Architecture', pct: 20, c: 'from-amber-500 to-yellow-500', pts: ['Draw components: View, Controller/Store, Client cache, Server/API', 'Rendering strategy: CSR / SSR / SSG / streaming', 'Data flow direction and responsibilities'] },
  { l: 'D', name: 'Data model', pct: 15, c: 'from-emerald-500 to-teal-500', pts: ['Entities & fields; which are server vs client state', 'Normalised store shape, derived state', 'Where each piece of state lives'] },
  { l: 'I', name: 'Interface (API)', pct: 15, c: 'from-sky-500 to-indigo-500', pts: ['Server APIs: REST/GraphQL, request/response shapes, pagination (cursor vs offset)', 'Component APIs: props, events, composition', 'Real-time: WebSocket / SSE / polling'] },
  { l: 'O', name: 'Optimisations', pct: 38, c: 'from-violet-500 to-fuchsia-500', pts: ['Performance: virtualization, code splitting, caching, prefetch, images', 'UX: loading/empty/error states, optimistic updates', 'Accessibility, i18n, security (XSS), observability', 'This is where seniors stand out — spend the most time here'] },
]

export function RadioFramework() {
  const [i, setI] = useState(0)
  const r = RADIO[i]
  return (
    <Frame title="RADIO: a framework for frontend system design" subtitle="Suggested share of a ~45 minute interview.">
      <div className="flex h-3 overflow-hidden rounded-full">
        {RADIO.map((x, j) => (
          <button key={x.l} onClick={() => setI(j)} className={`bg-gradient-to-r ${x.c} transition-opacity ${i === j ? '' : 'opacity-40'}`} style={{ width: `${x.pct}%` }} aria-label={x.name} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {RADIO.map((x, j) => (
          <button key={x.l} onClick={() => setI(j)} className={`rounded-2xl p-2 text-center transition-all ${i === j ? 'scale-105 shadow-lg' : 'opacity-70'}`}>
            <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-xl font-black text-white sm:h-14 sm:w-14 sm:text-2xl ${x.c}`}>{x.l}</div>
            <div className="mt-1 hidden text-xs font-semibold sm:block">{x.name}</div>
            <div className="font-mono text-[10px] text-faint">~{x.pct}%</div>
          </button>
        ))}
      </div>
      <div key={i} className="animate-pop mt-3 rounded-xl border border-line p-4">
        <div className="font-semibold">{r.name}</div>
        <ul className="mt-2 space-y-1.5 text-sm">
          {r.pts.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-violet-500">▸</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  )
}
