import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const dateInput = (date) => date.toISOString().slice(0, 10);
const money = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
const customerStages = new Set(["signed", "active", "in_revision", "delivered"]);
const qualifiedStages = new Set(["qualified", "meeting_booked", ...customerStages]);

export default function MarketingAnalytics() {
  const [leads, setLeads] = useState([]);
  const [spend, setSpend] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState(() => dateInput(new Date(Date.now() - 29 * 86400000)));
  const [endDate, setEndDate] = useState(() => dateInput(new Date()));
  const [campaignName, setCampaignName] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [spendDate, setSpendDate] = useState(() => dateInput(new Date()));
  const [savingSpend, setSavingSpend] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    const [leadResult, spendResult, eventResult] = await Promise.all([
      supabase.from("clients").select("id, name, stage, lead_source, utm_source, utm_medium, utm_campaign, created_at, first_contact_at, revenue_amount, marketing_consent").gte("created_at", `${startDate}T00:00:00`).lte("created_at", `${endDate}T23:59:59`).order("created_at", { ascending: false }),
      supabase.from("campaign_spend").select("*").gte("spend_date", startDate).lte("spend_date", endDate).order("spend_date", { ascending: false }),
      supabase.from("meta_event_queue").select("id, event_name, status, attempts, last_error, created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    const failure = [leadResult.error, spendResult.error, eventResult.error].find(Boolean);
    if (failure) setError(failure.message);
    setLeads(leadResult.data || []);
    setSpend(spendResult.data || []);
    setEvents(eventResult.data || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const metrics = useMemo(() => {
    const leadCount = leads.length;
    const qualifiedCount = leads.filter((lead) => qualifiedStages.has(lead.stage)).length;
    const customerCount = leads.filter((lead) => customerStages.has(lead.stage)).length;
    const totalSpend = spend.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const revenue = leads.filter((lead) => customerStages.has(lead.stage)).reduce((sum, lead) => sum + Number(lead.revenue_amount || 0), 0);
    const responseTimes = leads.filter((lead) => lead.first_contact_at && lead.created_at).map((lead) => Math.max(0, new Date(lead.first_contact_at) - new Date(lead.created_at)) / 3600000);
    return {
      leadCount, qualifiedCount, customerCount, totalSpend, revenue,
      cpl: leadCount ? totalSpend / leadCount : 0,
      qualifiedRate: leadCount ? qualifiedCount / leadCount * 100 : 0,
      costPerQualified: qualifiedCount ? totalSpend / qualifiedCount : 0,
      customerRate: leadCount ? customerCount / leadCount * 100 : 0,
      cac: customerCount ? totalSpend / customerCount : 0,
      roas: totalSpend ? revenue / totalSpend : 0,
      speed: responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null,
    };
  }, [leads, spend]);

  const campaigns = useMemo(() => {
    const groups = new Map();
    leads.forEach((lead) => {
      const key = lead.utm_campaign || "Unattributed";
      const item = groups.get(key) || { name: key, leads: 0, qualified: 0, customers: 0, revenue: 0, sources: new Set() };
      item.leads += 1;
      if (qualifiedStages.has(lead.stage)) item.qualified += 1;
      if (customerStages.has(lead.stage)) { item.customers += 1; item.revenue += Number(lead.revenue_amount || 0); }
      if (lead.utm_source || lead.lead_source) item.sources.add(lead.utm_source || lead.lead_source);
      groups.set(key, item);
    });
    spend.forEach((entry) => {
      const item = groups.get(entry.campaign_name) || { name: entry.campaign_name, leads: 0, qualified: 0, customers: 0, revenue: 0, sources: new Set() };
      item.spend = (item.spend || 0) + Number(entry.amount || 0);
      groups.set(entry.campaign_name, item);
    });
    return [...groups.values()].map((item) => ({ ...item, sources: [...item.sources] })).sort((a, b) => b.leads - a.leads || (b.spend || 0) - (a.spend || 0));
  }, [leads, spend]);

  const addSpend = async (event) => {
    event.preventDefault();
    if (!campaignName.trim() || !Number.isFinite(Number(spendAmount)) || Number(spendAmount) < 0) return;
    setSavingSpend(true);
    const { error: insertError } = await supabase.from("campaign_spend").insert({ campaign_name: campaignName.trim(), amount: Number(spendAmount), spend_date: spendDate, currency: "INR" });
    if (insertError) setError(insertError.message);
    else { setCampaignName(""); setSpendAmount(""); await loadAnalytics(); }
    setSavingSpend(false);
  };

  const retryEvents = async () => {
    setRetrying(true);
    const { data, error: invokeError } = await supabase.functions.invoke("process-meta-events", { body: { limit: 100, retry_now: true } });
    if (invokeError || data?.error) setError(data?.error || invokeError.message);
    await loadAnalytics();
    setRetrying(false);
  };

  const cards = [
    ["Leads", metrics.leadCount, "New enquiries in selected period"],
    ["Cost per lead", money(metrics.cpl), `${money(metrics.totalSpend)} spend ÷ leads`],
    ["Qualified rate", `${metrics.qualifiedRate.toFixed(1)}%`, `${metrics.qualifiedCount} qualified leads`],
    ["Cost per qualified", money(metrics.costPerQualified), "Spend ÷ qualified leads"],
    ["Lead to customer", `${metrics.customerRate.toFixed(1)}%`, `${metrics.customerCount} customers`],
    ["Customer acquisition", money(metrics.cac), "Spend ÷ customers"],
    ["Revenue / ROAS", `${metrics.roas.toFixed(2)}×`, `${money(metrics.revenue)} revenue ÷ spend`],
    ["Speed to lead", metrics.speed === null ? "—" : `${metrics.speed.toFixed(1)} hrs`, "Average to first logged conversation"],
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-700">Attribution & outcomes</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Marketing Analytics</h1><p className="mt-2 text-sm text-slate-500">Campaign data from CRM leads, stage changes and manually entered ad spend.</p></div><div className="flex gap-2"><label className="text-xs font-semibold text-slate-500">From<input className="mt-1 block h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="text-xs font-semibold text-slate-500">To<input className="mt-1 block h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div></div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading marketing data…</div> : <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([title, value, detail]) => <article key={title} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-2 text-xs text-slate-400">{detail}</p></article>)}</section>
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <article className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Campaign performance</h2><p className="mt-1 text-xs text-slate-500">Spend is matched by exact campaign name to <code>utm_campaign</code>.</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">{campaigns.length} campaigns</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{["Campaign", "Leads", "Qualified", "Customers", "Spend", "Revenue"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{campaigns.map((item) => <tr key={item.name} className="border-t border-slate-100"><td className="px-5 py-4"><strong className="block text-slate-800">{item.name}</strong><span className="text-xs text-slate-400">{item.sources.join(", ") || "No source recorded"}</span></td><td className="px-5 py-4">{item.leads}</td><td className="px-5 py-4">{item.qualified}</td><td className="px-5 py-4">{item.customers}</td><td className="px-5 py-4">{money(item.spend || 0)}</td><td className="px-5 py-4">{money(item.revenue)}</td></tr>)}{campaigns.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-400" colSpan="6">No leads or spend in this date range.</td></tr>}</tbody></table></div></article>
          <article className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Record ad spend</h2><p className="mt-1 text-xs leading-5 text-slate-500">Enter the campaign name exactly as it appears in your landing page's <code>utm_campaign</code>.</p><form onSubmit={addSpend} className="mt-5 space-y-4"><label className="block text-xs font-semibold text-slate-600">Campaign name<input className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="e.g. web-design-october" required /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">Amount (INR)<input className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" type="number" min="0" step="0.01" value={spendAmount} onChange={(event) => setSpendAmount(event.target.value)} required /></label><label className="text-xs font-semibold text-slate-600">Spend date<input className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" type="date" value={spendDate} onChange={(event) => setSpendDate(event.target.value)} required /></label></div><button disabled={savingSpend} className="h-10 w-full rounded-lg bg-[#321073] text-sm font-semibold text-white disabled:opacity-60">{savingSpend ? "Saving…" : "Add spend entry"}</button></form><div className="mt-6 border-t border-slate-100 pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How to read the numbers</p><p className="mt-2 text-xs leading-5 text-slate-500">Qualified means the lead is at Qualified, Meeting Booked or a later customer stage. Revenue and ROAS need a value entered on each lead record after a sale.</p></div></article>
        </section>
        <section className="mt-6 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Meta Conversions API queue</h2><p className="mt-1 text-xs text-slate-500">Consent-approved Lead, QualifiedLead, Schedule and Purchase events.</p></div><button onClick={retryEvents} disabled={retrying} className="rounded-lg border border-violet-200 px-4 py-2 text-xs font-semibold text-violet-800 disabled:opacity-50">{retrying ? "Processing…" : "Process / retry events"}</button></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{["Event", "Status", "Attempts", "Last error", "Created"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-slate-100"><td className="px-5 py-3 font-medium text-slate-800">{event.event_name}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.status === "sent" ? "bg-emerald-50 text-emerald-700" : event.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{event.status}</span></td><td className="px-5 py-3">{event.attempts}</td><td className="max-w-xs truncate px-5 py-3 text-xs text-slate-500">{event.last_error || "—"}</td><td className="px-5 py-3 text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</td></tr>)}{events.length === 0 && <tr><td className="px-5 py-8 text-center text-slate-400" colSpan="5">No server events yet. New events appear when a lead with consent is captured or its CRM stage changes.</td></tr>}</tbody></table></div></section>
      </>}
    </div>
  );
}
