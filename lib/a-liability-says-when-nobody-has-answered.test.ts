import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A LIABILITY WITH NO STATUS SAYS SO, ON THE FORM.
//
// 29 Oct 2026. Fabio, on a credit card that reached a client email with no
// status against it: "we used to have a 'remain open' label next to credit
// card, investigate that too."
//
// There never was one. The status dropdown has always started blank, the email
// prints no chip when it is blank - which is right, inventing a status on a
// credit document is not a thing this portal does - and nothing anywhere told
// the broker the question was still open.

const FORM = readFileSync('app/(app)/deals/[id]/FactFindForm.tsx', 'utf8')

describe('THE MARKER', () => {
  it('is on the card, not in a panel somewhere else', () => {
    expect(FORM).toContain('Status required')
  })

  it('AND IT IS DRAWN ONCE, NOT ONCE PER LIABILITY TYPE', () => {
    // The status dropdown itself is drawn five times, one per type. Five
    // copies of a marker is five places to fix it next time.
    expect(FORM.match(/Status required/g) || []).toHaveLength(1)
  })

  it('and it waits for a type to be chosen', () => {
    // A card somebody just added has nothing in it. A box that opens shouting
    // is a box people learn to ignore.
    expect(FORM).toContain('{liab.liabilityType && !liab.status && (')
  })

  it('and it goes the moment the question is answered', () => {
    expect(FORM).toContain('!liab.status')
  })

  it('and it is the red that means "somebody has to answer this"', () => {
    const at = FORM.indexOf('Status required')
    expect(FORM.slice(at - 200, at)).toContain('text-chase')
  })
})

describe('AND NOTHING ELSE CHANGED', () => {
  it('the type dropdown still writes where it always did', () => {
    expect(FORM).toContain("updateLiability(liab.id, 'liabilityType', e.target.value)")
  })

  it('and Remove is still on the card', () => {
    expect(FORM).toContain('removeLiability(liab.id)')
  })

  it('and the status dropdown is still the thing that answers it', () => {
    expect(FORM).toContain("updateLiability(liab.id, 'status', e.target.value)")
  })
})
