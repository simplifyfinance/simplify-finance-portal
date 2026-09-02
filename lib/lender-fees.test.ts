import { describe, it, expect } from 'vitest'
import { legalFeeLabel, rowLegalFeeLabel, confirmedFeeLabel, LEGAL_FEE_LABELS, DEFAULT_LEGAL_FEE_LABEL } from './lender-fees'

describe('what a lender calls the fee', () => {
  it('uses the wording set on the lender', () => {
    expect(legalFeeLabel({ legal_fee_label: 'Settlement fee' })).toBe('Settlement fee')
  })
  it('falls back to Legal fee when nothing is set', () => {
    expect(legalFeeLabel({})).toBe(DEFAULT_LEGAL_FEE_LABEL)
    expect(legalFeeLabel(null)).toBe(DEFAULT_LEGAL_FEE_LABEL)
  })
  it('treats a blank or a space as nothing set, never as a blank heading', () => {
    expect(legalFeeLabel({ legal_fee_label: '' })).toBe(DEFAULT_LEGAL_FEE_LABEL)
    expect(legalFeeLabel({ legal_fee_label: '   ' })).toBe(DEFAULT_LEGAL_FEE_LABEL)
  })
})

describe('the wording written into a deal', () => {
  it('uses what was copied across when the lender was chosen', () => {
    expect(rowLegalFeeLabel({ legalFeeLabel: 'Settlement fee' })).toBe('Settlement fee')
  })
  it('falls back for a deal written before this existed', () => {
    expect(rowLegalFeeLabel({ lenderName: 'CBA' })).toBe(DEFAULT_LEGAL_FEE_LABEL)
  })
})

describe("the list the library was seeded from", () => {
  it('has every lender Fabio listed', () => {
    expect(LEGAL_FEE_LABELS).toHaveLength(13)
  })
  it('keeps Bankwest as the only Legal fee', () => {
    const legal = LEGAL_FEE_LABELS.filter(x => x.label === 'Legal fee').map(x => x.lender)
    expect(legal).toEqual(['Bankwest'])
  })
  it('says so in words where there is no fee, rather than leaving it blank', () => {
    for (const name of ['Suncorp', 'Bank Australia', 'NAB']) {
      const row = LEGAL_FEE_LABELS.find(x => x.lender === name)!
      expect(row.fee).toMatch(/^None/)
      expect(row.fee).toMatch(/government/)
    }
  })
  it('never leaves a lender without wording', () => {
    for (const row of LEGAL_FEE_LABELS) {
      expect(row.label.trim()).not.toBe('')
      expect(row.fee.trim()).not.toBe('')
    }
  })
})

// The default is what an unchecked lender says. Twelve of the thirteen banks
// Fabio checked say settlement fee, so that is the better guess - but a guess
// has to be visible, which is what confirmedFeeLabel is for.
describe('lenders nobody has checked', () => {
  it('says the commoner word rather than Bankwest\'s', () => {
    expect(DEFAULT_LEGAL_FEE_LABEL).toBe('Settlement fee')
    expect(legalFeeLabel({ name: 'Pepper Money' })).toBe('Settlement fee')
  })
  it('knows the difference between checked and merely defaulted', () => {
    expect(confirmedFeeLabel({ legal_fee_label: 'Settlement fee' })).toBe(true)
    expect(confirmedFeeLabel({ legal_fee_label: 'Legal fee' })).toBe(true)
    expect(confirmedFeeLabel({})).toBe(false)
    expect(confirmedFeeLabel({ legal_fee_label: '  ' })).toBe(false)
  })
  it('still lets Bankwest be the exception', () => {
    expect(legalFeeLabel({ legal_fee_label: 'Legal fee' })).toBe('Legal fee')
  })
})
