import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { CLONE_READS, CLONE_SELECT, cloneFields, cloneAsks } from './clone-deal'

// A CLONE KEEPS THE WORK AND LEAVES THE HISTORY.
//
// 8 Oct 2026. A deal lodged with one bank had to go in again with another.
// The portal's own rule for that is to clone - BCForm says so in two places -
// and Clone copied the Fact Find and nothing else. The borrowing capacity and
// the lending options had to be typed again.
//
// Fixing that puts a new risk in: a clone that copies too much. A copied
// lodged_at would put a brand new deal in the Settlements column. A copied
// compliance_data would hang a signed-off recommendation on a bank nobody has
// chosen. Both are worse than the fault being fixed, and neither would throw.
//
// So the list of what travels is guarded from both sides.

const source = readFileSync('lib/clone-deal.ts', 'utf8')

// From lib/deal-phase.ts. Not imported - that file does not export it, and a
// second copy here is the point: if somebody adds a date there and not here,
// this list is the one that was checked against the clone.
const WORK_DONE = [
  'bc_completed_at', 'bc_sent_at', 'proceeded_at',
  'lo_completed_at', 'lo_proceeded_at',
  'compliance_completed_at', 'compliance_sent_at', 'lodged_at',
  'preapproval_at', 'offer_accepted_at', 'formal_approval_at',
  'contracts_returned_at', 'settlement_booked_at', 'settled_at',
  'docs_received_at',
]

const written = cloneFields({
  client_id: 'c', deal_type: 't', assigned_broker: 'b', assigned_credit_officer: 'co-1',
  fact_find_data: { a: 1 }, bc_data: { b: 2 }, bc_scenarios: [{ c: 3 }], lo_data: { d: 4 },
}, 'whoever_clone')

describe('a clone keeps the work', () => {
  it('brings the fact find, the borrowing capacity and the lending options', () => {
    expect(written.fact_find_data, 'the fact find no longer travels').toEqual({ a: 1 })
    expect(written.bc_data, 'the borrowing capacity no longer travels - this is the\n'
      + 'whole reason the clone was changed').toEqual({ b: 2 })
    expect(written.lo_data, 'the lending options no longer travel').toEqual({ d: 4 })
  })

  it('brings the parked second scenario too', () => {
    // A parked scenario is a whole bc_data. Leaving it behind loses one of the
    // two the client was shown, silently, and it cannot be rebuilt from the
    // one that did travel. See lib/bc-scenarios.ts.
    expect(written.bc_scenarios).toEqual([{ c: 3 }])
  })

  it('keeps the person working it, which the database checks', () => {
    // 8 Oct 2026. A staff member got "new row violates row-level security
    // policy for table deals" pressing Clone. The rule for creating a deal lets
    // through an admin, a broker whose key matches assigned_broker, or a staff
    // member who is the assigned_credit_officer ON THE NEW ROW. The clone
    // copied the broker and not the credit officer, so a staff member's clone
    // was born matching none of the three and the database refused it.
    expect(written.assigned_credit_officer, 'a staff member cannot clone a deal\n'
      + 'without this - the row-level security rule refuses the insert')
      .toBe('co-1')
    expect(CLONE_READS).toContain('assigned_credit_officer')
    // Null rather than undefined, so a deal with no credit officer writes a
    // blank rather than leaving the column to a default nobody has read.
    expect(cloneFields({ assigned_broker: 'b' }, 'x').assigned_credit_officer).toBeNull()
  })

  it('reads every column it writes', () => {
    // The select asking for one column fewer than the insert writes is how a
    // clone quietly loses a form - it writes undefined and nothing complains.
    for (const k of ['fact_find_data', 'bc_data', 'bc_scenarios', 'lo_data', 'client_id', 'deal_type', 'assigned_broker', 'assigned_credit_officer']) {
      expect(CLONE_READS, `${k} is written by the clone but never read off the original`)
        .toContain(k)
      expect(CLONE_SELECT).toContain(k)
    }
  })
})

describe('and leaves the history behind', () => {
  it('copies no date that says something was done', () => {
    const carried = WORK_DONE.filter(f => f in written)
    expect(carried, 'a clone has had nothing sent, nothing lodged and nothing\n'
      + 'settled. These dates decide which column the card sits in and what the\n'
      + 'client is told, so a copied one is a straight lie.\n'
      + carried.join('\n')).toEqual([])
    const read = WORK_DONE.filter(f => (CLONE_READS as readonly string[]).includes(f))
    expect(read, 'the clone reads a date it has no business carrying').toEqual([])
  })

  it('does not copy compliance', () => {
    // Fabio drew the line himself: "I want all the way to LO to be cloned."
    // Compliance is written about one recommendation to one lender.
    expect(written).not.toHaveProperty('compliance_data')
    expect(CLONE_READS).not.toContain('compliance_data')
  })

  it('does not carry the bank that is being replaced', () => {
    for (const f of ['lender_id', 'lender', 'row_version', 'phase_override', 'phase_override_at']) {
      expect(written, `${f} belongs to the lodgement the clone exists to replace`)
        .not.toHaveProperty(f)
    }
  })

  it('is born in Fact Find, not in BC', () => {
    // One of the two callers wrote 'BC' here, so the dashboard printed BC on a
    // deal nobody had opened. The column is legacy either way - phaseOf reads
    // the dates - but it is still written, so it may as well be true.
    expect(written.stage).toBe('FactFind')
    expect(written.status).toBe('in_progress')
  })
})

describe('and says what it is about to do', () => {
  it('names the forms that travel, so the old wording cannot come back', () => {
    const asked = cloneAsks('Some Deal')
    expect(asked).toContain('Some Deal')
    expect(asked, 'the confirm no longer says the BC comes across').toMatch(/borrowing capacity/i)
    expect(asked, 'the confirm no longer says the LO comes across').toMatch(/lending options/i)
    expect(asked, 'the confirm still claims the BC and LO start fresh')
      .not.toMatch(/Fact Find only/i)
  })

  it('is asked from one place, so the two callers cannot drift', () => {
    // There were two Clone buttons with two copies of the same confirm string,
    // and both copies said something that had stopped being true.
    const board = readFileSync('app/(app)/deals/page.tsx', 'utf8')
    const page = readFileSync('app/(app)/deals/[id]/DealPageClient.tsx', 'utf8')
    for (const [name, src] of [['the board', board], ['the deal page', page]] as const) {
      expect(src, `${name} writes its own clone instead of using lib/clone-deal.ts`)
        .toContain('cloneFields(')
      expect(src, `${name} still asks the question in its own words`).toContain('cloneAsks(')
      expect(src, `${name} still lists the columns itself`).toContain('CLONE_SELECT')
      expect(src, `${name} still has the old wording in it`).not.toMatch(/Fact Find only/i)
    }
  })

  it('names the source file so the reasoning is findable', () => {
    expect(source).toMatch(/all the way to LO/)
  })
})
