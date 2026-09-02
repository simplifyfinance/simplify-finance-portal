import { describe, it, expect } from 'vitest'
import { phaseOf, phaseSince, isInApplication, isWithLender, isFinished,
         PHASE_ORDER, PHASE_LABEL, WRITTEN_PHASES, type Phase } from './deal-phase'
import { dealBeads, barFolds } from './deal-status'
import { stepIsOn, stepPatch, STEPS, STEP_DATE } from './settlement'
import { AGED_PHASES, readThresholds, WAITING_ON } from './board-settings'

// The three stages added on 2 Sep 2026, and the folding they made necessary.
//
// Offer accepted was a process hidden inside Preapproved. Contracts returned and
// Settlement booked were `settlement_step`, one enum holding one of two things,
// with no date, invisible outside the Settlement panel.

const written = {
  status: 'in_progress',
  fact_find_data: { applicants: [{}] },
  client_proceeded: true, lo_client_proceeded: true,
  compliance_completed_at: '2026-07-08', compliance_sent_at: '2026-07-09',
}
const lodged = { ...written, lodged_at: '2026-07-14' }

describe('the three new phases', () => {
  it('puts a deal in each of them', () => {
    expect(phaseOf({ ...lodged, offer_accepted_at: '2026-08-02' })).toBe('offer_accepted')
    expect(phaseOf({ ...lodged, contracts_returned_at: '2026-08-18' })).toBe('contracts_returned')
    expect(phaseOf({ ...lodged, settlement_booked_at: '2026-08-25' })).toBe('settlement_booked')
  })

  it('takes the FURTHEST milestone, so a skipped step is history not a blocker', () => {
    // A refinance has no accepted offer. It must not be held at Preapproved.
    expect(phaseOf({ ...lodged, preapproval_at: '2026-07-22', formal_approval_at: '2026-08-11' })).toBe('formal')
    // Contracts back but never marked booked, then settled.
    expect(phaseOf({ ...lodged, contracts_returned_at: '2026-08-18', settled_at: '2026-09-01' })).toBe('settled')
    // Booked without contracts ever being recorded - the old enum could only
    // hold one of the two, so this is exactly what the backfill leaves behind.
    expect(phaseOf({ ...lodged, settlement_booked_at: '2026-08-25' })).toBe('settlement_booked')
  })

  it('ages from the date the new stage was reached, not from lodgement', () => {
    expect(phaseSince({ ...lodged, offer_accepted_at: '2026-08-02' })).toBe('2026-08-02')
    expect(phaseSince({ ...lodged, contracts_returned_at: '2026-08-18' })).toBe('2026-08-18')
    expect(phaseSince({ ...lodged, settlement_booked_at: '2026-08-25' })).toBe('2026-08-25')
  })

  it('counts them as live loans, and still ends at settled or lost', () => {
    expect(isInApplication({ ...lodged, offer_accepted_at: 'x' })).toBe(true)
    expect(isInApplication({ ...lodged, contracts_returned_at: 'x' })).toBe(true)
    expect(isInApplication({ ...lodged, settlement_booked_at: 'x' })).toBe(true)
    expect(isInApplication({ ...lodged, settled_at: 'x' })).toBe(false)
    // Still being written - the compliance pack has not gone out yet.
    expect(isInApplication({ ...written, compliance_sent_at: null })).toBe(false)
    // Sent, though, IS in application. Those were the deals being hidden.
    expect(isInApplication(written)).toBe(true)
    expect(isFinished({ ...lodged, settlement_booked_at: 'x' })).toBe(false)
  })

  it('keeps them behind the lender line, so the tabs stay locked', () => {
    expect(isWithLender({ ...lodged, offer_accepted_at: 'x' })).toBe(true)
    expect(isWithLender({ ...lodged, settlement_booked_at: 'x' })).toBe(true)
    // and a dead deal is still dead wherever it got to
    expect(isWithLender({ ...lodged, settlement_booked_at: 'x', status: 'lost' })).toBe(false)
  })

  it('orders them between preapproved and settled, and names every one', () => {
    const i = (p: Phase) => PHASE_ORDER.indexOf(p)
    expect(i('preapproved')).toBeLessThan(i('offer_accepted'))
    expect(i('offer_accepted')).toBeLessThan(i('formal'))
    expect(i('formal')).toBeLessThan(i('contracts_returned'))
    expect(i('contracts_returned')).toBeLessThan(i('settlement_booked'))
    expect(i('settlement_booked')).toBeLessThan(i('settled'))
    for (const p of PHASE_ORDER) expect(PHASE_LABEL[p]).toBeTruthy()
  })

  it('every phase that can go stale has a plain-English line about who we are waiting on', () => {
    // Except the two governed by the settlement date, which ship with no
    // threshold - but the sentence still has to be there when someone sets one.
    for (const p of AGED_PHASES) expect(WAITING_ON[p]).toBeTruthy()
  })

  it('leaves contracts returned and settlement booked with no default threshold', () => {
    const t = readThresholds(null)
    expect(t.offer_accepted).toBeTruthy()
    expect(t.contracts_returned).toBeUndefined()
    expect(t.settlement_booked).toBeUndefined()
  })
})

