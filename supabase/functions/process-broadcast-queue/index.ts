import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Attachment = { path: string; name: string; type: string; size: number };
type Job = {
  id: string;
  campaign_id: string;
  client_id: string;
  channel: "email" | "whatsapp";
  client_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  unsubscribe_token: string;
  attempts: number;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  message_kind: "text" | "template" | "media";
  template_name: string | null;
  template_language: string | null;
  template_parameters: string[];
  attachment_paths: Attachment[];
};

class ProviderError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.retryable = retryable;
  }
}

const bounded = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const interpolate = (value: string, job: Job) => value
  .replace(/\{\{\s*name\s*\}\}/gi, job.client_name || "there")
  .replace(/\{\{\s*company\s*\}\}/gi, job.company || "your team");
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
const interpolateHtml = (value: string, job: Job) => value
  .replace(/\{\{\s*name\s*\}\}/gi, escapeHtml(job.client_name || "there"))
  .replace(/\{\{\s*company\s*\}\}/gi, escapeHtml(job.company || "your team"));
const sanitizeHtml = (value: string) => value
  .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1\s*>/gi, "")
  .replace(/<(script|style|iframe|object|embed|form)\b[^>]*\/?>/gi, "")
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "$1=\"#\"");
const normalizePhone = (value: string) => value.replace(/\D/g, "");

async function readAttachment(db: ReturnType<typeof createClient>, attachment: Attachment) {
  const { data, error } = await db.storage.from("broadcast-attachments").download(attachment.path);
  if (error || !data) throw new ProviderError(`Could not read attachment ${attachment.name}.`);
  return new Uint8Array(await data.arrayBuffer());
}

