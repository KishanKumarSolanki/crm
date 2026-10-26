import emailjs from "@emailjs/browser"

const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character])

export async function sendLeadWelcomeEmail({ email, name, company }) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      "EmailJS is not configured. Add the service ID, template ID, and public key to .env, then restart the app."
    )
  }

  const recipientName = name || "there"
  const companyName = company || "our team"
  const messageText = `Hi ${recipientName},\n\nThank you for getting in touch with ${companyName}. Our team will follow up with you about your project soon.`

  return emailjs.send(
    serviceId,
    templateId,
    {
      to_email: email,
      lead_name: name,
      company_name: companyName,
      email,
      subject: `Welcome to ${companyName}`,
      message_text: messageText,
      message_html: `<p>Hi ${escapeHtml(recipientName)},</p><p>Thank you for getting in touch with ${escapeHtml(companyName)}. Our team will follow up with you about your project soon.</p>`,
    },
    { publicKey }
  )
}

export async function sendWelcomeEmailWhenContacted({ supabase, lead }) {
  if (!lead?.email) return { status: "missing_email" }

  const claimedAt = new Date().toISOString()
  const { data: claim, error: claimError } = await supabase
    .from("clients")
    .update({ welcome_email_sent_at: claimedAt })
    .eq("id", lead.id)
    .eq("stage", "contacted")
    .is("welcome_email_sent_at", null)
    .select("id")
    .maybeSingle()

  if (claimError) throw new Error(`Could not prepare the welcome email: ${claimError.message}`)
  if (!claim) return { status: "already_sent" }

  try {
    await sendLeadWelcomeEmail({
      email: lead.email,
      name: lead.name,
      company: lead.company,
    })
    return { status: "sent", sentAt: claimedAt }
  } catch (error) {
    const { error: releaseError } = await supabase
      .from("clients")
      .update({ welcome_email_sent_at: null })
      .eq("id", lead.id)
      .eq("welcome_email_sent_at", claimedAt)

    if (releaseError) {
      console.error("Could not release the welcome email retry claim:", releaseError)
    }
    throw error
  }
}
