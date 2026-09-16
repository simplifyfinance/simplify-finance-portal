import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  splitsAreUntouched, scenarioChangeCost, keepSplits, splitsAdded,
} from './scenario-change'

// ONE CLICK ON A SCENARIO CHIP USED TO THROW THE SPLITS AWAY.
//
// setSplits(defaults) ran on the spot. Every amount, rate, label, repayment type,
// typed repayment and per-property balance went with it - no confirmation, no
// copy in deal_history, and the autosave wrote the empty version 700ms later.
//
// The notes have been safe since 8 Sep. The splits never were.

const REFI_DEFAULTS = [{ label: 'Refinanced loan', amount: '', rate: '6.14', type: 'P&I' }]
const BRIDGING_DEFAULTS = [
  { label: 'Bridging loan', amount: '', rate: '7.50', type: 'Interest only' },
  { label: 'End loan', amount: '', rate: '6.14', type: 'P&I' },
]
const typed = [{
  label: '17 Dennington Lane Chelsea VIC', amount: '560,000', existingBalance: '545,000',
  rate: '6.24', type: 'Interest only', repayment: '$3,445',
}]

describe('has anybody typed in here', () => {
  it('knows an untouched scenario when it sees one', () => {
    expect(splitsAreUntouched(REFI_DEFAULTS, REFI_DEFAULTS)).toBe(true)
  })

  it('counts an empty set as untouched', () => {
    expect(splitsAreUntouched([{ label: '', amount: '', rate: '', type: '' }], REFI_DEFAULTS)).toBe(true)
    expect(splitsAreUntouched([], REFI_DEFAULTS)).toBe(true)
  })

  it('counts one changed field as touched', () => {
    expect(splitsAreUntouched([{ ...REFI_DEFAULTS[0], amount: '560,000' }], REFI_DEFAULTS)).toBe(false)
    expect(splitsAreUntouched([{ ...REFI_DEFAULTS[0], repayment: '3,445' }], REFI_DEFAULTS)).toBe(false)
    // The per-property balance is as much a typed figure as any other.
    expect(splitsAreUntouched([{ ...REFI_DEFAULTS[0], existingBalance: '545,000' }], REFI_DEFAULTS)).toBe(false)
  })

  it('counts an added split as touched', () => {
    expect(splitsAreUntouched([...REFI_DEFAULTS, { label: 'Second', amount: '' }], REFI_DEFAULTS)).toBe(false)
  })
})

describe('what the click would cost', () => {
  it('says nothing when it would cost nothing', () => {
    expect(scenarioChangeCost(REFI_DEFAULTS, REFI_DEFAULTS)).toBeNull()
    expect(scenarioChangeCost([], REFI_DEFAULTS)).toBeNull()
  })

  it('lists the split in the words and figures on screen', () => {
    const cost = scenarioChangeCost(typed, REFI_DEFAULTS)
    expect(cost).not.toBeNull()
    expect(cost!.lines).toHaveLength(1)
    expect(cost!.lines[0]).toContain('17 Dennington Lane Chelsea VIC')
    expect(cost!.lines[0]).toContain('$560,000')
    expect(cost!.lines[0]).toContain('6.24%')
    expect(cost!.lines[0]).toContain('Interest only')
    expect(cost!.lines[0]).toContain('$3,445 repayment')
    expect(cost!.lines[0]).toContain('$545,000 existing')
  })

  it('leaves a blank row out of the list', () => {
    const cost = scenarioChangeCost([...typed, { label: '', amount: '' }], REFI_DEFAULTS)
    expect(cost!.lines).toHaveLength(1)
  })

  it('falls back to a number when a split has no label', () => {
    const cost = scenarioChangeCost([{ amount: '400,000' }], REFI_DEFAULTS)
    expect(cost!.lines[0]).toBe('Split 1 — $400,000')
  })
})

describe('keeping them', () => {
  it('leaves every typed split exactly as it is', () => {
    const kept = keepSplits(typed, BRIDGING_DEFAULTS)
    expect(kept[0]).toMatchObject(typed[0])
  })

  it('adds the ones the new scenario still needs, blank', () => {
    const kept = keepSplits(typed, BRIDGING_DEFAULTS)
    expect(kept).toHaveLength(2)
    expect(kept[1]).toMatchObject({ label: 'End loan', amount: '', rate: '6.14', type: 'P&I' })
    expect(splitsAdded(typed, BRIDGING_DEFAULTS)).toBe(1)
  })

  it('never drops a split the new scenario was not expecting', () => {
    const three = [typed[0], { label: 'Two', amount: '1' }, { label: 'Three', amount: '2' }]
    expect(keepSplits(three, REFI_DEFAULTS)).toHaveLength(3)
    expect(splitsAdded(three, REFI_DEFAULTS)).toBe(0)
  })

  it('hands back copies, not the same objects', () => {
    const kept = keepSplits(typed, REFI_DEFAULTS)
    expect(kept[0]).not.toBe(typed[0])
  })
})

// ---------------------------------------------------------------------------

describe('the BC asks before it replaces anything', () => {
  const src = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  it('no longer wipes the splits the moment a chip is clicked', () => {
    // The old body of selectTemplate. If this comes back, a wrong click costs a
    // broker everything they typed.
    const picker = src.slice(src.indexOf('function selectTemplate('), src.indexOf('function applyTemplate('))
      // Comments stripped: the note explaining the old behaviour names the call
      // it is warning about, and matching that would fail on a correct file.
      .replace(/\/\/[^\n]*/g, '')
    expect(picker, 'selectTemplate is replacing splits again without asking')
      .not.toMatch(/setSplits\(/)
  })

  it('asks first, and offers both ways out', () => {
    expect(src).toContain('scenarioChangeCost(splits')
    expect(src).toContain("applyTemplate(askScenario.id, 'keep')")
    expect(src).toContain("applyTemplate(askScenario.id, 'replace')")
    expect(src).toContain('Would be replaced')
  })

  it('keeps the guard the notes already had', () => {
    expect(src).toContain('notesAfterScenarioChange(prev, TEMPLATE_NOTES[previous]')
  })
})