async function sendEmailJsRequest(db: ReturnType<typeof createClient>, form: FormData) {
  const { data: sendAt, error: slotError } = await db.rpc("claim_emailjs_send_slot");
  if (slotError || !sendAt) throw new ProviderError("Could not reserve an EmailJS queue slot. Check the EmailJS rate-limit migration.");
  const waitMs = new Date(sendAt).getTime() - Date.now();
  if (waitMs > 0) await delay(waitMs);
  try {
    return await fetch("https://api.emailjs.com/api/v1.0/email/send-form", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ProviderError("EmailJS did not return a response. Check EmailJS history before retrying to avoid a duplicate send.", false);
  }
}

async function sendEmail(db: ReturnType<typeof createClient>, job: Job) {
  const serviceId = Deno.env.get("EMAILJS_SERVICE_ID");
  const templateId = Deno.env.get("EMAILJS_TEMPLATE_ID");
  const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
  const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");
  const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") || "").replace(/\/$/, "");
  if (!serviceId || !templateId || !publicKey || !siteUrl) {
    throw new ProviderError("EmailJS is not configured. Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, and PUBLIC_SITE_URL as Edge Function secrets.", false);
  }
  if (!job.email) throw new ProviderError("The client has no email address.", false);
  const token = encodeURIComponent(job.unsubscribe_token);
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${token}`;
  const rawHtml = interpolateHtml(job.body_html || `<p>${escapeHtml(job.body_text || "")}</p>`, job);
  const html = `${sanitizeHtml(rawHtml)}<hr style="border:0;border-top:1px solid #e2e8f0;margin:28px 0 14px"><p style="font:12px/1.5 Arial,sans-serif;color:#64748b">You received this email because you opted in to updates. <a href="${unsubscribeUrl}">Unsubscribe</a></p>`;
  const text = `${interpolate(job.body_text || "", job)}\n\nYou received this email because you opted in to updates. Unsubscribe: ${unsubscribeUrl}`;
  if (new TextEncoder().encode(html).byteLength + new TextEncoder().encode(text).byteLength > 45_000) {
    throw new ProviderError("Email content exceeds EmailJS's 50 KB template-variable limit.", false);
  }

  const form = new FormData();
  form.set("service_id", serviceId);
  form.set("template_id", templateId);
  form.set("user_id", publicKey);
  if (privateKey) form.set("accessToken", privateKey);
  form.set("to_email", job.email);
  form.set("email", job.email);
  form.set("lead_name", job.client_name || "there");
  form.set("company_name", job.company || "your team");
  form.set("subject", interpolate(job.subject || "", job));
  form.set("message_html", html);
  form.set("message_text", text);
  form.set("unsubscribe_url", unsubscribeUrl);

  for (const [index, attachment] of (job.attachment_paths || []).entries()) {
    const bytes = await readAttachment(db, attachment);
    const fieldName = `broadcast_attachment_${index + 1}`;
    form.append(fieldName, new File([bytes], attachment.name, { type: attachment.type || "application/octet-stream" }));
  }
  const response = await sendEmailJsRequest(db, form);
  const result = await response.text().catch(() => "");
  if (!response.ok) {
    const message = bounded(result || `EmailJS returned ${response.status}.`);
    const uncertainOutcome = response.status >= 500;
    throw new ProviderError(
      uncertainOutcome ? `${message} Check EmailJS history before retrying to avoid a duplicate send.` : message,
      response.status === 429,
    );
  }
  return null;
}

async function uploadWhatsAppMedia(db: ReturnType<typeof createClient>, attachment: Attachment, phoneId: string, version: string, accessToken: string) {
  const bytes = await readAttachment(db, attachment);
  const mediaType = attachment.type.startsWith("image/") ? "image" : attachment.type.startsWith("video/") ? "video" : "document";
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", attachment.type || "application/octet-stream");
  form.set("file", new File([bytes], attachment.name, { type: attachment.type || "application/octet-stream" }));
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.id) {
    const message = bounded(result?.error?.message || `WhatsApp media upload failed (${response.status}).`);
    throw new ProviderError(message, response.status === 429 || response.status >= 500);
  }
  return { id: String(result.id), type: mediaType };
}

async function sendWhatsApp(db: ReturnType<typeof createClient>, job: Job, mediaCache: Map<string, { id: string; type: string }>) {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const version = Deno.env.get("WHATSAPP_GRAPH_API_VERSION");
  if (!accessToken || !phoneId || !version) throw new ProviderError("WhatsApp Cloud API is not configured on the server.", false);
  const to = normalizePhone(job.phone || "");
  if (to.length < 8 || to.length > 15) throw new ProviderError("Use an international phone number with country code.", false);

  let content: Record<string, unknown>;
  if (job.message_kind === "template") {
    if (!job.template_name || !job.template_language) throw new ProviderError("The approved WhatsApp template is incomplete.", false);
    const parameters = (job.template_parameters || []).map((value) => ({ type: "text", text: interpolate(String(value), job) }));
    content = {
      type: "template",
      template: {
        name: job.template_name,
        language: { code: job.template_language },
        ...(parameters.length ? { components: [{ type: "body", parameters }] } : {}),
      },
    };
  } else if (job.message_kind === "media") {
    const attachment = (job.attachment_paths || [])[0];
    if (!attachment) throw new ProviderError("A WhatsApp media attachment is missing.", false);
    let media = mediaCache.get(attachment.path);
    if (!media) {
      media = await uploadWhatsAppMedia(db, attachment, phoneId, version, accessToken);
      mediaCache.set(attachment.path, media);
    }
    const objectName = media.type;
    content = {
      type: objectName,
      [objectName]: {
        id: media.id,
        ...(job.body_text ? { caption: interpolate(job.body_text, job) } : {}),
        ...(objectName === "document" ? { filename: attachment.name } : {}),
      },
    };
  } else {
    if (!job.body_text?.trim()) throw new ProviderError("The WhatsApp message is empty.", false);
    content = { type: "text", text: { body: interpolate(job.body_text, job), preview_url: true } };
  }

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...content }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = bounded(result?.error?.message || `WhatsApp API returned ${response.status}.`);
    throw new ProviderError(message, response.status === 429 || response.status >= 500);
  }
  return bounded(result?.messages?.[0]?.id, 200);
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, headers);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return jsonResponse({ error: "Broadcast processing is not configured." }, 503, headers);
  const secret = Deno.env.get("BROADCAST_CRON_SECRET");
  const isInternal = Boolean(secret && request.headers.get("x-internal-secret") === secret);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (!isInternal) {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!accessToken) return jsonResponse({ error: "Sign-in required." }, 401, headers);
    const { data: userData, error: userError } = await db.auth.getUser(accessToken);
    if (userError || !userData.user) return jsonResponse({ error: "Sign-in required." }, 401, headers);
    const { data: profile } = await db.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin") return jsonResponse({ error: "Admin access required." }, 403, headers);
  }

  let limit = 25;
  try {
    const body = await request.json();
    limit = Math.max(1, Math.min(Number(body?.limit) || 25, 100));
  } catch { /* use the default batch */ }

  const staleAt = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: staleRows } = await db.from("broadcast_recipients")
    .select("campaign_id")
    .eq("status", "processing")
    .lt("last_attempt_at", staleAt);
  const campaignIds = new Set<string>((staleRows || []).map((row) => row.campaign_id));
  await db.from("broadcast_recipients")
    .update({ status: "pending", next_attempt_at: new Date().toISOString(), error_message: "Recovered an interrupted send attempt." })
    .eq("status", "processing").lt("last_attempt_at", staleAt).lt("attempts", 3);
  await db.from("broadcast_recipients")
    .update({ status: "failed", error_message: "The send worker stopped after the final retry." })
    .eq("status", "processing").lt("last_attempt_at", staleAt).gte("attempts", 3);

  const { data: jobs, error: claimError } = await db.rpc("claim_broadcast_recipients", { p_limit: limit });
  if (claimError) return jsonResponse({ error: "Could not claim the broadcast queue. Apply the broadcasting migration first." }, 500, headers);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const mediaCache = new Map<string, { id: string; type: string }>();
  for (const job of (jobs || []) as Job[]) {
    campaignIds.add(job.campaign_id);
    const { data: client } = await db.from("clients")
      .select("name, company, email, phone, email_marketing_opt_in, email_unsubscribed_at, whatsapp_opt_in")
      .eq("id", job.client_id).maybeSingle();
    if (!client) {
      await db.from("broadcast_recipients").update({ status: "skipped", error_message: "Client record no longer exists.", status_updated_at: new Date().toISOString() }).eq("id", job.id);
      skipped += 1;
      continue;
    }
    if (job.channel === "email" && (!client.email_marketing_opt_in || client.email_unsubscribed_at || !client.email)) {
      await db.from("broadcast_recipients").update({ status: "skipped", error_message: "Email consent was withdrawn or the address is missing.", status_updated_at: new Date().toISOString() }).eq("id", job.id);
      skipped += 1;
      continue;
    }
    if (job.channel === "whatsapp" && (!client.whatsapp_opt_in || !client.phone)) {
      await db.from("broadcast_recipients").update({ status: "skipped", error_message: "WhatsApp opt-in was withdrawn or the phone number is missing.", status_updated_at: new Date().toISOString() }).eq("id", job.id);
      skipped += 1;
      continue;
    }
    const currentJob: Job = {
      ...job,
      client_name: bounded(client.name, 120) || job.client_name,
      company: bounded(client.company, 160) || job.company,
      email: bounded(client.email, 254) || job.email,
      phone: bounded(client.phone, 40) || job.phone,
    };
    await db.from("broadcast_recipients").update({
      client_name: currentJob.client_name,
      company: currentJob.company,
      email: currentJob.email,
      phone: currentJob.phone,
    }).eq("id", job.id).eq("status", "processing");

    try {
      const providerId = job.channel === "email"
        ? await sendEmail(db, currentJob)
        : await sendWhatsApp(db, currentJob, mediaCache);
      const { error: updateError } = await db.from("broadcast_recipients").update({
        status: "sent",
        provider_message_id: providerId || null,
        sent_at: new Date().toISOString(),
        status_updated_at: new Date().toISOString(),
        error_message: null,
      }).eq("id", job.id).eq("status", "processing");
      if (updateError && job.channel === "whatsapp") {
        await db.from("broadcast_recipients").update({
          status: "failed",
          error_message: "WhatsApp accepted the send, but the delivery ID could not be saved. Check WhatsApp delivery before resending.",
          status_updated_at: new Date().toISOString(),
        }).eq("id", job.id).eq("status", "processing");
        failed += 1;
        continue;
      }
      if (updateError) {
        await db.from("broadcast_recipients").update({
          status: "failed",
          error_message: "EmailJS accepted the request, but its status could not be saved. Check EmailJS history before retrying to avoid a duplicate.",
          status_updated_at: new Date().toISOString(),
        }).eq("id", job.id).eq("status", "processing");
        failed += 1;
        continue;
      }
      sent += 1;
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : new ProviderError(error instanceof Error ? error.message : "Provider request failed.");
      const retry = providerError.retryable && job.attempts < 3;
      const nextAttempt = new Date(Date.now() + Math.min(30, 2 ** Math.max(0, job.attempts - 1)) * 60_000).toISOString();
      await db.from("broadcast_recipients").update({
        status: retry ? "pending" : "failed",
        next_attempt_at: retry ? nextAttempt : null,
        error_message: bounded(providerError.message),
        status_updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "processing");
      if (!retry) failed += 1;
    }
  }

  for (const campaignId of campaignIds) {
    const rows: Array<{ status: string }> = [];
    let offset = 0;
    let readFailed = false;
    for (;;) {
      const { data: recipientRows, error: recipientReadError } = await db.from("broadcast_recipients")
        .select("status")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true })
        .range(offset, offset + 999);
      if (recipientReadError) {
        readFailed = true;
        break;
      }
      rows.push(...(recipientRows || []));
      if (!recipientRows || recipientRows.length < 1000) break;
      offset += 1000;
    }
    if (readFailed) continue;
    const hasWork = rows.some((row) => ["pending", "processing"].includes(row.status));
    if (hasWork) continue;
    const successes = rows.filter((row) => ["sent", "delivered", "read"].includes(row.status)).length;
    const failures = rows.filter((row) => ["failed", "skipped"].includes(row.status)).length;
    const status = successes > 0 ? failures > 0 ? "partial" : "sent" : "failed";
    await db.from("broadcast_campaigns").update({ status, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", campaignId).in("status", ["processing", "queued"]);
  }

  return jsonResponse({ processed: (jobs || []).length, sent, failed, skipped }, 200, headers);
});
