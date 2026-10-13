import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function Clients() {
  const [clients, setClients] = useState([])
  const [teamMembers, setTeamMembers] = useState([])

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [assignedTo, setAssignedTo] = useState("")

  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [showAddForm, setShowAddForm] = useState(false)

  // =========================
  // FETCH CLIENTS
  // =========================

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Clients fetch error:", error)
      alert(error.message)
      return
    }

    setClients(data || [])
  }

  // =========================
  // FETCH TEAM MEMBERS
  // =========================

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("id, name, designation, status")
      .eq("status", "active")
      .order("name", { ascending: true })

    if (error) {
      console.error("Team members fetch error:", error)
      alert(error.message)
      return
    }

    setTeamMembers(data || [])
  }

  useEffect(() => {
    fetchClients()
    fetchTeamMembers()
  }, [])

  // =========================
  // ADD CLIENT
  // =========================

  const addClient = async (e) => {
    e.preventDefault()

    if (!name.trim()) {
      alert("Please enter client name")
      return
    }

    if (!email.trim()) {
      alert("Please enter client email")
      return
    }

    if (!assignedTo) {
      alert("Please select a team member")
      return
    }

    setLoading(true)

    try {
      // 1. CREATE CLIENT
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert([
          {
            name: name.trim(),
            email: email.trim(),
            company: company.trim(),
            assigned_to: assignedTo,
            stage: "discovery",
          },
        ])
        .select()
        .single()

      if (clientError) {
        throw clientError
      }

      // 2. GET MEMBER NAME
      const selectedMember = teamMembers.find(
        (member) => member.id === assignedTo
      )

      const memberName = selectedMember
        ? selectedMember.name
        : "Unknown Member"

      // 3. CREATE FOLLOW-UP TASK
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { error: taskError } = await supabase
        .from("tasks")
        .insert([
          {
            client_id: newClient.id,
            title: `Follow up with ${newClient.name}`,
            due_date: tomorrow.toISOString(),
            status: "pending",
          },
        ])

      if (taskError) {
        console.error("Task creation error:", taskError)
      }

      // 4. CREATE ACTIVITY
      const { error: activityError } = await supabase
        .from("activities")
        .insert([
          {
            client_id: newClient.id,
            type: "created",
            description: `Client created and assigned to ${memberName}`,
          },
        ])

      if (activityError) {
        console.error("Activity creation error:", activityError)
      }

      // 5. RESET FORM
      setName("")
      setEmail("")
      setCompany("")
      setAssignedTo("")

      // 6. REFRESH
      await fetchClients()

      setShowAddForm(false)

      alert("Client added successfully")
    } catch (error) {
      console.error("Add client error:", error)
      alert(error.message)
    }

    setLoading(false)
  }

  // =========================
  // ADD NOTE
  // =========================

  const addNote = async (clientId, note) => {
    if (!note.trim()) return

    const { error } = await supabase
      .from("notes")
      .insert([
        {
          client_id: clientId,
          note: note.trim(),
        },
      ])

    if (error) {
      console.error("Note error:", error)
      alert(error.message)
      return
    }

    alert("Note added successfully")
  }

  // =========================
  // GET MEMBER NAME
  // =========================

  const getMemberName = (assignedTo) => {
    if (!assignedTo) return "Unassigned"

    const member = teamMembers.find(
      (item) => item.id === assignedTo
    )

    if (member) {
      return member.name
    }

    if (assignedTo === "member1") return "Member 1"
    if (assignedTo === "member2") return "Member 2"
    if (assignedTo === "member3") return "Member 3"

    return "Unassigned"
  }

  // =========================
  // GET MEMBER OBJECT
  // =========================

  const getMember = (assignedTo) => {
    return teamMembers.find(
      (member) => member.id === assignedTo
    )
  }

  // =========================
  // FILTER CLIENTS
  // =========================

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const searchValue = search.toLowerCase().trim()

      const matchesSearch =
        !searchValue ||
        client.name?.toLowerCase().includes(searchValue) ||
        client.email?.toLowerCase().includes(searchValue) ||
        client.company?.toLowerCase().includes(searchValue)

      const matchesStage =
        stageFilter === "all" ||
        client.stage === stageFilter

      return matchesSearch && matchesStage
    })
  }, [clients, search, stageFilter])

  // =========================
  // STATS
  // =========================

  const totalClients = clients.length

  const activeClients = clients.filter(
    (client) =>
      client.stage === "active" ||
      client.stage === "signed"
  ).length

  const discoveryClients = clients.filter(
    (client) => client.stage === "discovery"
  ).length

  const deliveredClients = clients.filter(
    (client) => client.stage === "delivered"
  ).length

  // =========================
  // STAGE BADGE
  // =========================

  const getStageClass = (stage) => {
    switch (stage) {
      case "discovery":
        return "stage-discovery"

      case "signed":
        return "stage-signed"

      case "active":
        return "stage-active"

      case "delivered":
        return "stage-delivered"

      default:
        return "stage-default"
    }
  }

  const formatStage = (stage) => {
    if (!stage) return "Unknown"

    return stage
      .replace("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  return (
    <div className="clients-page">

      {/* =========================
          PAGE HEADER
      ========================== */}

      <div className="clients-header">

        <div>
          <div className="breadcrumb">
            CRM <span>/</span> Clients
          </div>

          <h1>Clients</h1>

          <p>
            Manage your clients, assignments and relationships.
          </p>
        </div>

        <button
          className="add-client-btn"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <span className="plus-icon">
            {showAddForm ? "×" : "+"}
          </span>

          {showAddForm ? "Close Form" : "Add Client"}
        </button>

      </div>


      {/* =========================
          STATS
      ========================== */}

      <div className="stats-grid">

        <div className="stat-card">

          <div className="stat-icon clients-icon">
            👥
          </div>

          <div>
            <span>Total Clients</span>
            <strong>{totalClients}</strong>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon active-icon">
            ↗
          </div>

          <div>
            <span>Active Clients</span>
            <strong>{activeClients}</strong>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon discovery-icon">
            ◌
          </div>

          <div>
            <span>In Discovery</span>
            <strong>{discoveryClients}</strong>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-icon delivered-icon">
            ✓
          </div>

          <div>
            <span>Delivered</span>
            <strong>{deliveredClients}</strong>
          </div>

        </div>

      </div>


      {/* =========================
          ADD CLIENT FORM
      ========================== */}

      {showAddForm && (
        <form
          onSubmit={addClient}
          className="add-client-card"
        >

          <div className="form-heading">

            <div>
              <h2>Add New Client</h2>

              <p>
                Create a client and assign them to a team member.
              </p>
            </div>

            <div className="form-number">
              01
            </div>

          </div>


          <div className="form-grid">

            {/* NAME */}

            <div className="form-field">

              <label>
                Client Name
                <span>*</span>
              </label>

              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

            </div>


            {/* EMAIL */}

            <div className="form-field">

              <label>
                Email Address
                <span>*</span>
              </label>

              <input
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

            </div>


            {/* COMPANY */}

            <div className="form-field">

              <label>
                Company
              </label>

              <input
                type="text"
                placeholder="Company name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />

            </div>


            {/* ASSIGNED TO */}

            <div className="form-field">

              <label>
                Assign Team Member
                <span>*</span>
              </label>

              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >

                <option value="">
                  Select team member
                </option>

                {teamMembers.map((member) => (
                  <option
                    key={member.id}
                    value={member.id}
                  >
                    {member.name}
                    {member.designation
                      ? ` - ${member.designation}`
                      : ""}
                  </option>
                ))}

              </select>

              {teamMembers.length === 0 && (
                <small className="field-warning">
                  No active team members available.
                </small>
              )}

            </div>

          </div>


          <div className="form-footer">

            <p>
              <span>●</span>
              A follow-up task will automatically be created.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="submit-client-btn"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Adding...
                </>
              ) : (
                <>
                  Add Client
                  <span>→</span>
                </>
              )}
            </button>

          </div>

        </form>
      )}


      {/* =========================
          CLIENT LIST CARD
      ========================== */}

      <div className="clients-card">

        {/* TABLE HEADER */}

        <div className="clients-toolbar">

          <div>
            <h2>All Clients</h2>

            <p>
              {filteredClients.length} of {totalClients} clients
            </p>
          </div>


          <div className="toolbar-actions">

            {/* SEARCH */}

            <div className="search-box">

              <span>⌕</span>

              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

            </div>


            {/* FILTER */}

            <select
              className="stage-filter"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
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


        {/* TABLE */}

        <div className="table-wrapper">

          <table className="clients-table">

            <thead>

              <tr>

                <th>CLIENT</th>

                <th>COMPANY</th>

                <th>STAGE</th>

                <th>ASSIGNED TO</th>

                <th>CONTACT</th>

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
                        👥
                      </div>

                      <h3>
                        {clients.length === 0
                          ? "No clients yet"
                          : "No matching clients"}
                      </h3>

                      <p>
                        {clients.length === 0
                          ? "Add your first client to get started."
                          : "Try changing your search or filter."}
                      </p>

                      {clients.length === 0 && (
                        <button
                          className="empty-add-btn"
                          onClick={() => setShowAddForm(true)}
                        >
                          + Add Client
                        </button>
                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                filteredClients.map((client) => {

                  const member = getMember(
                    client.assigned_to
                  )

                  return (
                    <tr key={client.id}>

                      {/* CLIENT */}

                      <td>

                        <Link
                          to={`/client/${client.id}`}
                          className="client-info"
                        >

                          <div className="client-avatar">
                            {client.name
                              ?.charAt(0)
                              ?.toUpperCase() || "C"}
                          </div>

                          <div>

                            <strong>
                              {client.name}
                            </strong>

                            <span>
                              {client.email}
                            </span>

                          </div>

                        </Link>

                      </td>


                      {/* COMPANY */}

                      <td>

                        <div className="company-cell">

                          <span className="company-icon">
                            ◈
                          </span>

                          <span>
                            {client.company || "—"}
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

                        <div className="assigned-cell">

                          <div className="member-avatar">
                            {getMemberName(
                              client.assigned_to
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>

                            <strong>
                              {getMemberName(
                                client.assigned_to
                              )}
                            </strong>

                            {member?.designation && (
                              <span>
                                {member.designation}
                              </span>
                            )}

                          </div>

                        </div>

                      </td>


                      {/* CONTACT */}

                      <td>

                        <a
                          href={`mailto:${client.email}`}
                          className="email-link"
                        >
                          Email
                        </a>

                      </td>


                      {/* ACTION */}

                      <td>

                        <div className="action-buttons">

                          <Link
                            to={`/client/${client.id}`}
                            className="view-btn"
                          >
                            View
                          </Link>

                          <button
                            className="note-btn"
                            onClick={() => {

                              const note =
                                window.prompt(
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
                  )
                })
              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* =========================
          CSS
      ========================== */}

      <style>{`

        .clients-page {
          width: 100%;
          color: #111827;
        }


        /* =========================
           HEADER
        ========================== */

        .clients-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }

        .breadcrumb {
          color: #9ca3af;
          font-size: 11px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .breadcrumb span {
          margin: 0 6px;
          color: #d1d5db;
        }

        .clients-header h1 {
          margin: 0;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 750;
          letter-spacing: -0.7px;
        }

        .clients-header p {
          margin: 7px 0 0;
          color: #9ca3af;
          font-size: 12px;
        }


        /* =========================
           BUTTON
        ========================== */

        .add-client-btn {
          height: 42px;
          display: flex;
          align-items: center;
          gap: 9px;

          padding: 0 17px;

          border: none;
          border-radius: 9px;

          background: #111827;
          color: #ffffff;

          font-size: 12px;
          font-weight: 600;

          cursor: pointer;

          transition: all 0.2s ease;
        }

        .add-client-btn:hover {
          background: #1f2937;
          transform: translateY(-1px);
        }

        .plus-icon {
          font-size: 18px;
          line-height: 1;
        }


        /* =========================
           STATS
        ========================== */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat-card {
          min-height: 94px;

          display: flex;
          align-items: center;
          gap: 13px;

          padding: 17px;

          background: #ffffff;
          border: 1px solid #e9ebef;
          border-radius: 12px;

          box-shadow: 0 2px 7px rgba(15, 23, 42, 0.025);
        }

        .stat-icon {
          width: 43px;
          height: 43px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 10px;

          font-size: 17px;
          font-weight: 700;
        }

        .clients-icon {
          background: #eef2ff;
          color: #4f46e5;
        }

        .active-icon {
          background: #ecfdf5;
          color: #059669;
        }

        .discovery-icon {
          background: #fff7ed;
          color: #ea580c;
        }

        .delivered-icon {
          background: #f0fdf4;
          color: #16a34a;
        }

        .stat-card span {
          display: block;
          color: #9ca3af;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .stat-card strong {
          display: block;
          color: #111827;
          font-size: 21px;
          font-weight: 700;
        }


        /* =========================
           ADD FORM
        ========================== */

        .add-client-card {
          margin-bottom: 20px;

          padding: 22px;

          background: #ffffff;
          border: 1px solid #e7e9ed;
          border-radius: 13px;

          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.035);
        }

        .form-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;

          padding-bottom: 18px;
          margin-bottom: 20px;

          border-bottom: 1px solid #f0f1f3;
        }

        .form-heading h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }

        .form-heading p {
          margin: 5px 0 0;
          color: #9ca3af;
          font-size: 11px;
        }

        .form-number {
          width: 34px;
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 8px;

          background: #f3f4f6;
          color: #9ca3af;

          font-size: 10px;
          font-weight: 700;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 17px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
        }

        .form-field label {
          margin-bottom: 7px;

          color: #374151;
          font-size: 11px;
          font-weight: 600;
        }

        .form-field label span {
          margin-left: 3px;
          color: #ef4444;
        }

        .form-field input,
        .form-field select {
          width: 100%;
          height: 42px;

          padding: 0 12px;

          border: 1px solid #e1e4e8;
          border-radius: 8px;

          outline: none;

          background: #ffffff;
          color: #374151;

          font-size: 12px;

          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .form-field input:focus,
        .form-field select:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05);
        }

        .form-field input::placeholder {
          color: #b0b5bd;
        }

        .field-warning {
          margin-top: 6px;
          color: #d97706;
          font-size: 10px;
        }

        .form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;

          margin-top: 21px;
          padding-top: 17px;

          border-top: 1px solid #f0f1f3;
        }

        .form-footer p {
          margin: 0;
          color: #9ca3af;
          font-size: 10px;
        }

        .form-footer p span {
          margin-right: 5px;
          color: #22c55e;
          font-size: 7px;
        }

        .submit-client-btn {
          height: 39px;

          display: flex;
          align-items: center;
          gap: 10px;

          padding: 0 16px;

          border: none;
          border-radius: 8px;

          background: #111827;
          color: #ffffff;

          font-size: 11px;
          font-weight: 600;

          cursor: pointer;
        }

        .submit-client-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .submit-client-btn:hover:not(:disabled) {
          background: #1f2937;
        }

        .submit-client-btn span:last-child {
          font-size: 14px;
        }

        .spinner {
          width: 12px;
          height: 12px;

          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #ffffff;
          border-radius: 50%;

          animation: clientSpin 0.7s linear infinite;
        }

        @keyframes clientSpin {
          to {
            transform: rotate(360deg);
          }
        }


        /* =========================
           CLIENTS CARD
        ========================== */

        .clients-card {
          overflow: hidden;

          background: #ffffff;
          border: 1px solid #e7e9ed;
          border-radius: 13px;

          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.03);
        }

        .clients-toolbar {
          min-height: 76px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 15px 19px;

          border-bottom: 1px solid #eef0f2;
        }

        .clients-toolbar h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
        }

        .clients-toolbar p {
          margin: 4px 0 0;
          color: #a1a1aa;
          font-size: 10px;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-box {
          width: 190px;
          height: 36px;

          display: flex;
          align-items: center;
          gap: 7px;

          padding: 0 10px;

          background: #f8f9fb;
          border: 1px solid #eceef1;
          border-radius: 8px;
        }

        .search-box span {
          color: #9ca3af;
          font-size: 17px;
        }

        .search-box input {
          width: 100%;

          border: none;
          outline: none;
          background: transparent;

          color: #374151;
          font-size: 11px;
        }

        .search-box input::placeholder {
          color: #a1a1aa;
        }

        .stage-filter {
          height: 36px;

          padding: 0 10px;

          border: 1px solid #eceef1;
          border-radius: 8px;

          background: #ffffff;
          color: #4b5563;

          font-size: 10px;
          outline: none;
          cursor: pointer;
        }


        /* =========================
           TABLE
        ========================== */

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .clients-table {
          width: 100%;
          min-width: 920px;

          border-collapse: collapse;
        }

        .clients-table th {
          height: 43px;

          padding: 0 17px;

          background: #fafafa;

          border-bottom: 1px solid #eef0f2;

          color: #9ca3af;

          text-align: left;

          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.06em;
        }

        .clients-table td {
          padding: 14px 17px;

          border-bottom: 1px solid #f1f2f4;

          color: #4b5563;

          font-size: 11px;

          vertical-align: middle;
        }

        .clients-table tbody tr {
          transition: background 0.15s ease;
        }

        .clients-table tbody tr:hover {
          background: #fafbfc;
        }

        .clients-table tbody tr:last-child td {
          border-bottom: none;
        }


        /* =========================
           CLIENT
        ========================== */

        .client-info {
          display: flex;
          align-items: center;
          gap: 10px;

          text-decoration: none;
        }

        .client-avatar {
          width: 34px;
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 9px;

          background: #eef2ff;
          color: #4f46e5;

          font-size: 11px;
          font-weight: 700;
        }

        .client-info > div:last-child {
          min-width: 120px;
          display: flex;
          flex-direction: column;
        }

        .client-info strong {
          color: #111827;
          font-size: 11px;
          font-weight: 650;
        }

        .client-info span {
          margin-top: 3px;

          color: #9ca3af;
          font-size: 9px;
        }


        /* =========================
           COMPANY
        ========================== */

        .company-cell {
          display: flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        }

        .company-icon {
          width: 25px;
          height: 25px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 6px;

          background: #f5f5f5;
          color: #6b7280;

          font-size: 11px;
        }


        /* =========================
           STAGE
        ========================== */

        .stage-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;

          padding: 5px 8px;

          border-radius: 6px;

          font-size: 9px;
          font-weight: 600;

          white-space: nowrap;
        }

        .stage-badge i {
          width: 5px;
          height: 5px;

          border-radius: 50%;
        }

        .stage-discovery {
          background: #fff7ed;
          color: #c2410c;
        }

        .stage-discovery i {
          background: #f97316;
        }

        .stage-signed {
          background: #eff6ff;
          color: #2563eb;
        }

        .stage-signed i {
          background: #3b82f6;
        }

        .stage-active {
          background: #ecfdf5;
          color: #047857;
        }

        .stage-active i {
          background: #10b981;
        }

        .stage-delivered {
          background: #f0fdf4;
          color: #15803d;
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
           ASSIGNED MEMBER
        ========================== */

        .assigned-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 125px;
        }

        .member-avatar {
          width: 27px;
          height: 27px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 50%;

          background: #f3f4f6;
          color: #374151;

          font-size: 9px;
          font-weight: 700;
        }

        .assigned-cell > div:last-child {
          display: flex;
          flex-direction: column;
        }

        .assigned-cell strong {
          color: #374151;
          font-size: 10px;
          font-weight: 600;
        }

        .assigned-cell span {
          margin-top: 2px;
          color: #9ca3af;
          font-size: 8px;
        }


        /* =========================
           EMAIL
        ========================== */

        .email-link {
          color: #6b7280;
          text-decoration: none;

          padding: 5px 8px;

          border: 1px solid #e5e7eb;
          border-radius: 6px;

          font-size: 9px;
          font-weight: 600;
        }

        .email-link:hover {
          background: #f9fafb;
          color: #111827;
        }


        /* =========================
           ACTIONS
        ========================== */

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .view-btn,
        .note-btn {
          height: 28px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          padding: 0 8px;

          border-radius: 6px;

          font-size: 9px;
          font-weight: 600;

          cursor: pointer;
          text-decoration: none;
        }

        .view-btn {
          background: #111827;
          color: #ffffff;
        }

        .view-btn:hover {
          background: #1f2937;
        }

        .note-btn {
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #4b5563;
        }

        .note-btn:hover {
          background: #f9fafb;
        }


        /* =========================
           EMPTY
        ========================== */

        .empty-cell {
          padding: 0 !important;
        }

        .empty-state {
          padding: 55px 20px;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;

          display: flex;
          align-items: center;
          justify-content: center;

          margin: 0 auto 12px;

          border-radius: 12px;

          background: #f3f4f6;

          font-size: 19px;
        }

        .empty-state h3 {
          margin: 0;

          color: #374151;
          font-size: 13px;
          font-weight: 650;
        }

        .empty-state p {
          margin: 5px 0 15px;

          color: #9ca3af;
          font-size: 10px;
        }

        .empty-add-btn {
          height: 34px;

          padding: 0 12px;

          border: none;
          border-radius: 7px;

          background: #111827;
          color: #ffffff;

          font-size: 10px;
          font-weight: 600;

          cursor: pointer;
        }


        /* =========================
           RESPONSIVE
        ========================== */

        @media (max-width: 1100px) {

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

        }


        @media (max-width: 768px) {

          .clients-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .add-client-btn {
            width: 100%;
            justify-content: center;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-footer {
            align-items: flex-start;
            flex-direction: column;
            gap: 13px;
          }

          .submit-client-btn {
            width: 100%;
            justify-content: center;
          }

          .clients-toolbar {
            align-items: flex-start;
            flex-direction: column;
            gap: 14px;
          }

          .toolbar-actions {
            width: 100%;
          }

          .search-box {
            flex: 1;
            width: auto;
          }

          .stage-filter {
            flex-shrink: 0;
          }

        }


        @media (max-width: 480px) {

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .clients-header h1 {
            font-size: 23px;
          }

          .add-client-card {
            padding: 16px;
          }

          .clients-toolbar {
            padding: 14px;
          }

          .toolbar-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .search-box {
            width: 100%;
          }

          .stage-filter {
            width: 100%;
          }

        }

      `}</style>

    </div>
  )
}