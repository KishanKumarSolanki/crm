import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import Icon from "../components/Icon"

// =========================
// CONSTANTS
// =========================

const STAGES = [
  { key: "discovery", label: "New Lead", bar: "bg-slate-400" },
  { key: "contacted", label: "Contacted", bar: "bg-sky-400" },
  { key: "qualified", label: "Qualified", bar: "bg-cyan-500" },
  { key: "meeting_booked", label: "Meeting Booked", bar: "bg-indigo-400" },
  { key: "follow_up", label: "Follow-up", bar: "bg-amber-400" },
  { key: "signed", label: "Closed & Signed", bar: "bg-violet-500" },
  { key: "active", label: "In Progress", bar: "bg-emerald-500" },
  { key: "in_revision", label: "In Revision", bar: "bg-orange-400" },
  { key: "delivered", label: "Delivered", bar: "bg-blue-600" },
]

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]))

const AVATAR_TONES = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-600",
  "from-slate-600 to-slate-800",
]

const ACTIVITY_TONES = {
  created: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  stage_change: "bg-violet-50 text-violet-600 ring-violet-100",
  task_created: "bg-amber-50 text-amber-600 ring-amber-100",
  task_completed: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  task_reopened: "bg-orange-50 text-orange-600 ring-orange-100",
  note: "bg-sky-50 text-sky-600 ring-sky-100",
  conversation: "bg-sky-50 text-sky-600 ring-sky-100",
  default: "bg-slate-100 text-slate-600 ring-slate-200",
}

const ACTIVITY_ICONS = {
  created: "plus",
  stage_change: "pipeline",
  task_created: "tasks",
  task_completed: "tasks",
  task_reopened: "tasks",
  note: "leads",
  conversation: "leads",
}

// Counter cards shown above the activity list
const ACTIVITY_COUNTERS = [
  {
    key: "new",
    label: "New leads",
    icon: "plus",
    chip: "bg-sky-50 text-sky-600 ring-sky-100",
    activeRing: "ring-sky-400 bg-sky-50/60",
    text: "text-sky-700",
  },
  {
    key: "followup",
    label: "Follow-ups",
    icon: "tasks",
    chip: "bg-amber-50 text-amber-600 ring-amber-100",
    activeRing: "ring-amber-400 bg-amber-50/60",
    text: "text-amber-700",
  },
  {
    key: "all",
    label: "Total",
    icon: "dashboard",
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    activeRing: "ring-slate-400 bg-slate-50",
    text: "text-slate-900",
  },
]

const DAY_MS = 86400000

// =========================
// HELPERS
// =========================

const initialOf = (name) => (name ? name.trim().charAt(0).toUpperCase() : "?")

const toneFor = (seed = "") => {
  const sum = [...String(seed)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_TONES[sum % AVATAR_TONES.length]
}

const formatDateTime = (value) => {
  if (!value) return ""
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const isOverdue = (value) => Boolean(value) && new Date(value).getTime() < Date.now()

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0)

const matchesPeriod = (dateStr, period) => {
  if (period === "all") return true

  const date = new Date(dateStr)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7))

  switch (period) {
    case "today":
      return date >= startOfToday && date < new Date(startOfToday.getTime() + DAY_MS)
    case "yesterday":
      return date >= new Date(startOfToday.getTime() - DAY_MS) && date < startOfToday
    case "this_week":
      return date >= startOfWeek
    case "last_week": {
      const lastWeekStart = new Date(startOfWeek)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      return date >= lastWeekStart && date < startOfWeek
    }
    default:
      return true
  }
}

// Decide which counter an activity belongs to.
// "created" -> New lead, "stage_change" -> Follow-up / New lead,
// based on the target stage in the description
const classifyActivity = (activity) => {
  if (activity.type === "created") return "new"

  if (activity.type === "stage_change") {
    const match = (activity.description || "").match(/\sto\s+(.+)$/i)
    const target = match?.[1]?.trim().toLowerCase()
    if (target === "follow-up" || target === "follow_up") return "followup"
    if (target === "new lead" || target === "discovery") return "new"
    return "stage"
  }

  return "other"
}

// =========================
// UI PRIMITIVES
// =========================

