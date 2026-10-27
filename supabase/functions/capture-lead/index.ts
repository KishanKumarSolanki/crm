import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const boundedText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
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
      console.error("Lead capture rate limiter failed", rateLimitError.message);
      return jsonResponse({ error: "Lead capture is temporarily unavailable." }, 503, headers);
    }
    if (!allowed) return jsonResponse({ error: "Too many enquiries from this connection. Please try again in a few minutes." }, 429, { ...headers, "Retry-After": "600" });
  }
  if (externalLeadId) {
    const { data: existingLead, error: existingLeadError } = await db.from("clients")
      .select("id")
      .eq("external_lead_id", externalLeadId)
      .maybeSingle();
    if (existingLeadError) return jsonResponse({ error: "Could not verify this enquiry." }, 500, headers);
    if (existingLead) return jsonResponse({ ok: true, duplicate: true }, 200, headers);
  }
  const attribution = (body.attribution && typeof body.attribution === "object")
    ? body.attribution as Record<string, unknown>
    : {};
  const consent = body.marketing_consent === true;
  const submittedAt = Number(body.submitted_at || 0);
  if (submittedAt && Date.now() - submittedAt < 1800) return jsonResponse({ error: "Please try submitting the form again." }, 400, headers);

  const { data: lead, error: leadError } = await db.from("clients").insert({
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
    stage: "discovery",
  }).select("id").single();

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
    db.from("tasks").insert({ client_id: lead.id, title: "Follow up with new lead", due_date: dueDate, status: "pending" }),
    boundedText(body.message, 2000)
      ? db.from("notes").insert({ client_id: lead.id, note: boundedText(body.message, 2000) })
      : Promise.resolve({ error: null }),
    db.from("activities").insert({ client_id: lead.id, type: "created", description: "Lead captured from the Creative Crew landing page" }),
  ]);
  if (taskResult.error) console.error("Lead follow-up task insert failed", taskResult.error.message);
  if (noteResult.error) console.error("Lead message insert failed", noteResult.error.message);
  if (activityResult.error) console.error("Lead activity insert failed", activityResult.error.message);

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

  return jsonResponse({ ok: true, event_id: eventId }, 201, headers);
});