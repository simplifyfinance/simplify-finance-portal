import { money, readMoney } from './money'
import { dealRow } from './deal-structure'
import { variantOf, andList, type Gap } from './box-one'

// BOX NINE — SECURITY.
//
// What is being taken as security, what is known about it, and what is not.
//
// WHAT COUNTS AS SECURITY, AND WHAT DOES NOT. A property is security on this
// deal only if it is being purchased, or a loan against it is marked "To be
// refinanced" or "To be consolidated" on the fact find. That is the same test
// securityValue() uses for the deal structure block's property value and LVR, so
// this box can never name a property the block did not count.
//
// It matters. The Fielding deal owns 14 Sample Street worth $3,000,000 with a
// Macquarie loan on it marked Ongoing. That is an asset they hold, not security
// for this loan, and naming it here would tell an assessor the lender is taking
// a property it is not taking.
//
// The lender's fees are box four's job, including the valuation fee. This box
// does not repeat them.

const txt = (v: any) => String(v ?? '').trim()
const shout = (s: string) => `** ${s} **`
const num = (v: any) => readMoney(v) ?? 0
const has = (v: any) => num(v) > 0

export type Box = { text: string; gaps: Gap[]; variant: 1 | 2 | 3 }

export type Security = {
  // The property being bought has no address until somebody types one, so this
  // says which kind it is rather than leaving the caller to guess from a blank.
  kind: 'purchase' | 'existing'
  address: string
  value: number
  // Owner occupied / Investment / Residential / Commercial / Rural, as recorded.
  use: string
  // House / Unit / Townhouse / Land / Commercial / Rural, as recorded.
  subtype: string
  zoning: string
  futureUse: string
  valuationMethod: string
  // The loan being refinanced off it, where there is one.
  mortgagee: string
  owing: number
}

const REFINANCING = ['To be refinanced', 'To be consolidated']

// EVERY SECURITY, IN THE SAME ORDER AND BY THE SAME TEST AS securityValue().
export function securitiesOf(deal: any): Security[] {
  const bc = deal?.bc_data || {}
  const out: Security[] = []

  const buying = has(bc.purchasePrice) ? num(bc.purchasePrice)
    : has(bc.newPurchasePrice) ? num(bc.newPurchasePrice) : 0
  if (buying > 0) {
    out.push({
      kind: 'purchase',
      address: txt(deal?.compliance_data?.securityAddress),
      value: buying,
      // newPurchasePropertyType holds "Owner-occupied" - it is a USE, not a
      // subtype. Reading it as the subtype produced "an owner-occupied
      // owner-occupied to be purchased". Caught by looking at the output.
      use: txt(bc.propertyType) || txt(bc.newPurchasePropertyType),
      subtype: txt(bc.purchasePropertySubtype),
      zoning: '', futureUse: '', valuationMethod: '', mortgagee: '', owing: 0,
    })
  }

  for (const p of deal?.fact_find_data?.properties || []) {
    const loan = (p?.loans || []).find((l: any) => REFINANCING.includes(txt(l?.status)))
    if (!loan) continue
    out.push({
      kind: 'existing',
      address: txt(p?.address),
      value: num(p?.value),
      use: txt(p?.ownershipType),
      subtype: txt(p?.propertySubtype),
      zoning: txt(p?.zoning),
      futureUse: txt(p?.futureUse),
      valuationMethod: txt(p?.valuationMethod),
      mortgagee: txt(loan?.lenderName),
      owing: num(loan?.balance),
    })
  }

  if (out.length === 0 && has(bc.propertyValue)) {
    out.push({
      kind: 'existing', address: txt(deal?.compliance_data?.securityAddress),
      value: num(bc.propertyValue), use: '', subtype: '', zoning: '',
      futureUse: '', valuationMethod: '', mortgagee: '', owing: 0,
    })
  }
  return out
}

// "owner occupied townhouse", or nothing at all. Never a description assembled
// out of blanks, and never the same word twice - the BC records the use in two
// boxes and on a plain purchase they hold the same value.
function bare(s: Security): string {
  const use = s.use.toLowerCase()
  const sub = s.subtype.toLowerCase()
  const bits = sub && sub !== use ? [use, sub] : [use || sub]
  return bits.filter(Boolean).join(' ')
}

// The same, with its article. Only used where a sentence needs one - "the" and
// "a" together produced "the an owner-occupied ...".
function describe(s: Security): string {
  const phrase = bare(s)
  if (!phrase) return ''
  return `${/^[aeiou]/.test(phrase) ? 'an' : 'a'} ${phrase}`
}

