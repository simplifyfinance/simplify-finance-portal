// THE NOTE THAT GOES TO A REFERRAL PARTNER.
//
// Invented partners, clients and figures throughout.
//
// EVERY TIMESTAMP IS WRITTEN WITHOUT A Z and this runs under three timezones
// in the ship. A week boundary read in UTC puts a Monday lodgement in the week
// before, which is the fault that cost a week's report in November.
import { describe, it, expect } from 'vitest'
import {
  buildPartnerNote, dayOf, dealsOf, draftNote, lineFor, partnerSubject, periodsFor, scoreOf,
} from './the-partner-note'

const SPAN = { from: '2026-11-09', to: '2026-11-15' }

const deal = (over: any = {}) => ({
  id: 'd' + Math.random(),
  deal_name: 'Okonkwo, C 2026',
  lender: 'ING',
  commission_split_id: 'newblue',
  commission_split_name: 'New Blue Finance',
  lodged_at: '2026-11-10T13:00:00+00:00',
  lodged_total: 880_000,
  ...over,
})

describe('the four periods', () => {
  const p = () => periodsFor('2026-11-12')

  it('are always in the same order', () => {
    expect(p().map(x => x.key)).toEqual(['week', 'month', 'quarter', 'fy'])
  })

  it('start the week on Monday', () => {
    expect(p()[0].from).toBe('2026-11-09')
    expect(p()[0].to).toBe('2026-11-12')
  })

  it('name the month rather than saying "this month"', () => {
    expect(p()[1].label).toBe('November so far')
    expect(p()[1].from).toBe('2026-11-01')
  })

  it('put November in the October-to-December quarter', () => {
    expect(p()[2].from).toBe('2026-10-01')
  })

  it('run the financial year from July', () => {
    expect(p()[3].from).toBe('2026-07-01')
    expect(p()[3].label).toBe('FY27 so far')
  })

  it('roll the week over on a Monday, not a Sunday', () => {
    expect(periodsFor('2026-11-15')[0].from).toBe('2026-11-09')  // Sunday
    expect(periodsFor('2026-11-16')[0].from).toBe('2026-11-16')  // Monday
  })
})

describe('only this partner, never anybody else', () => {
  const book = [
    deal(),
    deal({ deal_name: 'Barbieri, L 2026', lodged_total: 912_000 }),
    deal({ deal_name: 'Somebody Else 2026', commission_split_id: 'navigate',
           commission_split_name: 'Navigate Advisors', lodged_total: 500_000 }),
  ]

  it('leaves another partner’s clients out', () => {
    const mine = dealsOf(book, 'newblue', 'lodged', SPAN)
    expect(mine).toHaveLength(2)
    expect(mine.map(d => d.deal_name)).not.toContain('Somebody Else 2026')
  })

  it('sends nothing at all where no partner is named', () => {
    expect(dealsOf(book, '', 'lodged', SPAN)).toEqual([])
    expect(dealsOf(book, null, 'lodged', SPAN)).toEqual([])
  })

  it('adds up only what is theirs', () => {
    const s = scoreOf(book, 'newblue', SPAN)
    expect(s.lodged).toBe(2)
    expect(s.lodgedAmount).toBe(1_792_000)
    expect(s.settled).toBe(0)
  })
})

describe('the day, in Sydney', () => {
  // Stored as Sydney midnight, which is 13:00 the day before in UTC.
  it('reads the day somebody actually lodged', () => {
    expect(dayOf({ lodged_at: '2026-11-10T13:00:00+00:00' }, 'lodged')).toBe('Wednesday')
    expect(dayOf({ settled_at: '2026-11-12T13:00:00+00:00' }, 'settled')).toBe('Friday')
  })

  it('is empty where nothing happened', () => {
    expect(dayOf({}, 'lodged')).toBe('')
  })

  it('carries the lender and the figure onto the line', () => {
    const l = lineFor(deal(), 'lodged')
    expect(l.name).toBe('Okonkwo, C 2026')
    expect(l.day).toBe('Wednesday')
    expect(l.lender).toBe('ING')
    expect(l.amount).toBe(880_000)
  })
})

describe('the first draft', () => {
  const score = { lodged: 2, settled: 1, lodgedAmount: 1_792_000, settledAmount: 758_000 }

  it('says what happened, in words', () => {
    const d = draftNote('Mark', score)
    expect(d.startsWith('Hi Mark,')).toBe(true)
    expect(d).toContain('Two lodged and one settled this week')
  })

  it('handles a quiet week without pretending', () => {
    const d = draftNote('Mark', { lodged: 0, settled: 0, lodgedAmount: 0, settledAmount: 0 })
    expect(d).toContain('Nothing of yours moved this week')
  })

  // SAVED PER PARTNER. What he says to an accountant who sends two a year is
  // not what he says to a buyer's agent who sends ten a month.
  it('uses the saved note where there is one', () => {
    const d = draftNote('Mark', score, 'Good week. Lunch soon?')
    expect(d).toBe('Hi Mark,\n\nGood week. Lunch soon?')
  })

  it('still greets somebody whose name we do not have', () => {
    expect(draftNote('', score).startsWith('Hi there,')).toBe(true)
  })
})

