import { describe, it, expect } from 'vitest'
import { reviewEmailHtml, reviewEmailSubject, DEFAULT_COPY } from './portfolio-review-email'

// FABIO'S OPPORTUNITY EMAIL, BUILT FROM A REVIEW.
//
// 19 Oct 2026. He has been sending this by hand for years. It went through four
// drafts in one sitting and the figures are the part nobody is allowed to get
// wrong, so these read the RENDERED HTML rather than the source - the lesson
// from lib/two-boxes-on-a-refinance.test.ts.
//
// The worked example is his own: 520 + 28 = 548, less 385 = 163, and
// 130 + 33 = 163.
const RUTH = {
  greeting: 'Ruth',
  equityAddress: '52 Donnelly Ave, Coorparoo QLD',
  purchasePrice: '520,000',
  stampDuty: '28,000',
  loanAmount: '385,000',
  loanNote: 'your maximum borrowing capacity with non-bank lender',
  equityRelease: '130,000',
  savings: '33,000',
  brokerName: 'Fabio De Castro',
  brokerTitle: 'Director, Simplify Finance',
  calendlyUrl: 'https://cal.example/fabio',
}

// What a person reads off the page, with the markup taken away.
const read = (html: string): string[] =>
  html.replace(/<\/p>/g, '\n').replace(/<\/tr>/g, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&bull;/g, '•').replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&#10071;/g, '!')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

describe('the numbers block', () => {
  const lines = read(reviewEmailHtml(RUTH))
  const at = (needle: string) => lines.find(l => l.startsWith(needle)) || ''

  // Fabio, 19 Oct 2026: "why are you changing the purchase number need the same
  // way". A plain line with the bracket inline, as he writes it by hand.
  it('is his five lines, word for word', () => {
    expect(at('Purchase Price')).toBe('Purchase Price: $520,000')
    expect(at('Stamp Duty')).toBe('Stamp Duty: $28,000')
    expect(at('Total Cost')).toBe('Total Cost: $548,000 (plus solicitor’s fees and incidentals)')
    expect(at('Loan Amount')).toBe('Loan Amount: $385,000 (your maximum borrowing capacity with non-bank lender)')
    expect(at('Deposit Needed')).toBe(
      'Deposit Needed: $163,000 (coming from equity release of $130,000 and personal savings of $33,000) '
      + 'plus solicitor’s fees and incidentals')
  })

  // THE TWO FIGURES NOBODY TYPES. Everything else on the screen is entered; the
  // total and the deposit are worked out, and they are the two that would be
  // wrong at midnight.
  it('works out the total and the deposit rather than being told them', () => {
    const lines2 = read(reviewEmailHtml({ ...RUTH, purchasePrice: '700,000', stampDuty: '35,500', loanAmount: '500,000' }))
    expect(lines2.find(l => l.startsWith('Total Cost'))).toContain('$735,500')
    expect(lines2.find(l => l.startsWith('Deposit Needed'))).toContain('$235,500')
  })

  // THE DEPOSIT IN THE HEADLINE IS THEIR OWN MONEY.
  //
  // The equity is not cash out of their pocket, which is the entire point the
  // sentence is making. Naming the full $163,000 there would undo the email.
  it('names the savings in the headline, not the whole deposit', () => {
    const headline = lines.find(l => l.includes('with only a')) || ''
    expect(headline).toContain('with only a $33,000 deposit')
    expect(headline).not.toContain('$163,000')
  })
})

describe('the buffer', () => {
  // "We structure a little extra equity as a cash-flow buffer" is a promise the
  // email makes further down. A client who reads that and then finds the equity
  // release exactly equals the deposit has been told two things that disagree.
  it('is named as its own line when there is one', () => {
    const lines = read(reviewEmailHtml({ ...RUTH, buffer: '20,000' }))
    expect(lines.find(l => l.startsWith('Cash-flow buffer')))
      .toBe('Cash-flow buffer: $20,000 (extra equity released and set aside, not spent at settlement)')
  })

  it('says nothing at all when there is none', () => {
    const lines = read(reviewEmailHtml(RUTH))
    expect(lines.some(l => l.startsWith('Cash-flow buffer'))).toBe(false)
  })

  // money(0) returns "$0", which is truthy and reads as a fact. A buffer of
  // nothing is not a buffer.
  it('says nothing for a zero', () => {
    const lines = read(reviewEmailHtml({ ...RUTH, buffer: '0' }))
    expect(lines.some(l => l.startsWith('Cash-flow buffer'))).toBe(false)
  })
})

