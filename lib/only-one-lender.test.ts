// "WE NEED TO FORCE MY CREDIT TEAM TO GIVE ME AN ANSWER."
//
// 17 Nov 2026, Fabio, on a lending option going out with one product on it:
// "because that answer then goes into the compliance notes."
import { describe, it, expect } from 'vitest'
import {
  WHY_ONE_LENDER, WHY_KEY, whyOneLender, whyOneLenderSentence,
  blockedForNoReason, ASK_FOR_IT,
} from './only-one-lender'

const lo = (reason?: string) => (reason === undefined ? {} : { [WHY_KEY]: reason })

describe('the reasons credit is offered', () => {
  it('are the ones they actually give', () => {
    expect(WHY_ONE_LENDER).toContain('Client wants to stay with their existing lender')
    expect(WHY_ONE_LENDER).toContain('Only lender that services this application')
    expect(WHY_ONE_LENDER.length).toBeGreaterThanOrEqual(4)
  })

  it('and every one of them has words for the notes', () => {
    for (const why of WHY_ONE_LENDER) {
      const said = whyOneLenderSentence(lo(why), 'St George')
      expect(said, `${why} prints nothing`).toBeTruthy()
      expect(said.endsWith('.'), `${why} does not end in a full stop`).toBe(true)
      expect(said).toContain('St George')
    }
  })
})

describe('what the notes print', () => {
  it('the reason, in the portal’s words', () => {
    expect(whyOneLenderSentence(lo('Client wants to stay with their existing lender'), 'St George'))
      .toBe('The clients want to stay with their existing lender, St George.')
    expect(whyOneLenderSentence(lo('Only lender that services this application'), 'St George'))
      .toBe('St George is the only lender that services this application.')
  })

  // A BROKER EXPLAINING AN UNUSUAL DEAL IS NOT IMPROVED BY BEING PARAPHRASED.
  it('and anything typed is used word for word', () => {
    expect(whyOneLenderSentence(lo('Client is mid-build and cannot move lenders'), 'St George'))
      .toBe('Client is mid-build and cannot move lenders.')
  })

  it('without doubling up the full stop they typed', () => {
    expect(whyOneLenderSentence(lo('Client cannot move lenders.'), 'St George'))
      .toBe('Client cannot move lenders.')
  })

  it('and a lender nobody named still reads as a sentence', () => {
    expect(whyOneLenderSentence(lo('The clients asked for this lender'), ''))
      .toBe('The clients asked for this lender.')
  })

  it('nothing recorded prints nothing', () => {
    expect(whyOneLenderSentence(lo(), 'St George')).toBe('')
    expect(whyOneLenderSentence(lo('   '), 'St George')).toBe('')
    expect(whyOneLenderSentence(null, 'St George')).toBe('')
  })
})

// THE ONE THING IN THE NOTES THAT STOPS SOMEBODY.
describe('when the lending option cannot go out', () => {
  it('one product and no reason', () => {
    expect(blockedForNoReason(lo(), 1)).toBe(true)
    expect(ASK_FOR_IT).toContain('compliance notes')
  })

  it('one product with a reason goes', () => {
    expect(blockedForNoReason(lo('The clients asked for this lender'), 1)).toBe(false)
  })

  // A DEAL WITH A COMPARISON ON IT HAS NEVER NEEDED THIS AND IS NOT ASKED.
  it('two products never ask', () => {
    expect(blockedForNoReason(lo(), 2)).toBe(false)
    expect(blockedForNoReason(lo(), 3)).toBe(false)
  })

  it('and an empty lending option is not what this is for', () => {
    expect(blockedForNoReason(lo(), 0)).toBe(false)
  })

  it('whyOneLender reads the one key', () => {
    expect(whyOneLender({ oneLenderReason: 'x' })).toBe('x')
    expect(whyOneLender({})).toBe('')
  })
})
