// THE SALE PROCEEDS CAN FUND A BUILD, AND EVERYTHING DOWNSTREAM KNOWS.
//
// 9 Oct 2026. Fabio: "I want the buy and sell template to have the ability of
// instead of buying a new property use sale proceeds to build one ... we need
// to ensure LO and Compliance notes are also verified its impact".
//
// The deal these tests are written around, and the arithmetic they are
// defending. Invented clients, invented figures.
//
//   sale price             1,180,000
//   agent fees               -26,000
//   loan discharged         -415,000
//   --------------------------------
//   net proceeds             739,000
//   plus their own savings    +40,000
//   --------------------------------
//   deposit                  779,000     the box the rest of the portal reads
//
//   land        560,000
//   build       720,000
//   duty         20,000
//   -------------------
//   total cost 1,300,000  less 521,000 of lending  =  779,000 to find.
//
// The number to watch is 779,000. It is the same on both sides of the question,
// because the sale does not change - only what the money lands in does.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { saleProceedsUseOf, isSellAndBuild, buildsSomething, purchasePriceOf } from './sale-build'
import { isConstruction, fundsToComplete, securityValue, lvrOf } from './funds-to-complete'
import { missingForEmail } from './bc-ready'
import { dealFigures } from './deal-figures'
import { typeOf } from './deal-labels'

const SALE = {
  template: 'buy_sell',
  salePrice: '1,180,000',
  agentFees: '26,000',
  existingLoanBal: '415,000',
  netProceeds: 739000,
  additionalSavings: '40,000',
  deposit: '779,000',
}

const BUILD = {
  ...SALE,
  saleProceedsUse: 'build',
  landFunding: 'purchase',
  landValue: '560,000',
  constructionCost: '720,000',
  stampDuty: '20,000',
  dutyState: 'NSW',
  asIfCompleteValue: '1,340,000',
  splits: [
    { label: 'Land loan', amount: '320,000', rate: '6.14', type: 'P&I' },
    { label: 'Construction loan', amount: '201,000', rate: '6.39', type: 'Interest only', ioYears: '2' },
  ],
}

const BUY = {
  ...SALE,
  purchasePrice: '1,250,000',
  stampDuty: '54,000',
  dutyState: 'NSW',
  splits: [{ label: 'End Debt', amount: '525,000', rate: '6.14', type: 'P&I' }],
}

const deal = (bc: any) => ({ bc_data: bc })

describe('what the sale proceeds are funding', () => {
  it('is a purchase unless somebody says otherwise, including on every record saved before today', () => {
    expect(saleProceedsUseOf({})).toBe('buy')
    expect(saleProceedsUseOf({ saleProceedsUse: '' })).toBe('buy')
    expect(saleProceedsUseOf(BUY)).toBe('buy')
    expect(saleProceedsUseOf(BUILD)).toBe('build')
    expect(isSellAndBuild(BUY)).toBe(false)
    expect(isSellAndBuild(BUILD)).toBe(true)
  })

  it('is only a question on the buy and sell template', () => {
    // The answer riding on some other scenario's record means nothing.
    expect(isSellAndBuild({ template: 'oo_purchase', saleProceedsUse: 'build' })).toBe(false)
    expect(buildsSomething({ template: 'construction' })).toBe(true)
    expect(buildsSomething(BUILD)).toBe(true)
    expect(buildsSomething(BUY)).toBe(false)
  })
})

describe('the funds to complete', () => {
  // The buy side of this only started answering on 9 Oct 2026. Until then
  // mixed() read the loan being discharged as debt the NEW lending was paying
  // out, so every buy and sell in the portal refused to show a figure at all.
  it('asks for the same $779,000 whether they buy or build', () => {
    expect(fundsToComplete(deal(BUY)).toFind).toBe(779_000)
    expect(fundsToComplete(deal(BUILD)).toFind).toBe(779_000)
  })

  it('builds the figure from the land and the build, not from a purchase price', () => {
    const lines = fundsToComplete(deal(BUILD)).lines.map(l => [l.label, l.amount])
    expect(lines).toContainEqual(['Land value', 560_000])
    expect(lines).toContainEqual(['Construction cost', 720_000])
    expect(lines.map(l => l[0])).not.toContain('Purchase price')
  })

  it('agrees with the deposit the sale worked out', () => {
    const f = fundsToComplete(deal(BUILD))
    expect(f.deposit).toBe(779_000)
    expect(f.depositAgrees).toBe(true)
  })

  it('treats the deal as a build because the question was answered, not because a box was typed in', () => {
    // The old rule was "a construction cost exists". Left on its own that flips
    // the arithmetic mid-sentence, before anybody has said what they are doing.
    const halfTyped = { ...SALE, saleProceedsUse: 'build' }
    expect(isConstruction(deal(halfTyped))).toBe(true)
    expect(isConstruction(deal(BUY))).toBe(false)
    // And the net for old records is still there.
    expect(isConstruction(deal({ template: 'custom', constructionCost: '400,000' }))).toBe(true)
  })

  it('does not treat the discharged loan as debt the new lending is paying out', () => {
    // The sale clears it - netProceeds is the sale price less agent fees less
    // that balance - so there is no second job for the new loan to be doing.
    const f = fundsToComplete(deal(BUY))
    expect(f.workable).toBe(true)
    expect(f.missing.join(' ')).not.toContain('both refinances and buys')
  })

  it('ignores a purchase price left behind by a deal that used to be a purchase', () => {
    // Switching the answer does not delete what somebody typed, so the readers
    // have to ask rather than read the field.
    const wasBuying = { ...BUILD, purchasePrice: '1,250,000' }
    expect(purchasePriceOf(wasBuying)).toBe('')
    expect(fundsToComplete(deal(wasBuying)).toFind).toBe(779_000)
  })
})

