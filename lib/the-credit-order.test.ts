// COMPLIANCE FIRST, BECAUSE THAT IS A DEAL THIS WEEK.
//
// 16 Nov 2026. Fabio: "if someone is at compliance, I want that to be sitting
// on the top of the list for credit, because that means we're going to get a
// deal that week."
import { describe, it, expect } from 'vitest'
import {
  CREDIT_STAGES, SUGGEST, stageRank, byStageThenAge, openWithSuggestion, pickedWords,
  creditDay,
} from './the-credit-order'

const LINE = '__line__'
const row = (id: string, stage: string, since: string) => ({ id, stage, since })

describe('the order is the distance to a lodged deal', () => {
  it('compliance, then LO, then BC, then fact find', () => {
    expect(CREDIT_STAGES).toEqual(['Compliance', 'LO', 'BC', 'Fact Find'])
    expect(stageRank('Compliance')).toBeLessThan(stageRank('LO'))
    expect(stageRank('LO')).toBeLessThan(stageRank('BC'))
    expect(stageRank('BC')).toBeLessThan(stageRank('Fact Find'))
  })

  it('and anything it does not recognise sorts last, never first', () => {
    expect(stageRank('')).toBe(CREDIT_STAGES.length)
    expect(stageRank(null)).toBe(CREDIT_STAGES.length)
    expect(stageRank('Settlement')).toBe(CREDIT_STAGES.length)
    expect(stageRank('Fact Find')).toBeLessThan(stageRank('Settlement'))
  })
})

describe('inside a stage, oldest first', () => {
  it('because the one sitting longest has kept somebody waiting longest', () => {
    const rows = [
      row('new-compliance', 'Compliance', '2026-11-14'),
      row('old-bc',         'BC',         '2026-10-01'),
      row('old-compliance', 'Compliance', '2026-11-02'),
      row('new-lo',         'LO',         '2026-11-13'),
      row('old-lo',         'LO',         '2026-11-05'),
    ]
    expect(byStageThenAge(rows).map(r => r.id)).toEqual([
      'old-compliance', 'new-compliance', 'old-lo', 'new-lo', 'old-bc',
    ])
  })

  it('a missing date sorts last within its stage, not first', () => {
    const rows = [row('nodate', 'LO', ''), row('dated', 'LO', '2026-11-01')]
    expect(byStageThenAge(rows).map(r => r.id)).toEqual(['dated', 'nodate'])
  })

  it('and it never touches the list it was given', () => {
    const rows = [row('b', 'BC', '2026-10-01'), row('a', 'Compliance', '2026-11-01')]
    const before = rows.map(r => r.id)
    byStageThenAge(rows)
    expect(rows.map(r => r.id)).toEqual(before)
  })

  it('an empty book is an empty day', () => {
    expect(byStageThenAge([])).toEqual([])
    expect(byStageThenAge(null as any)).toEqual([])
  })
})

describe('where the day opens', () => {
  const ids = Array.from({ length: 27 }, (_, i) => `d${i + 1}`)

  // 16 Nov 2026: it used to open EMPTY - everything below the line.
  it('with ten ticked, and the rest in the queue', () => {
    const out = openWithSuggestion(ids, null, SUGGEST, LINE)
    expect(out.indexOf(LINE)).toBe(10)
    expect(out.slice(0, 10)).toEqual(ids.slice(0, 10))
    expect(out.slice(11)).toEqual(ids.slice(10))
  })

  it('and never offers more than there are', () => {
    const three = ['a', 'b', 'c']
    const out = openWithSuggestion(three, null, SUGGEST, LINE)
    expect(out).toEqual(['a', 'b', 'c', LINE])
  })

  it('nothing with you is still a line, not a crash', () => {
    expect(openWithSuggestion([], null, SUGGEST, LINE)).toEqual([LINE])
    expect(openWithSuggestion(null as any, null, SUGGEST, LINE)).toEqual([LINE])
  })

  // THE RULE THAT MATTERS MOST. Once she has said "this is my day", the portal
  // does not get to put a deal into her morning behind her back.
  describe('but a day she has already said yes to wins', () => {
    it('her saved day stays above the line, whatever the suggestion would be', () => {
      const saved = ['d20', 'd3']
      const out = openWithSuggestion(ids, saved, SUGGEST, LINE)
      expect(out.slice(0, out.indexOf(LINE))).toEqual(['d20', 'd3'])
    })

    it('and a deal that arrived since goes to the queue, not into her day', () => {
      const saved = ['d2']
      const out = openWithSuggestion([...ids, 'brand-new'], saved, SUGGEST, LINE)
      const today = out.slice(0, out.indexOf(LINE))
      expect(today).toEqual(['d2'])
      expect(out.slice(out.indexOf(LINE) + 1)).toContain('brand-new')
    })

    it('a saved deal that is no longer hers is dropped, not resurrected', () => {
      const out = openWithSuggestion(['a', 'b'], ['a', 'gone'], SUGGEST, LINE)
      expect(out).toEqual(['a', LINE, 'b'])
    })
  })
})

describe('the counter', () => {
  it('says what it is out of, without pretending ten is a cap', () => {
    expect(pickedWords(10, 27)).toBe('of 27 — the most anybody gets through')
  })

  it('and says so plainly when there is nothing', () => {
    expect(pickedWords(0, 0)).toBe('nothing with you today')
  })

  it('and never tells her off for picking eleven', () => {
    const words = pickedWords(11, 27).toLowerCase()
    for (const nag of ['too many', 'limit', 'maximum', 'cannot', 'only']) {
      expect(words, `"${words}" reads as a telling-off`).not.toContain(nag)
    }
  })
})

// 27 Oct 2026, and it still holds: a rework beats a broker's ask, and a
// broker's ask beats anything the portal thinks. The suggestion only sorts
// what nobody has given an instruction about.
describe('an instruction outranks a suggestion', () => {
  const back = { id: 'back', stage: 'BC', since: '2026-11-14', rework: { at: '2026-11-14' } }
  const ask = { id: 'ask', stage: 'Fact Find', since: '2026-11-14', priority: 'Mark' }
  const comp = { id: 'comp', stage: 'Compliance', since: '2026-10-01' }
  const lo = { id: 'lo', stage: 'LO', since: '2026-10-02' }

  it('sent back first, then the broker ask, then the stage order', () => {
    expect(creditDay([lo, comp, ask, back]).map(d => d.id))
      .toEqual(['back', 'ask', 'comp', 'lo'])
  })

  it('even when the sent-back one is the furthest from lodging', () => {
    // back is at BC and ask is at Fact Find - both behind a Compliance file,
    // and both still above it, because a person asked for them.
    expect(creditDay([comp, back, ask])[0].id).toBe('back')
    expect(creditDay([comp, back, ask])[1].id).toBe('ask')
  })

  it('and with nobody asking for anything it is purely the stage order', () => {
    expect(creditDay([lo, comp]).map(d => d.id)).toEqual(['comp', 'lo'])
  })

  it('an empty book is an empty day', () => {
    expect(creditDay([])).toEqual([])
    expect(creditDay(null as any)).toEqual([])
  })
})
