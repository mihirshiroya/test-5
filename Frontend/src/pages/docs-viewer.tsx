import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Menu,
  Search,
  X,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Home,
  Pencil,
} from 'lucide-react'

import { INITIAL_DOCS, LANGUAGE_META, type Doc, type Topic, type Subtopic } from '../lib/docs-data'
import { fetchDoc, selectDoc, selectDocStatus, selectFolders } from '../store/slices/notesSlice'

export default function DocsViewer() {
  const { folderId } = useParams<{ folderId: string }>()

  if (!folderId) {
    return <Navigate to="/notes" replace />
  }

  return <DocsViewerContent folderId={folderId} />
}

function DocsViewerContent({ folderId }: { folderId: string }) {
  const dispatch = useDispatch()

  const reduxDoc = useSelector(selectDoc(folderId))
  const docStatus = useSelector(selectDocStatus(folderId))
  const folders = useSelector(selectFolders)

  const folder = useMemo(() => folders.find((item) => item.id === folderId), [folders, folderId])
  const folderName = folder?.title ?? 'Documentation'

  useEffect(() => {
    if (docStatus === 'idle') {
      dispatch(fetchDoc(folderId))
    }
  }, [dispatch, folderId, docStatus])

  const mainScrollRef = useRef<HTMLElement | null>(null)

  const initialDoc = useMemo<Doc>(() => {
    return (
      INITIAL_DOCS[folderId] ?? {
        id: folderId,
        title: `${folderId.charAt(0).toUpperCase()}${folderId.slice(1)} Documentation`,
        description: 'This documentation has not been published yet.',
        topics: [],
      }
    )
  }, [folderId])

  const meta = useMemo(() => {
    return (
      LANGUAGE_META[folderId] ?? {
        label: folder?.title ?? 'Documentation',
        color: 'indigo',
        emoji: '·',
      }
    )
  }, [folderId, folder])

  const doc = useMemo<Doc>(() => {
    return reduxDoc ?? initialDoc
  }, [reduxDoc, initialDoc])

  const [topicId, setTopicId] = useState(doc.topics[0]?.id ?? '')
  const [subtopicId, setSubtopicId] = useState(doc.topics[0]?.subtopics[0]?.id ?? '')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(doc.topics.map((topic) => [topic.id, true]))
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)

  useEffect(() => {
    const firstTopic = doc.topics[0]
    const firstSubtopic = firstTopic?.subtopics[0]
    const currentTopic = doc.topics.find((topic) => topic.id === topicId)

    const topicExists = Boolean(currentTopic)
    const subtopicExists = Boolean(currentTopic?.subtopics.some((subtopic) => subtopic.id === subtopicId))

    if (!topicExists) {
      const nextTopicId = firstTopic?.id ?? ''
      const nextSubtopicId = firstSubtopic?.id ?? ''
      setTopicId((previous) => (previous === nextTopicId ? previous : nextTopicId))
      setSubtopicId((previous) => (previous === nextSubtopicId ? previous : nextSubtopicId))
    } else if (!subtopicExists) {
      const nextSubtopicId = currentTopic?.subtopics[0]?.id ?? ''
      setSubtopicId((previous) => (previous === nextSubtopicId ? previous : nextSubtopicId))
    }

    setExpanded((previous) => {
      let changed = false
      const next = { ...previous }
      for (const topic of doc.topics) {
        if (next[topic.id] === undefined) {
          next[topic.id] = true
          changed = true
        }
      }
      return changed ? next : previous
    })
  }, [doc])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((previous) => !previous)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const topic = doc.topics.find((item) => item.id === topicId) ?? doc.topics[0]
  const subtopic = topic?.subtopics.find((item) => item.id === subtopicId) ?? topic?.subtopics[0]
  const toc = subtopic?.content ?? []

  const [activeTocId, setActiveTocId] = useState<string | null>(toc[0]?.id ?? null)

  useEffect(() => {
    setActiveTocId(toc[0]?.id ?? null)
  }, [subtopic?.id])

  useEffect(() => {
    const scrollContainer = mainScrollRef.current
    if (!scrollContainer || !toc.length) return

    const sections = toc.map((item) => document.getElementById(`content-${item.id}`)).filter((element): element is HTMLElement => Boolean(element))
    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visibleEntries.length > 0) {
          const activeId = visibleEntries[0].target.id.replace('content-', '')
          setActiveTocId((previous) => (previous === activeId ? previous : activeId))
        }
      },
      { root: scrollContainer, rootMargin: '-40px 0px -60% 0px', threshold: 0 }
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [subtopic?.id])

  const allSubtopics = useMemo(() => {
    const list: { topic: Topic; subtopic: Subtopic }[] = []
    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        list.push({ topic: currentTopic, subtopic: currentSubtopic })
      })
    })
    return list
  }, [doc])

  const currentIndex = allSubtopics.findIndex((item) => item.topic.id === topic?.id && item.subtopic.id === subtopic?.id)
  const prevSubtopic = currentIndex > 0 ? allSubtopics[currentIndex - 1] : null
  const nextSubtopic = currentIndex >= 0 && currentIndex < allSubtopics.length - 1 ? allSubtopics[currentIndex + 1] : null

  const select = (nextTopic: Topic, nextSubtopicArg?: Subtopic) => {
    const targetSubtopic = nextSubtopicArg ?? nextTopic.subtopics[0]
    setTopicId(nextTopic.id)
    setSubtopicId(targetSubtopic?.id ?? '')
    setExpanded((old) => ({ ...old, [nextTopic.id]: true }))
    setMobileOpen(false)
    setActiveTocId(targetSubtopic?.content?.[0]?.id ?? null)

    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.history.replaceState(null, '', `#${targetSubtopic?.id ?? nextTopic.id}`)
  }

  const scrollTo = (id: string) => {
    const container = mainScrollRef.current
    const element = document.getElementById(`content-${id}`)
    if (!container || !element) return

    setActiveTocId(id)
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const targetTop = container.scrollTop + (elementRect.top - containerRect.top) - 24

    container.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' })
    window.history.replaceState(null, '', `#content-${id}`)
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(null), 2000)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedUrl(true)
    window.setTimeout(() => setCopiedUrl(false), 2000)
  }

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    const results: { topic: Topic; subtopic: Subtopic; contentItem?: (typeof toc)[number] }[] = []

    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        const matchesSubtopic = currentSubtopic.title.toLowerCase().includes(q) || currentSubtopic.description?.toLowerCase().includes(q)
        if (matchesSubtopic) results.push({ topic: currentTopic, subtopic: currentSubtopic })

        currentSubtopic.content.forEach((contentItem) => {
          const matchesContent = contentItem.title.toLowerCase().includes(q) || contentItem.content.toLowerCase().includes(q)
          if (matchesContent) results.push({ topic: currentTopic, subtopic: currentSubtopic, contentItem })
        })
      })
    })
    return results
  }, [searchQuery, doc])

  // ---------------------------------------------------------------------------
  // SIDEBAR
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
          className="rounded-lg p-1.5 text-zinc-400 hover:text-white md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-6">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
          / Topics & Sections
        </span>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2 no-scrollbar">
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
                    if (hasSubtopics) {
                      select(item, item.subtopics[0])
                    } else {
                      select(item)
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

                {hasSubtopics && (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="mr-2 flex size-6 shrink-0 items-center justify-center text-zinc-500 hover:text-white"
                  >
                    {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </button>
                )}
              </div>

              {isExpanded && hasSubtopics && (
                <div className="relative mb-2 ml-7 mt-1 border-l border-zinc-800">
                  <div className="space-y-0.5">
                    {item.subtopics.map((child) => {
                      const isSelected = subtopic?.id === child.id
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => select(item, child)}
                          className={`relative flex w-full items-center px-3 py-1.5 text-left transition-all ${
                            isSelected
                              ? 'text-lime-400'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute -left-[1px] top-1/2 h-4 w-[2px] -translate-y-1/2 bg-lime-400" />
                          )}
                          <span className="truncate text-xs font-mono tracking-wide">{child.title}</span>
                        </button>
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
            / NO TOPICS PUBLISHED
          </p>
        )}
      </nav>
    </aside>
  )

  // ---------------------------------------------------------------------------
  // MAIN RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black font-sans text-white selection:bg-lime-500/30 selection:text-lime-200">
      {/* Background Grid */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>

      {/* HEADER */}
      <header className="relative z-[50] flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 bg-black/50 px-4 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 hover:text-white md:hidden"
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
              to={`/notes/${folderId}/edit`}
              className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:border-lime-400 hover:text-lime-400"
            >
              <Pencil className="size-3" /> EDIT DOCS
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-zinc-400 hover:text-white md:hidden"
          >
            <Search className="size-4" />
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {sidebar}

        <main
          ref={mainScrollRef}
          className="min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto max-w-4xl px-5 py-8 md:px-12 md:py-12 lg:py-16">
            
            {/* BREADCRUMB */}
            <div className="mb-8 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <div className="size-1.5 bg-lime-400"></div>
              <span>BUILT FOR YOUR NEXT GREAT IDEA</span>
              <span>//</span>
              <span>{topic?.title ?? 'General'}</span>
              <span>//</span>
              <span className="text-white">{subtopic?.title ?? 'Overview'}</span>
            </div>

            {/* PAGE HEADER */}
            <div className="mb-12 border-b border-zinc-800 pb-8">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {subtopic?.title ?? 'Select a subtopic'}
                <span className="text-lime-400">.</span>
              </h1>
              {subtopic?.description && (
                <p className="mt-6 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {subtopic.description}
                </p>
              )}
            </div>

            {/* CONTENT */}
            {subtopic?.content && subtopic.content.length > 0 ? (
              <div className="flex flex-col gap-10">
                {subtopic.content.map((item) => (
                  <section id={`content-${item.id}`} key={item.id} className="scroll-mt-24">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {item.title}
                      </h2>
                    </div>

                    {item.type === 'code' ? (
                      <div className="relative overflow-hidden border border-zinc-800 bg-black">
                        <div className="flex items-center justify-between border-b border-zinc-800/50 bg-zinc-950 px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-lime-400">
                              {item.language}
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
                  This section is empty. Open the editor to add content.
                </p>
                <Link
                  to={`/notes/${folderId}/edit`}
                  className="mt-8 inline-flex cursor-pointer items-center gap-2 border border-zinc-800 bg-zinc-900 px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white transition-all hover:border-lime-400 hover:text-lime-400"
                >
                  <Pencil className="size-3" />
                  OPEN EDITOR
                </Link>
              </div>
            )}

            {/* PREVIOUS / NEXT */}
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
                      PREVIOUS
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
                      NEXT
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
                onChange={(e) => setSearchQuery(e.target.value)}
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
                      <ChevronRight className="size-4 shrink-0 text-zinc-600 transition-colors group-hover:text-lime-400" />
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
    </div>
  )
}
