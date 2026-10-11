import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utills'
import { Button } from '../Ui/Button'
import { Input } from './input'
import {
  FOLDER_TINTS,
  FOLDER_ICONS,
  type TintKey,
  type IconKey,
} from './project-data'
import type { ProjectItem } from '../../pages/AppSidebar'

export type ProjectDraft = {
  name: string
  tint: TintKey
  icon: IconKey
}

export function ProjectDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initial?: ProjectItem
  onClose: () => void
  onSubmit: (draft: ProjectDraft) => void
}) {
  const [name, setName] = useState('')
  const [tint, setTint] = useState<TintKey>('lavender')
  const [icon, setIcon] = useState<IconKey>('folder')

  useEffect(() => {
    if (open) {
      setName(initial?.label ?? '')
      setTint(initial?.tint ?? 'lavender')
      setIcon(initial?.icon ?? 'folder')
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSubmit = name.trim().length > 0

  const submit = () => {
    if (!canSubmit) return

    onSubmit({
      name: name.trim(),
      tint,
      icon,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        aria-describedby="project-dialog-desc"
        className="relative w-full max-w-md border border-soft bg-canvas p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2
              id="project-dialog-title"
              className="text-lg font-semibold text-ink text-balance tracking-wide"
            >
              {mode === 'create' ? 'New Workspace' : 'Edit Workspace'}
            </h2>

            <p
              id="project-dialog-desc"
              className="mt-0.5 text-sm text-steel"
            >
              {mode === 'create'
                ? 'Give your workspace a name, color and icon.'
                : 'Update the workspace details.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-steel transition-colors hover:bg-gray-tint hover:text-ink"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {/* Name */}
        <label
          htmlFor="project-name"
          className="mb-1.5 block text-sm font-medium text-charcoal"
        >
          Workspace name
        </label>

        <Input
          id="project-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              submit()
            }
          }}
          placeholder="e.g. Website redesign"
          className="h-11 w-full border border-soft px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-stone focus:border-primary"
        />

        {/* Color */}
        <p className="mt-5 mb-2 text-sm font-medium text-charcoal">
          Color
        </p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(FOLDER_TINTS) as TintKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-label={`Color ${key}`}
              aria-pressed={tint === key}
              onClick={() => setTint(key)}
              className={cn(
                'size-8 rounded-full border border-soft transition-transform',
                'hover:scale-110',
                tint === key
                  ? 'ring-2 ring-primary ring-offset-4 scale-105 outline-1'
                  : 'ring-0',
              )}
              style={{
                backgroundColor: FOLDER_TINTS[key].bg,
                borderColor: FOLDER_TINTS[key].fg,
                // @ts-expect-error css var for ring offset
                '--tw-ring-offset-color': 'var(--canvas)',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <p className="mt-5 mb-2 text-sm font-medium text-charcoal">
          Icon
        </p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(FOLDER_ICONS) as IconKey[]).map((key) => {
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
                  'flex size-10 items-center justify-center border border-soft transition-colors',
                  selected
                    ? 'border-primary bg-lavender text-primary'
                    : 'text-steel hover:bg-gray-tint hover:text-ink',
                )}
                style={{
                  borderColor: selected
                    ? 'var(--primary)'
                    : '',
                }}
              >
                <Icon className="size-5" />
              </button>
            )
          })}
        </div>

        {/* Actions */}
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
              ? 'Create workspace'
              : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
