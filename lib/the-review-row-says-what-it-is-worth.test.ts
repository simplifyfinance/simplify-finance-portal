import { describe, it, expect } from 'vitest'
import { figuresFor } from '../components/PortfolioReview'

// WHAT THE ROW IS TRIAGED ON.
//
// Fabio, 19 Oct 2026, looking at 656 imported rows that all said "3
// properties" and nothing else: "All I need is the name of the client, the
// property address, the loan amount, the LVR, the security address."
//
// These are the arithmetic behind those columns. The mock was approved before
// a line of it was written, so these assertions are that mock.

const prop = (o: any) => ({
  review_id: 'r1', ordinal: 1, address: '1 Test St', investor: true,
  original_value: null, original_loan: null, current_balance: null,
  estimated_current_value: null, usable_equity: null, lender_raw: '', ...o,
})

describe('the figures on a row', () => {
  it('adds up the loan, the value and the LVR off the settlement figures', () => {
    const f = figuresFor([
      prop({ ordinal: 1, address: '52 Donnelly Ave', original_loan: 341000, original_value: 1480000 }),
      prop({ ordinal: 2, address: '9/118 Ipswich Rd', original_loan: 208000, original_value: 930000 }),
    ])
    expect(f.loan).toBe(549000)
    expect(f.value).toBe(2410000)
    // 549,000 / 2,410,000 = 22.78%
    expect(f.lvr).toBe(22.8)
    // 80% of 2,410,000 is 1,928,000, less 549,000
    expect(f.usable).toBe(1379000)
  })

  // The balance keeps itself current from the commission statements, and a
  // valuation somebody looked up by hand beats what it sold for in 2016.
  it('prefers the current balance and a current valuation where there are any', () => {
    const f = figuresFor([
      prop({ original_loan: 341000, current_balance: 298000,
             original_value: 1480000, estimated_current_value: 1850000 }),
    ])
    expect(f.loan).toBe(298000)
    expect(f.value).toBe(1850000)
    expect(f.lvr).toBe(16.1)
  })

  // THE HOME IS SHOWN AND NOT COUNTED - the same rule the schema sets on
  // portfolio_review_properties. Counting it inflates the equity and the email
  // that goes out would be wrong.
  it('leaves an owner occupied property out of every figure', () => {
    const f = figuresFor([
      prop({ ordinal: 1, address: 'Home', investor: false, original_loan: 600000, original_value: 1900000 }),
      prop({ ordinal: 2, address: 'The rental', original_loan: 200000, original_value: 800000 }),
    ])
    expect(f.loan).toBe(200000)
    expect(f.value).toBe(800000)
    expect(f.usable).toBe(440000)
    // Shown, though. You need the whole portfolio to have the conversation.
    expect(f.count).toBe(2)
    expect(f.first).toBe('Home')
    expect(f.more).toBe(1)
  })

  // A figure somebody worked out is a decision. Nothing recalculates over it.
  it('uses a recorded usable equity rather than the 80% rule', () => {
    const f = figuresFor([
      prop({ original_loan: 200000, original_value: 800000, usable_equity: 315000 }),
    ])
    expect(f.usable).toBe(315000)
  })

  it('names the first security and counts the rest', () => {
    const f = figuresFor([
      prop({ ordinal: 2, address: 'Second' }),
      prop({ ordinal: 1, address: 'First' }),
      prop({ ordinal: 3, address: 'Third' }),
    ])
    expect(f.first).toBe('First')
    expect(f.more).toBe(2)
    expect(f.count).toBe(3)
  })

  // A BLANK IS A BLANK, NEVER A ZERO. money(0) prints "$0", which is truthy
  // and reads as a fact - this codebase has paid for that one more than once.
  // A client whose figures never came across must not look like a client who
  // owes nothing.
  it('says nothing rather than zero when the book carried no figures', () => {
    const f = figuresFor([prop({})])
    expect(f.loan).toBe(0)
    expect(f.value).toBe(0)
    expect(f.lvr).toBeNull()
    expect(f.usable).toBeNull()
  })

  it('survives a review with no properties at all', () => {
    const f = figuresFor(undefined)
    expect(f.count).toBe(0)
    expect(f.first).toBe('')
    expect(f.lvr).toBeNull()
    expect(f.usable).toBeNull()
  })

  // Owing more than 80% of the value is a real answer and the list has to be
  // able to show it, not hide it behind a zero.
  it('reports a negative where there is no headroom', () => {
    const f = figuresFor([prop({ original_loan: 700000, original_value: 800000 })])
    expect(f.usable).toBe(-60000)
  })
})
