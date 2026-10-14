import { useEffect, useMemo, useRef, useState } from 'react'

import { AchievementsSection, ProfileHeader, ProfileProjects, getAchievements } from './profile/profile-section'

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Sparkles,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react'

import {
  type ProfileAnalytics,
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

  const { current } = getAchievements(data)

  const stats = useMemo(() => {
    const s = data?.stats
    return [
      {
        label: 'Tasks completed',
        value: s ? fmt(s.totalCompleted) : '—',
        hint: undefined as string | undefined,
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
    <main className="min-h-screen bg-background pb-12">
      <div className="mx-auto">
        

        <ProfileHeader user={user} current={current} onEdit={() => setEditOpen(true)} />

        {status === 'failed' && (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
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

        <section
          aria-label="Productivity statistics"
          className="mt-5 mb-7 grid grid-cols-1 gap-y-5 border border-soft py-[18px] sm:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-5 ${i < stats.length - 1 ? 'lg:border-r border-soft' : ''}`}
            >
              <div className="mb-2 flex items-center justify-between text-[#aaa0bc]">
                <span className="text-[10px] text-[#777580]">{s.label}</span>
                <s.icon size={13} aria-hidden="true" />
              </div>
              <p className="text-2xl font-semibold tracking-[-0.7px]">{s.value}</p>
              <p className="mt-[5px] min-h-3.5 text-[9px] text-[#8d8797]">
                {s.hint ?? (s.label === 'Tasks completed' ? 'One task at a time' : 'Time well invested')}
              </p>
            </div>
          ))}
        </section>

        <AchievementsSection data={data} />

        <ProfileProjects projects={data?.projects ?? null} />

        <section aria-label="Activity and focus insights" className="mt-8 flex flex-col gap-5">
          <div className="w-full min-w-0 overflow-x-auto">
            {data ? <ActivityHeatmap cells={data.heatmap} /> : <HeatmapSkeleton />}
          </div>
          <ProductivityCard
            monthly={data?.monthly ?? null}
            loading={loading}
            onMonthChange={(m) => dispatch(fetchProfileAnalytics(m))}
          />
          <FocusTimeCard focus={data?.focus30 ?? null} />
        </section>

        <p className="mt-[30px] flex items-center justify-center gap-1.5 text-[9px] text-[#9a909f]">
          <Sparkles size={11} aria-hidden="true" /> Progress isn&apos;t always loud. Sometimes, it&apos;s just showing up.
        </p>
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