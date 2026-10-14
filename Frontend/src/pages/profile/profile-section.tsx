import { useMemo, useState } from 'react'

import { Link } from 'react-router-dom'

import {

  Check,

  CheckCheck,

  ChevronDown,

  ChevronRight,

  Clock3,

  Diamond,

  FolderKanban,

  LockKeyhole,

  Pencil,

  Sparkles,

} from 'lucide-react'

import type { User } from '../../types'

import type { Achievement, ProfileAnalytics, ProjectSummary } from '../../components/Ui/analytics-data'

import { FOLDER_ICONS, type IconKey } from '../../components/Ui/folder-data'
import { FunnelChartCard } from '../../components/Ui/funnel-chart'



/* --------------------------------- shared -------------------------------- */



const eyebrow = 'flex items-center gap-1.5 text-[9px] font-medium tracking-[1.7px]'

const sectionTitle = 'mt-2.5 text-[26px] font-medium leading-[1.35] tracking-[-0.7px]'



function Bar({

  value,

  className = '',

  trackClass,

  fillClass,

  label,

}: {

  value: number

  className?: string

  trackClass: string

  fillClass: string

  label: string

}) {

  return (

    <div

      role="progressbar"

      aria-label={label}

      aria-valuenow={Math.round(value)}

      aria-valuemin={0}

      aria-valuemax={100}

      className={`h-1 overflow-hidden rounded-full ${trackClass} ${className} border border-soft`}

    >

      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />

    </div>

  )

}



/* ------------------------------ achievements ------------------------------ */



export function getAchievements(data: ProfileAnalytics | null) {

  const hours = data?.totalFocusHours ?? (data?.heatmap.reduce((sum, day) => sum + day.minutes, 0) ?? 0) / 60

  const achievements = data?.achievements ?? []

  const current =

    data?.currentAchievement ??

    [...achievements].filter((tier) => tier.unlocked).sort((a, b) => b.requiredHours - a.requiredHours)[0] ??

    null

  return { hours, achievements, current }

}



const gemFilters: Record<string, string> = {

  starter: 'saturate(0) brightness(1.1)',

  bronze: 'hue-rotate(-12deg) saturate(.65)',

  silver: 'saturate(0) brightness(1.4)',

  gold: 'none',

  diamond: 'hue-rotate(165deg)',

  platinum: 'hue-rotate(215deg)',

  devoted: 'hue-rotate(100deg)',

  legendary: 'hue-rotate(290deg)',

}



function Gem({ tier, locked = false }: { tier: Achievement; locked?: boolean }) {

  return (

    <span

      className="relative isolate mx-auto mt-0.5 mb-1 grid h-[135px] w-full place-items-center"

      style={

        locked

          ? {

              background: `radial-gradient(ellipse at center, color-mix(in srgb, ${tier.color} 16%, transparent), transparent 60%)`,

            }

          : undefined

      }

      aria-hidden="true"

    >

      <img

        src="/images/profile-gem.png"

        alt=""

        width="135"

        height="135"

        className={`size-[135px] object-contain mix-blend-screen transition-transform duration-300 group-hover:-translate-y-[3px] ${

          locked ? 'scale-80 opacity-[.48] blur-[9px]' : ''

        }`}

        style={{ filter: locked ? undefined : gemFilters[tier.id] }}

      />

      {locked && <LockKeyhole size={19} strokeWidth={1.6} className="absolute z-[2] text-primary" />}

    </span>

  )

}



