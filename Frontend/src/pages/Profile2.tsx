import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Link } from 'react-router-dom'

import {
  ProfileStatCard,
  type ProfileStat,
} from '../components/Ui/profile-state-card'

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Diamond,
  Flame,
  FolderKanban,
  Pencil,
  Star,
  TrendingUp,
  Trophy,
  X,
  Zap,
  Sparkles,
} from 'lucide-react'

import {
  type Achievement,
  type ProfileAnalytics,
  type ProjectSummary,
  formatMinutes,
  localDayKey,
} from '../components/Ui/analytics-data'

import { ActivityHeatmap } from '../components/Ui/activity-heatmap'
import { HeatmapSkeleton } from '../components/Ui/skeletons'
import { useAppDispatch, useAppSelector } from '../store'
import {
  fetchProfileAnalytics,
  selectProfileAnalytics,
} from '../store/slices/analyticsSlice'
import { updateUser } from '../store/slices/authSlice'
import { authApi } from '../api/auth'
import type { User } from '../types'

/* -------------------------------------------------------------------------- */
/*  Design tokens (light, soft-card style)                                    */
/* -------------------------------------------------------------------------- */

/*  page bg     #f4f4fb      card        #ffffff     border   #e8e8f3          */
/*  ink         #14142b      muted       #6b6b84     faint    #9a9ab0          */
/*  accent      #6d4aff      accent-soft #efeaff     chip bg  #f0f0f7          */

