"use client"

import { useState } from "react"
import {
  Check,
  Circle,
  FileText,
  Folder,
  Plus,
  Sparkles,
} from "lucide-react"
import { useParams, Navigate } from "react-router-dom"

import { Card } from "../components/Ui/card"
import { BoardView } from "../components/Ui/board-view"
import { TaskModal } from "../components/Ui/task-modal"

const notes = [
  "Launch brief and positioning",
  "Customer interview synthesis",
  "Q3 content calendar",
  "Website redesign notes",
]

export function ProjectPage() {
  const { projectSlug } = useParams<{
    projectSlug: string
  }>()

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)

  if (!projectSlug) {
    return <Navigate to="/overview" replace />
  }

  const projectName = projectSlug
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ")

  console.log("Project Name:", projectName)

  return (
    <div className="flex min-h-full flex-col">
      {/* Top Header */}

      {/* Board */}
      <div className="flex-1">
        <BoardView
          title={projectName}
          description={`All tasks for ${projectName}.`}
          category={projectSlug}
        />
      </div>

      {/* Create Task Modal */}
      {isTaskModalOpen && (
        <TaskModal
          task={null}
          createInStatus="todo"
          createInCategory={projectSlug}
          onClose={() => setIsTaskModalOpen(false)}
        />
      )}
    </div>
  )
}