import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Icon from "../components/Icon";

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const ROLE_LABEL = { manager: "Manager", staff: "Team Member", team_member: "Team Member" };

export default function DailyReports() {
  const [date, setDate] = useState(todayString);
  const [selectedUser, setSelectedUser] = useState("all");
  const [accounts, setAccounts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const [profilesResult, reportsResult] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,role").in("role", ["manager", "staff", "team_member"]).order("full_name", { ascending: true }),
        supabase.from("daily_reports").select("id,user_id,report_date,work_summary,accomplishments,blockers,next_day_plan,created_at,updated_at").eq("report_date", date).order("updated_at", { ascending: false }),
      ]);
      if (!active) return;
      const failures = [profilesResult.error, reportsResult.error].filter(Boolean);
      if (failures.length) setError(failures.map((item) => item.message).join(" "));
      setAccounts(profilesResult.data || []);
      setReports(reportsResult.data || []);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [date]);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const reportByUser = useMemo(() => new Map(reports.map((report) => [report.user_id, report])), [reports]);
  const people = useMemo(() => accounts.filter((account) => selectedUser === "all" || account.id === selectedUser), [accounts, selectedUser]);
  const filteredReports = useMemo(() => reports.filter((report) => selectedUser === "all" || report.user_id === selectedUser), [reports, selectedUser]);
  const missingCount = people.filter((account) => !reportByUser.has(account.id)).length;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-indigo-600">Team activity</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Daily Reports</h1><p className="mt-2 text-sm text-slate-500">Team members aur managers ki submitted daily updates.</p></div>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-semibold text-slate-600">Date<input type="date" value={date} max={todayString()} onChange={(event) => setDate(event.target.value)} className="mt-1 block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" /></label>
        <label className="text-xs font-semibold text-slate-600">Person<select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} className="mt-1 block h-10 min-w-44 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"><option value="all">All team</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.full_name || account.email}</option>)}</select></label>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Could not load daily reports: {error}</div>}
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Submitted</p><p className="mt-2 text-3xl font-bold text-slate-900">{loading ? "—" : filteredReports.length}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Expected reports</p><p className="mt-2 text-3xl font-bold text-slate-900">{loading ? "—" : people.length}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Not submitted</p><p className="mt-2 text-3xl font-bold text-amber-600">{loading ? "—" : missingCount}</p></div>
    </div>

    {loading ? <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">Loading daily reports…</div> : filteredReports.length === 0 ? (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Icon name="tasks" size={22} /></span><p className="mt-3 text-sm font-semibold text-slate-700">No reports submitted for this date</p><p className="mt-1 text-xs text-slate-400">{people.length ? `${missingCount} team account${missingCount === 1 ? " has" : "s have"} not submitted yet.` : "No manager or team-member accounts found."}</p></div>
    ) : <div className="grid gap-4 xl:grid-cols-2">
      {filteredReports.map((report) => {
        const account = accountById.get(report.user_id);
        return <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <header className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0"><h2 className="truncate text-base font-bold text-slate-900">{account?.full_name || account?.email || "CRM user"}</h2><p className="mt-1 truncate text-xs text-slate-500">{account?.email || ""}</p></div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{ROLE_LABEL[account?.role] || account?.role || "Team"}</span>
          </header>
          <div className="space-y-4">
            <section><h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Work summary</h3><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.work_summary}</p></section>
            {report.accomplishments && <section><h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Completed / achievements</h3><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.accomplishments}</p></section>}
            {report.blockers && <section><h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Blockers / support needed</h3><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.blockers}</p></section>}
            {report.next_day_plan && <section><h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Next day plan</h3><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.next_day_plan}</p></section>}
          </div>
          <p className="mt-5 border-t border-slate-100 pt-3 text-right text-[11px] text-slate-400">Updated {new Date(report.updated_at).toLocaleString()}</p>
        </article>;
      })}
    </div>}
  </div>;
}
