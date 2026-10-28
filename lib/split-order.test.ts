import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { inOrder, pinnedRank, normalise, termsShort, PINNED_ORDER } from './split-order'

// THE ORDER THE COMMISSION SPLITS ARE OFFERED IN.
//
// 28 Oct 2026. Fourteen arrangements, alphabetical, every line repeating the
// name and spelling out "upfront" and "trail", and no way to find anything.
// Fabio: "it's very, very messy... my team is getting lost."
//
// He gave the order himself, which is the only order worth having.
//
// The arrangements here are invented, but each one is shaped like a real
// problem: a name worded three different ways, a first name that appears in two
// different arrangements, a brand new one nobody has told this file about.

const BOX = readFileSync(join(__dirname, '..', 'components', 'WhoSharesThisDeal.tsx'), 'utf8')

const split = (name: string) => ({ name })
const names = (xs: Array<{ name: string }>) => xs.map(x => x.name)

describe('FABIO’S ORDER', () => {
  const all = [
    split('Westbourne Mortgages'),
    split('Simplify broker — Luke Arakelian'),
    split('Navigate Advisors'),
    split('Simplify Justin Cornock referral'),
    split('Ashgrove Wealth'),
    split('Simplify broker — Justin Cornock'),
    split('Simplify Kenan Wood referral'),
    split('Simplify broker — Kenan Wood'),
  ]
  const { shown, rest } = inOrder(all, s => s.name)

  it('puts the two referrals first, then Navigate, then the three broker splits', () => {
    expect(names(shown)).toEqual([
      'Simplify Justin Cornock referral',
      'Simplify Kenan Wood referral',
      'Navigate Advisors',
      'Simplify broker — Justin Cornock',
      'Simplify broker — Kenan Wood',
      'Simplify broker — Luke Arakelian',
    ])
  })

  it('AND A REFERRAL BEATS A BROKER SPLIT WITH THE SAME FIRST NAME', () => {
    // Both carry "Justin". The referral is the one they reach for first, so
    // first match wins and the referral rule sits above the broker one.
    expect(pinnedRank('Simplify Justin Cornock referral'))
      .toBeLessThan(pinnedRank('Simplify broker — Justin Cornock'))
  })

  it('and everything else falls below the fold, alphabetically', () => {
    expect(names(rest)).toEqual(['Ashgrove Wealth', 'Westbourne Mortgages'])
  })

  it('A NEW ARRANGEMENT NOBODY TOLD THIS FILE ABOUT IS NOT A FAULT', () => {
    // Fabio: "anything else that is added sits on the expansion pack."
    const { shown, rest } = inOrder([...all, split('Brightwater Finance')], s => s.name)
    expect(names(rest)).toContain('Brightwater Finance')
    expect(shown).toHaveLength(6)
  })
})

describe('IT MATCHES ON WORDS, NOT ON AN EXACT NAME', () => {
  // The list lives in a table people rename things in. An exact-name order
  // would drop an arrangement to the bottom the first time somebody tidied the
  // wording, and nobody would know why.
  it('the same arrangement worded three ways lands in the same place', () => {
    for (const written of [
      'Simplify broker — Justin Cornock',
      'Simplify Broker Split - Justin',
      'SIMPLIFY  BROKER / JUSTIN CORNOCK',
    ]) expect(pinnedRank(written), written).toBe(3)
  })

  it('punctuation and case are nothing', () => {
    expect(normalise('Simplify Broker — Justin (50/50)')).toBe('simplify broker justin 50 50')
  })

  it('and a name that matches nothing is not pinned', () => {
    for (const other of ['Ashgrove Wealth', '', null, undefined]) {
      expect(pinnedRank(other as any), String(other)).toBe(-1)
    }
  })

  it('the order has six entries, which is what was asked for', () => {
    expect(PINNED_ORDER).toHaveLength(6)
  })
})

describe('THE NAME, AND TWO NUMBERS', () => {
  // "Aspire Partners — Aspire Partners 20% upfront, 20% trail" said the name
  // twice and then spelled out two words everybody here already knows.
  it('upfront then trail', () => {
    expect(termsShort([{ upfront: 20, trail: 20 }])).toBe('20 / 20')
    expect(termsShort([{ upfront: 60, trail: 40 }])).toBe('60 / 40')
  })

  it('everybody on the same terms is said once, not three times', () => {
    expect(termsShort([
      { who: 'Justin Cornock', upfront: 50, trail: 50 },
      { who: 'Kenan Wood', upfront: 50, trail: 50 },
    ])).toBe('50 / 50 each')
  })

  it('but people on different terms are named', () => {
    expect(termsShort([
      { who: 'Justin Cornock', upfront: 60, trail: 60 },
      { who: 'Kenan Wood', upfront: 40, trail: 40 },
    ])).toBe('Justin 60 / 60 · Kenan 40 / 40')
  })

  it('and half an answer says which half it is', () => {
    expect(termsShort([{ upfront: 20, trail: null }])).toBe('20 upfront')
    expect(termsShort([{ upfront: null, trail: 15 }])).toBe('15 trail')
  })

  it('nothing known is nothing printed, rather than a stray slash', () => {
    expect(termsShort([{ upfront: null, trail: null }])).toBe('')
    expect(termsShort([])).toBe('')
  })
})

describe('THE BOX ON SCREEN', () => {
  it('is called Commission splits', () => {
    // Fabio: "Is this deal shared with anybody? That's stupid. Just put
    // commission splits."
    expect(BOX).toContain('Commission splits')
    expect(BOX).toContain('aria-label="Commission splits"')
    expect(BOX).not.toContain('aria-label="Is this deal shared with anybody?"')
  })

  it('and not sharing is the first thing on the list, in his words', () => {
    expect(BOX).toContain('Simplify only — 100%')
    expect(BOX).not.toContain('Nobody — this one is all ours')
  })

  it('and it reads the deal from the database, not from a prop', () => {
    // THE WHOLE SAVE BUG. `live` started from a copy taken at page load, so a
    // tab change rebuilt the box from a snapshot that pre-dated the answer.
    expect(BOX).toContain("supabase.from('deals').select(")
    expect(BOX).toContain('commission_split_none')
  })

  it('and it still refuses to make the order up for itself', () => {
    expect(BOX).toContain("from '@/lib/split-order'")
    expect(BOX).toContain('inOrder(')
    expect(BOX).not.toContain('localeCompare')
  })
})
