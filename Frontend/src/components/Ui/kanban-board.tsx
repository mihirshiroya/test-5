"use client"

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import confetti from "canvas-confetti"
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import {
  ChevronDownIcon,
  Plus,
  ClipboardList,
  Search,
  X,
} from "lucide-react"

import { useTaskStore } from "../../store/slices/taskSlice.tsx"
import {
  canCompleteTask,
  normalizeTimestamp,
  STATUS_META,
  STATUS_ORDER,
  isLocked,
  isTaskStartAllowed,
  type Task,
  type TaskStatus,
} from "../../store/slices/taskSlice.tsx"

import { TaskCard } from "./task-card"
import { TaskModal } from "./task-modal"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"

interface KanbanBoardProps {
  /**
   * Optional board title.
   */
  title?: string

  /**
   * Restrict the board to a single workspace.
   * When null, show tasks from every workspace.
   */
  workspaceId?: string | null
}

export function KanbanBoard({
  title,
  workspaceId = null,
}: KanbanBoardProps) {
  const {
    tasks,
    timer,
    moveTask,
    deleteTask,
  } = useTaskStore()

  const [draggingId, setDraggingId] =
    useState<string | null>(null)

  const [modalOpen, setModalOpen] =
    useState(false)

  const [editingTask, setEditingTask] =
    useState<Task | null>(null)

  const [deletingTask, setDeletingTask] =
    useState<Task | null>(null)

  const [createStatus, setCreateStatus] =
    useState<TaskStatus>("TODO")

  const [notice, setNotice] =
    useState<string | null>(null)

  const [searchQuery, setSearchQuery] =
    useState("")

  // Week is the default view.
  const [period, setPeriod] =
    useState<"day" | "week" | "month">("week")

  const completedIdsRef =
    useRef<Set<string>>(new Set())

  /* -------------------------------------------------------------------------- */
  /* Completion celebration                                                     */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const completedIds = new Set(
      tasks
        .filter(
          (task) =>
            task.status === "COMPLETED",
        )
        .map((task) => task.id),
    )

    const completedNewTask =
      [...completedIds].some(
        (id) =>
          !completedIdsRef.current.has(id),
      )

    const shouldCelebrate =
      completedIdsRef.current.size > 0 &&
      completedNewTask

    completedIdsRef.current =
      completedIds

    if (!shouldCelebrate) return

    const end = Date.now() + 5000

    const colors = [
      "#bb0000",
      "#ffffff",
    ]

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      })

      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [tasks])

  /* -------------------------------------------------------------------------- */
  /* Visible tasks                                                              */
  /* -------------------------------------------------------------------------- */

  const visibleTasks = useMemo(() => {
    const normalizedQuery =
      searchQuery
        .trim()
        .toLocaleLowerCase()

    const now = new Date()

    const periodStart = new Date(now)
    const periodEnd = new Date(now)

    periodStart.setHours(
      0,
      0,
      0,
      0,
    )

    periodEnd.setHours(
      23,
      59,
      59,
      999,
    )

    if (period === "week") {
      // Today plus the next seven calendar days.
      periodEnd.setDate(
        periodEnd.getDate() + 7,
      )

      periodEnd.setHours(
        23,
        59,
        59,
        999,
      )
    } else if (period === "month") {
      periodStart.setDate(1)

      periodEnd.setMonth(
        periodStart.getMonth() + 1,
        0,
      )

      periodEnd.setHours(
        23,
        59,
        59,
        999,
      )
    }

    return tasks.filter((task) => {
      const matchesWorkspace =
        workspaceId == null ||
        task.workspaceId === workspaceId

      const isUnfinished =
        task.status !== "COMPLETED"

      /*
       * Completed views are based on when work was completed.
       */
      const taskDate = isUnfinished
        ? normalizeTimestamp(
            task.startDate,
          ) ??
          normalizeTimestamp(
            task.createdAt,
          )
        : normalizeTimestamp(
            task.completedAt,
          ) ??
          normalizeTimestamp(
            task.startDate,
          ) ??
          normalizeTimestamp(
            task.createdAt,
          )

      const start =
        periodStart.getTime()

      const end =
        periodEnd.getTime()

      /*
       * Unfinished work remains visible once it is due/available.
       * Future tasks only appear inside the selected window.
       */
      const matchesPeriod =
        taskDate == null ||
        (isUnfinished
          ? taskDate <= end
          : taskDate >= start &&
            taskDate <= end)

      if (
        !matchesWorkspace ||
        !matchesPeriod
      ) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return [
        task.title,
        task.description,
        task.priority,
        task.status,
      ].some((value) =>
        value
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    })
  }, [
    tasks,
    workspaceId,
    searchQuery,
    period,
  ])

  /* -------------------------------------------------------------------------- */
  /* Columns                                                                    */
  /* -------------------------------------------------------------------------- */

  const columns = useMemo(() => {
    const result: Record<
      TaskStatus,
      Task[]
    > = {
      TODO: [],
      IN_PROGRESS: [],
      ON_HOLD: [],
      COMPLETED: [],
    }

    for (const task of visibleTasks) {
      result[task.status].push(task)
    }

    for (const status of STATUS_ORDER) {
      result[status].sort((a, b) => {
        if (a.workspaceId === b.workspaceId) {
          return (
            a.position - b.position
          )
        }

        return a.workspaceId.localeCompare(
          b.workspaceId,
        )
      })
    }

    return result
  }, [visibleTasks])

  /* -------------------------------------------------------------------------- */
  /* Active task state                                                          */
  /* -------------------------------------------------------------------------- */

  const hasInProgress = useMemo(
    () =>
      tasks.some(
        (task) =>
          task.status ===
          "IN_PROGRESS",
      ),
    [tasks],
  )

  const draggingTask = useMemo(() => {
    if (!draggingId) {
      return null
    }

    return (
      tasks.find(
        (task) =>
          task.id === draggingId,
      ) ?? null
    )
  }, [tasks, draggingId])

  /* -------------------------------------------------------------------------- */
  /* Create task                                                                */
  /* -------------------------------------------------------------------------- */

  const openCreate = useCallback(
    (status: TaskStatus) => {
      setEditingTask(null)
      setCreateStatus(status)
      setModalOpen(true)
    },
    [],
  )

  /* -------------------------------------------------------------------------- */
  /* Edit task                                                                  */
  /* -------------------------------------------------------------------------- */

  const openEdit = useCallback(
    (task: Task) => {
      if (isLocked(task.status)) {
        return
      }

      setEditingTask(task)
      setModalOpen(true)
    },
    [],
  )

  /* -------------------------------------------------------------------------- */
  /* Delete task                                                                */
  /* -------------------------------------------------------------------------- */

  const openDelete = useCallback(
    (task: Task) => {
      setDeletingTask(task)
    },
    [],
  )

  const confirmDelete =
    useCallback(() => {
      if (deletingTask) {
        deleteTask(
          deletingTask.id,
        )
      }

      setDeletingTask(null)
    }, [
      deleteTask,
      deletingTask,
    ])

  /* -------------------------------------------------------------------------- */
  /* Drag start                                                                 */
  /* -------------------------------------------------------------------------- */

  const onDragStart = useCallback(
    (start: {
      draggableId: string
    }) => {
      setDraggingId(
        start.draggableId,
      )
    },
    [],
  )

  /* -------------------------------------------------------------------------- */
  /* Drag end                                                                   */
  /* -------------------------------------------------------------------------- */

  const onDragEnd = useCallback(
    (result: DropResult) => {
      setDraggingId(null)

      const {
        source,
        destination,
        draggableId,
      } = result

      if (!destination) {
        return
      }

      /*
       * Nothing changed.
       */
      if (
        source.droppableId ===
          destination.droppableId &&
        source.index ===
          destination.index
      ) {
        return
      }

      const destinationStatus =
        destination.droppableId as TaskStatus

      const dragged = tasks.find(
        (task: Task) =>
          task.id === draggableId,
      )

      /*
       * Completion restriction.
       */
      if (
        dragged &&
        destinationStatus ===
          "COMPLETED" &&
        !canCompleteTask(
          tasks,
          timer,
          dragged.id,
        )
      ) {
        setNotice(
          "Complete becomes available after 75% of the planned time is used.",
        )

        window.setTimeout(
          () =>
            setNotice(null),
          4000,
        )

        return
      }

      /*
       * Start restriction.
       */
      if (
        dragged &&
        destinationStatus ===
          "IN_PROGRESS" &&
        !isTaskStartAllowed(
          tasks,
          timer,
          dragged.id,
        )
      ) {
        setNotice(
          "Only one task can be in progress at a time.",
        )

        window.setTimeout(
          () =>
            setNotice(null),
          4000,
        )

        return
      }

      /*
       * Translate the visible drop index back
       * into the complete column index.
       */
      const destinationVisibleTasks =
        columns[
          destinationStatus
        ] ?? []

      const draggedWorkspaceId =
        dragged?.workspaceId

      const workspaceItemsBeforeDrop =
        destinationVisibleTasks
          .slice(
            0,
            destination.index,
          )
          .filter(
            (task) =>
              task.workspaceId ===
                draggedWorkspaceId &&
              task.id !== draggableId,
          ).length

      const fullDestinationLength =
        tasks.filter(
          (task) =>
            task.status ===
              destinationStatus &&
            task.workspaceId ===
              draggedWorkspaceId &&
            task.id !== draggableId,
        ).length

      const fullIndex = Math.min(
        workspaceItemsBeforeDrop,
        fullDestinationLength,
      )

      moveTask(
        draggableId,
        destinationStatus,
        fullIndex,
        workspaceId ?? undefined,
      )
    },
    [
      moveTask,
      tasks,
      timer,
      columns,
      workspaceId,
    ],
  )

  /* -------------------------------------------------------------------------- */
  /* Modal close                                                                */
  /* -------------------------------------------------------------------------- */

  const closeModal =
    useCallback(() => {
      setModalOpen(false)
      setEditingTask(null)
    }, [])

  /* -------------------------------------------------------------------------- */
  /* Period label                                                               */
  /* -------------------------------------------------------------------------- */

  const periodLabel =
    period === "day"
      ? "D"
      : period === "week"
        ? "W"
        : "M"

  return (
    <>
      {/* ---------------------------------------------------------------------- */}
      {/* Notice                                                                 */}
      {/* ---------------------------------------------------------------------- */}

      {notice && (
        <div
          className="fixed right-4 top-4 z-50 max-w-sm rounded-lg border border-warning/40 bg-card px-4 py-3 text-sm text-foreground shadow-lg"
          role="status"
        >
          {notice}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Kanban Header / Toolbar                                                 */}
      {/* ---------------------------------------------------------------------- */}

      <div className="mb-5 flex w-full items-center gap-3">
        {title && (
          <h2 className="shrink-0 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
        )}

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          {/* Search */}
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search tasks..."
              aria-label="Search tasks"
              className="h-10 w-full border border-soft bg-card pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() =>
                  setSearchQuery("")
                }
                aria-label="Clear task search"
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X
                  className="size-4"
                  aria-hidden="true"
                />
              </button>
            )}
          </div>

          {/* Period Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-10 shrink-0 items-center gap-2 border border-soft bg-card/60 px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Change task period"
            >
              <span>
                {periodLabel}
              </span>

              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-32"
            >
              <DropdownMenuRadioGroup
                value={period}
                onValueChange={(
                  value,
                ) => {
                  if (value) {
                    setPeriod(
                      value as
                        | "day"
                        | "week"
                        | "month",
                    )
                  }
                }}
              >
                <DropdownMenuRadioItem
                  value="month"
                  className="text-xs"
                >
                  Month
                </DropdownMenuRadioItem>

                <DropdownMenuRadioItem
                  value="week"
                  className="text-xs"
                >
                  Week
                </DropdownMenuRadioItem>

                <DropdownMenuRadioItem
                  value="day"
                  className="text-xs"
                >
                  Day
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Create Task */}
          {/* {workspaceId !== null && ( */}
            <button
              type="button"
              onClick={() =>
                openCreate("TODO")
              }
              className="inline-flex h-10 shrink-0 items-center gap-2 bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
              aria-label="Create task"
            >
              <Plus
                size={17}
                aria-hidden="true"
              />
            </button>
          {/* )} */}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Kanban Board                                                           */}
      {/* ---------------------------------------------------------------------- */}

      <DragDropContext
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid min-h-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map(
            (status) => {
              const meta =
                STATUS_META[status]

              const columnTasks =
                columns[status]

              const dropDisabled =
                (!!draggingTask &&
                  isLocked(
                    draggingTask.status,
                  )) ||
                (!!draggingTask &&
                  status ===
                    "IN_PROGRESS" &&
                  !isTaskStartAllowed(
                    tasks,
                    timer,
                    draggingTask.id,
                  )) ||
                (status ===
                  "IN_PROGRESS" &&
                  hasInProgress &&
                  !!draggingTask &&
                  draggingTask.status !==
                    "IN_PROGRESS")

              return (
                <KanbanColumn
                  key={status}
                  status={status}
                  meta={meta}
                  tasks={columnTasks}
                  dropDisabled={
                    dropDisabled
                  }
                  draggingId={
                    draggingId
                  }
                  activeTaskId={
                    timer.taskId
                  }
                  workspaceId={workspaceId}
                  onCreate={
                    openCreate
                  }
                  onEdit={openEdit}
                  onDelete={
                    openDelete
                  }
                />
              )
            },
          )}
        </div>
      </DragDropContext>

      {/* ---------------------------------------------------------------------- */}
      {/* Task Modal                                                             */}
      {/* ---------------------------------------------------------------------- */}

      {modalOpen && (
        <TaskModal
          task={editingTask}
          createInStatus={
            createStatus
          }
          createInWorkspaceId={
            workspaceId
          }
          onClose={closeModal}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Delete Modal                                                           */}
      {/* ---------------------------------------------------------------------- */}

      {deletingTask && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-task-title"
        >
          <div className="w-full max-w-sm border border-soft bg-canvas p-6 shadow-2xl">
            <h2
              id="delete-task-title"
              className="text-lg font-semibold text-foreground"
            >
              Delete task?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This will permanently
              delete “
              {deletingTask.title}
              ”. This action cannot
              be undone.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setDeletingTask(null)
                }
                className="border border-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  confirmDelete
                }
                className="bg-error px-3 py-2 text-sm font-medium text-error-foreground hover:opacity-90"
              >
                Delete task
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Kanban Column                                                              */
/* -------------------------------------------------------------------------- */

