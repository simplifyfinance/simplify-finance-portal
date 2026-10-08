// CLONING A DEAL, AND WHAT A CLONE IS FOR.
//
// 8 Oct 2026. A deal was lodged with one bank and has to go in again with
// another. The portal's own rule for that is to clone - BCForm says it in two
// places: "Lending options have been started on this scenario, so it is the one
// going ahead. To change it now, clone the deal." Fabio's words in
// lib/bc-scenarios.ts: "I rather we clone the deal and change if we have to
// switch after LO is sent."
//
// But Clone copied the Fact Find and nothing else, and said so in its own
// confirm box: "This copies Fact Find only - BC, LO, and Compliance start
// fresh." So the rule sent you to a button that threw away the two forms you
// were trying to keep, and the borrowing capacity and the lending options had
// to be typed again from scratch. Fabio: "when we clone the BC and LO are not
// coming accross I want all the way to LO to be cloned."
//
// SO THE LINE IS DRAWN AFTER LENDING OPTIONS.
//
// What a re-lodgement keeps is the work that describes the CLIENT and the
// DEAL: who they are, what they can borrow, what was put in front of them.
// What it must not keep is anything that records what happened with the bank
// that said no - that is the history of the old file and it belongs to it.
//
// ================================================================= what travels
//
//   assigned_credit_officer
//                    who is working it. A re-lodgement is the same file with a
//                    different bank. It is also what the database checks before
//                    it will let a staff member create a deal at all - see the
//                    note beside it below.
//   fact_find_data   who they are. Already travelled.
//   bc_data          the borrowing capacity, which is the scenario in play.
//   bc_scenarios     the parked second scenario. Without it a clone silently
//                    loses one of the two the client was given - and the
//                    parked one is a WHOLE bc_data, so it costs nothing to
//                    bring and everything to rebuild. See lib/bc-scenarios.ts.
//   lo_data          the lending options. The recommended bank inside it is
//                    the one being replaced, which is the point: the figures,
//                    the fees and the wording stay, and the bank is changed.
//
// ============================================================= what does NOT
//
//   compliance_data  "all the way to LO". Compliance is written about a
//                    specific recommendation to a specific lender, and
//                    carrying it would put a signed-off reasoning document
//                    against a bank nobody has chosen yet.
//
//   every date in WORK_DONE - bc_sent_at, lo_sent_at, lodged_at, settled_at
//                    and the rest. Nothing has been sent on a clone and
//                    nothing has been lodged. These decide which column the
//                    card sits in and what the client is told, so a copied one
//                    would be a straight lie. lib/clone-deal.test.ts fails the
//                    ship if one ever creeps into the list below.
//
//   lender_id, the loan numbers, the commission rows, the documents - all of
//                    them belong to the lodgement that is being replaced.
//
//   row_version      the clone is a new row and starts its own count.
//
// THE CARD LANDS IN FACT FIND, which is correct and will look odd the first
// time: the clone has a full BC and a full LO, but nothing has been SENT on
// it, and the board reads the dates rather than the forms. Open it, send the
// BC or go straight to lending options, and it moves on its own.

// Read off the original. Kept as a list so the select and the insert cannot
// drift apart - the select asking for one column fewer than the insert writes
// is how a clone quietly loses a form.
export const CLONE_READS = [
  'client_id', 'deal_type', 'assigned_broker', 'assigned_credit_officer',
  'fact_find_data', 'bc_data', 'bc_scenarios', 'lo_data',
] as const

export const CLONE_SELECT = CLONE_READS.join(', ')

// The question, in one place, because it was asked in two and both copies said
// something that stopped being true.
export function cloneAsks(dealName: string): string {
  return `Clone "${dealName}"?\n\n`
       + 'The fact find, the borrowing capacity and the lending options all come across, '
       + 'ready to be pointed at a different bank.\n\n'
       + 'Compliance starts fresh, and nothing about the old lodgement comes with it - '
       + 'no lender, no dates, no documents.'
}

// What gets written. Everything not named here is left at its default on
// purpose; see the note above for the ones that matter.
export function cloneFields(from: any, newDealName: string): Record<string, any> {
  return {
    deal_name: newDealName,
    client_id: from.client_id,
    deal_type: from.deal_type,
    assigned_broker: from.assigned_broker,
    // THE CREDIT OFFICER COMES TOO, AND THE DATABASE INSISTS ON IT.
    //
    // 8 Oct 2026. A staff member pressed Clone and got "new row violates
    // row-level security policy for table deals".
    //
    // The rule for creating a deal (docs/rls_rollback_2026-08-19.sql, "Deal
    // editing by role") lets exactly three people through: an admin, a broker
    // whose own broker_key matches assigned_broker, or a staff member who is
    // the assigned_credit_officer ON THE NEW ROW. The clone copied the broker
    // and not the credit officer, so a staff member's clone was born with that
    // column empty, matched none of the three, and was refused by the database
    // before it ever reached the board.
    //
    // It should travel anyway, RLS or no RLS: a re-lodgement is the same file
    // with a different bank, and the person working it does not change.
    assigned_credit_officer: from.assigned_credit_officer ?? null,
    // A NEW DEAL IS NOT A BC. This column is legacy - phaseOf works out where a
    // deal really is from what has actually been done to it - but it is still
    // written here, and it was being born as 'BC' in one of the two callers,
    // which the dashboard printed on a deal nobody had opened yet.
    stage: 'FactFind',
    status: 'in_progress',
    fact_find_data: from.fact_find_data,
    bc_data: from.bc_data,
    bc_scenarios: from.bc_scenarios,
    lo_data: from.lo_data,
  }
}
