import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { isInterestOnly } from './deal-structure'

// THE INTEREST ONLY PERIOD IS ASKED THE SAME WAY EVERYWHERE.
//
// 30 Oct 2026. Fabio, on the New purchase panel of an Equity release +
// purchase: "interest only years is not a dropdown like all others, fix it."
//
// Every other split asks with a dropdown of one to five years. This one was a
// free text box, so it would take "5 years", "five", "60 months" or a typo -
// and that figure goes onto a lender's servicing sheet.
//
// AND IT ASKED ON ITS OWN TEST. The splits show the field on
// /interest only|^io$/ and this one wanted an exact "Interest only", so a split
// recorded as "Fixed IO" had nowhere to record the term at all. Both now ask
// isInterestOnly(), which is the portal's one answer to that question.

const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
const PANEL = FORM.slice(FORM.indexOf('>New purchase</div>'))

describe('THE NEW PURCHASE PANEL', () => {
  it('asks with a dropdown, like every other split', () => {
    const at = PANEL.indexOf('Interest only years')
    expect(at).toBeGreaterThan(-1)
    expect(PANEL.slice(at, at + 400)).toContain('<select')
  })

  it('and offers one to five years, the same list', () => {
    const at = PANEL.indexOf('Interest only years')
    const field = PANEL.slice(at, at + 400)
    for (const y of ['1', '2', '3', '4', '5']) expect(field).toContain(`<option>${y}</option>`)
  })

  it('AND NO LONGER TAKES WHATEVER SOMEBODY TYPES', () => {
    const at = PANEL.indexOf('Interest only years')
    expect(PANEL.slice(at, at + 400)).not.toContain('<input')
  })

  it('and it opens on a question, not on an answer', () => {
    const at = PANEL.indexOf('Interest only years')
    expect(PANEL.slice(at, at + 400)).toContain('value=""')
  })
})

describe('AND BOTH PLACES ASK THE SAME QUESTION', () => {
  it('through the one function that answers it', () => {
    expect(FORM).toContain('isInterestOnly(pSplit?.type)')
    expect(FORM).toContain('isInterestOnly(s.type)')
  })

  it('and the hand-written regex is gone', () => {
    expect(FORM).not.toContain('/interest only|^io$/i.test(s.type')
    expect(FORM).not.toContain('/^interest only$/i.test(String(pSplit?.type')
  })

  it('AND THE ANSWER COVERS WHAT A SPLIT IS ACTUALLY CALLED', () => {
    expect(isInterestOnly('Interest only')).toBe(true)
    expect(isInterestOnly('IO')).toBe(true)
    expect(isInterestOnly('Fixed IO')).toBe(true)
    expect(isInterestOnly('P&I')).toBe(false)
    expect(isInterestOnly('Fixed P&I')).toBe(false)
    expect(isInterestOnly('')).toBe(false)
  })
})
