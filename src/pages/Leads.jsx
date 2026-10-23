import { useCallback, useEffect, useState } from "react"

import readXlsxFile from "read-excel-file/browser"

import { supabase } from "../lib/supabase"

import { Link } from "react-router-dom"
import Icon from "../components/Icon"



export default function Leads() {

  const [leads, setLeads] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [serviceName, setServiceName] = useState("")
  const [leadSource, setLeadSource] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [nextFollowUp, setNextFollowUp] = useState("")



  const [loading, setLoading] = useState(false)

  const [importing, setImporting] = useState(false)

  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [leadCategory, setLeadCategory] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)



  // =========================

  // FETCH LEADS

  // =========================



  const loadLeadRecords = useCallback(() => Promise.all([
      supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("team_members")
        .select("id, name, status")
        .order("name", { ascending: true }),
    ]), [])

  const applyLeadRecords = useCallback(([leadsResult, membersResult]) => {
    if (leadsResult.error) {
      console.error("Lead fetch error:", leadsResult.error)
    } else {
      setLeads(leadsResult.data || [])
    }

    if (membersResult.error) {
      console.error("Team member fetch error:", membersResult.error)
    } else {
      setTeamMembers(membersResult.data || [])
    }
  }, [])

  const fetchLeads = async () => applyLeadRecords(await loadLeadRecords())



  useEffect(() => {
    let active = true
    loadLeadRecords()
      .then((records) => {
        if (active) applyLeadRecords(records)
      })
      .catch((error) => console.error("Lead records fetch error:", error))
    return () => { active = false }
  }, [applyLeadRecords, loadLeadRecords])



  // =========================

  // ADD LEAD WITH AUTOMATION

  // =========================



  const addLead = async () => {

    if (!name.trim() || (!email.trim() && !phone.trim())) {

      alert("Please enter a lead name and either an email or phone number.")

      return

    }



    setLoading(true)



    try {

      const assignedMember = teamMembers.find(
        (member) => String(member.id) === assignedTo
      )

      const initialFollowUp = nextFollowUp
        ? new Date(nextFollowUp).toISOString()
        : new Date(Date.now() + 86400000).toISOString()



      // Insert lead

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

            assigned_to: assignedMember?.id || null,

            next_follow_up: initialFollowUp,

            stage: "discovery",

          },

        ])

        .select()



      if (error) throw error



      const newLead = data[0]



      // Create follow-up task

      const { error: taskError } = await supabase

        .from("tasks")

        .insert([

          {

            client_id: newLead.id,

            title: "Follow up with lead",

            due_date: initialFollowUp,
            assigned_to: assignedMember?.id || null,

            status: "pending",

          },

        ])



      if (taskError) {

        console.error("Task error:", taskError)

      }



      // Activity log

      const { error: activityError } = await supabase

        .from("activities")

        .insert([

          {

            client_id: newLead.id,

            type: "created",

            description: assignedMember
              ? `Lead created and assigned to ${assignedMember.name}`
              : "Lead created without an assignee",

          },

        ])



      if (activityError) {

        console.error("Activity error:", activityError)

      }



      // Reset

      setName("")
      setPhone("")
      setEmail("")
      setCompany("")
      setServiceName("")
      setLeadSource("")
      setAssignedTo("")
      setNextFollowUp("")



      await fetchLeads()
      setPage(1)



      alert("Lead added. The welcome email will be sent when you move it to Contacted.")

    } catch (err) {

      alert(err.message)

    }



    setLoading(false)

  }



  const importLeadsFromExcel = async (event) => {

    const file = event.target.files?.[0]

    event.target.value = ""

    if (!file) return



    setImporting(true)



    try {

      const rows = await readXlsxFile(file)

      if (rows.length < 2) {

        throw new Error("Workbook needs a header row and at least one lead row.")

      }



      const normalizeHeader = (value) =>

        String(value ?? "").toLowerCase().replace(/[^a-z]/g, "")

      const headers = rows[0].map(normalizeHeader)

      const nameIndex = headers.findIndex((header) =>

        ["name", "leadname", "fullname"].includes(header)

      )

      const emailIndex = headers.findIndex((header) => header === "email")

      const companyIndex = headers.findIndex((header) =>

        ["company", "companyname", "organization"].includes(header)

      )



      if (nameIndex < 0 || emailIndex < 0) {

        throw new Error(

          "Excel headers must include Name and Email. Company is optional."

        )

      }



      const importedRows = rows.slice(1)

        .filter((row) => row.some((value) => String(value ?? "").trim()))

        .map((row, index) => ({

          rowNumber: index + 2,

          name: String(row[nameIndex] ?? "").trim(),

          email: String(row[emailIndex] ?? "").trim(),

          company: companyIndex < 0

            ? ""

            : String(row[companyIndex] ?? "").trim(),

        }))



      if (!importedRows.length) {

        throw new Error("No lead rows were found in this workbook.")

      }



      const knownEmails = new Set(

        leads.map((lead) => lead.email?.trim().toLowerCase()).filter(Boolean)

      )

      const workbookEmails = new Set()

      let added = 0

      let skipped = 0

      let failed = 0

      const failureDetails = []



      for (const row of importedRows) {

        const normalizedEmail = row.email.toLowerCase()

        if (

          !row.name ||

          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ||

          knownEmails.has(normalizedEmail) ||

          workbookEmails.has(normalizedEmail)

        ) {

          skipped += 1

          continue

        }

        workbookEmails.add(normalizedEmail)



        try {

          const { data: newLead, error } = await supabase

            .from("clients")

            .insert({

              name: row.name,

              email: row.email,

              company: row.company,

              assigned_to: assignedTo || null,

              stage: "discovery",

            })

            .select()

            .single()



          if (error) throw error



          added += 1

          knownEmails.add(normalizedEmail)



          const { error: taskError } = await supabase

            .from("tasks")

            .insert({

              client_id: newLead.id,

              title: "Follow up with lead",

              due_date: new Date(Date.now() + 86400000),

              status: "pending",

            })

          if (taskError) console.error("Imported lead task error:", taskError)



          const { error: activityError } = await supabase

            .from("activities")

            .insert({

              client_id: newLead.id,

              type: "created",

              description: assignedTo
                ? `Lead imported and assigned to ${
                    teamMembers.find((member) => String(member.id) === assignedTo)?.name || "a team member"
                  }`
                : "Lead imported without an assignee",

            })

          if (activityError) console.error("Imported lead activity error:", activityError)



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



  // =========================

  // DELETE LEAD
  // =========================

  const handleDeleteLead = async (lead) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${lead.name}"? This will also delete this lead's notes, tasks, and activity history.`
    )

    if (!confirmed) return

    try {
      // Remove related records first to avoid foreign-key errors.
      for (const table of ["notes", "tasks", "activities"]) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("client_id", lead.id)

        if (error) throw error
      }

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", lead.id)

      if (error) throw error

      setLeads((currentLeads) =>
        currentLeads.filter((item) => item.id !== lead.id)
      )
      setPage(1)
      alert("Lead deleted successfully.")
    } catch (error) {
      console.error("Delete lead error:", error)
      alert(`Could not delete lead: ${error.message || "Unknown error"}`)
    }
  }


  // =========================

  // ADD NOTE

  // =========================



  const addNote = async (leadId, noteText) => {

    if (!noteText || !noteText.trim()) return



    const { error } = await supabase

      .from("notes")

      .insert([

        {

          client_id: leadId,

          note: noteText.trim(),

        },

      ])



    if (error) {

      alert(error.message)

      return

    }



    alert("Note added")

  }



  // =========================

  const exportLeadsToCsv = async () => {
    const ids = filteredLeads.map((lead) => lead.id)
    const conversationsByLead = new Map()
    const taskStatusByLead = new Map()
    if (ids.length) {
      const [activityResult, taskResult] = await Promise.all([
        supabase.from("activities").select("client_id, description, created_at").eq("type", "conversation").in("client_id", ids).order("created_at", { ascending: false }),
        supabase.from("tasks").select("client_id, status, due_date").in("client_id", ids).neq("status", "completed").order("due_date", { ascending: true }),
      ])
      if (activityResult.error || taskResult.error) {
        alert(`Could not prepare export: ${(activityResult.error || taskResult.error).message}`)
        return
      }
      for (const activity of activityResult.data || []) {
        if (!conversationsByLead.has(String(activity.client_id))) conversationsByLead.set(String(activity.client_id), activity)
      }
      for (const task of taskResult.data || []) {
        if (!taskStatusByLead.has(String(task.client_id))) taskStatusByLead.set(String(task.client_id), task.status)
      }
    }
    const columns = ["Lead Name", "Phone Number", "Email", "Company", "Service", "Lead Source", "Assigned To", "Pipeline Stage", "Last Conversation", "Last Discussion", "Next Follow-up", "Task Status"]
    const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
    const rows = filteredLeads.map((lead) => {
      const conversation = conversationsByLead.get(String(lead.id))
      return [lead.name, lead.phone, lead.email, lead.company, lead.service_name, lead.lead_source, getMemberName(lead.assigned_to), formatStage(lead.stage), conversation?.created_at ? new Date(conversation.created_at).toLocaleString() : "", conversation?.description, lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString() : "", taskStatusByLead.get(String(lead.id)) || ""]
    })
    const csv = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // FILTER LEADS

  // =========================



  const filteredLeads = leads.filter((lead) => {

    const query = search.toLowerCase().trim()

    const matchesCategory =
      leadCategory === "all" || lead.lead_source?.trim().toLowerCase() === "igs"



    const matchesSearch =

      !query ||

      lead.name?.toLowerCase().includes(query) ||

      lead.email?.toLowerCase().includes(query) ||

      lead.company?.toLowerCase().includes(query)



    const matchesStage =

      stageFilter === "all" ||

      lead.stage === stageFilter



    return matchesCategory && matchesSearch && matchesStage

  })

  // =========================

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleLeads = filteredLeads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  const getMemberName = (memberId) =>
    teamMembers.find((member) => String(member.id) === String(memberId))?.name ||
    "Unassigned"

    // STATS

  // =========================



  const totalLeads = leads.length



  const discoveryLeads = leads.filter(

    (lead) => lead.stage === "discovery"

  ).length



  const activeLeads = leads.filter(

    (lead) =>

      lead.stage === "active" ||

      lead.stage === "signed"

  ).length



  const deliveredLeads = leads.filter(

    (lead) => lead.stage === "delivered"

  ).length



  // =========================

  // STAGE FORMAT

  // =========================



  const formatStage = (stage) => {

    if (!stage) return "Unknown"

    const stageLabels = { discovery: "New Lead", contacted: "Contacted", qualified: "Qualified", meeting_booked: "Meeting Booked", follow_up: "Follow-up", signed: "Closed & Signed", active: "In Progress", in_revision: "In Revision", delivered: "Delivered" }
    if (stageLabels[stage]) return stageLabels[stage]



    return stage

      .replace("_", " ")

      .replace(/\b\w/g, (char) => char.toUpperCase())

  }



  const stageStyles = {

    discovery: { badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },

    contacted: { badge: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
    qualified: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    meeting_booked: { badge: "bg-cyan-50 text-cyan-700", dot: "bg-cyan-500" },

    follow_up: { badge: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },

    signed: { badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },

    active: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },

    in_revision: { badge: "bg-fuchsia-50 text-fuchsia-700", dot: "bg-fuchsia-500" },

    delivered: { badge: "bg-green-50 text-green-700", dot: "bg-green-500" },

    default: { badge: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },

  }



  const getStageStyle = (stage) => stageStyles[stage] || stageStyles.default



  // =========================

  // MEMBER AVATAR

  // =========================



  const getMemberInitial = (member) => {

    if (!member) return "U"



    return member

      .replace("member", "M")

      .charAt(0)

      .toUpperCase()

  }



  const card = "leads-card rounded-2xl border border-gray-200 bg-white shadow-sm"



  const statCards = [

    { label: "Total Leads", value: totalLeads, icon: "◉", color: "bg-violet-50 text-violet-600" },

    { label: "Discovery", value: discoveryLeads, icon: "◌", color: "bg-orange-50 text-orange-500" },

    { label: "Active", value: activeLeads, icon: "↗", color: "bg-emerald-50 text-emerald-600" },

    { label: "Delivered", value: deliveredLeads, icon: "✓", color: "bg-blue-50 text-blue-600" },

  ]



  const inputWrap =

    "flex h-10 items-center rounded-lg border border-gray-200 bg-white transition focus-within:border-gray-400 focus-within:ring-4 focus-within:ring-gray-900/5"



  const inputBase =

    "h-full w-full border-none bg-transparent pr-3 text-sm text-gray-700 outline-none placeholder:text-gray-400"



  const toolbarControl =

    "h-[38px] rounded-lg border border-gray-200 bg-white text-[13px] text-gray-600"



  return (

    <div className="leads-page w-full text-gray-900">



      {/* HEADER */}

      <div className="leads-heading mb-[22px] flex items-end justify-between max-[768px]:items-start">

        <div>

          <div className="mb-2 text-xs text-gray-400">

            CRM <span className="mx-1.5 text-gray-300">/</span> Leads

          </div>



          <h1 className="text-[22px] font-bold tracking-tight min-[481px]:text-[28px]">

            Leads

          </h1>



          <p className="mt-1.5 text-sm text-gray-500">

            Manage your leads, pipeline and relationships.

          </p>

        </div>



        <div className="flex flex-col items-end max-[768px]:hidden">

          <span className="text-xs uppercase tracking-widest text-gray-400">

            Total

          </span>

          <strong className="mt-0.5 text-[22px]">{totalLeads}</strong>

        </div>

      </div>



      {/* STAT CARDS */}

      <div className="mb-[18px] grid grid-cols-1 gap-3.5 min-[481px]:grid-cols-2 min-[1101px]:grid-cols-4">

        {statCards.map((item) => (

          <div key={item.label} className={`${card} leads-stat flex min-h-[88px] items-center gap-3.5 p-4`}>

            <div className={`flex h-11 w-11 items-center justify-center rounded-[10px] text-base font-bold ${item.color}`}>

              <Icon name={item.icon === "!" ? "tasks" : item.icon === "+" ? "plus" : item.icon === "◉" ? "leads" : item.icon === "↗" ? "pipeline" : "tasks"} size={18} />

            </div>



            <div>

              <span className="mb-1 block text-xs text-gray-400">{item.label}</span>

              <strong className="block text-[22px] font-bold text-gray-900">{item.value}</strong>

            </div>

          </div>

        ))}

      </div>



      {/* ADD LEAD CARD */}

      <div className={`${card} mb-[18px] p-5 max-[480px]:p-3.5`}>

        <div className="mb-[18px] flex items-center justify-between max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-2.5">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#321073] text-xl text-white shadow-sm">

              +

            </div>



            <div>

              <h2 className="text-base font-bold">Add New Lead</h2>

              <p className="mt-0.5 text-xs text-gray-400">

                Create a new lead and automatically assign follow-up.

              </p>

            </div>

          </div>



          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">

            ● Automation Active

          </span>

        </div>



        <div className="grid grid-cols-1 items-end gap-3 min-[769px]:grid-cols-2 xl:grid-cols-4">

          {/* NAME */}

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-gray-700">

              Lead Name<span className="ml-0.5 text-red-500">*</span>

            </label>

            <div className={inputWrap}>

              <span className="flex w-10 items-center justify-center text-sm text-gray-400">◯</span>

              <input

                type="text"

                placeholder="Enter lead name"

                value={name}

                onChange={(e) => setName(e.target.value)}

                className={inputBase}

              />

            </div>

          </div>



          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">Phone Number</label>
            <div className={inputWrap}>
              <span className="flex w-10 items-center justify-center text-sm text-gray-400">+</span>
              <input type="tel" placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputBase} />
            </div>
          </div>

          {/* EMAIL */}

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-gray-700">

              Email Address <span className="font-normal text-gray-400">(optional)</span>

            </label>

            <div className={inputWrap}>

              <span className="flex w-10 items-center justify-center text-sm text-gray-400">@</span>

              <input

                type="email"

                placeholder="lead@example.com"

                value={email}

                onChange={(e) => setEmail(e.target.value)}

                className={inputBase}

              />

            </div>

          </div>



          {/* COMPANY */}

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-gray-700">

              Company

            </label>

            <div className={inputWrap}>

              <span className="flex w-10 items-center justify-center text-sm text-gray-400">◈</span>

              <input

                type="text"

                placeholder="Company name"

                value={company}

                onChange={(e) => setCompany(e.target.value)}

                className={inputBase}

              />

            </div>

          </div>



          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">Service</label>
            <div className={inputWrap}>
              <input type="text" placeholder="e.g. Landing page" value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="h-full w-full bg-transparent px-3 text-sm text-gray-700 outline-none placeholder:text-gray-400" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">Lead source</label>
            <div className={inputWrap}>
              <input type="text" placeholder="Website, referral..." value={leadSource} onChange={(event) => setLeadSource(event.target.value)} className="h-full w-full bg-transparent px-3 text-sm text-gray-700 outline-none placeholder:text-gray-400" />
            </div>
          </div>

          {/* ASSIGNEE */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
              Assign to
            </label>
            <select
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
            >
              <option value="">Unassigned</option>
              {teamMembers.filter((member) => member.status === "active").map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">Next follow-up</label>
            <input type="datetime-local" value={nextFollowUp} onChange={(event) => setNextFollowUp(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700" />
          </div>

          {/* BUTTON */}

          <div>

            <button

              onClick={addLead}

              disabled={loading || importing}

              className="leads-primary flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#321073] text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#42149b] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"

            >

              {loading ? (

                <>

                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>

                  Adding...

                </>

              ) : (

                <>

                  <span className="text-base leading-none">+</span>

                  Add Lead

                </>

              )}

            </button>

          </div>

        </div>



        <div className="mt-3.5 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-400">

          <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>

          <span>

            Adding a lead automatically creates a follow-up task and activity record.

          </span>

        </div>

      </div>



      {/* LEAD LIST */}

      <div className={`${card} leads-table-card overflow-hidden`}>

        <div role="tablist" aria-label="Lead categories" className="flex gap-2 overflow-x-auto border-b border-gray-100 px-5 pt-4">
          {[
            { id: "all", label: "All", count: leads.length },
            { id: "igs", label: "IGS", count: leads.filter((lead) => lead.lead_source?.trim().toLowerCase() === "igs").length },
          ].map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={leadCategory === category.id}
              onClick={() => {
                setLeadCategory(category.id)
                setPage(1)
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition ${leadCategory === category.id ? "border-violet-700 bg-violet-50 text-violet-800" : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}
            >
              {category.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${leadCategory === category.id ? "bg-violet-100 text-violet-800" : "bg-gray-100 text-gray-500"}`}>
                {category.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex min-h-[72px] items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 max-[480px]:flex-col max-[480px]:items-start">

          <div>

            <h2 className="text-base font-bold">All Leads</h2>

            <p className="mt-0.5 text-xs text-gray-400">

              Showing {visibleLeads.length} of {filteredLeads.length} matching lead

              {filteredLeads.length !== 1 ? "s" : ""}

            </p>

          </div>



          <div className="flex items-center gap-2 max-[768px]:w-full max-[480px]:flex-col max-[480px]:items-stretch">

            <button type="button" onClick={exportLeadsToCsv} className={`inline-flex items-center justify-center px-3 ${toolbarControl} hover:bg-violet-50`}>
              Export Excel
            </button>

            <label

              className={`inline-flex cursor-pointer items-center whitespace-nowrap px-3 hover:bg-gray-50 max-[480px]:justify-center ${toolbarControl} ${

                importing ? "cursor-wait opacity-60" : ""

              }`}

            >

              {importing ? "Importing..." : "Upload Excel"}

              <input

                type="file"

                accept=".xlsx"

                onChange={importLeadsFromExcel}

                disabled={importing}

                aria-label="Upload Excel workbook"

                className="hidden"

              />

            </label>



            {/* SEARCH */}

            <div className={`flex w-[200px] items-center gap-2 bg-gray-50 px-2.5 max-[768px]:w-auto max-[768px]:flex-1 max-[480px]:w-full ${toolbarControl}`}>

              <span className="text-base text-gray-400">⌕</span>

              <input

                type="text"

                placeholder="Search leads..."

                value={search}

                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}

                className="w-full border-none bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"

              />

            </div>



            {/* FILTER */}

            <select

              value={stageFilter}

              onChange={(e) => {
                setStageFilter(e.target.value)
                setPage(1)
              }}

              className={`cursor-pointer px-2.5 outline-none max-[480px]:w-full ${toolbarControl}`}

            >

              <option value="all">All Stages</option>

              <option value="discovery">Discovery</option>

              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="meeting_booked">Meeting Booked</option>
              <option value="follow_up">Follow-up Scheduled</option>
              <option value="signed">Signed</option>

              <option value="active">Active</option>

              <option value="in_revision">In Revision</option>
              <option value="delivered">Delivered</option>

            </select>

          </div>

        </div>



        {/* TABLE */}

        <div className="w-full overflow-x-auto">

          <table className="w-full min-w-[950px] border-collapse">

            <thead className="leads-table-head bg-gray-50">

              <tr>

                {["LEAD", "COMPANY", "SERVICE", "CONTACT", "NEXT FOLLOW-UP", "STAGE", "ASSIGNED TO", "EMAIL", "ACTION"].map((h) => (

                  <th

                    key={h}

                    className="h-11 border-b border-gray-100 px-5 text-left text-xs font-bold tracking-wider text-gray-400"

                  >

                    {h}

                  </th>

                ))}

              </tr>

            </thead>



            <tbody>

              {filteredLeads.length === 0 ? (

                <tr>

                  <td colSpan="9" className="p-0">

                    <div className="px-5 py-14 text-center">

                      <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-400">

                        ◉

                      </div>



                      <h3 className="text-sm font-semibold text-gray-700">

                        {leads.length === 0

                          ? "No leads yet"

                          : "No matching leads"}

                      </h3>



                      <p className="mt-1 text-xs text-gray-400">

                        {leads.length === 0

                          ? "Add your first lead using the form above."

                          : "Try changing your search or stage filter."}

                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                visibleLeads.map((lead) => {

                  const stage = getStageStyle(lead.stage)



                  return (

                    <tr

                      key={lead.id}

                      className="transition-colors last:[&>td]:border-b-0 hover:bg-gray-50"

                    >

                      {/* LEAD */}

                      <td className="border-b border-gray-100 px-5 py-3 text-[13px] text-gray-600">

                        <Link

                          to={`/lead/${lead.id}`}

                          className="leads-name-link flex items-center gap-2.5 text-inherit no-underline"

                        >

                          <div className="leads-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[13px] font-bold text-violet-700">

                            {lead.name?.charAt(0)?.toUpperCase() || "C"}

                          </div>



                          <div className="flex flex-col">

                            <strong className="text-sm font-semibold text-gray-900">

                              {lead.name}

                            </strong>

                            <span className="mt-0.5 text-xs text-gray-400">

                              ID: {lead.id.slice(0, 8)}

                            </span>

                          </div>

                        </Link>

                      </td>



                      {/* COMPANY */}

                      <td className="border-b border-gray-100 px-5 py-3 text-[13px] text-gray-600">

                        <div className="flex items-center gap-2">

                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-500">

                            ◈

                          </div>

                          <span className="whitespace-nowrap">

                            {lead.company || "No company"}

                          </span>

                        </div>

                      </td>



                      <td className="border-b border-gray-100 px-5 py-3 text-xs text-gray-600">
                        {lead.service_name || "—"}
                      </td>

                      <td className="border-b border-gray-100 px-5 py-3 text-xs text-gray-600">
                        {lead.phone || "—"}
                      </td>

                      <td className="border-b border-gray-100 px-5 py-3 text-xs text-gray-600">
                        {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>

                      {/* STAGE */}

                      <td className="border-b border-gray-100 px-5 py-3">

                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${stage.badge}`}>

                          <i className={`h-1.5 w-1.5 rounded-full ${stage.dot}`}></i>

                          {formatStage(lead.stage)}

                        </span>

                      </td>



                      {/* ASSIGNED */}

                      <td className="border-b border-gray-100 px-5 py-3">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">

                            {getMemberInitial(getMemberName(lead.assigned_to))}

                          </div>



                          <div className="flex flex-col">

                            <strong className="text-[13px] font-semibold text-gray-700">

                              {getMemberName(lead.assigned_to)}

                            </strong>

                            <span className="mt-0.5 text-xs text-gray-400">

                              Team Member

                            </span>

                          </div>

                        </div>

                      </td>



                      {/* EMAIL */}

                      <td className="border-b border-gray-100 px-5 py-3">

                        <a

                          href={`mailto:${lead.email}`}

                          className="text-[13px] text-gray-500 no-underline hover:text-gray-900 hover:underline"

                        >

                          {lead.email}

                        </a>

                      </td>



                      {/* ACTION */}

                      <td className="border-b border-gray-100 px-5 py-3">

                        <div className="flex items-center gap-1.5">

                          <Link

                            to={`/lead/${lead.id}`}

                            className="leads-primary inline-flex h-8 items-center justify-center rounded-lg bg-[#321073] px-3 text-xs font-semibold text-white no-underline hover:bg-[#42149b]"

                          >

                            View

                          </Link>



                          <button

                            className="inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50"

                            onClick={() => {

                              const note = window.prompt("Enter note")



                              if (note) {

                                addNote(lead.id, note)

                              }

                            }}

                          >

                            + Note

                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead)}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>

                  )

                })

              )}

            </tbody>

          </table>

        </div>

        {filteredLeads.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              Rows per page
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-gray-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                className="rounded-md border border-gray-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

    </div>

  )

}
