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
  // `id` and `deal_name` so a fact find can say where it came from - see
  // withProvenance. The select asking for one column fewer than the insert
  // writes is how a clone quietly loses a form, so they live in one list.
  'id', 'deal_name',
  'client_id', 'deal_type', 'assigned_broker', 'assigned_credit_officer',
  'fact_find_data', 'bc_data', 'bc_scenarios',
  // lo_data IS STILL READ although neither kind of clone writes it: a deal
  // page that has it in hand can say what is being left behind. It is listed
  // here so the select and the insert stay one list - a select asking for one
  // column fewer than the insert writes is how a clone quietly loses a form.
  'lo_data',
] as const

export const CLONE_SELECT = CLONE_READS.join(', ')

// TWO DIFFERENT THINGS, AND THEY WERE NEARLY ONE BUTTON.
//
// 13 Oct 2026. Fabio, with four refinances about to lodge and a purchase to
// write alongside them for the same clients:
//
//   "when we clone that deal that is a complex refinance, it's not allowing me
//    to do a purchase because it's cloning all the way to lending options"
//
// Cloning to the lending options is "another version of THIS deal" - same
// people, same scenario, pointed at a different bank. He likes it and it stays
// exactly as it is.
//
// What he needed is "another deal for THESE PEOPLE". Their circumstances are
// the same; everything about the loan is new. That is not a copy of a deal at
// all, which is why it gets its own name rather than a question on Clone. A
// dialog asking "how far should this copy?" makes somebody think about our
// tabs at the moment they are trying to do something simple.
// THREE DOORS, NOT TWO.
//
// 15 Oct 2026. Fabio: "would you like to clone this deal all the way to lending
// options, or would you like to clone this deal all the way to borrowing
// capacity? And then put a little note that if you clone it to lending
// options, you won't be able to change BC."
//
// Earlier today the lending options stopped travelling at all, because carrying
// them froze the clone's scenario the moment it was born. That fixed the freeze
// and quietly took away re-lodging the same deal at another bank. Offering both
// and naming the cost is better than either default.
//
//   'lending-options'     everything, ready for another bank. Scenario locked.
//   'borrowing-capacity'  the figures, lending options blank. Scenario yours.
//   'clients'             the people only. UNCHANGED - do not touch it.
export type CloneKind = 'lending-options' | 'borrowing-capacity' | 'clients'

export function cloneAsks(dealName: string, kind: CloneKind = 'borrowing-capacity'): string {
  if (kind === 'clients') {
    return `New deal for the clients on "${dealName}"?\n\n`
         + 'Comes across: both applicants, their income, expenses, liabilities and properties.\n\n'
         + 'Does not: the scenario, the securities, the splits, the lending options, '
         + 'compliance, documents.\n\n'
         + 'You start on a blank borrowing capacity and choose the scenario yourself.'
  }
  if (kind === 'lending-options') {
    return `Clone "${dealName}" with the lending options?\n\n`
         + 'Comes across: the fact find, the borrowing capacity, and the lender options and '
         + 'pricing. Ready to point at another bank.\n\n'
         + 'THE SCENARIO IS LOCKED. Because the lending options come too, you will not be '
         + 'able to change the BC template or swap scenarios on the copy. To change it, '
         + 'clone to the borrowing capacity instead.\n\n'
         + 'Compliance starts fresh, and nothing about the old lodgement comes with it - '
         + 'no lender, no dates, no documents.'
  }
  return `Clone "${dealName}" to the borrowing capacity?\n\n`
       + 'Comes across: the fact find and the borrowing capacity - the people, the figures, '
       + 'the securities and the splits.\n\n'
       + 'The lending options start fresh, so you pick the bank again and the scenario is '
       + 'still yours to change.\n\n'
       + 'Compliance starts fresh too, and nothing about the old lodgement comes with it - '
       + 'no lender, no dates, no documents.'
}

