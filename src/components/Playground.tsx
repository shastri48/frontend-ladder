import { useCallback, useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { CircleCheck, CircleX, Loader2, Play, RotateCcw, Terminal } from 'lucide-react'
import { runCode, type RunResult } from '../lib/runner'

const extensions = [javascript({ jsx: false })]

export default function Playground({
  initial,
  tests,
  storageKey,
  onAllPass,
  minHeight = '220px',
}: {
  initial: string
  tests?: string
  storageKey?: string
  onAllPass?: () => void
  minHeight?: string
}) {
  const [code, setCode] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem('fl-code:' + storageKey)
        if (saved) return saved
      } catch {
        /* ignore */
      }
    }
    return initial
  })
  const [result, setResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!storageKey) return
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem('fl-code:' + storageKey, code)
      } catch {
        /* ignore */
      }
    }, 400)
  }, [code, storageKey])

  const run = useCallback(async () => {
    setRunning(true)
    const r = await runCode(code, tests)
    setResult(r)
    setRunning(false)
    if (tests && r.tests.length && r.tests.every((t) => t.pass) && !r.error) onAllPass?.()
  }, [code, tests, onAllPass])

  const reset = () => {
    setCode(initial)
    setResult(null)
  }

  const passed = result?.tests.filter((t) => t.pass).length ?? 0
  const total = result?.tests.length ?? 0

  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-[#0b0e1c]"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          run()
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 font-mono text-xs text-slate-400">solution.js</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
            title="Reset to starter code"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-60"
            title="Run (⌘/Ctrl + Enter)"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
            {tests ? 'Run tests' : 'Run'}
          </button>
        </div>
      </div>
      <CodeMirror
        value={code}
        onChange={setCode}
        theme="dark"
        extensions={extensions}
        minHeight={minHeight}
        maxHeight="520px"
        basicSetup={{ foldGutter: false, highlightActiveLine: true, autocompletion: true }}
        style={{ fontSize: 13.5 }}
      />
      {result && (
        <div className="animate-reveal border-t border-white/10 bg-black/30 p-3 font-mono text-[12.5px] text-slate-200">
          {result.error && <div className="mb-2 whitespace-pre-wrap text-rose-300">✖ {result.error}</div>}
          {total > 0 && (
            <div className="mb-2">
              <div
                className={`mb-1.5 text-xs font-semibold ${passed === total ? 'text-emerald-300' : 'text-amber-300'}`}
              >
                {passed === total ? '🎉 ' : ''}
                {passed}/{total} tests passed
              </div>
              <ul className="space-y-1">
                {result.tests.map((t, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    {t.pass ? (
                      <CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                    ) : (
                      <CircleX size={14} className="mt-0.5 shrink-0 text-rose-400" />
                    )}
                    <span>
                      <span className={t.pass ? 'text-slate-300' : 'text-rose-200'}>{t.name}</span>
                      {t.error && <span className="block text-rose-300/80">{t.error}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.logs.length > 0 && (
            <div className="mt-1 border-t border-white/5 pt-2">
              <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-500">
                <Terminal size={12} /> Console
              </div>
              {result.logs.map((l, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap ${
                    l.level === 'error' ? 'text-rose-300' : l.level === 'warn' ? 'text-amber-300' : 'text-slate-300'
                  }`}
                >
                  {l.text}
                </div>
              ))}
            </div>
          )}
          {!result.error && total === 0 && result.logs.length === 0 && (
            <div className="text-slate-500">Ran with no output. Use console.log to print values.</div>
          )}
        </div>
      )}
    </div>
  )
}
