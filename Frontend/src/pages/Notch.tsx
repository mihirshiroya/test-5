"use client"

import React, { useState } from "react"
import { X } from "lucide-react"

import {
  useActiveTask,
  useTaskStore,
  formatClock,
} from "../store/slices/taskSlice"

import { TimerPanel } from "../components/Ui/timer-panel"
import { useAuth } from "../hooks/useAuth"

interface NotchNavbarProps {
  brand?: string
  ctaLabel?: string
  ctaHref?: string
  barBg?: string
  pageBg?: string
  ctaBg?: string
  radius?: number
}

export default function NotchNavbar({
  brand = "Notch Buddy",
  ctaLabel = "Buy lifetime license",
  ctaHref = "#",
  barBg = "#17110F",
  pageBg = "#F5E8DF",
  ctaBg = "#FA6F45",
  radius = 16,
}: NotchNavbarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // --------------------------------------------------
  // IMPORTANT:
  // ALL HOOKS MUST RUN BEFORE ANY CONDITIONAL RETURN
  // --------------------------------------------------

  const { isAuthenticated } = useAuth()

  const { hasActiveTask } = useTaskStore()

  const { remainingSeconds: remaining } = useActiveTask()

  // --------------------------------------------------
  // Authentication guard
  // --------------------------------------------------

  if (!isAuthenticated) {
    return null
  }

  // --------------------------------------------------
  // Timer
  // --------------------------------------------------

  const timerText = hasActiveTask
    ? formatClock(Math.max(0, Math.floor(remaining)))
    : "00:00"

  return (
    <>
      {/* =========================
          NOTCH
      ========================== */}
      <header className="fixed left-1/2 top-0 z-[9999] -translate-x-1/2">
        <nav
          className="
            pointer-events-auto
            relative
            flex
            w-fit
            max-w-[95vw]
            items-center
            gap-5
            rounded-b-2xl
            border-b-2
            border-soft
            bg-mauve-950
            px-4
            py-1
            shadow-none
            outline-none
          "
          style={{
            backgroundColor: barBg,
          }}
        >
          {/* =========================
              LEFT FLARE
          ========================== */}
          <span
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              bottom-[28px]
              right-full
              overflow-hidden
            "
            style={{
              width: radius,
              height: radius,
              backgroundColor: barBg,
            }}
          >
            <span
              className="
                absolute
                right-0
                top-0
                h-[200%]
                w-[200%]
                rounded-t-full
                border
                border-soft
                bg-[var(--color-background)]
              "
            />
          </span>

          {/* =========================
              RIGHT FLARE
          ========================== */}
          <span
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              bottom-[28px]
              left-full
              overflow-hidden
            "
            style={{
              width: radius,
              height: radius,
              backgroundColor: barBg,
            }}
          >
            <span
              className="
                absolute
                left-0
                top-0
                h-[200%]
                w-[200%]
                rounded-t-full
                border
                border-soft
                bg-[var(--color-background)]
              "
            />
          </span>

          {/* =========================
              TIMER NOTCH BUTTON
          ========================== */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open focus timer"
            className="
              group
              flex
              h-9
              items-center
              justify-center
              gap-2
            "
          >
            {/* Status dot */}
            <span
              className={`
                h-1.5
                w-1.5
                shrink-0
                rounded-full
                ${
                  hasActiveTask
                    ? "animate-pulse bg-green-400"
                    : "bg-white/30"
                }
              `}
            />

            {/* Timer */}
            <span
              className="
                font-mono
                text-[13px]
                font-medium
                tabular-nums
                tracking-tight
                text-white
              "
            >
              {timerText}
            </span>
          </button>
        </nav>
      </header>

      {/* =========================
          SIDEBAR OVERLAY
      ========================== */}
      {sidebarOpen && (
        <div
          className="
            fixed
            inset-0
            z-[105]
            bg-black/30
            backdrop-blur-[2px]
          "
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* =========================
          TIMER SIDEBAR
      ========================== */}
      <aside
        className={`
          fixed
          right-0
          top-0
          z-[110]
          h-dvh
          w-[390px]
          max-w-[92vw]
          border-l
          border-soft
          bg-canvas
          shadow-2xl
          transition-transform
          duration-300
          ease-out
          ${
            sidebarOpen
              ? "translate-x-0"
              : "translate-x-full"
          }
        `}
      >
        {/* =========================
            SIDEBAR HEADER
        ========================== */}
        <div
          className="
            flex
            h-14
            items-center
            justify-between
            border-b
            border-soft
            px-4
          "
        >
          <div className="flex items-center gap-2">
            {/* Timer status */}
            <div
              className={`
                h-2
                w-2
                rounded-full
                ${
                  hasActiveTask
                    ? "animate-pulse bg-green-500"
                    : "bg-muted-foreground/40"
                }
              `}
            />

            <span className="text-sm font-semibold text-foreground">
              Focus Timer
            </span>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close timer"
            className="
              flex
              size-8
              items-center
              justify-center
              rounded-lg
              text-muted-foreground
              transition-colors
              hover:bg-muted
              hover:text-foreground
            "
          >
            <X size={17} />
          </button>
        </div>

        {/* =========================
            TIMER PANEL
        ========================== */}
        <div className="h-[calc(100dvh-56px)] overflow-hidden">
          <TimerPanel />
        </div>
      </aside>
    </>
  )
}