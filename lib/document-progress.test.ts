import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  rowsFor, tickedCount, withTick, withAdded, withoutAdded, progressOf, COMMON_EXTRAS,
  extrasNotAlreadyListed,
  toRequest, withRequest, withDeferred, requestRounds,
} from './document-progress'
import type { DocItem } from './document-rules'

const item = (key: string, auto: boolean, over: Partial<DocItem> = {}): DocItem => ({
  key, label: key, group: 'applicant', groupKey: 'a1', groupLabel: 'Sarah Chapman',
  forWhat: 'lodge', round: 'proceed', auto, ...over,
})

const items = [item('payslips:a1', true), item('bas:a1', false)]

describe('reading the list back', () => {
  it('follows the fact find when nobody has decided anything', () => {
    const rows = rowsFor(items, {})
    expect(rows.find(r => r.key === 'payslips:a1')!.ticked).toBe(true)
    expect(rows.find(r => r.key === 'bas:a1')!.ticked).toBe(false)
  })

  // THE RULE THAT MATTERS. Somebody unticking a row knows something the fact
  // find does not, and it must survive.
  it('lets a person overrule the fact find, both ways', () => {
    const p = withTick(withTick({}, 'payslips:a1', false, 'Fabio'), 'bas:a1', true, 'Fabio')
    const rows = rowsFor(items, p)
    expect(rows.find(r => r.key === 'payslips:a1')!.ticked).toBe(false)
    expect(rows.find(r => r.key === 'bas:a1')!.ticked).toBe(true)
  })

  it('remembers who decided', () => {
    const p = withTick({}, 'payslips:a1', false, 'Katie Lawson')
    expect(rowsFor(items, p).find(r => r.key === 'payslips:a1')!.decidedBy).toBe('Katie Lawson')
  })

  it('an untick survives the fact find changing underneath it', () => {
    const p = withTick({}, 'bonus-payslip:a1', false, 'Fabio')
    // The bonus is still recorded, so the rule still produces the row...
    const later = [...items, item('bonus-payslip:a1', true)]
    // ...and it is still unticked, because the decision was about the document.
    expect(rowsFor(later, p).find(r => r.key === 'bonus-payslip:a1')!.ticked).toBe(false)
  })

  // A key that is no longer produced simply stops appearing. The decision stays
  // filed harmlessly in case the liability comes back.
  it('ignores a decision about something that is no longer on the list', () => {
    const p = withTick({}, 'cc-statement:gone', false, 'Fabio')
    const rows = rowsFor(items, p)
    expect(rows).toHaveLength(2)
    expect(rows.some(r => r.key === 'cc-statement:gone')).toBe(false)
  })

  it('counts what is actually ticked', () => {
    expect(tickedCount(rowsFor(items, {}))).toBe(1)
    expect(tickedCount(rowsFor(items, withTick({}, 'bas:a1', true, 'F')))).toBe(2)
  })
})

describe('adding something no rule would produce', () => {
  it('appears, ticked, and says who added it', () => {
    const p = withAdded({}, "Accountant's letter", 'lodge', 'Fabio')
    const added = rowsFor(items, p).filter(r => r.addedByHand)
    expect(added).toHaveLength(1)
    expect(added[0].label).toBe("Accountant's letter")
    expect(added[0].ticked).toBe(true)
    expect(added[0].why).toBe('Added by Fabio')
  })

  it('can be unticked like any other row', () => {
    let p = withAdded({}, 'Letter of employment', 'lodge', 'Fabio')
    const key = p.added![0].key
    p = withTick(p, key, false, 'Katie')
    expect(rowsFor(items, p).find(r => r.key === key)!.ticked).toBe(false)
  })

  it('can be removed, and takes its decision with it', () => {
    let p = withAdded({}, 'Trust deed', 'lodge', 'Fabio')
    const key = p.added![0].key
    p = withTick(p, key, false, 'Fabio')
    p = withoutAdded(p, key)
    expect(p.added).toHaveLength(0)
    expect(p.decisions?.[key]).toBeUndefined()
  })

  it('gives two people adding the same thing two rows', () => {
    let p = withAdded({}, "Accountant's letter", 'lodge', 'Fabio')
    p = withAdded(p, "Accountant's letter", 'lodge', 'Katie')
    expect(p.added).toHaveLength(2)
    expect(new Set(p.added!.map(a => a.key)).size).toBe(2)
  })

  it('refuses an empty label rather than making a blank row', () => {
    expect(withAdded({}, '   ', 'lodge', 'Fabio').added).toBeUndefined()
  })

  it('trims what was typed', () => {
    const p = withAdded({}, '  Statement of position  ', 'compliance', 'Fabio', '  last 2 years ')
    expect(p.added![0].label).toBe('Statement of position')
    expect(p.added![0].detail).toBe('last 2 years')
  })

  it('does not invent an empty detail', () => {
    expect(withAdded({}, 'Visa grant notice', 'lodge', 'F', '   ').added![0].detail).toBeUndefined()
  })
})

