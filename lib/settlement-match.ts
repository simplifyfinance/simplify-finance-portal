// Matching what the portal says settled against what SFG actually paid.
//
// THERE IS ONE SHARED KEY, WHERE SOMEBODY HAS COLLECTED IT. The lender issues
// the loan reference after settlement, and your team rings for it and types it
// onto the deal - see lib/loan-id.ts. Where it is there, it is checked first and
// it settles the question.
//
// This file used to say "the portal never sees it", which was true when it was
// written and stopped being true when the Loan ID boxes were built. Everything
// below is the fallback for the deals where nobody has it yet: the client's
// name, the lender, and roughly when it settled. Names are
// written differently on each side — "KNIGHT, DAX" on a statement against
// "Dax Knight" in a deal — so they are compared as a bag of words rather than
// as strings.
//
// The matching is deliberately generous. A false pair is quiet and wrong; a
// missed pair shows up as a loud row someone will check.

import { sameLoanId } from './loan-id'

export type PortalDeal = {
  id: string
  client: string
  // THE LOAN IDS YOUR TEAM RINGS THE BANK FOR.
  //
  // One per split, typed in after settlement, and until 23 Sep 2026 read by
  // nothing at all. Fabio, 1 Sep 2026: "once contracts are issued and loan
  // settles our team contacts the bank and manually input the Loan ID. That
  // figure will then match on RCTI to confirm deal has been paid." It was being
  // collected and then ignored, while this file matched on the client's name.
  loanIds?: string[]
  brokerKey: string
  lenderId: string | null
  lender: string
  settledOn: string          // YYYY-MM-DD
  amount: number | null
  expectedUpfront: number | null
  expectedReason: string | null
}

export type PaidLine = {
  id: string
  client: string
  brokerKey: string
  lenderId: string | null
  lender: string
  loanRef: string
  settlementDate: string | null
  settlementAmount: number | null
  paidExGst: number
  periodMonth: string
}

const STOP = new Set([
  'MR', 'MRS', 'MS', 'MISS', 'DR', 'AND', 'THE', 'PTY', 'LTD', 'ATF', 'TRUST',
  'SUPERANNUATION', 'SUPER', 'FUND', 'SMSF', 'TRUSTEE', 'AS',
])

// Upper case, letters only, common noise words dropped. What is left is the
// set of words a human would use to tell two people apart.
export function nameTokens(raw: string): Set<string> {
  return new Set(
    String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOP.has(w)))
}

// One name's words all appearing in the other is a match — it covers "Adoyi
// Paul Ojobo and Ann Ebo Agaba Eke" against "Adoyi Ojobo", which is the same
// borrower written short. Two words minimum, so a lone shared surname is not
// enough to pair two different families.
export function nameMatches(a: string, b: string): boolean {
  const A = nameTokens(a), B = nameTokens(b)
  if (A.size === 0 || B.size === 0) return false
  const small = A.size <= B.size ? A : B
  const large = A.size <= B.size ? B : A
  if (small.size < 2) {
    // A lone surname is not evidence. Pairing "SMITH" with "John Smith" would
    // quietly mark a deal as paid, which is the one error that hides money —
    // so a single word must match a single word.
    return small.size === large.size && large.has(Array.from(small)[0])
  }
  let hits = 0
  for (const w of Array.from(small)) if (large.has(w)) hits += 1
  return hits >= 2 && hits >= small.size - 1
}

function within(a: number | null | undefined, b: number | null | undefined, pct: number): boolean {
  const x = Number(a), y = Number(b)
  if (!x || !y || isNaN(x) || isNaN(y)) return false
  return Math.abs(x - y) <= Math.max(x, y) * pct
}

function monthsApart(a: string, b: string): number {
  const ay = Number(a.slice(0, 4)), am = Number(a.slice(5, 7))
  const by = Number(b.slice(0, 4)), bm = Number(b.slice(5, 7))
  if (!ay || !by) return 99
  return Math.abs((ay * 12 + am) - (by * 12 + bm))
}

export type Pairing = {
  matched: { deal: PortalDeal; line: PaidLine; how: string }[]
  unpaidDeals: PortalDeal[]
  unmatchedLines: PaidLine[]
}

export function reconcile(deals: PortalDeal[], lines: PaidLine[]): Pairing {
  const used = new Set<string>()
  const matched: Pairing['matched'] = []
  const unpaidDeals: PortalDeal[] = []

  for (const deal of deals) {
    // Same lender first, then anywhere — a lender recorded differently on one
    // side should not turn a paid loan into a missing one.
    const sameLender = lines.filter(l => !used.has(l.id) && l.lenderId && deal.lenderId && l.lenderId === deal.lenderId)
    const anyLender = lines.filter(l => !used.has(l.id))

    const find = (pool: PaidLine[], how: string) => {
      const hit = pool.find(l => nameMatches(l.client, deal.client))
      return hit ? { line: hit, how } : null
    }

    let found =
      // THE LOAN ID FIRST, BECAUSE IT IS THE ONLY CERTAIN ONE.
      //
      // Everything below this is inference: names written differently on the two
      // sides, amounts that happen to agree, a lender recorded oddly. A loan ID
      // is the bank's own number for the account, printed on the RCTI - if it
      // matches, the question is answered and no guess should be allowed to
      // overrule it.
      //
      // Every rule under here was written because names do not match. Thilina
      // Dilan Dissanayake Dissanayake Mudiyanselage is not going to arrive on a
      // statement the way it is typed on a deal.
      (() => {
        const ids = (deal.loanIds || []).filter(Boolean)
        if (ids.length === 0) return null
        const hit = anyLender.find(l => ids.some(id => sameLoanId(id, l.loanRef)))
        return hit ? { line: hit, how: 'loan ID' } : null
      })() ||
      find(sameLender, 'name and lender') ||
      // The amount is a strong signal on its own when the name is written oddly.
      (() => {
        const hit = sameLender.find(l => within(l.settlementAmount, deal.amount, 0.01))
        return hit ? { line: hit, how: 'lender and settlement amount' } : null
      })() ||
      (() => {
        const hit = anyLender.find(l =>
          nameMatches(l.client, deal.client) &&
          (!l.settlementDate || monthsApart(l.settlementDate, deal.settledOn) <= 3))
        return hit ? { line: hit, how: 'name, different lender recorded' } : null
      })()

    if (found) {
      used.add(found.line.id)
      matched.push({ deal, line: found.line, how: found.how })
    } else {
      unpaidDeals.push(deal)
    }
  }

  return { matched, unpaidDeals, unmatchedLines: lines.filter(l => !used.has(l.id)) }
}
