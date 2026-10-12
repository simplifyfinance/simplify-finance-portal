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

  // THE EFFECT WAS NEVER THE PATH THAT MATTERED.
  //
  // It fires on mount. Every record that arrives afterwards - the first load
  // finishing, a realtime update, a save adopting what the database returned -
  // goes through loShape instead, and loShape used to put the stored list back
  // untouched. The merge was real and was undone seconds later, which is why
  // the Veljovic deal still read two splits after the flag was retired.
  it('merges on the path a record actually arrives by, not just on mount', () => {
    const shape = code.slice(code.indexOf('function loShape'),
                             code.indexOf('function loShape') + 1600)
    expect(shape, 'loShape is putting the stored split list back untouched')
      .toContain('mergeWithBc(loaded.refinanceSplits)')
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

  // THIS TEST SAID THE OPPOSITE THIS MORNING, AND THE DEAL PROVED IT WRONG.
  //
  // It read "reports and changes nothing - it is a warning, not a correction",
  // and asserted splitsOf returned the lending options' one split while the BC
  // held two. I wrote that believing the tab reconciled the lists on load, so
  // this function would only ever see them agree.
  //
  // The tab does reconcile - on screen. A load never writes (writeNow: arrival
  // is not an edit), so the DATABASE keeps whatever it had. And the broker
  // notes PDF reads the deal from the database and comes through here. On the
  // Veljovic deal that meant the compliance pack was built from two splits and
  // $1,020,000 while the deal was six splits and $2,720,000 - a regulated
  // document describing a loan nobody was writing, with no warning on it,
  // because the warning is on a screen nobody had to open.
  //
  // So splitsOf follows the BC too. The warning still appears, and it is still
  // a warning rather than the thing doing the work - but what the documents say
  // no longer depends on whether somebody opened a tab.
  it('follows the borrowing capacity, so the documents cannot be left behind', () => {
    const d = deal([{ id: 'a', label: 'End Debt', amount: '521,000' }])
    expect(splitsDisagree(d)).not.toBeNull()
    expect(splitsOf(d).map(s => s.label)).toEqual(['Land loan', 'Construction loan'])
    expect(splitsOf(d).map(s => s.amount)).toEqual(['320,000', '201,000'])
  })

  // AND FOLLOWING IS NOT DELETING. A split typed straight onto the lending
  // options - an equity release the BC has not caught up with - is kept on the
  // end, which is the same rule mergeWithBc follows on the tab.
  it('keeps a split the lending options added beyond the BC list', () => {
    const d = deal([
      { id: 'a', label: 'Land loan', amount: '320,000' },
      { id: 'b', label: 'Construction loan', amount: '201,000' },
      { id: 'c', label: 'Equity release', amount: '80,000' },
    ])
    expect(splitsOf(d).map(s => s.label)).toEqual(['Land loan', 'Construction loan', 'Equity release'])
  })

  // THE IDS ARE THE LENDING OPTIONS', NOT POSITIONS MINTED HERE.
  // compliance_data.splitDetail files the term, the product type and the IO
  // years under them. BC splits carry no id at all, so taking the BC's would
  // orphan all three on every deal already written.
  it('keeps the ids the compliance answers are filed under', () => {
    const d = deal([
      { id: 'uid-1', label: 'Land loan', amount: '320,000' },
      { id: 'uid-2', label: 'Construction loan', amount: '201,000' },
    ])
    expect(splitsOf(d).map(s => s.id)).toEqual(['uid-1', 'uid-2'])
  })

  // The pricing and the answers that are this tab's to give are still read off
  // the lending options' row, not thrown away with its structure.
  it('still reads the lending options own answers off their own row', () => {
    const d = deal([
      { id: 'uid-1', label: 'whatever', amount: '1', purpose: 'INV', funds: 'refinance' },
      { id: 'uid-2', label: 'whatever', amount: '1', purpose: 'OO' },
    ])
    expect(splitsOf(d).map(s => s.purpose)).toEqual(['INV', 'OO'])
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

// EVERY LIST YOU CAN ADD TO, YOU CAN TAKE FROM.
//
// 13 Oct 2026. The deal strip had "+ Add split" and nothing else. Fabio pressed
// it four times on the Veljovic deal and the list could only grow: "I dont have
// the ability to delete splits on LO? come on".
//
// The remove is deliberately NOT on every row. The borrowing capacity owns the
// first n splits, and one deleted here would be back on the next load - the
// merge puts it straight back, which is the whole point of the merge. A button
// that undoes itself is worse than no button, so it appears only on the ones
// this tab added beyond the BC's list, which are genuinely its own.
describe('the splits can be taken away as well as added', () => {
  const strip = readFileSync('components/DealStructure.tsx', 'utf8')

  it('the strip offers a remove at all', () => {
    expect(strip).toContain('onRemoveSplit')
    expect(strip, 'the remove is not reaching the row').toContain('onRemoveSplit(i)')
  })

  it('only on the splits the lending options added beyond the BC', () => {
    expect(strip).toContain('i >= bcOwned')
    expect(strip).toContain("const bcOwned: number = (deal?.bc_data?.splits || []).length")
  })

  it('and the lending options tab hands it one', () => {
    expect(form).toContain('onRemoveSplit={removeRefinanceSplit}')
  })

  // Compliance draws the same block and must not be able to change the LO's
  // mind - it passes no handlers, so no remove is drawn there either.
  it('but only where the tab is allowed to write to lo_data', () => {
    const compliance = readFileSync('app/(app)/deals/[id]/ComplianceForm.tsx', 'utf8')
    expect(compliance).not.toContain('onRemoveSplit')
  })

  // The banner used to send him somewhere else to do it. There is a button now.
  it('and the warning points at the button instead of sending you away', () => {
    expect(strip).not.toContain('or remove it there')
    expect(strip).toContain('Remove it below with the')
  })
})
