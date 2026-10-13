import { describe, it, expect } from 'vitest'
import {
  HARD, EASIER, WHY, empty, tidy, saidSomething, whatPacoKeeps, theShortVersion, asksAbout,
} from './handover-notes'

const LENDERS = ['Bankwest', 'Macquarie']

describe('two moments, two questions', () => {
  // The borrowing capacity knows what was hard, because that is where the
  // difficulty showed up. The lending options know why each lender is there.
  it('the borrowing capacity asks what was hard, and nothing about lenders', () => {
    expect(asksAbout('bc')).toEqual(['hard', 'easier'])
  })

  it('the lending options ask why these lenders, and nothing about difficulty', () => {
    expect(asksAbout('lo')).toEqual(['why', 'surprise'])
  })
})

describe('what somebody typed, cleaned', () => {
  it('keeps the taps we offered', () => {
    const h = tidy({ stage: 'bc', hard: ['Servicing was tight', 'Self-employed income'] })
    expect(h.hard).toEqual(['Servicing was tight', 'Self-employed income'])
  })

  // A MADE-UP TAG WOULD POISON EVERY COUNT PACO DOES AFTERWARDS, quietly and
  // for good. Anything we did not offer is thrown away.
  it('throws away a tap nobody was offered', () => {
    const h = tidy({ stage: 'bc', hard: ['Servicing was tight', 'Whatever I fancy'] })
    expect(h.hard).toEqual(['Servicing was tight'])
  })

  it('and only keeps reasons against a lender actually on the deal', () => {
    const h = tidy({ stage: 'lo', why: { Bankwest: ['Policy fit'], Suncorp: ['Rate'] } }, LENDERS)
    expect(Object.keys(h.why)).toEqual(['Bankwest'])
  })

  it('drops a lender nobody gave a reason for, rather than storing an empty one', () => {
    const h = tidy({ stage: 'lo', why: { Bankwest: ['Policy fit'], Macquarie: [] } }, LENDERS)
    expect(Object.keys(h.why)).toEqual(['Bankwest'])
  })

  it('a person can only choose the two tiers that are theirs to choose', () => {
    expect(tidy({ surpriseTier: 'B' }).surpriseTier).toBe('B')
    expect(tidy({ surpriseTier: 'D' }).surpriseTier).toBe('D')
    // A and C come from documents. Typing one would let somebody mark their own
    // recollection as the lender's written policy.
    expect(tidy({ surpriseTier: 'A' }).surpriseTier).toBe('D')
    expect(tidy({ surpriseTier: 'C' }).surpriseTier).toBe('D')
  })

  it('and copes with nothing at all', () => {
    const h = tidy(null)
    expect(h.stage).toBe('bc')
    expect(saidSomething(h)).toBe(false)
    expect(saidSomething(empty('lo'))).toBe(false)
  })

  it('knows when somebody actually said something', () => {
    expect(saidSomething(tidy({ note: 'Capacity is tight.' }))).toBe(true)
    expect(saidSomething(tidy({ hard: ['Credit history'] }))).toBe(true)
    expect(saidSomething(tidy({ note: '   ' }))).toBe(false)
  })
})

// THE LINE THIS WHOLE FILE IS DRAWN AROUND.
describe('almost none of it reaches Paco', () => {
  it('the note to the broker never does', () => {
    const h = tidy({
      stage: 'lo',
      note: 'Capacity is tight, the clients are stretched, sell Bankwest.',
      surprise: 'Bankwest took the one year in isolation.',
      surpriseLender: 'Bankwest',
    }, LENDERS)
    const kept = whatPacoKeeps(h)
    expect(kept?.said).toBe('Bankwest took the one year in isolation.')
    expect(kept?.said).not.toContain('clients')
    expect(kept?.said).not.toContain('Capacity is tight')
  })

  // A COUNT IS NOT A REASON. Three deals going the same way might be policy,
  // might be a good BDM, might be what the client wanted. Paco counts the taps
  // and asks about them later; he never repeats one as a fact.
  it('and nor do the taps, however many there are', () => {
    const h = tidy({
      stage: 'lo',
      why: { Bankwest: ['Policy fit', 'Only one who would'] },
      hard: ['Servicing was tight'],
    }, LENDERS)
    expect(whatPacoKeeps(h)).toBeNull()
  })

  it('the surprise does, with the bank and where it came from', () => {
    const h = tidy({
      stage: 'lo', surprise: 'Took one year in isolation on a 3 year ABN.',
      surpriseLender: 'Bankwest', surpriseTier: 'B',
    }, LENDERS)
    expect(whatPacoKeeps(h)).toEqual({
      lender: 'Bankwest', said: 'Took one year in isolation on a 3 year ABN.', tier: 'B',
    })
  })

  it('but not a surprise with no bank attached to it', () => {
    expect(whatPacoKeeps(tidy({ surprise: 'They were great.' }, LENDERS))).toBeNull()
  })

  it('nor a bank with no surprise attached to it', () => {
    expect(whatPacoKeeps(tidy({ surpriseLender: 'Bankwest' }, LENDERS))).toBeNull()
  })
})

describe('what the broker reads', () => {
  it('says what was hard and what would have helped', () => {
    const h = tidy({
      stage: 'bc',
      hard: ['Servicing was tight', 'Self-employed income'],
      easier: ['Another year of returns'],
    })
    expect(theShortVersion(h))
      .toBe('Hard because: servicing was tight, self-employed income. Easier with: another year of returns')
  })

  it('and why each lender is on the deal', () => {
    const h = tidy({ stage: 'lo', why: { Bankwest: ['Policy fit', 'Only one who would'], Macquarie: ['Rate'] } }, LENDERS)
    expect(theShortVersion(h)).toBe('Bankwest — policy fit, only one who would · Macquarie — rate')
  })

  it('and says nothing at all when nothing was tapped', () => {
    expect(theShortVersion(empty('bc'))).toBe('')
  })
})

describe('the questions themselves', () => {
  it('cover what actually makes an Australian deal hard', () => {
    for (const must of ['Servicing was tight', 'Self-employed income', 'Credit history', 'SMSF', 'Construction']) {
      expect(HARD as readonly string[]).toContain(must)
    }
  })

  it('and Fabio’s own example is one of the answers', () => {
    // "I might be able to get this across the line if they show us another
    // year's tax returns."
    expect(EASIER as readonly string[]).toContain('Another year of returns')
  })

  it('and his lending options example is one of the reasons', () => {
    // "I focused on Bank West because it's one year in isolation."
    expect(WHY as readonly string[]).toContain('Policy fit')
    expect(WHY as readonly string[]).toContain('Only one who would')
  })

  it('none of them ask about compliance', () => {
    const all = [...HARD, ...EASIER, ...WHY].join(' ').toLowerCase()
    for (const word of ['compliance', 'best interests', 'disclosure', 'responsible lending']) {
      expect(all, `the handover is asking about ${word}`).not.toContain(word)
    }
  })

  it('and none of them need typing', () => {
    for (const q of [...HARD, ...EASIER, ...WHY]) {
      expect(q.length, `"${q}" is too long to be a chip`).toBeLessThan(30)
    }
  })
})
