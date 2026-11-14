// WHAT THE DOCUMENTS BOX KNOWS AND HAS NEVER SAID.
//
// 11 Nov 2026. Fabio, on Ian Davies' deal: "why I can't click docs to request???"
//
// The button was right. Everything on that list had already been asked for on
// 9 November, and two rows had been unticked by hand - so there was nothing to
// send, and the portal said nothing at all. A grey button with no sentence
// under it is a question somebody has to ask a colleague.
//
// Everything here is a sentence built from what the record already holds.
// Nothing new is stored except who a round went to and whether anybody has
// chased - see lib/document-progress.ts.

import { type DocRow } from './document-progress'
import { OFFICE } from './same-date-everywhere'

const txt = (v: any) => String(v ?? '').trim()

/**
 * WHY THE BUTTON IS OFF, IN ONE SENTENCE, OR '' WHERE IT IS ON.
 *
 * Three reasons, and it names the one that applies rather than the first one
 * somebody thought of.
 */
export function whyNotRequestable(rows: DocRow[], covered: Set<string>): string {
  const list = rows || []
  if (list.length === 0) return 'There is nothing on the list yet.'
  const ticked = list.filter(r => r.ticked)
  if (ticked.length === 0) {
    return 'Nothing is ticked. Tick what the client has to send and it will go.'
  }
  const wanted = ticked.filter(r => !r.requestedAt && !(r as any).askFirst)
  if (wanted.length === 0) {
    const out = list.filter(r => r.requestedAt && !r.receivedAt).length
    return out > 0
      ? `Everything ticked has already been asked for. Tick something that has not, or chase the ${out} still out.`
      : 'Everything ticked has already been asked for.'
  }
  if (wanted.every(r => covered.has(r.key))) {
    return 'What is left is already covered by the bank statements on file.'
  }
  return ''
}

/**
 * WHY THIS DOCUMENT IS ON THE LIST.
 *
 * A few rules write their own reason - see `why` in lib/document-rules.ts -
 * and those are the ones where the name does not explain itself. The rest get
 * the two facts the row always carries: whose it is and what it is for. That
 * is thinner than a sentence somebody wrote, and it is true, which a generated
 * one would not reliably be.
 */
export function whyOnTheList(row: any): string {
  const written = txt(row?.why)
  if (written) return written
  const who = txt(row?.groupLabel)
  const forWhat = FOR_WORDS[txt(row?.forWhat)] || ''
  if (who && forWhat) return `${who} — ${forWhat}`
  return forWhat || who || ''
}

const FOR_WORDS: Record<string, string> = {
  lodge: 'needed before this can be lodged',
  compliance: 'needed for the compliance file',
  settlement: 'needed before settlement',
}

/** "Asked 9 Nov by Mellissa Sedin · waiting 2 days", or what happened instead. */
export function trailFor(row: any, now: Date = new Date()): string {
  const r = row || {}
  if (r.receivedAt) {
    const by = txt(r.receivedBy)
    return `Arrived ${dayWords(r.receivedAt)}${by ? ', marked by ' + by : ''}.`
  }
  if (r.requestedAt) {
    const days = daysBetween(r.requestedAt, now)
    const waited = days === null ? '' : days === 0 ? ' · asked today'
      : ` · waiting ${days} ${days === 1 ? 'day' : 'days'}`
    return `Asked ${dayWords(r.requestedAt)}${waited}`
  }
  // UNTICKED IS A DECISION, NOT AN OVERSIGHT, and it carries the name of
  // whoever made it. Without that the next person ticks it straight back.
  if (!r.ticked && txt(r.decidedBy)) {
    return `Taken off the list by ${txt(r.decidedBy)} — never asked for.`
  }
  if (!r.ticked) return 'Not on the request.'
  return 'Ticked, not asked for yet.'
}

export function dayWords(at: any): string {
  const d = new Date(txt(at))
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', { timeZone: OFFICE, day: 'numeric', month: 'short' })
}

export function timeWords(at: any): string {
  const d = new Date(txt(at))
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-AU', { timeZone: OFFICE,
    day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true,
  }).replace(/\s?(am|pm)/i, (m) => m.toLowerCase().trim())
}

export function daysBetween(at: any, now: Date = new Date()): number | null {
  const d = new Date(txt(at))
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000))
}

export function agoWords(at: any, now: Date = new Date()): string {
  const d = daysBetween(at, now)
  if (d === null) return ''
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

/** The line that sits folded above the rounds. */
export function askedSummary(
  rounds: Array<{ at: string; by: string }>, chasedAt: any, back: number, sent: number,
  now: Date = new Date(),
): string {
  if (!rounds.length) return 'Nobody has asked for anything yet.'
  const last = rounds[rounds.length - 1]
  const who = txt(last.by)
  const chased = txt(chasedAt)
    ? `Last chased ${agoWords(chasedAt, now)}.`
    : 'Never chased.'
  return `Last on ${timeWords(last.at)}${who ? ' by ' + who : ''} — `
    + `${sent} ${sent === 1 ? 'document' : 'documents'}, ${back} back. ${chased}`
}
