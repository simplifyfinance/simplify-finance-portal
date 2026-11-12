// THE CLIENT AGREED, AT THE TOP OF A LIVE DEAL.
//
// Invented names and figures throughout.
//
// EVERY TIMESTAMP IS WRITTEN WITHOUT A Z and this file runs under three
// timezones in the ship. A day said back to a broker is a Sydney day; a test
// that only passes in Sydney hides exactly the fault it is meant to catch.
import { describe, it, expect } from 'vitest'
import { agoWords, brokerSubject, clientAgreed } from './the-client-agreed'

const NOW = new Date('2026-11-15T09:00:00+11:00')

const bc = (over: any = {}) => ({
  deal_name: 'Tanner, J & M 2026',
  client_proceeded: true,
  proceeded_at: '2026-11-11T14:30:00+11:00',
  proceeded_source: 'client',
  proceeded_by: null,
  ...over,
})

describe('what it says', () => {
  it('names the day in Sydney and says the client pressed it', () => {
    const a = clientAgreed(bc(), NOW)!
    expect(a.what).toBe('The client agreed to proceed')
    expect(a.day).toBe('Wednesday 11 November')
    expect(a.how).toBe('from their own page')
    expect(a.byClient).toBe(true)
  })

  // "FROM THEIR OWN PAGE" IS THE WHOLE POINT. The office recording it is a
  // different fact and the brokers must be able to tell them apart.
  it('names the person where the office recorded it', () => {
    const a = clientAgreed(bc({ proceeded_source: 'office', proceeded_by: 'Kylie Searle' }), NOW)!
    expect(a.how).toBe('recorded by Kylie Searle')
    expect(a.byClient).toBe(false)
  })

  it('does not pretend to know on a deal from before we tracked it', () => {
    const a = clientAgreed(bc({ proceeded_source: null, proceeded_by: null }), NOW)!
    expect(a.how).toBe('recorded before we started tracking who pressed it')
    expect(a.byClient).toBe(false)
  })

  it('names the bank on a lending options', () => {
    const a = clientAgreed({
      lo_client_proceeded: true,
      lo_proceeded_at: '2026-11-13T10:00:00+11:00',
      lo_proceeded_source: 'client',
      lo_proceeded_lender: 'ANZ',
    }, NOW)!
    expect(a.what).toBe('The client chose ANZ')
    expect(a.stage).toBe('LO')
  })

  it('counts the days in Sydney', () => {
    expect(clientAgreed(bc(), NOW)!.aside).toBe('BC · 4 days ago')
    expect(clientAgreed(bc({ proceeded_at: '2026-11-15T08:00:00+11:00' }), NOW)!.aside)
      .toBe('BC · today')
    expect(clientAgreed(bc({ proceeded_at: '2026-11-14T08:00:00+11:00' }), NOW)!.aside)
      .toBe('BC · yesterday')
  })

  it('says nothing where nothing has been agreed', () => {
    expect(clientAgreed({}, NOW)).toBe(null)
    expect(clientAgreed(null, NOW)).toBe(null)
    // Flagged true with no timestamp is not evidence of anything.
    expect(clientAgreed({ client_proceeded: true }, NOW)).toBe(null)
  })
})

// FABIO, 12 Nov 2026: "when we lodge drop it."
describe('it drops off at lodgement', () => {
  it('is gone the moment the deal lodges', () => {
    expect(clientAgreed(bc({ lodged_at: '2026-11-14T13:00:00+00:00' }), NOW)).toBe(null)
  })

  it('is still there right up until then', () => {
    expect(clientAgreed(bc({ lodged_at: null }), NOW)).not.toBe(null)
    expect(clientAgreed(bc({ lodged_at: '' }), NOW)).not.toBe(null)
  })
})

describe('where both stages have been agreed', () => {
  // A broker opening a deal wants the most recent thing the client did.
  it('shows the later one', () => {
    const both = {
      ...bc(),
      lo_client_proceeded: true,
      lo_proceeded_at: '2026-11-13T10:00:00+11:00',
      lo_proceeded_source: 'client',
      lo_proceeded_lender: 'ANZ',
    }
    expect(clientAgreed(both, NOW)!.stage).toBe('LO')
    expect(clientAgreed(both, NOW)!.what).toBe('The client chose ANZ')
  })

  it('shows the BC where the LO came first somehow', () => {
    const both = {
      ...bc({ proceeded_at: '2026-11-14T10:00:00+11:00' }),
      lo_client_proceeded: true,
      lo_proceeded_at: '2026-11-12T10:00:00+11:00',
      lo_proceeded_source: 'client',
    }
    expect(clientAgreed(both, NOW)!.stage).toBe('BC')
  })
})

describe('the subject line the broker reads', () => {
  // IT USED TO BE THE FILING, NOT THE NEWS: "<deal> has moved to Lending
  // Options", which reads like the office moved it.
  it('leads with what the client did', () => {
    expect(brokerSubject('Tanner, J & M 2026'))
      .toBe('The client agreed to proceed — Tanner, J & M 2026')
    expect(brokerSubject('Tanner, J & M 2026', 'ANZ'))
      .toBe('The client chose ANZ — Tanner, J & M 2026')
  })

  it('never says the deal has moved', () => {
    for (const s of [brokerSubject('X'), brokerSubject('X', 'CBA')]) {
      expect(s).not.toContain('has moved')
      expect(s.startsWith('The client')).toBe(true)
    }
  })

  it('survives a deal with no name', () => {
    expect(brokerSubject('')).toBe('The client agreed to proceed — A deal')
  })
})

describe('ago, in words', () => {
  it('reads as a person would say it', () => {
    expect(agoWords(0)).toBe('today')
    expect(agoWords(1)).toBe('yesterday')
    expect(agoWords(9)).toBe('9 days ago')
    expect(agoWords(null)).toBe('')
  })
})
