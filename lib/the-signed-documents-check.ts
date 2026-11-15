// THE SIGNED LOAN DOCUMENTS.
//
// 17 Nov 2026. They come back at Contracts Reviewing and this is NOT the same
// job as the contract check. Nothing is being compared to the formal approval -
// the figures were settled days ago. The question here is whether the pack is
// complete enough to return to the lender, and a pack goes back for one of four
// reasons, every time:
//
//   somebody did not sign          the lender rejects the pack
//   a signature is not dated       the lender rejects the pack
//   no direct debit account        the first repayment fails
//   no repayment frequency         the lender picks one, and it is monthly
//
// And a fifth that is not about the pack at all: an offset was sold and the
// client has not nominated the account. That one is checked against the DEAL,
// not against the handover, because the offset is a fact about this loan and
// not about what a document told somebody.
//
// WHAT IS MISSING IS THE FINDING. On every other document in this build a
// blank means "nobody said" and is left alone. Here a blank is the whole point:
// an unsigned page is not an absence of information, it is an unsigned page. So
// every row says either what the pack nominates or that it nominates nothing,
// and the nothings are what go to a person.
import { row, type Row } from './a-checked-row'
import { sameNames } from './the-contract-check'

const txt = (v: any) => String(v ?? '').trim()

export type SignedSays = {
  /** Everyone the pack carries a signature for. */
  signedBy?: any[]
  /** Whether every signature carries a date. */
  signaturesDated?: any
  /** The account nominated for repayments, as written. */
  directDebit?: any
  /** Weekly, fortnightly or monthly, as nominated. */
  repaymentFrequency?: any
  /** The offset account nominated, as written. */
  offsetAccount?: any
}

export type SignedWants = {
  /** Everyone on the deal who has to sign. */
  borrowers?: any[]
  /** Whether the loan this deal recommended carries an offset. */
  hasOffset?: boolean
}

export type SignedField = 'signedBy' | 'signaturesDated' | 'directDebit' | 'repaymentFrequency' | 'offsetAccount'

export const SIGNED_LABEL: Record<SignedField, string> = {
  signedBy: 'Signatures',
  signaturesDated: 'Signatures dated',
  directDebit: 'Direct debit',
  repaymentFrequency: 'Repayment frequency',
  offsetAccount: 'Offset account',
}

export const NOT_NOMINATED = 'Not nominated'
export const NOT_DATED = 'Not dated'

const names = (v: any) => (Array.isArray(v) ? v.filter(Boolean).map(txt).join(', ') : txt(v))

/** A yes, a no, or nothing at all - written on a pack in a dozen ways. */
export function readYesNo(v: any): boolean | null {
  const s = txt(v).toLowerCase()
  if (!s) return null
  if (/^(y|yes|true|all|dated|complete|signed)/.test(s)) return true
  if (/^(n|no|false|none|undated|incomplete|unsigned)/.test(s)) return false
  return null
}

/**
 * ONE SIGNED PACK, CHECKED.
 *
 * `want.borrowers` is who has to sign. Where nobody recorded them the
 * signatures row still appears, saying who signed, because a settlements
 * officer reading the names is the point even when the portal cannot do the
 * comparison itself.
 */
export function checkSignedDocuments(said: SignedSays, want: SignedWants): Row[] {
  const out: Row[] = []
  const add = (r: Row | null) => { if (r) out.push(r) }

  const signed = Array.isArray(said.signedBy) ? said.signedBy.filter(Boolean) : []
  const must = Array.isArray(want.borrowers) ? want.borrowers.filter(Boolean) : []
  add(row('signedBy', SIGNED_LABEL.signedBy,
    names(signed) || NOT_NOMINATED, names(must),
    signed.length > 0 && sameNames(signed, must)))

  const dated = readYesNo(said.signaturesDated)
  if (dated !== null || signed.length > 0) {
    add(row('signaturesDated', SIGNED_LABEL.signaturesDated,
      dated === true ? 'Every signature dated' : dated === false ? NOT_DATED : 'Could not tell',
      'Every signature dated', dated === true))
  }

  add(row('directDebit', SIGNED_LABEL.directDebit,
    txt(said.directDebit) || NOT_NOMINATED, 'An account for repayments',
    !!txt(said.directDebit)))

  add(row('repaymentFrequency', SIGNED_LABEL.repaymentFrequency,
    txt(said.repaymentFrequency) || NOT_NOMINATED, 'Weekly, fortnightly or monthly',
    !!txt(said.repaymentFrequency)))

  // ONLY WHERE THE DEAL SAYS THIS LOAN HAS ONE. A pack that nominates no offset
  // on a loan that has no offset is not a finding.
  if (want.hasOffset) {
    add(row('offsetAccount', SIGNED_LABEL.offsetAccount,
      txt(said.offsetAccount) || NOT_NOMINATED, 'The deal records an offset on this loan',
      !!txt(said.offsetAccount)))
  }

  return out
}

/** "Nothing is nominated for the direct debit." */
export function askAboutSigned(r: Row): string {
  if (r.says === NOT_NOMINATED) {
    if (r.field === 'signedBy') return 'Nobody has signed the pack, or the signatures could not be read.'
    if (r.field === 'offsetAccount') return 'No offset account is nominated, and the deal records an offset on this loan.'
    return `Nothing is nominated for the ${r.label.toLowerCase()}.`
  }
  if (r.field === 'signaturesDated') {
    return r.says === NOT_DATED
      ? 'A signature on the pack is not dated.'
      : 'It could not be told whether every signature is dated.'
  }
  if (r.field === 'signedBy') {
    return `The pack is signed by ${r.says} and the deal records ${r.expected}. Which one is right?`
  }
  return `The pack says ${r.says} and the deal says ${r.expected}. Which one is right?`
}
