import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import Icon from "../components/Icon"

const stages = ["discovery", "signed", "active", "delivered"]

export default function ClientDetail() {
  const { id } = useParams()

  const [client, setClient] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [notes, setNotes] = useState([])

  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDue, setTaskDue] = useState("")

  // =========================
  // FETCH ALL DATA
  // =========================

  const fetchAll = async () => {
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single()

    if (clientError) {
      console.error("Client fetch error:", clientError)
      setClient(null)
      setLoading(false)
      return
    }

    setClient(clientData)

    const [membersRes, tasksRes, activitiesRes, notesRes] = await Promise.all([
      supabase
        .from("team_members")
        .select("id, name, designation, status")
        .eq("status", "active")
        .order("name", { ascending: true }),

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

    setTeamMembers(membersRes.data || [])
    setTasks(tasksRes.data || [])
    setActivities(activitiesRes.data || [])
    setNotes(notesRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [id])

  // =========================
  // ACTIONS
  // =========================

  const logActivity = async (type, description) => {
    await supabase
      .from("activities")
      .insert({ client_id: id, type, description })
  }

  const updateStage = async (newStage) => {
    const { error } = await supabase
      .from("clients")
      .update({ stage: newStage })
      .eq("id", id)

    if (error) {
      alert(error.message)
      return
    }

    await logActivity("stage", `Stage changed to ${newStage}`)
    fetchAll()
  }

  const updateAssignee = async (memberId) => {
    const { error } = await supabase
      .from("clients")
      .update({ assigned_to: memberId || null })
      .eq("id", id)

    if (error) {
      alert(error.message)
      return
    }

    const member = teamMembers.find((m) => m.id === memberId)
    await logActivity(
      "assigned",
      member ? `Client assigned to ${member.name}` : "Client unassigned"
    )
    fetchAll()
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
      due_date: taskDue
        ? new Date(taskDue)
        : new Date(Date.now() + 86400000),
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
  // HELPERS
  // =========================

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

  const assignee = teamMembers.find((m) => m.id === client?.assigned_to)

  // =========================
  // STYLES (Tailwind)
  // =========================

  const card = "rounded-xl border border-gray-200 bg-white shadow-sm"
  const input =
    "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-4 focus:ring-gray-900/5"
  const label = "mb-1.5 block text-xs font-semibold text-gray-700"
  const btnDark =
    "inline-flex h-10 items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-gray-800"
  const btnLight =
    "inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"

  const stageStyles = {
    discovery: "bg-orange-50 text-orange-700",
    signed: "bg-blue-50 text-blue-700",
    active: "bg-emerald-50 text-emerald-700",
    delivered: "bg-green-50 text-green-700",
  }

  const stageDots = {
    discovery: "bg-orange-500",
    signed: "bg-blue-500",
    active: "bg-emerald-500",
    delivered: "bg-green-500",
  }

  // =========================
  // STATES
  // =========================

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-gray-400">
        Loading client...
      </div>
    )
  }

  if (!client) {
    return (
      <div className={`${card} px-5 py-14 text-center`}>
        <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-400">
          ◉
        </div>
        <h2 className="text-base font-semibold text-gray-700">Client not found</h2>
        <p className="mb-4 mt-1 text-xs text-gray-400">
          This client may have been deleted.
        </p>
        <Link to="/clients" className={btnDark}>
          ← Back to Clients
        </Link>
      </div>
    )
  }

  const pendingTasks = tasks.filter((t) => t.status !== "completed")

  const statCards = [
    { label: "Pending Tasks", value: pendingTasks.length, icon: "✓", color: "bg-orange-50 text-orange-500" },
    { label: "Notes", value: notes.length, icon: "✎", color: "bg-violet-50 text-violet-600" },
    { label: "Activities", value: activities.length, icon: "↗", color: "bg-emerald-50 text-emerald-600" },
    { label: "Account Manager", value: assignee?.name || "Unassigned", icon: "◉", color: "bg-blue-50 text-blue-600", text: true },
  ]

  return (
    <div className="w-full text-gray-900">

      {/* HEADER */}
      <div className="mb-[22px] flex items-end justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start">
        <div>
          <div className="mb-2 text-xs text-gray-400">
            <Link to="/" className="no-underline hover:text-gray-900">CRM</Link>
            <span className="mx-1.5 text-gray-300">/</span>
            <Link to="/clients" className="no-underline hover:text-gray-900">Clients</Link>
            <span className="mx-1.5 text-gray-300">/</span>
            {client.name}
          </div>

          <h1 className="text-[22px] font-bold tracking-tight min-[481px]:text-[28px]">
            {client.name}
          </h1>

          <p className="mt-1.5 text-sm text-gray-500">
            {client.company || "No company"}
          </p>
        </div>

        <Link to="/clients" className={`${btnLight} h-10 px-4 text-sm`}>
          ← Back to Clients
        </Link>
      </div>

      {/* PROFILE CARD */}
      <div className={`${card} mb-[18px] flex flex-wrap items-center gap-5 p-5`}>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-[28px] font-bold text-indigo-600">
          {(client.name || "?").charAt(0).toUpperCase()}
        </div>

        <div className="min-w-[220px] flex-1">
          <h2 className="text-lg font-bold">{client.name}</h2>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-gray-500">
            <a
              href={`mailto:${client.email}`}
              className="no-underline hover:text-gray-900 hover:underline"
            >
              ✉ {client.email || "No email"}
            </a>

            {client.phone && <span>☎ {client.phone}</span>}

            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
                stageStyles[client.stage] || "bg-gray-100 text-gray-500"
              }`}
            >
              <i className={`h-1.5 w-1.5 rounded-full ${stageDots[client.stage] || "bg-gray-400"}`}></i>
              {client.stage
                ? client.stage.charAt(0).toUpperCase() + client.stage.slice(1)
                : "Unknown"}
            </span>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-3.5 min-[641px]:w-auto min-[641px]:grid-cols-[repeat(2,190px)]">
          <div>
            <label className={label}>Stage</label>
            <select
              className={`${input} cursor-pointer`}
              value={client.stage || ""}
              onChange={(e) => updateStage(e.target.value)}
            >
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Assigned To</label>
            <select
              className={`${input} cursor-pointer`}
              value={client.assigned_to || ""}
              onChange={(e) => updateAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="mb-[18px] grid grid-cols-1 gap-3.5 min-[481px]:grid-cols-2 min-[1101px]:grid-cols-4">
        {statCards.map((item) => (
          <div key={item.label} className={`${card} flex min-h-[88px] items-center gap-3.5 p-4`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-base font-bold ${item.color}`}>
              <Icon name={item.label === "Pending Tasks" ? "tasks" : item.label === "Notes" ? "clients" : item.label === "Activities" ? "pipeline" : "team"} size={18} />
            </div>

            <div className="min-w-0">
              <span className="mb-1 block text-xs text-gray-400">{item.label}</span>
              <strong
                className={`block truncate font-bold text-gray-900 ${
                  item.text ? "text-lg" : "text-[22px]"
                }`}
              >
                {item.value}
              </strong>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-[18px] grid grid-cols-1 items-start gap-[18px] min-[1001px]:grid-cols-2">

        {/* TASKS */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold">Tasks</h2>
              <p className="mt-0.5 text-xs text-gray-400">{tasks.length} total</p>
            </div>
          </div>

          <form
            onSubmit={addTask}
            className="flex flex-wrap gap-2.5 border-b border-gray-100 px-5 py-4"
          >
            <input
              className={`${input} min-w-[160px] flex-1`}
              placeholder="New task title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <input
              className={`${input} w-full shrink-0 min-[481px]:w-[160px]`}
              type="date"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
            />
            <button type="submit" className={btnDark}>
              + Add
            </button>
          </form>

          {tasks.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              No tasks yet.
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 last:border-b-0 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <strong
                    className={`block text-sm font-semibold ${
                      task.status === "completed"
                        ? "text-gray-400 line-through"
                        : "text-gray-900"
                    }`}
                  >
                    {task.title}
                  </strong>
                  <span className="mt-0.5 block text-xs text-gray-400">
                    Due:{" "}
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString()
                      : "No due date"}
                  </span>
                </div>

                {task.status === "completed" ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <i className="h-1.5 w-1.5 rounded-full bg-emerald-500"></i>
                    Completed
                  </span>
                ) : (
                  <button
                    className={`${btnLight} shrink-0`}
                    onClick={() => markTaskDone(task.id)}
                  >
                    Mark Done
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* NOTES */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold">Notes</h2>
              <p className="mt-0.5 text-xs text-gray-400">{notes.length} total</p>
            </div>
          </div>

          <form
            onSubmit={addNote}
            className="flex flex-col items-start gap-2.5 border-b border-gray-100 px-5 py-4"
          >
            <textarea
              className={`${input} h-auto min-h-[90px] resize-y py-2.5`}
              placeholder="Write a note about this client..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button type="submit" className={btnDark}>
              + Add Note
            </button>
          </form>

          {notes.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              No notes yet.
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="border-b border-gray-100 px-5 py-3.5 last:border-b-0 hover:bg-gray-50"
              >
                <p className="whitespace-pre-wrap text-sm text-gray-800">
                  {note.note}
                </p>
                <span className="mt-1 block text-xs text-gray-400">
                  {formatDate(note.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ACTIVITY TIMELINE */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold">Activity Timeline</h2>
            <p className="mt-0.5 text-xs text-gray-400">{activities.length} total</p>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No activity recorded.
          </div>
        ) : (
          <div className="px-5 py-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex gap-3.5 border-b border-gray-100 py-3.5 last:border-b-0"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                  {(activity.type || "•").charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <strong className="block text-sm font-semibold capitalize text-gray-900">
                    {activity.type}
                  </strong>
                  <p className="text-[13px] text-gray-600">
                    {activity.description}
                  </p>
                  <span className="mt-0.5 block text-xs text-gray-400">
                    {formatDate(activity.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
