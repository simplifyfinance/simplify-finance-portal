// TWO WORDS, AND THE FACT FIND FINALLY AGREEING WITH ITSELF.
//
// 22 Oct 2026, both asked for by Fabio on the same morning.
import { describe, it, expect } from 'vitest'
import { whoHasIt } from './who-has-it'
import { currentStage, dealBeads, getWaitingOnLabel } from './deal-status'
import { derivedPhaseOf } from './deal-phase'

const deal = (x: any = {}) => ({ status: 'in_progress', fact_find_data: { applicants: [{ firstName: 'Nora' }] }, ...x })

describe('a deal the moment it is created', () => {
  // The new-deal form seeds fact_find_data with the applicants off the modal.
  const fresh = deal()

  it('opens on the Fact Find, not the BC', () => {
    expect(currentStage(fresh)).toBe('FactFind')
  })

  it('and the deal page now agrees with the board', () => {
    expect(derivedPhaseOf(fresh)).toBe('fact_find')
    expect(dealBeads(fresh).find(b => b.key === 'fact_find')!.done).toBe(false)
  })

  it('once somebody types real fact find work, it moves on', () => {
    const typed = deal({ fact_find_data: { applicants: [{ firstName: 'Nora', dob: '1988-04-02' }] } })
    expect(currentStage(typed)).toBe('BC')
  })
})

describe('who has it', () => {
  it('nobody has sent anything yet, so it is us', () => {
    expect(whoHasIt(deal())!.label).toBe('With us')
  })

  it('the BC has gone out and the client has not answered', () => {
    const sent = deal({ bc_completed_at: '2026-10-20', bc_sent_at: '2026-10-21' })
    expect(whoHasIt(sent)!.label).toBe('With client')
  })

  it('they said yes, so it is back with us for the LO', () => {
    const agreed = deal({ bc_completed_at: '2026-10-20', bc_sent_at: '2026-10-21', client_proceeded: true })
    expect(whoHasIt(agreed)!.label).toBe('With us')
  })

  it('the LO has gone out and they have not answered', () => {
    const loSent = deal({ bc_completed_at: '1', bc_sent_at: '1', client_proceeded: true,
                          lo_completed_at: '1', lo_sent_at: '1' })
    expect(whoHasIt(loSent)!.label).toBe('With client')
  })

  it('compliance is ours, even while we chase the client for documents', () => {
    // THE HONEST LIMIT OF THIS SHIP. Nothing is recorded yet about documents,
    // so compliance still reads as ours. The next ship records the change
    // itself and this becomes "With client" where it should be.
    const comp = deal({ bc_completed_at: '1', bc_sent_at: '1', client_proceeded: true,
                        lo_completed_at: '1', lo_sent_at: '1', lo_client_proceeded: true })
    expect(whoHasIt(comp)!.label).toBe('With us')
  })

  it('everything written and lodged - the bank has it', () => {
    const lodged = deal({ bc_completed_at: '1', bc_sent_at: '1', client_proceeded: true,
                          lo_completed_at: '1', lo_sent_at: '1', lo_client_proceeded: true,
                          compliance_completed_at: '1' })
    expect(whoHasIt(lodged)!.label).toBe('With lender')
  })

  it('a finished or dead deal has no chip at all', () => {
    expect(whoHasIt(deal({ status: 'completed' }))).toBeNull()
    expect(whoHasIt(deal({ status: 'lost' }))).toBeNull()
    expect(whoHasIt(null)).toBeNull()
  })
})

describe('the colours are the portal’s own', () => {
  it('blue for us, purple for the client - both already mean that', () => {
    expect(whoHasIt(deal())!.style).toContain('info')
    const sent = deal({ bc_completed_at: '1', bc_sent_at: '1' })
    expect(whoHasIt(sent)!.style).toContain('waiting')
  })

  it('and no amber anywhere', () => {
    for (const d of [deal(), deal({ bc_sent_at: '1', bc_completed_at: '1' })]) {
      expect(whoHasIt(d)!.style).not.toMatch(/amber|yellow|orange/)
    }
  })
})

describe('the sentence behind the two words is unchanged', () => {
  it('getWaitingOnLabel still says what is next', () => {
    const sent = deal({ bc_completed_at: '1', bc_sent_at: '1' })
    expect(getWaitingOnLabel(sent)!.text).toContain('Client to respond')
  })
})
