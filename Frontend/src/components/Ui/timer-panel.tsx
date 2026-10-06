"use client"

import {
  Play,
  Pause,
  CheckCircle2,
  PauseCircle,
  Hourglass,
} from "lucide-react"

import {
  useActiveTask,
  useTaskStore,
  formatDuration,
  taskSpentSeconds,
  isTaskStartAllowed,
} from "../../store/slices/taskSlice"

interface TimerPanelProps {
  workspaceId?: string | null
  compact?: boolean
}

export function TimerPanel({
  workspaceId = null,
  compact = false,
}: TimerPanelProps) {
  const {
    tasks,
    timer,
    workspaces,
    startTask,
    holdTask,
    completeTask,
  } = useTaskStore()

  const {
    activeTask: active,
    remainingSeconds: remaining,
    spentSeconds: spent,
  } = useActiveTask()

  const hasActiveTask = !!timer.taskId

  const onHold = tasks
    .filter(
      (task) =>
        task.status === "ON_HOLD" &&
        (!workspaceId || task.workspaceId === workspaceId),
    )
    .sort((a, b) => a.position - b.position)

  const pct =
    active && active.plannedDurationSeconds > 0
      ? Math.min(100, Math.max(0, (spent / active.plannedDurationSeconds) * 100))
      : 0

  const radius = 62

  const circumference = 2 * Math.PI * radius

  const offset = circumference - (pct / 100) * circumference

  const isFinished = remaining <= 0

  const activeWorkspace = active
    ? workspaces.find((w) => w.id === active.workspaceId)
    : null

  /*
   * ============================
   * COMPACT TIMER
   * ============================
   *
   * Can be used when only the timer
   * needs to be displayed.
   *
   * No active task:
   * 00 : 00
   *
   * Active task:
   * remaining time
   */
  if (compact) {
    return (
      <span
        className="
          font-mono
          text-sm
          font-medium
          tabular-nums
          tracking-tight
          text-foreground
        "
      >
        {hasActiveTask ? formatDuration(Math.max(0, remaining)) : "00:00"}
      </span>
    )
  }

  return (
    <section
      aria-label="Focus timer"
      className="
        flex
        h-full
        min-h-0
        flex-col
        overflow-hidden
        bg-card
      "
    >
      {/* =========================
          ACTIVE TASK
      ========================== */}
      {active ? (
        <div className="flex flex-col items-center px-4 py-5">
          {/* Task */}
          <div
            className="
              mb-4
              flex
              w-full
              min-w-0
              items-center
              justify-center
              gap-2
            "
          >
            <span
              className="
                shrink-0
                rounded-full
                bg-muted
                px-2
                py-0.5
                text-[9px]
                font-medium
                uppercase
                tracking-wide
                text-muted-foreground
              "
            >
              {activeWorkspace?.name ?? "Workspace"}
            </span>

            <p
              className="
                min-w-0
                truncate
                text-xs
                font-medium
                text-foreground
              "
              title={active.title}
            >
              {active.title}
            </p>
          </div>

          {/* =========================
              CIRCULAR TIMER
          ========================== */}
          <div
            className="
              relative
              size-[156px]
              shrink-0
              sm:size-[170px]
            "
          >
            <svg
              viewBox="0 0 150 150"
              className="
                size-full
                -rotate-90
              "
              aria-hidden="true"
            >
              {/* Background ring */}
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                className="text-muted"
              />

              {/* Progress ring */}
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
                className={isFinished ? "text-destructive" : "text-primary"}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{
                  transition: "stroke-dashoffset 500ms linear",
                }}
              />
            </svg>

            {/* Timer content */}
            <div
              className="
                absolute
                inset-0
                flex
                flex-col
                items-center
                justify-center
              "
            >
              <span
                className="
                  text-[9px]
                  uppercase
                  tracking-wider
                  text-muted-foreground
                "
              >
                {isFinished ? "Time's up" : "Remaining"}
              </span>

              <span
                className={`
                  mt-1
                  font-mono
                  text-3xl
                  font-semibold
                  leading-none
                  tabular-nums
                  ${isFinished ? "text-destructive" : "text-foreground"}
                `}
              >
                {formatDuration(Math.max(0, remaining))}
              </span>

              <span
                className="
                  mt-2
                  text-[9px]
                  tabular-nums
                  text-muted-foreground
                "
              >
                {Math.round(pct)}% complete
              </span>
            </div>
          </div>

          {/* =========================
              STATS
          ========================== */}
          <div
            className="
              mt-4
              flex
              items-center
              gap-4
              text-[10px]
              text-muted-foreground
            "
          >
            <span>
              <strong
                className="
                  font-mono
                  font-medium
                  text-foreground
                "
              >
                {formatDuration(spent)}
              </strong>{" "}
              spent
            </span>

            <span
              className="
                h-3
                w-px
                bg-border
              "
            />

            <span>
              <strong
                className="
                  font-mono
                  font-medium
                  text-foreground
                "
              >
                {formatDuration(active.plannedDurationSeconds)}
              </strong>{" "}
              planned
            </span>
          </div>

          {/* =========================
              ACTIONS
          ========================== */}
          <div
            className="
              mt-4
              flex
              w-full
              max-w-[280px]
              gap-2
            "
          >
            <button
              type="button"
              onClick={() => holdTask(active.id)}
              className="
                flex
                h-9
                flex-1
                items-center
                justify-center
                gap-1.5
                rounded-lg
                border
                border-soft
                bg-background
                text-xs
                font-medium
                text-warning
                transition-colors
                hover:bg-warning-soft
              "
            >
              <Pause size={14} />
              Pause
            </button>

            <button
              type="button"
              onClick={() => completeTask(active.id)}
              className="
                flex
                h-9
                flex-1
                items-center
                justify-center
                gap-1.5
                rounded-lg
                bg-success
                text-xs
                font-medium
                text-success-foreground
                transition-opacity
                hover:opacity-90
              "
            >
              <CheckCircle2 size={14} />
              Complete
            </button>
          </div>
        </div>
      ) : (
        /* =========================
           EMPTY STATE
        ========================== */
        <div
          className="
            flex
            min-h-[210px]
            flex-col
            items-center
            justify-center
            px-6
            py-5
            text-center
          "
        >
          <div
            className="
              mb-2
              flex
              size-10
              items-center
              justify-center
              rounded-full
              bg-muted
            "
          >
            <Hourglass size={18} className="text-muted-foreground" />
          </div>

          <p
            className="
              text-xs
              font-medium
              text-foreground
            "
          >
            No active task
          </p>

          <p
            className="
              mt-1
              max-w-[260px]
              text-[11px]
              leading-4
              text-muted-foreground
            "
          >
            Resume an on-hold task or move one into progress.
          </p>
        </div>
      )}

      {/* =========================
          ON HOLD
      ========================== */}
      <div
        className="
          mt-auto
          border-t
          border-soft
          bg-muted/20
          px-3
          py-3
        "
      >
        <div
          className="
            mb-2
            flex
            items-center
            gap-1.5
          "
        >
          <PauseCircle size={14} className="text-warning" />

          <span
            className="
              text-xs
              font-semibold
              text-foreground
            "
          >
            On hold
          </span>

          <span
            className="
              text-[10px]
              text-muted-foreground
            "
          >
            {onHold.length}
          </span>
        </div>

        {onHold.length === 0 ? (
          <p
            className="
              text-[10px]
              text-muted-foreground
            "
          >
            Nothing on hold.
          </p>
        ) : (
          <ul
            className="
              flex
              max-h-28
              flex-col
              gap-1.5
              overflow-y-auto
            "
          >
            {onHold.map((task) => {
              const rem = Math.max(
                0,
                task.plannedDurationSeconds - taskSpentSeconds(task, timer),
              )

              const canResumeNow = isTaskStartAllowed(tasks, timer, task.id)

              return (
                <li
                  key={task.id}
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-2
                    border
                    border-soft
                    bg-card
                    px-2.5
                    py-2
                  "
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="
                        truncate
                        text-[11px]
                        font-medium
                        text-foreground
                      "
                    >
                      {task.title}
                    </p>

                    <p
                      className="
                        text-[9px]
                        tabular-nums
                        text-muted-foreground
                      "
                    >
                      {formatDuration(rem)} left
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => startTask(task.id)}
                    disabled={hasActiveTask && !canResumeNow}
                    className="
                      flex
                      h-7
                      shrink-0
                      items-center
                      gap-1
                      rounded-md
                      bg-primary
                      px-2
                      text-[10px]
                      font-medium
                      text-primary-foreground
                      transition-opacity
                      hover:opacity-90
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    <Play size={11} />
                    Resume
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {hasActiveTask && onHold.length > 0 && (
          <p
            className="
              mt-2
              text-[9px]
              text-muted-foreground
            "
          >
            Pause or complete the current task to resume another.
          </p>
        )}
      </div>
    </section>
  )
}