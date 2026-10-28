// FROM THE ASSESSMENT ONTO THE FACT FIND.
//
// 28 Oct 2026. The last piece of the payslip job. lib/annualise-income.ts works
// out what somebody earns in a year and lib/payslip-lines.ts works out what
// each line is. This decides what lands in the six boxes everything downstream
// actually reads.
//
// IT IS SMALL AND IT IS THE PART THAT CHANGES SOMEBODY'S FILE. Everything
// before it is a screen. This writes.
//
// THREE THINGS IT HOLDS:
//
//   1. WHICH COLUMN. Full or at 80%. Never chosen here - the person presses one
//      of two buttons and that is the credit decision, made once a lender is in
//      view. Fabio: "that is a credit decision later on so keep it simple."
//
//   2. BASE AND ALLOWANCE ARE TWO BOXES, NOT ONE. The fact find keeps Gross
//      salary and Allowance apart and so does this. Adding them into Gross
//      would still total right and would quietly tell every lender that an
//      allowance is salary.
//
//   3. IT REFUSES TO WRITE A LINE NOBODY HAS PLACED. A payslip line this
//      portal has no rule for - "Site Uplift 7B" - has no box to go in. It is
//      shown, it is counted in the totals on screen, and the press is blocked
//      until a person says what it is. Folding it into Allowance to get the
//      button working would put unshaded money on a file on the strength of a
//      name nobody recognised.
//
// NOTHING HERE WRITES TO THE DATABASE. It returns the six values and the
// sentence for the file. The form saves them the way it saves everything else,
// through the guarded path.
import type { Assessment, LineKey } from './annualise-income'

export type Column = 'full' | 'shaded'

/** The six boxes on the PAYG income card, as the fact find stores them. */
export type Fields = {
  grossSalary: string
  allowanceAmount: string
  overtimeEssentialAmount: string
  overtimeNonEssentialAmount: string
  commissionAmount: string
  bonusAmount: string
}

export const EMPTY_FIELDS: Fields = {
  grossSalary: '', allowanceAmount: '',
  overtimeEssentialAmount: '', overtimeNonEssentialAmount: '',
  commissionAmount: '', bonusAmount: '',
}

/** What a line needs to carry for us to know whether it has been placed. */
export type SeenLine = {
  label: string
  ytd: number | null
  notIncome?: boolean
  /** False where lib/payslip-lines.ts had no rule for the label. */
  recognised?: boolean
}

/**
 * THE LINES THAT HAVE TO BE SETTLED BEFORE ANYTHING CAN BE WRITTEN.
 *
 * A line with no figure on it cannot change a total, so it is not in the way.
 * A line somebody has already called "not income" is settled. Everything else
 * the portal could not place is listed here by name, and the screen asks.
 */
export function unsettled(lines: SeenLine[]): string[] {
  return (lines || [])
    .filter(l => l && l.recognised === false && !l.notIncome && typeof l.ytd === 'number')
    .map(l => String(l.label))
}

const money = (n: number): string => (n > 0 ? String(Math.round(n)) : '')

function totalFor(a: Assessment, key: LineKey, column: Column): number {
  return (a?.lines || [])
    .filter(l => l.key === key)
    .reduce((t, l) => t + (column === 'full' ? l.full : l.shaded), 0)
}

/**
 * THE SIX VALUES, FROM ONE COLUMN.
 *
 * `essentialOvertime` is the one thing a payslip cannot answer. It prints
 * "Overtime" and nothing else; whether this is an ambulance officer or a
 * warehouse is on the file, not the payslip, and the fact find keeps the two
 * apart because lenders do. It goes in as non-essential - the shaded one -
 * unless a person says otherwise, so the only way it moves is upwards and by
 * hand.
 *
 * A figure of nought is written as an empty box rather than "0". A zero in
 * Commission reads as "we checked and there is none"; an empty box reads as
 * "there is none", and on a PAYG payslip those are the same thing. It is the
 * screen that is honest about what was looked at, not a row of noughts.
 */
export function toFactFind(
  a: Assessment, column: Column, opts?: { essentialOvertime?: boolean },
): Fields {
  const overtime = totalFor(a, 'overtime', column)
  const essential = Boolean(opts?.essentialOvertime)
  return {
    grossSalary: money(totalFor(a, 'base', column)),
    allowanceAmount: money(totalFor(a, 'allowance', column)),
    overtimeEssentialAmount: essential ? money(overtime) : '',
    overtimeNonEssentialAmount: essential ? '' : money(overtime),
    commissionAmount: money(totalFor(a, 'commission', column)),
    bonusAmount: money(totalFor(a, 'bonus', column)),
  }
}

const dollars = (n: number) => '$' + Math.round(n).toLocaleString('en-AU')

const auDate = (d: Date) =>
  d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * THE LINE THAT GOES IN THE FILE.
 *
 * It carries BOTH totals, not just the one that was used. Six months later the
 * question an auditor asks is not what the figure was - that is on the fact
 * find - it is what else was on the table when somebody chose it.
 */
export function whatHappened(
  a: Assessment, column: Column, opts?: { payslips?: number; short?: boolean },
): string {
  const n = Math.max(1, Math.round(opts?.payslips || 1))
  const used = column === 'full' ? 'Full' : `At ${Math.round(a.rate * 100)}%`
  const parts = [
    `Income assessed from ${n} ${n === 1 ? 'payslip' : 'payslips'}`
      + ` to ${auDate(a.coverage.to)}.`,
    `Full ${dollars(a.totals.full)}, at ${Math.round(a.rate * 100)}%`
      + ` ${dollars(a.totals.shaded)}. ${used} used.`,
  ]
  // A short year to date that somebody used anyway is the single most useful
  // thing this line can say, so it is said plainly and not softened.
  if (opts?.short || !a.coverage.enough) {
    parts.push(
      `Only ${a.coverage.days} days of year to date - under the`
      + ` ${a.coverage.monthsNeeded} months a lender asks for. Used anyway.`)
  }
  return parts.join(' ')
}
