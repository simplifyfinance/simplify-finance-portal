import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// NOBODY SAVES ANONYMOUSLY.
//
// 23 Sep 2026. A credit officer's work was thought lost, and the first place
// anybody looked was the history - who saved what, and when. Several rows had
// no name against them at all.
//
// The cause: the screen learns who you are through two calls in sequence, the
// session then the profile row with your full name. Anything saved before both
// finished was written with no name. Which is ALWAYS the first save after a tab
// opens - the exact save somebody goes looking for.

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('the save resolves who did it', () => {
  it('does not simply trust the name the screen hands it', () => {
    // It used to write `savedBy.name` straight through, so an empty one meant
    // an unsigned row and nothing noticed.
    const s = read('lib/save-conflict.ts')
    expect(s).toMatch(/if \(!by\?\.name\)/)
    expect(s).toMatch(/supabase\.auth\.getUser\(\)/)
  })

  it('falls back to the address rather than to nothing', () => {
    expect(read('lib/save-conflict.ts')).toMatch(/u\.email/)
  })

  it('signs the kept version with the same name as the save', () => {
    // The version kept in deal_history and the deal's own last-saved line must
    // agree. Signing one and not the other is how a history grows rows that
    // contradict the record they came from.
    const s = read('lib/save-conflict.ts')
    expect(s).toContain('keepVersion(supabase, dealId, column, previous, by)')
    expect(s).toContain('fields.last_saved_name = by.name')
  })

  it('never lets a missing name stop the save', () => {
    // Fabio, 7 Sep 2026: being told you cannot save is worse than almost
    // anything it protects you from. A label is not worth blocking work over.
    const s = read('lib/save-conflict.ts')
    const block = s.slice(s.indexOf('let by = savedBy'), s.indexOf('KEEP WHAT WE ARE ABOUT TO REPLACE'))
    expect(block).toMatch(/catch/)
    expect(block).not.toMatch(/\breturn\b/)
  })
})

describe('the screen knows who you are sooner', () => {
  it('uses the address the moment the session lands', () => {
    // Without this the window stays open for the whole profile lookup, which
    // is a second round trip on a cold page.
    const s = read('app/(app)/deals/[id]/DealPageClient.tsx')
    expect(s).toMatch(/setMe\(\{ id: u\.id, name: u\.email \|\| '' \}\)/)
  })

  it('still replaces it with the real full name', () => {
    const s = read('app/(app)/deals/[id]/DealPageClient.tsx')
    expect(s).toContain("select('full_name')")
    expect(s).toMatch(/full_name \|\| u\.email/)
  })
})
