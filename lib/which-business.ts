// WHICH BUSINESS A DEAL BELONGS TO.
//
// Fabio, 17 Nov 2026: "the business is broken down by broker so Simplify
// Finance Mark Fabio Kylie, Simplify Finance Brokers Keanan Justin, and
// eventually more brokers."
//
// NOTHING NEW IS STORED FOR THIS. Settings already carries the brands, and
// Settings -> Broker profiles already ticks which brands each broker holds
// ("a broker can work under multiple brands"). This reads those two and
// nothing else, so a new business appears on the reports the moment somebody
// sets it up, with no ship.
//
// WHY THE BROKER AND NOT THE DEAL.
//
// A deal does carry a brand of its own, inside bc_data / lo_data. On 12 Nov
// every single lodged deal in the book read "simplify" - all 58 of them - and
// that is not because they were all Simplify Finance deals. It is the fault
// Catherine reported on 27 October: the old code matched a broker's full name
// against a deal's key, never matched, fell back to `|| ['simplify']`, and
// wrote Simplify onto the deal without anybody choosing it. See
// lib/the-brand-follows-the-broker.ts.
//
// So the stored brand is evidence of a bug, not of a business, and a report
// built on it would file another brand's clients under Simplify's licence.
// The brand ticks in Settings are the thing a person actually set.
//
// THE ORDER OF ANSWERS, AND WHERE IT STOPS.
//
//   1. The broker holds exactly one brand -> that one. Certain: if that is the
//      only brand they can write under, the deal cannot be anything else.
//   2. The broker holds two or more -> the deal's own brand, but only if it
//      names one of the brands they actually hold. This is the only case where
//      the deal is the sole signal, and the only case where the stored value
//      can change an answer.
//   3. Anything else -> NOT_SAID. Not Simplify. Guessing Simplify is the exact
//      mistake that caused this, and a deal in its own row saying nobody has
//      said is a thing somebody can go and fix.
//
// NOTHING IS EVER COUNTED TWICE. A broker who holds two brands appears under
// each business, with the deals that belong to each - never the same deal in
// both. The totals add up to the book.

// amountOf is the same figure the rest of the report uses, so a business
// total and a deal row can never disagree.
import { amountOf } from './deal-phase'
import { sameBroker } from './broker-key'
import { normaliseBrokers, type Brand } from './the-brand-follows-the-broker'
import type { Line2 } from './who-brought-us-this'

const txt = (v: any) => String(v ?? '').trim()

/** The heading for work whose business nobody has established. */
export const NOT_SAID = '__not_said__'
export const NOT_SAID_NAME = 'Nobody has said which business'

export type Business = {
  id: string
  name: string
  /** One line per broker, biggest first. */
  brokers: Line2[]
  lodged: number
  settled: number
  lodgedAmount: number
  settledAmount: number
}

/** The brand written on the deal itself, wherever the forms put it. */
export function brandOnDeal(deal: any): string {
  return txt(deal?.lo_data?.brandId)
    || txt(deal?.bc_data?.brand)
    || txt(deal?.brand_id)
}

/**
 * WHICH BUSINESS ONE DEAL BELONGS TO, or NOT_SAID.
 *
 * `brokerRows` is public.brokers, carrying broker_key, name and brand_ids.
 */
export function businessOfDeal(deal: any, brokerRows: any[]): string {
  const who = deal?.assigned_broker
  if (!txt(who)) return NOT_SAID

  const brokers = normaliseBrokers(brokerRows)
  const hit = brokers.find(b => sameBroker(b.key, who))
    || brokers.find(b => sameBroker(b.name, who))
  const held = hit?.brands

  // Nobody has told the portal which brands this broker holds.
  if (!held || held.length === 0) return NOT_SAID

  // One brand: the deal cannot be anything else.
  if (held.length === 1) return held[0]

  // Two or more: only the deal knows, and only if it names one they hold.
  const own = brandOnDeal(deal)
  return own && held.includes(own) ? own : NOT_SAID
}

const blank = (id: string, name: string): Business => ({
  id, name, brokers: [], lodged: 0, settled: 0, lodgedAmount: 0, settledAmount: 0,
})

/**
 * THE WHOLE REPORT, BUSINESS BY BUSINESS.
 *
 * Takes the per-broker lines byBroker() already produces and cuts each one by
 * business, so a broker working under two appears under both with the right
 * deals under each.
 *
 * `brands` is settings.brands. A brand with no name falls back to its id, and
 * a brand nobody has registered still gets a heading rather than vanishing -
 * work that exists is always shown.
 */
export function businessesOf(
  lines: Line2[], brokerRows: any[], brands: Brand[],
): Business[] {
  const nameOf = (id: string) =>
    txt((brands || []).find(b => txt(b?.id) === id)?.name) || id

  const out = new Map<string, Business>()
  const reach = (id: string) => {
    if (!out.has(id)) {
      out.set(id, blank(id, id === NOT_SAID ? NOT_SAID_NAME : nameOf(id)))
    }
    return out.get(id)!
  }

  for (const line of lines || []) {
    // One broker's deals, split into the businesses they were written under.
    const parts = new Map<string, Line2>()
    const put = (id: string, deal: any, which: 'lodged' | 'settled') => {
      if (!parts.has(id)) {
        parts.set(id, { ...line, lodged: [], settled: [], lodgedAmount: 0, settledAmount: 0 })
      }
      parts.get(id)![which].push(deal)
    }
    for (const d of line.lodged || []) put(businessOfDeal(d, brokerRows), d, 'lodged')
    for (const d of line.settled || []) put(businessOfDeal(d, brokerRows), d, 'settled')

    for (const [id, part] of parts) {
      // The money is re-added from the deals in THIS business, never copied
      // from the broker's line - that would count the other business's work.
      part.lodgedAmount = sum(part.lodged)
      part.settledAmount = sum(part.settled)
      const biz = reach(id)
      biz.brokers.push(part)
      biz.lodged += part.lodged.length
      biz.settled += part.settled.length
      biz.lodgedAmount += part.lodgedAmount
      biz.settledAmount += part.settledAmount
    }
  }

  for (const biz of out.values()) {
    biz.brokers.sort((a, b) =>
      b.lodged.length - a.lodged.length
      || b.settled.length - a.settled.length
      || a.name.localeCompare(b.name))
  }

  // Biggest business first, but "nobody has said" always last - it is a thing
  // to fix, not a business, and it should never head the page.
  return [...out.values()].sort((a, b) => {
    if (a.id === NOT_SAID) return 1
    if (b.id === NOT_SAID) return -1
    return b.lodged - a.lodged || b.settled - a.settled || a.name.localeCompare(b.name)
  })
}

function sum(deals: any[]): number {
  return (deals || []).reduce((t, d) => t + (amountOf(d) || 0), 0)
}

/** Both businesses added together. */
export function acrossAll(businesses: Business[]): {
  lodged: number; settled: number; lodgedAmount: number; settledAmount: number
} {
  return (businesses || []).reduce((t, b) => ({
    lodged: t.lodged + b.lodged,
    settled: t.settled + b.settled,
    lodgedAmount: t.lodgedAmount + b.lodgedAmount,
    settledAmount: t.settledAmount + b.settledAmount,
  }), { lodged: 0, settled: 0, lodgedAmount: 0, settledAmount: 0 })
}

/**
 * Shown under the headings when there is only one business set up, so nobody
 * thinks the split is broken. Empty once a second brand exists.
 */
export function oneBusinessOnly(businesses: Business[]): boolean {
  return (businesses || []).filter(b => b.id !== NOT_SAID).length <= 1
}
