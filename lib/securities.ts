// WHICH HOUSES THE LOAN IS SECURED BY.
//
// 12 Oct 2026. Fabio: "I can add multiple splits but I want the ability of
// adding multiple securities ... ensure carries to LO and Compliance".
//
// A complex refinance could already name a property on each split - but by
// TYPING IT. The box offered the fact find's addresses as suggestions and then
// saved whatever was typed, so "12 Smith St" and "12 Smith Street" became two
// properties, two limits, and two cards in the client email for one house. A
// split with the box left blank pointed at nothing and dropped out of the
// grouping without a word.
//
// AND NOTHING RECORDED WHICH PROPERTIES WERE SECURITY AT ALL. A client with
// five on the fact find and three as security had no field saying so, which is
// why the real LVR - lending over TOTAL security - could not be worked out.
//
// THE PIECES ALREADY EXISTED. The fact find holds every property with an id, an
// address, a value, its use and its subtype. This file joins them up:
//
//   bc_data.securityIds      which of those properties are security
//   bc_data.securityLimits   the limit approved against each, by id
//   split.securityId         which one a split sits against, by id
//
// BY ID, NEVER BY ADDRESS. That is the whole fix. An id cannot be spelled two
// ways, renaming a property does not orphan its splits, and the value shown is
// always the fact find's current one rather than a copy that went stale.
//
// WHAT IS NOT HERE. No figure is invented and nothing is auto-corrected. A
// deal recorded before today keeps its typed addresses - see legacyMatch at the
// foot, which links only an EXACT match and leaves everything else for a person
// to decide.

import { readMoney, money } from './money'
import { isTopUp, lendingAgainst } from './top-up'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any): number => readMoney(v) || 0

// --- what the fact find already holds ---------------------------------------

export type FactFindProperty = {
  id?: string
  address?: string
  ownershipType?: string
  propertySubtype?: string
  value?: string
  rpDataEstimatedValue?: string
  loans?: any[]
}

export function ffProperties(ff: any): FactFindProperty[] {
  return Array.isArray(ff?.properties) ? ff.properties.filter((p: any) => p && txt(p.id)) : []
}

// --- a security -------------------------------------------------------------

export type Security = {
  id: string
  address: string
  // Owner occupied or investment. A PROPERTY OF THE HOUSE, not of the loan
  // against it - which is why it is read here rather than asked again on the
  // split. Recorded twice is how the two end up disagreeing.
  use: string
  subtype: string
  // The fact find's figure, read live. Never copied onto the BC: a value that
  // is corrected on the fact find must not leave a stale number in the LVR.
  value: string
  // Typed on the BC. Blank is legitimate - plenty of deals are drawn to the
  // limit and there is nothing extra approved.
  limit: string
}

export function securityIdsOf(bc: any): string[] {
  return Array.isArray(bc?.securityIds) ? bc.securityIds.map(txt).filter(Boolean) : []
}

export function isSecurity(bc: any, id: any): boolean {
  return securityIdsOf(bc).includes(txt(id))
}

export function limitOf(bc: any, id: any): string {
  const limits = bc?.securityLimits
  const typed = limits && typeof limits === 'object' ? txt(limits[txt(id)]) : ''
  if (typed) return typed

  // A TOP UP HAS A LIMIT WHETHER OR NOT ANYBODY TYPED ONE. 20 Oct 2026.
  //
  // On a top up the lending against a security is what is owed now plus the
  // increase - $500,000 + $300,000 - and it is known the moment those two
  // boxes are filled in. Leaving it blank until somebody also types a limit
  // would make lvrOf return null, so the screen would show no LVR at all on a
  // deal whose whole point is the LVR.
  //
  // THE TYPED BOX STILL WINS, above, because a lender may approve a limit
  // higher than the two added up and that is a real thing to record.
  //
  // This is the one place it belongs: lvrOf, totalsOf, the deal structure
  // strip and lib/commission.ts all read this function, and a second answer
  // anywhere else is how one screen ends up disagreeing with another.
  if (isTopUp(bc?.template)) {
    const lending = lendingAgainst(bc, txt(id))
    return lending > 0 ? String(lending) : ''
  }
  return ''
}

// THE SECURITIES ON THIS DEAL, IN FACT FIND ORDER.
//
// Ticked ids that no longer match a property are dropped rather than drawn as a
// blank row: a property deleted off the fact find is not a security with no
// name, it is not a security.
export function securitiesOf(bc: any, ff: any): Security[] {
  const ids = new Set(securityIdsOf(bc))
  return ffProperties(ff).filter(p => ids.has(txt(p.id))).map(p => ({
    id: txt(p.id),
    address: txt(p.address),
    use: txt(p.ownershipType),
    subtype: txt(p.propertySubtype),
    // The applicant's own estimate is the figure the rest of the portal uses;
    // the RP Data one is a cross-check and only stands in when there is nothing
    // else, so a security is never valued at nothing when a number exists.
    value: txt(p.value) || txt(p.rpDataEstimatedValue),
    limit: limitOf(bc, p.id),
  }))
}

