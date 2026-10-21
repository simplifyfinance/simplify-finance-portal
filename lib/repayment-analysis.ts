// WHAT HAPPENS IF THEY KEEP PAYING WHAT THEY PAY NOW.
//
// 21 Oct 2026. Fabio: "stress the importance of refinancing your loan BUT
// keeping the remaining loan term but also show the impact of keeping your
// current repayments and how many years of your mortgage and interest you would
// save if you continue your CURRENT repayments AFTER the refinance to a lower
// rate."
//
// A client refinances, the repayment drops, and the saving disappears into the
// week. The whole point of this is the one sentence nobody says to them: the
// same money can leave your account and take years off the loan instead.
//
// ---------------------------------------------------------------------------
// IT MATCHES HIS OWN CALCULATOR, WHICH IS WHY IT AMORTISES MONTH BY MONTH
// ---------------------------------------------------------------------------
//
// simplifyfinance.com.au/calculators/repayment is already on his website and a
// client can run their own numbers in it. If our email says one thing and his
// site says another, both are worthless.
//
// The closed-form formula is a month out, every time, because the final payment
// is a part payment and the formula returns a fraction where a bank charges a
// whole month. Checked against his own worked example - $400,000 over 30 years
// at 5.99% with $200 a month extra - this returns $2,596 a month, 24 years 7
// months and $364,412 of interest. His site: the same, to the dollar.

import { readMoney } from './money'

const n = (v: any) => readMoney(v) ?? 0
const txt = (v: any) => String(v ?? '').trim()

export const CALCULATOR_DISCLAIMER =
  'The results from this calculator should be used as an indication only. Results do not represent '
  + 'either quotes or pre-qualifications for the product. Individual institutions apply different '
  + 'formulas. Information such as interest rates quoted and default figures used in the assumptions '
  + 'are subject to change.'

export type Leg = { months: number; interest: number }

export type Analysis = {
  balance: number
  yearsRemaining: number
  currentRate: number
  newRate: number
  currentRepayment: number
  /** The minimum on the new rate over the SAME remaining term. Never a fresh 30 years. */
  newRepayment: number
  /** What the rate drop frees up. The client is never asked for this. */
  extraPerMonth: number
  stay: Leg
  lower: Leg
  keep: Leg
  interestSaved: number
  monthsSaved: number
}

/**
 * The minimum repayment on a balance at a rate over a number of months.
 *
 * Rounded to the cent before anything is done with it, because a bank bills a
 * repayment, not a real number, and the schedule below has to start from the
 * same figure the client sees on their statement.
 */
export function minimumRepayment(balance: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12
  if (balance <= 0 || months <= 0) return 0
  if (r <= 0) return Math.round((balance / months) * 100) / 100
  return Math.round((balance * r / (1 - Math.pow(1 + r, -months))) * 100) / 100
}

/**
 * MONTH BY MONTH, THE WAY A BANK DOES IT AND THE WAY HIS CALCULATOR DOES IT.
 *
 * The last month is a part payment, and it still counts as a month - which is
 * the whole of the difference between this and the textbook formula.
 *
 * A repayment that does not cover the interest never clears the loan. It
 * returns null rather than looping, because "this never gets paid off" is a
 * real answer and a silent 1,200-month cap is not.
 */
export function schedule(balance: number, annualRate: number, repayment: number): Leg | null {
  const r = annualRate / 100 / 12
  if (balance <= 0 || repayment <= 0) return null
  if (r > 0 && repayment <= balance * r) return null
  let bal = balance
  let interest = 0
  let months = 0
  while (bal > 0.005) {
    const i = bal * r
    const paid = Math.min(repayment, bal + i)
    bal = bal + i - paid
    interest += i
    months += 1
    if (months > 1200) return null
  }
  return { months, interest: Math.round(interest) }
}

/**
 * The three legs, from figures somebody has actually recorded.
 *
 * null where it cannot be worked out. Never a partial answer - a table with one
 * column missing reads as a finished table.
 *
 * THE REPAYMENT IS THEIRS, NOT OURS. `currentRepayment` is what leaves their
 * account: it may carry a package fee, or extra they already pay. The portal
 * does not work it out and does not correct it. Everything else follows from
 * it, which is also why a typo in it is worth more than a typo anywhere else on
 * this form.
 */
