import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const dateInputValue = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("normal");
  const [instructions, setInstructions] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");

  const loadTaskRecords = useCallback(() => Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true }),
      supabase
        .from("clients")
        .select("id, name, company")
        .order("name", { ascending: true }),
      supabase
        .from("team_members")
        .select("id, name")
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]), []);

  const applyTaskRecords = useCallback(([tasksResult, clientsResult, membersResult]) => {
    if (tasksResult.error) {
      setError(`Could not load tasks: ${tasksResult.error.message}`);
    } else {
      setTasks(tasksResult.data || []);
    }

    if (clientsResult.error) {
      setError((current) =>
        [current, `Could not load clients: ${clientsResult.error.message}`]
          .filter(Boolean)
          .join(" ")
      );
    } else {
      setClients(clientsResult.data || []);
    }

    if (membersResult.error) {
      setError((current) =>
        [current, `Could not load team members: ${membersResult.error.message}`]
          .filter(Boolean)
          .join(" ")
      );
    } else {
      setTeamMembers(membersResult.data || []);
    }

    setLoading(false);
  }, []);

  const fetchTasks = () =>
    loadTaskRecords()
      .then(applyTaskRecords)
      .catch((loadError) => {
        setError(`Could not load tasks: ${loadError.message}`);
        setLoading(false);
      });

  useEffect(() => {
    let active = true;
    loadTaskRecords()
      .then((records) => {
        if (active) applyTaskRecords(records);
      })
      .catch((loadError) => {
        if (active) {
          setError(`Could not load tasks: ${loadError.message}`);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [applyTaskRecords, loadTaskRecords]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setClientId("");
    setDueDate("");
    setAssignedTo("");
    setPriority("normal");
    setInstructions("");
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (!title.trim() || !clientId) {
      setError("Task title and client are required.");
      return;
    }

    setSaving(true);
    setError("");
    const values = {
      title: title.trim(),
      client_id: clientId,
      due_date: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
      assigned_to: assignedTo || null,
      priority,
      instructions: instructions.trim() || null,
    };

    const result = editingId
      ? await supabase.from("tasks").update(values).eq("id", editingId)
      : await supabase.from("tasks").insert({ ...values, status: "pending" });

    if (result.error) {
      setError(`Could not save task: ${result.error.message}`);
      setSaving(false);
      return;
    }

    const { error: activityError } = await supabase.from("activities").insert({
      client_id: clientId,
      type: editingId ? "task_updated" : "task_assigned",
      description: `${editingId ? "Updated" : "Assigned"} task: ${title.trim()}${assignedTo ? ` (${teamMembers.find((member) => String(member.id) === assignedTo)?.name || "team member"})` : ""}`,
    });
    if (activityError) setError(`Task saved, but its activity could not be recorded: ${activityError.message}`);

    resetForm();
    await fetchTasks();
    setSaving(false);
  };

  const beginEdit = (task) => {
    setEditingId(task.id);
    setTitle(task.title || "");
    setClientId(task.client_id ? String(task.client_id) : "");
    setDueDate(dateInputValue(task.due_date));
    setAssignedTo(task.assigned_to ? String(task.assigned_to) : "");
    setPriority(task.priority || "normal");
    setInstructions(task.instructions || "");
    setError("");
  };

  const toggleComplete = async (task) => {
    setUpdatingId(task.id);
    setError("");
    const status = task.status?.toLowerCase() === "completed" ? "pending" : "completed";
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", task.id);

    if (updateError) {
      setError(`Could not update task: ${updateError.message}`);
    } else {
      setTasks((current) =>
        current.map((item) => item.id === task.id ? { ...item, status } : item)
      );
      if (task.client_id) {
        const { error: activityError } = await supabase.from("activities").insert({
          client_id: task.client_id,
          type: status === "completed" ? "task_completed" : "task_reopened",
          description: `${status === "completed" ? "Completed" : "Reopened"} task: ${task.title || "Untitled Task"}`,
        });
        if (activityError) setError(`Task updated, but the activity could not be recorded: ${activityError.message}`);
      }
    }
    setUpdatingId(null);
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`Delete task "${task.title || "Untitled Task"}"?`)) return;

    setUpdatingId(task.id);
    setError("");
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (deleteError) {
      setError(`Could not delete task: ${deleteError.message}`);
    } else {
      setTasks((current) => current.filter((item) => item.id !== task.id));
      if (editingId === task.id) resetForm();
    }
    setUpdatingId(null);
  };

  const visibleTasks = useMemo(
    () => tasks.filter((task) =>
      statusFilter === "all" ||
      (statusFilter === "pending"
        ? task.status?.toLowerCase() !== "completed"
        : task.status?.toLowerCase() === "completed")
    ),
    [tasks, statusFilter]
  );
  const completedCount = tasks.filter((task) => task.status?.toLowerCase() === "completed").length;
  const pendingCount = tasks.length - completedCount;
  const clientById = new Map(clients.map((client) => [String(client.id), client]));
  const memberById = new Map(teamMembers.map((member) => [String(member.id), member]));

  const formatDate = (value) => {
    if (!value) return "No due date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="w-full text-slate-900">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">CRM Management</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks & Follow-ups</h1>
          <p className="mt-2 text-sm text-slate-500">Assign follow-ups to clients and team members, set priorities, and track completion.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchTasks();
          }}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Total Tasks", tasks.length, "text-slate-900"],
          ["Pending Tasks", pendingCount, "text-amber-600"],
          ["Completed Tasks", completedCount, "text-emerald-600"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className={`mt-3 text-3xl font-bold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={saveTask} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold">{editingId ? "Edit Task" : "Create Task"}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1.5fr_1fr_1fr_0.9fr_auto_auto]">
          <label className="text-xs font-semibold text-slate-600">
            Task title
            <input
              className={`${inputClass} mt-1.5`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              placeholder="e.g. Call client"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Client
            <select className={`${inputClass} mt-1.5`} value={clientId} onChange={(event) => setClientId(event.target.value)} required>
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}{client.company ? ` · ${client.company}` : ""}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Due date
            <input className={`${inputClass} mt-1.5`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Assignee
            <select className={`${inputClass} mt-1.5`} value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Priority
            <select className={`${inputClass} mt-1.5 capitalize`} value={priority} onChange={(event) => setPriority(event.target.value)}>
              {["low", "normal", "high", "urgent"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2 xl:col-span-2">
            Instructions
            <textarea className={`${inputClass} mt-1.5 h-10 min-h-10 py-2`} value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={2000} placeholder="Add context for the assigned team member" />
          </label>
          <button
            type="submit"
            disabled={saving || clients.length === 0}
            className="self-end rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Task"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="self-end rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          )}
        </div>
        {clients.length === 0 && !loading && <p className="mt-3 text-xs text-amber-700">Add a client before creating a task.</p>}
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold">All Tasks</h2>
            <p className="mt-1 text-xs text-slate-500">Tasks are ordered by due date.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Show
            <select className="h-9 rounded-lg border border-slate-200 bg-white px-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>

        {error && <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading tasks...</div>
        ) : visibleTasks.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            {tasks.length === 0 ? "No tasks yet. Create a task above." : "No tasks match this status."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleTasks.map((task) => {
              const linkedClient = clientById.get(String(task.client_id));
              const completed = task.status?.toLowerCase() === "completed";
              const overdue = !completed && task.due_date && new Date(task.due_date) < new Date();
              return (
                <article key={task.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className={`break-words text-sm font-semibold ${completed ? "text-slate-500 line-through" : "text-slate-900"}`}>
                      {task.title || "Untitled Task"}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {linkedClient ? <Link to={`/client/${linkedClient.id}`} className="text-indigo-600 hover:underline">{linkedClient.name}</Link> : <span>Client unavailable</span>}
                      <span>{memberById.get(String(task.assigned_to))?.name || "Unassigned"}</span>
                      <span className={overdue ? "font-semibold text-red-600" : ""}>{overdue ? "Overdue · " : "Due · "}{formatDate(task.due_date)}</span>
                    </div>
                    {task.instructions && <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">{task.instructions}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                      task.priority === "urgent" ? "bg-red-50 text-red-700" :
                      task.priority === "high" ? "bg-orange-50 text-orange-700" :
                      task.priority === "low" ? "bg-slate-100 text-slate-600" :
                      "bg-blue-50 text-blue-700"
                    }`}>
                      {task.priority || "normal"}
                    </span>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${completed ? "bg-emerald-50 text-emerald-700" : overdue ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                      {completed ? "Completed" : overdue ? "Overdue" : task.status || "Pending"}
                    </span>
                    <button type="button" onClick={() => toggleComplete(task)} disabled={updatingId === task.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      {completed ? "Reopen" : "Complete"}
                    </button>
                    <button type="button" onClick={() => beginEdit(task)} disabled={updatingId === task.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteTask(task)} disabled={updatingId === task.id} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
