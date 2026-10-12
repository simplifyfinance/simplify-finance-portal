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

  // ASKING HIM A QUESTION WRITES NOTHING.
  //
  // 12 Oct 2026. This used to say the route never writes at all, which was true
  // until the team could tell him things. The rule it was really protecting is
  // narrower and still holds: a QUESTION changes no record anywhere. Only the
  // POST writes, and only to add a note or retire one.
  it('the question handler writes nothing', () => {
    const get = route.slice(route.indexOf('export async function GET'),
                            route.indexOf('export async function POST'))
    expect(get).not.toContain('.update(')
    expect(get).not.toContain('.insert(')
    expect(get).not.toContain('.delete(')
  })

  // AND NOTHING ANYWHERE DELETES OR REWRITES WHAT SOMEBODY SAID.
  //
  // A note is added, or it is retired. It is never edited and never removed -
  // which is what makes the name and the date on it worth anything.
  it('nothing deletes a note', () => {
    expect(route).not.toContain('.delete(')
  })

  it('the only update is a retirement', () => {
    const i = route.indexOf('.update(')
    expect(i).toBeGreaterThan(-1)
    const near = route.slice(i, i + 300)
    expect(near).toContain('retired_at')
    expect(near).not.toContain('said:')
    expect(near).not.toContain('tier:')
    // One update in the whole file.
    expect(route.indexOf('.update(', i + 1)).toBe(-1)
  })

  // THE STAMP IS TAKEN FROM THE SESSION, NEVER FROM THE BROWSER. Otherwise the
  // name on a note is whatever the sender typed, and the stamp is the entire
  // safeguard - there is no approval step behind it.
  it('a note is stamped with whoever is signed in', () => {
    expect(route).toContain('said_by: auth.user.id')
    expect(route).not.toMatch(/said_by:\s*body/)
    expect(route).not.toMatch(/said_by_name:\s*body/)
  })

  // A and C are what a lender wrote. Letting them be typed would mean somebody
  // could mark their own recollection as the lender's own policy.
  it('a person can only choose the two tiers that are theirs to choose', () => {
    expect(route).toContain("tier: body?.tier === 'B' ? 'B' : 'D'")
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

// BIG ENOUGH TO READ, AND IT STAYS THAT WAY.
//
// Fabio asked for this twice. The first time I changed the move-on dialog,
// because that was the box on screen when he asked - so the one he meant went
// out at exactly the size he had just told me was too small. A number in a
// class name is the easiest thing in this file to lose in a tidy-up.
describe('the panel is big enough to read', () => {
  const panel = readFileSync('components/Paco.tsx', 'utf8')

  it('is wider than it was, with a floor under its height', () => {
    expect(panel).toContain('w-[560px]')
    expect(panel).toContain('h-[620px]')
  })

  it('and never bigger than the window it is in', () => {
    expect(panel).toContain('max-w-[calc(100vw-2rem)]')
    expect(panel).toContain('max-h-[calc(100vh-3rem)]')
  })

  it('with what Paco says set a point larger than the chrome around it', () => {
    expect(panel).toContain('text-[14.5px] text-body max-w-[430px]')
  })
})

// MINIMISE, NOT CLOSE - AND YOUR CHAT IS YOURS.
//
// Paco sits in the app layout and never unmounts, so closing him only ever hid
// him; the conversation was still there on reopening. The cross said otherwise,
// so nobody trusted it. Fabio, 13 Oct 2026: "should we have a minus button to be
// safe", and then the question underneath it - "we dont want me opening paco and
// seeing some elses conversation".
//
// They cannot. The turns are state in one browser window. Nothing writes them
// anywhere, which is why a refresh clears them and why there is nothing to
// restore. Storing them to survive a refresh would be the only way one person's
// chat could ever reach another, so this file holds that line.
describe('minimise keeps your conversation, and keeps it yours', () => {
  const panel = readFileSync('components/Paco.tsx', 'utf8')

  it('the button minimises rather than claiming to close', () => {
    expect(panel).toContain('aria-label="Minimise Paco"')
    expect(panel).toContain('&minus;')
    expect(panel, 'the cross is back on the panel header').not.toContain('aria-label="Close Paco"')
  })

  it('hiding him does not throw the conversation away', () => {
    // Tight around the minimise button's own element. Wider than this and it
    // swallows the Start again button above it, which is SUPPOSED to clear.
    const at = panel.indexOf('aria-label="Minimise Paco"')
    const hide = panel.slice(at - 60, at + 200)
    expect(hide).toContain('setOpen(false)')
    expect(hide, 'minimising is clearing the chat again').not.toContain('setTurns([])')
  })

  it('and there is a way to clear it on purpose', () => {
    expect(panel).toContain('Start again')
    expect(panel).toContain('setTurns([])')
  })

  it('the bubble says when he is holding one', () => {
    expect(panel).toContain('turns.length > 0')
  })

  // THE ONE THAT MATTERS. A conversation that is never written down cannot be
  // read by anybody else, cannot be restored onto somebody else's screen, and
  // cannot outlive the window it was had in.
  it('nothing about the conversation is ever stored or sent', () => {
    expect(panel).not.toMatch(/localStorage|sessionStorage|indexedDB/i)
    // The only thing posted from this panel is a note somebody deliberately
    // typed into the Tell box, which is team knowledge and is meant to be shared.
    const posts = panel.match(/method:\s*'POST'/g) || []
    expect(posts.length).toBe(1)
    expect(panel).not.toMatch(/body:\s*JSON\.stringify\(\{[^}]*turns/)
  })
})
