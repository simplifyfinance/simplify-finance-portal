// The file note log and the alerts that sit beside it.
//
// Every note field in this portal used to be a box that got overwritten -
// internal notes, "latest update", "outstandings". You typed today's note over
// yesterday's and yesterday's was gone. This is append only.

export type Note = {
  id: string
  deal_id: string
  body: string
  kind: string           // 'note' typed by a person, 'system' written by the portal
  author_name: string | null
  created_at: string
}

export type Alert = {
  id: string
  deal_id: string
  title: string
  owner_name: string | null
  due_on: string | null
  resolved_at: string | null
  resolved_by: string | null
  author_name: string | null
  created_at: string
}

export function isOpen(a: Alert): boolean {
  return !a?.resolved_at
}

export function openAlerts(list: Alert[]): Alert[] {
  return (list || []).filter(isOpen)
}

const DAY = 86400000

// Whole days from today until the due date. Negative once it has passed.
export function daysUntil(due: string | null | undefined, now: Date = new Date()): number | null {
  if (!due) return null
  const d = new Date(String(due).slice(0, 10) + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((d.getTime() - a) / DAY)
}

export type AlertTone = 'red' | 'amber'

// Red once it is due within two days or already overdue. An alert with no date
// is amber - it is a problem, but not a clock.
export function toneOf(a: Alert, now: Date = new Date()): AlertTone {
  const d = daysUntil(a?.due_on, now)
  return d !== null && d <= 2 ? 'red' : 'amber'
}

// Short enough for a chip on a deal card, where there is room for about
// thirty characters and no more.
export function chipLabel(a: Alert, now: Date = new Date()): string {
  const t = String(a?.title || '').trim()
  const short = t.length > 26 ? t.slice(0, 25).trimEnd() + '…' : t
  const d = daysUntil(a?.due_on, now)
  if (d === null) return short
  if (d < 0) return `${short} · overdue`
  if (d === 0) return `${short} · today`
  if (d === 1) return `${short} · tomorrow`
  return `${short} · ${d}d`
}

// Newest first. The log is read from the top - what happened most recently is
// what somebody opening the deal wants first.
export function newestFirst(list: Note[]): Note[] {
  return [...(list || [])].sort((a, b) =>
    String(b?.created_at || '').localeCompare(String(a?.created_at || '')))
}

// Open alerts, most urgent first: overdue, then soonest due, then undated.
export function byUrgency(list: Alert[], now: Date = new Date()): Alert[] {
  return openAlerts(list).sort((a, b) => {
    const da = daysUntil(a.due_on, now), db = daysUntil(b.due_on, now)
    if (da === null && db === null) return String(a.created_at).localeCompare(String(b.created_at))
    if (da === null) return 1
    if (db === null) return -1
    return da - db
  })
}

export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-AU', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export function dueLabel(due: string | null | undefined, now: Date = new Date()): string {
  const d = daysUntil(due, now)
  if (d === null) return ''
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} overdue`
  if (d === 0) return 'due today'
  if (d === 1) return 'due tomorrow'
  return `${d} days`
}
