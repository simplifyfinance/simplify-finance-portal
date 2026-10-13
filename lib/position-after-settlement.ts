// THEIR POSITION AFTER THIS DEAL SETTLES, NOT AS IT STANDS TODAY.
//
// 13 Oct 2026. Velimir refinances three properties to Bankwest and takes cash
// out. At the same time a purchase goes to another lender. Fabio:
//
//   "When I go to Ord, I need to show them that the Bankwest loans are now in
//    play... the lending options becomes the updated financial position."
//
// The first version of "another deal for these clients" copied the fact find as
// it stood, which is the position BEFORE the refinance. No lender assessing the
// second application cares about that. They care what he will owe when the
// first one completes - and that is written on the first deal's lending
// options, not on its fact find.
//
// So this works out the difference and proposes it, line by line, for a person
// to tick before anything is created. It never applies anything on its own.
//
// AND IT WRITES ONLY TO A NEW DEAL'S FACT FIND. Never the client record. The
// question of whether a settled deal updates the client's own file is a
// separate one with its own answer, and nothing here may pre-empt it.
import { splitsOf } from './deal-structure'
import { securitiesOf } from './securities'
// WHICH OPTION THIS DEAL IS ON, NOT WHICH WE RECOMMENDED. Those are the same
// until a client picks something else, and then they are not - and the whole
// point here is the structure that will actually settle. See the rule in
// lib/lender-on-the-deal.test.ts, which caught this the moment it was written.
import { optionOnTheDeal } from './client-agreement'

const txt = (v: any): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())
const num = (v: any): number => Number(txt(v).replace(/[^0-9.]/g, '')) || 0
const money = (n: number): string => n > 0 ? n.toLocaleString('en-AU') : ''

// A loan on a fact find property is "in this deal" when somebody marked it so.
// Same two words lib/funds-to-complete.ts has always used.
export const REFINANCING = ['To be refinanced', 'To be consolidated']

export type ChangeKind = 'replace' | 'add' | 'funds'

export type PositionChange = {
  id: string
  kind: ChangeKind
  /** The property or account it is about, for the heading. */
  about: string
  /** How it reads today. Empty on something being added. */
  was: string
  /** How it will read. */
  now: string
  /** Does not exist until the other deal completes. */
  subjectToSettlement: boolean
  /** Enough to apply it without working any of it out twice. */
  apply: {
    propertyId?: string
    loanId?: string
    lenderName?: string
    limitAmount?: string
    balance?: string
    interestRate?: string
    repaymentType?: string
    savings?: string
  }
}

/**
 * What this deal's lending options do to these clients' position.
 *
 * Nothing is decided here. Every line comes back unticked or ticked by the
 * caller, and applyChanges only touches what it is handed.
 */
export function positionChanges(deal: any, savingsNow: string): PositionChange[] {
  const out: PositionChange[] = []
  const lender = txt(optionOnTheDeal(deal?.lo_data)?.lenderName) || 'the new lender'
  const splits = splitsOf(deal)
  const secs = securitiesOf(deal?.bc_data, deal?.fact_find_data)
  const props: any[] = deal?.fact_find_data?.properties || []

  // 1. EVERY LOAN BEING PAID OUT IS REPLACED BY WHAT REPLACES IT.
  for (const p of props) {
    for (const l of p?.loans || []) {
      if (!REFINANCING.includes(txt(l?.status))) continue
      const mine = splits.filter(s => txt(s.securityId) === txt(p?.id))
      // The split that is paying this loan out: the one against this house that
      // is not an equity release. Where the BC did not say which house a split
      // is against there is nothing to match on, and nothing is proposed -
      // better than guessing which loan a figure belongs to.
      const payout = mine.find(s => !/equity|release|cash\s*out/i.test(txt(s.label)))
      if (!payout) continue
      out.push({
        id: `replace:${txt(p.id)}:${txt(l.id)}`,
        kind: 'replace',
        about: txt(p.address) || 'a property',
        was: [txt(l.lenderName), money(num(l.balance)) && `$${money(num(l.balance))}`,
              txt(l.repaymentType), txt(l.interestRate) && `${txt(l.interestRate)}%`]
              .filter(Boolean).join(' · '),
        now: [lender, `$${money(num(payout.amount))}`, txt(payout.repaymentType),
              txt(payout.rate) && `${txt(payout.rate)}%`].filter(Boolean).join(' · '),
        subjectToSettlement: true,
        apply: {
          propertyId: txt(p.id), loanId: txt(l.id), lenderName: lender,
          limitAmount: money(num(payout.amount)), balance: money(num(payout.amount)),
          interestRate: txt(payout.rate), repaymentType: txt(payout.repaymentType),
        },
      })
    }
  }

  // 2. ANYTHING NEW THEY ARE BORROWING. An equity release is a liability on the
  //    second application whether or not the money has been spent.
  for (const s of splits) {
    if (!/equity|release|cash\s*out/i.test(txt(s.label))) continue
    const house = secs.find(x => x.id === txt(s.securityId))
    out.push({
      id: `add:${txt(s.id)}`,
      kind: 'add',
      about: house?.address ? `${txt(s.label)} — ${house.address}` : txt(s.label),
      was: '',
      now: [lender, `$${money(num(s.amount))}`, txt(s.repaymentType),
            txt(s.rate) && `${txt(s.rate)}%`].filter(Boolean).join(' · '),
      subjectToSettlement: true,
      apply: {
        propertyId: txt(s.securityId) || undefined, lenderName: lender,
        limitAmount: money(num(s.amount)), balance: money(num(s.amount)),
        interestRate: txt(s.rate), repaymentType: txt(s.repaymentType),
      },
    })
  }

  // 3. WHAT THE CASH OUT LEAVES THEM HOLDING.
  //
  // Offered, never assumed. Released equity is money towards the next deposit
  // on some files and stays inside the loan on others, and only a person knows
  // which. Untick it and the liability above still carries - the two are
  // separate answers to separate questions.
  const released = splits
    .filter(s => /equity|release|cash\s*out/i.test(txt(s.label)))
    .reduce((t, s) => t + num(s.amount), 0)
  if (released > 0) {
    const before = num(savingsNow)
    out.push({
      id: 'funds:savings',
      kind: 'funds',
      about: 'Savings',
      was: before > 0 ? `$${money(before)}` : '$0',
      now: `$${money(before + released)}`,
      subjectToSettlement: false,
      apply: { savings: money(before + released) },
    })
  }

  return out
}

