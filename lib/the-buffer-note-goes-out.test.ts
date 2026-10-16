import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { TEMPLATE_LABELS } from './templates'
import { hasBufferNote, bufferNoteBlock, BUFFERED_TEMPLATES, BUFFER_TEXT } from './buffer-note'

// A PARAGRAPH STOPPED GOING OUT AND NOTHING SAID SO.
//
// 12 Oct 2026. Fabio: "I had a setence like this We've included a small buffer
// in your loan amount ... when we did refinance loans ... why did that disaper
// form email templates".
//
// It had not disappeared. It was in the code, word for word, switched off by
// one condition - the lending options email template is not "LO Purchase". When
// a refinance got stuck on the purchase template, and they were (see
// lib/lo-template.ts), the paragraph went quiet. Nothing prints to say a
// paragraph was left out, which is why it took weeks to notice.
//
// Fabio: "lets make sure this doesnt happen again where we work on somthing and
// it doesnt ship". So this file is the watchman. It is the same shape as
// lib/rate-notice-everywhere.test.ts, which does the same job for the RBA
// notice: walk every scenario, and fail the ship if one that should carry the
// paragraph has lost it.
const BC_ROUTE = readFileSync('app/api/generate-email/route.ts', 'utf8')
const LO_ROUTE = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')

// The branch of the borrowing capacity email that builds one scenario.
function branchFor(template: string): string {
  const start = BC_ROUTE.indexOf(`template === '${template}'`)
  if (start === -1) return ''
  const next = BC_ROUTE.indexOf('} else if (template ===', start + 10)
  return BC_ROUTE.slice(start, next === -1 ? BC_ROUTE.length : next)
}

describe('every scenario is accounted for', () => {
  // The whole point: a fifteenth template added next year and forgotten stops
  // the ship, instead of quietly shorting somebody's settlement.
  it.each(Object.keys(TEMPLATE_LABELS).map(t => [t]))(
    '%s has been decided one way or the other', (t) => {
      expect(typeof hasBufferNote(t)).toBe('boolean')
    })

  it('the four that get it are the four that were named', () => {
    expect([...BUFFERED_TEMPLATES]).toEqual([
      'refinance_only', 'refinance_equity', 'investment_equity', 'complex_refinance',
    ])
  })

  it('every one of them is a real scenario, not a typo', () => {
    for (const t of BUFFERED_TEMPLATES) expect(TEMPLATE_LABELS).toHaveProperty(t)
  })
})

describe('the borrowing capacity email', () => {
  it.each(BUFFERED_TEMPLATES.map(t => [t]))('%s carries the buffer note', (t) => {
    const branch = branchFor(t)
    expect(branch, `no email branch found for ${t}`).not.toBe('')
    expect(branch, `${t} builds a client email with no buffer note in it`)
      .toContain('bufferNoteBlock(template)')
  })

  // A TEMPLATE CAN HAVE SEVERAL BRANCHES AND EVERY ONE OF THEM IS AN EMAIL.
  //
  // refinance_equity has three: the comparison layout, the grouped layout for a
  // deal with several securities, and the plain one. refinance_only has two.
  // branchFor() above finds the FIRST, so on its own it would pass while a
  // later branch quietly went out without the paragraph.
  //
  // This used to be `.toBe(5)` - a count of the calls in the file, with no idea
  // which branch any of them was in. Adding the two grouped layouts on 16 Oct
  // 2026 made it 7 and the ship stopped, correctly, but a bare number cannot
  // tell you whether 7 is right. So it walks the branches instead.
  it('EVERY branch of a buffered template carries it, not just the first', () => {
    const chunks = BC_ROUTE.split(/\} else if \(template ===/).slice(1)
    const missed: string[] = []
    for (const chunk of chunks) {
      const name = /^\s*'([a-z_]+)'/.exec(chunk)?.[1]
      if (!name || !BUFFERED_TEMPLATES.includes(name as any)) continue
      // Only the chunks that actually build an email. A guard clause that
      // falls through to another branch builds nothing and needs nothing.
      if (!chunk.includes('body = heading()')) continue
      if (!chunk.includes('bufferNoteBlock(template)')) {
        missed.push(`${name} (${/securedByMany/.test(chunk) ? 'several securities'
          : /compareOptions/.test(chunk) ? 'comparison' : 'plain'} layout)`)
      }
    }
    expect(missed, 'these branches build a client email with no buffer note in it').toEqual([])
  })

  it('and there are more branches than templates, which is why the above walks them', () => {
    const chunks = BC_ROUTE.split(/\} else if \(template ===/).slice(1)
      .filter(c => {
        const n = /^\s*'([a-z_]+)'/.exec(c)?.[1]
        return n && BUFFERED_TEMPLATES.includes(n as any) && c.includes('body = heading()')
      })
    expect(chunks.length).toBeGreaterThan(BUFFERED_TEMPLATES.length)
  })

  it.each(Object.keys(TEMPLATE_LABELS).filter(t => !hasBufferNote(t)).map(t => [t]))(
    '%s does not', (t) => {
      const branch = branchFor(t)
      if (!branch) return
      expect(branch, `${t} is not a payout and should not mention a buffer`)
        .not.toContain('bufferNoteBlock(template)')
    })
})

