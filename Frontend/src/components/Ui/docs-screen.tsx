import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Copy, FileText, Menu, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAppDispatch, useAppSelector } from '../../store'
import { fetchDoc } from '../../store/slices/notesSlice'
import { DocsEditDialog, type DocEditTarget } from './docs-edit-dialog'
import { WorkDialog } from './work-dialog'
import type { Topic, Subtopic, Content } from '../../lib/docs-data'

export function DocsScreen({ editable = false }: { editable?: boolean }) {
  const { folderId } = useParams<{ folderId: string }>()
  if (!folderId) return <Navigate to="/notes" replace />
  return <DocumentContent key={folderId} folderId={folderId} editable={editable} />
}

function DocumentContent({ folderId, editable }: { folderId: string; editable: boolean }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useAppSelector(s => s.auth.user?.id)
  const doc = useAppSelector(s => s.notes.docs[folderId])
  const folder = useAppSelector(s => s.notes.folders.find(f => f.id === folderId))
  const { isPending, isFetching, error, refetch } = useQuery({ queryKey: ['document', userId, folderId], queryFn: () => dispatch(fetchDoc(folderId)).unwrap(), enabled: !!userId })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<DocEditTarget | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [activeToc, setActiveToc] = useState('')
  const anchor = location.hash.slice(1)
  const topics = doc?.topics ?? []
  const rows = useMemo(() => doc?.topics.flatMap(topic => topic.subtopics.map(subtopic => ({ topic, subtopic }))) ?? [], [doc])
  const anchorRow = rows.find(row => row.subtopic.id === anchor || row.subtopic.content.some(c => `content-${c.id}` === anchor))
  const topic = anchorRow?.topic ?? topics.find(t => t.id === anchor) ?? topics[0]
  const subtopic = anchorRow?.subtopic ?? topic?.subtopics[0]
  const content = subtopic?.content
  const index = rows.findIndex(row => row.subtopic.id === subtopic?.id)
  const previous = rows[index - 1]
  const next = index >= 0 ? rows[index + 1] : undefined
  const title = folder?.name ?? doc?.title ?? 'Documentation'

  const select = (id: string) => { navigate({ hash: `#${id}` }, { replace: true }); setMobileOpen(false) }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !editTarget) { event.preventDefault(); setSearchOpen(v => !v) }
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editTarget])
  useEffect(() => () => { if (copyTimeout.current) clearTimeout(copyTimeout.current) }, [])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const block = anchor.startsWith('content-') ? document.getElementById(anchor) : null
      if (block && mainRef.current) {
        mainRef.current.scrollTo({ top: mainRef.current.scrollTop + block.getBoundingClientRect().top - mainRef.current.getBoundingClientRect().top - 24, behavior: 'auto' })
        setActiveToc(anchor.replace('content-', ''))
      } else { mainRef.current?.scrollTo({ top: 0 }); setActiveToc(content?.[0]?.id ?? '') }
    })
    return () => cancelAnimationFrame(frame)
  }, [anchor, subtopic?.id, content])
  const updateToc = () => {
    const main = mainRef.current
    if (!main) return
    let active = content?.[0]?.id ?? ''
    for (const item of content ?? []) {
      const element = document.getElementById(`content-${item.id}`)
      if (element && element.getBoundingClientRect().top - main.getBoundingClientRect().top <= 120) active = item.id
    }
    setActiveToc(active)
  }
  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopied(null), 2000)
    } catch { toast.error('Could not copy. Please select and copy the text manually.') }
  }
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    const results: { topic: Topic; subtopic?: Subtopic; block?: Content }[] = []
    for (const topic of doc?.topics ?? []) {
      if (topic.title.toLowerCase().includes(query)) results.push({ topic })
      for (const subtopic of topic.subtopics) {
        if (`${subtopic.title} ${subtopic.description ?? ''}`.toLowerCase().includes(query)) results.push({ topic, subtopic })
        for (const block of subtopic.content) if (`${block.title} ${block.content}`.toLowerCase().includes(query)) results.push({ topic, subtopic, block })
      }
    }
    return results
  }, [doc, search])
  const openAdd = (kind: DocEditTarget['kind']) => setEditTarget({ kind, action: 'add', topicId: topic?.id, subtopicId: subtopic?.id })

  return <div className="work-surface docs-shell">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-soft px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button className="work-icon lg:hidden" aria-label="Open topics" aria-expanded={mobileOpen} aria-controls="docs-navigation" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
        <Link to="/notes" className="work-icon" aria-label="Back to notes"><ArrowLeft size={16} /></Link>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs text-secondary">{editable ? 'Workspace editor' : 'Document viewer'}</p></div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button className="work-button" onClick={() => setSearchOpen(true)} aria-label="Search documentation"><Search size={15} /><span className="hidden sm:inline">Search</span><kbd className="hidden text-xs text-secondary xl:inline">⌘ K</kbd></button>
        <Link className="work-button work-button--primary" to={`/notes/${folderId}${editable ? '' : '/edit'}${location.hash}`}>{editable ? <FileText size={14} /> : <Pencil size={14} />}<span>{editable ? 'View' : 'Edit'}</span></Link>
      </div>
    </header>
    <div className="relative flex min-h-0 flex-1">
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close topics overlay" />}
      <aside id="docs-navigation" className={`docs-sidebar ${mobileOpen ? 'docs-sidebar--open' : ''}`}>
        <div className="mb-4 flex items-center justify-between gap-2 px-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-secondary">Topics & sections</h2><div className="flex gap-1">{editable && doc && <button className="work-icon" aria-label="Add topic" onClick={() => openAdd('topic')}><Plus size={14} /></button>}<button className="work-icon lg:hidden" aria-label="Close topics" onClick={() => setMobileOpen(false)}><X size={14} /></button></div></div>
        <nav aria-label="Document topics" className="flex flex-col gap-3">
          {topics.map(item => <div key={item.id}>
            <div className="flex items-center gap-1"><button className="docs-topic min-w-0 flex-1" aria-current={topic?.id === item.id ? 'page' : undefined} onClick={() => select(item.id)}><FileText size={15} className="shrink-0" /><span className="truncate">{item.title}</span></button>{item.subtopics.length > 0 && <button className="work-icon" aria-label={`${collapsed[item.id] ? 'Expand' : 'Collapse'} ${item.title}`} aria-expanded={!collapsed[item.id]} onClick={() => setCollapsed(v => ({ ...v, [item.id]: !v[item.id] }))}>{collapsed[item.id] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button>}</div>
            {!collapsed[item.id] && <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-soft pl-2">{item.subtopics.map(section => <button key={section.id} className="docs-topic" aria-current={subtopic?.id === section.id ? 'page' : undefined} onClick={() => select(section.id)}><span className="truncate">{section.title}</span></button>)}</div>}
            {editable && topic?.id === item.id && <div className="mt-2 flex items-center gap-1 pl-2"><button className="work-icon" title="Add section" aria-label={`Add section to ${item.title}`} onClick={() => setEditTarget({ kind: 'subtopic', action: 'add', topicId: item.id })}><Plus size={13} /></button><button className="work-icon" aria-label={`Rename ${item.title}`} onClick={() => setEditTarget({ kind: 'topic', action: 'edit', topicId: item.id, title: item.title })}><Pencil size={13} /></button><button className="work-icon" aria-label={`Delete topic ${item.title}`} onClick={() => setEditTarget({ kind: 'topic', action: 'delete', topicId: item.id, title: item.title })}><Trash2 size={13} /></button></div>}
          </div>)}
          {!isPending && !topics.length && <p className="px-2 py-4 text-xs leading-relaxed text-secondary">No topics yet. {editable ? 'Add a topic to organize your documentation.' : 'Open the editor to get started.'}</p>}
        </nav>
      </aside>
      <main ref={mainRef} className="docs-reader" onScroll={updateToc}>
        <div className="docs-reader-inner">
          {error && <div role="alert" className="work-error mb-6 flex flex-wrap items-center justify-between gap-2"><span>Unable to load this document.</span><button className="work-button" onClick={() => void refetch()} disabled={isFetching}>Retry</button></div>}
          {isPending && !doc ? <p role="status" className="work-empty">Loading your document…</p> : doc && <>
            <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-secondary"><Link to="/notes">Notes</Link><ChevronRight size={12} /><span>{title}</span>{topic && <><ChevronRight size={12} /><button onClick={() => select(topic.id)}>{topic.title}</button></>}</nav>
            <header className="mb-8 border-b border-soft pb-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-widest text-secondary">{editable ? 'Workspace / Editor' : 'Knowledge / Documentation'}</p>
              <div className="flex flex-wrap items-start justify-between gap-4"><h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{subtopic?.title ?? topic?.title ?? title}</h1>
                {editable && subtopic && <div className="flex gap-2"><button className="work-icon" aria-label="Edit section" onClick={() => setEditTarget({ kind: 'subtopic', action: 'edit', topicId: topic.id, subtopicId: subtopic.id, title: subtopic.title, description: subtopic.description })}><Pencil size={14} /></button><button className="work-icon" aria-label="Delete section" onClick={() => setEditTarget({ kind: 'subtopic', action: 'delete', topicId: topic.id, subtopicId: subtopic.id, title: subtopic.title })}><Trash2 size={14} /></button></div>}
              </div>
              {(subtopic?.description || (!topic && doc.description)) && <p className="mt-4 max-w-2xl text-sm leading-7 text-secondary">{subtopic?.description ?? doc.description}</p>}
              {editable && <div className="mt-5 flex flex-wrap gap-2"><button className="work-button work-button--primary" onClick={() => openAdd(subtopic ? 'content' : topic ? 'subtopic' : 'topic')}><Plus size={14} />{subtopic ? 'Add content' : topic ? 'Add section' : 'Add topic'}</button>{topic && subtopic && <button className="work-button" onClick={() => openAdd('subtopic')}><Plus size={14} /> Add section</button>}</div>}
            </header>
            {content?.length ? <div className="flex flex-col gap-8">{content.map(block => <section className="docs-block" key={block.id} id={`content-${block.id}`}>
              <div className="mb-3 flex items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-semibold">{block.title}</h2>{editable && <div className="flex shrink-0 gap-1"><button className="work-icon" aria-label={`Edit ${block.title}`} onClick={() => setEditTarget({ kind: 'content', action: 'edit', topicId: topic.id, subtopicId: subtopic.id, content: block })}><Pencil size={13} /></button><button className="work-icon" aria-label={`Delete ${block.title}`} onClick={() => setEditTarget({ kind: 'content', action: 'delete', topicId: topic.id, subtopicId: subtopic.id, content: block })}><Trash2 size={13} /></button></div>}</div>
              {block.type === 'code' ? <div className="work-card overflow-hidden"><div className="work-stat flex items-center justify-between gap-2 border-b border-soft px-4 py-2"><span className="font-mono text-xs text-secondary">{block.language ?? 'text'}</span><button className="work-button" onClick={() => void copy(block.content, block.id)} aria-label={`Copy ${block.title}`}>{copied === block.id ? <Check size={13} /> : <Copy size={13} />}{copied === block.id ? 'Copied' : 'Copy'}</button></div><pre className="overflow-x-auto p-4 text-sm leading-7"><code>{block.content}</code></pre></div> : <p className="whitespace-pre-wrap break-words text-sm leading-7 text-secondary">{block.content}</p>}
            </section>)}</div> : <div className="work-card flex flex-col items-center gap-3 px-5 py-12 text-center"><FileText size={28} className="text-secondary" /><h2 className="text-base font-medium">{topic ? 'Make room for your ideas' : 'Your documentation starts here'}</h2><p className="max-w-sm text-sm leading-relaxed text-secondary">{editable ? topic ? 'Add a section, then fill it with notes and code.' : 'Create your first topic to organize what you know.' : 'This document has no content here yet. Open the editor to add some.'}</p>{!editable && <Link className="work-button" to={`/notes/${folderId}/edit${location.hash}`}><Pencil size={14} /> Open editor</Link>}</div>}
            {(previous || next) && <nav aria-label="Previous and next sections" className="mt-10 grid gap-3 border-t border-soft pt-6 sm:grid-cols-2">{previous ? <button className="work-card flex min-w-0 flex-col gap-2 p-4 text-left" onClick={() => select(previous.subtopic.id)}><span className="flex items-center gap-2 text-xs text-secondary"><ArrowLeft size={13} /> Previous</span><span className="w-full truncate text-sm">{previous.subtopic.title}</span></button> : <div />}{next && <button className="work-card flex min-w-0 flex-col items-end gap-2 p-4 text-right" onClick={() => select(next.subtopic.id)}><span className="flex items-center gap-2 text-xs text-secondary">Next <ArrowRight size={13} /></span><span className="w-full truncate text-sm">{next.subtopic.title}</span></button>}</nav>}
          </>}
        </div>
      </main>
      <aside className="hidden w-52 shrink-0 overflow-y-auto border-l border-soft p-5 xl:block"><h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-secondary">On this page</h2><nav aria-label="On this page" className="flex flex-col gap-1">{content?.map(block => <button key={block.id} className="docs-topic" aria-current={activeToc === block.id ? 'page' : undefined} onClick={() => select(`content-${block.id}`)}><span className="truncate">{block.title}</span></button>)}</nav>{!content?.length && <p className="text-xs text-secondary">Sections will appear here.</p>}</aside>
    </div>
    {searchOpen && <WorkDialog title="Search documentation" onClose={() => { setSearchOpen(false); setSearch('') }}><div className="flex flex-col gap-4"><label className="work-field">Search this document<input autoFocus type="search" className="work-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Topics, sections, or content…" /></label><p role="status" className="text-xs text-secondary">{search.trim() ? `${searchResults.length} results` : 'Type to search your documentation.'}</p><div className="flex max-h-80 flex-col gap-1 overflow-y-auto">{searchResults.map((result, i) => <button key={`${result.topic.id}-${i}`} className="docs-topic flex-col items-start" onClick={() => { select(result.block ? `content-${result.block.id}` : result.subtopic?.id ?? result.topic.id); setSearchOpen(false); setSearch('') }}><span className="text-xs text-secondary">{result.topic.title}{result.subtopic && ` / ${result.subtopic.title}`}</span><span className="text-sm font-medium text-primary">{result.block?.title ?? result.subtopic?.title ?? result.topic.title}</span></button>)}</div></div></WorkDialog>}
    {editTarget && editable && <DocsEditDialog folderId={folderId} target={editTarget} onClose={() => setEditTarget(null)} onSelect={select} />}
  </div>
}
