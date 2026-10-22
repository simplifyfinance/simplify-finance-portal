// THE THREE CARDS THAT HAD NO LMI ON THEM AT ALL.
//
// 22 Oct 2026, scoped by Fabio to exactly these and nothing else:
//
//   Top up + purchase           the premium on a top up lives on the security,
//                               so this card was blind twice over
//   Investment + equity release same card, same omission
//   The lending options purchase card
//
// Bridging is deliberately NOT in this list. It prints "Bridging loan" and
// "End debt" rather than a loan amount, on purpose, so there is no loan line
// for a premium to attach to. Fabio, 22 Oct 2026: "bridigng never has lmi".
//
// First home buyer is NOT in this list either. That template IS the government
// scheme - it hard-prints "Waived under Gov. Deposit Scheme" - and adding the
// record would print a second, contradicting LMI line above it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { purchaseRows } from './purchase-rows'
import { loPurchaseBlock } from './lo-purchase-block'
import { lvrLine } from './box-deposit'
import { fundsToComplete } from './funds-to-complete'

const PER_SECURITY = {
  purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000',
  splits: [{ amount: '680,000' }],
  securityIds: ['a'],
  securityLmiApplicable: { a: 'Applicable' },
  securityLmi: { a: '18,000' },
  securityLmiTreatment: { a: 'Capitalised' },
}

describe('a premium recorded against the security', () => {
  it('reaches a card that passes the record', () => {
    const rows = purchaseRows({ price: '850,000', duty: '45,000', dutyLabel: 'Stamp duty',
      loan: '680,000', contribution: '170,000', lmiFrom: PER_SECURITY })
    expect(rows.find(r => r.label === 'Loan amount')!.value).toBe('$698,000')
    expect(rows.find(r => r.note)!.value).toBe('includes LMI of $18,000, added to the loan')
  })

  it('and the contribution still comes out right - the premium bought no house', () => {
    const rows = purchaseRows({ price: '850,000', duty: '45,000', dutyLabel: 'Stamp duty',
      loan: '680,000', contribution: '170,000', lmiFrom: PER_SECURITY })
    expect(rows.find(r => r.label.startsWith('Your contribution'))!.value).toBe('$215,000')
  })
})

describe('the lending options purchase card', () => {
  const bc = { purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000',
    lmiApplicable: 'Applicable', lmi: '18,000', lmiTreatment: 'Capitalised',
    splits: [{ amount: '680,000' }] }

  it('shows the premium', () => {
    const html = loPurchaseBlock({ loanAmount: '680,000', depositSource: 'Savings' }, bc)
    expect(html).toContain('698,000')
    expect(html).toContain('includes LMI of $18,000, added to the loan')
  })

  it('and says nothing when there is no premium', () => {
    const none = { ...bc, lmiApplicable: '', lmi: '', lmiTreatment: '' }
    const html = loPurchaseBlock({ loanAmount: '680,000', depositSource: 'Savings' }, none)
    expect(html).not.toContain('LMI')
    expect(html).toContain('680,000')
  })
})

describe('the two templates, and only those two', () => {
  const src = readFileSync('app/api/generate-email/route.ts', 'utf8')

  it('top up + purchase and investment + equity release carry the record', () => {
    expect(src).toContain("contributionFrom: 'the loan increase',\n            // A top up's premium lives on the security")
    expect(src).toContain("contributionFrom: 'equity release and personal savings',\n          // This card had no LMI at all")
    expect((src.match(/lmiFrom: d,/g) || []).length).toBe(2)
  })

  it('bridging is still left alone - it has no loan row to hang a premium on', () => {
    const i = src.indexOf("template === 'bridging'")
    const branch = src.slice(i, i + 2600)
    expect(branch).not.toContain('lmiFrom')
    expect(branch).toContain("loan: ''")
  })

  it('first home buyer is still left alone - that template is the scheme', () => {
    const i = src.indexOf("template === 'fhb'")
    const branch = src.slice(i, i + 2600)
    expect(branch).not.toContain('lmiFrom')
    expect(branch).toContain("row('LMI', 'Waived under Gov. Deposit Scheme')")
  })
})

// AND THE COMPLIANCE SIDE OF THESE SAME TWO TEMPLATES.
//
// e3489c6 made the pack read lib/lmi.ts rather than the two deal-level boxes.
// Nothing further is needed here - this is the proof of that, on the two
// scenarios that actually record the premium per security.
describe('the compliance pack on a top up and an equity release', () => {
  const deal = (template: string) => ({
    bc_data: { ...PER_SECURITY, template, propertyValue: '850,000',
               securityLimits: { a: '780,000' }, splits: [{ amount: '780,000' }] },
    lo_data: {}, fact_find_data: {},
  })

  for (const template of ['top_up_purchase', 'investment_equity']) {
    it(`${template}: reads the premium instead of shouting NOT RECORDED`, () => {
      const out = lvrLine(deal(template))
      expect(out.parts.join(' ')).toContain('$18,000')
      expect(out.parts.join(' ')).toContain('capitalised onto the loan')
      expect(out.gaps).toHaveLength(0)
    })

    it(`${template}: the funds to complete sees it too`, () => {
      const f = fundsToComplete(deal(template))
      expect(f.capitalised.map(l => l.label)).toContain('LMI')
    })
  }
})
