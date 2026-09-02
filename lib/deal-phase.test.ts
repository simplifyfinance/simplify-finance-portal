import { describe, it, expect } from 'vitest'
import { phaseOf, isFinished, isInApplication, amountOf, phaseSince, PHASE_ORDER , loMayWriteAmount, isWithLender, pastFactFind, tabForPhase, moveBack, PHASE_FIELDS, PHASE_UNDO_LABEL, derivedPhaseOf, placedByHand } from './deal-phase'

// A fact find somebody has actually typed into. An applicant row on its own is
// not that - the new-deal form seeds one before anybody has touched the tab.
const ff = { fact_find_data: { applicants: [{ dob: '14/03/1988' }] } }

describe('which column a deal is in', () => {
  it('starts at fact find, and stays there until the form has something in it', () => {
    expect(phaseOf({})).toBe('fact_find')
    expect(phaseOf({ fact_find_data: {} })).toBe('fact_find')
    // The seeded applicant the new-deal form creates is not "something in it".
    expect(phaseOf({ fact_find_data: { applicants: [{}] } })).toBe('fact_find')
    expect(phaseOf(ff)).toBe('bc')
  })

  it('walks the ladder on what actually happened', () => {
    expect(phaseOf({ ...ff, client_proceeded: true })).toBe('lo')
    expect(phaseOf({ ...ff, client_proceeded: true, lo_client_proceeded: true })).toBe('compliance')
    // Finishing compliance is not enough — it has to have actually gone out.
    expect(phaseOf({ ...ff, lo_client_proceeded: true, compliance_completed_at: 'x' })).toBe('compliance')
    expect(phaseOf({ ...ff, lo_client_proceeded: true, compliance_completed_at: 'x', compliance_sent_at: 'x' })).toBe('compliance_sent')
  })

  it('keeps a pushed deal on the board instead of calling it finished', () => {
    // The nine deals that were invisible on 1 Sep 2026.
    const pushed = { ...ff, compliance_completed_at: '2026-08-21', compliance_sent_at: '2026-08-21', status: 'completed' }
    expect(phaseOf(pushed)).toBe('compliance_sent')
    expect(isFinished(pushed)).toBe(false)
    expect(isInApplication(pushed)).toBe(true)
  })

  it('ignores the retired completed status entirely', () => {
    const a = { ...ff, compliance_completed_at: 'x', compliance_sent_at: 'x' }
    expect(phaseOf({ ...a, status: 'completed' })).toBe(phaseOf(a))
  })

  it('runs through the post-lodgement columns', () => {
    const base = { ...ff, compliance_completed_at: 'x', compliance_sent_at: 'x' }
    expect(phaseOf({ ...base, lodged_at: 'x' })).toBe('lodged')
    expect(phaseOf({ ...base, lodged_at: 'x', preapproval_at: 'x' })).toBe('preapproved')
    expect(phaseOf({ ...base, lodged_at: 'x', preapproval_at: 'x', formal_approval_at: 'x' })).toBe('formal')
    expect(phaseOf({ ...base, lodged_at: 'x', formal_approval_at: 'x', settled_at: 'x' })).toBe('settled')
  })

  it('lets a deal skip preapproval without getting stuck', () => {
    // Most deals never get one. Missing it must not hold the deal back.
    const straight = { ...ff, compliance_sent_at: 'x', lodged_at: 'x', formal_approval_at: 'x' }
    expect(phaseOf(straight)).toBe('formal')
  })

  it('is only finished when the money landed or the deal died', () => {
    expect(phaseOf({ ...ff, settled_at: 'x' })).toBe('settled')
    expect(isFinished({ ...ff, settled_at: 'x' })).toBe(true)
    expect(phaseOf({ ...ff, status: 'lost' })).toBe('lost')
    expect(isFinished({ ...ff, status: 'lost' })).toBe(true)
    expect(isFinished({ ...ff, compliance_sent_at: 'x' })).toBe(false)
  })

  it('calls a deal lost wherever it got to', () => {
    expect(phaseOf({ ...ff, status: 'lost', lodged_at: 'x', formal_approval_at: 'x' })).toBe('lost')
  })

  it('never reads deals.stage', () => {
    const d = { ...ff, client_proceeded: true, stage: 'Compliance' }
    expect(phaseOf(d)).toBe('lo')                   // the stale column said Compliance
    expect(phaseOf({ ...ff, stage: 'Settled' })).toBe('bc')
  })

  it('shows what settled over what was lodged over what was asked for', () => {
    expect(amountOf({ loan_amount: '500000' })).toBe(500000)
    expect(amountOf({ loan_amount: 500000, lodged_total: 520000 })).toBe(520000)
    expect(amountOf({ loan_amount: 500000, lodged_total: 520000, settled_total: 515000 })).toBe(515000)
    expect(amountOf({ lodged_total: '$1,250,000' })).toBe(1250000)
    expect(amountOf({})).toBeNull()
  })

  it('shows nothing before Lending Options — a BC figure is a capacity, not a loan', () => {
    // Nobody has applied for a borrowing capacity, and on the comparison template
    // it is two alternatives for one deal. Counting it inflates the pipeline.
    const bcOnly = { bc_data: { template: 'refinance_equity', splits: [
      { label: 'Existing loan refinanced', amount: '640000' },
      { label: 'Equity access', amount: '60,000' },
    ] } }
    expect(amountOf(bcOnly)).toBeNull()
  })

  it('counts the Lending Options figure once it exists', () => {
    expect(amountOf({ lo_data: { loanAmount: '387,000' } })).toBe(387000)
    expect(amountOf({ lo_data: { refinanceSplits: [{ amount: '400000' }, { amount: '60000' }] } })).toBe(460000)
  })

  it('prefers the deal\'s own column, which the LO now writes', () => {
    const d = { loan_amount: 530000, lo_data: { loanAmount: '500,000' } }
    expect(amountOf(d)).toBe(530000)
  })

  it('ignores an LO figure that was never filled in', () => {
    expect(amountOf({ lo_data: { loanAmount: '' } })).toBeNull()
    expect(amountOf({ lo_data: { refinanceSplits: [{ label: 'Owner-occupied loan', amount: '' }] } })).toBeNull()
  })

  it('adds up the real splits on a lodged loan', () => {
    expect(amountOf({ lodged_splits: [{ amount: 400000 }, { amount: 150000 }] })).toBe(550000)
  })

  it('ages from the milestone that put the deal in its column', () => {
    const d = { ...ff, compliance_completed_at: '2026-08-20', compliance_sent_at: '2026-08-21' }
    expect(phaseSince(d)).toBe('2026-08-21')        // not when compliance was finished
    expect(phaseSince({ ...d, lodged_at: '2026-08-28' })).toBe('2026-08-28')
    expect(phaseSince({ ...ff, status: 'lost', closed_at: '2026-07-01' })).toBe('2026-07-01')
  })

  it('has every phase in the order the board draws them', () => {
    expect(PHASE_ORDER).toHaveLength(13)
    expect(PHASE_ORDER.indexOf('compliance_sent')).toBeLessThan(PHASE_ORDER.indexOf('lodged'))
    expect(PHASE_ORDER.indexOf('preapproved')).toBeLessThan(PHASE_ORDER.indexOf('formal'))
  })
})

