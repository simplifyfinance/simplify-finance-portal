// ONE LIST, IN THE ORDER YOU CHOOSE TO DO IT.
//
// Alan's item 3. Fabio chose the shape on 11 Nov 2026: a credit officer's
// queue is their own allocated work, sorted by them - not the board with
// filters on it, and not a pool anybody can take from.
//
// THE BROKER'S ORDER IS A MARKER, NOT THE SORT. Fabio: "credit can re-order
// their own queue." So the broker's priority rides beside the deal, worth
// knowing and not an instruction. Two people may both have an opinion about
// what matters most; only one of them is doing the work.
//
// URGENT CARRIES ITS REASON OR IT DOES NOT EXIST. A red chip saying nothing is
// a chip everybody learns to scroll past, and then everything is urgent. And
// only whoever set it can take it off - Fabio, asked straight out - so credit
// cannot clear their own queue by unflagging it.
//
// A DEAL NOBODY CAN WORK DOES NOT SIT IN A QUEUE. When credit cannot action
// something they say why, and it goes back to the broker. That is the whole of
// what makes a queue mean anything.

import { STAGES, ownerOf, handOver, type Stage, STAGE_LABEL } from './who-did-this-stage'
import { reworkOn, type BackStage } from './send-it-back'

const txt = (v: any) => String(v ?? '').trim()
const DAY = 86_400_000

export { STAGE_LABEL }

function daysSince(at: any, now: Date): number | null {
  const t = txt(at)
  if (!t) return null
  const ms = new Date(t).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor((now.getTime() - ms) / DAY))
}

// --- urgent -------------------------------------------------------------------

export type Urgent = { at: string; by: string | null; byName: string; why: string }

export function urgentOn(deal: any): Urgent | null {
  const at = txt(deal?.urgent_at)
  if (!at) return null
  return {
    at,
    by: txt(deal?.urgent_by) || null,
    byName: txt(deal?.urgent_by_name),
    why: txt(deal?.urgent_why),
  }
}

/**
 * ONLY WHOEVER PUT IT ON.
 *
 * The person it was aimed at must not be able to make it go away. Where the
 * flag predates this and has no id on it, the name is the next best answer -
 * and a flag with neither can be cleared by anybody, because otherwise it is
 * on the deal for ever.
 */
export function mayClearUrgent(deal: any, me: { id?: string | null; name?: string }): boolean {
  const u = urgentOn(deal)
  if (!u) return false
  if (u.by) return u.by === txt(me?.id)
  if (u.byName) return u.byName.toLowerCase() === txt(me?.name).toLowerCase()
  return true
}

/** "Urgent — Jess Moreton, 2 days ago: the finance clause is Friday." */
export function urgentLine(deal: any, now: Date = new Date()): string {
  const u = urgentOn(deal)
  if (!u) return ''
  const when = agoWords(u.at, now)
  const who = u.byName ? ` ${u.byName}` : ''
  return `Urgent —${who}${when ? ', ' + when : ''}${u.why ? ': ' + u.why : ''}`
}

export function agoWords(at: any, now: Date = new Date()): string {
  const d = daysSince(at, now)
  if (d === null) return ''
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

/**
 * A REASON IS NOT OPTIONAL, AND ONE WORD IS NOT A REASON.
 *
 * Returns the problem to show, or '' where it is fine. The floor is low on
 * purpose - this is here to stop "asap", not to mark anybody's writing.
 */
export const URGENT_MIN = 10

export function validateUrgent(why: any): string {
  const t = txt(why)
  if (!t) return 'Say why this one jumps the queue.'
  if (t.length < URGENT_MIN) return 'A few more words — the person who picks this up has to act on it.'
  return ''
}

export function urgentPatch(me: { id?: string | null; name?: string }, why: string, now = new Date()) {
  return {
    urgent_at: now.toISOString(),
    urgent_by: txt(me?.id) || null,
    urgent_by_name: txt(me?.name) || null,
    urgent_why: txt(why),
  }
}

export const NOT_URGENT_PATCH = {
  urgent_at: null, urgent_by: null, urgent_by_name: null, urgent_why: null,
}

// --- cannot action this -------------------------------------------------------

export type Stuck = { at: string; byName: string; why: string }

export function stuckOn(deal: any): Stuck | null {
  const at = txt(deal?.stuck_at)
  if (!at) return null
  return { at, byName: txt(deal?.stuck_by_name), why: txt(deal?.stuck_why) }
}

// A COUPLE OF SENTENCES, AND NO LIST OF REASONS.
//
// Fabio, 11 Nov 2026: "don't want buttons just an explanation why deal is
// going back to broker, make field enough for a couple of sentences." A list
// of six chips is a list where everybody picks the first one, and the broker
// then rings up to ask what it meant.
export const STUCK_MIN = 25

export function validateStuck(why: any): string {
  const t = txt(why)
  if (!t) return 'Say what is stopping you, and what the broker needs to do.'
  if (t.length < STUCK_MIN) return 'A couple of sentences — enough that nobody has to ring you about it.'
  return ''
}

/**
 * It leaves credit's queue and lands on the broker's, with the words attached.
 *
 * The stage is handed to the broker rather than a new flag being invented:
 * every screen in this portal already reads who owns a stage, so one write
 * moves the deal everywhere at once.
 */
export function stuckPatch(
  deal: any, stage: Stage, me: { name?: string }, why: string, now = new Date(),
): Record<string, any> {
  return {
    ...handOver(stage, { officerId: null, name: txt(deal?.assigned_broker) }, now),
    stuck_at: now.toISOString(),
    stuck_by_name: txt(me?.name) || null,
    stuck_why: txt(why),
  }
}

/** Cleared the moment somebody picks it up again - it is not a badge. */
export const UNSTUCK_PATCH = { stuck_at: null, stuck_by_name: null, stuck_why: null }

// --- WHOSE STAGE IS THIS ------------------------------------------------------
//
// THE QUEUE THAT USED TO LIVE HERE IS GONE. 12 Nov 2026. Fabio: "my work, I
// don't like it... let's remove that and it's today."
//
// It was Today twice. myWork(), sortQueue(), orderAfterMove() and the
// broker-place wording built a second, permanent ordering of the same deals
// Today already orders - and the two did not agree on whose deal it was. A
// second answer to one question is the thing this portal keeps getting bitten
// by, so it is deleted rather than left sitting here for somebody to wire up.
//
// What stays is what the DEAL PAGE uses: urgent with a reason, "credit cannot
// action this", and the one function below.

/**
 * THE STAGE THIS OFFICER HAS OPEN ON THIS DEAL, OR NULL.
 *
 * FINISHED HERE MEANS SHE FINISHED IT, which is not what stageIsDone() means.
 * The portal closes a BC when the CLIENT agrees to it - see BEADS in
 * lib/deal-status.ts, "closed by the client agreeing, not by the credit
 * officer finishing" - and that is the right rule for the bar across the top
 * of a deal.
 *
 * It is the wrong rule for a queue. A BC she wrote on Monday would sit in her
 * list until the client got round to pressing proceed, so her work would read
 * as outstanding for days after she had done it, and the one number a queue
 * exists to show - what is waiting on me - would be wrong every time.
 *
 * So this asks her own stamp. 11 Nov 2026.
 */
export function stageFor(deal: any, officerId: string): Stage | null {
  for (const s of STAGES) {
    if (txt(deal?.[`${s}_completed_at`])) continue
    const o = ownerOf(deal, s)
    if (o?.officerId && o.officerId === txt(officerId)) return s
  }
  return null
}
