// THE KNOWLEDGE BASE READS NEWEST FIRST, WHOEVER ADDED THE ENTRY.
//
// 22 Oct 2026. Fabio: "knowledeg based under everything should be cronological
// order". It relied on people writing new entries at the top of the file, and
// that had already drifted - the lending options guide, dated 19 October, sat
// above four entries from the 21st. Nothing noticed, because nothing checked.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { ENTRIES, entriesFor, SECTIONS } from './knowledge-base'

describe('the knowledge base is in date order', () => {
  it('every section reads newest first', () => {
    for (const section of ['all' as const, ...SECTIONS.map(s => s.key)]) {
      const dates = entriesFor(section).map(e => e.on)
      const sorted = [...dates].sort().reverse()
      expect(dates, `the ${section} list is out of order`).toEqual(sorted)
    }
  })

  it('a search result is in order too', () => {
    const dates = entriesFor('all', 'the').map(e => e.on)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('two entries on the same day keep the order they were written in', () => {
    const sameDay = ENTRIES.filter(e => e.on === '2026-10-21').map(e => e.id)
    const shown = entriesFor('all').filter(e => e.on === '2026-10-21').map(e => e.id)
    expect(shown).toEqual(sameDay)
  })

  it('every entry carries a real date', () => {
    for (const e of ENTRIES) {
      expect(e.on, `${e.id} has no date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(`${e.on}T00:00:00`).getTime()), `${e.id}: ${e.on}`).toBe(false)
    }
  })

  it('and no two entries share an id', () => {
    const ids = ENTRIES.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// AND THE PAGE DOES NOT PUT IT BACK OUT OF ORDER.
//
// 23 Oct 2026. The list was sorted on 22 Oct and the page still looked wrong,
// because it cut the sorted list into three section groups and drew them in a
// fixed order. The newest entry in the portal sat two headings down the page.
// Fabio: "I asked you to be chronologic, that hasn't been done." He was right.
describe('the Everything tab is one list, not three', () => {
  const page = readFileSync('app/(app)/knowledge-base/page.tsx', 'utf8')

  it('does not group when the tab is Everything', () => {
    expect(page).toContain("if (section === 'all') return [{ key: 'all', label: '', blurb: '', items: shown }]")
  })

  it('and each card still names its own section, not the group it sits in', () => {
    expect(page, 'the pill is reading the group label again')
      .toContain('{sectionLabel(e.section)}')
  })
})
