import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNewLeadTemplate } from "../_shared/chatverse.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, headers);
  if (headers["Access-Control-Allow-Origin"] === "null") return jsonResponse({ error: "Origin not allowed." }, 403, headers);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return jsonResponse({ error: "Lead messaging is not configured." }, 503, headers);

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return jsonResponse({ error: "Sign-in required." }, 401, headers);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await db.auth.getUser(accessToken);
  if (userError || !userData.user) return jsonResponse({ error: "Sign-in required." }, 401, headers);
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) return jsonResponse({ error: "Could not verify CRM access." }, 500, headers);
  if (!["admin", "manager"].includes(profile?.role || "")) {
    return jsonResponse({ error: "CRM access required." }, 403, headers);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400, headers);
  }
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  if (!phone) return jsonResponse({ error: "A phone number is required." }, 400, headers);

  try {
    await sendNewLeadTemplate(phone);
    return jsonResponse({ ok: true }, 200, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ChatVerse request failed.";
    console.error("ChatVerse lead template failed:", message);
    return jsonResponse({ error: message }, 502, headers);
  }
});
