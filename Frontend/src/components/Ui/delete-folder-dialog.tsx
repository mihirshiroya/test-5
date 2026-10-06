import { useEffect } from 'react'
import { Button } from './button'
import type { Folder } from './folder-data'

export function DeleteFolderDialog({
  open,
  folder,
  onClose,
  onConfirm,
}: {
  open: boolean
  folder?: Folder
  onClose: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !folder) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete folder"
        className="relative w-full max-w-sm border border-soft bg-canvas p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-ink text-balance">Delete &quot;{folder.name}&quot;?</h2>
        <p className="mt-1.5 text-sm text-steel">
          This permanently removes the folder and all of its published notes. This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" size="lg" onClick={onConfirm}>
            Delete folder
          </Button>
        </div>
      </div>
    </div>
  )
}
