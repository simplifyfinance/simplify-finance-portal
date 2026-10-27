// THE EMAIL THAT WENT OUT, AS WORDING.
//
// 29 Oct 2026. Fabio, on recording what we send a client: "is there a way to
// make the HTML just wording, structured word, so it doesn't look like a mess
// on the file notes?"
//
// EVERY FIXTURE HERE IS BUILT WITH THE REAL FUNCTIONS. card() and row() are the
// same ones both email routes use, so a change to the markup for Outlook's sake
// shows up here as a change to the text rather than as silence. A test holding
// its own hand-typed copy of that markup would pass forever while the real
// thing drifted.
import { describe, it, expect } from 'vitest'
import { emailAsText, sentEmailAsText } from './email-as-text'
import { card, row } from './email-card'
import { stillNeedBlock } from './still-need-block'

const AT = new Date('2026-10-14T11:31:00+11:00')

describe('a cream card becomes a heading and a column of figures', () => {
  const html = card('What you can borrow',
    row('Maximum loan', '$842,000') + row('Estimated repayment', '$4,980 / month'))
  const text = emailAsText(html)

  it('the title is the heading', () => {
    expect(text.split('\n')[0]).toBe('WHAT YOU CAN BORROW')
  })

  it('and every row is a label and a figure, lined up', () => {
    expect(text).toContain('  Maximum loan              $842,000')
    expect(text).toContain('  Estimated repayment       $4,980 / month')
  })

  it('with no markup left in it at all', () => {
    expect(text).not.toContain('<')
    expect(text).not.toContain('style=')
    expect(text).not.toContain('bgcolor')
  })

  it('AND IT IS A FRACTION OF THE SIZE', () => {
    // This is the whole reason it is text. Thirty times is the claim; the real
    // emails are bigger than this fixture, so this is the pessimistic case.
    expect(text.length * 4).toBeLessThan(html.length)
  })
})

describe('the questions block', () => {
  const html = stillNeedBlock({
    heading: 'A few things I still need from you',
    lead: 'These take a minute and you can answer straight back to this email.',
    items: [
      { ask: 'Priya — where did you live before September 2024?',
        help: 'Lenders need three years of address history.', asked: '' },
      { ask: 'Your cars — make, model, year and value', help: '', asked: 'Asked 14 Oct · 14 days' },
    ],
    url: 'https://portal.example.com/answers/TOK123',
  })
  const text = emailAsText(html)

  it('keeps every question the client was asked', () => {
    expect(text).toContain('Priya — where did you live before September 2024?')
    expect(text).toContain('Your cars — make, model, year and value')
  })

  it('and the date on a second ask', () => {
    expect(text).toContain('Asked 14 Oct · 14 days')
  })

  it('the heading is a heading', () => {
    expect(text).toContain('A FEW THINGS I STILL NEED FROM YOU')
  })

  it('and the link is not pasted into the file note as a wall of characters', () => {
    // A signed token is two hundred characters of nothing a person can read.
    expect(text).not.toContain('TOK123')
    expect(text).toContain('Answer these now')
  })
})

describe('what it refuses to do', () => {
  it('nothing in, nothing out', () => {
    expect(emailAsText('')).toBe('')
    expect(emailAsText(null)).toBe('')
    expect(emailAsText(undefined)).toBe('')
  })

  it('a style block never reaches the file note', () => {
    expect(emailAsText('<style>p{color:red}</style><p>Hello</p>')).toBe('Hello')
  })

  it('and neither does a comment', () => {
    expect(emailAsText('<!--BROKER-BOX--><p>Hello</p>')).toBe('Hello')
  })

  it('entities come out as the characters a person reads', () => {
    expect(emailAsText('<p>Tom &amp; Jerry &mdash; 50&nbsp;per cent</p>'))
      .toBe('Tom & Jerry — 50 per cent')
  })

  it('it never runs two paragraphs into one line', () => {
    expect(emailAsText('<p>First.</p><p>Second.</p>')).toBe('First.\nSecond.')
  })

  it('and never leaves a page of blank lines', () => {
    expect(emailAsText('<p>One</p><div></div><div></div><div></div><p>Two</p>'))
      .not.toMatch(/\n\n\n/)
  })

  it('a sentence somebody put in a table is a sentence, not a column', () => {
    // Only two-cell rows are figures. One cell is prose and stays prose.
    expect(emailAsText('<table><tr><td>Please let us know which lender.</td></tr></table>'))
      .toBe('Please let us know which lender.')
  })
})

describe('the header that makes it a record', () => {
  const text = sentEmailAsText({
    what: 'Borrowing capacity sent',
    subject: 'Your Borrowing Capacity',
    to: ['priya@example.com', 'daniel@example.com'],
    bcc: 'PMRHEZLG0000000000000000000000000000@sfg.email.v2.salestrekker.com',
    by: 'Mark Gallo',
    brand: 'Simplify Finance',
    at: AT,
    html: card('What you can borrow', row('Maximum loan', '$842,000')),
  })

  it('says what it was, when, and who sent it', () => {
    expect(text.split('\n')[0]).toBe('BORROWING CAPACITY SENT')
    expect(text).toContain('Mark Gallo')
    expect(text).toContain('Simplify Finance')
    expect(text).toContain('14 Oct 2026')
  })

  it('and who it went to', () => {
    expect(text).toContain('To   priya@example.com, daniel@example.com')
  })

  it('THE SALESTREKKER ADDRESS IS NAMED, NOT PRINTED', () => {
    // Seventy characters of code that is the same on every line and that nobody
    // can read. The fact that it was BCC'd is the part worth recording.
    expect(text).toContain('BCC  SalesTrekker')
    expect(text).not.toContain('sfg.email.v2.salestrekker.com')
  })

  it('no BCC means the line is not there, rather than an empty one', () => {
    expect(sentEmailAsText({ what: 'x', to: 'a@b.com', at: AT })).not.toContain('BCC')
  })

  it('and the figures the client was told are in it', () => {
    expect(text).toContain('$842,000')
  })

  it('an email with no body is still a record of having been sent', () => {
    const bare = sentEmailAsText({ what: 'Pre-approval sent', to: 'a@b.com', by: 'Mark', at: AT })
    expect(bare).toContain('PRE-APPROVAL SENT')
    expect(bare).toContain('To   a@b.com')
  })
})
