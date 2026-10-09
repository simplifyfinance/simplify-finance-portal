import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
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

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const full = join(dir, n)
    if (n === 'node_modules' || n === '.next' || n === '_to_delete') return []
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(n) ? [full] : []
  })
}

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

  it('and every reader goes through the one function', () => {
    // THE FAULT THAT SURVIVED THE FIRST FIX. loanAmount() was corrected and
    // four call sites never called it - they reached into lo_data.loanAmount
    // themselves. So the deal CARD, the contract panel, the offer-accepted
    // panel and the COMPLIANCE WORDING kept quoting the old figure while the
    // deal page showed the new one. Fabio: "the deal card still shows 522".
    //
    // One source of truth is not one source of truth while anybody keeps their
    // own copy of the rule.
    const offenders: string[] = []
    for (const dir of ['lib', 'app', 'components']) {
      for (const f of walk(dir)) {
        if (/\.test\.tsx?$/.test(f)) continue
        if (f.endsWith('funds-to-complete.ts')) continue  // where the rule lives
        if (f.endsWith('LOForm.tsx')) continue            // the form that owns the record
        // loFigures() asks a different question: does the SAVED LO EMAIL still
        // match the LO record it was built from. The email prints the record's
        // own loanAmount, so the check has to read the same thing or it would
        // be comparing the email against a figure the email never used.
        //
        // KNOWN GAP, 8 Oct 2026. An LO email saved before a BC change quotes
        // the old loan and this check will call it fresh, because the record
        // still holds the old figure too. Regenerating the email picks up the
        // new one. Fixing it properly means the email reading loanAmount(deal)
        // as well, and that is its own piece of work.
        if (f.endsWith('deal-figures.ts')) continue
        // CODE, NOT PROSE. Every one of these files now carries a comment
        // SAYING it used to read lo_data.loanAmount, and a guard that cannot
        // tell an explanation from an instruction fails on the explanation -
        // which is how it would get weakened rather than obeyed.
        const text = readFileSync(f, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '')
        if (/lo_data\??\.loanAmount|lo\?\.loanAmount/.test(text)) offenders.push(f)
      }
    }
    expect(offenders, "this file reads the lending options' stored loan amount\n"
      + 'directly instead of calling loanAmount(deal), so a changed BC will not\n'
      + 'reach it.\n' + offenders.join('\n')).toEqual([])
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

  it('says nothing at all about a stale copy', () => {
    // The first version drew a red banner for this case. Nothing reads the
    // copy, nothing can be done about it, and there is no way to clear it - a
    // permanent red warning about dead data. Fabio: "this ridiculous red line
    // is still there??" He is right. A handled thing does not need a banner.
    expect(structure, 'the stale copy is being warned about again')
      .not.toMatch(/older loan amount/i)
    expect(structure, 'it tells somebody to type into a Loan amount box, which\n'
      + 'is never drawn on a refinance').not.toMatch(/type it to make the two agree/i)
    expect(structure, 'the line is drawn for every disagreement again, not only\n'
      + 'for one somebody made on purpose').toContain('loanSplit?.byHand &&')
  })

  it('but names a figure somebody entered on purpose', () => {
    // One of the two numbers goes in front of a client. Blue, not red: this is
    // information, not a fault.
    expect(structure).toContain('loanAmountDisagrees')
    expect(structure).toMatch(/entered on the lending options/i)
    const block = structure.slice(structure.indexOf('{loanSplit?.byHand &&'))
    expect(block.slice(0, 400), 'a recorded decision is being shown as an error')
      .toContain('bg-info-bg')
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
