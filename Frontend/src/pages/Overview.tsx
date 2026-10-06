import { useEffect, useMemo, useState } from "react"
import { useSelector } from "react-redux"
import { RefreshCw } from "lucide-react"

import type { ComparisonMode } from "../components/Ui/analytics-data"
import { useAppDispatch, useAppSelector } from "../store"
import { fetchOverview, selectOverview } from "../store/slices/analyticsSlice"
import { selectTasks } from "../store/slices/taskSlice"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/Ui/dropdown-menu"

import { StatCard } from "../components/Ui/stat-card"
import { TrendChart } from "../components/Ui/trend-chart"
import { ActivityHeatmap } from "../components/Ui/activity-heatmap"
import { TodaysTasks } from "../components/Ui/todays-tasks"
import { RecentActivity } from "../components/Ui/recent-activity"

import {
  ChartSkeleton,
  HeatmapSkeleton,
  ListSkeleton,
  StatCardSkeleton,
} from "../components/Ui/skeletons"

const POLL_MS = 60_000
const TASK_CHANGE_DEBOUNCE_MS = 800

function getGreeting(name: string) {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 17) return `Good afternoon, ${name}`
  if (hour < 21) return `Good evening, ${name}`
  return `Good night, ${name}`
}

export default function Overview() {
  const dispatch = useAppDispatch()
  const { data, status, error } = useAppSelector(selectOverview)
  const user = useAppSelector((s) => s.auth.user)
  const tasks = useSelector(selectTasks)

  const [mode, setMode] = useState<ComparisonMode>("today")
  const [open, setOpen] = useState(false)

  // Re-fetch whenever a task is created, moved, started, held or completed.
  const tasksSignature = useMemo(
    () => tasks.map((t) => `${t.id}:${t.status}:${t.completedAt ?? ""}:${t.actualDurationSeconds}`).join("|"),
    [tasks],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      dispatch(fetchOverview())
    }, data ? TASK_CHANGE_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, tasksSignature])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") dispatch(fetchOverview())
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [dispatch])

  const loading = !data
  const refreshing = status === "loading" && !!data

  return (
    <main className="min-h-screen bg-background">
      <div className="flex w-full flex-col gap-[clamp(1rem,3vw,1.75rem)]">
        <header className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-heading-3 text-primary text-balance">
              {getGreeting(user?.firstName || "there")}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch(fetchOverview())}
              disabled={status === "loading"}
              aria-label="Refresh dashboard"
              className="inline-flex size-9 items-center justify-center border border-soft bg-canvas text-primary outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            <DropdownMenu open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger
                type="button"
                className="inline-flex h-9 min-w-[110px] items-center justify-between gap-2 border border-soft bg-canvas px-3 text-sm font-medium text-primary outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{mode === "today" ? "Today" : "This Week"}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="opacity-60"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[140px]">
                <DropdownMenuRadioGroup
                  value={mode}
                  onValueChange={(value) => {
                    if (value === "today" || value === "week") {
                      setMode(value)
                      setOpen(false)
                    }
                  }}
                >
                  <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="week">This Week</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {status === "failed" && !data && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border border-soft p-4 text-sm text-primary"
          >
            <span>{error ?? "Could not load your dashboard."}</span>
            <button
              type="button"
              onClick={() => dispatch(fetchOverview())}
              className="border border-soft px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Try again
            </button>
          </div>
        )}

        <section
          aria-label="Key metrics"
          className="grid grid-cols-1 gap-[clamp(0.75rem,2vw,1rem)] sm:grid-cols-2 lg:grid-cols-4"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : data.metrics.map((metric, index) => (
                <StatCard key={metric.key} metric={metric} mode={mode} index={index} />
              ))}
        </section>

        <section className="grid grid-cols-1 items-stretch gap-[clamp(0.75rem,2vw,1rem)] lg:grid-cols-3">
          <div className="flex min-h-0 lg:col-span-2">
            <div className="h-full w-full">
              {loading ? (
                <ChartSkeleton />
              ) : (
                <TrendChart mode={mode} weekSeries={data.weekSeries} daySeries={data.daySeries} />
              )}
            </div>
          </div>

          <div className="flex min-h-0 lg:col-span-1">
            <div className="h-full w-full">
              <TodaysTasks />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-[clamp(0.75rem,2vw,1rem)] lg:grid-cols-3">
          <div className="lg:col-span-1">
            {loading ? <ListSkeleton rows={6} /> : <RecentActivity items={data.activity} />}
          </div>

          <div className="lg:col-span-2">
            {loading ? <HeatmapSkeleton /> : <ActivityHeatmap cells={data.heatmap} />}
          </div>
        </section>
      </div>
    </main>
  )
}
