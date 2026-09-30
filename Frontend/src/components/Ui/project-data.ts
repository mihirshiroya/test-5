import {
  Folder,
  Briefcase,
  Rocket,
  BookOpen,
  Sparkles,
  Target,
  Users,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type TintKey =
  | 'lavender'
  | 'sky'
  | 'mint'
  | 'amber'
  | 'rose'
  | 'slate'

export type IconKey =
  | 'folder'
  | 'briefcase'
  | 'rocket'
  | 'book'
  | 'sparkles'
  | 'target'
  | 'users'
  | 'idea'

/* -------------------------------------------------------------------------- */
/* Palettes                                                                   */
/* -------------------------------------------------------------------------- */

export const FOLDER_TINTS: Record<TintKey, { bg: string; fg: string }> = {
  lavender: { bg: '#ede9fe', fg: '#7c3aed' },
  sky: { bg: '#e0f2fe', fg: '#0284c7' },
  mint: { bg: '#dcfce7', fg: '#16a34a' },
  amber: { bg: '#fef3c7', fg: '#d97706' },
  rose: { bg: '#ffe4e6', fg: '#e11d48' },
  slate: { bg: '#f1f5f9', fg: '#475569' },
}

export const FOLDER_ICONS: Record<IconKey, LucideIcon> = {
  folder: Folder,
  briefcase: Briefcase,
  rocket: Rocket,
  book: BookOpen,
  sparkles: Sparkles,
  target: Target,
  users: Users,
  idea: Lightbulb,
}