describe('writing never changes what it was given', () => {
  it('leaves the original alone', () => {
    const before = withAdded({}, 'Trust deed', 'lodge', 'Fabio')
    const snapshot = JSON.stringify(before)
    withTick(before, 'payslips:a1', false, 'Katie')
    withAdded(before, 'Another', 'lodge', 'Katie')
    withoutAdded(before, before.added![0].key)
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('reading a deal that has never been touched', () => {
  it('copes with anything', () => {
    for (const d of [{}, null, undefined, { document_progress: null }, { document_progress: 'nonsense' }]) {
      expect(progressOf(d)).toEqual(expect.any(Object))
      expect(() => rowsFor(items, progressOf(d))).not.toThrow()
    }
  })

  it('reads a real one back', () => {
    const stored = { decisions: { 'bas:a1': { ticked: true, at: '2026-09-03', by: 'Fabio' } } }
    expect(rowsFor(items, progressOf({ document_progress: stored })).find(r => r.key === 'bas:a1')!.ticked).toBe(true)
  })
})

describe('the extras list', () => {
  it('has no duplicates and every entry says which pile it goes in', () => {
    expect(new Set(COMMON_EXTRAS.map(e => e.label)).size).toBe(COMMON_EXTRAS.length)
    for (const e of COMMON_EXTRAS) expect(['lodge', 'compliance']).toContain(e.forWhat)
  })
})

describe('what the request button would actually send', () => {
  it('sends the ticked rows and skips the rest', () => {
    const rows = rowsFor(items, {})
    expect(toRequest(rows).map(r => r.key)).toEqual(['payslips:a1'])
  })

  // THE POINT OF RECORDING A REQUEST AT ALL. Without this, pressing the button
  // twice asks the client again for the payslips they already sent.
  it('never asks twice for the same document', () => {
    const p = withRequest({}, ['payslips:a1'], 'Fabio')
    expect(toRequest(rowsFor(items, p))).toHaveLength(0)
  })

  it('sends only what is new after something is added', () => {
    let p = withRequest({}, ['payslips:a1'], 'Fabio')
    p = withAdded(p, "Accountant's letter", 'lodge', 'Katie')
    const next = toRequest(rowsFor(items, p))
    expect(next).toHaveLength(1)
    expect(next[0].label).toBe("Accountant's letter")
  })

  it('shows when a row was asked for', () => {
    const p = withRequest({}, ['payslips:a1'], 'Fabio', '2026-09-03T01:00:00.000Z')
    expect(rowsFor(items, p).find(r => r.key === 'payslips:a1')!.requestedAt)
      .toBe('2026-09-03T01:00:00.000Z')
  })

  it('keeps every round, because "what did we ask for, and when" gets asked later', () => {
    let p = withRequest({}, ['a'], 'Fabio', '2026-09-01T00:00:00.000Z')
    p = withRequest(p, ['b'], 'Katie', '2026-09-05T00:00:00.000Z')
    expect(requestRounds(p)).toHaveLength(2)
    expect(requestRounds(p)[1].by).toBe('Katie')
  })

  it('records nothing for an empty press', () => {
    expect(withRequest({}, [], 'Fabio').requests).toBeUndefined()
  })

  it('does not double-record a key sent twice in one press', () => {
    expect(withRequest({}, ['a', 'a', 'b'], 'F').requests![0].keys).toEqual(['a', 'b'])
  })

  it('holds back a row that is still asking to be decided', () => {
    const discharge = [item('discharge', false, { askFirst: true })]
    expect(toRequest(rowsFor(discharge, withTick({}, 'discharge', true, 'F')))).toHaveLength(0)
  })
})

describe('putting the discharge off until formal approval', () => {
  const discharge = [item('discharge', false, { askFirst: true, label: 'Discharge of mortgage' })]

  it('takes it off the list when somebody says not yet', () => {
    const p = withDeferred({}, 'discharge', 'Fabio')
    expect(rowsFor(discharge, p)).toHaveLength(0)
  })

  // The whole reason for deferring rather than unticking: it comes back without
  // anybody having to remember it.
  it('brings it back, ticked, once the loan is formally approved', () => {
    const p = withDeferred({}, 'discharge', 'Fabio')
    const rows = rowsFor(discharge, p, { formallyApproved: true })
    expect(rows).toHaveLength(1)
    expect(rows[0].ticked).toBe(true)
    expect(rows[0].askFirst).toBe(false)
    expect(rows[0].why).toContain('formally approved')
  })

  it('can still be unticked once it is back', () => {
    let p = withDeferred({}, 'discharge', 'Fabio')
    p = withTick(p, 'discharge', false, 'Katie')
    expect(rowsFor(discharge, p, { formallyApproved: true })[0].ticked).toBe(false)
  })

  it('clears an earlier tick, so a yes then a not-yet does not contradict itself', () => {
    let p = withTick({}, 'discharge', true, 'Fabio')
    p = withDeferred(p, 'discharge', 'Fabio')
    expect(p.decisions?.discharge).toBeUndefined()
    expect(rowsFor(discharge, p)).toHaveLength(0)
  })

  it('leaves everything else alone', () => {
    const p = withDeferred({}, 'discharge', 'Fabio')
    expect(rowsFor(items, p)).toHaveLength(2)
  })
})

// EVERY DOCUMENT THE RULES CAN PRODUCE MUST BE PICKABLE BY HAND.
//
// 10 Sep 2026. The extras list held only documents the rules never produce, so
// anything produced CONDITIONALLY could not be added manually on a deal where
// the condition did not hold. Fabio hit it on a purchase: "this screenshot is a
// purchase so Discharge Form shouldn't be automatically requested, but I should
// still be able to manually select it."
//
// The labels are read out of document-rules.ts rather than listed here, so a
// document added to the rules tomorrow fails this until it is offered too.
describe('the manual list is not conditional', () => {
  const ruleLabels = () => {
    const src = readFileSync(new URL('./document-rules.ts', import.meta.url), 'utf8')
    const out = new Set<string>()
    for (const m of src.matchAll(/label: '([^']+)'/g)) out.add(m[1])
    for (const m of src.matchAll(/label: "([^"]+)"/g)) out.add(m[1])
    // Statements are built with the bank appended - named('Credit card
    // statement') and `Home loan statement — ${bank}`. The plain label is what
    // has to be offerable, so it is what this collects.
    for (const m of src.matchAll(/named\('([^']+)'\)/g)) out.add(m[1])
    for (const m of src.matchAll(/label: bank \? `([^`\$]+) — \$\{bank\}` : '([^']+)'/g)) out.add(m[2])
    return [...out]
  }

  it('reads a real list of labels out of the rules', () => {
    expect(ruleLabels().length).toBeGreaterThan(15)
  })

  it('offers every document the rules can produce', () => {
    const offered = new Set(COMMON_EXTRAS.map(e => e.label))
    for (const label of ruleLabels()) {
      expect(offered.has(label), `"${label}" can be produced by a rule but cannot be added by hand`).toBe(true)
    }
  })

  it('offers the discharge of mortgage, which is the one that was found', () => {
    expect(COMMON_EXTRAS.map(e => e.label)).toContain('Discharge of mortgage')
  })

  it('offers the statements, which only appear when that debt is on the fact find', () => {
    const offered = COMMON_EXTRAS.map(e => e.label)
    for (const l of ['Credit card statement', 'Car loan statement',
                     'Personal loan statement', 'Home loan statement']) {
      expect(offered).toContain(l)
    }
  })

  it('is in alphabetical order', () => {
    // Thirty-four entries. Fabio, 10 Sep 2026: "alphabetical and ability to type
    // and search." Sorted on export, so a new one cannot land in the wrong place.
    const labels = COMMON_EXTRAS.map(e => e.label)
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, 'en'))
    expect(labels).toEqual(sorted)
  })

  it('starts where an alphabetical list should', () => {
    expect(COMMON_EXTRAS[0].label).toBe("Accountant's letter")
  })

  it('has no duplicate labels', () => {
    const labels = COMMON_EXTRAS.map(e => e.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps the one-offs that no rule produces', () => {
    const offered = COMMON_EXTRAS.map(e => e.label)
    for (const l of ["Accountant's letter", 'Letter of employment', 'Trust deed', 'Visa grant notice']) {
      expect(offered).toContain(l)
    }
  })
})

// Fabio, 10 Sep 2026: "why would payslips be there if I am already requesting -
// eliminate double ups."
describe('nothing already on the list is offered again', () => {
  const labels = (list: { label: string }[]) => list.map(e => e.label)

  it('drops a document that is already being asked for', () => {
    const left = labels(extrasNotAlreadyListed(['Payslips × 2', 'ID — licence, Medicare, passport']))
    expect(left).not.toContain('Payslips × 2')
    expect(left).not.toContain('ID — licence, Medicare, passport')
  })

  it('keeps everything that is not on the list', () => {
    const left = labels(extrasNotAlreadyListed(['Payslips × 2']))
    expect(left).toContain('Discharge of mortgage')
    expect(left).toContain("Accountant's letter")
  })

  it('matches a statement even though the row carries the bank', () => {
    // The row reads "Credit card statement — ANZ"; the extra is the plain label.
    const left = labels(extrasNotAlreadyListed(['Credit card statement — ANZ',
                                                'Home loan statement — Macquarie']))
    expect(left).not.toContain('Credit card statement')
    expect(left).not.toContain('Home loan statement')
    expect(left).toContain('Car loan statement')
  })

  it('is not fooled by spacing or case', () => {
    const left = labels(extrasNotAlreadyListed(['  payslips × 2  ']))
    expect(left).not.toContain('Payslips × 2')
  })

  it('offers the whole list when nothing is on the deal yet', () => {
    expect(extrasNotAlreadyListed([])).toHaveLength(COMMON_EXTRAS.length)
  })

  it('stays alphabetical after filtering', () => {
    const left = labels(extrasNotAlreadyListed(['Payslips × 2']))
    expect(left).toEqual([...left].sort((a, b) => a.localeCompare(b, 'en')))
  })
})