export function analyse(input: {
  balance: any; currentRate: any; yearsRemaining: any; currentRepayment: any; newRate: any
}): Analysis | null {
  const balance = n(input.balance)
  const currentRate = n(input.currentRate)
  const newRate = n(input.newRate)
  const years = n(input.yearsRemaining)
  const currentRepayment = n(input.currentRepayment)
  if (balance <= 0 || currentRate <= 0 || newRate <= 0 || years <= 0 || currentRepayment <= 0) return null

  // A NEW RATE THAT IS NOT LOWER HAS NOTHING TO SAY. There is no saving to keep
  // and the table would argue against the refinance it is attached to.
  if (newRate >= currentRate) return null

  const months = Math.round(years * 12)
  const newRepayment = minimumRepayment(balance, newRate, months)

  const stay = schedule(balance, currentRate, currentRepayment)
  const lower = schedule(balance, newRate, newRepayment)
  const keep = schedule(balance, newRate, currentRepayment)
  if (!stay || !lower || !keep) return null

  // TIME SAVED IS WHAT THE REFINANCE DELIVERS, NOT WHAT THEY HAVE ALREADY DONE.
  //
  // 21 Oct 2026, found by auditing the maths against an independent integer-cent
  // ledger before the figures went anywhere near a client.
  //
  // This measured against the term they typed. On a client paying exactly their
  // minimum that is correct. On one already paying extra - and plenty round
  // their repayment up - it claimed credit for the head start they gave
  // themselves. A client paying $4,500 against a $3,917 minimum would have been
  // told the refinance saves 7 years 7 months. It saves 1 year 4 months.
  //
  // So it is measured against the leg beside it: what staying put actually
  // achieves on THEIR repayment, against what the lower rate achieves on the
  // same money. Both legs are simulated the same way, so the comparison is
  // like for like and the answer is the benefit of the refinance alone.
  //
  // Interest saved was never affected - it has always been these same two legs.
  return {
    balance, yearsRemaining: years, currentRate, newRate, currentRepayment, newRepayment,
    extraPerMonth: Math.round((currentRepayment - newRepayment) * 100) / 100,
    stay, lower, keep,
    interestSaved: stay.interest - keep.interest,
    monthsSaved: Math.max(0, stay.months - keep.months),
  }
}

export function yearsAndMonths(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y <= 0) return `${m} month${m === 1 ? '' : 's'}`
  if (m <= 0) return `${y} year${y === 1 ? '' : 's'}`
  return `${y} year${y === 1 ? '' : 's'} ${m} month${m === 1 ? '' : 's'}`
}

// ---------------------------------------------------------------------------
// WHERE IT IS OFFERED, AND WHERE IT WOULD BE NONSENSE
// ---------------------------------------------------------------------------

/** The scenario that IS the analysis, sent on its own. */
// Fabio, 21 Oct 2026: "offer option on refinance and equity cash out",
// "complex refinance and debt recycling out".
//
// THE STANDALONE EMAIL IS NOT A SCENARIO. It lives in Templates, beside the
// other emails a broker sends without a deal behind them - Fabio: "move that
// template to templates section not deal specific". I built it as a BC
// scenario first, which put a sixteenth entry in the picker for something that
// is not a way of structuring a loan. See lib/refinance-calculations.ts.
const OFFERED_ON = ['refinance_only', 'refinance_equity']

export function offersAnalysis(template: any): boolean {
  return OFFERED_ON.includes(txt(template))
}

/**
 * ON AN EQUITY CASH OUT IT IS THE REFINANCED LOAN AND NOTHING ELSE.
 *
 * Fabio, 21 Oct 2026: "on equity cash out how about we only compare existing
 * loan amount and exclude equity."
 *
 * He is right, and the figures say why. They owe $600,000 and pay $3,917. We
 * refinance that and release $150,000. After settlement they pay $4,646 - the
 * refinanced split at $3,717 plus the release at $929. Their TOTAL repayment
 * goes up by $729. An email telling them to keep paying $3,917 without saying
 * what it is about is telling them something false about their own budget.
 *
 * So the analysis is about the balance being refinanced, which is what the
 * client already owes - never the new total lending.
 */
export function analysedBalance(bc: any): number {
  const ids: string[] = Array.isArray(bc?.securityIds) ? bc.securityIds.map(String) : []
  const balances = bc?.securityBalances
  if (ids.length > 0 && balances && typeof balances === 'object') {
    const total = ids.reduce((t, id) => t + n(balances[id]), 0)
    if (total > 0) return total
  }
  return n(bc?.existingLoanBal)
}

