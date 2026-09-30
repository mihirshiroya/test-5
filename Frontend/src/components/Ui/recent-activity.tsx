import {
  CircleCheck,
  MessageSquare,
  Plus,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react"
import type { Activity } from "../Ui/analytics-data"

const ICONS: Record<Activity["kind"], LucideIcon> = {
  completed: CircleCheck,
  focus: Timer,
  milestone: Target,
  created: Plus,
  comment: MessageSquare,
}

// Optional category accent styling for a modern, lively look
const KIND_STYLES: Record<Activity["kind"], { badge: string; icon: string }> = {
  completed: {
    badge: "group-hover:border-emerald-500/40 group-hover:bg-emerald-500/10",
    icon: "group-hover:text-emerald-500",
  },
  focus: {
    badge: "group-hover:border-amber-500/40 group-hover:bg-amber-500/10",
    icon: "group-hover:text-amber-500",
  },
  milestone: {
    badge: "group-hover:border-purple-500/40 group-hover:bg-purple-500/10",
    icon: "group-hover:text-purple-500",
  },
  created: {
    badge: "group-hover:border-blue-500/40 group-hover:bg-blue-500/10",
    icon: "group-hover:text-blue-500",
  },
  comment: {
    badge: "group-hover:border-sky-500/40 group-hover:bg-sky-500/10",
    icon: "group-hover:text-sky-500",
  },
}

export function RecentActivity({ items }: { items: Activity[] }) {
  return (
    <div className="border border-soft animate-fadeIn flex h-full flex-col p-6">
      <h3 className="text-heading-5 text-primary">Recent activity</h3>
      <ol className="relative mt-5 flex flex-col">
        {items.map((item, i) => {
          const Icon = ICONS[item.kind]
          const kindStyle = KIND_STYLES[item.kind]
          const isFirst = i === 0
          const isLast = i === items.length - 1

          return (
            <li
              key={item.id}
              className="group relative flex gap-3 pb-5 last:pb-0 transition-all duration-300"
              style={{
                animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                animationDelay: `${i * 80}ms`,
              }}
            >
              {/* Connector Line */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px bg-[var(--color-border)] origin-top transition-all duration-500 group-hover:bg-primary/40 group-hover:w-[1.5px]"
                  style={{
                    animation: `growDown 500ms ease-out both`,
                    animationDelay: `${i * 80 + 100}ms`,
                  }}
                />
              )}

              {/* Icon Container Node */}
              <div className="relative z-10 shrink-0">
                {/* Subtle radar pulse ping for the most recent activity */}
                {isFirst && (
                  <span className="absolute inset-0 rounded-notion-full bg-primary/20 animate-ping pointer-events-none opacity-75" />
                )}

                <span
                  className={`relative skew-x-3 group-hover:skew-x-0 grid h-8 w-8 place-items-center rounded-notion-full border border-soft bg-surface text-steel shadow-sm transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-md ${kindStyle.badge}`}
                >
                  <Icon
                    className={`h-4 w-4 transition-all duration-300 ease-out group-hover:rotate-12 group-hover:scale-110 ${kindStyle.icon}`}
                  />
                </span>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pt-0.5 transition-transform duration-200 group-hover:translate-x-0.5">
                <p className="text-body-sm text-primary transition-colors duration-200 group-hover:text-primary-hover">
                  {item.text}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-caption text-stone">
                  <span>{item.meta}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.ago}</span>
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}