describe('the LVR, which is where the email and the compliance pack disagreed', () => {
  it('values a build at what it will be worth finished', () => {
    const sec = securityValue(deal(BUILD))
    expect(sec.total).toBe(1_340_000)
    // 521,000 / 1,340,000
    expect(lvrOf(deal(BUILD))).toBe(38.9)
  })

  it('does the same for the plain construction template, which could not work one out at all', () => {
    const site = {
      template: 'construction', landFunding: 'purchase',
      landValue: '560,000', constructionCost: '720,000', asIfCompleteValue: '1,340,000',
      splits: [{ label: 'Construction loan', amount: '521,000' }],
    }
    expect(lvrOf(deal(site))).toBe(38.9)
  })

  it('leaves an ordinary purchase alone', () => {
    expect(securityValue(deal(BUY)).total).toBe(1_250_000)
    expect(lvrOf(deal(BUY))).toBe(42)
  })
})

describe('what the BC still needs before it can be sent', () => {
  it('asks a buy and sell for boxes the form actually has', () => {
    // It asked for newPurchasePrice and newPurchaseDeposit, which this form
    // never draws - so every buy and sell reported two boxes nobody could fill.
    const labels = missingForEmail('buy_sell', BUY).map(m => m.label)
    expect(labels).not.toContain('New purchase price')
    expect(labels).not.toContain('New purchase deposit')
    expect(missingForEmail('buy_sell', { ...BUY, purchasePrice: '' }).map(m => m.label))
      .toContain('Purchase price')
  })

  it('asks a build for the land, the build cost and the valuation instead', () => {
    expect(missingForEmail('buy_sell', BUILD).map(m => m.label)).toEqual([])
    const labels = missingForEmail('buy_sell',
      { ...BUILD, constructionCost: '', asIfCompleteValue: '' }).map(m => m.label)
    expect(labels).toContain('Construction cost')
    expect(labels).toContain('As if complete value')
    expect(labels).not.toContain('Purchase price')
  })
})

describe('compliance', () => {
  it('goes stale when the answer flips, because the whole second card changes', () => {
    const before = dealFigures(deal(BUY))
    const after = dealFigures(deal(BUILD))
    expect(before['what the sale proceeds are funding']).toBe('buy')
    expect(after['what the sale proceeds are funding']).toBe('build')
  })

  it('does not put the question on scenarios that never ask it', () => {
    expect(dealFigures(deal({ template: 'oo_purchase' })))
      .not.toHaveProperty('what the sale proceeds are funding')
  })
})

describe('the deal is called what it is', () => {
  it('files a sell-and-build as construction, not as a purchase', () => {
    expect(typeOf(deal(BUY))).toBe('purchase')
    expect(typeOf(deal(BUILD))).toBe('construction')
  })
})

describe('the rule is written down once', () => {
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')

  it('nobody spells the question out for themselves', () => {
    // The fault this is guarding against is the one "is this a construction
    // deal" already had: four files, four slightly different answers.
    const files = ['./funds-to-complete.ts', './bc-ready.ts', './deal-labels.ts', './deal-figures.ts']
    for (const f of files) {
      const src = read(f).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(src, f).not.toMatch(/saleProceedsUse\s*===/)
    }
  })

  it('the form shows the build boxes on both scenarios that build, from one flag', () => {
    const form = read('../app/(app)/deals/[id]/BCForm.tsx')
    // Every one of these was `template === 'construction'`, which is how the
    // new option would have shown a card with no boxes in it.
    expect(form).toContain('const showsBuild = ')
    expect(form).toContain('{showsBuild && <Field label="Construction cost">')
    expect(form).toContain('{showsBuild && <Field label={\'"As if complete" valuation\'}>')
    // And the purchase price is not on screen when there is no purchase.
    expect(form).toContain('!sellAndBuild && <Field label="Purchase price">')
  })
})
