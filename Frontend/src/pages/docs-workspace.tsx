import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Menu,
  Plus,
  Search,
  Trash2,
  X,
  Copy,
  Check,
  Terminal,
  ArrowRight,
  ArrowLeft,
  AlignLeft,
  Home,
} from 'lucide-react'

import {
  fetchDoc,
  setDoc,
  addSubtopic,
  addContent,
  type NotesState,
  type StoredFolder,
} from '../store/slices/notesSlice.ts'

import type { Doc, Topic, Subtopic, Content } from '../lib/docs-data'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type RootState = {
  notes: NotesState
}

type DeleteModalState = {
  type: 'topic' | 'subtopic' | 'content'
  id: string
  title: string
  parentTopicId?: string
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return Math.random().toString(36).slice(2, 11)
}

const humanize = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()

const looksLikeGeneratedId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  ) ||
  /^c[a-z0-9]{20,}$/i.test(value) ||
  /^[0-9a-f]{20,}$/i.test(value) ||
  /^\d+$/.test(value)

const getFolderName = (folder?: StoredFolder | null): string => {
  if (!folder) return ''

  const source = folder as StoredFolder & {
    title?: string
    label?: string
  }

  return String(source.name ?? source.title ?? source.label ?? '').trim()
}

const getLanguageKey = (label: string) => {
  const key = label.toLowerCase().replace(/[^a-z0-9+#]/g, '')

  if (key === 'react' || key === 'reactjs') return 'tsx'

  return key || 'text'
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function DocsWorkspace() {
  const { folderId } = useParams<{
    folderId: string
  }>()

  if (!folderId) {
    return <Navigate to="/notes" replace />
  }

  return <DocsWorkspaceContent folderId={folderId} />
}

// -----------------------------------------------------------------------------
// Workspace content
// -----------------------------------------------------------------------------

function DocsWorkspaceContent({ folderId }: { folderId: string }) {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(fetchDoc(folderId))
  }, [dispatch, folderId])

  const mainScrollRef = useRef<HTMLElement | null>(null)

  const folders = useSelector((state: RootState) => state.notes.folders)
  const reduxDoc = useSelector((state: RootState) => state.notes.docs[folderId])
  const folder = folders.find((item) => String(item.id) === folderId)

  const folderName = getFolderName(folder)

  const label = useMemo(() => {
    if (folderName) return folderName
    return looksLikeGeneratedId(folderId) ? 'Documentation' : humanize(folderId)
  }, [folderName, folderId])

  const languageKey = getLanguageKey(label)

  const fallbackDoc = useMemo<Doc>(
    () => ({
      id: folderId,
      title: `${label} Documentation`,
      description:
        'Your documentation workspace is ready. Add topics and content to get started.',
      topics: [],
    }),
    [folderId, label]
  )

  const doc = reduxDoc ?? fallbackDoc

  const meta = useMemo(
    () => ({
      label,
      color: folder?.tint ?? 'indigo',
      emoji: '·',
    }),
    [label, folder?.tint]
  )

  const [topicId, setTopicId] = useState(doc.topics[0]?.id ?? '')
  const [subtopicId, setSubtopicId] = useState(doc.topics[0]?.subtopics[0]?.id ?? '')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(doc.topics.map((topic) => [topic.id, true]))
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [modal, setModal] = useState<'topic' | 'subtopic' | 'content' | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentType, setContentType] = useState<'text' | 'code'>('text')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTocId, setActiveTocId] = useState<string | null>(null)

  useEffect(() => {
    const firstTopic = doc.topics[0]
    const selectedTopic = doc.topics.find((topic) => topic.id === topicId) ?? firstTopic
    const selectedSubtopic = selectedTopic?.subtopics.find((subtopic) => subtopic.id === subtopicId) ?? selectedTopic?.subtopics[0]

    const nextTopicId = selectedTopic?.id ?? ''
    const nextSubtopicId = selectedSubtopic?.id ?? ''

    if (topicId !== nextTopicId) setTopicId(nextTopicId)
    if (subtopicId !== nextSubtopicId) setSubtopicId(nextSubtopicId)

    setExpanded((previous) => {
      let changed = false
      const next = { ...previous }
      doc.topics.forEach((topic) => {
        if (typeof next[topic.id] === 'undefined') {
          next[topic.id] = true
          changed = true
        }
      })
      return changed ? next : previous
    })
  }, [doc])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((previous) => !previous)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setModal(null)
        setDeleteModal(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const topic = doc.topics.find((item) => item.id === topicId) ?? doc.topics[0]
  const subtopic = topic?.subtopics.find((item) => item.id === subtopicId) ?? topic?.subtopics[0]
  const toc = subtopic?.content ?? []

  useEffect(() => {
    setActiveTocId(toc[0]?.id ?? null)
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [subtopic?.id])

  const handleMainScroll = () => {
    const container = mainScrollRef.current
    if (!container || !toc.length) return
    const containerRect = container.getBoundingClientRect()
    const activationOffset = 100
    let currentId = toc[0]?.id ?? null

    for (const item of toc) {
      const element = document.getElementById(`content-${item.id}`)
      if (!element) continue
      const elementRect = element.getBoundingClientRect()
      const relativeTop = elementRect.top - containerRect.top
      if (relativeTop <= activationOffset) {
        currentId = item.id
      }
    }
    setActiveTocId((previous) => (previous === currentId ? previous : currentId))
  }

  const allSubtopics = useMemo(() => {
    const list: { topic: Topic; subtopic: Subtopic }[] = []
    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        list.push({ topic: currentTopic, subtopic: currentSubtopic })
      })
    })
    return list
  }, [doc])

  const currentIndex = allSubtopics.findIndex(
    (item) => item.topic.id === topic?.id && item.subtopic.id === subtopic?.id
  )
  const prevSubtopic = currentIndex > 0 ? allSubtopics[currentIndex - 1] : null
  const nextSubtopic = currentIndex >= 0 && currentIndex < allSubtopics.length - 1 ? allSubtopics[currentIndex + 1] : null

  const select = (nextTopic: Topic, nextSubtopic?: Subtopic) => {
    const targetSubtopic = nextSubtopic ?? nextTopic.subtopics[0]
    setTopicId(nextTopic.id)
    setSubtopicId(targetSubtopic?.id ?? '')
    setExpanded((previous) => ({ ...previous, [nextTopic.id]: true }))
    setMobileOpen(false)
    setActiveTocId(targetSubtopic?.content?.[0]?.id ?? null)

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${targetSubtopic?.id ?? nextTopic.id}`)
    }
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  const scrollTo = (id: string) => {
    const container = mainScrollRef.current
    const element = document.getElementById(`content-${id}`)
    if (!container || !element) return
    setActiveTocId(id)
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const targetTop = container.scrollTop + (elementRect.top - containerRect.top) - 24
    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    window.history.replaceState(null, '', `#content-${id}`)
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const resetModal = () => {
    setModal(null)
    setTitle('')
    setContent('')
    setContentType('text')
  }

  const add = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const cleanTitle = title.trim()
    const cleanContent = content.trim()
    if (!modal || !cleanTitle || (modal === 'content' && !cleanContent)) return

    if (modal === 'topic') {
      const newTopic: Topic = { id: createId(), title: cleanTitle, subtopics: [] }
      dispatch(setDoc({ folderId, doc: { ...doc, topics: [...doc.topics, newTopic] } }))
      setTopicId(newTopic.id)
      setSubtopicId('')
      setExpanded((previous) => ({ ...previous, [newTopic.id]: true }))
      resetModal()
      return
    }

    if (modal === 'subtopic' && topic) {
      dispatch(addSubtopic({ folderId, topicId: topic.id, title: cleanTitle, description: 'Recently added section. Click Add Content to populate.' }))
      setExpanded((previous) => ({ ...previous, [topic.id]: true }))
      resetModal()
      return
    }

    if (modal === 'content' && topic && subtopic) {
      dispatch(addContent({
        folderId, topicId: topic.id, subtopicId: subtopic.id,
        content: { title: cleanTitle, type: contentType, content: cleanContent, ...(contentType === 'code' ? { language: languageKey } : {}) }
      }))
      resetModal()
    }
  }

  const deleteTopic = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const target = doc.topics.find((item) => item.id === id)
    if (target) setDeleteModal({ type: 'topic', id, title: target.title })
  }

  const deleteSubtopic = (parentTopic: Topic, id: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const target = parentTopic.subtopics.find((item) => item.id === id)
    if (target) setDeleteModal({ type: 'subtopic', id, title: target.title, parentTopicId: parentTopic.id })
  }

  const deleteContent = (contentId: string) => {
    if (!topic || !subtopic) return
    const target = subtopic.content.find((item) => item.id === contentId)
    if (target) setDeleteModal({ type: 'content', id: contentId, title: target.title, parentTopicId: topic.id })
  }

  const confirmDelete = () => {
    if (!deleteModal) return
    if (deleteModal.type === 'topic') {
      const remainingTopics = doc.topics.filter((item) => item.id !== deleteModal.id)
      dispatch(setDoc({ folderId, doc: { ...doc, topics: remainingTopics } }))
      if (deleteModal.id === topicId) {
        if (remainingTopics[0]) {
          select(remainingTopics[0])
        } else {
          setTopicId('')
          setSubtopicId('')
          setActiveTocId(null)
        }
      }
    }
    if (deleteModal.type === 'subtopic') {
      const parentTopic = doc.topics.find((item) => item.id === deleteModal.parentTopicId)
      if (parentTopic) {
        const remainingSubtopics = parentTopic.subtopics.filter((item) => item.id !== deleteModal.id)
        dispatch(setDoc({ folderId, doc: { ...doc, topics: doc.topics.map(t => t.id === parentTopic.id ? { ...t, subtopics: remainingSubtopics } : t) } }))
        if (deleteModal.id === subtopicId && remainingSubtopics[0]) {
          select(parentTopic, remainingSubtopics[0])
        }
      }
    }
    if (deleteModal.type === 'content' && topic && subtopic) {
      dispatch(setDoc({
        folderId, doc: { ...doc, topics: doc.topics.map(t => t.id !== topic.id ? t : { ...t, subtopics: t.subtopics.map(s => s.id !== subtopic.id ? s : { ...s, content: s.content.filter(c => c.id !== deleteModal.id) }) }) }
      }))
    }
    setDeleteModal(null)
  }

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    const results: { topic: Topic; subtopic: Subtopic; contentItem?: Content }[] = []
    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        if (currentSubtopic.title.toLowerCase().includes(query) || currentSubtopic.description?.toLowerCase().includes(query)) {
          results.push({ topic: currentTopic, subtopic: currentSubtopic })
        }
        currentSubtopic.content.forEach((contentItem) => {
          if (contentItem.title.toLowerCase().includes(query) || contentItem.content.toLowerCase().includes(query)) {
            results.push({ topic: currentTopic, subtopic: currentSubtopic, contentItem })
          }
        })
      })
    })
    return results
  }, [searchQuery, doc])

  const codePlaceholder = languageKey === 'python' ? `def my_function():\n    print("Hello from Python!")`
    : languageKey === 'javascript' || languageKey === 'typescript' ? `function myFunction() {\n  console.log("Hello!");\n}`
      : languageKey === 'tsx' ? `function MyComponent() {\n  return <div>Hello!</div>;\n}`
        : `public void myMethod() {\n    System.out.println("Hello!");\n}`

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------
  const sidebar = (
    <aside
      className={`${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-50 flex w-80 shadow-2xl animate-in slide-in-from-left duration-200'
          : 'hidden'
      } h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-black/80 backdrop-blur-xl md:sticky md:top-0 md:flex md:w-72 lg:w-80`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-[2px]">
            <div className="size-2 bg-lime-400"></div>
            <div className="size-2 bg-lime-400"></div>
            <div className="size-2 bg-lime-400"></div>
            <div className="size-2 bg-lime-400"></div>
          </div>
          <div className="text-sm font-bold tracking-tight text-white">
            forma. <span className="font-mono text-[10px] font-normal text-zinc-500 uppercase">UI / 001</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:text-white md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-6">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
          / Topics & Sections
        </span>
        <button
          type="button"
          onClick={() => setModal('topic')}
          className="text-lime-400 transition-colors hover:text-lime-300"
          aria-label="Add topic"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-2">
        {doc.topics.map((item, index) => {
          const isExpanded = Boolean(expanded[item.id])
          const isCurrentTopic = topic?.id === item.id
          const hasSubtopics = item.subtopics.length > 0

          return (
            <div key={item.id} className="group">
              <div
                className={`relative flex items-center border-l-2 transition-all duration-200 ${
                  isCurrentTopic
                    ? 'border-lime-400 bg-zinc-900/50'
                    : 'border-transparent hover:bg-zinc-900/30'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpanded((previous) => ({ ...previous, [item.id]: !previous[item.id] }))
                    if (item.subtopics[0]) {
                      select(item, item.subtopics[0])
                    } else {
                      setTopicId(item.id)
                      setSubtopicId('')
                    }
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center font-mono text-[10px] font-semibold transition-colors ${
                      isCurrentTopic
                        ? 'bg-lime-400 text-black'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-xs ${
                      isCurrentTopic
                        ? 'font-medium text-white'
                        : 'font-normal text-zinc-400'
                    }`}
                  >
                    {item.title}
                  </span>
                </button>

                <div className="flex shrink-0 items-center pr-2">
                  <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setModal('subtopic')
                        setTopicId(item.id)
                        setSubtopicId(item.subtopics[0]?.id ?? '')
                      }}
                      className="flex size-6 items-center justify-center text-zinc-500 transition-colors hover:text-lime-400"
                    >
                      <Plus className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => deleteTopic(item.id, event)}
                      className="flex size-6 items-center justify-center text-zinc-500 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>

                  {hasSubtopics && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setExpanded((previous) => ({ ...previous, [item.id]: !previous[item.id] }))
                      }}
                      className="ml-1 flex size-6 shrink-0 items-center justify-center text-zinc-500 hover:text-white"
                    >
                      {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && hasSubtopics && (
                <div className="relative mb-2 ml-7 mt-1 border-l border-zinc-800">
                  <div className="space-y-0.5">
                    {item.subtopics.map((child) => {
                      const isSelected = subtopic?.id === child.id
                      return (
                        <div key={child.id} className="group/subtopic relative flex min-w-0 items-center">
                          <div
                            className={`relative flex min-w-0 flex-1 items-center transition-all duration-150 ${
                              isSelected
                                ? 'text-lime-400'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {isSelected && (
                              <span className="absolute -left-[1px] top-1/2 h-4 w-[2px] -translate-y-1/2 bg-lime-400" />
                            )}
                            <button
                              type="button"
                              onClick={() => select(item, child)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left"
                            >
                              <span className="min-w-0 flex-1 truncate text-xs font-mono tracking-wide">
                                {child.title}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(event) => deleteSubtopic(item, child.id, event)}
                              className="mr-2 flex size-5 shrink-0 items-center justify-center text-zinc-600 opacity-0 transition-all hover:text-red-500 group-hover/subtopic:opacity-100"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {doc.topics.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-600 font-mono">
            / NO TOPICS CREATED
          </p>
        )}
      </nav>
    </aside>
  )

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-black font-sans text-white selection:bg-lime-500/30 selection:text-lime-200">
      {/* Background Grid */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>

      {/* Header */}
      <header className="relative z-[50] flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 bg-black/50 px-4 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:text-white md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="grid grid-cols-2 gap-[2px]">
              <div className="size-2 bg-lime-400"></div>
              <div className="size-2 bg-lime-400"></div>
              <div className="size-2 bg-lime-400"></div>
              <div className="size-2 bg-lime-400"></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-tight text-white">
                forma.
              </span>
              <span className="font-mono text-[10px] font-normal uppercase tracking-widest text-zinc-500">
                UI / 001
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-6 font-mono text-[10px] uppercase tracking-widest text-zinc-500 md:flex">
            <span className="cursor-pointer transition-colors hover:text-white">/ COMPONENTS</span>
            <span className="cursor-pointer transition-colors hover:text-white">DESIGN TOKENS</span>
            <span className="cursor-pointer text-lime-400">DOCUMENTATION ↗</span>
          </div>

          <div className="hidden items-center gap-4 sm:flex">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="group flex w-48 items-center justify-between border border-zinc-800 bg-transparent px-3 py-1.5 transition-colors hover:border-zinc-600"
            >
              <div className="flex items-center gap-2">
                <Search className="size-3 text-zinc-500 transition-colors group-hover:text-white" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400">Search docs...</span>
              </div>
            </button>
            <Link
              to="/notes"
              className="border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:border-lime-400 hover:text-lime-400"
            >
              Get Started ↗
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:text-white md:hidden"
          >
            <Search className="size-4" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {sidebar}

        <main
          ref={mainScrollRef}
          onScroll={handleMainScroll}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto max-w-4xl px-5 py-8 md:px-12 md:py-12 lg:py-16">
            
            {/* Breadcrumbs */}
            <div className="mb-8 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <div className="size-1.5 bg-lime-400"></div>
              <span>BUILT FOR YOUR NEXT GREAT IDEA</span>
              <span>//</span>
              <span
                className="cursor-pointer transition-colors hover:text-white"
                onClick={() => { if (topic) select(topic, topic.subtopics[0]) }}
              >
                {topic?.title ?? 'General'}
              </span>
              <span>//</span>
              <span className="text-white">
                {subtopic?.title ?? 'Overview'}
              </span>
            </div>

            {/* Page Header */}
            <div className="mb-12 border-b border-zinc-800 pb-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                    {subtopic?.title ?? 'Select a subtopic'}
                    <span className="text-lime-400">.</span>
                  </h1>
                  {subtopic?.description && (
                    <div className="mt-6 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                      {subtopic.description}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setModal('content')}
                    disabled={!subtopic}
                    className="group inline-flex cursor-pointer items-center gap-2 border border-zinc-800 bg-zinc-900 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-all hover:border-lime-400 hover:text-lime-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ADD CONTENT <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            {subtopic?.content && subtopic.content.length > 0 ? (
              <div className="flex flex-col gap-10">
                {subtopic.content.map((item) => (
                  <section
                    id={`content-${item.id}`}
                    key={item.id}
                    className="group relative scroll-mt-24"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {item.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => deleteContent(item.id)}
                        className="p-1.5 text-zinc-500 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {item.type === 'code' ? (
                      <div className="relative overflow-hidden border border-zinc-800 bg-black">
                        <div className="flex items-center justify-between border-b border-zinc-800/50 bg-zinc-950 px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-lime-400">
                              {item.language && !looksLikeGeneratedId(item.language) ? item.language : languageKey}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                              / CODE BLOCK
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.content, item.id)}
                            className="flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-lime-400"
                          >
                            {copiedId === item.id ? (
                              <><Check className="size-3 text-lime-400" /><span className="text-lime-400">COPIED</span></>
                            ) : (
                              <><Copy className="size-3" /><span>COPY</span></>
                            )}
                          </button>
                        </div>
                        <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-zinc-300 selection:bg-lime-500/30">
                          <code>{item.content}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="prose prose-invert max-w-none text-base leading-relaxed text-zinc-400">
                        <p>{item.content}</p>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-16 text-center border border-zinc-800 bg-zinc-950/30">
                <div className="mb-6 flex size-12 items-center justify-center bg-lime-400 text-black">
                  <FileText className="size-6" />
                </div>
                <h3 className="text-xl font-semibold text-white">
                  No content. <span className="text-lime-400">Just empty space.</span>
                </h3>
                <p className="mt-2 max-w-sm text-sm text-zinc-500">
                  Start documenting by adding a text explanation or code snippet block.
                </p>
                <button
                  type="button"
                  onClick={() => setModal('content')}
                  disabled={!subtopic}
                  className="mt-8 inline-flex cursor-pointer items-center gap-2 border border-zinc-800 bg-zinc-900 px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white transition-all hover:border-lime-400 hover:text-lime-400"
                >
                  <Plus className="size-3" />
                  CREATE CONTENT BLOCK
                </button>
              </div>
            )}

            {/* Prev / Next */}
            {allSubtopics.length > 0 && (
              <div className="mt-16 grid grid-cols-1 gap-4 border-t border-zinc-800 pt-8 sm:grid-cols-2">
                {prevSubtopic ? (
                  <button
                    type="button"
                    onClick={() => select(prevSubtopic.topic, prevSubtopic.subtopic)}
                    className="group flex flex-col items-start border border-zinc-800 bg-black p-5 text-left transition-all hover:border-lime-400"
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 transition-colors group-hover:text-lime-400">
                      <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-1" />
                      <span>PREVIOUS</span>
                    </div>
                    <div className="mt-2 w-full truncate text-sm font-medium text-zinc-300 group-hover:text-white">
                      {prevSubtopic.subtopic.title}
                    </div>
                  </button>
                ) : <div />}
                {nextSubtopic ? (
                  <button
                    type="button"
                    onClick={() => select(nextSubtopic.topic, nextSubtopic.subtopic)}
                    className="group flex flex-col items-end border border-zinc-800 bg-black p-5 text-right transition-all hover:border-lime-400"
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 transition-colors group-hover:text-lime-400">
                      <span>NEXT</span>
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                    </div>
                    <div className="mt-2 w-full truncate text-right text-sm font-medium text-zinc-300 group-hover:text-white">
                      {nextSubtopic.subtopic.title}
                    </div>
                  </button>
                ) : <div />}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT TOC */}
        <aside className="hidden h-full min-h-0 w-64 shrink-0 overflow-y-auto overscroll-contain p-6 xl:flex xl:flex-col border-l border-zinc-800 bg-black/30 backdrop-blur-md">
          <div className="mb-6 pt-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              / ON THIS PAGE
            </div>
          </div>
          {toc.length > 0 ? (
            <nav className="space-y-1">
              {toc.map((item) => {
                const isActive = activeTocId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollTo(item.id)}
                    className={`group relative flex w-full items-center border-l-2 pl-4 py-1.5 text-left text-xs transition-colors ${
                      isActive
                        ? 'border-lime-400 font-medium text-white'
                        : 'border-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <span className="truncate">{item.title}</span>
                  </button>
                )
              })}
            </nav>
          ) : (
            <p className="text-xs text-zinc-600 font-mono">/ NO SECTIONS</p>
          )}
        </aside>
      </div>

      {/* SEARCH MODAL */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24 backdrop-blur-sm bg-black/60 animate-in fade-in duration-150">
          <div className="w-full max-w-xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center border-b border-zinc-800 bg-black px-4 py-3">
              <Search className="mr-3 size-4 text-lime-400" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search documentation..."
                className="flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1 text-zinc-500 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.topic.id}-${result.subtopic.id}-${result.contentItem?.id ?? index}`}
                      onClick={() => {
                        select(result.topic, result.subtopic)
                        if (result.contentItem) {
                          window.setTimeout(() => scrollTo(result.contentItem!.id), 150)
                        }
                        setSearchOpen(false)
                        setSearchQuery('')
                      }}
                      className="group flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-zinc-900"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
                          <span className="text-lime-400">{result.topic.title}</span>
                          <span className="text-zinc-600">/</span>
                          <span className="text-zinc-400">{result.subtopic.title}</span>
                        </div>
                        {result.contentItem && (
                          <div className="mt-1.5 truncate text-xs text-zinc-400">
                            <span className="font-semibold text-white">{result.contentItem.title}:</span>{' '}
                            {result.contentItem.content.slice(0, 80)}...
                          </div>
                        )}
                      </div>
                      <ChevronRight className="ml-2 size-4 shrink-0 text-zinc-600 transition-colors group-hover:text-lime-400" />
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <div className="py-8 text-center text-xs font-mono uppercase tracking-widest text-zinc-600">
                  / NO RESULTS FOUND
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono uppercase tracking-widest text-zinc-600">
                  / START TYPING TO SEARCH
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60 animate-in fade-in duration-150"
             onMouseDown={(e) => e.target === e.currentTarget && setDeleteModal(null)}>
          <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="font-mono text-sm uppercase tracking-widest text-white">
                / DELETE {deleteModal.type}
              </h2>
              <button onClick={() => setDeleteModal(null)} className="p-1 text-zinc-500 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <div className="py-6">
              <p className="text-sm text-zinc-300">
                Are you sure you want to delete <span className="font-semibold text-white">"{deleteModal.title}"</span>?
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white">
                CANCEL
              </button>
              <button onClick={confirmDelete} className="border border-red-900 bg-red-950/50 px-5 py-2 font-mono text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-900 hover:text-white">
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60 animate-in fade-in duration-150">
          <div className="w-full max-w-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="font-mono text-sm uppercase tracking-widest text-white">
                / CREATE NEW {modal}
              </h2>
              <button onClick={resetModal} className="p-1 text-zinc-500 hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            <form className="mt-6 flex flex-col gap-5" onSubmit={add}>
              <label className="flex flex-col gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                TITLE
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="border border-zinc-800 bg-black px-4 py-3 font-sans text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-lime-400"
                  placeholder={modal === 'topic' ? 'e.g., Advanced Concepts' : 'e.g., Error Handling'}
                />
              </label>

              {modal === 'content' && (
                <>
                  <div className="flex flex-col gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    BLOCK TYPE
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setContentType('text')}
                        className={`flex items-center justify-center gap-2 border p-3 transition-all ${
                          contentType === 'text'
                            ? 'border-lime-400 bg-lime-400/10 text-lime-400'
                            : 'border-zinc-800 bg-black text-zinc-500 hover:border-zinc-600'
                        }`}
                      >
                        <AlignLeft className="size-4" /> TEXT
                      </button>
                      <button
                        type="button"
                        onClick={() => setContentType('code')}
                        className={`flex items-center justify-center gap-2 border p-3 transition-all ${
                          contentType === 'code'
                            ? 'border-lime-400 bg-lime-400/10 text-lime-400'
                            : 'border-zinc-800 bg-black text-zinc-500 hover:border-zinc-600'
                        }`}
                      >
                        <Terminal className="size-4" /> CODE
                      </button>
                    </div>
                  </div>
                  <label className="flex flex-col gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    {contentType === 'code' ? 'CODE BODY' : 'CONTENT PARAGRAPH'}
                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      rows={6}
                      className="resize-y border border-zinc-800 bg-black p-4 font-mono text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-lime-400"
                      placeholder={contentType === 'code' ? codePlaceholder : 'Write explanation here...'}
                    />
                  </label>
                </>
              )}

              <div className="mt-4 flex justify-end gap-3 border-t border-zinc-800 pt-5">
                <button type="button" onClick={resetModal} className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white">
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || (modal === 'content' && !content.trim())}
                  className="border border-zinc-800 bg-zinc-900 px-6 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-all hover:border-lime-400 hover:text-lime-400 disabled:opacity-50"
                >
                  CREATE {modal}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
