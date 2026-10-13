import { describe, it, expect } from 'vitest'
import {
  tidyLink, whyNotALink, looksLikeALink, kindFromLink, nameFromLink, siteOf,
  isOurOwnSide, pageToText, tooThinToRead, LINK_MAX_BYTES,
  splitIntoTopics, TOPIC_LIMITS, HEADING_MARK,
} from './dropped-links'

const MACQUARIE = 'https://www.macquarie.com.au/assets/bfs/documents/broker/mortgages/macquarie_broker-credit-guidelines.pdf'
const AMP = 'https://distributor.amp.com.au/policies'

describe('tidying what somebody pasted', () => {
  it('trims it', () => {
    expect(tidyLink(`  ${AMP}  `)).toBe(AMP)
  })

  it('takes off the angle brackets Outlook wraps a link in', () => {
    expect(tidyLink(`<${AMP}>`)).toBe(AMP)
  })

  it('and copes with nothing', () => {
    expect(tidyLink('')).toBe('')
    expect(tidyLink(null)).toBe('')
  })
})

describe('what we will and will not fetch', () => {
  it('takes a lender’s PDF and a lender’s page', () => {
    expect(looksLikeALink(MACQUARIE)).toBe(true)
    expect(looksLikeALink(AMP)).toBe(true)
  })

  it('asks for an address when there is nothing there', () => {
    expect(whyNotALink('')).toMatch(/Paste the web address/)
  })

  it('says so in plain words when it is not a web address', () => {
    expect(whyNotALink('macquarie credit policy')).toMatch(/not a web address/)
    expect(whyNotALink('file:///Users/simplifyfinance/Downloads/x.pdf')).toMatch(/starting with https/)
  })

  // THE ONE THAT MATTERS. A drop zone that fetches whatever it is handed will
  // happily fetch our own side of the wall.
  it('refuses an address on our own network', () => {
    for (const bad of [
      'http://localhost:3000/secret',
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/db',
      'http://192.168.1.1/',
      'http://172.16.4.4/',
      'http://db.internal/dump',
      'http://printer.local/',
    ]) {
      expect(whyNotALink(bad), `${bad} was allowed through`).toMatch(/our own network/)
    }
  })

  it('and knows a private host when it sees one', () => {
    expect(isOurOwnSide('localhost')).toBe(true)
    expect(isOurOwnSide('172.20.1.1')).toBe(true)
    expect(isOurOwnSide('172.15.1.1')).toBe(false)
    expect(isOurOwnSide('172.32.1.1')).toBe(false)
    expect(isOurOwnSide('www.macquarie.com.au')).toBe(false)
    expect(isOurOwnSide('')).toBe(true)
  })

  it('refuses a bare word with no website in it', () => {
    expect(whyNotALink('https://intranet/policy')).toMatch(/no website in it/)
  })

  it('and caps what it will pull down', () => {
    expect(LINK_MAX_BYTES).toBe(25 * 1024 * 1024)
  })
})

describe('reading the address', () => {
  it('knows a PDF from a page', () => {
    expect(kindFromLink(MACQUARIE)).toBe('pdf')
    expect(kindFromLink(AMP)).toBe('page')
    expect(kindFromLink('https://x.com.au/a.PDF')).toBe('pdf')
  })

  it('makes a title a person would recognise', () => {
    expect(nameFromLink(MACQUARIE)).toBe('macquarie broker credit guidelines')
    expect(nameFromLink(AMP)).toBe('policies')
    expect(nameFromLink('https://brokers.mystate.com.au/credit-policy/')).toBe('credit policy')
  })

  it('falls back to the site when the address has no path', () => {
    expect(nameFromLink('https://www.bluestone.com.au')).toBe('bluestone.com.au')
    expect(nameFromLink('nonsense')).toBe('')
  })

  it('and names the site, so nobody has to read a URL', () => {
    expect(siteOf(MACQUARIE)).toBe('macquarie.com.au')
    expect(siteOf(AMP)).toBe('distributor.amp.com.au')
    expect(siteOf('nonsense')).toBe('')
  })
})

// A COOKIE BANNER IS TEXT, AND A RULE QUOTED OUT OF ONE IS WORSE THAN NO RULE.
describe('turning a web page into something readable', () => {
  it('throws the furniture away', () => {
    const html = `
      <html><head><style>.a{color:red}</style><script>alert(1)</script></head>
      <body><!-- nav --><nav>Home About</nav>
      <h1>Serviceability</h1>
      <p>The assessment rate is the higher of the two.</p>
      <noscript>Turn on JavaScript</noscript>
      </body></html>`
    const out = pageToText(html)
    expect(out).toContain('Serviceability')
    expect(out).toContain('The assessment rate is the higher of the two.')
    expect(out).not.toContain('alert')
    expect(out).not.toContain('color:red')
    expect(out).not.toContain('Turn on JavaScript')
  })

  it('keeps one line per block so sections stay apart', () => {
    expect(pageToText('<p>One</p><p>Two</p>')).toBe('One\nTwo')
    expect(pageToText('<li>A</li><li>B</li>')).toBe('A\nB')
  })

  it('puts the ampersands back', () => {
    expect(pageToText('<p>Fees &amp; charges &gt; 2%</p>')).toBe('Fees & charges > 2%')
  })

  it('and copes with nothing at all', () => {
    expect(pageToText('')).toBe('')
    expect(pageToText(null)).toBe('')
  })
})

