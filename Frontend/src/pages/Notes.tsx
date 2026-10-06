'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'

import {
  addFolder,
  updateFolder,
  deleteFolder,
  selectFolders,
  fetchFolders,
  type StoredFolder,
} from '../store/slices/notesSlice.ts'

import { FolderCard } from '../components/Ui/folder-card'

import {
  FolderDialog,
  type FolderDraft,
} from '../components/Ui/folder-dialog'

import { DeleteFolderDialog } from '../components/Ui/delete-folder-dialog'

export function Notes() {
  const dispatch = useDispatch()

  const folders = useSelector(selectFolders) as StoredFolder[]

  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  // ---------------------------------------------------------------------------
  // Folder dialog
  // create = create form
  // edit   = rename form
  // ---------------------------------------------------------------------------

  const [dialogMode, setDialogMode] = useState<
    'create' | 'edit' | null
  >(null)

  const [editingFolder, setEditingFolder] = useState<
    StoredFolder | undefined
  >(undefined)

  // ---------------------------------------------------------------------------
  // Delete confirmation
  // ---------------------------------------------------------------------------

  const [deletingFolder, setDeletingFolder] = useState<
    StoredFolder | undefined
  >(undefined)

  useEffect(() => {
  setMounted(true)

  dispatch(fetchFolders())
}, [dispatch])

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return folders
    }

    return folders.filter((folder) =>
      folder.name.toLowerCase().includes(normalizedQuery),
    )
  }, [folders, query])

  // ---------------------------------------------------------------------------
  // Open create dialog
  // ---------------------------------------------------------------------------

  function openCreateDialog() {
    setEditingFolder(undefined)
    setDialogMode('create')
  }

  // ---------------------------------------------------------------------------
  // Open rename dialog (directly, no actions popup)
  // ---------------------------------------------------------------------------

  function openRenameDialog(folder: StoredFolder) {
    setEditingFolder(folder)
    setDialogMode('edit')
  }

  // ---------------------------------------------------------------------------
  // Create folder
  // ---------------------------------------------------------------------------

  function handleCreateSubmit(draft: FolderDraft) {
    dispatch(
      addFolder({
        title: draft.title,
        tint: draft.tint,
        icon: draft.icon,
      }),
    )

    closeFolderDialog()
  }

  // ---------------------------------------------------------------------------
  // Rename folder
  // ---------------------------------------------------------------------------

  function handleEditSubmit(draft: FolderDraft) {
    if (!editingFolder) {
      return
    }

    dispatch(
      updateFolder({
        id: editingFolder.id,
        title: draft.title,
        tint: draft.tint,
        icon: draft.icon,
      }),
    )

    closeFolderDialog()
  }

  // ---------------------------------------------------------------------------
  // Close create/edit dialog
  // ---------------------------------------------------------------------------

  function closeFolderDialog() {
    setDialogMode(null)
    setEditingFolder(undefined)
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  function handleDeleteConfirm() {
    if (!deletingFolder) {
      return
    }

    dispatch(deleteFolder(deletingFolder.id))

    setDeletingFolder(undefined)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <main className="flex min-w-0 flex-1 flex-col">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}

        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h1 className="text-heading-3 text-primary text-balance">
                All Notes
              </h1>
            </div>
          </div>

          {/* CREATE */}
          <button
            type="button"
            onClick={openCreateDialog}
            className="flex h-10 shrink-0 items-center gap-2 bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-pressed"
          >
            <Plus className="size-4" />

            <span className="hidden sm:inline">
              New Note
            </span>

            <span className="sm:hidden">
              New
            </span>
          </button>
        </header>

        {/* ----------------------------------------------------------------- */}
        {/* Search + View                                                     */}
        {/* ----------------------------------------------------------------- */}

        <div className="flex items-center gap-3 py-4">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 border border-soft px-3 sm:max-w-xs">
            <Search className="size-4 shrink-0 text-stone" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search folders…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-stone"
            />
          </div>

          <div className="ml-auto flex items-center gap-0.5 border border-soft p-0.5">
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
              className={`flex size-8 items-center justify-center ${
                view === 'grid'
                  ? 'bg-lavender text-primary'
                  : 'text-steel'
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>

            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              className={`flex size-8 items-center justify-center ${
                view === 'list'
                  ? 'bg-lavender text-primary'
                  : 'text-steel'
              }`}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Folder list                                                       */}
        {/* ----------------------------------------------------------------- */}

        <div className="flex-1 overflow-y-auto pb-8">
          {!mounted ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[124px] animate-pulse border border-soft bg-gray-tint/50"
                />
              ))}
            </div>
          ) : filtered.length ? (
            <div
              className={
                view === 'grid'
                  ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'
                  : 'flex flex-col gap-3'
              }
            >
              {filtered.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onEdit={() => openRenameDialog(folder)}
                  onDelete={() => setDeletingFolder(folder)}
                />
              ))}
            </div>
          ) : (
            <p className="border border-dashed border-soft p-12 text-center text-sm text-steel">
              No folders found.
            </p>
          )}
        </div>
      </main>

      {/* =================================================================== */}
      {/* CREATE / RENAME DIALOG                                              */}
      {/* =================================================================== */}

      <FolderDialog
        open={dialogMode !== null}
        mode={dialogMode === 'edit' ? 'edit' : 'create'}
        initial={editingFolder}
        onClose={closeFolderDialog}
        onSubmit={
          dialogMode === 'edit'
            ? handleEditSubmit
            : handleCreateSubmit
        }
      />

      {/* =================================================================== */}
      {/* DELETE CONFIRMATION                                                 */}
      {/* =================================================================== */}

      <DeleteFolderDialog
        open={deletingFolder !== undefined}
        folder={deletingFolder}
        onClose={() => setDeletingFolder(undefined)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}