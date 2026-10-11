// THE BUYERS AGENCY EMAIL IS HIS DOCUMENT, NOT MY VERSION OF IT.
//
// 9 Oct 2026. I rewrote Fabio's wording three times without being asked - I
// changed "Simplify Buyers Agency" to "Simplify BA" because a heading in his
// own document said BA, I put House A before House B, I dropped the Price
// Difference row, and I added a line lifted off simplifyba.com.au that was
// never his. Each time he had to catch it.
//
// Then: "DO NOT CHANGE A SINGLE WORD".
//
// So this file is the document. Every line below was read out of John
// Halliday.docx and is held against the builder, character for character -
// the curly apostrophes, the em dash, the capitals, the two spaces around the
// pipes, and the order. A tidy-up that "fixes" any of it fails the ship.
import { describe, it, expect } from 'vitest'
import {
  buildSimplifyBaEmail, OPENING, DIFFERENCE_HEADING, DIFFERENCE_POINTS, OUTCOME,
  IDENTICAL, TIMING_HEADING, HOUSE_A, HOUSE_B, CLOSING, SUBJECT, DISCLAIMER,
} from './simplify-ba-email'
import { DEFAULT_BRAND } from './brand'

// Straight out of the .docx, pasted. Not imported, not derived - a copy made by
// reading the document, which is the only thing that makes this a test.
const DOC = {
  p1: 'At Simplify Buyers Agency, we believe successful property buying is about more than simply finding a property — it’s about making the right purchase, at the right price, at the right time.',
  p2: 'Leading our Buyers Agency, John Halliday brings more than 35 years of property experience across property investment, consulting and negotiation. His focus is simple: helping our clients buy strategically, avoid costly mistakes and make confident property decisions.',
  p3: 'And the results speak for themselves. John’s client portfolio has grown from $170.1 million in property acquired to a current assessed value of $257.2 million, with properties held for at least 12 months delivering average annualised capital growth of 12.3% p.a.',
  diffHead: 'THE SIMPLIFY BA DIFFERENCE',
  diffLine: 'Industry Knowledge  •  Market Timing  •  Professional Negotiation',
  outcome: '$85,000 BETTER PURCHASE OUTCOME',
  identical: 'IDENTICAL PROPERTIES  |  SAME LOCATION  |  PURCHASED JUST 12 WEEKS APART',
  timing: 'THE DIFFERENCE WAS MORE THAN JUST TIMING',
  c1: 'With two identical properties purchased just 10km from Melbourne CBD, the $85,000 difference demonstrates the value of combining industry knowledge, an understanding of market timing, and professional negotiation.',
  c2: 'Knowing when to buy, what a property is truly worth and how to negotiate effectively can create a significantly better purchase outcome.',
  c3: 'A brand-new investment property delivering a 4.8% rental yield, with the added benefits available through a new-property investment.',
}

const ctx = {
  clientFirstName: 'Dervla', brokerName: 'John Halliday',
  calendlyUrl: 'https://calendly.com/john', brand: DEFAULT_BRAND,
}
const words = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

describe('every paragraph is the document', () => {
  it('the three opening paragraphs, character for character', () => {
    expect(OPENING[0]).toBe(DOC.p1)
    expect(OPENING[1]).toBe(DOC.p2)
    expect(OPENING[2]).toBe(DOC.p3)
  })

  it('the three closing paragraphs, character for character', () => {
    expect(CLOSING[0]).toBe(DOC.c1)
    expect(CLOSING[1]).toBe(DOC.c2)
    expect(CLOSING[2]).toBe(DOC.c3)
  })

  it('the headings, capitals and all', () => {
    expect(DIFFERENCE_HEADING).toBe(DOC.diffHead)
    expect(OUTCOME).toBe(DOC.outcome)
    expect(IDENTICAL).toBe(DOC.identical)
    expect(TIMING_HEADING).toBe(DOC.timing)
  })

  it('the three points, in his order', () => {
    expect(DIFFERENCE_POINTS.join('  •  ')).toBe(DOC.diffLine)
  })
})