const Avatar = ({ name, seed, size = "md" }) => {
  const sizes = {
    sm: "h-8 w-8 text-[11px] rounded-lg",
    md: "h-10 w-10 text-sm rounded-xl",
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${toneFor(seed)} ${sizes[size]} font-bold text-white shadow-sm`}
    >
      {initialOf(name)}
    </div>
  )
}

const SectionCard = ({ title, subtitle, action, children, className = "" }) => (
  <section
    className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 ${className}`}
  >
    <header className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>
)

const ActionLink = ({ to, children }) => (
  <Link
    to={to}
    className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 no-underline transition hover:bg-indigo-50 hover:text-indigo-700"
  >
    {children}
  </Link>
)

const EmptyState = ({ icon = "dashboard", children }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <Icon name={icon} size={20} />
    </div>
    <p className="text-sm text-slate-400">{children}</p>
  </div>
)

const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />
)

const LoadingState = () => (
  <div className="space-y-6">
    <SkeletonBlock className="h-24" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonBlock key={i} className="h-36" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <SkeletonBlock className="h-80 xl:col-span-2" />
      <SkeletonBlock className="h-80" />
    </div>
  </div>
)

const StatCard = ({ label, value, icon, accent, helper, progress }) => (
  <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 sm:p-5">
    <div
      className={`absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.07] blur-2xl transition group-hover:opacity-[0.12] ${accent.glow}`}
    />

    <div className="relative flex items-start justify-between">
      <span className="text-[11px] font-semibold text-slate-500 sm:text-[13px]">{label}</span>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 sm:h-10 sm:w-10 ${accent.chip}`}>
        <Icon name={icon} size={16} />
      </div>
    </div>

    <div className="relative mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">{value}</div>

    <div className="relative mt-2 sm:mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-1 text-[10px] font-medium text-slate-400 sm:text-[11px]">
        <span className="truncate">{helper}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${accent.bar}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  </div>
)

const ActivityCounter = ({ config, count, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`group flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-px hover:shadow-sm ${
      active
        ? `border-transparent ring-2 ${config.activeRing}`
        : "border-slate-200 bg-white hover:border-slate-300"
    }`}
  >
    <div className="flex w-full items-center justify-between">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ${config.chip}`}>
        <Icon name={config.icon} size={14} />
      </span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-slate-900/70" />}
    </div>
    <div>
      <p className={`text-xl font-bold leading-none tabular-nums ${config.text}`}>{count}</p>
      <p className="mt-1 text-[11px] font-medium text-slate-500">{config.label}</p>
    </div>
  </button>
)

