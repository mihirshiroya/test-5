import { KanbanBoard } from "./kanban-board"

interface BoardViewProps {
  title: string
  description: string
  workspaceId: string | null
}

export function BoardView({
  title,
  description,
  workspaceId,
}: BoardViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <KanbanBoard
        title={title}
        workspaceId={workspaceId}
      />
    </div>
  )
}