// A TRAIL, NOT A BOX.
//
// 17 Nov 2026, from Fabio's spec: "Latest update - a trail, not a box. Every
// entry dated and named, nothing typed over. So 'what did we tell them last
// week' has an answer."
//
// Today it is `settlement_note`, one text field on the settlements board and
// one on the deal panel, both reading "e.g. settling 3pm". Whatever was in it
// last week is gone, because somebody typed over it. On a file that pushes
// twice and changes solicitors, that field is the only record of why - and it
// holds one sentence.
//
// NOTHING IS LOST TURNING IT INTO A TRAIL. settlement_note is left exactly
// where it is and seeds the first entry, so a deal carrying a note today still
// carries it tomorrow, with a line saying where it came from.
//
// THE SAME SHAPE SERVES ATTN SETTLEMENTS, which is the field that crosses the
// handover - the broker and credit write into it before formal, settlements add
// to it after. One field, both sides, nothing retyped.

const txt = (v: any) => String(v ?? '').trim()

export type Entry = {
  /** ISO, when it was written. */
  at: string
  /** Who wrote it. A name, because a user id means nothing on a screen. */
  by: string
  text: string
}

function one(v: any): Entry | null {
  if (!v || typeof v !== 'object') return null
  const text = txt((v as any).text)
  if (!text) return null
  return { at: txt((v as any).at), by: txt((v as any).by), text }
}

/**
 * THE TRAIL, NEWEST FIRST.
 *
 * Anything that is not an entry is dropped rather than drawn as an empty row.
 * A column that has held three shapes over its life is a column that will hand
 * back a surprise one day.
 */
export function trailOf(raw: any): Entry[] {
  if (!Array.isArray(raw)) return []
  return raw.map(one).filter((e): e is Entry => e !== null)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}

/**
 * THE OLD ONE-LINE NOTE, AS THE FIRST ENTRY.
 *
 * Only ever used where the trail is empty and the note is not - a deal that has
 * been written on since is already carrying its history and must not have an
 * old sentence pushed into the middle of it.
 */
export function seedFrom(note: any, at: any): Entry[] {
  const words = txt(note)
  if (!words) return []
  return [{ at: txt(at), by: '', text: words }]
}

/** Everything on the deal, with the old note underneath where there is one. */
export function trailFor(deal: any, column = 'settlement_trail'): Entry[] {
  const trail = trailOf(deal?.[column])
  if (trail.length > 0) return trail
  if (column !== 'settlement_trail') return trail
  return seedFrom(deal?.settlement_note, deal?.settlement_updated_at)
}

/**
 * WHAT WRITING ON THE TRAIL SAVES.
 *
 * The whole trail back, with the new entry on it. Never a patch that appends
 * server-side: two people writing at once would otherwise each save a trail
 * without the other's line, and the second save would quietly eat the first.
 * That is a real risk on a settlement - the broker and the settlements officer
 * are often in the same deal - so the caller re-reads before it writes.
 */
export function addPatch(
  deal: any, text: any, by: any, now: Date = new Date(), column = 'settlement_trail',
): Record<string, any> | null {
  const words = txt(text)
  if (!words) return null
  const was = trailFor(deal, column)
  const entry: Entry = { at: now.toISOString(), by: txt(by), text: words }
  return { [column]: [entry, ...was] }
}

/** "Belle Nguyen · 12 Nov, 2:40 pm", or just the time where nobody is named. */
export function entryLine(e: Entry, fmt: (iso: string) => string): string {
  const when = e.at ? fmt(e.at) : ''
  return [txt(e.by), when].filter(Boolean).join(' · ')
}
