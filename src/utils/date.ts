const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Date → `YYYY-MM-DD` in local time, for `<input type="date">`. */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * `YYYY-MM-DD` → ISO timestamp at local midnight. Today's date maps to "now"
 * so a grant starting today is active immediately.
 */
export function fromDateInputValue(value: string, now: Date = new Date()): string {
  if (value === toDateInputValue(now)) return now.toISOString()
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).toISOString()
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatDate(iso: string | null | undefined, fallback = '—'): string {
  return iso ? dateFormatter.format(new Date(iso)) : fallback
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const days = Math.round((new Date(iso).getTime() - now.getTime()) / DAY_MS)
  if (Math.abs(days) < 60) return relativeFormatter.format(days, 'day')
  return relativeFormatter.format(Math.round(days / 30), 'month')
}
