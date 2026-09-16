import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  repaymentOf, repaymentMismatch, balancesDisagree, cardTitle, structureLead, splitRows, realSplits,
  repaymentTypeLine,
} from './split-cards'

// ARVIND MANE, 16 SEP 2026.
//
// The BC said the repayment was $3,445. The client email said $2,912 - the
// portal's own arithmetic, printed over the figure a broker had typed. And a
// second split added to that deal appeared nowhere in the email at all.

const split = (over: any = {}) => ({
  label: '17 Dennington Lane Chelsea VIC', amount: '560,000', rate: '6.24',
  type: 'Interest only', repayment: '$3,445', ...over,
})

describe('the repayment', () => {
  it('prints what the broker typed, not what the portal works out', () => {
    expect(repaymentOf(split(), '30')).toBe('$3,445')
  })

  it('never substitutes its own arithmetic for a typed figure', () => {
    // 560,000 x 6.24% / 12 = 2,912. That is where the wrong number came from.
    expect(repaymentOf(split(), '30')).not.toBe('$2,912')
  })

  it('works one out only when the box is empty', () => {
    expect(repaymentOf(split({ repayment: '' }), '30')).toBe('$2,912')
  })

  it('shows nothing at all when there is neither a typed figure nor enough to work one out', () => {
    expect(repaymentOf({ amount: '', rate: '', type: '', repayment: '' }, '30')).toBe('')
    expect(repaymentOf(undefined, '30')).toBe('')
  })
})

describe('the repayment typed against the wrong type', () => {
  it('spots a P&I figure on an interest only split', () => {
    const m = repaymentMismatch(split(), '30')
    expect(m).not.toBeNull()
    expect(m!.typed).toBe(3445)
    expect(m!.thisType).toBe(2912)
    expect(m!.looksLike).toBe('principal and interest')
    expect(m!.thisLabel).toBe('interest only')
  })

  it('spots it the other way round too', () => {
    const m = repaymentMismatch(split({ type: 'P&I', repayment: '2,912' }), '30')
    expect(m!.looksLike).toBe('interest only')
  })

  it('says nothing when the figure matches its own type', () => {
    expect(repaymentMismatch(split({ repayment: '2,912' }), '30')).toBeNull()
    expect(repaymentMismatch(split({ type: 'P&I', repayment: '3,445' }), '30')).toBeNull()
  })

  it("leaves a broker's own figure alone", () => {
    // The lender's actual repayment is neither calculation. Not ours to question.
    expect(repaymentMismatch(split({ repayment: '3,180' }), '30')).toBeNull()
  })

  it('says nothing when there is nothing to compare', () => {
    expect(repaymentMismatch(split({ repayment: '' }), '30')).toBeNull()
    expect(repaymentMismatch(split({ rate: '' }), '30')).toBeNull()
  })
})

describe('how long the interest only lasts', () => {
  const io = (over: any = {}) => ({ type: 'Interest only', amount: '560,000', rate: '6.24', ...over })

  it('says both halves when the years are recorded', () => {
    expect(repaymentTypeLine(io({ ioYears: '3' }), '30'))
      .toBe('Interest only for 3 years, then principal and interest for 27')
  })

  it('gets one year right', () => {
    expect(repaymentTypeLine(io({ ioYears: '1' }), '30'))
      .toBe('Interest only for 1 year, then principal and interest for 29')
  })

  it('NEVER says "Interest only over 30 years"', () => {
    // That is what it said before, and it reads as thirty years of interest
    // only. 30 is the loan term. Fabio, 16 Sep 2026.
    expect(repaymentTypeLine(io(), '30', true)).toBe('Interest only')
    expect(repaymentTypeLine(io(), '30', true)).not.toMatch(/over 30 years/)
  })

  it('says nothing about a term it has not been told', () => {
    expect(repaymentTypeLine(io({ ioYears: '5' }), '')).toBe('Interest only for 5 years')
  })

  it('leaves principal and interest exactly as it was', () => {
    expect(repaymentTypeLine({ type: 'P&I' }, '30', true)).toBe('P&I over 30 years')
    expect(repaymentTypeLine({ type: 'P&I' }, '30')).toBe('P&I')
  })

  it('reaches the card', () => {
    const rows = splitRows(io({ ioYears: '2', repayment: '2,912' }), '30', { termWithType: true })
    expect(rows.find(r => r.label === 'Repayment type')!.value)
      .toBe('Interest only for 2 years, then principal and interest for 28')
  })

  it('the BC asks for it, and only when the split is interest only', () => {
    const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
    expect(bc).toContain('IO period (years)')
    expect(bc).toContain("updateSplit(i, 'ioYears', e.target.value)")
    expect(bc, 'the box would show on a P&I split').toMatch(/interest only\|\^io\$/i)
  })
})

describe('the card title', () => {
  it('does not say "Split 1" when there is only one loan', () => {
    expect(cardTitle(split(), 0, 1, 'Refinanced Loan'))
      .toBe('Refinanced Loan — 17 Dennington Lane Chelsea VIC')
  })

  it('reads exactly as it did before when the label was left alone', () => {
    expect(cardTitle(split({ label: 'Refinanced loan' }), 0, 1, 'Refinanced Loan')).toBe('Refinanced Loan')
    expect(cardTitle(split({ label: '' }), 0, 1, 'Refinanced Loan')).toBe('Refinanced Loan')
  })

  it('numbers them once there is more than one', () => {
    expect(cardTitle(split(), 0, 2, 'Refinanced Loan')).toBe('Split 1 — 17 Dennington Lane Chelsea VIC')
    expect(cardTitle(split({ label: '4 Bayview Road Frankston VIC' }), 1, 2, 'Refinanced Loan'))
      .toBe('Split 2 — 4 Bayview Road Frankston VIC')
  })
})

