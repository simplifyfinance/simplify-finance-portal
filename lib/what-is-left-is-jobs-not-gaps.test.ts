// WHAT IS LEFT BEFORE THE CREDIT NOTES - COUNTED AS JOBS, NOT AS EMPTY BOXES.
//
// 13 Oct 2026, the Veljovic deal. The strip carried a red box reading "14 things
// are needed before the credit notes can be written", six identical lines, and
// "and 8 more". Fabio: "audti this box? confused with meaning".
//
// There were two things to do.
//
// Ten of the fourteen were one untick. A split's product is read off whichever
// lending option is marked as recommended - it is not typed on the split at all.
// With no option picked there is nothing to read, so all ten splits reported it.
// The box listed ten faults for one unmade decision and named the decision
// nowhere.
//
// The four that were real were the ones hidden behind "and 8 more", because the
// list showed the first six and the first six were all the same kind.
//
// It also printed each split's LABEL, and labels repeat - three lines read
// "Existing Investment Home loan" with nothing to tell them apart. The number is
// printed on the row directly above and is the only thing a person can act on.
//
// AND IT WAS RED. Fabio: "I dont like warnigns for the sake of warnigns unless
// it is needed meaning BC and LO are not mtching". A deal halfway through being
// written has blanks in it; that is a deal in progress, not a fault. Red belongs
// to splitsDisagree, and it only reads as a fault while nothing else on the page
// is wearing it too.
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { whatIsLeft, splitsNamed } from './deal-structure'

const strip = readFileSync('components/DealStructure.tsx', 'utf8')

// Answered on the BC: purpose, repayment type, and a term for the whole deal.
// What is left on these is the product, which is the point.
const bcSplits = (n: number) => Array.from({ length: n }, (_, i) => ({
  label: i % 2 === 0 ? 'Existing Investment Home loan' : 'Investment equity loan split',
  amount: '250000', purpose: 'INV', type: 'P&I',
}))

const deal = (n: number, over: any = {}) => ({
  bc_data: { template: 'refinance_only', loanTerm: '30', splits: bcSplits(n) },
  lo_data: {},
  ...over,
})

describe('ten splits missing a product is one job, not ten', () => {
  it('says so, and counts it once', () => {
    const left = whatIsLeft(deal(10))
    expect(left.pickLender).toBe(true)
    expect(left.jobs).toBe(1)
    expect(left.ofSplits).toBe(10)
  })

  it('and does not also list the ten', () => {
    const left = whatIsLeft(deal(10))
    expect(left.lines.map(l => l.what).join(' ')).not.toContain('product')
  })

  // ONE split blank while the rest are answered is that split's own gap. The
  // shortcut is only honest when the missing recommendation really is the cause.
  it('but a single blank among answered ones is listed as itself', () => {
    const d: any = deal(3)
    d.lo_data = { lenders: [{ id: 'o1', productName: 'Simple Home Loan' }], recommendedOptionId: 'o1' }
    d.compliance_data = { splitDetail: { s0: { productType: '' } } }
    const left = whatIsLeft(d)
    expect(left.pickLender).toBe(false)
  })
})

describe('it names the split by its number', () => {
  it('one of them', () => {
    expect(splitsNamed([7])).toBe('Split 7')
  })

  it('several, as a person would say it', () => {
    expect(splitsNamed([7, 8, 9, 10])).toBe('Splits 7, 8, 9 and 10')
    expect(splitsNamed([2, 3])).toBe('Splits 2 and 3')
  })

  it('and never the label, which repeats', () => {
    const left = whatIsLeft(deal(4, {
      bc_data: {
        template: 'refinance_only', loanTerm: '30',
        splits: bcSplits(4).map(s => ({ ...s, type: '' })),
      },
    }))
    const line = left.lines.find(l => l.what.includes('principal and interest'))
    expect(line!.splits).toEqual([1, 2, 3, 4])
    expect(JSON.stringify(left.lines)).not.toContain('Existing Investment Home loan')
  })
})

describe('the words are what to do, not what the box is called', () => {
  it('no field names reach the screen', () => {
    const left = whatIsLeft(deal(2, {
      bc_data: { template: 'refinance_only', loanTerm: '', splits: bcSplits(2).map(s => ({ ...s, type: '', purpose: '' })) },
    }))
    const said = left.lines.map(l => l.what).join(' | ')
    expect(said).not.toContain('product type')
    expect(said).not.toContain('repayment type')
    expect(said).toContain('owner occupied or investment')
    expect(said).toContain('principal and interest or interest only')
  })
})

describe('the strip itself', () => {
  it('no longer paints this red', () => {
    // lastIndexOf: the first `left.jobs > 0` is the count chip in the heading,
    // which has its own test below. This is the box itself.
    const at = strip.lastIndexOf('left.jobs > 0')
    const block = strip.slice(at, at + 1800)
    expect(block, 'the quiet box is red again').not.toContain('bg-chase-bg')
    expect(block).toContain('bg-page')
  })

  it('and neither is the count in the heading', () => {
    const chip = strip.slice(strip.indexOf('to complete') - 400, strip.indexOf('to complete'))
    expect(chip).not.toContain('text-chase')
  })

  // Red is not banned from this file - it is RESERVED. splitsDisagree is a real
  // fault and keeps it.
  it('but the two lists disagreeing still is', () => {
    expect(strip).toContain('The two split lists do not match')
    const warn = strip.slice(strip.indexOf('splitGap && ('), strip.indexOf('splitGap && (') + 400)
    expect(warn).toContain('bg-chase-bg')
  })

  it('shows all of them rather than the first six', () => {
    expect(strip).not.toContain('needed.slice(0, 6)')
    expect(strip).not.toContain('and {needed.length - 6} more')
  })

  it('and the sentence about money that was not on screen is gone', () => {
    expect(strip).not.toContain('nothing useful about that money')
  })
})

describe('when there is nothing left it says nothing', () => {
  it('no jobs, no box', () => {
    const d: any = deal(2)
    d.lo_data = { lenders: [{ id: 'o1', productName: 'Simple Home Loan' }], recommendedOptionId: 'o1' }
    const left = whatIsLeft(d)
    expect(left.jobs).toBe(0)
    expect(left.lines).toEqual([])
    expect(left.pickLender).toBe(false)
  })
})
