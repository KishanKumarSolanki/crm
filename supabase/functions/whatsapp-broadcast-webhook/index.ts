import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const toHex = (bytes: Uint8Array) => [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
};

Deno.serve(async (request) => {
  const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  if (request.method === "GET") {
    const url = new URL(request.url);
    if (!verifyToken || url.searchParams.get("hub.mode") !== "subscribe" || url.searchParams.get("hub.verify_token") !== verifyToken) return new Response("Verification failed", { status: 403 });
    return new Response(url.searchParams.get("hub.challenge") || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!appSecret || !signature.startsWith("sha256=")) return new Response("Webhook is not configured", { status: 401 });
  const rawBody = await request.text();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = `sha256=${toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))))}`;
  if (!constantTimeEqual(signature, expected)) return new Response("Invalid signature", { status: 401 });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Webhook storage is not configured", { status: 503 });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); }
  catch { return new Response("Invalid payload", { status: 400 }); }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const entries = Array.isArray(payload.entry) ? payload.entry as Array<Record<string, unknown>> : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : [];
    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      const inboundMessages = Array.isArray(value?.messages) ? value.messages as Array<Record<string, unknown>> : [];
      for (const message of inboundMessages) {
        const textContent = message.text as Record<string, unknown> | undefined;
        const interactive = message.interactive as Record<string, unknown> | undefined;
        const buttonReply = interactive?.button_reply as Record<string, unknown> | undefined;
        const listReply = interactive?.list_reply as Record<string, unknown> | undefined;
        const optOutText = String(textContent?.body || buttonReply?.title || listReply?.title || "").trim().toLowerCase();
        const optOutKeywords = new Set(["stop", "unsubscribe", "end", "quit", "cancel", "remove"]);
        if (!optOutKeywords.has(optOutText)) continue;
        const phone = typeof message.from === "string" ? message.from : "";
        if (!phone) continue;
        const { error } = await db.rpc("revoke_whatsapp_opt_in", { p_phone: phone });
        if (error) return new Response("Could not update WhatsApp consent", { status: 500 });
      }
      const statuses = Array.isArray(value?.statuses) ? value.statuses as Array<Record<string, unknown>> : [];
      for (const statusEvent of statuses) {
        const providerId = typeof statusEvent.id === "string" ? statusEvent.id : "";
        const providerStatus = typeof statusEvent.status === "string" ? statusEvent.status : "";
        const status = ["sent", "delivered", "read", "failed"].includes(providerStatus) ? providerStatus : "";
        if (!providerId || !status) continue;
        const { data: recipient, error: lookupError } = await db.from("broadcast_recipients")
          .select("id, status")
          .eq("provider_message_id", providerId)
          .maybeSingle();
        if (lookupError) return new Response("Could not find delivery record", { status: 500 });
        if (!recipient) return new Response("Delivery record not ready", { status: 503 });
        const rank = { sent: 1, delivered: 2, read: 3 } as Record<string, number>;
        if (status !== "failed" && (recipient.status === "failed" || (rank[recipient.status] || 0) > (rank[status] || 0))) continue;
        const errors = Array.isArray(statusEvent.errors) ? statusEvent.errors as Array<Record<string, unknown>> : [];
        const firstError = errors[0];
        const details = String(firstError?.error_data && (firstError.error_data as Record<string, unknown>).details || firstError?.title || firstError?.message || "WhatsApp delivery failed.").slice(0, 1000);
        const { error } = await db.from("broadcast_recipients").update({
          status,
          status_updated_at: new Date().toISOString(),
          ...(status === "failed" ? { error_message: details } : { error_message: null }),
        }).eq("provider_message_id", providerId);
        if (error) return new Response("Could not record delivery status", { status: 500 });
      }
    }
  }
  return new Response("ok", { status: 200 });
});
