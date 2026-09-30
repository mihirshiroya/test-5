
import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

import {
  type AnalyticsData,
  type ComparisonMode,
  getAnalyticsData,
} from "../components/Ui/analytics-data"

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

const LOAD_MS = 1400
function getGreeting(name: string) {
  const hour = new Date().getHours()

  if (hour < 12) {
    return `Good morning, ${name}`
  }

  if (hour < 17) {
    return `Good afternoon, ${name}`
  }

  if (hour < 21) {
    return `Good evening, ${name}`
  }

  return `Good night, ${name}`
}

export default function Overview() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [mode, setMode] = useState<ComparisonMode>("today")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setData(null)

    const timer = setTimeout(() => {
      setData(getAnalyticsData())
    }, LOAD_MS)

    return () => clearTimeout(timer)
  }, [])

  function refresh() {
    setData(null)

    setTimeout(() => {
      setData(getAnalyticsData())
    }, LOAD_MS)
  }

  const loading = data === null

  return (
    <main className="min-h-screen bg-background">
      <div className="flex w-full flex-col gap-[clamp(1rem,3vw,1.75rem)]">
        {/* Header */}
        <header className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-heading-3 text-primary text-balance">
              {getGreeting("Alex")}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            

            {/* Day / Week Dropdown */}
           
<DropdownMenu open={open} onOpenChange={setOpen}>
  <DropdownMenuTrigger asChild>
    <button
      type="button"
      className="inline-flex h-9 min-w-[110px] items-center justify-between gap-2 border border-soft bg-canvas px-3 text-sm font-medium text-primary outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>
        {mode === "today" ? "Today" : "This Week"}
      </span>

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
    </button>
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
      <DropdownMenuRadioItem value="today">
        Today
      </DropdownMenuRadioItem>

      <DropdownMenuRadioItem value="week">
        This Week
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>


          </div>
        </header>

        {/* Stat Cards */}
        <section
          aria-label="Key metrics"
          className="grid grid-cols-1 gap-[clamp(0.75rem,2vw,1rem)] sm:grid-cols-2 lg:grid-cols-4"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))
            : data.metrics.map((metric, index) => (
                <StatCard
                  key={metric.key}
                  metric={metric}
                  mode={mode}
                  index={index}
                />
              ))}
        </section>

        {/* Chart + Today's Tasks */}
        <section className="grid grid-cols-1 items-stretch gap-[clamp(0.75rem,2vw,1rem)] lg:grid-cols-3">
          {/* Trend Chart */}
          <div className="flex min-h-0 lg:col-span-2">
            {loading ? (
              <div className="h-full w-full">
                <ChartSkeleton />
              </div>
            ) : (
              <div className="h-full w-full">
                <TrendChart
                  mode={mode}
                  weekSeries={data.weekSeries}
                  daySeries={data.daySeries}
                />
              </div>
            )}
          </div>

          {/* Today's Tasks */}
          <div className="flex min-h-0 lg:col-span-1">
            {loading ? (
              <div className="h-full w-full">
                <ListSkeleton rows={5} />
              </div>
            ) : (
              <div className="h-full w-full">
                <TodaysTasks initial={data.tasks} />
              </div>
            )}
          </div>
        </section>

        {/* Recent Activity + Heatmap */}
        <section className="grid grid-cols-1 gap-[clamp(0.75rem,2vw,1rem)] lg:grid-cols-3">
          {/* Recent Activity */}
          <div className="lg:col-span-1">
            {loading ? (
              <ListSkeleton rows={6} />
            ) : (
              <RecentActivity items={data.activity} />
            )}
          </div>

          {/* Activity Heatmap */}
          <div className="lg:col-span-2">
            {loading ? (
              <HeatmapSkeleton />
            ) : (
              <ActivityHeatmap cells={data.heatmap} />
            )}
          </div>
        </section>

      </div>
    </main>
  )
}


