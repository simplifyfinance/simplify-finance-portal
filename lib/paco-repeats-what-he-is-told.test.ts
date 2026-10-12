import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  TIERS, TYPEABLE_TIERS, tierLabel, isOfficial, rankOf,
  isLive, isUsable, tagsOfClaim, claimsFor, disagree, ageingAt,
  attribution, caveatFor, type Claim,
} from './paco-knowledge'
import { answer } from './paco'

// PACO'S SECOND SOURCE: WHAT THE TEAM TELLS HIM.
//
// 12 Oct 2026. He answers from our own deals already. A deal is fields - a
// lender, a date, an outcome - and a count of deals cannot be subtly wrong.
//
// A NOTE IS DIFFERENT AND THAT IS THE WHOLE RISK. It is a sentence somebody
// wrote, and the obvious thing to do with a sentence is tidy it, shorten it,
// blend three of them into one. Every one of those is Paco writing about
// lending, which is the thing he must never do. So he quotes, word for word,
// and says whose words they are.
//
// Fabio, 12 Oct 2026: "anyone can update paco but we data stmap and mark which
// person did" - no approval queue, nothing waiting on one person. The stamp is
// the safeguard, so the stamp is what these tests are mostly about.
const note = (over: Partial<Claim> = {}): Claim => ({
  id: 'n1', lender: 'Northgate', said: 'They will look at limited title up to 80%.',
  tags: ['Limited title'], tier: 'D', source: 'BDM call', who: 'Sam Fletcher',
  when: '2026-10-01T00:00:00Z', retiredAt: null, retiredBy: null, ...over,
})

describe('the tiers say where a claim came from', () => {
  it('is four, in order, and official is the top two', () => {
    expect(TIERS.map(t => t.tier)).toEqual(['A', 'B', 'C', 'D'])
    expect(TIERS.filter(t => t.official).map(t => t.tier)).toEqual(['A', 'B'])
  })

  it('official outranks what we have seen', () => {
    expect(rankOf('A')).toBeLessThan(rankOf('B'))
    expect(rankOf('B')).toBeLessThan(rankOf('C'))
    expect(rankOf('C')).toBeLessThan(rankOf('D'))
  })

  // A and C are what a LENDER wrote. Letting a person pick them would mean
  // somebody could mark their own recollection as the lender's own policy.
  it('a person can only choose the two that are theirs to choose', () => {
    expect(TYPEABLE_TIERS).toEqual(['B', 'D'])
  })

  it('an unknown tier reads as our experience, never as policy', () => {
    expect(tierLabel('Z')).toBe('Our experience')
    expect(isOfficial('Z')).toBe(false)
    expect(isOfficial('')).toBe(false)
  })
})

describe('he quotes, he does not summarise', () => {
  it('the note comes back exactly as it was typed', () => {
    const n = note({ said: '  Up to 80%, but only with a full val.  ' })
    const found = claimsFor([n], ['Limited title'], '')
    expect(found[0].said).toBe('  Up to 80%, but only with a full val.  ')
  })

  it('nothing in the library rewrites it', () => {
    const src = readFileSync('lib/paco-knowledge.ts', 'utf8')
    expect(src).not.toMatch(/\.said\s*\.(replace|slice|substring|split)/)
  })
})

describe('the stamp', () => {
  it('says how firm, who, and when', () => {
    expect(attribution(note(), new Date('2026-10-02T00:00:00Z')))
      .toBe('Our experience · Sam Fletcher · 2026-10-01')
  })

  it('says someone here when no name was recorded', () => {
    expect(attribution(note({ who: '' }), new Date('2026-10-02T00:00:00Z')))
      .toContain('someone here')
  })

  // Hedged, never hidden. An old note is still the best thing we have.
  it('marks an old one as worth re-checking rather than dropping it', () => {
    const old = note({ when: '2026-01-01T00:00:00Z' })
    expect(ageingAt(old, new Date('2026-10-12T00:00:00Z'))).toBe(true)
    expect(attribution(old, new Date('2026-10-12T00:00:00Z'))).toContain('worth re-checking')
    expect(claimsFor([old], ['Limited title'], '')).toHaveLength(1)
  })

  it('gives written policy longer than something somebody saw once', () => {
    const when = '2026-06-01T00:00:00Z'
    const now = new Date('2026-10-12T00:00:00Z')
    expect(ageingAt(note({ when, tier: 'D' }), now)).toBe(true)
    expect(ageingAt(note({ when, tier: 'B' }), now)).toBe(false)
  })

  it('says nothing about age when the date is nonsense', () => {
    expect(ageingAt(note({ when: 'not a date' }))).toBe(false)
  })
})

