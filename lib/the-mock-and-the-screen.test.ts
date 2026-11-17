import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { splitGroups, kindOf, kindTail, KIND_HEAD, KIND_ORDER } from './splits-groups'
import { splitFromRow, splitGroupLabel, splitKind } from './who-shares-this-deal'

// THE MOCK AND THE SCREEN.
//
// 19 Nov 2026. Fabio, holding a photograph of the live commission splits box
// beside the mock I drew for it: "see another example that the mock and
// reality are COMPLETELY DIFFERENT. Fix this - this needs to stop."
//
// He is right, and it had happened before. The rule I gave him and then did
// not keep: an approved mock lives in the repo, and the screen is checked
// against the FILE rather than against my memory of it.
//
// So this test reads docs/approved-looks/commission-splits.html off the disk
// and fails the ship if the component stops drawing what it draws.
//
// WHY THE OLD ONE COULD NEVER HAVE MATCHED. The screen used the browser's own
// <select>. The operating system draws that element, and it cannot carry a
// styled heading, a tick, or a second line under a name. Every one of those is
// in the mock. A mock that needs what the element cannot do is a mock that
// will be wrong forever, and I should have said so when I drew it.

// A class list wraps across lines in both files, and where it wraps is not a
// decision anybody made. Compared with the spaces squeezed out, so a tidy-up
// never fails the ship and a changed colour always does.
const flat = (s: string) => s.replace(/\s+/g, ' ')

const MOCK = flat(readFileSync('docs/approved-looks/commission-splits.html', 'utf8'))
const BOX  = flat(readFileSync('components/WhoSharesThisDeal.tsx', 'utf8'))
const RAW  = readFileSync('components/WhoSharesThisDeal.tsx', 'utf8')

describe('the screen is not the browser dropdown any more', () => {
  it('draws its own list', () => {
    expect(RAW, 'the operating system draws that box; it cannot do the mock')
      .not.toContain('<select')
    expect(RAW).not.toContain('<optgroup')
    expect(BOX).toContain('role="listbox"')
    expect(BOX).toContain('role="option"')
  })

  it('and shuts when you click away or press escape', () => {
    // The browser's dropdown did this for free. Ours has to be told.
    expect(BOX).toContain("document.addEventListener('mousedown', away)")
    expect(BOX).toContain("if (e.key === 'Escape') setOpen(false)")
  })
})

describe('every class in the component came out of the mock', () => {
  const lifted = [
    'rounded-lg border border-gray-200 bg-card px-3 py-2 text-left text-sm text-ink',
    'rounded-lg border border-ink bg-card px-3 py-2 text-left text-sm text-ink',
    'rounded-lg border border-chase-edge bg-chase-bg px-3 py-2 text-left text-sm text-muted',
    'mt-1 rounded-lg border border-card-line bg-card overflow-hidden',
    'max-h-[320px] overflow-y-auto',
    'flex items-baseline gap-1.5 bg-page px-3 py-1.5 border-b border-line-soft',
    'text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-ink',
    'text-[10.5px] text-faint',
    'w-full block px-3 py-2 text-left text-[13.5px] text-ink hover:bg-page border-b border-line-soft',
    'bg-info-bg text-info font-semibold border-b border-line-soft',
    'block text-[11px] text-faint tabular-nums mt-[1px]',
  ]
  for (const c of lifted) {
    it(`"${c.slice(0, 44)}..."`, () => {
      expect(MOCK, 'not in the approved mock').toContain(c)
      expect(BOX, 'not in the component').toContain(c)
    })
  }

  // THE OFF-WHITE BAND. Fabio: "you do the little off-white between they
  // refer, they wrote, partner firms. Keep that off-white look and feel."
  it('the band between the groups is the page off-white', () => {
    expect(MOCK).toContain('bg-page px-3 py-1.5')
    expect(BOX).toContain('bg-page px-3 py-1.5')
  })
})

describe('the four groups, in the order he asked for', () => {
  it('they referred it, they wrote it, partner firms, everything else', () => {
    expect(KIND_ORDER).toEqual(['referrer', 'broker_split', 'firm', 'other'])
    expect(KIND_HEAD.referrer).toBe('They referred it')
    expect(KIND_HEAD.broker_split).toBe('They wrote it')
    expect(KIND_HEAD.firm).toBe('Partner firms')
    expect(KIND_HEAD.other).toBe('Everything else')
  })

  it('and the mock shows all four', () => {
    for (const k of KIND_ORDER) expect(MOCK).toContain(KIND_HEAD[k])
  })

  it('a kind nobody set falls in with everything else, not with the referrers', () => {
    expect(kindOf('')).toBe('other')
    expect(kindOf('nonsense')).toBe('other')
    expect(kindOf('firm')).toBe('firm')
  })
})

