import { describe, it, expect } from 'vitest'
import { choiceFromLink, lenderOnOffer, lenderToRecord } from './client-lender-choice'
import { ctasLender } from './email-buttons'

// THE CLIENT IS TOLD WHICH BANK THEY ARE AGREEING TO.
//
// Fabio, 18 Oct 2026: "It looks like though that the system is no longer asking
// the client to confirm if they are happy to proceed with the recommended
// lender." It never did - `git log -S clientAgreedLender -- lib/proceed-flow.ts
// app/proceed` is empty. The button said "I am ready to proceed", named
// nothing, and the deal recorded no lender against the answer.
//
// These read the RENDERED buttons rather than the route's source text, for the
// reason written at the top of lib/two-boxes-on-a-refinance.test.ts: a branch
// can contain every string a grep looks for and still put the wrong bank, or no
// bank, in front of a client.

// Sindy's shape: one recommendation, two splits priced the same.
const CLEAR = {
  recommendedOptionId: 'opt-1',
  recommendedLender: 'St George',
  loanAmount: '1,200,000',
  lenders: [
    { id: 'opt-1', lenderName: 'St George', productName: 'Advantage Package',
      lenderSplits: [
        { id: 's1', label: 'Loan 1', amount: '700,000', rate: '6.09', repaymentType: 'IO' },
        { id: 's2', label: 'Loan 2', amount: '500,000', rate: '6.09', repaymentType: 'IO' },
      ] },
    { id: 'opt-2', lenderName: 'Macquarie', productName: 'Basic' },
  ],
}

describe('which button they pressed', () => {
  it('is one of two words we chose, or nothing', () => {
    expect(choiceFromLink('proceed')).toBe('proceed')
    expect(choiceFromLink('talk')).toBe('talk')
    expect(choiceFromLink('PROCEED')).toBe('proceed')
  })

  // The value arrives in a query string, so it is whatever somebody typed.
  // Anything else is not a choice, and is certainly not printed.
  it('is nothing at all when somebody edits the link', () => {
    for (const bad of ['', null, undefined, '1', 'yes', 'Westpac', '<script>', 'proceed; drop']) {
      expect(choiceFromLink(bad)).toBeNull()
    }
  })
})

describe('what the client is looking at when they agree', () => {
  const offer = lenderOnOffer(CLEAR)!

  it('is the bank, the product and the loan amount', () => {
    expect(offer.name).toBe('St George')
    expect(offer.product).toBe('Advantage Package')
    expect(offer.amount).toBe('1,200,000')
  })

  // THE RATE IS NOT HERE ON PURPOSE, though the mock Fabio approved on 19 Oct
  // 2026 carried one.
  //
  // lib/rate-notice-everywhere.test.ts is the list of every surface that quotes
  // a rate to a client, and each one carries the RBA notice. This page NAMES a
  // bank, which is exactly the case that notice exists for - the mechanism is
  // per-bank effective dates. A figure here with no notice, on the page the
  // client agrees on, when the email they pressed to get here carries one, is
  // the inconsistency Fabio asked to end on 30 Sep.
  //
  // The guard would have caught it. This says it out loud so the next person
  // who adds a rate here knows what they are also signing up for.
  it('quotes no rate at all, because this page carries no rate notice', () => {
    expect(Object.keys(offer).sort()).toEqual(['amount', 'name', 'product'])
    expect(JSON.stringify(offer)).not.toMatch(/6\.09|%/)
  })

  // Two options from the same bank and nothing recording which is "we do not
  // know" everywhere else in this portal. It is not going to become a name on
  // the button a client presses to agree to a loan.
  it('is nothing when two options share a bank and no id says which', () => {
    const ambiguous = {
      recommendedLender: 'Bankwest', loanAmount: '800,000',
      lenders: [
        { lenderName: 'Bankwest', productName: 'Simple' },
        { lenderName: 'Bankwest', productName: 'Package' },
      ],
    }
    expect(lenderOnOffer(ambiguous)).toBeNull()
    expect(lenderToRecord(ambiguous)).toBeNull()
  })

  it('is nothing when no lender has been recommended yet', () => {
    expect(lenderOnOffer({ lenders: [] })).toBeNull()
    expect(lenderOnOffer(null)).toBeNull()
  })
})

// What a person reads off the buttons, with the markup taken away.
const readText = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/&rarr;/g, '')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

describe('the buttons at the end of the lending options email', () => {
  const html = ctasLender('https://cal.example/x', 'https://portal.example/proceed/d1?from=LO&choice=proceed',
    'https://portal.example/proceed/d1?from=LO&choice=talk', 'St George')

  it('names the bank on the button, not just in the sentence above it', () => {
    expect(readText(html)).toContain('Proceed with St George')
  })

  it('offers the honest no beside it', () => {
    expect(readText(html)).toContain('I’d rather talk it through first')
  })

  it('sends each button to its own answer', () => {
    expect(html).toContain('choice=proceed')
    expect(html).toContain('choice=talk')
  })

  // Word paints a cell background and ignores one on an inline anchor, which is
  // why these used to arrive as bare blue text in Outlook on Windows. The same
  // rule the single button learned the hard way - see lib/email-buttons.ts.
  it('wears its colour the way Outlook will actually render it', () => {
    expect(html).toMatch(/<td bgcolor="#2DBEFF"/)
    expect(html).toMatch(/<td bgcolor="#E8E1D6"/)
    expect(html).not.toMatch(/rgba\(/)
    // The text colour lives on the anchor, never on the paragraph.
    expect(html).toMatch(/<a href="[^"]*choice=proceed"[^>]*color:#343333/)
  })

  // A button that says something other than what it does is worse than no
  // button - 17 Sep 2026, lib/email-buttons.ts. With no bank to name, the old
  // single button stands rather than one reading "Proceed with ".
  it('falls back to the one unnamed button when there is no bank to name', () => {
    const fallback = ctasLender('https://cal.example/x', 'https://portal.example/p/d1', 'https://portal.example/t/d1', '')
    expect(readText(fallback)).toContain('I am ready to proceed')
    expect(readText(fallback)).not.toContain('Proceed with')
    expect(fallback).not.toContain('choice=talk')
  })

  it('falls back the same way when there is nothing to record a proceed against', () => {
    const none = ctasLender('https://cal.example/x', '', '', 'St George')
    expect(readText(none)).toContain('Book a call with us')
    expect(readText(none)).not.toContain('Proceed with St George')
  })
})