describe('the lending options email', () => {
  // THE FAULT ITSELF. It read this email's own template, so a label on an email
  // decided whether a client was told about their loan amount.
  it('no longer decides it from the email template', () => {
    // The CODE, not the note explaining why it is gone - which quite properly
    // quotes the line it replaced, and which this test matched on first run.
    expect(LO_ROUTE).not.toMatch(/if \(d\.template !== 'lo_purchase'\)/)
  })

  it('reads the deal\'s scenario, the same thing the BC email reads', () => {
    expect(LO_ROUTE).toContain('bufferNoteBlock(bcData?.template)')
  })

  it('does not keep its own copy of the wording', () => {
    expect(LO_ROUTE).not.toContain('we have added a buffer')
  })
})

describe('the panel itself', () => {
  it('says the two things it has to say', () => {
    expect(BUFFER_TEXT).toMatch(/buffer/i)
    expect(BUFFER_TEXT).toMatch(/discharge fee/i)
    expect(BUFFER_TEXT).toMatch(/shortfall/i)
    expect(BUFFER_TEXT).toMatch(/credited back/i)
  })

  // Outlook renders through Word, which paints a background only from the
  // attribute. scripts/check-email-html.sh fails the ship if it slips.
  it('carries bgcolor on every coloured area, not only CSS', () => {
    const html = bufferNoteBlock('refinance_only')
    expect(html).toContain('bgcolor="#2DBEFF"')
    expect(html).toContain('bgcolor="#EEF6FD"')
  })

  it('draws nothing at all on a scenario that pays nothing out', () => {
    for (const t of ['oo_purchase', 'fhb', 'construction', 'smsf', 'bridging', 'buy_sell', 'debt_recycling']) {
      expect(bufferNoteBlock(t)).toBe('')
    }
  })

  it('draws nothing for a template nobody recognises', () => {
    expect(bufferNoteBlock('')).toBe('')
    expect(bufferNoteBlock(undefined)).toBe('')
    expect(bufferNoteBlock('something_new')).toBe('')
  })
})

// TURNED OFF ON PURPOSE, AND WRITTEN DOWN SO NOBODY "FIXES" IT BACK.
//
// These three print the note today, because the old rule was "anything that is
// not a purchase". Fabio took them off on 12 Oct 2026 after reading the list.
describe('the three that used to get it and no longer do', () => {
  it.each([['debt_recycling'], ['buy_sell'], ['bridging']])('%s', (t) => {
    expect(hasBufferNote(t)).toBe(false)
  })
})
