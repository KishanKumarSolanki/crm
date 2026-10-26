import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, headers);

  let token = new URL(request.url).searchParams.get("token")?.trim() || "";
  try {
    const body = await request.json();
    if (!token) token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    // Mail clients use an empty or form-encoded POST for one-click unsubscribe;
    // its token is in the URL query string.
    if (!token) return jsonResponse({ error: "Invalid request." }, 400, headers);
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return jsonResponse({ error: "This unsubscribe link is invalid." }, 400, headers);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return jsonResponse({ error: "Unsubscribe is temporarily unavailable." }, 503, headers);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: recipient, error: lookupError } = await db
    .from("broadcast_recipients")
    .select("id, client_id, campaign_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (lookupError) return jsonResponse({ error: "Could not process this request. Please contact the sender." }, 500, headers);
  if (!recipient) return jsonResponse({ error: "This unsubscribe link is invalid." }, 404, headers);

  const { data: campaign } = await db.from("broadcast_campaigns").select("channel").eq("id", recipient.campaign_id).maybeSingle();
  if (campaign?.channel !== "email") return jsonResponse({ error: "This link is not for an email subscription." }, 400, headers);
  const { error: updateError } = await db.from("clients").update({ email_marketing_opt_in: false, email_unsubscribed_at: new Date().toISOString() }).eq("id", recipient.client_id);
  if (updateError) return jsonResponse({ error: "Could not update email preferences. Please contact the sender." }, 500, headers);
  return jsonResponse({ ok: true }, 200, headers);
});
