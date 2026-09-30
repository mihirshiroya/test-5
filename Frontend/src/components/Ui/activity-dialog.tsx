"use client"

import { useEffect, useRef } from "react"
import { AlarmClock } from "lucide-react"
import {
  useTaskStore,
  formatDuration,
  taskSpentSeconds,
} from "../../store/slices/taskSlice"

/**
 * NOTE ON MIGRATION:
 *
 * The old TimerState had a dedicated "checking" phase with a hard
 * `checkDeadline` timestamp, which powered the circular countdown you'd
 * see here. The new TimerState doesn't track a check-in deadline at all —
 * `timerTick` just flips `isStale` to true if too much time passed since
 * the timer was last confirmed as running (e.g. the tab was backgrounded
 * or the machine slept). Because there's no deadline to count down to
 * anymore, this dialog now shows as soon as the timer goes stale, with no
 * countdown — the person can confirm they're still working or pause.
 */
export function ActivityDialog() {
  const { timer, tasks, workspaces, confirmActive, holdTask } = useTaskStore()

  const primaryRef = useRef<HTMLButtonElement>(null)

  const open = timer.phase === "running" && timer.isStale && !!timer.taskId

  const task = tasks.find((t) => t.id === timer.taskId)

  /*
   * Focus primary action.
   */
  useEffect(() => {
    if (open) {
      primaryRef.current?.focus()
    }
  }, [open])

  if (!open || !task) {
    return null
  }

  const workspace = workspaces.find((w) => w.id === task.workspaceId)
  const workspaceLabel = workspace?.name ?? "Workspace"

  const spent = taskSpentSeconds(task, timer)

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-foreground/35 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
      aria-describedby="checkin-desc"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        {/* ============================================================ */}
        {/* HEADER                                                        */}
        {/* ============================================================ */}

        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary-soft">
              <AlarmClock
                size={15}
                className="text-primary"
                aria-hidden="true"
              />
            </div>

            <span className="text-sm font-semibold text-foreground">
              Focus Check-in
            </span>
          </div>

          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-warning">
            Check-in
          </span>
        </div>

        {/* ============================================================ */}
        {/* CONTENT                                                       */}
        {/* ============================================================ */}

        <div className="flex flex-col items-center px-5 py-5">
          {/* Task */}
          <span className="mb-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {workspaceLabel}
          </span>

          <h2
            id="checkin-title"
            className="max-w-[90%] truncate text-center text-sm font-semibold text-foreground"
            title={task.title}
          >
            {task.title}
          </h2>

          {/* Description */}
          <p
            id="checkin-desc"
            className="mt-1.5 max-w-[280px] text-center text-[11px] leading-4 text-muted-foreground"
          >
            We noticed a gap since your last check-in. Are you still working
            on this task?
          </p>

          {/* ======================================================== */}
          {/* STATUS                                                    */}
          {/* ======================================================== */}

          <div className="relative my-5 flex size-[108px] flex-col items-center justify-center rounded-full border-4 border-warning-soft">
            <AlarmClock
              size={28}
              className="animate-pulse text-warning"
              aria-hidden="true"
            />

            <span className="mt-2 font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatDuration(spent)}
            </span>

            <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
              spent so far
            </span>
          </div>

          {/* ======================================================== */}
          {/* ACTIONS                                                    */}
          {/* ======================================================== */}

          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => holdTask(task.id)}
              className="flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Pause it
            </button>

            <button
              ref={primaryRef}
              type="button"
              onClick={() => confirmActive(task.id)}
              className="flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Yes, continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}