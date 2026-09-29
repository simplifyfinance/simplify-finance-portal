// WHO ELSE IS ON A PURCHASE.
//
// Fabio, 29 Sep 2026, reading a draft of the formal approval email: "we should
// have a spot do solictors details so they also recieve apporval??? when it is
// a purchase".
//
// The draft said "we have let your solicitor and your buyers agent know". The
// portal had nowhere to record a solicitor, so nothing could have told anyone.
// These tests are all one rule: the email never says somebody was told unless
// that somebody is on the copy line of the email doing the telling.

import { describe, it, expect } from 'vitest'
import {
  solicitorOf, buyersAgentOf, otherSide, copyTheseIn, otherSideGaps,
  toldTheOtherSide, looksLikeEmail,
} from './other-side'

const BOTH = {
  solicitor_name: 'Rebecca Toh, Toh & Associates',
  solicitor_email: 'rebecca@tohlegal.com.au',
  buyers_agent_name: 'Marcus Reid, Reid Buyers Agency',
  buyers_agent_email: 'marcus@reidba.com.au',
}

describe('nobody recorded is not a gap', () => {
  it('a purchase with neither says nothing at all', () => {
    expect(otherSide({})).toEqual([])
    expect(copyTheseIn({})).toEqual([])
    expect(otherSideGaps({})).toEqual([])
    expect(toldTheOtherSide({})).toBe('')
  })

  it('a solicitor but no buyers agent is normal, not missing', () => {
    const d = { solicitor_name: 'Rebecca Toh', solicitor_email: 'rebecca@tohlegal.com.au' }
    expect(buyersAgentOf(d)).toBeNull()
    expect(otherSideGaps(d)).toEqual([])
    expect(toldTheOtherSide(d)).toBe('We have copied your solicitor in on this email, so they have the approval too.')
  })
})

describe('a name we cannot reach', () => {
  // The case that matters. It LOOKS like we know them, so the sentence would
  // have gone out while the copy line stayed empty.
  it('is not copied in, and is not mentioned', () => {
    const d = { solicitor_name: 'Rebecca Toh' }
    expect(solicitorOf(d)!.reachable).toBe(false)
    expect(copyTheseIn(d)).toEqual([])
    expect(toldTheOtherSide(d)).toBe('')
  })

  it('is said out loud, before anybody presses send', () => {
    expect(otherSideGaps({ solicitor_name: 'Rebecca Toh' }))
      .toEqual(['Solicitor Rebecca Toh has no email address recorded — they will not be copied in'])
  })

  it('catches a phone number typed into the email box', () => {
    const d = { buyers_agent_name: 'Marcus Reid', buyers_agent_email: '0412 555 901' }
    expect(copyTheseIn(d)).toEqual([])
    expect(otherSideGaps(d)[0]).toContain('is not an email address')
  })

  it('knows an address from something that is not one', () => {
    expect(looksLikeEmail('rebecca@tohlegal.com.au')).toBe(true)
    expect(looksLikeEmail('rebecca at tohlegal')).toBe(false)
    expect(looksLikeEmail('rebecca@tohlegal')).toBe(false)
    expect(looksLikeEmail('')).toBe(false)
    expect(looksLikeEmail(null)).toBe(false)
  })
})

describe('both of them', () => {
  it('go on the copy line', () => {
    expect(copyTheseIn(BOTH).map(p => p.email))
      .toEqual(['rebecca@tohlegal.com.au', 'marcus@reidba.com.au'])
  })

  it('are named in one sentence, in order', () => {
    expect(toldTheOtherSide(BOTH))
      .toBe('We have copied your solicitor and your buyers agent in on this email, so they have the approval too.')
  })

  it('the sentence shrinks to match who is actually reachable', () => {
    // The buyers agent drops off. The sentence must drop with them rather than
    // keep claiming both.
    const one = { ...BOTH, buyers_agent_email: '' }
    expect(toldTheOtherSide(one)).toBe('We have copied your solicitor in on this email, so they have the approval too.')
    expect(otherSideGaps(one)).toHaveLength(1)
  })
})

describe('the rule, stated as a test', () => {
  it('everybody in the sentence is on the copy line, always', () => {
    const cases: any[] = [
      {}, BOTH,
      { solicitor_name: 'A' },
      { solicitor_email: 'a@b.com' },
      { ...BOTH, solicitor_email: 'rubbish' },
      { buyers_agent_name: 'M', buyers_agent_email: 'm@r.com' },
    ]
    for (const d of cases) {
      const sentence = toldTheOtherSide(d)
      const copied = copyTheseIn(d)
      if (copied.length === 0) {
        expect(sentence).toBe('')
      } else {
        for (const p of copied) expect(sentence).toContain(p.who)
        // And nobody in the sentence who is not being copied.
        const notCopied = otherSide(d).filter(p => !p.reachable)
        for (const p of notCopied) expect(sentence).not.toContain(p.who)
      }
    }
  })
})
