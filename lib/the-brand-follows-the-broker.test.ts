// THE BRAND FOLLOWS THE BROKER, NOT THE SPELLING OF THEIR NAME.
//
// 27 Oct 2026. Catherine: "When Navigate is selected at the BC level, it
// switches back to Simplify Finance after moving on."
//
// The fixture below is the real register, with the real keys. `deals` stores
// "justin"; the brand list stores "Justin Cornock". That mismatch is the whole
// fault, so it is the first thing this file asserts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  normaliseBrokers, brandsHeldBy, brandsOffered, brandToSettleOn, brandUncertainty,
} from './the-brand-follows-the-broker'

const BRANDS = [
  { id: 'simplify', name: 'Simplify Finance' },
  { id: 'navigate', name: 'Navigate' },
]

// public.brokers, where brands actually live.
const REGISTER = [
  { broker_key: 'fabio', name: 'Fabio de Castro', brand_ids: ['simplify'] },
  { broker_key: 'justin', name: 'Justin Cornock', brand_ids: ['simplify', 'navigate'] },
  { broker_key: 'mark', name: 'Mark Gallo', brand_ids: ['simplify'] },
  { broker_key: 'gone', name: 'A Leaver', brand_ids: ['simplify'], active: false },
]

describe('a key and a full name are the same person', () => {
  it('which is the bug, in one line', () => {
    // This is what the old code did: 'Justin Cornock' === 'justin'.
    expect('Justin Cornock' === ('justin' as any)).toBe(false)
    // And this is what it does now.
    expect(brandsHeldBy(REGISTER, 'justin')).toEqual(['simplify', 'navigate'])
  })

  it('from either direction', () => {
    expect(brandsHeldBy(REGISTER, 'Justin Cornock')).toEqual(['simplify', 'navigate'])
    expect(brandsHeldBy(REGISTER, 'JUSTIN')).toEqual(['simplify', 'navigate'])
  })

  it('and the old settings list reads the same as the brokers table', () => {
    const OLD = [{ name: 'Justin Cornock', brandIds: ['simplify', 'navigate'] }]
    expect(brandsHeldBy(OLD, 'justin')).toEqual(['simplify', 'navigate'])
  })

  it('somebody who has left is not a broker', () => {
    expect(brandsHeldBy(REGISTER, 'gone')).toBeNull()
  })

  it('normalising keeps the key, the name and the brands', () => {
    expect(normaliseBrokers([REGISTER[1]])).toEqual([
      { key: 'justin', name: 'Justin Cornock', brands: ['simplify', 'navigate'] },
    ])
  })
})

describe('what the dropdown offers', () => {
  it('a broker with two brands gets two', () => {
    expect(brandsOffered(REGISTER, 'justin', BRANDS).map(b => b.id))
      .toEqual(['simplify', 'navigate'])
  })

  it('a broker with one gets one', () => {
    expect(brandsOffered(REGISTER, 'mark', BRANDS).map(b => b.id)).toEqual(['simplify'])
  })

  it('and a broker nobody has recorded gets ALL of them, not Simplify', () => {
    // The old fallback was `|| ['simplify']`. It is the worst possible guess:
    // it is the one that puts our credit licence on another brand's email.
    expect(brandsOffered(REGISTER, 'nobody', BRANDS).map(b => b.id))
      .toEqual(['simplify', 'navigate'])
  })

  it('a broker whose brands are not in the register gets all of them too', () => {
    // Rather than an empty dropdown and no way to send anything.
    const odd = [{ broker_key: 'x', name: 'X', brand_ids: ['retired-brand'] }]
    expect(brandsOffered(odd, 'x', BRANDS)).toHaveLength(2)
  })
})

describe('what gets written onto the deal', () => {
  it('fills a blank, because a blank falls through to the default brand', () => {
    expect(brandToSettleOn(REGISTER, 'justin', BRANDS, '')).toBe('simplify')
  })

  it('leaves a brand the broker holds completely alone', () => {
    expect(brandToSettleOn(REGISTER, 'justin', BRANDS, 'navigate')).toBeNull()
  })

  it('THE ONE CATHERINE SAW: it no longer overwrites Navigate with Simplify', () => {
    // Deal is Justin's, stored as the key, with Navigate chosen on the BC.
    // Before today this returned 'simplify' and the lending options wrote it.
    expect(brandToSettleOn(REGISTER, 'justin', BRANDS, 'navigate')).toBeNull()
  })

  it('and where we do not know the broker, it touches nothing', () => {
    expect(brandToSettleOn(REGISTER, 'nobody', BRANDS, 'navigate')).toBeNull()
  })

  it('but still fills a blank for an unknown broker, with the first brand', () => {
    // Blank is not a safe resting place - it resolves to the default brand in
    // lib/brand.ts without anybody choosing.
    expect(brandToSettleOn(REGISTER, 'nobody', BRANDS, '')).toBe('simplify')
  })

  it('and corrects a brand a known broker demonstrably cannot use', () => {
    expect(brandToSettleOn(REGISTER, 'mark', BRANDS, 'navigate')).toBe('simplify')
  })

  it('with no brands at all it writes nothing rather than inventing one', () => {
    expect(brandToSettleOn(REGISTER, 'justin', [], 'navigate')).toBeNull()
  })
})

