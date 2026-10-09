// THE LENDING OPTIONS SPLIT LIST IS MERGED, NEVER REBUILT.
//
// 9 Oct 2026. LOForm replaced the whole list with initRefinanceSplits() on every
// change to the borrowing capacity, and that function mints a new id for every
// split. compliance_data.splitDetail files the term, the product type and the
// IO years under those ids, so each rebuild threw all three away - silently,
// because setDRaw does not save until the broker types one character.
//
// THE FLAG IS SET THE SAFE WAY ROUND. refinanceSplitsByHand is false on a list
// this form built, true once a person changes it, and ABSENT on every deal
// saved before today. Absent is treated as true, so no existing deal is
// touched. Fabio, 9 Oct 2026: "i want to minimise impact on current deals".
//
// Invented clients, invented figures.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { splitsDisagree, splitsOf } from './deal-structure'

const form = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const code = form.replace(/\/\/[^\n]*/g, '')

const BC = [
  { label: 'Land loan', amount: '320,000', rate: '6.14', type: 'P&I' },
  { label: 'Construction loan', amount: '201,000', rate: '6.39', type: 'Interest only' },
]

describe('the re-seed', () => {
  it('no longer throws the list away when the BC changes', () => {
    // The whole fault in one line. If initRefinanceSplits() is called
    // unconditionally here again, every id on the deal changes.
    const effect = code.slice(code.indexOf('refinanceSplits: (prev.refinanceSplits'),
                              code.indexOf('}, [deal.bc_data])'))
    expect(effect, 'the BC is rebuilding the split list again').toBeTruthy()
    expect(effect).toContain('prev.refinanceSplitsByHand === false')
    expect(effect).toContain('mergeWithBc(prev.refinanceSplits)')
  })

  it('keeps the id, which is what the compliance answers are filed under', () => {
    const merge = code.slice(code.indexOf('function mergeWithBc'),
                             code.indexOf('function mergeWithBc') + 700)
    expect(merge).toContain('id: was.id || makeUid()')
  })

  it('keeps the answers the lending options own and the BC does not hold', () => {
    const merge = code.slice(code.indexOf('function mergeWithBc'),
                             code.indexOf('function mergeWithBc') + 700)
    expect(merge).toContain('purpose: was.purpose')
    // Dropped entirely by the old rebuild. purchaseLoan() needs it on a deal
    // that both refinances and buys.
    expect(merge).toContain('funds: was.funds')
  })
})

describe('the flag', () => {
  it('is claimed by the four ways a person changes the list, and only those', () => {
    for (const fn of ['addRefinanceSplit', 'addEquityRelease',
                      'removeRefinanceSplit', 'updateRefinanceSplit']) {
      const body = code.slice(code.indexOf(`function ${fn}`),
                              code.indexOf(`function ${fn}`) + 400)
      expect(body, `${fn} does not claim the list`).toContain('refinanceSplitsByHand: true')
    }
  })

  it('is never claimed by the form copying the BC in', () => {
    // setD is a person; setDRaw is the form arranging itself. If the re-seed
    // ever sets this true, one visit to this tab freezes the list for good.
    const effect = code.slice(code.indexOf('setDRaw(prev => ({'),
                              code.indexOf('}, [deal.bc_data])'))
    expect(effect).not.toContain('refinanceSplitsByHand: true')
  })

  it('marks a list this form creates as a copy, in all three places it creates one', () => {
    expect((code.match(/refinanceSplitsByHand = false|refinanceSplitsByHand: false/g) || []).length)
      .toBeGreaterThanOrEqual(3)
  })
})

describe('when the two lists disagree', () => {
  const deal = (lo: any[], bc: any[] = BC) => ({ bc_data: { splits: bc }, lo_data: { refinanceSplits: lo } })

  it('says nothing when they agree', () => {
    expect(splitsDisagree(deal([
      { id: 'a', label: 'Land loan', amount: '320,000' },
      { id: 'b', label: 'Construction loan', amount: '201,000' },
    ]))).toBeNull()
  })

  it('names a different number of splits', () => {
    const gap = splitsDisagree(deal([{ id: 'a', label: 'End Debt', amount: '521,000' }]))
    expect(gap!.lines.join(' ')).toContain('2 splits')
    expect(gap!.lines.join(' ')).toContain('have 1')
  })

  it('names a different total', () => {
    const gap = splitsDisagree(deal([
      { id: 'a', label: 'Land loan', amount: '320,000' },
      { id: 'b', label: 'Construction loan', amount: '150,000' },
    ]))
    expect(gap!.lines.join(' ')).toContain('$521,000')
    expect(gap!.lines.join(' ')).toContain('$470,000')
  })

  it('stays quiet on a rename, which is usually deliberate', () => {
    expect(splitsDisagree(deal([
      { id: 'a', label: 'Land facility', amount: '320,000' },
      { id: 'b', label: 'Build facility', amount: '201,000' },
    ]))).toBeNull()
  })

  it('stays quiet while one of the two is still empty', () => {
    expect(splitsDisagree(deal([]))).toBeNull()
    expect(splitsDisagree(deal([{ id: 'a', label: 'End Debt', amount: '521,000' }], []))).toBeNull()
  })

  it('reports and changes nothing - the documents still read the lending options', () => {
    const d = deal([{ id: 'a', label: 'End Debt', amount: '521,000' }])
    expect(splitsDisagree(d)).not.toBeNull()
    // The reader is untouched on purpose: correcting this would replace a list
    // somebody may have built by hand.
    expect(splitsOf(d).map(s => s.label)).toEqual(['End Debt'])
  })
})

describe('the strip shows it', () => {
  it('names the disagreement where it already names the others', () => {
    const strip = readFileSync('components/DealStructure.tsx', 'utf8')
    expect(strip).toContain('splitsDisagree(deal)')
    expect(strip).toContain('The two split lists do not match')
  })
})
