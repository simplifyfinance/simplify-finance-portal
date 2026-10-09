// THE BUILD REACHES EVERY EMAIL AND THE COMPLIANCE SHEET.
//
// 9 Oct 2026. Three places described a build badly or not at all:
//
//   the BC email on a buy and sell funding a build - printed "New Purchase"
//     with no price, no land and no total
//   the lending options email - printed "New purchase" with a loan and a
//     contribution and no mention of a build, on EVERY construction deal
//   the compliance facts sheet - had no land value, build cost or valuation
//     anywhere on it, on EVERY construction deal
//
// And a fourth, which is the one that was already going to clients: the lending
// options email chose its layout by asking whether the existing loan box had a
// number in it. On a buy and sell it always does - the LO copies it from the BC
// - so that email took the refinance path and printed an "Equity Release" line
// worked out as the lending minus a loan the SALE discharges. Nobody typed it.
//
// Invented clients, invented figures. The deal is the one from the mock:
//
//   land 560,000 + build 720,000 + duty 20,000 = 1,300,000 total cost
//   less 320,000 + 201,000 of lending            =   779,000 to contribute
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { buildCostRows, buildSplitRows, fundsToContributeRow, landEquityNote } from './build-card'
import { loPurchaseBlock } from './lo-purchase-block'
import { buildLines, dealFacts } from './deal-facts'

const BUYING_LAND = {
  template: 'buy_sell',
  saleProceedsUse: 'build',
  landFunding: 'purchase',
  landValue: '560,000',
  constructionCost: '720,000',
  stampDuty: '20,000',
  dutyState: 'NSW',
  asIfCompleteValue: '1,340,000',
  salePrice: '1,180,000',
  agentFees: '26,000',
  existingLoanBal: '415,000',
  additionalSavings: '40,000',
  deposit: '779,000',
  splits: [
    { label: 'Land loan', amount: '320,000', rate: '6.14', type: 'P&I' },
    { label: 'Construction loan', amount: '201,000', rate: '6.39', type: 'Interest only', ioYears: '2' },
  ],
}

// They already own it, with a loan on it. The case that produced the $900,000
// the clients did not have to find, on 30 Sep.
const OWNED_WITH_LOAN = {
  template: 'construction',
  landFunding: 'owned_with_loan',
  landValue: '880,000',
  landLoanBalance: '119,000',
  constructionCost: '1,612,000',
  asIfCompleteValue: '2,700,000',
  splits: [{ label: 'Construction loan', amount: '970,000', rate: '6.39', type: 'Interest only' }],
}

describe('the build card', () => {
  it('counts the land as a cost when it is being bought', () => {
    const html = buildCostRows(BUYING_LAND)
    expect(html).toContain('Land value')
    expect(html).toContain('$560,000')
    expect(html).toContain('Total cost')
    expect(html).toContain('$1,300,000')
  })

  it('counts land they already own as security, under the total and not inside it', () => {
    const html = buildCostRows(OWNED_WITH_LOAN)
    expect(html).toContain('Total to fund')
    // build 1,612,000 + the 119,000 payout. NOT the 880,000 of land.
    expect(html).toContain('$1,731,000')
    expect(html).toContain('Land you already own')
    expect(html).toContain('Existing land loan paid out')
    // and the land value is not sitting in the column being added up
    expect(html.indexOf('$1,731,000')).toBeLessThan(html.indexOf('Land you already own'))
  })

  it('prints no duty row on land nobody is buying', () => {
    expect(buildCostRows(OWNED_WITH_LOAN)).not.toContain('Stamp duty')
    expect(buildCostRows(BUYING_LAND)).toContain('Stamp duty')
  })

  it('names every split with its own rate and type', () => {
    const html = buildSplitRows(BUYING_LAND.splits)
    expect(html).toContain('Land loan')
    expect(html).toContain('Construction loan')
    expect(html).toContain('6.39')
    expect(html).toContain('Interest only')
  })

  it('says Nil rather than $0, and still mentions the solicitor', () => {
    expect(fundsToContributeRow(0, ' (x)')).toContain('Nil')
    expect(fundsToContributeRow(0, ' (x)')).toContain('solicitor')
    expect(fundsToContributeRow(779000, ' (x)')).toContain('$779,000')
  })

  it('explains the LVR on a deal with no deposit anywhere on the page', () => {
    // 880,000 less the 119,000 being paid out.
    expect(landEquityNote(OWNED_WITH_LOAN)).toContain('$761,000')
    expect(landEquityNote(OWNED_WITH_LOAN)).toContain('takes the place of a deposit')
    expect(landEquityNote(BUYING_LAND)).toBe('')
  })
})