/** The equity being released, which is the part the analysis leaves out. */
export function releasedAlongside(bc: any): number {
  const releases = bc?.securityReleases
  if (releases && typeof releases === 'object') {
    const total = Object.values(releases).reduce((t: number, v: any) => t + n(v), 0)
    if (total > 0) return total
  }
  return n(bc?.equityRelease)
}

const splitsOf = (bc: any): any[] => Array.isArray(bc?.splits) ? bc.splits : []
const isIO = (s: any) => /interest only|^io$/i.test(txt(s?.type))

/**
 * The split the analysis is about: the one holding the loan being refinanced.
 *
 * The first real split, which on both scenarios is the refinanced loan - that
 * is what TEMPLATE_DEFAULTS puts there and what every one of these deals is
 * recorded as.
 */
export function refinancedSplit(bc: any): any {
  return splitsOf(bc).find(s => n(s?.amount) > 0) || null
}

/**
 * WHY IT IS NOT ON OFFER, in words a broker can act on.
 *
 * Empty means it IS on offer. A greyed tick box with no reason beside it is a
 * support call, and somebody will ask why it shows on one deal and not another.
 */
export function whyNotOffered(bc: any): string {
  const template = txt(bc?.template)
  if (!offersAnalysis(template)) {
    return 'Only on a refinance. There is no current repayment to keep on a purchase, '
      + 'and on a top up the repayment goes up rather than down.'
  }
  // AN EMPTY FORM IS NOT A REASON TO GREY THIS OUT.
  //
  // 21 Oct 2026. Fabio, on a refinance he had just started: "the box you mock
  // up to tick to show the refinance analysis is not showing". It was there and
  // it was disabled, because no split had an amount yet - which is true of
  // every BC for the first few minutes of its life. A broker ticks the box when
  // they decide to show the analysis, then fills the figures in.
  //
  // So this answers only "does the analysis make sense on this deal at all".
  // What is still missing is said inside the panel, by analysisMissing, where
  // it reads as a to-do rather than a refusal.
  const split = refinancedSplit(bc)
  // Fabio, 21 Oct 2026: "NEVER offer if IO as this doesnt make sense". Nothing
  // is paying the balance down, so there are no years to take off and no
  // interest saved - the table would be three identical rows.
  if (split && isIO(split)) {
    return 'Not available — this loan is interest only. Nothing is paying the balance down, '
      + 'so there are no years to take off and no interest to save.'
  }
  // The release has to be its own split or there is no separate repayment to
  // keep, and nothing honest to say about keeping it.
  if (releasedAlongside(bc) > 0 && splitsOf(bc).filter(s => n(s?.amount) > 0).length < 2) {
    return 'Not available — the equity release is rolled into one loan, so there is no '
      + 'separate repayment on the refinanced portion to keep.'
  }
  return ''
}

export function analysisOn(bc: any): boolean {
  if (whyNotOffered(bc)) return false
  return bc?.repaymentAnalysis === true
}

/**
 * The analysis for a deal, or null.
 *
 * `newRate` is passed in because the answer differs by where it is asked: the
 * BC knows the rate on its own split, and the lending options knows the rate on
 * the recommended product - and Fabio asked for the lending options to follow
 * the recommendation rather than the BC. One function, told which rate to use,
 * rather than two that can disagree.
 */
export function analysisFor(bc: any, ff: any, newRate?: any): Analysis | null {
  if (!analysisOn(bc)) return null
  const split = refinancedSplit(bc)
  const rate = txt(newRate) || txt(split?.rate)
  return analyse({
    balance: analysedBalance(bc),
    currentRate: currentRateOf(bc, ff),
    yearsRemaining: bc?.analysisYearsRemaining,
    currentRepayment: bc?.analysisCurrentRepayment,
    newRate: rate,
  })
}

/**
 * WHAT THEY PAY TODAY, FROM THE FACT FIND. Every property there carries its
 * loans and every loan its rate - it is what lib/top-up.ts reads to hold the
 * existing lender's rate. Asking for it again on this form would be the same
 * fact in two places, free to disagree.
 *
 * ONE RATE OR NONE. Two loans with two rates have no single answer, and a guess
 * puts a figure nobody typed at the top of a client's email. A typed override
 * always wins.
 */
