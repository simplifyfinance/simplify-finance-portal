// THE SETTLEMENT FIVE JOIN THE DROPDOWN THAT ALREADY EXISTS.
//
// 17 Nov 2026. Fabio: "Look at how we do the templates. There's a little drop
// down box on the deal card, and you can do pre approval, you can do formal
// approval, you can do offer accepted. Nothing changes. You put the data in
// there, copy and paste, do the same thing."
import { describe, it, expect } from 'vitest'
import { menuFor, menuToBrowse, templateById, SENT_FROM_ITS_OWN_STEP } from './milestone-emails'
import { assembleMilestoneEmail } from './milestone-send'
import { outstandingLines, isIoDeal, settlementWords } from './settlement-emails'

const FIVE = ['loan_documents', 'settlement_numbers', 'settlement_booked', 'settled', 'month_in']

const state = (deal: any, id: string) => menuFor(deal).find(i => i.id === id)!

describe('when each one becomes ready', () => {
  it('nothing is ready on a deal that has not reached formal', () => {
    for (const id of FIVE) expect(state({}, id).state, id).toBe('not_yet')
  })

  it('the loan documents email waits for the documents to be issued', () => {
    expect(state({ settlement_stage: 'formal' }, 'loan_documents').state).toBe('not_yet')
    expect(state({ settlement_stage: 'contracts_issued' }, 'loan_documents').state).toBe('ready')
    // And stays available afterwards - a client loses an email.
    expect(state({ settlement_stage: 'outstandings' }, 'loan_documents').state).toBe('ready')
  })

  it('the numbers wait for a date, booked or expected', () => {
    expect(state({ expected_settlement_date: '2026-11-28' }, 'settlement_numbers').state).toBe('ready')
  })

  // "YOUR SETTLEMENT IS BOOKED" ABOUT A DATE NOBODY HAS ACCEPTED IS THE EMAIL
  // THAT GETS A CLIENT TO BOOK A REMOVALIST.
  it('but the booked email waits for a CONFIRMED date', () => {
    expect(state({ expected_settlement_date: '2026-11-28' }, 'settlement_booked').state).toBe('not_yet')
    expect(state({ confirmed_settlement_date: '2026-11-28' }, 'settlement_booked').state).toBe('ready')
  })

  it('settled waits for settlement', () => {
    expect(state({ settled_at: '2026-11-28T00:00:00Z' }, 'settled').state).toBe('ready')
  })

  // READY EARLY RATHER THAN LOCKED, with the note saying how long it has been.
  it('one month in is ready from settlement, and says how long it has been', () => {
    const just = state({ settled_at: new Date().toISOString() }, 'month_in')
    expect(just.state).toBe('ready')
    expect(just.note).toContain('days ago')
    const old = state({ settled_at: '2026-01-01T00:00:00Z' }, 'month_in')
    expect(old.note).toContain('due now')
  })

  it('every one of them says why when it is not yet', () => {
    for (const id of FIVE) expect(state({}, id).note, id).not.toBe('')
  })
})

// ONE DOOR, LIKE THE OFFER ACCEPTED EMAIL. They read figures and lender
// answers that cannot be filled in from the Templates page.
describe('where they are sent from', () => {
  it('the deal, never the templates page', () => {
    for (const id of FIVE) expect(SENT_FROM_ITS_OWN_STEP).toContain(id)
    const browsable = menuToBrowse({ settled_at: '2026-11-28T00:00:00Z' }).map(i => i.id)
    for (const id of FIVE) expect(browsable, id).not.toContain(id)
  })

  it('and none of them promises an attachment it has not got', () => {
    for (const id of FIVE) expect(templateById(id)!.letterRequired, id).toBe(false)
  })
})

describe('the assembler builds all five', () => {
  const deal = {
    id: 'd1',
    settlement_stage: 'contracts_issued',
    confirmed_settlement_date: '2026-11-28',
    settled_at: '2026-11-28T00:00:00Z',
    transaction_type: 'refinance',
    outstandings: 'Signed loan documents\nCertificate of currency',
    fact_find_data: { applicants: [{ firstName: 'Tomas', email: 'tomas@example.com' }] },
    lo_data: {},
  }
  const input = (templateId: any) => ({
    deal, templateId, rules: {},
    sender: { name: 'Belle Tran', email: 'belle@example.com', phone: '02 8355 4100' },
  }) as any

  it('each one comes back with a subject and a body', () => {
    for (const id of FIVE) {
      const out = assembleMilestoneEmail(input(id))
      expect(out, id).not.toBeNull()
      expect(out!.subject.trim(), id).not.toBe('')
      expect(out!.html, id).toContain('Tomas')
    }
  })

  // NOTHING IS INVENTED, AND THE SCREEN SAYS SO.
  it('the numbers email says its breakdown is not built yet', () => {
    const out = assembleMilestoneEmail(input('settlement_numbers'))!
    expect(out.problems.join(' ')).toContain('not worked out by the portal yet')
  })

  it('and the month-in email says the four checks were never written down', () => {
    const out = assembleMilestoneEmail(input('month_in'))!
    expect(out.problems.join(' ')).toContain('four checks')
  })

  // The outstandings the team typed print into the email rather than being
  // retyped - that is why it is one field.
  it('the outstandings print into the loan documents email', () => {
    const out = assembleMilestoneEmail(input('loan_documents'))!
    expect(out.html).toContain('Signed loan documents')
    expect(out.html).toContain('Certificate of currency')
  })
})

describe('reading the outstandings box', () => {
  it('splits however somebody typed it', () => {
    expect(outstandingLines({ outstandings: 'One\n- Two\n• Three' }))
      .toEqual(['One', 'Two', 'Three'])
  })

  it('and an empty box is no lines, not one empty one', () => {
    expect(outstandingLines({})).toEqual([])
    expect(outstandingLines({ outstandings: '  \n ' })).toEqual([])
  })
})

describe('the settlement day, as a person says it', () => {
  it('names the weekday, because that is what they ring about', () => {
    expect(settlementWords('2026-11-27')).toBe('Friday 27 November')
  })

  it('and says nothing at all where there is no date', () => {
    expect(settlementWords('')).toBe('')
    expect(settlementWords('whenever')).toBe('')
  })
})

describe('interest only', () => {
  // THE BORROWING CAPACITY OWNS THE STRUCTURE - see splitsOf in
  // lib/deal-structure.ts and the Veljovic deal it was written for.
  it('is true where any split is', () => {
    expect(isIoDeal({ bc_data: { splits: [
      { repaymentType: 'P&I' }, { repaymentType: 'Interest only' }] } })).toBe(true)
  })

  it('and false on a plain principal and interest loan', () => {
    expect(isIoDeal({ bc_data: { splits: [{ repaymentType: 'P&I' }] } })).toBe(false)
  })

  it('and false on a deal with no structure at all, rather than throwing', () => {
    expect(isIoDeal({})).toBe(false)
  })
})
