// EVERY DOCUMENT NAMES THE SAME LENDER.
//
// Fabio, 29 Sep 2026: "I cant afford these delays if we are changing complaicne
// notes we need to think logically that thepdfs are also impacted so on".
//
// He is right, and this file exists because I did not. The client's decision to
// leave Macquarie for ubank was recorded correctly on 29 September, and the
// wrong name then surfaced in four separate places across four separate ten
// minute ships: the deal structure strip, the facts the notes are written from,
// the whole of the handover's assessment, and the recommendation sentence a
// client signs.
//
// They are one bug. There is one question - WHICH LENDER IS THIS DEAL WITH -
// and three functions in lib/client-agreement.ts that answer it:
//
//   lenderOnTheDeal   the name
//   optionOnTheDeal   its product, rate, fees and turnaround
//   labelOnTheDeal    the two together, for a heading
//
// Anything a client or the compliance team reads must go through one of them.
// The tests in lib/lender-on-the-deal.test.ts stop a LIBRARY asking the
// recommendation instead. This file covers the rest of the chain - the pages
// and the routes that build a document - because a guard that only watches lib
// is how the handover page kept the old line after both PDFs were fixed.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { lenderOnTheDeal, optionOnTheDeal, labelOnTheDeal } from './client-agreement'

// Everything that prints a lender onto something a person outside the portal
// reads: the three PDFs, the handover page, the fact find sheet, the pack.
const DOCUMENTS = [
  'app/api/generate-compliance-pdf/route.tsx',
  'app/api/generate-summary-pdf/route.tsx',
  'app/(app)/deals/[id]/handover/page.tsx',
  'lib/factfind-form-content.ts',
  'lib/handover-view.ts',
  'lib/box-one.ts',
  'lib/box-four.ts',
  'lib/deal-facts.ts',
]

const code = (f: string) => readFileSync(f, 'utf8')
  .split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('one question, one answer, every document', () => {
  it('every document asks the deal, not the recommendation', () => {
    const offenders = DOCUMENTS.filter(f => !/lenderOnTheDeal|optionOnTheDeal|labelOnTheDeal/.test(code(f)))
    expect(offenders,
      'These build something a client or the compliance team reads and none of\n'
      + 'them ask which lender the deal is on:\n\n  ' + offenders.join('\n  ')).toEqual([])
  })

  it('no document falls back to the recommendation when the deal has an answer', () => {
    // `deal.lenders?.name || lo.recommendedLender` is the exact shape that left
    // the handover page saying Macquarie after both PDFs were fixed.
    const offenders = DOCUMENTS.filter(f => /recommendedLender\s*\|\|/.test(code(f))
      || /\|\|\s*[^\n]*recommendedLender/.test(code(f)))
    expect(offenders).toEqual([])
  })
})

describe('the three answers agree with each other', () => {
  const lo = {
    recommendedLender: 'Macquarie',
    recommendedOptionId: 'm1',
    clientAgreedLender: 'No',
    clientChosenLender: 'ubank',
    lenders: [
      { id: 'm1', lenderName: 'Macquarie', productName: 'Offset Home Loan' },
      { id: 'u1', lenderName: 'ubank', productName: 'Neat Home Loan' },
    ],
  }

  it('name the same bank', () => {
    expect(lenderOnTheDeal(lo)).toBe('ubank')
    expect(optionOnTheDeal(lo)?.lenderName).toBe('ubank')
    expect(labelOnTheDeal(lo)).toBe('ubank — Neat Home Loan')
  })

  it('and all three follow the client back again', () => {
    const agreed = { ...lo, clientAgreedLender: 'Yes', clientChosenLender: '' }
    expect(lenderOnTheDeal(agreed)).toBe('Macquarie')
    expect(optionOnTheDeal(agreed)?.productName).toBe('Offset Home Loan')
    expect(labelOnTheDeal(agreed)).toBe('Macquarie — Offset Home Loan')
  })

  it('never hand back the turned-down lender when the chosen one has no option', () => {
    // The trap: a right name with another bank's rate and product underneath it.
    const noOption = { ...lo, lenders: [lo.lenders[0]] }
    expect(lenderOnTheDeal(noOption)).toBe('ubank')
    expect(optionOnTheDeal(noOption)).toBeNull()
    expect(labelOnTheDeal(noOption)).toBe('ubank')
  })
})
