import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Icon from "../components/Icon";

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const EMPTY_REPORT = { work_summary: "", accomplishments: "", blockers: "", next_day_plan: "" };

const fields = [
  { key: "work_summary", label: "Aaj ka work summary", hint: "Aaj aapne kis kaam par focus kiya?", required: true },
  { key: "accomplishments", label: "Completed work / achievements", hint: "Kaun se tasks ya milestones complete hue?" },
  { key: "blockers", label: "Blockers / support needed", hint: "Koi issue ya help chahiye? Nahi hai to 'None' likhein." },
  { key: "next_day_plan", label: "Kal ka plan", hint: "Kal ke liye aapke main priorities kya hain?" },
];

export default function DailyReport() {
  const [reportDate, setReportDate] = useState(todayString);
  const [form, setForm] = useState(EMPTY_REPORT);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(userError?.message || "Sign in to submit your daily report.");
      setLoading(false);
      return;
    }
    setUserId(user.id);
    const { data, error: reportError } = await supabase
      .from("daily_reports")
      .select("work_summary, accomplishments, blockers, next_day_plan, updated_at")
      .eq("user_id", user.id)
      .eq("report_date", reportDate)
      .maybeSingle();
    if (reportError) {
      setError(`Could not load report: ${reportError.message}`);
    } else {
      setForm(data ? {
        work_summary: data.work_summary || "",
        accomplishments: data.accomplishments || "",
        blockers: data.blockers || "",
        next_day_plan: data.next_day_plan || "",
      } : EMPTY_REPORT);
      setSavedAt(data?.updated_at || "");
    }
    setLoading(false);
  }, [reportDate]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const submitReport = async (event) => {
    event.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    const now = new Date().toISOString();
    const { data, error: saveError } = await supabase
      .from("daily_reports")
      .upsert({ user_id: userId, report_date: reportDate, ...form, updated_at: now }, { onConflict: "user_id,report_date" })
      .select("updated_at")
      .single();
    if (saveError) {
      setError(`Could not submit report: ${saveError.message}`);
    } else {
      setSavedAt(data?.updated_at || now);
      setSuccess("Daily report submitted. You can update it again today if needed.");
    }
    setSaving(false);
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <header>
      <p className="text-sm font-semibold text-indigo-600">Daily update</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Daily Report</h1>
      <p className="mt-2 text-sm text-slate-500">Apna aaj ka kaam, progress aur kal ka plan admin ke saath share karein.</p>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div><h2 className="text-base font-bold text-slate-900">Report details</h2><p className="mt-1 text-xs text-slate-500">Har din ki ek report save hoti hai. Aap submit ke baad edit kar sakte hain.</p></div>
        <label className="text-xs font-semibold text-slate-600">Report date<input type="date" value={reportDate} max={todayString()} onChange={(event) => { setReportDate(event.target.value); setSuccess(""); }} className="mt-1 block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" /></label>
      </div>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
      {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading report…</div> : <form onSubmit={submitReport} className="space-y-5">
        {fields.map((field) => <label key={field.key} className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">{field.label}{field.required && <span className="ml-1 text-rose-500">*</span>}</span>
          <span className="mb-2 block text-xs text-slate-400">{field.hint}</span>
          <textarea required={field.required} rows={field.key === "work_summary" ? 4 : 3} maxLength={5000} value={form[field.key]} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} placeholder="Yahan apna update likhein..." className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
        </label>)}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-400">{savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}` : "Not submitted yet"}</p>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"><Icon name="tasks" size={17} />{saving ? "Submitting…" : savedAt ? "Update report" : "Submit report"}</button>
        </div>
      </form>}
    </section>
  </div>;
}
