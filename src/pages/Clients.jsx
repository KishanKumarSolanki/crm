import { useEffect, useState } from "react"
import readXlsxFile from "read-excel-file/browser"
import { supabase } from "../lib/supabase"
import { sendClientWelcomeEmail } from "../lib/email"
import { Link } from "react-router-dom"

export default function Clients() {
  const [clients, setClients] = useState([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")

  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")

  // =========================
  // FETCH CLIENTS
  // =========================

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error) {
      setClients(data || [])
    } else {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

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
      // Auto assign
      const team = ["member1", "member2", "member3"]

      const randomMember =
        team[Math.floor(Math.random() * team.length)]

      // Insert client
      const { data, error } = await supabase
        .from("clients")
        .insert([
          {
            name: name.trim(),
            email: email.trim(),
            company: company.trim(),
            assigned_to: randomMember,
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
            description: `Client created and assigned to ${randomMember}`,
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

      await fetchClients()

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

        const team = ["member1", "member2", "member3"]
        const assignedTo = team[Math.floor(Math.random() * team.length)]

        try {
          const { data: newClient, error } = await supabase
            .from("clients")
            .insert({
              name: row.name,
              email: row.email,
              company: row.company,
              assigned_to: assignedTo,
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
              description: `Client imported and assigned to ${assignedTo}`,
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

  const getStageClass = (stage) => {
    if (stage === "discovery") return "stage-discovery"
    if (stage === "signed") return "stage-signed"
    if (stage === "active") return "stage-active"
    if (stage === "delivered") return "stage-delivered"

    return "stage-default"
  }

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

  return (
    <div className="clients-page">

      {/* =========================
          HEADER
      ========================= */}

      <div className="page-header">

        <div>
          <div className="breadcrumb">
            CRM <span>/</span> Clients
          </div>

          <h1>Clients</h1>

          <p>
            Manage your clients, pipeline and relationships.
          </p>
        </div>

        <div className="header-count">
          <span>Total</span>
          <strong>{totalClients}</strong>
        </div>

      </div>


      {/* =========================
          STAT CARDS
      ========================= */}

      <div className="stats-grid">

        <div className="stat-card">

          <div className="stat-icon purple">
            <span>◉</span>
          </div>

          <div className="stat-content">
            <span>Total Clients</span>
            <strong>{totalClients}</strong>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon orange">
            <span>◌</span>
          </div>

          <div className="stat-content">
            <span>Discovery</span>
            <strong>{discoveryClients}</strong>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon green">
            <span>↗</span>
          </div>

          <div className="stat-content">
            <span>Active</span>
            <strong>{activeClients}</strong>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon blue">
            <span>✓</span>
          </div>

          <div className="stat-content">
            <span>Delivered</span>
            <strong>{deliveredClients}</strong>
          </div>

        </div>

      </div>


      {/* =========================
          ADD CLIENT CARD
      ========================= */}

      <div className="add-client-card">

        <div className="section-header">

          <div>
            <div className="section-icon">
              +
            </div>

            <div>
              <h2>Add New Client</h2>

              <p>
                Create a new client and automatically assign follow-up.
              </p>
            </div>
          </div>

          <span className="automation-badge">
            ● Automation Active
          </span>

        </div>


        <div className="form-grid">

          {/* NAME */}

          <div className="form-group">

            <label>
              Client Name
              <span>*</span>
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                ◯
              </span>

              <input
                type="text"
                placeholder="Enter client name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />

            </div>

          </div>


          {/* EMAIL */}

          <div className="form-group">

            <label>
              Email Address
              <span>*</span>
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                @
              </span>

              <input
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />

            </div>

          </div>


          {/* COMPANY */}

          <div className="form-group">

            <label>
              Company
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                ◈
              </span>

              <input
                type="text"
                placeholder="Company name"
                value={company}
                onChange={(e) =>
                  setCompany(e.target.value)
                }
              />

            </div>

          </div>


          {/* BUTTON */}

          <div className="form-group button-group">

            <label>
              &nbsp;
            </label>

            <button
              className="add-btn"
              onClick={addClient}
              disabled={loading || importing}
            >

              {loading ? (
                <>
                  <span className="spinner"></span>
                  Adding...
                </>
              ) : (
                <>
                  <span>+</span>
                  Add Client
                </>
              )}

            </button>

          </div>

        </div>


        <div className="automation-info">

          <span className="info-dot"></span>

          <span>
            Adding a client automatically creates a follow-up task
            and activity record.
          </span>

        </div>

      </div>


      {/* =========================
          CLIENT LIST
      ========================= */}

      <div className="clients-card">

        <div className="clients-toolbar">

          <div>
            <h2>All Clients</h2>

            <p>
              {filteredClients.length} client
              {filteredClients.length !== 1 ? "s" : ""} found
            </p>
          </div>


          <div className="toolbar-right">

            <label className={`import-btn${importing ? " disabled" : ""}`}>
              {importing ? "Importing..." : "Upload Excel"}
              <input
                type="file"
                accept=".xlsx"
                onChange={importClientsFromExcel}
                disabled={importing}
                aria-label="Upload Excel workbook"
              />
            </label>

            {/* SEARCH */}

            <div className="search-box">

              <span>⌕</span>

              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

            </div>


            {/* FILTER */}

            <select
              value={stageFilter}
              onChange={(e) =>
                setStageFilter(e.target.value)
              }
            >

              <option value="all">
                All Stages
              </option>

              <option value="discovery">
                Discovery
              </option>

              <option value="signed">
                Signed
              </option>

              <option value="active">
                Active
              </option>

              <option value="delivered">
                Delivered
              </option>

            </select>

          </div>

        </div>


        {/* =========================
            TABLE
        ========================= */}

        <div className="table-container">

          <table>

            <thead>

              <tr>

                <th>CLIENT</th>

                <th>COMPANY</th>

                <th>STAGE</th>

                <th>ASSIGNED TO</th>

                <th>EMAIL</th>

                <th>ACTION</th>

              </tr>

            </thead>


            <tbody>

              {filteredClients.length === 0 ? (

                <tr>

                  <td
                    colSpan="6"
                    className="empty-cell"
                  >

                    <div className="empty-state">

                      <div className="empty-icon">
                        ◉
                      </div>

                      <h3>
                        {clients.length === 0
                          ? "No clients yet"
                          : "No matching clients"}
                      </h3>

                      <p>
                        {clients.length === 0
                          ? "Add your first client using the form above."
                          : "Try changing your search or stage filter."}
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredClients.map((client) => (

                  <tr key={client.id}>

                    {/* CLIENT */}

                    <td>

                      <Link
                        to={`/client/${client.id}`}
                        className="client-link"
                      >

                        <div className="client-avatar">
                          {client.name
                            ?.charAt(0)
                            ?.toUpperCase() || "C"}
                        </div>

                        <div className="client-details">

                          <strong>
                            {client.name}
                          </strong>

                          <span>
                            ID: {client.id.slice(0, 8)}
                          </span>

                        </div>

                      </Link>

                    </td>


                    {/* COMPANY */}

                    <td>

                      <div className="company-info">

                        <div className="company-icon">
                          ◈
                        </div>

                        <span>
                          {client.company || "No company"}
                        </span>

                      </div>

                    </td>


                    {/* STAGE */}

                    <td>

                      <span
                        className={`stage-badge ${getStageClass(
                          client.stage
                        )}`}
                      >

                        <i></i>

                        {formatStage(client.stage)}

                      </span>

                    </td>


                    {/* ASSIGNED */}

                    <td>

                      <div className="assigned-member">

                        <div className="member-avatar">
                          {getMemberInitial(
                            client.assigned_to
                          )}
                        </div>

                        <div>
                          <strong>
                            {client.assigned_to ||
                              "Unassigned"}
                          </strong>

                          <span>
                            Team Member
                          </span>
                        </div>

                      </div>

                    </td>


                    {/* EMAIL */}

                    <td>

                      <a
                        href={`mailto:${client.email}`}
                        className="email-link"
                      >
                        {client.email}
                      </a>

                    </td>


                    {/* ACTION */}

                    <td>

                      <div className="actions">

                        <Link
                          to={`/client/${client.id}`}
                          className="view-btn"
                        >
                          View
                        </Link>

                        <button
                          className="note-btn"
                          onClick={() => {

                            const note = window.prompt(
                              "Enter note"
                            )

                            if (note) {
                              addNote(
                                client.id,
                                note
                              )
                            }

                          }}
                        >
                          + Note
                        </button>

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* =========================
          CSS
      ========================= */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        .clients-page {
          width: 100%;
          color: #111827;
        }


        /* =========================
           PAGE HEADER
        ========================= */

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .breadcrumb {
          color: #9ca3af;
          font-size: 10px;
          margin-bottom: 7px;
        }

        .breadcrumb span {
          margin: 0 6px;
          color: #d1d5db;
        }

        .page-header h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 750;
          letter-spacing: -0.7px;
        }

        .page-header p {
          margin: 6px 0 0;
          color: #9ca3af;
          font-size: 11px;
        }

        .header-count {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .header-count span {
          color: #9ca3af;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .header-count strong {
          margin-top: 2px;
          font-size: 20px;
        }


        /* =========================
           STATS
        ========================= */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 13px;
          margin-bottom: 18px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;

          min-height: 86px;
          padding: 15px;

          background: #fff;
          border: 1px solid #e8eaee;
          border-radius: 11px;

          box-shadow:
            0 2px 7px rgba(15, 23, 42, 0.025);
        }

        .stat-icon {
          width: 40px;
          height: 40px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 9px;

          font-size: 16px;
          font-weight: 700;
        }

        .stat-icon.purple {
          background: #f0edff;
          color: #635bdb;
        }

        .stat-icon.orange {
          background: #fff4e8;
          color: #ea7a18;
        }

        .stat-icon.green {
          background: #eafaf2;
          color: #15966b;
        }

        .stat-icon.blue {
          background: #eaf3ff;
          color: #3976d6;
        }

        .stat-content span {
          display: block;
          color: #9ca3af;
          font-size: 9px;
          margin-bottom: 4px;
        }

        .stat-content strong {
          display: block;
          color: #111827;
          font-size: 20px;
          font-weight: 700;
        }


        /* =========================
           ADD CLIENT
        ========================= */

        .add-client-card {
          margin-bottom: 18px;
          padding: 19px;

          background: #fff;
          border: 1px solid #e8eaee;
          border-radius: 11px;

          box-shadow:
            0 2px 7px rgba(15, 23, 42, 0.025);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;

          margin-bottom: 18px;
        }

        .section-header > div:first-child {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-icon {
          width: 34px;
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 8px;

          background: #111827;
          color: white;

          font-size: 19px;
        }

        .section-header h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
        }

        .section-header p {
          margin: 3px 0 0;
          color: #9ca3af;
          font-size: 9px;
        }

        .automation-badge {
          padding: 6px 9px;

          border-radius: 6px;

          background: #ecfdf5;
          color: #059669;

          font-size: 8px;
          font-weight: 600;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 145px;
          gap: 11px;
          align-items: end;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;

          color: #374151;
          font-size: 9px;
          font-weight: 600;
        }

        .form-group label span {
          color: #ef4444;
          margin-left: 2px;
        }

        .input-wrapper {
          height: 39px;

          display: flex;
          align-items: center;

          border: 1px solid #e2e5e9;
          border-radius: 7px;

          background: #fff;

          transition: all 0.2s ease;
        }

        .input-wrapper:focus-within {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.04);
        }

        .input-icon {
          width: 34px;
          display: flex;
          align-items: center;
          justify-content: center;

          color: #a1a1aa;
          font-size: 12px;
        }

        .input-wrapper input {
          width: 100%;
          height: 100%;

          padding-right: 9px;

          border: none;
          outline: none;
          background: transparent;

          color: #374151;
          font-size: 10px;
        }

        .input-wrapper input::placeholder {
          color: #b1b5bc;
        }

        .add-btn {
          width: 100%;
          height: 39px;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;

          border: none;
          border-radius: 7px;

          background: #111827;
          color: white;

          font-size: 10px;
          font-weight: 600;

          cursor: pointer;

          transition: all 0.2s ease;
        }

        .add-btn:hover:not(:disabled) {
          background: #1f2937;
          transform: translateY(-1px);
        }

        .add-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .add-btn > span:first-child {
          font-size: 16px;
          line-height: 1;
        }

        .spinner {
          width: 11px;
          height: 11px;

          border: 2px solid rgba(255,255,255,.3);
          border-top-color: #fff;
          border-radius: 50%;

          animation: spin .7s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .automation-info {
          display: flex;
          align-items: center;
          gap: 6px;

          margin-top: 13px;
          padding-top: 12px;

          border-top: 1px solid #f0f1f3;

          color: #9ca3af;
          font-size: 8px;
        }

        .info-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #22c55e;
        }


        /* =========================
           CLIENT CARD
        ========================= */

        .clients-card {
          overflow: hidden;

          background: #fff;
          border: 1px solid #e8eaee;
          border-radius: 11px;

          box-shadow:
            0 2px 7px rgba(15, 23, 42, 0.025);
        }

        .clients-toolbar {
          min-height: 68px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 12px 17px;

          border-bottom: 1px solid #edf0f2;
        }

        .clients-toolbar h2 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
        }

        .clients-toolbar p {
          margin: 3px 0 0;
          color: #a1a1aa;
          font-size: 8px;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .import-btn {
          height: 34px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border: 1px solid #e8eaee;
          border-radius: 7px;
          background: white;
          color: #4b5563;
          font-size: 9px;
          cursor: pointer;
          white-space: nowrap;
        }

        .import-btn.disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .import-btn input {
          display: none;
        }

        .search-box {
          width: 185px;
          height: 34px;

          display: flex;
          align-items: center;
          gap: 6px;

          padding: 0 9px;

          border: 1px solid #e8eaee;
          border-radius: 7px;

          background: #fafbfc;
        }

        .search-box span {
          color: #9ca3af;
          font-size: 15px;
        }

        .search-box input {
          width: 100%;

          border: none;
          outline: none;
          background: transparent;

          font-size: 9px;
          color: #374151;
        }

        .search-box input::placeholder {
          color: #a5a9b0;
        }

        .toolbar-right select {
          height: 34px;

          padding: 0 8px;

          border: 1px solid #e8eaee;
          border-radius: 7px;

          background: white;
          color: #4b5563;

          font-size: 9px;
          outline: none;

          cursor: pointer;
        }


        /* =========================
           TABLE
        ========================= */

        .table-container {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 950px;
          border-collapse: collapse;
        }

        thead {
          background: #fafafa;
        }

        th {
          height: 40px;

          padding: 0 15px;

          border-bottom: 1px solid #edf0f2;

          color: #9ca3af;

          text-align: left;

          font-size: 8px;
          font-weight: 700;
          letter-spacing: .06em;
        }

        td {
          padding: 12px 15px;

          border-bottom: 1px solid #f1f2f4;

          color: #4b5563;

          font-size: 9px;
        }

        tbody tr {
          transition: background .15s ease;
        }

        tbody tr:hover {
          background: #fafbfc;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }


        /* =========================
           CLIENT
        ========================= */

        .client-link {
          display: flex;
          align-items: center;
          gap: 9px;

          color: inherit;
          text-decoration: none;
        }

        .client-avatar {
          width: 32px;
          height: 32px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 8px;

          background: #eef0ff;
          color: #5b56c8;

          font-size: 10px;
          font-weight: 700;
        }

        .client-details {
          display: flex;
          flex-direction: column;
        }

        .client-details strong {
          color: #111827;
          font-size: 10px;
          font-weight: 650;
        }

        .client-details span {
          margin-top: 3px;
          color: #a1a1aa;
          font-size: 7px;
        }


        /* =========================
           COMPANY
        ========================= */

        .company-info {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .company-icon {
          width: 25px;
          height: 25px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 6px;

          background: #f4f5f6;
          color: #6b7280;

          font-size: 10px;
        }

        .company-info span {
          white-space: nowrap;
        }


        /* =========================
           STAGE
        ========================= */

        .stage-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;

          padding: 5px 7px;

          border-radius: 5px;

          font-size: 8px;
          font-weight: 600;
        }

        .stage-badge i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .stage-discovery {
          background: #fff5e9;
          color: #c76513;
        }

        .stage-discovery i {
          background: #f97316;
        }

        .stage-signed {
          background: #edf4ff;
          color: #3475d3;
        }

        .stage-signed i {
          background: #3b82f6;
        }

        .stage-active {
          background: #eafaf2;
          color: #07855d;
        }

        .stage-active i {
          background: #10b981;
        }

        .stage-delivered {
          background: #edf9ef;
          color: #19863b;
        }

        .stage-delivered i {
          background: #22c55e;
        }

        .stage-default {
          background: #f3f4f6;
          color: #6b7280;
        }

        .stage-default i {
          background: #9ca3af;
        }


        /* =========================
           MEMBER
        ========================= */

        .assigned-member {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .member-avatar {
          width: 27px;
          height: 27px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #f1f5f9;
          color: #475569;

          font-size: 8px;
          font-weight: 700;
        }

        .assigned-member > div:last-child {
          display: flex;
          flex-direction: column;
        }

        .assigned-member strong {
          color: #374151;
          font-size: 9px;
          font-weight: 600;
        }

        .assigned-member span {
          margin-top: 2px;
          color: #a1a1aa;
          font-size: 7px;
        }


        /* =========================
           EMAIL
        ========================= */

        .email-link {
          color: #6b7280;
          text-decoration: none;
          font-size: 8px;
        }

        .email-link:hover {
          color: #111827;
          text-decoration: underline;
        }


        /* =========================
           ACTION
        ========================= */

        .actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .view-btn,
        .note-btn {
          height: 27px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          padding: 0 8px;

          border-radius: 5px;

          font-size: 8px;
          font-weight: 600;

          cursor: pointer;
          text-decoration: none;
        }

        .view-btn {
          background: #111827;
          color: white;
        }

        .view-btn:hover {
          background: #1f2937;
        }

        .note-btn {
          border: 1px solid #e5e7eb;
          background: white;
          color: #4b5563;
        }

        .note-btn:hover {
          background: #f8f9fa;
        }


        /* =========================
           EMPTY STATE
        ========================= */

        .empty-cell {
          padding: 0 !important;
        }

        .empty-state {
          padding: 55px 20px;
          text-align: center;
        }

        .empty-icon {
          width: 45px;
          height: 45px;

          display: flex;
          align-items: center;
          justify-content: center;

          margin: 0 auto 10px;

          border-radius: 11px;

          background: #f3f4f6;
          color: #9ca3af;

          font-size: 17px;
        }

        .empty-state h3 {
          margin: 0;
          color: #374151;
          font-size: 12px;
        }

        .empty-state p {
          margin: 5px 0 0;
          color: #a1a1aa;
          font-size: 9px;
        }


        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 1100px) {

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .form-grid {
            grid-template-columns: 1fr 1fr;
          }

        }


        @media (max-width: 768px) {

          .page-header {
            align-items: flex-start;
          }

          .header-count {
            display: none;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .section-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .toolbar-right {
            width: 100%;
          }

          .search-box {
            flex: 1;
            width: auto;
          }

        }


        @media (max-width: 480px) {

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .page-header h1 {
            font-size: 22px;
          }

          .add-client-card {
            padding: 14px;
          }

          .clients-toolbar {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .toolbar-right {
            flex-direction: column;
            align-items: stretch;
          }

          .search-box {
            width: 100%;
          }

          .toolbar-right select {
            width: 100%;
          }

        }

      `}</style>

    </div>
  )
}