import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { groupLoSplits, everySplitHasASecurity, propertyColour, PROPERTY_COLOURS } from './lo-by-property'
import type { Security } from './securities'

// SIX LOANS ACROSS THREE HOUSES, AND NOTHING SAID WHICH WAS WHICH.
//
// 12 Oct 2026. Fabio: "I now need the ability in LO to say Property 1 these
// splits Property 2 these splits". The lending options tab held a flat list,
// every security on the deal read "nothing drawn", and the lender comparison
// priced a structure that was not the one on the borrowing capacity.
const sec = (id: string, address: string): Security =>
  ({ id, address, use: 'Investment', subtype: 'House', value: '600,000', limit: '480,000' })

const SECS = [sec('p1', '16 Mock Street'), sec('p2', '7/22 Mock Road'), sec('p3', '14/22 Mock Road')]

const SPLITS = [
  { id: 's1', label: 'Existing', amount: '1,020,000', securityId: 'p1' },
  { id: 's2', label: 'Equity',   amount: '740,000',   securityId: 'p1' },
  { id: 's3', label: 'Existing', amount: '447,000',   securityId: 'p2' },
  { id: 's4', label: 'Equity',   amount: '33,000',    securityId: 'p2' },
  { id: 's5', label: 'Existing', amount: '238,000',   securityId: 'p3' },
  { id: 's6', label: 'Equity',   amount: '242,000',   securityId: 'p3' },
]

describe('the splits, under the house each one is against', () => {
  it('puts two loans under each of the three properties', () => {
    const { groups } = groupLoSplits(SPLITS, SECS)
    expect(groups.map(g => g.rows.length)).toEqual([2, 2, 2])
    expect(groups.map(g => g.security!.address)).toEqual(['16 Mock Street', '7/22 Mock Road', '14/22 Mock Road'])
  })

  it('keeps the securities in the order they are ticked on the BC', () => {
    const { groups } = groupLoSplits(SPLITS, [SECS[2], SECS[0], SECS[1]])
    expect(groups.map(g => g.security!.id)).toEqual(['p3', 'p1', 'p2'])
  })

  // The form edits refinanceSplits[i]. After grouping, position in the group is
  // no longer position in the list - so an index that did not travel would land
  // every edit on the wrong loan.
  it('hands back each split with the index it has in the real list', () => {
    const { groups } = groupLoSplits(SPLITS, SECS)
    expect(groups[2].rows.map(r => r.index)).toEqual([4, 5])
    expect(groups[2].rows.map(r => r.split.id)).toEqual(['s5', 's6'])
  })

  // A FORM SHOWS THE ROW SOMEBODY IS HALFWAY THROUGH TYPING. groupBySecurity()
  // drops a split with no amount, which is right for a client email and wrong
  // here - the row would vanish under them mid-edit.
  it('keeps a split that has no amount yet', () => {
    const { groups } = groupLoSplits([{ id: 'new', label: '', amount: '', securityId: 'p1' }], SECS)
    expect(groups[0].rows).toHaveLength(1)
  })

  it('every split appears exactly once, and none is lost', () => {
    const { groups, loose } = groupLoSplits(SPLITS, SECS)
    const seen = [...groups.flatMap(g => g.rows), ...loose.rows].map(r => r.split.id).sort()
    expect(seen).toEqual(['s1', 's2', 's3', 's4', 's5', 's6'])
  })
})

// MONEY NO PROPERTY IS CARRYING IS THE DANGEROUS KIND.
describe('the splits against nothing', () => {
  it('collects a split with no security at all', () => {
    const { loose } = groupLoSplits([...SPLITS, { id: 's7', label: 'Stray', amount: '50,000' }], SECS)
    expect(loose.rows.map(r => r.split.id)).toEqual(['s7'])
    expect(everySplitHasASecurity([...SPLITS, { id: 's7', amount: '50,000' }], SECS)).toBe(false)
  })

  it('collects one whose property has been unticked on the BC', () => {
    const { loose } = groupLoSplits(SPLITS, [SECS[0], SECS[1]])
    expect(loose.rows.map(r => r.split.id)).toEqual(['s5', 's6'])
  })

  it('is empty when every split has a house', () => {
    expect(groupLoSplits(SPLITS, SECS).loose.rows).toHaveLength(0)
    expect(everySplitHasASecurity(SPLITS, SECS)).toBe(true)
  })

  it('says nothing is lost when handed nothing', () => {
    expect(groupLoSplits(null, SECS).groups.every(g => g.rows.length === 0)).toBe(true)
    expect(groupLoSplits(SPLITS, null as any).loose.rows).toHaveLength(6)
  })
})