interface KanbanColumnProps {
  status: TaskStatus
  meta: (typeof STATUS_META)[TaskStatus]
  tasks: Task[]
  dropDisabled: boolean
  draggingId: string | null
  activeTaskId: string | null
  workspaceId: string | null
  onCreate: (status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

const KanbanColumn = memo(
  function KanbanColumn({
    status,
    meta,
    tasks,
    dropDisabled,
    draggingId,
    activeTaskId,
    workspaceId,
    onEdit,
    onDelete,
  }: KanbanColumnProps) {
    return (
      <div
        className="
          flex
          h-[calc(100vh-220px)]
          min-h-[500px]
          min-w-0
          flex-col
          gap-3
        "
      >
        {/* Column header */}
        <div
          className="flex shrink-0 items-center justify-between border-l-[3px] bg-muted/40 px-3 py-2"
          style={{
            borderColor:
              meta.accent,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {meta.title}
            </span>
          </div>

          <span className="ml-auto rounded-full bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </div>

        {/* Scrollable task area */}
        <Droppable
          droppableId={status}
          isDropDisabled={
            dropDisabled
          }
        >
          {(
            provided,
            snapshot,
          ) => (
            <div
              ref={
                provided.innerRef
              }
              {...provided.droppableProps}
              className={[
                "min-h-0 flex-1 bg-[var(--sidebar-bg)]",
                "overflow-y-auto no-scrollbar",
                "overflow-x-hidden",
                "flex flex-col gap-3",
                "p-2",
                "bg-sidebar",
                "transition-colors",
                snapshot.isDraggingOver
                  ? "bg-primary-soft/60"
                  : dropDisabled &&
                      draggingId
                    ? "bg-warning-soft/40"
                    : "bg-sidebar",
              ].join(" ")}
            >
              {tasks.map(
                (
                  task,
                  index,
                ) => (
                  <KanbanDraggable
                    key={task.id}
                    task={task}
                    index={index}
                    activeTaskId={
                      activeTaskId
                    }
                    workspaceId={
                      workspaceId
                    }
                    onEdit={
                      onEdit
                    }
                    onDelete={
                      onDelete
                    }
                  />
                ),
              )}

              {provided.placeholder}

              {tasks.length === 0 &&
                !snapshot.isDraggingOver && (
                  <div className="mt-8 flex flex-col items-center gap-2 py-6 text-center text-secondary">
                    <ClipboardList
                      size={28}
                      aria-hidden="true"
                    />

                    <p className="text-xs">
                      No tasks
                    </p>
                  </div>
                )}
            </div>
          )}
        </Droppable>
      </div>
    )
  },
)

KanbanColumn.displayName =
  "KanbanColumn"

/* -------------------------------------------------------------------------- */
/* Draggable Task                                                             */
/* -------------------------------------------------------------------------- */

interface KanbanDraggableProps {
  task: Task
  index: number
  activeTaskId: string | null
  workspaceId: string | null
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

const KanbanDraggable = memo(
  function KanbanDraggable({
    task,
    index,
    activeTaskId,
    workspaceId,
    onEdit,
    onDelete,
  }: KanbanDraggableProps) {
    const locked = isLocked(
      task.status,
    )

    const isActive =
      activeTaskId === task.id

    return (
      <Draggable
        draggableId={task.id}
        index={index}
        isDragDisabled={locked}
      >
        {(
          provided,
          snapshot,
        ) => {
          const draggableStyle =
            provided
              .draggableProps
              .style

          return (
            <div
              ref={
                provided.innerRef
              }
              {...provided.draggableProps}
              style={{
                ...draggableStyle,

                /*
                 * Keep DnD's transform,
                 * then add our visual effect.
                 */
                transform:
                  snapshot.isDragging
                    ? `${
                        draggableStyle?.transform ??
                        ""
                      } rotate(-2deg) scale(1.02)`
                    : draggableStyle?.transform,

                transition:
                  snapshot.isDragging
                    ? "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms ease"
                    : draggableStyle?.transition,

                willChange:
                  snapshot.isDragging
                    ? "transform"
                    : undefined,

                zIndex:
                  snapshot.isDragging
                    ? 50
                    : undefined,
              }}
              className={[
                "transition-[box-shadow,opacity]",
                "duration-200",
                "ease-out",
                snapshot.isDragging
                  ? "opacity-95 shadow-xl"
                  : "opacity-100",
              ].join(" ")}
            >
              <TaskCard
                task={task}
                isActive={isActive}
                onEdit={onEdit}
                onDelete={onDelete}
                dragHandleProps={
                  provided.dragHandleProps
                }
                showWorkspace={
                  workspaceId == null
                }
              />
            </div>
          )
        }}
      </Draggable>
    )
  },
)

KanbanDraggable.displayName =
  "KanbanDraggable"
