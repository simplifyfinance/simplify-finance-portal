import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { documentsBlock, documentsHeading, docAskedLine,
         DOCUMENTS_LEAD, DOCUMENTS_HOW } from './documents-block'
import { documentItemsFor, documentChaseFor } from './documents-block'
import { withRequest, withReceived } from './document-progress'

// WHAT THE CLIENT IS TOLD IS STILL MISSING.
//
// 28 Oct 2026. The Arrived tick shipped this morning. Until this block exists
// the tick only makes the hole visible to us - the client is never told.
//
// THE RULE THIS WHOLE FILE PROTECTS: the list in a client's email is exactly
// the rows somebody has asked for and nobody has ticked off. Wrong in one
// direction and we chase a client for a payslip they sent a fortnight ago,
// which is the fastest way to teach them the list means nothing. Wrong in the
// other and a file reaches a lender with a hole everybody believed was filled.

const DAY = 86_400_000
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString()

// THE KEYS ARE THE RULES' OWN, NOT INVENTED ONES.
//
// 29 Oct 2026. The first version of this fixture made up keys like 'payslips'
// and every list came back empty, because allRowsOf() derives its rows from
// lib/document-rules.ts and a decision filed under a key that is not on the
// list is ignored - exactly as designed. A PAYG applicant produces these four.
const KEYS = ['id:a0', 'salary-account:a0', 'super:a0', 'expenses-account']

const deal = (opts: { asked?: string[]; days?: number; got?: string[] } = {}) => {
  let p: any = {
    decisions: Object.fromEntries(KEYS.map(k => [k, { ticked: true, at: '', by: 'Kylie' }])),
  }
  if (opts.asked?.length) p = withRequest(p, opts.asked, 'Kylie', ago(opts.days ?? 3))
  for (const k of opts.got || []) p = withReceived(p, k, 'Cris')
  return {
    document_progress: p,
    fact_find_data: { applicants: [{ firstName: 'Dean', lastName: 'Okafor',
      income: [{ incomeType: 'PAYG' }], employment: [{ employmentBasis: 'Full time' }],
      addresses: [{ address: '1 Example St', isCurrent: true, startDate: '2020-01-01' }] }] },
    bc_data: {},
  }
}

describe('THE HEADING COUNTS THEM', () => {
  it('because "some documents" is not something anybody acts on', () => {
    expect(documentsHeading(1)).toBe('1 document still to send us')
    expect(documentsHeading(3)).toBe('3 documents still to send us')
  })
  it('and nothing outstanding has no heading at all', () => {
    expect(documentsHeading(0)).toBe('')
  })
})

describe('"ASKED 14 OCT · 14 DAYS"', () => {
  it('names the first ask, so a chase is not just the same email twice', () => {
    const line = docAskedLine(ago(14))
    expect(line).toContain('Asked ')
    expect(line).toContain('14 days')
  })
  it('and one day is not "1 days"', () => {
    expect(docAskedLine(ago(1))).toContain('1 day')
    expect(docAskedLine(ago(1))).not.toContain('1 days')
  })
  it('and a row never asked for has no line', () => {
    expect(docAskedLine('')).toBe('')
    expect(docAskedLine(null)).toBe('')
  })
})

