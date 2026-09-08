import { describe, it, expect } from 'vitest'
import { filledCount, figureCount, looksLikeAWipe, wipeMessage } from './wipe-guard'

// The real thing, roughly: a BC somebody had finished.
const finishedBc = () => ({
  template: 'buy_sell',
  purchasePrice: '797,000', deposit: '160,000', stampDuty: '31,200', dutyState: 'NSW',
  suburb: 'Orange', propertyType: 'Investment', purchasePropertySubtype: 'House',
  salePrice: '640,000', agentFees: '14,000', netProceeds: '626,000',
  existingLoanBal: '410,000', loanTerm: '30', lvrPercent: '80',
  incomeOther: '12,000', incomeRental: '24,000', ccLimit: '15,000', hecs: '480',
  brokerNotes: 'Client wants to keep repayments under 4k a month.',
  brokerSig: 'Fabio de Castro', brand: 'Simplify Finance',
  splits: [{ id: 's1', amount: '637,000', rate: '6.14', type: 'P&I' }],
})

// What the form holds when it has come up empty.
const emptyBc = () => ({
  template: 'buy_sell', purchasePrice: '797,000', dutyState: 'NSW',
  deposit: '', stampDuty: '', suburb: '', brokerNotes: '',
  splits: [{ id: 's1', amount: '', rate: '', type: 'P&I' }],
})

describe('counting what somebody actually typed', () => {
  it('counts real values and ignores empty ones', () => {
    expect(filledCount({ a: 'x', b: '', c: null, d: '   ' })).toBe(1)
  })

  it('does not count an untouched field pretending to be filled in', () => {
    expect(filledCount({ a: '0', b: 'Select', c: 'Annually', d: false })).toBe(0)
  })

  it('sees inside lists and nested records', () => {
    expect(filledCount({ rows: [{ v: 'one' }, { v: 'two' }], deep: { deeper: { v: 'three' } } })).toBe(3)
  })
})

describe('refusing to empty a form', () => {
  // The Alexis Janes case.
  it('catches a finished BC being replaced by a nearly blank one', () => {
    const v = looksLikeAWipe(finishedBc(), emptyBc())
    expect(v.wipe).toBe(true)
  })

  it('lets an ordinary edit through', () => {
    const next = { ...finishedBc(), deposit: '170,000' }
    expect(looksLikeAWipe(finishedBc(), next).wipe).toBe(false)
  })

  it('lets somebody clear a few fields', () => {
    const next = { ...finishedBc(), salePrice: '', agentFees: '', netProceeds: '', incomeOther: '' }
    expect(looksLikeAWipe(finishedBc(), next).wipe).toBe(false)
  })

  // Switching scenario rewrites the notes and the splits but keeps the figures.
  it('lets a scenario change through', () => {
    const next = { ...finishedBc(), template: 'oo_purchase', brokerNotes: '', splits: [{ id: 's1', amount: '', rate: '', type: 'P&I' }] }
    expect(looksLikeAWipe(finishedBc(), next).wipe).toBe(false)
  })

  it('says nothing about a record that was nearly empty to begin with', () => {
    expect(looksLikeAWipe({ a: '1', b: '2' }, {}).wipe).toBe(false)
  })

  it('says nothing about a brand new record', () => {
    expect(looksLikeAWipe(null, finishedBc()).wipe).toBe(false)
    expect(looksLikeAWipe({}, finishedBc()).wipe).toBe(false)
  })

  it('tells the person nothing was lost and who to tell', () => {
    const m = wipeMessage('BC', { had: 40, keeping: 3 })
    expect(m).toContain('NOT SAVED')
    expect(m).toContain('Nothing has been changed')
    expect(m).toContain('tell Fabio')
  })
})