describe('the lending options email', () => {
  const lo = { bcTemplate: 'buy_sell', loanAmount: '521,000', additionalSavings: '40,000',
               existingLoan: '415,000', purchasePrice: '', stampDuty: '', deposit: '779,000' }

  it('describes the build instead of a purchase nobody is making', () => {
    const html = loPurchaseBlock(lo, BUYING_LAND)
    expect(html).toContain('Your build')
    expect(html).toContain('Construction cost')
    expect(html).toContain('$1,300,000')
    expect(html).toContain('$521,000')
    expect(html).not.toContain('New purchase')
  })

  it('works the contribution out from the figure on its own page', () => {
    // 1,300,000 less the 521,000 this email is about.
    expect(loPurchaseBlock(lo, BUYING_LAND)).toContain('$779,000')
  })

  it('keeps the sale warning under the figures it is about', () => {
    expect(loPurchaseBlock(lo, BUYING_LAND)).toContain('only estimated amounts')
  })

  it('leaves an ordinary purchase exactly as it was', () => {
    const buying = { bcTemplate: 'buy_sell', purchasePrice: '1,250,000', stampDuty: '54,000',
                     dutyState: 'NSW', loanAmount: '525,000', deposit: '779,000' }
    const html = loPurchaseBlock(buying, { template: 'buy_sell' })
    expect(html).toContain('New purchase')
    expect(html).not.toContain('Construction cost')
  })

  it('chooses its layout by whether the deal refinances, not by whether a box has a number in it', () => {
    // THE ONE THAT WAS REACHING CLIENTS. The LO copies existingLoanBal across
    // from the BC on every scenario, so this box always has the discharge
    // figure in it on a buy and sell - and the route read that as a refinance.
    // The client was then shown "Existing Loan Balance" on a purchase email and
    // an "Equity Release" line worked out as lending minus that balance.
    const route = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')
    expect(route).toContain('if (!d.existingLoan || isBuyAndSell(d))')
    expect(route).toContain('loPurchaseBlock(d, bcData)')
  })

  it('is handed the borrowing capacity rather than keeping a copy of it', () => {
    // A copy on the LO record is the fault of 8 Oct. The form sends the BC with
    // the request; nothing is stored.
    const form = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
    expect(form).toContain('bcData: deal.bc_data')
    const lo2 = readFileSync('lib/lo-purchase-block.ts', 'utf8')
      .replace(/\/\/[^\n]*/g, '')
    expect(lo2).not.toMatch(/landValue:\s/)
  })
})

describe('the compliance facts sheet', () => {
  it('had nothing to say about a build, and now has five things', () => {
    const lines = buildLines({ bc_data: BUYING_LAND }).join(' | ')
    expect(lines).toContain('being purchased')
    expect(lines).toContain('$560,000')
    expect(lines).toContain('$720,000')
    expect(lines).toContain('$1,300,000')
    expect(lines).toContain('$1,340,000')
  })

  it('says whose land it is, because that decides cost from security', () => {
    const owned = buildLines({ bc_data: OWNED_WITH_LOAN }).join(' | ')
    expect(owned).toContain('already own the land')
    expect(owned).toContain('loan on it being paid out')
    expect(owned).toContain('$761,000')
    expect(owned).toContain('Total to fund')
  })

  it('shouts when the valuation is missing rather than quietly having no LVR', () => {
    const noVal = buildLines({ bc_data: { ...BUYING_LAND, asIfCompleteValue: '' } }).join(' | ')
    expect(noVal).toContain('NOT RECORDED')
  })

  it('is not there at all on a deal that builds nothing', () => {
    expect(buildLines({ bc_data: { template: 'oo_purchase', purchasePrice: '900,000' } })).toEqual([])
    const facts = dealFacts({ bc_data: { template: 'oo_purchase', purchasePrice: '900,000' } })
    expect(facts.sections.map((x: any) => x.title)).not.toContain('THE BUILD')
  })

  it('reaches the sheet the compliance wording is written from', () => {
    const facts = dealFacts({ bc_data: BUYING_LAND })
    const build = facts.sections.find((x: any) => x.title === 'THE BUILD')
    expect(build).toBeTruthy()
    expect(build!.lines.join(' ')).toContain('$720,000')
  })
})

describe('one question, asked in one place', () => {
  it('nobody decides for themselves whether a deal builds something', () => {
    const files = ['./box-goals.ts', './lo-purchase-block.ts', './deal-facts.ts', './build-card.ts']
    for (const f of files) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8')
        .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(src, f).not.toMatch(/template\s*\)?\s*===\s*'construction'/)
    }
  })
})
