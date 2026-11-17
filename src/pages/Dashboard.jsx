import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import Icon from "../components/Icon"
import { formatIndiaDateTime, INDIA_TIME_ZONE, indiaDateInputValue, parseDateTime } from "../lib/time"

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
  return formatIndiaDateTime(value, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// "2026-11" key (India time) from a created_at value
const monthKeyOf = (value) => {
  const d = parseDateTime(value)
  return d ? indiaDateInputValue(d).slice(0, 7) : null
}

const dayKeyOf = (value) => {
  const d = parseDateTime(value)
  return d ? indiaDateInputValue(d) : null
}

// "2026-11" -> "November 2026"
const monthLabelOf = (key) => {
  const [year, month] = key.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

const parseAppointmentTime = (message) => {
  const match = String(message || "").match(/Appointment Requested:\s*(?:[A-Za-z]+,\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*\(([^)]*)\)/i)
  if (!match) return null
  const [, dayText, monthText, yearText, hourText, minuteText, meridiem, zoneText] = match
  const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(monthText.toLowerCase())
  if (month < 0) return null
  const day = Number(dayText)
  const year = Number(yearText)
  const hour12 = Number(hourText)
  const minute = Number(minuteText)
  if (day < 1 || day > 31 || hour12 < 1 || hour12 > 12 || minute > 59) return null
  const zone = zoneText.trim()
  let offsetMinutes
  if (/\bIST\b|India Standard Time/i.test(zone)) {
    offsetMinutes = 330
  } else {
    const offsetMatch = zone.match(/(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?/i)
    if (!offsetMatch) return null
    offsetMinutes = (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] || 0)) * (offsetMatch[1] === "+" ? 1 : -1)
  }
  const hour = hour12 % 12 + (meridiem.toUpperCase() === "PM" ? 12 : 0)
  const localDate = new Date(Date.UTC(year, month, day, hour, minute))
  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== month || localDate.getUTCDate() !== day) return null
  return new Date(localDate.getTime() - offsetMinutes * 60_000).toISOString()
}