// WHERE THIS FACT FIND CAME FROM, AND WHEN.
//
// It is a COPY, not a link. Update the refinance's fact find next week and this
// one will not hear about it - the same drift we spent two days removing, one
// level up. The expensive fix is both deals reading one client record; the
// cheap and honest one is for the new deal to say where its figures came from
// so nobody assumes they are live. That line is the whole defence.
export function withProvenance(factFind: any, from: any, dealName: string, when: Date): any {
  const ff = factFind && typeof factFind === 'object' ? factFind : {}
  return {
    ...ff,
    copiedFrom: {
      dealId: from?.id ?? null,
      dealName: String(dealName || ''),
      at: when.toISOString(),
    },
  }
}

/** "from Velimir_Veljovic_Refinance_2026, copied on 13 October 2026" */
export function provenanceLine(factFind: any): string {
  const c = factFind?.copiedFrom
  if (!c?.dealName) return ''
  const d = new Date(String(c.at || ''))
  const when = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  return `from ${c.dealName}${when ? `, copied on ${when}` : ''}`
}

// What gets written. Everything not named here is left at its default on
// purpose; see the note above for the ones that matter.
export function cloneFields(from: any, newDealName: string, kind: CloneKind = 'borrowing-capacity'): Record<string, any> {
  // THE LOAN DOES NOT COME. Only the people and what they own.
  //
  // bc_data carries the scenario, the securities and the splits; lo_data
  // carries the lenders and the pricing. A purchase written on top of a complex
  // refinance's borrowing capacity is the fault Fabio hit - the scenario was
  // already answered and would not let him change it.
  if (kind === 'clients') {
    return {
      deal_name: newDealName,
      client_id: from.client_id,
      assigned_broker: from.assigned_broker,
      assigned_credit_officer: from.assigned_credit_officer ?? null,
      stage: 'FactFind',
      status: 'in_progress',
      // deal_type is left out on purpose: a refinance's type on a deal that
      // has not chosen its scenario yet is a guess, and it is the one thing
      // this whole action exists to let somebody answer afresh.
      fact_find_data: withProvenance(from.fact_find_data, from, String(from.deal_name || ''), new Date()),
    }
  }
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
    // THE LENDING OPTIONS TRAVEL ONLY WHEN THEY WERE ASKED FOR BY NAME.
    //
    // Carrying them is what froze the clone - downstreamStarted() reads lo_data
    // to answer "has anybody started the lending options", so a copy of it is a
    // copy of the answer YES onto a deal nobody has opened. Still true. It is
    // now a thing somebody CHOSE, with the cost written on the button.
    ...(kind === 'lending-options' ? { lo_data: from.lo_data } : {}),
    // AND WHY THEY DO NOT ON THE OTHER ONE, WHICH IS WHAT UNLOCKS IT.
    //
    // 15 Oct 2026. Fabio cloned a deal to change the scenario from an owner
    // occupied purchase to an investment purchase, and the clone was frozen
    // the moment it was born - "Lending options have been started on this
    // scenario, so it is the one going ahead. To change it now, clone the
    // deal." On the clone. Telling him to do the thing he had just done.
    //
    // downstreamStarted() in lib/bc-scenarios.ts asks "has anybody started the
    // lending options" by looking at lo_data - the lenders, the LO email, the
    // lender on the deal. Copying lo_data copied the answer YES onto a deal
    // nobody had opened yet.
    //
    // This is the same fault that was fixed one level up on 13 Oct for "New
    // deal for these clients", and the note there says it exactly: "A purchase
    // written on top of a complex refinance's borrowing capacity is the fault
    // Fabio hit - the scenario was already answered and would not let him
    // change it." The fix was never applied to Clone.
    //
    // Nothing is lost that was worth keeping. A clone goes to a DIFFERENT bank
    // or a different scenario; either way the old lender list and its pricing
    // are wrong for it, and a wrong figure carried forward is worse than a
    // blank one. The borrowing capacity - the securities, the splits, the
    // numbers - is the part worth having, and it still comes.
  }
}
