import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  INITIAL_DOCS,
  LANGUAGE_META,
  type Doc,
  type Topic,
  type Subtopic,
} from '../lib/docs-data'
import {
  fetchDoc,
  selectDoc,
  selectDocStatus,
  selectFolders,
} from '../store/slices/notesSlice'
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
import {
  Link,
  Navigate,
  useParams,
} from 'react-router-dom'

export default function DocsViewer() {
  const { folderId } =
    useParams<{ folderId: string }>()

  if (!folderId) {
    return <Navigate to="/notes" replace />
  }

  return (
    <DocsViewerContent folderId={folderId} />
  )
}

function DocsViewerContent({
  folderId,
}: {
  folderId: string
}) {
   const dispatch = useDispatch()

  const reduxDoc = useSelector(selectDoc(folderId))
  const docStatus = useSelector(selectDocStatus(folderId))
  const folders = useSelector(selectFolders)

const folder = useMemo(
  () => folders.find((item) => item.id === folderId),
  [folders, folderId],
)

 const folderName = folder?.title ?? 'Documentation'

  useEffect(() => {
    if (docStatus === 'idle') {
      dispatch(fetchDoc(folderId))
    }
  }, [dispatch, folderId, docStatus])

  // ---------------------------------------------------------------------------
  // REFS
  // ---------------------------------------------------------------------------

  const mainScrollRef =
    useRef<HTMLElement | null>(null)

  // ---------------------------------------------------------------------------
  // DOCUMENT
  // ---------------------------------------------------------------------------

  const initialDoc = useMemo<Doc>(() => {
    return (
      INITIAL_DOCS[folderId] ?? {
        id: folderId,
        title: `${folderId.charAt(0).toUpperCase()}${folderId.slice(1)} Documentation`,
        description:
          'This documentation has not been published yet.',
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

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [topicId, setTopicId] = useState(
    doc.topics[0]?.id ?? '',
  )

  const [subtopicId, setSubtopicId] =
    useState(
      doc.topics[0]?.subtopics[0]?.id ?? '',
    )

  const [expanded, setExpanded] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      doc.topics.map((topic) => [
        topic.id,
        true,
      ]),
    ),
  )

  const [mobileOpen, setMobileOpen] =
    useState(false)

  const [copiedId, setCopiedId] =
    useState<string | null>(null)

  const [searchOpen, setSearchOpen] =
    useState(false)

  const [searchQuery, setSearchQuery] =
    useState('')

  const [copiedUrl, setCopiedUrl] =
    useState(false)

  // ---------------------------------------------------------------------------
  // KEEP SELECTION IN SYNC WITH DOCUMENT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const firstTopic = doc.topics[0]

    const firstSubtopic =
      firstTopic?.subtopics[0]

    const currentTopic = doc.topics.find(
      (topic) => topic.id === topicId,
    )

    const topicExists = Boolean(currentTopic)

    const subtopicExists = Boolean(
      currentTopic?.subtopics.some(
        (subtopic) =>
          subtopic.id === subtopicId,
      ),
    )

    if (!topicExists) {
      const nextTopicId =
        firstTopic?.id ?? ''

      const nextSubtopicId =
        firstSubtopic?.id ?? ''

      setTopicId((previous) =>
        previous === nextTopicId
          ? previous
          : nextTopicId,
      )

      setSubtopicId((previous) =>
        previous === nextSubtopicId
          ? previous
          : nextSubtopicId,
      )
    } else if (!subtopicExists) {
      const nextSubtopicId =
        currentTopic?.subtopics[0]?.id ?? ''

      setSubtopicId((previous) =>
        previous === nextSubtopicId
          ? previous
          : nextSubtopicId,
      )
    }

    setExpanded((previous) => {
      let changed = false

      const next = {
        ...previous,
      }

      for (const topic of doc.topics) {
        if (
          next[topic.id] === undefined
        ) {
          next[topic.id] = true
          changed = true
        }
      }

      return changed ? next : previous
    })
  }, [doc])

  // ---------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (
      e: KeyboardEvent,
    ) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'k'
      ) {
        e.preventDefault()

        setSearchOpen(
          (previous) => !previous,
        )
      }

      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [])

  // ---------------------------------------------------------------------------
  // CURRENT TOPIC / SUBTOPIC
  // ---------------------------------------------------------------------------

  const topic =
    doc.topics.find(
      (item) => item.id === topicId,
    ) ?? doc.topics[0]

  const subtopic =
    topic?.subtopics.find(
      (item) => item.id === subtopicId,
    ) ?? topic?.subtopics[0]

  const toc = subtopic?.content ?? []

  // ---------------------------------------------------------------------------
  // ACTIVE TOC
  // ---------------------------------------------------------------------------

  const [activeTocId, setActiveTocId] =
    useState<string | null>(
      toc[0]?.id ?? null,
    )

  useEffect(() => {
    setActiveTocId(
      toc[0]?.id ?? null,
    )
  }, [subtopic?.id])

  // ---------------------------------------------------------------------------
  // INTERSECTION OBSERVER
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const scrollContainer =
      mainScrollRef.current

    if (!scrollContainer || !toc.length) {
      return
    }

    const sections = toc
      .map((item) =>
        document.getElementById(
          `content-${item.id}`,
        ),
      )
      .filter(
        (
          element,
        ): element is HTMLElement =>
          Boolean(element),
      )

    if (!sections.length) {
      return
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visibleEntries =
            entries
              .filter(
                (entry) =>
                  entry.isIntersecting,
              )
              .sort(
                (a, b) =>
                  a.boundingClientRect
                    .top -
                  b.boundingClientRect.top,
              )

          if (
            visibleEntries.length > 0
          ) {
            const activeId =
              visibleEntries[0].target.id.replace(
                'content-',
                '',
              )

            setActiveTocId(
              (previous) =>
                previous === activeId
                  ? previous
                  : activeId,
            )
          }
        },
        {
          root: scrollContainer,
          rootMargin:
            '-40px 0px -60% 0px',
          threshold: 0,
        },
      )

    sections.forEach((section) => {
      observer.observe(section)
    })

    return () => {
      observer.disconnect()
    }
  }, [subtopic?.id])

  // ---------------------------------------------------------------------------
  // ALL SUBTOPICS
  // ---------------------------------------------------------------------------

  const allSubtopics = useMemo(() => {
    const list: {
      topic: Topic
      subtopic: Subtopic
    }[] = []

    doc.topics.forEach(
      (currentTopic) => {
        currentTopic.subtopics.forEach(
          (currentSubtopic) => {
            list.push({
              topic: currentTopic,
              subtopic:
                currentSubtopic,
            })
          },
        )
      },
    )

    return list
  }, [doc])

  // ---------------------------------------------------------------------------
  // PREVIOUS / NEXT
  // ---------------------------------------------------------------------------

  const currentIndex =
    allSubtopics.findIndex(
      (item) =>
        item.topic.id === topic?.id &&
        item.subtopic.id ===
          subtopic?.id,
    )

  const prevSubtopic =
    currentIndex > 0
      ? allSubtopics[currentIndex - 1]
      : null

  const nextSubtopic =
    currentIndex >= 0 &&
    currentIndex <
      allSubtopics.length - 1
      ? allSubtopics[currentIndex + 1]
      : null

  // ---------------------------------------------------------------------------
  // SELECT
  // ---------------------------------------------------------------------------

  const select = (
    nextTopic: Topic,
    nextSubtopicArg?: Subtopic,
  ) => {
    const targetSubtopic =
      nextSubtopicArg ??
      nextTopic.subtopics[0]

    setTopicId(nextTopic.id)

    setSubtopicId(
      targetSubtopic?.id ?? '',
    )

    setExpanded((old) => ({
      ...old,
      [nextTopic.id]: true,
    }))

    setMobileOpen(false)

    setActiveTocId(
      targetSubtopic?.content?.[0]?.id ??
        null,
    )

    // Reset the documentation scroll
    mainScrollRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    })

    window.history.replaceState(
      null,
      '',
      `#${targetSubtopic?.id ?? nextTopic.id}`,
    )
  }

  // ---------------------------------------------------------------------------
  // SCROLL TO TOC SECTION
  // ---------------------------------------------------------------------------

  const scrollTo = (id: string) => {
    const container =
      mainScrollRef.current

    const element =
      document.getElementById(
        `content-${id}`,
      )

    if (!container || !element) {
      return
    }

    setActiveTocId(id)

    /**
     * Calculate the section's position
     * relative to the scroll container.
     */
    const containerRect =
      container.getBoundingClientRect()

    const elementRect =
      element.getBoundingClientRect()

    const targetTop =
      container.scrollTop +
      (elementRect.top -
        containerRect.top) -
      24

    container.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: 'smooth',
    })

    window.history.replaceState(
      null,
      '',
      `#content-${id}`,
    )
  }

  // ---------------------------------------------------------------------------
  // COPY
  // ---------------------------------------------------------------------------

  const handleCopy = (
    text: string,
    id: string,
  ) => {
    navigator.clipboard.writeText(text)

    setCopiedId(id)

    window.setTimeout(() => {
      setCopiedId(null)
    }, 2000)
  }

  // ---------------------------------------------------------------------------
  // SHARE
  // ---------------------------------------------------------------------------

  const handleShare = () => {
    navigator.clipboard.writeText(
      window.location.href,
    )

    setCopiedUrl(true)

    window.setTimeout(() => {
      setCopiedUrl(false)
    }, 2000)
  }

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return []
    }

    const q =
      searchQuery.toLowerCase()

    const results: {
      topic: Topic
      subtopic: Subtopic
      contentItem?: (typeof toc)[number]
    }[] = []

    doc.topics.forEach(
      (currentTopic) => {
        currentTopic.subtopics.forEach(
          (currentSubtopic) => {
            const matchesSubtopic =
              currentSubtopic.title
                .toLowerCase()
                .includes(q) ||
              currentSubtopic.description
                ?.toLowerCase()
                .includes(q)

            if (matchesSubtopic) {
              results.push({
                topic: currentTopic,
                subtopic:
                  currentSubtopic,
              })
            }

            currentSubtopic.content.forEach(
              (contentItem) => {
                const matchesContent =
                  contentItem.title
                    .toLowerCase()
                    .includes(q) ||
                  contentItem.content
                    .toLowerCase()
                    .includes(q)

                if (matchesContent) {
                  results.push({
                    topic: currentTopic,
                    subtopic:
                      currentSubtopic,
                    contentItem,
                  })
                }
              },
            )
          },
        )
      },
    )

    return results
  }, [searchQuery, doc])

  // ---------------------------------------------------------------------------
  // SIDEBAR
  // ---------------------------------------------------------------------------

  const sidebar = (
    <aside
      className={`${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-40 flex w-72 shadow-2xl'
          : 'hidden'
      } h-screen shrink-0 flex-col overflow-hidden border-r border-soft bg-card/60 backdrop-blur-xl md:sticky md:top-16 md:flex md:h-[calc(100vh-4rem)] md:w-72`}
    >
      {/* Sidebar Header */}

      <div className="flex shrink-0 items-center justify-between border-b border-soft bg-muted/20 px-5 py-4">
        <div className="text-xl font-semibold tracking-tight">
          Overview
        </div>

        <button
          type="button"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          onClick={() =>
            setMobileOpen(false)
          }
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Sidebar Navigation */}

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 no-scrollbar">
        {doc.topics.map(
          (item, index) => {
            const isExpanded =
              Boolean(expanded[item.id])

            const isCurrentTopic =
              topic?.id === item.id

            const hasSubtopics =
              item.subtopics.length > 0

            return (
              <div
                key={item.id}
                className="group"
              >
                <div
                  className={`relative flex items-center ${
                    isCurrentTopic
                      ? 'bg-foreground/[0.045]'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        hasSubtopics
                      ) {
                        select(
                          item,
                          item.subtopics[0],
                        )
                      } else {
                        select(item)
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2.5 text-left"
                  >
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center text-[10px] font-semibold ${
                        isCurrentTopic
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {String(
                        index + 1,
                      ).padStart(2, '0')}
                    </span>

                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] ${
                        isCurrentTopic
                          ? 'font-semibold'
                          : 'font-medium text-foreground/80'
                      }`}
                    >
                      {item.title}
                    </span>
                  </button>

                  {hasSubtopics && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(
                          (prev) => ({
                            ...prev,
                            [item.id]:
                              !prev[
                                item.id
                              ],
                          }),
                        )
                      }
                      className="mr-2 flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                  )}
                </div>

                {isExpanded &&
                  hasSubtopics && (
                    <div className="relative mb-1 ml-6 mt-1 border-l border-dotted border-soft ">
                      <div className="space-y-0.5">
                        {item.subtopics.map(
                          (child) => {
                            const isSelected =
                              subtopic?.id ===
                              child.id

                            return (
                              <button
                                key={
                                  child.id
                                }
                                type="button"
                                onClick={() =>
                                  select(
                                    item,
                                    child,
                                  )
                                }
                                className={`relative flex w-full items-center px-2.5 py-2 text-left text-[12.5px] ${
                                  isSelected
                                    ? 'bg-indigo-500/10 font-medium text-primary'
                                    : 'text-secondary hover:bg-muted/50 hover:text-foreground'
                                }`}
                              >
                                {isSelected && (
                                  <span className="absolute -left-[1px] top-1/2 h-9 w-0.5 -translate-y-1/2 rounded-full bg-indigo-500" />
                                )}

                                <span className="truncate">
                                  {
                                    child.title
                                  }
                                </span>
                              </button>
                            )
                          },
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )
          },
        )}

        {doc.topics.length ===
          0 && (
          <p className="px-2.5 py-4 text-xs text-muted-foreground">
            No topics have been
            published for{' '}
            {folderName} yet.
          </p>
        )}
      </nav>
    </aside>
  )

  // ---------------------------------------------------------------------------
  // MAIN RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-screen flex-col overflow-hidden text-foreground">
      {/* HEADER */}

      <header className="flex h-16 shrink-0 items-center justify-between border-b border-soft px-4 md:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={() =>
              setMobileOpen(true)
            }
          >
            <Menu className="size-5" />
          </button>

          <span className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
             {folderName}
          </span>
        </div>

       

        <div className="flex items-center gap-2">
           <div className="mx-4 hidden max-w-md flex-1 md:block">
          <button
            type="button"
            onClick={() =>
              setSearchOpen(true)
            }
            className="group flex w-full items-center justify-between border border-soft bg-muted/40 px-3.5 py-2 text-sm text-muted-foreground hover:bg-muted/70"
          >
            <div className="flex items-center gap-2.5">
              <Search className="size-4" />

              <span className="text-xs text-secondary">
                Search  {folderName}{' '}
                docs...
              </span>
            </div>

          </button>
        </div>
          <Link
            to="/notes"
            className="hidden border border-soft bg-background p-2 hover:bg-muted sm:flex"
          >
            <Home className="size-4" />
          </Link>

          <Link
            to={`/notes/${folderId}/edit`}
            className="hidden border border-soft bg-background p-2 hover:bg-muted sm:flex"
          >
            <Pencil className="size-4" />
          </Link>

          <button
            type="button"
            onClick={() =>
              setSearchOpen(true)
            }
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
          >
            <Search className="size-5" />
          </button>
        </div>
      </header>

      {/* BODY */}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}

        {sidebar}

        {/* DOCUMENT SCROLL CONTAINER */}

        <main
          ref={mainScrollRef}
          className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background"
        >
          <div className="mx-auto px-4 py-6 md:px-8 lg:max-w-6xl">
            {/* BREADCRUMB */}

            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link
                to="/notes"
                className="hover:text-foreground"
              >
                <Home className="size-3.5" />
              </Link>

              <ChevronRight className="size-3.5" />

              <span>
                 {folderName}
              </span>

              <ChevronRight className="size-3.5" />

              <span>
                {topic?.title ??
                  'General'}
              </span>

              <ChevronRight className="size-3.5" />

              <span className="font-semibold text-foreground">
                {subtopic?.title ??
                  'Overview'}
              </span>
            </div>

            {/* PAGE HEADER */}

            <div className="mb-4 border-b border-soft pb-4">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {subtopic?.title ??
                  'Select a subtopic'}
              </h1>

              {subtopic?.description && (
                <p className="mt-4 text-sm leading-relaxed text-secondary">
                  {
                    subtopic.description
                  }
                </p>
              )}
            </div>

            {/* CONTENT */}

            {subtopic?.content &&
            subtopic.content.length >
              0 ? (
              <div className="flex flex-col gap-8">
                {subtopic.content.map(
                  (item) => (
                    <section
                      id={`content-${item.id}`}
                      key={item.id}
                      className="scroll-mt-6"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                          {item.title}
                        </h2>
                      </div>

                      {item.type ===
                      'code' ? (
                        <div className="overflow-hidden border border-soft bg-zinc-950 text-zinc-100 shadow-md">
                          <div className="flex items-center justify-between border-b border-soft bg-zinc-900 px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="size-3 rounded-full bg-rose-500/80" />
                              <div className="size-3 rounded-full bg-amber-500/80" />
                              <div className="size-3 rounded-full bg-emerald-500/80" />

                              <span className="ml-2 font-mono text-xs text-zinc-400">
                                {
                                  item.language
                                }
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  item.content,
                                  item.id,
                                )
                              }
                              className="flex items-center gap-1.5 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white"
                            >
                              {copiedId ===
                              item.id ? (
                                <>
                                  <Check className="size-3.5" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3.5" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>

                          <pre className="overflow-x-auto p-5 font-mono text-sm leading-6 text-zinc-200">
                            <code>
                              {
                                item.content
                              }
                            </code>
                          </pre>
                        </div>
                      ) : (
                        <div className="text-base leading-7 text-secondary">
                          <p>
                            {
                              item.content
                            }
                          </p>
                        </div>
                      )}
                    </section>
                  ),
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex size-14 items-center justify-center bg-indigo-500/10 text-indigo-500">
                  <FileText className="size-7" />
                </div>

                <h3 className="text-lg font-bold">
                  No content in this section
                </h3>

                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  This section is
                  empty. Open the
                  editor to add
                  content.
                </p>

                <Link
                  to={`/notes/${folderId}/edit`}
                  className="mt-5 inline-flex items-center gap-2 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  <Pencil className="size-4" />
                  Open Editor
                </Link>
              </div>
            )}

            {/* PREVIOUS / NEXT */}

            {allSubtopics.length >
              0 && (
              <div className="mt-14 grid grid-cols-1 gap-4 border-t border-soft pt-8 sm:grid-cols-2">
                {prevSubtopic ? (
                  <button
                    type="button"
                    onClick={() =>
                      select(
                        prevSubtopic.topic,
                        prevSubtopic.subtopic,
                      )
                    }
                    className="group flex flex-col items-start border border-soft bg-card p-4 text-left hover:border-indigo-500/40"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <ArrowLeft className="size-3.5" />
                      Previous
                    </div>

                    <div className="mt-1 truncate text-sm text-secondary">
                      {
                        prevSubtopic
                          .subtopic.title
                      }
                    </div>
                  </button>
                ) : (
                  <div />
                )}

                {nextSubtopic ? (
                  <button
                    type="button"
                    onClick={() =>
                      select(
                        nextSubtopic.topic,
                        nextSubtopic.subtopic,
                      )
                    }
                    className="group flex flex-col items-end border border-soft bg-card p-4 text-right hover:border-indigo-500/40"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Next
                      <ArrowRight className="size-3.5" />
                    </div>

                    <div className="mt-1 truncate text-sm text-secondary">
                      {
                        nextSubtopic
                          .subtopic.title
                      }
                    </div>
                  </button>
                ) : (
                  <div />
                )}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT TOC */}

        <aside className="hidden w-64 shrink-0 p-3 xl:sticky xl:top-16 xl:flex xl:h-[calc(100vh-4rem)] xl:flex-col">
          <div className="border border-soft bg-background p-2 shadow-sm">
            <div className="px-2.5 pb-3 pt-1.5">
              <div className="text-sm font-medium">
                Table of Content
              </div>
            </div>

            {toc.length > 0 ? (
              <nav className="space-y-0.5">
                {toc.map((item) => {
                  const isActive =
                    activeTocId ===
                    item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        scrollTo(
                          item.id,
                        )
                      }
                      className={`relative flex w-full items-center px-2.5 py-2 text-left text-xs transition-colors ${
                        isActive
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-px -translate-y-1/2 rounded-full bg-indigo-500" />
                      )}

                      <span className="truncate">
                        {item.title}
                      </span>
                    </button>
                  )
                })}
              </nav>
            ) : (
              <p className="px-2.5 py-3 text-xs text-muted-foreground">
                No sections in this
                subtopic.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* MOBILE BACKDROP */}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() =>
            setMobileOpen(false)
          }
        />
      )}

      {/* SEARCH */}

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 backdrop-blur-xs">
          <div className="w-full max-w-xl overflow-hidden border border-soft bg-canvas shadow-2xl">
            <div className="flex items-center border-b border-soft bg-muted/30 px-4 py-3">
              <Search className="mr-3 size-5 text-muted-foreground" />

              <input
                autoFocus
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value,
                  )
                }
                placeholder={`Search $ {folderName} docs...`}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />

              <button
                type="button"
                onClick={() =>
                  setSearchOpen(false)
                }
                className="p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-3">
              {searchResults.length >
              0 ? (
                <div className="space-y-1">
                  {searchResults.map(
                    (
                      result,
                      index,
                    ) => (
                      <button
                        key={`${result.topic.id}-${result.subtopic.id}-${result.contentItem?.id ?? index}`}
                        type="button"
                        onClick={() => {
                          select(
                            result.topic,
                            result.subtopic,
                          )

                          if (
                            result.contentItem
                          ) {
                            window.setTimeout(
                              () =>
                                scrollTo(
                                  result
                                    .contentItem!
                                    .id,
                                ),
                              150,
                            )
                          }

                          setSearchOpen(
                            false,
                          )

                          setSearchQuery(
                            '',
                          )
                        }}
                        className="flex w-full items-center justify-between p-3 text-left hover:bg-indigo-500/10"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-indigo-500">
                              {
                                result
                                  .topic
                                  .title
                              }
                            </span>

                            <span>
                              /
                            </span>

                            <span className="text-xs font-medium">
                              {
                                result
                                  .subtopic
                                  .title
                              }
                            </span>
                          </div>

                          {result.contentItem && (
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {
                                result
                                  .contentItem
                                  .title
                              }
                            </div>
                          )}
                        </div>

                        <ChevronRight className="size-4 shrink-0" />
                      </button>
                    ),
                  )}
                </div>
              ) : searchQuery.trim() ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No results for
                  &ldquo;
                  {searchQuery}
                  &rdquo;
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Type to search
                  through{' '}
                   {folderName}{' '}
                  documentation.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}