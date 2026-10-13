import emailjs from "@emailjs/browser"

export async function sendClientWelcomeEmail({ email, name, company }) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      "EmailJS is not configured. Add the service ID, template ID, and public key to .env, then restart the app."
    )
  }

  return emailjs.send(
    serviceId,
    templateId,
    {
      to_email: email,
      client_name: name,
      company_name: company || "our team",
      email,
    },
    { publicKey }
  )
}