export function currentRateOf(bc: any, ff: any): string {
  const typed = txt(bc?.analysisCurrentRate)
  if (typed) return typed
  const ids = new Set((Array.isArray(bc?.securityIds) ? bc.securityIds : []).map((x: any) => txt(x)))
  const props: any[] = Array.isArray(ff?.properties) ? ff.properties : []
  const rates = new Set<string>()
  for (const p of props) {
    if (ids.size > 0 && !ids.has(txt(p?.id))) continue
    for (const l of (Array.isArray(p?.loans) ? p.loans : [])) {
      const r = txt(l?.interestRate)
      if (r) rates.add(r)
    }
  }
  return rates.size === 1 ? [...rates][0] : ''
}

/** What is still needed before the block can be drawn, for the missing list. */
export function analysisMissing(bc: any, ff: any): string[] {
  if (!analysisOn(bc)) return []
  const out: string[] = []
  if (n(bc?.analysisYearsRemaining) <= 0) out.push('Years remaining on the current loan')
  if (n(bc?.analysisCurrentRepayment) <= 0) out.push('The current monthly repayment')
  if (n(currentRateOf(bc, ff)) <= 0) out.push('The rate they are on today')
  return out
}

// ---------------------------------------------------------------------------
// THE BLOCK, BUILT ONCE
// ---------------------------------------------------------------------------
//
// 21 Oct 2026. Three things draw it: the tick box on Refinance only, the tick
// box on Refinance + equity release, and the Refinance repayment analysis
// scenario where the block IS the email. Fabio asked for the standalone one
// knowing the risk - so it is built here and nothing else owns a copy. Two
// versions of this table are two sets of figures free to drift, which is the
// fault this portal keeps paying for.
//
// WORD PAINTS A BACKGROUND ONLY FROM bgcolor ON A td OR table, and drops colour
// set on a <p>. Every colour below sits on a span inside its paragraph, and
// every fill is a bgcolor attribute. scripts/check-email-html.sh fails the ship
// otherwise, and it is right to.

const dollars = (v: number) => '$' + Math.round(v).toLocaleString('en-AU')

function cell(t: string, align: 'left' | 'right', bold: boolean, dim = false) {
  return `<td align="${align}" style="padding:8px 8px 8px 0;border-top:1px solid #F0EEE9;`
    + `font-family:Arial,sans-serif;font-size:12.5px;white-space:nowrap">`
    + `<span style="color:${dim ? '#6b6b66' : bold ? '#1a1a1a' : '#3d3d3a'};`
    + `${bold ? 'font-weight:bold;' : ''}">${t}</span></td>`
}

function head(t: string, align: 'left' | 'right') {
  return `<td align="${align}" style="padding:0 8px 6px 0;font-family:Arial,sans-serif;font-size:9.5px;`
    + `letter-spacing:.5px"><span style="color:#6b6b66;font-weight:bold;text-transform:uppercase;">`
    + `${t}</span></td>`
}

/**
 * The analysis, as the client reads it.
 *
 * `lead` is the sentence above the pull quote. It differs by where the block is
 * drawn - on an equity release it has to name the portion, because the client's
 * TOTAL repayment goes up and a bare "keep paying $3,917" is false about their
 * own budget.
 */
