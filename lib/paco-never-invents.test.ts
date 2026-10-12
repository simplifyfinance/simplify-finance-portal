// PACO CANNOT MAKE ANYTHING UP, AND THIS IS WHERE THAT IS ENFORCED.
//
// 12 Oct 2026. He answers "which lender will do a limited title property" from
// our own deals. The obvious way to build that is to hand the deals to a model
// and let it write a paragraph, and that version is one confident sentence away
// from a false representation to a client.
//
// So he assembles from fields instead. These tests exist to keep it that way -
// not to check that the counting works, which is easy, but to make the next
// person who wants to "make the answers read better" fail the build and come
// and read this first.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  answer, tagsAsked, lenderAsked, outcomeOf, monthYear, factOf, flat,
} from './paco'

const deal = (o: any = {}) => ({
  lo_data: {
    recommendedLender: o.lender ?? 'Northgate Mutual',
    dealTags: o.tags ?? ['Limited title'],
    lenders: (o.considered ?? ['Harbourline']).map((n: string) => ({ lenderName: n })),
  },
  deal_name: o.name ?? 'Callum Thistlewood 2026',
  lodged_at: o.lodged ?? '2026-07-14',
  formal_approval_at: o.formal ?? null,
  settled_at: o.settled ?? null,
})

describe('what he understood', () => {
  it('matches a tag by its own words', () => {
    expect(tagsAsked('who have we used for limited title?')).toEqual(['Limited title'])
  })

  it('and by the way people actually say it', () => {
    expect(tagsAsked('anyone do self employed under 2 years?')).toContain('Self-employed under 2 yrs')
    expect(tagsAsked('what about a self managed super fund purchase')).toContain('SMSF')
    expect(tagsAsked('who is quick, need a fast approval')).toContain('Turnaround')
  })

  it('punctuation and capitals are not meaning', () => {
    expect(tagsAsked('LIMITED TITLE?!')).toEqual(['Limited title'])
    expect(flat('Self-Employed  under 2 yrs!')).toBe('self employed under 2 yrs')
  })

  it('NEVER guesses at a near miss', () => {
    // "Nearest match" is how a bot answers a question nobody asked, which is the
    // same failure as inventing. Either the words are there or they are not.
    expect(tagsAsked('what about a tricky property')).toEqual([])
    expect(tagsAsked('is this one hard')).toEqual([])
  })

  it('two things asked at once are both understood', () => {
    const t = tagsAsked('limited title and a guarantor')
    expect(t).toContain('Limited title')
    expect(t).toContain('Guarantor')
  })

  it('a lender is matched longest name first', () => {
    const known = ['Bank of Queensland', 'Bank of Melbourne', 'Bank']
    expect(lenderAsked('anything with bank of melbourne?', known)).toBe('Bank of Melbourne')
  })
})

describe('the outcome is dates, never an opinion', () => {
  it.each([
    [{ settled: '2026-02-01', formal: '2026-01-01', lodged: '2025-12-01' }, 'settled'],
    [{ formal: '2026-01-01', lodged: '2025-12-01' }, 'formally approved'],
    [{ lodged: '2025-12-01' }, 'lodged'],
    // Empty rather than null: the helper uses ?? so null falls through to its
    // own default, which is the sort of thing that makes a test lie.
    [{ lodged: '' }, 'not lodged yet'],
  ])('%o reads as %s', (dates, expected) => {
    expect(outcomeOf(deal(dates) as any)).toBe(expected)
  })

  it('a date nobody can parse is no date, not a wrong one', () => {
    expect(monthYear('whenever')).toBe('')
    expect(monthYear(null)).toBe('')
    expect(monthYear('2026-07-14')).toBe('Jul 2026')
  })
})

