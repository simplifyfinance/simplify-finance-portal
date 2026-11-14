// THE TAB FINDS OUT, WITHOUT SITTING IN THE WAY.
//
// 13 Nov 2026. Katie's session ended at 3:14pm. Her tab carried on until past
// four, asking the database four hundred times with no credentials. The
// database answers an unknown caller with silence rather than an error, so
// every box was empty and nothing said why.
//
// THE FIRST ATTEMPT AT THIS BROKE THE PORTAL. It wrapped the fetch every
// database call goes through so it could watch each one leave. Sixty-eight
// browser tests failed, no deal card would load, and a ship was lost.
//
// So the rules this file holds are as much about what the watcher MUST NOT do
// as what it must. It never touches a request. It never treats "I could not
// tell" as "signed out". And it never fires on a healthy session, however long
// that session runs.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import {
  heartbeatSaysOut, cookieSaysOut, theDoorHasClosed, theDoorClosed,
  onDoorClosed, openTheDoorAgain,
} from './the-door-closed'

beforeEach(() => openTheDoorAgain())

describe('the heartbeat we already send', () => {
  // The middleware answers 401 on /api/2fa/touch in its own words when the
  // session is gone. That is the only status that means it.
  it('401 means signed out', () => {
    expect(heartbeatSaysOut(401)).toBe(true)
  })

  // WIFI DROPS AND SERVERS HICCUP. Locking somebody's screen for that would be
  // its own fault, and a worse one than the thing being fixed.
  it('and nothing else does', () => {
    for (const s of [200, 204, 403, 429, 500, 502, 0, null, undefined, 'nope']) {
      expect(heartbeatSaysOut(s), `${s} must not lock the screen`).toBe(false)
    }
  })
})

describe('what the browser cookie says', () => {
  const now = 1_800_000_000_000

  it('no session at all is signed out', () => {
    expect(cookieSaysOut(null, now)).toBe(true)
    expect(cookieSaysOut(undefined, now)).toBe(true)
  })

  it('an expired one is too', () => {
    expect(cookieSaysOut({ expires_at: (now - 1000) / 1000 }, now)).toBe(true)
  })

  it('a live one is not', () => {
    expect(cookieSaysOut({ expires_at: (now + 3_600_000) / 1000 }, now)).toBe(false)
  })

  // THE LESSON FROM THE VERSION THAT BROKE THE PORTAL. A missing header was
  // read as "nobody is asking", and the whole portal locked.
  it('and anything unreadable is NOT counted as signed out', () => {
    expect(cookieSaysOut({}, now)).toBe(false)
    expect(cookieSaysOut({ expires_at: 'soon' }, now)).toBe(false)
    expect(cookieSaysOut({ expires_at: 0 }, now)).toBe(false)
    expect(cookieSaysOut('a string', now)).toBe(false)
  })
})

describe('the work is put somewhere safe before anything is drawn', () => {
  it('every listener runs, in the order they were added', () => {
    const ran: string[] = []
    onDoorClosed(() => ran.push('draft'))
    onDoorClosed(() => ran.push('screen'))
    theDoorHasClosed()
    expect(ran).toEqual(['draft', 'screen'])
  })

  it('and one failing does not stop the others', () => {
    const ran: string[] = []
    onDoorClosed(() => { throw new Error('storage is full') })
    onDoorClosed(() => ran.push('screen'))
    theDoorHasClosed()
    expect(ran).toEqual(['screen'])
  })

  it('and it only ever happens once', () => {
    let n = 0
    onDoorClosed(() => { n++ })
    theDoorHasClosed()
    theDoorHasClosed()
    theDoorHasClosed()
    expect(n).toBe(1)
    expect(theDoorClosed()).toBe(true)
  })
})

// WHAT IT MUST NOT DO. This block is the one that would have stopped the
// version that broke the portal, so it checks the shape of the code itself.
describe('it never sits between the portal and its data', () => {
  const watcher = readFileSync('lib/the-door-closed.ts', 'utf8')
  const screen = readFileSync('components/TheDoorClosed.tsx', 'utf8')

  it('the watcher does not wrap fetch', () => {
    expect(watcher).not.toContain('watchingFetch')
    expect(watcher, 'nothing here may stand in front of a request')
      .not.toMatch(/\bfetch\s*\(/)
  })

  it('and neither browser connection has a fetch of ours in it', () => {
    for (const f of ['lib/supabase.ts', 'lib/supabase-browser.ts']) {
      const code = readFileSync(f, 'utf8')
      expect(code, `${f} must not wrap fetch - it broke every deal card on 13 Nov`)
        .not.toContain('global:')
    }
  })

  it('the screen only reads the session the browser already holds', () => {
    expect(screen).toContain('auth.getSession()')
    expect(screen).toContain('visibilitychange')
  })

  it('and it draws nothing until it has to', () => {
    expect(screen).toContain('if (!shut) return null')
  })

  // Fabio, on the first draft: "Why would I tell the session expired an hour
  // ago? imagine reading that and say, my last hour of work is lost."
  it('and it says the work is safe, not that an hour was lost', () => {
    expect(screen).toContain('Your work is saved on this computer')
    expect(screen).toContain('nowInSydney')
    expect(screen.toLowerCase()).not.toContain('hour ago')
    expect(screen.toLowerCase()).not.toContain('has been lost')
  })
})
