import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { positionChanges } from './position-after-settlement'
import { splitsOf } from './deal-structure'
import { lmiAmount, lmiTreatment, lmiBySecurity, lmiTreatmentsDisagree,
         LMI_CAPITALISED, LMI_SETTLEMENT } from './lmi'

// THE TWO LEFT BEFORE THE TEAM GETS THESE TEMPLATES.
//
// 20 Oct 2026. Fabio: "anyhting else any other audti on LO and compliance for
// template top up and top up + purchase before we can commnicate with the
// team???" Two things were, and both are here.

const BOTANY = 'p1'
const HELMSMAN = 'p2'

const bc = (over: any = {}) => ({
  template: 'top_up',
  securityIds: [BOTANY],
  securityBalances: { [BOTANY]: '942,441' },
  securityIncreases: { [BOTANY]: '200,000' },
  securityDollarForDollar: {},
  splits: [
    { label: 'Existing loan', amount: '942,441', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: BOTANY, purpose: 'investment', staying: true },
    { label: 'Loan increase', amount: '200,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: BOTANY, purpose: 'investment' },
  ],
  ...over,
})

const ff = {
  applicants: [{ firstName: 'Dan', lastName: 'Hartley' }],
  properties: [
    { id: BOTANY, address: '1372 Botany Rd, Botany NSW 2019', value: '2,000,000',
      ownershipType: 'Investment',
      loans: [{ id: 'l1', lenderName: 'St George', balance: '942,441', status: 'Staying' }] },
    { id: HELMSMAN, address: '43 Helmsman Blvd, St Huberts Island NSW 2257', value: '3,000,000',
      ownershipType: 'Owner occupied', loans: [] },
  ],
}

const deal = (over: any = {}) => ({ bc_data: bc(over), fact_find_data: ff, lo_data: {} } as any)

describe('the loan that stays is counted once', () => {
  // The tag was written by the top up builder and read by nothing: the shared
  // split shape dropped it, so every compliance box saw new lending where a
  // loan was simply staying put.
  it('carries the tag through to every box that reads splits', () => {
    const sp = splitsOf(deal()).find(x => /existing/i.test(x.label))
    expect(sp?.staying).toBe(true)
    const inc = splitsOf(deal()).find(x => /increase/i.test(x.label))
    expect(inc?.staying).toBe(false)
  })

  // $942,441 kept, plus $942,441 "new", plus $200,000 - on a property that will
  // owe $1,142,441. The screen whose whole job is what they owe afterwards.
  it('does not list the existing loan again as new lending', () => {
    const rows = positionChanges(deal(), '0')
    const added = rows.filter(r => r.kind === 'add')
    expect(added).toHaveLength(1)
    expect(added[0].amount).toBe('200,000')
  })

  it('says the kept loan is increasing, not unchanged', () => {
    const kept = positionChanges(deal(), '0').find(r => r.kind === 'keep')
    expect(kept?.now).toContain('increasing by $200,000 to $1,142,441')
    expect(kept?.now).not.toBe('unchanged')
    // The figure stays at what is owed today; the increase is its own line.
    // Carrying the new total here as well would count the $200,000 twice.
    expect(kept?.amount).toBe('942,441')
  })

  it('totals to what they will actually owe', () => {
    const rows = positionChanges(deal(), '0')
    const owed = rows.filter(r => r.kind === 'keep' || r.kind === 'add')
      .reduce((t, r) => t + (Number(String(r.amount).replace(/[^0-9.]/g, '')) || 0), 0)
    expect(owed).toBe(1142441)
  })

  // Nothing about any other scenario changes: no split anywhere else carries
  // the tag, so every one of them still becomes a new loan exactly as before.
  it('leaves a refinance listing every split as new lending', () => {
    const d = deal({
      template: 'refinance_only',
      splits: [{ label: 'Refinanced loan', amount: '942,441', rate: '6.14', type: 'P&I', securityId: BOTANY }],
    })
    expect(positionChanges(d, '0').filter(r => r.kind === 'add')).toHaveLength(1)
  })
})

describe('LMI is asked on the security', () => {
  const over80 = (extra: any = {}) => bc({
    securityIncreases: { [BOTANY]: '780,000' },
    securityLmiApplicable: { [BOTANY]: 'Applicable' },
    securityLmi: { [BOTANY]: '31,480' },
    securityLmiTreatment: { [BOTANY]: LMI_CAPITALISED },
    ...extra,
  })

  it('adds the per-property premiums into the one figure everything reads', () => {
    expect(lmiAmount(over80())).toBe(31480)
    expect(lmiTreatment(over80())).toBe('capitalised')
    expect(lmiBySecurity(over80())).toEqual([{ id: BOTANY, amount: 31480 }])
  })

  it('counts only a security marked applicable', () => {
    expect(lmiAmount(over80({ securityLmiApplicable: { [BOTANY]: 'Waived' } }))).toBe(null)
  })

  it('adds up across properties', () => {
    const d = over80({
      securityIds: [BOTANY, HELMSMAN],
      securityLmiApplicable: { [BOTANY]: 'Applicable', [HELMSMAN]: 'Applicable' },
      securityLmi: { [BOTANY]: '31,480', [HELMSMAN]: '12,000' },
      securityLmiTreatment: { [BOTANY]: LMI_CAPITALISED, [HELMSMAN]: LMI_CAPITALISED },
    })
    expect(lmiAmount(d)).toBe(43480)
    expect(lmiTreatmentsDisagree(d)).toBe(false)
  })

  // Two properties paid differently has no single answer, and inventing one
  // would put a figure nobody chose into the funds to complete.
  it('refuses to pick a treatment when two properties disagree', () => {
    const d = over80({
      securityIds: [BOTANY, HELMSMAN],
      securityLmiApplicable: { [BOTANY]: 'Applicable', [HELMSMAN]: 'Applicable' },
      securityLmi: { [BOTANY]: '31,480', [HELMSMAN]: '12,000' },
      securityLmiTreatment: { [BOTANY]: LMI_CAPITALISED, [HELMSMAN]: LMI_SETTLEMENT },
    })
    expect(lmiTreatmentsDisagree(d)).toBe(true)
    expect(lmiTreatment(d)).toBe('unanswered')
    // The amount is still real and still added up. Only the treatment is unknown.
    expect(lmiAmount(d)).toBe(43480)
  })

  // Every deal already on the system answers at deal level and must not move.
  it('falls back to the deal-level answer where no security has one', () => {
    const old = { lmiApplicable: 'Applicable', lmi: '8,400', lmiTreatment: LMI_SETTLEMENT }
    expect(lmiAmount(old)).toBe(8400)
    expect(lmiTreatment(old)).toBe('settlement')
  })
})

describe('the form asks it where it applies', () => {
  const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  // The deal-level LMI group hides on any deal with ticked securities, which is
  // every top up - so until now the question was never put at all.
  it('draws the question on a security over 80%', () => {
    expect(form).toContain('{on && l !== null && l > 80 && (() => {')
    expect(form).toContain('LMI is a consideration here')
  })

  it('saves the answers with the rest of the borrowing capacity', () => {
    for (const k of ['securityLmiApplicable', 'securityLmi,', 'securityLmiTreatment']) {
      expect(form).toContain(k)
    }
  })

  it('says so when two properties are paid differently', () => {
    expect(form).toContain('lmiTreatmentsDisagree(bcNow)')
  })
})