export function ProfileHeader({

  user,

  current,

  onEdit,

}: {

  user: User | null

  current: Achievement | null

  onEdit: () => void

}) {

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?'

  const joined = user?.createdAt

    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    : '—'



  return (

    <header className="overflow-hidden border border-soft bg-background">

      <div className="relative flex h-[114px] items-end justify-end overflow-hidden bg-[#ebe5f2] px-6 py-[19px] text-[#7b688e]">

        <div

          aria-hidden="true"

          className="absolute -top-[480px] left-[18%] size-[650px] rounded-full border border-[#d7cce5]"

          style={{

            boxShadow:

              '0 0 0 28px #ebe5f2, 0 0 0 29px #dcd1e8, 0 0 0 65px #ebe5f2, 0 0 0 66px #dcd1e8, 0 0 0 106px #ebe5f2, 0 0 0 107px #dcd1e8',

            transform: 'rotate(-25deg) scaleX(1.6)',

          }}

        />

        <span className="relative flex items-center gap-[7px] text-[10px]">

          <Sparkles size={13} /> A little focus. A lot of possibility.

        </span>

      </div>



      <div className="px-[26px]">

        <div className="relative -mt-[37px] size-[82px] rounded-3xl border-[5px] border-[var(--color-background)] bg-[#e5dbea] shadow-[0_0_0_1px_#e9dfef]">

          {user?.avatar ? (

            <img

              src={user.avatar}

              alt={`${user.firstName} ${user.lastName}`}

              referrerPolicy="no-referrer"

              className="size-full rounded-[19px] object-cover"

            />

          ) : (

            <span className="grid size-full place-items-center rounded-[19px] bg-[#e7ddee] text-[25px] font-semibold text-[#705379]">

              {initials}

            </span>

          )}

          {current && (

            <span

              title={`Current earned badge: ${current.title}`}

              aria-label={`Current earned badge: ${current.title}`}

              className="absolute -right-[9px] -bottom-[3px] grid size-[29px] place-items-center rounded-full border-[3px] border-white bg-[#fcf1d9] text-[#bd8428] shadow-[0_2px_7px_#bd842825]"

            >

              <Diamond size={18} fill="currentColor" strokeWidth={1.5} />

            </span>

          )}

        </div>



        <div className="mt-[15px] flex items-center justify-between gap-4">

          <div>

            <div className="flex flex-wrap items-center gap-[11px]">

              <h1 className="text-[25px] leading-[1.3] font-semibold tracking-[-1px]">

                {user ? `${user.firstName} ${user.lastName}` : 'Your profile'}

              </h1>

              {current && (

                <span className="inline-flex items-center gap-[5px] rounded-[5px] border border-[#f0dfb9] bg-[#fff6e2] px-[7px] py-1 text-[9px] font-semibold text-[#926817]">

                  <Diamond size={12} /> {current.title}

                </span>

              )}

            </div>

            <p className="mt-[7px] text-[11px] text-[#777580]">

              {user?.email ?? 'Your own little corner of progress.'}

              <span className="text-[#9a93a6]"> · Joined {joined}</span>

            </p>

          </div>

          <button

            type="button"

            onClick={onEdit}

            disabled={!user}

            className="flex items-center gap-[7px] rounded-[7px] border border-soft px-[11px] py-2 text-[11px] font-medium whitespace-nowrap text-primary transition-colors disabled:opacity-55"

          >

            <Pencil size={13} /> Edit profile

          </button>

        </div>



        <div className="mt-5 flex justify-between gap-4 border-t border-soft py-[17px] text-[10px] text-[#777580]">

          <span className="flex items-center gap-1.5">

            <span className="size-[5px] rounded-full bg-[#7f9d80]" /> Building better habits, one day at a time.

          </span>

          <span className="flex items-center gap-1.5">

            <LockKeyhole size={11} /> Only visible to you

          </span>

        </div>

      </div>

    </header>

  )

}



