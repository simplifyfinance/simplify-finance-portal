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

// 13 OCT 2026: A FIGURE TYPED ON THE LENDING OPTIONS IS NO LONGER THEIRS.
//
// This block used to say the opposite, and it was right at the time: the
// lending options held a stale COPY of the BC's amount, there was no way to
// tell a stale copy from a deliberate figure, so a flag marked the deliberate
// ones and they won.
//
// What that produced on the Veljovic deal: $1,000,000 on the lending options
// against a borrowing capacity of $2,720,000, with a blue banner on the strip
// calmly explaining that the typed figure wins and is "what the client sees and
// what the compliance wording uses".
//
// Fabio, 13 Oct 2026: "why LO anc BC amount dont match fucking hell".
//
// They cannot now. How much is being borrowed is the sum of the splits; the
// splits are the borrowing capacity's; so the total is the borrowing
// capacity's. The lending options price the loan, they do not size it.
// loanAmountByHand is still on records already saved and is never read.
describe('the borrowing capacity sizes the loan', () => {
  it('its splits win over anything typed on the lending options', () => {
    const deal = { bc_data: bcOf(810000), lo_data: { loanAmount: '522,000', loanAmountByHand: true } }
    expect(loanAmount(deal)).toBe(810000)
  })

  it('and the contract beats both, as it always did', () => {
    const deal = {
      contract_loan_amount: '700,000',
      bc_data: bcOf(810000),
      lo_data: { loanAmount: '522,000', loanAmountByHand: true },
    }
    expect(loanAmount(deal)).toBe(700000)
  })

  // A deal with no BC splits at all - a pre-approval somebody started on the
  // lending options - still has to report something.
  it('but with no BC splits the lending options figure is all there is', () => {
    expect(loanAmount({ bc_data: {}, lo_data: { loanAmount: '522,000' } })).toBe(522000)
  })

  it('nothing in the portal reads the flag any more', () => {
    const { readdirSync } = require('fs')
    const reads: string[] = []
    for (const dir of ['lib', 'components']) {
      for (const f of readdirSync(dir).filter((f: string) => f.endsWith('.ts') || f.endsWith('.tsx'))) {
        if (f.includes('.test.')) continue
        const src = readFileSync(`${dir}/${f}`, 'utf8').replace(/\/\/[^\n]*/g, '')
        if (/loanAmountByHand/.test(src)) reads.push(`${dir}/${f}`)
      }
    }
    expect(reads, 'the flag is being read again').toEqual([])
  })
})
