import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { loanAmount, bcSplitsTotal, loanAmountDisagrees } from './funds-to-complete'

// THE LOAN AMOUNT HAD TWO HOMES AND NOTHING SAID WHICH ONE WAS TRUE.
//
// 8 Oct 2026. A borrowing capacity was changed from one loan amount to
// another. The deal card, the funds to complete, the deal facts and the prompt
// that writes the COMPLIANCE WORDING all went on quoting the old figure, and
// nothing on screen said so. Fabio: "we changed the loan amoutn in BC but not
// carrying accross to LO ... imperative it does".
//
// The cause: lo_data.loanAmount is a COPY the LO form takes from the BC when
// the LO record is first written, and every reader preferred the copy. Opening
// the LO afterwards pulls the new figure onto the screen but deliberately does
// not save it - a visit must never write, because a visit once overwrote a real
// lodged amount with this form's estimate.
//
// The fix is not a button. A button would have to write lo_data, and that
// column has one owner; a second writer loses its changes the next time
// somebody types on the LO. The fix is that a copy no longer outranks the
// thing it was copied from. Only a figure a PERSON TYPED does.

const lo = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const structure = readFileSync('components/DealStructure.tsx', 'utf8')
const figures = readFileSync('lib/deal-figures.ts', 'utf8')

const bcOf = (...amounts: number[]) => ({ splits: amounts.map((a, i) => ({ label: `Split ${i + 1}`, amount: String(a) })) })

describe('a changed BC carries across by itself', () => {
  it('beats a copy the lending options are still holding', () => {
    const deal = { bc_data: bcOf(810000), lo_data: { loanAmount: '522,000' } }
    expect(loanAmount(deal), 'the stale copy is winning again - this is the whole\n'
      + 'fault of 8 Oct 2026 and it reaches the compliance wording').toBe(810000)
  })

  it('adds up every split, never the first', () => {
    expect(loanAmount({ bc_data: bcOf(405000, 405000) })).toBe(810000)
    expect(bcSplitsTotal({ bc_data: bcOf(405000, 405000) })).toBe(810000)
  })

  it('needs nothing pressed to do it', () => {
    // No button, no second writer on lo_data. The BC simply outranks a copy.
    expect(structure, 'the deal structure writes lo_data. That column has one\n'
      + 'owner - the LO form - and a second writer loses its changes.')
      .not.toMatch(/'lo_data'/)
  })
})

describe('but a figure somebody typed is still theirs', () => {
  it('wins over the BC when it was entered by hand', () => {
    const deal = { bc_data: bcOf(810000), lo_data: { loanAmount: '522,000', loanAmountByHand: true } }
    expect(loanAmount(deal), 'a figure a broker entered on purpose is being\n'
      + 'overruled by the BC. The flag exists so that cannot happen.').toBe(522000)
  })

  it('and the contract beats both, as it always did', () => {
    const deal = {
      contract_loan_amount: '700,000',
      bc_data: bcOf(810000),
      lo_data: { loanAmount: '522,000', loanAmountByHand: true },
    }
    expect(loanAmount(deal)).toBe(700000)
  })

  it('falls back to the LO on a deal with no BC splits at all', () => {
    expect(loanAmount({ lo_data: { loanAmount: '522,000' } })).toBe(522000)
  })
})

describe('the lending options record who put the number there', () => {
  it('sets the flag on all four ways a person lands a figure in that box', () => {
    // The loan box itself, and the three figures that recalculate it: price,
    // deposit and stamp duty. All four are deliberate acts describing THIS
    // lending.
    const hands = lo.match(/loanAmountByHand: true/g) || []
    expect(hands.length, 'a handler that a person types through no longer records\n'
      + 'that the loan amount is theirs, so their figure will be overruled by the BC')
      .toBeGreaterThanOrEqual(5)
  })

  it('never sets it when the form copies the BC in', () => {
    // If either copy site ever claims the flag, one VISIT to the lending
    // options freezes the BC's figure for good and the fault comes straight
    // back - this time looking like a deliberate override.
    const copies = lo.match(/loanAmount: bcLoanAmount\(\),\s*\n\s*loanAmountByHand: false,/g) || []
    expect(copies.length, 'a place that copies the BC in is no longer declaring\n'
      + 'itself as a copy').toBe(2)
    expect(lo).not.toMatch(/loanAmount: bcLoanAmount\(\),\s*\n\s*loanAmountByHand: true/)
  })
})

describe('and nothing changes quietly', () => {
  it('reports two records that disagree', () => {
    const copy = loanAmountDisagrees({ bc_data: bcOf(810000), lo_data: { loanAmount: '522,000' } })
    expect(copy).toEqual({ using: 810000, stored: 522000, byHand: false })

    const typed = loanAmountDisagrees({ bc_data: bcOf(810000), lo_data: { loanAmount: '522,000', loanAmountByHand: true } })
    expect(typed).toEqual({ using: 522000, stored: 522000, byHand: true })
  })

  it('says nothing when they agree, or when there is only one of them', () => {
    expect(loanAmountDisagrees({ bc_data: bcOf(810000), lo_data: { loanAmount: '810,000' } })).toBeNull()
    expect(loanAmountDisagrees({ bc_data: bcOf(810000) })).toBeNull()
    expect(loanAmountDisagrees({ lo_data: { loanAmount: '522,000' } })).toBeNull()
    // An answered contract settles it; there is no disagreement left to report.
    expect(loanAmountDisagrees({
      contract_loan_amount: '700,000', bc_data: bcOf(810000), lo_data: { loanAmount: '522,000' },
    })).toBeNull()
  })

  it('draws it on the deal, with both figures named', () => {
    expect(structure).toContain('loanAmountDisagrees')
    expect(structure).toMatch(/showing an older loan amount/i)
    expect(structure).toMatch(/entered by hand/i)
  })
})

describe('and compliance written before the change says so', () => {
  it('stamps the BC splits, which nothing used to watch', () => {
    // Every compliance box is stamped with what it was written from, so it can
    // be marked stale by name when those figures move. The list came from the
    // fact find and the lending options and never from the BC - so changing
    // the loan in the BC marked nothing stale at all. The guard built to catch
    // this was being shown the one number that could not change.
    expect(figures, "the stamp no longer watches the BC's splits")
      .toMatch(/bc_data\?\.splits/)
    expect(figures).toMatch(/the BC total lending/)
  })

  it('names each split as well as the total', () => {
    // One split of 810,000 and two of 405,000 have the same total and are not
    // the same lending, and the compliance prose describes the splits.
    expect(figures).toMatch(/the BC's \$\{label\}|the BC's \$\{/)
  })
})
