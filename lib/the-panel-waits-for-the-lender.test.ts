import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { isWithLender, phaseOf } from './deal-phase'

// "I COULDNT FIND THAT SECTION IN THAT PARTICULAR DEAL"
//
// 26 Nov 2026. Belle, on Thomas and Sally Isherwood - OO Purchase - Mona Vale:
//
//   "loan docs have just been issued im gonna put a comment in the latest
//    update but I couldnt find that section in that particular deal - why this
//    section is missing from particular deal"
//
// The settlement panel - the seven steps, the contracts, ATTN Settlements and
// Latest update - was hidden behind one line:
//
//   if (!d.lodged_at) return null
//
// That deal carries a preapproval, an offer accepted and a formal approval. It
// has plainly reached the lender. Nobody ever ticked Lodged, so the panel went
// on waiting for a date that was never coming while the settlement work it
// exists for had already started.
//
// THE QUESTION WAS WRONG, NOT THE ANSWER. "Has it been lodged?" and "has it
// reached the lender?" are different questions, and only the second one is what
// this panel wants to know.

const PAST_LODGEMENT_NO_DATE = {
  lodged_at: null,
  preapproval_at: '2026-09-28T16:00:00Z',
  offer_accepted_at: '2026-11-23T16:00:00Z',
  formal_approval_at: '2026-11-26T13:00:00Z',
}

describe('a deal is with the lender by the furthest date on it', () => {
  it('Thomas and Sally Isherwood, which had no lodgement date at all', () => {
    expect(phaseOf(PAST_LODGEMENT_NO_DATE)).toBe('formal')
    expect(isWithLender(PAST_LODGEMENT_NO_DATE)).toBe(true)
  })

  it('and a deal with the lodgement date, as before', () => {
    expect(isWithLender({ lodged_at: '2026-09-22T14:00:00Z' })).toBe(true)
  })

  it('but not one that has not got there', () => {
    expect(isWithLender({ lo_client_proceeded: true })).toBe(false)
    expect(isWithLender({})).toBe(false)
  })

  // A dead deal is dead wherever it got to.
  it('and not a lost one', () => {
    expect(isWithLender({ ...PAST_LODGEMENT_NO_DATE, status: 'lost' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AND THEN THE GATE CAME OFF THE NOTES ENTIRELY
// ---------------------------------------------------------------------------
//
// The fix above was half a fix, and Fabio said so:
//
//   "I don't like that... Whatever goes in and out. Like, you should always be
//    available at all times. It can't be tied to a lodgement date."
//
// He is right. Swapping one gate for a wider gate still hides the notes on a
// deal that has not reached the bank, and notes start at the first phone call.
//
// So Latest update and ATTN Settlements are out of the settlement panel
// altogether - components/TheDealTrail.tsx - drawn on every deal at every
// stage. What stays gated is the settlement MACHINERY: the seven steps, the
// contracts, the discharge. Those cannot start before a deal is lodged and on
// a new lead they are a row of empty boxes for work nobody has begun.

describe('the notes are on every deal, at every stage', () => {
  const trail = readFileSync('components/TheDealTrail.tsx', 'utf8')
  const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
  const panel = readFileSync('app/(app)/deals/[id]/DealSettlementPanel.tsx', 'utf8')

  it('they live in their own file now', () => {
    expect(trail).toContain('Latest update')
    expect(trail).toContain('ATTN Settlements')
  })

  it('with no gate of any kind in it', () => {
    expect(trail).not.toContain('lodged_at')
    expect(trail).not.toContain('isWithLender')
    expect(trail).not.toContain('return null')
  })

  it('and the settlement panel no longer draws them', () => {
    expect(panel).not.toContain('<SettlementTrail')
    expect(panel).not.toContain('column="attn_settlements"')
  })

  // THE RULE THE DEAL PAGE ALREADY HELD ITSELF TO: never render the same
  // component in two branches of a condition a deal can cross. Drawn once,
  // outside everything.
  it('the deal page draws it exactly once', () => {
    expect(page.split('<TheDealTrail').length - 1).toBe(1)
  })

  it('and a note that does not reach the database says so', () => {
    // A note that looks saved and is not is the one somebody relies on next
    // week. RLS refuses by returning no rows and no error.
    expect(trail).toContain('checkedWrite')
  })
})

describe('the panel asks that question and not the old one', () => {
  const src = readFileSync('app/(app)/deals/[id]/DealSettlementPanel.tsx', 'utf8')

  it('the lodgement-date gate is gone', () => {
    expect(src).not.toContain('if (!d.lodged_at) return null')
  })

  it('and it waits for the lender instead', () => {
    expect(src).toContain('if (!isWithLender(d)) return null')
  })
})

// ---------------------------------------------------------------------------
// THE PART THAT IS NOT COSMETIC
// ---------------------------------------------------------------------------
//
// `lodged_at` is what the lodgement NUMBERS are counted from. Both
// components/MonthlyActuals.tsx and components/BrokerTargets.tsx read it and
// nothing else. A deal that reached formal approval without one has never been
// counted as lodged, in any month, by anybody.
//
// Showing the panel makes the settlement work possible. It does not put the
// deal back in the figures, and nothing else in the portal would ever have
// mentioned it - so the panel says so.

describe('a missing lodgement date is said out loud', () => {
  const src = readFileSync('app/(app)/deals/[id]/DealSettlementPanel.tsx', 'utf8')

  it('the panel warns when there is no lodgement date', () => {
    expect(src).toContain('No lodgement date on this deal')
    expect(src).toContain('{!d.lodged_at && (')
  })

  it('and says what it actually costs, rather than just flagging it', () => {
    expect(src).toContain('missing from every lodgement figure')
  })

  // AND WHERE TO FIX IT. I first wrote this up claiming there was no way to
  // record a skipped lodgement date on a live deal. That was wrong: STAGES in
  // DealSettlement.tsx marks `lodged_at` with mark: true, and `available`
  // offers every unrecorded stage on any deal that has not settled. The button
  // has been there the whole time. A warning that does not point at it just
  // moves the confusion along one step.
  it('points at the button that already exists', () => {
    expect(src).toContain('What happened next?')
    expect(src).toContain('<b>Lodged</b>')
  })

  it('and that button really is offered on a live deal with no lodgement date', () => {
    const ds = readFileSync('app/(app)/deals/[id]/DealSettlement.tsx', 'utf8')
    expect(ds).toContain("{ key: 'lodged_at',")
    expect(ds).toContain("label: 'Lodged',")
    // The filter that keeps it offered until the deal settles.
    expect(ds).toContain('.filter(s => !deal.settled_at || fillingGaps)')
  })

  it('the figures really are counted off that column and nothing else', () => {
    // If either of these ever learns a second source, the warning above is
    // overstating it and should be reworded rather than left to rot.
    for (const f of ['components/MonthlyActuals.tsx', 'components/BrokerTargets.tsx']) {
      expect(readFileSync(f, 'utf8')).toContain('toAuDate(d.lodged_at)')
    }
  })
})