export function AchievementsSection({ data }: { data: ProfileAnalytics | null }) {

  const [filter, setFilter] = useState<'All badges' | 'Unlocked' | 'Locked'>('All badges')

  const { hours, achievements, current } = getAchievements(data)

  const unlocked = achievements.filter((tier) => tier.unlocked).length

  const next = achievements.find((tier) => !tier.unlocked)

  const visible = achievements.filter(

    (tier) => filter === 'All badges' || (filter === 'Unlocked' ? tier.unlocked : !tier.unlocked),

  )



  return (

    <section

      aria-labelledby="profile-achievements-title"

      aria-busy={!data}

      className="overflow-hidden border border-soft bg-background px-[25px] pt-[27px] text-[#f5f3f7]"

    >

      <div className="flex items-center justify-between gap-5">

        <div>



          <h2 id="" className="mt-2.5 text-[26px] font-medium leading-[1.35] tracking-[-0.7px] text-primary">

            Your focus, crystallized.

          </h2>

          <p className="mt-[7px] text-xs leading-[1.6] text-primary">

            Every hour is a step forward. Every gem tells your story.

          </p>

        </div>

        <span className="flex items-center gap-[5px] border border-soft bg-secondary px-2.5 py-[7px] text-[10px] whitespace-nowrap text-[#a49ea9]">

          <Diamond size={14} className="mr-[3px] text-[#d8b769]" />

          <strong className="font-medium">{data ? unlocked : '—'}</strong> / {achievements.length}{' '}

          unlocked

        </span>

      </div>



      <div className="mt-[25px] flex items-center gap-3.5 border border-soft p-[18px]">

        <div className="grid size-[39px] shrink-0 place-items-center border border-soft text-[#b49cdd]">

          <Sparkles size={20} />

        </div>

        <div className="flex-1">

          <span className="text-[9px] tracking-[1.4px] text-[#ab91ce]">

            {next ? 'YOUR NEXT MILESTONE' : 'COLLECTION COMPLETE'}

          </span>

          <h3 className="text-[18px] font-bold text-primary">{next ? next.title : 'Legendary focus. Well earned.'}</h3>

          <p className="mt-[5px] text-[9px] text-secondary">

            {!data ? (

              'Loading your focus journey…'

            ) : next ? (

              <>

                <strong className="font-normal text-secondary">

                  {Math.max(0, next.requiredHours - hours).toLocaleString('en-US', { maximumFractionDigits: 1 })} more

                  hours

                </strong>{' '}

                to unlock your next spark.

              </>

            ) : (

              'You have unlocked every focus milestone.'

            )}

          </p>

        </div>

        <div className="w-[190px] shrink-0">

          <div className="mb-2 flex justify-between text-[11px] text-[#d4c7ec]">

            <span>

              {Math.floor(hours)} <small className="text-[10px] text-[#9588a8]">/ {next?.requiredHours ?? Math.floor(hours)} hrs</small>

            </span>

            <span>{Math.min(100, Math.floor(next?.progress ?? 100))}%</span>

          </div>

          <Bar

            value={next?.progress ?? 100}

            label="Next achievement progress"

            trackClass="bg-background"

            fillClass="bg-primary"

          />

          <p className="mt-[7px] flex items-center justify-end gap-1 text-[8px] text-[#9c8fae]">

            <Clock3 size={10} /> Total focus time

          </p>

        </div>

      </div>



      <div className="mt-[23px] mb-[17px] flex items-center justify-between">

        <div className="flex items-center gap-[5px]" role="group" aria-label="Filter achievements">

          {(['All badges', 'Unlocked', 'Locked'] as const).map((tab) => (

            <button

              type="button"

              key={tab}

              aria-pressed={filter === tab}

              onClick={() => setFilter(tab)}

              className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] transition-colors ${

                filter === tab

                  ? 'border-[#3a363f] bg-[#2b282f] text-white'

                  : 'border-transparent text-secondary hover:text-white'

              }`}

            >

              {tab}

              {tab === 'Unlocked' && <span className="text-[8px] text-[#b7a0d3]">{unlocked}</span>}

            </button>

          ))}

        </div>

        <span className="flex items-center gap-[9px] text-[8px] tracking-[1.6px] text-[#77717e]">

          THE COLLECTION <span className="h-px w-[25px] bg-[#39343f]" />

        </span>

      </div>



      <div className="grid grid-cols-2 gap-[11px] sm:grid-cols-3 lg:grid-cols-4 mb-4">

        {visible.map((tier) => {

          const isCurrent = current?.id === tier.id

          return (

            <article

              key={tier.id}

              className={`group min-w-0 border px-[18px] pt-[15px] pb-[18px] text-center transition-colors ${

                isCurrent ? 'border-[#87703e] bg-[#242018]' : 'border-soft bg-transparent hover:border-[#65556d]'

              }`}

            >

              <div className="flex h-[13px] items-center justify-between text-[9px] text-[#827d86]">

                {isCurrent ? (

                  <span className="text-[7px] tracking-[.7px] text-[#d8b365]">CURRENT BADGE</span>

                ) : (

                  <span className='text-primary'>{String(achievements.indexOf(tier) + 1).padStart(2, '0')}</span>

                )}

                {tier.unlocked ? (

                  <Check size={13} className="text-primary" />

                ) : (

                  <LockKeyhole size={11} className="text-primary" />

                )}

              </div>



              <Gem tier={tier} locked={!tier.unlocked} />



              <h3 className="text-[13px] font-medium text-primary">{tier.title}</h3>

              <p className="mt-[5px] text-[10px] text-[#99929f]">

                Focus for {tier.requiredHours.toLocaleString()} hours

              </p>



              <div className="mt-3.5 flex h-3 items-center justify-center gap-[7px]">

                {tier.unlocked ? (

                  <span

                    className={`flex items-center gap-1 text-[8px] ${isCurrent ? 'text-[#c4a264]' : 'text-[#918c96]'}`}

                  >

                    <CheckCheck size={12} /> Earned

                  </span>

                ) : (

                  <>

                    <Bar

                      value={tier.progress}

                      label={`${tier.title} progress`}

                      className="h-[3px] w-[62%]"

                      trackClass="bg-background"

                      fillClass="bg-primary"

                    />

                    <span className="text-[8px] text-[#918c96]">{Math.floor(tier.progress)}%</span>

                  </>

                )}

              </div>

            </article>

          )

        })}

      </div>



      {data && visible.length === 0 && (

        <p className="px-2.5 py-[35px] text-center text-xs text-[#b2a9c0]">

          {filter === 'Unlocked'

            ? 'Your first spark is waiting. Complete a focus session to get started.'

            : 'Every badge earned. What a journey.'}

        </p>

      )}





    </section>

  )

}



/* -------------------------------- projects -------------------------------- */

/* Redesigned: one list of rows instead of a grid of cards + progress rings.   */



const PROJECT_TINTS: Record<string, string> = {

  lavender: '#8b6fd6',

  violet: '#8b6fd6',

  blue: '#4f86d9',

  cyan: '#2fa0b8',

  emerald: '#3f9a70',

  lime: '#7ea32f',

  amber: '#c4892b',

  rose: '#d0587a',

  pink: '#c256a3',

}



type ProjectFilter = 'All' | ProjectSummary['status']



const STATUS_META: Record<ProjectSummary['status'], { label: string; dot: string }> = {

  'In progress': { label: 'In progress', dot: '#8b6fd6' },

  Done: { label: 'Completed', dot: '#3f9a70' },

  Planning: { label: 'Planning', dot: '#c4892b' },

}



const PREVIEW_COUNT = 5



const percent = (done: number, total: number) => (total ? Math.min(100, Math.round((done / total) * 100)) : 0)



/** Tints a colour so it works on light and dark surfaces. */

const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`



const projectFocusRing =

  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'



function ProjectBar({

  value,

  label,

  color,

  className = 'h-1.5',

}: {

  value: number

  label: string

  color?: string

  className?: string

}) {

  const v = Math.min(100, Math.max(0, value))

  return (

    <div

      role="progressbar"

      aria-label={label}

      aria-valuenow={Math.round(v)}

      aria-valuemin={0}

      aria-valuemax={100}

      className={`overflow-hidden rounded-full bg-primary/10 ${className}`}

    >

      <div

        className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${

          color ? '' : 'bg-primary'

        }`}

        style={{ width: `${v}%`, background: color }}

      />

    </div>

  )

}



function ProjectRow({ project }: { project: ProjectSummary }) {

  const tint = PROJECT_TINTS[project.tint] ?? PROJECT_TINTS.lavender

  const Icon = FOLDER_ICONS[project.icon as IconKey] ?? FolderKanban

  const meta = STATUS_META[project.status]

  const pct = percent(project.done, project.total)

  const barColor = project.status === 'Done' ? STATUS_META.Done.dot : tint



  return (

    <li className="border-t border-soft first:border-t-0">

      <Link

        to={`/projects/${project.id}`}

        className={`group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-primary/[0.04] sm:gap-4 sm:px-5 focus-visible:-outline-offset-2 ${projectFocusRing}`}

      >

        <span

          aria-hidden="true"

          className="grid size-10 shrink-0 place-items-center rounded-xl"

          style={{ background: mix(tint, 14), color: tint }}

        >

          <Icon className="size-5" />

        </span>



        <div className="min-w-0 flex-1">

          <h3 className="truncate text-sm font-medium">{project.name}</h3>

          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-primary/60">

            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: meta.dot }} />

            {meta.label}

          </p>

          {project.total > 0 && (

            <ProjectBar

              value={pct}

              label={`${project.name}: ${pct}% complete`}

              color={barColor}

              className="mt-2.5 h-1 sm:hidden"

            />

          )}

        </div>



        {/* Desktop progress */}

        <div className="hidden w-48 shrink-0 sm:block">

          {project.total === 0 ? (

            <p className="text-right text-xs text-primary/50">No tasks yet</p>

          ) : (

            <>

              <div className="mb-1.5 flex justify-between text-xs text-primary/60 tabular-nums">

                <span>

                  {project.done} of {project.total} tasks

                </span>

                <span>{pct}%</span>

              </div>

              <ProjectBar value={pct} label={`${project.name}: ${pct}% complete`} color={barColor} />

            </>

          )}

        </div>



        {/* Mobile percentage */}

        <span className="text-xs text-primary/60 tabular-nums sm:hidden">{project.total ? `${pct}%` : '—'}</span>



        <ChevronRight

          aria-hidden="true"

          className="size-4 shrink-0 text-primary/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary/60 motion-reduce:transition-none"

        />

      </Link>

    </li>

  )

}



export function ProfileProjects({ projects }: { projects: ProjectSummary[] | null }) {

  const [filter, setFilter] = useState<ProjectFilter>('All')

  const [showAll, setShowAll] = useState(false)

  const list = useMemo(() => projects ?? [], [projects])
  console.log('list', list)



  const summary = useMemo(() => {

    const counts = { 'In progress': 0, Done: 0, Planning: 0 } as Record<ProjectSummary['status'], number>

    let done = 0

    let total = 0

    for (const project of list) {

      counts[project.status] += 1

      done += project.done

      total += project.total

    }

    return { counts, done, total, pct: percent(done, total) }

  }, [list])



  
const stages = useMemo(
  () => [
    {
      name: 'Total Tasks',
      value: list.reduce((sum, project) => sum + project.total, 0),
    },
    {
      name: 'Started Tasks',
      value: list.reduce(
        (sum, project) =>
          sum + Math.max(0, project.total - project.done === 0
            ? 0
            : project.total - project.done),
        0,
      ),
    },
    {
      name: 'Completed Tasks',
      value: list.reduce((sum, project) => sum + project.done, 0),
    },
  ],
  [list],
)


  const filtered = filter === 'All' ? list : list.filter((project) => project.status === filter)

  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_COUNT)



  const filters: { key: ProjectFilter; label: string; count: number }[] = [

    { key: 'All', label: 'All', count: list.length },

    { key: 'In progress', label: 'In progress', count: summary.counts['In progress'] },

    { key: 'Done', label: 'Completed', count: summary.counts.Done },

    { key: 'Planning', label: 'Planning', count: summary.counts.Planning },

  ]



  return (

    <section className="mt-9" aria-labelledby="profile-projects-title" aria-busy={!projects}>

      <div className="flex items-start justify-between gap-4">

        <div>

          <h2 id="profile-projects-title" className="text-xl font-semibold tracking-tight">

            Projects

          </h2>

          <p className="mt-1 text-sm text-primary/60">Task progress across everything you&apos;re working on.</p>

        </div>

        <span className="pt-1 text-sm whitespace-nowrap text-primary/60 tabular-nums">

          {list.length} {list.length === 1 ? 'project' : 'projects'}

        </span>

      </div>



      {projects ? (
        <div className="mt-5">
          <FunnelChartCard
            title="Project completion funnel"
            stages={stages}
            subtitle={`All time · ${summary.done} of ${summary.total} project tasks completed`}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-soft p-5 text-sm text-primary/60" role="status">
          Loading project progress…
        </div>
      )}

      {/* Overall progress + filters */}

      <div className="mt-5 rounded-2xl border border-soft p-5">

        <div className="flex items-baseline justify-between gap-4">

          <p className="text-sm text-primary/60">

            <span className="text-xl font-semibold text-primary tabular-nums">{summary.done.toLocaleString()}</span>{' '}

            of {summary.total.toLocaleString()} tasks done

          </p>

          <span className="text-sm font-medium tabular-nums">{summary.pct}%</span>

        </div>

        <ProjectBar

          value={summary.pct}

          label={`Overall ${summary.pct}% of project tasks complete`}

          className="mt-3 h-2"

        />



        <div role="group" aria-label="Filter projects" className="-mx-1 mt-5 flex gap-1 overflow-x-auto px-1 pb-1">

          {filters.map(({ key, label, count }) => (

            <button

              type="button"

              key={key}

              aria-pressed={filter === key}

              onClick={() => {

                setFilter(key)

                setShowAll(false)

              }}

              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${projectFocusRing} ${

                filter === key

                  ? 'bg-primary/10 font-medium text-primary'

                  : 'text-primary/60 hover:bg-primary/[0.05] hover:text-primary'

              }`}

            >

              {label}

              <span className="ml-1.5 text-xs text-primary/50 tabular-nums">{count}</span>

            </button>

          ))}

        </div>

      </div>



      {!projects && (

        <ul className="mt-4 overflow-hidden rounded-2xl border border-soft" aria-hidden="true">

          {[0, 1, 2].map((i) => (

            <li key={i} className="flex items-center gap-4 border-t border-soft px-5 py-4 first:border-t-0">

              <span className="size-10 animate-pulse rounded-xl bg-primary/10 motion-reduce:animate-none" />

              <span className="h-4 w-40 animate-pulse rounded bg-primary/10 motion-reduce:animate-none" />

            </li>

          ))}

        </ul>

      )}



      {projects && visible.length > 0 && (

        <ul className="mt-4 overflow-hidden rounded-2xl border border-soft">

          {visible.map((project) => (

            <ProjectRow key={project.id} project={project} />

          ))}

        </ul>

      )}



      {projects && visible.length === 0 && (

        <div className="mt-4 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-soft px-5 py-10 text-center">

          <span className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/[0.07] text-primary/70">

            <FolderKanban size={20} aria-hidden="true" />

          </span>

          <p className="text-sm font-medium">{list.length ? 'No projects in this category.' : 'No projects yet.'}</p>

          <p className="text-sm text-primary/60">

            {list.length ? 'Try a different filter.' : 'Create a workspace to group your tasks into a project.'}

          </p>

        </div>

      )}



      {filtered.length > PREVIEW_COUNT && (

        <button

          type="button"

          onClick={() => setShowAll((value) => !value)}

          className={`mx-auto mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-primary/70 transition-colors hover:bg-primary/[0.06] hover:text-primary ${projectFocusRing}`}

        >

          {showAll ? 'Show fewer' : `Show all ${filtered.length} projects`}

          <ChevronDown

            size={15}

            aria-hidden="true"

            className={`transition-transform motion-reduce:transition-none ${showAll ? 'rotate-180' : ''}`}

          />

        </button>

      )}

    </section>

  )

}