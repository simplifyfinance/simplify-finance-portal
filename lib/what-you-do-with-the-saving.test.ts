import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  minimumRepayment, schedule, analyse, yearsAndMonths, offersAnalysis, whyNotOffered,
  analysisOn, analysedBalance, releasedAlongside, currentRateOf, analysisFor,
  analysisLead, analysisBlockHtml, CALCULATOR_DISCLAIMER, analysisMissing,
} from './repayment-analysis'
import { TEMPLATE_LABELS } from './templates'

// WHAT HAPPENS IF THEY KEEP PAYING WHAT THEY PAY NOW.
//
// 21 Oct 2026. Fabio wants a client shown that the same money can leave their
// account and take years off the loan instead of disappearing into the week.

const bc = (over: any = {}) => ({
  template: 'refinance_only',
  securityIds: ['p1'],
  securityBalances: { p1: '600,000' },
  repaymentAnalysis: true,
  analysisYearsRemaining: '25',
  analysisCurrentRepayment: '3,917',
  analysisCurrentRate: '6.14',
  splits: [{ label: 'Refinanced loan', amount: '600,000', rate: '5.59', type: 'P&I' }],
  ...over,
})

const ff = {
  properties: [{ id: 'p1', address: '1 Example St', value: '1,000,000',
    loans: [{ lenderName: 'St George', balance: '600,000', interestRate: '6.14' }] }],
}

describe('it agrees with his own calculator', () => {
  // simplifyfinance.com.au/calculators/repayment, his worked example:
  // $400,000 over 30 years at 5.99% with $200 a month extra. A client can run
  // this themselves, so if our email and his site disagree both are worthless.
  const base = minimumRepayment(400000, 5.99, 360)

  it('works the minimum repayment out the same', () => {
    expect(Math.round(base)).toBe(2396)
    expect(Math.round(base + 200)).toBe(2596)
  })

  it('lands on the same term and the same total interest', () => {
    const s = schedule(400000, 5.99, base + 200)!
    expect(s.months).toBe(295)            // the site: 24 years, 7 months
    expect(yearsAndMonths(s.months)).toBe('24 years 7 months')
    expect(s.interest).toBe(364412)       // the site: $364,412
  })

  it('and on the same saving', () => {
    const plain = schedule(400000, 5.99, base)!
    const extra = schedule(400000, 5.99, base + 200)!
    expect(plain.interest - extra.interest).toBeCloseTo(98016, -1)  // the site: $98,015
  })

  // The closed-form formula is a month out every time, because the final
  // payment is a part payment and a bank charges a whole month for it.
  it('counts the final part payment as a whole month, which the formula does not', () => {
    const s = schedule(100000, 6, 1000)!
    expect(Number.isInteger(s.months)).toBe(true)
  })
})

describe('the three legs', () => {
  const a = analyse({ balance: 600000, currentRate: 6.14, yearsRemaining: 25,
                      currentRepayment: 3917, newRate: 5.59 })!

  it('keeps the remaining term, never a fresh thirty years', () => {
    expect(Math.round(a.newRepayment)).toBe(3717)
    expect(a.lower.months).toBeLessThanOrEqual(301)
  })

  it('works out the extra without being told it', () => {
    expect(Math.round(a.extraPerMonth)).toBe(200)
  })

  // THE ANSWER FOLLOWS THEIR REPAYMENT, NOT A TIDY ONE. $3,917 is what a client
  // reads off a statement; the exact minimum is $3,917.32, so their own figure
  // is 32 cents short and takes a month longer. Their figure wins, because it
  // is the one leaving their account.
  it('takes years off when the repayment is kept', () => {
    expect(yearsAndMonths(a.keep.months)).toBe('22 years 6 months')
    expect(yearsAndMonths(a.monthsSaved)).toBe('2 years 7 months')
    expect(a.interestSaved).toBeCloseTo(121627, -1)
  })

  // THE FAULT AN INDEPENDENT AUDIT OF THE MATHS FOUND, 21 Oct 2026, before any
  // of this reached a client. Measured against the STATED term, a client
  // already paying extra was credited with the head start they gave
  // themselves: $4,500 against a $3,917 minimum read as 7 years 7 months saved
  // when the refinance delivers 1 year 4 months.
  it('credits the refinance only, never a head start they gave themselves', () => {
    const ahead = analyse({ balance: 600000, currentRate: 6.14, yearsRemaining: 25,
                            currentRepayment: 4500, newRate: 5.59 })!
    expect(yearsAndMonths(ahead.stay.months)).toBe('18 years 9 months')
    expect(yearsAndMonths(ahead.monthsSaved)).toBe('1 year 4 months')
    expect(ahead.monthsSaved).toBe(ahead.stay.months - ahead.keep.months)
    // Never the stated term minus the new one, which is what it used to be.
    expect(ahead.monthsSaved).not.toBe(300 - ahead.keep.months)
  })

  // Interest saved was never affected - it has always been these same two legs
  // on the same repayment.
  it('reports the interest saving correctly whatever they already pay', () => {
    const ahead = analyse({ balance: 600000, currentRate: 6.14, yearsRemaining: 25,
                            currentRepayment: 4500, newRate: 5.59 })!
    expect(ahead.interestSaved).toBe(ahead.stay.interest - ahead.keep.interest)
    expect(ahead.interestSaved).toBeCloseTo(71108, -2)
  })

  // A rate that is not lower has nothing to say, and the table would argue
  // against the refinance it is attached to.
  it('refuses a new rate that is not lower', () => {
    expect(analyse({ balance: 600000, currentRate: 5.59, yearsRemaining: 25,
                     currentRepayment: 3917, newRate: 6.14 })).toBe(null)
  })

  // "This never gets paid off" is a real answer. A silent cap is not.
  it('returns nothing when the repayment does not cover the interest', () => {
    expect(schedule(600000, 6.14, 500)).toBe(null)
  })

  it('never answers from a partial set of figures', () => {
    expect(analyse({ balance: 600000, currentRate: 6.14, yearsRemaining: 25,
                     currentRepayment: '', newRate: 5.59 })).toBe(null)
  })
})

