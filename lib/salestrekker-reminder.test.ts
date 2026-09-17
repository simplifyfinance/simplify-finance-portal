import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { needsSalestrekker, salestrekkerReminder, SALESTREKKER_TICK } from './salestrekker-reminder'

// 17 Sep 2026. Recording a stage sends nothing anywhere, so SalesTrekker only
// changes if a person remembers. The reminder goes where the work is.

describe('which stages ask', () => {
  it('asks on all five a person records by hand', () => {
    for (const k of ['lodged_at', 'preapproval_at', 'offer_accepted_at', 'formal_approval_at', 'settled_at'])
      expect(needsSalestrekker(k), `${k} should ask`).toBe(true)
  })

  it('does not ask on the two the settlements team records in their own panel', () => {
    expect(needsSalestrekker('contracts_returned_at')).toBe(false)
    expect(needsSalestrekker('settlement_booked_at')).toBe(false)
  })

  it('says nothing on rubbish rather than guessing', () => {
    expect(needsSalestrekker('')).toBe(false)
    expect(needsSalestrekker(null)).toBe(false)
    expect(needsSalestrekker('made_up')).toBe(false)
    expect(salestrekkerReminder('made_up')).toBe(null)
  })
})

describe('what it says', () => {
  it('NAMES the status rather than saying "update SalesTrekker"', () => {
    expect(salestrekkerReminder('lodged_at')!.status).toBe('Lodged')
    expect(salestrekkerReminder('formal_approval_at')!.status).toBe('Formally approved')
    expect(salestrekkerReminder('settled_at')!.status).toBe('Settled')
  })

  it('reads as one sentence', () => {
    const r = salestrekkerReminder('preapproval_at')!
    expect(`${r.before}${r.status}${r.after}`).toBe('Update the status to Preapproved in SalesTrekker')
  })

  it('every stage that asks has a status to name', () => {
    for (const k of ['lodged_at', 'preapproval_at', 'offer_accepted_at', 'formal_approval_at', 'settled_at']) {
      const r = salestrekkerReminder(k)!
      expect(r.status.length, `${k} has no status in its wording`).toBeGreaterThan(3)
      expect(r.after).toMatch(/SalesTrekker/)
    }
  })
})

describe('the tick is a gate, not decoration', () => {
  const src = readFileSync('app/(app)/deals/[id]/DealSettlement.tsx', 'utf8')

  it('the confirm button will not fire until it is ticked', () => {
    expect(src).toMatch(/disabled=\{saving \|\| \(needsSalestrekker\(stage\?\.key\) && !stUpdated\)\}/)
  })

  it('it is asked fresh every time, not remembered from the last stage', () => {
    expect(src).toMatch(/setStUpdated\(false\)/)
  })

  it('and it is drawn from the one wording, not typed into the dialog', () => {
    expect(src).toMatch(/salestrekkerReminder\(/)
    expect(src).toMatch(/SALESTREKKER_TICK/)
    expect(src, 'the reminder has been written out by hand in the component')
      .not.toMatch(/Mark this deal as/)
  })
})

describe('the wording lives in one place', () => {
  it('the tick says the same thing everywhere it is used', () => {
    expect(SALESTREKKER_TICK).toBe('I have updated SalesTrekker')
  })
})
