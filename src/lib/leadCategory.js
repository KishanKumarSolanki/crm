const normalizeSource = (value) => String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ")

export const leadCategoryForSource = (value) => {
  const source = normalizeSource(value)
  if (/\bigs\b|institute growth system/.test(source)) return "igs"
  if (/landing pages?/.test(source)) return "landing-page"
  return null
}

export const sourceCategoryOptions = [
  { id: "all", label: "All" },
  { id: "igs", label: "IGS" },
  { id: "landing-page", label: "Landing Pages" },
]
