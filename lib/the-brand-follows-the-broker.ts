// WHICH BRAND A DEAL IS ALLOWED TO GO OUT UNDER.
//
// 27 Oct 2026. Catherine, Operations Manager: "When Navigate is selected at the
// BC level, it switches back to Simplify Finance after moving on."
//
// She was right, and it was ours. On 23 Oct the lending options learned to pick
// a brand, and the line that did the picking was this:
//
//   brokersList.find(b => b.name === brokerSig)?.brandIds || ['simplify']
//
// Two different things are being compared there. The brand list holds FULL
// NAMES - "Justin Cornock". A deal holds a KEY - "justin". They are never
// equal, so the find returns nothing, the `|| ['simplify']` fires, every other
// brand is filtered out of the dropdown, and the rule that says a brand can
// never be blank then writes Simplify onto the deal. Silently.
//
// It only looked right when somebody had touched the broker dropdown by hand,
// because that writes a full name in. Nobody touches it on most deals.
//
// scripts/check-broker-keys.sh has warned about this exact mistake since
// September - "brokerKey() takes the FIRST WORD, so 'Fabio De Castro'
// .toLowerCase() never equals 'fabio'" - and did not catch it, because it looks
// for `assigned_broker ===` and this was spelled `b.name === brokerSig`.
// The guard is widened in the same commit as this file.
//
// THE RULE THAT MATTERS MOST HERE IS THE NEW ONE:
//
//   WHERE WE DO NOT KNOW WHICH BRANDS A BROKER HOLDS, WE DO NOT GUESS.
//
// The old fallback guessed Simplify. That is the worst possible guess, because
// it is the one that puts SIMPLIFY'S CREDIT LICENCE on another brand's client
// email, and it does it without anybody choosing. So an unknown broker is now
// offered every brand and nothing is ever written for them. A person picking
// the wrong brand is visible and fixable. The portal picking it is neither.

import { sameBroker } from './broker-key'

export type Brand = { id: string; name: string }

/** Both shapes: public.brokers rows, and the old settings.brokers list. */
export type BrokerRow = {
  name?: any
  broker_key?: any
  brokerKey?: any
  brand_ids?: any
  brandIds?: any
  active?: any
}

const list = (v: any): string[] | null =>
  Array.isArray(v) && v.length ? v.map(x => String(x)) : null

/** One shape, whichever table the rows came out of. */
export function normaliseBrokers(rows: any[]): { key: any; name: string; brands: string[] | null }[] {
  return (rows || [])
    .filter(r => r?.active !== false)
    .map(r => ({
      key: r?.broker_key ?? r?.brokerKey ?? r?.name,
      name: String(r?.name ?? '').trim(),
      brands: list(r?.brand_ids) ?? list(r?.brandIds),
    }))
}

/**
 * THE BRANDS THIS BROKER HOLDS, or null where we cannot tell.
 *
 * Null is a real answer and it is different from an empty list. It means
 * "nobody has told the portal", and the caller must not narrow anything on it.
 *
 * Matched on the key, then on the name, both through sameBroker() - so a deal
 * carrying "justin", a dropdown carrying "Justin Cornock" and a row keyed
 * "justin" are all one person, which is the whole fault being fixed.
 */
export function brandsHeldBy(rows: any[], who: any): string[] | null {
  const brokers = normaliseBrokers(rows)
  const hit = brokers.find(b => sameBroker(b.key, who))
    || brokers.find(b => sameBroker(b.name, who))
  if (!hit) return null
  return hit.brands
}

/**
 * WHAT THE DROPDOWN OFFERS.
 *
 * Where the broker is known, the brands they hold. Where they are not, every
 * brand - because offering one is a decision, and a decision made out of
 * ignorance is how a Navigate client got Simplify's licence on their email.
 */
export function brandsOffered(rows: any[], who: any, allBrands: Brand[]): Brand[] {
  const held = brandsHeldBy(rows, who)
  if (!held) return [...(allBrands || [])]
  const offered = (allBrands || []).filter(b => held.includes(String(b?.id)))
  // A broker holding a brand the register has never heard of would otherwise
  // be left with an empty dropdown and no way to send anything at all.
  return offered.length ? offered : [...(allBrands || [])]
}

/**
 * WHAT TO WRITE ONTO THE DEAL, or null to leave it exactly as it is.
 *
 * Only ever fills a blank, or corrects a brand the broker demonstrably cannot
 * use. It will not touch a brand somebody chose while we are unsure, which is
 * the behaviour that caused this.
 */
export function brandToSettleOn(
  rows: any[], who: any, allBrands: Brand[], current: any,
): string | null {
  const offered = brandsOffered(rows, who, allBrands)
  if (!offered.length) return null
  const now = String(current ?? '').trim()
  if (now && offered.some(b => String(b.id) === now)) return null
  // UNKNOWN BROKER, BRAND ALREADY CHOSEN: leave it. This single line is the
  // bug. It used to overwrite.
  if (now && brandsHeldBy(rows, who) === null) return null
  return String(offered[0].id)
}

/** Shown beside the dropdown when we are offering everything because we cannot tell. */
export function brandUncertainty(rows: any[], who: any): string {
  if (brandsHeldBy(rows, who) !== null) return ''
  const name = String(who ?? '').trim()
  return `No brands are recorded against ${name || 'this broker'}, so all of them are offered. `
    + `Check this is the right one before it goes out.`
}
