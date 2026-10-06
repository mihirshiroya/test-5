"use client"

import { format } from "date-fns"
import {
  CalendarDays,
  Clock,
  Tag,
  Activity,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./sheet"

import { Separator } from "./separator"

import {
  getWorkspaceVisual,
  getPriorityVisual,
  useWorkspaceMap,
  STATUS_CONFIG,
  formatDurationLabel,
  type Task,
} from "../../lib/tasks"

import { cn } from "../../lib/utills"

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  LOW: "Low priority",
  MEDIUM: "Medium priority",
  HIGH: "High priority",
  URGENT: "Urgent priority",
}

function getPriorityClass(priority: Task["priority"]) {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "badge-priority-urgent"

    case "high":
      return "badge-priority-high"

    case "medium":
      return "badge-priority-medium"

    case "low":
      return "badge-priority-low"

    default:
      return "badge-priority-default"
  }
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Hooks must run before the early return below (rules of hooks).
  const workspaceMap = useWorkspaceMap()

  if (!task) return null

  const workspace = getWorkspaceVisual(workspaceMap.get(task.workspaceId))
  const status = STATUS_CONFIG[task.status]

  const priorityClass = getPriorityClass(task.priority)
  const priorityLabel = getPriorityVisual(task.priority).label

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full bg-canvas sm:max-w-md"
      >
        {/* Header */}
        <SheetHeader className="gap-3 border-b border-soft pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg leading-snug text-balance">
            <span className="min-w-0">{task.title}</span>

            <span
              title={PRIORITY_LABEL[task.priority]}
              className={cn(
                "shrink-0 px-2 py-0.5 text-[11px] font-medium",
                priorityClass,
              )}
            >
              {priorityLabel}
            </span>
          </SheetTitle>

          <SheetDescription className="sr-only">
            Task details for {task.title}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description -
            </h3>

            <p className="text-sm leading-relaxed text-secondary">
              {task.description || "No description provided."}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* Deadline */}
            <div className="flex items-start gap-3">
              <CalendarDays
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />

              <div className="min-w-0 text-xs">
                <p className="font-medium text-secondary">
                  {task.deadlineDate
                    ? format(
                      new Date(task.deadlineDate),
                      "EEEE, MMMM d, yyyy",
                    )
                    : "No deadline set"}
                </p>
              </div>
            </div>

            {/* Time */}
            <div className="flex items-start gap-3">
              <Clock
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />

              <div className="min-w-0 text-xs">
                <p className="font-medium text-secondary">
                  {formatDurationLabel(
                    task.plannedDurationSeconds,
                  )}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-3">
              <Activity
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />

              <div className="min-w-0 !text-xs">
                <p className="text-secondary">
                  {status.label}
                </p>
              </div>
            </div>

            {/* Workspace */}
            <div className="flex items-center gap-3">
              <Tag
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />

              <span
                style={workspace.chipStyle}
                className="text-xs !text-secondary"
              >
                {workspace.label}
              </span>
            </div>
          </div>

          <Separator />
        </div>
      </SheetContent>
    </Sheet>
  )
}
