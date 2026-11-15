// WHERE THE MONEY GOES ON THE DAY.
//
// 17 Nov 2026. The settlement numbers email, about a week out. The spec asks
// for a different set of figures per transaction type, and the portal already
// works out almost all of them - so this file reshapes what exists rather than
// adding a second set of sums beside it.
//
// WHY THAT MATTERS MORE THAN IT SOUNDS. lib/funds-to-complete.ts was cut back
// hard in September after a released-equity line double counted the same
// dollars and a purchase-plus-refinance produced a six-figure surplus that did
// not exist. Fabio, 3 Sep 2026: "it is VERY simple Purchase Price, Stamp Duty,
// and deposit as we have the loan value correct? no legal fees etc". A second
// implementation of settlement money would be a second place for those bugs to
// live, and the one that reached a client would be this one.
//
// So: a purchase reads fundsToComplete, a refinance reads the same three
// refinance figures every other email on this portal reads, and nothing here
// adds anything up that is not already added up somewhere else.
//
// NOTHING IS INVENTED. A figure nobody has recorded is a gap, said in words,
// and the email goes without the table rather than with a hole in it.
import { fundsToComplete } from './funds-to-complete'
import { loanForEmail } from './milestone-figures'
import { balanceTotal, releaseTotal } from './complex-refinance'
import { isRefinance, isPurchase } from './settlement'
import { money } from './money'
import { type MoneyRow } from './settlement-emails'

const num = (v: any): number => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export type NumbersKind = 'purchase' | 'refinance' | 'none'

export function numbersKind(deal: any): NumbersKind {
  if (isPurchase(deal)) return 'purchase'
  if (isRefinance(deal)) return 'refinance'
  return 'none'
}

/** What is taken in hand on a refinance - the surplus, or nothing. */
export function cashOut(deal: any): number {
  return releaseTotal(deal?.bc_data || {})
}

/**
 * IS THERE ANYTHING WORTH AN EMAIL?
 *
 * The spec: not sent on a dollar-for-dollar refinance, only where there is a
 * surplus or a shortfall. A refinance that pays out one loan and writes another
 * of the same size moves no money the client will see, and an email headed
 * "your settlement numbers" that says nothing changed is worse than silence.
 *
 * A purchase always has something to say: they have to find money on the day.
 */
export function numbersWorthSending(deal: any): boolean {
  const kind = numbersKind(deal)
  if (kind === 'purchase') return fundsToComplete(deal).applies
  if (kind === 'refinance') return cashOut(deal) > 0
  return false
}

/**
 * THE ROWS, PER TRANSACTION TYPE.
 *
 * Empty where there is nothing honest to print. The caller shows the table only
 * when this returns something, and shows the gaps either way.
 */
export function settlementRows(deal: any): MoneyRow[] {
  const kind = numbersKind(deal)

  if (kind === 'refinance') {
    const rows: MoneyRow[] = []
    const add = (label: string, n: number, total = false) => {
      if (n > 0) rows.push({ label, value: money(n), ...(total ? { total: true } : {}) })
    }
    add('Existing loan being paid out', balanceTotal(deal?.bc_data || {}))
    add('New loan amount', loanForEmail(deal))
    // LAST AND RULED OFF, because it is the only line they will look for.
    add('Surplus to you', cashOut(deal), true)
    return rows
  }

  if (kind === 'purchase') {
    const f = fundsToComplete(deal)
    // NOT WORKABLE MEANS THE TOTAL WOULD BE WRONG. A mixed deal with the split
    // roles unanswered still has lines worth showing on a screen, but this is a
    // client email - a column of figures with a wrong total at the bottom is
    // the single worst thing this email could carry.
    if (!f.applies || !f.workable) return []
    const rows: MoneyRow[] = f.lines
      .filter(l => l.amount > 0)
      .map(l => ({
        // A SOURCE IS NOT A COST. The loan and the deposit pay FOR the purchase,
        // so they read as what they are rather than sitting in the same column
        // as the price.
        label: l.kind === 'source' ? `Less ${l.label.toLowerCase()}` : l.label,
        value: money(l.amount),
      }))
    if (rows.length === 0) return []
    rows.push({ label: 'You will need on the day', value: money(f.toFind), total: true })
    return rows
  }

  return []
}

/**
 * WHAT IS STOPPING THE TABLE, IN WORDS.
 *
 * Said on the send screen, never swallowed. Each one is a thing somebody can go
 * and record, which is the only kind of problem worth printing.
 */
export function settlementNumbersGaps(deal: any): string[] {
  const kind = numbersKind(deal)
  if (kind === 'none') {
    return ['This deal is neither a purchase nor a refinance, so the portal has no settlement '
      + 'breakdown for it. Type the figures into the box below.']
  }

  if (kind === 'refinance') {
    const out: string[] = []
    if (cashOut(deal) <= 0) {
      out.push('Nothing is being released on this refinance, so there are no settlement numbers to '
        + 'send. On a dollar-for-dollar refinance this email is not sent at all.')
    }
    if (balanceTotal(deal?.bc_data || {}) <= 0) {
      out.push('No balance being refinanced is recorded, so the payout line is left out.')
    }
    return out
  }

  const f = fundsToComplete(deal)
  const out = [...f.missing]
  if (!f.workable && f.applies) {
    out.push('The split roles have not been answered, so the total would be wrong and the table is '
      + 'left out entirely.')
  }
  // THE TWO FIGURES THAT SHOULD AGREE AND SOMETIMES DO NOT. Said plainly: this
  // email is the last thing a client reads before they move money.
  if (f.deposit !== null && !f.depositAgrees) {
    out.push(`The recorded deposit (${money(f.deposit)}) does not match what the figures say they `
      + `have to find (${money(f.toFind)}). One of the two is wrong - check before this goes.`)
  }
  return out
}

/** "your Bankwest offset account ending 4417", where anybody has recorded one. */
export function surplusGoesTo(deal: any): string {
  const docs = deal?.settlement_documents
  const signed = docs && typeof docs === 'object' ? (docs as any).signed : null
  const nominated = String(signed?.read?.offsetAccount || '').trim()
  return nominated
}
