// ONE SECURITY, TWO LOANS.
//
// 26 Oct 2026. Fabio, on a client in the book: "see how the portal doesnt not
// think logically 2 loans against same secuitry and it is not caluclating
// overall LVR".
//
// The fixture below is that client's actual rows, with the names changed. The
// numbers in the expectations are what the portal used to say beside them.
import { describe, it, expect } from 'vitest'
import {
  normaliseAddress, sameSecurity, securitiesOf, bookTotals, valueFor,
} from './one-security-many-loans'

const BOOK = [
  { id: '1', ordinal: 1, address: '25 Hartigan Crescent Campbell ACT 2612', investor: true,
    lender_raw: 'NAB', current_balance: 366000, estimated_current_value: 1600000,
    usable_equity: 914000 },
  { id: '2', ordinal: 2, address: 'Unit 113 26 Olwen St, LYNEHAM ACT 2602', investor: true,
    lender_raw: 'NAB Broker', current_balance: 252176.72, estimated_current_value: 419853,
    usable_equity: 83706 },
  { id: '3', ordinal: 3, address: '25 Hartigan Cres, CAMPBELL ACT 2612', investor: true,
    lender_raw: 'NAB Broker', current_balance: 663744.07, estimated_current_value: 1700000,
    usable_equity: 696256 },
  { id: '4', ordinal: 4, address: '7 Heseltine Street, DENMAN PROSPECT, ACT 2611', investor: false,
    lender_raw: 'NAB', current_balance: 908326, estimated_current_value: 1550000 },
]

describe('telling one property from another', () => {
  it('knows Crescent and Cres are the same street', () => {
    expect(sameSecurity('25 Hartigan Crescent Campbell ACT 2612',
                        '25 Hartigan Cres, CAMPBELL ACT 2612')).toBe(true)
  })

  it('and Street, Road and the rest of them', () => {
    expect(normaliseAddress('7 Heseltine Street, DENMAN PROSPECT, ACT 2611'))
      .toBe('7 heseltine st denman prospect act 2611')
  })

  it('but a unit is not the building it is in', () => {
    // The same fault in the other direction, and it would hide a property.
    expect(sameSecurity('Unit 113 26 Olwen St Lyneham', '26 Olwen St Lyneham')).toBe(false)
  })

  it('and two streets with the same number are two properties', () => {
    expect(sameSecurity('25 Hartigan Cres Campbell', '25 Hartigan Cres Watson')).toBe(false)
  })

  it('a row with no address is never merged with another', () => {
    const out = securitiesOf([{ id: 'a', address: '' }, { id: 'b', address: '  ' }])
    expect(out).toHaveLength(2)
  })
})

describe('the client the portal was wrong about', () => {
  const secs = securitiesOf(BOOK)
  const campbell = secs.find(s => s.key.startsWith('25 hartigan'))!
  const counted = secs.filter(s => s.investor)
  const totals = bookTotals(counted)

  it('four rows are three properties', () => {
    expect(secs).toHaveLength(3)
    expect(campbell.loans).toHaveLength(2)
  })

  it('what is owed on it is both loans together', () => {
    expect(campbell.owing).toBeCloseTo(1029744.07, 2)
  })

  it('and its equity is 80% of the value ONCE, less both', () => {
    // It used to read 914,000 + 696,256 = 1,610,256, because each row was
    // worked out as if it were the only loan on the house.
    expect(campbell.usable).toBe(250256)
    expect(campbell.usable).not.toBe(914000 + 696256)
  })

  it('the stored per-loan figures are ignored where rows were merged', () => {
    // They are not wrong by a little. Each one is 80% of the whole value less
    // one of the two loans.
    expect(campbell.rows.map(r => r.usable_equity)).toEqual([914000, 696256])
    expect(campbell.usable).toBe(250256)
  })

  it('but a figure somebody recorded on a single property still stands', () => {
    const lyneham = secs.find(s => s.key.includes('olwen'))!
    expect(lyneham.loans).toHaveLength(1)
    expect(lyneham.usable).toBe(83706)
  })

  it('the home is shown and not counted', () => {
    const home = secs.find(s => s.key.includes('heseltine'))!
    expect(home.investor).toBe(false)
    expect(home.usable).toBeNull()
  })

  it('the total equity is a third of what it said', () => {
    expect(totals.usable).toBe(333962)
    expect(totals.usable).toBeLessThan(1693962)
  })

  it('and the overall LVR is finally worked out', () => {
    // 1,281,920 owed against 2,019,853 of investment property.
    expect(totals.lvr).toBe(63.5)
    expect(totals.value).toBe(1600000 + 419853)
  })

  it('it says how many rows were folded, so the screen can show it', () => {
    expect(totals.merged).toBe(1)
  })
})

