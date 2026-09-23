import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// THE HISTORY OF A CLIENT'S POSITION.
//
// `client_positions` has existed since the portal was built - indexed, with its
// policies - and until 23 Sep 2026 nothing had ever written a row to it. So
// every one of these things was wrong at once and none of them could have been
// noticed: two columns the code wrote did not exist, `captured_at` was NOT NULL
// and never set, and both policies could only find the FIRST applicant on a
// deal.
//
// These are the gates that stop each of those coming back.

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const settlement = () => read('components/PositionAtSettlement.tsx')
const close      = () => read('app/(app)/deals/[id]/CloseDeal.tsx')
const schema     = () => read('docs/client-position-schema.sql')

describe('every capture writes a history row', () => {
  it('the settlement capture inserts one', () => {
    const s = settlement()
    expect(s).toContain("from('client_positions').insert")
    expect(s).toContain("captured_from: 'settlement'")
  })

  it('closing a deal as lost inserts one', () => {
    const s = close()
    expect(s).toContain("from('client_positions').insert")
    expect(s).toContain("captured_from: 'deal closed'")
  })

  it('both set the date, because the column will not take a row without one', () => {
    // captured_at is NOT NULL. Relying on a default that may or may not be
    // there is how this fails on the first real settlement and nowhere else.
    expect(settlement(), 'settlement capture does not set captured_at').toContain('captured_at')
    expect(close(), 'close deal does not set captured_at').toContain('captured_at')
  })

  it('both check the write, because row level security refuses silently', () => {
    expect(settlement()).toMatch(/checkedWrite\(\s*supabase\.from\('client_positions'\)/)
    expect(close()).toMatch(/checkedWrite\(\s*supabase\.from\('client_positions'\)/)
  })
})

describe('the schema the capture needs', () => {
  it('adds the two columns the code writes', () => {
    const s = schema()
    expect(s).toContain('position_source')
    expect(s).toContain('position_updated_by')
    // Twice-runnable. A migration somebody is afraid to re-run is a migration
    // that only ever gets run on one of the two databases.
    expect(s).toMatch(/add column if not exists\s+position_source/)
    expect(s).toMatch(/add column if not exists\s+position_updated_by/)
  })

  it('lets a joint applicant be recorded, not just the first one', () => {
    // The second applicant's client id lives inside the fact find, never in
    // deals.client_id. A policy that only knows deals.client_id silently
    // refuses every joint deal's second person.
    const s = schema()
    const insertPolicy = s.slice(s.indexOf('Position insert via clients'))
    expect(insertPolicy).toContain("fact_find_data->'applicants'")
  })

  it('lets a joint applicant be read back too', () => {
    const s = schema()
    const selectPolicy = s.slice(s.indexOf('Position visibility via clients'))
    expect(selectPolicy).toContain("fact_find_data->'applicants'")
  })

  it('lets somebody who can see every deal record one', () => {
    // The insert policy was missing this and the select policy had it, so a
    // person could read a position they were not allowed to write.
    const s = schema()
    const insertPolicy = s.slice(s.indexOf('Position insert via clients'), s.indexOf('Position visibility via clients'))
    expect(insertPolicy).toContain('auth_sees_all_deals()')
  })

  it('deletes nothing', () => {
    const s = schema().toLowerCase()
    expect(s).not.toMatch(/\bdrop table\b/)
    expect(s).not.toMatch(/\bdrop column\b/)
    expect(s).not.toMatch(/\bdelete from\b/)
    expect(s).not.toMatch(/\btruncate\b/)
  })
})
