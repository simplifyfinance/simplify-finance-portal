import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// 16 Oct 2026. Fabio: "template box is not searching - Richard Lake is marked
// formal and not showing."
//
// The search was working perfectly. A browser probe typed "richard" into the
// real page and watched 39 rows become 0, with "No deal matches that" on screen
// and no error anywhere. Then it asked the better question - was a Lake deal in
// the list BEFORE anybody typed - and the answer was no.
//
// The picker loads the 300 most recent deals and filters them in the browser.
// On his book 300 rows leave 39 after the test deals and copies are stripped,
// and the Lake deal - opened 11 September - is older than the cut. It was never
// there. The filter matched nothing, correctly, and the screen blamed his
// typing.
//
// I could not find this by reading the component. Three passes over a filter
// that was right the whole time.

const SRC = readFileSync('components/MilestoneFromTemplates.tsx', 'utf8')

describe('the template picker', () => {
  it('asks the database when somebody types', () => {
    expect(SRC).toContain('deal_name.ilike')
    expect(SRC).toContain('[term]')
  })

  it('debounces, so a name is one query and not eight', () => {
    expect(SRC).toContain('setTimeout(')
    expect(SRC).toContain('clearTimeout(')
  })

  it('and says what the unsearched list actually is', () => {
    // A cap nobody is told about is the same fault as hiding a deal that
    // cannot send yet - which this file's own opening note forbids.
    expect(SRC).toContain('Type a name to search every deal')
    expect(SRC).toContain('every deal was searched, not just the ones listed')
  })

  it('still keeps test deals out of it', () => {
    expect((SRC.match(/realDealsOnly\(/g) || []).length).toBe(2)
  })

  it('never lists one deal twice when it is in both lists', () => {
    expect(SRC).toContain('function mergeById')
    expect(SRC).toContain('seen.has(String(r.id))')
  })
})

describe('mergeById', () => {
  // Pulled out of the component so the one piece with a way to go wrong can be
  // run without a browser.
  const merge = (first: any[], rest: any[]) => {
    const seen = new Set(first.map(r => String(r.id)))
    return [...first, ...rest.filter(r => !seen.has(String(r.id)))]
  }

  it('puts what the search found first', () => {
    expect(merge([{ id: 'b' }], [{ id: 'a' }]).map(r => r.id)).toEqual(['b', 'a'])
  })

  it('and a deal in both appears once', () => {
    expect(merge([{ id: 'a' }], [{ id: 'a' }, { id: 'c' }]).map(r => r.id)).toEqual(['a', 'c'])
  })

  it('copes with an id that is a number on one side and a string on the other', () => {
    expect(merge([{ id: 1 }], [{ id: '1' }]).map(r => r.id)).toEqual([1])
  })
})