// --- what it is worth and what is against it --------------------------------

// ONE SECURITY'S LVR, or null when it cannot be worked out.
//
// Null rather than zero. Zero is a number somebody will read as "no debt", and
// a missing value is not a low LVR - it is an unanswered question.
export function lvrOf(s: { value?: any; limit?: any }): number | null {
  const v = num(s?.value)
  const l = num(s?.limit)
  if (v <= 0 || l <= 0) return null
  return (l / v) * 100
}

export type Totals = { value: number; limit: number; lvr: number | null; valuedAll: boolean }

// ACROSS EVERY SECURITY, which is the figure a lender actually assesses on a
// multi-security deal and the one the portal could not produce before.
export function totalsOf(securities: Security[]): Totals {
  const list = Array.isArray(securities) ? securities : []
  const value = list.reduce((t, s) => t + num(s.value), 0)
  const limit = list.reduce((t, s) => t + num(s.limit), 0)
  return {
    value, limit,
    lvr: value > 0 && limit > 0 ? (limit / value) * 100 : null,
    // WHETHER THE TOTAL CAN BE TRUSTED. One security with no value makes the
    // total security figure too low and the LVR too high, so the screen must be
    // able to say so rather than printing a number that looks precise.
    valuedAll: list.length > 0 && list.every(s => num(s.value) > 0),
  }
}

// --- the splits against each one --------------------------------------------

export type Grouped = { security: Security; splits: any[]; drawn: number; undrawn: number }

const realOnes = (splits: any): any[] =>
  (Array.isArray(splits) ? splits : []).filter(s => num(s?.amount) > 0)

export function splitSecurityId(split: any): string {
  return txt(split?.securityId)
}

export function groupBySecurity(splits: any, securities: Security[]): Grouped[] {
  const rows = realOnes(splits)
  return (securities || []).map(security => {
    const mine = rows.filter(s => splitSecurityId(s) === security.id)
    const drawn = mine.reduce((t, s) => t + num(s.amount), 0)
    const lim = num(security.limit)
    return { security, splits: mine, drawn, undrawn: lim > drawn ? lim - drawn : 0 }
  })
}

// THE HOUSE THAT IS NOT BOUGHT YET.
//
// 15 Oct 2026. Fabio, on an equity release and purchase with two securities:
// "the deal structure is not allocating the new loan to the TBA security (new
// security) hence why you are getting all this issues."
//
// He had it exactly. The Security dropdown offered only the two houses on the
// fact find, so the $438,000 New purchase split had to sit against one of them.
// It landed on Alter Street, which then carried $506,000 + $290,000 + $438,000
// against a $995,000 value and printed 124% - a number that is not true about
// any property on the deal, and which every figure downstream then inherited.
//
// The property being purchased is real lending and is not any of those houses.
// It is also not an orphan - an orphan is money nobody has thought about, and
// this is money with a house that does not exist yet.
//
// A RESERVED ID RATHER THAN A ROW. There is nothing on the fact find to point
// at and inventing a property there would put a phantom house on the client's
// record. The id is reserved, it matches no security, so it is excluded from
// every property's LVR for free.
export const BEING_PURCHASED = 'being-purchased'

export const BEING_PURCHASED_LABEL = 'The property being purchased (TBA)'

export function isBeingPurchased(split: any): boolean {
  return splitSecurityId(split) === BEING_PURCHASED
}

// A SCENARIO THAT REFINANCES HOUSES AND BUYS ONE. The only shape where a
// security list needs a row for a property nobody owns yet. Named here rather
// than asked as "which template is this" on four screens.
//
// TOP UP + PURCHASE IS THE SAME SHAPE AND WAS LEFT OFF. 20 Oct 2026. Fabio:
// "ensure you are doing the same work for top + purchase". The top up half was
// finished and this list was not touched, so on that template the house being
// bought got no row: no value, no LVR of its own, and nothing to pick in the
// Security dropdown. The purchase loan then had to be parked on one of the
// houses being topped up - which is the Alter Street fault of 15 Oct exactly,
// where one property carried three loans and printed 124%.
const BUYS_AND_REFINANCES = ['investment_equity', 'top_up_purchase']

