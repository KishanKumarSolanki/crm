import { useCallback, useEffect, useState } from "react"

import readXlsxFile from "read-excel-file/browser"

import { supabase } from "../lib/supabase"

import { sendClientWelcomeEmail } from "../lib/email"

import { Link } from "react-router-dom"



export default function Clients() {

  const [clients, setClients] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [assignedTo, setAssignedTo] = useState("")



  const [loading, setLoading] = useState(false)

  const [importing, setImporting] = useState(false)

  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)



  // =========================

  // FETCH CLIENTS

  // =========================



  const loadClientRecords = useCallback(() => Promise.all([
      supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("team_members")
        .select("id, name, status")
        .order("name", { ascending: true }),
    ]), [])

  const applyClientRecords = useCallback(([clientsResult, membersResult]) => {
    if (clientsResult.error) {
      console.error("Client fetch error:", clientsResult.error)
    } else {
      setClients(clientsResult.data || [])
    }

    if (membersResult.error) {
      console.error("Team member fetch error:", membersResult.error)
    } else {
      setTeamMembers(membersResult.data || [])
    }
  }, [])

  const fetchClients = async () => applyClientRecords(await loadClientRecords())



  useEffect(() => {
    let active = true
    loadClientRecords()
      .then((records) => {
        if (active) applyClientRecords(records)
      })
      .catch((error) => console.error("Client records fetch error:", error))
    return () => { active = false }
  }, [applyClientRecords, loadClientRecords])



  // =========================

  // ADD CLIENT WITH AUTOMATION

  // =========================



  const addClient = async () => {

    if (!name.trim() || !email.trim()) {

      alert("Name & Email required")

      return

    }



    setLoading(true)



    try {

      const assignedMember = teamMembers.find(
        (member) => String(member.id) === assignedTo
      )



      // Insert client

      const { data, error } = await supabase

        .from("clients")

        .insert([

          {

            name: name.trim(),

            email: email.trim(),

            company: company.trim(),

            assigned_to: assignedMember?.id || null,

            stage: "discovery",

          },

        ])

        .select()



      if (error) throw error



      const newClient = data[0]



      let welcomeEmailError



      // Create follow-up task

      const { error: taskError } = await supabase

        .from("tasks")

        .insert([

          {

            client_id: newClient.id,

            title: "Follow up with client",

            due_date: new Date(Date.now() + 86400000),

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

            client_id: newClient.id,

            type: "created",

            description: assignedMember
              ? `Client created and assigned to ${assignedMember.name}`
              : "Client created without an assignee",

          },

        ])



      if (activityError) {

        console.error("Activity error:", activityError)

      }



      try {

        await sendClientWelcomeEmail({

          email: newClient.email,

          name: newClient.name,

          company: newClient.company,

        })

      } catch (error) {

        console.error("Welcome email error:", error)

        welcomeEmailError = error

      }



      // Reset

      setName("")
      setEmail("")
      setCompany("")
      setAssignedTo("")



      await fetchClients()
      setPage(1)



      if (welcomeEmailError) {

        const message = welcomeEmailError instanceof Error

          ? welcomeEmailError.message

          : "Unknown email delivery error"

        alert(`Client added, but the welcome email could not be sent: ${message}`)

      } else {

        alert("Client added and welcome email sent")

      }

    } catch (err) {

      alert(err.message)

    }



    setLoading(false)

  }



  const importClientsFromExcel = async (event) => {

    const file = event.target.files?.[0]

    event.target.value = ""

    if (!file) return



    setImporting(true)



    try {

      const rows = await readXlsxFile(file)

      if (rows.length < 2) {

        throw new Error("Workbook needs a header row and at least one client row.")

      }



      const normalizeHeader = (value) =>

        String(value ?? "").toLowerCase().replace(/[^a-z]/g, "")

      const headers = rows[0].map(normalizeHeader)

      const nameIndex = headers.findIndex((header) =>

        ["name", "clientname", "fullname"].includes(header)

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

        throw new Error("No client rows were found in this workbook.")

      }



      const knownEmails = new Set(

        clients.map((client) => client.email?.trim().toLowerCase()).filter(Boolean)

      )

      const workbookEmails = new Set()

      let added = 0

      let skipped = 0

      let failed = 0

      let emailFailures = 0

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

          const { data: newClient, error } = await supabase

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

              client_id: newClient.id,

              title: "Follow up with client",

              due_date: new Date(Date.now() + 86400000),

              status: "pending",

            })

          if (taskError) console.error("Imported client task error:", taskError)



          const { error: activityError } = await supabase

            .from("activities")

            .insert({

              client_id: newClient.id,

              type: "created",

              description: assignedTo
                ? `Client imported and assigned to ${
                    teamMembers.find((member) => String(member.id) === assignedTo)?.name || "a team member"
                  }`
                : "Client imported without an assignee",

            })

          if (activityError) console.error("Imported client activity error:", activityError)



          try {

            await sendClientWelcomeEmail({

              email: newClient.email,

              name: newClient.name,

              company: newClient.company,

            })

          } catch (error) {

            emailFailures += 1

            console.error("Imported client welcome email error:", error)

            if (failureDetails.length < 3) {

              failureDetails.push(`Email failed for row ${row.rowNumber}`)

            }

          }

        } catch (error) {

          failed += 1

          console.error(`Client import failed on row ${row.rowNumber}:`, error)

          if (failureDetails.length < 3) {

            failureDetails.push(`Client row ${row.rowNumber} could not be saved`)

          }

        }

      }



      await fetchClients()
      setPage(1)
      const summary = [

        `Clients added: ${added}`,

        `Skipped (invalid or duplicate): ${skipped}`,

        `Could not save: ${failed}`,

        `Welcome emails failed: ${emailFailures}`,

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

  // DELETE CLIENT
  // =========================

  const handleDeleteClient = async (client) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${client.name}"? This will also delete this client's notes, tasks, and activity history.`
    )

    if (!confirmed) return

    try {
      // Remove related records first to avoid foreign-key errors.
      for (const table of ["notes", "tasks", "activities"]) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("client_id", client.id)

        if (error) throw error
      }

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id)

      if (error) throw error

      setClients((currentClients) =>
        currentClients.filter((item) => item.id !== client.id)
      )
      setPage(1)
      alert("Client deleted successfully.")
    } catch (error) {
      console.error("Delete client error:", error)
      alert(`Could not delete client: ${error.message || "Unknown error"}`)
    }
  }


  // =========================

  // ADD NOTE

  // =========================



  const addNote = async (clientId, noteText) => {

    if (!noteText || !noteText.trim()) return



    const { error } = await supabase

      .from("notes")

      .insert([

        {

          client_id: clientId,

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

  // FILTER CLIENTS

  // =========================



  const filteredClients = clients.filter((client) => {

    const query = search.toLowerCase().trim()



    const matchesSearch =

      !query ||

      client.name?.toLowerCase().includes(query) ||

      client.email?.toLowerCase().includes(query) ||

      client.company?.toLowerCase().includes(query)



    const matchesStage =

      stageFilter === "all" ||

      client.stage === stageFilter



    return matchesSearch && matchesStage

  })

  // =========================

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleClients = filteredClients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  const getMemberName = (memberId) =>
    teamMembers.find((member) => String(member.id) === String(memberId))?.name ||
    "Unassigned"

    // STATS

  // =========================



  const totalClients = clients.length



  const discoveryClients = clients.filter(

    (client) => client.stage === "discovery"

  ).length



  const activeClients = clients.filter(

    (client) =>

      client.stage === "active" ||

      client.stage === "signed"

  ).length



  const deliveredClients = clients.filter(

    (client) => client.stage === "delivered"

  ).length



  // =========================

  // STAGE FORMAT

  // =========================



  const formatStage = (stage) => {

    if (!stage) return "Unknown"



    return stage

      .replace("_", " ")

      .replace(/\b\w/g, (char) => char.toUpperCase())

  }



  const stageStyles = {

    discovery: { badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },

    signed: { badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },

    active: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },

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



  const card = "rounded-xl border border-gray-200 bg-white shadow-sm"



  const statCards = [

    { label: "Total Clients", value: totalClients, icon: "◉", color: "bg-violet-50 text-violet-600" },

    { label: "Discovery", value: discoveryClients, icon: "◌", color: "bg-orange-50 text-orange-500" },

    { label: "Active", value: activeClients, icon: "↗", color: "bg-emerald-50 text-emerald-600" },

    { label: "Delivered", value: deliveredClients, icon: "✓", color: "bg-blue-50 text-blue-600" },

  ]



  const inputWrap =

    "flex h-10 items-center rounded-lg border border-gray-200 bg-white transition focus-within:border-gray-400 focus-within:ring-4 focus-within:ring-gray-900/5"



  const inputBase =

    "h-full w-full border-none bg-transparent pr-3 text-sm text-gray-700 outline-none placeholder:text-gray-400"



  const toolbarControl =

    "h-[38px] rounded-lg border border-gray-200 bg-white text-[13px] text-gray-600"



  return (

    <div className="w-full text-gray-900">



      {/* HEADER */}

      <div className="mb-[22px] flex items-end justify-between max-[768px]:items-start">

        <div>

          <div className="mb-2 text-xs text-gray-400">

            CRM <span className="mx-1.5 text-gray-300">/</span> Clients

          </div>



          <h1 className="text-[22px] font-bold tracking-tight min-[481px]:text-[28px]">

            Clients

          </h1>



          <p className="mt-1.5 text-sm text-gray-500">

            Manage your clients, pipeline and relationships.

          </p>

        </div>



        <div className="flex flex-col items-end max-[768px]:hidden">

          <span className="text-xs uppercase tracking-widest text-gray-400">

            Total

          </span>

          <strong className="mt-0.5 text-[22px]">{totalClients}</strong>

        </div>

      </div>



      {/* STAT CARDS */}

      <div className="mb-[18px] grid grid-cols-1 gap-3.5 min-[481px]:grid-cols-2 min-[1101px]:grid-cols-4">

        {statCards.map((item) => (

          <div key={item.label} className={`${card} flex min-h-[88px] items-center gap-3.5 p-4`}>

            <div className={`flex h-11 w-11 items-center justify-center rounded-[10px] text-base font-bold ${item.color}`}>

              <span>{item.icon}</span>

            </div>



            <div>

              <span className="mb-1 block text-xs text-gray-400">{item.label}</span>

              <strong className="block text-[22px] font-bold text-gray-900">{item.value}</strong>

            </div>

          </div>

        ))}

      </div>



      {/* ADD CLIENT CARD */}

      <div className={`${card} mb-[18px] p-5 max-[480px]:p-3.5`}>

        <div className="mb-[18px] flex items-center justify-between max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-2.5">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-xl text-white">

              +

            </div>



            <div>

              <h2 className="text-base font-bold">Add New Client</h2>

              <p className="mt-0.5 text-xs text-gray-400">

                Create a new client and automatically assign follow-up.

              </p>

            </div>

          </div>



          <span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-600">

            ● Automation Active

          </span>

        </div>



        <div className="grid grid-cols-1 items-end gap-3 min-[769px]:grid-cols-2 min-[1101px]:grid-cols-[1fr_1fr_1fr_1fr_150px]">

          {/* NAME */}

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-gray-700">

              Client Name<span className="ml-0.5 text-red-500">*</span>

            </label>

            <div className={inputWrap}>

              <span className="flex w-10 items-center justify-center text-sm text-gray-400">◯</span>

              <input

                type="text"

                placeholder="Enter client name"

                value={name}

                onChange={(e) => setName(e.target.value)}

                className={inputBase}

              />

            </div>

          </div>



          {/* EMAIL */}

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-gray-700">

              Email Address<span className="ml-0.5 text-red-500">*</span>

            </label>

            <div className={inputWrap}>

              <span className="flex w-10 items-center justify-center text-sm text-gray-400">@</span>

              <input

                type="email"

                placeholder="client@example.com"

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

          {/* BUTTON */}

          <div>

            <button

              onClick={addClient}

              disabled={loading || importing}

              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"

            >

              {loading ? (

                <>

                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>

                  Adding...

                </>

              ) : (

                <>

                  <span className="text-base leading-none">+</span>

                  Add Client

                </>

              )}

            </button>

          </div>

        </div>



        <div className="mt-3.5 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-400">

          <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>

          <span>

            Adding a client automatically creates a follow-up task and activity record.

          </span>

        </div>

      </div>



      {/* CLIENT LIST */}

      <div className={`${card} overflow-hidden`}>

        <div className="flex min-h-[72px] items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 max-[480px]:flex-col max-[480px]:items-start">

          <div>

            <h2 className="text-base font-bold">All Clients</h2>

            <p className="mt-0.5 text-xs text-gray-400">

              Showing {visibleClients.length} of {filteredClients.length} matching client

              {filteredClients.length !== 1 ? "s" : ""}

            </p>

          </div>



          <div className="flex items-center gap-2 max-[768px]:w-full max-[480px]:flex-col max-[480px]:items-stretch">

            <label

              className={`inline-flex cursor-pointer items-center whitespace-nowrap px-3 hover:bg-gray-50 max-[480px]:justify-center ${toolbarControl} ${

                importing ? "cursor-wait opacity-60" : ""

              }`}

            >

              {importing ? "Importing..." : "Upload Excel"}

              <input

                type="file"

                accept=".xlsx"

                onChange={importClientsFromExcel}

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

                placeholder="Search clients..."

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

              <option value="signed">Signed</option>

              <option value="active">Active</option>

              <option value="delivered">Delivered</option>

            </select>

          </div>

        </div>



        {/* TABLE */}

        <div className="w-full overflow-x-auto">

          <table className="w-full min-w-[950px] border-collapse">

            <thead className="bg-gray-50">

              <tr>

                {["CLIENT", "COMPANY", "STAGE", "ASSIGNED TO", "EMAIL", "ACTION"].map((h) => (

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

              {filteredClients.length === 0 ? (

                <tr>

                  <td colSpan="6" className="p-0">

                    <div className="px-5 py-14 text-center">

                      <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-400">

                        ◉

                      </div>



                      <h3 className="text-sm font-semibold text-gray-700">

                        {clients.length === 0

                          ? "No clients yet"

                          : "No matching clients"}

                      </h3>



                      <p className="mt-1 text-xs text-gray-400">

                        {clients.length === 0

                          ? "Add your first client using the form above."

                          : "Try changing your search or stage filter."}

                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                visibleClients.map((client) => {

                  const stage = getStageStyle(client.stage)



                  return (

                    <tr

                      key={client.id}

                      className="transition-colors last:[&>td]:border-b-0 hover:bg-gray-50"

                    >

                      {/* CLIENT */}

                      <td className="border-b border-gray-100 px-5 py-3 text-[13px] text-gray-600">

                        <Link

                          to={`/client/${client.id}`}

                          className="flex items-center gap-2.5 text-inherit no-underline"

                        >

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[13px] font-bold text-indigo-600">

                            {client.name?.charAt(0)?.toUpperCase() || "C"}

                          </div>



                          <div className="flex flex-col">

                            <strong className="text-sm font-semibold text-gray-900">

                              {client.name}

                            </strong>

                            <span className="mt-0.5 text-xs text-gray-400">

                              ID: {client.id.slice(0, 8)}

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

                            {client.company || "No company"}

                          </span>

                        </div>

                      </td>



                      {/* STAGE */}

                      <td className="border-b border-gray-100 px-5 py-3">

                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${stage.badge}`}>

                          <i className={`h-1.5 w-1.5 rounded-full ${stage.dot}`}></i>

                          {formatStage(client.stage)}

                        </span>

                      </td>



                      {/* ASSIGNED */}

                      <td className="border-b border-gray-100 px-5 py-3">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">

                            {getMemberInitial(getMemberName(client.assigned_to))}

                          </div>



                          <div className="flex flex-col">

                            <strong className="text-[13px] font-semibold text-gray-700">

                              {getMemberName(client.assigned_to)}

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

                          href={`mailto:${client.email}`}

                          className="text-[13px] text-gray-500 no-underline hover:text-gray-900 hover:underline"

                        >

                          {client.email}

                        </a>

                      </td>



                      {/* ACTION */}

                      <td className="border-b border-gray-100 px-5 py-3">

                        <div className="flex items-center gap-1.5">

                          <Link

                            to={`/client/${client.id}`}

                            className="inline-flex h-8 items-center justify-center rounded-md bg-gray-900 px-3 text-xs font-semibold text-white no-underline hover:bg-gray-800"

                          >

                            View

                          </Link>



                          <button

                            className="inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50"

                            onClick={() => {

                              const note = window.prompt("Enter note")



                              if (note) {

                                addNote(client.id, note)

                              }

                            }}

                          >

                            + Note

                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteClient(client)}
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

        {filteredClients.length > 0 && (
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
                {Math.min(currentPage * pageSize, filteredClients.length)} of {filteredClients.length}
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