// ---------------------------------------------------------------------------
// WILLIAM WELTON 2026, 7 Sep 2026. The one the box count could not see.
//
// A finished refinance BC came back holding the scenario, the brand, the
// signature, a thirty year term, an empty set of money boxes - and 72% of its
// boxes, which is why nothing stopped it.
describe('the money is counted on its own', () => {
  const FINISHED = {
    template: 'refinance_equity', brand: 'simplify', brokerSig: 'Fabio de Castro',
    loanTerm: '30', dutyState: 'VIC', propertyType: 'Owner-occupied', lvr: '80',
    suburb: 'Reservoir', depositSource: 'Savings', lmiApplicable: 'Waived',
    internalNotes: 'Bankwest short-form valuation returned', templateNotes: 'Rates subject to change',
    checklist: ['Payslips', 'Rates notice'],
    existingLoanBal: '424,000',
    propertyValue: '540,000',
    equityRelease: '24,700',
    splits: [{ label: 'Existing loan refinanced', amount: '448,700', rate: '6.95', type: 'Interest only' }],
  }
  // Every box that is not money, exactly as it came back.
  const STRIPPED = {
    ...FINISHED,
    existingLoanBal: '', propertyValue: '', equityRelease: '',
    splits: [{ label: 'Existing loan refinanced', amount: '', rate: '6.95', type: 'Interest only' }],
  }

  it('counts the figures and not the rates, terms or dropdowns', () => {
    // 424,000 / 540,000 / 24,700 / 448,700. Not 30, not 6.95, not 80.
    expect(figureCount(FINISHED)).toBe(4)
    expect(figureCount(STRIPPED)).toBe(0)
  })

  it('refuses the save that emptied William Welton', () => {
    const v = looksLikeAWipe(FINISHED, STRIPPED)
    expect(v.wipe).toBe(true)
    expect((v as any).kind).toBe('figures')
  })

  it('and the old box count would have let it through', () => {
    // The proof this test is worth having: most boxes survived.
    expect(filledCount(STRIPPED)).toBeGreaterThan(filledCount(FINISHED) * 0.35)
  })

  it('says what happened in words a broker can act on', () => {
    const v = looksLikeAWipe(FINISHED, STRIPPED) as any
    const msg = wipeMessage('BC — Borrowing capacity', v)
    expect(msg).toContain('wiped the figures')
    expect(msg).toContain('4 amounts were recorded')
  })

  // ---- and the edits that must still be allowed -----------------------------

  it('allows changing every figure to a different one', () => {
    const edited = { ...FINISHED, existingLoanBal: '430,000', propertyValue: '560,000' }
    expect(looksLikeAWipe(FINISHED, edited).wipe).toBe(false)
  })

  it('allows clearing one figure to retype it', () => {
    const midType = { ...FINISHED, propertyValue: '' }
    expect(looksLikeAWipe(FINISHED, midType).wipe).toBe(false)
  })

  it('allows clearing two - a property and the loan on it', () => {
    const deleted = { ...FINISHED, propertyValue: '', equityRelease: '' }
    expect(looksLikeAWipe(FINISHED, deleted).wipe).toBe(false)
  })

  it('says nothing about a record with barely any money in it', () => {
    const early = { template: 'refinance_equity', existingLoanBal: '424,000', loanTerm: '30' }
    expect(looksLikeAWipe(early, { ...early, existingLoanBal: '' }).wipe).toBe(false)
  })

  it('does not mistake a year, a rate, a term or an email for money', () => {
    expect(figureCount({ year: '2026', rate: '6.95', term: '30', dependants: '2' })).toBe(0)
    expect(figureCount({ dob: '1984-03-11', started: '01/02/2019' })).toBe(0)
    expect(figureCount({ emailHtml: '<p style="font-size:14px">Hi Kylie, 424,000</p>' })).toBe(0)
  })

  it('does count money however it is written', () => {
    expect(figureCount({ a: '424,000', b: '$540,000', c: '448700', d: '2,464.68' })).toBe(4)
  })
})

describe('picking a different scenario is not a wipe', () => {
  // Compare-options: four option amounts. Switching scenario rebuilds the splits
  // with empty amounts, which clears four figures in one deliberate action.
  const COMPARING = {
    template: 'oo_lvr_compare', purchasePrice: '797,000',
    splits: [
      { label: '80', amount: '637,600', rate: '6.14', type: 'P&I' },
      { label: '85', amount: '677,450', rate: '6.24', type: 'P&I' },
      { label: '90', amount: '717,300', rate: '6.44', type: 'P&I' },
    ],
  }
  const AFTER_SWITCH = {
    template: 'oo_purchase', purchasePrice: '797,000',
    splits: [{ label: 'Split 1', amount: '', rate: '6.14', type: 'P&I' }],
  }

  it('lets the scenario change through even though three figures went', () => {
    expect(figureCount(COMPARING)).toBe(4)
    expect(figureCount(AFTER_SWITCH)).toBe(1)
    expect(looksLikeAWipe(COMPARING, AFTER_SWITCH).wipe).toBe(false)
  })

  it('but still refuses the same loss when the scenario did NOT change', () => {
    const sameScenario = { ...AFTER_SWITCH, template: 'oo_lvr_compare' }
    const v = looksLikeAWipe(COMPARING, sameScenario)
    expect(v.wipe).toBe(true)
    expect((v as any).kind).toBe('figures')
  })

  it('still refuses a record that empties entirely, scenario change or not', () => {
    // The blunt test above does not care about the scenario, and must not.
    const emptied = { template: 'oo_purchase' }
    expect(looksLikeAWipe({ ...COMPARING, a: '1', b: '2', c: '3', d: '4', e: '5', f: '6' }, emptied).wipe).toBe(true)
  })
})
