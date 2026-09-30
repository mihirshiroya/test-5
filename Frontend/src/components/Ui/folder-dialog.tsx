
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { cn } from '../../lib/utills'
import { Button } from './Button'

import {
  FOLDER_TINTS,
  FOLDER_ICONS,
  type Folder,
  type TintKey,
  type IconKey,
} from './folder-data'

export type FolderDraft = {
  title: string
  tint: TintKey
  icon: IconKey
}

type FolderDialogProps = {
  open: boolean
  mode: 'create' | 'edit'

  initial?: Folder

  onClose: () => void

  onSubmit?: (draft: FolderDraft) => void
}

export function FolderDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: FolderDialogProps) {
  const [title, setTitle] = useState('')
  const [tint, setTint] = useState<TintKey>('blue')
  const [icon, setIcon] = useState<IconKey>('folder')

  useEffect(() => {
    if (!open) {
      return
    }

    setTitle(initial?.title ?? '')
    setTint(initial?.tint ?? 'blue')
    setIcon(initial?.icon ?? 'folder')
  }, [open, initial])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  const canSubmit = title.trim().length > 0

  function submit() {
    if (!canSubmit || !onSubmit) {
      return
    }

    onSubmit({
      title: title.trim(),
      tint,
      icon,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md border border-soft bg-canvas p-6 shadow-2xl"
      >
        {/* HEADER */}

        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {mode === 'create' ? 'New folder' : 'Rename folder'}
            </h2>

            <p className="mt-1 text-sm text-steel">
              {mode === 'create'
                ? 'Give your folder a name, color and icon.'
                : 'Update the folder details.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-steel hover:bg-gray-tint hover:text-ink"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {/* NAME */}

        <label
          htmlFor="folder-title"
          className="mb-1.5 block text-sm font-medium text-charcoal"
        >
          Folder name
        </label>

        <input
          id="folder-title"
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.nativeEvent.isComposing
            ) {
              submit()
            }
          }}
          placeholder="e.g. Product specs"
          className="h-11 w-full border border-soft bg-background px-3.5 text-sm text-ink outline-none placeholder:text-stone focus:border-primary"
        />

        {/* COLOR */}

        <p className="mt-5 mb-2 text-sm font-medium text-charcoal">
          Color
        </p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(FOLDER_TINTS) as TintKey[]).map(
            (key) => {
              const color = FOLDER_TINTS[key]
              const selected = tint === key

              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`Color ${key}`}
                  aria-pressed={selected}
                  onClick={() => setTint(key)}
                  className={cn(
                    'size-8 rounded-full border transition-transform hover:scale-110',
                    selected
                      ? 'scale-105 ring-2 ring-primary ring-offset-4'
                      : '',
                  )}
                  style={{
                    backgroundColor: color.bg,
                    borderColor: color.fg,
                    // @ts-expect-error CSS custom property
                    '--tw-ring-offset-color': 'var(--canvas)',
                  }}
                />
              )
            },
          )}
        </div>

        {/* ICON */}

        <p className="mt-5 mb-2 text-sm font-medium text-charcoal">
          Icon
        </p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(FOLDER_ICONS) as IconKey[]).map(
            (key) => {
              const Icon = FOLDER_ICONS[key]
              const selected = icon === key

              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`Icon ${key}`}
                  aria-pressed={selected}
                  onClick={() => setIcon(key)}
                  className={cn(
                    'flex size-10 items-center justify-center border transition-colors',
                    selected
                      ? 'text-primary'
                      : 'text-steel hover:bg-gray-tint hover:text-ink',
                  )}
                  style={{
                    backgroundColor: selected
                      ? FOLDER_TINTS[tint].bg
                      : 'transparent',
                    borderColor: selected
                      ? FOLDER_TINTS[tint].fg
                      : 'var(--soft)',
                  }}
                >
                  <Icon className="size-5" />
                </button>
              )
            },
          )}
        </div>

        {/* FOOTER */}

        <div className="mt-7 flex justify-end gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            size="lg"
            disabled={!canSubmit}
            onClick={submit}
            className="bg-primary text-on-primary hover:bg-primary-pressed"
          >
            {mode === 'create'
              ? 'Create folder'
              : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
