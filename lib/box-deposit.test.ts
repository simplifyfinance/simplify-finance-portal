import { describe, it, expect } from 'vitest'
import { boxSeven, shapeOf, depositSourceOf, lvrLine, completionLine } from './box-deposit'
import { DEAL } from './box-fixture'

const base = (over: any = {}) => ({ ...JSON.parse(JSON.stringify(DEAL)), id: 'deal-1', ...over })

// A purchase, straight off the fixture.
// LENDING COMES FROM lo_data.loanAmount WHEN IT IS SET, and it is set on the
// fixture. A test that changes the splits has to move that too, or it silently
// keeps the fixture's $1,700,000 and proves nothing. Cost me five red tests.
const purchase = (bcOver: any = {}, over: any = {}, lending?: string) => {
  const d = base(over)
  d.bc_data = { ...d.bc_data, ...bcOver }
  if (lending !== undefined) d.lo_data = { ...d.lo_data, loanAmount: lending }
  else if (bcOver.splits) {
    d.lo_data = { ...d.lo_data,
      loanAmount: String(bcOver.splits.reduce((t: number, x: any) =>
        t + Number(String(x.amount || '0').replace(/[$,\s]/g, '')), 0)) }
  }
  return d
}

// A refinance. No purchase price, a payout, a property value to measure against.
const refi = (bcOver: any = {}) => purchase({
  template: 'refinance_only',
  purchasePrice: '', newPurchasePrice: '', deposit: '', stampDuty: '', depositSource: '',
  existingLoanBal: '640,000', propertyValue: '1,050,000', equityRelease: '',
  splits: [{ label: 'Refinance', amount: '640,000', rate: '5.89', type: 'P&I' }],
  ...bcOver,
})

describe('which story it tells', () => {
  it('a purchase talks about the deposit', () => {
    expect(shapeOf(purchase())).toBe('purchase')
  })

  it('a refinance with nothing coming out talks about the equity position', () => {
    expect(shapeOf(refi())).toBe('refinance')
  })

  it('an equity release amount makes it a cash out', () => {
    expect(shapeOf(refi({ equityRelease: '260,000' }))).toBe('cashout')
  })

  it('a release AND a purchase price is the release funding the purchase', () => {
    expect(shapeOf(refi({ equityRelease: '180,000', purchasePrice: '780,000' })))
      .toBe('release_and_purchase')
  })

  it('says so plainly when the deal records none of the three', () => {
    const r = boxSeven(refi({ existingLoanBal: '', propertyValue: '', splits: [] }))
    expect(r.text).toMatch(/\*\* NOT RECORDED — this deal records neither a purchase price/)
    expect(r.gaps.length).toBeGreaterThan(0)
  })

  it('reads the scenario name for nothing', () => {
    // A deal mislabelled as a refinance that has a purchase price and a deposit
    // is a purchase, and gets the deposit wording.
    expect(shapeOf(purchase({ template: 'refinance_only' }))).toBe('purchase')
  })
})