describe('the email itself', () => {
  const built = (over: any = {}) => buildPartnerNote({
    brand: { name: 'Simplify Finance', headerColor: '#343333', accentColor: '#2DBEFF' },
    note: 'Hi Mark,\n\nTwo of yours lodged this week.',
    main: {
      label: 'This week',
      lodged: [
        { name: 'Okonkwo, C', day: 'Wednesday', lender: 'ING', amount: 880_000 },
        { name: 'Barbieri, L', day: 'Friday', lender: 'CBA', amount: 912_000 },
      ],
      settled: [{ name: 'Tanner, J & M', day: 'Friday', lender: 'ANZ', amount: 758_000 }],
    },
    also: [{ label: 'November so far',
             score: { lodged: 5, settled: 2, lodgedAmount: 4_410_000, settledAmount: 1_648_000 } }],
    from: { name: 'Fabio De Castro' },
    ...over,
  })

  it('names the brand in the subject', () => {
    expect(partnerSubject('Navigate Advisors')).toBe('Your clients this week — Navigate Advisors')
    expect(built().subject).toBe('Your clients this week — Simplify Finance')
  })

  it('carries the clients, the banks and the figures', () => {
    const { html } = built()
    for (const bit of ['Okonkwo, C', 'Barbieri, L', 'Tanner, J &amp; M',
                       'ING', 'CBA', 'ANZ', '$880,000', '$912,000', '$758,000']) {
      expect(html).toContain(bit)
    }
  })

  it('wears the brand it was given', () => {
    const { html } = built({
      brand: { name: 'Navigate Advisors', headerColor: '#1F3A5F', accentColor: '#7FB2E5' },
    })
    expect(html).toContain('#1F3A5F')
    expect(html).toContain('#7FB2E5')
    expect(html).toContain('Navigate')
  })

  // FABIO, 12 Nov 2026: "stop overthinking about the credit licence number,
  // this is just going to the referral partner."
  it('carries no licence, no trading name and no address', () => {
    const { html, text } = built()
    for (const banned of ['387025', 'Australian Credit Licence', 'Mortgage Specialists',
                          'St Leonards']) {
      expect(html).not.toContain(banned)
      expect(text).not.toContain(banned)
    }
  })

  // NOTHING ABOUT COMMISSION. That is between him and them.
  it('never mentions a split, a percentage or a term', () => {
    const { html, text } = built()
    for (const banned of ['split', 'upfront', 'trail', 'commission']) {
      expect(html.toLowerCase()).not.toContain(banned)
      expect(text.toLowerCase()).not.toContain(banned)
    }
    // The symbol only matters where a person would read it. HTML is full of
    // width="50%".
    expect(text).not.toContain('%')
    expect(html).not.toMatch(/>[^<]*\d+\s?%/)
  })

  it('says so when nothing settled, rather than leaving a hole', () => {
    const { html } = built({
      main: { label: 'This week', lodged: [], settled: [] },
    })
    expect(html).toContain('Nothing settled this week.')
  })

  // "WHY WOULD YOU MAKE NOVEMBER SO FAR SO TINY AND HARD TO SEE?"
  it('gives the other periods a bar with a big number on it', () => {
    const { html } = built()
    expect(html).toContain('November so far')
    expect(html).toContain('$4,410,000')
    // 30px is the bar's number; 12px is its label. Both present means it is a
    // bar and not a line of grey text.
    expect(html).toContain('800 30px/1')
  })

  it('survives Outlook: no stylesheet, no web font, no background image', () => {
    const { html } = built()
    expect(html).not.toContain('<style')
    expect(html).not.toContain('class=')
    expect(html).not.toContain('background-image')
    expect(html).not.toContain('fonts.googleapis')
  })

  it('escapes a client name with an ampersand in it', () => {
    const { html } = built()
    expect(html).toContain('Tanner, J &amp; M')
    expect(html).not.toContain('Tanner, J & M<')
  })

  it('hands back a plain version for a mail client that mangles tables', () => {
    const { text } = built()
    expect(text).toContain('Okonkwo, C')
    expect(text).toContain('Fabio De Castro')
    expect(text).not.toContain('<')
  })
})
