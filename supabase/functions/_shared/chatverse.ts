const bounded = (value: unknown, max = 300) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function sendNewLeadTemplate(phone: string) {
  const apiKey = Deno.env.get("CHATVERSE_API_KEY");
  if (!apiKey) throw new Error("ChatVerse API is not configured on the server.");

  let recipient = phone.replace(/\D/g, "");
  if (recipient.length === 10) {
    const countryCode = (Deno.env.get("CHATVERSE_DEFAULT_COUNTRY_CODE") || "91").replace(/\D/g, "");
    recipient = `${countryCode}${recipient}`;
  }
  if (recipient.length < 10 || recipient.length > 15) {
    throw new Error("Use an international phone number with country code.");
  }

  let response: Response;
  try {
    response = await fetch("https://api.chatverse.io/v1/whatsapp/templates/new_template/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: recipient, language: "en_US" }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("ChatVerse did not return a response. Check provider history before retrying.");
  }

  const responseText = await response.text().catch(() => "");
  let result: Record<string, unknown> = {};
  try {
    result = JSON.parse(responseText);
  } catch {
    // The HTTP status remains useful when the provider responds with plain text.
  }
  if (!response.ok || result.success === false) {
    const message = bounded(result.error) || `ChatVerse returned status ${response.status}.`;
    throw new Error(message);
  }
}
