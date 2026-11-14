// A PUSH THAT FAILS LEAVES A MARK.
//
// 13 Nov 2026, Jayver Varghese. Fabio: "we press the button push to sales
// tracker. The email never went out to the team."
//
// Establishing what had happened took three SQL queries and the Supabase
// request logs, at midnight, and it nearly became a conversation with a member
// of staff about whether she was telling the truth. The portal wrote NOTHING
// when that button was pressed, so a deal somebody had pushed and a deal
// nobody had touched were identical in the database.
//
// The only record of the failure was a message box that vanished when it was
// clicked.
//
// Fabio: "I need 100% certainty... otherwise i need to flag with a team
// memeber." These tests are what makes that a two second check instead.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  startPush, appended, settled, latest, listOf, KEEP,
  pushedButNotSent, theProblem, whatHappened, needsChasing, chaseLine,
  STUCK_AFTER_MS,
} from './the-push-leaves-a-mark'

const T = new Date('2026-11-13T04:58:00.000Z')

describe('the attempt is written before anything is tried', () => {
  it('starts as trying, with who and when on it', () => {
    const p = startPush('Katie Amos', T, 'u1')
    expect(p.state).toBe('trying')
    expect(p.by).toBe('Katie Amos')
    expect(p.byId).toBe('u1')
    expect(p.at).toBe(T.toISOString())
  })

  it('and somebody with no name on their profile still gets a row', () => {
    expect(startPush('', T).by).toBe('Somebody')
  })

  it('a first push on a deal that has never had one', () => {
    expect(appended(null, startPush('Katie Amos', T))).toHaveLength(1)
    expect(appended('nonsense', startPush('Katie Amos', T))).toHaveLength(1)
  })

  it('and a card does not keep a year of them', () => {
    let log: any = []
    for (let i = 0; i < KEEP + 5; i++) {
      log = appended(log, startPush('Katie Amos', new Date(T.getTime() + i * 1000)))
    }
    expect(log).toHaveLength(KEEP)
  })
})

describe('the outcome goes on top of the attempt', () => {
  const attempt = startPush('Katie Amos', T)
  const log = appended([], attempt)

  // TWO ROWS FOR ONE PRESS is how a log starts lying about how many times
  // something happened.
  it('never beside it', () => {
    const after = settled(log, attempt.at, { state: 'sent', to: 'info@', packs: 3 })
    expect(after).toHaveLength(1)
    expect(after[0].state).toBe('sent')
  })

  it('and an outcome for an attempt that is not there changes nothing', () => {
    expect(settled(log, 'some-other-time', { state: 'sent' })).toEqual(log)
  })
})

describe('what the card says', () => {
  it('a deal nobody has pushed says nothing at all', () => {
    expect(listOf(null)).toHaveLength(0)
    expect(pushedButNotSent(null)).toBe(false)
    expect(theProblem(null)).toBe('')
  })

  it('a push that worked', () => {
    const a = startPush('Katie Amos', T)
    const log = settled(appended([], a), a.at, { state: 'sent', to: 'info@ and Cris', packs: 3 })
    expect(pushedButNotSent(log)).toBe(false)
    expect(whatHappened(log[0])).toBe('Email sent to info@ and Cris · 3 PDFs attached')
  })

  // THE JAYVER CASE. Somebody believes they have handed it over and nobody has it.
  it('a push that failed says so, and says what to do', () => {
    const a = startPush('Katie Amos', T)
    const log = settled(appended([], a), a.at,
      { state: 'failed', why: 'Not saved - signed out. No email sent.' })
    expect(pushedButNotSent(log)).toBe(true)
    expect(theProblem(log)).toContain('has not been pushed')
    expect(theProblem(log)).toContain('Press Done to try again')
  })

  // A PUSH THAT NEVER CAME BACK IS A PUSH THAT NEVER ARRIVED. This is the
  // state Jayver's deal would have been left in, and it must not read as fine.
  it('and one that started and never finished counts as not sent', () => {
    const log = appended([], startPush('Katie Amos', T))
    expect(pushedButNotSent(log)).toBe(true)
    expect(whatHappened(log[0])).toContain('never finished')
  })

  it('only the last attempt decides, because a retry fixes it', () => {
    const a = startPush('Katie Amos', T)
    let log: any = settled(appended([], a), a.at, { state: 'failed', why: 'no' })
    const b = startPush('Katie Amos', new Date(T.getTime() + 60_000))
    log = settled(appended(log, b), b.at, { state: 'sent', to: 'info@' })
    expect(pushedButNotSent(log)).toBe(false)
    expect(latest(log)?.state).toBe('sent')
  })
})

// Fabio, 14 Nov 2026: "run through on his own after 1 hours."
describe('a stuck push comes to management on its own', () => {
  const a = startPush('Katie Amos', T)
  const stuck = appended([], a)

  it('not straight away - a slow email is not a false alarm', () => {
    expect(needsChasing(stuck, new Date(T.getTime() + 59 * 60_000))).toBe(false)
  })

  it('but after an hour it does', () => {
    expect(needsChasing(stuck, new Date(T.getTime() + STUCK_AFTER_MS))).toBe(true)
    expect(chaseLine(stuck)).toBe(
      'Pushed by Katie Amos and never arrived — nobody has this deal.')
  })

  it('and a deal nobody has pushed is never chased - it is simply not ready', () => {
    expect(needsChasing(null, new Date(T.getTime() + 86_400_000))).toBe(false)
  })

  it('and one that went is never chased', () => {
    const sent = settled(stuck, a.at, { state: 'sent', to: 'info@' })
    expect(needsChasing(sent, new Date(T.getTime() + 86_400_000))).toBe(false)
  })
})

// THE WIRING. The attempt must be written BEFORE the email is tried, or a
// failure in between leaves nothing behind - which is the whole fault.
describe('the form writes it down in the right order', () => {
  const form = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')
  const body = form.slice(form.indexOf('async function markComplianceComplete'))
  const upTo = body.slice(0, body.indexOf('notify-salestrekker'))

  it('the attempt is recorded before the notification is sent', () => {
    expect(upTo, 'the attempt must be written before anything is tried')
      .toContain('startPush(')
    expect(upTo).toContain('appended(')
  })

  it('and every way out records an outcome', () => {
    expect(body).toContain("outcome({ state: 'sent'")
    expect((body.match(/outcome\(\{ state: 'failed'/g) || []).length)
      .toBeGreaterThanOrEqual(3)
  })

  // A DATABASE WITHOUT THE COLUMN YET BEHAVES EXACTLY AS IT DID YESTERDAY, and
  // the pack going out always matters more than the note about it.
  it('and a failure to record never stops the push', () => {
    expect(form).toContain('async function notePush(')
    expect(form.slice(form.indexOf('async function notePush'))).toContain('catch')
  })

  it('the card shows it, and shows nothing when there is nothing', () => {
    expect(form).toContain('<PushLog pushLog=')
    const comp = readFileSync('components/PushLog.tsx', 'utf8')
    expect(comp).toContain('if (all.length === 0) return null')
    // Sydney's clock, like every other time in the portal.
    expect(comp).toContain('dayMonthTime')
  })
})