export function canBuyAndRefinance(template: any): boolean {
  return BUYS_AND_REFINANCES.includes(txt(template))
}

/** The lending that sits against the house nobody has bought yet. */
export function purchaseLending(splits: any): number {
  return realOnes(splits).filter(isBeingPurchased).reduce((t, s) => t + num(s.amount), 0)
}

// THE LOAN THAT BUYS THE NEW HOUSE, FOUND THE SAME WAY EVERYWHERE.
//
// 16 Oct 2026. Three screens wanted this number and each worked it out
// differently. lib/lo-purchase-block.ts looked for a split labelled "New
// purchase". The LVR box on the lending options used d.loanAmount - the WHOLE
// deal - over the purchase price, and printed 265% on a deal buying a $700,000
// property with $1,855,000 of lending across four splits. The compliance pack
// used a third answer again.
//
// THE TAG BEATS THE LABEL. A split pointed at the property being purchased says
// so by its securityId; a label is what somebody typed. The label is still read
// second, because every deal recorded before BEING_PURCHASED existed has only
// that.
export function purchaseLoanOf(bc: any): number {
  const splits = Array.isArray(bc?.splits) ? bc.splits : []
  const tagged = purchaseLending(splits)
  if (tagged > 0) return tagged
  const named = splits.find((x: any) => /new purchase/i.test(txt(x?.label)))
  return num(named?.amount)
}

export function purchasePriceOf(bc: any): string {
  return txt(bc?.newPurchasePrice) || txt(bc?.purchasePrice)
}

// THE HOUSE BEING BOUGHT, AS A SECURITY ROW LIKE ANY OTHER.
//
// 16 Oct 2026. BEING_PURCHASED was a reserved id and nothing more, so it could
// be chosen on the BC and nowhere else. The lending options Security dropdown
// offered only the ticked fact find properties, which left a broker buying a
// house with two bad options: hang the purchase loan on one of the properties
// being refinanced - Fabio did, and Alter Street printed 125% - or create a
// property on the fact find called "TBA", which puts a house that does not
// exist on the client's permanent record.
//
// So the purchase becomes a row. Every screen that works off a list of
// securities - the dropdown, the grouped splits, the per-property LVR, the
// totals - then handles it without knowing anything new.
//
// ONLY WHERE THERE IS SOMETHING TO BUY. A refinance has no purchase row, and a
// straight purchase has one security which is the house, so this is for the
// scenarios that do both.
//
// ITS VALUE IS THE PURCHASE PRICE, which is what a lender lends against before
// there is a valuation, and its limit is the loan that buys it. Neither is
// invented: both are already on the BC.
export function securitiesWithPurchase(bc: any, ff: any): Security[] {
  const real = securitiesOf(bc, ff)
  // NOTHING TICKED MEANS THIS LIST IS NOT IN USE ON THIS DEAL, and a list
  // holding only the house being bought is not a security list - it is the
  // deal. Every caller has an older path for that case which already counts
  // the purchase AND the properties being refinanced off the fact find; adding
  // a row here makes those callers stop early and lose the rest.
  //
  // Caught by lib/box-security.test.ts before this shipped: a deal with one
  // refinanced house and a $780,000 purchase went from $1,830,000 of security
  // to $780,000, which would have raised its LVR instead of correcting it.
  if (real.length === 0) return real
  if (!canBuyAndRefinance(bc?.template)) return real
  const price = purchasePriceOf(bc)
  const loan = purchaseLoanOf(bc)
  if (num(price) <= 0 && loan <= 0) return real
  return [...real, {
    id: BEING_PURCHASED,
    address: BEING_PURCHASED_LABEL,
    use: '', subtype: '',
    value: price,
    limit: loan > 0 ? String(loan) : '',
  }]
}

// THE SPLITS THAT POINT AT NOTHING, WHICH ARE THE DANGEROUS ONES.
//
// A split with no security, or one whose security has been unticked, is money
// in the structure that no property is carrying. It used to disappear from the
// grouping in silence. Named here so a screen can say so out loud.
export function orphanSplits(splits: any, securities: Security[]): any[] {
  const have = new Set((securities || []).map(s => s.id))
  // The property being purchased is NOT an orphan. It has been thought about;
  // it just has no address yet. Flagging it would train somebody to ignore the
  // warning on the deals where it means something.
  return realOnes(splits).filter(s => !isBeingPurchased(s) && !have.has(splitSecurityId(s)))
}