describe('the Lending options form may only write the amount before lodgement', () => {
  it('writes while the deal is still being written', () => {
    expect(loMayWriteAmount({})).toBe(true)
    expect(loMayWriteAmount({ lo_completed_at: '2026-08-01' })).toBe(true)
    expect(loMayWriteAmount({ compliance_sent_at: '2026-08-10' })).toBe(true)
  })

  it('stops the moment the loan is lodged', () => {
    expect(loMayWriteAmount({ lodged_at: '2026-08-14' })).toBe(false)
  })

  it('stops for a settled deal even if lodged was never recorded', () => {
    // Nine deals were pushed to compliance before lodged_at existed. Opening an
    // LO on one of those must still not overwrite what settled.
    expect(loMayWriteAmount({ settled_at: '2026-07-14' })).toBe(false)
  })
})

describe('with the lender', () => {
  const done = { ...ff, client_proceeded: true, lo_client_proceeded: true }

  it('a deal still being written is not with the lender', () => {
    expect(isWithLender({})).toBe(false)
    expect(isWithLender(ff)).toBe(false)
    expect(isWithLender(done)).toBe(false)
  })

  it('compliance being SENT is not far enough - support still has it', () => {
    // The line is lodgement. Between compliance sent and lodged the deal is
    // waiting on a SalesTrekker card and compliance work can still matter.
    expect(isWithLender({ ...done, compliance_sent_at: '2026-08-20' })).toBe(false)
  })

  it('is true from lodgement onwards', () => {
    expect(isWithLender({ ...done, lodged_at: '2026-08-22' })).toBe(true)
    expect(isWithLender({ ...done, lodged_at: '2026-08-22', preapproval_at: '2026-08-30' })).toBe(true)
    expect(isWithLender({ ...done, lodged_at: '2026-08-22', settled_at: '2026-09-01' })).toBe(true)
  })

  it('a lost deal is never with the lender, whatever order the phases are in', () => {
    // lost sits last in PHASE_ORDER, which would otherwise make every dead deal
    // look like it had moved on.
    expect(isWithLender({ ...done, lodged_at: '2026-08-22', status: 'lost' })).toBe(false)
  })
})

