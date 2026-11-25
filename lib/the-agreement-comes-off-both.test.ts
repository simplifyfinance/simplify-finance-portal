import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  canSendAgain, canSendBack, undoesTheAgreement, undoTheAgreement, undoWarning,
  loDataWithoutTheAgreement, undoTheAgreementLine, whereTheCardGoes,
  AGREEMENT_FIELDS_ON_THE_DEAL, AGREEMENT_FIELDS_IN_LO_DATA,
} from './send-it-back'

// "I DON'T LIKE DRAGGING DEAL CARDS."
//
// 25 Nov 2026. Fabio needed to pivot a client off Bankwest after they had
// already agreed. Both buttons that would have let him - Send again and Send
// it back - were hidden, because `lo_client_proceeded` was true. Nothing on the
// screen said so. The only route back was dragging the card from Compliance to
// Lending options on the deal board, which nothing on the lending options tab
// mentions, and in the end it took a hand-written SQL update on a live deal.
//
//   "I want to make sure in future, even when we send to the client, it
//    doesn't suppress. So we can always change it and send it again."
//
// The rule was already written one function away, for Send again: a sent date
// "is a statement, not a lock". It had never been applied to the case where the
// client answered.
//
// =========================================================================
// AND THE CONDITION HE PUT ON APPROVING IT, WHICH IS WHAT MOST OF THIS FILE
// IS ABOUT:
//
//   "as long as when we go to compliance, it doesn't hard code the previous
//    choice, then no issues"
//
// It does not. lib/client-agreement.ts rebuilds the compliance copy from
// lo_data every time - that is the Charles Mullins fix of 25 Sep 2026, where
// the lending options moved from AMP to Bankwest and the compliance pack went
// on saying AMP for weeks.
//
// WHICH IS EXACTLY WHY THE UNDO HAS TO CLEAR lo_data TOO. The client's press
// lives on the DEAL. The broker's recorded answer - "Yes, they went with
// Bankwest" - lives in LO_DATA, and that is the one the pack reads. Clear the
// first and not the second and compliance rebuilds, faithfully, from a stale
// answer, and names a lender the client is no longer taking on a regulated
// document.
//
// That is the Charles Mullins fault coming back through a different door, and
// it is what this file exists to stop.
// =========================================================================

const AGREED_DEAL = {
  lo_sent_at: '2026-11-24T01:16:55Z',
  lo_completed_at: '2026-11-23T00:00:00Z',
  lo_client_proceeded: true,
  lo_proceeded_at: '2026-11-24T11:11:25Z',
  lo_proceeded_lender: 'Bankwest',
  assigned_credit_officer: 'officer-1',
  lo_data: {
    clientAgreedLender: 'Yes',
    clientDecisionAt: '2026-11-24T11:20:00Z',
    clientDecisionBy: 'Fabio De Castro',
    lenders: [{ lenderName: 'Bankwest' }],
  },
}

describe('the buttons no longer vanish when a client agrees', () => {
  it('Send again is offered', () => {
    expect(canSendAgain(AGREED_DEAL, 'lo')).toBe(true)
  })

  it('Send it back is offered', () => {
    expect(canSendBack(AGREED_DEAL, 'lo').ok).toBe(true)
  })

  it('and the old refusal is gone from the source', () => {
    const src = readFileSync('lib/send-it-back.ts', 'utf8')
    expect(src).not.toContain("why: 'The client has already agreed to this one'")
  })

  it('Send again still needs the email to have gone once', () => {
    expect(canSendAgain({ ...AGREED_DEAL, lo_sent_at: null }, 'lo')).toBe(false)
  })

  it('Send it back still needs somebody in credit to have worked on it', () => {
    const nobody = { ...AGREED_DEAL, assigned_credit_officer: null }
    expect(canSendBack(nobody, 'lo').ok).toBe(false)
  })
})

describe('it says what it is about to undo', () => {
  it('knows when an agreement is on the file', () => {
    expect(undoesTheAgreement(AGREED_DEAL, 'lo')).toBe(true)
    expect(undoesTheAgreement({ lo_sent_at: 'x' }, 'lo')).toBe(false)
  })

  it('names the bank and the date, rather than warning in the abstract', () => {
    const w = undoWarning(AGREED_DEAL, 'lo')
    expect(w).toContain('Bankwest')
    expect(w).toContain('2026-11-24')
    expect(w).toContain('comes off the file')
  })
})