describe('the purchase wording', () => {
  it('states the deposit, the price and the lending', () => {
    const t = boxSeven(purchase()).text
    expect(t).toContain('$3,841,500')
    expect(t).toContain('$5,250,000')
    expect(t).toContain('$1,700,000')
  })

  it('states the LVR the deal structure block shows, not the target dropdown', () => {
    // bc.lvr is '80%' on this deal - the 80/90/95 selector, which is not even
    // displayed on a purchase. The real figure is 32.4%. 10 Sep 2026: I read the
    // wrong one and told Fabio his BC was wrong.
    const t = boxSeven(purchase()).text
    expect(t).toContain('32.4%')
    expect(t).not.toContain('80%')
  })

  it('states stamp duty and the state exactly as recorded', () => {
    expect(boxSeven(purchase()).text).toContain('Stamp duty of $291,500 has been allowed for in NSW')
  })

  it('says the funds to complete agree with the deposit when they do', () => {
    expect(boxSeven(purchase()).text).toMatch(/come to \$3,841,500, which agrees with the deposit/)
  })

  it('shouts when they do not agree, and quotes both', () => {
    const r = boxSeven(purchase({ deposit: '3,000,000' }))
    expect(r.text).toMatch(/\*\* The funds required to complete come to \$3,841,500 and the deposit recorded on the scenario is \$3,000,000\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain('Funds to complete does not match the deposit')
  })

  it('shouts for a missing stamp duty rather than treating a blank as nil', () => {
    const r = boxSeven(purchase({ stampDuty: '' }))
    expect(r.text).toMatch(/\*\* NOT RECORDED — stamp duty on this purchase\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain('Stamp duty')
  })
})

describe('where the deposit is from', () => {
  it('reads the scenario, which is where the deposit was priced', () => {
    expect(depositSourceOf(purchase()).words).toBe('is held in savings')
    expect(boxSeven(purchase()).text).toContain('The deposit is held in savings.')
  })

  it('has words for every option the BC offers', () => {
    for (const [src, want] of [
      ['Savings', 'is held in savings'],
      ['Equity', 'is coming from equity in an existing property'],
      ['Gift', 'is a gift'],
    ] as const) {
      expect(depositSourceOf(purchase({ depositSource: src })).words).toBe(want)
    }
  })

  it('reads "Combination" differently on a buy/sell, because the BC asks a different question', () => {
    expect(depositSourceOf(purchase({ depositSource: 'Combination' })).words)
      .toBe('is a combination of savings and equity')
    expect(depositSourceOf(purchase({ depositSource: 'Combination', template: 'buy_sell' })).words)
      .toBe('is a combination of savings and a gift')
  })

  it('falls back to the fact find when the scenario has not been answered', () => {
    const d = purchase({ depositSource: '' })
    d.fact_find_data = { ...d.fact_find_data, depositSource: 'Sale of a property' }
    expect(boxSeven(d).text).toContain('The deposit is coming from the sale of a property.')
  })

  it('asks for a gift letter whenever it is a gift', () => {
    expect(boxSeven(purchase({ depositSource: 'Gift' })).text)
      .toContain('A gift letter will be required on file before settlement.')
  })

  it('reports a disagreement between the two tabs instead of picking one quietly', () => {
    const d = purchase({ depositSource: 'Savings' })
    d.fact_find_data = { ...d.fact_find_data, depositSource: 'Gift' }
    const r = boxSeven(d)
    expect(r.text).toMatch(/\*\* The scenario records the deposit source as Savings and the fact find records it as Gift\. \*\*/)
    expect(r.gaps.some(g => /disagrees/.test(g.what))).toBe(true)
  })

  it('does not call Equity and Equity release a disagreement', () => {
    const d = purchase({ depositSource: 'Equity' })
    d.fact_find_data = { ...d.fact_find_data, depositSource: 'Equity release' }
    expect(boxSeven(d).text).not.toMatch(/disagree|records it as/)
  })

  it('shouts when neither tab has been answered', () => {
    const d = purchase({ depositSource: '' })
    d.fact_find_data = { ...d.fact_find_data, depositSource: '' }
    const r = boxSeven(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — where the deposit is coming from\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain('Deposit source')
  })

  it('states a source it does not have words for rather than dropping it', () => {
    expect(depositSourceOf(purchase({ depositSource: 'Crypto' })).words)
      .toBe('is recorded as "Crypto"')
  })
})

describe('LMI is only mentioned where the portal asks about it', () => {
  it('says nothing about LMI at or under 80%', () => {
    // The BC does not ask below 80, so "no LMI is payable" would be this box's
    // own conclusion rather than anybody's answer.
    const t = boxSeven(purchase()).text
    expect(t).toContain('32.4%')
    expect(t).not.toMatch(/mortgage insurance/i)
  })

  it('reads the LMI status box above 80%', () => {
    const d = purchase({ deposit: '525,000', splits: [{ label: 'Loan', amount: '4,725,000', rate: '5.99', type: 'P&I' }],
                         lmiApplicable: 'Applicable', lmi: '48,200' }, {}, '4725000')
    const t = boxSeven(d).text
    expect(t).toMatch(/The loan to value ratio is 90%/)
    expect(t).toContain('Lenders mortgage insurance is applicable and has been estimated at $48,200.')
  })

  it('says it plainly when the insurance has been waived', () => {
    const d = purchase({ splits: [{ label: 'Loan', amount: '4,725,000', rate: '5.99', type: 'P&I' }],
                         lmiApplicable: 'Waived' }, {}, '4725000')
    expect(boxSeven(d).text).toContain('Lenders mortgage insurance has been waived.')
  })

  it('shouts above 80% when nobody has answered the LMI question', () => {
    const d = purchase({ splits: [{ label: 'Loan', amount: '4,725,000', rate: '5.99', type: 'P&I' }],
                         lmiApplicable: '' }, {}, '4725000')
    const r = boxSeven(d)
    expect(r.text).toMatch(/\*\* NOT RECORDED — whether lenders mortgage insurance applies at 90%\. \*\*/)
    expect(r.gaps.map(g => g.what)).toContain('LMI status')
  })

  it('shouts for a missing estimate when it is applicable', () => {
    const d = purchase({ splits: [{ label: 'Loan', amount: '4,725,000', rate: '5.99', type: 'P&I' }],
                         lmiApplicable: 'Applicable', lmi: '' })
    expect(boxSeven(d).text).toMatch(/\*\* NOT RECORDED — the LMI estimate\. \*\*/)
  })

  it('shouts rather than quoting an LVR it cannot work out', () => {
    const d = purchase({ purchasePrice: '', newPurchasePrice: '', propertyValue: '', splits: [],
                         deposit: '100,000' }, {}, '')
    const r = lvrLine(d)
    expect(r.parts.join(' ')).toMatch(/\*\* NOT RECORDED — the loan to value ratio/)
    expect(r.gaps.map(g => g.what)).toContain('Loan to value ratio')
  })
})

describe('the dollar-for-dollar refinance', () => {
  const t = () => boxSeven(refi()).text

  it('says no deposit is required, because there is not one', () => {
    expect(t()).toMatch(/No deposit or contribution is required/)
  })

  it('names the payout and the new lending', () => {
    expect(t()).toContain('$640,000')
    expect(t()).toMatch(/dollar for dollar/)
  })

  it('states the clients own position on the exposure, not an assessment of it', () => {
    // Fabio, 10 Sep 2026: "customers have enough of a equity position to proceed
    // with the refinance, and they're comfortable with the exposure".
    expect(t()).toMatch(/comfortable with the (level of )?exposure against the asset/)
    expect(t()).not.toMatch(/we (are|believe|consider)|in our (view|opinion)|appears (to be )?(adequate|sufficient)/i)
  })

  it('never mentions a deposit source on a refinance', () => {
    expect(t()).not.toMatch(/deposit is|gift letter|held in savings/)
  })

  it('states the LVR against the recorded property value', () => {
    expect(t()).toMatch(/The loan to value ratio is 61%/)
  })

  it('says nothing about stamp duty, because there is no purchase', () => {
    expect(t()).not.toMatch(/stamp duty/i)
  })
})

describe('the refinance with an equity release', () => {
  const d = () => refi({ equityRelease: '260,000', propertyValue: '1,300,000',
    splits: [{ label: 'Refinance', amount: '640,000', rate: '5.89', type: 'P&I' },
             { label: 'Equity release', amount: '260,000', rate: '5.99', type: 'P&I' }] })

  it('reads the equity release box rather than subtracting one number from another', () => {
    // 10 Sep 2026: I was going to work this out as lending minus payout and asked
    // for a cut-off to decide when a small difference counted. There is a box.
    expect(boxSeven(d()).text).toContain('$260,000')
  })

  it('names the payout and the release separately', () => {
    const t = boxSeven(d()).text
    expect(t).toContain('$640,000')
    expect(t).toContain('$260,000')
    expect(t).toMatch(/equity release/)
  })

  it('says the funds come from the equity, so no deposit is required', () => {
    expect(boxSeven(d()).text).toMatch(/drawn from the equity in the property/)
  })

  it('states what the released money is for from the split purpose, never the scenario name', () => {
    const inv = d(); inv.lo_data = { ...inv.lo_data,
      refinanceSplits: [{ id: 'a', label: 'Refinance', amount: '640,000', purpose: 'INV' },
                        { id: 'b', label: 'Equity release', amount: '260,000', purpose: 'INV' }] }
    expect(boxSeven(inv).text).toContain('recorded as being for investment purposes')
  })

  it('shouts when no split has a purpose', () => {
    const none = d(); none.lo_data = { ...none.lo_data,
      refinanceSplits: [{ id: 'a', label: 'Refinance', amount: '640,000', purpose: '' }] }
    expect(boxSeven(none).text).toMatch(/\*\* NOT RECORDED — whether the lending is owner occupied or investment\. \*\*/)
  })
})

describe('the release that funds a purchase', () => {
  const d = () => refi({ equityRelease: '180,000', purchasePrice: '780,000', stampDuty: '42,900',
    dutyState: 'VIC', existingLoanBal: '560,000', propertyValue: '1,000,000',
    splits: [{ label: 'Refinance', amount: '560,000', rate: '5.89', type: 'P&I' },
             { label: 'Equity release', amount: '180,000', rate: '5.99', type: 'P&I' },
             { label: 'New purchase', amount: '440,000', rate: '5.99', type: 'P&I' }] })

  it('says the release is the contribution towards the purchase', () => {
    const t = boxSeven(d()).text
    expect(t).toMatch(/releasing \$180,000 of equity/)
    expect(t).toMatch(/that release is the contribution towards the purchase price of \$780,000/)
  })

  it('says no cash is coming from their own funds', () => {
    expect(boxSeven(d()).text).toMatch(/No cash contribution is being made/)
  })

  it('shouts instead of dividing the lending up itself when a split is unanswered', () => {
    const r = boxSeven(d())
    expect(r.text).toMatch(/\*\* NOT RECORDED — what each split does/)
    expect(r.gaps.some(g => /what each split does/i.test(g.what))).toBe(true)
  })

  it('breaks the lending down once every split has been answered', () => {
    const answered = d()
    answered.lo_data = { ...answered.lo_data, refinanceSplits: [
      { id: 'a', label: 'Refinance', amount: '560,000', purpose: 'OO', funds: 'payout' },
      { id: 'b', label: 'Equity release', amount: '180,000', purpose: 'OO', funds: 'equity' },
      { id: 'c', label: 'New purchase', amount: '440,000', purpose: 'OO', funds: 'purchase' },
    ] }
    const t = boxSeven(answered).text
    expect(t).not.toMatch(/NOT RECORDED — what each split does/)
    expect(t).toMatch(/\$560,000 to pay out the existing debt, the \$180,000 equity release, and \$440,000 funding the purchase/)
  })

  it('still states the stamp duty on the purchase half', () => {
    expect(boxSeven(d()).text).toContain('Stamp duty of $42,900 has been allowed for in VIC')
  })
})

describe('it reads like a person wrote it', () => {
  it('never leaves a raw key, a placeholder or a NaN', () => {
    for (const d of [purchase(), refi(), refi({ equityRelease: '260,000' })]) {
      const t = boxSeven(d).text
      expect(t).not.toMatch(/undefined|NaN|\$NaN|\[object|oo_purchase|refinance_only/)
      expect(t).not.toMatch(/ {2}|\.\.| ,|,,/)
    }
  })

  it('is the same words every time for one deal, and varies across deals', () => {
    expect(new Set(Array.from({ length: 20 }, () => boxSeven(purchase()).text)).size).toBe(1)
    const across = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => {
      const d = purchase(); d.id = id; return boxSeven(d).text
    })
    expect(new Set(across).size).toBeGreaterThan(1)
  })

  it('stays short — this box is a paragraph, not an essay', () => {
    const n = boxSeven(purchase()).text.split(/\s+/).length
    expect(n).toBeGreaterThan(25)
    expect(n).toBeLessThan(160)
  })

  it('never states an equity figure it was told not to state', () => {
    // Fabio, 10 Sep 2026: "the equity figure is not necessary. You don't need to
    // say leaving this much in equity."
    for (const d of [purchase(), refi(), refi({ equityRelease: '260,000' })]) {
      expect(boxSeven(d).text).not.toMatch(/leaving equity|equity of \$|remaining equity/i)
    }
  })
})