/**
 * The new deal's fact find with the ticked changes applied.
 *
 * Takes a fact find and gives back a fact find. It has no idea what a deal is,
 * cannot reach a database, and cannot touch a client record - which is the
 * point, and is tested.
 */
export function applyChanges(factFind: any, changes: PositionChange[], sourceDealName: string): any {
  const ff = factFind && typeof factFind === 'object' ? factFind : {}
  let props: any[] = Array.isArray(ff.properties) ? ff.properties.map((p: any) => ({ ...p, loans: [...(p?.loans || [])] })) : []
  let savings = ff.savings

  for (const c of changes) {
    if (c.kind === 'replace') {
      props = props.map(p => txt(p.id) !== txt(c.apply.propertyId) ? p : {
        ...p,
        loans: (p.loans || []).map((l: any) => txt(l.id) !== txt(c.apply.loanId) ? l : {
          ...l,
          lenderName: c.apply.lenderName ?? l.lenderName,
          limitAmount: c.apply.limitAmount ?? l.limitAmount,
          balance: c.apply.balance ?? l.balance,
          interestRate: c.apply.interestRate || l.interestRate,
          repaymentType: c.apply.repaymentType || l.repaymentType,
          // IT IS NOT BEING REFINANCED ANY MORE - on the new deal it is just a
          // loan they have. Leaving the old status would have the next
          // borrowing capacity think it is paying these out again.
          status: 'Ongoing',
          subjectToSettlementOf: sourceDealName,
        }),
      })
    }
    if (c.kind === 'add') {
      const at = props.findIndex(p => txt(p.id) === txt(c.apply.propertyId))
      const loan = {
        id: `after-${c.id}`,
        lenderName: c.apply.lenderName || '', limitAmount: c.apply.limitAmount || '',
        balance: c.apply.balance || '', interestRate: c.apply.interestRate || '',
        repaymentType: c.apply.repaymentType || 'Interest only',
        repaymentFrequency: 'Monthly', rateType: 'Variable',
        remainingLoanTermYears: '30', status: 'Ongoing', ownership: {},
        subjectToSettlementOf: sourceDealName,
      }
      if (at >= 0) props[at] = { ...props[at], loans: [...(props[at].loans || []), loan] }
    }
    if (c.kind === 'funds' && c.apply.savings !== undefined) savings = c.apply.savings
  }

  const next: any = { ...ff, properties: props }
  if (savings !== undefined) next.savings = savings
  return next
}

/** "4 liabilities are subject to settlement of X" - what the new deal says. */
export function subjectToSettlementCount(factFind: any): number {
  let n = 0
  for (const p of factFind?.properties || []) {
    for (const l of p?.loans || []) if (txt(l?.subjectToSettlementOf)) n++
  }
  return n
}
