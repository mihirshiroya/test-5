import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  FolderOpen,
  Grid2X2,
  Home,
  KanbanSquare,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Plus,
  CalendarDays,
  Settings,
  Trash2,
  X,
  LogOut
} from 'lucide-react'
import { cn } from '../lib/utills'
import ThemeSwitcher from './ThemeSwitcher'
import logo from '../assets/logo.png'
import {
  ProjectDialog,
  type ProjectDraft,
} from '../components/Ui/project-dialog'
import {
  FOLDER_TINTS,
  FOLDER_ICONS,
  type TintKey,
  type IconKey,
} from '../components/Ui/project-data'
import { useWorkspaceStore } from '../store/slices/taskSlice.tsx'
import { logoutUser } from '../store/slices/authSlice'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '../store'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ProjectItem = {
  id: string
  label: string
  path: string
  tint: TintKey
  icon: IconKey
}

/* -------------------------------------------------------------------------- */
/* Static navigation                                                          */
/* -------------------------------------------------------------------------- */

const folders = [
  { label: 'Product launch', count: 12, color: 'bg-sky-500' },
  { label: 'Research', count: 8, color: 'bg-violet-500' },
  { label: 'Personal', count: 4, color: 'bg-amber-500' },
]

const outletItems = [
  { label: 'Overview', path: '/overview', icon: Home },
  { label: 'Notes', path: '/Notes', icon: FolderOpen },
  { label: 'Calender', path: '/Calender', icon: CalendarDays },
  { label: 'Session', path: '/session', icon: Grid2X2 },
  { label: 'Kanban', path: '/kanban', icon: KanbanSquare },
]

/**
 * Workspaces now come from the backend, so there are no built-in defaults.
 * Kept as an (empty) export so existing imports don't break.
 */
const defaultProjects: ProjectItem[] = []

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const SIDEBAR_COLLAPSED_KEY = 'consistent-sidebar-collapsed'

const DEFAULT_APPEARANCE = {
  tint: 'lavender' as TintKey,
  icon: 'folder' as IconKey,
}

const getInitialCollapsed = (): boolean => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* App Sidebar                                                                */
/* -------------------------------------------------------------------------- */

