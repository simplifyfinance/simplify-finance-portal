// MANAGEMENT SETS THE ORDER, AND SHE IS TOLD WHO AND WHY.
//
// 12 Nov 2026. Fabio:
//
//   "the brokers and admin always dictate for Katie and Mel what they want to
//    do first and in what order. That's a very important thing."
//
// And, asked whether credit can push back on it:
//
//   "Credit never disagrees with the order unless they are sending a deal
//    back, which they already did... But if I give the order, they follow the
//    order."
//
// So this is not a negotiation and there is no reply to write. Management
// orders her day; her only answer is "I can't do this", which sends the deal
// back to the broker with a reason and is the process that already exists.
//
// WHAT IT IS NOT: a silent rewrite of somebody's day. She is told, in words,
// who changed it and what they said - and management is told whether she has
// opened it, because the one time a phone call is the right answer is when
// nobody has looked.
//
// ONE VOICE DOES THE ORDERING. Admin, not each broker. 27 Oct 2026, Catherine:
// "When Mark and Kylie reprioritise, other brokers' deals, like Justin's, keep
// getting pushed back." Give every broker a free hand here and they spend the
// morning swapping position one between them. Brokers keep one slot each - see
// lib/a-slot-each.ts.

const txt = (v: any) => String(v ?? '').trim()

export type OrderFromAbove = {
  /** The user id of whoever set it. */
  by: string | null
  /** Their name, for the sentence on her screen. */
  byName: string
  at: string
  /** The order they set, above the line. */
  dealIds: string[]
  /** One line saying why. Optional, and usually the whole point. */
  note: string
}

export function orderFrom(row: any): OrderFromAbove | null {
  const o = row?.order_from ?? row?.orderFrom
  if (!o || typeof o !== 'object') return null
  const at = txt(o.at)
  if (!at) return null
  return {
    by: txt(o.by) || null,
    byName: txt(o.byName),
    at,
    dealIds: Array.isArray(o.dealIds) ? o.dealIds.map(txt).filter(Boolean) : [],
    note: txt(o.note),
  }
}

/** What to write when management presses Send this order. */
export function orderPatch(
  me: { id?: any; name?: any }, dealIds: string[], note: string, now = new Date(),
): Record<string, any> {
  return {
    deal_ids: dealIds,
    order_from: {
      by: txt(me?.id) || null,
      byName: txt(me?.name),
      at: now.toISOString(),
      dealIds,
      note: txt(note).slice(0, 400),
    },
    // A NEW ORDER IS UNSEEN AGAIN. Clearing this is the whole point: the
    // second change of the morning must raise the flag exactly like the first.
    seen_at: null,
    updated_at: now.toISOString(),
  }
}

/**
 * HAS SHE SEEN THE LATEST ONE?
 *
 * By timestamp rather than by a flag, so an order set after she looked is
 * unseen again without anybody having to remember to clear something.
 */
export function unseen(row: any): boolean {
  const o = orderFrom(row)
  if (!o) return false
  const seen = txt(row?.seen_at ?? row?.seenAt)
  if (!seen) return true
  return new Date(seen).getTime() < new Date(o.at).getTime()
}

/** What she was given that was not on her own list - "he also put X on your day". */
export function putOnHerDay(o: OrderFromAbove | null, hers: string[]): string[] {
  if (!o) return []
  const mine = new Set((hers || []).map(txt))
  return o.dealIds.filter(id => !mine.has(id))
}

export type Told = {
  /** "Fabio changed your order at 9:12 am" */
  line: string
  /** His words, or ''. */
  note: string
  /** Ids he added that she had not picked. */
  added: string[]
}

/**
 * THE RED STRIP ON HER SCREEN, or null when there is nothing to say.
 *
 * `hers` is the day as SHE saved it, so "he also put X on your day" is true
 * rather than a guess.
 */
export function whatSheIsTold(row: any, hers: string[], now = new Date()): Told | null {
  const o = orderFrom(row)
  if (!o || !unseen(row)) return null
  const when = new Date(o.at)
  const sameDay = when.toDateString() === now.toDateString()
  const time = when.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  const who = o.byName || 'Management'
  return {
    line: sameDay
      ? `${who} changed your order at ${time}.`
      : `${who} changed your order.`,
    note: o.note,
    added: putOnHerDay(o, hers),
  }
}

/** Minutes since management sent it, for "not opened yet - 9 minutes". */
export function minutesSince(at: any, now = new Date()): number | null {
  const t = txt(at)
  if (!t) return null
  const ms = new Date(t).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor((now.getTime() - ms) / 60_000))
}

export type SeenState = {
  /** Nothing has been ordered for this person today. */
  none: boolean
  seen: boolean
  /** Minutes it has been sitting unopened. */
  waiting: number | null
  /** The sentence for management's screen. */
  words: string
}

/**
 * WHAT MANAGEMENT'S SCREEN SAYS ABOUT ONE ASSESSOR.
 *
 * This is the half that stops the phone call: not opened after a few minutes
 * is the only state worth acting on, and it says so in minutes rather than
 * leaving somebody to work it out from a timestamp.
 */
export function seenState(row: any, now = new Date()): SeenState {
  const o = orderFrom(row)
  if (!o) return { none: true, seen: false, waiting: null, words: 'No order set today.' }
  const seenAt = txt(row?.seen_at ?? row?.seenAt)
  if (!unseen(row)) {
    const at = new Date(seenAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    return { none: false, seen: true, waiting: null, words: `Seen ${at}.` }
  }
  const mins = minutesSince(o.at, now)
  const at = new Date(o.at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  return {
    none: false, seen: false, waiting: mins,
    words: `Order sent ${at}. Not opened yet.`,
  }
}

/** Move one deal up or down in management's list. */
export function moveBy(ids: string[], id: any, step: number): string[] {
  const list = (ids || []).map(txt)
  const at = list.indexOf(txt(id))
  if (at < 0) return list
  const to = at + step
  if (to < 0 || to >= list.length) return list
  const out = list.slice()
  const [one] = out.splice(at, 1)
  out.splice(to, 0, one)
  return out
}

/** Pull one out of her queue and onto today, at the bottom. */
export function putOn(ids: string[], id: any): string[] {
  const list = (ids || []).map(txt)
  const one = txt(id)
  return !one || list.includes(one) ? list : [...list, one]
}

/** Take one off today again. It goes back to her queue, not away. */
export function takeOff(ids: string[], id: any): string[] {
  return (ids || []).map(txt).filter(x => x !== txt(id))
}
