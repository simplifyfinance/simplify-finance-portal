// THE BUTTON HAS TO KEEP DOING SOMETHING.
//
// 14 Nov 2026. "That is my week" shipped on 12 Nov as a <span> styled to look
// exactly like the solid dark button used everywhere else in the portal. It
// had no onClick and wrote nothing. For two days a broker could press it,
// believe he had told the office, and leave no trace at all.
//
// Fabio, on being shown it: "Why would I leave a button fake?"
//
// These are the wiring. The rules and the clock are in
// lib/went-through-the-week.test.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const WEEK = readFileSync('components/BrokerWeek.tsx', 'utf8')
const HOOK = readFileSync('lib/use-went-through.ts', 'utf8')
const RUN = readFileSync('components/RunThrough.tsx', 'utf8')
const PAGE = readFileSync('app/(app)/dashboard/page.tsx', 'utf8')

describe('the broker presses it and something is written', () => {
  it('it is a button, not text dressed as one', () => {
    expect(WEEK, 'the fake pill is back').not.toContain('<span className="rounded-[10px] bg-ink')
    expect(WEEK).toContain('onClick={() => { week.say() }}')
  })

  it('through the one hook, so the screen holds no copy of the rule', () => {
    expect(WEEK).toContain('useWentThrough')
    expect(WEEK).toContain('week.told')
  })

  // A PREFERENCE MAY BE FIRED AND FORGOTTEN. A RECORD MAY NOT.
  // lib/use-theme-choice.ts deliberately does not check its write, because a
  // colour that fails to save costs nobody anything. This one decides whether
  // somebody gets a red mark next to their name on Monday.
  it('and the write is checked, because a blocked policy returns no rows', () => {
    expect(HOOK).toContain('checkedWrite(')
    expect(HOOK, 'a record is never fired and forgotten').not.toContain('.then(() => {})')
  })

  it('and a refused write is said out loud on his screen', () => {
    expect(WEEK).toContain('week.problem')
  })

  it('the press writes one field and nothing else', () => {
    expect(HOOK).toContain('donePatch(')
    expect(HOOK, 'a hand-rolled patch here is a second shape of the same row')
      .not.toContain('week_done_at:')
  })
})

describe('and the meeting can see it', () => {
  it('the mark is the shared rule, not a second idea of seen', () => {
    expect(RUN).toContain("from '@/lib/went-through-the-week'")
    expect(RUN).toContain('weekMark(weekDone[r.key], when)')
  })

  it('red until he has, green after', () => {
    expect(RUN).toContain('border-done-edge bg-done-bg text-done')
    expect(RUN).toContain('border-chase-edge bg-chase-bg text-chase')
  })

  // THE MARK IS ON THE ADMIN SCREEN AND NOWHERE ELSE. Keanen and Justin are
  // not managed - no target, no league table, nothing red at them. See the
  // header of lib/the-brokers-monday.ts.
  it('only in the Simplify Finance Brokers section', () => {
    expect(RUN).toContain('section(theirs, false, true)')
    expect(RUN, 'the other section must not carry the mark').toContain('section(mine, true)')
  })

  it('and the page hands it the brokers own rows', () => {
    expect(PAGE).toContain('weekDone={weekDone}')
    expect(PAGE).toContain("from('user_profiles')")
    expect(PAGE).toContain('week_done_at')
  })
})
