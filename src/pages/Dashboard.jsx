import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = async () => {
    setLoading(true)

    const [
      clientsResult,
      tasksResult,
      activitiesResult,
      membersResult
    ] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true }),

      supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),

      supabase
        .from("team_members")
        .select("*")
        .eq("status", "active")
        .order("name", { ascending: true })
    ])

    if (clientsResult.error) {
      console.error("Clients:", clientsResult.error)
    }

    if (tasksResult.error) {
      console.error("Tasks:", tasksResult.error)
    }

    if (activitiesResult.error) {
      console.error("Activities:", activitiesResult.error)
    }

    if (membersResult.error) {
      console.error("Team Members:", membersResult.error)
    }

    setClients(clientsResult.data || [])
    setTasks(tasksResult.data || [])
    setActivities(activitiesResult.data || [])
    setTeamMembers(membersResult.data || [])

    setLoading(false)
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // =========================
  // STATISTICS
  // =========================

  const totalClients = clients.length

  const activeClients = clients.filter(
    (client) => client.stage === "active"
  ).length

  const deliveredClients = clients.filter(
    (client) => client.stage === "delivered"
  ).length

  const pendingTasks = tasks.filter(
    (task) => task.status !== "completed"
  ).length

  const discoveryClients = clients.filter(
    (client) => client.stage === "discovery"
  ).length

  const signedClients = clients.filter(
    (client) => client.stage === "signed"
  ).length

  // =========================
  // TEAM WORKLOAD
  // =========================

  const getMemberClients = (memberId) => {
    return clients.filter(
      (client) => client.assigned_to === memberId
    ).length
  }

  const getMemberTasks = (memberId) => {
    const memberClientIds = clients
      .filter((client) => client.assigned_to === memberId)
      .map((client) => client.id)

    return tasks.filter(
      (task) =>
        memberClientIds.includes(task.client_id) &&
        task.status !== "completed"
    ).length
  }

  // =========================
  // HELPERS
  // =========================

  const getStageLabel = (stage) => {
    if (!stage) return "Unknown"

    return stage.charAt(0).toUpperCase() + stage.slice(1)
  }

  const getActivityTime = (date) => {
    if (!date) return ""

    return new Date(date).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case "created":
        return "＋"

      case "stage_change":
        return "↗"

      case "task_created":
        return "✓"

      case "note":
        return "✎"

      default:
        return "•"
    }
  }

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>

        <style>{`
          .dashboard-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f6f8fb;
            color: #64748b;
            font-family: Inter, Arial, sans-serif;
          }

          .loading-spinner {
            width: 38px;
            height: 38px;
            border: 3px solid #e2e8f0;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 14px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="dashboard-page">

      {/* =========================
          HEADER
      ========================= */}

      <div className="dashboard-header">

        <div>
          <div className="eyebrow">
            CRM OVERVIEW
          </div>

          <h1>
            Dashboard
          </h1>

          <p>
            Keep track of your clients, tasks and team activity.
          </p>
        </div>

        <div className="header-actions">

          <Link
            to="/clients"
            className="secondary-button"
          >
            View Clients
          </Link>

          <Link
            to="/clients"
            className="primary-button"
          >
            + Add Client
          </Link>

        </div>

      </div>


      {/* =========================
          STAT CARDS
      ========================= */}

      <div className="stats-grid">

        <div className="stat-card">

          <div className="stat-top">
            <span className="stat-label">
              Total Clients
            </span>

            <div className="stat-icon blue">
              ◉
            </div>
          </div>

          <div className="stat-value">
            {totalClients}
          </div>

          <div className="stat-bottom">
            <span className="positive">
              All clients
            </span>

            <span>
              in CRM
            </span>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span className="stat-label">
              Active Clients
            </span>

            <div className="stat-icon green">
              ↗
            </div>
          </div>

          <div className="stat-value">
            {activeClients}
          </div>

          <div className="stat-bottom">
            <span className="positive">
              Active
            </span>

            <span>
              projects
            </span>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span className="stat-label">
              Delivered
            </span>

            <div className="stat-icon purple">
              ✓
            </div>
          </div>

          <div className="stat-value">
            {deliveredClients}
          </div>

          <div className="stat-bottom">
            <span className="positive">
              Completed
            </span>

            <span>
              projects
            </span>
          </div>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span className="stat-label">
              Pending Tasks
            </span>

            <div className="stat-icon orange">
              !
            </div>
          </div>

          <div className="stat-value">
            {pendingTasks}
          </div>

          <div className="stat-bottom">
            <span className="warning">
              Needs attention
            </span>
          </div>

        </div>

      </div>


      {/* =========================
          MAIN GRID
      ========================= */}

      <div className="main-grid">

        {/* PIPELINE */}

        <div className="panel">

          <div className="panel-header">

            <div>
              <h2>
                Client Pipeline
              </h2>

              <p>
                Current distribution of your clients
              </p>
            </div>

            <Link
              to="/pipeline"
              className="view-link"
            >
              View Pipeline →
            </Link>

          </div>


          <div className="pipeline-list">

            <div className="pipeline-item">

              <div className="pipeline-info">

                <span className="pipeline-dot discovery"></span>

                <span>
                  Discovery
                </span>

              </div>

              <strong>
                {discoveryClients}
              </strong>

            </div>


            <div className="pipeline-item">

              <div className="pipeline-info">

                <span className="pipeline-dot signed"></span>

                <span>
                  Signed
                </span>

              </div>

              <strong>
                {signedClients}
              </strong>

            </div>


            <div className="pipeline-item">

              <div className="pipeline-info">

                <span className="pipeline-dot active"></span>

                <span>
                  Active
                </span>

              </div>

              <strong>
                {activeClients}
              </strong>

            </div>


            <div className="pipeline-item">

              <div className="pipeline-info">

                <span className="pipeline-dot delivered"></span>

                <span>
                  Delivered
                </span>

              </div>

              <strong>
                {deliveredClients}
              </strong>

            </div>

          </div>

        </div>


        {/* TEAM WORKLOAD */}

        <div className="panel">

          <div className="panel-header">

            <div>
              <h2>
                Team Workload
              </h2>

              <p>
                Assigned clients and pending tasks
              </p>
            </div>

            <Link
              to="/team-members"
              className="view-link"
            >
              View Team →
            </Link>

          </div>


          <div className="team-list">

            {teamMembers.length === 0 ? (

              <div className="empty-state">
                No active team members.
              </div>

            ) : (

              teamMembers.slice(0, 5).map((member) => {

                const memberClients =
                  getMemberClients(member.id)

                const memberTasks =
                  getMemberTasks(member.id)

                return (
                  <Link
                    key={member.id}
                    to={`/team-member/${member.id}`}
                    className="team-item"
                  >

                    <div className="avatar">
                      {member.name
                        ? member.name
                            .charAt(0)
                            .toUpperCase()
                        : "?"}
                    </div>

                    <div className="team-info">

                      <strong>
                        {member.name}
                      </strong>

                      <span>
                        {member.designation ||
                          "Team Member"}
                      </span>

                    </div>

                    <div className="team-stats">

                      <strong>
                        {memberClients}
                      </strong>

                      <span>
                        clients
                      </span>

                    </div>

                    <div className="task-count">
                      {memberTasks}
                    </div>

                  </Link>
                )
              })

            )}

          </div>

        </div>

      </div>


      {/* =========================
          LOWER GRID
      ========================= */}

      <div className="lower-grid">

        {/* RECENT ACTIVITIES */}

        <div className="panel activities-panel">

          <div className="panel-header">

            <div>
              <h2>
                Recent Activity
              </h2>

              <p>
                Latest CRM activity
              </p>
            </div>

          </div>


          <div className="activity-list">

            {activities.length === 0 ? (

              <div className="empty-state">
                No recent activity.
              </div>

            ) : (

              activities.map((activity) => (

                <div
                  className="activity-item"
                  key={activity.id}
                >

                  <div className="activity-icon">
                    {getActivityIcon(activity.type)}
                  </div>

                  <div className="activity-content">

                    <strong>
                      {activity.description}
                    </strong>

                    <span>
                      {getActivityTime(
                        activity.created_at
                      )}
                    </span>

                  </div>

                </div>

              ))

            )}

          </div>

        </div>


        {/* QUICK ACTIONS */}

        <div className="panel">

          <div className="panel-header">

            <div>
              <h2>
                Quick Actions
              </h2>

              <p>
                Common CRM actions
              </p>
            </div>

          </div>


          <div className="quick-actions">

            <Link
              to="/clients"
              className="quick-action"
            >

              <div className="quick-icon blue">
                +
              </div>

              <div>
                <strong>
                  Add Client
                </strong>

                <span>
                  Create a new client
                </span>
              </div>

              <span className="arrow">
                →
              </span>

            </Link>


            <Link
              to="/team-members"
              className="quick-action"
            >

              <div className="quick-icon green">
                +
              </div>

              <div>
                <strong>
                  Add Team Member
                </strong>

                <span>
                  Add someone to your team
                </span>
              </div>

              <span className="arrow">
                →
              </span>

            </Link>


            <Link
              to="/pipeline"
              className="quick-action"
            >

              <div className="quick-icon purple">
                ↗
              </div>

              <div>
                <strong>
                  Open Pipeline
                </strong>

                <span>
                  Manage client stages
                </span>
              </div>

              <span className="arrow">
                →
              </span>

            </Link>


            <Link
              to="/tasks"
              className="quick-action"
            >

              <div className="quick-icon orange">
                ✓
              </div>

              <div>
                <strong>
                  View Tasks
                </strong>

                <span>
                  Check pending work
                </span>
              </div>

              <span className="arrow">
                →
              </span>

            </Link>

          </div>

        </div>

      </div>


      {/* =========================
          RECENT CLIENTS
      ========================= */}

      <div className="panel recent-clients-panel">

        <div className="panel-header">

          <div>
            <h2>
              Recent Clients
            </h2>

            <p>
              Recently added clients
            </p>
          </div>

          <Link
            to="/clients"
            className="view-link"
          >
            View All →
          </Link>

        </div>


        <div className="recent-client-list">

          {clients.length === 0 ? (

            <div className="empty-state">
              No clients found.
            </div>

          ) : (

            clients.slice(0, 5).map((client) => {

              const assignedMember =
                teamMembers.find(
                  (member) =>
                    member.id ===
                    client.assigned_to
                )

              return (
                <Link
                  key={client.id}
                  to={`/client/${client.id}`}
                  className="recent-client"
                >

                  <div className="client-avatar">
                    {client.name
                      ? client.name
                          .charAt(0)
                          .toUpperCase()
                      : "?"}
                  </div>

                  <div className="client-main">

                    <strong>
                      {client.name}
                    </strong>

                    <span>
                      {client.company ||
                        client.email}
                    </span>

                  </div>

                  <div className="client-stage">
                    {getStageLabel(
                      client.stage
                    )}
                  </div>

                  <div className="assigned-member">

                    {assignedMember
                      ? assignedMember.name
                      : "Unassigned"}

                  </div>

                  <span className="client-arrow">
                    →
                  </span>

                </Link>
              )
            })

          )}

        </div>

      </div>


      {/* =========================
          STYLES
      ========================= */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        .dashboard-page {
          min-height: 100vh;
          background: #f6f8fb;
          padding: 34px;
          color: #0f172a;
          font-family: Inter, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .dashboard-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 25px;
          margin-bottom: 30px;
        }

        .eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #64748b;
          margin-bottom: 8px;
        }

        .dashboard-header h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.15;
          letter-spacing: -0.8px;
        }

        .dashboard-header p {
          margin: 9px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .primary-button,
        .secondary-button {
          text-decoration: none;
          padding: 11px 16px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          transition: 0.2s ease;
        }

        .primary-button {
          background: #2563eb;
          color: white;
          box-shadow: 0 5px 15px rgba(37, 99, 235, 0.18);
        }

        .primary-button:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .secondary-button {
          background: white;
          color: #334155;
          border: 1px solid #e2e8f0;
        }

        .secondary-button:hover {
          background: #f8fafc;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e8edf3;
          border-radius: 15px;
          padding: 20px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.035);
        }

        .stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stat-label {
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
        }

        .stat-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-weight: 700;
        }

        .stat-icon.blue,
        .quick-icon.blue {
          background: #eff6ff;
          color: #2563eb;
        }

        .stat-icon.green,
        .quick-icon.green {
          background: #ecfdf5;
          color: #059669;
        }

        .stat-icon.purple,
        .quick-icon.purple {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .stat-icon.orange,
        .quick-icon.orange {
          background: #fff7ed;
          color: #ea580c;
        }

        .stat-value {
          font-size: 30px;
          font-weight: 750;
          letter-spacing: -1px;
          margin-top: 18px;
        }

        .stat-bottom {
          display: flex;
          gap: 5px;
          margin-top: 7px;
          font-size: 12px;
          color: #94a3b8;
        }

        .positive {
          color: #059669;
          font-weight: 600;
        }

        .warning {
          color: #ea580c;
          font-weight: 600;
        }

        .main-grid,
        .lower-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .panel {
          background: white;
          border: 1px solid #e8edf3;
          border-radius: 15px;
          padding: 22px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0.035);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 20px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 16px;
          letter-spacing: -0.2px;
        }

        .panel-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .view-link {
          color: #2563eb;
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .pipeline-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .pipeline-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 13px;
          background: #f8fafc;
          border-radius: 9px;
        }

        .pipeline-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #334155;
          font-weight: 500;
        }

        .pipeline-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }

        .pipeline-dot.discovery {
          background: #64748b;
        }

        .pipeline-dot.signed {
          background: #8b5cf6;
        }

        .pipeline-dot.active {
          background: #10b981;
        }

        .pipeline-dot.delivered {
          background: #2563eb;
        }

        .pipeline-item strong {
          font-size: 14px;
        }

        .team-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .team-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 8px;
          border-radius: 10px;
          text-decoration: none;
          color: inherit;
          transition: 0.2s ease;
        }

        .team-item:hover {
          background: #f8fafc;
        }

        .avatar,
        .client-avatar {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
        }

        .team-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .team-info strong {
          font-size: 13px;
        }

        .team-info span {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .team-stats {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 55px;
        }

        .team-stats strong {
          font-size: 13px;
        }

        .team-stats span {
          color: #94a3b8;
          font-size: 10px;
        }

        .task-count {
          min-width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #fff7ed;
          color: #ea580c;
          font-size: 12px;
          font-weight: 700;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
        }

        .activity-item {
          display: flex;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .activity-item:last-child {
          border-bottom: none;
        }

        .activity-icon {
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
        }

        .activity-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .activity-content strong {
          font-size: 12px;
          font-weight: 600;
          line-height: 1.4;
        }

        .activity-content span {
          color: #94a3b8;
          font-size: 10px;
        }

        .quick-actions {
          display: flex;
          flex-direction: column;
        }

        .quick-action {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          text-decoration: none;
          color: inherit;
          border-bottom: 1px solid #f1f5f9;
        }

        .quick-action:last-child {
          border-bottom: none;
        }

        .quick-icon {
          width: 35px;
          height: 35px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .quick-action > div:nth-child(2) {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .quick-action strong {
          font-size: 12px;
        }

        .quick-action span {
          color: #94a3b8;
          font-size: 10px;
        }

        .quick-action .arrow {
          color: #94a3b8;
          font-size: 16px;
        }

        .recent-clients-panel {
          margin-bottom: 10px;
        }

        .recent-client-list {
          display: flex;
          flex-direction: column;
        }

        .recent-client {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 8px;
          border-top: 1px solid #f1f5f9;
          text-decoration: none;
          color: inherit;
          transition: 0.2s ease;
        }

        .recent-client:hover {
          background: #f8fafc;
        }

        .client-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .client-main strong {
          font-size: 13px;
        }

        .client-main span {
          color: #94a3b8;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .client-stage {
          padding: 5px 9px;
          background: #f1f5f9;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 600;
          color: #475569;
        }

        .assigned-member {
          width: 90px;
          font-size: 11px;
          color: #64748b;
        }

        .client-arrow {
          color: #94a3b8;
          font-size: 15px;
        }

        .empty-state {
          padding: 25px 10px;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
        }

        @media (max-width: 1100px) {

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .main-grid,
          .lower-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 700px) {

          .dashboard-page {
            padding: 20px 14px;
          }

          .dashboard-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .dashboard-header h1 {
            font-size: 26px;
          }

          .header-actions {
            width: 100%;
          }

          .primary-button,
          .secondary-button {
            flex: 1;
            text-align: center;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 17px;
          }

          .assigned-member {
            display: none;
          }

          .client-stage {
            display: none;
          }

          .recent-client {
            gap: 9px;
          }

        }

      `}</style>

    </div>
  )
}