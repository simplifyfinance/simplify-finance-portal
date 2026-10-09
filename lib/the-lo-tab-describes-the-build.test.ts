// THE LENDING OPTIONS TAB DESCRIBES THE BUILD, AND DOES NOT KEEP A COPY OF IT.
//
// 9 Oct 2026. On a build this tab drew Purchase price, Deposit, Stamp duty,
// State and an LVR worked out from a purchase price. On a buy and sell funding
// a build that reads: no purchase price, a deposit, duty on the LAND under a
// purchase heading, and an empty LVR - with nothing anywhere on the tab
// mentioning a build. The plain Construction template has had the same tab
// since the day it was built.
//
// WHAT REPLACED IT IS READ ONLY. The land value, the build cost and the
// valuation live on the borrowing capacity, and lib/lo-purchase-block.ts reads
// them from there when the email is built. An editable copy on this tab could
// only ever disagree with what went out - the fault this codebase spent three
// days undoing on the loan amount, the split list and the split purpose.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const form = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const code = form.replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

// The block that runs on a build, and the one that runs on a purchase.
const buildBlock = code.slice(code.indexOf('buildsSomething(bc) && (() => {'),
                              code.indexOf('!buildsSomething(bc) && ('))

describe('which block is drawn', () => {
  it('asks lib/sale-build.ts rather than deciding for itself', () => {
    // The same question every other reader asks, so the construction template
    // and the buy and sell that funds a build cannot drift apart.
    expect(code).toContain('buildsSomething(bc) && (() => {')
    expect(code).toContain('!buildsSomething(bc) && (')
  })

  it('no longer draws purchase boxes on a deal that builds something', () => {
    // Purchase price, Deposit, Stamp duty and State all sit in the other half.
    expect(buildBlock).not.toContain('Purchase price')
    expect(buildBlock).not.toContain('handleLoDepositChange')
    expect(buildBlock).not.toContain('handleLoStampDutyChange')
  })
})

describe('what it shows instead', () => {
  it('names the land, the build and the valuation', () => {
    expect(buildBlock).toContain('Construction cost')
    expect(buildBlock).toContain('"As if complete" valuation')
    expect(buildBlock).toContain('Total cost')
    expect(buildBlock).toContain('Total to fund')
  })

  it('reads every figure off the BC, never off the lending options record', () => {
    for (const f of ['bc.landValue', 'bc.constructionCost', 'bc.asIfCompleteValue', 'bc.stampDuty']) {
      expect(buildBlock, `${f} is not being read from the BC`).toContain(f)
    }
    // The LO record holds none of these and must not start to.
    for (const f of ['d.landValue', 'd.constructionCost', 'd.asIfCompleteValue']) {
      expect(buildBlock, `${f} would be a second copy`).not.toContain(f)
    }
  })

  it('is read only - nothing in it can be typed into', () => {
    expect(buildBlock).not.toContain('<NumberInput')
    expect(buildBlock).not.toContain('onChange')
    expect(buildBlock).toContain('Read only')
  })

  it('does its arithmetic with lib/construction.ts and invents none of its own', () => {
    for (const fn of ['totalCost(bc)', 'isLandPurchase(bc)', 'landLoanPayout(bc)',
                      'landEquity(bc)', 'constructionLvr(']) {
      expect(buildBlock, `${fn} is not being used`).toContain(fn)
    }
  })

  it('works the LVR out against the finished house, not against a purchase price', () => {
    expect(buildBlock).toContain('constructionLvr(bc.asIfCompleteValue')
    expect(buildBlock).not.toContain('d.purchasePrice')
  })

  it('says where the contribution comes from, in the BC\'s own words', () => {
    expect(buildBlock).toContain('isSellAndBuild(bc)')
    expect(buildBlock).toContain('sale proceeds and savings')
  })
})

describe('the purchase half is untouched', () => {
  it('still draws every box it always did', () => {
    const purchase = code.slice(code.indexOf('!buildsSomething(bc) && ('),
                                code.indexOf('Global loan splits'))
    expect(purchase).toContain('Purchase price')
    expect(purchase).toContain('handleLoDepositChange')
    expect(purchase).toContain('handleLoStampDutyChange')
    expect(purchase).toContain('LVR (calculated)')
  })
})
