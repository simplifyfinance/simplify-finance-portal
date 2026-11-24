import { describe, it, expect } from 'vitest'
import { laneOf, readyToPush } from './the-board-columns'
import { phaseOf } from './deal-phase'
import { getWaitingOnLabel } from './deal-status'

// WHERE THE CARD GOES WHEN A CLIENT PRESSES THE BUTTON.
//
// Fabio, 24 Nov 2026: "if I send a borrowing capacity email and the client says
// I want to go ahead with it, where is the deal card being moved to? And the
// same with the lending options... I think we're putting on the wrong boxes
// because we create new stages lately."
//
// A fair worry - the board was rebuilt on 18 and 19 November, the three-way
// lending options split is five days old, and nothing anywhere wrote down what
// the two Proceed buttons are supposed to do to the board.
//
// It is written down here. Nothing in this file changed any behaviour; it
// pins the behaviour that already exists, so the next time somebody adds a
// stage, the board either still does this or a test says it stopped.
//
// Two things worth knowing about the chain, because neither is obvious:
//
//   The buttons do not move a card by setting a column. They set one fact -
//   client_proceeded, or lo_client_proceeded - and the column is worked out
//   from the facts on the deal every time it is drawn. There is no column
//   stored anywhere to get out of step. See lib/deal-phase.ts.
//
//   Pressing Proceed on the BC also asks the client for their documents, so in
//   real life the card usually lands in Awaiting docs rather than With credit.
//   That is the 19 November rule and it is deliberate: "it sounds like we're
//   waiting on credit and then credit gets in trouble for not doing the deal."

const SENT_THE_BC = {
  created_at: '2026-11-01T00:00:00Z',
  fact_find_data: { properties: [] },
  bc_data: { template: 'oo_purchase', splits: [{ amount: '500000' }] },
  bc_completed_at: '2026-11-10T00:00:00Z',
  bc_sent_at: '2026-11-12T00:00:00Z',
}

const PRESSED_PROCEED_ON_THE_BC = {
  ...SENT_THE_BC, client_proceeded: true, proceeded_at: '2026-11-20T00:00:00Z',
}

const SENT_THE_LENDING_OPTIONS = {
  ...PRESSED_PROCEED_ON_THE_BC,
  lo_completed_at: '2026-11-22T00:00:00Z',
  lo_sent_at: '2026-11-23T00:00:00Z',
}

const PRESSED_PROCEED_ON_THE_LENDING_OPTIONS = {
  ...SENT_THE_LENDING_OPTIONS,
  lo_client_proceeded: true, lo_proceeded_at: '2026-11-24T00:00:00Z',
}

describe('the borrowing capacity button', () => {
  it('before they answer, the card sits with the client', () => {
    expect(laneOf(SENT_THE_BC)).toBe('bc_client')
  })

  it('pressing it moves the card into Lending options, Awaiting docs', () => {
    // ALWAYS Awaiting docs, whether the client pressed it or we did, and
    // whether or not the request has been made yet. Fabio, 24 Nov 2026: "BC
    // pressed internally or through the email, always lending options awaiting
    // docs." Pressing Proceed is what starts document collection, so the deal
    // is in that pile from the moment it is pressed.
    expect(phaseOf(PRESSED_PROCEED_ON_THE_BC)).toBe('lo')
    expect(laneOf(PRESSED_PROCEED_ON_THE_BC)).toBe('lo_docs')
  })

  it('and "Docs received" is the one press that moves it to With credit', () => {
    const asked = {
      ...PRESSED_PROCEED_ON_THE_BC,
      document_progress: { requests: [{ round: 'proceed', at: '2026-11-20T00:01:00Z', to: ['a@b.com'] }] },
    }
    expect(laneOf(asked)).toBe('lo_docs')
    expect(getWaitingOnLabel(asked, 'Mellissa')?.text).toBe('Waiting on: Client to send documents')
    expect(laneOf({ ...asked, docs_received_at: '2026-11-21T00:00:00Z' })).toBe('lo_us')
  })

  it('it never jumps a client straight into Compliance', () => {
    expect(laneOf(PRESSED_PROCEED_ON_THE_BC)).not.toBe('comp_us')
    expect(laneOf(PRESSED_PROCEED_ON_THE_BC)).not.toBe('comp_client')
  })
})

describe('the lending options button', () => {
  it('before they answer, the card sits with the client', () => {
    expect(laneOf(SENT_THE_LENDING_OPTIONS)).toBe('lo_client')
  })

  it('pressing it moves the card into Compliance, with credit', () => {
    expect(phaseOf(PRESSED_PROCEED_ON_THE_LENDING_OPTIONS)).toBe('compliance')
    expect(laneOf(PRESSED_PROCEED_ON_THE_LENDING_OPTIONS)).toBe('comp_us')
  })

  it('AND NOT INTO "Sent - signing", WHICH IS A LATER AND DIFFERENT THING', () => {
    // comp_client means the compliance document has gone out for signature.
    // A client agreeing to a lender has not signed anything and nobody has
    // written it yet. One column apart, weeks apart in real life.
    expect(laneOf(PRESSED_PROCEED_ON_THE_LENDING_OPTIONS)).not.toBe('comp_client')
  })

  it('and the card goes green, because it is the pile to push', () => {
    expect(readyToPush(PRESSED_PROCEED_ON_THE_LENDING_OPTIONS)).toBe(true)
  })

  it('the green stops once compliance has gone to SalesTrekker', () => {
    const pushed = { ...PRESSED_PROCEED_ON_THE_LENDING_OPTIONS,
      compliance_completed_at: '2026-11-25T00:00:00Z',
      compliance_sent_at: '2026-11-25T01:00:00Z' }
    expect(readyToPush(pushed)).toBe(false)
    expect(laneOf(pushed)).toBe('comp_client')
  })
})

describe('"I would rather talk first"', () => {
  // markWantsCall moves nothing on purpose - the broker rings them, and what
  // actually happens is written on the Lending Options tab afterwards. The
  // card staying put is the intended behaviour, pinned here so that a future
  // change to it is a decision rather than an accident.
  it('leaves the card exactly where it was', () => {
    const wantsCall = { ...SENT_THE_LENDING_OPTIONS, lo_wants_call: true,
                        lo_wants_call_at: '2026-11-24T00:00:00Z' }
    expect(laneOf(wantsCall)).toBe('lo_client')
    expect(laneOf(wantsCall)).toBe(laneOf(SENT_THE_LENDING_OPTIONS))
  })
})
