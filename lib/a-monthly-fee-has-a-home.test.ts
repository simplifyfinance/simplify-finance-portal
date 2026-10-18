import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// 18 Oct 2026. Fabio: "I need to find to add a box that says monthly fees box
// on product library it is causing confusion."
//
// WHAT WAS ACTUALLY MISSING. The LO lender already had a monthlyFee field -
// built with bridging, beside the establishment and doc processing fees. The
// PRODUCT had no such box, so a lender charging $10 a month on an ordinary loan
// had nowhere for it to come from. It went into the annual box as $120, a
// figure the lender never wrote, or into Internal notes, which nothing reads.
//
// So the field was never the gap. The library was.

const LIB = readFileSync('components/LenderLibrary.tsx', 'utf8')
const LO = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const CMP = readFileSync('lib/lender-comparison.ts', 'utf8')
const EMAIL = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')
const SQL = readFileSync('docs/monthly-fee-schema.sql', 'utf8')

describe('the product library', () => {
  it('has a monthly fee box beside the annual one', () => {
    expect(LIB).toContain('label className="text-xs text-gray-400 block mb-1">Monthly fee<')
    expect(LIB).toContain('productForm.monthly_fee')
  })

  it('saves it, loads it back when editing, and copies it off an extraction', () => {
    expect(LIB).toContain("monthly_fee: product.monthly_fee || ''")
    expect(LIB).toContain("monthly_fee: p.monthly_fee || ''")
    expect(LIB).toContain("'monthly_fee'")       // in FEE_FIELDS
  })

  // ONE COLUMN, NOT TWO. A lender charges one or the other, so a second column
  // would be empty on every row.
  it('shows whichever is charged in one Ongoing column', () => {
    expect(LIB).toContain('>Ongoing</th>')
    expect(LIB).toContain('product.monthly_fee && !product.annual_fee')
  })
})

describe('the lending options', () => {
  it('fills the lender from the product', () => {
    expect(LO).toContain("monthlyFee: product.monthly_fee || ''")
  })

  // THE FIELD ALREADY EXISTED - the test is that it is not declared twice.
  it('declares monthlyFee once on the lender, not twice', () => {
    expect((LO.match(/^  monthlyFee: string$/gm) || []).length).toBe(1)
  })

  // Bridging has its own Monthly fee box beside the establishment fee. Two
  // boxes onto one value is how figures come to disagree.
  it('does not draw a second box for it on a bridge', () => {
    expect(LO).toContain('{!isBridging && (')
    const atLibrary = LO.indexOf('<LibraryField label="Monthly fee"')
    const gate = LO.lastIndexOf('{!isBridging && (', atLibrary)
    expect(gate).toBeGreaterThan(-1)
    expect(atLibrary - gate).toBeLessThan(400)
  })
})

describe('the comparison', () => {
  // ADDING IT TO THE ONGOING LIST WOULD HAVE COMPARED $10 AGAINST $395 and
  // called the first cheaper by $385. The arithmetic needs one unit.
  it('annualises a monthly fee for the arithmetic', () => {
    expect(CMP).toContain('const monthlyAsAnnual = (l: any) => fee(l?.monthlyFee) * 12')
    expect(CMP).toContain('+ monthlyAsAnnual(l)')
  })

  it('and counts it as a known ongoing cost', () => {
    expect(CMP).toContain("recorded(l?.monthlyFee)")
  })

  it('but never folds it into the annual list, which would not be annualised', () => {
    expect(CMP).toContain("const ONGOING = ['annualFee']")
  })
})

describe('what the client reads', () => {
  // The words stay the lender's. $10 a month is charged monthly, and that is
  // when they will see it leave the account.
  it('prints the monthly fee in its own units', () => {
    expect(EMAIL).toContain('tick("Monthly fee: " + feeText(l.monthlyFee))')
  })

  it('and the bridging line it has always had is untouched', () => {
    expect(EMAIL).toContain('Monthly Loan Account Fee of ')
  })
})

describe('the column', () => {
  it('is text, like every other fee on that table', () => {
    expect(SQL).toContain('add column if not exists monthly_fee text')
  })

  it('and is safe to run twice on staging and on live', () => {
    expect(SQL).toContain('if not exists')
    expect(SQL).toContain('RUN ON STAGING AND LIVE')
  })
})