// WHAT IS ACTUALLY LENT AGAINST EACH HOUSE, AND WHAT THAT MAKES ITS LVR.
//
// 16 Oct 2026. Fabio, reading a compliance note that said the clients were
// borrowing "$1,855,000 ... against TBA - TBA, 10/5 Kinsellas Road and 15/15
// Alter St - a loan to value ratio of 73.5%": "on compliance notes when
// multiple properties I want the breakdown per property not combined."
//
// One ratio across three houses is a number no credit assessor can act on. It
// does not say which property is at 80% and which is at 64%, and those are the
// facts a lender's policy is actually written against.
//
// THE SPLITS ARE THE ANSWER, THE TYPED LIMIT IS THE FALLBACK. Every split
// carries the security it sits against, so what is lent on a house is the sum
// of its splits. securityLimits is almost never filled in - that is what sent
// every LVR on the Veljovic deal to a dash on 13 Oct - so it comes second.
export type Position = { security: Security; lending: number; lvr: number | null }

export function positionsOf(securities: Security[], splits: any): Position[] {
  const rows = realOnes(splits)
  return (securities || []).map(security => {
    const drawn = rows
      .filter(s => splitSecurityId(s) === security.id)
      .reduce((t, s) => t + num(s?.amount), 0)
    const lending = drawn > 0 ? drawn : num(security.limit)
    const value = num(security.value)
    return {
      security, lending,
      lvr: value > 0 && lending > 0 ? Math.round((lending / value) * 1000) / 10 : null,
    }
  })
}

// ONE PROPERTY, IN A SENTENCE A CREDIT ASSESSOR READS.
//
// Nothing is skipped quietly: a house with no value says so, and a house
// carrying no lending says that too, because on a multi-security deal both are
// questions somebody has to answer before submission.
export function positionLine(p: Position): string {
  const use = p.security.use.toLowerCase()
  const bits = [
    use || '',
    num(p.security.value) > 0 ? `valued at ${money(p.security.value)}` : 'no value recorded',
    p.lending > 0 ? `lending of ${money(p.lending)} against it` : 'no lending recorded against it',
    p.lvr === null ? '' : `a loan to value ratio of ${pct(p.lvr)}`,
  ].filter(Boolean)
  return `${p.security.address || 'Address not recorded'} \u2014 ${bits.join(', ')}.`
}

// --- saying it ---------------------------------------------------------------

export function pct(n: number | null): string {
  return n === null ? '' : `${n.toFixed(1).replace(/\.0$/, '')}%`
}

// THE SECURITY PARAGRAPH, ASSEMBLED RATHER THAN TYPED.
//
// Compliance held ONE security address and a free-text comment box, so three
// houses went in as prose, written out by hand, every time. Every figure below
// comes off the securities table; the only words are the joining ones.
export function securityLines(securities: Security[]): string[] {
  return (securities || []).map(s => {
    const bits = [s.use.toLowerCase(), s.subtype.toLowerCase()].filter(Boolean).join(', ')
    const valued = num(s.value) > 0 ? `valued ${money(s.value)}` : 'no value recorded'
    const l = lvrOf(s)
    const lim = num(s.limit) > 0
      ? `Limit ${money(s.limit)}${l === null ? '' : ` (${pct(l)} LVR)`}.`
      : 'No limit recorded.'
    return `${s.address || 'Address not recorded'} — ${bits || 'use not recorded'}, ${valued}. ${lim}`
  })
}

export function totalLine(t: Totals): string {
  if (t.value <= 0 || t.limit <= 0) return ''
  const tail = t.valuedAll ? '' : ' One security has no value recorded, so this is understated.'
  return `Total security ${money(t.value)} against lending of ${money(t.limit)}, ` +
    `an overall LVR of ${pct(t.lvr)}.${tail}`
}

// --- deals recorded before today ---------------------------------------------

// LINKED ONLY WHERE THE TEXT IS EXACTLY THE SAME.
//
// Existing complex refinances carry typed addresses on their splits. Matching
// them loosely - ignoring "St" against "Street", say - would be the portal
// quietly deciding which house a loan is against, and it would be wrong on the
// deal where the client genuinely owns both.
//
// So: an exact match after trimming and case, and nothing else. Everything else
// stays as typed text for a person to look at, which is what legacyAddress is
// for. NO EXISTING DEAL CHANGES ON ITS OWN.
export function legacyMatch(typed: any, props: FactFindProperty[]): string {
  const want = txt(typed).toLowerCase()
  if (!want) return ''
  const hit = (props || []).find(p => txt(p.address).toLowerCase() === want)
  return hit ? txt(hit.id) : ''
}

// What a split says when it has no securityId: the address somebody typed, or
// nothing. A screen shows this greyed with a note rather than pretending the
// split is linked.
export function legacyAddress(split: any): string {
  return splitSecurityId(split) ? '' : txt(split?.property)
}
