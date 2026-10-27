// THE QUESTIONS AS THEY APPEAR IN A CLIENT EMAIL.
//
// Outlook on Windows renders mail through Word. Everything asserted here is a
// rule that was learned by an email arriving unreadable, not a preference.
// Invented wording throughout.
import { describe, it, expect } from 'vitest'
import { stillNeedBlock } from './still-need-block'

const ITEMS = [
  { ask: 'Priya — where did you live before September 2024?',
    help: 'Lenders need three years of address history.', asked: '' },
  { ask: 'What cars do you have?', help: '', asked: 'Asked 14 Oct · 14 days' },
]

const block = (over: any = {}) => stillNeedBlock({
  heading: 'A few things I still need from you',
  lead: 'These take a minute.',
  items: ITEMS,
  url: 'https://portal.example.com/answers/TOK123',
  ...over,
})

describe('nothing to ask', () => {
  it('is NO BLOCK, not an empty one', () => {
    // No heading, no "nothing outstanding". Most clients have already told us
    // everything and should never know this exists.
    expect(stillNeedBlock({ heading: 'x', lead: 'y', items: [] })).toBe('')
  })

  it('and a question with no words in it is not a question', () => {
    expect(stillNeedBlock({ heading: 'x', lead: 'y', items: [{ ask: '   ', help: '', asked: '' }] })).toBe('')
  })
})

describe('it says the thing', () => {
  it('the heading, the lead and every question', () => {
    const h = block()
    expect(h).toContain('A few things I still need from you')
    expect(h).toContain('These take a minute.')
    expect(h).toContain('Priya — where did you live before September 2024?')
    expect(h).toContain('What cars do you have?')
  })

  it('the help line only where there is one', () => {
    expect(block()).toContain('Lenders need three years of address history.')
    expect(block({ items: [{ ask: 'Just this?', help: '', asked: '' }] }))
      .not.toContain('color:#5A5349;')
  })

  it('and the date on a second ask, because a chase has to name the first', () => {
    expect(block()).toContain('Asked 14 Oct · 14 days')
  })

  it('a first ask carries no date at all', () => {
    expect(block({ items: [ITEMS[0]] })).not.toContain('Asked ')
  })
})

describe('the link', () => {
  it('is there when there is one', () => {
    expect(block()).toContain('href="https://portal.example.com/answers/TOK123"')
    expect(block()).toContain('Answer these now')
  })

  it('and the reply sentence stays either way, because some people never press a link', () => {
    expect(block()).toContain('Or just reply to this email')
  })

  it('no link means no button and no promise of one', () => {
    const h = block({ url: '' })
    expect(h).not.toContain('Answer these now')
    expect(h).not.toContain('Or just reply to this email')
    expect(h).toContain('What cars do you have?')
  })
})

describe('it survives Outlook on Windows', () => {
  const h = block()

  it('every background sits on a bgcolor ATTRIBUTE, never on CSS alone', () => {
    // Word paints a background only from the attribute. CSS on a div shows
    // nothing, which is how half a client list got black text on white.
    const withBg = h.match(/<(td|table)[^>]*background:[^>]*>/g) || []
    expect(withBg.length).toBeGreaterThan(0)
    for (const tag of withBg) expect(tag, tag).toContain('bgcolor=')
  })

  it('and never on a div, a paragraph or a link', () => {
    expect(h).not.toMatch(/<(div|p|a|span)[^>]*background/)
  })

  it('every piece of text wears its colour on a SPAN, not on the paragraph', () => {
    // Word keeps a colour on a run and drops one on a paragraph, which is how
    // Kylie's disclaimer arrived black on charcoal.
    expect(h).not.toMatch(/<p style="[^"]*color:/)
    expect(h).toContain('<span style="color:#17140F;">')
  })

  it('THE BUTTON IS PALE WITH DARK TEXT, which looks backwards and is not', () => {
    // A dark cell keeps its background and loses the pale text that made it
    // readable. Dark cells hold artwork only.
    expect(h).toContain('bgcolor="#C9B6F0"')
    expect(h).toContain('color:#2E1C56')
    expect(h).not.toContain('bgcolor="#5B3A9E" align')
  })

  it('the one dark cell in it holds nothing but a spacer', () => {
    const bar = h.slice(h.indexOf('bgcolor="#5B3A9E"'))
    expect(bar.slice(0, bar.indexOf('</td>'))).toContain('&nbsp;')
    expect(bar.slice(0, bar.indexOf('</td>'))).not.toMatch(/>[A-Za-z]/)
  })

  it('no rgba anywhere, because Word has never heard of it', () => {
    expect(h).not.toContain('rgba(')
  })
})

describe('a client who types something strange', () => {
  it('cannot break the email with it', () => {
    const h = block({ items: [{ ask: 'Tom & Jerry <b>?</b>', help: '', asked: '' }] })
    expect(h).toContain('Tom &amp; Jerry &lt;b&gt;?&lt;/b&gt;')
    expect(h).not.toContain('<b>?</b>')
  })

  it('and a question somebody typed cannot carry a link out of the email', () => {
    const h = block({ url: '" onmouseover="x' })
    expect(h).not.toContain('onmouseover="x"')
  })
})
