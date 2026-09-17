import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { ctas } from './email-buttons'

// CAN A CLIENT ACTUALLY SAY YES, AND DOES IT REACH US?
//
// Fabio, 17 Sep 2026: "I want an audit to ensure if a client clicks it does show
// on the portal."
//
// It does - the button opens the client's own page, and pressing it there
// records the proceed against the deal with 'client' as the source, so the card
// says "client pressed Proceed" rather than crediting one of us.
//
// What the audit found was the other half: with no proceed link the button still
// SAID "I am ready to proceed" and quietly pointed at the booking page. A client
// would press it believing they had said yes, book a call, and nothing would
// reach the deal.

const CAL = 'https://calendly.com/simplify/chat'
const PROCEED = 'https://simplify-finance-portal.vercel.app/proceed/deal-1?from=BC'

describe('with a proceed link', () => {
  const html = ctas(CAL, PROCEED)

  it('the button goes to the proceed page, not the calendar', () => {
    const btn = html.match(/<a href="([^"]+)"[^>]*>I am ready to proceed/)
    expect(btn, 'the proceed button has gone').toBeTruthy()
    expect(btn![1]).toBe(PROCEED)
  })

  it('booking a call is still offered underneath', () => {
    expect(html).toContain('Or book a call with us')
    expect(html).toContain(CAL)
  })
})

describe('with no proceed link', () => {
  const html = ctas(CAL)

  it('NEVER says "I am ready to proceed" over a link to the calendar', () => {
    expect(html, 'the button claims a proceed and books a meeting instead')
      .not.toMatch(/I am ready to proceed/)
  })

  it('asks them to book a call, which is what the button actually does', () => {
    expect(html).toMatch(/Book a call with us/)
    expect(html).toContain(CAL)
  })

  it('is the same for an empty string as for nothing at all', () => {
    expect(ctas(CAL, '')).toBe(html)
    expect(ctas(CAL, '   ')).toBe(html)
  })
})

describe('every client email passes the link', () => {
  // The scenarios are written out one by one in the generators, so a new one
  // added without the link would send a button that cannot record anything.
  for (const f of ['app/api/generate-email/route.ts', 'app/api/generate-lo-email/route.ts']) {
    it(`${f} never calls ctas without a proceed link`, () => {
      const src = readFileSync(f, 'utf8')
      const calls = src.split('\n').filter(l => /[^a-z]ctas\(/.test(l))
      expect(calls.length, `${f}: no ctas() calls found - has it been renamed?`).toBeGreaterThan(0)
      const bare = calls.filter(l => !/proceedUrl|\/proceed\//.test(l))
      expect(bare, `${f}: a client email sends the button with no proceed link, so a `
        + 'client pressing it would book a call and the deal would never hear about it')
        .toEqual([])
    })
  }
})
