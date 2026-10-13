import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../lib/supabase"

const PanelHeader = ({ title, text, to, linkText }) => (
  <div className="mb-5 flex items-start justify-between gap-4">
    <div>
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>

    {to && (
      <Link
        to={to}
        className="whitespace-nowrap text-xs font-semibold text-blue-600 no-underline hover:text-blue-700"
      >
        {linkText}
      </Link>
    )}
  </div>
)

const Empty = ({ children }) => (
  <div className="px-2.5 py-6 text-center text-[13px] text-slate-400">
    {children}
  </div>
)

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
  // STYLES (Tailwind)
  // =========================

  const panel = "rounded-2xl border border-slate-200 bg-white p-[22px] shadow-sm max-[700px]:p-[17px]"

  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-violet-50 text-violet-600",
    orange: "bg-orange-50 text-orange-600",
  }

  const statCards = [
    { label: "Total Clients", value: totalClients, icon: "◉", tone: "blue", note: "All clients", rest: "in CRM", noteClass: "text-emerald-600" },
    { label: "Active Clients", value: activeClients, icon: "↗", tone: "green", note: "Active", rest: "projects", noteClass: "text-emerald-600" },
    { label: "Delivered", value: deliveredClients, icon: "✓", tone: "purple", note: "Completed", rest: "projects", noteClass: "text-emerald-600" },
    { label: "Pending Tasks", value: pendingTasks, icon: "!", tone: "orange", note: "Needs attention", rest: "", noteClass: "text-orange-600" },
  ]

  const pipelineRows = [
    { label: "Discovery", value: discoveryClients, dot: "bg-slate-500" },
    { label: "Signed", value: signedClients, dot: "bg-violet-500" },
    { label: "Active", value: activeClients, dot: "bg-emerald-500" },
    { label: "Delivered", value: deliveredClients, dot: "bg-blue-600" },
  ]

  const quickActions = [
    { to: "/clients", tone: "blue", icon: "+", title: "Add Client", text: "Create a new client" },
    { to: "/team-members", tone: "green", icon: "+", title: "Add Team Member", text: "Add someone to your team" },
    { to: "/pipeline", tone: "purple", icon: "↗", title: "Open Pipeline", text: "Manage client stages" },
    { to: "/tasks", tone: "orange", icon: "✓", title: "View Tasks", text: "Check pending work" },
  ]

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-slate-500">
        <div className="mb-3.5 h-[38px] w-[38px] animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600"></div>
        <p className="text-sm">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="w-full text-slate-900">

      {/* HEADER */}
      <div className="mb-[30px] flex items-end justify-between gap-6 max-[700px]:flex-col max-[700px]:items-start">
        <div>
          <div className="mb-2 text-xs font-bold tracking-[0.12em] text-slate-500">
            CRM OVERVIEW
          </div>

          <h1 className="text-[26px] font-bold leading-tight tracking-tight min-[701px]:text-[28px]">
            Dashboard
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Keep track of your clients, tasks and team activity.
          </p>
        </div>

        <div className="flex gap-2.5 max-[700px]:w-full">
          <Link
            to="/clients"
            className="rounded-[9px] border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 no-underline transition hover:bg-slate-50 max-[700px]:flex-1"
          >
            View Clients
          </Link>

          <Link
            to="/clients"
            className="rounded-[9px] bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white no-underline shadow-[0_5px_15px_rgba(37,99,235,0.18)] transition hover:-translate-y-px hover:bg-blue-700 max-[700px]:flex-1"
          >
            + Add Client
          </Link>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="mb-5 grid grid-cols-1 gap-4 min-[701px]:grid-cols-2 min-[1101px]:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">{card.label}</span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-[9px] font-bold ${tones[card.tone]}`}>
                {card.icon}
              </div>
            </div>

            <div className="mt-[18px] text-[28px] font-bold tracking-tight">{card.value}</div>

            <div className="mt-1.5 flex gap-1.5 text-xs text-slate-400">
              <span className={`font-semibold ${card.noteClass}`}>{card.note}</span>
              {card.rest && <span>{card.rest}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div className="mb-5 grid grid-cols-1 gap-5 min-[1101px]:grid-cols-2">

        {/* PIPELINE */}
        <div className={panel}>
          <PanelHeader
            title="Client Pipeline"
            text="Current distribution of your clients"
            to="/pipeline"
            linkText="View Pipeline →"
          />

          <div className="flex flex-col gap-3.5">
            {pipelineRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-[9px] bg-slate-50 px-3.5 py-3">
                <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                  <span className={`h-2.5 w-2.5 rounded-full ${row.dot}`}></span>
                  <span>{row.label}</span>
                </div>
                <strong className="text-sm">{row.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* TEAM WORKLOAD */}
        <div className={panel}>
          <PanelHeader
            title="Team Workload"
            text="Assigned clients and pending tasks"
            to="/team-members"
            linkText="View Team →"
          />

          <div className="flex flex-col gap-1">
            {teamMembers.length === 0 ? (
              <Empty>No active team members.</Empty>
            ) : (
              teamMembers.slice(0, 5).map((member) => {
                const memberClients = getMemberClients(member.id)
                const memberTasks = getMemberTasks(member.id)

                return (
                  <Link
                    key={member.id}
                    to={`/team-member/${member.id}`}
                    className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 text-inherit no-underline transition hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-sm font-bold text-blue-600">
                      {member.name ? member.name.charAt(0).toUpperCase() : "?"}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <strong className="truncate text-sm">{member.name}</strong>
                      <span className="mt-0.5 text-xs text-slate-400">
                        {member.designation || "Team Member"}
                      </span>
                    </div>

                    <div className="flex min-w-[55px] flex-col items-end">
                      <strong className="text-sm">{memberClients}</strong>
                      <span className="text-xs text-slate-400">clients</span>
                    </div>

                    <div className="flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-orange-600">
                      {memberTasks}
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* LOWER GRID */}
      <div className="mb-5 grid grid-cols-1 gap-5 min-[1101px]:grid-cols-2">

        {/* RECENT ACTIVITY */}
        <div className={panel}>
          <PanelHeader title="Recent Activity" text="Latest CRM activity" />

          <div className="flex flex-col">
            {activities.length === 0 ? (
              <Empty>No recent activity.</Empty>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-3 border-b border-slate-100 py-3.5 last:border-b-0"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-600">
                    {getActivityIcon(activity.type)}
                  </div>

                  <div className="flex flex-col gap-1">
                    <strong className="text-[13px] font-semibold leading-snug">
                      {activity.description}
                    </strong>
                    <span className="text-xs text-slate-400">
                      {getActivityTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className={panel}>
          <PanelHeader title="Quick Actions" text="Common CRM actions" />

          <div className="flex flex-col">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.to}
                className="flex items-center gap-3 border-b border-slate-100 py-3.5 text-inherit no-underline transition last:border-b-0 hover:bg-slate-50"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-[9px] font-bold ${tones[action.tone]}`}>
                  {action.icon}
                </div>

                <div className="flex flex-1 flex-col gap-0.5">
                  <strong className="text-[13px]">{action.title}</strong>
                  <span className="text-xs text-slate-400">{action.text}</span>
                </div>

                <span className="text-base text-slate-400">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* RECENT CLIENTS */}
      <div className={`${panel} mb-2.5`}>
        <PanelHeader
          title="Recent Clients"
          text="Recently added clients"
          to="/clients"
          linkText="View All →"
        />

        <div className="flex flex-col">
          {clients.length === 0 ? (
            <Empty>No clients found.</Empty>
          ) : (
            clients.slice(0, 5).map((client) => {
              const assignedMember = teamMembers.find(
                (member) => member.id === client.assigned_to
              )

              return (
                <Link
                  key={client.id}
                  to={`/client/${client.id}`}
                  className="flex items-center gap-3.5 border-t border-slate-100 px-2 py-3.5 text-inherit no-underline transition hover:bg-slate-50 max-[700px]:gap-2.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-sm font-bold text-blue-600">
                    {client.name ? client.name.charAt(0).toUpperCase() : "?"}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="truncate text-sm">{client.name}</strong>
                    <span className="truncate text-xs text-slate-400">
                      {client.company || client.email}
                    </span>
                  </div>

                  <div className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 max-[700px]:hidden">
                    {getStageLabel(client.stage)}
                  </div>

                  <div className="w-[100px] truncate text-xs text-slate-500 max-[700px]:hidden">
                    {assignedMember ? assignedMember.name : "Unassigned"}
                  </div>

                  <span className="text-[15px] text-slate-400">→</span>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}