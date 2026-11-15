// "CHECKLIST ITEMS ARE FOR EVERY DEAL." — Julian Kok, 17 Nov 2026.
// "Yes those checklist are applicable for every deal." — Belle, the same day.
import { describe, it, expect } from 'vitest'
import {
  CHECKLISTS, itemsFor, ticked, tickPatch, doneCount, leftBehind, leavingWords,
  stillOpen, isEsign, hasSettlementDate,
} from './the-step-checklists'
import { STEPS, type Step } from './the-seven-steps'

const item = (step: Step, key: string) => CHECKLISTS[step].find(i => i.key === key)!

describe('every step has its list', () => {
  it('and every item on it says what it is', () => {
    for (const s of STEPS) {
      for (const i of CHECKLISTS[s]) {
        expect(i.key, `${s} has an item with no key`).toBeTruthy()
        expect(i.what, `${s}.${i.key} does not say what it is`).toBeTruthy()
      }
    }
  })

  // Fabio's spec: "No checklist. Clear the field and move on."
  it('except Outstandings, where the field is the whole step', () => {
    expect(CHECKLISTS.outstandings).toEqual([])
  })

  // THE ONE CONDITIONAL ITEM IN THE WHOLE BUILD, and it was in the spec from
  // the start: on an esign deal there is nothing to post.
  it('one item is conditional, and it says why', () => {
    const conditional = STEPS.flatMap(s => CHECKLISTS[s].filter(i => i.only))
    expect(conditional).toHaveLength(1)
    expect(conditional[0].key).toBe('scan_first')
    expect(conditional[0].onlyWhy).toContain('esign')
  })

  it('and it is hidden on an esign deal', () => {
    const keys = (d: any) => itemsFor('contracts_issued', d).map(i => i.key)
    expect(keys({ loan_docs_signing: 'Esign' })).not.toContain('scan_first')
    expect(keys({ loan_docs_signing: 'Wet sign' })).toContain('scan_first')
    expect(keys({}), 'nobody has said, so the reminder stands').toContain('scan_first')
  })

  it('isEsign knows the words people actually type', () => {
    for (const yes of ['Esign', 'e-sign', 'DocuSign', 'electronic']) {
      expect(isEsign({ loan_docs_signing: yes }), yes).toBe(true)
    }
    expect(isEsign({ loan_docs_signing: 'Mortgage only to be wet signed' })).toBe(false)
  })
})

// FOUR OF THESE ARE ALREADY COLUMNS AND STAY COLUMNS. The same fact in two
// places is the mistake this codebase keeps having to undo.
describe('the items that are already columns on the deal', () => {
  it('read the column, not a second copy', () => {
    const i = item('settled', 'review_sent')
    expect(i.column).toBe('review_sent')
    expect(ticked({ review_sent: true }, 'settled', i)).toBe(true)
    expect(ticked({ review_sent: false }, 'settled', i)).toBe(false)
  })

  it('and ticking one writes the column', () => {
    const i = item('settled', 'commission_paid')
    expect(tickPatch({}, 'settled', i, true)).toEqual({ commission_paid: true })
  })

  it('funds to complete is the board’s own column', () => {
    expect(item('settlement_booked', 'funds_checked').column).toBe('funds_to_complete_checked')
  })
})

// A BOX THAT ARGUES WITH THE DEAL BESIDE IT IS WORSE THAN NO BOX.
describe('the items the portal answers itself', () => {
  it('a settlement date on the deal ticks its own box', () => {
    const i = item('pending_booking', 'date_entered')
    expect(ticked({ confirmed_settlement_date: '2026-11-28' }, 'pending_booking', i)).toBe(true)
    expect(ticked({}, 'pending_booking', i)).toBe(false)
    expect(hasSettlementDate({ expected_settlement_date: '2026-11-28' })).toBe(true)
  })

  it('and the lender solicitor ticks when either field is filled', () => {
    const i = item('formal', 'solicitor')
    expect(ticked({ lender_solicitor: 'Gadens' }, 'formal', i)).toBe(true)
    expect(ticked({ lender_solicitor_ref: 'MBL-4418' }, 'formal', i)).toBe(true)
    expect(ticked({}, 'formal', i)).toBe(false)
  })

  it('neither of them can be ticked by hand', () => {
    expect(tickPatch({}, 'pending_booking', item('pending_booking', 'date_entered'), true)).toBe(null)
    expect(tickPatch({}, 'formal', item('formal', 'solicitor'), true)).toBe(null)
  })
})

describe('ticking an ordinary item', () => {
  const i = item('formal', 'welcome_sent')

  it('writes it into the box under its step', () => {
    expect(tickPatch({}, 'formal', i, true))
      .toEqual({ settlement_checklist: { formal: { welcome_sent: true } } })
  })

  it('and unticking takes it out rather than storing a false', () => {
    const d = { settlement_checklist: { formal: { welcome_sent: true, approval_matches: true } } }
    expect(tickPatch(d, 'formal', i, false))
      .toEqual({ settlement_checklist: { formal: { approval_matches: true } } })
  })

  it('another step’s ticks are never disturbed', () => {
    const d = { settlement_checklist: { contracts_issued: { called_client: true } } }
    const p = tickPatch(d, 'formal', i, true)!
    expect(p.settlement_checklist.contracts_issued).toEqual({ called_client: true })
  })

  it('and a checklist column holding nonsense does not crash it', () => {
    expect(tickPatch({ settlement_checklist: 'nope' }, 'formal', i, true))
      .toEqual({ settlement_checklist: { formal: { welcome_sent: true } } })
  })
})

// NOTHING BLOCKS. "I don't want to block it because it makes it hard, but just
// put a warning on top."
describe('what you are leaving behind', () => {
  it('is the ones not ticked, and it never stops anybody', () => {
    const d = { settlement_checklist: { formal: { welcome_sent: true } } }
    expect(leftBehind(d, 'formal').map(i => i.key)).toEqual(['solicitor', 'approval_matches'])
  })

  it('counted for the heading', () => {
    const d = { settlement_checklist: { formal: { welcome_sent: true } } }
    expect(doneCount(d, 'formal')).toEqual({ done: 1, all: 3 })
  })

  it('and said in words', () => {
    expect(leavingWords(1)).toBe('You are leaving one thing unticked')
    expect(leavingWords(3)).toBe('You are leaving 3 things unticked')
    expect(leavingWords(0)).toBe('')
  })

  // THE ITEMS FOLLOW THE DEAL. A reminder nobody sent at Contracts Issued is
  // still unsent at Settlement Booked.
  it('an item left behind is still findable from a later step', () => {
    const d = {
      loan_docs_signing: 'Wet sign',
      settlement_checklist: { formal: { welcome_sent: true, approval_matches: true },
                              contracts_issued: { contract_matches: true } },
      lender_solicitor: 'Gadens',
    }
    const open = stillOpen(d, 'contracts_reviewing', STEPS)
    expect(open.map(o => o.item.key)).toEqual(['contract_dropped', 'called_client', 'scan_first'])
  })

  it('and nothing from the step you are on, or past it', () => {
    expect(stillOpen({}, 'formal', STEPS)).toEqual([])
  })
})
