import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const normalizePhone = (value: string) => value.replace(/\D/g, "");

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, headers);

  const siteUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!siteUrl || !serviceKey) return jsonResponse({ error: "Event processing is not configured." }, 503, headers);
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const isInternal = Boolean(internalSecret && request.headers.get("x-internal-secret") === internalSecret);
  const db = createClient(siteUrl, serviceKey, { auth: { persistSession: false } });

  if (!isInternal) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "Sign-in required." }, 401, headers);
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse({ error: "Sign-in required." }, 401, headers);
    const { data: profile } = await db.from("profiles").select("role").eq("id", userData.user.id).single();
    if (profile?.role !== "admin") return jsonResponse({ error: "Admin access required." }, 403, headers);
  }

  const pixelId = Deno.env.get("META_PIXEL_ID");
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  const apiVersion = Deno.env.get("META_GRAPH_API_VERSION");
  if (!pixelId || !accessToken || !apiVersion) {
    return jsonResponse({ error: "Meta Conversions API secrets are not configured." }, 503, headers);
  }

  let limit = 20;
  let retryNow = false;
  try {
    const body = await request.json();
    limit = Math.max(1, Math.min(Number(body?.limit) || 20, 100));
    if (body?.retry_now === true) {
      retryNow = true;
      await db.from("meta_event_queue").update({ next_attempt_at: new Date().toISOString() }).eq("status", "failed");
    }
  } catch { /* an empty body uses the default batch */ }

  const staleProcessing = new Date(Date.now() - 15 * 60_000).toISOString();
  await db.from("meta_event_queue").update({ status: "failed", next_attempt_at: new Date().toISOString(), last_error: "A previous processor stopped before completing this event." })
    .eq("status", "processing").lt("created_at", staleProcessing);

  let eventsQuery = db.from("meta_event_queue")
    .select("id, event_id, event_name, client_id, event_time, event_source_url, attempts")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (!retryNow) eventsQuery = eventsQuery.lt("attempts", 8);
  const { data: events, error: queueError } = await eventsQuery;
  if (queueError) return jsonResponse({ error: "Could not load queued events." }, 500, headers);

  let sent = 0;
  let failed = 0;
  for (const event of events || []) {
    const { data: claimed } = await db.from("meta_event_queue")
      .update({ status: "processing", attempts: event.attempts + 1, last_error: null })
      .eq("id", event.id)
      .in("status", ["pending", "failed"])
      .select("id");
    if (!claimed?.length) continue;

    const { data: lead } = await db.from("clients")
      .select("email, phone, fbc, fbp, marketing_consent, revenue_amount, landing_page_url")
      .eq("id", event.client_id)
      .maybeSingle();

    try {
      if (!lead || !lead.marketing_consent) throw new Error("Marketing consent is missing.");
      const userData: Record<string, unknown> = {};
      if (lead.email) userData.em = [await sha256(lead.email.trim().toLowerCase())];
      if (lead.phone) userData.ph = [await sha256(normalizePhone(lead.phone))];
      if (lead.fbc) userData.fbc = lead.fbc;
      if (lead.fbp) userData.fbp = lead.fbp;
      if (!userData.em && !userData.ph) throw new Error("No matchable email or phone is available.");

      const customData: Record<string, unknown> = {};
      if (event.event_name === "Purchase" && lead.revenue_amount !== null) {
        customData.value = Number(lead.revenue_amount);
        customData.currency = "INR";
      }
      const response = await fetch(`https://graph.facebook.com/${apiVersion}/${pixelId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          data: [{
            event_name: event.event_name,
            event_time: Math.floor(new Date(event.event_time).getTime() / 1000),
            event_id: event.event_id,
            action_source: "website",
            event_source_url: event.event_source_url || lead.landing_page_url || Deno.env.get("PUBLIC_SITE_URL"),
            user_data: userData,
            ...(Object.keys(customData).length ? { custom_data: customData } : {}),
          }],
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message || `Meta returned HTTP ${response.status}.`);

      await db.from("meta_event_queue").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", event.id);
      sent += 1;
    } catch (error) {
      const nextAttempt = new Date(Date.now() + Math.min(60, 2 ** (event.attempts + 1)) * 60_000).toISOString();
      await db.from("meta_event_queue").update({
        status: "failed",
        next_attempt_at: nextAttempt,
        last_error: String(error instanceof Error ? error.message : error).slice(0, 500),
      }).eq("id", event.id);
      failed += 1;
    }
  }

  return jsonResponse({ processed: sent + failed, sent, failed }, 200, headers);
});
