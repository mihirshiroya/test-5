import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  FolderKanban,
  Pencil,
  TrendingUp,
  X,
} from 'lucide-react'
import {
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
  'In progress': { badge: 'bg-blue-500/10 text-blue-400', dot: 'bg-blue-500' },
  Done: { badge: 'bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-500' },
  Planning: { badge: 'bg-amber-500/10 text-amber-400', dot: 'bg-amber-500' },
}

/* -------------------------------- banner card ------------------------------ */

function Banner({ user, onEdit }: { user: User | null; onEdit: () => void }) {
  const first = user?.firstName ?? ''
  const last = user?.lastName ?? ''
  const initials = ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?'
  const handle = user?.email?.split('@')[0]
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <section className="overflow-hidden">
      <div className="relative h-44 sm:h-52">
        <img
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#131316] via-transparent to-transparent" />
      </div>

      <div className="px-5 pb-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative -mt-12 shrink-0 sm:-mt-14">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={`${first} ${last}`}
                  className="size-24 rounded-full border-4 border-(--color-background) object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="grid size-24 place-items-center rounded-full border-4 border-(--color-background) bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] text-3xl font-bold text-white">
                  {initials}
                </div>
              )}
              <span className="absolute bottom-2 right-1 size-3 rounded-full border-2 border-(--color-background) bg-emerald-500" />
            </div>

            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2.5 text-primary">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {first || last ? `${first} ${last}`.trim() : 'Your profile'}
                </h2>
                {user?.role && user.role !== 'USER' && (
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-secondary">
                    {user.role}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-[#8b8b96]">
                {handle ? `@${handle} · ` : ''}
                {user?.email}
                {memberSince ? ` · Member since ${memberSince}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:pb-1">
            <button
              type="button"
              onClick={onEdit}
              disabled={!user}
              className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8b5cf6] disabled:opacity-50"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------- productivity chart --------------------------- */

function ProductivityCard({
  monthly,
  loading,
  onMonthChange,
}: {
  monthly: ProfileAnalytics['monthly'] | null
  loading: boolean
  onMonthChange: (month: string) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const currentMonth = localDayKey().slice(0, 7)
  const month = monthly?.month ?? currentMonth
  const days = monthly?.days ?? []
  const max = Math.max(1, ...days.map((d) => d.completed))

  return (
    <section className="border border-soft bg-card p-5 sm:p-6" aria-busy={loading}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#8b8b96]">Daily productivity</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-primary">
            {monthly ? `${monthly.avgTasksPerDay} tasks/day` : '—'}
          </p>
          {monthly && (
            <p className="mt-0.5 text-xs text-[#8b8b96]">
              {fmt(monthly.totalCompleted)} completed this month
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 px-1 py-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            disabled={loading}
            className="grid size-6 place-items-center rounded-md text-[#8b8b96] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="min-w-[120px] text-center text-sm text-white/80">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            disabled={loading || month >= currentMonth}
            className="grid size-6 place-items-center rounded-md text-[#8b8b96] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className={`relative mt-6 flex h-32 items-end gap-[3px] transition-opacity ${loading ? 'opacity-40' : ''}`}>
        {days.length === 0 && (
          <p className="m-auto text-sm text-[#8b8b96]">{loading ? 'Loading…' : 'No data'}</p>
        )}
        {days.map((d, i) => (
          <div
            key={d.date}
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={`w-full rounded-t-[3px] transition-colors ${
                d.completed > 0 ? 'bg-[#a855f7] group-hover:bg-[#c084fc]' : 'bg-white/[0.06]'
              }`}
              style={{ height: `${Math.max(4, (d.completed / max) * 100)}%` }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#1c1c22] px-3 py-2 text-xs shadow-lg">
                <p className="font-semibold text-white">
                  {d.completed} {d.completed === 1 ? 'task' : 'tasks'} · {formatMinutes(d.focusMinutes)}
                </p>
                <p className="text-[#8b8b96]">{fmtDay(d.date)}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {days.length > 0 && (
        <div className="mt-2 flex justify-between text-[10px] text-[#5c5c66]">
          <span>{fmtDay(days[0].date)}</span>
          <span>{fmtDay(days[days.length - 1].date)}</span>
        </div>
      )}
    </section>
  )
}

/* ----------------------------- focus chart -------------------------------- */

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
    <section className="border border-soft p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-[#8b8b96]">Focus time · Last 30 days</p>
          <div className="mt-1 flex items-center gap-2.5">
            <p className="text-2xl font-semibold tracking-tight text-primary">
              {focus ? formatMinutes(focus.totalMinutes) : '—'}
            </p>
            {focus && (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  delta >= 0 ? 'bg-[#7c3aed]/20 text-[#c084fc]' : 'bg-rose-500/15 text-rose-400'
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
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PX}
                x2={W - PX}
                y1={PT + f * (H - PT - PB)}
                y2={PT + f * (H - PT - PB)}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 5"
              />
            ))}

            <path d={area} fill="url(#focusFill)" />
            <path
              d={line}
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
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
                  stroke="rgba(255,255,255,0.15)"
                />
                <circle
                  cx={pts[hover].x}
                  cy={pts[hover].y}
                  r="4.5"
                  fill="#c084fc"
                  stroke="#131316"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        ) : (
          <div className="grid h-40 place-items-center text-sm text-[#8b8b96]">Loading…</div>
        )}

        {hover !== null && pts[hover] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#1c1c22] px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(pts[hover].x / W) * 100}%`,
              top: `${(pts[hover].y / H) * 100 - 2}%`,
            }}
          >
            <p className="font-semibold text-white">{formatMinutes(pts[hover].minutes)} focused</p>
            <p className="text-[#8b8b96]">{fmtDay(pts[hover].date)}</p>
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------- projects --------------------------------- */

const PROJECTS_PREVIEW = 5

function ProjectsList({ projects }: { projects: ProjectSummary[] | null }) {
  const [showAll, setShowAll] = useState(false)
  const list = projects ?? []
  const visible = showAll ? list : list.slice(0, PROJECTS_PREVIEW)

  return (
    <section className="mt-5 border border-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-soft px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold text-primary">Projects</h2>
          <p className="mt-1 text-sm text-[#8b8b96]">Where your tasks live.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-primary">
            {list.length} {list.length === 1 ? 'project' : 'projects'}
          </span>
          {list.length > PROJECTS_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-secondary hover:bg-white/[0.06]"
            >
              {showAll ? 'Show less' : 'View all'}
            </button>
          )}
        </div>
      </div>

      {projects === null && (
        <p className="px-5 py-6 text-sm text-[#8b8b96] sm:px-6">Loading projects…</p>
      )}

      {projects !== null && list.length === 0 && (
        <p className="px-5 py-6 text-sm text-[#8b8b96] sm:px-6">
          No projects yet. Create a workspace to get started.
        </p>
      )}

      {visible.map((p) => {
        const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
        const style = statusStyle[p.status]

        return (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 transition-colors last:border-0 hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-4 sm:px-6"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                <FolderKanban className="size-4 text-[#8b8b96]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-primary">{p.name}</p>
                <p className="text-xs text-[#8b8b96]">
                  {p.done}/{p.total} tasks · {pct}%
                </p>
              </div>
            </div>

            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-[#a855f7]" style={{ width: `${pct}%` }} />
            </div>

            <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${style.badge}`}>
              <span className={`mr-1.5 inline-block size-1.5 rounded-full ${style.dot}`} />
              {p.status}
            </span>
          </Link>
        )
      })}
    </section>
  )
}

/* ------------------------------- edit modal ------------------------------- */

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

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="w-full max-w-md bg-[#131316] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 id="edit-profile-title" className="text-lg font-semibold text-white">
              Edit profile
            </h3>
            <p className="mt-1 text-sm text-[#8b8b96]">Update your personal profile information.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="grid size-8 place-items-center rounded-lg text-[#8b8b96] hover:bg-white/[0.06] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-white/90">
            First name
            <input
              autoFocus
              value={draft.firstName}
              maxLength={50}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              className="h-10 rounded-lg border border-white/[0.08] bg-[#0b0b0e] px-3 text-sm font-normal text-white outline-none ring-[#7c3aed] focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-white/90">
            Last name
            <input
              value={draft.lastName}
              maxLength={50}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
              className="h-10 rounded-lg border border-white/[0.08] bg-[#0b0b0e] px-3 text-sm font-normal text-white outline-none ring-[#7c3aed] focus:ring-2"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-[#8b8b96]">
          {error ? (
            <span role="alert" className="text-rose-400">
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
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#8b8b96] hover:bg-white/[0.06] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || saving}
            className="bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#8b5cf6] disabled:opacity-50"
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
    // Only on mount; month changes dispatch directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])

  useEffect(() => {
    if (!saved) return
    const t = window.setTimeout(() => setSaved(false), 2200)
    return () => window.clearTimeout(t)
  }, [saved])

  const stats = useMemo(() => {
    const s = data?.stats
    return [
      {
        label: 'Tasks completed',
        value: s ? fmt(s.totalCompleted) : '—',
        icon: Check,
      },
      {
        label: 'Best productivity day',
        value: s?.bestDay ? `${s.bestDay.count} ${s.bestDay.count === 1 ? 'task' : 'tasks'}` : s ? '0 tasks' : '—',
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
        value: s ? `${s.currentStreak} ${s.currentStreak === 1 ? 'day' : 'days'}` : '—',
        hint: s && s.longestStreak > 0 ? `Best: ${s.longestStreak} days` : undefined,
        icon: Flame,
      },
    ]
  }, [data])

  const loading = status === 'loading'

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Banner user={user} onEdit={() => setEditOpen(true)} />

        {status === 'failed' && (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-soft p-4 text-sm text-primary"
          >
            <span>{error ?? 'Could not load your profile analytics.'}</span>
            <button
              type="button"
              onClick={() => dispatch(fetchProfileAnalytics(month ?? undefined))}
              className="border border-soft px-3 py-1.5 text-sm font-medium hover:bg-white/[0.06]"
            >
              Try again
            </button>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="border border-soft p-5">
              <p className="text-2xl font-semibold tracking-tight text-primary tabular-nums">{s.value}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#8b8b96]">
                <s.icon className="size-3.5" />
                {s.label}
              </p>
              {s.hint && <p className="mt-1 text-xs text-[#5c5c66]">{s.hint}</p>}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <div className="w-full">
            {data ? <ActivityHeatmap cells={data.heatmap} /> : <HeatmapSkeleton />}
          </div>

          <div className="w-full">
            <ProductivityCard
              monthly={data?.monthly ?? null}
              loading={loading}
              onMonthChange={(m) => dispatch(fetchProfileAnalytics(m))}
            />
          </div>

          <div className="w-full">
            <FocusTimeCard focus={data?.focus30 ?? null} />
          </div>
        </div>

        <ProjectsList projects={data?.projects ?? null} />
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
          className="fixed bottom-5 right-5 flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-3 text-sm text-white shadow-lg"
        >
          <Check className="size-4" />
          Profile saved
        </div>
      )}
    </main>
  )
}
