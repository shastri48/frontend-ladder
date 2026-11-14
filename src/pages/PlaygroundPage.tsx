import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const Playground = lazy(() => import('../components/Playground'))

const STARTER = `// A scratchpad for experiments. ⌘/Ctrl + Enter to run.
// Try predicting the output before you run it!

console.log('1: sync')
setTimeout(() => console.log('4: macrotask (timeout)'), 0)
Promise.resolve().then(() => console.log('3: microtask (promise)'))
queueMicrotask(() => console.log('3b: microtask (queueMicrotask)'))
console.log('2: sync')

const counter = (() => {
  let count = 0 // private via closure
  return { inc: () => ++count, get value() { return count } }
})()
counter.inc(); counter.inc()
console.log('closure count =', counter.value)

console.log([1, [2, [3, [4]]]].flat(Infinity))
console.log(0.1 + 0.2 === 0.3, 0.1 + 0.2)
`

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">JavaScript playground</h1>
      <p className="mt-1 text-muted">Runs in an isolated sandbox in your browser. Your code is saved automatically.</p>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex h-96 items-center justify-center rounded-xl border border-line text-faint">
              <Loader2 className="animate-spin" />
            </div>
          }
        >
          <Playground initial={STARTER} storageKey="__playground" minHeight="420px" />
        </Suspense>
      </div>
      <p className="mt-3 text-xs text-faint">
        Tip: <code>test(name, fn)</code>, <code>expect(x).toEqual(y)</code> and <code>sleep(ms)</code> are available here too, so you can write quick tests.
      </p>
    </div>
  )
}
