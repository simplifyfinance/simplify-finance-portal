import { describe, it, expect } from 'vitest'
import { getWaitingOnLabel } from './deal-status'

const base = {
  status: 'in_progress',
  fact_find_data: { applicants: [{}] },
  bc_completed_at: null, bc_sent_at: null, client_proceeded: false,
  lo_completed_at: null, lo_sent_at: null, lo_client_proceeded: false,
  compliance_completed_at: null,
  assigned_credit_officer: null,
}
const say = (d: any, officer?: string) => getWaitingOnLabel({ ...base, ...d }, officer)?.text

describe('what a deal is waiting on', () => {
  it('asks for the fact find before anything else', () => {
    expect(say({ fact_find_data: null })).toMatch(/Fact Find/)
    expect(say({ fact_find_data: {} })).toMatch(/Fact Find/)
  })

  it('walks the BC through in order', () => {
    expect(say({})).toBe('Waiting on: Broker to complete BC')
    expect(say({ bc_completed_at: 'x' })).toBe('Waiting on: Broker to review and send the BC')
    expect(say({ bc_completed_at: 'x', bc_sent_at: 'x' })).toBe('Waiting on: Client to respond to the BC')
  })

  it('names the credit officer when there is one', () => {
    expect(say({ assigned_credit_officer: 'id' }, 'Katie')).toBe('Waiting on: Katie to complete BC')
    expect(say({ assigned_credit_officer: 'id' })).toBe('Waiting on: Credit officer to complete BC')
  })

  it('walks the LO through in order', () => {
    const upToBc = { bc_completed_at: 'x', bc_sent_at: 'x', client_proceeded: true }
    expect(say(upToBc)).toBe('Waiting on: Broker to complete LO')
    expect(say({ ...upToBc, lo_completed_at: 'x' })).toBe('Waiting on: Broker to review and send the LO')
    expect(say({ ...upToBc, lo_completed_at: 'x', lo_sent_at: 'x' }))
      .toBe('Waiting on: Client to respond to the LO')
    expect(say({ ...upToBc, lo_completed_at: 'x', lo_sent_at: 'x', lo_client_proceeded: true }))
      .toBe('Waiting on: Broker to complete Compliance')
  })

  it('is ready to push once compliance is done', () => {
    expect(say({
      bc_completed_at: 'x', bc_sent_at: 'x', client_proceeded: true,
      lo_completed_at: 'x', lo_sent_at: 'x', lo_client_proceeded: true, compliance_completed_at: 'x',
    })).toBe('✓ Ready to push to SalesTrekker')
  })

  // The real deal that exposed this. Its stage column still said 'BC' because the
  // client had never clicked proceed, so the old logic answered a question about
  // the BC forever - "Broker to review and send" - while the LO sat with the
  // client. A skipped step behind the furthest milestone is history, not a task.
  it('follows the work even when an earlier step was never ticked', () => {
    const natasha = {
      stage: 'BC',
      bc_completed_at: '2026-08-31T03:11:05Z',
      bc_sent_at: null,
      client_proceeded: false,
      lo_completed_at: '2026-08-31T02:22:12Z',
      lo_sent_at: '2026-08-31T05:40:47Z',
      lo_client_proceeded: false,
    }
    expect(say(natasha)).toBe('Waiting on: Client to respond to the LO')
  })

  it('ignores the stage column entirely', () => {
    const d = { bc_completed_at: 'x', bc_sent_at: 'x', client_proceeded: true, lo_completed_at: 'x' }
    expect(say({ ...d, stage: 'BC' })).toBe(say({ ...d, stage: 'Compliance' }))
    expect(say({ ...d, stage: 'BC' })).toBe('Waiting on: Broker to review and send the LO')
  })

  it('says nothing useful for a deal that is finished or lost', () => {
    expect(say({ status: 'completed' })).toBe('✓ Done')
    expect(getWaitingOnLabel({ ...base, status: 'lost' })).toBeNull()
    expect(getWaitingOnLabel(null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The progress bar beads. These exist because the bar and the chip disagreed:
// the bar ticked BC green on bc_completed_at, which only means the credit officer
// finished typing.
import { dealBeads, currentStage, proceedCredit } from './deal-status'

const beadOf = (d: any, key: string) => dealBeads(d).find(b => b.key === key)!

describe('progress beads', () => {
  it('does not tick BC just because the credit officer finished typing', () => {
    // Clementine: BC written, sent, sitting with the client unanswered.
    const d = { ...base, fact_find_data: { a: 1 }, bc_completed_at: 'x', bc_sent_at: 'x', client_proceeded: false }
    expect(beadOf(d, 'bc').done).toBe(false)
    expect(beadOf(d, 'bc').current).toBe(true)
    expect(beadOf(d, 'lo').current).toBe(false)
  })

  it('ticks BC once the client has agreed', () => {
    // Kornelia: client agreed, LO now being written.
    const d = { ...base, fact_find_data: { a: 1 }, bc_completed_at: 'x', bc_sent_at: 'x', client_proceeded: true }
    expect(beadOf(d, 'bc').done).toBe(true)
    expect(beadOf(d, 'lo').current).toBe(true)
  })

  it('tells those two deals apart', () => {
    const ff = { ...base, fact_find_data: { a: 1 }, bc_completed_at: 'x', bc_sent_at: 'x' }
    const clementine = dealBeads({ ...ff, client_proceeded: false }).map(b => b.done).join()
    const kornelia = dealBeads({ ...ff, client_proceeded: true }).map(b => b.done).join()
    expect(clementine).not.toBe(kornelia)
  })

  it('does not hold the bar back for a BC done outside the portal', () => {
    const d = { ...base, fact_find_data: { a: 1 }, client_proceeded: false, lo_client_proceeded: true }
    expect(beadOf(d, 'bc').done).toBe(true)          // history, not a task
    expect(beadOf(d, 'compliance').current).toBe(true)
  })

  it('names who is holding the live stage up, and only on that bead', () => {
    const withClient = { ...base, fact_find_data: { a: 1 }, bc_completed_at: 'x', bc_sent_at: 'x' }
    expect(beadOf(withClient, 'bc').state).toBe('with client')
    expect(beadOf(withClient, 'lo').state).toBe(null)

    const withCredit = { ...base, fact_find_data: { a: 1 }, assigned_credit_officer: 'Mellissa' }
    expect(beadOf(withCredit, 'bc').state).toBe('with credit')

    const withBroker = { ...base, fact_find_data: { a: 1 }, bc_completed_at: 'x' }
    expect(beadOf(withBroker, 'bc').state).toBe('with broker')
  })

  it('opens the deal page on the same stage the blue bead is on', () => {
    expect(currentStage({ ...base, fact_find_data: null })).toBe('FactFind')
    expect(currentStage({ ...base, fact_find_data: { a: 1 } })).toBe('BC')
    expect(currentStage({ ...base, fact_find_data: { a: 1 }, client_proceeded: true })).toBe('LO')
    expect(currentStage({ ...base, fact_find_data: { a: 1 }, client_proceeded: true, lo_client_proceeded: true })).toBe('Compliance')
  })
})

describe('who pressed the client-agreed button', () => {
  it('says the client pressed it when the client pressed it', () => {
    const r = proceedCredit({ proceeded_at: '2026-08-26T06:12:00Z', proceeded_source: 'client' }, 'BC')
    expect(r.who).toBe('client pressed Proceed')
  })

  it('names whoever in the office recorded it', () => {
    const r = proceedCredit({ proceeded_at: 'x', proceeded_source: 'office', proceeded_by: 'Mellissa Sedin' }, 'BC')
    expect(r.who).toBe('recorded by Mellissa Sedin')
  })

  it('does not credit the client on a deal recorded before we tracked it', () => {
    const r = proceedCredit({ proceeded_at: '2026-08-26T06:12:00Z' }, 'BC')
    expect(r.who).not.toContain('client pressed')
    expect(r.who).toContain('before we started tracking')
  })

  it('reads the LO fields for the LO stage', () => {
    const d = { proceeded_source: 'client', lo_proceeded_source: 'office', lo_proceeded_by: 'Katie', lo_proceeded_at: 'y' }
    expect(proceedCredit(d, 'LO').who).toBe('recorded by Katie')
    expect(proceedCredit(d, 'BC').who).toBe('client pressed Proceed')
  })
})
