import { describe, it, expect } from 'vitest'
import { suggestPurpose, splitsOf, stillNeeded, canGenerateNotes,
         defaultSecurityAddress, dealRow, purposeSummary, PURPOSE_LABEL,
         isMixed, needsFundsRole, purchaseLending, suggestFunds, FUNDS_LABEL,
         withSplitDetail } from './deal-structure'

const deal = (over: any = {}) => ({
  bc_data: { purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000',
             suburb: 'Brunswick', ...(over.bc_data || {}) },
  lo_data: { recommendedLender: 'Macquarie', loanAmount: '1,350,000',
             refinanceSplits: [], ...(over.lo_data || {}) },
  compliance_data: over.compliance_data || {},
  fact_find_data: over.fact_find_data || {},
})

const split = (o: any = {}) => ({ id: o.id || 's1', label: o.label || 'Loan', amount: o.amount || '520,000',
  rate: o.rate || '6.14', repaymentType: o.repaymentType || 'P&I',
  purpose: o.purpose ?? '', termYears: o.termYears ?? '', productType: o.productType ?? '' })

describe('suggesting a purpose from the label', () => {
  it('reads the obvious investment words', () => {
    expect(suggestPurpose('Equity access')).toBe('INV')
    expect(suggestPurpose('Investment loan')).toBe('INV')
    expect(suggestPurpose('Cash out for investment')).toBe('INV')
  })

  it('reads the obvious owner-occupied ones', () => {
    expect(suggestPurpose('Owner-occupied loan')).toBe('OO')
    expect(suggestPurpose('End Debt')).toBe('OO')
  })

  it('says nothing when the label gives nothing away', () => {
    expect(suggestPurpose('Split 2')).toBe('')
    expect(suggestPurpose('')).toBe('')
    expect(suggestPurpose('Loan')).toBe('')
  })

  // A SUGGESTION IS NOT A DEFAULT. The field stays unset until a person picks,
  // because this answer ends up in a regulated document.
  it('never fills the field in — the split is still unanswered', () => {
    const d = deal({ lo_data: { refinanceSplits: [split({ label: 'Equity access' })] } })
    expect(splitsOf(d)[0].purpose).toBe('')
    expect(stillNeeded(d).some(n => n.what.startsWith('purpose'))).toBe(true)
  })
})

describe('which splits the block shows', () => {
  it('uses the LO list when there is one', () => {
    const d = deal({ lo_data: { refinanceSplits: [
      split({ id: 'a', label: 'Existing loan refinanced' }),
      split({ id: 'b', label: 'Equity access', amount: '180,000' })] } })
    expect(splitsOf(d).map(s => s.label)).toEqual(['Existing loan refinanced', 'Equity access'])
  })

  it('falls back to the BC splits when the LO has none', () => {
    const d = deal({ bc_data: { splits: [{ label: 'Owner-occupied loan', amount: '680,000', type: 'P&I' }] } })
    const s = splitsOf(d)
    expect(s).toHaveLength(1)
    expect(s[0].repaymentType).toBe('P&I')
  })

  it('copes with a deal that has no splits anywhere', () => {
    expect(splitsOf({})).toEqual([])
    expect(() => splitsOf(null)).not.toThrow()
  })
})

describe('what a person still has to answer', () => {
  it('asks for purpose, term and product on an untouched split', () => {
    const d = deal({ lo_data: { refinanceSplits: [split()] } })
    expect(stillNeeded(d).map(n => n.what)).toEqual([
      'purpose — owner occupied or investment', 'term', 'product type'])
  })

  it('asks nothing once they are answered', () => {
    const d = deal({ lo_data: { refinanceSplits: [
      split({ purpose: 'OO', termYears: '30', productType: 'Basic Variable' })] } })
    expect(stillNeeded(d)).toHaveLength(0)
    expect(canGenerateNotes(d)).toBe(true)
  })

  // "none" is a real answer and most deals have none, so an empty box is not
  // a gap.
  it('never asks about cashback', () => {
    const d = deal({ lo_data: { refinanceSplits: [
      split({ purpose: 'OO', termYears: '30', productType: 'Basic Variable' })] },
      compliance_data: { cashback: '' } })
    expect(stillNeeded(d)).toHaveLength(0)
  })

  it('names the split it is asking about', () => {
    const d = deal({ lo_data: { refinanceSplits: [
      split({ id: 'a', label: 'Existing loan refinanced', purpose: 'OO', termYears: '30', productType: 'X' }),
      split({ id: 'b', label: 'Equity access' })] } })
    const n = stillNeeded(d)
    expect(n).toHaveLength(3)
    expect(n.every(x => x.splitLabel === 'Equity access')).toBe(true)
    expect(n[0].splitId).toBe('b')
  })

  // THE POINT OF THE GATE. Fabio, 3 Sep 2026: "dont lock but warning sign
  // saying we need that information to generate compliance".
  it('holds the credit notes until they are answered', () => {
    expect(canGenerateNotes(deal({ lo_data: { refinanceSplits: [split()] } }))).toBe(false)
  })

  it('lets an existing deal with no splits through rather than blocking it', () => {
    expect(canGenerateNotes(deal())).toBe(true)
  })
})

