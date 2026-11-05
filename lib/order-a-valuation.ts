import { dutyStateOf, isStateCode } from './duty-state'

// ORDERING A VALUATION, FROM WHAT THE DEAL ALREADY KNOWS.
//
// 4 Nov 2026. Fabio: "I want a button in the BC stage that the credit team can
// press. A pop-up with information for them to input, and this generates an
// email to my valuations bot to organise a valuation... just remember, we want
// this to be easy."
//
// Valerio's spec is docs/CRM_valuation_email_spec.md and it asks fifteen
// questions. Eleven of them are already on the deal, which is the whole point
// of this file: the pop-up asks four things and shows the rest.
//
// WHAT IS SHOWN IS NOT RE-ASKED. The address, the purpose, the use, the loan
// amount and the borrower all come off the record. Retyping an address into a
// valuation request is how a valuer ends up at the wrong house, and a loan
// amount typed twice is a loan amount that can disagree with the deal.
//
// AND SURNAMES GO IN THIS ONE. Deliberately, and the opposite of
// lib/serviceability-request.ts: a valuer has to get inside a house, so they
// need a name and a mobile for whoever opens the door. Fabio was asked and
// said so. The two files sit next to each other and say different things on
// purpose, which is why each one says why.

const txt = (v: any) => String(v ?? '').trim()
const digits = (v: any) => {
  const n = String(v ?? '').replace(/[^0-9.]/g, '')
  if (!n) return ''
  const x = Number(n)
  return Number.isFinite(x) ? String(Math.round(x)) : ''
}

export const VALUER_EMAIL = 'fabio-tgt029+valuations@mail.grokbot.com'
export const COPY_TO = 'fabio@simplifyfinance.com.au'

export const PROPERTY_TYPES = ['House', 'Unit', 'Townhouse', 'Villa', 'Land', 'Duplex'] as const
export const ACCESS_CONTACTS = ['Agent', 'Owner', 'Occupier', 'Tenant', 'Borrower'] as const
export const TENURES = ['Freehold', 'Strata', 'Company title', 'Leasehold'] as const
export const ANCILLARY = ['Pool', 'Tennis court', 'Carport'] as const

// BANKWEST ASKS ITS OWN FOUR, and it is not ordered through CoreLogic at all -
// Valerio signs into Bankwest's own broker portal for these. 5 Nov 2026.
export const BW_SPECIAL: [label: string, key: string][] = [
  ['Bridging finance', 'BRIDGING'],
  ['Fixed-price build contract over $1M', 'FIXED_PRICE_OVER_1M'],
  ['Cost-plus build contract', 'COST_PLUS'],
  ['House and land package', 'HOUSE_AND_LAND'],
  ['Complex of 4+ dwellings', 'COMPLEX_4PLUS'],
  ["Not at arm's length", 'NOT_ARMS_LENGTH'],
  ['Over 2 hectares', 'OVER_2HA'],
  ['Two-tiered marketing', 'TWO_TIERED'],
  ['Non-standard lease', 'NON_STANDARD_LEASE'],
  ['3+ dwellings on one title', 'THREE_PLUS_ON_TITLE'],
  ['Second mortgage', 'SECOND_MORTGAGE'],
  ['Leasehold', 'LEASEHOLD'],
]

// NOT SUPPORTED YET, AND SAID OUT LOUD RATHER THAN REFUSED. Valerio orders
// every other ticked lender and writes back that this one needs a person, so
// ticking it is not a mistake - it is a note to whoever reads the reply.
export const BY_HAND = ['CBA']

/**
 * A STREET, A SUBURB, A STATE AND A POSTCODE, OUT OF ONE LINE.
 *
 * The fact find holds an address as a single line. Valerio wants four fields,
 * and CoreLogic looks the property up on them.
 *
 * Anything this cannot read with confidence comes back blank rather than
 * guessed. A blank is something Valerio writes back about; a wrong suburb is a
 * valuation of somebody else's house.
 */