// The state the duty was worked out in, which is the only state this portal
// records against a purchase.
function stateOf(deal: any): string {
  const bc = deal?.bc_data || {}
  return txt(bc.dutyState) || txt(bc.suburb) || ''
}

// FUTURE USE IS ONLY WORTH A SENTENCE WHEN IT IS A CHANGE.
// "Ongoing" is the default on every property and says nothing.
const FUTURE_WORDS: Record<string, string> = {
  'Will become investment': 'will become an investment after settlement',
  'Will become owner occupied': 'will become owner occupied after settlement',
  'To be sold': 'is to be sold',
}

export function securitySentences(deal: any, s: Security, only: boolean): { parts: string[]; gaps: Gap[] } {
  const parts: string[] = []
  const gaps: Gap[] = []
  const row = dealRow(deal)
  const what = describe(s)
  const lead = only ? 'The security for this loan is' : 'One security is'

  if (s.kind === 'purchase') {
    const state = stateOf(deal)
    if (!s.address || /^TBA/i.test(s.address)) {
      // A blank address on a pre-approval is a fact, not a gap.
      if (row.preApproval) {
        const kind = bare(s) ? `${bare(s)} property` : 'property'
        parts.push(`${lead} the ${kind} to be purchased${state ? ` in ${state}` : ''}. `
          + 'The address is not yet known as this is a pre-approval, and the security will be confirmed '
          + 'once a property is found and a contract is in place.')
      } else {
        parts.push(shout('NOT RECORDED — the security address.'))
        gaps.push({ what: 'Security address', where: 'Deal structure' })
      }
    } else {
      parts.push(`${lead} ${s.address}, ${what || 'the property'} being purchased for ${money(s.value)}.`)
    }
  } else {
    if (!s.address) {
      parts.push(shout('NOT RECORDED — the address of the property being taken as security.'))
      gaps.push({ what: 'Security address', where: 'Fact Find → Properties' })
    } else if (s.value > 0) {
      parts.push(`${lead} ${s.address}, ${what || 'a property'} valued at ${money(s.value)}.`)
    } else {
      parts.push(`${lead} ${s.address}, ${what || 'a property'}. ${shout(`NOT RECORDED — the value of ${s.address}.`)}`)
      gaps.push({ what: `Value of ${s.address}`, where: 'Fact Find → Properties' })
    }

    // The value is somebody's estimate until a lender says otherwise, and an
    // assessor should be told which.
    if (s.value > 0 && /applicant estimate/i.test(s.valuationMethod)) {
      parts.push("The value is the applicants' own estimate and will be confirmed by the lender's valuation.")
    }

    if (s.mortgagee && s.owing > 0) {
      parts.push(`The property is currently mortgaged to ${s.mortgagee} with ${money(s.owing)} outstanding, which is being refinanced.`)
    }
  }

  const future = FUTURE_WORDS[s.futureUse]
  if (future) parts.push(`The property ${future}.`)

  // Residential is the default and says nothing. Anything else can narrow the
  // lenders able to consider it, which is worth an assessor knowing.
  if (s.zoning && !/^residential$/i.test(s.zoning)) {
    parts.push(`The property is zoned ${s.zoning.toLowerCase()}, which may restrict the lenders able to consider it.`)
  }
  return { parts, gaps }
}

export function boxNine(deal: any): Box {
  const v = variantOf(deal?.id)
  const row = dealRow(deal)
  const list = securitiesOf(deal)
  const parts: string[] = []
  const gaps: Gap[] = []

  if (list.length === 0) {
    return { text: shout('NOT RECORDED — no property is recorded as security on this deal.'),
             gaps: [{ what: 'Security', where: 'Deal structure' }], variant: v }
  }

  if (list.length > 1) {
    parts.push(`${list.length === 2 ? 'Two' : String(list.length)} properties are being taken as security.`)
  }
  for (const s of list) {
    const r = securitySentences(deal, s, list.length === 1)
    parts.push(...r.parts)
    gaps.push(...r.gaps)
  }

  // The LVR, from the block, across everything counted above.
  if (row.lvr === null) {
    parts.push(shout(`NOT RECORDED — the loan to value ratio cannot be stated because ${row.lvrWhy || 'the figures behind it are incomplete'}.`))
    gaps.push({ what: 'Loan to value ratio', where: 'Deal structure' })
  } else {
    parts.push(list.length > 1
      ? `Total lending of ${money(row.totalLending)} against combined security of ${money(row.propertyValue)} is a loan to value ratio of ${row.lvr}%.`
      : `Lending of ${money(row.totalLending)} against ${money(row.propertyValue)} is a loan to value ratio of ${row.lvr}%.`)
  }

  return { text: parts.filter(Boolean).join(' '), gaps, variant: v }
}
