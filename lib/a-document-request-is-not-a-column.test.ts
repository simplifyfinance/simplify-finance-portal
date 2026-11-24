import { describe, it, expect } from 'vitest'
import { laneOf, readyToPush } from './the-board-columns'
import { whoHasIt, holderLabel } from './who-has-it'
import { phaseOf } from './deal-phase'

// A DOCUMENT REQUEST IS NOT A COLUMN.
//
// 24 Nov 2026. Two cards on the live board, both wrong, both the same cause.
//
//   Rachel Welton    Borrowing capacity / With client.
//                    Fabio: "BC never completed but sitting in 'with client'".
//                    The deal had no bc_completed_at, no bc_sent_at, nothing
//                    sent to that client at all - and one document request
//                    that had never been ticked off.
//
//   Leeanne Jordan   Compliance / Sent - signing.
//                    Fabio: "client pressed LO to proceed and went to
//                    Compliance Sent and not With Credit". She had pressed it,
//                    the card had moved to Compliance correctly, and then the
//                    same unticked document request flipped the column. Nobody
//                    had written her compliance, let alone sent it for
//                    signature. The card was GREEN - ready to push - inside a
//                    column saying it was already out being signed.
//
// whoHasIt() answers "who is holding this deal up", and for an open document
// request the answer is honestly the client. That is right on the chip and
// right on the deal page. It is wrong as a COLUMN, because two of the three
// groups have no column for it:
//
//   Lending options   HAS one - "Awaiting docs", built 19 Nov for this exact
//                     wait. Untouched here, and still correct.
//   Borrowing capacity  "With client" means the BC has gone out and they have
//                     not answered.
//   Compliance        "Sent - signing" means the compliance document is out
//                     for signature. There is already a phase for that -
//                     compliance_sent - set by compliance_sent_at and nothing
//                     else.
//
// So those two columns now read the fact they are named after, and the
// documents wait stays on the chip where it belongs.

const OPEN_DOC_REQUEST = {
  document_progress: { requests: [{ round: 'proceed', at: '2026-11-18T00:01:00Z', to: ['a@b.com'] }] },
}

const WELTON = {
  created_at: '2026-11-01T00:00:00Z',
  fact_find_data: { properties: [] },
  bc_data: { template: 'refinance_equity' },
  // Exactly as the database had it: nothing completed, nothing sent.
  bc_completed_at: null, bc_sent_at: null, client_proceeded: false,
  ...OPEN_DOC_REQUEST,
}

const LEEANNE = {
  created_at: '2026-11-01T00:00:00Z',
  fact_find_data: { properties: [] },
  bc_data: { template: 'refinance_only', splits: [{ amount: '545000' }] },
  bc_completed_at: '2026-11-10T00:00:00Z',
  bc_sent_at: '2026-11-12T00:00:00Z',
  client_proceeded: true, proceeded_at: '2026-11-18T00:00:00Z',
  lo_completed_at: '2026-11-20T00:00:00Z',
  lo_sent_at: '2026-11-21T00:00:00Z',
  lo_client_proceeded: true, lo_proceeded_at: '2026-11-22T00:00:00Z',
  ...OPEN_DOC_REQUEST,
}

describe('Rachel Welton - nothing was ever sent to her', () => {
  it('sits with credit, not with the client', () => {
    expect(laneOf(WELTON)).toBe('bc_us')
  })

  it('and the chip still tells the truth about the documents', () => {
    // The column changed. What the deal is actually waiting on did not.
    expect(holderLabel(whoHasIt(WELTON))).toBe('With client — documents')
  })

  it('once the BC has gone out, it IS with the client', () => {
    const sent = { ...WELTON, bc_completed_at: '2026-11-20T00:00:00Z', bc_sent_at: '2026-11-21T00:00:00Z' }
    expect(laneOf(sent)).toBe('bc_client')
  })
})

describe('Leeanne Jordan - she agreed, nobody has written her compliance', () => {
  it('is in Compliance', () => {
    expect(phaseOf(LEEANNE)).toBe('compliance')
  })

  it('sits with credit, NOT in "Sent - signing"', () => {
    expect(laneOf(LEEANNE)).toBe('comp_us')
    expect(laneOf(LEEANNE)).not.toBe('comp_client')
  })

  it('and is green, which now agrees with the column it is in', () => {
    // Green means "the client said yes and nobody has pushed it yet". A green
    // card in Sent - signing was two statements that could not both be true.
    expect(readyToPush(LEEANNE)).toBe(true)
  })

  it('"Sent - signing" needs the compliance to have actually been sent', () => {
    const sent = { ...LEEANNE,
      compliance_completed_at: '2026-11-25T00:00:00Z',
      compliance_sent_at: '2026-11-25T01:00:00Z' }
    expect(laneOf(sent)).toBe('comp_client')
    expect(readyToPush(sent)).toBe(false)
  })

  it('and ticking the documents off changes nothing either way now', () => {
    expect(laneOf({ ...LEEANNE, docs_received_at: '2026-11-19T00:00:00Z' })).toBe('comp_us')
    expect(laneOf({ ...WELTON, docs_received_at: '2026-11-19T00:00:00Z' })).toBe('bc_us')
  })
})

describe('the lending options group keeps its documents lane', () => {
  it('because that is where the wait has somewhere to go', () => {
    const waitingOnDocs = {
      created_at: '2026-11-01T00:00:00Z',
      fact_find_data: { properties: [] },
      bc_data: { template: 'oo_purchase', splits: [{ amount: '500000' }] },
      bc_completed_at: '2026-11-10T00:00:00Z',
      bc_sent_at: '2026-11-12T00:00:00Z',
      client_proceeded: true, proceeded_at: '2026-11-18T00:00:00Z',
      ...OPEN_DOC_REQUEST,
    }
    expect(laneOf(waitingOnDocs)).toBe('lo_docs')
  })
})
