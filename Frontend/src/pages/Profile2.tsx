import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  FolderKanban,
  LayoutDashboard,
  Pencil,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import {
  type AnalyticsData,
  type ComparisonMode,
  getAnalyticsData,
} from "../components/Ui/analytics-data"
import { ActivityHeatmap } from '../components/Ui/activity-heatmap'
import NotchNavbar from './Notch'
import { TimerPanel } from '../components/Ui/timer-panel'

/* --------------------------------- utils ---------------------------------- */

const addDays = (date: Date, days: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const seeded = (seed: number) => {
  let s = seed

  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)

const fmtDay = (d: Date) =>
  d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}

/* ------------------------------ dark tokens ------------------------------- */

const heatLevels = [
  'bg-[#221a2e]',
  'bg-[#3b1d63]',
  'bg-[#6d28d9]',
  'bg-[#9333ea]',
  'bg-[#c084fc]',
]

/* --------------------------------- data ----------------------------------- */

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, active: false },
  { label: 'My tasks', icon: Check, active: false },
  { label: 'Projects', icon: FolderKanban, active: true },
  { label: 'Team', icon: Users, active: false },
]


const projects = [
  {
    name: 'Website redesign',
    tasks: 128,
    done: 104,
    status: 'In progress',
    tone: 'bg-blue-500',
  },
  {
    name: 'Mobile app launch',
    tasks: 86,
    done: 86,
    status: 'Done',
    tone: 'bg-emerald-500',
  },
  {
    name: 'Q3 marketing plan',
    tasks: 54,
    done: 22,
    status: 'In progress',
    tone: 'bg-blue-500',
  },
  {
    name: 'Design system v2',
    tasks: 73,
    done: 61,
    status: 'In progress',
    tone: 'bg-blue-500',
  },
  {
    name: 'Customer research',
    tasks: 31,
    done: 0,
    status: 'Planning',
    tone: 'bg-amber-500',
  },
]

const statusStyle: Record<string, string> = {
  'In progress': 'bg-blue-500/10 text-blue-400',
  Done: 'bg-emerald-500/10 text-emerald-400',
  Planning: 'bg-amber-500/10 text-amber-400',
}

type RangeKey = 'Weekly' | 'Monthly' | 'Yearly'

const ranges: RangeKey[] = ['Weekly', 'Monthly', 'Yearly']