describe('the line above the cards', () => {
  it('counts, so nobody has to keep it in step by hand', () => {
    expect(structureLead(1)).toBe('Here is a breakdown of the structure:')
    expect(structureLead(2)).toBe('Your lending would be set up in two parts:')
    expect(structureLead(3)).toBe('Your lending would be set up in three parts:')
  })
})

describe('the rows inside a card', () => {
  const labels = (rows: any[]) => rows.map(r => r.label)

  it('says the same things in the same order on every card', () => {
    const a = splitRows(split({ existingBalance: '545,000' }), '30', { amountLabel: 'New loan amount' })
    const b = splitRows({ label: 'Frankston', amount: '210,000', existingBalance: '198,000',
                          rate: '6.14', type: 'P&I', repayment: '1,278' }, '30', { amountLabel: 'New loan amount' })
    // Fabio: "split 1 existing loan balance but 2 loan amount, consistency please."
    expect(labels(a)).toEqual(labels(b))
    expect(labels(a)[0]).toBe('Existing loan balance')
    expect(labels(a)[1]).toBe('New loan amount')
  })

  it('carries the typed repayment into the card', () => {
    const rows = splitRows(split(), '30')
    expect(rows.find(r => r.label === 'Estimated repayments')!.value).toBe('$3,445')
  })

  it('falls back to the deal balance only for a lone split', () => {
    const rows = splitRows(split(), '30', { existingFallback: '560,000', amountLabel: 'New loan amount' })
    expect(rows.find(r => r.label === 'Existing loan balance')!.value).toBe('$560,000')
  })

  it('still hides a new loan amount that is the same number said twice', () => {
    // Fabio, 2 Sep 2026: "all we need is equity release amount and existing loan
    // amount." The BC copies the balance into split 1, so on a straight refinance
    // they are one figure. See lib/email-amounts.ts.
    const rows = splitRows(split(), '30', { existingFallback: '560,000', amountLabel: 'New loan amount' })
    expect(labels(rows)).not.toContain('New loan amount')
  })

  it('shows it again the moment they differ', () => {
    const rows = splitRows(split({ existingBalance: '545,000' }), '30', { amountLabel: 'New loan amount' })
    expect(rows.find(r => r.label === 'New loan amount')!.value).toBe('$560,000')
  })

  it('leaves out a row it has no figure for', () => {
    const rows = splitRows({ label: 'x', amount: '100,000' }, '30')
    expect(labels(rows)).toEqual(['Loan amount'])
  })
})

describe('which splits are real', () => {
  it('ignores an untouched blank row', () => {
    expect(realSplits([{ amount: '560,000' }, { amount: '', label: '' }])).toHaveLength(1)
    expect(realSplits(undefined)).toEqual([])
  })
})

describe('the balances against the deal', () => {
  it('names a disagreement and nothing else', () => {
    const off = balancesDisagree([{ existingBalance: '545,000' }, { existingBalance: '198,000' }], '770,000')
    expect(off).toEqual({ parts: 743000, deal: 770000 })
  })

  it('stays quiet when they agree, or when nobody has filled them in', () => {
    expect(balancesDisagree([{ existingBalance: '545,000' }, { existingBalance: '225,000' }], '770,000')).toBeNull()
    expect(balancesDisagree([{ amount: '560,000' }], '770,000')).toBeNull()
    expect(balancesDisagree([{ existingBalance: '545,000' }], '')).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('no template works it out for itself', () => {
  const src = readFileSync('app/api/generate-email/route.ts', 'utf8')

  it('no client email calculates a repayment over a typed one', () => {
    // estimatedRepayment is reached through repaymentOf(), which reads the box
    // first. A direct call here is a template going back round the broker.
    const direct = (src.replace(/\/\/[^\n]*/g, '').match(/estimatedRepayment\(/g) || []).length
    expect(direct, 'a template is calling estimatedRepayment() directly again').toBe(0)
  })

  it('the scenarios with hand-written cards pick up anything past them', () => {
    // refinance + equity release keeps its two, bridging keeps its two, equity
    // release + purchase keeps its three - and a split beyond those now prints
    // instead of vanishing.
    const froms = (src.match(/from: (\d)/g) || []).sort()
    expect(froms).toEqual(['from: 2', 'from: 2', 'from: 3'])
  })

  it('nothing shadows the shared row builder', () => {
    // The construction branch had a local `splitRows` of its own sitting on top
    // of the imported one. Legal, and a trap for the next person reading it.
    expect(src).not.toMatch(/const splitRows = /)
  })

  it('every scenario that had one hard-coded split now prints a card per split', () => {
    for (const name of ['Refinanced Loan', 'Owner-occupied loan', 'Investment loan', 'SMSF loan', 'End debt', 'Your loan']) {
      expect(src, `${name} is not built from splitCards()`).toContain(`splitCards(d, '${name}'`)
    }
  })

  it('the BC records a balance per split and checks the typed repayment', () => {
    const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
    expect(bc).toContain('Existing balance on this property')
    expect(bc).toContain('repaymentMismatch(s, loanTerm)')
    expect(bc).toContain('balancesDisagree(splits, existingLoanBal)')
    expect(bc, 'the per-split balance must reach the saved record').toContain("updateSplit(i, 'existingBalance', v)")
  })
})
