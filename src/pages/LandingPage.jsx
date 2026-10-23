import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { sendLeadWelcomeEmail } from "../lib/email";
import { getAttribution, hasMarketingChoice, hasMarketingConsent, saveMarketingConsent, trackMetaLead, trackMetaPageView } from "../lib/marketing";

const initialForm = { name: "", email: "", phone: "", company: "", service_name: "", message: "", marketing_consent: false, website: "" };

export default function LandingPage() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [consentChoice, setConsentChoice] = useState(() => hasMarketingChoice() ? "saved" : "unset");
  const [submittedAt] = useState(Date.now());

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Creative Crew — Brand, Website & CRM Studio";
    trackMetaPageView();
    return () => { document.title = previousTitle; };
  }, []);

  const setField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  const chooseConsent = (granted) => {
    saveMarketingConsent(granted);
    setConsentChoice("saved");
    if (granted) trackMetaPageView();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setStatus({ type: "error", message: "Name aur email ya phone number zaroor bharein." });
      return;
    }
    setSaving(true);
    setStatus({ type: "", message: "" });
    const attribution = getAttribution();
    if (!form.marketing_consent) {
      attribution.fbclid = "";
      attribution.fbc = "";
      attribution.fbp = "";
    }
    const { data, error } = await supabase.functions.invoke("capture-lead", {
      body: {
        ...form,
        attribution,
        landing_page_url: window.location.href.slice(0, 1000),
        submitted_at: submittedAt,
      },
    });
    if (error || data?.error) {
      setStatus({ type: "error", message: data?.error || "Enquiry save nahi hui. Thodi der baad dobara koshish karein." });
    } else {
      if (form.marketing_consent) {
        saveMarketingConsent(true);
        trackMetaPageView();
        trackMetaLead(data?.event_id);
      }
      let successMessage = "Thank you! Creative Crew team jald hi aapse contact karegi.";
      const emailConfigured = import.meta.env.VITE_EMAILJS_SERVICE_ID && import.meta.env.VITE_EMAILJS_TEMPLATE_ID && import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      if (form.email.trim() && emailConfigured) {
        try {
          await sendLeadWelcomeEmail({ email: form.email.trim(), name: form.name.trim(), company: form.company.trim() });
          successMessage = "Thank you! Aapki enquiry save ho gayi hai aur welcome email bhej diya hai.";
        } catch (emailError) {
          console.warn("Lead saved, but welcome email could not be sent:", emailError);
        }
      }
      setForm(initialForm);
      setStatus({ type: "success", message: successMessage });
    }
    setSaving(false);
  };

  const inputClass = "mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100";

  return (
    <div className="min-h-screen bg-[#fbf9ff] text-slate-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-8">
        <a href="/landing" className="flex items-center gap-3 text-inherit no-underline">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#321073] text-lg font-bold text-white">C.</span>
          <span><strong className="block text-base">Creative Crew</strong><small className="text-xs text-slate-500">Digital experiences that grow</small></span>
        </a>
        <a href="#enquiry" className="rounded-full bg-[#321073] px-5 py-3 text-sm font-semibold text-white no-underline transition hover:bg-[#4b1b87]">Start a project <span aria-hidden="true">↗</span></a>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-28 lg:pt-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-4 py-2 text-xs font-semibold text-violet-800 shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Strategy, design & development</div>
            <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-[-.055em] sm:text-6xl lg:text-7xl">Make your next big idea <span className="text-[#6a32ad]">impossible to ignore.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">We build memorable brands, high-converting websites and custom digital tools that help ambitious teams move forward.</p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600"><span className="rounded-full bg-white px-4 py-2 shadow-sm">Brand & web design</span><span className="rounded-full bg-white px-4 py-2 shadow-sm">Web development</span><span className="rounded-full bg-white px-4 py-2 shadow-sm">Custom CRM</span></div>
            <a href="#enquiry" className="mt-9 inline-flex items-center gap-3 rounded-xl bg-[#321073] px-6 py-4 text-sm font-semibold text-white no-underline shadow-lg shadow-violet-900/15 transition hover:-translate-y-0.5 hover:bg-[#4b1b87]">Tell us about your project <span aria-hidden="true">→</span></a>
            <p className="mt-5 text-xs text-slate-400">Thoughtful work. Clear communication. Built around your goals.</p>
          </div>
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-violet-200/70 via-fuchsia-100 to-amber-100 blur-xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white bg-white p-5 shadow-2xl shadow-violet-950/10 sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-700">Creative Crew / 01</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Ideas into impact.</h2></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-2xl text-violet-700">✳</span></div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-2xl bg-[#321073] p-6 text-white"><span className="text-xs text-violet-200">A smarter first impression</span><div className="mt-8 flex items-end justify-between"><strong className="text-3xl tracking-tight">Stand out.</strong><span className="text-3xl">↗</span></div></div>
                <div className="rounded-2xl bg-[#f4effa] p-5"><span className="text-xs font-medium text-violet-800">01 / Discover</span><p className="mt-8 text-lg font-semibold">Start with a clear goal.</p></div>
                <div className="rounded-2xl bg-[#fff5e9] p-5"><span className="text-xs font-medium text-amber-800">02 / Create</span><p className="mt-8 text-lg font-semibold">Make it feel like you.</p></div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-100 p-4"><div className="flex -space-x-2"><span className="h-8 w-8 rounded-full border-2 border-white bg-violet-200" /><span className="h-8 w-8 rounded-full border-2 border-white bg-amber-200" /><span className="h-8 w-8 rounded-full border-2 border-white bg-emerald-200" /></div><p className="text-xs text-slate-500"><strong className="block text-slate-800">One close-knit crew</strong>Partnering from first sketch to launch.</p></div>
            </div>
          </div>
        </section>

        <section className="border-y border-violet-100 bg-white py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:grid-cols-3 lg:px-8">
            {["A brand people remember", "A website made to convert", "A CRM built for your workflow"].map((item, index) => <article key={item} className="rounded-2xl bg-[#fbf9ff] p-6"><span className="text-sm font-bold text-violet-700">0{index + 1}</span><h2 className="mt-4 text-lg font-bold">{item}</h2><p className="mt-2 text-sm leading-6 text-slate-500">Practical creative work that connects your business with the people you want to reach.</p></article>)}
          </div>
        </section>

        <section id="enquiry" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-28">
          <div className="pt-2"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-700">Let's make something good</p><h2 className="mt-4 text-4xl font-bold leading-tight tracking-[-.04em]">Tell us what you're working on.</h2><p className="mt-5 max-w-md leading-7 text-slate-600">Share a few details and our team will get back to you to talk through the right next step.</p><div className="mt-8 rounded-2xl border border-violet-100 bg-white p-5"><p className="text-sm font-semibold">What happens next?</p><ol className="mt-4 space-y-3 text-sm text-slate-600"><li>01. We review your enquiry.</li><li>02. A team member reaches out.</li><li>03. We shape a plan around your goals.</li></ol></div></div>
          <form onSubmit={submit} className="rounded-[1.75rem] border border-violet-100 bg-white p-5 shadow-xl shadow-violet-950/5 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">Your name *<input className={inputClass} name="name" autoComplete="name" maxLength={120} required value={form.name} onChange={setField} placeholder="Your name" /></label>
              <label className="text-xs font-semibold text-slate-700">Email<input className={inputClass} name="email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={setField} placeholder="you@company.com" /></label>
              <label className="text-xs font-semibold text-slate-700">Phone<input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={setField} placeholder="+91 98765 43210" /></label>
              <label className="text-xs font-semibold text-slate-700">Company<input className={inputClass} name="company" autoComplete="organization" maxLength={160} value={form.company} onChange={setField} placeholder="Company name" /></label>
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">What do you need help with?<select className={inputClass} name="service_name" value={form.service_name} onChange={setField}><option value="">Choose a service</option><option>Branding & design</option><option>Website / landing page</option><option>Custom CRM</option><option>Something else</option></select></label>
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">A little about your project<textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" name="message" maxLength={2000} value={form.message} onChange={setField} placeholder="Goals, timeline, or anything else that would help us understand…" /></label>
            </div>
            <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-slate-500"><input className="mt-1 h-4 w-4 accent-violet-700" type="checkbox" name="marketing_consent" checked={form.marketing_consent} onChange={setField} /><span>I agree that Creative Crew may use my contact details and ad identifiers to measure this enquiry and future project outcomes with Meta. Optional; leaving this unchecked will not affect my enquiry.</span></label>
            <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" name="website" value={form.website} onChange={setField} /></label></div>
            {status.message && <p role={status.type === "error" ? "alert" : "status"} className={`mt-5 rounded-xl px-4 py-3 text-sm ${status.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{status.message}</p>}
            <button disabled={saving} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#321073] px-5 text-sm font-semibold text-white transition hover:bg-[#4b1b87] disabled:cursor-wait disabled:opacity-60">{saving ? "Sending…" : "Send project enquiry"}<span aria-hidden="true">→</span></button>
            <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">Your details are used to respond to your enquiry. Ad measurement only runs when you give optional consent.</p>
          </form>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-violet-100 bg-white px-5 py-7 text-center text-xs text-slate-400">© {new Date().getFullYear()} Creative Crew · Built with care.<span aria-hidden="true">·</span><button type="button" onClick={() => { saveMarketingConsent(false); setConsentChoice("unset"); }} className="underline decoration-slate-300 underline-offset-2">Privacy & tracking choices</button></footer>
      {consentChoice === "unset" && <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-2xl sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-xs leading-5 text-slate-600">With your permission, we use Meta Pixel to measure visits and improve campaign reporting. You can still send an enquiry if you decline.</p><div className="flex shrink-0 gap-2"><button type="button" onClick={() => chooseConsent(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">Decline</button><button type="button" onClick={() => chooseConsent(true)} className="rounded-lg bg-[#321073] px-4 py-2 text-xs font-semibold text-white">Allow measurement</button></div></aside>}
    </div>
  );
}
