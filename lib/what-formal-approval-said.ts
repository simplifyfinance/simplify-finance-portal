// THE FORMAL APPROVAL IS ALWAYS WHAT THE CONTRACT IS CHECKED AGAINST.
//
// 17 Nov 2026. Fabio first said it depended - the offer accepted figures on a
// purchase, the lending options and the approval email on a refinance - and
// then, a minute later: "actually formal approval tab is always the data to be
// used sorry."
//
// He is right, and the portal already works this way. Marking a deal formally
// approved writes a SNAPSHOT into deal_stage_snapshots: the lender, and every
// split with its amount, its rate and whether it is principal and interest or
// interest only. That snapshot already starts from the offer rather than from
// lodgement, for exactly the reason he gave in September - "deal is lodged for
// a pre-apporval those figures go in the deal summary, deal move to offer
// accepted which will change the figures (most of the time down)... THAT
// figures now becomes the true reflection of formal apporval".
//
// So the two answers were never different. The formal snapshot IS the offer
// figures on a purchase, and it is the lending options on a refinance, because
// that is what it was filled in from.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT HOLD, AND WHERE THAT COMES FROM
// ---------------------------------------------------------------------------
//
// The snapshot carries amount, rate and repayment type per split. It does not
// carry the loan term or how long a loan is interest only for, and Fabio asked
// for both to be checked. Those come off the deal's own splits, which is where
// every other document in this portal reads them from.
//
// AND WITH NO FORMAL APPROVAL RECORDED THERE IS NOTHING TO CHECK AGAINST. The
// screen says so. It does not quietly fall back to the lending options, because
// then nobody reading it would know which of two different things the contract
// had been measured against.
import { splitsOf } from './deal-structure'
import { securitiesOf } from './box-security'
import { fullName } from './fact-find'
import { type DealSays } from './the-contract-check'

const txt = (v: any) => String(v ?? '').trim()

export type SnapSplit = { label?: any; amount?: any; rate?: any; type?: any }
export type FormalSnapshot = { lender?: any; splits?: SnapSplit[] }

/** The formal row out of whatever deal_stage_snapshots handed back. */
export function formalSnapshot(rows: any): FormalSnapshot | null {
  const list = Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? [rows] : []
  const row = list.find((r: any) => txt(r?.stage) === 'formal')
  if (!row) return null
  const splits = Array.isArray(row.splits) ? row.splits : []
  return { lender: txt(row.lender), splits }
}

export const NO_FORMAL =
  'No formal approval has been recorded on this deal, so there is nothing to check the contract against. '
  + 'Mark it as formally approved first.'

/** Everyone on the deal, as the contract would name them. */
export function borrowersOf(deal: any): string[] {
  return ((deal?.fact_find_data?.applicants) || [])
    .map((a: any) => fullName(a)).filter(Boolean)
}

/** The one security, or all of them where a loan is secured by several. */
export function securityOf(deal: any): string {
  return securitiesOf(deal).map(s => txt(s.address)).filter(Boolean).join(' and ')
}

/**
 * WHAT THE DEAL SAYS EACH LOAN SHOULD BE.
 *
 * One entry per split on the formal snapshot, in its order, because that is the
 * order the contracts arrive in. The term and the interest only period are
 * matched to the snapshot split by its label, and fall back to position where
 * nobody labelled them - a split called "Split 2" in one place and "Loan 2" in
 * another is still the second loan.
 */
export function expectedFromFormal(deal: any, snap: FormalSnapshot | null): DealSays[] {
  if (!snap) return []
  const dealSplits = splitsOf(deal) || []
  const security = securityOf(deal)
  const borrowers = borrowersOf(deal)

  return (snap.splits || []).map((s, i) => {
    const label = txt(s.label)
    const match = dealSplits.find((d: any) => txt(d.label) && txt(d.label) === label) || dealSplits[i]
    return {
      label: label || `Split ${i + 1}`,
      amount: s.amount,
      rate: s.rate,
      repayment: s.type,
      // NOT ON THE SNAPSHOT. Off the deal's own splits, the same place every
      // other document in this portal reads a term from.
      loanTerm: match ? (match as any).termYears : '',
      ioTerm: match ? (match as any).ioYears : '',
      security,
      borrowers,
    }
  })
}

/** "Checked against the formal approval recorded on 11 Nov." */
export function checkedAgainst(deal: any, when: (iso: string) => string): string {
  const at = txt(deal?.formal_approval_at)
  return at
    ? `Checked against the formal approval recorded on ${when(at)}.`
    : 'Checked against the formal approval.'
}
