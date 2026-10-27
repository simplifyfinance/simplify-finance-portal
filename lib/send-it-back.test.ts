// SENDING A DEAL BACK TO CREDIT.
//
// 27 Oct 2026. Fabio: "we have situatiomns where credit has worked on a BC but
// broker asked credit to reword that deal... How can we communicate with credit
// person thgat this needs a rework so it gets flagged in her queue?"
//
// And, the same hour: "once we mark email sent it locks and we cant resend the
// email with rewoked figures".
import { describe, it, expect } from 'vitest'
import {
  canSendBack, clearedBySendingBack, validateSendBack, sendBackPatch, sendBackLine,
  reworkOn, reworkCount, reworkChip, canSendAgain, reworkReasonLabel, sendBackTarget,
  REWORK_REASON_KEYS, REWORK_REASONS,
} from './send-it-back'
import { getWaitingOnLabel } from './deal-status'
import { whoHasIt } from './who-has-it'

const INPUT = {
  why: 'scenario',
  note: 'They want to keep the Ipswich Rd place rather than sell, so run it on three securities.',
  by: 'Mark Gallo',
}

// A BC credit finished yesterday and the broker has not sent out yet.
const FINISHED_BC = {
  id: 'd1', deal_name: 'Harding & Vass 2026',
  fact_find_data: { applicants: [{ firstName: 'A' }] },
  assigned_credit_officer: 'o1',
  bc_owner_officer: 'o1', bc_owner_name: 'Katie Amos', bc_owner_since: '2026-10-24T00:00:00Z',
  bc_completed_at: '2026-10-26T04:00:00Z',
}

// The same BC, already emailed to the client, who has not answered.
const SENT_BC = { ...FINISHED_BC, bc_sent_at: '2026-10-26T05:30:00Z' }

describe('when it can be sent back', () => {
  it('once credit has finished it', () => {
    expect(canSendBack(FINISHED_BC, 'bc').ok).toBe(true)
  })

  it('and still after it has gone to the client', () => {
    // Fabio, 27 Oct 2026, asked where the line is: any time until the client
    // agrees. Reading it is what makes a client change their mind, so this is
    // the common case, not the edge one.
    expect(canSendBack(SENT_BC, 'bc').ok).toBe(true)
  })

  it('but not once they have agreed to it', () => {
    const agreed = { ...SENT_BC, client_proceeded: true }
    expect(canSendBack(agreed, 'bc')).toEqual({
      ok: false, why: 'The client has already agreed to this one',
    })
  })

  it('and not before there is anything to send back', () => {
    const { ok, why } = canSendBack({ id: 'd1' }, 'bc')
    expect(ok).toBe(false)
    expect(why).toContain('no finished BC')
  })

  it('the lending options answer the same questions off their own dates', () => {
    const lo = { id: 'd1', lo_completed_at: '2026-10-26T04:00:00Z',
                 lo_owner_officer: 'o1', lo_owner_name: 'Katie Amos' }
    expect(canSendBack(lo, 'lo').ok).toBe(true)
    expect(canSendBack({ ...lo, lo_client_proceeded: true }, 'lo').ok).toBe(false)
    // A finished BC is not a finished LO.
    expect(canSendBack(FINISHED_BC, 'lo').ok).toBe(false)
  })

  it('and never where a broker did it himself', () => {
    // There is nobody to send it back TO. He opens it and changes it, which is
    // what the form is for - so the button is absent rather than pointless.
    const own = { ...FINISHED_BC, bc_owner_officer: null, bc_owner_name: 'Mark Gallo' }
    expect(sendBackTarget(own, 'bc')).toBeNull()
    expect(canSendBack(own, 'bc').why).toContain('Nobody in credit')
  })

  it('and it names the person who gets it', () => {
    expect(sendBackTarget(FINISHED_BC, 'bc')).toEqual({ officerId: 'o1', name: 'Katie Amos' })
  })
})

describe('the reason is not optional', () => {
  it('needs one of the six', () => {
    expect(validateSendBack({ note: INPUT.note }).map(v => v.field)).toEqual(['why'])
    expect(validateSendBack({ ...INPUT, why: 'made up' }).map(v => v.field)).toEqual(['why'])
  })

  it('and needs the words as well', () => {
    // The whole point is that she gets the reason. "Figures are wrong" with no
    // words is a phone call, which is the thing being removed.
    expect(validateSendBack({ why: 'figures' }).map(v => v.field)).toEqual(['note'])
    expect(validateSendBack({ why: 'figures', note: 'redo' }).map(v => v.field)).toEqual(['note'])
  })

  it('and a complete one passes', () => {
    expect(validateSendBack(INPUT)).toEqual([])
  })

  it('every reason key has words on it', () => {
    for (const k of REWORK_REASON_KEYS) expect(REWORK_REASONS[k].length).toBeGreaterThan(3)
    expect(reworkReasonLabel('scenario')).toBe('A different scenario')
    expect(reworkReasonLabel('')).toBe('')
  })
})