export function splitAddress(address: any): {
  street: string; suburb: string; state: string; postcode: string
} {
  const s = txt(address).replace(/,?\s*Australia\s*$/i, '').trim()
  const m = s.match(/^(.*?),?\s*([A-Za-z][A-Za-z'\-\s]{1,40}?)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})\s*$/i)
  if (!m) return { street: '', suburb: '', state: '', postcode: '' }
  return {
    street: txt(m[1]).replace(/,$/, ''),
    suburb: txt(m[2]),
    state: m[3].toUpperCase(),
    postcode: m[4],
  }
}

/** PURCHASE | REFINANCE | EQUITY_RELEASE, off the security's own loans. */
export function loanPurposeOf(security: any, bc: any, ff: any): string {
  if (txt(security?.id) === 'BEING_PURCHASED') return 'PURCHASE'
  const prop = (ff?.properties || []).find((p: any) => txt(p?.id) === txt(security?.id))
  const statuses = (prop?.loans || []).map((l: any) => txt(l?.status).toLowerCase())
  if (statuses.some((x: string) => x === 'refinance' || x === 'to be refinanced')) return 'REFINANCE'
  // Nothing being refinanced against a house we already own and are lending
  // more against is an equity release, which is the third of the three.
  if (txt(bc?.equityRelease)) return 'EQUITY_RELEASE'
  return 'REFINANCE'
}

/** CONTRACT_PRICE on a purchase, CUSTOMER_ESTIMATE otherwise. Never asked. */
export function valueTypeOf(loanPurpose: string): string {
  return loanPurpose === 'PURCHASE' ? 'CONTRACT_PRICE' : 'CUSTOMER_ESTIMATE'
}

export function propertyUseOf(use: any): string {
  const s = txt(use).toLowerCase()
  if (s.includes('investment')) return 'INVESTMENT'
  if (s.includes('owner')) return 'OWNER_OCCUPIED'
  return ''
}

const enumOf = (v: any) => txt(v).toUpperCase().replace(/[.\s]+/g, '_')

export type Answers = {
  // ONE PROPERTY, SEVERAL LENDERS, ONE EMAIL. 5 Nov 2026: "If several lenders
  // are ticked, send them all in the one email... Valerio places a separate
  // order per lender." Everything else on the request is shared, so asking the
  // same fifteen questions once per bank would be asking them again.
  lenders?: string[]
  propertyType?: string
  securityCategory?: string
  accessType?: string
  accessFirst?: string
  accessLast?: string
  accessMobile?: string
  inCompany?: boolean
  companyName?: string
  /** Only read when the lender is ANZ. */
  anzLvr?: string
  anzTenure?: string
  anzHolds?: boolean
  anzOnCompletion?: boolean
  anzAncillary?: string[]
  /** Only read when Bankwest is one of the ticked lenders. */
  bwUnder50?: boolean
  bwOffThePlan?: boolean
  bwCurrentLenderBwCba?: boolean
  bwSpecial?: string[]
}

/** The broker the valuation is ordered UNDER, which is not who pressed the button. */
export type Broker = { name?: string; email?: string }

export type Valuation = {
  to: string
  subject: string
  body: string
  ref: string
  /** Who to copy, worked out once so the screen and the email agree. */
  cc: string[]
  /** Ticked lenders Valerio cannot order - he says so and does the rest. */
  byHand: string[]
  missing: string[]
}

/** The same reference for the same security, so a re-order is a re-order. */
export function valuationRef(deal: any, security: any): string {
  const seed = `${txt(deal?.id)}|${txt(security?.id)}`.replace(/-/g, '')
  let n = 0
  for (const c of seed) n = (n * 31 + c.charCodeAt(0)) % 100000
  return `SF-${String(n).padStart(5, '0')}`
}

const bare = (v: any) => txt(v).toUpperCase().replace(/[^A-Z]/g, '')

// ANZ IS ANZ WHATEVER THE LIBRARY CALLS IT. CoreLogic's own list says
// "ANZ - Brokers", so an exact match would have missed it.
export function isAnz(lenders: any): boolean {
  return list(lenders).some(l => bare(l).startsWith('ANZ'))
}

export function hasBankwest(lenders: any): boolean {
  return list(lenders).some(l => bare(l).startsWith('BANKWEST'))
}

export function byHandOnly(lenders: any): string[] {
  return list(lenders).filter(l => BY_HAND.some(b => bare(l).startsWith(bare(b))))
}

function list(v: any): string[] {
  return (Array.isArray(v) ? v : v ? [v] : []).map(txt).filter(Boolean)
}

/** Loan ÷ value, as a whole percent. Filled in, and still editable. */
export function expectedLvr(limit: any, value: any): string {
  const l = Number(digits(limit) || 0)
  const v = Number(digits(value) || 0)
  if (!l || !v) return ''
  return String(Math.round((l / v) * 100))
}

/**
 * WHO THE REPLY GOES TO.
 *
 * 5 Nov 2026. "Replies go to RequestedByEmail, cc the broker (if different)
 * and fabio@simplifyfinance.com.au (no duplicate cc if Fabio is the requester
 * or broker)."
 *
 * Credit staff order these on a broker's deal, so the person who pressed the
 * button and the person whose file it is are often two different people. Both
 * want the answer, and neither wants it twice.
 */
export function copyList(requester: any, broker: any): string[] {
  const seen = new Set([txt(requester).toLowerCase()].filter(Boolean))
  const out: string[] = []
  for (const who of [txt(broker), COPY_TO]) {
    const key = who.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(who)
  }
  return out
}

export function buildValuation(
  deal: any, security: any, a: Answers,
  who: { name?: string; email?: string }, broker?: Broker,
): Valuation {
  const bc = deal?.bc_data || {}
  const ff = deal?.fact_find_data || {}
  const app = (ff?.applicants || [])[0] || {}
  const purpose = loanPurposeOf(security, bc, ff)
  const addr = splitAddress(security?.address)
  const value = digits(security?.value)
  const limit = digits(security?.limit)
  const anz = isAnz(a.lenders)
  const bw = hasBankwest(a.lenders)
  const purchase = purpose === 'PURCHASE'

  // THE PERSON WHO OPENS THE DOOR. Owner and Borrower are the client, so the
  // name is already known and nobody types it; an agent or a tenant is not on
  // the deal at all, so those come from the box.
  const theirs = a.accessType === 'Owner' || a.accessType === 'Borrower'
  const accessFirst = theirs ? txt(app?.firstName) : txt(a.accessFirst)
  const accessLast = theirs ? txt(app?.lastName) : txt(a.accessLast)

  const line = (k: string, v: string) => `${k}: ${v}`.trimEnd()
  const body = [
    '=== VALUATION REQUEST v1 ===',
    line('DealRef', valuationRef(deal, security)),
    line('RequestedByName', txt(who?.name)),
    line('RequestedByEmail', txt(who?.email)),
    // THE BROKER THE ORDER IS PLACED UNDER, which is not the person who
    // pressed the button. Valerio signs into CoreLogic with that broker's own
    // login, so a valuation ordered by credit still lands in the right
    // broker's account.
    line('BrokerName', txt(broker?.name)),
    line('BrokerEmail', txt(broker?.email)),
    // Exactly as CoreLogic's own "Choose a Lender" page spells them, which is
    // why these are the library's names and not an enum of ours.
    line('Lender', (a.lenders || []).map(txt).filter(Boolean).join(' | ')),
    line('LoanPurpose', purpose),
    line('PropertyUse', propertyUseOf(security?.use)),
    line('LoanAmount', limit),
    line('ValueAmount', value),
    line('ValueType', valueTypeOf(purpose)),
    line('StreetAddress', addr.street),
    line('Suburb', addr.suburb),
    line('State', addr.state || dutyStateOf(bc)),
    line('Postcode', addr.postcode),
    line('PropertyType', enumOf(a.propertyType)),
    line('SecurityCategory', enumOf(a.securityCategory || 'Residential')),
    line('BorrowerFirstName', txt(app?.firstName)),
    line('BorrowerLastName', txt(app?.lastName)),
    line('CompanyName', a.inCompany ? txt(a.companyName) : ''),
    line('AccessContactType', enumOf(a.accessType)),
    line('AccessFirstName', accessFirst),
    line('AccessLastName', accessLast),
    line('AccessMobile', txt(a.accessMobile).replace(/[^0-9+]/g, '')),
    // ANZ ONLY, AND BLANK FOR EVERYONE ELSE. "Fields that don't apply are sent
    // blank - never removed."
    line('ANZ_ExpectedLVR', anz ? digits(a.anzLvr) : ''),
    line('ANZ_Tenure', anz ? enumOf(a.anzTenure) : ''),
    line('ANZ_HoldsSecurity', anz ? (a.anzHolds ? 'Y' : 'N') : ''),
    line('ANZ_OnCompletion', anz ? (a.anzOnCompletion ? 'Y' : 'N') : ''),
    line('ANZ_Ancillary', anz ? (a.anzAncillary || []).map(enumOf).join(', ') : ''),
    // BANKWEST ONLY, and two of its four depend on the purpose - it asks about
    // off the plan on a purchase and about the current lender on a refinance,
    // never both.
    line('BW_Under50sqm', bw ? yn(a.bwUnder50) : ''),
    line('BW_OffThePlan', bw && purchase ? yn(a.bwOffThePlan) : ''),
    line('BW_CurrentLenderBWCBA', bw && !purchase ? yn(a.bwCurrentLenderBwCba) : ''),
    // NONE IS AN ANSWER, not an empty line. Blank here would read as unasked.
    line('BW_Special', bw ? ((a.bwSpecial || []).length ? (a.bwSpecial || []).join(', ') : 'NONE') : ''),
    '=== END ===',
  ].join('\n')

  return {
    to: VALUER_EMAIL,
    subject: `VALUATION REQUEST v1 – ${txt(app?.firstName) || 'client'} – ${addr.suburb || 'property'}`,
    body,
    ref: valuationRef(deal, security),
    cc: copyList(who?.email, broker?.email),
    byHand: byHandOnly(a.lenders),
    missing: missingFor(a, { addr, value, limit, purpose, security, anz, bw, purchase, broker }),
  }
}

/**
 * WHAT VALERIO WOULD WRITE BACK ASKING FOR.
 *
 * "Checks every required answer is there; if not, replies to the requester
 * listing exactly what's missing (no guessing, no order)." Same reasoning as
 * the serviceability request: being told by email what the screen already knew
 * is a wasted round trip. There are no optional questions in his spec, so
 * everything here is required.
 */
function missingFor(a: Answers, ctx: any): string[] {
  const out: string[] = []
  if (!(a.lenders || []).filter(Boolean).length) out.push('at least one lender')
  // REQUIRED, because Valerio signs in as this person. Normally the deal's own
  // broker and nobody is asked; a deal with none has to be told.
  if (!txt(ctx.broker?.name) || !txt(ctx.broker?.email)) {
    out.push('which broker to order it under')
  }
  if (!txt(a.propertyType)) out.push('the property type')
  if (!propertyUseOf(ctx.security?.use)) out.push('whether it is owner occupied or an investment')
  if (!ctx.limit) out.push('the loan amount — nothing is recorded against this security')
  if (!ctx.value) out.push(ctx.purpose === 'PURCHASE' ? 'the purchase price' : 'the estimated value')
  if (!ctx.addr.suburb || !ctx.addr.postcode) {
    out.push('a full address for this property — street, suburb, state and postcode')
  }
  if (!txt(a.accessType)) out.push('who lets the valuer in')
  if (!txt(a.accessMobile)) out.push('a mobile for the access contact')
  if (a.inCompany && !txt(a.companyName)) out.push('the company name')
  if (ctx.anz) {
    if (!digits(a.anzLvr)) out.push("ANZ's expected LVR")
    if (!txt(a.anzTenure)) out.push('the title — ANZ asks')
  }
  if (ctx.bw) {
    if (a.bwUnder50 === undefined) out.push('whether it is under 50 m² — Bankwest asks')
    if (ctx.purchase && a.bwOffThePlan === undefined) out.push('whether it is off the plan — Bankwest asks')
    if (!ctx.purchase && a.bwCurrentLenderBwCba === undefined) {
      out.push('whether the current lender is Bankwest or CBA — Bankwest asks')
    }
  }
  return out
}

/** Y, N, or blank where nobody has answered - never a guessed N. */
function yn(v: boolean | undefined): string {
  return v === undefined ? '' : v ? 'Y' : 'N'
}

/** Does this security look orderable at all? Used to decide the button's state. */
export function canOrder(security: any): boolean {
  return !!txt(security?.address) && !isStateCode(txt(security?.address))
}