// IT GROUPS. IT DOES NOT ADD UP.
//
// An earlier version put a subtotal under each property. Fabio: "scrap the last
// line on each property", "no need to add splits and repayments".
describe('it does not total anything', () => {
  it('a group carries its splits and nothing else', () => {
    const { groups } = groupLoSplits(SPLITS, SECS)
    expect(Object.keys(groups[0]).sort()).toEqual(['rows', 'security'])
  })
})

// THE COLOURS WERE CHECKED, NOT CHOSEN BY EYE.
describe('a colour per property', () => {
  it('is three, in a fixed order', () => {
    expect(PROPERTY_COLOURS).toHaveLength(3)
    expect(propertyColour(0)).toBe(PROPERTY_COLOURS[0])
    expect(propertyColour(2)).toBe(PROPERTY_COLOURS[2])
  })

  // lib/colours.ts: amber measured 1.2 out of 100 from the chase red to a
  // red-green colourblind reader. It is absent from this portal on purpose.
  it('has no amber in it', () => {
    const AMBER = /#(D97706|F59E0B|FBBF24|FCD34D|B45309|92400E)/i
    for (const c of PROPERTY_COLOURS) {
      expect(`${c.bar}${c.band}${c.ink}`).not.toMatch(AMBER)
    }
  })

  // Word paints a background from the bgcolor attribute and throws the text
  // colour away, so a pale band on a dark fill arrives unreadable. Every band
  // here is dark ink on a light tint. See lib/email-shell.ts.
  const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) }
  const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05) }

  it.each(PROPERTY_COLOURS.map((c, i) => [i + 1, c] as const))(
    'property %i reads as dark ink on a light band', (_n, c) => {
      expect(lum(c.band)).toBeGreaterThan(0.6)
      expect(ratio(c.ink, c.band)).toBeGreaterThan(4.5)
    })

  // A generated hue is how a palette stops being readable. Nothing was checked
  // past the third, so a fourth property wears the third's colour and is told
  // apart by its number.
  it('does not invent a fourth colour', () => {
    expect(propertyColour(3)).toBe(PROPERTY_COLOURS[2])
    expect(propertyColour(99)).toBe(PROPERTY_COLOURS[2])
  })

  it('survives a nonsense index rather than returning undefined', () => {
    expect(propertyColour(-1)).toBe(PROPERTY_COLOURS[0])
    expect(propertyColour(NaN)).toBe(PROPERTY_COLOURS[0])
  })
})

// THE CLIENT EMAIL SAYS IT TOO.
describe('the email band', () => {
  const ROUTE = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')

  it('groups by property and reads the colours from one place', () => {
    expect(ROUTE).toContain('propertyColour')
    expect(ROUTE).toContain('Your loans, by property')
  })

  // Outlook on Windows renders through Word, which paints a background only
  // from the attribute. scripts/check-email-html.sh fails the ship if it slips.
  it('puts bgcolor on the coloured band, not only CSS', () => {
    const band = ROUTE.slice(ROUTE.indexOf('Your loans, by property'))
    expect(band).toContain('bgcolor="${c.band}"')
  })

  it('still names the house as well as colouring it', () => {
    expect(ROUTE).toContain("${n + 1} &nbsp;&middot;&nbsp; ${sec.address")
  })

  it('never drops a loan that sits against nothing', () => {
    expect(ROUTE).toContain('Other lending')
  })

  it('prints no per-property subtotal', () => {
    expect(ROUTE).not.toContain('on this property')
  })
})
