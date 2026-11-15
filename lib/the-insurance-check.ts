// THE BUILDING INSURANCE, OR THE STRATA CERTIFICATE.
//
// 17 Nov 2026. It arrives at Outstandings and three things about it matter:
// it covers the right house, the lender is noted on it, and it is still in
// force on settlement day. Everything else on a certificate of currency is
// somebody else's business.
//
// ONE ROW, NOT TWO. Belle: "lenders will generally only require either
// building insurance or strata, depending on the property type." Which one is
// not a question anybody is asked - lib/which-insurance-certificate.ts reads
// it off the security.
//
// THE CAUTIOUS DIRECTION. Two of these three checks fail towards "a person
// should look at this" rather than towards "fine":
//
//   The lender not noted is a DIFFERENCE, not a silence. A certificate with
//   nothing in the interested party box is the single most common reason a
//   settlement is pulled, and "nobody said" reads like there was nothing to
//   say. So a blank reads "Not noted" and goes to a person.
//
//   A lender we cannot CONFIRM is noted is also a difference. Insurers write
//   "Commonwealth Bank of Australia" where the deal says "CBA", and the honest
//   answer when the two cannot be matched is that somebody should look, not
//   that it is wrong and not that it is right.
//
// An expiry we could not read is a genuine silence and says so.
import { row, type Row } from './a-checked-row'
import { sameAddress } from './the-contract-check'
import { sameLenderName } from './an-internal-refinance'
import { when } from './employment-in-order'
import { dayMonth } from './same-date-everywhere'
import { certificateFor, CERTIFICATE_LABEL, type Certificate } from './which-insurance-certificate'

const txt = (v: any) => String(v ?? '').trim()

export type InsuranceSays = {
  insurer?: any
  policyNumber?: any
  /** The address the policy covers. */
  insured?: any
  /** Who is noted as the interested party, mortgagee or financial interest. */
  interestedParty?: any
  /** The expiry or period-of-cover end, as written. */
  expires?: any
  /** What kind of certificate this is, where the document says. */
  kind?: any
}

export type InsuranceWants = {
  /** The security address, off the deal. */
  security?: any
  /** The lender the deal is going to. */
  lender?: any
  /** The settlement date, confirmed or expected. */
  settlesOn?: any
  /** What this property needs, from its subtype. */
  needs?: Certificate
}

export type InsuranceField = 'insured' | 'interestedParty' | 'expires' | 'kind'

export const INSURANCE_LABEL: Record<InsuranceField, string> = {
  insured: 'Insured address',
  interestedParty: 'Interested party',
  expires: 'Expires',
  kind: 'Certificate',
}

export const NOT_NOTED = 'Not noted'

/**
 * IS THE LENDER ON IT?
 *
 * True only where it can be shown. An insurer's full legal name against a
 * deal's short one cannot always be matched, and this says so by returning
 * false, which puts it in front of a person rather than passing it.
 */
export function lenderIsNoted(noted: any, lender: any): boolean {
  const n = txt(noted)
  const l = txt(lender)
  if (!n || !l) return false
  if (sameLenderName(n, l)) return true
  const k = (v: any) => txt(v).toLowerCase().replace(/[^a-z0-9]/g, '')
  return k(n).includes(k(l))
}

/** "4 August 2027" where it parses, and what the document wrote where it does not. */
export function expiryWords(v: any): string {
  const t = when(v)
  return t === null ? txt(v) : dayMonth(new Date(t).toISOString())
}

/** True where the cover is still in force on settlement day. */
export function coversSettlement(expires: any, settlesOn: any): boolean {
  const e = when(expires)
  const s = when(settlesOn)
  if (e === null || s === null) return true
  return e > s
}

/**
 * ONE CERTIFICATE, CHECKED.
 *
 * Rows in the order the team reads them, and a row only where there is
 * something to say.
 */
export function checkInsurance(said: InsuranceSays, want: InsuranceWants): Row[] {
  const out: Row[] = []
  const add = (r: Row | null) => { if (r) out.push(r) }

  add(row('insured', INSURANCE_LABEL.insured,
    txt(said.insured), txt(want.security),
    sameAddress(said.insured, want.security)))

  // A BLANK IS AN ANSWER HERE. See the note at the top.
  const lender = txt(want.lender)
  if (lender) {
    add(row('interestedParty', INSURANCE_LABEL.interestedParty,
      txt(said.interestedParty) || NOT_NOTED, lender,
      lenderIsNoted(said.interestedParty, lender)))
  }

  const settles = txt(want.settlesOn)
  add(row('expires', INSURANCE_LABEL.expires,
    expiryWords(said.expires),
    settles ? `after settlement — ${expiryWords(settles)}` : '',
    coversSettlement(said.expires, settles)))

  // ONLY WHERE THE DOCUMENT NAMES ITS OWN KIND. The portal knowing a unit needs
  // a strata certificate is not a finding about the document in front of it.
  const saidKind = txt(said.kind)
  const needs = want.needs
  if (saidKind && needs && needs !== 'unknown') {
    const same = kindMatches(saidKind, needs)
    add(row('kind', INSURANCE_LABEL.kind, saidKind, CERTIFICATE_LABEL[needs], same))
  }

  return out
}

/** "Strata" against a property that needs strata, however the insurer worded it. */
export function kindMatches(saidKind: any, needs: Certificate): boolean {
  const k = txt(saidKind).toLowerCase()
  if (!k) return true
  if (needs === 'strata') return /strata|body ?corp|owners ?corp/.test(k)
  if (needs === 'building') return /building|home|dwelling|house/.test(k)
  return true
}

/**
 * WHICH SECURITY THIS CERTIFICATE IS ABOUT.
 *
 * A refinance can be over two houses and each one has its own policy. The
 * certificate names an address, so the address picks the security - and only
 * where nothing matches does it fall back to the first property that needs a
 * certificate at all, so the screen still says something useful about a policy
 * over an address nobody recognises.
 */
export function securityFor(
  securities: { address?: any; subtype?: any }[] | null | undefined,
  insured: any,
): { address: string; subtype: string } | null {
  const list = (securities || []).map(s => ({ address: txt(s?.address), subtype: txt(s?.subtype) }))
  if (list.length === 0) return null
  const named = txt(insured)
  if (named) {
    const hit = list.find(s => s.address && sameAddress(s.address, named))
    if (hit) return hit
  }
  return list.find(s => certificateFor(s.subtype) !== 'none') || list[0]
}

/** "The certificate expires before settlement. Which one is right?" */
export function askAboutInsurance(r: Row): string {
  if (r.field === 'interestedParty') {
    return r.says === NOT_NOTED
      ? `Nobody is noted as the interested party. ${r.expected} has to be noted before settlement.`
      : `The certificate notes ${r.says} and the deal is going to ${r.expected}. Which one is right?`
  }
  if (r.field === 'expires') {
    return `The certificate expires ${r.says}, which is not past settlement. Which one is right?`
  }
  return `The certificate says ${r.says} and the deal says ${r.expected}. Which one is right?`
}
