import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE GATE THAT WATCHED IT HAPPEN.
//
// 16 Sep 2026: the browser check found the Lending Options tab failing to draw
// at all, printed the failure, and pushed to production anyway. Fabio's team got
// a broken tab from the very gate that spotted it.
//
// It was written that way on purpose on 9 Sep - "a new gate that stops the ship
// while it is still being bedded in costs more time than the bugs it catches.
// Turn the exit 1 back on once it has been quiet for a week." It has been quiet
// for a week, and then it earned the promotion the hard way.

const src = readFileSync('scripts/check-browser.sh', 'utf8')

describe('a failing browser check stops the ship', () => {
  it('exits non-zero when the robot finds something', () => {
    const block = src.slice(src.indexOf('if [ $RESULT -ne 0 ]'))
    expect(block, 'the browser check reports and ships anyway again')
      .toMatch(/exit 1/)
    expect(block.slice(0, block.indexOf('exit 1')))
      .not.toMatch(/exit 0/)
  })

  it('still skips quietly when it is not set up', () => {
    // A gate that blocks everybody the day somebody clones the repo is a gate
    // that gets deleted. Not signed in, no test deal, no Playwright - skip.
    for (const why of ['Playwright is not installed', 'set PORTAL_TEST_DEAL_ID', 'not signed in']) {
      const at = src.indexOf(why)
      expect(at, `the skip for "${why}" has gone`).toBeGreaterThan(-1)
      expect(src.slice(at, at + 200)).toMatch(/exit 0/)
    }
  })

  it('tells you how to re-run just the failures', () => {
    // Seven minutes to find out whether a one-line fix worked is why this was
    // left un-blocking for a week.
    expect(src).toContain('./scripts/check-browser.sh <spec name>')
  })
})