// =========================
// PAGE
// =========================

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [activityPeriod, setActivityPeriod] = useState("all")
  const [activityKind, setActivityKind] = useState("all")

  useEffect(() => {
    let active = true

    const fetchDashboardData = async () => {
      setLoading(true)

      const [leadsResult, tasksResult, activitiesResult] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(100),
      ])

      if (leadsResult.error) console.error("Leads:", leadsResult.error)
      if (tasksResult.error) console.error("Tasks:", tasksResult.error)
      if (activitiesResult.error) console.error("Activities:", activitiesResult.error)

      if (!active) return
      setLeads(leadsResult.data || [])
      setTasks(tasksResult.data || [])
      setActivities(activitiesResult.data || [])
      setLoading(false)
    }

    fetchDashboardData()
    return () => {
      active = false
    }
  }, [])

  // =========================
  // DERIVED DATA
  // =========================

  const stats = useMemo(() => {
    const totalLeads = leads.length
    const activeLeads = leads.filter((l) => l.stage === "active").length
    const deliveredLeads = leads.filter((l) => l.stage === "delivered").length
    const pendingTasks = tasks.filter((t) => t.status !== "completed").length
    const totalTasks = tasks.length

    return {
      totalLeads,
      activeLeads,
      deliveredLeads,
      pendingTasks,
      activePct: pct(activeLeads, totalLeads),
      deliveredPct: pct(deliveredLeads, totalLeads),
      pendingPct: pct(pendingTasks, totalTasks),
    }
  }, [leads, tasks])

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0]))
    leads.forEach((lead) => {
      if (lead.stage && lead.stage in counts) counts[lead.stage] += 1
    })
    return counts
  }, [leads])

  const followUpQueue = useMemo(
    () =>
      leads
        .filter((lead) => lead.stage === "follow_up" || lead.next_follow_up)
        .sort((a, b) => {
          const dateA = a.next_follow_up ? new Date(a.next_follow_up).getTime() : Number.MAX_SAFE_INTEGER
          const dateB = b.next_follow_up ? new Date(b.next_follow_up).getTime() : Number.MAX_SAFE_INTEGER
          return dateA - dateB
        }),
    [leads]
  )

  // Activities inside the selected date range, tagged with their counter type
  const periodActivities = useMemo(
    () =>
      activities
        .filter(
          (a) =>
            ["created", "stage_change"].includes(a.type) &&
            matchesPeriod(a.created_at, activityPeriod)
        )
        .map((a) => ({ ...a, kind: classifyActivity(a) })),
    [activities, activityPeriod]
  )

  const activityCounts = useMemo(() => {
    const counts = { all: periodActivities.length, new: 0, followup: 0 }
    periodActivities.forEach((a) => {
      if (a.kind in counts) counts[a.kind] += 1
    })
    return counts
  }, [periodActivities])

  const visibleActivities = useMemo(
    () =>
      activityKind === "all"
        ? periodActivities
        : periodActivities.filter((a) => a.kind === activityKind),
    [periodActivities, activityKind]
  )


  // =========================
  // RENDER
  // =========================

  if (loading) {
    return (
      <div className="w-full text-slate-900">
        <LoadingState />
      </div>
    )
  }

  const statCards = [
    {
      label: "Total Leads",
      value: stats.totalLeads,
      icon: "leads",
      helper: "All leads in CRM",
      progress: 100,
      accent: {
        chip: "bg-indigo-50 text-indigo-600 ring-indigo-100",
        bar: "from-indigo-500 to-violet-500",
        glow: "bg-indigo-500",
      },
    },
    {
      label: "Active Leads",
      value: stats.activeLeads,
      icon: "pipeline",
      helper: "In progress",
      progress: stats.activePct,
      accent: {
        chip: "bg-emerald-50 text-emerald-600 ring-emerald-100",
        bar: "from-emerald-500 to-teal-500",
        glow: "bg-emerald-500",
      },
    },
    {
      label: "Delivered",
      value: stats.deliveredLeads,
      icon: "tasks",
      helper: "Completed projects",
      progress: stats.deliveredPct,
      accent: {
        chip: "bg-blue-50 text-blue-600 ring-blue-100",
        bar: "from-blue-500 to-sky-500",
        glow: "bg-blue-500",
      },
    },
    {
      label: "Pending Tasks",
      value: stats.pendingTasks,
      icon: "tasks",
      helper: "Needs attention",
      progress: stats.pendingPct,
      accent: {
        chip: "bg-amber-50 text-amber-600 ring-amber-100",
        bar: "from-amber-400 to-orange-500",
        glow: "bg-amber-500",
      },
    },
  ]

  const quickActions = [
    { to: "/leads", icon: "plus", title: "Add Lead", text: "Create a new lead", accent: "bg-indigo-50 text-indigo-600" },
    { to: "/team-members", icon: "team", title: "Add Team Member", text: "Add someone to your team", accent: "bg-emerald-50 text-emerald-600" },
    { to: "/pipeline", icon: "pipeline", title: "Open Pipeline", text: "Manage lead stages", accent: "bg-violet-50 text-violet-600" },
    { to: "/tasks", icon: "tasks", title: "View Tasks", text: "Check pending work", accent: "bg-amber-50 text-amber-600" },
  ]

  const periodLabel = {
    all: "Recent",
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This week",
    last_week: "Last week",
  }[activityPeriod]

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* HEADER */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-gradient-to-tr from-sky-300/15 to-emerald-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600 ring-1 ring-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              CRM Overview
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-500">
              Keep track of your leads, tasks and team activity in one place.
            </p>
          </div>

          <div className="flex gap-2.5 max-sm:w-full">
            <Link
              to="/leads"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 no-underline shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:flex-none"
            >
              View Leads
            </Link>
            <Link
              to="/leads"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-md shadow-indigo-500/25 transition hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/30 sm:flex-none"
            >
              <Icon name="plus" size={16} />
              Add Lead
            </Link>
          </div>
        </div>
      </header>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* FOLLOW-UP + QUICK ACTIONS */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Follow-up Queue"
          subtitle={`${followUpQueue.length} lead${followUpQueue.length === 1 ? "" : "s"} need attention`}
          action={<ActionLink to="/leads">View leads →</ActionLink>}
        >
          {followUpQueue.length === 0 ? (
            <EmptyState icon="leads">No leads are waiting for follow-up.</EmptyState>
          ) : (
            <div className="-mx-2 flex flex-col">
              {followUpQueue.slice(0, 6).map((lead) => {
                const overdue = isOverdue(lead.next_follow_up)
                const dueLabel = lead.next_follow_up ? formatDateTime(lead.next_follow_up) : "Follow-up needed"

                return (
                  <Link
                    key={lead.id}
                    to={`/lead/${lead.id}`}
                    className="group flex items-center gap-4 rounded-xl px-2 py-3 text-inherit no-underline transition hover:bg-slate-50"
                  >
                    <Avatar name={lead.name} seed={lead.id} size="sm" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[lead.company, lead.service_name, lead.lead_source].filter(Boolean).join(" · ") || "No company or service details"}
                      </p>
                    </div>

                    <span
                      className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 sm:inline-flex ${
                        overdue
                          ? "bg-red-50 text-red-600 ring-red-100"
                          : "bg-indigo-50 text-indigo-700 ring-indigo-100"
                      }`}
                    >
                      {overdue ? "Overdue · " : ""}
                      {dueLabel}
                    </span>

                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500">→</span>
                  </Link>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Quick Actions" subtitle="Common CRM actions">
          <div className="flex flex-col gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.to}
                className="group flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-inherit no-underline transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.accent}`}>
                  <Icon name={action.icon} size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">{action.title}</p>
                  <p className="text-xs text-slate-500">{action.text}</p>
                </div>
                <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500">→</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ACTIVITY + RECENT LEADS */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          title="Activity"
          subtitle="New leads and stage changes"
          action={
            <select
              aria-label="Filter activity by date"
              value={activityPeriod}
              onChange={(e) => {
                setActivityPeriod(e.target.value)
                setActivityKind("all")
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
            >
              <option value="all">Recent</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This week</option>
              <option value="last_week">Last week</option>
            </select>
          }
        >
          {/* COUNTERS */}
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            {ACTIVITY_COUNTERS.map((counter) => (
              <ActivityCounter
                key={counter.key}
                config={counter}
                count={activityCounts[counter.key] ?? 0}
                active={activityKind === counter.key}
                onClick={() => setActivityKind(counter.key)}
              />
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50/80 px-3.5 py-2.5 text-[11px] text-slate-500">
            <span>
              {periodLabel}: <strong className="text-slate-700">{activityCounts.all}</strong> activities
            </span>
            <span>
              Pipeline now:{" "}
              <strong className="text-sky-700">{stageCounts.discovery}</strong> new ·{" "}
              <strong className="text-amber-700">{stageCounts.follow_up}</strong> follow-up
            </span>
          </div>

          {visibleActivities.length === 0 ? (
            <EmptyState icon="dashboard">No activity found for this filter.</EmptyState>
          ) : (
            <ol className="relative flex max-h-[420px] flex-col gap-1 overflow-y-auto pr-1">
              <span className="absolute bottom-3 left-[15px] top-3 w-px bg-slate-200" aria-hidden="true" />
              {visibleActivities.slice(0, 30).map((activity) => (
                <li key={activity.id} className="relative flex gap-3 rounded-xl py-2 pl-0 pr-1">
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${
                      ACTIVITY_TONES[activity.type] || ACTIVITY_TONES.default
                    }`}
                  >
                    <Icon name={ACTIVITY_ICONS[activity.type] || "dashboard"} size={15} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[13px] font-medium leading-snug text-slate-800">{activity.description}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(activity.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          title="Recent Leads"
          subtitle="Latest leads added to your CRM"
          action={<ActionLink to="/leads">View all →</ActionLink>}
        >
          {leads.length === 0 ? (
            <EmptyState icon="leads">No leads found.</EmptyState>
          ) : (
            <div className="-mx-2 flex flex-col">
              {leads.slice(0, 5).map((lead) => {
                return (
                  <Link
                    key={lead.id}
                    to={`/lead/${lead.id}`}
                    className="group flex items-center gap-3.5 rounded-xl px-2 py-3 text-inherit no-underline transition hover:bg-slate-50 max-sm:gap-2.5"
                  >
                    <Avatar name={lead.name} seed={lead.id} size="sm" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                      <p className="truncate text-xs text-slate-400">{lead.company || lead.email || "—"}</p>
                    </div>

                    <span className="hidden shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 md:inline-flex">
                      {STAGE_LABEL[lead.stage] || (lead.stage ? lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1) : "Unknown")}
                    </span>

                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500">→</span>
                  </Link>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