describe('two values for one house', () => {
  it('takes the lower where neither was dated', () => {
    // This figure goes in an email telling somebody what they can borrow. The
    // cost of being wrong in the generous direction is a conversation nobody
    // wants to have twice.
    expect(valueFor([{ estimated_current_value: 1700000 }, { estimated_current_value: 1600000 }]))
      .toEqual({ value: 1600000, values: [1600000, 1700000] })
  })

  it('and the one somebody looked up most recently where there is one', () => {
    const out = valueFor([
      { estimated_current_value: 1600000, valuation_date: '2026-01-10' },
      { estimated_current_value: 1700000, valuation_date: '2026-10-20' },
    ])
    expect(out.value).toBe(1700000)
  })

  it('says nothing where no value was ever recorded', () => {
    expect(valueFor([{}, {}])).toEqual({ value: null, values: [] })
  })
})

describe('what is not known is not zero', () => {
  it('a property with no balance anywhere has unknown equity, not 80%', () => {
    const [sec] = securitiesOf([{ id: '1', address: '1 Nowhere St', investor: true,
                                  estimated_current_value: 900000 }])
    expect(sec.owing).toBeNull()
    expect(sec.usable).toBeNull()
    expect(sec.usable).not.toBe(720000)
  })

  it('a recorded zero is an answer - it is paid off', () => {
    const [sec] = securitiesOf([{ id: '1', address: '1 Nowhere St', investor: true,
                                  current_balance: 0, estimated_current_value: 900000 }])
    expect(sec.owing).toBe(0)
    expect(sec.usable).toBe(720000)
  })

  it('a property past 80% reports the negative rather than hiding it', () => {
    // 720,000 of headroom against 800,000 owed. Clamping that at zero would
    // tell somebody the portfolio has equity it does not have - the list has
    // shown the real number since the day it was built.
    const [sec] = securitiesOf([{ id: '1', address: '1 Nowhere St', investor: true,
                                  current_balance: 800000, estimated_current_value: 900000 }])
    expect(sec.usable).toBe(-80000)
  })

  it('and one loan recorded out of two still counts what it knows', () => {
    const [sec] = securitiesOf([
      { id: '1', ordinal: 1, address: '1 Nowhere St', investor: true, current_balance: 300000, estimated_current_value: 900000 },
      { id: '2', ordinal: 2, address: '1 Nowhere St', investor: true, estimated_current_value: 900000 },
    ])
    expect(sec.loans).toHaveLength(2)
    expect(sec.owing).toBe(300000)
  })
})

describe('a home is never folded in with an investment', () => {
  it('even where the book put them at the same address', () => {
    // The book disagreeing with itself about what a property is cannot be
    // resolved by guessing, so they stay apart and the home stays uncounted -
    // which is the safe direction.
    const out = securitiesOf([
      { id: '1', ordinal: 1, address: '1 Example St', investor: false, current_balance: 500000, estimated_current_value: 900000 },
      { id: '2', ordinal: 2, address: '1 Example St', investor: true, estimated_current_value: 900000 },
    ])
    expect(out).toHaveLength(2)
    expect(out.filter(s => s.investor)).toHaveLength(1)
  })
})

describe('the figures are whole dollars', () => {
  it('because a client email does not say $250,255.93', () => {
    const secs = securitiesOf(BOOK)
    for (const s of secs) {
      if (s.usable !== null) expect(Number.isInteger(s.usable), `${s.address}`).toBe(true)
    }
  })
})
