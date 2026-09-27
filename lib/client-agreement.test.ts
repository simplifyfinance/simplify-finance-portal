// CHARLES MULLINS 2026.
//
// The lending options tab said Bankwest. The compliance tab said "Client chose
// a different lender: AMP", and the pack was about to go to the compliance team
// saying the clients had chosen AMP. Nobody had chosen AMP.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { clientAgreement, agreementFields, lenderOnTheDeal, chosenLenderName } from './client-agreement'

describe('the lending options tab is the answer', () => {
  it('reads a Yes', () => {
    expect(clientAgreement({ clientAgreedLender: 'Yes' }))
      .toEqual({ agreed: 'Yes', chosen: '', reason: '' })
  })

  it('reads a No, with who they chose and why', () => {
    expect(clientAgreement({
      clientAgreedLender: 'No', clientChosenLender: 'AMP',
      clientChosenLenderReason: 'Existing relationship',
    })).toEqual({ agreed: 'No', chosen: 'AMP', reason: 'Existing relationship' })
  })

  it('resolves a lender typed in by hand', () => {
    expect(clientAgreement({
      clientAgreedLender: 'No', clientChosenLender: '__other__',
      clientChosenLenderOther: 'Great Southern Bank',
    }).chosen).toBe('Great Southern Bank')
    // The places that forgot this check printed the code itself on screen.
    expect(chosenLenderName({ clientChosenLender: '__other__', clientChosenLenderOther: 'X' })).toBe('X')
  })

  it('nothing answered is nothing answered', () => {
    expect(clientAgreement({}).agreed).toBe('')
    expect(clientAgreement(null).agreed).toBe('')
    expect(clientAgreement({ clientAgreedLender: '  ' }).agreed).toBe('')
  })

  it('a Yes carries no chosen lender, whatever is lying underneath it', () => {
    // The deal was once "No, AMP" and is now "Yes". AMP must not survive.
    expect(clientAgreement({ clientAgreedLender: 'Yes', clientChosenLender: 'AMP' }))
      .toEqual({ agreed: 'Yes', chosen: '', reason: '' })
  })
})

describe('the compliance copy is rebuilt, never kept', () => {
  it('THE BUG: a stale compliance copy does not survive the lender changing', () => {
    // Compliance held "No / AMP" from when AMP was the recommendation. The
    // lending options tab has since been changed to Bankwest and nobody has
    // answered the question against it.
    const lo = { recommendedLender: 'Bankwest' }
    expect(agreementFields(lo)).toEqual({
      clientAgreedLender: '', clientChosenLender: '',
      clientChosenLenderOther: '', clientChosenLenderReason: '',
    })
    // Not captured, which is the truth, and the pack says so in capitals.
    expect(clientAgreement(lo).agreed).toBe('')
  })

  it('a Yes clears the three fields underneath it', () => {
    expect(agreementFields({ clientAgreedLender: 'Yes' })).toEqual({
      clientAgreedLender: 'Yes', clientChosenLender: '',
      clientChosenLenderOther: '', clientChosenLenderReason: '',
    })
  })

  it('a No is copied across whole', () => {
    expect(agreementFields({
      clientAgreedLender: 'No', clientChosenLender: '__other__',
      clientChosenLenderOther: 'Great Southern Bank', clientChosenLenderReason: 'Rate',
    })).toEqual({
      clientAgreedLender: 'No', clientChosenLender: '__other__',
      clientChosenLenderOther: 'Great Southern Bank', clientChosenLenderReason: 'Rate',
    })
  })
})

