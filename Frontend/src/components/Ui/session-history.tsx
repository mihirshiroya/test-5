import { useEffect, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { CalendarDays, Clock3, Target, Layers, RefreshCw } from "lucide-react"
import { cn } from "../../lib/utills"
import { chartColor, sum, useCountUp } from "../../lib/chart-utils"
import {
  type SessionRecord,
  durationSeconds,
  formatCompact,
  formatDuration,
  formatClock,
} from "../../lib/time"
import { SessionGantt } from "./session-gantt"
import { localDayKey } from "./analytics-data"
import { useAppDispatch, useAppSelector } from "../../store"
import { fetchSessions, selectSessions } from "../../store/slices/analyticsSlice"
import { selectTimer } from "../../store/slices/taskSlice"

const DEFAULT_GOAL_SECONDS = 4 * 60 * 60
const LIVE_REFRESH_MS = 30_000

export function SessionHistory() {
  const dispatch = useAppDispatch()
  const { data: day, status, error, selectedDate } = useAppSelector(selectSessions)
  const timer = useSelector(selectTimer)

  const current = day && day.date === selectedDate ? day : null
  const isCurrent = current !== null
  const sessions: SessionRecord[] = current?.sessions ?? []
  const goalSeconds = current?.goalSeconds ?? DEFAULT_GOAL_SECONDS
  const hasRunning = current?.sessions.some((s) => s.running) ?? false
  const loading = status === "loading" && !isCurrent
  const today = localDayKey()

  // Load the selected day, and reload when the timer starts/pauses/stops.
  useEffect(() => {
    dispatch(fetchSessions(selectedDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, selectedDate, timer.phase, timer.taskId])

  // Keep a running session's bar growing while viewing today.
  useEffect(() => {
    if (!hasRunning || selectedDate !== today) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") dispatch(fetchSessions(selectedDate))
    }, LIVE_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [dispatch, hasRunning, selectedDate, today])

  // Task currently hovered in the donut chart or the task list
  const [activeTask, setActiveTask] = useState<string | null>(null)

  const dateInputRef = useRef<HTMLInputElement>(null)

  // --------------------------------------------------
  // Date picker
  // --------------------------------------------------

  const handleDateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const date = event.target.value
    if (!date || date > today) return
    dispatch(fetchSessions(date))
  }

  const openDatePicker = () => {
    const input = dateInputRef.current

    if (!input) return

    // Supported browsers
    if (typeof input.showPicker === "function") {
      input.showPicker()
    } else {
      // Fallback
      input.focus()
      input.click()
    }
  }

  // --------------------------------------------------
  // Stable color per task
  // --------------------------------------------------

  const taskOrder: string[] = []

  for (const session of sessions) {
    if (!taskOrder.includes(session.taskName)) {
      taskOrder.push(session.taskName)
    }
  }

  const colors: Record<string, string> = {}

  taskOrder.forEach((task, index) => {
    colors[task] = chartColor(index)
  })

  // --------------------------------------------------
  // Total duration
  // --------------------------------------------------

  const totalSeconds = sum(sessions.map(durationSeconds))

  // --------------------------------------------------
  // Goal progress
  // --------------------------------------------------

  const goalPercent =
    goalSeconds > 0
      ? Math.min(
          100,
          (totalSeconds / goalSeconds) * 100
        )
      : 0

  // --------------------------------------------------
  // Task breakdown
  // --------------------------------------------------

  const byTask: TaskSummary[] = taskOrder
    .map((name) => ({
      name,
      color: colors[name],

      seconds: sum(
        sessions
          .filter((session) => session.taskName === name)
          .map(durationSeconds)
      ),

      count: sessions.filter(
        (session) =>
          session.taskName === name
      ).length,
    }))
    .sort(
      (a, b) =>
        b.seconds - a.seconds
    )

  // --------------------------------------------------
  // Date label
  // --------------------------------------------------

  const dateLabel = new Date(
    `${selectedDate}T00:00:00`
  ).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="mx-auto w-full">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance">
            Session Log
          </h1>
        </div>

        {/* Date picker */}
        <div className="relative flex items-center gap-3 font-mono text-4xl font-semibold tabular-nums text-foreground">
          <button
            type="button"
            onClick={() => dispatch(fetchSessions(selectedDate))}
            disabled={status === "loading"}
            aria-label="Refresh sessions"
            className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", status === "loading" && "animate-spin")}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={openDatePicker}
            className="group flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Select date. Current date is ${dateLabel}`}
          >
            <CalendarDays
              className="h-3.5 w-3.5 transition-colors group-hover:text-foreground"
              aria-hidden="true"
            />

            <span>{dateLabel}</span>
          </button>

          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            max={today}
            onChange={handleDateChange}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </header>

      {status === "failed" && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-soft p-4 text-sm text-foreground"
        >
          <span>{error ?? "Could not load sessions."}</span>
          <button
            type="button"
            onClick={() => dispatch(fetchSessions(selectedDate))}
            className="border border-soft px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Try again
          </button>
        </div>
      )}

      {/* Stat strip */}
      <div
        className={cn(
          "mb-8 grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4",
          loading && "opacity-50"
        )}
        aria-busy={loading}
      >
        <StatCard
          icon={Clock3}
          label="Total Active Time"
          value={formatDuration(totalSeconds)}
        />

        <StatCard
          icon={Layers}
          label="Sessions"
          value={String(sessions.length)}
        />

        <StatCard
          icon={Target}
          label="Tasks"
          value={String(taskOrder.length)}
        />

        <StatCard
          icon={Target}
          label="Goal Progress"
          value={`${Math.round(goalPercent)}%`}
          hint={`${formatDuration(
            totalSeconds
          )} / ${formatDuration(goalSeconds)}`}
        />
      </div>

      {/* Goal progress bar */}
      <div className="mb-10 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Daily goal progress
          </span>

          <span className="font-mono tabular-nums text-foreground">
            {formatDuration(totalSeconds)} /{" "}
            {formatDuration(goalSeconds)}
          </span>
        </div>

        <div
          className="flex h-2.5 w-full overflow-hidden bg-secondary"
          role="progressbar"
          aria-valuenow={Math.round(goalPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {byTask.map((task) => (
            <div
              key={task.name}
              style={{
                width: `${
                  goalSeconds > 0
                    ? (task.seconds /
                        goalSeconds) *
                      100
                    : 0
                }%`,
                backgroundColor:
                  task.color,
              }}
            />
          ))}
        </div>
      </div>

      {/* Timeline chart panel */}
      <section className="mb-10 border border-soft bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Timeline
          </h2>

          <span className="text-xs text-muted-foreground">
            Grouped by task
          </span>
        </div>

        <SessionGantt
          sessions={sessions}
          colors={colors}
        />
      </section>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:h-[500px] lg:grid-cols-2">
        {/* Sessions */}
        <section className="min-h-0 overflow-y-auto border border-soft bg-card p-6 no-scrollbar">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
            Sessions
          </h2>

          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading sessions…" : "No focus sessions on this day."}
            </p>
          )}

          <ol className="flex flex-col">
            {sessions.map(
              (session, index) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  color={
                    colors[
                      session.taskName
                    ]
                  }
                  last={
                    index ===
                    sessions.length - 1
                  }
                />
              )
            )}
          </ol>
        </section>

        {/* By task */}
        <section className="min-h-0 overflow-y-auto border border-soft bg-card p-6 no-scrollbar">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
            By Task
          </h2>

          {/* Donut chart */}
          <div className="mb-6 flex justify-center">
            <TaskDonut
              tasks={byTask}
              totalSeconds={totalSeconds}
              activeTask={activeTask}
              onActiveChange={setActiveTask}
            />
          </div>

          {/* Task list */}
          <ul className="flex flex-col gap-4">
            {byTask.map((task) => {
              const percent =
                totalSeconds > 0
                  ? Math.round(
                      (task.seconds /
                        totalSeconds) *
                        100
                    )
                  : 0

              const dimmed =
                activeTask !== null &&
                activeTask !== task.name

              return (
                <li
                  key={task.name}
                  className={cn(
                    "flex flex-col gap-2 transition-opacity duration-200",
                    dimmed && "opacity-40"
                  )}
                  onMouseEnter={() =>
                    setActiveTask(task.name)
                  }
                  onMouseLeave={() =>
                    setActiveTask(null)
                  }
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {task.name}
                    </span>

                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatCompact(
                        task.seconds
                      )}
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden bg-secondary">
                    <div
                      className="h-full"
                      style={{
                        width:
                          totalSeconds > 0
                            ? `${
                                (task.seconds /
                                  totalSeconds) *
                                100
                              }%`
                            : "0%",
                        backgroundColor:
                          task.color,
                      }}
                    />
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {task.count}{" "}
                    {task.count === 1
                      ? "session"
                      : "sessions"}{" "}
                    · {percent}% of total
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Task Donut Chart
// --------------------------------------------------

type TaskSummary = {
  name: string
  color: string
  seconds: number
  count: number
}

const DONUT_SIZE = 200
const DONUT_CENTER = DONUT_SIZE / 2
const DONUT_STROKE = 22
const DONUT_RADIUS = 78
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS
const DONUT_GAP = 3

function truncate(text: string, max: number) {
  return text.length > max
    ? `${text.slice(0, max - 1)}…`
    : text
}

function TaskDonut({
  tasks,
  totalSeconds,
  activeTask,
  onActiveChange,
}: {
  tasks: TaskSummary[]
  totalSeconds: number
  activeTask: string | null
  onActiveChange: (name: string | null) => void
}) {
  const [mounted, setMounted] = useState(false)
  const animatedTotal = useCountUp(totalSeconds)

  // Draw-in animation on first render
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setMounted(true)
    )

    return () => cancelAnimationFrame(frame)
  }, [])

  const gap = tasks.length > 1 ? DONUT_GAP : 0

  // Arc length + start position for each task
  let cursor = 0

  const segments = tasks.map((task) => {
    const length =
      totalSeconds > 0
        ? (task.seconds / totalSeconds) *
          DONUT_CIRCUMFERENCE
        : 0

    const segment = {
      ...task,
      length,
      start: cursor,
    }

    cursor += length

    return segment
  })

  const active = tasks.find(
    (task) => task.name === activeTask
  )

  const activePercent =
    active && totalSeconds > 0
      ? Math.round(
          (active.seconds / totalSeconds) * 100
        )
      : 0

  const ariaLabel = tasks
    .map((task) => {
      const percent =
        totalSeconds > 0
          ? Math.round(
              (task.seconds / totalSeconds) * 100
            )
          : 0

      return `${task.name} ${percent}%`
    })
    .join(", ")

  return (
    <svg
      viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
      className="size-44"
      role="img"
      aria-label={`Time by task: ${ariaLabel}`}
      onMouseLeave={() => onActiveChange(null)}
    >
      {/* Background track */}
      <circle
        cx={DONUT_CENTER}
        cy={DONUT_CENTER}
        r={DONUT_RADIUS}
        fill="none"
        className="stroke-primary"
        strokeOpacity={0.15}
        strokeWidth={DONUT_STROKE}
      />

      {/* Segments */}
      {segments.map((segment) => {
        const visibleLength = Math.max(
          0,
          segment.length - gap
        )

        const isActive =
          activeTask === segment.name

        const dimmed =
          activeTask !== null && !isActive

        return (
          <circle
            key={segment.name}
            cx={DONUT_CENTER}
            cy={DONUT_CENTER}
            r={DONUT_RADIUS}
            fill="none"
            stroke={segment.color}
            strokeWidth={
              isActive
                ? DONUT_STROKE + 4
                : DONUT_STROKE
            }
            strokeDasharray={`${
              mounted ? visibleLength : 0
            } ${DONUT_CIRCUMFERENCE}`}
            strokeDashoffset={-(
              segment.start +
              gap / 2
            )}
            transform={`rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})`}
            opacity={dimmed ? 0.3 : 1}
            className="cursor-pointer"
            style={{
              transition:
                "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1), stroke-width 200ms, opacity 200ms",
            }}
            onMouseEnter={() =>
              onActiveChange(segment.name)
            }
          />
        )
      })}

      {/* Center label */}
      <g className="pointer-events-none">
        <text
          x={DONUT_CENTER}
          y={DONUT_CENTER + 2}
          textAnchor="middle"
          fontSize={22}
          fontWeight={600}
          className="fill-primary tabular-nums"
        >
          {active
            ? `${activePercent}%`
            : formatCompact(
                Math.round(animatedTotal)
              )}
        </text>

        <text
          x={DONUT_CENTER}
          y={DONUT_CENTER + 20}
          textAnchor="middle"
          fontSize={10}
          fillOpacity={0.7}
          className="fill-primary"
        >
          {active
            ? truncate(active.name, 20)
            : "Total"}
        </text>
      </g>
    </svg>
  )
}

// --------------------------------------------------
// Stat Card
// --------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{
    className?: string
  }>
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="animate-fadeIn border-2 border-soft bg-background p-5 transition-shadow hover:shadow-(--shadow-card)">
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg text-secondary">
          {label}
        </span>

        <span className="grid h-9 w-9 place-items-center rounded-notion text-steel">
          <Icon className="size-4.5" />
        </span>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="animate-count text-heading-3 tabular-nums text-primary">
          {value}
        </span>
      </div>

      {/* Optional hint */}
      {/* 
      {hint && (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {hint}
        </span>
      )}
      */}
    </div>
  )
}

// --------------------------------------------------
// Session Row
// --------------------------------------------------

function SessionRow({
  session,
  color,
  last,
}: {
  session: SessionRecord
  color: string
  last: boolean
}) {
  const start = new Date(session.start)
  const end = new Date(session.end)

  return (
    <li
      className={`flex items-center gap-4 py-3 ${
        last
          ? ""
          : "border-b border-soft"
      }`}
    >
      <span
        className="h-8 w-1 shrink-0"
        style={{
          backgroundColor: color,
        }}
        aria-hidden="true"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-foreground">
          {session.taskName}
        </span>

        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatClock(start)} —{" "}
          {formatClock(end)}
        </span>
      </div>

      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {formatDuration(
          durationSeconds(session)
        )}
      </span>
    </li>
  )
}