// A deal is created with fact_find_data already seeded - the applicants from the
// modal, plus a blank address, a blank job and a blank income. That is not
// fact-find work, and treating it as work put every new deal in the BC column
// and opened it on the BC tab.
describe('a new deal starts at Fact Find', () => {
  const seeded = {
    fact_find_data: {
      applicants: [{
        id: 'a1', firstName: 'Natasha', lastName: 'Chapman', dob: '',
        addresses: [{ id: 'x', address: '', residentialStatus: '', isCurrent: true, startDate: '' }],
        employment: [{ id: 'y', isCurrent: true, employmentBasis: 'Full time', occupation: '', employerName: '' }],
        income: [{ id: 'z', incomeType: 'PAYG', grossSalary: '' }],
      }],
      assets: [], properties: [], liabilities: [],
    },
  }

  it('is at Fact Find the moment it is created', () => {
    expect(phaseOf(seeded)).toBe('fact_find')
    expect(pastFactFind(seeded)).toBe(false)
  })

  it('opens on the Fact Find tab', () => {
    expect(tabForPhase(phaseOf(seeded))).toBe('FactFind')
  })

  it('stays at Fact Find when somebody only opens the tab', () => {
    // Opening the tab autosaves the same empty rows back. Nothing was typed.
    expect(phaseOf({ fact_find_data: { applicants: [{ addresses: [{ address: '' }], employment: [{}], income: [{}] }] } }))
      .toBe('fact_find')
  })

  it('moves to BC once a date of birth is typed', () => {
    const d = JSON.parse(JSON.stringify(seeded))
    d.fact_find_data.applicants[0].dob = '14/03/1988'
    expect(phaseOf(d)).toBe('bc')
  })

  it('moves to BC once an address is typed', () => {
    const d = JSON.parse(JSON.stringify(seeded))
    d.fact_find_data.applicants[0].addresses[0].address = '6 Bella Vista Court'
    expect(phaseOf(d)).toBe('bc')
  })

  it('moves to BC once an employer or a salary is typed', () => {
    const e = JSON.parse(JSON.stringify(seeded))
    e.fact_find_data.applicants[0].employment[0].employerName = 'Roc Partners'
    expect(phaseOf(e)).toBe('bc')
    const i = JSON.parse(JSON.stringify(seeded))
    i.fact_find_data.applicants[0].income[0].grossSalary = '446,428.63'
    expect(phaseOf(i)).toBe('bc')
  })

  it('moves to BC once a property or a liability is added', () => {
    const d = JSON.parse(JSON.stringify(seeded))
    d.fact_find_data.properties = [{ address: '6 Bella Vista Court' }]
    expect(phaseOf(d)).toBe('bc')
  })

  it('is past the fact find whenever there are BC figures, however thin the fact find', () => {
    expect(phaseOf({ ...seeded, bc_data: { purchasePrice: '5,250,000' } })).toBe('bc')
  })

  it('does not disturb a deal that has moved on', () => {
    expect(phaseOf({ ...seeded, lodged_at: '2026-09-01' })).toBe('lodged')
  })
})

// The board refused every backwards move. Deals do get recorded wrongly.
describe('moving a deal backwards', () => {
  it('names the dates it would clear', () => {
    const m = moveBack('lodged', 'compliance_sent')
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.fields).toEqual(['lodged_at'])
  })

  it('clears everything between, not just the one step', () => {
    const m = moveBack('settled', 'lodged')
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.fields).toContain('settled_at')
    expect(m.fields).toContain('formal_approval_at')
    expect(m.fields).toContain('preapproval_at')
    expect(m.fields).not.toContain('lodged_at')
  })

  it('clears both halves of a client agreeing to proceed', () => {
    const m = moveBack('lo', 'bc')
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.fields).toEqual(['client_proceeded', 'proceeded_at'])
  })

  it('allows Fact Find, and clears nothing to get there', () => {
    // It used to refuse. A deal leaves Fact Find because somebody typed into the
    // fact find, so there is no date to undo - it is placed by hand instead, and
    // the client's answers are left alone. See the placing tests below.
    const m = moveBack('lo', 'fact_find')
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.place).toBe(true)
    expect(m.fields).toEqual([])
  })

  it('refuses a forwards move, or a move to where it already is', () => {
    expect(moveBack('bc', 'lodged').ok).toBe(false)
    expect(moveBack('lodged', 'lodged').ok).toBe(false)
  })

  it('has plain wording for every stage it can undo', () => {
    for (const p of Object.keys(PHASE_FIELDS) as any[]) {
      expect(PHASE_UNDO_LABEL[p]).toBeTruthy()
    }
  })
})