export function analysisBlockHtml(a: Analysis, opts: { lead: string; heading?: string }): string {
  const keepYears = yearsAndMonths(a.keep.months)
  const row = (label: string, pay: number, term: string, interest: number, win = false) =>
    `<tr>`
    + (win
      ? `<td bgcolor="#EAFAF4" style="padding:8px 8px 8px 0;border-top:1px solid #F0EEE9;border-left:3px solid #137A55;font-family:Arial,sans-serif;font-size:12.5px"><span style="color:#1a1a1a;font-weight:bold;">${label}</span></td>`
        + `<td bgcolor="#EAFAF4" align="right" style="padding:8px 8px 8px 0;border-top:1px solid #F0EEE9;font-family:Arial,sans-serif;font-size:12.5px;white-space:nowrap"><span style="color:#1a1a1a;font-weight:bold;">${dollars(pay)}</span></td>`
        + `<td bgcolor="#EAFAF4" align="right" style="padding:8px 8px 8px 0;border-top:1px solid #F0EEE9;font-family:Arial,sans-serif;font-size:12.5px;white-space:nowrap"><span style="color:#1a1a1a;font-weight:bold;">${term}</span></td>`
        + `<td bgcolor="#EAFAF4" align="right" style="padding:8px 8px 8px 0;border-top:1px solid #F0EEE9;font-family:Arial,sans-serif;font-size:12.5px;white-space:nowrap"><span style="color:#1a1a1a;font-weight:bold;">${dollars(interest)}</span></td>`
      : cell(label, 'left', false) + cell(dollars(pay), 'right', true)
        + cell(term, 'right', true) + cell(dollars(interest), 'right', true))
    + `</tr>`

  return ''
    + `<p style="font-size:11px;margin:0 0 10px;padding-top:14px;border-top:1px solid #E4E2DC;letter-spacing:.9px">`
    + `<span style="color:#1a1a1a;font-weight:bold;text-transform:uppercase;">`
    + `${opts.heading || 'If you keep your repayment where it is'}</span></p>`

    + `<p style="font-size:13.5px;line-height:1.62;margin:0 0 12px"><span style="color:#3d3d3a;">`
    + `${opts.lead}</span></p>`

    // The pull quote. A left border rather than a fill, so it still reads on a
    // phone with images off and in a client that strips backgrounds.
    + `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr>`
    + `<td style="border-left:3px solid #2DBEFF;padding:3px 0 3px 13px;font-family:Arial,sans-serif">`
    + `<p style="font-size:20px;line-height:1.25;margin:0"><span style="color:#1a1a1a;font-weight:bold;">`
    + `${dollars(a.interestSaved)} saved, ${yearsAndMonths(a.monthsSaved)} earlier</span></p>`
    + `<p style="font-size:12px;margin:3px 0 0"><span style="color:#6b6b66;">`
    + `for no change in what leaves your account</span></p>`
    + `</td></tr></table>`

    + `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px">`
    + `<tr>${head('&nbsp;', 'left')}${head('Repayment', 'right')}${head('Finishes', 'right')}${head('Interest', 'right')}</tr>`
    // WHEN STAYING PUT REALLY ENDS. The stated term assumes they pay the
    // minimum; a client already paying extra finishes sooner and knows it, so
    // printing their stated term beside their own repayment is a figure they
    // can see is wrong.
    + row('Stay as you are', a.currentRepayment, yearsAndMonths(a.stay.months), a.stay.interest)
    + row('Take the lower repayment', a.newRepayment, yearsAndMonths(Math.round(a.yearsRemaining * 12)), a.lower.interest)
    + row(`Keep paying ${dollars(a.currentRepayment)}`, a.currentRepayment, keepYears, a.keep.interest, true)
    + `</table>`

    + `<p style="font-size:13.5px;line-height:1.62;margin:0 0 12px"><span style="color:#3d3d3a;">`
    + `The same money leaves your account on the same day. It just stops paying the bank&rsquo;s interest. `
    + `We also keep the time you have left on the loan as it is &mdash; a refinance that starts you again `
    + `at 30 years makes the monthly number look smaller and costs you more.</span></p>`
}

/** The lead sentence, which is the one thing that changes by scenario. */
export function analysisLead(a: Analysis, opts: { released?: number; releaseRepayment?: number } = {}): string {
  const released = opts.released || 0
  if (released > 0) {
    const total = a.newRepayment + (opts.releaseRepayment || 0)
    return `Your repayment on the loan you already have falls by ${dollars(a.extraPerMonth)} a month. `
      + `The ${dollars(released)} you are releasing is a separate split with its own repayment`
      + (opts.releaseRepayment ? ` of ${dollars(opts.releaseRepayment)}, so your total will be ${dollars(total)}` : '')
      + `. The question below is only about the first part.`
  }
  return `Your repayment drops by ${dollars(a.extraPerMonth)} a month. `
    + `The bigger decision is what you do with it.`
}

/** The disclaimer, on every email that carries the block. Fabio's wording. */
export function analysisDisclaimerHtml(): string {
  return `<p style="font-size:10.5px;line-height:1.55;margin:12px 0 0;padding-top:11px;`
    + `border-top:1px solid #E4E2DC"><span style="color:#8a8a84;">`
    + `<span style="color:#6b6b66;font-weight:bold;">Calculator Disclaimer</span><br>`
    + `${CALCULATOR_DISCLAIMER}</span></p>`
}
