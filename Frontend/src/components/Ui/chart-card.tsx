'use client'

import { Calendar, ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utills'
import { formatNumber, useCountUp } from '../../lib/chart-utils'

export type Period<T> = { id: string; label: string; data: T }

export function usePeriod<T>(periods: Period<T>[], controlledId?: string) {
  const [internalId, setInternalId] = useState(periods[0]?.id)
  const activeId = controlledId ?? internalId
  const period = periods.find((p) => p.id === activeId) ?? periods[0]
  return { period, periodId: period?.id, setPeriodId: setInternalId }
}

type ChartCardProps = {
  title: string
  subtitle?: string
  value?: number
  format?: (value: number) => string
  delta?: number
  periods?: { id: string; label: string }[]
  periodId?: string
  onPeriodChange?: (id: string) => void
  headerRight?: ReactNode
  children: ReactNode
  className?: string
}

export function ChartCard({
  title,
  subtitle,
  value,
  format,
  delta,
  periods,
  periodId,
  onPeriodChange,
  headerRight,
  children,
  className,
}: ChartCardProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col gap-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-xs',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="truncate text-sm text-muted-foreground">{subtitle ?? title}</p>
          {value !== undefined && <Headline value={value} format={format} delta={delta} />}
        </div>
        {headerRight ??
          (periods && periods.length > 0 && periodId && onPeriodChange ? (
            <PeriodSelect options={periods} value={periodId} onChange={onPeriodChange} />
          ) : null)}
      </header>
      {children}
    </section>
  )
}

function Headline({
  value,
  format = formatNumber,
  delta,
}: {
  value: number
  format?: (value: number) => string
  delta?: number
}) {
  const animated = useCountUp(value)
  return (
    <div className="flex items-center gap-2">
      <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
        {format(animated)}
      </span>
      {delta !== undefined && <DeltaChip delta={delta} />}
    </div>
  )
}

export function DeltaChip({ delta }: { delta: number }) {
  const positive = delta >= 0
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
        positive ? 'bg-chart-1/45 text-foreground' : 'bg-destructive/15 text-destructive',
      )}
    >
      {positive ? '+' : ''}
      {delta.toFixed(1)}%
    </span>
  )
}

export function PeriodSelect({
  options,
  value,
  onChange,
  label = 'Select period',
}: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  const current = options.find((o) => o.id === value) ?? options[0]
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-xs transition-colors hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
      <span>{current.label}</span>
      <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      <select
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={current.id}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function StatTile({
  label,
  value,
  color,
  hint,
  active,
  dimmed,
  className,
  ...rest
}: {
  label: string
  value: ReactNode
  color?: string
  hint?: ReactNode
  active?: boolean
  dimmed?: boolean
  className?: string
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className'>) {
  return (
    <div
      {...rest}
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-xl border bg-muted/40 px-3 py-2 transition-all duration-200',
        active && 'border-foreground/20 bg-muted/70',
        dimmed && 'opacity-40',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {color && (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: color }}
          />
        )}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