const formatAppointmentTime = (value) => formatIndiaDateTime(value, {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const formatCompactAppointmentTime = (value) => {
  const date = parseDateTime(value)
  return date
    ? date.toLocaleString("en-IN", {
        timeZone: INDIA_TIME_ZONE,
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h12",
      })
    : ""
}

const isOverdue = (value) => {
  const d = parseDateTime(value)
  return Boolean(d) && d.getTime() < Date.now()
}

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0)

const matchesPeriod = (dateStr, period) => {
  if (period === "all") return true

  const date = parseDateTime(dateStr)
  if (!date) return false
  const now = new Date()
  const startOfToday = new Date(`${indiaDateInputValue(now)}T00:00:00+05:30`)
  const indiaCalendarToday = new Date(`${indiaDateInputValue(now)}T00:00:00Z`)
  const startOfWeek = new Date(startOfToday.getTime() - ((indiaCalendarToday.getUTCDay() + 6) % 7) * DAY_MS)

  switch (period) {
    case "today":
      return date >= startOfToday && date < new Date(startOfToday.getTime() + DAY_MS)
    case "yesterday":
      return date >= new Date(startOfToday.getTime() - DAY_MS) && date < startOfToday
    case "this_week":
      return date >= startOfWeek
    case "last_week": {
      const lastWeekStart = new Date(startOfWeek.getTime() - 7 * DAY_MS)
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
    <SkeletonBlock className="h-56" />
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[0, 1].map((i) => (
          <SkeletonBlock key={i} className="h-36" />
        ))}
      </div>
      <SkeletonBlock className="h-16" />
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <SkeletonBlock className="h-80 xl:col-span-2" />
      <SkeletonBlock className="h-80" />
    </div>
  </div>
)

const TotalLeadsCard = ({ total, categories, months, selectedMonth, onMonthChange }) => (
  <div className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 sm:p-8">
    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500 opacity-[0.08] blur-2xl transition group-hover:opacity-[0.14]" />
    <div className="absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-violet-400 opacity-[0.06] blur-3xl" />

    <div className="relative">
      {/* TITLE */}
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <Icon name="leads" size={16} />
        </span>
        <span className="text-sm font-semibold text-slate-500 sm:text-base">Total Leads</span>
      </div>

      {/* NUMBER (left) + MONTH FILTER (right) */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">{total}</p>
          <Link to="/leads" className="mt-2 inline-block text-xs font-medium text-slate-400 no-underline transition hover:text-indigo-600">
            All leads in CRM →
          </Link>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="leads-month-filter" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Filter by month
          </label>
          <select
            id="leads-month-filter"
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="h-10 w-44 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 sm:w-52"
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CATEGORY BREAKDOWN */}
      <div className="mt-5 space-y-2">
        {categories.map((category, index) => (
          <Link
            key={category.id}
            to={`/leads?category=${category.id}`}
            className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-inherit no-underline transition hover:scale-[1.01] hover:shadow-sm sm:py-3.5 ${
              index === 0
                ? "border-indigo-100/80 bg-indigo-50/50 hover:border-indigo-200 hover:bg-indigo-100/70"
                : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="truncate text-xs font-semibold text-slate-600 sm:text-sm">{category.label}</span>
            <span className="shrink-0 text-lg font-bold leading-none text-slate-900 sm:text-xl">{category.count}</span>
          </Link>
        ))}
      </div>
    </div>
  </div>
)

const StatCard = ({ label, value, icon, accent, helper, progress, compact = false, to }) => {
  const content = (
    <>
      <div
        className={`absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.07] blur-2xl transition group-hover:opacity-[0.12] ${accent.glow}`}
      />

      {compact ? (
        <>
          <div className="relative flex items-center gap-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${accent.chip}`}>
              <Icon name={icon} size={15} />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-500 sm:text-[13px]">{label}</p>
                <p className="truncate text-[10px] font-medium text-slate-400">{helper}</p>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{value}</span>
            </div>
          </div>
          <div className="relative mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${accent.bar}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
    </>
  )

  const className = `group relative block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 hover:border-slate-300 ${to ? "cursor-pointer no-underline text-inherit" : ""} ${compact ? "p-3 sm:px-5 sm:py-3" : "p-3 sm:p-5"}`

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}

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
  const [appointmentNotes, setAppointmentNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState("all")
  const [selectedLeadDate, setSelectedLeadDate] = useState("")
  const [activityPeriod, setActivityPeriod] = useState("all")
  const [activityKind, setActivityKind] = useState("all")

  useEffect(() => {
    let active = true

    const fetchDashboardData = async () => {
      setLoading(true)

      const [leadsResult, tasksResult, activitiesResult, notesResult] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("notes").select("client_id,note,created_at").ilike("note", "%Appointment Requested:%").order("created_at", { ascending: false }),
      ])

      if (leadsResult.error) console.error("Leads:", leadsResult.error)
      if (tasksResult.error) console.error("Tasks:", tasksResult.error)
      if (activitiesResult.error) console.error("Activities:", activitiesResult.error)
      if (notesResult.error) console.error("Appointment notes:", notesResult.error)

      if (!active) return
      setLeads(leadsResult.data || [])
      setTasks(tasksResult.data || [])
      setActivities(activitiesResult.data || [])
      setAppointmentNotes(notesResult.data || [])
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

  // Months that have leads, newest first (for the month filter)
  const leadMonths = useMemo(() => {
    const keys = new Set()
    leads.forEach((lead) => {
      const key = monthKeyOf(lead.created_at)
      if (key) keys.add(key)
    })
    return [...keys]
      .sort((a, b) => (a < b ? 1 : -1))
      .map((key) => ({ key, label: monthLabelOf(key) }))
  }, [leads])

  // Leads filtered by the selected month
  const filteredLeads = useMemo(
    () =>
      selectedMonth === "all"
        ? leads
        : leads.filter((lead) => monthKeyOf(lead.created_at) === selectedMonth),
    [leads, selectedMonth]
  )

  const recentLeads = useMemo(
    () =>
      selectedLeadDate
        ? leads.filter((lead) => dayKeyOf(lead.created_at) === selectedLeadDate)
        : leads,
    [leads, selectedLeadDate]
  )

  const categoryCounts = useMemo(() => {
    const counts = [
      { id: "igs", label: "IGS Landing Page", count: 0 },
      { id: "landing-page", label: "Landing Page", count: 0 },
      { id: "dm", label: "Digital Marketing", count: 0 },
    ]

    filteredLeads.forEach((lead) => {
      const source = String(lead.lead_source || "").trim().toLowerCase().replace(/[_-]+/g, " ")
      if (/\bigs\b|institute growth system/.test(source)) counts[0].count += 1
      else if (/landing pages?/.test(source)) counts[1].count += 1
      else if (/\bdm\b|digital marketing/.test(source)) counts[2].count += 1
    })

    return counts.sort((a, b) => b.count - a.count)
  }, [filteredLeads])

  const stats = useMemo(() => {
    const totalLeads = leads.length
    const activeLeads = leads.filter((l) => l.stage === "signed" || l.stage === "active").length
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

  const followUpQueue = useMemo(() => {
    const appointmentsByLead = new Map()
    appointmentNotes.forEach((note) => {
      const appointmentAt = parseAppointmentTime(note.note)
      const key = String(note.client_id)
      if (appointmentAt && !appointmentsByLead.has(key)) appointmentsByLead.set(key, appointmentAt)
    })

    return leads
      .map((lead) => ({
        ...lead,
        dashboardFollowUpAt: lead.next_follow_up || appointmentsByLead.get(String(lead.id)) || null,
      }))
      .filter((lead) => lead.stage === "follow_up" || lead.dashboardFollowUpAt)
      .sort((a, b) => {
        const dateA = a.dashboardFollowUpAt ? new Date(a.dashboardFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER
        const dateB = b.dashboardFollowUpAt ? new Date(b.dashboardFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER
        return dateA - dateB
      })
  }, [leads, appointmentNotes])

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
      label: "Active Leads",
      value: stats.activeLeads,
      icon: "pipeline",
      helper: "Closed & Signed",
      progress: stats.activePct,
      to: "/leads?stage=active",
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
      to: "/leads?stage=delivered",
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
      to: "/tasks?status=pending",
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
      {/* TOTAL LEADS + MONTH FILTER */}
      <TotalLeadsCard
        total={filteredLeads.length}
        categories={categoryCounts}
        months={leadMonths}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* STATS */}
      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {statCards.slice(0, 2).map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
        <StatCard {...statCards[2]} compact />
      </div>

      <SectionCard
        title="Recent Leads"
        subtitle={`${recentLeads.length} lead${recentLeads.length === 1 ? "" : "s"} ${selectedLeadDate ? "on selected day" : "in CRM, newest first"}`}
        action={
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                Day
                <input
                  type="date"
                  value={selectedLeadDate}
                  onChange={(event) => setSelectedLeadDate(event.target.value)}
                  className="h-8 w-[132px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                />
              </label>
              {selectedLeadDate && (
                <button
                  type="button"
                  onClick={() => setSelectedLeadDate("")}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  All days
                </button>
              )}
            </div>
            <ActionLink to="/leads">View all →</ActionLink>
          </div>
        }
      >
        {recentLeads.length === 0 ? (
          <EmptyState icon="leads">
            {selectedLeadDate ? "No leads were added on this day." : "No leads found."}
          </EmptyState>
        ) : (
          <div className="-mx-2 flex max-h-[360px] flex-col overflow-y-auto overscroll-contain pr-1">
            {recentLeads.map((lead) => (
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
            ))}
          </div>
        )}
      </SectionCard>

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
                const overdue = isOverdue(lead.dashboardFollowUpAt)
                const dueLabel = lead.dashboardFollowUpAt ? formatAppointmentTime(lead.dashboardFollowUpAt) : "Follow-up needed"

                return (
                  <Link
                    key={lead.id}
                    to={`/lead/${lead.id}`}
                    className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-3 text-inherit no-underline transition hover:bg-slate-50 sm:flex-nowrap sm:gap-4"
                  >
                    <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-auto sm:flex-1">
                      <Avatar name={lead.name} seed={lead.id} size="sm" />

                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-slate-900 sm:truncate">{lead.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[lead.company, lead.service_name, lead.lead_source].filter(Boolean).join(" · ") || "No company or service details"}
                        </p>
                      </div>
                      <span className="ml-auto text-slate-300 sm:hidden">→</span>
                    </div>

                    <span
                      className={`ml-11 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold leading-4 ring-1 sm:ml-auto sm:px-2.5 sm:py-1 sm:text-[11px] sm:leading-normal ${
                        overdue
                          ? "bg-red-50 text-red-600 ring-red-100"
                          : "bg-indigo-50 text-indigo-700 ring-indigo-100"
                      }`}
                    >
                      <span className="sm:hidden">
                        {lead.dashboardFollowUpAt ? formatCompactAppointmentTime(lead.dashboardFollowUpAt) : "Follow-up needed"}
                      </span>
                      <span className="hidden sm:inline">
                        {overdue ? "Overdue · " : lead.dashboardFollowUpAt ? "Scheduled · " : ""}
                        {dueLabel}
                      </span>
                    </span>

                    <span className="hidden text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 sm:inline">→</span>
                  </Link>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Quick Actions" subtitle="Common CRM actions" className="hidden sm:block">
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

      {/* ACTIVITY */}
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
    </div>
  )
}