// AN UNOFFICIAL NOTE MUST NEVER READ AS LENDER POLICY. Blueprint section 2.
describe('experience is never dressed up as policy', () => {
  it('carries a caveat', () => {
    expect(caveatFor(note({ tier: 'D' }))).toContain('Not lender policy')
  })

  it('and written policy does not need one', () => {
    expect(caveatFor(note({ tier: 'B' }))).toBe('')
  })
})

describe('finding the ones that answer the question', () => {
  // THE TAG NAMES HERE ARE THE REAL ONES, out of ALL_TAGS, and they have to be.
  // A made-up tag is thrown away by tagsOfClaim, which then falls back to
  // reading the note's own words - so a fixture with an invented tag quietly
  // stops testing tags at all and starts testing the word search instead.
  // That is how this block first went green on a rule it was not checking.
  //
  // For the same reason each note says something DIFFERENT. Three notes with
  // one sentence between them match each other through the word fallback and
  // every query returns all three.
  const notes = [
    note({ id: 'a', lender: 'Northgate', tags: ['Limited title'] }),
    note({
      id: 'b', lender: 'Marlow Bank', tags: ['Self-employed under 2 yrs'],
      said: 'One full year of figures is enough for them.',
    }),
    note({
      id: 'c', lender: 'Northgate', tags: ['Self-employed under 2 yrs'], tier: 'B',
      said: 'Eighteen months trading, with an accountant letter.',
    }),
  ]

  it('by tag', () => {
    expect(claimsFor(notes, ['Limited title'], '').map(c => c.id)).toEqual(['a'])
  })

  it('by lender', () => {
    expect(claimsFor(notes, [], 'Northgate').map(c => c.id).sort()).toEqual(['a', 'c'])
  })

  // Case and punctuation only. flat() turns anything that is not a letter or a
  // number into a space - it does not CLOSE a gap, so "north gate" is two words
  // and stays two words. That is deliberate: a lender is matched exactly after
  // tidying, never by guessing that two names are near enough.
  it('and the lender name is matched however it was typed', () => {
    expect(claimsFor(notes, [], '  NORTHGATE.  ').map(c => c.id).sort()).toEqual(['a', 'c'])
  })

  it('does not match a lender whose name merely looks close', () => {
    expect(claimsFor(notes, [], 'north gate')).toHaveLength(0)
  })

  it('puts official first, then newest', () => {
    expect(claimsFor(notes, ['Self-employed under 2 yrs'], '')[0].id).toBe('c')
  })

  // The words in the note itself, when nobody ticked a tag. Deterministic -
  // the words are there or they are not.
  it('finds a note nobody tagged, from what it says', () => {
    const loose = note({ id: 'x', tags: [], said: 'Fine with a limited title block.' })
    expect(tagsOfClaim(loose)).toContain('Limited title')
    expect(claimsFor([loose], ['Limited title'], '').map(c => c.id)).toEqual(['x'])
  })

  it('ignores a tag that is not one of ours', () => {
    expect(tagsOfClaim(note({ tags: ['Something invented'], said: 'no clues here' }))).toEqual([])
  })
})

