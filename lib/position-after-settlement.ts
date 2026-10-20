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
import { isTopUp, increaseFor } from './top-up'

const txt = (v: any): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())
const num = (v: any): number => Number(txt(v).replace(/[^0-9.]/g, '')) || 0
const money = (n: number): string => n > 0 ? n.toLocaleString('en-AU') : ''

// A loan on a fact find property is "in this deal" when somebody marked it so.
// Same two words lib/funds-to-complete.ts has always used.
export const REFINANCING = ['To be refinanced', 'To be consolidated']

export type ChangeKind = 'close' | 'add' | 'keep' | 'funds'

export type PositionChange = {
  id: string
  kind: ChangeKind
  /** The property it is against, for the heading. */
  about: string
  /** What it is today. Empty on a loan that does not exist yet. */
  was: string
  /** What it becomes. Empty on one that is being paid out and gone. */
  now: string
  /** The figure, on its own, so it can be edited without parsing a sentence. */
  amount: string
  /** Can the figure be changed on the screen. */
  editable: boolean
  /** Does not exist until the other deal completes. */
  subjectToSettlement: boolean
  apply: {
    propertyId?: string
    loanId?: string
    lenderName?: string
    interestRate?: string
    repaymentType?: string
    savings?: boolean
  }
}

// WHAT A SPLIT'S MONEY DOES - ASKED OF THE DEAL, NOT GUESSED FROM ITS NAME.
//
// 13 Oct 2026, and this is the fault Fabio found within an hour of it shipping.
// The first version decided whether a split was paying a loan out or releasing
// equity by matching /equity|release|cash out/ against its LABEL. On the
// Veljovic deal every split is labelled "Investment equity loan split", so all
// three read as equity, none as a refinance, and the screen showed him three
// new liabilities, no refinance at all, and $934,000 of savings.
//
// A label is free text somebody typed. The deal already holds the answer -
// `funds` is purchase, payout or equity, asked on the split itself - so that is
// what is read. Where nobody was asked, the arithmetic answers instead: money
// above what is being paid out is money coming out. Never the name.
const equityOf = (splits: any[], payingOut: number): number => {
  const answered = splits.filter(s => txt(s.funds) === 'equity')
  if (answered.length > 0) return answered.reduce((t, s) => t + num(s.amount), 0)
  const lending = splits.reduce((t, s) => t + num(s.amount), 0)
  return Math.max(0, lending - payingOut)
}

/**
 * What this deal does to these clients' position, as a list of lines.
 *
 * EVERY LIABILITY IS LISTED, not only the ones that change. Fabio: "maybe list
 * all libiities not just the equity". A position you can only see half of is
 * one somebody has to go and check somewhere else, which is the whole thing
 * this screen exists to avoid.
 */