function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  /* ------------------------------------------------------------------------ */
  /* Backend data                                                             */
  /* ------------------------------------------------------------------------ */

  const {
    workspaces,
    error,
    clearError,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
  } = useWorkspaceStore()

  /* ------------------------------------------------------------------------ */
  /* UI state                                                                 */
  /* ------------------------------------------------------------------------ */

  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const [query] = useState('')
  const [notifications, setNotifications] = useState(3)
  const [profileOpen, setProfileOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [projectDialog, setProjectDialog] = useState<{
    mode: 'create' | 'edit'
    project?: ProjectItem
  } | null>(null)

  const [deleteProject, setDeleteProject] = useState<ProjectItem | null>(null)

  /* ------------------------------------------------------------------------ */
  /* Error toast (auto dismiss)                                               */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(clearError, 5000)
    return () => window.clearTimeout(timer)
  }, [error, clearError])

  /* ------------------------------------------------------------------------ */
  /* Projects = backend workspaces                                            */
  /* ------------------------------------------------------------------------ */

  const projects = useMemo<ProjectItem[]>(
    () =>
      (workspaces ?? []).map((workspace) => ({
        id: workspace.id,
        label: workspace.name,
        path: `/projects/${workspace.id}`,
        tint: workspace.tint ?? DEFAULT_APPEARANCE.tint,
        icon: workspace.icon ?? DEFAULT_APPEARANCE.icon,
      })),
    [workspaces],
  )

  /* ------------------------------------------------------------------------ */
  /* Toggle collapse                                                          */
  /* ------------------------------------------------------------------------ */

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous

      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // Ignore localStorage errors.
      }

      return next
    })
  }

  /* ------------------------------------------------------------------------ */
  /* Navigation                                                               */
  /* ------------------------------------------------------------------------ */

  const go = (path: string) => {
    navigate(path)
    setMobileOpen(false)
  }

  /* ------------------------------------------------------------------------ */
  /* Current breadcrumb                                                       */
  /* ------------------------------------------------------------------------ */

  const current = useMemo(() => {
    const allItems = [
      ...outletItems,
      ...projects.map((project) => ({
        label: project.label,
        path: project.path,
      })),
      { label: 'Profile', path: '/profile' },
    ]

    const exactMatch = allItems.find(
      (item) => location.pathname === item.path,
    )

    if (exactMatch) return exactMatch

    const projectMatch = projects.find((project) =>
      location.pathname.startsWith(`${project.path}/`),
    )

    if (projectMatch) {
      return { label: projectMatch.label, path: projectMatch.path }
    }

    return { label: 'Overview', path: '/overview' }
  }, [location.pathname, projects])

  /* ------------------------------------------------------------------------ */
  /* Filter projects                                                          */
  /* ------------------------------------------------------------------------ */

  const filteredProjects = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return projects
    return projects.filter((project) =>
      project.label.toLowerCase().includes(search),
    )
  }, [projects, query])

  /* ------------------------------------------------------------------------ */
  /* Navigation classes                                                       */
  /* ------------------------------------------------------------------------ */

  const hideWhenCollapsed = collapsed ? 'lg:hidden' : ''

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium my-1 transition-colors',
      collapsed && 'lg:justify-center lg:px-0',
      isActive
        ? 'bg-[var(--color-nav-active-bg)] font-semibold text-[var(--color-nav-active-text)]'
        : 'hover:bg-[var(--color-nav-hover-bg)] hover:text-[var(--color-nav-hover-text)] text-secondary',
    )

  const iconClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'size-[18px] shrink-0 transition-colors',
      isActive
        ? 'stroke-2 stroke-[var(--color-nav-active-text)]'
        : 'stroke-1 stroke-[var(--color-nav-hover-text)]',
    )

  const titleClass = cn('min-w-0 flex-1 truncate text-left', hideWhenCollapsed)

  const workspaceIconClass = cn('grid size-6 shrink-0 place-items-center rounded-md')

  const workspaceTitleClass = cn(
    'min-w-0 flex-1 truncate text-left',
    collapsed && 'md:hidden',
  )

  /* ------------------------------------------------------------------------ */
  /* Create / edit workspace (backend)                                        */
  /* ------------------------------------------------------------------------ */

  const handleProjectDialogSubmit = async (draft: ProjectDraft) => {
    if (saving) return

    const name = draft.name.trim()
    if (!name) return

    const editingProject = projectDialog?.project

    const duplicateName = projects.some(
      (project) =>
        project.id !== editingProject?.id &&
        project.label.trim().toLowerCase() === name.toLowerCase(),
    )
    if (duplicateName) return

    setSaving(true)
    try {
      if (projectDialog?.mode === 'edit' && editingProject) {
        // FIX: removed the early `return` that escaped the try block and
        // therefore never reached the `finally` clause — saving stayed true
        // and the dialog button remained permanently disabled after a
        // successful edit.
        const ok = await updateWorkspace(editingProject.id, {
          name,
          tint: draft.tint,
          icon: draft.icon,
        })
        if (ok) setProjectDialog(null)
        return   // still return early — but saving is reset in finally below
      }

      const created = await addWorkspace({
        name,
        tint: draft.tint,
        icon: draft.icon,
      })

      if (created) {
        setProjectDialog(null)
        go(`/projects/${created.id}`)
      }
    } finally {
      // This always runs whether we returned early (edit path) or fell through
      // (create path), so the button is never left stuck in a disabled state.
      setSaving(false)
    }
  }

  const handleEditClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    project: ProjectItem,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setProjectDialog({ mode: 'edit', project })
  }

  const handleDeleteClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    project: ProjectItem,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setDeleteProject(project)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteProject || saving) return

    const project = deleteProject
    setSaving(true)

    try {
      const ok = await deleteWorkspace(project.id)

      if (!ok) return

      setDeleteProject(null)

      if (
        location.pathname === project.path ||
        location.pathname.startsWith(`${project.path}/`)
      ) {
        go('/overview')
      }
    } finally {
      setSaving(false)
    }
  }
  const dispatch = useDispatch<AppDispatch>()
  const handleLogout = async () => {
  try {
    await dispatch(logoutUser(false)).unwrap()

    setProfileOpen(false)
    setMobileOpen(false)
    navigate('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-sidebar text-foreground">
      {/* Error toast */}
      {error && (
        <div
          role="alert"
          className="fixed right-4 top-4 z-[60] flex max-w-sm items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={clearError}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div
        className={cn(
          'grid h-screen overflow-hidden transition-[grid-template-columns] duration-300 ease-in-out',
          collapsed
            ? 'md:grid-cols-[68px_minmax(0,1fr)]'
            : 'md:grid-cols-[240px_minmax(0,1fr)]',
        )}
      >
        {/* ================================================================== */}
        {/* Sidebar                                                            */}
        {/* ================================================================== */}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 flex h-screen w-[248px] max-w-[85vw] flex-col border-r border-soft bg-[var(--sidebar-bg)]',
            'transition-transform duration-300 ease-in-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            'md:relative md:inset-auto md:z-auto md:h-screen md:w-full md:max-w-none md:translate-x-0',
          )}
        >
          {/* Logo header */}
          <div className="flex items-center gap-2 p-3">
            <button
              type="button"
              onClick={() => go('/')}
              className={cn(
                'group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-accent',
                collapsed && 'md:justify-center',
              )}
            >
              <img src={logo} alt="Consistent" className="size-7 shrink-0" />

              <span
                className={cn(
                  'flex min-w-0 flex-1 flex-col justify-end',
                  hideWhenCollapsed,
                )}
              >
                <span className="truncate text-lg font-semibold text-foreground">
                  Consistent
                </span>
              </span>
            </button>

            {/* Desktop collapse */}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              className={cn(
                'hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex',
                collapsed && 'md:hidden',
              )}
            >
              <PanelLeftClose className="size-[18px] text-secondary" />
            </button>

            {/* Mobile close */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            >
              <X className="size-[18px]" />
            </button>
          </div>

          {/* Desktop expand toggle */}
          {collapsed && (
            <div className="hidden justify-center px-3 pb-1 md:flex">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Expand sidebar"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PanelLeft className="size-[18px] text-secondary" />
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav
            className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar"
            aria-label="Main navigation"
          >
            {/* Main navigation */}
            <ul className="mb-4 flex flex-col gap-0.5">
              {outletItems.map(({ label, path, icon: Icon }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? label : undefined}
                    className={linkClass}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={iconClass({ isActive })} />
                        <span className={titleClass}>{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="border-[0.5px] border-soft border-dotted" />

            {/* Workspaces header */}
            <div
              className={cn(
                'mt-4 mb-2 flex items-center justify-between px-2',
                collapsed && 'md:justify-center md:px-0',
              )}
            >
              <span
                className={cn('text-sm font-semibold', collapsed && 'md:hidden')}
              >
                Workspaces
              </span>

              <button
                type="button"
                aria-label="Create project"
                title="Create project"
                onClick={() => setProjectDialog({ mode: 'create' })}
                className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5 stroke-2" />
              </button>
            </div>

            {/* Workspace list */}
            <ul className="flex flex-col gap-0.5">
              {filteredProjects.map((project) => {
                const ProjectIcon =
                  FOLDER_ICONS[project.icon] ??
                  FOLDER_ICONS[DEFAULT_APPEARANCE.icon]
                const tint =
                  FOLDER_TINTS[project.tint] ??
                  FOLDER_TINTS[DEFAULT_APPEARANCE.tint]

                return (
                  <li key={project.id}>
                    <NavLink
                      to={project.path}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? project.label : undefined}
                      className={linkClass}
                      style={({ isActive }) => ({
                        color: isActive ? tint.fg : undefined,
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <span className={workspaceIconClass}>
                            <ProjectIcon className={iconClass({ isActive })} />
                          </span>

                          <span
                            className={cn(
                              workspaceTitleClass,
                              isActive ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            {project.label}
                          </span>

                          {/* Edit / Delete */}
                          <span
                            className={cn(
                              'hidden shrink-0 items-center gap-0.5 group-hover:flex',
                              collapsed && '!hidden',
                            )}
                          >
                            <button
                              type="button"
                              aria-label={`Edit ${project.label}`}
                              onClick={(event) => handleEditClick(event, project)}
                              className="grid size-6 place-items-center rounded-md text-primary transition-colors hover:bg-accent hover:!text-foreground"
                            >
                              <Pencil className="size-3.5" />
                            </button>

                            <button
                              type="button"
                              aria-label={`Delete ${project.label}`}
                              onClick={(event) => handleDeleteClick(event, project)}
                              className="grid size-6 place-items-center rounded-md text-red-500 transition-colors hover:bg-destructive/10 hover:!text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </span>
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-20 bg-background/70 md:hidden"
          />
        )}

        {/* ================================================================== */}
        {/* Main content                                                       */}
        {/* ================================================================== */}

        <div className="min-h-0 min-w-0 flex flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-soft border-border px-5 sm:px-8">
            {/* Left */}
            <div className="flex items-center gap-3">
              <button
                aria-label="Open sidebar"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent md:hidden"
              >
                <Menu className="size-5" />
              </button>

              <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                <span className="hidden sm:inline">Workspace</span>
                <ChevronRight className="hidden size-4 sm:inline" />
                <span className="text-primary">{current.label}</span>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              <ThemeSwitcher />

              <button
                aria-label="Notifications"
                onClick={() => setNotifications(0)}
                className="relative grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Bell className="size-[18px]" />

                {notifications > 0 && (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
                )}
              </button>

              <div className="relative">
                <button
                  aria-label="Open profile menu"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="ml-2 grid size-8 place-items-center rounded-full bg-background-inverse text-xs font-semibold text-inverse"
                >
                  AM
                </button>

              {profileOpen && (
  <div className="absolute right-0 top-10 z-40 w-48 rounded-lg border border-border bg-popover p-1 text-sm shadow-lg">
    <button
      type="button"
      onClick={() => {
        setProfileOpen(false)
        go('/profile')
      }}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent"
    >
      <Settings className="size-4" />
      Account settings
    </button>

    <div className="my-1 border-t border-border" />

    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-red-500 hover:bg-red-500/10"
    >
      <LogOut className="size-4" />
      Logout
    </button>
  </div>
)}
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
            <Outlet />
          </main>
        </div>

        {/* Create / Edit workspace dialog */}
        <ProjectDialog
          open={projectDialog !== null}
          mode={projectDialog?.mode ?? 'create'}
          initial={projectDialog?.project}
          onClose={() => setProjectDialog(null)}
          onSubmit={handleProjectDialogSubmit}
        />

        {/* Delete workspace modal */}
        {deleteProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setDeleteProject(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-project-title"
              aria-describedby="delete-project-desc"
              className="relative w-full max-w-md border border-soft bg-canvas p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2
                    id="delete-project-title"
                    className="text-lg font-semibold text-ink"
                  >
                    Delete workspace
                  </h2>

                  <p id="delete-project-desc" className="mt-0.5 text-sm text-steel">
                    This action cannot be undone. All tasks in this workspace will
                    be deleted too.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleteProject(null)}
                  aria-label="Close"
                  className="flex size-8 items-center justify-center rounded-lg text-steel transition-colors hover:bg-gray-tint hover:text-ink"
                >
                  <X className="size-[18px]" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'rgb(var(--color-card-tint-red))' }}
                >
                  <Trash2 className="text-danger" size={20} aria-hidden="true" />
                </div>

                <p className="text-sm text-steel">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-ink">
                    "{deleteProject.label}"
                  </span>
                  ?
                </p>
              </div>

              <div className="mt-7 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setDeleteProject(null)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={handleDeleteConfirm}
                >
                  Delete workspace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export {
  AppSidebar,
  outletItems,
  folders,
  defaultProjects,
}