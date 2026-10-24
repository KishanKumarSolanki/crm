import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Icon from "../components/Icon";

// =========================
// CONSTANTS
// =========================

const AVATAR_TONES = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-600",
  "from-slate-600 to-slate-800",
];

const STAGE_LABELS = {
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
  discovery: "bg-orange-50 text-orange-700 ring-orange-100",
  contacted: "bg-violet-50 text-violet-700 ring-violet-100",
  qualified: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  meeting_booked: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  follow_up: "bg-purple-50 text-purple-700 ring-purple-100",
  signed: "bg-blue-50 text-blue-700 ring-blue-100",
  active: "bg-amber-50 text-amber-700 ring-amber-100",
  in_revision: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100",
  delivered: "bg-green-50 text-green-700 ring-green-100",
};

// =========================
// HELPERS
// =========================

const toneFor = (seed = "") => {
  const sum = [...String(seed)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
};

const initialOf = (name, fallback = "T") =>
  (name?.trim()?.charAt(0) || fallback).toUpperCase();

const formatDate = (date) => {
  if (!date) return "No due date";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatStage = (stage) => {
  if (!stage) return "Unknown";
  return STAGE_LABELS[stage] || stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const taskStatusStyle = (status) => {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "pending") return "bg-amber-50 text-amber-700 ring-amber-100";
  return "bg-slate-100 text-slate-600 ring-slate-200";
};

// =========================
// UI PRIMITIVES
// =========================

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

const Avatar = ({ name, seed, size = "md" }) => {
  const sizes = {
    sm: "h-8 w-8 rounded-lg text-[11px]",
    md: "h-10 w-10 rounded-xl text-sm",
    lg: "h-20 w-20 rounded-2xl text-3xl",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${toneFor(seed)} ${sizes[size]} font-bold text-white shadow-md shadow-slate-900/10`}
    >
      {initialOf(name)}
    </div>
  );
};

const SectionCard = ({ title, subtitle, action, children, className = "" }) => (
  <section className={`${cardClass} overflow-hidden ${className}`}>
    <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>
);

const CountBadge = ({ children }) => (
  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
    {children}
  </span>
);

const EmptyState = ({ icon = "dashboard", children, hint }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <Icon name={icon} size={20} />
    </div>
    <p className="text-sm font-medium text-slate-600">{children}</p>
    {hint && <p className="text-xs text-slate-400">{hint}</p>}
  </div>
);

const StatCard = ({ label, value, icon, chip, valueClass = "text-slate-900", helper }) => (
  <div className={`${cardClass} group p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5`}>
    <div className="flex items-center justify-between">
      <p className="text-[13px] font-semibold text-slate-500">{label}</p>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${chip}`}>
        <Icon name={icon} size={18} />
      </div>
    </div>
    <p className={`mt-4 text-3xl font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</p>
    <p className="mt-1 text-xs text-slate-400">{helper}</p>
  </div>
);

const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />
);

const LoadingSkeleton = () => (
  <div className="w-full space-y-6">
    <SkeletonBlock className="h-44" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-36" />)}
    </div>
    <SkeletonBlock className="h-72" />
    <SkeletonBlock className="h-72" />
  </div>
);

// =========================
// PAGE
// =========================

export default function TeamMemberDetail() {
  const { id } = useParams();

  const [member, setMember] = useState(null);
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMemberData = async () => {
    setLoading(true);

    try {
      const { data: memberData, error: memberError } = await supabase
        .from("team_members")
        .select("*")
        .eq("id", id)
        .single();

      if (memberError) {
        console.error("Member error:", memberError);
        alert(memberError.message);
        setMember(null);
        return;
      }

      setMember(memberData);

      const { data: leadData, error: leadError } = await supabase
        .from("clients")
        .select("*")
        .eq("assigned_to", id)
        .order("created_at", { ascending: false });

      if (leadError) console.error("Leads error:", leadError);

      const leadList = leadData || [];
      setLeads(leadList);

      const leadIds = leadList.map((lead) => lead.id);

      if (leadIds.length === 0) {
        setTasks([]);
        setActivities([]);
        return;
      }

      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .in("client_id", leadIds)
        .order("due_date", { ascending: true });

      if (taskError) console.error("Tasks error:", taskError);
      setTasks(taskData || []);

      const { data: activityData, error: activityError } = await supabase
        .from("activities")
        .select("*")
        .in("client_id", leadIds)
        .order("created_at", { ascending: false });

      if (activityError) console.error("Activities error:", activityError);
      setActivities(activityData || []);
    } catch (error) {
      console.error("Unable to fetch member data:", error);
      alert("Unable to load team member details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberData();
  }, [id]);

  // =========================
  // DERIVED DATA
  // =========================

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== "completed"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "completed"), [tasks]);

  const leadById = useMemo(
    () => new Map(leads.map((lead) => [String(lead.id), lead])),
    [leads]
  );

  // =========================
  // STATES
  // =========================

  if (loading) {
    return (
      <div className="w-full text-slate-900">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!member) {
    return (
      <div className={`${cardClass} flex flex-col items-center px-5 py-16 text-center`}>
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon name="team" size={22} />
        </div>
        <h2 className="text-base font-semibold text-slate-800">Team member not found</h2>
        <p className="mb-5 mt-1 text-sm text-slate-400">
          This team member may have been deleted or is unavailable.
        </p>
        <Link
          to="/team-members"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 no-underline transition hover:-translate-y-px hover:shadow-lg"
        >
          ← Back to team members
        </Link>
      </div>
    );
  }

  const isActive = member.status === "active";

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* BREADCRUMB */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
          <Link to="/" className="no-underline transition hover:text-slate-700">CRM</Link>
          <span className="text-slate-300">/</span>
          <Link to="/team-members" className="no-underline transition hover:text-slate-700">Team</Link>
          <span className="text-slate-300">/</span>
          <span className="truncate font-medium text-slate-600">{member.name}</span>
        </nav>

        <Link
          to="/team-members"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 no-underline shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      {/* HERO */}
      <section className={`${cardClass} relative overflow-hidden p-6 sm:p-7`}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/15 to-violet-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-52 w-52 rounded-full bg-gradient-to-tr from-sky-300/10 to-emerald-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <Avatar name={member.name} seed={member.id} size="lg" />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                  {member.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {member.status || "Unknown"}
                </span>
              </div>

              <p className="mt-1.5 text-sm font-medium text-indigo-600">
                {member.designation || "Team Member"}
              </p>

              <div className="mt-3 flex flex-col gap-1.5 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1.5">
                <span className="flex min-w-0 items-center gap-2 break-all">
                  <Icon name="leads" size={14} className="shrink-0 text-slate-400" />
                  {member.email || "No email"}
                </span>
                <span className="flex items-center gap-2">
                  <Icon name="team" size={14} className="shrink-0 text-slate-400" />
                  {member.phone || "No phone"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Assigned leads"
          value={leads.length}
          icon="leads"
          chip="bg-indigo-50 text-indigo-600 ring-indigo-100"
          helper="Leads assigned to this member"
        />
        <StatCard
          label="Pending tasks"
          value={pendingTasks.length}
          icon="tasks"
          chip="bg-amber-50 text-amber-600 ring-amber-100"
          valueClass="text-amber-600"
          helper="Tasks waiting to be completed"
        />
        <StatCard
          label="Completed tasks"
          value={completedTasks.length}
          icon="check"
          chip="bg-emerald-50 text-emerald-600 ring-emerald-100"
          valueClass="text-emerald-600"
          helper="Successfully completed tasks"
        />
      </div>

      {/* ASSIGNED LEADS */}
      <SectionCard
        title="Assigned leads"
        subtitle="Leads managed by this team member"
        action={<CountBadge>{leads.length}</CountBadge>}
      >
        {leads.length === 0 ? (
          <EmptyState icon="leads" hint="Assigned leads will appear here.">
            No leads assigned.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/70">
                  {["Name", "Email", "Company", "Stage"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:px-6"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="group transition hover:bg-slate-50/70">
                    <td className="border-b border-slate-100 px-5 py-3.5 sm:px-6">
                      <Link
                        to={`/lead/${lead.id}`}
                        className="flex items-center gap-3 text-inherit no-underline"
                      >
                        <Avatar name={lead.name} seed={lead.id} size="sm" />
                        <span className="text-sm font-semibold text-slate-900 transition group-hover:text-indigo-700">
                          {lead.name || "Unnamed lead"}
                        </span>
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-500 sm:px-6">
                      {lead.email || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-500 sm:px-6">
                      {lead.company || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="border-b border-slate-100 px-5 py-3.5 sm:px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                          STAGE_STYLES[lead.stage] || "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {formatStage(lead.stage)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* TASKS + ACTIVITIES */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard
          title="Tasks & follow-ups"
          subtitle="Tasks associated with assigned leads"
          action={<CountBadge>{tasks.length}</CountBadge>}
        >
          {tasks.length === 0 ? (
            <EmptyState icon="tasks">No tasks found.</EmptyState>
          ) : (
            <div className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const taskLead = leadById.get(String(task.client_id));
                const done = task.status === "completed";
                return (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:px-6"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${done ? "bg-emerald-500" : "bg-amber-400"}`}
                      />
                      <div className="min-w-0">
                        <p
                          className={`break-words text-sm font-semibold ${
                            done ? "text-slate-400 line-through" : "text-slate-900"
                          }`}
                        >
                          {task.title || "Untitled task"}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {taskLead?.name ? (
                            <>Lead: <span className="font-medium text-slate-700">{taskLead.name}</span></>
                          ) : (
                            "Lead: Unknown"
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">Due {formatDate(task.due_date)}</p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ${taskStatusStyle(task.status)}`}
                    >
                      {task.status || "Unknown"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent activities"
          subtitle="Activity history for assigned leads"
          action={<CountBadge>{activities.length}</CountBadge>}
        >
          {activities.length === 0 ? (
            <EmptyState icon="dashboard">No activities found.</EmptyState>
          ) : (
            <ol className="relative px-5 py-4 sm:px-6">
              <span className="absolute bottom-6 left-[37px] top-6 w-px bg-slate-200 sm:left-[41px]" aria-hidden="true" />
              {activities.map((activity) => {
                const activityLead = leadById.get(String(activity.client_id));
                return (
                  <li key={activity.id} className="relative flex gap-4 py-3">
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                      <Icon name="pipeline" size={15} />
                    </div>

                    <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold capitalize text-slate-900">
                          {(activity.type || "Activity").replace(/_/g, " ")}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          {activityLead?.name || "Unknown lead"}
                        </span>
                      </div>
                      <p className="mt-1.5 break-words text-[13px] leading-relaxed text-slate-600">
                        {activity.description || "No description available."}
                      </p>
                      {activity.created_at && (
                        <p className="mt-2 text-[11px] text-slate-400">{formatDate(activity.created_at)}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}