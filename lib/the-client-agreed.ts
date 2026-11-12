// THE CLIENT AGREED, SAID WHERE A BROKER READS IT.
//
// Fabio, 12 Nov 2026: "brokers are saying it's not clear the client agreed and
// pressed buttons to proceed."
//
// They were right, and nothing was missing from the database. The portal has
// recorded who pressed Proceed since 2 Oct - proceeded_source tells a client
// apart from the office, proceeded_by names the person where it was the
// office. proceedCredit() in lib/deal-status.ts has read it back the whole
// time.
//
// IT WAS SHOWN IN EXACTLY ONE PLACE: inside the BC tab, and inside the LO tab.
// To learn that a client had agreed, a broker had to open the deal and then
// click into the stage they had already finished with. Nobody does that. So
// the only thing a broker actually saw was a stage bead turning green, which
// looks identical whether the client agreed or somebody in the office moved it
// by hand.
//
// AND THE EMAIL DID NOT SAY IT EITHER. The subject read "<deal> has moved to
// Lending Options" - the filing, not the news. See notifyBrokerOfProgress.
//
// IT DROPS OFF AT LODGEMENT. Fabio, same day: "when we lodge drop it." By then
// the deal is with the bank, the written half of the bar folds away, and the
// client agreeing is history rather than something anybody is about to act on.
// The record itself is untouched - the columns keep it, the BC and LO tabs
// still show it, and the deal file still carries the line. This is only about
// the strip at the top of a live deal.

import { toAuDate } from './periods'

const txt = (v: any) => String(v ?? '').trim()

export type AgreedStage = 'BC' | 'LO'

export type Agreed = {
  stage: AgreedStage
  /** "The client agreed to proceed", or "The client chose ANZ". */
  what: string
  /** "Tuesday 11 November". */
  day: string
  /** "from their own page", or "recorded by Kylie". */
  how: string
  /** "BC · 4 days ago". */
  aside: string
  /** True only where the client pressed it themselves. */
  byClient: boolean
}

/** Sydney, never the server's clock. A lodgement day taught us that once. */
function dayWords(ts: any): string {
  const d = txt(ts)
  if (!d) return ''
  const parsed = new Date(d)
  if (isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-AU',
    { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Sydney' })
}

function daysAgo(ts: any, now: Date): number | null {
  const then = toAuDate(txt(ts) || null)
  const today = toAuDate(now.toISOString())
  if (!then || !today) return null
  const a = Date.parse(`${then}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  if (isNaN(a) || isNaN(b)) return null
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export function agoWords(n: number | null): string {
  if (n === null) return ''
  if (n === 0) return 'today'
  if (n === 1) return 'yesterday'
  return `${n} days ago`
}

/**
 * HOW IT WAS RECORDED, IN WORDS A BROKER CAN ACT ON.
 *
 * "from their own page" is the sentence that matters. It is the difference
 * between the client agreeing and the office deciding they had, and the portal
 * has always known which it was.
 */
function howWords(source: any, by: any): string {
  const s = txt(source)
  if (s === 'client') return 'from their own page'
  if (s === 'office') {
    const name = txt(by)
    return name ? `recorded by ${name}` : 'recorded by our office'
  }
  return 'recorded before we started tracking who pressed it'
}

/**
 * THE LINE AT THE TOP OF A LIVE DEAL, or null where there is nothing to say.
 *
 * Null once the deal has lodged, and null where no stage has been proceeded.
 * Where both stages have, the LATER one wins - a broker opening a deal wants
 * the most recent thing the client did, not the first.
 */
export function clientAgreed(deal: any, now: Date = new Date()): Agreed | null {
  if (!deal) return null
  // DROPS OFF AT LODGEMENT. The deal is with the bank now.
  if (txt(deal.lodged_at)) return null

  const rows: Array<{ stage: AgreedStage; at: string; source: any; by: any; lender: string }> = []

  if (deal.client_proceeded && txt(deal.proceeded_at)) {
    rows.push({
      stage: 'BC', at: txt(deal.proceeded_at),
      source: deal.proceeded_source, by: deal.proceeded_by, lender: '',
    })
  }
  if (deal.lo_client_proceeded && txt(deal.lo_proceeded_at)) {
    rows.push({
      stage: 'LO', at: txt(deal.lo_proceeded_at),
      source: deal.lo_proceeded_source, by: deal.lo_proceeded_by,
      lender: txt(deal.lo_proceeded_lender),
    })
  }
  if (!rows.length) return null

  rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const hit = rows[0]

  // THE BANK IS THE NEWS ON A LENDING OPTIONS. "The client agreed to proceed"
  // is true and tells a broker nothing they could not guess; the bank is the
  // thing they need before they ring.
  const what = hit.lender
    ? `The client chose ${hit.lender}`
    : 'The client agreed to proceed'

  const n = daysAgo(hit.at, now)
  const ago = agoWords(n)

  return {
    stage: hit.stage,
    what,
    day: dayWords(hit.at),
    how: howWords(hit.source, hit.by),
    aside: ago ? `${hit.stage} · ${ago}` : hit.stage,
    byClient: txt(hit.source) === 'client',
  }
}

/**
 * THE SUBJECT LINE THE BROKER SEES.
 *
 * It used to be "<deal> has moved to Lending Options", which is the filing and
 * not the news - and reads exactly like somebody in the office moved it, which
 * is what the brokers said. The client's action goes first; the stage change
 * belongs in the body, where it always did.
 */
export function brokerSubject(dealName: any, lender?: any): string {
  const name = txt(dealName) || 'A deal'
  const bank = txt(lender)
  return bank
    ? `The client chose ${bank} — ${name}`
    : `The client agreed to proceed — ${name}`
}
