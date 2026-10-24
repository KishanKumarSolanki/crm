import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Icon from "../components/Icon";

// =========================
// CONSTANTS
// =========================

const STAGES = {
  discovery: "New Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  meeting_booked: "Meeting Booked",
  follow_up: "Follow-up",
  signed: "Closed & Signed",
  active: "In Progress",
  in_revision: "In Revision",
  delivered: "Delivered",
};

const STAGE_STYLES = {
  discovery: "bg-sky-50 text-sky-700 ring-sky-200",
  contacted: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  qualified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  meeting_booked: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  follow_up: "bg-amber-50 text-amber-700 ring-amber-200",
  signed: "bg-blue-50 text-blue-700 ring-blue-200",
  active: "bg-violet-50 text-violet-700 ring-violet-200",
  in_revision: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  delivered: "bg-teal-50 text-teal-700 ring-teal-200",
};

const PRIORITY_STYLES = {
  high: "bg-rose-50 text-rose-700 ring-rose-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const TASK_TABS = [
  { key: "open", label: "Open" },
  { key: "today", label: "Due today" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Completed" },
  { key: "all", label: "All" },
];

const DAY_MS = 86400000;

// =========================
// HELPERS
// =========================

const stageLabel = (stage) => STAGES[stage] || stage || "Unknown";

const dateLabel = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not scheduled";

const initialOf = (name) => (name?.trim()?.charAt(0) || "C").toUpperCase();

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const isComplete = (task) => task.status?.toLowerCase() === "completed";

const csvCell = (value) => {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

// =========================
// UI PRIMITIVES
// =========================

function ProgressRing({ percent }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className="stroke-violet-200" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-violet-600 transition-all duration-700"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{percent}%</span>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, subtitle, action, children }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-violet-200/80 bg-[#f8f3fe] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(76,29,149,0.25)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-200/70 bg-[#efe6fa] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-800 ring-1 ring-violet-200">
            <Icon name={icon} size={18} />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="px-5 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-500">
        <Icon name={icon} size={22} />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse space-y-6 p-4 sm:p-6">
      <div className="h-48 rounded-3xl bg-violet-200/60" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-violet-200/60" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="h-96 rounded-3xl bg-violet-200/60 xl:col-span-2" />
        <div className="h-96 rounded-3xl bg-violet-200/60" />
      </div>
    </div>
  );
}

// =========================
// PAGE
// =========================

export default function TeamMemberDashboard() {
  const [member, setMember] = useState(null);
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingTask, setUpdatingTask] = useState(null);
  const [taskTab, setTaskTab] = useState("open");
  const [leadSearch, setLeadSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  // =========================
  // FETCH
  // =========================

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(userError?.message || "Sign in to view your dashboard.");
      setLoading(false);
      return;
    }

    const { data: memberRecord, error: memberError } = await supabase
      .from("team_members")
      .select("id, name, email, designation, status")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (memberError || !memberRecord) {
      setError(
        memberError?.message ||
          "Your login is not linked to a team member record. Ask your admin to match your Supabase account email with your team member email."
      );
      setLoading(false);
      return;
    }

    setMember(memberRecord);

    const [leadsResult, tasksResult] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("assigned_to", memberRecord.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", memberRecord.id)
        .order("due_date", { ascending: true }),
    ]);

    const loadErrors = [leadsResult.error, tasksResult.error].filter(Boolean);
    if (loadErrors.length) setError(loadErrors.map((item) => item.message).join(" "));

    setLeads(leadsResult.data || []);
    setTasks(tasksResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // =========================
  // ACTIONS
  // =========================

  const markTaskComplete = async (task) => {
    setUpdatingTask(task.id);
    setError("");

    const nextStatus = isComplete(task) ? "pending" : "completed";

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: nextStatus })
      .eq("id", task.id);

    if (updateError) {
      setError(`Could not update task: ${updateError.message}`);
      setUpdatingTask(null);
      return;
    }

    await supabase.from("activities").insert({
      client_id: task.client_id,
      type: nextStatus === "completed" ? "task_completed" : "task_reopened",
      description: `${nextStatus === "completed" ? "Completed" : "Reopened"} task: ${task.title || "Untitled Task"}`,
    });

    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item))
    );
    setUpdatingTask(null);
  };

  const exportLeads = () => {
    const columns = [
      "Lead Name",
      "Phone",
      "Email",
      "Company",
      "Service",
      "Lead Source",
      "Pipeline Stage",
      "Next Follow-up",
    ];

    const rows = leads.map((lead) => [
      lead.name,
      lead.phone,
      lead.email,
      lead.company,
      lead.service_name,
      lead.lead_source,
      stageLabel(lead.stage),
      lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString() : "",
    ]);

    const csv = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `my-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // =========================
  // DERIVED DATA
  // =========================

  const { startOfToday, endOfToday } = useMemo(() => {
    const now = new Date();
    return {
      startOfToday: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      endOfToday: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    };
  }, [loading]);

  const pendingTasks = useMemo(() => tasks.filter((t) => !isComplete(t)), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(isComplete), [tasks]);

  const dueToday = useMemo(
    () =>
      pendingTasks.filter(
        (t) =>
          t.due_date &&
          new Date(t.due_date) >= startOfToday &&
          new Date(t.due_date) <= endOfToday
      ),
    [pendingTasks, startOfToday, endOfToday]
  );

  const overdueTasks = useMemo(
    () =>
      pendingTasks.filter(
        (t) => t.due_date && new Date(t.due_date) < startOfToday
      ),
    [pendingTasks, startOfToday]
  );

  const completionPercent = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;

  const followUpLeads = useMemo(
    () =>
      leads
        .filter(
          (lead) =>
            lead.stage === "follow_up" ||
            (lead.next_follow_up && new Date(lead.next_follow_up) <= endOfToday)
        )
        .sort(
          (a, b) =>
            new Date(a.next_follow_up || "9999-12-31") - new Date(b.next_follow_up || "9999-12-31")
        ),
    [leads, endOfToday]
  );

  const leadById = useMemo(
    () => new Map(leads.map((lead) => [String(lead.id), lead])),
    [leads]
  );

  const taskCounts = {
    open: pendingTasks.length,
    today: dueToday.length,
    overdue: overdueTasks.length,
    done: completedTasks.length,
    all: tasks.length,
  };

  const visibleTasks = useMemo(() => {
    const lists = {
      open: pendingTasks,
      today: dueToday,
      overdue: overdueTasks,
      done: completedTasks,
      all: tasks,
    };
    return lists[taskTab] || tasks;
  }, [taskTab, tasks, pendingTasks, dueToday, overdueTasks, completedTasks]);

  const visibleLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
      const matchesQuery =
        !query ||
        [lead.name, lead.company, lead.email, lead.phone, lead.service_name]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query));
      return matchesStage && matchesQuery;
    });
  }, [leads, leadSearch, stageFilter]);

  // =========================
  // RENDER
  // =========================

  if (loading) return <DashboardSkeleton />;

  const stats = [
    {
      label: "Assigned leads",
      value: leads.length,
      icon: "leads",
      note: "In your portfolio",
      tone: "from-violet-500 to-indigo-500",
    },
    {
      label: "Open tasks",
      value: pendingTasks.length,
      icon: "tasks",
      note: overdueTasks.length ? `${overdueTasks.length} overdue` : "You're up to date",
      noteAlert: overdueTasks.length > 0,
      tone: "from-sky-500 to-cyan-500",
    },
    {
      label: "Due today",
      value: dueToday.length,
      icon: "pipeline",
      note: "Tasks to finish today",
      tone: "from-amber-500 to-orange-500",
    },
    {
      label: "Follow-ups",
      value: followUpLeads.length,
      icon: "bell",
      note: "Leads needing a touchpoint",
      tone: "from-fuchsia-500 to-rose-500",
    },
  ];

  const heroSubtitle = overdueTasks.length
    ? `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} and ${followUpLeads.length} follow-up${followUpLeads.length === 1 ? "" : "s"} waiting.`
    : dueToday.length
    ? `${dueToday.length} task${dueToday.length > 1 ? "s" : ""} due today. Let's get them done.`
    : "Your lead relationships, follow-ups, and priorities in one focused workspace.";

  return (
    <div className="team-dashboard mx-auto max-w-[1400px] space-y-6 rounded-[32px] bg-[#f1e9fb] p-4 sm:p-6 lg:p-7">
      {/* HERO */}
      <div
        style={{
          backgroundImage: "linear-gradient(125deg, #1e0647 0%, #3b0e82 55%, #6d28d9 100%)",
        }}
        className="relative isolate overflow-hidden rounded-3xl px-7 py-9 text-white shadow-[0_24px_60px_-30px_rgba(54,19,112,0.8)] sm:px-10 sm:py-11"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10 shadow-[0_0_0_26px_rgba(255,255,255,0.03),0_0_0_54px_rgba(255,255,255,0.02)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl"
        />

        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
              Team workspace
            </div>

            <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-[40px]">
              {greeting()}, {member?.name?.split(" ")[0] || "Team Member"} 👋
            </h1>

            <p className="mt-2 max-w-lg text-sm leading-6 text-violet-100/80">{heroSubtitle}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-violet-100/80">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">
                {member?.designation || "Team member"}
              </span>
              {member?.email && (
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">
                  {member.email}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadDashboard}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={exportLeads}
              disabled={leads.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#321073] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="arrow" size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900 shadow-sm"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-100 font-bold">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <article
            key={item.label}
            className="group relative overflow-hidden rounded-2xl border border-violet-200/80 bg-[#f8f3fe] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_18px_36px_-22px_rgba(76,29,149,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-slate-500">{item.label}</p>
                <p className="mt-3 text-[36px] font-bold leading-none tracking-[-0.04em] text-slate-900">
                  {item.value}
                </p>
              </div>
              <span
                className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${item.tone} text-white shadow-md transition group-hover:scale-105`}
              >
                <Icon name={item.icon} size={19} />
              </span>
            </div>
            <p className={`mt-4 text-xs font-medium ${item.noteAlert ? "text-rose-600" : "text-slate-400"}`}>
              {item.note}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* LEFT: TASKS + LEADS */}
        <div className="space-y-6 xl:col-span-2">
          <SectionCard icon="tasks" title="My tasks" subtitle="Priorities assigned to you by your admin">
            <div className="flex gap-1.5 overflow-x-auto border-b border-violet-200/70 bg-[#f3ebfc] px-5 py-3 sm:px-6">
              {TASK_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTaskTab(tab.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    taskTab === tab.key
                      ? "bg-violet-700 text-white shadow-sm"
                      : "bg-violet-100 text-violet-800 hover:bg-violet-200"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                      taskTab === tab.key ? "bg-white/20" : "bg-white/70 text-violet-700"
                    }`}
                  >
                    {taskCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>

            {visibleTasks.length === 0 ? (
              <EmptyState
                icon="tasks"
                title={tasks.length === 0 ? "No tasks assigned yet" : "Nothing here"}
                text={
                  tasks.length === 0
                    ? "New work will appear here when your admin assigns it."
                    : "No tasks match this filter."
                }
              />
            ) : (
              <div className="max-h-[560px] divide-y divide-violet-200/60 overflow-y-auto">
                {visibleTasks.map((task) => {
                  const lead = leadById.get(String(task.client_id));
                  const complete = isComplete(task);
                  const overdue = !complete && task.due_date && new Date(task.due_date) < startOfToday;
                  const priority = (task.priority || "normal").toLowerCase();

                  return (
                    <article
                      key={task.id}
                      className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-violet-100/50 sm:px-6 ${
                        complete ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span
                          className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                            complete
                              ? "bg-emerald-50 text-emerald-700"
                              : overdue
                              ? "bg-rose-50 text-rose-600"
                              : "bg-violet-50 text-violet-700"
                          }`}
                        >
                          <Icon name="tasks" size={16} />
                        </span>

                        <div className="min-w-0">
                          <p
                            className={`text-sm font-semibold ${
                              complete ? "text-slate-500 line-through" : "text-slate-900"
                            }`}
                          >
                            {task.title || "Untitled task"}
                          </p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                            {lead && (
                              <Link
                                to={`/lead/${lead.id}`}
                                className="font-medium text-violet-700 no-underline hover:underline"
                              >
                                {lead.name}
                              </Link>
                            )}
                            <span className={overdue ? "font-semibold text-rose-600" : ""}>
                              {task.due_date ? dateLabel(task.due_date) : "No due date"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 capitalize ring-1 ring-inset ${
                                PRIORITY_STYLES[priority] || "bg-slate-50 text-slate-600 ring-slate-200"
                              }`}
                            >
                              {priority} priority
                            </span>
                            {overdue && <span className="font-semibold text-rose-600">Overdue</span>}
                          </div>

                          {task.instructions && (
                            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
                              {task.instructions}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => markTaskComplete(task)}
                        disabled={updatingTask === task.id}
                        className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-wait disabled:opacity-50 ${
                          complete
                            ? "border border-violet-300 bg-[#f3eafd] text-violet-900 hover:bg-violet-100"
                            : "bg-gradient-to-r from-[#321073] to-[#5b21b6] text-white shadow-sm shadow-violet-900/20 hover:-translate-y-0.5 hover:shadow-md"
                        }`}
                      >
                        {updatingTask === task.id ? "Saving..." : complete ? "Reopen" : "Mark complete"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon="leads"
            title="My assigned leads"
            subtitle={`${visibleLeads.length} of ${leads.length} lead${leads.length === 1 ? "" : "s"}`}
            action={
              <button
                type="button"
                onClick={exportLeads}
                disabled={leads.length === 0}
                className="rounded-lg border border-violet-300 bg-[#f3eafd] px-3 py-2 text-xs font-semibold text-violet-900 transition hover:bg-violet-100 disabled:opacity-50"
              >
                Export CSV
              </button>
            }
          >
            {leads.length > 0 && (
              <div className="flex flex-wrap gap-3 border-b border-violet-200/70 bg-[#f3ebfc] px-5 py-3 sm:px-6">
                <input
                  type="search"
                  aria-label="Search my leads"
                  value={leadSearch}
                  onChange={(event) => setLeadSearch(event.target.value)}
                  placeholder="Search name, company, phone, email..."
                  className="h-10 min-w-[220px] flex-1 rounded-xl border border-violet-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
                <select
                  aria-label="Filter by stage"
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value)}
                  className="h-10 rounded-xl border border-violet-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                >
                  <option value="all">All stages</option>
                  {Object.entries(STAGES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {leads.length === 0 ? (
              <EmptyState
                icon="leads"
                title="No leads assigned yet"
                text="Your admin's lead assignments will show up here."
              />
            ) : visibleLeads.length === 0 ? (
              <EmptyState
                icon="leads"
                title="No matching leads"
                text="Try a different search or stage filter."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-[#e9ddf6] text-[10px] uppercase tracking-[0.12em] text-violet-950/75">
                    <tr>
                      {["Lead", "Contact", "Service", "Stage", "Next follow-up"].map((heading) => (
                        <th key={heading} className="px-5 py-3 font-bold">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-200/60">
                    {visibleLeads.map((lead) => (
                      <tr key={lead.id} className="transition hover:bg-violet-100/50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 text-sm font-bold text-violet-800">
                              {initialOf(lead.name)}
                            </span>
                            <div className="min-w-0">
                              <Link
                                to={`/lead/${lead.id}`}
                                className="block truncate text-sm font-semibold text-slate-900 no-underline hover:text-violet-700"
                              >
                                {lead.name}
                              </Link>
                              <span className="block truncate text-xs text-slate-500">
                                {lead.company || "Individual lead"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-700">{lead.phone || lead.email || "—"}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-700">{lead.service_name || "—"}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                              STAGE_STYLES[lead.stage] || "bg-slate-50 text-slate-600 ring-slate-200"
                            }`}
                          >
                            {stageLabel(lead.stage)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-700">
                          {lead.next_follow_up ? (
                            dateLabel(lead.next_follow_up)
                          ) : (
                            <span className="text-slate-400">Not scheduled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* RIGHT: PROGRESS + FOLLOW-UPS */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-violet-200/80 bg-[#f8f3fe] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(76,29,149,0.25)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Progress</p>
            <h2 className="mt-1 text-base font-bold tracking-tight text-slate-900">Task completion</h2>

            <div className="mt-5 flex items-center gap-5">
              <ProgressRing percent={completionPercent} />
              <dl className="grid flex-1 gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Completed</dt>
                  <dd className="font-bold text-emerald-600 tabular-nums">{completedTasks.length}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Pending</dt>
                  <dd className="font-bold text-slate-900 tabular-nums">{pendingTasks.length}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Overdue</dt>
                  <dd
                    className={`font-bold tabular-nums ${overdueTasks.length ? "text-rose-600" : "text-slate-900"}`}
                  >
                    {overdueTasks.length}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <SectionCard
            icon="bell"
            title="Follow-up queue"
            subtitle="Your next lead touchpoints"
            action={
              <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 ring-1 ring-violet-100">
                {followUpLeads.length} to follow up
              </span>
            }
          >
            {followUpLeads.length === 0 ? (
              <EmptyState
                icon="bell"
                title="You're all caught up"
                text="Scheduled lead follow-ups will appear here."
              />
            ) : (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto p-4">
                {followUpLeads.slice(0, 8).map((lead) => {
                  const date = lead.next_follow_up ? new Date(lead.next_follow_up) : null;
                  const isOverdue = date && date < new Date();

                  return (
                    <Link
                      key={lead.id}
                      to={`/lead/${lead.id}`}
                      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-violet-200/70 bg-[#fbf8ff] p-3.5 no-underline transition hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-sm"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 text-sm font-bold text-violet-800">
                        {initialOf(lead.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-violet-800">
                          {lead.name}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            isOverdue ? "font-semibold text-rose-600" : "text-slate-500"
                          }`}
                        >
                          {date ? `${isOverdue ? "Overdue · " : "Due · "}${dateLabel(date)}` : "Follow-up stage"}
                        </span>
                      </span>
                      <Icon
                        name="arrow"
                        size={15}
                        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600"
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
