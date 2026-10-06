'use client'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, Pencil, Trash2, FileText, Edit3, ArrowUpRight } from 'lucide-react'
import {
  FOLDER_TINTS,
  FOLDER_ICONS,
  relativeTime,
  type Folder,
} from './folder-data'

export function FolderCard({
  folder,
  onEdit,
  onDelete,
}: {
  folder: Folder
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const Icon = FOLDER_ICONS[folder.icon]
  const tint = FOLDER_TINTS[folder.tint]

  const goToNotes = () => {
    navigate(`/notes/${folder.id}`)
  }

  const goToEditNotes = () => {
    navigate(`/notes/${folder.id}/edit`)
  }

  return (
    <article className="group relative gap-y-5 flex flex-col border border-soft p-4 transition-all hover:shadow-[0_8px_24px_-8px_rgba(15,15,15,0.16)]">
      <div className="flex items-start justify-between">
        <span
          className="flex size-10 items-center justify-center"
          style={{ backgroundColor: tint.bg }}
        >
          <Icon className="size-5" />
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Go to notes"
            onClick={goToNotes}
            className="flex size-8 items-center justify-center text-steel hover:bg-gray-tint hover:text-ink"
          >
            <ArrowUpRight className="size-[18px]" />
          </button>

          {onEdit && onDelete && (
            <div className="relative">
              <button
                type="button"
                aria-label="Folder actions"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex size-8 items-center justify-center text-steel hover:bg-gray-tint"
              >
                <MoreHorizontal className="size-[18px] rotate-90" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-20 w-40 border border-soft bg-canvas p-1 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      goToEditNotes()
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-sm text-steel hover:bg-gray-tint"
                  >
                    <Edit3 className="size-4" />
                    Edit notes
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit()
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-sm text-steel hover:bg-gray-tint"
                  >
                    <Pencil className="size-4" />
                    Rename
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-sm text-error hover:bg-rose"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
          <div className="flex flex-col gap-2">
            <button
        type="button"
        onClick={goToNotes}
        className="mt-4 text-left"
      >
        <h3 className="truncate text-heading-5 font-semibold text-ink">
          {folder.title}
        </h3>
      </button>

      <div className="mt-1 flex items-center gap-1.5 text-sm text-steel">
        <FileText className="size-3.5" />

        <span>
          {folder.items} {folder.items === 1 ? 'section' : 'sections'}
        </span>

        <span className="text-stone">·</span>

        <span>{relativeTime(folder.updatedAt)}</span>
      </div>
          </div>
      

    </article>
  )
}