describe('and it says when it is unsure', () => {
  it('names the broker and asks somebody to look', () => {
    const msg = brandUncertainty(REGISTER, 'Sam Unknown')
    expect(msg).toContain('Sam Unknown')
    expect(msg).toContain('Check this is the right one')
  })

  it('and says nothing at all when it knows', () => {
    expect(brandUncertainty(REGISTER, 'justin')).toBe('')
  })
})

// THE TWO FORMS READ THE SAME ANSWER.
//
// They had a copy of this logic each, and the copies agreed - which is why one
// bug was two bugs. Neither may work a brand out for itself again.
describe('neither form decides this for itself', () => {
  const FORMS = ['app/(app)/deals/[id]/BCForm.tsx', 'app/(app)/deals/[id]/LOForm.tsx']

  it('both ask this file', () => {
    for (const f of FORMS) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} is not reading the shared answer`)
        .toContain("from '@/lib/the-brand-follows-the-broker'")
      expect(src).toContain('brandsOffered(')
      expect(src).toContain('brandToSettleOn(')
    }
  })

  it('and neither compares a broker by name any more', () => {
    for (const f of FORMS) {
      // Code only - a comment describing the old line is not the old line.
      const src = readFileSync(f, 'utf8').split('\n')
        .filter(l => !l.trim().startsWith('//')).join('\n')
      expect(src, `${f} still matches a broker with ===`)
        .not.toContain('b.name === ')
      expect(src, `${f} still falls back to Simplify on its own`)
        .not.toContain("?.brandIds || ['simplify']")
    }
  })

  it('and both read the brokers table, where brands live', () => {
    for (const f of FORMS) {
      expect(readFileSync(f, 'utf8'), `${f} still reads the frozen settings list first`)
        .toContain("from('brokers').select('broker_key, name, brand_ids, active')")
    }
  })
})

// THE REGISTER AS IT ACTUALLY IS, 27 Oct 2026.
//
// Brand ids are timestamps, not slugs - "1784774195128" is Navigate and
// "1787804232890" is SimplifyBA. A fixture using tidy names like 'navigate'
// would pass while the live data failed, so the live shape is tested too.
describe('the register as it really is', () => {
  const LIVE_BRANDS = [
    { id: 'simplify', name: 'Simplify Finance' },
    { id: '1784774195128', name: 'Navigate' },
    { id: '1787804232890', name: 'SimplifyBA' },
  ]
  const LIVE = [
    { broker_key: 'fabio', name: 'Fabio de Castro', brand_ids: ['simplify'] },
    { broker_key: 'justin', name: 'Justin Cornock', brand_ids: ['simplify', '1784774195128'] },
    { broker_key: 'keanen', name: 'Keanen Wood', brand_ids: ['simplify'] },
    { broker_key: 'kylie', name: 'Kylie Searle', brand_ids: ['simplify', '1787804232890'] },
    { broker_key: 'mark', name: 'Mark Gallo', brand_ids: ['simplify'] },
  ]

  it('Justin is offered Navigate, which is the whole complaint', () => {
    expect(brandsOffered(LIVE, 'justin', LIVE_BRANDS).map(b => b.name))
      .toEqual(['Simplify Finance', 'Navigate'])
  })

  it('and keeps it once it is chosen', () => {
    expect(brandToSettleOn(LIVE, 'justin', LIVE_BRANDS, '1784774195128')).toBeNull()
  })

  it('Kylie is offered SimplifyBA - the old settings list did not even know', () => {
    // settings.brokers had Kylie on one brand; public.brokers has her on two.
    expect(brandsOffered(LIVE, 'kylie', LIVE_BRANDS).map(b => b.name))
      .toEqual(['Simplify Finance', 'SimplifyBA'])
  })

  it('Mark is offered Simplify only, because that is what he holds', () => {
    expect(brandsOffered(LIVE, 'mark', LIVE_BRANDS).map(b => b.name)).toEqual(['Simplify Finance'])
  })

  it('and a deal of Mark\u2019s on Navigate is corrected, not left wrong', () => {
    expect(brandToSettleOn(LIVE, 'mark', LIVE_BRANDS, '1784774195128')).toBe('simplify')
  })

  it('every broker in the register resolves - none falls through to the guess', () => {
    for (const b of LIVE) {
      expect(brandsHeldBy(LIVE, b.broker_key), `${b.broker_key} did not resolve`).not.toBeNull()
    }
  })
})