// Dragging a card from BC back to Fact Find. There is no date to clear - a deal
// leaves Fact Find because somebody typed into the fact find - so it is placed
// by hand instead. The whole risk is a column that stops meaning anything, which
// is what deals.stage became. These are the three rules that stop that.
describe('placing a deal back in Fact Find by hand', () => {
  const atBc = { fact_find_data: { applicants: [{ dob: '14/03/1988' }] } }

  it('moves the deal, and says so', () => {
    const placed = { ...atBc, phase_override: 'fact_find', phase_override_from: 'bc' }
    expect(phaseOf(placed)).toBe('fact_find')
    expect(placedByHand(placed)).toBe(true)
  })

  it('leaves the record itself untouched', () => {
    const placed = { ...atBc, phase_override: 'fact_find', phase_override_from: 'bc' }
    // What the deal has actually done is unchanged - only where it is shown.
    expect(derivedPhaseOf(placed)).toBe('bc')
  })

  it('expires the moment real work happens, even if the column would not change', () => {
    // The hole this closed: placed in Fact Find while the deal sat at BC, then
    // the BC is written and sent to the client. The derived phase is still BC,
    // so nothing "changed" - and the card would have stayed in Fact Find with a
    // live BC out with the client. Fabio, 3 Sep 2026: "because a deal was moved
    // by hand it doesnt mean it stops any other rules".
    const placed = {
      ...atBc,
      phase_override: 'fact_find', phase_override_from: 'bc',
      phase_override_at: '2026-09-03T01:00:00.000Z',
    }
    expect(phaseOf(placed)).toBe('fact_find')
    expect(phaseOf({ ...placed, bc_sent_at: '2026-09-03T02:00:00.000Z' })).toBe('bc')
    expect(phaseOf({ ...placed, bc_completed_at: '2026-09-03T02:00:00.000Z' })).toBe('bc')
    expect(phaseOf({ ...placed, docs_received_at: '2026-09-03T02:00:00.000Z' })).toBe('bc')
  })

  it('survives work that happened BEFORE it was placed', () => {
    // Placing a card is a decision made with the file's history in view. Only
    // what happens next overrides it.
    const placed = {
      ...atBc,
      bc_sent_at: '2026-09-01T00:00:00.000Z',
      phase_override: 'fact_find', phase_override_from: 'bc',
      phase_override_at: '2026-09-03T01:00:00.000Z',
    }
    expect(phaseOf(placed)).toBe('fact_find')
  })

  it('expires by itself the moment the deal moves on', () => {
    // Placed while at BC; the client then agrees to proceed, so the deal is at
    // LO. The placement no longer matches and is ignored - no deal can hide in
    // the wrong column indefinitely.
    const movedOn = { ...atBc, client_proceeded: true, phase_override: 'fact_find', phase_override_from: 'bc' }
    expect(phaseOf(movedOn)).toBe('lo')
    expect(placedByHand(movedOn)).toBe(false)
  })

  it('cannot be used to claim progress', () => {
    const forwards = { ...atBc, phase_override: 'settled', phase_override_from: 'bc' }
    expect(phaseOf(forwards)).toBe('bc')
  })

  it('cannot be used to sit still', () => {
    const sideways = { ...atBc, phase_override: 'bc', phase_override_from: 'bc' }
    expect(phaseOf(sideways)).toBe('bc')
  })

  it('ignores a phase that is not a phase', () => {
    expect(phaseOf({ ...atBc, phase_override: 'Compliance', phase_override_from: 'bc' })).toBe('bc')
    expect(phaseOf({ ...atBc, phase_override: '', phase_override_from: 'bc' })).toBe('bc')
  })

  it('ignores a placement with no record of where it came from', () => {
    expect(phaseOf({ ...atBc, phase_override: 'fact_find' })).toBe('bc')
  })

  it('does not disturb a deal nobody has touched', () => {
    expect(phaseOf(atBc)).toBe('bc')
    expect(placedByHand(atBc)).toBe(false)
  })

  it('still says a dead deal is dead, whatever the board says', () => {
    expect(phaseOf({ ...atBc, status: 'lost', phase_override: 'fact_find', phase_override_from: 'bc' })).toBe('lost')
  })

  it('tells the board there is nothing to clear for Fact Find', () => {
    const m = moveBack('bc', 'fact_find')
    expect(m.ok).toBe(true)
    if (!m.ok) return
    expect(m.place).toBe(true)
    expect(m.fields).toEqual([])
  })
})
