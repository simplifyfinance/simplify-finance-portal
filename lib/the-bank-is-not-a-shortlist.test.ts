import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { theBankIsDecided, theRefCanBeTyped } from './where-the-work-is'

// THE LENDER ROW DOES NOT EXIST UNTIL COMPLIANCE.
//
// Fabio, 16 Nov 2026: "that line only shows after we move to compliance, so we
// know which lender the customer is going with. Obvious. And before
// compliance it never shows."
//
// Before that, a bank sitting on the deal is a SHORTLIST. Credit may have put
// one there while writing the lending options; the client has not chosen. A
// row at the top of the page reading "LENDER Macquarie" says they have, and a
// broker could ring a client about a bank they never agreed to.
//
// Compliance is the first stage that only exists because somebody said yes to
// a particular bank.

const sent = (col: string) => ({ [col]: '2026-11-16T00:00:00Z' })

describe('before compliance there is no lender row', () => {
  it('a brand new deal', () => {
    expect(theBankIsDecided({})).toBe(false)
  })

  it('a borrowing capacity being written', () => {
    expect(theBankIsDecided({ ...sent('bc_completed_at') })).toBe(false)
  })

  it('lending options sitting with the client - the shortlist stage', () => {
    expect(theBankIsDecided({
      ...sent('bc_completed_at'), ...sent('lo_sent_at'),
    })).toBe(false)
  })
})

describe('from compliance on, the bank is a fact', () => {
  const agreed = {
    client_proceeded: true, proceeded_at: '2026-11-10T00:00:00Z',
    lo_client_proceeded: true, lo_proceeded_at: '2026-11-12T00:00:00Z',
    lo_completed_at: '2026-11-12T00:00:00Z',
  }

  it('compliance', () => {
    expect(theBankIsDecided(agreed)).toBe(true)
  })

  it('lodged', () => {
    expect(theBankIsDecided({ ...agreed, ...sent('lodged_at') })).toBe(true)
  })

  it('settled', () => {
    expect(theBankIsDecided({ ...agreed, ...sent('lodged_at'), ...sent('settled_at') })).toBe(true)
  })
})

describe('and the page actually asks', () => {
  it('the row is behind it', () => {
    const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    expect(page).toContain('theBankIsDecided(dealData)')
    expect(page, 'the lender row is drawn without asking whether the bank is decided')
      .not.toMatch(/\{\(dealData\.lenders\?\.name \|\| loanRef/)
  })
})

// AND THE REFERENCE WAITS FOR LODGEMENT.
//
// Fabio, 16 Nov 2026: "after lodged we can add a ref number, remember we need
// space for that."
//
// A reference is the number the BANK gives an application. There is no
// application until it is lodged, so a box to type one into before that is a
// box somebody fills with a guess.
describe('the bank reference cannot be typed before lodgement', () => {
  const agreed = {
    client_proceeded: true, proceeded_at: '2026-11-10T00:00:00Z',
    lo_client_proceeded: true, lo_proceeded_at: '2026-11-12T00:00:00Z',
    lo_completed_at: '2026-11-12T00:00:00Z',
  }

  it('not on a new deal', () => {
    expect(theRefCanBeTyped({})).toBe(false)
  })

  it('not even at compliance, where the bank is already decided', () => {
    expect(theBankIsDecided(agreed), 'the bank IS decided here').toBe(true)
    expect(theRefCanBeTyped(agreed), 'but there is no application yet').toBe(false)
  })

  it('from lodgement', () => {
    expect(theRefCanBeTyped({ ...agreed, lodged_at: '2026-11-16T00:00:00Z' })).toBe(true)
  })

  it('and still at settlement', () => {
    expect(theRefCanBeTyped({
      ...agreed, lodged_at: '2026-11-16T00:00:00Z', settled_at: '2026-12-01T00:00:00Z',
    })).toBe(true)
  })

  it('the page asks before it draws the box', () => {
    const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    expect(page).toContain('canTypeRef={theRefCanBeTyped(dealData)}')
  })

  it('and the reference is not the loan ID', () => {
    // The loan ID is issued at settlement and lives in settled_splits. This is
    // the number on the application. Two different things, two different
    // columns, and the box only appears where there is no loan ID yet.
    const bank = readFileSync('components/TheBank.tsx', 'utf8')
    expect(bank).toContain('lender_ref')
    expect(bank).toContain('canTypeRef && !loanId')
  })
})
