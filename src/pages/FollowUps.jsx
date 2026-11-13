import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import Icon from "../components/Icon"
import { supabase } from "../lib/supabase"
import { formatIndiaDateTime, indiaDateInputValue } from "../lib/time"

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
  if (/\bIST\b|India Standard Time/i.test(zone)) offsetMinutes = 330
  else {
    const offsetMatch = zone.match(/(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?/i)
    if (!offsetMatch) return null
    offsetMinutes = (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] || 0)) * (offsetMatch[1] === "+" ? 1 : -1)
  }
  const hour = hour12 % 12 + (meridiem.toUpperCase() === "PM" ? 12 : 0)
  const localDate = new Date(Date.UTC(year, month, day, hour, minute))
  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== month || localDate.getUTCDate() !== day) return null
  return new Date(localDate.getTime() - offsetMinutes * 60_000).toISOString()
}

const scheduleKey = (leadId, date) => `${leadId}:${new Date(date).getTime()}`

export default function FollowUps() {
  const [followUps, setFollowUps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("upcoming")
  const [selectedDate, setSelectedDate] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [completingId, setCompletingId] = useState("")

  useEffect(() => {
    let active = true
    const loadFollowUps = async () => {
      setLoading(true)
      setError("")
      const [leadsResult, tasksResult, activitiesResult, notesResult] = await Promise.all([
        supabase.from("clients").select("id,name,email,phone,company,stage,next_follow_up"),
        supabase.from("tasks").select("id,client_id,title,due_date,instructions,status").not("due_date", "is", null).order("due_date", { ascending: true }),
        supabase.from("activities").select("id,client_id,description,outcome,follow_up_at").not("follow_up_at", "is", null).order("follow_up_at", { ascending: true }),
        supabase.from("notes").select("client_id,note").ilike("note", "%Appointment Requested:%"),
      ])
      if (!active) return
      const fetchError = [leadsResult.error, tasksResult.error, activitiesResult.error, notesResult.error].find(Boolean)
      if (fetchError) {
        setError(`Could not load follow-ups: ${fetchError.message}`)
        setFollowUps([])
      } else {
        const leadsById = new Map((leadsResult.data || []).map((lead) => [String(lead.id), lead]))
        const appointmentKeys = new Set((notesResult.data || []).flatMap((note) => {
          const appointmentAt = parseAppointmentTime(note.note)
          return appointmentAt ? [scheduleKey(note.client_id, appointmentAt)] : []
        }))
        const tasksByKey = new Map((tasksResult.data || [])
          .filter((task) => task.client_id && task.due_date)
          .map((task) => [scheduleKey(task.client_id, task.due_date), task]))
        const rows = []
        const seen = new Set()
        const addRow = ({ leadId, date, description, status = "Scheduled", id, taskId = null }) => {
          if (!leadId || !date) return
          const key = scheduleKey(leadId, date)
          if (appointmentKeys.has(key) || seen.has(key)) return
          const lead = leadsById.get(String(leadId))
          if (!lead) return
          seen.add(key)
          rows.push({ id: id || key, lead, date, description: description || "Follow-up scheduled", status, taskId })
        }

        ;(activitiesResult.data || []).forEach((activity) => {
          const matchingTask = tasksByKey.get(scheduleKey(activity.client_id, activity.follow_up_at))
          addRow({
            leadId: activity.client_id,
            date: activity.follow_up_at,
            description: activity.outcome || activity.description,
            status: matchingTask?.status || "Scheduled",
            id: `activity-${activity.id}`,
            taskId: matchingTask?.id || null,
          })
        })

        ;(tasksResult.data || []).forEach((task) => {
          if (!/^follow[\s-]?up\b/i.test(task.title || "")) return
          // These generic tasks were created automatically when leads were added.
          // They were not scheduled by a user, so keep them out of the follow-up queue.
          if (/^follow\s+up\s+with\s+(?:new\s+)?lead$/i.test((task.title || "").trim())) return
          addRow({
            leadId: task.client_id,
            date: task.due_date,
            description: task.instructions || task.title,
            status: task.status || "Pending",
            id: `task-${task.id}`,
            taskId: task.id,
          })
        })

        // Leads explicitly moved to the Follow-up stage can have their schedule
        // stored on the lead record instead of an activity or task.
        ;(leadsResult.data || []).forEach((lead) => {
          if (lead.stage !== "follow_up") return
          if (lead.next_follow_up) {
            const key = scheduleKey(lead.id, lead.next_follow_up)
            const matchingTask = tasksByKey.get(key)
            const previousRowCount = rows.length
            addRow({
              leadId: lead.id,
              date: lead.next_follow_up,
              description: matchingTask?.instructions || matchingTask?.title || "Follow-up scheduled",
              status: matchingTask?.status || "Scheduled",
              taskId: matchingTask?.id || null,
            })
            if (rows.length > previousRowCount) return
          }
          if (rows.some((row) => String(row.lead.id) === String(lead.id))) return
          const leadRecord = leadsById.get(String(lead.id))
          if (!leadRecord) return
          rows.push({
            id: `stage-${lead.id}`,
            lead: leadRecord,
            date: null,
            description: "Follow-up needed",
            status: "Needs scheduling",
          })
        })

        setFollowUps(rows)
      }
      setLoading(false)
    }
    loadFollowUps()
    return () => { active = false }
  }, [refreshKey])

  const markFollowUpComplete = async (followUp) => {
    setCompletingId(String(followUp.id))
    setError("")
    const result = followUp.taskId
      ? await supabase.from("tasks").update({ status: "completed" }).eq("id", followUp.taskId)
      : await supabase.from("tasks").insert({
          client_id: followUp.lead.id,
          title: "Follow-up completed",
          instructions: followUp.description,
          due_date: followUp.date || new Date().toISOString(),
          status: "completed",
        })
    if (result.error) {
      setError(`Could not complete follow-up: ${result.error.message}`)
    } else {
      setRefreshKey((key) => key + 1)
    }
    setCompletingId("")
  }

  const visibleFollowUps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return followUps.filter((lead) => {
      const time = lead.date ? new Date(lead.date).getTime() : null
      if (!lead.date && filter === "past") return false
      const isActiveFollowUpLead = lead.lead.stage === "follow_up"
      const isCompleted = String(lead.status).toLowerCase() === "completed"
      if (isCompleted && filter === "upcoming") return false
      if (isCompleted && filter === "past") return true
      if (filter === "upcoming" && time !== null && time < Date.now() && !isActiveFollowUpLead) return false
      if (filter === "past" && (isActiveFollowUpLead || (time !== null && time >= Date.now()))) return false
      if (selectedDate && (!lead.date || indiaDateInputValue(lead.date) !== selectedDate)) return false
      if (!normalizedQuery) return true
      const haystack = [lead.lead.name, lead.lead.company, lead.lead.email, lead.lead.phone, lead.description].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    }).sort((a, b) => {
      if (!a.date) return b.date ? 1 : 0
      if (!b.date) return -1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
  }, [followUps, filter, query, selectedDate])

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Lead schedule</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Follow-ups</h2>
          <p className="mt-2 text-sm text-slate-500">See scheduled follow-ups and leads marked for follow-up in one place.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 sm:max-w-sm">
          <Icon name="search" size={17} className="shrink-0 text-slate-400" />
          <input aria-label="Search follow-ups" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lead or company..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-500">
            <Icon name="calendar" size={16} className="text-violet-500" />
            <span className="sr-only">Choose follow-up date</span>
            <input aria-label="Choose follow-up date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="bg-transparent text-sm text-slate-700 outline-none" />
          </label>
          {selectedDate && <button type="button" onClick={() => setSelectedDate("")} className="h-10 rounded-lg px-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">Clear date</button>}
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="Filter follow-ups">
            {[{ id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past" }].map((option) => (
              <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${filter === option.id ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{option.label}</button>
            ))}
          </div>
        </div>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div> : loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading follow-ups…</div>
      ) : visibleFollowUps.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Icon name="clock" size={20} /></div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">No {filter} follow-ups found</h3>
          <p className="mt-1 text-sm text-slate-500">Scheduled follow-ups and leads marked for follow-up will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <h3 className="text-sm font-bold text-slate-900">{filter === "upcoming" ? "Upcoming follow-ups" : "Past follow-ups"}</h3>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{visibleFollowUps.length} shown</span>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleFollowUps.map((lead) => {
              const isUnscheduled = !lead.date
              const isOverdue = !isUnscheduled && new Date(lead.date).getTime() < Date.now() && lead.lead.stage === "follow_up"
              const isUpcoming = !isUnscheduled && new Date(lead.date).getTime() >= Date.now()
              const isCompleted = String(lead.status).toLowerCase() === "completed"
              return (
                <article key={lead.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)_auto] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <Link to={`/lead/${lead.lead.id}`} className="truncate text-sm font-semibold text-slate-900 no-underline hover:text-violet-700">{lead.lead.name || "Unnamed lead"}</Link>
                    <p className="mt-1 truncate text-xs text-slate-500">{lead.lead.company || lead.lead.email || lead.lead.phone || "Lead"}</p>
                  </div>
                  <div className="flex min-w-0 items-start gap-2 text-sm text-slate-700">
                    <Icon name="clock" size={16} className="mt-0.5 shrink-0 text-violet-500" />
                    <span className="min-w-0">
                      <span className="block font-medium">{lead.date ? formatIndiaDateTime(lead.date, { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date not set"}</span>
                      <span className="mt-1 block break-words text-xs text-slate-600">Follow-up: {lead.description}</span>
                      <span className="mt-1 block truncate text-xs text-slate-400">{lead.lead.stage ? stageLabels[lead.lead.stage] || lead.lead.stage.replaceAll("_", " ") : "Stage unavailable"}{lead.date ? " · India Standard Time (GMT+5:30)" : ""}</span>
                    </span>
                  </div>
                  <div className="flex w-fit items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isCompleted ? "bg-slate-100 text-slate-500" : isUnscheduled ? "bg-amber-50 text-amber-700" : isOverdue ? "bg-rose-50 text-rose-700" : isUpcoming ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{isCompleted ? "Completed" : isUnscheduled ? "Needs scheduling" : isOverdue ? "Overdue" : isUpcoming ? "Upcoming" : "Past"}</span>
                    {isOverdue && !isCompleted && (
                      <button
                        type="button"
                        onClick={() => markFollowUpComplete(lead)}
                        disabled={completingId === String(lead.id)}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {completingId === String(lead.id) ? "Saving…" : "Complete"}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