describe('the bar folds its written half once a deal is lodged', () => {
  it('does not fold while the deal is still being written', () => {
    expect(barFolds({})).toBe(false)
    expect(barFolds(written)).toBe(false)
  })

  it('folds from lodgement on', () => {
    expect(barFolds(lodged)).toBe(true)
    expect(barFolds({ ...lodged, settled_at: 'x' })).toBe(true)
  })

  it('splits the beads into the two halves of a deal, and nothing is orphaned', () => {
    const beads = dealBeads(lodged)
    const w = beads.filter(b => b.group === 'written').map(b => b.key)
    const t = beads.filter(b => b.group === 'tracked').map(b => b.key)
    expect(w).toEqual(['fact_find', 'bc', 'lo', 'compliance'])
    expect(t).toEqual(['lodged', 'preapproved', 'offer_accepted', 'formal',
                       'contracts_returned', 'settlement_booked', 'settled'])
    expect(w.length + t.length).toBe(beads.length)
  })

  it('every written bead is done by the time the bar folds', () => {
    // This is the whole argument for folding: on a lodged deal those four ticks
    // say nothing. If one could still be open, hiding it would hide work.
    const beads = dealBeads(lodged)
    expect(beads.filter(b => b.group === 'written').every(b => b.done)).toBe(true)
  })

  it('lights the new beads', () => {
    const at = (d: any, key: string) => dealBeads(d).find(b => b.key === key)
    expect(at({ ...lodged, offer_accepted_at: '2026-08-02' }, 'offer_accepted')?.done).toBe(true)
    expect(at({ ...lodged, contracts_returned_at: '2026-08-18' }, 'contracts_returned')?.date).toBe('2026-08-18')
    expect(at(lodged, 'settlement_booked')?.done).toBe(false)
  })
})

describe('the two settlement steps, now that each has its own date', () => {
  it('reads a recorded date as pressed', () => {
    expect(stepIsOn({ contracts_returned_at: 'x' }, 'contracts_returned')).toBe(true)
    expect(stepIsOn({}, 'contracts_returned')).toBe(false)
  })

  it('still reads the old enum, so a deal awaiting backfill does not lose its step', () => {
    expect(stepIsOn({ settlement_step: 'settlement_booked' }, 'settlement_booked')).toBe(true)
    expect(stepIsOn({ settlement_step: 'settlement_booked' }, 'contracts_returned')).toBe(false)
  })

  it('lets a deal hold both at once, which the old single field could not', () => {
    const d: any = {}
    const p1 = stepPatch(d, 'contracts_returned', true)
    const after = { ...d, ...p1 }
    expect(after.contracts_returned_at).toBeTruthy()
    expect(after.settlement_step).toBe('contracts_returned')

    const p2 = stepPatch(after, 'settlement_booked', true)
    const both = { ...after, ...p2 }
    expect(both.contracts_returned_at).toBeTruthy()
    expect(both.settlement_booked_at).toBeTruthy()
    // The chip on the settlements board shows the furthest of the two.
    expect(both.settlement_step).toBe('settlement_booked')
  })

  it('unpressing one clears only its own date and falls back to the other', () => {
    const both: any = { contracts_returned_at: 'a', settlement_booked_at: 'b', settlement_step: 'settlement_booked' }
    const after = { ...both, ...stepPatch(both, 'settlement_booked', false) }
    expect(after.settlement_booked_at).toBe(null)
    expect(after.contracts_returned_at).toBe('a')
    expect(after.settlement_step).toBe('contracts_returned')

    const none = { ...after, ...stepPatch(after, 'contracts_returned', false) }
    expect(none.settlement_step).toBe(null)
  })

  it('names a date column for every step', () => {
    for (const s of STEPS) expect(STEP_DATE[s]).toMatch(/_at$/)
  })
})
