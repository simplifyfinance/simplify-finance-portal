import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { dutyStateOf, dutyLabel, purchaseSuburbOf, isStateCode } from './duty-state'
import { dutyLabelFor } from './purchase-rows'
import { securityState, needsOriginalMortgage } from './milestone-blocks'

// ONE PLACE DECIDES WHICH STATE A PURCHASE IS IN.
//
// 30 Sep 2026, Fabio, looking at an equity-release-plus-purchase email:
// "refinance and purchase template the State is not coming accross?"
//
// It was not, for two reasons that had been sitting there quietly.
//
// The New purchase block had a field LABELLED "State" that wrote into the
// SUBURB. And dutyState - what every stamp duty label actually reads - was not
// on that template's form at all. So the state could not be recorded, and the
// thing that looked like it recorded it was filling a different field.
//
// Nothing caught it because five files each read bc.dutyState for themselves
// and three wrote their own "Stamp duty (NSW)" label. Same shape as the lender
// bug on 29 September: one fact, several readers, free to disagree - and it
// surfaced on a client's email rather than on a screen somebody checks.

describe('reading the state', () => {
  it('takes the real field first', () => {
    expect(dutyStateOf({ dutyState: 'vic' })).toBe('VIC')
  })

  it('rescues a state typed into the box that was labelled wrong', () => {
    expect(dutyStateOf({ newPurchaseSuburb: 'NSW' })).toBe('NSW')
    expect(dutyLabel({ newPurchaseSuburb: 'NSW' })).toBe('Stamp duty (NSW)')
    expect(dutyLabelFor({ newPurchaseSuburb: 'NSW' })).toBe('Stamp duty (NSW)')
  })

  it('never mistakes a suburb for a state', () => {
    expect(dutyStateOf({ newPurchaseSuburb: 'Cronulla' })).toBe('')
    expect(dutyLabel({ newPurchaseSuburb: 'Cronulla' })).toBe('Stamp duty')
    expect(dutyStateOf({})).toBe('')
  })

  it('never lets the stray value outrank the real answer', () => {
    expect(dutyStateOf({ dutyState: 'QLD', newPurchaseSuburb: 'NSW' })).toBe('QLD')
  })

  it('and a state in the suburb box is not printed as a suburb', () => {
    expect(purchaseSuburbOf({ newPurchaseSuburb: 'NSW' })).toBe('')
    expect(purchaseSuburbOf({ newPurchaseSuburb: 'Cronulla' })).toBe('Cronulla')
  })

  it('knows the eight', () => {
    for (const s of ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']) {
      expect(isStateCode(s.toLowerCase())).toBe(true)
    }
    expect(isStateCode('NZ')).toBe(false)
    expect(isStateCode('')).toBe(false)
  })

  // THE OTHER THING THAT WAS SILENTLY WRONG. The original mortgage document
  // line in a formal approval email only appears for WA, TAS and NT - and it
  // reads the same state. On these templates it could never have appeared.
  it('a deal whose state went into the wrong box still gets its mortgage document line', () => {
    const deal = { bc_data: { template: 'investment_equity', newPurchaseSuburb: 'WA' } }
    expect(securityState(deal)).toBe('WA')
    expect(needsOriginalMortgage(deal)).toBe(true)
  })
})

describe('the form asks for it where it can be answered', () => {
  const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  // THE BUG ITSELF, AS A TEST. A field labelled State that writes somewhere
  // else is undetectable by anything but reading it, so this reads it.
  it('every field called State writes into dutyState', () => {
    const blocks = bc.split('<Field label="State">').slice(1)
    expect(blocks.length, 'no State field found - this test is testing nothing').toBeGreaterThan(0)
    blocks.forEach((b, i) => {
      const body = b.slice(0, b.indexOf('</Field>'))
      expect(body, `the State field #${i + 1} does not write into dutyState`).toContain('setDutyState')
    })
  })

  it('and the suburb box is called Suburb', () => {
    // The INPUT, not the useState line above it.
    const i = bc.indexOf('value={newPurchaseSuburb}')
    expect(i, 'the suburb input is not on the form at all').toBeGreaterThan(-1)
    const label = [...bc.slice(0, i).matchAll(/<Field label="([^"]+)"/g)].pop()?.[1]
    expect(label, 'the newPurchaseSuburb box is labelled something other than Suburb').toBe('Suburb')
  })
})

describe('nobody goes round it', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) walk(p, out)
      else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) out.push(p)
    }
    return out
  }
  const files = [...walk('lib'), ...walk('app'), ...walk('components')]

  // COMMENTS ARE NOT CODE. The email HTML gate learned this on 29 September,
  // when it failed a ship over an rgba() inside a comment explaining why rgba()
  // must not be used. Blanked rather than deleted, so line numbers still hold.
  const codeOf = (f: string) => readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, ' '))

  it('found the codebase, so the tests below are testing something', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  // Reading it off BC DATA is the thing that breaks. The LO keeps a copy of its
  // own, filled from dutyStateOf when the deal reaches it, and that is fine.
  it('no other file reads the state off bc_data for itself', () => {
    const offenders = files.filter(f => f !== 'lib/duty-state.ts')
      .filter(f => /\bbc(_data)?\??\.\s*dutyState\b/.test(codeOf(f)))
    expect(offenders,
      'ask dutyStateOf() in lib/duty-state.ts - bc.dutyState is empty on every equity-release template')
      .toEqual([])
  })

  it('and nobody writes their own stamp duty label', () => {
    const offenders = files.filter(f => f !== 'lib/duty-state.ts')
      .filter(f => /Stamp [Dd]uty \(\$\{/.test(codeOf(f)))
    expect(offenders, 'one label, in lib/duty-state.ts').toEqual([])
  })

  it('and nobody prints newPurchaseSuburb raw', () => {
    const allowed = new Set(['lib/duty-state.ts', 'app/(app)/deals/[id]/BCForm.tsx', 'lib/box-fixture.ts'])
    const offenders = files.filter(f => !allowed.has(f))
      .filter(f => /\bnewPurchaseSuburb\b/.test(codeOf(f)))
    expect(offenders, 'ask purchaseSuburbOf() - that box has states typed into it').toEqual([])
  })
})
