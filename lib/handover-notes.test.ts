import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  HARD, EASIER, WHY, empty, tidy, saidSomething, whatPacoKeeps, theShortVersion, asksAbout,
  whatIsMissing, readyToSend,
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
    const h = tidy({ stage: 'bc', hard: ['Serviceability', 'Self-employed under 2 yrs'] })
    expect(h.hard).toEqual(['Serviceability', 'Self-employed under 2 yrs'])
  })

  // A MADE-UP TAG WOULD POISON EVERY COUNT PACO DOES AFTERWARDS, quietly and
  // for good. Anything we did not offer is thrown away.
  it('throws away a tap nobody was offered', () => {
    const h = tidy({ stage: 'bc', hard: ['Serviceability', 'Whatever I fancy'] })
    expect(h.hard).toEqual(['Serviceability'])
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
    expect(saidSomething(tidy({ hard: ['Credit impairment'] }))).toBe(true)
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
      hard: ['Serviceability'],
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
      hard: ['Serviceability', 'Self-employed under 2 yrs'],
      easier: ['Another year of returns'],
    })
    expect(theShortVersion(h))
      .toBe('Hard because: serviceability, self-employed under 2 yrs. Easier with: another year of returns')
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
    for (const must of ['Serviceability', 'Self-employed under 2 yrs', 'Credit impairment', 'SMSF', 'Construction']) {
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


// THE BOXES GET ANSWERED. THERE IS NO WAY PAST.
//
// 13 Oct 2026. The first version of this screen had a "Send without notes"
// button on it, which I added on my own reasoning that nothing should ever
// block a handover. Nobody asked for it. Fabio: "I never heard of it we never
// discussed so NO they need to fucking answer the boxes."
//
// The explanation that used to go in the email is the entire point of the
// screen, and an opt-out means it goes back to not happening.
describe('nothing is sent until the boxes are answered', () => {
  const note = 'Capacity is tight, I have focused on the smaller banks.'

  it('the borrowing capacity needs a sentence and an answer', () => {
    expect(readyToSend(tidy({ stage: 'bc', note, hard: ['Serviceability'] }))).toBe(true)
  })

  it('and says which box is still empty, rather than just greying out', () => {
    expect(whatIsMissing(tidy({ stage: 'bc' })))
      .toEqual(['what the broker needs to know', 'whether anything was hard about it'])
    expect(whatIsMissing(tidy({ stage: 'bc', note })))
      .toEqual(['whether anything was hard about it'])
    expect(whatIsMissing(tidy({ stage: 'bc', hard: ['Credit impairment'] })))
      .toEqual(['what the broker needs to know'])
  })

  it('a few characters is not a sentence', () => {
    expect(readyToSend(tidy({ stage: 'bc', note: 'ok', hard: ['Credit impairment'] }))).toBe(false)
  })

  // THE HONEST WAY OUT. Without it somebody ticks "credit history" on a clean
  // file to get past the box, and every count Paco does is rubbish.
  it('and a straightforward deal has a true answer to give', () => {
    expect(HARD as readonly string[]).toContain('Nothing unusual')
    expect(readyToSend(tidy({ stage: 'bc', note, hard: ['Nothing unusual'] }))).toBe(true)
  })

  it('the lending options need a reason for every lender on the deal', () => {
    const lenders = ['Bankwest', 'Macquarie']
    expect(readyToSend(tidy({ stage: 'lo', note, why: { Bankwest: ['Policy fit'] } }, lenders), lenders)).toBe(false)
    expect(whatIsMissing(tidy({ stage: 'lo', note, why: { Bankwest: ['Policy fit'] } }, lenders), lenders))
      .toEqual(['why Macquarie is on the deal'])
    expect(readyToSend(tidy({ stage: 'lo', note,
      why: { Bankwest: ['Policy fit'], Macquarie: ['Rate'] } }, lenders), lenders)).toBe(true)
  })

  it('and names them all when none are answered', () => {
    const lenders = ['Bankwest', 'Macquarie']
    expect(whatIsMissing(tidy({ stage: 'lo', note }, lenders), lenders))
      .toEqual(['why these lenders are on the deal'])
  })

  // MOST DEALS HAVE NO SURPRISE. Demanding one would manufacture them, and a
  // manufactured surprise is a wrong thing told to everybody who asks later.
  it('but the surprise stays optional', () => {
    const lenders = ['Bankwest']
    expect(readyToSend(tidy({ stage: 'lo', note, why: { Bankwest: ['Rate'] } }, lenders), lenders)).toBe(true)
  })

  it('and there is no way round it on the screen', () => {
    const box = readFileSync('components/Handover.tsx', 'utf8')
    expect(box).toContain('disabled={busy || missing.length > 0}')
    // The only mention left is the comment explaining why it went.
    expect((box.match(/Send without notes/g) || []).length).toBe(1)
    expect(box).not.toContain('onClick={() => send(false)}')
  })
})
