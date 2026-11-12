import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import Icon from "../components/Icon"
import { supabase } from "../lib/supabase"
import { formatIndiaDateTime } from "../lib/time"

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

const appointmentText = (note) => String(note || "").match(/Appointment Requested:\s*(.+)/i)?.[1]?.trim() || "Appointment details unavailable"

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    let active = true
    const loadAppointments = async () => {
      setLoading(true)
      setError("")
      const [notesResult, leadsResult] = await Promise.all([
        supabase.from("notes").select("id,client_id,note,created_at").ilike("note", "%Appointment Requested:%").order("created_at", { ascending: false }),
        supabase.from("clients").select("id,name,email,phone,company,stage,created_at").order("created_at", { ascending: false }),
      ])
      if (!active) return
      const fetchError = notesResult.error || leadsResult.error
      if (fetchError) {
        setError(`Could not load appointments: ${fetchError.message}`)
        setAppointments([])
      } else {
        const leadById = new Map((leadsResult.data || []).map((lead, index) => [String(lead.id), { ...lead, listOrder: index }]))
        setAppointments((notesResult.data || []).map((note) => ({
          ...note,
          appointmentAt: parseAppointmentTime(note.note),
          appointmentLabel: appointmentText(note.note),
          lead: leadById.get(String(note.client_id)) || null,
        })))
      }
      setLoading(false)
    }
    loadAppointments()
    return () => { active = false }
  }, [])

  const visibleAppointments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return appointments.filter((appointment) => {
      const time = appointment.appointmentAt ? new Date(appointment.appointmentAt).getTime() : null
      if (filter === "upcoming" && (time === null || time < Date.now())) return false
      if (filter === "past" && (time === null || time >= Date.now())) return false
      if (!normalizedQuery) return true
      const haystack = [appointment.lead?.name, appointment.lead?.company, appointment.lead?.email, appointment.lead?.phone, appointment.appointmentLabel].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    }).sort((a, b) => {
      const aLeadOrder = a.lead?.listOrder ?? Number.MAX_SAFE_INTEGER
      const bLeadOrder = b.lead?.listOrder ?? Number.MAX_SAFE_INTEGER
      if (aLeadOrder !== bLeadOrder) return aLeadOrder - bLeadOrder
      const aTime = a.appointmentAt ? new Date(a.appointmentAt).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.appointmentAt ? new Date(b.appointmentAt).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })
  }, [appointments, filter, query])

  const upcomingCount = appointments.filter(({ appointmentAt }) => appointmentAt && new Date(appointmentAt).getTime() >= Date.now()).length

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Lead schedule</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Appointments</h2>
          <p className="mt-2 text-sm text-slate-500">See every lead’s requested appointment in one place.</p>
        </div>
        <div className="flex h-11 items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-4 text-sm font-semibold text-violet-700">
          <Icon name="calendar" size={17} /> {upcomingCount} upcoming
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 sm:max-w-sm">
          <Icon name="search" size={17} className="shrink-0 text-slate-400" />
          <input aria-label="Search appointments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lead or appointment..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </label>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="Filter appointments">
          {[{ id: "all", label: "All" }, { id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past" }].map((option) => (
            <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${filter === option.id ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{option.label}</button>
          ))}
        </div>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div> : loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading appointments…</div>
      ) : visibleAppointments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Icon name="calendar" size={20} /></div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">No appointments found</h3>
          <p className="mt-1 text-sm text-slate-500">Appointments requested by leads will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <h3 className="text-sm font-bold text-slate-900">All lead appointments</h3>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{visibleAppointments.length} shown</span>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleAppointments.map((appointment) => {
              const isUpcoming = appointment.appointmentAt && new Date(appointment.appointmentAt).getTime() >= Date.now()
              return (
                <article key={appointment.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)_auto] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    {appointment.lead ? <Link to={`/lead/${appointment.lead.id}`} className="truncate text-sm font-semibold text-slate-900 no-underline hover:text-violet-700">{appointment.lead.name || "Unnamed lead"}</Link> : <p className="text-sm font-semibold text-slate-700">Lead unavailable</p>}
                    <p className="mt-1 truncate text-xs text-slate-500">{appointment.lead?.company || appointment.lead?.email || appointment.lead?.phone || "Lead"}</p>
                  </div>
                  <div className="flex min-w-0 items-start gap-2 text-sm text-slate-700">
                    <Icon name="calendar" size={16} className="mt-0.5 shrink-0 text-violet-500" />
                    <span className="min-w-0"><span className="block font-medium">{appointment.appointmentAt ? formatIndiaDateTime(appointment.appointmentAt, { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : appointment.appointmentLabel}</span><span className="mt-1 block truncate text-xs text-slate-400">{appointment.appointmentAt ? "India Standard Time (GMT+5:30)" : "Time could not be read"}</span></span>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${isUpcoming ? "bg-emerald-50 text-emerald-700" : appointment.appointmentAt ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}>{isUpcoming ? "Upcoming" : appointment.appointmentAt ? "Past" : "Check details"}</span>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
