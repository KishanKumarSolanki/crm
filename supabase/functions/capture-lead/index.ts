import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const boundedText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const parseAppointmentTime = (message: string) => {
  const match = message.match(/Appointment Requested:\s*(?:[A-Za-z]+,\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*\(([^)]*)\)/i);
  if (!match) return null;

  const [, dayText, monthText, yearText, hourText, minuteText, meridiem, zoneText] = match;
  const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
    .indexOf(monthText.toLowerCase());
  if (month < 0) return null;

  const day = Number(dayText);
  const year = Number(yearText);
  const hour12 = Number(hourText);
  const minute = Number(minuteText);
  if (day < 1 || day > 31 || hour12 < 1 || hour12 > 12 || minute > 59) return null;

  const zone = zoneText.trim();
  let offsetMinutes: number;
  if (/\bIST\b|India Standard Time/i.test(zone)) {
    offsetMinutes = 330;
  } else {
    const offsetMatch = zone.match(/(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!offsetMatch) return null;
    offsetMinutes = (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] || 0)) * (offsetMatch[1] === "+" ? 1 : -1);
  }

  const hour = hour12 % 12 + (meridiem.toUpperCase() === "PM" ? 12 : 0);
  const localDate = new Date(Date.UTC(year, month, day, hour, minute));
  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== month || localDate.getUTCDate() !== day) return null;
  return new Date(localDate.getTime() - offsetMinutes * 60_000).toISOString();
};
const formatAppointmentForWhatsApp = (appointmentAt: string) => {
  const appointment = new Date(appointmentAt);
  return {
    date: new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(appointment),
    time: `${new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(appointment)} IST`,
  };
};
const sendAppointmentConfirmation = async (args: {
  name: string;
  phone: string;
  appointmentAt: string;
}) => {
  const apiKey = Deno.env.get("CHATVERSE_API_KEY");
  const templateName = Deno.env.get("CHATVERSE_TEMPLATE_NAME");
  if (!apiKey || !templateName) {
    console.warn("WhatsApp appointment message skipped: ChatVerse API secrets are not configured.");
    return false;
  }

  let recipient = args.phone.replace(/\D/g, "");
  if (recipient.length === 10) {
    const countryCode = (Deno.env.get("CHATVERSE_DEFAULT_COUNTRY_CODE") || "91").replace(/\D/g, "");
    recipient = `${countryCode}${recipient}`;
  }
  if (recipient.length < 10 || recipient.length > 15) {
    console.warn("WhatsApp appointment message skipped: lead phone number is not a valid international number.");
    return false;
  }

  const { date, time } = formatAppointmentForWhatsApp(args.appointmentAt);
  try {
    const response = await fetch(
      `https://api.chatverse.io/v1/whatsapp/templates/${encodeURIComponent(templateName)}/send`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipient,
          body: [args.name, date, time],
        }),
      },
    );
    const responseText = await response.text();
    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      // Preserve the HTTP status as the useful signal for non-JSON responses.
    }
    if (!response.ok || result.success === false) {
      console.error("WhatsApp appointment message was rejected by ChatVerse.", {
        status: response.status,
        error: typeof result.error === "string" ? result.error : undefined,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("WhatsApp appointment message request failed.", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
};
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, headers);
  if (headers["Access-Control-Allow-Origin"] === "null") return jsonResponse({ error: "Origin not allowed" }, 403, headers);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400, headers);
  }

  if (boundedText(body.website, 200)) return jsonResponse({ ok: true }, 200, headers);
  const name = boundedText(body.name, 120);
  const email = boundedText(body.email, 254).toLowerCase();
  const phone = boundedText(body.phone, 40);
  const externalLeadId = boundedText(body.external_lead_id, 120) || null;
  const formStage = boundedText(body.form_stage, 20) === "step1" ? "step1" : "complete";
  if (!name || (!email && !phone)) return jsonResponse({ error: "Name and either email or phone are required." }, 400, headers);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: "Enter a valid email address." }, 400, headers);

  const siteUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!siteUrl || !serviceKey) return jsonResponse({ error: "Lead capture is not configured." }, 503, headers);
  const db = createClient(siteUrl, serviceKey, { auth: { persistSession: false } });
  const forwardedIp = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedIp) {
    const ipHash = await sha256(`creative-crew-lead-capture:${forwardedIp}`);
    const { data: allowed, error: rateLimitError } = await db.rpc("consume_public_lead_capture", {
      p_ip_hash: ipHash,
      p_max_requests: 8,
      p_window_seconds: 600,
    });
    if (rateLimitError) {
      console.error("Lead capture rate limiter failed", JSON.stringify({
        message: rateLimitError.message,
        code: rateLimitError.code,
        details: rateLimitError.details,
        hint: rateLimitError.hint,
      }));
      return jsonResponse({ error: "Lead capture is temporarily unavailable." }, 503, headers);
    }
    if (!allowed) return jsonResponse({ error: "Too many enquiries from this connection. Please try again in a few minutes." }, 429, { ...headers, "Retry-After": "600" });
  }
  if (externalLeadId) {
    const { data: existingLead, error: existingLeadError } = await db.from("clients")
      .select("id, form_completed_at, whatsapp_opt_in")
      .eq("external_lead_id", externalLeadId)
      .maybeSingle();
    if (existingLeadError) return jsonResponse({ error: "Could not verify this enquiry." }, 500, headers);
    // Stage 1 creates the CRM record. On final submission, update that same row
    // rather than creating a duplicate lead. Repeated completed submissions are idempotent.
    if (existingLead && formStage === "complete" && existingLead.form_completed_at) {
      return jsonResponse({ ok: true, duplicate: true }, 200, headers);
    }
  }
  const attribution = (body.attribution && typeof body.attribution === "object")
    ? body.attribution as Record<string, unknown>
    : {};
  const appointmentAt = parseAppointmentTime(boundedText(body.message, 2000));
  const consent = body.marketing_consent === true;
  const whatsappOptIn = typeof body.whatsapp_opt_in === "boolean" ? body.whatsapp_opt_in : null;
  const submittedAt = Number(body.submitted_at || 0);
  if (submittedAt && Date.now() - submittedAt < 1800) return jsonResponse({ error: "Please try submitting the form again." }, 400, headers);

  const leadFields = {
    external_lead_id: externalLeadId,
    name,
    email: email || null,
    phone: phone || null,
    company: boundedText(body.company, 160) || null,
    service_name: boundedText(body.service_name, 160) || null,
    lead_source: boundedText(body.lead_source, 120) || boundedText(attribution.utm_source, 120) || "Landing Page",
    utm_source: boundedText(attribution.utm_source, 120) || null,
    utm_medium: boundedText(attribution.utm_medium, 120) || null,
    utm_campaign: boundedText(attribution.utm_campaign, 160) || null,
    utm_content: boundedText(attribution.utm_content, 160) || null,
    fbclid: consent ? boundedText(attribution.fbclid, 500) || null : null,
    fbc: consent ? boundedText(attribution.fbc, 500) || null : null,
    fbp: consent ? boundedText(attribution.fbp, 500) || null : null,
    landing_page_url: boundedText(body.landing_page_url, 1000) || null,
    marketing_consent: consent,
    ...(whatsappOptIn !== null ? { whatsapp_opt_in: whatsappOptIn } : {}),
    ...(appointmentAt ? { next_follow_up: appointmentAt } : {}),
  };

  let lead: { id: string; whatsapp_opt_in?: boolean; next_follow_up?: string | null } | null = null;
  let leadError: { code?: string; message: string } | null = null;
  let isNewLead = true;
  if (externalLeadId) {
    const { data: existingLead, error: existingLeadError } = await db.from("clients")
      .select("id, form_completed_at, whatsapp_opt_in")
      .eq("external_lead_id", externalLeadId)
      .maybeSingle();
    if (existingLeadError) return jsonResponse({ error: "Could not verify this enquiry." }, 500, headers);
    if (existingLead && formStage === "complete" && existingLead.form_completed_at) {
      return jsonResponse({ ok: true, duplicate: true }, 200, headers);
    }
    if (existingLead) {
      isNewLead = false;
      const updateFields = Object.fromEntries(
        Object.entries(leadFields).filter(([key, value]) => value !== null || key === "marketing_consent"),
      );
      let updateQuery = db.from("clients").update(updateFields).eq("id", existingLead.id);
      if (formStage === "complete") updateQuery = updateQuery.is("form_completed_at", null);
      const { data, error } = await updateQuery.select("id, whatsapp_opt_in, next_follow_up").maybeSingle();
      if (!error && !data && formStage === "complete") {
        return jsonResponse({ ok: true, duplicate: true }, 200, headers);
      }
      lead = data;
      leadError = error;
    } else {
      const { data, error } = await db.from("clients").insert({ ...leadFields, stage: "discovery" }).select("id, whatsapp_opt_in, next_follow_up").single();
      lead = data;
      leadError = error;
    }
  } else {
    const { data, error } = await db.from("clients").insert({ ...leadFields, stage: "discovery" }).select("id, whatsapp_opt_in, next_follow_up").single();
    lead = data;
    leadError = error;
  }

  if (leadError || !lead) {
    if (externalLeadId && leadError?.code === "23505") {
      const { data: existingLead } = await db.from("clients")
        .select("id")
        .eq("external_lead_id", externalLeadId)
        .maybeSingle();
      if (existingLead) return jsonResponse({ ok: true, duplicate: true }, 200, headers);
    }
    console.error("Lead insert failed", leadError?.message);
    return jsonResponse({ error: "We could not save your enquiry. Please try again." }, 500, headers);
  }

  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const [taskResult, noteResult, activityResult] = await Promise.all([
    isNewLead
      ? db.from("tasks").insert({ client_id: lead.id, title: "Follow up with new lead", due_date: dueDate, status: "pending" })
      : Promise.resolve({ error: null }),
    boundedText(body.message, 2000)
      ? db.from("notes").insert({ client_id: lead.id, note: boundedText(body.message, 2000) })
      : Promise.resolve({ error: null }),
    db.from("activities").insert({
      client_id: lead.id,
      type: isNewLead ? "created" : "updated",
      description: isNewLead
        ? "Lead captured from the Creative Crew landing page"
        : formStage === "complete"
          ? "Lead completed the admission goals form"
          : "Lead updated their institute details",
    }),
  ]);
  if (taskResult.error) console.error("Lead follow-up task insert failed", taskResult.error.message);
  if (noteResult.error) {
    console.error("Lead message insert failed", noteResult.error.message);
    if (formStage === "complete") return jsonResponse({ error: "Your enquiry was saved, but the completed form details could not be saved. Please submit again." }, 500, headers);
  }
  if (activityResult.error) console.error("Lead activity insert failed", activityResult.error.message);

  let completedFormNow = false;
  if (formStage === "complete") {
    const { data: completedLead, error: completionError } = await db.from("clients")
      .update({ form_completed_at: new Date().toISOString() })
      .eq("id", lead.id)
      .is("form_completed_at", null)
      .select("id")
      .maybeSingle();
    if (completionError) {
      console.error("Completed form marker failed", completionError.message);
      return jsonResponse({ error: "Your form details were saved, but completion could not be confirmed. Please try again." }, 500, headers);
    }
    if (!completedLead) return jsonResponse({ ok: true, duplicate: true }, 200, headers);
    completedFormNow = true;
  }

  let whatsappMessageSent = false;
  const appointmentForLead = appointmentAt || lead.next_follow_up || null;
  if (completedFormNow && appointmentForLead && lead.whatsapp_opt_in === true && phone) {
    whatsappMessageSent = await sendAppointmentConfirmation({
      name,
      phone,
      appointmentAt: appointmentForLead,
    });
  }

  let eventId: string | null = null;
  if (consent) {
    const { data: event } = await db.from("meta_event_queue")
      .select("event_id")
      .eq("client_id", String(lead.id))
      .eq("event_name", "Lead")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    eventId = event?.event_id || null;

    const functionUrl = `${siteUrl}/functions/v1/process-meta-events`;
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    if (eventId && internalSecret) {
      await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret, "apikey": serviceKey },
        body: JSON.stringify({ limit: 10 }),
      }).catch((error) => console.error("Meta event dispatch failed", error.message));
    }
  }

  return jsonResponse({ ok: true, event_id: eventId, whatsapp_message_sent: whatsappMessageSent }, 201, headers);
});
