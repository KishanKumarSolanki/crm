import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import readXlsxFile from "read-excel-file/browser"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"
import Icon from "../components/Icon"

// =========================
// CONSTANTS
// =========================

const STAGE_LABELS = {
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

const STAGE_FILTER_OPTIONS = [
  { value: "all", label: "All stages" },
  { value: "discovery", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "meeting_booked", label: "Meeting Booked" },
  { value: "follow_up", label: "Follow-up" },
  { value: "signed", label: "Closed & Signed" },
  { value: "active", label: "In Progress" },
  { value: "in_revision", label: "In Revision" },
  { value: "delivered", label: "Delivered" },
]

const STAGE_STYLES = {
  discovery: { badge: "bg-orange-50 text-orange-700 ring-orange-100", dot: "bg-orange-500" },
  contacted: { badge: "bg-violet-50 text-violet-700 ring-violet-100", dot: "bg-violet-500" },
  qualified: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-500" },
  meeting_booked: { badge: "bg-cyan-50 text-cyan-700 ring-cyan-100", dot: "bg-cyan-500" },
  follow_up: { badge: "bg-purple-50 text-purple-700 ring-purple-100", dot: "bg-purple-500" },
  signed: { badge: "bg-blue-50 text-blue-700 ring-blue-100", dot: "bg-blue-500" },
  active: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-500" },
  in_revision: { badge: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100", dot: "bg-fuchsia-500" },
  delivered: { badge: "bg-green-50 text-green-700 ring-green-100", dot: "bg-green-500" },
  default: { badge: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
}

const AVATAR_TONES = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-600",
  "from-slate-600 to-slate-800",
]

const PAGE_SIZES = [10, 25, 50]
const DAY_MS = 86400000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// =========================
// HELPERS
// =========================

const toneFor = (seed = "") => {
  const sum = [...String(seed)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_TONES[sum % AVATAR_TONES.length]
}

const initialOf = (value) => (value ? String(value).trim().charAt(0).toUpperCase() : "?")

const formatStage = (stage) => {
  if (!stage) return "Unknown"
  if (STAGE_LABELS[stage]) return STAGE_LABELS[stage]
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const formatShortDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"

const LEAD_CATEGORIES = [
  { id: "igs", label: "Institute Growth System", aliases: ["igs", "institute growth system"] },
  { id: "dm", label: "Digital Marketing", aliases: ["dm", "digital marketing"] },
  { id: "landing-page", label: "Landing Page", aliases: ["landing page", "landing-page"] },
  { id: "lms", label: "LMS", aliases: ["lms"] },
  { id: "ncf", label: "NCF", aliases: ["ncf"] },
]

const categoryForLead = (lead) => {
  const source = lead.lead_source?.trim().toLowerCase()
  return LEAD_CATEGORIES.find((category) => category.aliases.includes(source))?.id || null
}

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`

// =========================
// UI PRIMITIVES
// =========================

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600"

const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"

const btnGhost =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"

const Avatar = ({ name, seed, size = "md" }) => {
  const sizes = {
    sm: "h-8 w-8 rounded-lg text-[11px]",
    md: "h-9 w-9 rounded-xl text-[13px]",
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${toneFor(seed)} ${sizes[size]} font-bold text-white shadow-sm`}
    >
      {initialOf(name)}
    </div>
  )
}

const StatCard = ({ label, value, icon, chip }) => (
  <div className={`${cardClass} group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5`}>
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${chip}`}>
      <Icon name={icon} size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  </div>
)

const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />
)

const LoadingSkeleton = () => (
  <div className="w-full space-y-5">
    <SkeletonBlock className="h-16" />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-24" />)}
    </div>
    <SkeletonBlock className="h-64" />
    <SkeletonBlock className="h-96" />
  </div>
)

const FieldIcon = ({ children }) => (
  <span className="flex w-9 shrink-0 items-center justify-center text-sm font-medium text-slate-400">
    {children}
  </span>
)

const InputWithIcon = ({ icon, className = "", ...props }) => (
  <div className="flex h-10 items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10">
    {icon && <FieldIcon>{icon}</FieldIcon>}
    <input
      {...props}
      className={`h-full w-full min-w-0 bg-transparent pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60 ${icon ? "" : "px-3"} ${className}`}
    />
  </div>
)

// =========================
// PAGE
// =========================

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [role, setRole] = useState("")

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [serviceName, setServiceName] = useState("")
  const [leadSource, setLeadSource] = useState("")
  const [nextFollowUp, setNextFollowUp] = useState("")

  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showAddLead, setShowAddLead] = useState(false)
  const [showImportCategory, setShowImportCategory] = useState(false)
  const [importCategory, setImportCategory] = useState("")
  const importFileRef = useRef(null)

  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [leadCategory, setLeadCategory] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // =========================
  // FETCH
  // =========================

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      if (active) setRole(data?.role || "")
    })
    return () => { active = false }
  }, [])

  const loadLeadRecords = useCallback(
    () =>
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
    []
  )

  const applyLeadRecords = useCallback((leadsResult) => {
    if (leadsResult.error) console.error("Lead fetch error:", leadsResult.error)
    else setLeads(leadsResult.data || [])
  }, [])

  const fetchLeads = useCallback(async () => {
    applyLeadRecords(await loadLeadRecords())
  }, [applyLeadRecords, loadLeadRecords])

  useEffect(() => {
    let active = true
    loadLeadRecords()
      .then((records) => {
        if (active) applyLeadRecords(records)
      })
      .catch((error) => console.error("Lead records fetch error:", error))
      .finally(() => {
        if (active) setInitialLoading(false)
      })
    return () => {
      active = false
    }
  }, [applyLeadRecords, loadLeadRecords])

  // =========================
  // ACTIONS
  // =========================

  const resetForm = () => {
    setName("")
    setPhone("")
    setEmail("")
    setCompany("")
    setServiceName("")
    setLeadSource("")
    setNextFollowUp("")
  }

  const addLead = async () => {
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      alert("Please enter a lead name and either an email or phone number.")
      return
    }

    setLoading(true)

    try {
      const initialFollowUp = nextFollowUp
        ? new Date(nextFollowUp).toISOString()
        : new Date(Date.now() + DAY_MS).toISOString()

      const { data, error } = await supabase
        .from("clients")
        .insert([
          {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim(),
            service_name: serviceName.trim(),
            lead_source: leadSource.trim(),
            next_follow_up: initialFollowUp,
            stage: "discovery",
          },
        ])
        .select()

      if (error) throw error

      const newLead = data[0]

      const { error: taskError } = await supabase.from("tasks").insert([
        {
          client_id: newLead.id,
          title: "Follow up with lead",
          due_date: initialFollowUp,
          status: "pending",
        },
      ])
      if (taskError) console.error("Task error:", taskError)

      const { error: activityError } = await supabase.from("activities").insert([
        {
          client_id: newLead.id,
          type: "created",
          description: "Lead created",
        },
      ])
      if (activityError) console.error("Activity error:", activityError)

      resetForm()
      await fetchLeads()
      setPage(1)
      setShowAddLead(false)
      alert("Lead added. The welcome email will be sent when you move it to Contacted.")
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!showAddLead) return undefined
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !loading) setShowAddLead(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [showAddLead, loading])

  const importLeadsFromExcel = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const importCategoryLabel = LEAD_CATEGORIES.find((category) => category.id === importCategory)?.label
    if (!importCategoryLabel) {
      alert("Please choose the category for this workbook first.")
      return
    }

    setImporting(true)

    try {
      const normalizeHeader = (value) => String(value ?? "").toLowerCase().replace(/[^a-z]/g, "")
      const workbookSheets = await readXlsxFile(file)
      const sheets = Array.isArray(workbookSheets)
        ? workbookSheets
        : [{ sheet: "Sheet1", data: workbookSheets }]
      const rows = sheets.find(({ data }) => {
        if (!Array.isArray(data) || data.length < 2) return false
        const sheetHeaders = data[0].map(normalizeHeader)
        const hasName = sheetHeaders.some((header) => ["name", "leadname", "fullname"].includes(header))
        const hasContact = sheetHeaders.some((header) => ["email", "emailaddress", "phone", "phonenumber", "mobile", "mobilenumber", "whatsapp", "whatsappnumber"].includes(header))
        return hasName && hasContact
      })?.data

      if (!rows) {
        const hasDataRows = sheets.some(({ data }) => Array.isArray(data) && data.length >= 2)
        if (!hasDataRows) {
          throw new Error("No lead rows found. The workbook needs a header row and at least one lead row below it.")
        }
        throw new Error("Could not find a worksheet with a Name header and at least one Email or Phone header.")
      }

      const headers = rows[0].map(normalizeHeader)

      const nameIndex = headers.findIndex((h) => ["name", "leadname", "fullname"].includes(h))
      const emailIndex = headers.findIndex((h) => ["email", "emailaddress"].includes(h))
      const phoneIndex = headers.findIndex((h) => ["phone", "phonenumber", "mobile", "mobilenumber", "whatsapp", "whatsappnumber"].includes(h))
      const companyIndex = headers.findIndex((h) => ["company", "companyname", "organization", "institute", "institutename", "business", "businessname"].includes(h))
      const timestampIndex = headers.findIndex((h) => ["timestamp", "date", "createdat"].includes(h))
      const cityIndex = headers.findIndex((h) => h === "city")
      const coursesIndex = headers.findIndex((h) => ["course", "courses", "service", "services"].includes(h))
      const otherCourseIndex = headers.findIndex((h) => h === "othercourse")
      const challengeIndex = headers.findIndex((h) => ["challenge", "requirement", "requirements"].includes(h))
      const budgetIndex = headers.findIndex((h) => h === "budget")
      const startIndex = headers.findIndex((h) => ["start", "startdate", "timeline"].includes(h))
      const roleIndex = headers.findIndex((h) => ["role", "jobrole"].includes(h))
      const websiteIndex = headers.findIndex((h) => ["websiteinstagram", "website", "instagram", "sociallink"].includes(h))
      const leadScoreIndex = headers.findIndex((h) => h === "leadscore")
      const leadTemperatureIndex = headers.findIndex((h) => ["leadtemperature", "temperature"].includes(h))
      const totalPointsIndex = headers.findIndex((h) => h === "totalpoints")
      const leadSummaryIndex = headers.findIndex((h) => h === "leadsummary")
      const externalLeadIdIndex = headers.findIndex((h) => ["leadid", "externalleadid"].includes(h))
      const stageIndex = headers.findIndex((h) => h === "stage")
      const crmDeliveryIndex = headers.findIndex((h) => ["crmdelivery", "delivery"].includes(h))

      if (nameIndex < 0 || (emailIndex < 0 && phoneIndex < 0)) {
        throw new Error("Excel headers must include Name and at least one contact column: Email or Phone.")
      }

      const importedRows = rows
        .slice(1)
        .filter((row) => row.some((value) => String(value ?? "").trim()))
        .map((row, index) => {
          const cellText = (columnIndex) => columnIndex < 0 ? "" : String(row[columnIndex] ?? "").trim()
          const extraDetails = [
            ["Timestamp", cellText(timestampIndex)],
            ["City", cellText(cityIndex)],
            ["Courses", cellText(coursesIndex)],
            ["Other Course", cellText(otherCourseIndex)],
            ["Challenge", cellText(challengeIndex)],
            ["Budget", cellText(budgetIndex)],
            ["Start", cellText(startIndex)],
            ["Role", cellText(roleIndex)],
            ["Website / Instagram", cellText(websiteIndex)],
            ["Lead Score", cellText(leadScoreIndex)],
            ["Lead Temperature", cellText(leadTemperatureIndex)],
            ["Total Points", cellText(totalPointsIndex)],
            ["Lead Summary", cellText(leadSummaryIndex)],
            ["Lead ID", cellText(externalLeadIdIndex)],
            ["Stage", cellText(stageIndex)],
            ["CRM delivery", cellText(crmDeliveryIndex)],
          ].filter(([, value]) => value)
          const stageValue = normalizeHeader(cellText(stageIndex))
          const stageAliases = {
            new: "discovery",
            newlead: "discovery",
            discovery: "discovery",
            contacted: "contacted",
            qualified: "qualified",
            meetingbooked: "meeting_booked",
            followup: "follow_up",
            signed: "signed",
            closed: "signed",
            closedandsigned: "signed",
            active: "active",
            inprogress: "active",
            inrevision: "in_revision",
            delivered: "delivered",
          }

          return {
            rowNumber: index + 2,
            name: cellText(nameIndex),
            email: cellText(emailIndex),
            phone: cellText(phoneIndex),
            company: cellText(companyIndex),
            serviceName: [cellText(coursesIndex), cellText(otherCourseIndex)].filter(Boolean).join("; "),
            leadSource: importCategoryLabel,
            externalLeadId: cellText(externalLeadIdIndex).slice(0, 120),
            stage: stageAliases[stageValue] || "discovery",
            note: extraDetails.map(([label, value]) => `${label}: ${value}`).join("\n"),
          }
        })

      if (!importedRows.length) {
        throw new Error("No lead rows were found in this workbook.")
      }

      const knownEmails = new Set(
        leads.map((lead) => lead.email?.trim().toLowerCase()).filter(Boolean)
      )
      const normalizePhone = (value) => {
        const digits = String(value ?? "").replace(/\D/g, "")
        return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits
      }
      const knownPhones = new Set(leads.map((lead) => normalizePhone(lead.phone)).filter(Boolean))
      const knownExternalIds = new Set(leads.map((lead) => lead.external_lead_id).filter(Boolean))
      const workbookEmails = new Set()
      const workbookPhones = new Set()
      const workbookExternalIds = new Set()
      let added = 0
      let skipped = 0
      let failed = 0
      const failureDetails = []

      for (const row of importedRows) {
        const normalizedEmail = row.email.toLowerCase()
        const normalizedPhone = normalizePhone(row.phone)
        const phoneIsValid = !row.phone || (
          /^[+]?([\d\s\-().]){7,15}$/.test(row.phone) &&
          normalizedPhone.length >= 7 && normalizedPhone.length <= 15
        )
        const emailIsValid = !row.email || EMAIL_RE.test(row.email)

        if (
          !row.name ||
          (!row.email && !row.phone) ||
          !emailIsValid ||
          !phoneIsValid ||
          (normalizedEmail && (knownEmails.has(normalizedEmail) || workbookEmails.has(normalizedEmail))) ||
          (normalizedPhone && (knownPhones.has(normalizedPhone) || workbookPhones.has(normalizedPhone))) ||
          (row.externalLeadId && (knownExternalIds.has(row.externalLeadId) || workbookExternalIds.has(row.externalLeadId)))
        ) {
          skipped += 1
          continue
        }
        if (normalizedEmail) workbookEmails.add(normalizedEmail)
        if (normalizedPhone) workbookPhones.add(normalizedPhone)
        if (row.externalLeadId) workbookExternalIds.add(row.externalLeadId)

        try {
          const { data: newLead, error } = await supabase
            .from("clients")
            .insert({
              name: row.name,
              email: row.email || null,
              phone: row.phone || null,
              company: row.company || null,
              service_name: row.serviceName || null,
              lead_source: row.leadSource || null,
              external_lead_id: row.externalLeadId || null,
              stage: row.stage,
            })
            .select()
            .single()

          if (error) throw error

          added += 1
          if (normalizedEmail) knownEmails.add(normalizedEmail)
          if (normalizedPhone) knownPhones.add(normalizedPhone)
          if (row.externalLeadId) knownExternalIds.add(row.externalLeadId)

          const { error: taskError } = await supabase.from("tasks").insert({
            client_id: newLead.id,
            title: "Follow up with lead",
            due_date: new Date(Date.now() + DAY_MS),
            status: "pending",
          })
          if (taskError) console.error("Imported lead task error:", taskError)

          const { error: activityError } = await supabase.from("activities").insert({
            client_id: newLead.id,
            type: "created",
            description: "Lead imported",
          })
          if (activityError) console.error("Imported lead activity error:", activityError)

          if (row.note) {
            const { error: noteError } = await supabase.from("notes").insert({
              client_id: newLead.id,
              note: row.note,
            })
            if (noteError) console.error("Imported lead note error:", noteError)
          }
        } catch (error) {
          failed += 1
          console.error(`Lead import failed on row ${row.rowNumber}:`, error)
          if (failureDetails.length < 3) {
            failureDetails.push(`Lead row ${row.rowNumber} could not be saved`)
          }
        }
      }

      await fetchLeads()
      setPage(1)

      const summary = [
        `Category: ${importCategoryLabel}`,
        `Leads added: ${added}`,
        `Skipped (invalid or duplicate): ${skipped}`,
        `Could not save: ${failed}`,
        "Welcome emails will be sent when leads are moved to Contacted.",
      ]
      if (failureDetails.length) summary.push(failureDetails.join("\n"))
      alert(summary.join("\n"))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not import this Excel file.")
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteLead = async (lead) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${lead.name}"? This will also delete this lead's notes, tasks, and activity history.`
    )
    if (!confirmed) return

    try {
      for (const table of ["notes", "tasks", "activities"]) {
        const { error } = await supabase.from(table).delete().eq("client_id", lead.id)
        if (error) throw error
      }

      const { error } = await supabase.from("clients").delete().eq("id", lead.id)
      if (error) throw error

      setLeads((current) => current.filter((item) => item.id !== lead.id))
      setPage(1)
      alert("Lead deleted successfully.")
    } catch (error) {
      console.error("Delete lead error:", error)
      alert(`Could not delete lead: ${error.message || "Unknown error"}`)
    }
  }

  const addNote = async (leadId, noteText) => {
    if (!noteText || !noteText.trim()) return

    const { error } = await supabase
      .from("notes")
      .insert([{ client_id: leadId, note: noteText.trim() }])

    if (error) {
      alert(error.message)
      return
    }
    alert("Note added")
  }

  const exportLeadsToCsv = async () => {
    const ids = filteredLeads.map((lead) => lead.id)
    const conversationsByLead = new Map()
    const taskStatusByLead = new Map()

    if (ids.length) {
      const [activityResult, taskResult] = await Promise.all([
        supabase
          .from("activities")
          .select("client_id, description, created_at")
          .eq("type", "conversation")
          .in("client_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("client_id, status, due_date")
          .in("client_id", ids)
          .neq("status", "completed")
          .order("due_date", { ascending: true }),
      ])

      if (activityResult.error || taskResult.error) {
        alert(`Could not prepare export: ${(activityResult.error || taskResult.error).message}`)
        return
      }

      for (const activity of activityResult.data || []) {
        const key = String(activity.client_id)
        if (!conversationsByLead.has(key)) conversationsByLead.set(key, activity)
      }
      for (const task of taskResult.data || []) {
        const key = String(task.client_id)
        if (!taskStatusByLead.has(key)) taskStatusByLead.set(key, task.status)
      }
    }

    const columns = [
      "Lead Name", "Phone Number", "Email", "Company", "Service", "Lead Source",
      "Pipeline Stage", "Last Conversation", "Last Discussion",
      "Next Follow-up", "Task Status",
    ]

    const rows = filteredLeads.map((lead) => {
      const conversation = conversationsByLead.get(String(lead.id))
      return [
        lead.name,
        lead.phone,
        lead.email,
        lead.company,
        lead.service_name,
        lead.lead_source,
        formatStage(lead.stage),
        conversation?.created_at ? new Date(conversation.created_at).toLocaleString() : "",
        conversation?.description,
        lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString() : "",
        taskStatusByLead.get(String(lead.id)) || "",
      ]
    })

    const csv = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // =========================
  // DERIVED DATA
  // =========================

  const categoryCounts = useMemo(
    () => Object.fromEntries([
      ["all", leads.length],
      ...LEAD_CATEGORIES.map((category) => [category.id, leads.filter((lead) => categoryForLead(lead) === category.id).length]),
    ]),
    [leads]
  )

  const filteredLeads = useMemo(() => {
    const query = search.toLowerCase().trim()
    return leads.filter((lead) => {
      const matchesCategory = leadCategory === "all" || categoryForLead(lead) === leadCategory
      const matchesSearch =
        !query ||
        lead.name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.company?.toLowerCase().includes(query)
      const matchesStage = stageFilter === "all" || lead.stage === stageFilter
      return matchesCategory && matchesSearch && matchesStage
    })
  }, [leads, leadCategory, search, stageFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleLeads = useMemo(
    () => filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredLeads, currentPage, pageSize]
  )

  const stats = useMemo(() => {
    const count = (fn) => leads.filter(fn).length
    return {
      total: leads.length,
      discovery: count((l) => l.stage === "discovery"),
      active: count((l) => l.stage === "active" || l.stage === "signed"),
      delivered: count((l) => l.stage === "delivered"),
    }
  }, [leads])

  const statCards = [
    { label: "Total Leads", value: stats.total, icon: "leads", chip: "bg-indigo-50 text-indigo-600 ring-indigo-100" },
    { label: "New Leads", value: stats.discovery, icon: "plus", chip: "bg-orange-50 text-orange-600 ring-orange-100" },
    { label: "Active", value: stats.active, icon: "pipeline", chip: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
    { label: "Delivered", value: stats.delivered, icon: "tasks", chip: "bg-blue-50 text-blue-600 ring-blue-100" },
  ]

  const rangeStart = filteredLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, filteredLeads.length)

  // =========================
  // LOADING
  // =========================

  if (initialLoading) {
    return (
      <div className="w-full text-slate-900">
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between p-5 border border-slate-200/80 rounded-2xl">
        <div>
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <Link to="/" className="no-underline transition hover:text-slate-700">CRM</Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-600">Leads</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Leads</h1>
          <p className="mt-1.5 text-sm text-slate-500">Manage your leads, pipeline and relationships.</p>
        </div>

        <div className="flex flex-row items-center gap-2 self-start sm:flex-col sm:items-stretch sm:self-auto">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Total</span>
            <strong className="text-xl font-bold text-slate-900">{stats.total}</strong>
          </div>
          <button
            type="button"
            onClick={() => setShowAddLead(true)}
            className={`${btnPrimary} w-auto sm:w-full`}
          >
            <Icon name="plus" size={15} />
            Add lead
          </button>
        </div>
      </header>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* ADD LEAD MODAL */}
      {showAddLead && (
      <div
        className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/45 p-3 sm:p-6"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !loading) setShowAddLead(false)
        }}
      >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-title"
        className={`${cardClass} relative max-h-[90vh] w-full max-w-4xl overflow-y-auto p-5 sm:p-6`}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <Icon name="plus" size={18} />
            </div>
            <div>
              <h2 id="add-lead-title" className="text-[15px] font-bold tracking-tight">Add new lead</h2>
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close add lead dialog"
          onClick={() => !loading && setShowAddLead(false)}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 sm:right-6 sm:top-6"
          disabled={loading}
        >
          <Icon name="close" size={16} />
        </button>

        <form onSubmit={(event) => { event.preventDefault(); void addLead() }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={labelClass} htmlFor="lead-name">
              Lead name <span className="text-rose-500">*</span>
            </label>
            <InputWithIcon
              id="lead-name"
              icon="◯"
              type="text"
              placeholder="Enter lead name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="lead-phone">Phone number</label>
            <InputWithIcon
              id="lead-phone"
              icon="+"
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="lead-email">
              Email <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <InputWithIcon
              id="lead-email"
              icon="@"
              type="email"
              placeholder="lead@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="lead-company">Company</label>
            <InputWithIcon
              id="lead-company"
              icon="◈"
              type="text"
              placeholder="Company name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="lead-service">Service</label>
            <InputWithIcon
              id="lead-service"
              type="text"
              placeholder="e.g. Landing page"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="lead-source">Lead category / source</label>
            <select
              id="lead-source"
              className={inputClass}
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
            >
              <option value="">Choose a category</option>
              {LEAD_CATEGORIES.map((category) => <option key={category.id} value={category.label}>{category.label}</option>)}
              <option value="Website / referral / other">Website / referral / other</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="lead-followup">Next follow-up</label>
            <input
              id="lead-followup"
              type="datetime-local"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex items-end">
            <button type="submit" disabled={loading || importing} className={`${btnPrimary} w-full`}>
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Adding...
                </>
              ) : (
                <>
                  <Icon name="plus" size={15} />
                  Add lead
                </>
              )}
            </button>
          </div>
        </div>
        </form>
      </section>
      </div>
      )}

      {showImportCategory && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowImportCategory(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-category-title"
            className={`${cardClass} w-full max-w-md p-5 sm:p-6`}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="import-category-title" className="text-base font-bold text-slate-900">Choose lead category</h2>
                <p className="mt-1 text-sm text-slate-500">All leads in this workbook will be added under this category.</p>
              </div>
              <button
                type="button"
                aria-label="Close category selection"
                onClick={() => setShowImportCategory(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <label htmlFor="excel-import-category" className={labelClass}>Workbook category</label>
            <select
              id="excel-import-category"
              autoFocus
              className={inputClass}
              value={importCategory}
              onChange={(event) => setImportCategory(event.target.value)}
            >
              <option value="">Select a category</option>
              {LEAD_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowImportCategory(false)} className={btnGhost}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!importCategory || importing}
                onClick={() => {
                  setShowImportCategory(false)
                  importFileRef.current?.click()
                }}
                className={btnPrimary}
              >
                Choose Excel file
              </button>
            </div>
          </section>
        </div>
      )}

      {/* LEAD LIST */}
      <section className={`${cardClass} overflow-hidden`}>
        {/* Category tabs */}
        <div role="tablist" aria-label="Lead categories" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-3 sm:px-5">
          {[
            { id: "all", label: "All" },
            ...LEAD_CATEGORIES,
          ].map((category) => {
            const selected = leadCategory === category.id
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setLeadCategory(category.id)
                  setPage(1)
                }}
                className={`relative inline-flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-sm font-semibold transition ${
                  selected ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {category.label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                    selected ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {categoryCounts[category.id]}
                </span>
                {selected && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                )}
              </button>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight">
              {leadCategory === "all" ? "All leads" : `${LEAD_CATEGORIES.find((category) => category.id === leadCategory)?.label || "Other"} leads`}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Showing {visibleLeads.length} of {filteredLeads.length} matching lead{filteredLeads.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 sm:w-56">
              <Icon name="search" size={15} className="text-slate-400" />
              <input
                type="text"
                aria-label="Search leads"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex min-w-0 items-center gap-1.5">
              <select
                aria-label="Filter by stage"
                value={stageFilter}
                onChange={(e) => {
                  setStageFilter(e.target.value)
                  setPage(1)
                }}
                className="h-10 min-w-0 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 sm:px-3 sm:text-sm"
              >
                {STAGE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowImportCategory(true)}
                disabled={importing}
                className={`${btnGhost} h-10 px-2 text-[10px] sm:px-3 sm:text-xs ${importing ? "cursor-wait opacity-60" : ""}`}
              >
                <Icon name="plus" size={12} />
                {importing ? "Importing..." : "Upload Excel"}
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx"
                onChange={importLeadsFromExcel}
                disabled={importing}
                aria-label="Upload Excel workbook"
                className="hidden"
              />

              <button type="button" onClick={exportLeadsToCsv} className={`${btnGhost} h-10 px-2 text-[10px] sm:px-3 sm:text-xs`}>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-slate-50/70">
                {["Lead", "Company", "Service", "Phone", "Next follow-up", "Stage", "Email", ""].map((h, i) => (
                  <th
                    key={h + i}
                    className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Icon name="leads" size={20} />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-700">
                        {leads.length === 0 ? "No leads yet" : "No matching leads"}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {leads.length === 0
                          ? "Add your first lead using the form above."
                          : "Try changing your search or stage filter."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleLeads.map((lead) => {
                  const style = STAGE_STYLES[lead.stage] || STAGE_STYLES.default

                  return (
                    <tr key={lead.id} className="group transition-colors hover:bg-slate-50/70">
                      <td className="border-b border-slate-100 px-5 py-3.5">
                        <Link
                          to={`/lead/${lead.id}`}
                          className="flex items-center gap-3 text-inherit no-underline"
                        >
                          <Avatar name={lead.name} seed={lead.id} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                              {lead.name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                              #{String(lead.id).slice(0, 8)}
                            </p>
                          </div>
                        </Link>
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-600">
                        <span className="whitespace-nowrap">{lead.company || <span className="text-slate-300">—</span>}</span>
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-600">
                        {lead.service_name || <span className="text-slate-300">—</span>}
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-600">
                        {lead.phone || <span className="text-slate-300">—</span>}
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-600">
                        {formatShortDateTime(lead.next_follow_up)}
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${style.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {formatStage(lead.stage)}
                        </span>
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5">
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-[13px] text-slate-500 no-underline transition hover:text-indigo-600 hover:underline"
                          >
                            {lead.email}
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 transition group-hover:opacity-100">
                          <Link
                            to={`/lead/${lead.id}`}
                            className="inline-flex h-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-3 text-xs font-semibold text-white no-underline shadow-sm transition hover:shadow-md"
                          >
                            View
                          </Link>

                          <button
                            type="button"
                            className={`${btnGhost} h-8 px-2.5`}
                            onClick={() => {
                              const note = window.prompt("Enter note")
                              if (note) addNote(lead.id, note)
                            }}
                          >
                            + Note
                          </button>

                          {role === "admin" && (
                            <button
                              type="button"
                              onClick={() => handleDeleteLead(lead)}
                              className="inline-flex h-8 items-center justify-center rounded-xl border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredLeads.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-300"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-between gap-3 text-xs text-slate-500 sm:justify-end">
              <span className="tabular-nums">
                {rangeStart}–{rangeEnd} of {filteredLeads.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                  className={`${btnGhost} h-8 px-3`}
                >
                  Previous
                </button>
                <span className="px-2 font-medium text-slate-600 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage === totalPages}
                  className={`${btnGhost} h-8 px-3`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