describe('the security address', () => {
  it('fills itself with TBA and the suburb on a pre-approval', () => {
    expect(defaultSecurityAddress(deal(), true)).toBe('TBA — Brunswick')
  })

  it('is empty on a formal approval, so somebody types the real one', () => {
    expect(defaultSecurityAddress(deal(), false)).toBe('')
  })

  it('says TBA alone when the BC has no suburb either', () => {
    expect(defaultSecurityAddress(deal({ bc_data: { suburb: '' } }), true)).toBe('TBA')
  })

  it('never overwrites an address somebody typed', () => {
    const d = deal({ compliance_data: { preApproval: true, securityAddress: '14 Collins St' } })
    expect(dealRow(d).securityAddress).toBe('14 Collins St')
  })
})

describe('the deal row', () => {
  const mixed = deal({
    lo_data: { recommendedLender: 'Macquarie', loanAmount: '1,350,000', refinanceSplits: [
      split({ id: 'a', label: 'Existing loan refinanced', amount: '520,000', purpose: 'OO' }),
      split({ id: 'b', label: 'Equity access', amount: '180,000', purpose: 'INV' }),
      split({ id: 'c', label: 'New purchase', amount: '650,000', purpose: 'INV' })] },
    fact_find_data: { properties: [{ value: '620,000',
      loans: [{ balance: '380,000', status: 'To be refinanced' }] }] },
  })

  it('adds the splits up by purpose — the number nothing could state before', () => {
    const r = dealRow(mixed)
    expect(r.ooTotal).toBe(520_000)
    expect(r.invTotal).toBe(830_000)
    expect(r.unsetTotal).toBe(0)
  })

  it('says both when it is both', () => {
    expect(purposeSummary(mixed)).toBe('Owner occupied & investment')
  })

  it('counts money nobody has assigned a purpose to', () => {
    const half = deal({ lo_data: { refinanceSplits: [
      split({ id: 'a', amount: '520,000', purpose: 'OO' }),
      split({ id: 'b', amount: '180,000' })] } })
    expect(dealRow(half).unsetTotal).toBe(180_000)
  })

  it('says nothing about purpose when no split has one', () => {
    expect(purposeSummary(deal({ lo_data: { refinanceSplits: [split()] } }))).toBe('')
  })

  it('shows the existing loan only on a refinance', () => {
    const refi = deal({ bc_data: { purchasePrice: '', existingLoanBal: '520,000' } })
    expect(dealRow(refi).existingLoan).toBe(520_000)
    expect(dealRow(deal()).existingLoan).toBe(0)
  })

  it('reads the lender and the lending from the LO', () => {
    const r = dealRow(mixed)
    expect(r.lender).toBe('Macquarie')
    expect(r.totalLending).toBe(1_350_000)
  })

  it('never throws on an empty deal', () => {
    for (const d of [{}, null, undefined]) expect(() => dealRow(d)).not.toThrow()
  })
})

describe('the labels people read', () => {
  it('spells the purposes out in full', () => {
    expect(PURPOSE_LABEL.OO).toBe('Owner occupied')
    expect(PURPOSE_LABEL.INV).toBe('Investment')
  })
})

