import { useEffect, useState } from 'react'

/** Step-through state with optional autoplay. */
export function useSteps(total: number, interval = 1400) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    if (step >= total - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setStep((s) => s + 1), interval)
    return () => clearTimeout(t)
  }, [playing, step, total, interval])
  return {
    step,
    setStep: (n: number) => {
      setStep(n)
    },
    playing,
    setPlaying: (b: boolean) => {
      if (b && step >= total - 1) setStep(0)
      setPlaying(b)
    },
  }
}
