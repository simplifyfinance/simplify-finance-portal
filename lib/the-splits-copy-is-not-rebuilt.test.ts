// THE LENDING OPTIONS SPLIT LIST FOLLOWS THE BORROWING CAPACITY. ALWAYS.
//
// 9 Oct 2026. LOForm replaced the whole list with initRefinanceSplits() on every
// change to the borrowing capacity, and that function mints a new id for every
// split. compliance_data.splitDetail files the term, the product type and the
// IO years under those ids, so each rebuild threw all three away - silently.
// mergeWithBc fixed that by keeping the id and this tab's own answers.
//
// 12 Oct 2026. A SECOND FIX WENT IN THE SAME DAY AND WAS WRONG. A flag,
// refinanceSplitsByHand, froze the list the moment anybody typed in it - one
// keystroke, for good. On the Veljovic deal that held the lending options at two
// splits while the borrowing capacity went on to six, so three properties read
// "no loan against this property yet" and both the client email and the
// compliance pack described a deal nobody was writing.
//
// Fabio: "WHY would all the work done in BC in terms of structure and splits
// carry accross to LO?? theres no logical explantion for it".
//
// There is none. The borrowing capacity owns the structure - how many splits,
// their names, their amounts, which house each secures. The lending options own
// the pricing. The flag is retired and nothing reads it. See docs/the-chain.md.
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
  it('merges from the BC rather than rebuilding, so the ids survive', () => {
    const effect = code.slice(code.indexOf('refinanceSplits: (prev.refinanceSplits'),
                              code.indexOf('}, [deal.bc_data])'))
    expect(effect, 'the BC is rebuilding the split list again').toBeTruthy()
    expect(effect).toContain('mergeWithBc(prev.refinanceSplits)')
  })

  // THE FAULT THIS FILE NOW EXISTS FOR. Nothing may stand between the borrowing
  // capacity and this list.
  it('merges every time, with nothing allowed to switch it off', () => {
    const effect = code.slice(code.indexOf('refinanceSplits: (prev.refinanceSplits'),
                              code.indexOf('}, [deal.bc_data])'))
    expect(effect, 'something is gating the merge again').not.toContain('refinanceSplitsByHand')
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

// RETIRED, AND IT STAYS RETIRED.
describe('the flag that froze the list', () => {
  it('is never set by anything again', () => {
    expect(code).not.toContain('refinanceSplitsByHand: true')
  })

  it('is never read to decide what the list holds', () => {
    expect(code).not.toContain('refinanceSplitsByHand ===')
    expect(code).not.toContain('refinanceSplitsByHand ?')
  })
})

// A SPLIT THIS TAB ADDED IS NOT DELETED BY THE MERGE.
//
// mergeWithBc walks the BC's list, so anything beyond the end of it - an equity
// release typed straight onto the lending options - would fall off. Following
// the borrowing capacity is not the same as deleting what it has not got.
describe('a split the lending options added', () => {
  it('survives the merge', () => {
    const merge = code.slice(code.indexOf('function mergeWithBc'),
                             code.indexOf('function mergeWithBc') + 1400)
    expect(merge).toContain('existing.slice(bcSplits.length)')
    expect(merge).toContain('[...merged, ...extra]')
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

  // IT SHOULD NOW BE ALMOST SILENT. The lists reconcile themselves on every
  // load, so the only thing left for this to catch is a split living on the
  // lending options that the borrowing capacity has never heard of - structure
  // in a place that does not own it, which the client never agreed to.
  //
  // Fabio, 12 Oct 2026: "hopefully these warning saying split dont match will be
  // far and between and only show if there is a real error in place".
  it('reports and changes nothing - it is a warning, not a correction', () => {
    const d = deal([{ id: 'a', label: 'End Debt', amount: '521,000' }])
    expect(splitsDisagree(d)).not.toBeNull()
    expect(splitsOf(d).map(s => s.label)).toEqual(['End Debt'])
  })

  it('and the strip no longer tells you to go and reconcile it by hand', () => {
    const strip = readFileSync('components/DealStructure.tsx', 'utf8')
    expect(strip).not.toContain('make the two agree')
    expect(strip).toContain('follow the borrowing capacity now')
  })
})

describe('the strip shows it', () => {
  it('names the disagreement where it already names the others', () => {
    const strip = readFileSync('components/DealStructure.tsx', 'utf8')
    expect(strip).toContain('splitsDisagree(deal)')
    expect(strip).toContain('The two split lists do not match')
  })
})