/* --------------------------------- utils ---------------------------------- */

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)
const parseDay = (key: string) => new Date(`${key}T00:00:00`)
const fmtDay = (key: string) =>
  parseDay(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtSeconds = (seconds: number) => formatMinutes(Math.round(seconds / 60))

const shiftMonth = (month: string, dir: 1 | -1) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + dir, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

const NAME_PATTERN = /^[a-zA-Z\s]{2,50}$/

const statusStyle: Record<ProjectSummary['status'], { badge: string; dot: string }> = {
  'In progress': { badge: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  Done: { badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  Planning: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
}

const PROJECTS_PREVIEW = 4

/* ── 3D Isometric Cube Component ── */
function IsometricCube({
  color = '#DAA520',
  size = 36,
  unlocked = true,
}: {
  color?: string
  size?: number
  unlocked?: boolean
}) {
  const cubeId = useId().replace(/:/g, '')

  if (!unlocked) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className="shrink-0 opacity-40 transition-opacity"
      >
        {/* Top face */}
        <polygon points="32,8 54,20 32,32 10,20" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
        {/* Left face */}
        <polygon points="10,20 32,32 32,56 10,44" fill="#94a3b8" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round" />
        {/* Right face */}
        <polygon points="32,32 54,20 54,44 32,56" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className="shrink-0 drop-shadow-md transition-transform duration-300 hover:scale-110"
    >
      <defs>
        <linearGradient id={`cube-top-${cubeId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
        <linearGradient id={`cube-left-${cubeId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`cube-right-${cubeId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {/* Top face */}
      <polygon points="32,8 54,20 32,32 10,20" fill={`url(#cube-top-${cubeId})`} stroke={color} strokeWidth="1" strokeLinejoin="round" />
      {/* Left face */}
      <polygon points="10,20 32,32 32,56 10,44" fill={`url(#cube-left-${cubeId})`} stroke={color} strokeWidth="1" strokeLinejoin="round" />
      {/* Right face */}
      <polygon points="32,32 54,20 54,44 32,56" fill={`url(#cube-right-${cubeId})`} stroke={color} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

/* ── PFP Frame Presets (Updated with safe hex borders for previews) ── */
export const PFP_FRAMES: Array<{
  id: string
  label: string
  ring: string
  glow: string
  color: string
}> = [
  { id: 'none', label: 'Default', ring: 'border-[#e2e8f0]', glow: '', color: '#94a3b8' },
  { id: 'starter', label: 'Starter Spark', ring: 'border-[#94a3b8]', glow: 'shadow-[0_0_16px_rgba(148,163,184,0.4)] ring-2 ring-[#94a3b8]/40', color: '#94a3b8' },
  { id: 'bronze', label: 'Bronze Spark', ring: 'border-[#CD7F32]', glow: 'shadow-[0_0_18px_rgba(205,127,50,0.5)] ring-2 ring-[#CD7F32]/50', color: '#CD7F32' },
  { id: 'silver', label: 'Silver Spark', ring: 'border-[#A8A9AD]', glow: 'shadow-[0_0_18px_rgba(168,169,173,0.5)] ring-2 ring-[#A8A9AD]/50', color: '#A8A9AD' },
  { id: 'gold', label: 'Golden Spark', ring: 'border-[#DAA520]', glow: 'shadow-[0_0_22px_rgba(218,165,32,0.6)] ring-2 ring-[#DAA520]/60', color: '#DAA520' },
  { id: 'diamond', label: 'Diamond Spark', ring: 'border-[#5B9BD5]', glow: 'shadow-[0_0_22px_rgba(91,155,213,0.6)] ring-2 ring-[#5B9BD5]/60', color: '#5B9BD5' },
  { id: 'platinum', label: 'Platinum Spark', ring: 'border-[#8B5CF6]', glow: 'shadow-[0_0_22px_rgba(139,92,246,0.6)] ring-2 ring-[#8B5CF6]/60', color: '#8B5CF6' },
  { id: 'legendary', label: 'Legendary Spark', ring: 'border-[#F59E0B]', glow: 'shadow-[0_0_26px_rgba(245,158,11,0.65)] ring-2 ring-[#F59E0B]/70', color: '#F59E0B' },
]

const FRAME_LOOKUP: Record<string, (typeof PFP_FRAMES)[number]> = Object.fromEntries(
  PFP_FRAMES.map((f) => [f.id, f]),
)

function ProfileCard({
  user,
  onEdit,
  currentAchievement,
  onFrameChange,
}: {
  user: User | null
  onEdit: () => void
  currentAchievement: Achievement | null
  onFrameChange?: (frameId: string) => Promise<void> | void
}) {
  const [framePickerOpen, setFramePickerOpen] = useState(false)
  const [savingFrame, setSavingFrame] = useState(false)

  const first = user?.firstName ?? ''
  const last = user?.lastName ?? ''
  const initials = ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?'

  const activeFrameId =
    user?.pfpFrame && user.pfpFrame !== 'none'
      ? user.pfpFrame
      : (currentAchievement?.id ?? 'none')

  const frameConfig = FRAME_LOOKUP[activeFrameId] ?? FRAME_LOOKUP.none

  const handleSelectFrame = async (frameId: string) => {
    if (!onFrameChange) return
    setSavingFrame(true)
    try {
      await onFrameChange(frameId)
    } finally {
      setSavingFrame(false)
      setFramePickerOpen(false)
    }
  }

  return (
    <aside className="w-full p-1.5">
      {/* Banner */}
      <div className="relative h-32 overflow-hidden sm:h-36">
        <img
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#7c5cff]/70 via-[#b79cff]/55 to-[#eadfff]/60" />
      </div>

      <div className="px-4 pb-4 sm:px-5">
        {/* Avatar with customized PFP Frame */}
        <div className="relative -mt-11 w-fit">
          {activeFrameId !== 'none' && (
            <div
              className="absolute -inset-1.5 rounded-[26px] animate-pulse opacity-70"
              style={{
                background: `radial-gradient(circle, ${frameConfig.color}66 0%, ${frameConfig.color}11 75%)`,
              }}
            />
          )}

          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={`${first} ${last}`}
              className={`relative size-[88px] rounded-[20px] border-4 ${frameConfig.ring} object-cover ${frameConfig.glow} transition-all duration-500`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className={`relative grid size-[88px] place-items-center rounded-[20px] border-4 ${frameConfig.ring} bg-gradient-to-br from-[#7c5cff] to-[#4c1d95] text-3xl font-bold text-white ${frameConfig.glow} transition-all duration-500`}
            >
              {initials}
            </div>
          )}

          <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full border-[3px] border-[var(--color-background)] bg-emerald-500" />

          {currentAchievement && (
            <div
              className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border-2 border-[var(--color-background)] shadow-sm"
              style={{ backgroundColor: currentAchievement.color }}
              title={`Unlocked: ${currentAchievement.title}`}
            >
              {currentAchievement.icon === 'diamond' && <Diamond className="size-3 text-white" />}
              {currentAchievement.icon === 'crown' && <Crown className="size-3 text-white" />}
              {currentAchievement.icon === 'star' && <Star className="size-3 text-white" />}
              {currentAchievement.icon === 'spark' && <Zap className="size-3 text-white" />}
            </div>
          )}
        </div>

        {/* Name + Edit profile & Frame switcher controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-primary">
                {first || last ? `${first} ${last}`.trim() : 'Your profile'}
              </h2>

              {user?.role && user.role !== 'USER' && (
                <span className="rounded-md bg-[#efeaff] px-2 py-0.5 text-xs font-medium text-[#4b2fd0]">
                  {user.role}
                </span>
              )}

              {currentAchievement && (
                <span
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-white shadow-sm"
                  style={{ backgroundColor: currentAchievement.color }}
                >
                  <Trophy className="size-3" />
                  {currentAchievement.title}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* PFP Frame Selector Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setFramePickerOpen(!framePickerOpen)}
                title="Customize PFP frame"
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all duration-300 ${
                  framePickerOpen 
                    ? 'border-[#6d4aff] bg-[#efeaff] text-[#6d4aff] shadow-sm' 
                    : 'border-[#e8e8f3] bg-white text-[#14142b] hover:bg-[#f7f7fc] hover:border-[#d0d0e2]'
                }`}
              >
                <Sparkles className={`size-3.5 transition-colors ${framePickerOpen ? 'text-[#6d4aff]' : 'text-amber-500'}`} />
                <span>Customize Aura</span>
              </button>

              {/* Frame Picker Popover (Modern Grid) */}
              {framePickerOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-[#e8e8f3] bg-white/95 backdrop-blur-xl p-3 shadow-2xl shadow-[#6d4aff]/10">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <p className="text-sm font-bold text-[#14142b]">Profile Aura</p>
                      <p className="text-[10px] font-semibold text-[#6b6b84] uppercase tracking-wider">Choose your frame</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFramePickerOpen(false)}
                      className="grid size-7 place-items-center rounded-lg text-[#9a9ab0] hover:bg-[#f0f0f7] hover:text-[#14142b] transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                    {PFP_FRAMES.map((f) => {
                      const isSelected = activeFrameId === f.id
                      return (
                        <button
                          key={f.id}
                          type="button"
                          disabled={savingFrame}
                          onClick={() => handleSelectFrame(f.id)}
                          className={`group relative flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all duration-300 ${
                            isSelected
                              ? 'bg-[#6d4aff] text-white shadow-lg shadow-[#6d4aff]/30'
                              : 'bg-[#f7f7fc] text-[#14142b] hover:bg-[#efeaff] hover:shadow-md'
                          }`}
                        >
                          {/* Mini Avatar Preview */}
                          <div className="relative">
                            <div
                              className={`absolute -inset-1.5 rounded-xl blur-md opacity-50 transition-opacity group-hover:opacity-80`}
                              style={{ backgroundColor: f.color }}
                            />
                            <div className={`relative grid size-12 place-items-center rounded-lg border-[3px] ${f.ring} ${f.glow} bg-white text-xs font-bold ${isSelected ? 'text-[#6d4aff]' : 'text-[#14142b]'}`}>
                              {user?.avatar ? (
                                <img src={user.avatar} className="size-full rounded-md object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                initials
                              )}
                            </div>
                          </div>
                          <span className={`text-[11px] font-bold leading-tight ${isSelected ? 'text-white' : 'text-[#14142b]'}`}>
                            {f.label}
                          </span>
                          {isSelected && (
                            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-white">
                              <Check className="size-3" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Edit profile button */}
            <button
              type="button"
              onClick={onEdit}
              disabled={!user}
              aria-label="Edit profile"
              className="flex shrink-0 items-center justify-center gap-2 border border-soft px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-[#f0f0f7]"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ------------------------------ achievements section (modern premium look) ------------------------------ */

function AchievementsSection({
  achievements,
  currentAchievement,
  totalFocusHours,
}: {
  achievements: Achievement[] | null
  currentAchievement: Achievement | null
  totalFocusHours: number
}) {
  const list = achievements ?? []
  const latest = currentAchievement ?? (list.length > 0 ? list[0] : null)

  return (
    <section className="border border-soft p-5 sm:p-6" aria-label="Achievements">
      {/* Header with Title and Current Total Hours */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-primary">Achievement Timeline</h2>
          <p className="mt-0.5 text-sm text-secondary">
            Unlock profile auras through deep work
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-[#f0f0f7] px-3 py-1 text-xs font-bold text-[#14142b]">
          <Clock3 className="size-3.5 text-[#6d4aff]" />
          <span>{totalFocusHours} focus hours logged</span>
        </div>
      </div>

      {/* Featured "Your Latest Achievement" Hero (Dark Premium Mode) */}
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-[#2d2d44] bg-gradient-to-br from-[#14142b] via-[#1e1b4b] to-[#312e81] p-8 text-center shadow-xl">
        {/* Background glowing orbs */}
        <div className="absolute -top-20 -left-20 size-60 rounded-full bg-[#6d4aff]/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 size-60 rounded-full bg-[#f59e0b]/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-40 rounded-full bg-[#6d4aff]/20 blur-2xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="mx-auto w-fit rounded-full bg-white/5 p-4 backdrop-blur-sm ring-1 ring-white/10">
            <IsometricCube
              size={72}
              color={latest?.color ?? '#DAA520'}
              unlocked={Boolean(currentAchievement)}
            />
          </div>
          
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.25em] text-[#a5b4fc]">
            {currentAchievement ? '✨ Milestone Unlocked' : 'Current Progress'}
          </p>
          
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white">
            {latest ? latest.title : 'Starter Spark'}
          </h3>
          
          <p className="mt-3 max-w-md mx-auto text-sm text-[#cbd5e1] leading-relaxed">
            {currentAchievement
              ? `You have achieved over ${latest?.requiredHours ?? 0} hours of deep focused work. Your profile aura has been upgraded!`
              : 'Keep logging focus sessions to unlock your first achievement tier and customize your profile aura.'}
          </p>

          {currentAchievement && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-sm ring-1 ring-white/20">
              <Sparkles className="size-3.5 text-amber-400" />
              <span>New Aura Frame Equipped</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {achievements === null && (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#f7f7fc]" />
          ))}
        </div>
      )}

      {/* Vertical Timeline Roadmap (Sleek Track & Nodes) */}
      {list.length > 0 && (
        <div className="relative mt-10">
          {/* Glowing vertical track */}
          <div className="absolute left-[43px] top-4 bottom-4 w-[3px] rounded-full bg-gradient-to-b from-[#6d4aff] via-[#e8e8f3] to-[#e8e8f3]" />

          <div className="space-y-5">
            {list.map((tier, index) => {
              const isNext = !tier.unlocked && (index === 0 || list[index - 1].unlocked)
              const hoursLeft = Math.max(0, tier.requiredHours - totalFocusHours)

              return (
                <div
                  key={tier.id}
                  className={`group relative flex items-center gap-5 rounded-2xl border p-4 transition-all duration-300 ${
                    tier.unlocked
                      ? 'border-[#e8e8f3] bg-white shadow-sm hover:shadow-md hover:border-[#d0d0e2]'
                      : isNext
                        ? 'border-[#6d4aff]/30 bg-gradient-to-r from-white to-[#fafafc] shadow-[0_4px_20px_rgba(109,74,255,0.08)]'
                        : 'border-[#eeeef3] bg-[#fcfcfd] opacity-75 hover:opacity-100'
                  }`}
                >
                  {/* Left node with 3D faceted cube */}
                  <div className="relative z-10 grid size-14 shrink-0 place-items-center">
                    {tier.unlocked && (
                      <div 
                        className="absolute inset-0 rounded-full blur-md opacity-40 animate-pulse" 
                        style={{ backgroundColor: tier.color }} 
                      />
                    )}
                    <div className={`relative grid size-14 place-items-center rounded-full ${tier.unlocked ? 'bg-white shadow-lg' : 'bg-[#f4f4fa]'} ring-4 ring-white transition-transform group-hover:scale-105`}>
                      <IsometricCube
                        size={34}
                        color={tier.color}
                        unlocked={tier.unlocked}
                      />
                    </div>
                  </div>

                  {/* Milestone Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <p className={`text-[15px] font-bold ${tier.unlocked ? 'text-[#14142b]' : 'text-[#6b6b84]'}`}>
                          {tier.title}
                        </p>

                        {tier.unlocked ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
                            <Check className="size-3" />
                            Unlocked
                          </span>
                        ) : isNext ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#6d4aff]/10 px-2.5 py-1 text-[10px] font-bold text-[#6d4aff] uppercase tracking-wide">
                            <span className="relative flex size-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6d4aff] opacity-75"></span>
                              <span className="relative inline-flex rounded-full size-2 bg-[#6d4aff]"></span>
                            </span>
                            In Progress
                          </span>
                        ) : null}
                      </div>

                      <span className={`text-sm font-bold tabular-nums ${tier.unlocked ? 'text-[#14142b]' : 'text-[#6b6b84]'}`}>
                        {tier.requiredHours}h Goal
                      </span>
                    </div>

                    {/* Progress Bar for in-progress / next tier */}
                    {!tier.unlocked && (
                      <div className="mt-3.5 flex items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eeeef6] shadow-inner">
                          <div
                            className="relative h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${tier.progress}%`,
                              backgroundColor: tier.color,
                            }}
                          >
                            {/* Glossy overlay */}
                            <div className="absolute inset-x-0 top-0 h-1/2 bg-white/30 rounded-t-full" />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#6b6b84] tabular-nums min-w-[60px] text-right">
                          {hoursLeft}h left
                        </span>
                      </div>
                    )}

                    {tier.unlocked && (
                      <p className="mt-1.5 text-xs font-medium text-[#9a9ab0]">
                        Achieved · PFP Frame upgraded
                      </p>
                    )}
                  </div>

                  {/* Right chevron indicator */}
                  {tier.unlocked && (
                    <ChevronRight className="size-5 shrink-0 text-[#cbd5e1] transition-transform group-hover:translate-x-1" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------ projects section (unchanged) ------------------------------ */

function ProjectsSection({ projects }: { projects: ProjectSummary[] | null }) {
  const [filter, setFilter] = useState<'ALL' | 'IN_PROGRESS' | 'DONE'>('ALL')
  const [showAll, setShowAll] = useState(false)

  const list = projects ?? []
  const totalTasks = list.reduce((s, p) => s + p.total, 0)
  const totalDone = list.reduce((s, p) => s + p.done, 0)
  const overallPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0

  const filteredList = useMemo(() => {
    if (filter === 'IN_PROGRESS') return list.filter((p) => p.status === 'In progress')
    if (filter === 'DONE') return list.filter((p) => p.status === 'Done')
    return list
  }, [list, filter])

  const visible = showAll ? filteredList : filteredList.slice(0, PROJECTS_PREVIEW)

  return (
    <section className="border border-soft p-5 sm:p-6" aria-label="Projects">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#efeaff] text-[#6d4aff]">
            <FolderKanban className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-primary">Projects</h2>
            <p className="text-sm text-secondary">Where your tasks live.</p>
          </div>
        </div>

        {/* Status filters and count */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#e8e8f3] bg-[#f7f7fc] p-0.5">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-white text-[#14142b] shadow-sm'
                  : 'text-[#6b6b84] hover:text-[#14142b]'
              }`}
            >
              All ({list.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('IN_PROGRESS')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === 'IN_PROGRESS'
                  ? 'bg-white text-[#14142b] shadow-sm'
                  : 'text-[#6b6b84] hover:text-[#14142b]'
              }`}
            >
              In Progress
            </button>
            <button
              type="button"
              onClick={() => setFilter('DONE')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === 'DONE'
                  ? 'bg-white text-[#14142b] shadow-sm'
                  : 'text-[#6b6b84] hover:text-[#14142b]'
              }`}
            >
              Completed
            </button>
          </div>

          <span className="hidden rounded-full bg-[#f0f0f7] px-2.5 py-1 text-xs font-semibold text-[#6b6b84] sm:inline-block">
            {totalDone}/{totalTasks} tasks done ({overallPct}%)
          </span>
        </div>
      </div>

      {/* Loading Skeleton */}
      {projects === null && (
        <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#f7f7fc]" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {projects !== null && filteredList.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-[#e8e8f3] bg-[#fafafe] px-5 py-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#efeaff] text-[#6d4aff]">
            <FolderKanban className="size-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-primary">
            {filter === 'ALL' ? 'No projects yet' : `No ${filter.toLowerCase()} projects found`}
          </p>
          <p className="mt-1 text-xs text-secondary">
            {filter === 'ALL'
              ? 'Create a workspace to organize your tasks into projects.'
              : 'Try changing the filter tab above.'}
          </p>
        </div>
      )}

      {/* Redesigned Project Cards Grid */}
      {filteredList.length > 0 && (
        <ul className="mt-5 grid gap-3.5 sm:grid-cols-2">
          {visible.map((p) => {
            const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
            const style = statusStyle[p.status]

            return (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#e8e8f3] bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d5d5e8] hover:shadow-[0_4px_16px_rgba(20,20,43,0.06)]"
                >
                  {/* Left accent strip */}
                  <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-[#6d4aff] opacity-70 transition-opacity group-hover:opacity-100" />

                  <div>
                    {/* Top row: Icon, Name, and Status Badge */}
                    <div className="flex items-start justify-between gap-3 pl-1.5">
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f4f4fa] text-[#6d4aff] transition-colors group-hover:bg-[#efeaff]">
                          <FolderKanban className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#14142b] group-hover:text-[#6d4aff]">
                            {p.name}
                          </p>
                          <p className="text-xs text-[#6b6b84]">
                            {p.total} {p.total === 1 ? 'task' : 'tasks'}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}
                      >
                        <span className={`inline-block size-1.5 rounded-full ${style.dot}`} />
                        {p.status}
                      </span>
                    </div>

                    {/* Progress Bar with smooth rounded cap */}
                    <div className="mt-4 pl-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#eeeef6]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#6d4aff] to-[#9b80ff] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom summary row */}
                  <div className="mt-3 flex items-center justify-between border-t border-[#f4f4fa] pt-2.5 pl-1.5">
                    <p className="text-xs text-[#6b6b84]">
                      <span className="font-semibold text-[#14142b]">{p.done}</span> of {p.total} done
                    </p>
                    <span className="text-xs font-semibold text-[#6d4aff]">{pct}%</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* Expand/Collapse Toggle */}
      {filteredList.length > PROJECTS_PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-4 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#6d4aff] transition-colors hover:text-[#5b38f0]"
        >
          {showAll ? 'Show less' : `View ${filteredList.length - PROJECTS_PREVIEW} more projects`}
          <ChevronRight
            className={`size-4 transition-transform ${showAll ? '-rotate-90' : 'rotate-90'}`}
          />
        </button>
      )}
    </section>
  )
}

/* --------------------------- productivity chart (unchanged) --------------------------- */

function ProductivityCard({
  monthly,
  loading,
  onMonthChange,
}: {
  monthly: ProfileAnalytics["monthly"] | null;
  loading: boolean;
  onMonthChange: (month: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const currentMonth = localDayKey().slice(0, 7);
  const month = monthly?.month ?? currentMonth;
  const days = monthly?.days ?? [];

  const allDays = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);

    const totalDays = new Date(
      year,
      monthNumber,
      0,
    ).getDate();

    const daysMap = new Map(
      days.map((day) => [day.date.slice(0, 10), day]),
    );

    return Array.from({ length: totalDays }, (_, index) => {
      const dayNumber = index + 1;

      const dateKey = [
        year,
        String(monthNumber).padStart(2, "0"),
        String(dayNumber).padStart(2, "0"),
      ].join("-");

      const existing = daysMap.get(dateKey);

      return (
        existing ?? {
          date: dateKey,
          completed: 0,
          focusMinutes: 0,
        }
      );
    });
  }, [days, month]);

  const max = Math.max(
    1,
    ...allDays.map((day) => day.completed),
  );

  return (
    <section
      className="border border-soft p-5 sm:p-6"
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-secondary">
            Daily productivity
          </p>

          <p className="mt-1 text-2xl font-semibold tracking-tight text-primary">
            {monthly
              ? `${monthly.avgTasksPerDay} tasks/day`
              : "—"}
          </p>

        </div>

        <div className="flex items-center gap-1 border border-soft p-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            disabled={loading}
            className="grid size-7 place-items-center rounded-lg text-[#6b6b84] transition-colors hover:bg-[#f0f0f7] hover:text-[#14142b] disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>

          <span className="min-w-[120px] text-center text-sm font-medium text-steel">
            {monthLabel(month)}
          </span>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            disabled={loading || month >= currentMonth}
            className="grid size-7 place-items-center rounded-lg text-[#6b6b84] transition-colors hover:bg-[#f0f0f7] hover:text-[#14142b] disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        className={`relative mt-6 flex h-36 items-end gap-[3px] transition-opacity ${
          loading ? "opacity-40" : ""
        }`}
      >
        {loading && days.length === 0 ? (
          <p className="m-auto text-sm text-[#6b6b84]">
            Loading…
          </p>
        ) : (
          allDays.map((d, i) => (
            <div
              key={d.date}
              className="group relative flex h-full min-w-0 flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`w-full rounded-t-sm transition-colors ${
                  d.completed > 0
                    ? "bg-[#6d4aff]/85 group-hover:bg-[#6d4aff]"
                    : "bg-canvas"
                }`}
                style={{
                  height:
                    d.completed > 0
                      ? `${Math.max(
                          4,
                          (d.completed / max) * 100,
                        )}%`
                      : "4px",
                }}
              />

              {hover === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#14142b] px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-white">
                    {d.completed}{" "}
                    {d.completed === 1 ? "task" : "tasks"} ·{" "}
                    {formatMinutes(d.focusMinutes)}
                  </p>

                  <p className="text-white/60">
                    {fmtDay(d.date)}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {!loading || days.length > 0 ? (
        <div className="mt-2 flex justify-between text-[11px] text-[#9a9ab0]">
          <span>
            {allDays.length > 0
              ? fmtDay(allDays[0].date)
              : ""}
          </span>

          <span>
            {allDays.length > 0
              ? fmtDay(allDays[allDays.length - 1].date)
              : ""}
          </span>
        </div>
      ) : null}
    </section>
  );
}


/* ----------------------------- focus chart (unchanged) -------------------------------- */

function FocusTimeCard({ focus }: { focus: ProfileAnalytics['focus30'] | null }) {
  const W = 700
  const H = 220
  const PT = 18
  const PB = 30
  const PX = 10
  const ref = useRef<SVGSVGElement | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const data = focus?.days ?? []
  const max = Math.max(1, ...data.map((d) => d.minutes)) * 1.15
  const stepX = data.length > 1 ? (W - PX * 2) / (data.length - 1) : 0
  const pts = data.map((d, i) => ({
    ...d,
    x: PX + i * stepX,
    y: PT + (1 - d.minutes / max) * (H - PT - PB),
  }))
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const area =
    pts.length > 1
      ? `${line} L${pts[pts.length - 1].x.toFixed(1)} ${H - PB} L${pts[0].x.toFixed(1)} ${H - PB} Z`
      : ''
  const delta = focus?.delta ?? 0

  return (
    <section className={`p-5 sm:p-6 border border-soft`}>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-secondary">Focus time · Last 30 days</p>
          <div className="mt-1 flex items-center gap-2.5">
            <p className="text-2xl font-semibold tracking-tight text-primary">
              {focus ? formatMinutes(focus.totalMinutes) : '—'}
            </p>
            {focus && (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  delta >= 0 ? 'bg-[#efeaff] text-[#5b38f0]' : 'bg-rose-50 text-rose-600'
                }`}
                title={`vs ${formatMinutes(focus.prevTotalMinutes)} in the previous 30 days`}
              >
                {delta > 0 ? '+' : ''}
                {delta}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        {pts.length > 1 ? (
          <svg
            ref={ref}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full cursor-crosshair"
            role="img"
            aria-label={`Focus time over the last 30 days: ${formatMinutes(focus?.totalMinutes ?? 0)} total`}
            onMouseMove={(e) => {
              const rect = ref.current?.getBoundingClientRect()
              if (!rect) return
              const x = ((e.clientX - rect.left) / rect.width) * W
              const idx = Math.round((x - PX) / stepX)
              setHover(Math.max(0, Math.min(data.length - 1, idx)))
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6d4aff" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#6d4aff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PX}
                x2={W - PX}
                y1={PT + f * (H - PT - PB)}
                y2={PT + f * (H - PT - PB)}
                stroke="rgba(20,20,43,0.08)"
                strokeDasharray="3 5"
              />
            ))}
            <path d={area} fill="url(#focusFill)" />
            <path
              d={line}
              fill="none"
              stroke="#6d4aff"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {hover !== null && (
              <g>
                <line
                  x1={pts[hover].x}
                  x2={pts[hover].x}
                  y1={PT}
                  y2={H - PB}
                  stroke="rgba(20,20,43,0.15)"
                />
                <circle
                  cx={pts[hover].x}
                  cy={pts[hover].y}
                  r="5"
                  fill="#6d4aff"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
              </g>
            )}
          </svg>
        ) : (
          <div className="grid h-40 place-items-center text-sm text-[#6b6b84]">Loading…</div>
        )}

        {hover !== null && pts[hover] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[#14142b] px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(pts[hover].x / W) * 100}%`,
              top: `${(pts[hover].y / H) * 100 - 2}%`,
            }}
          >
            <p className="font-semibold text-white">{formatMinutes(pts[hover].minutes)} focused</p>
            <p className="text-white/60">{fmtDay(pts[hover].date)}</p>
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------- edit modal (unchanged) ------------------------------- */

function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: User
  onClose: () => void
  onSaved: (user: User) => void
}) {
  const [draft, setDraft] = useState({ firstName: user.firstName, lastName: user.lastName })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstName = draft.firstName.trim()
  const lastName = draft.lastName.trim()
  const valid = NAME_PATTERN.test(firstName) && NAME_PATTERN.test(lastName)
  const unchanged = firstName === user.firstName && lastName === user.lastName

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || saving) return
    if (unchanged) return onClose()
    setSaving(true)
    setError(null)
    try {
      const res = await authApi.updateProfile({ firstName, lastName })
      onSaved(res.data?.user ?? { ...user, firstName, lastName })
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; errors?: { msg: string }[] } } }
      setError(e.response?.data?.errors?.[0]?.msg ?? e.response?.data?.message ?? 'Could not save profile')
      setSaving(false)
    }
  }

  const inputCls =
    'h-11 bg-[#f7f7fc] px-3.5 text-sm font-normal text-[#14142b] outline-none transition-shadow focus:border-[#6d4aff] focus:bg-white focus:ring-4 focus:ring-[#6d4aff]/15'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background p-4 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="w-full max-w-md bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 id="edit-profile-title" className="text-lg font-semibold text-[#14142b]">
              Edit profile
            </h3>
            <p className="mt-1 text-sm text-[#6b6b84]">Update your personal profile information.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="grid size-8 place-items-center rounded-lg text-[#6b6b84] hover:bg-[#f0f0f7] hover:text-[#14142b]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-[#14142b]">
            First name
            <input
              autoFocus
              value={draft.firstName}
              maxLength={50}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-[#14142b]">
            Last name
            <input
              value={draft.lastName}
              maxLength={50}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-[#6b6b84]">
          {error ? (
            <span role="alert" className="text-rose-600">
              {error}
            </span>
          ) : (
            '2–50 characters, letters and spaces only.'
          )}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-medium text-[#6b6b84] hover:bg-[#f0f0f7] hover:text-[#14142b]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || saving}
            className=" bg-[#6d4aff] px-4 py-2.5 text-sm font-medium text-white shadow-[0_4px_12px_rgba(109,74,255,0.3)] hover:bg-[#5b38f0] disabled:opacity-50 disabled:shadow-none"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* --------------------------------- main page ------------------------------- */

export default function ProductivityProfile() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const { data, status, error, month } = useAppSelector(selectProfileAnalytics)
  const [editOpen, setEditOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    dispatch(fetchProfileAnalytics(month ?? undefined))
  }, [dispatch])

  useEffect(() => {
    if (!saved) return
    const t = window.setTimeout(() => setSaved(false), 2200)
    return () => window.clearTimeout(t)
  }, [saved])

  const stats: ProfileStat[] = useMemo(() => {
    const s = data?.stats
    return [
      {
        label: 'Tasks completed',
        value: s ? fmt(s.totalCompleted) : '—',
        icon: Check,
      },
      {
        label: 'Best productivity day',
        value: s ? `${s.bestDay?.count ?? 0} tasks` : '—',
        hint: s?.bestDay ? fmtDay(s.bestDay.date) : undefined,
        icon: TrendingUp,
      },
      {
        label: 'Longest focus session',
        value: s ? fmtSeconds(s.longestSessionSeconds) : '—',
        icon: Clock3,
      },
      {
        label: 'Completion streak',
        value: s
          ? `${s.currentStreak} ${s.currentStreak === 1 ? 'day' : 'days'}`
          : '—',
        hint:
          s && s.longestStreak > 0
            ? `Best: ${s.longestStreak} days`
            : undefined,
        icon: Flame,
      },
    ]
  }, [data])

  const loading = status === 'loading'

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1400px]">
        {status === 'failed' && (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            <span>{error ?? 'Could not load your profile analytics.'}</span>
            <button
              type="button"
              onClick={() => dispatch(fetchProfileAnalytics(month ?? undefined))}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-rose-100"
            >
              Try again
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-5">
          {/* Profile: full-width row */}
          <ProfileCard
            user={user}
            onEdit={() => setEditOpen(true)}
            currentAchievement={data?.currentAchievement ?? null}
            onFrameChange={async (frameId) => {
              try {
                const res = await authApi.updateProfile({ pfpFrame: frameId })
                if (res.data?.user) {
                  dispatch(updateUser(res.data.user))
                }
              } catch (e) {
                console.error('Failed to update PFP frame:', e)
              }
            }}
          />

          <section
            aria-label="Productivity statistics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {stats.map((stat, index) => (
              <ProfileStatCard
                key={stat.label}
                stat={stat}
                index={index}
              />
            ))}
          </section>

          <ProductivityCard
            monthly={data?.monthly ?? null}
            loading={loading}
            onMonthChange={(m) => dispatch(fetchProfileAnalytics(m))}
          />

          <FocusTimeCard focus={data?.focus30 ?? null} />

          <AchievementsSection
            achievements={data?.achievements ?? null}
            currentAchievement={data?.currentAchievement ?? null}
            totalFocusHours={data?.totalFocusHours ?? 0}
          />

          <ProjectsSection projects={data?.projects ?? null} />

          <section
            aria-label="Activity heatmap"
            className={`min-w-0 overflow-x-auto`}
          >
            {data ? <ActivityHeatmap cells={data.heatmap} /> : <HeatmapSkeleton />}
          </section>
        </div>
      </div>

      {editOpen && user && (
        <EditProfileModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            dispatch(updateUser(updated))
            setEditOpen(false)
            setSaved(true)
          }}
        />
      )}

      {saved && (
        <div
          role="status"
          className="fixed bottom-5 right-5 flex items-center gap-2 rounded-xl bg-[#14142b] px-4 py-3 text-sm text-white shadow-lg"
        >
          <Check className="size-4 text-emerald-400" />
          Profile saved
        </div>
      )}
    </main>
  )
}