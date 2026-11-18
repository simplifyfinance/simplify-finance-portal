import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// EVERY TABLE IS LOCKED.
//
// 18 Nov 2026. Supabase emailed: "Anyone with your project URL can read, edit,
// and delete all data in this table because Row-Level Security is not enabled."
//
// It was public.clients_backup_2026_11_12 - a copy of every client record taken
// by hand on 12 November before a bulk change. Names, emails, phone numbers,
// open to anyone holding the portal's public key for six days.
//
// NOBODY SWITCHED SECURITY OFF. A table made this way inherits nothing:
//
//   create table clients_backup_2026_11_12 as select * from clients;
//
// Not the policies, not the row level security, not the grants. public.clients
// carries seven policies; the copy was born with none and with RLS off, which
// is Postgres's default for a new table. It looked like the clients table and
// behaved like an open door.
//
// THIS IS THE SIBLING OF lib/every-door-is-locked.test.ts, which has stopped an
// unguarded API route shipping since September. Same idea, other half of the
// building: that one reads every route, this one reads every table.
//
// IT CANNOT CATCH A TABLE MADE BY HAND IN THE DASHBOARD, which is exactly what
// this one was. components/TablesWithoutRls.tsx is the half that catches those
// - the portal asks the database every time an admin opens the dashboard.
//
// Fabio, 18 Nov 2026: "security is my number one priority."

const DOCS = join(__dirname, '..', 'docs')

// COMMENTS ARE NOT CODE, AND THIS FILE IS FULL OF THEM.
//
// Every .sql in docs/ opens with a long note explaining itself, and those notes
// quote SQL - including, in every-table-is-locked.sql, the exact "create table
// ... as select *" that caused all this. Scanning the raw text made the guard
// fail on its own worked example, which is the sort of thing that gets a guard
// switched off.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
}

const sql = (): string =>
  readdirSync(DOCS)
    .filter(f => f.endsWith('.sql'))
    .map(f => stripComments(readFileSync(join(DOCS, f), 'utf8')))
    .join('\n')

/** Every table the repo's SQL creates, however it is spelled. */
function tablesCreated(all: string): string[] {
  const out = new Set<string>()
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(all))) out.add(m[1].toLowerCase())
  return [...out].sort()
}

function hasRls(all: string, table: string): boolean {
  return new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
    'i').test(all)
}

function hasPolicy(all: string, table: string): boolean {
  return new RegExp(`create\\s+policy[^;]*?\\son\\s+(?:public\\.)?${table}\\b`, 'is').test(all)
}

// LOCKED SO HARD NOTHING CAN READ THEM, AND THAT IS THE POINT.
//
// RLS on with no policy is the safest state a table can be in: it denies
// everybody. These three are deliberately there and our own SQL says so.
const NO_POLICY_ON_PURPOSE: Record<string, string> = {
  auth_codes: 'Sign-in codes. Service role only - a policy here removes the second factor.',
  trusted_devices: 'Browsers that passed a code. Service role only, same reason.',
  broker_access: 'Read only by auth_visible_broker_keys(), which is security definer.',
}

describe('every table our SQL creates is locked', () => {
  const all = sql()
  const tables = tablesCreated(all).filter(t => t !== 'if')

  // deals and clients are older than docs/ and are not created by any file in
  // it. The ones below are, and they are the proof this is reading real SQL
  // rather than an empty string.
  it('finds the tables at all', () => {
    expect(tables.length).toBeGreaterThan(20)
    expect(tables).toContain('deal_stage_events')
    expect(tables).toContain('commission_splits')
  })

  for (const t of tablesCreated(sql()).filter(x => x !== 'if')) {
    it(`${t} has row level security`, () => {
      expect(hasRls(all, t),
        `${t} is created with no "enable row level security". Anyone holding the `
        + 'public key could read it. Add the line, in the same file, under the create.')
        .toBe(true)
    })
  }

  for (const t of tablesCreated(sql()).filter(x => x !== 'if')) {
    if (NO_POLICY_ON_PURPOSE[t]) continue
    it(`${t} has at least one policy`, () => {
      expect(hasPolicy(all, t),
        `${t} has row level security and no policy, so nothing can read it - including `
        + 'the portal. Either write the policy, or add it to NO_POLICY_ON_PURPOSE with '
        + 'the reason, the way auth_codes and trusted_devices are.')
        .toBe(true)
    })
  }

  // broker_access is older than docs/ too - it is created in the September
  // catch-up script, outside this folder. Its lock is checked on the live
  // database by tables_without_rls(), which is the half that reads reality.
  it('and the ones with no policies are there on purpose, with a reason each', () => {
    for (const [t, why] of Object.entries(NO_POLICY_ON_PURPOSE)) {
      expect(why.length, `${t} needs a reason`).toBeGreaterThan(20)
      if (tables.includes(t)) expect(hasRls(all, t), `${t} must still have RLS on`).toBe(true)
    }
  })
})

// THE OTHER HALF: the portal asking the database, for tables nobody wrote SQL
// for. That is the one that would have caught the clients backup.
describe('the portal checks its own locks', () => {
  const FN = readFileSync(join(DOCS, 'every-table-is-locked.sql'), 'utf8')
  const BAND = readFileSync(
    join(__dirname, '..', 'components', 'TablesWithoutRls.tsx'), 'utf8')
  const PAGE = readFileSync(
    join(__dirname, '..', 'app', '(app)', 'dashboard', 'page.tsx'), 'utf8')

  it('there is a function that answers which tables are open', () => {
    expect(FN).toContain('create or replace function public.tables_without_rls()')
    expect(FN).toContain('c.relrowsecurity = false')
  })

  it('and it refuses anybody who is not an admin', () => {
    // A list of unlocked tables is a shopping list.
    expect(FN).toContain("public.auth_role() = 'admin'")
    expect(FN).toContain('revoke all on function public.tables_without_rls() from public')
  })

  it('the dashboard asks it, on a page somebody opens every morning', () => {
    expect(PAGE).toContain("supabase.rpc('tables_without_rls')")
    expect(PAGE).toContain('<TablesWithoutRls tables={openTables} />')
  })

  it('and a missing function does not take the dashboard down with it', () => {
    // The migration and the deploy land in either order.
    expect(PAGE).toContain('catch { /* the band simply does not draw */ }')
  })

  it('the band says nothing when there is nothing to say', () => {
    expect(BAND).toContain('if (open.length === 0) return null')
  })

  it('and names the table rather than sending somebody looking', () => {
    expect(BAND).toContain('{open.map(t =>')
    expect(BAND).toContain('enable row level security')
  })
})
