import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Btn, Frame, Slider, Stepper } from './Frame'
import { useSteps } from './useAutoplay'
import { highlight } from '../lib/markdown'

/* ------------------------------------------------------------------ */
/* Shared bits                                                          */
/* ------------------------------------------------------------------ */

function CodePane({ code, line }: { code: string; line?: number }) {
  const lines = code.split('\n')
  return (
    <pre className="overflow-x-auto rounded-xl bg-[#0b0e1c] p-3 font-mono text-[12.5px] leading-6 text-slate-200">
      {lines.map((l, i) => (
        <div
          key={i}
          className={`-mx-3 flex px-3 transition-colors ${line === i ? 'bg-violet-500/25 shadow-[inset_3px_0_0_#a78bfa]' : ''}`}
        >
          <span className="mr-3 w-4 shrink-0 select-none text-right text-slate-600">{i + 1}</span>
          <span dangerouslySetInnerHTML={{ __html: highlight(l || ' ', 'js') }} />
        </div>
      ))}
    </pre>
  )
}

function Box({
  title,
  items,
  color,
  empty = 'empty',
  className = '',
  reverse,
}: {
  title: string
  items: ReactNode[]
  color: string
  empty?: string
  className?: string
  reverse?: boolean
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface-2/60 p-2.5 ${className}`}>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">{title}</div>
      <div className={`flex min-h-9 gap-1.5 ${reverse ? 'flex-col-reverse' : 'flex-col'}`}>
        {items.length === 0 && <div className="text-xs italic text-faint">{empty}</div>}
        {items.map((it, i) => (
          <div key={i} className={`animate-pop rounded-lg px-2.5 py-1.5 font-mono text-[12px] font-medium ${color}`}>
            {it}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Event loop                                                           */
/* ------------------------------------------------------------------ */

const EL_CODE = `console.log('script start')
setTimeout(() => console.log('timeout'), 0)
Promise.resolve()
  .then(() => console.log('promise 1'))
  .then(() => console.log('promise 2'))
console.log('script end')`

interface ELStep {
  line?: number
  stack: string[]
  apis: string[]
  micro: string[]
  macro: string[]
  out: string[]
  note: string
}

const EL_STEPS: ELStep[] = [
  { stack: ['main()'], apis: [], micro: [], macro: [], out: [], note: 'The whole script runs as the first task. A frame for it is pushed on the call stack.' },
  { line: 0, stack: ['main()', "console.log('script start')"], apis: [], micro: [], macro: [], out: ['script start'], note: 'Synchronous code runs immediately, top to bottom.' },
  { line: 1, stack: ['main()', 'setTimeout(cb, 0)'], apis: ['⏱ timer 0ms → cb'], micro: [], macro: [], out: ['script start'], note: 'setTimeout hands the callback to a browser Web API (the timer). JS does not wait for it.' },
  { line: 1, stack: ['main()'], apis: [], micro: [], macro: ['timeout cb'], out: ['script start'], note: 'The timer expires (0ms is a minimum, not a guarantee) and its callback moves to the macrotask (task) queue.' },
  { line: 2, stack: ['main()'], apis: [], micro: ['then → promise 1'], macro: ['timeout cb'], out: ['script start'], note: 'Promise.resolve() is already fulfilled, so the first .then callback is queued as a MICROtask.' },
  { line: 5, stack: ['main()', "console.log('script end')"], apis: [], micro: ['then → promise 1'], macro: ['timeout cb'], out: ['script start', 'script end'], note: 'Still synchronous: script end is logged before ANY callback runs.' },
  { stack: [], apis: [], micro: ['then → promise 1'], macro: ['timeout cb'], out: ['script start', 'script end'], note: 'The call stack is empty. The event loop now drains the ENTIRE microtask queue before anything else.' },
  { line: 3, stack: ['then → promise 1'], apis: [], micro: ['then → promise 2'], macro: ['timeout cb'], out: ['script start', 'script end', 'promise 1'], note: 'Running promise 1 resolves the chained promise, which queues promise 2 — another microtask.' },
  { line: 4, stack: ['then → promise 2'], apis: [], micro: [], macro: ['timeout cb'], out: ['script start', 'script end', 'promise 1', 'promise 2'], note: 'Newly added microtasks also run before the loop moves on. Microtask queue is now empty.' },
  { stack: [], apis: [], micro: [], macro: ['timeout cb'], out: ['script start', 'script end', 'promise 1', 'promise 2'], note: 'Microtasks empty → the browser may render a frame (rAF, style, layout, paint) → then picks ONE macrotask.' },
  { line: 1, stack: ['timeout cb'], apis: [], micro: [], macro: [], out: ['script start', 'script end', 'promise 1', 'promise 2', 'timeout'], note: 'Finally the timeout callback runs. Output order: script start, script end, promise 1, promise 2, timeout.' },
]

export function EventLoop() {
  const s = useSteps(EL_STEPS.length, 1800)
  const st = EL_STEPS[s.step]
  return (
    <Frame
      title="The Event Loop, step by step"
      subtitle="Call stack → Web APIs → microtask queue → macrotask queue"
      controls={<Stepper {...s} total={EL_STEPS.length} />}
    >
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <CodePane code={EL_CODE} line={st.line} />
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.07] p-3 text-sm leading-relaxed">
            <span className="font-semibold text-violet-600 dark:text-violet-300">Step {s.step + 1}: </span>
            {st.note}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Box title="Call stack" items={st.stack} reverse color="bg-violet-500/20 text-violet-700 dark:text-violet-200" className="row-span-2" />
          <Box title="Web APIs" items={st.apis} color="bg-sky-500/20 text-sky-700 dark:text-sky-200" />
          <Box title="Console" items={st.out} color="bg-slate-500/15 text-ink" empty="—" />
          <Box title="Microtask queue" items={st.micro} color="bg-emerald-500/20 text-emerald-700 dark:text-emerald-200" className="col-span-2" />
          <Box title="Macrotask (task) queue" items={st.macro} color="bg-amber-500/20 text-amber-700 dark:text-amber-200" className="col-span-2" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">Microtasks: promise callbacks, queueMicrotask, MutationObserver</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">Macrotasks: setTimeout, setInterval, I/O, UI events, MessageChannel</span>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Execution context                                                    */
/* ------------------------------------------------------------------ */

const EC_CODE = `var a = 10
let b = 20
function add(x, y) {
  return x + y
}
const sum = add(a, b)`

interface Frm {
  name: string
  mem: [string, string][]
}
const EC_STEPS: { phase: string; line?: number; frames: Frm[]; note: string }[] = [
  {
    phase: 'Creation phase',
    frames: [{ name: 'Global EC', mem: [['a', 'undefined'], ['b', '<uninitialized> (TDZ)'], ['add', 'ƒ add(x, y)'], ['sum', '<uninitialized> (TDZ)']] }],
    note: 'Before any line runs, the engine scans the code and allocates memory. var → undefined, functions → full definition, let/const → reserved but uninitialized (Temporal Dead Zone). This is "hoisting".',
  },
  { phase: 'Execution phase', line: 0, frames: [{ name: 'Global EC', mem: [['a', '10'], ['b', '<TDZ>'], ['add', 'ƒ add(x, y)'], ['sum', '<TDZ>']] }], note: 'Now code runs line by line. a gets 10.' },
  { phase: 'Execution phase', line: 1, frames: [{ name: 'Global EC', mem: [['a', '10'], ['b', '20'], ['add', 'ƒ add(x, y)'], ['sum', '<TDZ>']] }], note: 'b leaves the TDZ at its declaration and gets 20. Accessing b before this line would throw a ReferenceError.' },
  {
    phase: 'Function call',
    line: 5,
    frames: [
      { name: 'Global EC', mem: [['a', '10'], ['b', '20'], ['add', 'ƒ add(x, y)'], ['sum', '<TDZ>']] },
      { name: 'add() EC', mem: [['x', '10'], ['y', '20'], ['this', 'undefined (strict)'], ['outer', '→ Global']] },
    ],
    note: 'Calling add() creates a brand-new execution context and pushes it on the call stack. It gets its own memory (params, locals), its own this, and a link to its outer (lexical) environment.',
  },
  {
    phase: 'Return',
    line: 3,
    frames: [
      { name: 'Global EC', mem: [['a', '10'], ['b', '20'], ['add', 'ƒ add(x, y)'], ['sum', '<TDZ>']] },
      { name: 'add() EC', mem: [['x', '10'], ['y', '20'], ['return', '30']] },
    ],
    note: 'return x + y evaluates to 30.',
  },
  { phase: 'Pop', line: 5, frames: [{ name: 'Global EC', mem: [['a', '10'], ['b', '20'], ['add', 'ƒ add(x, y)'], ['sum', '30']] }], note: 'add() EC is popped off the stack (its memory can be garbage-collected unless a closure keeps it alive). sum = 30.' },
]

export function ExecutionContext() {
  const s = useSteps(EC_STEPS.length, 2200)
  const st = EC_STEPS[s.step]
  return (
    <Frame title="Execution context & hoisting" subtitle="Creation phase → execution phase → call stack" controls={<Stepper {...s} total={EC_STEPS.length} />}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <div className="inline-flex rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">{st.phase}</div>
          <CodePane code={EC_CODE} line={st.line} />
          <p className="text-sm leading-relaxed text-muted">{st.note}</p>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">Call stack (top is running)</div>
          <div className="flex flex-col-reverse gap-2">
            {st.frames.map((f, i) => (
              <div key={f.name} className={`animate-pop rounded-xl border p-3 ${i === st.frames.length - 1 ? 'border-violet-500/50 bg-violet-500/[0.07]' : 'border-line bg-surface-2/60'}`}>
                <div className="mb-1.5 text-sm font-semibold">{f.name}</div>
                <table className="w-full font-mono text-[12px]">
                  <tbody>
                    {f.mem.map(([k, v]) => (
                      <tr key={k} className="border-t border-line/60">
                        <td className="py-1 pr-2 text-sky-600 dark:text-sky-300">{k}</td>
                        <td className={`py-1 ${v.includes('TDZ') || v.includes('uninit') ? 'text-rose-500' : v === 'undefined' ? 'text-amber-600 dark:text-amber-300' : ''}`}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scope chain & closures                                               */
/* ------------------------------------------------------------------ */

const SCOPES = [
  { name: 'Global scope', vars: { appName: "'Ladder'", createCounter: 'ƒ' } as Record<string, string>, color: 'border-sky-500/50 bg-sky-500/[0.06]' },
  { name: 'createCounter() scope', vars: { count: '0', step: '1' } as Record<string, string>, color: 'border-violet-500/50 bg-violet-500/[0.06]' },
  { name: 'increment() scope', vars: { next: 'count + step' } as Record<string, string>, color: 'border-emerald-500/50 bg-emerald-500/[0.07]' },
]

export function ScopeChain() {
  const [target, setTarget] = useState<string | null>(null)
  const [probe, setProbe] = useState(-1)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!target) return
    setProbe(2)
    let lvl = 2
    const t = setInterval(() => {
      if (lvl < 0) return clearInterval(t)
      if (target in SCOPES[lvl].vars) return clearInterval(t)
      lvl--
      setProbe(lvl)
      if (lvl < 0) clearInterval(t)
    }, 650)
    return () => clearInterval(t)
  }, [target])

  const found = target && probe >= 0 && target in SCOPES[probe].vars

  return (
    <Frame
      title="Scope chain & closures"
      subtitle="Lookup walks outward through lexical scopes. A closure keeps its outer scope alive."
      controls={
        <>
          <span className="text-xs text-muted">Look up:</span>
          {['next', 'count', 'appName', 'missing'].map((v) => (
            <Btn key={v} active={target === v} onClick={() => setTarget(v === target ? null : v)}>
              {v}
            </Btn>
          ))}
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div>
          {SCOPES.reduceRight<ReactNode>(
            (inner, sc, i) => (
              <div className={`rounded-2xl border-2 p-3 transition-all ${sc.color} ${probe === i ? 'ring-4 ring-amber-400/60' : ''}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold">{sc.name}</span>
                  {Object.entries(sc.vars).map(([k, v]) => (
                    <span
                      key={k}
                      className={`rounded-md px-1.5 py-0.5 font-mono text-[11.5px] ring-1 ring-line ${
                        target === k && probe === i ? 'bg-amber-400 text-black' : 'bg-surface'
                      }`}
                    >
                      {k} = {k === 'count' ? String(count) : v}
                    </span>
                  ))}
                </div>
                {inner}
              </div>
            ),
            null,
          )}
        </div>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-[#0b0e1c] p-3 font-mono text-[12px] leading-6 text-slate-200">
            <div dangerouslySetInnerHTML={{ __html: highlight(`function createCounter() {\n  let count = 0, step = 1\n  return function increment() {\n    const next = count + step\n    count = next\n    return count\n  }\n}\nconst counter = createCounter()\ncounter() // ${count}`, 'js') }} style={{ whiteSpace: 'pre' }} />
          </div>
          <div className="flex items-center gap-2">
            <Btn primary onClick={() => setCount((c) => c + 1)}>
              call counter()
            </Btn>
            <Btn onClick={() => setCount(0)}>reset</Btn>
          </div>
          <p className="text-muted">
            {target ? (
              found ? (
                <>
                  Found <b className="text-ink">{target}</b> in <b className="text-ink">{SCOPES[probe].name}</b>.
                </>
              ) : probe < 0 ? (
                <span className="text-rose-500">ReferenceError: {target} is not defined — reached the global scope without finding it.</span>
              ) : (
                <>Searching {SCOPES[probe].name}…</>
              )
            ) : (
              <>
                createCounter() has returned, yet <code>count</code> survives — increment() closes over it. Each call to{' '}
                <code>counter()</code> reads and updates the <i>same</i> retained variable.
              </>
            )}
          </p>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Prototype chain                                                       */
/* ------------------------------------------------------------------ */

const PROTO = [
  { name: 'rex (instance)', props: ['name', 'breed'] },
  { name: 'Dog.prototype', props: ['bark', 'constructor'] },
  { name: 'Animal.prototype', props: ['eat', 'sleep'] },
  { name: 'Object.prototype', props: ['toString', 'hasOwnProperty', 'valueOf'] },
]

export function PrototypeChain() {
  const [prop, setProp] = useState<string | null>(null)
  const [at, setAt] = useState(-1)
  useEffect(() => {
    if (!prop) return
    let i = 0
    setAt(0)
    const t = setInterval(() => {
      if (i < PROTO.length && PROTO[i].props.includes(prop)) return clearInterval(t)
      i++
      setAt(i)
      if (i >= PROTO.length) clearInterval(t)
    }, 600)
    return () => clearInterval(t)
  }, [prop])
  const found = prop && at >= 0 && at < PROTO.length && PROTO[at].props.includes(prop)
  return (
    <Frame
      title="Prototype chain lookup"
      subtitle="Property access walks [[Prototype]] links until it finds the key or hits null."
      controls={
        <>
          <span className="text-xs text-muted">rex.</span>
          {['name', 'bark', 'eat', 'toString', 'fly'].map((p) => (
            <Btn key={p} active={prop === p} onClick={() => setProp(p === prop ? null : p)}>
              {p}
            </Btn>
          ))}
        </>
      }
    >
      <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center">
        {PROTO.map((o, i) => (
          <div key={o.name} className="flex flex-1 flex-col items-center gap-1 sm:flex-row">
            <div className={`w-full rounded-xl border-2 p-2.5 transition-all ${at === i ? (found ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-400 bg-amber-400/10') : 'border-line bg-surface-2/50'}`}>
              <div className="text-xs font-bold">{o.name}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {o.props.map((p) => (
                  <span key={p} className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${prop === p && at === i ? 'bg-emerald-500 text-white' : 'bg-surface ring-1 ring-line'}`}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-faint sm:px-1">{i < PROTO.length - 1 ? (<><span className="sm:hidden">↓</span><span className="hidden sm:inline">→</span></>) : null}</span>
          </div>
        ))}
        <div className={`rounded-xl border-2 border-dashed px-3 py-2 text-center font-mono text-xs ${at >= PROTO.length ? 'border-rose-500 text-rose-500' : 'border-line text-faint'}`}>null</div>
      </div>
      <p className="mt-3 text-sm text-muted">
        {!prop
          ? 'Pick a property. Own properties are found first; methods are shared on prototypes so every Dog instance reuses one bark function.'
          : found
            ? `Found "${prop}" on ${PROTO[at].name}${at > 0 ? ` after ${at} hop${at > 1 ? 's' : ''} up the chain` : ' (own property)'}.`
            : at >= PROTO.length
              ? `Reached null — rex.${prop} is undefined (no error for property access; calling it would throw TypeError).`
              : 'Walking the chain…'}
      </p>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Event propagation                                                    */
/* ------------------------------------------------------------------ */

type Phase = 'capture' | 'target' | 'bubble'
const LAYERS = ['div.outer', 'div.middle', 'button']

export function EventPropagation() {
  const [stopAt, setStopAt] = useState<string>('none')
  const [seq, setSeq] = useState<{ el: string; phase: Phase }[]>([])
  const [idx, setIdx] = useState(-1)

  const fire = () => {
    const full: { el: string; phase: Phase }[] = [
      { el: 'div.outer', phase: 'capture' },
      { el: 'div.middle', phase: 'capture' },
      { el: 'button', phase: 'target' },
      { el: 'div.middle', phase: 'bubble' },
      { el: 'div.outer', phase: 'bubble' },
    ]
    const cut = full.findIndex((x) => x.el === stopAt && x.phase === 'bubble')
    setSeq(cut >= 0 ? full.slice(0, cut + 1) : full)
    setIdx(0)
  }
  useEffect(() => {
    if (idx < 0 || idx >= seq.length - 1) return
    const t = setTimeout(() => setIdx((i) => i + 1), 700)
    return () => clearTimeout(t)
  }, [idx, seq])

  const cur = seq[idx]
  const colors: Record<Phase, string> = { capture: 'ring-sky-400 bg-sky-400/15', target: 'ring-amber-400 bg-amber-400/20', bubble: 'ring-emerald-400 bg-emerald-400/15' }

  return (
    <Frame
      title="Event propagation: capture → target → bubble"
      controls={
        <>
          <span className="text-xs text-muted">stopPropagation() in bubble at:</span>
          {['none', 'div.middle'].map((s) => (
            <Btn key={s} active={stopAt === s} onClick={() => setStopAt(s)}>
              {s}
            </Btn>
          ))}
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div
          className={`rounded-2xl p-4 ring-2 transition-all ${cur?.el === 'div.outer' ? colors[cur.phase] : 'ring-line'}`}
        >
          <div className="mb-2 font-mono text-xs text-faint">div.outer</div>
          <div className={`rounded-2xl p-4 ring-2 transition-all ${cur?.el === 'div.middle' ? colors[cur.phase] : 'ring-line'}`}>
            <div className="mb-2 font-mono text-xs text-faint">div.middle</div>
            <button
              onClick={fire}
              className={`w-full rounded-xl px-4 py-3 font-semibold ring-2 transition-all ${cur?.el === 'button' ? colors[cur.phase] : 'bg-violet-600 text-white ring-transparent hover:bg-violet-500'}`}
            >
              Click me
            </button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">Listener log</div>
          <ol className="space-y-1 font-mono text-[12px]">
            {seq.slice(0, idx + 1).map((s, i) => (
              <li key={i} className="animate-pop flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.phase === 'capture' ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300' : s.phase === 'target' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'}`}>
                  {s.phase}
                </span>
                {s.el}
                {stopAt === s.el && s.phase === 'bubble' && <span className="text-rose-500">⛔ stopped</span>}
              </li>
            ))}
            {seq.length === 0 && <li className="text-faint">Click the button…</li>}
          </ol>
          <p className="mt-3 text-xs text-muted">
            Listeners added with <code>{'{ capture: true }'}</code> run on the way down; normal listeners run on the way up. That bubbling is what makes <b>event delegation</b> possible.
          </p>
        </div>
      </div>
      <div className="sr-only">{LAYERS.join(' > ')}</div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Promise combinators                                                  */
/* ------------------------------------------------------------------ */

interface P {
  name: string
  ms: number
  ok: boolean
}

export function PromiseCombinators() {
  const [ps, setPs] = useState<P[]>([
    { name: 'A', ms: 1800, ok: true },
    { name: 'B', ms: 900, ok: false },
    { name: 'C', ms: 1300, ok: true },
  ])
  const [t, setT] = useState(0)
  const [running, setRunning] = useState(false)
  const start = useRef(0)
  const max = Math.max(...ps.map((p) => p.ms))

  useEffect(() => {
    if (!running) return
    start.current = performance.now()
    let raf = 0
    const tick = () => {
      const e = performance.now() - start.current
      setT(e)
      if (e < max + 200) raf = requestAnimationFrame(tick)
      else setRunning(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, max])

  const sorted = [...ps].sort((a, b) => a.ms - b.ms)
  const firstReject = sorted.find((p) => !p.ok)
  const firstOk = sorted.find((p) => p.ok)
  const results = [
    {
      name: 'Promise.all',
      at: firstReject ? firstReject.ms : max,
      text: firstReject ? `rejects with ${firstReject.name}'s error` : `fulfills with [${ps.map((p) => p.name).join(', ')}] (input order)`,
      ok: !firstReject,
      rule: 'All must fulfill. Fails fast on the first rejection.',
    },
    { name: 'Promise.allSettled', at: max, text: `fulfills with ${ps.length} {status, value|reason} objects`, ok: true, rule: 'Waits for everyone. Never rejects.' },
    { name: 'Promise.race', at: sorted[0].ms, text: `${sorted[0].ok ? 'fulfills' : 'rejects'} with ${sorted[0].name}`, ok: sorted[0].ok, rule: 'First to SETTLE wins — success or failure.' },
    {
      name: 'Promise.any',
      at: firstOk ? firstOk.ms : max,
      text: firstOk ? `fulfills with ${firstOk.name}` : 'rejects with AggregateError',
      ok: !!firstOk,
      rule: 'First to FULFILL wins. Rejects only if all reject.',
    },
  ]

  return (
    <Frame
      title="Promise.all vs allSettled vs race vs any"
      subtitle="Toggle outcomes, then race them."
      controls={
        <Btn primary onClick={() => { setT(0); setRunning(true) }}>
          ▶ Run
        </Btn>
      }
    >
      <div className="space-y-2">
        {ps.map((p, i) => {
          const pct = Math.min(1, t / p.ms)
          const settled = t >= p.ms
          return (
            <div key={p.name} className="flex items-center gap-2">
              <button
                onClick={() => setPs(ps.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)))}
                className={`w-24 shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${p.ok ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}
                title="Toggle resolve/reject"
              >
                {p.name}: {p.ok ? 'resolve' : 'reject'}
              </button>
              <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-surface-2">
                <div className={`h-full rounded-lg ${settled ? (p.ok ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-violet-500/60'}`} style={{ width: `${pct * 100 * (p.ms / max)}%` }} />
                <span className="absolute inset-y-0 right-2 flex items-center font-mono text-[11px] text-muted">{p.ms}ms</span>
              </div>
              <input type="range" min={300} max={2400} step={100} value={p.ms} onChange={(e) => setPs(ps.map((x, j) => (j === i ? { ...x, ms: +e.target.value } : x)))} className="hidden w-20 accent-violet-500 sm:block" aria-label={`${p.name} duration`} />
            </div>
          )
        })}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {results.map((r) => {
          const done = t >= r.at && t > 0
          return (
            <div key={r.name} className={`rounded-xl border p-3 transition-all ${done ? (r.ok ? 'border-emerald-500/50 bg-emerald-500/[0.07]' : 'border-rose-500/50 bg-rose-500/[0.07]') : 'border-line'}`}>
              <div className="flex items-center justify-between">
                <code className="text-sm font-semibold">{r.name}</code>
                <span className="font-mono text-[11px] text-faint">{done ? `@${r.at}ms` : 'pending'}</span>
              </div>
              <div className="mt-1 text-sm">{done ? r.text : '…'}</div>
              <div className="mt-1 text-xs text-muted">{r.rule}</div>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Debounce vs throttle                                                  */
/* ------------------------------------------------------------------ */

export function DebounceThrottle() {
  const [wait, setWait] = useState(400)
  const [now, setNow] = useState(() => performance.now())
  const ev = useRef<{ raw: number[]; deb: number[]; thr: number[] }>({ raw: [], deb: [], thr: [] })
  const debT = useRef<number | undefined>(undefined)
  const lastThr = useRef(0)
  const trailing = useRef<number | undefined>(undefined)
  const WINDOW = 6000

  useEffect(() => {
    let raf = 0
    const loop = () => {
      setNow(performance.now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onEvent = () => {
    const t = performance.now()
    const e = ev.current
    e.raw.push(t)
    clearTimeout(debT.current)
    debT.current = window.setTimeout(() => e.deb.push(performance.now()), wait)
    if (t - lastThr.current >= wait) {
      lastThr.current = t
      e.thr.push(t)
    } else {
      clearTimeout(trailing.current)
      trailing.current = window.setTimeout(() => {
        lastThr.current = performance.now()
        e.thr.push(performance.now())
      }, wait - (t - lastThr.current))
    }
    const cutoff = t - WINDOW
    for (const k of ['raw', 'deb', 'thr'] as const) e[k] = e[k].filter((x) => x > cutoff)
  }

  const row = (label: string, list: number[], color: string, desc: string) => (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[11px] text-faint">{desc}</span>
      </div>
      <div className="relative h-8 overflow-hidden rounded-lg bg-surface-2">
        {list.map((t, i) => {
          const x = 100 - ((now - t) / WINDOW) * 100
          return x < 0 ? null : <span key={i} className={`absolute top-1.5 h-5 w-1.5 rounded-full ${color}`} style={{ left: `${x}%` }} />
        })}
      </div>
    </div>
  )

  const e = ev.current
  return (
    <Frame title="Debounce vs throttle" subtitle="Move your mouse / finger over the pad (or type) and watch which calls get through.">
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          <div
            onMouseMove={onEvent}
            onTouchMove={onEvent}
            className="flex h-36 touch-none select-none items-center justify-center rounded-2xl border-2 border-dashed border-violet-500/40 bg-violet-500/[0.06] text-sm font-medium text-violet-600 dark:text-violet-300"
          >
            Move here ⇢
          </div>
          <input onInput={onEvent} placeholder="…or type here" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <Slider label="wait" value={wait} min={100} max={1200} step={50} onChange={setWait} suffix="ms" />
        </div>
        <div className="space-y-3">
          {row(`Raw events (${e.raw.length})`, e.raw, 'bg-slate-400', 'every event fires')}
          {row(`Throttled (${e.thr.length})`, e.thr, 'bg-sky-500', `at most once per ${wait}ms`)}
          {row(`Debounced (${e.deb.length})`, e.deb, 'bg-emerald-500', `once, ${wait}ms after events stop`)}
          <p className="text-xs leading-relaxed text-muted">
            <b className="text-ink">Throttle</b> = steady heartbeat during activity (scroll position, resize, drag, WebSocket price ticks).{' '}
            <b className="text-ink">Debounce</b> = wait for a pause (search-as-you-type, autosave, validation).
          </p>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Concurrency-limited runner                                           */
/* ------------------------------------------------------------------ */

const TASKS = [1400, 600, 900, 1800, 500, 1100, 700, 1300, 800, 1000]

export function ConcurrencyLimit() {
  const [limit, setLimit] = useState(2)
  const [t, setT] = useState(0)
  const [running, setRunning] = useState(false)

  const schedule = useMemo(() => {
    const lanes = Array.from({ length: limit }, () => 0)
    return TASKS.map((d, i) => {
      let lane = 0
      for (let l = 1; l < limit; l++) if (lanes[l] < lanes[lane]) lane = l
      const start = lanes[lane]
      lanes[lane] = start + d
      return { i, d, lane, start, end: start + d }
    })
  }, [limit])
  const total = Math.max(...schedule.map((s) => s.end))

  useEffect(() => {
    if (!running) return
    const s = performance.now()
    let raf = 0
    const tick = () => {
      const e = (performance.now() - s) * 1.5
      setT(e)
      if (e < total) raf = requestAnimationFrame(tick)
      else setRunning(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, total])

  return (
    <Frame
      title="Async task runner with max concurrency"
      subtitle="At most N promises in flight; when one finishes, the next queued task starts."
      controls={
        <Btn primary onClick={() => { setT(0); setRunning(true) }}>
          ▶ Run {TASKS.length} tasks
        </Btn>
      }
    >
      <Slider label="limit (N)" value={limit} min={1} max={5} onChange={(n) => { setLimit(n); setT(0); setRunning(false) }} />
      <div className="mt-4 space-y-2">
        {Array.from({ length: limit }, (_, lane) => (
          <div key={lane} className="flex items-center gap-2">
            <span className="w-14 shrink-0 font-mono text-[11px] text-faint">slot {lane + 1}</span>
            <div className="relative h-8 flex-1 rounded-lg bg-surface-2">
              {schedule
                .filter((s) => s.lane === lane)
                .map((s) => {
                  const state = t >= s.end ? 'done' : t >= s.start ? 'run' : 'wait'
                  return (
                    <div
                      key={s.i}
                      className={`absolute top-1 flex h-6 items-center justify-center overflow-hidden rounded-md text-[10px] font-bold text-white transition-colors ${state === 'done' ? 'bg-emerald-500' : state === 'run' ? 'animate-pulse bg-violet-500' : 'bg-slate-400/40'}`}
                      style={{ left: `${(s.start / total) * 100}%`, width: `calc(${(s.d / total) * 100}% - 2px)` }}
                    >
                      T{s.i + 1}
                    </div>
                  )
                })}
              <div className="absolute inset-y-0 w-0.5 bg-amber-400" style={{ left: `${Math.min(100, (t / total) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span>
          Total time: <b className="font-mono">{total}ms</b>
        </span>
        <span className="text-muted">
          Sequential would take <b className="font-mono">{TASKS.reduce((a, b) => a + b, 0)}ms</b>; unlimited parallel ~
          <b className="font-mono">{Math.max(...TASKS)}ms</b> but may overload the server.
        </span>
      </div>
    </Frame>
  )
}