describe('the two names are not interchangeable', () => {
  // I "fixed" this twice. The prose says Simplify Buyers Agency; only the
  // heading says BA. That is how he wrote it.
  it('the prose says Simplify Buyers Agency', () => {
    expect(OPENING[0]).toContain('At Simplify Buyers Agency,')
    expect(OPENING[1]).toContain('Leading our Buyers Agency,')
  })

  it('and only the heading says BA', () => {
    expect(DIFFERENCE_HEADING).toContain('SIMPLIFY BA')
    for (const line of [...OPENING, ...CLOSING]) {
      expect(line, `"${line.slice(0, 40)}..." should not abbreviate the name`)
        .not.toMatch(/Simplify BA/)
    }
  })
})

describe('House B comes first', () => {
  // The better outcome is the point of the comparison, so it leads. I had these
  // the wrong way round, which turns the argument into a riddle.
  it('the figures are his', () => {
    expect(HOUSE_B).toEqual({
      name: 'House B', price: '$975,000',
      timing: 'Post Federal Budget announcement', difference: '$85,000 lower',
    })
    expect(HOUSE_A).toEqual({
      name: 'House A', price: '$1,060,000',
      timing: 'Prior to Federal Budget announcement', difference: '—',
    })
  })

  it('and B is drawn before A', () => {
    const html = buildSimplifyBaEmail(ctx).html
    expect(html.indexOf('HOUSE B')).toBeGreaterThan(-1)
    expect(html.indexOf('HOUSE B')).toBeLessThan(html.indexOf('HOUSE A'))
  })

  it('the Price Difference row is not dropped', () => {
    // It was missing from the first three drafts entirely.
    const w = words(buildSimplifyBaEmail(ctx).html)
    expect(w).toContain('$85,000 lower')
  })
})

describe('nothing is added', () => {
  it('no line that is not in the document', () => {
    // "We represent you, not the seller" came off simplifyba.com.au and was
    // never his. Nothing from that site belongs in here.
    const w = words(buildSimplifyBaEmail(ctx).html)
    expect(w).not.toContain('represent you')
    expect(w).not.toContain('Smart Property Investors')
  })

  it('the greeting, the button and the signature are the only additions', () => {
    const out = buildSimplifyBaEmail(ctx)
    expect(out.html).toContain('Hi Dervla,')
    expect(out.html).toContain('Book a 15-minute chat')
    expect(out.html).toContain('John Halliday')
  })
})

describe('the whole document reaches the reader', () => {
  const out = buildSimplifyBaEmail(ctx)
  const w = words(out.html)

  it.each([
    ['opening 1', DOC.p1], ['opening 2', DOC.p2], ['opening 3', DOC.p3],
    ['closing 1', DOC.c1], ['closing 2', DOC.c2], ['closing 3', DOC.c3],
    ['outcome', DOC.outcome], ['timing', DOC.timing],
  ])('%s is in the email', (_label, line) => {
    expect(w).toContain(words(line))
  })

  it('and in the plain text version too', () => {
    for (const line of [DOC.p1, DOC.p2, DOC.p3, DOC.c1, DOC.c2, DOC.c3]) {
      expect(out.plainText).toContain(line)
    }
  })
})

describe('performance claims carry their own caveat', () => {
  it('the disclaimer names past performance, the example and the yield', () => {
    expect(DISCLAIMER).toContain('past performance is not a reliable indicator')
    expect(DISCLAIMER).toContain('a single example')
    expect(DISCLAIMER).toContain('Rental yields vary')
  })

  it('and it is actually printed', () => {
    expect(words(buildSimplifyBaEmail(ctx).html)).toContain('past performance is not a reliable indicator')
  })
})

describe('the subject', () => {
  it('is the one line of this email somebody sees first', () => {
    expect(SUBJECT).toBe('The $85,000 difference between two identical houses')
    expect(buildSimplifyBaEmail(ctx).subject).toBe(SUBJECT)
  })
})

describe('no button without a link', () => {
  it('a broker with no Calendly sends the email without one', () => {
    const out = buildSimplifyBaEmail({ ...ctx, calendlyUrl: '' })
    expect(out.html).not.toContain('Book a 15-minute chat')
    expect(words(out.html)).toContain(words(DOC.c3))
  })
})
