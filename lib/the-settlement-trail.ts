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
  /** ISO, when it was written. Also what a reply points at - see `to`. */
  at: string
  /** Who wrote it. A name, because a user id means nothing on a screen. */
  by: string
  text: string
  // A PROGRESS NOTE UNDER SOMETHING ALREADY WRITTEN. 22 Nov 2026.
  //
  // Belle: "Can we also add an Edit option on the right side of each attention
  // item? This would allow us to easily update or add progress notes directly
  // under each attention."
  //
  // An Edit would have meant typing over what was there, and the whole point
  // of this file is that nothing is typed over - Fabio, 17 Nov: "every entry
  // dated and named, nothing typed over. So 'what did we tell them last week'
  // has an answer." Her own words were "add progress notes directly under
  // each attention", which is a reply, not an edit.
  //
  // So a reply is an ordinary entry, dated and named like any other, carrying
  // the `at` of the one it is about. Nothing is lost and nothing is rewritten.
  to?: string
}

function one(v: any): Entry | null {
  if (!v || typeof v !== 'object') return null
  const text = txt((v as any).text)
  if (!text) return null
  const to = txt((v as any).to)
  return { at: txt((v as any).at), by: txt((v as any).by), text, ...(to ? { to } : {}) }
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

export type Thread = { entry: Entry; replies: Entry[] }

/**
 * THE TRAIL AS IT IS READ: each entry with its progress notes under it.
 *
 * Entries newest first, as they have always been. Replies OLDEST first under
 * their own entry, because replies are a story about one thing and a story
 * reads forwards.
 *
 * A REPLY WHOSE ENTRY IS GONE IS STILL SHOWN. It becomes an entry of its own
 * rather than disappearing. Somebody's note must not vanish because the line
 * above it was removed - that is the same kind of silent loss this whole file
 * exists to stop.
 */
export function threadsOf(entries: Entry[]): Thread[] {
  const tops = entries.filter(e => !e.to)
  const known = new Set(tops.map(e => e.at))
  const orphans = entries.filter(e => e.to && !known.has(e.to))

  const byParent = new Map<string, Entry[]>()
  for (const e of entries) {
    if (!e.to || !known.has(e.to)) continue
    byParent.set(e.to, [...(byParent.get(e.to) || []), e])
  }

  return [...tops, ...orphans]
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map(entry => ({
      entry,
      replies: (byParent.get(entry.at) || [])
        .sort((a, b) => (a.at || '').localeCompare(b.at || '')),
    }))
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
  to: any = '',
): Record<string, any> | null {
  const words = txt(text)
  if (!words) return null
  const was = trailFor(deal, column)
  const under = txt(to)
  // A REPLY TO SOMETHING THAT IS NOT THERE IS WRITTEN AS AN ORDINARY ENTRY.
  // Better a note in the trail than a note pointing at nothing.
  const real = under && was.some(e => e.at === under) ? under : ''
  const entry: Entry = {
    at: now.toISOString(), by: txt(by), text: words, ...(real ? { to: real } : {}),
  }
  return { [column]: [entry, ...was] }
}

/** "Belle Nguyen · 12 Nov, 2:40 pm", or just the time where nobody is named. */
export function entryLine(e: Entry, fmt: (iso: string) => string): string {
  const when = e.at ? fmt(e.at) : ''
  return [txt(e.by), when].filter(Boolean).join(' · ')
}
