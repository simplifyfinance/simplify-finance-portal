// THE BROWSER CHECK ASKS WHETHER IT IS SIGNED IN BEFORE IT SPENDS HALF AN HOUR.
//
// 15 Nov 2026. Twice this week a ship passed every code check, every test and
// the build, then sat in the browser step failing all 42 tests - once for
// thirty-four minutes - because .auth/portal.json held a token Supabase had
// stopped accepting.
//
// The check knew the file EXISTED. It never asked whether it WORKED.
//
// Both times the server log said so in one line from the first second:
// "AuthApiError: Invalid Refresh Token: Refresh Token Not Found". Nobody was
// reading it, because the thing on screen said "Checking it in a browser..."
// and gave no reason to think anything was wrong.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

const SH = readFileSync('scripts/check-browser.sh', 'utf8')
const MJS = readFileSync('scripts/check-robot-login.mjs', 'utf8')
// ITS CODE, WITHOUT ITS COMMENTS. The file explains the fault it exists to
// catch, and that explanation names things the code must not contain - the
// word "password" among them. Four checks were tripped by their own prose on
// 14-15 Nov. A check that cannot tell an explanation from an instruction is a
// check somebody eventually deletes.
const MJS_CODE = MJS.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
// Comments explain the fault by quoting it. A check that reads prose as if it
// were code fails on correct code - that happened three times on 14 Nov.
const CODE = SH.split('\n').filter(l => !l.trim().startsWith('#')).join('\n')

describe('it asks first', () => {
  it('the check exists', () => {
    expect(existsSync('scripts/check-robot-login.mjs')).toBe(true)
  })

  it('and the browser gate runs it', () => {
    expect(CODE).toContain('check-robot-login.mjs')
  })

  // BEFORE THE TESTS, NOT AFTER. Running it afterwards answers a question
  // nobody is still asking.
  it('before any of the 42 tests, not after them', () => {
    const asks = CODE.indexOf('check-robot-login.mjs')
    const runs = CODE.indexOf('playwright test')
    expect(asks).toBeGreaterThan(-1)
    expect(runs).toBeGreaterThan(-1)
    expect(asks, 'the login check must come first').toBeLessThan(runs)
  })

  it('and stops rather than carrying on into the timeouts', () => {
    expect(CODE).toMatch(/check-robot-login\.mjs[\s\S]{0,400}exit 1/)
  })
})

describe('what it tells you', () => {
  it('names the one command that fixes it', () => {
    expect(MJS).toContain('./scripts/portal-login.sh')
  })

  it('and says plainly that the code is not the problem', () => {
    expect(MJS).toContain('Nothing is wrong with the code')
  })

  // THE ANSWER TO "WHY DID THIS HAPPEN AGAIN". Signing yourself out of the
  // portal revokes the robot's token too, because it signs in as you.
  it('and why it happened, so it stops being a mystery every time', () => {
    expect(MJS.toLowerCase()).toContain('signs out of the portal')
  })
})

describe('and it never damages what it is checking', () => {
  // Supabase rotates a refresh token when it is used. A check that wrote the
  // context back to disk could leave a half-rotated session behind - breaking
  // the very thing it exists to protect.
  it('reads the saved session and never writes it', () => {
    expect(MJS).toContain('storageState:')
    expect(MJS, 'writing the state back could corrupt it')
      .not.toContain('storageState({')
  })

  it('and never signs in, so no password is ever near it', () => {
    for (const never of ['password', 'fill(', 'PORTAL_TEST_PASSWORD']) {
      expect(MJS_CODE, `${never} has no place in a check`).not.toContain(never)
    }
  })
})