type DayCell = {
  date: Date
  count: number
  level: number
  future: boolean
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/* -------------------------------- banner card ------------------------------ */

function Banner({
  initials,
  onEdit,
}: {
  initials: string
  onEdit: () => void
}) {
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
              <div className="grid size-24 place-items-center rounded-full border-4 border-(--color-background) bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] text-3xl font-bold text-white">
                {initials}
              </div>

              <span className="absolute bottom-2 right-1 size-3 rounded-full border-2 border-(--color-background) bg-emerald-500" />
            </div>

            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2.5 text-primary">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Alex Morgan
                </h2>

                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-secondary">
                  PRODUCTIVE
                </span>
              </div>

              <p className="mt-1 text-sm text-[#8b8b96]">
                @alexmorgan · alex.morgan@example.com
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:pb-1">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8b5cf6]"
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

function ProductivityCard() {

  const [monthIdx, setMonthIdx] = useState(
    new Date().getMonth(),
  )

  const today = new Date()

  const bars = useMemo(() => {
    const rnd = seeded(100 + monthIdx)

    return Array.from({ length: 24 }, (_, i) => {
      const weekend = i % 7 >= 5

      return {
        label: String(i + 1),
        value: Math.round(
          rnd() * (weekend ? 4 : 18) + rnd() * 26,
        ),
      }
    })
  }, [monthIdx])

  const max = Math.max(...bars.map((b) => b.value))
  const monthLabel = months[monthIdx]

  const step = (dir: 1 | -1) =>
    setMonthIdx((m) =>
      Math.min(11, Math.max(0, m + dir)),
    )

  return (
    <section className="bg-card p-5 sm:p-6 border border-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#8b8b96]">
            Daily productivity
          </p>

          <p className="mt-1 text-2xl font-semibold tracking-tight text-primary">
            7.4 tasks/day
          </p>
        </div>

        <div className="flex items-center gap-1 px-1 py-1">
          <button
            aria-label="Previous month"
            onClick={() => step(-1)}
            disabled={monthIdx === 0}
            className="grid size-6 place-items-center rounded-md text-[#8b8b96] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="size-3.5" />
          </button>

          <span className="min-w-[84px] text-center text-sm text-white/80">
            {monthLabel}
          </span>

          <button
            aria-label="Next month"
            onClick={() => step(1)}
            disabled={monthIdx === 11}
            className="grid size-6 place-items-center rounded-md text-[#8b8b96] transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-6 flex h-32 items-end gap-[6px]">
        {bars.map((b, i) => (
          <div
            key={i}
            className="group relative flex h-full flex-1 items-end"
          >
            <div
              className="w-full rounded-t-[3px] bg-[#a855f7] transition-colors group-hover:bg-[#c084fc]"
              style={{
                height: `${Math.max(
                  4,
                  (b.value / max) * 100,
                )}%`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-[#5c5c66]">
        <span>Jun 1</span>

        <span>
          Today ·{' '}
          {today.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </section>
  )
}

/* ----------------------------- focus chart -------------------------------- */

function FocusTimeCard() {
  const W = 700
  const H = 220
  const PT = 18
  const PB = 30
  const PX = 10

  const ref = useRef<SVGSVGElement | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const data = useMemo(() => {
    const rnd = seeded(21)

    return Array.from({ length: 30 }, (_, i) => ({
      label: fmtDay(
        addDays(new Date(), -(29 - i)),
      ),
      value:
        60 +
        Math.round(
          rnd() * 240 + Math.sin(i / 4) * 80,
        ),
    }))
  }, [])

  const max =
    Math.max(...data.map((d) => d.value)) * 1.15

  const stepX =
    (W - PX * 2) / (data.length - 1)

  const pts = data.map((d, i) => ({
    ...d,
    x: PX + i * stepX,
    y:
      PT +
      (1 - d.value / max) *
        (H - PT - PB),
  }))

  const line = pts
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${p.x.toFixed(
          1,
        )} ${p.y.toFixed(1)}`,
    )
    .join(' ')

  const area = `${line} L${pts[
    pts.length - 1
  ].x.toFixed(1)} ${H - PB} L${pts[
    0
  ].x.toFixed(1)} ${H - PB} Z`

  const total = data.reduce(
    (a, b) => a + b.value,
    0,
  )

  return (
    <section className="border border-soft p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-[#8b8b96]">
            Focus time · Last 30 days
          </p>

          <div className="mt-1 flex items-center gap-2.5">
            <p className="text-2xl font-semibold tracking-tight text-primary">
              {formatMinutes(total)}
            </p>

            <span className="rounded-md bg-[#7c3aed]/20 px-2 py-0.5 text-xs font-semibold text-[#c084fc]">
              +9.4%
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full cursor-crosshair"
          onMouseMove={(e) => {
            const rect =
              ref.current?.getBoundingClientRect()

            if (!rect) return

            const x =
              ((e.clientX - rect.left) /
                rect.width) *
              W

            const idx = Math.round(
              (x - PX) / stepX,
            )

            setHover(
              Math.max(
                0,
                Math.min(
                  data.length - 1,
                  idx,
                ),
              ),
            )
          }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient
              id="focusFill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#a855f7"
                stopOpacity="0.35"
              />

              <stop
                offset="100%"
                stopColor="#a855f7"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PX}
              x2={W - PX}
              y1={
                PT +
                f *
                  (H - PT - PB)
              }
              y2={
                PT +
                f *
                  (H - PT - PB)
              }
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 5"
            />
          ))}

          <path
            d={area}
            fill="url(#focusFill)"
          />

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

        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#1c1c22] px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(pts[hover].x / W) * 100}%`,
              top: `${
                (pts[hover].y / H) * 100 - 2
              }%`,
            }}
          >
            <p className="font-semibold text-white">
              {formatMinutes(
                pts[hover].value,
              )}{' '}
              focused
            </p>

            <p className="text-[#8b8b96]">
              {pts[hover].label}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/* --------------------------------- main page ------------------------------- */

export default function ProductivityProfile() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [profile, setProfile] = useState({
    firstName: 'Alex',
    lastName: 'Morgan',
  })

  const [draft, setDraft] = useState(profile)
  const [editOpen, setEditOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load analytics data once when the component mounts.
  // NOTE: hooks must always be called at the top level of the
  // component body — never inside a function like an event
  // handler (that was the bug causing the heatmap to stay empty).
  useEffect(() => {
    setData(getAnalyticsData())
  }, [])

  const initials =
    (
      (profile.firstName[0] ?? '') +
      (profile.lastName[0] ?? '')
    ).toUpperCase() || '?'

  const stats = [
    {
      label: 'Tasks completed',
      value: '1,284',
      icon: Check,
    },
    {
      label: 'Best productivity day',
      value: '42 tasks',
      icon: TrendingUp,
    },
    {
      label: 'Longest focus session',
      value: '4h 18m',
      icon: Clock3,
    },
    {
      label: 'Completion streak',
      value: '62 days',
      icon: Flame,
    },
  ]

  const openEdit = () => {
    setDraft(profile)
    setEditOpen(true)
  }

  const saveEdit = () => {
    if (
      !draft.firstName.trim() ||
      !draft.lastName.trim()
    ) {
      return
    }

    setProfile({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
    })

    setEditOpen(false)
    setSaved(true)

    window.setTimeout(
      () => setSaved(false),
      2200,
    )
  }

  return (
    <main className="min-h-screen text-white">
      <div className="flex min-h-screen">
       
        {/* ------------------------------- sidebar ------------------------------ */}

        {/* Keep your existing sidebar here if this page
            is being rendered inside the application shell. */}

        {/* -------------------------------- content ----------------------------- */}

        <section className="min-w-0 flex-1">
          <div className="mx-auto px-4 py-8 sm:px-6 lg:px-8">

            {/* banner */}

            <Banner
              initials={initials}
              onEdit={openEdit}
            />


            {/* stat cards */}

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="border border-soft p-5"
                >
                  <p className="text-2xl font-semibold tracking-tight text-primary">
                    {s.value}
                  </p>

                  <p className="mt-1 flex items-center gap-1.5 text-sm text-[#8b8b96]">
                    <s.icon className="size-3.5" />
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* analytics - ONE COMPONENT PER ROW                               */}
            {/* ---------------------------------------------------------------- */}

            <div className="mt-5 flex flex-col gap-5">

              {/* Row 1 */}
              <div className="w-full">
                {data ? <ActivityHeatmap cells={data.heatmap} /> : null}
              </div>

              {/* Row 2 */}
              <div className="w-full">
                <ProductivityCard />
              </div>

              {/* Row 3 */}
              <div className="w-full">
                <FocusTimeCard />
              </div>

            </div>

            {/* projects */}

            <section className="mt-5 border border-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-soft px-5 py-5 sm:px-6">
                <div>
                  <h2 className="font-semibold text-primary">
                    Projects
                  </h2>

                  <p className="mt-1 text-sm text-[#8b8b96]">
                    Where your tasks live.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-primary">
                    32 projects
                  </span>

                  <button className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-secondary hover:bg-white/[0.06]">
                    View all
                  </button>
                </div>
              </div>

              {projects.map((p) => {
                const pct = Math.round(
                  (p.done / p.tasks) * 100,
                )

                return (
                  <div
                    key={p.name}
                    className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                        <FolderKanban className="size-4 text-[#8b8b96]" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {p.name}
                        </p>

                        <p className="text-xs text-[#8b8b96]">
                          {p.done}/{p.tasks} tasks · {pct}%
                        </p>
                      </div>
                    </div>

                    <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-[#a855f7]"
                        style={{
                          width: `${pct}%`,
                        }}
                      />
                    </div>

                    <span
                      className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle[p.status]}`}
                    >
                      <span
                        className={`mr-1.5 inline-block size-1.5 rounded-full ${p.tone}`}
                      />

                      {p.status}
                    </span>
                  </div>
                )
              })}
            </section>
          </div>
        </section>
      </div>

      {/* ------------------------------- edit modal ------------------------------ */}

      {editOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setEditOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit profile"
            className="w-full max-w-md bg-[#131316] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Edit profile
                </h3>

                <p className="mt-1 text-sm text-[#8b8b96]">
                  Update your personal profile
                  information.
                </p>
              </div>

              <button
                aria-label="Close"
                onClick={() =>
                  setEditOpen(false)
                }
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
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      firstName:
                        e.target.value,
                    })
                  }
                  className="h-10 rounded-lg border border-soft bg-[#0b0b0e] px-3 text-sm font-normal text-white outline-none ring-[#7c3aed] focus:ring-2"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-white/90">
                Last name

                <input
                  value={draft.lastName}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      lastName:
                        e.target.value,
                    })
                  }
                  className="h-10 rounded-lg border border-white/[0.08] bg-[#0b0b0e] px-3 text-sm font-normal text-white outline-none ring-[#7c3aed] focus:ring-2"
                />
              </label>
            </div>


            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() =>
                  setEditOpen(false)
                }
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#8b8b96] hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>

              <button
                onClick={saveEdit}
                disabled={
                  !draft.firstName.trim() ||
                  !draft.lastName.trim()
                }
                className=" bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#8b5cf6] disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}

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