describe('the lender the notes are about', () => {
  it('is the recommendation when the clients took it', () => {
    expect(lenderOnTheDeal({ recommendedLender: 'Bankwest', clientAgreedLender: 'Yes' })).toBe('Bankwest')
  })

  it('is the recommendation when nobody has answered yet', () => {
    expect(lenderOnTheDeal({ recommendedLender: 'Bankwest' })).toBe('Bankwest')
  })

  it('is the clients’ own lender when they went elsewhere', () => {
    expect(lenderOnTheDeal({
      recommendedLender: 'Bankwest', clientAgreedLender: 'No', clientChosenLender: 'AMP',
    })).toBe('AMP')
  })

  it('falls back to the recommendation when a No never named anybody', () => {
    expect(lenderOnTheDeal({ recommendedLender: 'Bankwest', clientAgreedLender: 'No' })).toBe('Bankwest')
  })
})

// THE PROSE AND THE STAMP MUST NAME THE SAME LENDER.
//
// The notes were written with "Recommended lender: AMP" and stamped
// "Bankwest". Two lenders, one note, and a freshness check that could never
// fire. Both now come from lenderOnTheDeal.
describe('the compliance form asks this file, not itself', () => {
  const src = readFileSync(new URL('../app/(app)/deals/[id]/ComplianceForm.tsx', import.meta.url), 'utf8')
  const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  it('the compliance copy is no longer kept in preference to the answer', () => {
    expect(code, 'compliance still keeps its own stale copy')
      .not.toContain('prev.clientAgreedLender || loLive.clientAgreedLender')
    expect(code).toContain('agreementFields(')
  })

  it('the stamp records the lender the notes were written about', () => {
    expect(code).toContain('lender: lenderOnTheDeal(lo)')
  })

  // The deal ROW carries the lender for the PDF header, the commission maths,
  // the clawback window and the settlement board. It used to be written only
  // when the client went elsewhere, so a client who changed their mind BACK
  // left the row pointing at a lender the deal was no longer with.
  it('points the deal row at the lender on every save, not only on a No', () => {
    expect(code).toContain('const chosenName = lenderOnTheDeal(deal.lo_data || {})')
    expect(code).not.toContain("liveD.current.clientAgreedLender === 'No'")
  })

  it('and the model is told the same one', () => {
    expect(code).toContain('recommendedLender: lenderOnTheDeal(lo)')
    // The old inline ternary named a different lender to the stamp.
    expect(code).not.toContain("if (d.clientAgreedLender === 'No') {")
  })
})

// "how do we avoid this as this happens all the time customers change their
// mind a button perhaps??" - Fabio, 25 Sep 2026.
//
// The question was only ever asked inside the box that moves a deal to
// compliance, and that box emails the client. So correcting the answer meant
// emailing them a second time, and nobody ever would.
describe('the client can change their mind without being emailed again', () => {
  const src = readFileSync(new URL('../app/(app)/deals/[id]/LOForm.tsx', import.meta.url), 'utf8')
  const code = src.replace(/\/\/[^\n]*/g, '')

  it('the decision is on the tab, not only inside the pop-up', () => {
    expect(code).toContain('The client&apos;s decision')
    expect(code).toContain('setDecisionOpen(true)')
  })

  it('and changing it sends nothing to anybody', () => {
    // The client email is still fired from one place and one place only.
    expect((code.match(/send-next-steps-email/g) || []).length).toBe(1)
    const at = code.indexOf('send-next-steps-email')
    expect(code.slice(Math.max(0, at - 500), at)).toContain('handleMoveToCompliance')
  })

  it('cancelling puts back exactly what was there', () => {
    expect(code).toContain('decisionWas.current')
  })

  it('the file records who wrote it down, and when', () => {
    expect(code).toContain('clientDecisionAt')
    expect(code).toContain('clientDecisionBy')
    // In the defaults, or a deal saved before today would never load them.
    expect(code).toContain("clientDecisionAt: ''")
  })
})

describe('the pack reads the answer, not the copy', () => {
  for (const file of ['box-four.ts', 'box-options.ts']) {
    it(`${file} no longer prefers the compliance copy`, () => {
      const s = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
      expect(s, 'still reads the stale copy first')
        .not.toContain('txt(cd.clientAgreedLender) || txt(lo.clientAgreedLender)')
      expect(s).toContain('clientAgreement(lo)')
    })
  }
})
