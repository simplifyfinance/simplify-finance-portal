import { describe, it, expect } from 'vitest'
import { buildReferralPartnerEmail } from './referral-partner-email'
import { DEFAULT_BRAND } from './brand'

const ctx = (over: any = {}) => ({
  clientFirstName: 'Michael',
  brokerName: 'Fabio De Castro',
  calendlyUrl: 'https://calendly.com/simplifyfinance/chat',
  ...over,
})

const built = (over: any = {}) => buildReferralPartnerEmail(ctx(over))

// FABIO'S WORDING, WORD FOR WORD.
//
// He pasted this email on 10 Sep 2026 and it goes out as he wrote it. These
// tests exist so that a later tidy-up - a comma, a "we will" for "we'll", a
// bullet reworded to read better - fails the ship instead of quietly going to
// an accountant. If the wording is to change, it changes here first because he
// said so, never because it read oddly to somebody editing nearby.
describe('the words are his', () => {
  const HIS_BULLETS = [
    'Refinancing private lending into longer-term loan structures, including terms of up to 30 years*',
    'Consolidating ATO debt and unsecured liabilities into a structured lending facility',
    'Lending solutions for company and trust structures',
    'Access to selected products with no risk fee*',
    'Access to selected products with no valuation fees*',
    'Reducing repayment pressure',
    'Consolidating multiple liabilities',
    'Creating greater certainty and long-term stability',
    'Establishing a clear pathway beyond short-term lending',
    'A client currently in private lending who needs an exit strategy',
    'A business owner carrying ATO or unsecured debt',
    'A borrower operating through a company or trust structure',
    'A client who no longer meets traditional bank servicing requirements',
    'A self-employed or complex-income borrower who needs greater flexibility',
  ]

  it('carries every bullet exactly as written', () => {
    const html = built().html
    for (const b of HIS_BULLETS) expect(html, b).toContain(b)
  })

  it('carries the sixth bullet, which has an apostrophe in it', () => {
    // "Accountant's Declaration" - written as an entity in the HTML so the
    // curl survives, and as a real character in the plain text.
    expect(built().html).toContain('Alternative Income Verification &mdash; Accountant&rsquo;s Declaration or BAS only')
    expect(built().plainText).toContain('Alternative Income Verification — Accountant’s Declaration or BAS only')
  })

  it('keeps the three headings and the closing line', () => {
    const html = built().html
    expect(html).toContain('Did you know?')
    expect(html).toContain('Why it matters')
    expect(html).toContain('Who should you refer?')
    expect(html).toContain('Have a scenario that needs a different approach?')
    expect(html).toContain('Simplify the debt. Strengthen the structure. Create a pathway forward.')
  })

  it('uses the subject he gave, unchanged', () => {
    expect(built().subject).toBe('Restructure Debt. Restore Control. Build for the Long Term.')
  })
})

// THE READER IS NOT THE BORROWER.
//
// Every other template speaks to the person taking the loan. This one speaks to
// their accountant about them, and the difference is the whole point of the
// template - an email that says "your position" to an accountant has missed.
describe('it is addressed to the referrer, not to a client', () => {
  it('says "your clients", never "your loan" or "your position"', () => {
    const html = built().html
    expect(html).toContain('we help your clients explore structured lending solutions')
    expect(html).not.toMatch(/your (loan|position|repayments|circumstances)/i)
  })

  it('greets the referrer by name', () => {
    expect(built({ clientFirstName: 'Michael' }).html).toContain('Hi Michael,')
  })

  it('has something to say when no name was typed', () => {
    expect(built({ clientFirstName: '   ' }).html).toContain('Hi there,')
  })
})

describe('nothing is invented', () => {
  it('states no rate, no figure and no saving', () => {
    // This email has no numbers in it at all beyond "30 years", which is his.
    const text = built().plainText
    expect(text).not.toMatch(/\$\s?[\d,]/)
    expect(text).not.toMatch(/\b\d+(\.\d+)?\s?%/)
  })

  it('makes no promise the small print does not qualify', () => {
    const html = built().html
    // Every asterisked claim, and the line that explains the asterisk.
    expect(html).toContain('no risk fee*')
    expect(html).toContain('no valuation fees*')
    expect(html).toContain('up to 30 years*')
    expect(html).toContain('*Eligibility, fees, loan terms and product features are subject to lender policy')
  })
})

describe('it survives Outlook', () => {
  it('paints every tinted block with a bgcolor attribute, not only CSS', () => {
    // Word renders a background from the attribute and ignores the CSS. See
    // lib/email-shell.ts and scripts/check-email-html.sh.
    const html = built().html
    const tinted = html.match(/background-color:#F4FAFE/g) || []
    const attrs = html.match(/bgcolor="#F4FAFE"/g) || []
    expect(tinted.length).toBeGreaterThan(0)
    expect(attrs.length).toBe(tinted.length)
  })

  it('sets the bullets as a table rather than a list', () => {
    // A <ul> gets Word's own margins and Word's own glyph.
    expect(built().html).not.toContain('<ul')
    expect(built().html).not.toContain('<li')
  })

  it('leaves no live text pale on dark', () => {
    // The only thing in the charcoal band is the logo, which is artwork.
    expect(built().html).not.toMatch(/background-color:#343333[^>]*>\s*<[^>]*color:#f/i)
  })
})

describe('the sender and the brand', () => {
  it('signs it with the broker chosen on the screen', () => {
    expect(built({ brokerName: 'Kylie Nguyen' }).html).toContain('Kylie Nguyen')
  })

  it('names the brand rather than hard-coding Simplify Finance in the sign-off', () => {
    const other = { ...DEFAULT_BRAND, id: 'other', name: 'Second Brand' }
    expect(built({ brand: other }).html).toContain('Second Brand')
  })

  it('puts the Calendly link on the button', () => {
    expect(built().html).toContain('https://calendly.com/simplifyfinance/chat')
    expect(built().html).toContain('Book a 15-minute chat')
  })

  it('does not produce a broken button when there is no Calendly', () => {
    const html = built({ calendlyUrl: '' }).html
    expect(html).toContain('Book a 15-minute chat')
    expect(html).not.toContain('href=""')
  })
})

describe('the plain text version', () => {
  it('has no markup and no HTML entities left in it', () => {
    const text = built().plainText
    expect(text).not.toMatch(/<[a-z/]/i)
    expect(text).not.toMatch(/&(mdash|rsquo|nbsp|amp);/)
  })

  it('carries the same argument as the HTML', () => {
    const text = built().plainText
    expect(text).toContain('DID YOU KNOW?')
    expect(text).toContain('WHO SHOULD YOU REFER?')
    expect(text).toContain('Simplify the debt. Strengthen the structure. Create a pathway forward.')
    expect(text).toContain('Fabio De Castro')
  })

  it('ends with the small print', () => {
    expect(built().plainText.trim().endsWith(
      '*Eligibility, fees, loan terms and product features are subject to lender policy, ' +
      'assessment criteria and individual borrower circumstances.')).toBe(true)
  })
})
