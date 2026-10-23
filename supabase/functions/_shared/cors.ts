export function corsHeaders(origin: string | null) {
  const allowedOrigins = (Deno.env.get("PUBLIC_SITE_URLS") || Deno.env.get("PUBLIC_SITE_URL") || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const normalizedOrigin = origin?.replace(/\/$/, "");
  const allowOrigin = allowedOrigins.length
    ? normalizedOrigin && allowedOrigins.includes(normalizedOrigin) ? normalizedOrigin : "null"
    : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