// NOTHING IS EVER DELETED.
describe('retiring a note', () => {
  const dead = note({ retiredAt: '2026-10-05T00:00:00Z', retiredBy: 'Katie' })

  it('stops it being answered with', () => {
    expect(isLive(dead)).toBe(false)
    expect(claimsFor([dead], ['Limited title'], '')).toHaveLength(0)
  })

  it('but the record is still there to read', () => {
    expect(dead.said).toBeTruthy()
    expect(dead.retiredBy).toBe('Katie')
  })

  it('and the table has no way to delete one', () => {
    const sql = readFileSync('docs/paco-knowledge-schema.sql', 'utf8')
    expect(sql).not.toMatch(/for delete/i)
    expect(sql).toContain('enable row level security')
  })

  // THE STAMP HAS TO HOLD WITHOUT US.
  //
  // Our own route only ever writes retired_at, but the route is not the only
  // way in - the browser carries a Supabase key, and the update policy can say
  // WHO may update, never WHICH COLUMNS. Without the trigger, anyone signed in
  // could rewrite the sentence or the name on somebody else's note straight
  // against the database. This table has no approval queue because the stamp is
  // the safeguard, so the safeguard cannot live only in our code.
  it('and the note, its tier and its stamp cannot be edited afterwards', () => {
    const sql = readFileSync('docs/paco-knowledge-schema.sql', 'utf8')
    expect(sql).toMatch(/before update on public\.paco_knowledge/i)
    for (const col of ['said', 'tier', 'said_by', 'said_by_name', 'created_at', 'lender', 'tags']) {
      expect(sql).toMatch(new RegExp(`new\\.${col}\\s+is distinct from old\\.${col}`, 'i'))
    }
  })
})

// TWO PEOPLE WHO DISAGREE. Blueprint section 16: an escalation, not a silent
// overwrite. In a four-person office the honest escalation is showing both.
describe('when two notes disagree', () => {
  it('says so when one is official and one is not', () => {
    expect(disagree([note({ id: 'a', tier: 'B' }), note({ id: 'b', tier: 'D' })])).toBe(true)
  })

  it('and not when they are the same kind of claim', () => {
    expect(disagree([note({ id: 'a', tier: 'D' }), note({ id: 'b', tier: 'D' })])).toBe(false)
  })

  it('nor across different lenders', () => {
    expect(disagree([note({ id: 'a', tier: 'B' }), note({ id: 'b', lender: 'Marlow', tier: 'D' })])).toBe(false)
  })

  it('both are returned, neither is dropped', () => {
    const two = [note({ id: 'a', tier: 'B' }), note({ id: 'b', tier: 'D' })]
    expect(claimsFor(two, ['Limited title'], '').map(c => c.id)).toEqual(['a', 'b'])
  })
})

describe('a note is an answer even with no deal behind it', () => {
  it('he says what he was told rather than nada', () => {
    const a = answer('limited title', [], {}, [note()])
    expect(a.kind).toBe('found')
    expect(a.notes.map(n => n.id)).toEqual(['n1'])
    expect(a.lenders).toEqual([])
  })

  it('and still says nada when nobody has told him anything', () => {
    expect(answer('limited title', [], {}, []).kind).toBe('none_tagged')
  })

  it('a lender he has no deals with is still a lender he can be asked about', () => {
    const a = answer('what about Northgate', [], {}, [note()])
    expect(a.notes.map(n => n.lender)).toEqual(['Northgate'])
  })

  it('an unusable note is never answered with', () => {
    expect(isUsable({ said: 'something', lender: '' })).toBe(false)
    expect(isUsable({ said: '', lender: 'Northgate' })).toBe(false)
    expect(answer('limited title', [], {}, [note({ lender: '' })]).kind).toBe('none_tagged')
  })
})

describe('the box that writes one', () => {
  const PANEL = readFileSync('components/Paco.tsx', 'utf8')

  it('quotes the note rather than printing it as his own words', () => {
    expect(PANEL).toContain('&ldquo;{n.said}&rdquo;')
  })

  it('shows the stamp on every one', () => {
    expect(PANEL).toContain('attribution(n)')
    expect(PANEL).toContain('tierLabel(n.tier)')
  })

  it('shows the caveat on anything that is not official', () => {
    expect(PANEL).toContain('caveatFor(n)')
  })

  it('says outright when two of them disagree', () => {
    expect(PANEL).toContain('a.notesDisagree')
    expect(PANEL).toContain('I am not picking one')
  })

  it('only offers the two tiers a person may choose', () => {
    expect(PANEL).toContain('TYPEABLE_TIERS.map')
  })
})