describe('what the write does, and what it refuses to do', () => {
  const now = new Date('2026-10-27T09:12:00+11:00')
  const patch = sendBackPatch(SENT_BC, 'bc', INPUT, now)

  it('clears the two stamps that carried the deal past credit', () => {
    expect(patch.bc_completed_at).toBeNull()
    expect(patch.bc_sent_at).toBeNull()
  })

  it('which is the whole of the mechanism - the ladder does the rest', () => {
    // No new rule anywhere. Clearing the stamps is what moves the deal, and
    // every screen that reads the ladder follows with no further instruction.
    const after = { ...SENT_BC, ...patch }
    expect(getWaitingOnLabel(after, 'Katie Amos')?.text).toBe('Waiting on: Katie Amos to complete BC')
    expect(whoHasIt(after)?.holder).toBe('us')
  })

  it('and the Send to client button unlocks, which was the other half of it', () => {
    // Fabio, same hour: "once we mark email sent it locks and we cant resend
    // the email with rewoked figures".
    const after = { ...SENT_BC, ...patch }
    expect(after.bc_sent_at).toBeNull()
  })

  it('keeps the date the client was first sent something', () => {
    // Clearing bc_sent_at unlocks the button. It is not a claim that nothing
    // was ever sent.
    expect(patch.bc_rework_was_sent).toBe('2026-10-26T05:30:00Z')
  })

  it('and does not overwrite it the second time round', () => {
    const second = sendBackPatch(
      { ...SENT_BC, bc_rework_was_sent: '2026-10-20T01:00:00Z', bc_rework_count: 1 },
      'bc', INPUT, now)
    expect(second.bc_rework_was_sent).toBeUndefined()
    expect(second.bc_rework_count).toBe(2)
  })

  it('NEVER touches the work itself', () => {
    // 3 Sep 2026: "I dont want anyhtuing to be wiped out no data to be lost".
    // A rework that wiped the BC would also take her finished work for the day
    // she finished it - her numbers would go down for doing what she was asked.
    for (const k of ['bc_data', 'fact_find_data', 'bc_email_html', 'assigned_credit_officer',
                     'bc_owner_officer', 'bc_owner_name', 'bc_owner_since']) {
      expect(patch, `a send-back must not write ${k}`).not.toHaveProperty(k)
    }
  })

  it('counts from one, so a third time round says so', () => {
    expect(patch.bc_rework_count).toBe(1)
    expect(sendBackPatch({ ...FINISHED_BC, bc_rework_count: 2 }, 'bc', INPUT, now).bc_rework_count).toBe(3)
  })

  it('carries the reason, the words and the broker', () => {
    expect(patch.bc_rework_why).toBe('scenario')
    expect(patch.bc_rework_note).toBe(INPUT.note)
    expect(patch.bc_rework_by).toBe('Mark Gallo')
    expect(patch.bc_rework_at).toBe(now.toISOString())
  })

  it('and supersedes a card somebody dragged on the board', () => {
    expect(patch.phase_override).toBeNull()
  })

  it('an unsent BC only clears the one stamp', () => {
    const p = sendBackPatch(FINISHED_BC, 'bc', INPUT, now)
    expect(clearedBySendingBack(FINISHED_BC, 'bc')).toEqual(['bc_completed_at'])
    expect(p).not.toHaveProperty('bc_rework_was_sent')
  })
})

describe('the line in the file notes', () => {
  const line = sendBackLine(SENT_BC, 'bc', INPUT)

  it('says who, why and in whose words', () => {
    expect(line).toContain('Mark Gallo')
    expect(line).toContain('A different scenario')
    expect(line).toContain('Ipswich Rd')
  })

  it('and says out loud that nothing was deleted', () => {
    expect(line).toContain('Nothing was deleted')
    expect(line).toContain('bc_sent_at')
    expect(line).toContain('The date it went to the client is kept')
  })
})

describe('reading it back', () => {
  const after = { ...SENT_BC, ...sendBackPatch(SENT_BC, 'bc', INPUT, new Date('2026-10-27T09:12:00+11:00')) }

  it('the stage is in rework until it is finished again', () => {
    expect(reworkOn(after, 'bc')?.label).toBe('A different scenario')
    expect(reworkOn(after, 'bc')?.note).toBe(INPUT.note)
  })

  it('and pressing Done closes it, with no second column to disagree', () => {
    const done = { ...after, bc_completed_at: '2026-10-27T23:00:00Z' }
    expect(reworkOn(done, 'bc')).toBeNull()
  })

  it('but the history stays on the deal', () => {
    const done = { ...after, bc_completed_at: '2026-10-27T23:00:00Z' }
    expect(reworkCount(done, 'bc')).toBe(1)
  })

  it('a deal that was never sent back has none', () => {
    expect(reworkOn(FINISHED_BC, 'bc')).toBeNull()
    expect(reworkCount(FINISHED_BC, 'bc')).toBe(0)
  })

  it('the chip names the broker and the time, on the day', () => {
    const chip = reworkChip(reworkOn(after, 'bc'), new Date('2026-10-27T10:00:00+11:00'))
    expect(chip).toContain('REWORK')
    expect(chip).toContain('Mark Gallo')
    expect(chip).toContain('9:12')
  })

  it('and drops the time once it is not today, because it stops meaning anything', () => {
    const chip = reworkChip(reworkOn(after, 'bc'), new Date('2026-10-30T10:00:00+11:00'))
    expect(chip).not.toContain('9:12')
    expect(chip).toContain('sent it back')
  })

  it('and says so out loud on the second time round', () => {
    const twice = { ...after, bc_rework_count: 2 }
    expect(reworkChip(reworkOn(twice, 'bc'), new Date('2026-10-27T10:00:00+11:00'))).toContain('2nd time')
  })
})

describe('sending the email again without a rework', () => {
  it('is offered once something has gone out', () => {
    expect(canSendAgain(SENT_BC, 'bc')).toBe(true)
  })

  it('and not before, because there is nothing to send again', () => {
    expect(canSendAgain(FINISHED_BC, 'bc')).toBe(false)
  })

  it('and not once the client has agreed - that is a different stage now', () => {
    expect(canSendAgain({ ...SENT_BC, client_proceeded: true }, 'bc')).toBe(false)
  })
})
