export const INDIA_TIME_ZONE = "Asia/Kolkata"
export const INDIA_TIME_ZONE_LABEL = "India Standard Time (GMT+5:30)"

export const parseDateTime = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  let str = String(value).trim()
  if (!str) return null
  // If the string is a database timestamp without timezone (e.g. "2026-11-10T20:08:58" or "2026-11-10 20:08:58.712655"),
  // treat it as UTC since PostgreSQL timestamps are recorded in UTC.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(str)) {
    str = str.replace(" ", "T") + "Z"
  }
  const date = new Date(str)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatIndiaDateTime = (value, options = {}) => {
  const date = parseDateTime(value)
  if (!date) return ""
  return `${date.toLocaleString("en-IN", { timeZone: INDIA_TIME_ZONE, ...options })} GMT+5:30`
}

export const formatIndiaDate = (value, options = {}) => {
  const date = parseDateTime(value)
  if (!date) return ""
  return date.toLocaleDateString("en-IN", { timeZone: INDIA_TIME_ZONE, ...options })
}

export const indiaDateInputValue = (value = new Date()) => {
  const date = parseDateTime(value)
  if (!date) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const part = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]))
  return `${part.year}-${part.month}-${part.day}`
}

export const indiaDateTimeInputValue = (value) => {
  const date = parseDateTime(value)
  if (!date) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const part = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]))
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`
}

export const indiaDateTimeInputToISOString = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const indiaWallTime = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (
    indiaWallTime.getUTCFullYear() !== year ||
    indiaWallTime.getUTCMonth() !== month - 1 ||
    indiaWallTime.getUTCDate() !== day ||
    hour > 23 || minute > 59
  ) return null
  return new Date(indiaWallTime.getTime() - 330 * 60_000).toISOString()
}
