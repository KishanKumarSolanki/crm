import { useEffect, useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { sendWelcomeEmailWhenContacted } from "../lib/email"
import Icon from "../components/Icon"

// =========================
// CONSTANTS
// =========================

const stages = [
  "discovery",
  "contacted",
  "qualified",
  "meeting_booked",
  "follow_up",
  "signed",
  "active",
  "in_revision",
  "delivered",
]

const stageLabels = {
  discovery: "New Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  meeting_booked: "Meeting Booked",
  follow_up: "Follow-up",
  signed: "Closed & Signed",
  active: "In Progress",
  in_revision: "In Revision",
  delivered: "Delivered",
}

const stageTone = {
  discovery: { pill: "bg-orange-50 text-orange-700 ring-orange-100", dot: "bg-orange-500" },
  contacted: { pill: "bg-violet-50 text-violet-700 ring-violet-100", dot: "bg-violet-500" },
  qualified: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-500" },
  meeting_booked: { pill: "bg-cyan-50 text-cyan-700 ring-cyan-100", dot: "bg-cyan-500" },
  follow_up: { pill: "bg-purple-50 text-purple-700 ring-purple-100", dot: "bg-purple-500" },
  signed: { pill: "bg-blue-50 text-blue-700 ring-blue-100", dot: "bg-blue-500" },
  active: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-500" },
  in_revision: { pill: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100", dot: "bg-fuchsia-500" },
  delivered: { pill: "bg-green-50 text-green-700 ring-green-100", dot: "bg-green-500" },
}

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
  task: "bg-amber-50 text-amber-600 ring-amber-100",
  conversation: "bg-sky-50 text-sky-600 ring-sky-100",
  note: "bg-sky-50 text-sky-600 ring-sky-100",
  default: "bg-slate-100 text-slate-600 ring-slate-200",
}

const ACTIVITY_ICONS = {
  created: "plus",
  stage_change: "pipeline",
  task: "tasks",
  conversation: "leads",
  note: "leads",
}

const CONTACT_METHODS = ["call", "email", "meeting", "whatsapp", "other"]

// =========================
// HELPERS
// =========================

const toneFor = (seed = "") => {
  const sum = [...String(seed)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_TONES[sum % AVATAR_TONES.length]
}

const initialOf = (name) => (name ? name.trim().charAt(0).toUpperCase() : "?")

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""

const capitalize = (value = "") => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "")

// =========================
// UI PRIMITIVES
// =========================

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600"

const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/30 disabled:translate-y-0 disabled:opacity-60"

const btnGhost =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"

const Avatar = ({ name, seed, size = "md" }) => {
  const sizes = {
    sm: "h-8 w-8 rounded-lg text-[11px]",
    md: "h-10 w-10 rounded-xl text-sm",
    lg: "h-[72px] w-[72px] rounded-2xl text-[28px]",
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${toneFor(seed)} ${sizes[size]} font-bold text-white shadow-md shadow-slate-900/10`}
    >
      {initialOf(name)}
    </div>
  )
}

const SectionCard = ({ title, subtitle, action, children, className = "", bodyClass = "" }) => (
  <section className={`${cardClass} overflow-hidden ${className}`}>
    <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
    <div className={bodyClass}>{children}</div>
  </section>
)

const CountBadge = ({ children }) => (
  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
    {children}
  </span>
)

const EmptyState = ({ icon = "dashboard", children }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <Icon name={icon} size={20} />
    </div>
    <p className="text-sm text-slate-400">{children}</p>
  </div>
)

const StatCard = ({ label, value, icon, chip, isText = false }) => (
  <div className={`${cardClass} group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5`}>
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${chip}`}>
      <Icon name={icon} size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate font-bold tracking-tight text-slate-900 ${isText ? "text-base" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  </div>
)

const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />
)

const LoadingState = () => (
  <div className="w-full space-y-5">
    <SkeletonBlock className="h-4 w-48" />
    <SkeletonBlock className="h-36" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonBlock key={i} className="h-24" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <SkeletonBlock className="h-80 xl:col-span-2" />
      <SkeletonBlock className="h-80" />
    </div>
  </div>
)

// =========================
// PAGE
// =========================

export default function LeadDetail() {
  const { id } = useParams()

  const [lead, setLead] = useState(null)
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [notes, setNotes] = useState([])

  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDue, setTaskDue] = useState("")
  const [conversationMethod, setConversationMethod] = useState("call")
  const [conversationText, setConversationText] = useState("")
  const [conversationOutcome, setConversationOutcome] = useState("")
  const [conversationFollowUp, setConversationFollowUp] = useState("")
  const [savingConversation, setSavingConversation] = useState(false)
  const [revenueAmount, setRevenueAmount] = useState("")
  const [savingRevenue, setSavingRevenue] = useState(false)
  const [savingConsent, setSavingConsent] = useState(false)
  const [userRole, setUserRole] = useState("")

  // =========================
  // FETCH ALL DATA
  // =========================

  const fetchAll = async () => {
    const { data: leadData, error: leadError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single()

    if (leadError) {
      console.error("Lead fetch error:", leadError)
      setLead(null)
      setLoading(false)
      return
    }

    setLead(leadData)
    setRevenueAmount(leadData.revenue_amount ?? "")

    const [tasksRes, activitiesRes, notesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("client_id", id)
        .order("due_date", { ascending: true }),

      supabase
        .from("activities")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),

      supabase
        .from("notes")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ])

    setTasks(tasksRes.data || [])
    setActivities(activitiesRes.data || [])
    setNotes(notesRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [id])

  useEffect(() => {
    let active = true
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      if (active) setUserRole(data?.role || "")
    }
    loadRole()
    return () => { active = false }
  }, [])

  // =========================
  // ACTIONS
  // =========================

  const logActivity = async (type, description) => {
    await supabase
      .from("activities")
      .insert({ client_id: id, type, description })
  }

  const updateStage = async (newStage) => {
    const oldStage = lead?.stage
    if (newStage === oldStage) return

    const { error } = await supabase
      .from("clients")
      .update({ stage: newStage })
      .eq("id", id)

    if (error) {
      alert(error.message)
      return
    }

    await logActivity(
      "stage_change",
      `Stage changed from ${stageLabels[oldStage] || oldStage || "Unknown"} to ${stageLabels[newStage] || newStage}`
    )

    const { error: eventError } = await supabase.functions.invoke("process-meta-events", {
      body: { limit: 20 },
    })
    if (eventError) console.warn("Meta conversion events will be retried later:", eventError.message)

    if (newStage === "contacted") {
      try {
        const emailResult = await sendWelcomeEmailWhenContacted({
          supabase,
          lead: { ...lead, stage: newStage },
        })
        if (emailResult.status === "sent") {
          alert(`Welcome email sent to ${lead.email}.`)
        } else if (emailResult.status === "missing_email") {
          alert("Stage updated, but this lead has no email address for the welcome email.")
        }
      } catch (emailError) {
        alert(`Stage updated, but the welcome email failed: ${emailError.message}`)
      }
    }

    fetchAll()
  }

  const updateRevenue = async (event) => {
    event.preventDefault()
    const value = revenueAmount === "" ? null : Number(revenueAmount)
    if (value !== null && (!Number.isFinite(value) || value < 0)) return

    setSavingRevenue(true)
    const { error } = await supabase
      .from("clients")
      .update({ revenue_amount: value })
      .eq("id", id)

    if (error) alert(`Could not save sale value: ${error.message}`)
    else fetchAll()
    setSavingRevenue(false)
  }

  const updateConsent = async (field, enabled) => {
    setSavingConsent(true)
    const changes = field === "email_marketing_opt_in"
      ? { email_marketing_opt_in: enabled, email_unsubscribed_at: enabled ? null : new Date().toISOString() }
      : { whatsapp_opt_in: enabled }
    const { error } = await supabase.from("clients").update(changes).eq("id", id)
    if (error) alert(`Could not update messaging consent: ${error.message}`)
    else setLead((current) => ({ ...current, ...changes }))
    setSavingConsent(false)
  }

  const addNote = async (e) => {
    e.preventDefault()
    if (!noteText.trim()) return

    const { error } = await supabase
      .from("notes")
      .insert([{ client_id: id, note: noteText.trim() }])

    if (error) {
      alert(error.message)
      return
    }

    setNoteText("")
    fetchAll()
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!taskTitle.trim()) return

    const { error } = await supabase.from("tasks").insert({
      client_id: id,
      title: taskTitle.trim(),
      due_date: taskDue ? new Date(taskDue) : new Date(Date.now() + 86400000),
      status: "pending",
    })

    if (error) {
      alert(error.message)
      return
    }

    await logActivity("task", `Task added: ${taskTitle.trim()}`)
    setTaskTitle("")
    setTaskDue("")
    fetchAll()
  }

  const addConversation = async (event) => {
    event.preventDefault()
    if (!conversationText.trim()) return
    setSavingConversation(true)
    const followUpAt = conversationFollowUp
      ? new Date(conversationFollowUp).toISOString()
      : null

    const { error: activityError } = await supabase.from("activities").insert({
      client_id: id,
      type: "conversation",
      contact_method: conversationMethod,
      description: conversationText.trim(),
      outcome: conversationOutcome.trim() || null,
      follow_up_at: followUpAt,
    })

    if (activityError) {
      alert(`Could not save conversation: ${activityError.message}`)
      setSavingConversation(false)
      return
    }

    if (followUpAt) {
      const { error: leadUpdateError } = await supabase
        .from("clients")
        .update({ next_follow_up: followUpAt })
        .eq("id", id)

      if (leadUpdateError) {
        alert(`Conversation saved, but follow-up date could not be updated: ${leadUpdateError.message}`)
      } else {
        const { error: taskError } = await supabase.from("tasks").insert({
          client_id: id,
          title: `Follow up with ${lead.name}`,
          due_date: followUpAt,
          status: "pending",
          priority: "normal",
          instructions: conversationOutcome.trim() || null,
        })
        if (taskError) alert(`Follow-up date saved, but task could not be created: ${taskError.message}`)
      }
    }

    setConversationText("")
    setConversationOutcome("")
    setConversationFollowUp("")
    setSavingConversation(false)
    fetchAll()
  }

  const markTaskDone = async (taskId) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", taskId)

    if (error) {
      alert(error.message)
      return
    }

    fetchAll()
  }

  // =========================
  // DERIVED DATA
  // =========================

  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status !== "completed"),
    [tasks]
  )
  const conversations = useMemo(
    () => activities.filter((activity) => activity.type === "conversation"),
    [activities]
  )
  const otherActivities = useMemo(
    () => activities.filter((activity) => activity.type !== "conversation"),
    [activities]
  )

  const sourceFields = [
    { label: "Lead source", value: lead?.lead_source },
    { label: "Campaign", value: lead?.utm_campaign },
    { label: "UTM source", value: lead?.utm_source },
    { label: "UTM medium", value: lead?.utm_medium },
  ]

  const tone = stageTone[lead?.stage] || { pill: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" }

  // =========================
  // STATES
  // =========================

  if (loading) {
    return (
      <div className="w-full text-slate-900">
        <LoadingState />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className={`${cardClass} flex flex-col items-center px-5 py-16 text-center`}>
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon name="leads" size={22} />
        </div>
        <h2 className="text-base font-semibold text-slate-800">Lead not found</h2>
        <p className="mb-5 mt-1 text-sm text-slate-400">This lead may have been deleted.</p>
        <Link to="/leads" className={btnPrimary}>
          ← Back to Leads
        </Link>
      </div>
    )
  }

  const statCards = [
    {
      label: "Pending Tasks",
      value: pendingTasks.length,
      icon: "tasks",
      chip: "bg-amber-50 text-amber-600 ring-amber-100",
    },
    {
      label: "Notes",
      value: notes.length,
      icon: "leads",
      chip: "bg-violet-50 text-violet-600 ring-violet-100",
    },
    {
      label: "Activities",
      value: activities.length,
      icon: "pipeline",
      chip: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    },
  ]

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* BREADCRUMB + BACK */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
          <Link to="/" className="no-underline transition hover:text-slate-700">CRM</Link>
          <span className="text-slate-300">/</span>
          <Link to="/leads" className="no-underline transition hover:text-slate-700">Leads</Link>
          <span className="text-slate-300">/</span>
          <span className="truncate font-medium text-slate-600">{lead.name}</span>
        </nav>

        <Link to="/leads" className={btnGhost}>
          ← Back to Leads
        </Link>
      </div>

      {/* HERO */}
      <section className={`${cardClass} relative overflow-hidden p-6 sm:p-7`}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/15 to-violet-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-52 w-52 rounded-full bg-gradient-to-tr from-sky-300/10 to-emerald-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <Avatar name={lead.name} seed={lead.id} size="lg" />

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                {lead.name}
              </h1>
              <p className="mt-1 truncate text-sm text-slate-500">
                {[lead.company, lead.service_name].filter(Boolean).join(" · ") || "No company or service"}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone.pill}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {stageLabels[lead.stage] || "Unknown"}
                </span>

                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 no-underline transition hover:bg-slate-200 hover:text-slate-900"
                  >
                    <Icon name="leads" size={12} />
                    {lead.email}
                  </a>
                )}

                {lead.phone && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    <Icon name="team" size={12} />
                    {lead.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[420px] lg:shrink-0">
            <div>
              <label className={labelClass} htmlFor="lead-stage">Stage</label>
              <select
                id="lead-stage"
                className={`${inputClass} cursor-pointer`}
                value={lead.stage || ""}
                onChange={(e) => updateStage(e.target.value)}
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabels[stage] || stage}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>
      </section>

      {userRole === "admin" && (
        <section className={`${cardClass} mb-5 p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Messaging consent</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Record channel-specific marketing permission provided by this client. Email unsubscribe requests are always honored.</p>
            </div>
            {lead.email_unsubscribed_at && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">Unsubscribed {formatDate(lead.email_unsubscribed_at)}</span>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition hover:border-indigo-200 hover:bg-indigo-50/30">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={Boolean(lead.email_marketing_opt_in && !lead.email_unsubscribed_at)} disabled={savingConsent} onChange={(event) => updateConsent("email_marketing_opt_in", event.target.checked)} />
              <span><strong className="block text-xs font-semibold text-slate-800">Email marketing</strong><span className="mt-1 block text-[11px] leading-4 text-slate-500">Client has agreed to receive email campaigns.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition hover:border-indigo-200 hover:bg-indigo-50/30">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={Boolean(lead.whatsapp_opt_in)} disabled={savingConsent} onChange={(event) => updateConsent("whatsapp_opt_in", event.target.checked)} />
              <span><strong className="block text-xs font-semibold text-slate-800">WhatsApp messages</strong><span className="mt-1 block text-[11px] leading-4 text-slate-500">Client has explicitly opted in on WhatsApp.</span></span>
            </label>
          </div>
        </section>
      )}

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      {/* CONVERSATION + ATTRIBUTION */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Log a conversation"
          subtitle="Record the discussion and schedule the next follow-up."
          action={
            lead.next_follow_up ? (
              <span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100">
                Next: {formatDate(lead.next_follow_up)}
              </span>
            ) : null
          }
        >
          <form onSubmit={addConversation} className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="conv-method">Contact method</label>
              <select
                id="conv-method"
                className={`${inputClass} cursor-pointer`}
                value={conversationMethod}
                onChange={(e) => setConversationMethod(e.target.value)}
              >
                {CONTACT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {capitalize(method)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="conv-followup">Next follow-up</label>
              <input
                id="conv-followup"
                type="datetime-local"
                className={inputClass}
                value={conversationFollowUp}
                onChange={(e) => setConversationFollowUp(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="conv-text">Discussion</label>
              <textarea
                id="conv-text"
                className={`${inputClass} h-auto min-h-[96px] resize-y py-2.5`}
                placeholder="What did you discuss with the lead?"
                value={conversationText}
                onChange={(e) => setConversationText(e.target.value)}
                required
                maxLength={3000}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="conv-outcome">Outcome / follow-up note</label>
              <input
                id="conv-outcome"
                className={inputClass}
                value={conversationOutcome}
                onChange={(e) => setConversationOutcome(e.target.value)}
                placeholder="Decision, next step, or reminder"
                maxLength={1000}
              />
            </div>

            <div className="flex justify-end md:col-span-2">
              <button type="submit" disabled={savingConversation} className={btnPrimary}>
                {savingConversation ? "Saving..." : "Save conversation"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Marketing & sale value"
          subtitle="Captured from the landing page"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 sm:p-6">
            {sourceFields.map((field) => (
              <div key={field.label} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{field.label}</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-700" title={field.value || ""}>
                  {field.value || "—"}
                </p>
              </div>
            ))}
          </div>

          <form
            onSubmit={updateRevenue}
            className="border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6"
          >
            <label className={labelClass} htmlFor="revenue">Confirmed sale amount (INR)</label>
            <div className="flex gap-2">
              <input
                id="revenue"
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={revenueAmount}
                onChange={(e) => setRevenueAmount(e.target.value)}
                placeholder="Leave blank until sale"
              />
              <button type="submit" disabled={savingRevenue} className={`${btnGhost} h-10 shrink-0`}>
                {savingRevenue ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Add the confirmed amount to make revenue and ROAS reports useful.
            </p>
          </form>
        </SectionCard>
      </div>

      {/* CONVERSATION HISTORY FOR THIS LEAD ONLY */}
      <SectionCard
        title="Conversation history"
        subtitle={`Saved conversations for ${lead.name}`}
        action={<CountBadge>{conversations.length}</CountBadge>}
      >
        {conversations.length === 0 ? (
          <EmptyState icon="leads">No conversations recorded for this lead yet.</EmptyState>
        ) : (
          <ol className="divide-y divide-slate-100">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md bg-violet-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-violet-700 ring-1 ring-violet-100">
                    {conversation.contact_method || "Conversation"}
                  </span>
                  <time className="text-[11px] text-slate-400" dateTime={conversation.created_at}>
                    {formatDate(conversation.created_at)}
                  </time>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {conversation.description}
                </p>
                {conversation.outcome && (
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-700">Outcome / follow-up note: </span>
                    {conversation.outcome}
                  </p>
                )}
                {conversation.follow_up_at && (
                  <p className="mt-2 text-xs font-medium text-indigo-700">
                    Next follow-up: {formatDate(conversation.follow_up_at)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      {/* TASKS + NOTES */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard
          title="Tasks"
          subtitle={`${pendingTasks.length} pending · ${tasks.length} total`}
          action={<CountBadge>{tasks.length}</CountBadge>}
        >
          <form
            onSubmit={addTask}
            className="flex flex-col gap-2.5 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:p-5"
          >
            <input
              className={`${inputClass} flex-1`}
              placeholder="New task title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <input
              type="date"
              className={`${inputClass} sm:w-[160px] sm:shrink-0`}
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
            />
            <button type="submit" className={`${btnPrimary} sm:shrink-0`}>
              <Icon name="plus" size={15} />
              Add
            </button>
          </form>

          {tasks.length === 0 ? (
            <EmptyState icon="tasks">No tasks yet.</EmptyState>
          ) : (
            <div className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const done = task.status === "completed"
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50/70"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${done ? "bg-emerald-500" : "bg-amber-400"}`}
                      />
                      <div className="min-w-0">
                        <p
                          className={`truncate text-sm font-semibold ${
                            done ? "text-slate-400 line-through" : "text-slate-900"
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : "no due date"}
                        </p>
                      </div>
                    </div>

                    {done ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        Completed
                      </span>
                    ) : (
                      <button type="button" className={`${btnGhost} shrink-0`} onClick={() => markTaskDone(task.id)}>
                        Mark done
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Notes"
          subtitle="Internal notes, visible to your team"
          action={<CountBadge>{notes.length}</CountBadge>}
        >
          <form
            onSubmit={addNote}
            className="flex flex-col gap-2.5 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5"
          >
            <textarea
              className={`${inputClass} h-auto min-h-[88px] resize-y py-2.5`}
              placeholder="Write a note about this lead..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="flex justify-end">
              <button type="submit" className={btnPrimary}>
                <Icon name="plus" size={15} />
                Add note
              </button>
            </div>
          </form>

          {notes.length === 0 ? (
            <EmptyState icon="leads">No notes yet.</EmptyState>
          ) : (
            <div className="divide-y divide-slate-100">
              {notes.map((note) => (
                <div key={note.id} className="px-5 py-3.5 transition hover:bg-slate-50/70">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{note.note}</p>
                  <span className="mt-1.5 block text-[11px] text-slate-400">{formatDate(note.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ACTIVITY TIMELINE */}
      <SectionCard
        title="Other activity"
        subtitle="Updates recorded for this lead"
        action={<CountBadge>{otherActivities.length}</CountBadge>}
      >
        {otherActivities.length === 0 ? (
          <EmptyState icon="dashboard">No activity recorded.</EmptyState>
        ) : (
          <ol className="relative px-5 py-4 sm:px-6">
            <span className="absolute bottom-6 left-[37px] top-6 w-px bg-slate-200 sm:left-[41px]" aria-hidden="true" />
            {otherActivities.map((activity) => (
              <li key={activity.id} className="relative flex gap-4 py-3">
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${
                    ACTIVITY_TONES[activity.type] || ACTIVITY_TONES.default
                  }`}
                >
                  <Icon name={ACTIVITY_ICONS[activity.type] || "dashboard"} size={15} />
                </div>

                <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold capitalize text-slate-900">
                      {(activity.type || "activity").replace(/_/g, " ")}
                    </p>
                    <span className="text-[11px] text-slate-400">{formatDate(activity.created_at)}</span>
                  </div>

                  {activity.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{activity.description}</p>
                  )}

                  {(activity.contact_method || activity.outcome) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {activity.contact_method && (
                        <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-violet-700 ring-1 ring-violet-100">
                          via {activity.contact_method}
                        </span>
                      )}
                      {activity.outcome && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Outcome: {activity.outcome}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  )
}
