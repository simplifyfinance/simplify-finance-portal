// The box that comes back once the valuation has gone. 17 Aug 2026.
import { describe, it, expect } from 'vitest'
import { sentSummary, sentNote, valueWords, sentAtWords } from './valuation-sent'

const DEAL: any = {
  id: '5b3163bc-90bd-447c-b620-8b68c2d01622',
  bc_data: { template: 'refinance_equity', dutyState: 'VIC' },
  fact_find_data: { applicants: [{ firstName: 'Mai', lastName: 'Chen' }] },
}
const SECURITY = {
  id: 'p-kalinga',
  address: '13 Kalinga Road, Ocean Grove VIC 3226',
  use: 'Owner occupied',
  value: '1,200,000',
  limit: '960,000',
}
const ANSWERS: any = { lenders: ['ANZ', 'Bankwest'], propertyType: 'House', accessType: 'Owner' }
const KATIE = { name: 'Katie Nguyen', email: 'katie@simplifyfinance.com.au' }
const FABIO = { name: 'Fabio De Castro', email: 'fabio@simplifyfinance.com.au' }

describe('the figures in the box', () => {
  const s = sentSummary(DEAL, SECURITY, ANSWERS, KATIE, FABIO)

  it('says which kind of valuation amount it is', () => {
    expect(s.valueLine).toBe('$1,200,000 — customer estimate')
  })

  // CoreLogic is told which, and the two produce different answers. The
  // purpose is the security's, not the template's - a deal that refinances two
  // houses and buys a third has both on it. See loanPurposeOf().
  it('calls it a contract price on the house being bought', () => {
    const buying = { ...SECURITY, id: 'BEING_PURCHASED' }
    expect(sentSummary(DEAL, buying, ANSWERS, KATIE, FABIO).valueLine)
      .toBe('$1,200,000 — contract price')
    expect(valueWords('PURCHASE')).toBe('contract price')
    expect(valueWords('REFINANCE')).toBe('customer estimate')
  })

  it('carries the loan amount and the LVR', () => {
    expect(s.loanAmount).toBe('$960,000')
    expect(s.lvr).toBe('80%')
  })

  it('names the banks', () => {
    expect(s.lenders).toEqual(['ANZ', 'Bankwest'])
  })

  // Two people, two lines. Credit order under a broker's CoreLogic login.
  it('keeps ordered-for and sent-by apart', () => {
    expect(s.brokerName).toBe('Fabio De Castro')
    expect(s.sentByName).toBe('Katie Nguyen')
  })

  it('copies the broker, and never the sender twice', () => {
    expect(s.copiedTo).toEqual(['fabio@simplifyfinance.com.au'])
    // Fabio ordering his own deal is copied to nobody - he is the requester.
    expect(sentSummary(DEAL, SECURITY, ANSWERS, FABIO, FABIO).copiedTo).toEqual([])
  })

  it('carries the reference, the same one a re-order would get', () => {
    expect(s.ref).toMatch(/^SF-\d{5}$/)
    expect(sentSummary(DEAL, SECURITY, ANSWERS, KATIE, FABIO).ref).toBe(s.ref)
  })
})

describe('the rows the box draws', () => {
  const s = sentSummary(DEAL, SECURITY, ANSWERS, KATIE, FABIO)

  it('is in the order the mock shows', () => {
    expect(s.rows.map(r => r.label)).toEqual([
      'Property', 'Valuation amount', 'Loan amount', 'Expected LVR',
      'Banks', 'Ordered for', 'Sent by', 'Copied to', 'Reference',
    ])
  })

  // A blank beside a label reads as a figure of zero.
  it('leaves out a row with nothing in it rather than drawing it empty', () => {
    const bare = sentSummary(DEAL, { ...SECURITY, limit: '' }, ANSWERS, KATIE, FABIO)
    expect(bare.rows.map(r => r.label)).not.toContain('Loan amount')
    expect(bare.rows.map(r => r.label)).not.toContain('Expected LVR')
    expect(bare.rows.map(r => r.label)).toContain('Valuation amount')
  })

  it('still says what kind it is when no value is recorded', () => {
    const none = sentSummary(DEAL, { ...SECURITY, value: '' }, ANSWERS, KATIE, FABIO)
    expect(none.valueLine).toBe('Not recorded — customer estimate')
  })
})

describe('the line on the file', () => {
  it('has the numbers in it', () => {
    const s = sentSummary(DEAL, SECURITY, ANSWERS, KATIE, FABIO)
    expect(sentNote(s)).toBe(
      'Valuation ordered, ANZ and Bankwest. 13 Kalinga Road, Ocean Grove VIC 3226. '
      + '$1,200,000 — customer estimate, 80% LVR. For Fabio De Castro. Ref ' + s.ref + '.')
  })

  it('says so rather than inventing a bank', () => {
    const s = sentSummary(DEAL, SECURITY, { ...ANSWERS, lenders: [] }, KATIE, FABIO)
    expect(sentNote(s)).toContain('no lender named')
  })

  it('does not throw on a deal with almost nothing on it', () => {
    const s = sentSummary({}, { id: 'x' }, { lenders: [] } as any, {}, undefined)
    expect(() => sentNote(s)).not.toThrow()
    expect(s.rows.length).toBeGreaterThan(0)
  })
})

describe('when it went', () => {
  it('reads in Sydney time', () => {
    expect(sentAtWords('2026-08-17T04:14:00Z')).toBe('2:14pm')
  })

  it('says nothing rather than Invalid Date', () => {
    expect(sentAtWords('not a date')).toBe('')
    expect(sentAtWords(null)).toBe('')
  })
})
