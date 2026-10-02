import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { readNotice } from './rate-notice'

// "WE CANNOT FLIP THE TOGGLE."
//
// 2 Oct 2026, from the team, trying to put the RBA notice on. Nothing was
// broken. Two separate things were invisible, and between them they made a
// working switch look like a dead one:
//
//   1. Only an admin may write settings. A credit officer's click was refused,
//      and the message saying so rendered at the BOTTOM of the panel - below
//      all forty-odd lenders, several screens from the button they pressed.
//
//   2. The wording box was empty. What everybody could see in it was the
//      PLACEHOLDER, which is a finished sentence in grey and reads exactly like
//      saved content. lib/rate-notice.ts refuses to report `on` without words,
//      so the write succeeded and the toggle sprang back with nothing said.
//
// Neither was a logic fault. Both were the portal knowing something and not
// saying it where the person was looking.

const src = readFileSync('components/RateNoticeSettings.tsx', 'utf8')
// A comment explaining a rule is not the rule. The same lesson as
// scripts/check-email-html.sh and lib/browser-tab.test.ts.
const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ')

describe('the rule that made the toggle look broken is still the rule', () => {
  // Kept deliberately. A blank notice on a client email quoting a rate is
  // worse than no notice. The fix was never to loosen this.
  it('a notice with no words is never on, however it was saved', () => {
    expect(readNotice({ on: true, text: '', decisionDate: '2026-09-29' }).on).toBe(false)
    expect(readNotice({ on: true, text: 'Rates may change.', decisionDate: '' }).on).toBe(false)
    expect(readNotice({ on: true, text: 'Rates may change.', decisionDate: '2026-09-29' }).on).toBe(true)
  })
})

describe('what happened is said where it happened', () => {
  it('the status sits beside the toggle, not only at the foot of the page', () => {
    const first = code.indexOf('<Status')
    const toggle = code.indexOf('Turn it on')
    expect(first, 'no status message is rendered at all').toBeGreaterThan(-1)
    expect(first, 'the status is below the toggle - which is what caused this')
      .toBeLessThan(toggle)
  })

  it('and again at the foot, for somebody down among the lenders', () => {
    expect(code.split('<Status').length - 1, 'the status is rendered in only one place').toBe(2)
  })

  // One definition. Two copies of the wording would drift, which is the fault
  // this portal keeps finding in other forms.
  it('from one definition, not two', () => {
    expect(code.split('function Status').length - 1).toBe(1)
  })
})

describe('a refused write says it is about who you are', () => {
  it('because "the database refused the change" sounds like bad data', () => {
    expect(code).toContain("err.includes('refused the change')")
    expect(src).toContain('admin only')
  })
})

describe('the empty box stops pretending to be full', () => {
  it('the warning names the wording specifically, not "words and a date"', () => {
    expect(src).toContain('No wording saved yet')
    expect(src).toContain('is a suggestion')
  })

  it('and names a missing date separately, so you fix the one that is wrong', () => {
    expect(src).toContain('No decision date yet')
  })

  it('and one press fills it in, since everybody thought it was filled already', () => {
    expect(src).toContain('Use the suggested wording')
    expect(code).toContain('save({ ...notice, text: SUGGESTED })')
  })

  it('and turning it on with nothing to say explains itself instead of springing back', () => {
    expect(code).toContain("if (!notice.on && !notice.text.trim())")
    expect(src).toContain('it would not stay on')
  })
})
