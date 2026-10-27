import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import Icon from "../components/Icon"

const tabs = [
  { id: "email", label: "Email", icon: "mail" },
  { id: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
  { id: "history", label: "Campaign history", icon: "clock" },
  { id: "reports", label: "Reports", icon: "chart" },
]
const stages = ["discovery", "contacted", "qualified", "meeting_booked", "follow_up", "signed", "active", "in_revision", "delivered"]
const stageLabel = (value = "") => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const dateLabel = (value) => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"
const toLocalDateTime = (value) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character])
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())
const validPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "")
  return digits.length >= 8 && digits.length <= 15
}
const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600"
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
const ghostButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
const cardClass = "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"

async function loadAllRows(table, columns, orderColumn) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).order(orderColumn, { ascending: false }).range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return { data: rows, error: null }
  }
}

async function loadCampaignRecipientRows(campaignId) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("broadcast_recipients")
      .select("id, client_name, company, email, phone, status, attempts, error_message, provider_message_id, sent_at, status_updated_at, email_opened_at, email_clicked_at, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return { data: rows, error: null }
  }
}

const statusStyle = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-violet-50 text-violet-700",
  queued: "bg-blue-50 text-blue-700",
  processing: "bg-amber-50 text-amber-700",
  sent: "bg-emerald-50 text-emerald-700",
  delivered: "bg-emerald-50 text-emerald-700",
  read: "bg-sky-50 text-sky-700",
  partial: "bg-orange-50 text-orange-700",
  failed: "bg-rose-50 text-rose-700",
  skipped: "bg-slate-100 text-slate-500",
  cancelled: "bg-slate-100 text-slate-500",
  pending: "bg-blue-50 text-blue-700",
}

