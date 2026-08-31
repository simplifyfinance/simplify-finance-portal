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
