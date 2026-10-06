import { useEffect, useRef, useState } from 'react'

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const

export function chartColor(index: number, override?: string) {
  return override ?? CHART_COLORS[index % CHART_COLORS.length]
}

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

/** Deterministic PRNG (mulberry32) so demo data is stable between renders. */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Animates from the previous value to `target` with an ease-out curve. */
export function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(target)
  const current = useRef(target)

  useEffect(() => {
    const from = current.current
    const to = target
    if (from === to) return

    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (to - from) * eased
      current.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}