function StatusPill({ status }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusStyle[status] || statusStyle.pending}`}>{status || "pending"}</span>
}

function MetricCard({ label, value, detail, icon, tone = "indigo" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
  }
  return <article className={`${cardClass} flex min-w-0 items-center gap-4 p-4 sm:p-5`}><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}><Icon name={icon} size={18} /></div><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-1 truncate text-xs text-slate-400">{detail}</p></div></article>
}

function Broadcasting() {
  const [activeTab, setActiveTab] = useState("email")
  const [clients, setClients] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [recipientStats, setRecipientStats] = useState([])
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [visibleClientCount, setVisibleClientCount] = useState(100)
  const [filters, setFilters] = useState({ search: "", stage: "all", service: "all" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [channel, setChannel] = useState("email")
  const [campaignName, setCampaignName] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [messageKind, setMessageKind] = useState("text")
  const [templateName, setTemplateName] = useState("")
  const [templateLanguage, setTemplateLanguage] = useState("en_US")
  const [templateParameters, setTemplateParameters] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [attachedFiles, setAttachedFiles] = useState([])
  const [storedAttachments, setStoredAttachments] = useState([])
  const [editingCampaignId, setEditingCampaignId] = useState(null)
  const [editorRevision, setEditorRevision] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [contentPreviewOpen, setContentPreviewOpen] = useState(false)
  const [historyCampaign, setHistoryCampaign] = useState(null)
  const [historyRecipients, setHistoryRecipients] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const editorRef = useRef(null)
  const bodyHtmlRef = useRef("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    const [clientResult, campaignResult, recipientResult] = await Promise.all([
      loadAllRows("clients", "id, name, email, phone, company, stage, service_name, email_marketing_opt_in, email_unsubscribed_at, whatsapp_opt_in, created_at", "created_at"),
      loadAllRows("broadcast_campaigns", "id, name, channel, status, subject, body_html, body_text, message_kind, template_name, template_language, template_parameters, filters, attachment_paths, recipient_count, scheduled_at, created_at, completed_at, dedupe_key", "created_at"),
      loadAllRows("broadcast_recipients", "campaign_id, status, email_opened_at, email_clicked_at, created_at", "created_at"),
    ])
    const failure = [clientResult.error, campaignResult.error, recipientResult.error].find(Boolean)
    if (failure) setError(failure.message)
    setClients(clientResult.data || [])
    setCampaigns(campaignResult.data || [])
    setRecipientStats(recipientResult.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = bodyHtmlRef.current || ""
  }, [editorRevision, channel])

  const changeFilter = (key, value) => {
    setVisibleClientCount(100)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const changeChannel = (nextChannel) => {
    setVisibleClientCount(100)
    setChannel(nextChannel)
  }

  const eligible = useCallback((client) => channel === "email"
    ? Boolean(validEmail(client.email) && client.email_marketing_opt_in && !client.email_unsubscribed_at)
    : Boolean(validPhone(client.phone) && client.whatsapp_opt_in), [channel])

  const filteredClients = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return clients.filter((client) => {
      const searchMatch = !query || [client.name, client.email, client.phone, client.company].some((value) => String(value || "").toLowerCase().includes(query))
      return searchMatch
        && (filters.stage === "all" || client.stage === filters.stage)
        && (filters.service === "all" || (client.service_name || "No service") === filters.service)
    })
  }, [clients, filters])
  const visibleClients = filteredClients.slice(0, visibleClientCount)

  const recipients = useMemo(() => clients.filter((client) => selectedRecipients.includes(String(client.id))), [clients, selectedRecipients])
  const eligibleSelected = recipients.filter(eligible)
  const eligibleFiltered = filteredClients.filter(eligible)
  const serviceNames = [...new Set(clients.map((client) => client.service_name || "No service"))].sort()
  const previewClient = eligibleSelected[0] || recipients[0]
  const previewMarkup = bodyHtml
    .replace(/\{\{\s*name\s*\}\}/gi, escapeHtml(previewClient?.name || "Client"))
    .replace(/\{\{\s*company\s*\}\}/gi, escapeHtml(previewClient?.company || "your company"))

  const toggleRecipient = (clientId) => setSelectedRecipients((current) => current.includes(String(clientId))
    ? current.filter((id) => id !== String(clientId))
    : [...current, String(clientId)])

  const selectFilteredEligible = () => {
    const ids = eligibleFiltered.map((client) => String(client.id))
    setSelectedRecipients((current) => [...new Set([...current, ...ids])])
  }

  const selectAllEligible = () => {
    const ids = clients.filter(eligible).map((client) => String(client.id))
    setSelectedRecipients((current) => [...new Set([...current, ...ids])])
  }

  const clearComposer = () => {
    setCampaignName("")
    setSubject("")
    setBodyHtml("")
    bodyHtmlRef.current = ""
    setBodyText("")
    setMessageKind("text")
    setTemplateName("")
    setTemplateLanguage("en_US")
    setTemplateParameters("")
    setScheduledAt("")
    setAttachedFiles([])
    setStoredAttachments([])
    setEditingCampaignId(null)
    setSelectedRecipients([])
    setEditorRevision((value) => value + 1)
  }

  const editCampaign = (campaign) => {
    if (campaign.status !== "draft") return
    setActiveTab(campaign.channel)
    changeChannel(campaign.channel)
    setCampaignName(campaign.name || "")
    setSubject(campaign.subject || "")
    setBodyHtml(campaign.body_html || "")
    bodyHtmlRef.current = campaign.body_html || ""
    setBodyText(campaign.body_text || "")
    setMessageKind(campaign.message_kind || "text")
    setTemplateName(campaign.template_name || "")
    setTemplateLanguage(campaign.template_language || "en_US")
    setTemplateParameters((campaign.template_parameters || []).join(", "))
    setScheduledAt(toLocalDateTime(campaign.scheduled_at))
    setStoredAttachments(campaign.attachment_paths || [])
    setEditingCampaignId(campaign.id)
    setSelectedRecipients(campaign.filters?.client_ids || [])
    setVisibleClientCount(100)
    setFilters({ search: "", stage: campaign.filters?.stage || "all", service: campaign.filters?.service || "all" })
    setEditorRevision((value) => value + 1)
    setNotice(`Editing draft “${campaign.name}”.`)
    setError("")
  }

  const addAttachments = (event) => {
    const incoming = [...(event.target.files || [])]
    const maxCount = channel === "email" ? 5 : 1
    const currentCount = storedAttachments.length + attachedFiles.length
    const available = Math.max(0, maxCount - currentCount)
    const selected = incoming.slice(0, available)
    const invalid = selected.find((file) => file.size > 10 * 1024 * 1024)
    if (invalid) setError(`${invalid.name} is larger than the 10 MB attachment limit.`)
    else if (incoming.length > available) setError(`You can attach up to ${maxCount} file${maxCount === 1 ? "" : "s"} to this ${channel === "email" ? "email" : "WhatsApp message"}.`)
    else {
      setError("")
      setAttachedFiles((current) => [...current, ...selected])
    }
    event.target.value = ""
  }

  const uploadAttachments = async (campaignId) => {
    const uploaded = []
    for (const file of attachedFiles) {
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(0, 120)
      const path = `campaigns/${campaignId}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from("broadcast-attachments").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false })
      if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`)
      uploaded.push({ path, name: file.name, type: file.type || "application/octet-stream", size: file.size })
    }
    return [...storedAttachments, ...uploaded]
  }

  const getDedupeKey = () => [
    channel,
    subject.trim(),
    bodyHtml,
    bodyText.trim(),
    messageKind,
    templateName.trim(),
    templateParameters.trim(),
    [...storedAttachments.map((file) => file.path), ...attachedFiles.map((file) => `${file.name}:${file.size}`)].join(","),
    selectedRecipients.slice().sort().join(","),
  ].join("|").slice(0, 500)

  const buildPayload = (status, attachmentPaths, userId) => ({
    name: campaignName.trim(),
    channel,
    status,
    subject: channel === "email" ? subject.trim() : null,
    body_html: channel === "email" ? bodyHtml : null,
    body_text: channel === "email" ? bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : bodyText.trim(),
    message_kind: channel === "whatsapp" ? messageKind : "text",
    template_name: messageKind === "template" ? templateName.trim() : null,
    template_language: messageKind === "template" ? templateLanguage.trim() : null,
    template_parameters: messageKind === "template" ? templateParameters.split(",").map((value) => value.trim()).filter(Boolean) : [],
    filters: { ...filters, client_ids: selectedRecipients, recipient_mode: "selected" },
    attachment_paths: attachmentPaths,
    recipient_count: status === "draft" ? 0 : eligibleSelected.length,
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    dedupe_key: getDedupeKey(),
    ...(editingCampaignId ? {} : { created_by: userId }),
    updated_at: new Date().toISOString(),
  })

  const validateComposer = (sending = false) => {
    if (!campaignName.trim()) return "Add a campaign name."
    if (channel === "email" && (!subject.trim() || !bodyHtml.replace(/<[^>]*>/g, "").trim())) return "Email campaigns need a subject and message."
    if (channel === "whatsapp" && messageKind === "text" && !bodyText.trim()) return "Enter a WhatsApp message."
    if (channel === "whatsapp" && messageKind === "template" && !templateName.trim()) return "Enter the approved WhatsApp template name."
    if (channel === "whatsapp" && messageKind === "media" && !storedAttachments.length && !attachedFiles.length) return "Attach one media file to send a WhatsApp media message."
    if (sending && eligibleSelected.length === 0) return `Select at least one client who has ${channel === "email" ? "an email address and email marketing consent" : "a phone number and WhatsApp opt-in"}.`
    if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) return "Choose a valid scheduled date and time."
    return ""
  }

  const saveDraft = async () => {
    const validation = validateComposer()
    if (validation) { setError(validation); return }
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Your session expired. Sign in again to save this draft.")
      let campaignId = editingCampaignId
      if (!campaignId) {
        const { data, error: insertError } = await supabase.from("broadcast_campaigns").insert({ name: campaignName.trim(), channel, status: "draft", created_by: user.id }).select("id").single()
        if (insertError) throw insertError
        campaignId = data.id
      }
      const attachmentPaths = await uploadAttachments(campaignId)
      const payload = buildPayload("draft", attachmentPaths, user.id)
      const { error: updateError } = await supabase.from("broadcast_campaigns").update(payload).eq("id", campaignId).eq("status", "draft")
      if (updateError) throw updateError
      setStoredAttachments(attachmentPaths)
      setAttachedFiles([])
      setEditingCampaignId(campaignId)
      setNotice("Draft saved. You can edit it from Campaign history.")
      await loadData()
    } catch (saveError) {
      setError(saveError.message || "Could not save this draft.")
    } finally { setSaving(false) }
  }

  const openSendConfirmation = () => {
    const validation = validateComposer(true)
    if (validation) { setError(validation); return }
    if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) { setError("Schedule the campaign for a time in the future."); return }
    setError("")
    setConfirmOpen(true)
  }

  const queueCampaign = async () => {
    setSaving(true)
    setConfirmOpen(false)
    setError("")
    setNotice("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Your session expired. Sign in again to continue.")

      const payloadForHash = getDedupeKey()
      const { data: duplicate } = await supabase.from("broadcast_campaigns").select("id, name, status, created_at").eq("dedupe_key", payloadForHash).in("status", ["queued", "processing", "sent", "partial"]).order("created_at", { ascending: false }).limit(1).maybeSingle()
      if (duplicate && duplicate.id !== editingCampaignId) {
        const recent = Date.now() - new Date(duplicate.created_at).getTime() < 24 * 60 * 60 * 1000
        if (recent && !window.confirm(`A similar campaign “${duplicate.name}” was ${duplicate.status} recently. Send this campaign again?`)) {
          setSaving(false)
          return
        }
      }

      let campaignId = editingCampaignId
      if (!campaignId) {
        const { data, error: insertError } = await supabase.from("broadcast_campaigns").insert({ name: campaignName.trim(), channel, status: "draft", created_by: user.id }).select("id").single()
        if (insertError) throw insertError
        campaignId = data.id
      }
      const attachmentPaths = await uploadAttachments(campaignId)
      const scheduleDate = scheduledAt ? new Date(scheduledAt) : null
      const status = scheduleDate && scheduleDate.getTime() > Date.now() ? "scheduled" : "queued"
      const payload = buildPayload("draft", attachmentPaths, user.id)
      const { error: updateError } = await supabase.from("broadcast_campaigns").update(payload).eq("id", campaignId).eq("status", "draft")
      if (updateError) throw updateError

      const { error: clearError } = await supabase.from("broadcast_recipients").delete().eq("campaign_id", campaignId)
      if (clearError) throw clearError

      const rows = eligibleSelected.map((client) => ({
        campaign_id: campaignId,
        client_id: String(client.id),
        client_name: client.name || "Client",
        company: client.company || null,
        email: client.email || null,
        phone: client.phone || null,
        status: "pending",
      }))
      for (let offset = 0; offset < rows.length; offset += 250) {
        const { error: recipientError } = await supabase.from("broadcast_recipients").insert(rows.slice(offset, offset + 250))
        if (recipientError) throw recipientError
      }

      const { error: activateError } = await supabase.from("broadcast_campaigns").update({ ...payload, status, recipient_count: rows.length, scheduled_at: status === "queued" ? null : scheduleDate?.toISOString() || null, updated_at: new Date().toISOString() }).eq("id", campaignId).eq("status", "draft")
      if (activateError) throw activateError

      if (status === "queued") {
        const { data: dispatchData, error: dispatchError } = await supabase.functions.invoke("process-broadcast-queue", { body: { limit: 25 } })
        if (dispatchError) setNotice(`Campaign is saved in the queue, but the worker request failed: ${dispatchError.message}. Check recipient statuses before trying again.`)
        else if (dispatchData?.error) setNotice(`Campaign queued. ${dispatchData.error}`)
        else setNotice(`Campaign queued. ${dispatchData?.sent || 0} sent; ${dispatchData?.failed || 0} failed in this batch. Remaining recipients will be picked up by the queue worker.`)
      } else setNotice(`Campaign scheduled for ${dateLabel(status === "scheduled" ? scheduleDate.toISOString() : null)}.`)
      clearComposer()
      await loadData()
      setActiveTab("history")
    } catch (sendError) {
      setError(sendError.message || "Could not queue this campaign.")
    } finally { setSaving(false) }
  }

  const loadCampaignRecipients = async (campaign) => {
    setHistoryCampaign(campaign)
    setHistoryLoading(true)
    const { data, error: recipientError } = await loadCampaignRecipientRows(campaign.id)
    if (recipientError) setError(recipientError.message)
    setHistoryRecipients(data || [])
    setHistoryLoading(false)
  }

  const sendStatus = async (campaign) => {
    if (campaign.status !== "scheduled") return
    if (!window.confirm(`Send “${campaign.name}” now? This will queue ${campaign.recipient_count} recipients.`)) return
    setSaving(true)
    const { error: updateError } = await supabase.from("broadcast_campaigns").update({ status: "queued", scheduled_at: null, updated_at: new Date().toISOString() }).eq("id", campaign.id).eq("status", "scheduled")
    if (updateError) setError(updateError.message)
    else {
      const { data, error: invokeError } = await supabase.functions.invoke("process-broadcast-queue", { body: { limit: 25 } })
      if (invokeError || data?.error) setNotice(`Campaign is saved in the queue, but the worker did not process it: ${invokeError?.message || data?.error}`)
      else setNotice(`Campaign started. ${data?.sent || 0} sent; ${data?.failed || 0} failed in this batch.`)
    }
    await loadData()
    if (historyCampaign?.id === campaign.id) await loadCampaignRecipients({ ...campaign, status: "queued" })
    setSaving(false)
  }

  const processQueue = async () => {
    const queuedCampaigns = campaigns.filter((campaign) => ["queued", "processing"].includes(campaign.status))
    const campaignSummary = queuedCampaigns.map((campaign) => `• ${campaign.name} (${campaign.recipient_count} recipients)`).join("\n")
    if (!queuedCampaigns.length || !window.confirm(`This processes pending recipients across all queued campaigns:\n\n${campaignSummary}\n\nOnly continue if every listed campaign is ready to send.`)) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("process-broadcast-queue", { body: { limit: 25 } })
      if (invokeError) setNotice(`Queue remains saved. The worker could not be reached: ${invokeError.message}`)
      else if (data?.error) setNotice(`Queue remains saved. ${data.error}`)
      else setNotice(`Queue checked: ${data?.sent || 0} sent, ${data?.failed || 0} failed, ${data?.skipped || 0} skipped in this batch.`)
      await loadData()
      if (historyCampaign) await loadCampaignRecipients(historyCampaign)
    } catch (queueError) {
      setNotice(`Queue remains saved, but processing failed: ${queueError.message || "Unknown worker error."}`)
    } finally {
      setSaving(false)
    }
  }

  const toolbarCommand = (command, value) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    setBodyHtml(editorRef.current?.innerHTML || "")
  }

  const campaignMetrics = useMemo(() => {
    const counts = { total: 0, sent: 0, delivered: 0, failed: 0, read: 0, opened: 0, clicked: 0, scheduled: 0 }
    campaigns.forEach((campaign) => { counts.total += Number(campaign.recipient_count || 0); if (campaign.status === "scheduled") counts.scheduled += 1 })
    recipientStats.forEach(({ status, email_opened_at, email_clicked_at }) => {
      if (["sent", "delivered", "read"].includes(status)) counts.sent += 1
      if (["delivered", "read"].includes(status)) counts.delivered += 1
      if (status === "read") counts.read += 1
      if (status === "failed") counts.failed += 1
      if (email_opened_at) counts.opened += 1
      if (email_clicked_at) counts.clicked += 1
    })
    return counts
  }, [campaigns, recipientStats])

  const reportCounts = useMemo(() => {
    const channelCounts = { email: { sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 }, whatsapp: { sent: 0, delivered: 0, read: 0, failed: 0 } }
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign.channel]))
    recipientStats.forEach((recipient) => {
      const channelType = campaignById.get(recipient.campaign_id)
      if (!channelType || !channelCounts[channelType]) return
      if (["sent", "delivered", "read"].includes(recipient.status)) channelCounts[channelType].sent += 1
      if (["delivered", "read"].includes(recipient.status)) channelCounts[channelType].delivered += 1
      if (channelType === "whatsapp" && recipient.status === "read") channelCounts.whatsapp.read += 1
      if (recipient.status === "failed") channelCounts[channelType].failed += 1
      if (channelType === "email" && recipient.email_opened_at) channelCounts.email.opened += 1
      if (channelType === "email" && recipient.email_clicked_at) channelCounts.email.clicked += 1
    })
    return channelCounts
  }, [campaigns, recipientStats])

  const currentCampaigns = activeTab === "email" || activeTab === "whatsapp"
    ? campaigns.filter((campaign) => campaign.channel === activeTab)
    : campaigns

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600">Client communications</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Broadcasting</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Create permission-aware campaigns, review recipients, and follow delivery from one place.</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" />Consent checks are on</div>
      </div>

      {(error || notice) && <div role={error ? "alert" : "status"} className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || notice}<button type="button" className="float-right font-semibold" onClick={() => { setError(""); setNotice("") }} aria-label="Dismiss">×</button></div>}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recipients" value={campaignMetrics.total.toLocaleString()} detail="Across all campaigns" icon="leads" />
        <MetricCard label="Messages sent" value={campaignMetrics.sent.toLocaleString()} detail="Accepted by the provider" icon="send" tone="violet" />
        <MetricCard label="Delivered" value={campaignMetrics.delivered.toLocaleString()} detail="Provider-confirmed statuses, currently WhatsApp" icon="check" tone="emerald" />
        <MetricCard label="Failed" value={campaignMetrics.failed.toLocaleString()} detail={`${campaignMetrics.scheduled} campaigns scheduled`} icon="close" tone="rose" />
        <MetricCard label="Email opens" value="Unavailable" detail="Not provided by the current EmailJS integration" icon="mail" tone="violet" />
        <MetricCard label="Email clicks" value="Unavailable" detail="Not provided by the current EmailJS integration" icon="arrow" />
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3 sm:px-5">
          {tabs.map((tab) => <button key={tab.id} type="button" disabled={Boolean(editingCampaignId && (tab.id === "email" || tab.id === "whatsapp") && tab.id !== channel)} onClick={() => { setActiveTab(tab.id); if (tab.id === "email" || tab.id === "whatsapp") changeChannel(tab.id) }} className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl border-b-2 px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${activeTab === tab.id ? "border-indigo-500 bg-indigo-50/70 text-indigo-700" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Icon name={tab.icon} size={16} />{tab.label}</button>)}
        </div>

        {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading campaigns and clients…</div> : <>
          {(activeTab === "email" || activeTab === "whatsapp") && <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
            <div className="min-w-0 border-b border-slate-100 p-4 sm:p-6 xl:border-b-0 xl:border-r">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{editingCampaignId ? "Edit campaign draft" : `Compose ${channel === "email" ? "email" : "WhatsApp"} campaign`}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Personalize with <code className="rounded bg-slate-100 px-1">{"{{name}}"}</code> and <code className="rounded bg-slate-100 px-1">{"{{company}}"}</code>.</p></div>{editingCampaignId && <button type="button" onClick={clearComposer} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Exit draft</button>}</div>

              <div className="space-y-4">
                <label className="block"><span className={labelClass}>Campaign name</span><input className={inputClass} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="e.g. October project update" maxLength={120} /></label>

                {channel === "email" ? <>
                  <label className="block"><span className={labelClass}>Subject</span><input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A clear, personal subject line" maxLength={200} /></label>
                  <div><label className={labelClass}>Message</label><div className="overflow-hidden rounded-xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10"><div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 p-2"><button type="button" title="Bold" onClick={() => toolbarCommand("bold")} className="h-8 w-8 rounded-lg text-sm font-bold text-slate-600 hover:bg-white">B</button><button type="button" title="Italic" onClick={() => toolbarCommand("italic")} className="h-8 w-8 rounded-lg text-sm italic text-slate-600 hover:bg-white">I</button><button type="button" title="Bulleted list" onClick={() => toolbarCommand("insertUnorderedList")} className="h-8 rounded-lg px-2 text-sm text-slate-600 hover:bg-white">• List</button><button type="button" title="Numbered list" onClick={() => toolbarCommand("insertOrderedList")} className="h-8 rounded-lg px-2 text-sm text-slate-600 hover:bg-white">1. List</button><button type="button" title="Add link" onClick={() => { const href = window.prompt("Link address (https://…)"); if (href && /^https?:\/\//i.test(href)) toolbarCommand("createLink", href) }} className="h-8 rounded-lg px-2 text-sm text-slate-600 hover:bg-white">Link</button></div><div ref={editorRef} contentEditable suppressContentEditableWarning onInput={() => { const html = editorRef.current?.innerHTML || ""; bodyHtmlRef.current = html; setBodyHtml(html) }} className="min-h-[220px] max-h-[480px] overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-700 outline-none [&_a]:text-indigo-600 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5" data-placeholder="Write your email here…" /></div><p className="mt-1.5 text-[11px] text-slate-400">A one-click unsubscribe link is added to every delivered campaign.</p></div>
                </> : <>
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setMessageKind("text")} className={`rounded-lg px-2 py-2 text-xs font-semibold ${messageKind === "text" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Text</button><button type="button" onClick={() => setMessageKind("template")} className={`rounded-lg px-2 py-2 text-xs font-semibold ${messageKind === "template" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Approved template</button><button type="button" onClick={() => setMessageKind("media")} className={`rounded-lg px-2 py-2 text-xs font-semibold ${messageKind === "media" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Media</button></div>
                  {messageKind === "template" && <div className="grid gap-3 sm:grid-cols-2"><label><span className={labelClass}>Approved template name</span><input className={inputClass} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="appointment_update" maxLength={120} /></label><label><span className={labelClass}>Language code</span><input className={inputClass} value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value)} placeholder="en_US" maxLength={20} /></label></div>}
                  {messageKind === "template" ? <label className="block"><span className={labelClass}>Body parameter values</span><input className={inputClass} value={templateParameters} onChange={(event) => setTemplateParameters(event.target.value)} placeholder="Hello {{name}}, your project is ready" /><span className="mt-1 block text-[11px] text-slate-400">Comma separated, in the same order as the approved template variables.</span></label> : <label className="block"><span className={labelClass}>{messageKind === "media" ? "Caption or message" : "Message"}</span><textarea className={`${inputClass} min-h-[150px] resize-y py-3 leading-6`} value={bodyText} onChange={(event) => setBodyText(event.target.value)} placeholder="Write a clear, concise message…" maxLength={4096} /></label>}
                  <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">WhatsApp free-form messages are sent only within the provider's customer-service window. Outside that window, use an approved template.</p>
                </>}

                <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className={labelClass}>Schedule (optional)</span><input className={inputClass} type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label><div><span className={labelClass}>Attachments {channel === "whatsapp" && messageKind !== "media" ? <span className="font-normal text-slate-400">(choose media first)</span> : <span className="font-normal text-slate-400">(max 10 MB each)</span>}</span><label className={`${ghostButtonClass} w-full cursor-pointer ${channel === "whatsapp" && messageKind !== "media" ? "cursor-not-allowed opacity-50" : ""}`}><Icon name="file" size={15} />Add file<input type="file" className="sr-only" disabled={channel === "whatsapp" && messageKind !== "media"} multiple={channel === "email"} accept={channel === "whatsapp" ? "image/jpeg,image/png,application/pdf,video/mp4" : ".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.doc,.docx,.xls,.xlsx"} onChange={addAttachments} /></label></div></div>
                {(storedAttachments.length > 0 || attachedFiles.length > 0) && <div className="flex flex-wrap gap-2">{[...storedAttachments.map((file, index) => ({ ...file, stored: true, index })), ...attachedFiles.map((file, index) => ({ name: file.name, size: file.size, stored: false, index }))].map((file) => <span key={`${file.stored ? "stored" : "new"}-${file.index}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600"><Icon name="file" size={13} /><span className="max-w-[180px] truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => file.stored ? setStoredAttachments((current) => current.filter((_, index) => index !== file.index)) : setAttachedFiles((current) => current.filter((_, index) => index !== file.index))} className="font-bold text-slate-400 hover:text-rose-600">×</button></span>)}</div>}

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"><button type="button" className={ghostButtonClass} onClick={saveDraft} disabled={saving}><Icon name="file" size={15} />Save draft</button><button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50" onClick={() => { const validation = validateComposer(true); if (validation) setError(validation); else { setError(""); setContentPreviewOpen(true) } }} disabled={saving}><Icon name="leads" size={15} />Preview {eligibleSelected.length} recipients</button><button type="button" className={`${buttonClass} ml-auto`} onClick={openSendConfirmation} disabled={saving || !eligibleSelected.length}><Icon name={scheduledAt ? "calendar" : "send"} size={15} />{saving ? "Working…" : scheduledAt ? "Review schedule" : "Review & send"}</button></div>
              </div>
            </div>

            <div className="min-w-0 p-4 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-2"><div><h2 className="text-base font-bold text-slate-900">Choose recipients</h2><p className="mt-1 text-xs text-slate-500">Only clients with channel-specific consent can be selected.</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{eligibleSelected.length} selected</span></div>
              <div className="grid gap-2 sm:grid-cols-2"><input aria-label="Search clients" className={`${inputClass} sm:col-span-2`} value={filters.search} onChange={(event) => changeFilter("search", event.target.value)} placeholder="Search clients, email, phone…"/><select aria-label="Filter by stage" className={inputClass} value={filters.stage} onChange={(event) => changeFilter("stage", event.target.value)}><option value="all">All project stages</option>{stages.map((stage) => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select><select aria-label="Filter by service" className={`${inputClass} sm:col-span-2`} value={filters.service} onChange={(event) => changeFilter("service", event.target.value)}><option value="all">All services</option>{serviceNames.map((service) => <option key={service} value={service}>{service}</option>)}</select></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-x-3 gap-y-1"><button type="button" onClick={selectFilteredEligible} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Select {eligibleFiltered.length} matching</button><button type="button" onClick={selectAllEligible} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Select all {clients.filter(eligible).length} eligible</button></div><button type="button" onClick={() => setSelectedRecipients([])} className="text-xs font-semibold text-slate-400 hover:text-slate-700">Clear</button></div>
              <div className="mt-2 max-h-[440px] overflow-y-auto rounded-xl border border-slate-100">
                {visibleClients.map((client) => {
                  const canSend = eligible(client)
                  const checked = selectedRecipients.includes(String(client.id))
                  const contact = channel === "email" ? client.email : client.phone
                  const consentLabel = channel === "email" ? client.email_unsubscribed_at ? "Unsubscribed" : !validEmail(client.email) ? "Invalid email" : client.email_marketing_opt_in ? "Opted in" : "No email consent" : !validPhone(client.phone) ? "Invalid phone" : client.whatsapp_opt_in ? "Opted in" : "No WhatsApp opt-in"
                  return <label key={client.id} className={`flex items-start gap-3 border-b border-slate-100 px-3 py-3 last:border-0 ${canSend ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed bg-slate-50/50 opacity-70"}`}><input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={checked} disabled={!canSend} onChange={() => toggleRecipient(client.id)} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm font-semibold text-slate-800">{client.name || "Unnamed client"}</strong><span className={`shrink-0 text-[10px] font-semibold ${canSend ? "text-emerald-600" : "text-slate-400"}`}>{consentLabel}</span></span><span className="mt-0.5 block truncate text-xs text-slate-500">{contact || "No contact details"} · {stageLabel(client.stage || "unknown")}</span><span className="mt-0.5 block truncate text-[11px] text-slate-400">{client.service_name || "No service"}</span></span></label>
                })}
                {filteredClients.length === 0 && <p className="px-4 py-9 text-center text-sm text-slate-400">No clients match these filters.</p>}
              </div>
              {visibleClientCount < filteredClients.length && <button type="button" onClick={() => setVisibleClientCount((count) => count + 100)} className="mt-2 w-full rounded-lg py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">Show {Math.min(100, filteredClients.length - visibleClientCount)} more of {filteredClients.length} matching clients</button>}
              <p className="mt-3 text-[11px] leading-5 text-slate-400">{channel === "email" ? "Email recipients must be opted in and not unsubscribed." : "WhatsApp recipients must have an explicit opt-in and an international-format number."} Confirm or record consent on each client profile.</p>
            </div>
          </div>}

          {activeTab === "history" && <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.9fr)]"><div className="min-w-0 border-b border-slate-100 xl:border-b-0 xl:border-r"><div className="flex items-center justify-between gap-3 px-5 py-4"><div><h2 className="font-bold text-slate-900">Campaign history</h2><p className="mt-1 text-xs text-slate-500">Review delivery, open a report, or continue a draft.</p></div>{campaigns.some((campaign) => ["queued", "processing"].includes(campaign.status)) && <button type="button" onClick={processQueue} disabled={saving} className={ghostButtonClass}><Icon name="send" size={15} />Process queue</button>}<button type="button" onClick={loadData} className={ghostButtonClass}><Icon name="refresh" size={15} />Refresh</button></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Campaign", "Channel", "Recipients", "Status", "Created"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{currentCampaigns.map((campaign) => <tr key={campaign.id} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${historyCampaign?.id === campaign.id ? "bg-indigo-50/50" : ""}`} onClick={() => loadCampaignRecipients(campaign)}><td className="px-4 py-3.5"><strong className="block max-w-[230px] truncate text-slate-800">{campaign.name}</strong><span className="mt-0.5 block text-xs text-slate-400">{campaign.subject || campaign.template_name || "Campaign"}</span></td><td className="px-4 py-3.5 capitalize text-slate-600">{campaign.channel}</td><td className="px-4 py-3.5 tabular-nums text-slate-600">{campaign.recipient_count}</td><td className="px-4 py-3.5"><StatusPill status={campaign.status} /></td><td className="px-4 py-3.5 text-xs text-slate-500">{dateLabel(campaign.created_at)}</td></tr>)}{currentCampaigns.length === 0 && <tr><td className="px-4 py-12 text-center text-slate-400" colSpan="5">No campaigns yet. Compose one from the Email or WhatsApp tab.</td></tr>}</tbody></table></div></div>
            <div className="min-w-0 p-4 sm:p-6">{!historyCampaign ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Icon name="chart" size={20} /></div><h3 className="mt-3 text-sm font-bold text-slate-800">Campaign report</h3><p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Select a campaign to view each recipient's latest delivery status and any provider error.</p></div> : <><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{historyCampaign.channel} campaign</p><h3 className="mt-1 text-lg font-bold text-slate-900">{historyCampaign.name}</h3><p className="mt-1 text-xs text-slate-500">{historyCampaign.recipient_count} recipients · {historyCampaign.subject || historyCampaign.template_name || "No subject"}</p></div><div className="flex gap-2">{historyCampaign.status === "draft" && <button type="button" onClick={() => editCampaign(historyCampaign)} className={ghostButtonClass}>Edit draft</button>}{historyCampaign.status === "scheduled" && <button type="button" onClick={() => sendStatus(historyCampaign)} disabled={saving} className={buttonClass}>Send now</button>}</div></div><div className="mt-4 flex flex-wrap gap-2"><StatusPill status={historyCampaign.status} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">{historyCampaign.scheduled_at ? `Scheduled ${dateLabel(historyCampaign.scheduled_at)}` : `Created ${dateLabel(historyCampaign.created_at)}`}</span></div><div className="mt-5 overflow-hidden rounded-xl border border-slate-100"><div className="flex items-center justify-between border-b border-slate-100 px-3 py-3"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Recipients</h4><span className="text-xs text-slate-400">{historyRecipients.length}</span></div><div className="max-h-[440px] overflow-y-auto divide-y divide-slate-100">{historyLoading ? <p className="p-6 text-center text-xs text-slate-400">Loading delivery records…</p> : historyRecipients.map((recipient) => <div key={recipient.id} className="px-3 py-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-xs text-slate-800">{recipient.client_name}</strong><span className="mt-0.5 block truncate text-[11px] text-slate-400">{recipient.email || recipient.phone || "No contact"}{recipient.company ? ` · ${recipient.company}` : ""}</span></div><StatusPill status={recipient.status} /></div>{recipient.error_message && <p className="mt-2 break-words rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] leading-4 text-rose-700">{recipient.error_message}</p>}<p className="mt-1 text-[10px] text-slate-400">{recipient.sent_at ? `Sent ${dateLabel(recipient.sent_at)}` : `Attempts ${recipient.attempts}`}{recipient.provider_message_id ? ` · ${recipient.provider_message_id}` : ""}</p></div>)}{!historyLoading && historyRecipients.length === 0 && <p className="p-6 text-center text-xs text-slate-400">No recipient records.</p>}</div></div></>}</div></div>}

          {activeTab === "reports" && <div className="p-4 sm:p-6"><div className="mb-5"><h2 className="text-lg font-bold text-slate-900">Delivery reports</h2><p className="mt-1 text-xs text-slate-500">Campaign request results and provider status callbacks.</p></div><div className="grid gap-4 xl:grid-cols-2">{["email", "whatsapp"].map((reportChannel) => { const stats = reportCounts[reportChannel]; const deliveredRate = stats.sent ? Math.round(stats.delivered / stats.sent * 100) : 0; const failedRate = stats.sent + stats.failed ? Math.round(stats.failed / (stats.sent + stats.failed) * 100) : 0; return <article key={reportChannel} className={`${cardClass} p-5`}><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${reportChannel === "email" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}><Icon name={reportChannel === "email" ? "mail" : "whatsapp"} size={18} /></div><div><h3 className="font-bold capitalize text-slate-900">{reportChannel}</h3><p className="text-xs text-slate-400">{stats.sent.toLocaleString()} {reportChannel === "email" ? "requests accepted by EmailJS" : "messages sent"}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-medium text-slate-500">{reportChannel === "email" ? "Delivery status" : "Delivered"}</p><p className="mt-1 text-xl font-bold text-slate-900">{reportChannel === "email" ? "Unavailable" : stats.delivered.toLocaleString()}</p><p className="mt-1 text-[11px] text-emerald-700">{reportChannel === "email" ? "EmailJS does not send delivery callbacks here" : `${deliveredRate}% delivery rate`}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-medium text-slate-500">Failed</p><p className="mt-1 text-xl font-bold text-slate-900">{stats.failed.toLocaleString()}</p><p className="mt-1 text-[11px] text-rose-700">{failedRate}% failure rate</p></div>{reportChannel === "whatsapp" && <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-medium text-slate-500">Read</p><p className="mt-1 text-xl font-bold text-slate-900">{stats.read.toLocaleString()}</p><p className="mt-1 text-[11px] text-sky-700">Provider-confirmed reads</p></div>}<div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-medium text-slate-500">Campaigns</p><p className="mt-1 text-xl font-bold text-slate-900">{campaigns.filter((campaign) => campaign.channel === reportChannel).length}</p><p className="mt-1 text-[11px] text-slate-400">Including drafts and scheduled</p></div></div></article> })}</div><div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><h3 className="text-sm font-bold text-indigo-950">How delivery is measured</h3><p className="mt-1 text-xs leading-5 text-indigo-900/70">Email sent means EmailJS accepted the request; this integration does not receive email delivered, bounced, open, or click events. WhatsApp delivery and read statuses come from your Meta webhook subscription.</p></div></div>}
        </>}
      </section>

      {contentPreviewOpen && <div className="fixed inset-0 z-[1190] flex items-center justify-center bg-slate-950/40 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setContentPreviewOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="broadcast-preview-title" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="border-b border-slate-100 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Campaign preview</p><h2 id="broadcast-preview-title" className="mt-1 text-xl font-bold text-slate-900">{subject || campaignName || "Message preview"}</h2><p className="mt-1 text-xs text-slate-500">Sample for {previewClient?.name || "your first selected recipient"}</p></header><div className="overflow-y-auto p-5">{channel === "email" ? <iframe title="Email message preview" sandbox="" className="h-[360px] w-full rounded-xl border border-slate-200 bg-white" srcDoc={`<!doctype html><html><body style="font:15px/1.6 Arial,sans-serif;color:#334155;padding:20px">${previewMarkup || "<p>Your message will appear here.</p>"}<hr style="border:0;border-top:1px solid #e2e8f0;margin-top:28px"><p style="font-size:12px;color:#64748b">You received this email because you opted in to updates. <a href="#unsubscribe">Unsubscribe</a></p></body></html>`} /> : <div className="mx-auto max-w-[340px] rounded-2xl bg-[#e9f7ed] p-4 shadow-inner"><p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">WhatsApp {messageKind === "template" ? `template · ${templateName || "template name"}` : "message"}</p><div className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-700 shadow-sm whitespace-pre-wrap">{messageKind === "template" ? (templateParameters || "Template parameters").replace(/\{\{\s*name\s*\}\}/gi, previewClient?.name || "Client").replace(/\{\{\s*company\s*\}\}/gi, previewClient?.company || "your company") : bodyText || "Your message will appear here."}{messageKind === "media" && (storedAttachments[0]?.name || attachedFiles[0]?.name) && <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-emerald-700">Attachment: {storedAttachments[0]?.name || attachedFiles[0]?.name}</p>}</div><p className="mt-2 text-right text-[10px] text-slate-400">Sent with the WhatsApp Business Platform</p></div>}<div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">{eligibleSelected.length} selected recipients · {channel === "email" ? "Unsubscribe footer will be included." : "Consent and provider window requirements apply."}</div></div><footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><button type="button" className={ghostButtonClass} onClick={() => setContentPreviewOpen(false)}>Close preview</button><button type="button" className={buttonClass} onClick={() => { setContentPreviewOpen(false); openSendConfirmation() }}>Review recipients<Icon name="arrow" size={15} /></button></footer></section></div>}

      {confirmOpen && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/40 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="broadcast-confirm-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="border-b border-slate-100 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Final review</p><h2 id="broadcast-confirm-title" className="mt-1 text-xl font-bold text-slate-900">{scheduledAt ? "Schedule campaign" : "Confirm bulk send"}</h2><p className="mt-1 text-sm text-slate-500">{campaignName} · {eligibleSelected.length} eligible {eligibleSelected.length === 1 ? "recipient" : "recipients"}</p></header><div className="overflow-y-auto p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Channel</p><p className="mt-1 text-sm font-semibold capitalize text-slate-800">{channel}{channel === "email" && subject ? ` · ${subject}` : messageKind === "template" ? ` · ${templateName}` : ""}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Timing</p><p className="mt-1 text-sm font-semibold text-slate-800">{scheduledAt ? dateLabel(new Date(scheduledAt).toISOString()) : "Send as soon as queued"}</p></div></div><h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Recipients</h3><div className="max-h-[34vh] overflow-y-auto rounded-xl border border-slate-100">{eligibleSelected.map((client) => <div key={client.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 last:border-0"><span className="min-w-0"><strong className="block truncate text-xs text-slate-800">{client.name}</strong><span className="block truncate text-[11px] text-slate-400">{channel === "email" ? client.email : client.phone}</span></span><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Consent verified</span></div>)}</div><p className="mt-3 text-[11px] leading-5 text-slate-400">The recipient list and consent status will be saved with this campaign. Sending can take a few minutes for larger lists.</p></div><footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4"><button type="button" className={ghostButtonClass} onClick={() => setConfirmOpen(false)}>Go back</button><button type="button" className={buttonClass} disabled={saving} onClick={queueCampaign}><Icon name={scheduledAt ? "calendar" : "send"} size={15} />{scheduledAt ? "Confirm schedule" : `Send to ${eligibleSelected.length}`}</button></footer></section></div>}
    </div>
  )
}

export default Broadcasting