describe('what each split does, on a mixed deal', () => {
  const mixed = (funds: string[] = ['', '', '']) => deal({
    bc_data: { purchasePrice: '850,000' },
    lo_data: { refinanceSplits: [
      split({ id: 'a', label: 'Existing loan refinanced', amount: '520,000', purpose: 'OO', termYears: '30', productType: 'X' }),
      split({ id: 'b', label: 'Equity access', amount: '180,000', purpose: 'INV', termYears: '30', productType: 'X' }),
      split({ id: 'c', label: 'New purchase', amount: '650,000', purpose: 'OO', termYears: '30', productType: 'X' }),
    ].map((s, i) => ({ ...s, funds: funds[i] })) },
    fact_find_data: { properties: [{ value: '620,000',
      loans: [{ balance: '380,000', status: 'To be refinanced' }] }] },
  })

  it('knows a mixed deal when it sees one', () => {
    expect(isMixed(mixed())).toBe(true)
    expect(needsFundsRole(mixed())).toBe(true)
  })

  // Nobody is made to answer a question with an obvious answer.
  it('does not ask on a plain purchase or a plain refinance', () => {
    expect(needsFundsRole(deal())).toBe(false)
    expect(needsFundsRole(deal({ bc_data: { purchasePrice: '', existingLoanBal: '520,000' } }))).toBe(false)
  })

  it('asks for it on every split of a mixed deal', () => {
    const n = stillNeeded(mixed())
    expect(n.filter(x => x.what.startsWith('what it does'))).toHaveLength(3)
  })

  it('stops asking once answered', () => {
    expect(stillNeeded(mixed(['payout', 'equity', 'purchase']))).toHaveLength(0)
  })

  it('counts only the purchase money', () => {
    expect(purchaseLending(mixed(['payout', 'equity', 'purchase']))).toBe(650_000)
  })

  it('refuses a partial answer rather than returning half a number', () => {
    expect(purchaseLending(mixed(['payout', '', 'purchase']))).toBeNull()
  })

  it('returns the whole loan on a deal that is not mixed', () => {
    expect(purchaseLending(deal())).toBe(1_350_000)
  })
})

describe('suggesting what a split does', () => {
  it('reads the obvious ones', () => {
    expect(suggestFunds('Existing loan refinanced')).toBe('payout')
    expect(suggestFunds('Equity access')).toBe('equity')
    expect(suggestFunds('New purchase')).toBe('purchase')
  })

  it('says nothing when the label gives nothing away', () => {
    expect(suggestFunds('Split 2')).toBe('')
    expect(suggestFunds('')).toBe('')
  })

  it('spells the answers out in full', () => {
    expect(FUNDS_LABEL.purchase).toBe('Funds the purchase')
    expect(FUNDS_LABEL.payout).toBe('Pays out existing debt')
    expect(FUNDS_LABEL.equity).toBe('Releases equity')
  })
})

describe('who owns what — the two forms must not fight', () => {
  // The LO form autosaves the whole of lo_data. A second component writing
  // there would lose its changes the next time somebody typed on the LO.
  const d = () => deal({
    bc_data: { loanTerm: '30' },
    lo_data: { recommendedLender: 'ING', refinanceSplits: [split({ id: 'a', purpose: 'OO' })],
      lenders: [{ lenderName: 'ING', productName: 'Orange Advantage' }] },
    compliance_data: { splitDetail: { a: { termYears: '25', productType: 'Fixed 2yr' } } },
  })

  it('merges the compliance-side detail onto the LO split', () => {
    const s = splitsOf(d())[0]
    expect(s.purpose).toBe('OO')          // from the LO
    expect(s.termYears).toBe('25')        // from compliance
    expect(s.productType).toBe('Fixed 2yr')
  })

  it('prefills the term from the BC and the product from the recommended lender', () => {
    const bare = deal({ bc_data: { loanTerm: '30' },
      lo_data: { recommendedLender: 'ING', refinanceSplits: [split({ id: 'a' })],
        lenders: [{ lenderName: 'ING', productName: 'Orange Advantage' }] } })
    const s = splitsOf(bare)[0]
    expect(s.termYears).toBe('30')
    expect(s.productType).toBe('Orange Advantage')
  })

  it('writes one split without disturbing another', () => {
    const cd = { preApproval: true, splitDetail: { a: { termYears: '25' }, b: { termYears: '30' } } }
    const next = withSplitDetail(cd, 'a', { productType: 'Fixed 2yr' })
    expect(next.splitDetail.a).toEqual({ termYears: '25', productType: 'Fixed 2yr' })
    expect(next.splitDetail.b).toEqual({ termYears: '30' })
    expect(next.preApproval).toBe(true)
  })

  it('never changes what it was given', () => {
    const cd = { splitDetail: { a: { termYears: '25' } } }
    const before = JSON.stringify(cd)
    withSplitDetail(cd, 'a', { termYears: '30' })
    expect(JSON.stringify(cd)).toBe(before)
  })

  it('copes with a deal that has never been touched', () => {
    expect(withSplitDetail(null, 'a', { termYears: '30' }).splitDetail.a.termYears).toBe('30')
  })

  it('ignores detail for a split that no longer exists', () => {
    const gone = deal({ lo_data: { refinanceSplits: [split({ id: 'a' })] },
      compliance_data: { splitDetail: { zzz: { termYears: '99' } } } })
    expect(splitsOf(gone)).toHaveLength(1)
    expect(splitsOf(gone)[0].termYears).toBe('')
  })
})
