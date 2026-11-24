import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

// NOTHING RESTORES OVER PRODUCTION.
//
// 23 Nov 2026. Two scripts were added to bring staging up to date and to
// prepare the move to Sydney. One of them RESTORES A SCHEMA, which is the
// single most dangerous thing in this repository: run against the wrong
// database it writes over the portal.
//
// The two connection strings differ by a dozen characters in the middle of a
// long line, and they get copied between a browser, a password manager and a
// terminal at the end of a long day.
//
// So the refusal is checked here. If somebody ever simplifies these scripts
// and takes the guard out, this fails.

const PULL = 'scripts/pull-the-real-schema.sh'
const PUSH = 'scripts/bring-staging-up-to-date.sh'

const PRODUCTION_REF = 'brjytbuirbupatjtauhx'

describe('the scripts exist', () => {
  for (const f of [PULL, PUSH, 'docs/both-sides-must-match.sql',
                   'docs/moving-the-database-to-sydney.md']) {
    it(f, () => expect(existsSync(f), `${f} is gone`).toBe(true))
  }
})

describe('reading production cannot change it', () => {
  const S = readFileSync(PULL, 'utf8')

  it('it only ever dumps and diffs', () => {
    expect(S).toContain('supabase db dump')
    for (const never of ['psql --file', 'DROP ', 'TRUNCATE', 'DELETE FROM', 'INSERT INTO']) {
      expect(S, `${never} has no business in a read-only script`).not.toContain(never)
    }
  })

  it('and it says so where somebody reading it will see', () => {
    expect(S).toContain('Read only')
  })

  // THE POOLER BREAKS BULK COPIES. Said in the script because it is the first
  // thing that goes wrong and the error does not explain itself.
  it('it tells you to use the direct connection', () => {
    expect(S).toContain('DIRECT connection')
  })
})

describe('the restore refuses to touch production', () => {
  const S = readFileSync(PUSH, 'utf8')

  it('the production project reference is named in the script', () => {
    expect(S).toContain(PRODUCTION_REF)
  })

  it('and it stops rather than warning', () => {
    const guard = S.slice(S.indexOf('THE REFUSAL'))
    expect(guard).toContain('exit 1')
    expect(guard).toContain('STOP')
  })

  it('the refusal comes BEFORE anything is restored', () => {
    expect(S.indexOf('$REFUSE'), 'the check runs after the restore')
      .toBeLessThan(S.indexOf('psql --variable'))
  })

  it('it asks for a word to be typed, not a key to be pressed', () => {
    expect(S).toContain('Type the word staging')
  })

  // A SCHEMA WITHOUT ITS POLICIES IS AN OPEN DATABASE, and on 12 November that
  // happened to one table for six days. The script counts them and refuses a
  // thin file rather than restoring one.
  it('and it refuses a dump that is missing its policies', () => {
    expect(S).toContain("grep -c 'CREATE POLICY'")
    expect(S).toContain('POLICIES" -lt 100')
    const thin = S.slice(S.indexOf('POLICIES" -lt 100'))
    expect(thin).toContain('exit 1')
  })
})

describe('no client data goes near staging', () => {
  const S = readFileSync(PUSH, 'utf8')

  it('the restore is schema and roles only, never data', () => {
    expect(S).toContain('roles.sql')
    expect(S).toContain('schema.sql')
    expect(S, 'a data file would put client records in staging')
      .not.toContain('data.sql')
  })

  it('and the script says so', () => {
    expect(S).toContain('SCHEMA ONLY')
  })
})

describe('the plan is written down where anyone can read it', () => {
  const PLAN = readFileSync('docs/moving-the-database-to-sydney.md', 'utf8')

  // CHANGED 25 NOV 2026. This used to assert the plan said "Nothing is being
  // done yet". It did, truthfully, on 23 November - seven questions were with
  // Supabase and the instruction was to wait.
  //
  // We are no longer waiting, and the reason is in the plan: two of the three
  // blockers we answered ourselves. The revoke statements Supabase were asked
  // for had already been written in our own 23 November audit, and whether the
  // dump carries the security policies can be read off the dump file instead of
  // asked. So the status line had to move or it would be a lie in a document
  // somebody follows at midnight.
  //
  // What this test guards now is the thing that actually matters: the plan must
  // always say plainly where the work has got to, and must never quietly become
  // a document that reads as if nothing has started while three steps are done.
  it('says where the work has actually got to', () => {
    expect(PLAN, 'the status heading must carry its own date')
      .toMatch(/## Status, \d{1,2} \w+ 2026/)
    expect(PLAN).toContain('Phase 1 has started')
    expect(PLAN, 'and must still name what is genuinely unresolved')
      .toContain('Still genuinely open with Supabase')
  })

  // THE GATE THAT REPLACED THE WAITING ONE. Production is not touched until
  // staging has proven it, and that sentence is load-bearing.
  it('and production is still untouched until staging proves it', () => {
    expect(PLAN).toContain('Production is not touched at all until staging has')
  })

  // THE ONE THAT WOULD BREAK QUIETLY. Three client pages open from links
  // signed with the service role key unless READY_LINK_SECRET is set.
  it('and it names the client links as the thing to fix first', () => {
    expect(PLAN).toContain('READY_LINK_SECRET')
    // "Not optional" is still in the document, now struck through beside DONE -
    // it was set in Vercel on 22 Nov and tested end to end on 25 Nov. The words
    // stay because the REASON stays, and the next person needs it.
    expect(PLAN).toContain('Not optional')
    expect(PLAN).toContain('this is already done')
  })

  it('it is honest about what Sydney does and does not mean', () => {
    expect(PLAN).toContain('Do not tell the IT reviewer that nothing leaves Australia')
    expect(PLAN).toContain('client data is stored in Australia')
  })

  it('and it lists what staging cannot prove', () => {
    expect(PLAN).toContain('What staging will NOT prove')
    for (const t of ['The 18 user accounts', 'The 582 files', 'The catch-up copy']) {
      expect(PLAN).toContain(t)
    }
  })
})