// THE BUG THAT WOULD HAVE MADE THE WHOLE FIX INVISIBLE.
//
// splitFromRow() read the column as "broker_split, or else referrer". So
// setting three rows to 'firm' in the table would have changed nothing at all
// on screen: they would have been read back as referrers before the grouping
// ever saw them.
describe('the kind survives being read', () => {
  it('a partner firm is still a partner firm after splitFromRow', () => {
    expect(splitFromRow({ id: '1', name: 'Navigate Advisors', kind: 'firm' }).kind).toBe('firm')
    expect(splitFromRow({ id: '2', name: 'PeakMax', kind: 'other' }).kind).toBe('other')
  })

  it('and an unset column still reads as a referrer, the way the table defaults', () => {
    expect(splitKind(null)).toBe('referrer')
    expect(splitFromRow({ id: '3', name: 'x' }).kind).toBe('referrer')
  })

  it('the old two-word labels still answer', () => {
    expect(splitGroupLabel('referrer')).toContain('referred')
    expect(splitGroupLabel('broker_split')).toContain('wrote')
    expect(splitGroupLabel('firm')).toBe('Partner firms')
  })
})

// "IT'S A STUPID, IN ENGLISH DOESN'T MAKE SENSE."
//
// The shut box carried the group's own heading, so a chosen deal read "Justin
// Cornock - they referred it". A heading over a list is a sentence about the
// list; the same words beside one name are a sentence about a person, and they
// come out wrong. Fabio: "just say he is the referrer."
describe('what the shut box says after the name', () => {
  it('the referrer, not they referred it', () => {
    expect(kindTail('referrer')).toBe('the referrer')
    expect(kindTail('broker_split')).toBe('the broker')
    expect(MOCK).toContain('the referrer')
    expect(MOCK).not.toContain('&middot; they referred it')
  })

  it('and nothing at all on a firm, whose name says it', () => {
    expect(kindTail('firm')).toBe('')
    expect(kindTail('other')).toBe('')
  })
})

// THE REAL FOURTEEN, as they stand in the table on 19 Nov 2026.
const ROWS = [
  { id: 'r1', name: 'Simplify - Justin Cornock referral', kind: 'referrer' },
  { id: 'r2', name: 'Simplify - Keanen Wood referral', kind: 'referrer' },
  { id: 'b1', name: 'Simplify Finance Brokers - Justin Cornock', kind: 'broker_split' },
  { id: 'b2', name: 'Simplify Finance Brokers - Keanen Wood', kind: 'broker_split' },
  { id: 'b3', name: 'Simplify Finance Brokers - Luke Suidgeest', kind: 'broker_split' },
  { id: 'f1', name: 'Navigate Advisors', kind: 'firm' },
  { id: 'f2', name: 'Simplify - Navigate Advisors', kind: 'firm' },
  { id: 'f3', name: 'New Blue Finance', kind: 'firm' },
  { id: 'o1', name: 'Simplify - Greenwood Estate Agents', kind: 'other' },
  { id: 'o2', name: 'Simplify - PeakMax', kind: 'other' },
].map(splitFromRow)

describe('the real list, grouped', () => {
  const groups = splitGroups(ROWS)

  it('four groups, nothing empty', () => {
    expect(groups.map(g => g.kind)).toEqual(['referrer', 'broker_split', 'firm', 'other'])
    expect(groups.every(g => g.rows.length > 0)).toBe(true)
  })

  it('a Justin in each of the first two, which is the point of the groups', () => {
    expect(groups[0].rows.map(r => r.label)).toEqual(['Justin Cornock', 'Keanen Wood'])
    expect(groups[1].rows.map(r => r.label))
      .toEqual(['Justin Cornock', 'Keanen Wood', 'Luke Suidgeest'])
  })

  // 19 Nov 2026, Fabio on the mock: "they wrote, it makes sense because it has
  // three brokers". The heading is what separates the two Justins, so neither
  // of them needs a line underneath, and the mock draws neither.
  it('and neither Justin carries a second line - the heading separates them', () => {
    expect(groups[0].rows[0].label).toBe('Justin Cornock')
    expect(groups[1].rows[0].label).toBe('Justin Cornock')
    expect(groups[0].rows[0].terms).toBe('')
    expect(groups[1].rows[0].terms).toBe('')
  })

  // The two Navigate rows are in the SAME group, so the heading cannot help.
  it('the two Navigate rows do carry one, because nothing else tells them apart', () => {
    const nav = groups[2].rows.filter(r => r.label === 'Navigate Advisors')
    expect(nav).toHaveLength(2)
    expect(nav.some(r => r.terms !== '')).toBe(true)
  })

  it('every other row is a bare name, the way he asked on 17 Nov', () => {
    const plain = groups.flatMap(g => g.rows).filter(r => r.label !== 'Navigate Advisors')
    expect(plain.every(r => r.terms === '')).toBe(true)
  })
})
