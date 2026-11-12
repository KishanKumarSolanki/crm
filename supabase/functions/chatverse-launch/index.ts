import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, headers);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return jsonResponse({ error: "ChatVerse launch is not configured." }, 503, headers);

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return jsonResponse({ error: "Sign-in required." }, 401, headers);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await db.auth.getUser(accessToken);
  if (userError || !userData.user) return jsonResponse({ error: "Sign-in required." }, 401, headers);

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) return jsonResponse({ error: "Could not verify account permissions." }, 500, headers);
  if (profile?.role !== "admin") return jsonResponse({ error: "Admin access required." }, 403, headers);

  const apiKey = Deno.env.get("CHATVERSE_KEY");
  if (!apiKey) return jsonResponse({ error: "Set CHATVERSE_KEY in Supabase Edge Function Secrets." }, 503, headers);

  let response: Response;
  try {
    response = await fetch("https://api.chatverse.io/embed/launch", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return jsonResponse({ error: "Could not reach ChatVerse. Please try again." }, 502, headers);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.detail?.message;
    return jsonResponse({ error: typeof detail === "string" ? detail.slice(0, 500) : `ChatVerse returned ${response.status}.` }, 502, headers);
  }

  const launchPath = body?.data?.launch_path;
  if (typeof launchPath !== "string" || !launchPath) {
    return jsonResponse({ error: "ChatVerse returned an invalid launch path." }, 502, headers);
  }

  return jsonResponse({ launchPath }, 200, headers);
});
