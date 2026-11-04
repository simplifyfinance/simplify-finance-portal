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
  lender?: string
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
}

export type Valuation = {
  to: string
  subject: string
  body: string
  ref: string
  missing: string[]
}

/** The same reference for the same security, so a re-order is a re-order. */
export function valuationRef(deal: any, security: any): string {
  const seed = `${txt(deal?.id)}|${txt(security?.id)}`.replace(/-/g, '')
  let n = 0
  for (const c of seed) n = (n * 31 + c.charCodeAt(0)) % 100000
  return `SF-${String(n).padStart(5, '0')}`
}

export function isAnz(lender: any): boolean {
  return txt(lender).toUpperCase().replace(/[^A-Z]/g, '') === 'ANZ'
}

/** Loan ÷ value, as a whole percent. Filled in, and still editable. */
export function expectedLvr(limit: any, value: any): string {
  const l = Number(digits(limit) || 0)
  const v = Number(digits(value) || 0)
  if (!l || !v) return ''
  return String(Math.round((l / v) * 100))
}

export function buildValuation(
  deal: any, security: any, a: Answers, who: { name?: string; email?: string },
): Valuation {
  const bc = deal?.bc_data || {}
  const ff = deal?.fact_find_data || {}
  const app = (ff?.applicants || [])[0] || {}
  const purpose = loanPurposeOf(security, bc, ff)
  const addr = splitAddress(security?.address)
  const value = digits(security?.value)
  const limit = digits(security?.limit)
  const anz = isAnz(a.lender)

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
    line('Lender', enumOf(a.lender)),
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
    '=== END ===',
  ].join('\n')

  return {
    to: VALUER_EMAIL,
    subject: `VALUATION REQUEST v1 – ${txt(app?.firstName) || 'client'} – ${addr.suburb || 'property'}`,
    body,
    ref: valuationRef(deal, security),
    missing: missingFor(a, { addr, value, limit, purpose, security, anz }),
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
  if (!txt(a.lender)) out.push('the lender')
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
  return out
}

/** Does this security look orderable at all? Used to decide the button's state. */
export function canOrder(security: any): boolean {
  return !!txt(security?.address) && !isStateCode(txt(security?.address))
}
