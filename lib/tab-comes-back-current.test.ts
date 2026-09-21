import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { merge3 } from './deal-merge'

// COMING BACK TO A TAB SHOWS WHAT THE DEAL HOLDS.
//
// 18 Sep 2026, Richard Lake. Mellissa filled in the whole Compliance tab, left
// it, came back, and every box was blank. Kylie opened the same deal and saw all
// of it. Nothing was lost - the record was complete throughout - but an hour
// went by believing it was.
//
// Two things had to be true for that to happen, and both are closed here.
//
//   1. THE PAGE HELD A COPY THAT NOBODY UPDATED. The deal page loads the row
//      once; tabs are mounted one at a time, so leaving one and returning
//      rebuilds it from that copy. Fact Find, BC and LO each hand their saved
//      record back up. Compliance never did. See lib/tab-reports-its-save.test.ts.
//
//   2. THE REPAIR GAVE UP. The tab re-reads the record when it opens, and
//      declined to use it whenever the form had changed at all since mounting -
//      which is always, because an effect fills three fields from the fact find
//      on every open. So the one screen that needed the repair never got it.
//
// The robot had this on the record and it was read as a flaky test: type on
// Compliance, change tab, come back, and the box holds a marker from an earlier
// run. Saved: yes. On screen: no. See tests/browser/tab-switch.spec.ts.

const form = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')

describe('a tab that opened from a stale copy', () => {
  // base   - what the screen held when the tab mounted: the stale copy
  // theirs - what the database holds, including work saved on the way out
  // mine   - the screen now: the base, plus the fields the form derives on mount
  const base   = { needsLongTerm: 'first line', needsPrimary: '', requirementsType: '' }
  const theirs = { needsLongTerm: 'first line\nthe sentence that was saved', needsPrimary: '', requirementsType: '' }
  const mine   = { needsLongTerm: 'first line', needsPrimary: 'from the fact find', requirementsType: 'Owner occupied' }

  it('brings back what the record holds, and keeps what the form derived', () => {
    const out = merge3(base, theirs, mine)
    expect(out.ok, 'a screen that only derived fields is not in conflict with anybody').toBe(true)
    expect(out.merged.needsLongTerm, 'the saved sentence did not come back').toContain('the sentence that was saved')
    expect(out.merged.needsPrimary).toBe('from the fact find')
    expect(out.merged.requirementsType).toBe('Owner occupied')
  })

  it('leaves the screen alone when somebody is genuinely typing in that box', () => {
    const typing = { ...base, needsLongTerm: 'first line, and a sentence being written right now' }
    const out = merge3(base, theirs, typing)
    expect(out.ok, 'the same box changed in both places has no honest merge').toBe(false)
  })

  it('the tab actually does this, rather than returning early', () => {
    expect(form, 'the mount re-read is giving up again instead of merging')
      .toMatch(/merge3\(JSON\.parse\(atOpen\.current as string\), stored, liveD\.current\)/)
    expect(form, 'the record the re-read found must reach the screen')
      .toMatch(/if \(merged\.ok\) putOnScreen\(shape\(merged\.merged\)\)/)
  })
})
