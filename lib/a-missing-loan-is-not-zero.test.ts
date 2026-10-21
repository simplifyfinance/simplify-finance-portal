import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { loanIsUnknown, usableForTheList } from './portfolio-review'
import { figuresFor } from '../components/PortfolioReview'

// A MISSING LOAN IS NOT A LOAN OF ZERO.
//
// A property that comes across with a value and nothing against it is not an
// unencumbered one. Read as zero, 80% of a $900,000 house is $720,000 of
// equity on a property we know nothing about, and it sorts above every client
// who really does have a loan and really might have equity.
//
// Fabio, asked whether to hide them or mark them: "loan unknown".
//
// WHAT WAS ACTUALLY THERE. Checked against the database on 21 Oct 2026, after
// a count in this comment turned out to have been made up rather than read:
// 656 reviews, 646 carrying at least one investment property, 760 properties
// in all, and NONE of them missing a loan. Every one carried the book's
// original figure. So this rule protects nobody today - it is the next import
// with an unmapped column that it is there for.


const prop = (over: any = {}) => ({
  id: 'x', ordinal: 1, address: '1 Example St', investor: true,
  original_value: 900000, original_loan: null,
  estimated_current_value: null, current_balance: null,
  usable_equity: null, ...over,
})

describe('what counts as unknown', () => {
  it('is a property with no loan figure anywhere', () => {
    expect(loanIsUnknown(prop())).toBe(true)
  })

  // A recorded zero IS an answer: somebody wrote down that it is paid off.
  it('is not a recorded zero', () => {
    expect(loanIsUnknown(prop({ original_loan: 0 }))).toBe(false)
    expect(loanIsUnknown(prop({ current_balance: 0 }))).toBe(false)
  })

  it('is not a property with a balance', () => {
    expect(loanIsUnknown(prop({ current_balance: 400000 }))).toBe(false)
  })
})

describe('the figure the list shows', () => {
  it('refuses to invent one where the loan is unknown', () => {
    expect(usableForTheList(prop())).toBe('unknown')
  })

  // The old behaviour, named so it cannot come back.
  it('does not report 80% of the value as equity', () => {
    expect(usableForTheList(prop())).not.toBe(720000)
  })

  it('works it out properly where the loan is recorded', () => {
    expect(usableForTheList(prop({ original_loan: 400000 }))).toBe(320000)
  })

  it('treats a paid-off property as paid off', () => {
    expect(usableForTheList(prop({ original_loan: 0 }))).toBe(720000)
  })

  // A figure somebody worked out and wrote down is never recalculated over.
  it('always prefers a figure a person recorded', () => {
    expect(usableForTheList(prop({ usable_equity: 111000 }))).toBe(111000)
  })

  // The home is shown and not counted - counting it would inflate the email.
  it('says nothing about an owner occupied home', () => {
    expect(usableForTheList(prop({ investor: false }))).toBe(null)
  })
})

describe('the client line agrees with the rows under it', () => {
  it('says the loan is unknown when no counted property has one', () => {
    const f = figuresFor([prop(), prop({ id: 'y', ordinal: 2 })] as any)
    expect(f.loanUnknown).toBe(true)
    expect(f.usable).toBe(null)
  })

  it('does not say so once one property has a loan', () => {
    const f = figuresFor([prop(), prop({ id: 'y', ordinal: 2, original_loan: 400000 })] as any)
    expect(f.loanUnknown).toBe(false)
    expect(f.usable).toBeGreaterThan(0)
  })

  // The home is not counted either way, so a portfolio of one home and one
  // unknown investment is still unknown.
  it('ignores the home when deciding', () => {
    const f = figuresFor([prop({ investor: false, original_loan: 500000 }), prop({ id: 'y' })] as any)
    expect(f.loanUnknown).toBe(true)
  })
})

describe('and it does not jump the queue', () => {
  const page = readFileSync('components/PortfolioReview.tsx', 'utf8')

  it('sorts below everyone whose equity is actually known', () => {
    expect(page).toContain('fa.loanUnknown ? -Infinity')
    expect(page).toContain('fb.loanUnknown ? -Infinity')
  })

  it('says loan unknown rather than showing a dash', () => {
    expect(page).toContain('loan unknown')
    expect(page).toContain('not recorded')
  })
})