export function positionChanges(deal: any, savingsNow: string): PositionChange[] {
  const out: PositionChange[] = []
  const lender = txt(optionOnTheDeal(deal?.lo_data)?.lenderName) || 'the new lender'
  const splits = splitsOf(deal)
  const bc = deal?.bc_data || {}
  const secs = securitiesOf(deal?.bc_data, deal?.fact_find_data)
  const props: any[] = deal?.fact_find_data?.properties || []
  const addressOf = (id: any) =>
    txt(props.find(p => txt(p?.id) === txt(id))?.address) || txt(secs.find(x => x.id === txt(id))?.address) || 'a property'

  let payingOut = 0

  // 1. EVERY LIABILITY THEY HAVE, AND WHAT BECOMES OF IT.
  for (const p of props) {
    for (const l of p?.loans || []) {
      const going = REFINANCING.includes(txt(l?.status))
      const reads = [txt(l.lenderName), num(l.balance) > 0 && `$${money(num(l.balance))}`,
                     txt(l.repaymentType), txt(l.interestRate) && `${txt(l.interestRate)}%`]
                     .filter(Boolean).join(' · ')
      if (going) payingOut += num(l.balance)
      // A TOPPED-UP LOAN IS NEITHER CLOSING NOR UNCHANGED.
      //
      // 20 Oct 2026. It stays with the lender it is already with and it gets
      // bigger, which is the one thing the two words above cannot say. Left as
      // "unchanged" the screen understated what these clients will owe by the
      // whole increase, on the screen whose entire job is what they owe after.
      const up = !going && isTopUp(bc?.template) && increaseFor(bc, txt(p.id)) > 0
        ? increaseFor(bc, txt(p.id)) : 0
      out.push({
        id: `${going ? 'close' : 'keep'}:${txt(p.id)}:${txt(l.id)}`,
        kind: going ? 'close' : 'keep',
        about: txt(p.address) || 'a property',
        was: reads,
        now: going ? `paid out by the ${lender} lending`
          : up > 0 ? `increasing by $${money(up)} to $${money(num(l.balance) + up)}, same lender`
          : 'unchanged',
        // THE FIGURE STAYS AT WHAT IS OWED TODAY. The increase is its own line
        // below - it is the new lending being arranged - so putting the new
        // total here as well would count the $200,000 twice, which is a
        // smaller version of the fault this whole change is about.
        amount: money(num(l.balance)),
        // A loan being paid out has no figure left to argue about, and one that
        // is not changing is not this screen's business to change.
        editable: false,
        subjectToSettlement: false,
        apply: { propertyId: txt(p.id), loanId: txt(l.id) },
      })
    }
  }

  // 2. WHAT THEY WILL OWE INSTEAD. Every split on the deal becomes a loan.
  for (const sp of splits) {
    if (num(sp.amount) <= 0) continue
    // THE LOAN THAT IS ALREADY THERE IS NOT SOMETHING THEY WILL OWE INSTEAD.
    //
    // On a top up the existing loan is a split, because that is the only way
    // the LVR counts it - see lib/top-up.ts. It is already listed above as a
    // liability they hold, so adding it here counted the same debt twice:
    // $942,441 kept plus $942,441 "new" plus the $200,000 increase, against a
    // property that will owe $1,142,441.
    if (sp.staying) continue
    out.push({
      id: `add:${txt(sp.id)}`,
      kind: 'add',
      about: txt(sp.securityId) ? addressOf(sp.securityId) : txt(sp.label) || 'the new lending',
      was: '',
      now: [lender, txt(sp.repaymentType), txt(sp.rate) && `${txt(sp.rate)}%`].filter(Boolean).join(' · '),
      amount: money(num(sp.amount)),
      editable: true,
      subjectToSettlement: true,
      apply: {
        propertyId: txt(sp.securityId) || undefined, lenderName: lender,
        interestRate: txt(sp.rate), repaymentType: txt(sp.repaymentType),
      },
    })
  }

  // 3. WHAT THE CASH OUT LEAVES THEM HOLDING. Offered, never assumed - released
  //    equity is deposit money on some files and stays in the loan on others.
  const released = equityOf(splits, payingOut)
  if (released > 0) {
    const before = num(savingsNow)
    out.push({
      id: 'funds:savings',
      kind: 'funds',
      about: 'Savings',
      was: `$${money(before) || '0'}`,
      now: 'after the equity released',
      amount: money(before + released),
      editable: true,
      subjectToSettlement: false,
      apply: { savings: true },
    })
  }

  return out
}

/**
 * The new deal's fact find with the chosen lines applied.
 *
 * Takes a fact find and gives back a fact find. It has no idea what a deal is,
 * cannot reach a database, and cannot touch a client record - which is the
 * point, and is tested.
 */
export function applyChanges(factFind: any, changes: PositionChange[], sourceDealName: string): any {
  const ff = factFind && typeof factFind === 'object' ? factFind : {}
  let props: any[] = Array.isArray(ff.properties)
    ? ff.properties.map((p: any) => ({ ...p, loans: [...(p?.loans || [])] }))
    : []
  let savings = ff.savings

  // A loan being paid out goes. Leaving it beside the loan that replaces it
  // would double their liabilities on the next application.
  const closing = new Set(changes.filter(c => c.kind === 'close').map(c => txt(c.apply.loanId)))
  props = props.map(p => ({ ...p, loans: (p.loans || []).filter((l: any) => !closing.has(txt(l.id))) }))

  for (const c of changes) {
    if (c.kind === 'add') {
      const at = props.findIndex(p => txt(p.id) === txt(c.apply.propertyId))
      const loan = {
        id: `after-${c.id}`,
        lenderName: c.apply.lenderName || '',
        limitAmount: c.amount, balance: c.amount,
        interestRate: c.apply.interestRate || '',
        repaymentType: c.apply.repaymentType || 'Interest only',
        repaymentFrequency: 'Monthly', rateType: 'Variable',
        remainingLoanTermYears: '30', status: 'Ongoing', ownership: {},
        subjectToSettlementOf: sourceDealName,
      }
      if (at >= 0) props[at] = { ...props[at], loans: [...(props[at].loans || []), loan] }
    }
    if (c.kind === 'funds' && c.apply.savings) savings = c.amount
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
