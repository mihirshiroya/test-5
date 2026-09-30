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

/**
 * Turns "my-react_notes" into "My React Notes".
 */
const humanize = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()

/**
 * Detects database-style ids (uuid, cuid, long numeric / hex strings) so we
 * never show them to the user as if they were a folder name.
 */
const looksLikeGeneratedId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  ) ||
  /^c[a-z0-9]{20,}$/i.test(value) ||
  /^[0-9a-f]{20,}$/i.test(value) ||
  /^\d+$/.test(value)

/**
 * Reads the display name from a folder. The API/store may expose it as
 * `name` or `title`, so we support both.
 */
const getFolderName = (folder?: StoredFolder | null): string => {
  if (!folder) return ''

  const source = folder as StoredFolder & {
    title?: string
    label?: string
  }

  return String(source.name ?? source.title ?? source.label ?? '').trim()
}

/**
 * Language key used for code blocks. It is derived from the folder NAME
 * (never the folder id).
 */
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

  // ---------------------------------------------------------------------------
  // Scroll container
  // ---------------------------------------------------------------------------

  const mainScrollRef = useRef<HTMLElement | null>(null)

  // ---------------------------------------------------------------------------
  // Redux
  // ---------------------------------------------------------------------------

  const folders = useSelector((state: RootState) => state.notes.folders)

  const reduxDoc = useSelector(
    (state: RootState) => state.notes.docs[folderId]
  )

  // String() on both sides so numeric ids from the API still match the
  // string id coming from the URL.
  const folder = folders.find((item) => String(item.id) === folderId)

  // ---------------------------------------------------------------------------
  // Folder label (the name shown in the UI – never the raw id)
  // ---------------------------------------------------------------------------

  const folderName = getFolderName(folder)

  const label = useMemo(() => {
    if (folderName) return folderName

    // Folder not loaded yet (or missing a name). Don't leak a database id.
    return looksLikeGeneratedId(folderId) ? 'Documentation' : humanize(folderId)
  }, [folderName, folderId])

  const languageKey = getLanguageKey(label)

  // ---------------------------------------------------------------------------
  // Fallback document
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Local UI state
  // ---------------------------------------------------------------------------

  const [topicId, setTopicId] = useState(doc.topics[0]?.id ?? '')

  const [subtopicId, setSubtopicId] = useState(
    doc.topics[0]?.subtopics[0]?.id ?? ''
  )

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(doc.topics.map((topic) => [topic.id, true]))
  )

  const [mobileOpen, setMobileOpen] = useState(false)

  const [modal, setModal] = useState<'topic' | 'subtopic' | 'content' | null>(
    null
  )

  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null)

  const [title, setTitle] = useState('')

  const [content, setContent] = useState('')

  const [contentType, setContentType] = useState<'text' | 'code'>('text')

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const [activeTocId, setActiveTocId] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Keep selection valid when Redux document changes
  //
  // IMPORTANT:
  // This effect only depends on `doc`. Depending on topicId/subtopicId while
  // also changing them could cause repeated updates.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const firstTopic = doc.topics[0]

    const selectedTopic =
      doc.topics.find((topic) => topic.id === topicId) ?? firstTopic

    const selectedSubtopic =
      selectedTopic?.subtopics.find((subtopic) => subtopic.id === subtopicId) ??
      selectedTopic?.subtopics[0]

    const nextTopicId = selectedTopic?.id ?? ''

    const nextSubtopicId = selectedSubtopic?.id ?? ''

    if (topicId !== nextTopicId) {
      setTopicId(nextTopicId)
    }

    if (subtopicId !== nextSubtopicId) {
      setSubtopicId(nextSubtopicId)
    }

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

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

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

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Current topic / subtopic
  // ---------------------------------------------------------------------------

  const topic = doc.topics.find((item) => item.id === topicId) ?? doc.topics[0]

  const subtopic =
    topic?.subtopics.find((item) => item.id === subtopicId) ??
    topic?.subtopics[0]

  const toc = subtopic?.content ?? []

  // ---------------------------------------------------------------------------
  // Reset active TOC when subtopic changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setActiveTocId(toc[0]?.id ?? null)

    // Always return the document scroll position to the top when changing
    // subtopics.
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({
        top: 0,
        behavior: 'auto',
      })
    })
  }, [subtopic?.id])

  // ---------------------------------------------------------------------------
  // Scroll-based active TOC tracking
  //
  // We intentionally don't use IntersectionObserver here.
  // `<main>` is our custom scroll container, so checking section positions
  // relative to that container is more predictable.
  // ---------------------------------------------------------------------------

  const handleMainScroll = () => {
    const container = mainScrollRef.current

    if (!container || !toc.length) {
      return
    }

    const containerRect = container.getBoundingClientRect()

    const activationOffset = 100

    let currentId = toc[0]?.id ?? null

    for (const item of toc) {
      const element = document.getElementById(`content-${item.id}`)

      if (!element) {
        continue
      }

      const elementRect = element.getBoundingClientRect()

      const relativeTop = elementRect.top - containerRect.top

      if (relativeTop <= activationOffset) {
        currentId = item.id
      }
    }

    setActiveTocId((previous) => (previous === currentId ? previous : currentId))
  }

  // ---------------------------------------------------------------------------
  // Previous / next
  // ---------------------------------------------------------------------------

  const allSubtopics = useMemo(() => {
    const list: {
      topic: Topic
      subtopic: Subtopic
    }[] = []

    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        list.push({
          topic: currentTopic,
          subtopic: currentSubtopic,
        })
      })
    })

    return list
  }, [doc])

  const currentIndex = allSubtopics.findIndex(
    (item) => item.topic.id === topic?.id && item.subtopic.id === subtopic?.id
  )

  const prevSubtopic = currentIndex > 0 ? allSubtopics[currentIndex - 1] : null

  const nextSubtopic =
    currentIndex >= 0 && currentIndex < allSubtopics.length - 1
      ? allSubtopics[currentIndex + 1]
      : null

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  const select = (nextTopic: Topic, nextSubtopic?: Subtopic) => {
    const targetSubtopic = nextSubtopic ?? nextTopic.subtopics[0]

    setTopicId(nextTopic.id)

    setSubtopicId(targetSubtopic?.id ?? '')

    setExpanded((previous) => ({
      ...previous,
      [nextTopic.id]: true,
    }))

    setMobileOpen(false)

    setActiveTocId(targetSubtopic?.content?.[0]?.id ?? null)

    if (typeof window !== 'undefined') {
      window.history.replaceState(
        null,
        '',
        `#${targetSubtopic?.id ?? nextTopic.id}`
      )
    }

    // IMPORTANT:
    // Scroll the actual main container, not window.
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Scroll to content section
  // ---------------------------------------------------------------------------

  const scrollTo = (id: string) => {
    const container = mainScrollRef.current

    const element = document.getElementById(`content-${id}`)

    if (!container || !element) {
      return
    }

    setActiveTocId(id)

    const containerRect = container.getBoundingClientRect()

    const elementRect = element.getBoundingClientRect()

    const headerOffset = 24

    const targetTop =
      container.scrollTop + (elementRect.top - containerRect.top) - headerOffset

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    })

    window.history.replaceState(null, '', `#content-${id}`)
  }

  // ---------------------------------------------------------------------------
  // Copy
  // ---------------------------------------------------------------------------

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)

      setCopiedId(id)

      window.setTimeout(() => {
        setCopiedId(null)
      }, 2000)
    } catch {
      // Clipboard unavailable.
    }
  }

  // ---------------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------------

  const resetModal = () => {
    setModal(null)
    setTitle('')
    setContent('')
    setContentType('text')
  }

  // ---------------------------------------------------------------------------
  // Add topic / subtopic / content
  // ---------------------------------------------------------------------------

  const add = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    const cleanTitle = title.trim()
    const cleanContent = content.trim()

    if (!modal || !cleanTitle || (modal === 'content' && !cleanContent)) {
      return
    }

    // -------------------------------------------------------------------------
    // Topic
    // -------------------------------------------------------------------------

    if (modal === 'topic') {
      const newTopic: Topic = {
        id: createId(),
        title: cleanTitle,
        subtopics: [],
      }

      const nextDoc: Doc = {
        ...doc,
        topics: [...doc.topics, newTopic],
      }

      dispatch(
        setDoc({
          folderId,
          doc: nextDoc,
        })
      )

      setTopicId(newTopic.id)
      setSubtopicId('')

      setExpanded((previous) => ({
        ...previous,
        [newTopic.id]: true,
      }))

      resetModal()
      return
    }

    // -------------------------------------------------------------------------
    // Subtopic
    // -------------------------------------------------------------------------

    if (modal === 'subtopic' && topic) {
      dispatch(
        addSubtopic({
          folderId,
          topicId: topic.id,
          title: cleanTitle,
          description: 'Recently added section. Click Add Content to populate.',
        })
      )

      setExpanded((previous) => ({
        ...previous,
        [topic.id]: true,
      }))

      resetModal()
      return
    }

    // -------------------------------------------------------------------------
    // Content
    // -------------------------------------------------------------------------

    if (modal === 'content' && topic && subtopic) {
      const newContent: Omit<Content, 'id'> = {
        title: cleanTitle,
        type: contentType,
        content: cleanContent,
        // Language comes from the folder NAME, not the folder id.
        ...(contentType === 'code' ? { language: languageKey } : {}),
      }

      dispatch(
        addContent({
          folderId,
          topicId: topic.id,
          subtopicId: subtopic.id,
          content: newContent,
        })
      )

      resetModal()
    }
  }

  // ---------------------------------------------------------------------------
  // Delete topic
  // ---------------------------------------------------------------------------

  const deleteTopic = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation()

    const target = doc.topics.find((item) => item.id === id)

    if (!target) return

    setDeleteModal({
      type: 'topic',
      id,
      title: target.title,
    })
  }

  // ---------------------------------------------------------------------------
  // Delete subtopic
  // ---------------------------------------------------------------------------

  const deleteSubtopic = (
    parentTopic: Topic,
    id: string,
    event?: React.MouseEvent
  ) => {
    event?.stopPropagation()

    const target = parentTopic.subtopics.find((item) => item.id === id)

    if (!target) return

    setDeleteModal({
      type: 'subtopic',
      id,
      title: target.title,
      parentTopicId: parentTopic.id,
    })
  }

  // ---------------------------------------------------------------------------
  // Delete content
  // ---------------------------------------------------------------------------

  const deleteContent = (contentId: string) => {
    if (!topic || !subtopic) {
      return
    }

    const target = subtopic.content.find((item) => item.id === contentId)

    if (!target) return

    setDeleteModal({
      type: 'content',
      id: contentId,
      title: target.title,
      parentTopicId: topic.id,
    })
  }

  // ---------------------------------------------------------------------------
  // Confirm deletion
  // ---------------------------------------------------------------------------

  const confirmDelete = () => {
    if (!deleteModal) return

    // -------------------------------------------------------------------------
    // Delete topic
    // -------------------------------------------------------------------------

    if (deleteModal.type === 'topic') {
      const remainingTopics = doc.topics.filter(
        (item) => item.id !== deleteModal.id
      )

      const nextDoc: Doc = {
        ...doc,
        topics: remainingTopics,
      }

      dispatch(
        setDoc({
          folderId,
          doc: nextDoc,
        })
      )

      if (deleteModal.id === topicId) {
        const nextTopic = remainingTopics[0]

        if (nextTopic) {
          setTopicId(nextTopic.id)

          setSubtopicId(nextTopic.subtopics[0]?.id ?? '')

          setExpanded((previous) => ({
            ...previous,
            [nextTopic.id]: true,
          }))

          setActiveTocId(nextTopic.subtopics[0]?.content?.[0]?.id ?? null)

          requestAnimationFrame(() => {
            mainScrollRef.current?.scrollTo({
              top: 0,
              behavior: 'auto',
            })
          })
        } else {
          setTopicId('')
          setSubtopicId('')
          setActiveTocId(null)
        }
      }
    }

    // -------------------------------------------------------------------------
    // Delete subtopic
    // -------------------------------------------------------------------------

    if (deleteModal.type === 'subtopic') {
      const parentTopic = doc.topics.find(
        (item) => item.id === deleteModal.parentTopicId
      )

      if (parentTopic) {
        const remainingSubtopics = parentTopic.subtopics.filter(
          (item) => item.id !== deleteModal.id
        )

        const nextDoc: Doc = {
          ...doc,
          topics: doc.topics.map((item) =>
            item.id === parentTopic.id
              ? {
                  ...item,
                  subtopics: remainingSubtopics,
                }
              : item
          ),
        }

        dispatch(
          setDoc({
            folderId,
            doc: nextDoc,
          })
        )

        if (deleteModal.id === subtopicId) {
          const nextSubtopic = remainingSubtopics[0]

          setTopicId(parentTopic.id)

          setSubtopicId(nextSubtopic?.id ?? '')

          setActiveTocId(nextSubtopic?.content?.[0]?.id ?? null)

          requestAnimationFrame(() => {
            mainScrollRef.current?.scrollTo({
              top: 0,
              behavior: 'auto',
            })
          })
        }
      }
    }

    // -------------------------------------------------------------------------
    // Delete content
    // -------------------------------------------------------------------------

    if (deleteModal.type === 'content') {
      if (topic && subtopic) {
        const nextDoc: Doc = {
          ...doc,
          topics: doc.topics.map((currentTopic) =>
            currentTopic.id !== topic.id
              ? currentTopic
              : {
                  ...currentTopic,
                  subtopics: currentTopic.subtopics.map((currentSubtopic) =>
                    currentSubtopic.id !== subtopic.id
                      ? currentSubtopic
                      : {
                          ...currentSubtopic,
                          content: currentSubtopic.content.filter(
                            (item) => item.id !== deleteModal.id
                          ),
                        }
                  ),
                }
          ),
        }

        dispatch(
          setDoc({
            folderId,
            doc: nextDoc,
          })
        )

        if (activeTocId === deleteModal.id) {
          setActiveTocId(
            subtopic.content.find((item) => item.id !== deleteModal.id)?.id ??
              null
          )
        }
      }
    }

    setDeleteModal(null)
  }

  // ---------------------------------------------------------------------------
  // Reset document
  // ---------------------------------------------------------------------------

  const resetToDefault = () => {
    const confirmed = window.confirm(
      `Reset ${meta.label} documentation to default content? This cannot be undone.`
    )

    if (!confirmed) return

    dispatch(
      setDoc({
        folderId,
        doc: fallbackDoc,
      })
    )

    setTopicId(fallbackDoc.topics[0]?.id ?? '')

    setSubtopicId(fallbackDoc.topics[0]?.subtopics[0]?.id ?? '')

    setExpanded(
      Object.fromEntries(fallbackDoc.topics.map((item) => [item.id, true]))
    )

    setActiveTocId(fallbackDoc.topics[0]?.subtopics[0]?.content?.[0]?.id ?? null)

    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({
        top: 0,
        behavior: 'auto',
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return []
    }

    const query = searchQuery.toLowerCase()

    const results: {
      topic: Topic
      subtopic: Subtopic
      contentItem?: Content
    }[] = []

    doc.topics.forEach((currentTopic) => {
      currentTopic.subtopics.forEach((currentSubtopic) => {
        if (
          currentSubtopic.title.toLowerCase().includes(query) ||
          currentSubtopic.description?.toLowerCase().includes(query)
        ) {
          results.push({
            topic: currentTopic,
            subtopic: currentSubtopic,
          })
        }

        currentSubtopic.content.forEach((contentItem) => {
          if (
            contentItem.title.toLowerCase().includes(query) ||
            contentItem.content.toLowerCase().includes(query)
          ) {
            results.push({
              topic: currentTopic,
              subtopic: currentSubtopic,
              contentItem,
            })
          }
        })
      })
    })

    return results
  }, [searchQuery, doc])

  // ---------------------------------------------------------------------------
  // Code placeholder (based on the folder NAME, not the id)
  // ---------------------------------------------------------------------------

  const codePlaceholder =
    languageKey === 'python'
      ? `def my_function():\n    print("Hello from Python!")`
      : languageKey === 'javascript' || languageKey === 'typescript'
        ? `function myFunction() {\n  console.log("Hello!");\n}`
        : languageKey === 'tsx'
          ? `function MyComponent() {\n  return <div>Hello!</div>;\n}`
          : `public void myMethod() {\n    System.out.println("Hello!");\n}`

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------

  const sidebar = (
    <aside
      className={`${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-40 flex w-80 shadow-2xl animate-in slide-in-from-left duration-200'
          : 'hidden'
      } h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-soft bg-card/60 backdrop-blur-xl md:sticky md:top-0 md:flex md:w-72 lg:w-80`}
    >
      {/* Sidebar Header */}

      <div className="flex shrink-0 items-center justify-between border-b border-soft bg-muted/20 px-5 py-4">
        <div className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground">
          Overview
        </div>

        <button
          type="button"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Topics Header */}

      <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Topics & Sections
        </span>

        <button
          type="button"
          onClick={() => setModal('topic')}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-500/10"
          aria-label="Add topic"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Navigation */}

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2">
        {doc.topics.map((item, index) => {
          const isExpanded = Boolean(expanded[item.id])

          const isCurrentTopic = topic?.id === item.id

          const hasSubtopics = item.subtopics.length > 0

          return (
            <div key={item.id} className="group">
              {/* Topic */}

              <div
                className={`relative flex items-center transition-all duration-200 ${
                  isCurrentTopic
                    ? 'bg-foreground/[0.045]'
                    : 'hover:bg-muted/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpanded((previous) => ({
                      ...previous,
                      [item.id]: !previous[item.id],
                    }))

                    if (item.subtopics[0]) {
                      select(item, item.subtopics[0])
                    } else {
                      setTopicId(item.id)
                      setSubtopicId('')
                    }
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2.5 text-left"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center text-[10px] font-semibold tracking-wide transition-colors ${
                      isCurrentTopic
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      isCurrentTopic
                        ? 'font-semibold text-foreground'
                        : 'font-medium text-foreground/80'
                    }`}
                  >
                    {item.title}
                  </span>
                </button>

                {/* Actions */}

                <div className="flex shrink-0 items-center">
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()

                        setModal('subtopic')

                        setTopicId(item.id)

                        setSubtopicId(item.subtopics[0]?.id ?? '')
                      }}
                      className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-indigo-500/10 hover:text-indigo-500"
                      title="Add subtopic"
                      aria-label={`Add subtopic to ${item.title}`}
                    >
                      <Plus className="size-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(event) => deleteTopic(item.id, event)}
                      className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title={`Delete topic ${item.title}`}
                      aria-label={`Delete topic ${item.title}`}
                    >
                      <Trash2 className="size-3.5 text-red-600" />
                    </button>
                  </div>

                  {hasSubtopics && (
                    <button
                      type="button"
                      aria-label={
                        isExpanded
                          ? `Collapse ${item.title}`
                          : `Expand ${item.title}`
                      }
                      aria-expanded={isExpanded}
                      onClick={(event) => {
                        event.stopPropagation()

                        setExpanded((previous) => ({
                          ...previous,
                          [item.id]: !previous[item.id],
                        }))
                      }}
                      className={`mr-2 flex size-7 shrink-0 items-center justify-center transition-all duration-200 ${
                        isExpanded
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Subtopics */}

              {isExpanded && hasSubtopics && (
                <div className="relative mb-1 ml-6 mt-1 border-l border-dotted border-soft ">
                  <div className="space-y-0.5">
                    {item.subtopics.map((child) => {
                      const isSelected = subtopic?.id === child.id

                      return (
                        <div
                          key={child.id}
                          className="group/subtopic relative flex min-w-0 items-center"
                        >
                          <div
                            className={`relative flex min-w-0 flex-1 items-center transition-all duration-150 ${
                              isSelected
                                ? 'bg-indigo-500/10 text-primary'
                                : 'text-secondary hover:bg-muted/50 hover:text-foreground'
                            }`}
                          >
                            {isSelected && (
                              <span className="absolute -left-[1px] top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-indigo-500" />
                            )}

                            <button
                              type="button"
                              onClick={() => select(item, child)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
                            >
                              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                                {child.title}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={(event) =>
                                deleteSubtopic(item, child.id, event)
                              }
                              className="mr-1 flex size-6 shrink-0 items-center justify-center text-muted-foreground/60 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/subtopic:opacity-100"
                              title={`Delete subtopic ${child.title}`}
                              aria-label={`Delete subtopic ${child.title}`}
                            >
                              <Trash2 className="size-3 text-red-600" />
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
          <p className="px-2.5 py-4 text-xs text-muted-foreground">
            No topics have been created for {meta.label} yet.
          </p>
        )}
      </nav>
    </aside>
  )

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background font-sans text-foreground selection:bg-indigo-500/20 selection:text-indigo-500">
      {/* Header */}

      <header className="relative z-[50] flex h-16 shrink-0 items-center justify-between border-b border-soft px-4 md:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <span className="text-lg font-semibold uppercase tracking-wider">
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        {/* Header actions */}

        <div className="flex items-center gap-2">
          {/* Search */}

          <div className="mx-4 hidden max-w-md flex-1 md:block">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="group flex w-full items-center justify-between border border-soft bg-muted/40 px-3.5 py-2 text-sm text-muted-foreground shadow-xs transition-all hover:border-border hover:bg-muted/70"
            >
              <div className="flex items-center gap-2.5">
                <Search className="size-4 transition-colors group-hover:text-foreground" />

                <span className="text-xs text-secondary">
                  Search {meta.label} docs...
                </span>
              </div>
            </button>
          </div>

          <Link
            to="/notes"
            className="hidden items-center gap-1.5 bg-background p-2 text-xs font-medium text-muted-foreground shadow-xs transition-all hover:bg-muted sm:flex"
            title="Notes"
          >
            <Home className="size-4" />
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            title="Search"
          >
            <Search className="size-5" />
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* BODY */}
      {/* ===================================================================== */}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebar}

        {/* =================================================================== */}
        {/* MAIN DOCUMENT SCROLL CONTAINER */}
        {/* =================================================================== */}

        <main
          ref={mainScrollRef}
          onScroll={handleMainScroll}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background"
        >
          <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-8 lg:py-14">
            {/* Breadcrumbs */}

            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link
                to="/notes"
                className="transition-colors hover:text-foreground"
              >
                <Home className="size-3.5" />
              </Link>

              <ChevronRight className="size-3.5 text-muted-foreground/60" />

              <span>{meta.label}</span>

              <ChevronRight className="size-3.5 text-muted-foreground/60" />

              <span
                className="cursor-pointer transition-colors hover:text-foreground"
                onClick={() => {
                  if (topic) {
                    select(topic, topic.subtopics[0])
                  }
                }}
              >
                {topic?.title ?? 'General'}
              </span>

              <ChevronRight className="size-3.5 text-muted-foreground/60" />

              <span className="px-2 py-0.5 font-semibold text-foreground">
                {subtopic?.title ?? 'Overview'}
              </span>
            </div>

            {/* Page Header */}

            <div className="mb-4 border-b border-soft pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                    {subtopic?.title ?? 'Select a subtopic'}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModal('content')}
                    disabled={!subtopic}
                    className="inline-flex cursor-pointer items-center gap-2 bg-indigo-600 p-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    title="Add content"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              {subtopic?.description && (
                <div className="mt-4 text-sm leading-relaxed text-secondary sm:text-base">
                  {subtopic.description}
                </div>
              )}
            </div>

            {/* Content */}

            {subtopic?.content && subtopic.content.length > 0 ? (
              <div className="flex flex-col gap-5">
                {subtopic.content.map((item) => (
                  <section
                    id={`content-${item.id}`}
                    key={item.id}
                    className="group relative scroll-mt-24 shadow-xs transition-all duration-200 hover:border-border"
                  >
                    <div className="mb-4 flex items-center justify-between pb-1">
                      <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                        {item.title}
                      </h2>

                      <button
                        type="button"
                        onClick={() => deleteContent(item.id)}
                        className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        title="Delete this block"
                        aria-label={`Delete content block ${item.title}`}
                      >
                        <Trash2 className="size-4 text-red-600" />
                      </button>
                    </div>

                    {/* Code */}

                    {item.type === 'code' ? (
                      <div className="relative overflow-hidden border border-soft bg-zinc-950 text-zinc-100 shadow-md">
                        <div className="flex items-center justify-between border-b border-soft bg-zinc-900/90 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="size-3 rounded-full bg-rose-500/80" />
                            <div className="size-3 rounded-full bg-amber-500/80" />
                            <div className="size-3 rounded-full bg-emerald-500/80" />

                            <span className="ml-2 font-mono text-xs text-zinc-400">
                              {item.title.toLowerCase().replace(/\s+/g, '-')}.
                              {item.language && !looksLikeGeneratedId(item.language)
                                ? item.language
                                : languageKey}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopy(item.content, item.id)}
                            className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="size-3.5 text-emerald-400" />

                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5" />

                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        <pre className="overflow-x-auto p-5 font-mono text-sm leading-6 text-zinc-200 selection:bg-indigo-500/40">
                          <code>{item.content}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="prose max-w-none text-base leading-relaxed text-secondary">
                        <p>{item.content}</p>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-4 flex size-14 items-center justify-center bg-indigo-500/10 text-indigo-500">
                  <FileText className="size-7" />
                </div>

                <h3 className="text-lg font-bold text-foreground">
                  No content in this section yet
                </h3>

                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Start documenting by adding a text explanation or code
                  snippet block.
                </p>

                <button
                  type="button"
                  onClick={() => setModal('content')}
                  disabled={!subtopic}
                  className="mt-5 inline-flex cursor-pointer items-center gap-2 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-4" />

                  <span>Create Content Block</span>
                </button>
              </div>
            )}

            {/* Prev / Next */}

            {allSubtopics.length > 0 && (
              <div className="mt-14 grid grid-cols-1 gap-4 border-t border-soft pt-8 sm:grid-cols-2">
                {prevSubtopic ? (
                  <button
                    type="button"
                    onClick={() =>
                      select(prevSubtopic.topic, prevSubtopic.subtopic)
                    }
                    className="group flex flex-col items-start border border-soft bg-card p-4 text-left shadow-xs transition-all hover:border-indigo-500/40 hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-indigo-500">
                      <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />

                      <span>Previous</span>
                    </div>

                    <div className="mt-1 w-full truncate text-sm text-secondary">
                      {prevSubtopic.subtopic.title}
                    </div>
                  </button>
                ) : (
                  <div />
                )}

                {nextSubtopic ? (
                  <button
                    type="button"
                    onClick={() =>
                      select(nextSubtopic.topic, nextSubtopic.subtopic)
                    }
                    className="group flex flex-col items-end border border-soft bg-card p-4 text-right shadow-xs transition-all hover:border-indigo-500/40 hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-indigo-500">
                      <span>Next</span>

                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </div>

                    <div className="mt-1 w-full truncate text-right text-sm text-secondary">
                      {nextSubtopic.subtopic.title}
                    </div>
                  </button>
                ) : (
                  <div />
                )}
              </div>
            )}
          </div>
        </main>

        {/* =================================================================== */}
        {/* RIGHT TOC */}
        {/* =================================================================== */}

        <aside className="hidden h-full min-h-0 w-64 shrink-0 overflow-y-auto overscroll-contain p-3 xl:flex xl:flex-col">
          <div className="w-full border border-soft bg-background/80 p-2 shadow-sm">
            <div className="px-2.5 pb-3 pt-1.5">
              <div className="text-sm font-medium tracking-tight text-foreground">
                Table of Content
              </div>
            </div>

            {toc.length > 0 ? (
              <nav className="w-full space-y-0.5">
                {toc.map((item) => {
                  const isActive = activeTocId === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollTo(item.id)}
                      aria-current={isActive ? 'location' : undefined}
                      className={`group relative flex w-full min-w-0 items-center px-2.5 py-2 text-left text-xs transition-all duration-150 ${
                        isActive
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-px -translate-y-1/2 rounded-full bg-indigo-500" />
                      )}

                      <span
                        className={`min-w-0 flex-1 truncate leading-5 ${
                          isActive ? 'font-medium' : 'font-normal'
                        }`}
                      >
                        {item.title}
                      </span>
                    </button>
                  )
                })}
              </nav>
            ) : (
              <div className="px-2.5 py-3">
                <p className="text-xs text-muted-foreground">
                  No sections in this subtopic.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ===================================================================== */}
      {/* SEARCH MODAL */}
      {/* ===================================================================== */}

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl overflow-hidden border border-soft bg-canvas shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center border-b border-soft bg-muted/30 px-4 py-3">
              <Search className="mr-3 size-5 text-muted-foreground" />

              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`Search ${meta.label} docs...`}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />

              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-3">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.topic.id}-${result.subtopic.id}-${result.contentItem?.id ?? index}`}
                      type="button"
                      onClick={() => {
                        select(result.topic, result.subtopic)

                        if (result.contentItem) {
                          window.setTimeout(() => {
                            scrollTo(result.contentItem!.id)
                          }, 150)
                        }

                        setSearchOpen(false)

                        setSearchQuery('')
                      }}
                      className="group flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-indigo-500/10"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-indigo-500">
                            {result.topic.title}
                          </span>

                          <span className="text-muted-foreground">/</span>

                          <span className="text-xs font-medium text-foreground">
                            {result.subtopic.title}
                          </span>
                        </div>

                        {result.contentItem && (
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground/80">
                              {result.contentItem.title}:
                            </span>{' '}
                            {result.contentItem.content.slice(0, 80)}
                            ...
                          </div>
                        )}
                      </div>

                      <ChevronRight className="ml-2 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-indigo-500" />
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{searchQuery}&rdquo; in {meta.label}{' '}
                  docs.
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Type to search through {meta.label} documentation.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DELETE MODAL */}
      {/* ===================================================================== */}

      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteModal(null)
            }
          }}
        >
          <div className="w-full max-w-lg border border-soft bg-canvas p-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-soft pb-4">
              <h2 className="text-lg font-bold capitalize text-foreground">
                Delete {deleteModal.type}
              </h2>

              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close delete confirmation"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="py-5">
              <p className="text-sm leading-relaxed text-foreground/90">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  &ldquo;{deleteModal.title}&rdquo;
                </span>
                ?
              </p>

              {deleteModal.type === 'topic' && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  This will also delete all subtopics and content inside this
                  topic.
                </p>
              )}

              {deleteModal.type === 'subtopic' && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  This will also delete all content blocks inside this
                  subtopic.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2.5 border-t border-soft pt-4">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                className="inline-flex items-center gap-2 bg-red-600 px-5 py-2 text-xs font-semibold text-destructive-foreground shadow-md transition-all hover:bg-destructive/90"
              >
                <Trash2 className="size-3.5" />
                Delete {deleteModal.type}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CREATE MODAL */}
      {/* ===================================================================== */}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg border border-soft bg-canvas p-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-soft pb-4">
              <h2 className="text-lg font-bold capitalize text-foreground">
                Create New {modal}
              </h2>

              <button
                type="button"
                onClick={resetModal}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="mt-5 flex flex-col gap-4" onSubmit={add}>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Title
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="border border-soft bg-muted/30 px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder={
                    modal === 'topic'
                      ? `e.g., ${meta.label} Advanced Concepts`
                      : modal === 'subtopic'
                        ? 'e.g., Error Handling'
                        : 'e.g., Example Code'
                  }
                />
              </label>

              {modal === 'content' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      Block Type
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setContentType('text')}
                        className={`flex items-center justify-center gap-2 border border-soft p-2.5 text-xs font-semibold transition-all ${
                          contentType === 'text'
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 ring-2 ring-indigo-500/20'
                            : 'border-soft bg-muted/20 text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <AlignLeft className="size-4" />

                        <span>Text / Paragraph</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setContentType('code')}
                        className={`flex items-center justify-center gap-2 border border-soft p-2.5 text-xs font-semibold transition-all ${
                          contentType === 'code'
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 ring-2 ring-indigo-500/20'
                            : 'border-soft bg-muted/20 text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Terminal className="size-4" />

                        <span>Code Snippet</span>
                      </button>
                    </div>
                  </div>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                    {contentType === 'code'
                      ? `Code Body (${meta.label})`
                      : 'Content Paragraph'}

                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      rows={6}
                      className="resize-y border border-soft bg-muted/30 p-3 font-mono text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      placeholder={
                        contentType === 'code'
                          ? codePlaceholder
                          : 'Write your documentation explanation here...'
                      }
                    />
                  </label>
                </>
              )}

              <div className="mt-2 flex justify-end gap-2.5 border-t border-soft pt-4">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    !title.trim() || (modal === 'content' && !content.trim())
                  }
                  className="cursor-pointer bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create {modal}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}