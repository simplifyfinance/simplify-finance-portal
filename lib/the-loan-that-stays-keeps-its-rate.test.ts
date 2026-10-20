import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { seedFromGlobal, resolveLenderSplits, type GlobalSplit } from './lo-splits'

// THE SPLIT THAT IS NOT BEING REPRICED.
//
// 20 Oct 2026. On a top up the existing loan appears as a split so every lender
// can be priced against the whole position - that is the comparison, staying
// and topping up against moving the lot, and it is deliberate. But under the
// lender the loan is ALREADY with, nothing about that facility changes: it
// stays, at the rate it is on, and only the increase is new money.
//
// Left blank, somebody had to remember to type it. Miss it and the client is
// quoted a repayment on the whole balance at a rate that is not theirs, on the
// recommended option - the one they actually read.

const globals = (over: Partial<GlobalSplit> = {}): GlobalSplit[] => ([
  { id: 'g1', label: 'Existing loan', amount: '942,441', securityId: 'p1',
    staying: true, existingRate: '6.14', existingLender: 'St George', ...over },
  { id: 'g2', label: 'Loan increase', amount: '200,000', securityId: 'p1' },
])

const option = (lenderName: string) => ({ lenderName, variableIO: { enabled: true } })

describe('the existing lender starts on the existing rate', () => {
  it('holds the rate on the loan that is staying', () => {
    const out = seedFromGlobal(globals(), option('St George') as any)
    expect(out[0].rate).toBe('6.14')
  })

  // Under anyone else that loan WOULD be moving, so there is nothing to hold -
  // the new lender has to price it, which is the whole point of comparing.
  it('leaves it blank under every other lender', () => {
    expect(seedFromGlobal(globals(), option('Macquarie') as any)[0].rate).toBe('')
    expect(seedFromGlobal(globals(), option('ubank') as any)[0].rate).toBe('')
  })

  it('never holds a rate on the new money', () => {
    expect(seedFromGlobal(globals(), option('St George') as any)[1].rate).toBe('')
  })

  // Punctuation and case are not a different bank.
  it('matches the name after normalising, not by exact spelling', () => {
    const out = seedFromGlobal(globals({ existingLender: 'St.George' }), option('St George') as any)
    expect(out[0].rate).toBe('6.14')
  })

  // lib/lender-id.ts: a near miss would put one bank's rate under another
  // bank's name on a client's email.
  it('does not match a bank that merely looks similar', () => {
    const out = seedFromGlobal(globals({ existingLender: 'Bank of Melbourne' }),
      option('Bank of Queensland') as any)
    expect(out[0].rate).toBe('')
  })

  it('holds nothing when the rate was never recorded', () => {
    expect(seedFromGlobal(globals({ existingRate: '' }), option('St George') as any)[0].rate).toBe('')
  })

  // Every other scenario has no split tagged staying, so nothing changes.
  it('leaves an ordinary refinance exactly as it was', () => {
    const plain: GlobalSplit[] = [{ id: 'g1', label: 'Loan to be refinanced', amount: '500,000' }]
    expect(seedFromGlobal(plain, option('St George') as any)[0].rate).toBe('')
  })

  // The first lender option exists from the moment the LO is created and gets
  // its splits through the fallback, not through addLender - so it has to get
  // the rate the same way, or the recommended option is the one that misses it.
  it('reaches the first option, which never goes through addLender', () => {
    const out = resolveLenderSplits({ ...option('St George'), lenderSplits: [] } as any, globals())
    expect(out[0].rate).toBe('6.14')
  })

  // A lender already priced keeps its own answers. Fabio's standing rule, and
  // the reason resolveLenderSplits hands its own list back untouched.
  it('never overwrites a rate somebody already typed', () => {
    const own = [{ id: 'g1', label: 'Existing loan', amount: '942,441', securityId: 'p1',
                   lvr: '', rate: '5.89', repayment: '', repaymentType: 'IO' }]
    const out = resolveLenderSplits({ ...option('St George'), lenderSplits: own } as any, globals())
    expect(out[0].rate).toBe('5.89')
  })
})

describe('where the rate comes from', () => {
  const form = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

  // It is already on the fact find - every property carries its loans and every
  // loan its lender and rate. Asking again would be the same fact in two
  // places, free to disagree.
  it('is read off the fact find, not asked for a second time', () => {
    expect(form).toContain('const existingLoanOn = (securityId: any)')
    expect(form).toContain('withRate[0].interestRate')
  })

  // Two loans on one security have two rates and no single answer.
  it('holds nothing when a security carries more than one loan with a rate', () => {
    expect(form).toContain('if (withRate.length !== 1) return')
  })

  // Both paths that build the global list, or the first option misses it.
  it('carries on the first build and on every merge with the BC', () => {
    expect(form.split('...stayingBits(').length - 1).toBe(2)
  })
})
