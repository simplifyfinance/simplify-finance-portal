// ONE ASK EACH, PER BROKER, PER DAY.
//
// 27 Oct 2026. Catherine, Operations Manager, item 2 of nine: "When Mark and
// Kylie reprioritise, other brokers' deals, like Justin's, keep getting pushed
// back. Possibly a queuing system?"
//
// THE PORTAL HAD NO PRIORITY AT ALL. lib/the-days-plan.ts has read a
// `priority` field since the day's plan was built and nothing has ever written
// one. What Catherine is describing happens in email, which is precisely why
// whoever chases hardest wins.
//
// AND BUILDING IT THE OBVIOUS WAY WOULD MAKE IT WORSE. Let every broker mark
// what they like and sort by who asked first, and Mark's three asks sit at the
// top of Katie's day in writing instead of in her inbox. Same outcome, now
// official.
//
// ONE SLOT EACH. Fabio's call, asked directly: a broker may mark one deal a
// day. Credit's day takes one from each broker in the order they asked, then
// comes back round. Mark still goes first because he asked first - he does not
// get three in a row.
//
//   first come first served    a slot each
//   Mark, Mark, Mark, Kylie    Mark, Justin, Kylie, Mark
//   Justin chases to be seen   Justin does not have to
//
// A REASON IS REQUIRED. A mark with no reason is just volume, and a credit
// assessor looking at three of them cannot tell which is real. Same rule as
// the handover box and the rework box.
//
// This file is arithmetic and no database, so all of it is tested without one.

import { brokerKey } from './broker-key'
import { todayYmd } from './periods'

const txt = (v: any) => String(v ?? '').trim()

export type Ask = {
  /** The broker key - lower case, never shown. See lib/broker-key.ts. */
  by: string
  why: string
  at: string
  /** The Sydney day this ask is for. */
  day: string
}

/** The live ask on a deal, or null. Yesterday's is not live. */
export function askOn(deal: any, day: string = todayYmd()): Ask | null {
  const by = brokerKey(deal?.priority_by)
  if (!by) return null
  const on = txt(deal?.priority_day)
  // A SLOT RESETS OVERNIGHT whether or not it was used. Without this, an ask
  // from last Tuesday sits at the top of somebody's day forever and the whole
  // list silently stops being about today.
  if (!on || on.slice(0, 10) !== day) return null
  return { by, why: txt(deal?.priority_why), at: txt(deal?.priority_at), day: on.slice(0, 10) }
}

export type AskInput = { by: string; why: string }

export function validateAsk(input: Partial<AskInput>): string {
  if (!brokerKey(input?.by)) return 'No broker to ask on behalf of'
  if (txt(input?.why).length < 10) {
    return 'Say why this one first — the person doing it reads this'
  }
  return ''
}

/** What goes on the deal when a broker asks for it next. */
export function askPatch(input: AskInput, now: Date = new Date(), day: string = todayYmd()) {
  return {
    priority_by: brokerKey(input.by),
    priority_why: txt(input.why),
    priority_at: now.toISOString(),
    priority_day: day,
  }
}

/** What goes on the deal a broker is moving their slot OFF. */
export function clearAskPatch() {
  return { priority_by: null, priority_why: null, priority_at: null, priority_day: null }
}

/**
 * THE ONE THEY ALREADY ASKED FOR TODAY, if any.
 *
 * Asking for a second deal does not fail - it MOVES the slot, and the screen
 * says which file it is coming off before it does. A broker who has changed
 * their mind at eleven o'clock is the normal case, not an error.
 */
export function alreadyAsked(deals: any[], by: any, day: string = todayYmd()): any | null {
  const me = brokerKey(by)
  if (!me) return null
  return (deals || []).find(d => {
    const a = askOn(d, day)
    return a && a.by === me
  }) || null
}

// ---------------------------------------------------------------------------
// THE ORDER
// ---------------------------------------------------------------------------

export type HasAsk = { id: string; ask?: Ask | null }

const when = (v: any) => (v ? new Date(v).getTime() : 0)

/**
 * ONE FROM EACH BROKER, THEN ROUND AGAIN.
 *
 * Brokers are served in the order they asked - whoever asked first takes the
 * first slot of every round. Within one broker, their own asks keep the order
 * they made them.
 *
 * With one slot a day there is one each and this is a straight interleave. It
 * is written as a full round-robin anyway because the slot count is a rule and
 * rules move: if a broker is ever given two, this still shares the top of the
 * day out rather than handing it to whoever typed fastest.
 */
export function interleaveByBroker<T extends HasAsk>(items: T[]): T[] {
  const asked = (items || []).filter(i => i.ask)
  if (asked.length < 2) return [...asked]

  const byBroker = new Map<string, T[]>()
  for (const i of asked) {
    const k = i.ask!.by
    byBroker.set(k, [...(byBroker.get(k) || []), i])
  }
  // Each broker's own asks, oldest first.
  for (const [k, list] of byBroker) {
    byBroker.set(k, [...list].sort((a, b) => when(a.ask!.at) - when(b.ask!.at)))
  }
  // And the brokers themselves, by who got in first.
  const order = [...byBroker.entries()]
    .sort((a, b) => when(a[1][0].ask!.at) - when(b[1][0].ask!.at))
    .map(([k]) => k)

  const out: T[] = []
  for (let round = 0; ; round++) {
    let took = false
    for (const k of order) {
      const list = byBroker.get(k)!
      if (round < list.length) { out.push(list[round]); took = true }
    }
    if (!took) break
  }
  return out
}

/** Who asked, in words, for the chip on credit's day. */
export function askChip(ask: Ask | null, name?: string): string {
  if (!ask) return ''
  return `${(name || ask.by).toUpperCase()} ASKED FOR THIS`
}