describe('THE CONDITION: the agreement comes off BOTH halves', () => {
  const { deal, loDataKeysToClear } = undoTheAgreement('lo', 'Fabio De Castro')

  it('clears the client\'s own press on the deal', () => {
    expect(deal.lo_client_proceeded).toBe(false)
    expect(deal.lo_proceeded_at).toBeNull()
    expect(deal.lo_proceeded_lender).toBeNull()
  })

  it('AND clears the recorded answer the compliance pack reads', () => {
    // The half that is easy to forget and impossible to spot afterwards.
    expect(loDataKeysToClear).toContain('clientAgreedLender')
    expect(loDataKeysToClear).toContain('clientChosenLender')
    expect(loDataKeysToClear).toContain('clientDecisionAt')
  })

  it('and lo_data really comes back without them', () => {
    const after = loDataWithoutTheAgreement(AGREED_DEAL.lo_data)
    expect(after.clientAgreedLender).toBeUndefined()
    expect(after.clientDecisionBy).toBeUndefined()
    // Everything else on the tab is untouched - this is not a reset.
    expect(after.lenders).toEqual([{ lenderName: 'Bankwest' }])
  })

  it('what happened is kept - and kept without a new column', () => {
    // 25 Nov 2026. This used to write lo_agreement_undone_at/_by onto `deals`.
    // scripts/check-deal-columns.sh fails the ship on any column the database
    // does not have, so that meant SQL on live AND staging AND Sydney, in the
    // fortnight the database is being moved between countries, to hold
    // something deal_notes and lo_data already hold.
    const { loDataStamp } = undoTheAgreement('lo', 'Fabio De Castro')
    expect(loDataStamp?.agreementUndoneAt).toBeTruthy()
    expect(loDataStamp?.agreementUndoneBy).toBe('Fabio De Castro')
    expect(Object.keys(deal)).not.toContain('lo_agreement_undone_at')
  })

  it('the stamp survives the clearing - it is not stripped by its own undo', () => {
    const { loDataKeysToClear, loDataStamp } = undoTheAgreement('lo', 'Fabio De Castro')
    const after = loDataWithoutTheAgreement(AGREED_DEAL.lo_data, loDataStamp)
    for (const k of loDataKeysToClear) expect(after[k]).toBeUndefined()
    expect(after.agreementUndoneBy).toBe('Fabio De Castro')
  })

  it('and the file notes get a line a reviewer can read', () => {
    const line = undoTheAgreementLine(AGREED_DEAL, 'lo', 'Fabio De Castro')
    expect(line).toContain('AGREEMENT UNDONE')
    expect(line).toContain('Fabio De Castro')
    expect(line).toContain('Bankwest')
  })

  it('NEITHER LIST MAY SHRINK', () => {
    // An allowlist by name. If somebody removes a field from either list, this
    // fails and they have to say why in the test rather than in a commit
    // message nobody reads.
    expect(AGREEMENT_FIELDS_ON_THE_DEAL.lo).toEqual([
      'lo_client_proceeded', 'lo_proceeded_at', 'lo_proceeded_lender',
      'lo_proceeded_source', 'lo_proceeded_by',
    ])
    expect(AGREEMENT_FIELDS_IN_LO_DATA).toEqual([
      'clientAgreedLender', 'clientChosenLender', 'clientChosenLenderOther',
      'clientChosenLenderReason', 'clientDecisionAt', 'clientDecisionBy',
    ])
  })

  it('and the screen says where the card goes, including when it does not move', () => {
    // The fault this whole change exists to stop, in miniature: pressing a
    // button, expecting the card to move, and going hunting when it does not.
    expect(whereTheCardGoes(AGREED_DEAL, 'lo'))
      .toContain('back from Compliance to Lending options')
    expect(whereTheCardGoes({ ...AGREED_DEAL, compliance_sent_at: '2026-11-25T00:00:00Z' }, 'lo'))
      .toContain('stays in Compliance')
    // And the BC's own agreement, which walks the card back one stage further.
    expect(whereTheCardGoes({ client_proceeded: true }, 'bc'))
      .toContain('back from Lending options to Borrowing capacity')
    expect(whereTheCardGoes(AGREED_DEAL, 'bc')).toContain('stays where it is')
  })

  it('and the compliance side still reads lo_data rather than its own copy', () => {
    // The thing the whole condition rests on. If this rule ever moves, the
    // undo above stops being enough.
    const src = readFileSync('lib/client-agreement.ts', 'utf8')
    expect(src).toContain('lo_data')
    expect(src).toMatch(/compliance_data.*copy|copy.*rebuilt/s)
  })
})