describe('the negative gearing section', () => {
  const lines = read(reviewEmailHtml(RUTH))

  // Fabio, 19 Oct 2026: "dont say rules dont start until 2027 its oncufsing as
  // all properties from now on (exept brand new) are under the new rule."
  //
  // The section says what happens to the LOSSES, not when the rules start. No
  // date is quoted in it, and this is the test that keeps one out.
  it('quotes no date, because a date reads as you have time', () => {
    const start = lines.findIndex(l => l.includes('WHAT ABOUT NEGATIVE GEARING'))
    const end = lines.findIndex(l => l.includes('BUILD YOUR STRATEGY'))
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const section = lines.slice(start, end).join(' ')
    expect(section).not.toMatch(/2026|2027|July|May|Budget/)
  })

  it('says the losses are quarantined and carried forward, and what they can be used against', () => {
    const all = lines.join(' ')
    expect(all).toContain('quarantined and carried forward')
    expect(all).toContain('rental income from your other properties')
    expect(all).toContain('any future capital gain when you sell a rental property')
  })
})

describe('what this email is not allowed to carry', () => {
  const html = reviewEmailHtml(RUTH)

  // Every surface in this portal that quotes a rate to a client carries the RBA
  // notice - see lib/rate-notice-everywhere.test.ts. This one names no lender
  // and quotes no rate, which is why it needs none.
  it('quotes no interest rate anywhere', () => {
    expect(html).not.toMatch(/\d+\.\d+%\s*p\.a\./i)
    expect(read(html).join(' ')).not.toMatch(/interest rate of|% p\.a\./i)
  })

  // Outlook on Windows renders through Word, which paints a background only
  // from a bgcolor attribute and understands no rgba at all.
  it('wears its colour the way Outlook will render it', () => {
    expect(html).not.toMatch(/rgba\(/)
    expect(html).toMatch(/<td bgcolor="#2DBEFF"/)
    expect(html).not.toMatch(/display:\s*flex/)
    expect(html).not.toMatch(/display:\s*grid/)
  })

  it('draws no button at all when there is no link to put on it', () => {
    const none = reviewEmailHtml({ ...RUTH, calendlyUrl: '' })
    expect(read(none).join(' ')).not.toContain(DEFAULT_COPY.ctaLabel)
  })
})

describe('the words can be changed without a ship', () => {
  it('takes every editable paragraph from the copy it is given', () => {
    const html = reviewEmailHtml({ ...RUTH, copy: { opening: 'Something else entirely.' } })
    const all = read(html).join(' ')
    expect(all).toContain('Something else entirely.')
    expect(all).not.toContain(DEFAULT_COPY.opening)
    // And the rest still stands - one changed paragraph is not a rewrite.
    expect(all).toContain(DEFAULT_COPY.standAlone)
  })

  // A FIGURE IS NEVER IN THE EDITABLE TEXT. No amount of rewriting can put a
  // wrong dollar figure in front of a client.
  it('holds no dollar figure in any default paragraph', () => {
    for (const [k, v] of Object.entries(DEFAULT_COPY)) {
      const text = Array.isArray(v) ? v.join(' ') : String(v)
      expect(text, `${k} has a figure in it`).not.toMatch(/\$\s?[\d,]/)
    }
  })

  it('escapes whatever somebody types into the settings box', () => {
    const html = reviewEmailHtml({ ...RUTH, copy: { opening: '<script>alert(1)</script>' } })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('the subject line', () => {
  it('is his', () => {
    expect(reviewEmailSubject()).toBe('Simplify Finance — New Opportunity Identified!')
  })
})
