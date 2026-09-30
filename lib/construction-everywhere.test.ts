import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fundsToComplete } from './funds-to-complete'
import { completionLine } from './box-deposit'

// THE SAME FIX, IN THE THREE PLACES NOBODY WOULD CONNECT TO IT.
//
// The $900,000 on the client email was the visible half. The compliance pack
// shouted NOT RECORDED in red about stamp duty that does not exist, and the
// funds-to-complete strip reported the deal permanently incomplete over the same
// figure - on every construction deal where the clients already owned the land.
//
// One question on the BC answers all three, which is the point of it being on
// the deal rather than decided separately in each file.

const OWNED = {
  transaction_type: 'construction',
  bc_data: {
    template: 'construction', landFunding: 'owned',
    landValue: '900000', constructionCost: '600000', stampDuty: '',
    asIfCompleteValue: '1700000',
    splits: [{ amount: '600000' }],
  },
}

const BUYING = {
  transaction_type: 'construction',
  bc_data: {
    template: 'construction', landFunding: 'purchase',
    landValue: '1000000', constructionCost: '1000000', stampDuty: '40000',
    dutyState: 'NSW', asIfCompleteValue: '2200000',
    splits: [{ amount: '800000' }, { amount: '800000' }],
  },
}

// toFind is COSTS LESS LENDING, not the cost of the project - so on a deal fully
// funded by the loan the honest answer is nil, and what this change is really
// about is which COST LINES exist at all.
const costs = (f: { lines: { label: string; amount: number; kind: string }[] }) =>
  f.lines.filter(l => l.kind === 'cost').reduce((t, l) => t + l.amount, 0)

describe('the funds to complete', () => {
  it('does not count land the clients already own', () => {
    const f = fundsToComplete(OWNED)
    expect(f.lines.map(l => l.label)).not.toContain('Land value')
    expect(costs(f)).toBe(600_000)
    // Fully funded by the construction loan, so there is nothing to find.
    expect(f.toFind).toBe(0)
  })

  // THE ONE THAT SAT THERE FOREVER. A deal cannot be completed by recording a
  // figure that does not exist.
  it('and does not report a missing stamp duty that cannot exist', () => {
    expect(fundsToComplete(OWNED).missing.join(' ')).not.toContain('Stamp duty')
  })

  it('while a land purchase still wants its duty recorded', () => {
    const noDuty = { ...BUYING, bc_data: { ...BUYING.bc_data, stampDuty: '' } }
    expect(fundsToComplete(noDuty).missing.join(' ')).toContain('Stamp duty')
  })

  it('and a land purchase still counts the land', () => {
    expect(fundsToComplete(BUYING).lines.map(l => l.label)).toContain('Land value')
  })

  it('an existing land loan being paid out IS a cost', () => {
    const withLoan = {
      ...OWNED,
      bc_data: {
        ...OWNED.bc_data, landFunding: 'owned_with_loan', landLoanBalance: '300000',
        splits: [{ amount: '300000' }, { amount: '600000' }],
      },
    }
    const f = fundsToComplete(withLoan)
    expect(f.lines.map(l => l.label)).toContain('Existing land loan paid out')
    expect(costs(f)).toBe(900_000)
    expect(f.toFind).toBe(0)
  })

  // THE BUG, AT THIS LAYER. Land already owned was a cost line, so the strip
  // said these clients had $900,000 to find.
  it('so the strip no longer asks an owner for their own land back', () => {
    const asItWas = { ...OWNED, bc_data: { ...OWNED.bc_data, landFunding: 'purchase' } }
    expect(fundsToComplete(asItWas).toFind).toBe(900_000)
    expect(fundsToComplete(OWNED).toFind).toBe(0)
  })
})

describe('the compliance pack', () => {
  // RED THAT IS ALWAYS WRONG TEACHES EVERYBODY TO IGNORE RED.
  it('says there is no duty rather than shouting that none was recorded', () => {
    const { parts, gaps } = completionLine(OWNED)
    const said = parts.join(' ')
    expect(said).not.toContain('NOT RECORDED')
    expect(said).toContain('no stamp duty')
    expect(said).toContain('already own the land')
    expect(gaps.map(g => g.what)).not.toContain('Stamp duty')
  })

  it('and still shouts on a purchase with no duty recorded', () => {
    const noDuty = { ...BUYING, bc_data: { ...BUYING.bc_data, stampDuty: '' } }
    const { parts, gaps } = completionLine(noDuty)
    expect(parts.join(' ')).toContain('NOT RECORDED')
    expect(gaps.map(g => g.what)).toContain('Stamp duty')
  })

  it('and says nothing of the sort when duty is there', () => {
    expect(completionLine(BUYING).parts.join(' ')).toContain('$40,000')
  })
})

describe('the client email', () => {
  const route = readFileSync('app/api/generate-email/route.ts', 'utf8')

  it('asks how the land is funded rather than assuming', () => {
    expect(route).toContain('isLandPurchase(d)')
  })

  it('only prints a duty row where there is duty', () => {
    expect(route).toContain('buyingLand ? row(dutyLabel(d)')
  })

  it('and says what the land equity is doing to the LVR', () => {
    expect(route).toContain('landEquity(d)')
    expect(route).toContain('equity in the land')
  })
})
