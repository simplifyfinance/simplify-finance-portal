// THE PRODUCT, ON THE BROKER SUBMISSION NOTES.
//
// 16 Nov 2026. Fabio, looking at a set of notes: "when we issue compliance, we
// generate what's called a broker note. There's no section in there... I want
// to show the actual product, which is what we're ticking on lending options.
// So it'll be the name of the product. So for example, Bankwest Complete, if
// it's P&I, the interest rates, I want all those details."
//
// The notes had a column headed PRODUCT TYPE, printing "Prime". That is the
// product's CATEGORY. A credit assessor reading it cannot tell which product
// was recommended, what rate it carries, or whether it has an offset - all
// three chosen and recorded on Lending options, and all three missing from the
// sheet the bank reads.
//
// ---------------------------------------------------------------------------
// NOTHING HERE IS TYPED TWICE, AND NOTHING IS GUESSED
// ---------------------------------------------------------------------------
//
// Every value comes off the option that was ticked - recommendedOption() in
// lib/recommended-option.ts, which is the portal's single answer to "which one
// was chosen" and returns null rather than guessing between two.
//
// An option holds four rate modules, and at most the enabled ones matter:
//
//   variablePI  rate
//   variableIO  rate, ioYears
//   fixedPI     rate, fixedYears
//   fixedIO     rate, fixedYears, ioYears
//
// WHAT FABIO ASKED FOR, 16 Nov, asked straight:
//
//   "The loan is fixed. I want the fixed term. I don't need a revert rate. So
//    just the fixed rate and how many years it's fixed. And if it's P&I,
//    that's okay. But if it's IO, how many years IO?"
//
// So: no revert rate anywhere. Fixed says how long it is fixed for. Interest
// only says how long it is interest only for. "IO" on its own told nobody
// anything - one year and ten years printed identically, which is the same
// fault repaymentLine() fixed on the splits table.

const txt = (v: any) => String(v ?? '').trim()

const num = (v: any) => {
  const n = Number(txt(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

const years = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`

export type RateModule = {
  enabled?: boolean
  rate?: any
  repayment?: any
  loanTerm?: any
  ioYears?: any
  fixedYears?: any
}

export type Chosen = {
  lenderName?: any
  productName?: any
  variablePI?: RateModule
  variableIO?: RateModule
  fixedPI?: RateModule
  fixedIO?: RateModule
  offsetAccount?: any
  annualFee?: any
  [k: string]: any
}

export type ProductLines = {
  /** "Bankwest — Complete Home Loan", or '' when nothing was ticked. */
  product: string
  /** "Fixed — 2 years" / "Variable". */
  rateType: string
  /** "Interest only — 5 years" / "Principal & interest". */
  repayments: string
  /** "6.54% p.a." */
  rate: string
  // NO COMPARISON RATE. 26 Nov 2026 - see the note in productLines().
  term: string
  offset: string
  annualFee: string
}

// THE ORDER THEY ARE ASKED IN. A deal is fixed or it is not, and it is interest
// only or it is not; where an option has more than one module enabled the fixed
// one is the one the bank is being asked for.
const MODULES: Array<{ key: keyof Chosen; fixed: boolean; io: boolean }> = [
  { key: 'fixedIO',    fixed: true,  io: true  },
  { key: 'fixedPI',    fixed: true,  io: false },
  { key: 'variableIO', fixed: false, io: true  },
  { key: 'variablePI', fixed: false, io: false },
]

/** The enabled module that the notes should print, or null. */
export function moduleOn(chosen: Chosen | null | undefined):
    { mod: RateModule; fixed: boolean; io: boolean } | null {
  if (!chosen) return null
  for (const m of MODULES) {
    const mod = chosen[m.key] as RateModule | undefined
    if (mod?.enabled) return { mod, fixed: m.fixed, io: m.io }
  }
  return null
}

/** "Fixed — 2 years" / "Variable" / '' when nothing is recorded. */
export function rateTypeLine(chosen: Chosen | null | undefined): string {
  const on = moduleOn(chosen)
  if (!on) return ''
  if (!on.fixed) return 'Variable'
  const n = num(on.mod.fixedYears)
  // NO REVERT RATE. Asked for and declined on 16 Nov: "I don't need a revert
  // rate. So just the fixed rate and how many years it's fixed."
  return n > 0 ? `Fixed — ${years(n)}` : 'Fixed'
}

/** "Interest only — 5 years" / "Principal & interest". */
export function repaymentsLine(chosen: Chosen | null | undefined): string {
  const on = moduleOn(chosen)
  if (!on) return ''
  if (!on.io) return 'Principal & interest'
  const n = num(on.mod.ioYears)
  return n > 0 ? `Interest only — ${years(n)}` : 'Interest only'
}

/** Everything the section prints. Empty strings where nothing was recorded. */
export function productLines(chosen: Chosen | null | undefined): ProductLines {
  const on = moduleOn(chosen)
  const lender = txt(chosen?.lenderName)
  const name = txt(chosen?.productName)
  const rate = on ? num(on.mod.rate) : 0
  const term = on ? num(on.mod.loanTerm) : 0
  const fee = num(chosen?.annualFee)
  const offset = chosen?.offsetAccount

  return {
    product: [lender, name].filter(Boolean).join(' — '),
    rateType: rateTypeLine(chosen),
    repayments: repaymentsLine(chosen),
    rate: rate > 0 ? `${rate}% p.a.` : '',
    // THERE IS NO COMPARISON RATE AND THERE NEVER WAS - 26 Nov 2026.
    //
    // The Broker Notes PDF carried a "Comparison rate" line reading from
    // chosen.comparison. Nothing in the portal has ever written that field -
    // there is no box anywhere to type one into - so it printed "Not recorded"
    // on all 311 deals in the book.
    //
    // Raised by Cath as a field that was not carrying over. It was not. Fabio:
    // "We don't have comparison rate... We never send comparison rate to
    // anyone." So the line came off the document rather than a box being added
    // to feed it. A row that is always empty is worse than no row: it teaches
    // whoever reads the sheet that this part of it can be skipped.
    term: term > 0 ? years(term) : '',
    // A BLANK IS NOT A NO. Nobody ticked the box either way, and printing "No"
    // on a product that has an offset is worse than printing nothing.
    offset: offset === true || txt(offset).toLowerCase() === 'yes' ? 'Yes'
      : offset === false || txt(offset).toLowerCase() === 'no' ? 'No' : '',
    annualFee: fee > 0 ? `$${fee.toLocaleString('en-AU')}` : '',
  }
}

/**
 * WHAT THE SECTION SAYS WHEN NOTHING WAS TICKED.
 *
 * 15-16 Nov 2026, Fabio's rule for every screen in the portal: "if it's blank,
 * it's blank, but the boxes are there. The screen is never blank." It holds
 * harder on a sheet a bank reads - a missing section tells a credit assessor
 * nothing at all, while an empty one tells them to go and look at Lending
 * options.
 */
export const NOTHING_TICKED = 'No product recorded on Lending options.'

export function hasProduct(chosen: Chosen | null | undefined): boolean {
  const l = productLines(chosen)
  return !!(l.product || l.rate)
}