describe('what he gives back', () => {
  const deals = [
    deal({ lender: 'Northgate Mutual', tags: ['Limited title', 'Turnaround'], formal: '2026-07-20' }),
    deal({ lender: 'Northgate Mutual', tags: ['Limited title'], settled: '2026-02-11' }),
    deal({ lender: 'Harbourline', tags: ['Limited title'], considered: ['Sunco Bank'] }),
    deal({ lender: 'Sunco Bank', tags: [], lodged: '2026-05-01' }),
  ]

  it('groups by lender, most deals first', () => {
    const a = answer('limited title?', deals)
    expect(a.kind).toBe('found')
    expect(a.lenders.map(l => l.lender)).toEqual(['Northgate Mutual', 'Harbourline'])
    expect(a.lenders[0].deals.length).toBe(2)
  })

  it('names the other tags on a deal, so a second reason is not lost', () => {
    const a = answer('limited title?', deals)
    expect(a.lenders[0].deals[0].alsoTagged).toEqual(['Turnaround'])
  })

  it('says who was compared and not chosen', () => {
    const a = answer('limited title?', deals)
    expect(a.alsoConsidered).toContain('Sunco Bank')
  })

  it('counts what it can and cannot see', () => {
    const a = answer('limited title?', deals)
    expect(a.counts.tagged).toBe(3)
    expect(a.counts.untagged).toBe(1)
    expect(a.counts.policies).toBe(0)
    expect(a.counts.bdmNotes).toBe(0)
  })

  it('a named lender narrows it', () => {
    const a = answer('limited title at harbourline?', deals)
    expect(a.lenders.map(l => l.lender)).toEqual(['Harbourline'])
  })
})

describe('the two kinds of knowing nothing, which are not the same', () => {
  const deals = [deal({ tags: ['Limited title'] })]

  it('understood, and no deal carries it', () => {
    const a = answer('anyone done an smsf?', deals)
    expect(a.kind).toBe('none_tagged')
    expect(a.asked).toEqual(['SMSF'])
  })

  it('the words matched nothing he holds', () => {
    const a = answer('what is the weather like', deals)
    expect(a.kind).toBe('not_understood')
    expect(a.asked).toEqual([])
  })

  it('and both still report what he can see', () => {
    for (const q of ['anyone done an smsf?', 'what is the weather like']) {
      expect(answer(q, deals).counts.tagged).toBe(1)
    }
  })

  it('no deals at all is still an answer, not a crash', () => {
    const a = answer('limited title', [])
    expect(a.kind).toBe('none_tagged')
    expect(a.counts.tagged).toBe(0)
  })

  it('junk where a deal should be cannot take him down', () => {
    expect(() => answer('limited title', [null, 'x', { lo_data: 7 }] as any)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// THE TWO RULES THAT ARE NOT ABOUT CORRECTNESS.
describe('no client ever appears in anything he says', () => {
  it('the answer carries no deal name, no id and no figure', () => {
    const a = answer('limited title?', [deal({ name: 'Callum Thistlewood 2026' })])
    const asText = JSON.stringify(a)
    expect(asText).not.toContain('Thistlewood')
    expect(asText).not.toContain('deal_name')
    expect(asText).not.toContain('loanAmount')
  })

  it('and the fact he builds from one carries only the five things it should', () => {
    const f = factOf(deal() as any)
    expect(Object.keys(f).sort()).toEqual(['considered', 'lender', 'outcome', 'tags', 'when'])
  })
})

describe('no model writes a sentence about lending', () => {
  const src = readFileSync('lib/paco.ts', 'utf8')
  const route = readFileSync('app/api/paco/route.ts', 'utf8')
  const ui = readFileSync('components/Paco.tsx', 'utf8')

  it('nothing in Paco calls a model', () => {
    for (const [name, code] of [['lib/paco.ts', src], ['the route', route], ['the panel', ui]] as const) {
      for (const tell of ['anthropic', 'openai', 'messages.create', 'generate-', 'completion']) {
        expect(code.toLowerCase(), `${name} reaches for ${tell}`).not.toContain(tell)
      }
    }
  })

  it('the route reads and never writes', () => {
    expect(route).not.toContain('.update(')
    expect(route).not.toContain('.insert(')
    expect(route).not.toContain('.delete(')
  })

  it('the route needs a signed-in person', () => {
    expect(route).toContain('auth.getUser()')
    expect(route).toContain('401')
    // The admin key would read every firm's rows past the database's own rules.
    expect(route).not.toContain('createSupabaseAdmin')
  })

  it('a failed look and an empty answer do not read the same', () => {
    expect(route).toContain('500')
    expect(route).toContain('I could not reach the deals')
  })
})

describe('he is on every page, from one place', () => {
  const layout = readFileSync('app/(app)/layout.tsx', 'utf8')

  it('mounted in the layout that wraps everything behind the login', () => {
    expect(layout).toContain('<Paco />')
  })

  it('and nowhere else, so there is one of him to fix', () => {
    // A second copy on one page is how he ends up subtly different on that page.
    expect((layout.match(/<Paco \/>/g) || []).length).toBe(1)
  })
})