describe('an error page is not a credit policy', () => {
  it('calls a short page too thin to read', () => {
    expect(tooThinToRead('Page not found')).toBe(true)
    expect(tooThinToRead('')).toBe(true)
  })

  it('and lets a real one through', () => {
    expect(tooThinToRead('x'.repeat(401))).toBe(false)
  })
})


// ONE TOPIC AT A TIME.
//
// 13 Oct 2026. AMP's policy library is one page of 124,000 characters. Handed
// to the reader whole it does not fail loudly - the answer comes back cut in
// half, nothing parses, and the library reports zero rules with no reason.
// This is the half that stops that happening.
describe('cutting a page into its own topics', () => {
  const page = (...sections: [string, number][]) =>
    pageToText(sections.map(([h, n]) => `<h2>${h}</h2><p>${'word '.repeat(n)}</p>`).join(''))

  it('marks a heading on the way through, and never leaves the mark behind', () => {
    const text = pageToText('<h2>Serviceability</h2><p>The assessment rate applies.</p>')
    expect(text).toContain(HEADING_MARK)
    for (const t of splitIntoTopics(text)) {
      expect(t.name).not.toContain(HEADING_MARK)
      expect(t.text).not.toContain(HEADING_MARK)
    }
  })

  it('gives each topic the lender\u2019s own heading as its name', () => {
    const got = splitIntoTopics(page(['Serviceability', 200], ['High density apartments', 200]))
    expect(got.map(t => t.name)).toEqual(['Serviceability', 'High density apartments'])
  })

  it('keeps the heading at the top of its own topic, so the reader has context', () => {
    const got = splitIntoTopics(page(['Monthly living expenses', 200]))
    expect(got[0].text.startsWith('Monthly living expenses')).toBe(true)
  })

  // A NAVIGATION MENU IS THIRTY HEADINGS WITH A LINE EACH, not thirty topics.
  it('joins a heading with almost nothing under it onto the one before', () => {
    const got = splitIntoTopics(page(['Serviceability', 200], ['See also', 2]))
    expect(got.length).toBe(1)
    expect(got[0].name).toBe('Serviceability')
    expect(got[0].text).toContain('See also')
  })

  it('cuts a topic that is too big on its own, rather than sending it whole', () => {
    const huge = page(['Security', 8000])
    const got = splitIntoTopics(huge)
    expect(got.length).toBeGreaterThan(1)
    for (const t of got) expect(t.text.length).toBeLessThanOrEqual(TOPIC_LIMITS.maxChars)
    expect(got.map(t => t.name)).toEqual(got.map((_, i) => `Security (${i + 1})`))
  })

  // THE REASON FOR CUTTING HAS NOTHING TO DO WITH WHETHER THE LENDER USED AN H2.
  it('cuts a page with no headings at all into even pieces', () => {
    const flat = 'A line of policy.\n'.repeat(4000)
    const got = splitIntoTopics(flat, 'credit policy')
    expect(got.length).toBeGreaterThan(1)
    for (const t of got) expect(t.text.length).toBeLessThanOrEqual(TOPIC_LIMITS.maxChars)
    expect(got[0].name).toBe('credit policy (1)')
  })

  it('leaves a small page as one topic', () => {
    const got = splitIntoTopics(pageToText('<p>A short policy page about nothing much at all.</p>'), 'policies')
    expect(got.length).toBe(1)
    expect(got[0].name).toBe('policies')
  })

  // LOSING THE END OF A CREDIT POLICY IS WORSE THAN A LONG WAIT.
  it('joins the tail up rather than dropping it past the cap', () => {
    const many: [string, number][] = []
    for (let i = 0; i < TOPIC_LIMITS.maxParts + 20; i++) many.push([`Topic ${i}`, 200])
    const got = splitIntoTopics(page(...many))
    expect(got.length).toBe(TOPIC_LIMITS.maxParts)
    expect(got[got.length - 1].name).toBe('The rest of the page')
    expect(got[got.length - 1].text).toContain(`Topic ${TOPIC_LIMITS.maxParts + 19}`)
  })

  it('and copes with nothing', () => {
    expect(splitIntoTopics('')).toEqual([])
    expect(splitIntoTopics(null)).toEqual([])
  })

  // THE WHOLE POINT, SAID AS A NUMBER. AMP is 124,000 characters; the reader
  // can answer comfortably at 18,000 a go.
  it('would cut a page the size of AMP\u2019s into readable pieces', () => {
    const amp = 'Policy sentence that says something about lending.\n'.repeat(2500)
    expect(amp.length).toBeGreaterThan(120_000)
    const got = splitIntoTopics(amp, 'policies')
    expect(got.length).toBeGreaterThan(6)
    for (const t of got) expect(t.text.length).toBeLessThanOrEqual(TOPIC_LIMITS.maxChars)
  })
})
