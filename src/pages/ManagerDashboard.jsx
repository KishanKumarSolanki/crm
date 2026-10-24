import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Icon from "../components/Icon";

const STAGES = [
  ["discovery", "New Lead"], ["contacted", "Contacted"], ["qualified", "Qualified"],
  ["meeting_booked", "Meeting Booked"], ["follow_up", "Follow-up"], ["signed", "Closed & Signed"],
  ["active", "In Progress"], ["in_revision", "In Revision"], ["delivered", "Delivered"],
];

function Stat({ label, value, icon, tone }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between text-sm font-medium text-slate-500"><span>{label}</span><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon name={icon} size={18} /></span></div>
    <div className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
  </div>;
}

export default function ManagerDashboard() {
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [serviceScope, setServiceScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [leadResult, taskResult, profileResult] = await Promise.all([
        supabase.from("clients").select("id,name,company,email,phone,stage,assigned_to,created_at,next_follow_up").order("created_at", { ascending: false }),
        supabase.from("tasks").select("id,title,status,due_date,client_id,assigned_to").neq("status", "completed").order("due_date", { ascending: true }),
        user ? supabase.from("profiles").select("manager_service").eq("id", user.id).single() : Promise.resolve({ data: null, error: null }),
      ]);
      if (!active) return;
      const failures = [leadResult.error, taskResult.error, profileResult.error].filter(Boolean);
      if (failures.length) setError(failures.map((item) => item.message).join(" "));
      setLeads(leadResult.data || []);
      setTasks(taskResult.data || []);
      setServiceScope(profileResult.data?.manager_service || "");
      setLoading(false);
    };
    loadDashboard();
    return () => { active = false; };
  }, []);

  const stages = useMemo(() => Object.fromEntries(STAGES.map(([key]) => [key, leads.filter((lead) => lead.stage === key).length])), [leads]);
  const needsFollowUp = leads.filter((lead) => lead.next_follow_up && new Date(lead.next_follow_up) <= new Date()).length;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-indigo-600">Manager workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Service leads</h1><p className="mt-2 text-sm text-slate-500">Review and manage leads in your assigned service or source scope.</p><span className="mt-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Scope: {serviceScope || "Not configured — contact Admin"}</span></div>
      <Link to="/leads" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-indigo-700"><Icon name="leads" size={16} /> Open leads</Link>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Could not load manager data: {error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Leads in scope" value={loading ? "—" : leads.length} icon="leads" tone="bg-indigo-50 text-indigo-600" />
      <Stat label="Open tasks" value={loading ? "—" : tasks.length} icon="tasks" tone="bg-amber-50 text-amber-600" />
      <Stat label="Follow-ups due" value={loading ? "—" : needsFollowUp} icon="bell" tone="bg-rose-50 text-rose-600" />
      <Stat label="Qualified" value={loading ? "—" : (stages.qualified || 0)} icon="pipeline" tone="bg-emerald-50 text-emerald-600" />
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900">Pipeline status</h2><p className="mt-1 text-xs text-slate-500">Select a stage to review the leads in it.</p></div><Link to="/pipeline" className="text-sm font-semibold text-indigo-600 no-underline">View pipeline →</Link></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{STAGES.map(([key, label]) => <Link key={key} to={`/leads?stage=${key}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm no-underline hover:border-indigo-200 hover:bg-indigo-50"><span className="font-medium text-slate-700">{label}</span><span className="font-bold text-slate-900">{loading ? "—" : stages[key]}</span></Link>)}</div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold text-slate-900">Recent leads</h2><p className="mt-1 text-xs text-slate-500">Open a record to contact the lead or update its stage.</p></div><Link to="/leads" className="text-sm font-semibold text-indigo-600 no-underline">All leads →</Link></div>
      {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading leads…</p> : leads.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No leads yet.</p> : <div className="divide-y divide-slate-100">{leads.slice(0, 8).map((lead) => <Link key={lead.id} to={`/lead/${lead.id}`} className="flex flex-wrap items-center gap-3 py-3 text-inherit no-underline hover:bg-slate-50"><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{lead.name || "Unnamed lead"}</strong><span className="mt-0.5 block truncate text-xs text-slate-400">{lead.company || lead.email || lead.phone || "No contact details"}</span></span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{STAGES.find(([key]) => key === lead.stage)?.[1] || lead.stage || "Unassigned"}</span><span className="text-xs text-indigo-600">Open →</span></Link>)}</div>}
    </section>
  </div>;
}