describe('THE BLOCK', () => {
  const items = [
    { name: 'PAYG summary or income statement', detail: 'The one the ATO issues', asked: 'Asked 14 Oct · 14 days' },
    { name: 'Car loan statement — Plenti', detail: '', asked: 'Asked 14 Oct · 14 days' },
  ]

  it('EMPTY WHERE THERE IS NOTHING OUTSTANDING', () => {
    // No heading, no "nothing outstanding", no empty box. Most clients have
    // sent us everything and should never know this exists.
    expect(documentsBlock({ items: [] })).toBe('')
    expect(documentsBlock({ items: [{ name: '  ', detail: '', asked: '' }] })).toBe('')
  })

  it('names every document and when it was asked for', () => {
    const html = documentsBlock({ items })
    expect(html).toContain('2 documents still to send us')
    expect(html).toContain('PAYG summary or income statement')
    expect(html).toContain('Car loan statement')
    expect(html).toContain('Asked 14 Oct')
  })

  it('AND IT HAS NO BUTTON, BECAUSE THERE IS NOWHERE TO SEND THEM', () => {
    // Fabio, on a draft that had an Upload button: "how are we uploading
    // documents? We never had a button where we can upload documents." The
    // client uploads to SalesTrekker, which is not ours. A button that goes
    // nowhere is worse than no button.
    const html = documentsBlock({ items })
    expect(html).not.toContain('<a href')
    expect(html).toContain('client portal you were invited to')
  })

  it('and the band is pale with dark text, like every button this portal sends', () => {
    // Word keeps a dark cell's background and throws away the pale text that
    // made it readable, so it arrives black on purple.
    const html = documentsBlock({ items })
    expect(html).toContain('bgcolor="#C9B6F0"')
    expect(html).toContain('color:#2E1C56')
  })

  it('AND THE WORDING IS THE ONE FABIO ASKED FOR', () => {
    // "the client wording is too firm. I don't like it. So just say something
    // like, these are essential for us to continue your application."
    expect(DOCUMENTS_LEAD).toBe('These are essential for us to continue your application.')
    expect(DOCUMENTS_LEAD).not.toContain('cannot submit')
    expect(DOCUMENTS_HOW).toContain('reply to this email')
  })

  it('and every colour sits on a span, so Word cannot paint it black', () => {
    const html = documentsBlock({ items })
    for (const m of html.matchAll(/<p style="[^"]*">([^<]+)</g)) {
      expect(m[1].trim(), 'bare text inside a <p> with no span').toBe('')
    }
  })

  it('and a name with an ampersand in it cannot break the mail', () => {
    const html = documentsBlock({ items: [{ name: 'Smith & Co <letter>', detail: '', asked: '' }] })
    expect(html).toContain('Smith &amp; Co &lt;letter&gt;')
    expect(html).not.toContain('<letter>')
  })
})

describe('THE LIST ITSELF', () => {
  it('is what was asked for and never ticked off', () => {
    const names = documentItemsFor(deal({ asked: [KEYS[0], KEYS[1]] })).map(i => i.name)
    expect(names.length).toBe(2)
  })

  it('AND A DOCUMENT THAT CAME IN IS NOT CHASED AGAIN', () => {
    // The fault this feature exists to prevent, stated as a test.
    const items = documentItemsFor(deal({ asked: [KEYS[0], KEYS[1]], got: [KEYS[1]] }))
    expect(items.length).toBe(1)
  })

  it('AND NOTHING NOBODY ASKED FOR EVER REACHES A CLIENT', () => {
    expect(documentItemsFor(deal({}))).toEqual([])
  })

  it('and the team’s copy says which have gone past the fortnight', () => {
    const late = documentChaseFor(deal({ asked: [KEYS[0]], days: 20 }))
    const fresh = documentChaseFor(deal({ asked: [KEYS[0]], days: 3 }))
    expect(late[0].late).toBe(true)
    expect(fresh[0].late).toBe(false)
  })

  it('AND THE CLIENT’S COPY CARRIES NO SUCH FLAG', () => {
    // Fabio: shouting happens in the portal and the compliance email. What a
    // client reads is the same sentence on day two and on day forty.
    const items = documentItemsFor(deal({ asked: [KEYS[0]], days: 40 }))
    expect(Object.keys(items[0])).toEqual(['name', 'detail', 'asked'])
  })
})

describe('AND IT REACHES THE THREE EMAILS', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
  const LO = read('app/api/generate-lo-email/route.ts')
  const NEXT = read('app/api/send-next-steps-email/route.ts')
  const PUSH = read('app/api/notify-salestrekker/route.ts')
  const NOTIFY = read('lib/salestrekker-notify.ts')

  it('the lending options email', () => {
    expect(LO).toContain('documentsStillOutFor(dealId)')
  })

  it('the email after they press proceed, on BOTH paths', () => {
    // The preview and the send. A preview that leaves the blocks out is a
    // preview of a different email, and somebody approves it.
    expect(NEXT.match(/documentsStillOutFor\(dealId\)/g)?.length).toBe(2)
    expect(NEXT.match(/stillNeedFor\(dealId/g)?.length).toBe(2)
  })

  it('and the compliance push, as its own panel', () => {
    expect(PUSH).toContain('documentChaseFor(full)')
    expect(NOTIFY).toContain('Keep chasing')
    expect(NOTIFY).toContain('chasePanel(')
  })

  it('AND NOT ONE OF THEM WRITES THE WORDING OUT FOR ITSELF', () => {
    // A second copy of a sentence is a sentence that will be fixed in one place
    // and left wrong in two.
    for (const [name, src] of [['the LO route', LO], ['the proceed route', NEXT]] as const) {
      expect(src, `${name} writes the lead out by hand`)
        .not.toContain('essential for us to continue')
    }
  })
})