describe('where it is offered', () => {
  it('is on the two refinance scenarios and its own, and nowhere else', () => {
    expect(offersAnalysis('refinance_only')).toBe(true)
    expect(offersAnalysis('refinance_equity')).toBe(true)
    // Fabio, 21 Oct: "complex refinance and debt recycling out".
    expect(offersAnalysis('complex_refinance')).toBe(false)
    expect(offersAnalysis('debt_recycling')).toBe(false)
    // A purchase has no current repayment to keep; a top up goes the other way.
    expect(offersAnalysis('oo_purchase')).toBe(false)
    expect(offersAnalysis('top_up')).toBe(false)
  })

  // Fabio, 21 Oct: "NEVER offer if IO as this doesnt make sense". Nothing is
  // paying the balance down, so the table would be three identical rows.
  it('is never offered on interest only', () => {
    const io = bc({ splits: [{ label: 'Refinanced loan', amount: '600,000', rate: '5.59', type: 'Interest only' }] })
    expect(whyNotOffered(io)).toContain('interest only')
    expect(analysisOn(io)).toBe(false)
    expect(analysisFor(io, ff)).toBe(null)
  })

  it('says why, rather than just going quiet', () => {
    expect(whyNotOffered(bc({ template: 'oo_purchase' }))).toContain('Only on a refinance')
    expect(whyNotOffered(bc())).toBe('')
  })

  it('is off until somebody ticks it', () => {
    expect(analysisOn(bc({ repaymentAnalysis: false }))).toBe(false)
    expect(analysisOn(bc())).toBe(true)
  })

  // 21 Oct 2026. Fabio: "when I said refinance analysis template I wanted HERE
  // not a separate BC template". It is a tick box on the scenarios that already
  // exist; the standalone email belongs in Templates, beside the other emails a
  // broker sends without a deal behind them.
  it('is not a scenario in the picker', () => {
    expect(TEMPLATE_LABELS['refinance_analysis']).toBe(undefined)
    expect(readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8'))
      .not.toContain("id: 'refinance_analysis'")
  })

  // A BOX NOBODY CAN TICK YET IS NOT THE SAME AS ONE THAT DOES NOT APPLY.
  // Fabio, on a refinance he had just started: "the box you mock up to tick to
  // show the refinance analysis is not showing". It was there and disabled,
  // because no split had an amount - which is true of every BC for its first
  // few minutes.
  it('is tickable on a form nobody has filled in yet', () => {
    const fresh = { template: 'refinance_only', splits: [{ label: 'Refinanced loan', amount: '', rate: '', type: 'P&I' }] }
    expect(whyNotOffered(fresh)).toBe('')
    expect(analysisMissing({ ...fresh, repaymentAnalysis: true }, {}).length).toBeGreaterThan(0)
  })
})

describe('an equity cash out is about the refinanced loan only', () => {
  // THE TRAP, IN ONE NUMBER. They owe $600,000 and pay $3,917. Refinance that
  // and release $150,000 and they will pay $4,646 - their total goes UP by
  // $729. "Keep paying $3,917" with no qualifier is false about their budget.
  const eq = bc({
    template: 'refinance_equity',
    equityRelease: '150,000',
    splits: [
      { label: 'Existing loan refinanced', amount: '600,000', rate: '5.59', type: 'P&I' },
      { label: 'Equity access', amount: '150,000', rate: '5.59', type: 'P&I' },
    ],
  })

  it('analyses what they already owe, not the new total lending', () => {
    expect(analysedBalance(eq)).toBe(600000)
    expect(releasedAlongside(eq)).toBe(150000)
    expect(analysisFor(eq, ff)!.balance).toBe(600000)
  })

  it('names the portion and the new total in the first line', () => {
    const a = analysisFor(eq, ff)!
    const lead = analysisLead(a, { released: 150000, releaseRepayment: 929 })
    expect(lead).toContain('$150,000')
    expect(lead).toContain('separate split')
    expect(lead).toContain('$4,646')
    expect(lead).toContain('only about the first part')
  })

  it('says nothing about a portion when there is no release', () => {
    expect(analysisLead(analysisFor(bc(), ff)!)).toContain('bigger decision is what you do with it')
  })

  // No separate split, no separate repayment to keep, nothing honest to say.
  it('is not offered when the release is rolled into one loan', () => {
    const merged = bc({
      template: 'refinance_equity', equityRelease: '150,000',
      splits: [{ label: 'One loan', amount: '750,000', rate: '5.59', type: 'P&I' }],
    })
    expect(whyNotOffered(merged)).toContain('rolled into one loan')
  })
})

describe('the rate they are on today', () => {
  it('comes off the fact find when exactly one loan has a rate', () => {
    expect(currentRateOf(bc({ analysisCurrentRate: '' }), ff)).toBe('6.14')
  })

  // Two loans with two rates have no single answer, and a guess puts a figure
  // nobody typed at the top of a client's email.
  it('comes back empty where two loans disagree', () => {
    const two = { properties: [{ id: 'p1', loans: [
      { interestRate: '6.14' }, { interestRate: '5.95' }] }] }
    expect(currentRateOf(bc({ analysisCurrentRate: '' }), two)).toBe('')
  })

  it('is always beaten by a figure somebody typed', () => {
    expect(currentRateOf(bc({ analysisCurrentRate: '7.01' }), ff)).toBe('7.01')
  })
})

describe('the block that goes to the client', () => {
  const a = analysisFor(bc(), ff)!
  const html = analysisBlockHtml(a, { lead: analysisLead(a) })

  it('shows the saving, the years and all three rows', () => {
    expect(html).toContain('$121,627')
    expect(html).toContain('2 years 7 months earlier')
    expect(html).toContain('Stay as you are')
    // Their real finish, not the stated term - a client paying extra can see
    // for themselves that the stated one is wrong.
    expect(html).toContain('25 years 1 month')
    expect(html).toContain('Take the lower repayment')
    expect(html).toContain('Keep paying $3,917')
  })

  it('says we keep the remaining term, with no figure competing with the saving', () => {
    expect(html).toContain('keep the time you have left on the loan')
    expect(html).not.toMatch(/30 years[^<]*\$/)
  })

  // Word paints a background only from bgcolor on a td or table, and drops
  // colour set on a <p>. scripts/check-email-html.sh fails the ship otherwise.
  it('is built the way Word renders', () => {
    expect(html).toContain('bgcolor="#EAFAF4"')
    expect(html).not.toContain('rgba(')
    for (const m of html.match(/<p style="[^"]*"/g) || []) {
      expect(m, `colour on a <p> is dropped by Word: ${m}`).not.toContain('color:')
    }
  })
})

describe('the disclaimer', () => {
  it('is his wording, unchanged', () => {
    expect(CALCULATOR_DISCLAIMER).toContain('should be used as an indication only')
    expect(CALCULATOR_DISCLAIMER).toContain('Individual institutions apply different formulas')
    expect(CALCULATOR_DISCLAIMER).toContain('subject to change')
  })

  // Fabio, 21 Oct: "add disclaimer on all email when we offer this". Every
  // email that can carry the block adds it, and only when it did.
  it('rides with the block on every email that can carry one', () => {
    const bcEmail = readFileSync('app/api/generate-email/route.ts', 'utf8')
    expect(bcEmail).toContain('function analysisDisclaimer(')
    expect(bcEmail.match(/analysisDisclaimer\(d\)/g)?.length).toBeGreaterThanOrEqual(2)
    const lo = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')
    expect(lo).toContain('if (analysis) body += analysisDisclaimerHtml()')
  })
})

describe('the lending options follows the recommendation', () => {
  const lo = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')

  // Fabio, 21 Oct: "it automatically pushes the data using recommend product".
  it('prices it off the starred product, not off the BC', () => {
    expect(lo).toContain('resolveLenderSplits(recommendedOption(d) as any, d.refinanceSplits)')
    expect(lo).toContain('analysisFor(bcData || {}, ffData || {}, recRate)')
  })

  // A saving built off whichever lender happens to be first is a figure
  // nobody chose.
  it('draws nothing until something is recommended', () => {
    expect(lo).toContain('const analysis = recRate ? analysisFor')
  })
})

describe('one block, three places', () => {
  // A standalone template owning its own copy of this table is two sets of
  // figures free to drift, which is the fault this portal keeps paying for.
  it('is rendered from one file and nowhere else', () => {
    const bcEmail = readFileSync('app/api/generate-email/route.ts', 'utf8')
    const lo = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')
    for (const src of [bcEmail, lo]) {
      expect(src).toContain('analysisBlockHtml')
      expect(src).not.toContain('Keep paying $')
    }
  })
})

