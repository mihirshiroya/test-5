export type ComparisonMode = "today" | "week"

export type SeriesPoint = {
  label: string
  current: number
  previous: number
}

export type MetricKey = "focus" | "tasks" | "rate" | "sessions"

export type Metric = {
  key: MetricKey
  label: string
  /** current value for the selected comparison period */
  today: number
  yesterday: number
  weekTotal: number
  prevWeekTotal: number
  /** how to render the value */
  unit: "minutes" | "count" | "percent"
  /** lower delta is better for this metric (e.g. avoid) */
  invert?: boolean
}

export type Task = {
  id: string
  title: string
  project: string
  tag: "purple" | "orange" | "green" | "sky"
  estimate: number // minutes
  done: boolean
  time: string
}

export type Activity = {
  id: string
  kind: "completed" | "created" | "focus" | "comment" | "milestone"
  text: string
  meta: string
  ago: string
}

export type HeatCell = {
  date: string
  value: number // 0-4 intensity
  minutes: number
}

export type AnalyticsData = {
  metrics: Metric[]
  weekSeries: SeriesPoint[]
  daySeries: SeriesPoint[]
  tasks: Task[]
  activity: Activity[]
  heatmap: HeatCell[]
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const HOURS = ["6a", "9a", "12p", "3p", "6p", "9p"]

function buildHeatmap(): HeatCell[] {
  const cells: HeatCell[] = []
  const totalDays = 365

  // Always use today's date as the latest date
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)

    // Deterministic seed based on the actual date
    const seed =
      d.getFullYear() * 31 +
      (d.getMonth() + 1) * 17 +
      d.getDate() * 13 +
      d.getDay() * 7

    const normalizedSeed = Math.abs(seed) % 11

    const weekendPenalty =
      d.getDay() === 0 || d.getDay() === 6 ? 3 : 0

    const raw = Math.max(
      0,
      normalizedSeed - weekendPenalty
    )

    const value =
      raw === 0
        ? 0
        : Math.min(4, Math.ceil(raw / 2.6))

    cells.push({
      date: d.toISOString().slice(0, 10),
      value,
      minutes: value * 45 + (normalizedSeed % 3) * 10,
    })
  }

  return cells
}

export function getAnalyticsData(): AnalyticsData {
  const metrics: Metric[] = [
    {
      key: "focus",
      label: "Focus time",
      today: 227,
      yesterday: 189,
      weekTotal: 1284,
      prevWeekTotal: 1102,
      unit: "minutes",
    },
    {
      key: "tasks",
      label: "Tasks completed",
      today: 9,
      yesterday: 11,
      weekTotal: 47,
      prevWeekTotal: 41,
      unit: "count",
    },
    {
      key: "rate",
      label: "Completion rate",
      today: 78,
      yesterday: 71,
      weekTotal: 82,
      prevWeekTotal: 76,
      unit: "percent",
    },
    {
      key: "sessions",
      label: "Focus sessions",
      today: 6,
      yesterday: 5,
      weekTotal: 34,
      prevWeekTotal: 29,
      unit: "count",
    },
  ]

  const weekSeries: SeriesPoint[] = [
    { label: "Mon", current: 198, previous: 152 },
    { label: "Tue", current: 242, previous: 210 },
    { label: "Wed", current: 176, previous: 188 },
    { label: "Thu", current: 264, previous: 172 },
    { label: "Fri", current: 227, previous: 196 },
    { label: "Sat", current: 96, previous: 110 },
    { label: "Sun", current: 81, previous: 74 },
  ]

  const daySeries: SeriesPoint[] = [
    { label: "6a", current: 12, previous: 4 },
    { label: "9a", current: 68, previous: 52 },
    { label: "12p", current: 41, previous: 38 },
    { label: "3p", current: 74, previous: 61 },
    { label: "6p", current: 26, previous: 30 },
    { label: "9p", current: 6, previous: 4 },
  ]

  const tasks: Task[] = [
    { id: "t1", title: "Finalize Q3 roadmap deck", project: "Planning", tag: "purple", estimate: 60, done: true, time: "9:10 AM" },
    { id: "t2", title: "Review pull request #482", project: "Engineering", tag: "sky", estimate: 25, done: true, time: "10:40 AM" },
    { id: "t3", title: "Write onboarding email sequence", project: "Growth", tag: "orange", estimate: 45, done: false, time: "1:00 PM" },
    { id: "t4", title: "Sync with design on heatmap", project: "Design", tag: "green", estimate: 30, done: false, time: "2:30 PM" },
    { id: "t5", title: "Prep investor update", project: "Ops", tag: "purple", estimate: 40, done: false, time: "4:00 PM" },
  ]

  const activity: Activity[] = [
    { id: "a1", kind: "completed", text: "Completed “Finalize Q3 roadmap deck”", meta: "Planning", ago: "12m ago" },
    { id: "a2", kind: "focus", text: "Logged a 52 min focus session", meta: "Deep work", ago: "48m ago" },
    { id: "a3", kind: "milestone", text: "Hit 80% completion rate this week", meta: "Milestone", ago: "1h ago" },
    { id: "a4", kind: "created", text: "Added 3 tasks to “Growth”", meta: "Growth", ago: "2h ago" },
    { id: "a5", kind: "comment", text: "Commented on “Heatmap spec”", meta: "Design", ago: "3h ago" },
  ]

  return {
    metrics,
    weekSeries,
    daySeries,
    tasks,
    activity,
    heatmap: buildHeatmap(),
  }
}

export const chartAxis = { WEEKDAYS, HOURS }

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatValue(m: Metric, value: number): string {
  if (m.unit === "minutes") return formatMinutes(value)
  if (m.unit === "percent") return `${value}%`
  return `${value}`
}

export function metricValues(m: Metric, mode: ComparisonMode) {
  const current = mode === "today" ? m.today : m.weekTotal
  const previous = mode === "today" ? m.yesterday : m.prevWeekTotal
  const delta = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100)
  return { current, previous, delta }
}
