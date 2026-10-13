// THE LENDING OPTIONS HOLDS A COPY OF THE BC'S FIGURES. THIS IS THAT LIST.
//
// 13 Oct 2026, India Roberts. Mellissa: "BC numbers are not reflecting properly
// in the LO template". The borrowing capacity said $1,050,000 / $42,000 and the
// client email said $975,000 / $35,000 - and on the lending options tab both
// numbers were on screen AT THE SAME TIME. The strip at the top read the BC and
// was right; the Scenario boxes below it were the LO's own old copies, and the
// email is built from those.
//
// THE THIRD TIME THIS SHAPE HAS BITTEN. The splits, then the loan amount, now
// these. Always the same: the lending options takes a copy of something the
// borrowing capacity owns, and nothing ever re-takes it.
//
// It is not the sync effect's fault - that runs and is correct. It is that a
// record arriving afterwards goes through fillMissing(), which fills only keys
// that are ABSENT, and a stale copy is not absent. So the copy wins, every
// time, for ever.
//
// Making these boxes read-only this morning stopped somebody typing a NEW wrong
// number into them. It did nothing about the old one already sitting there.
//
// So the list lives here, on its own, and both the sync effect and the loader
// read it. A field named here cannot be kept stale by either path.
export const LO_FIELDS_THE_BC_OWNS = [
  'firstName', 'lastName', 'joint', 'jointFirstName', 'jointLastName',
  'purchasePrice', 'deposit', 'stampDuty', 'dutyState', 'depositSource',
  'additionalSavings', 'existingLoan', 'propertyValue', 'brandId',
  // loanAmount is the sum of the BC's splits - see loanAmount() in
  // lib/funds-to-complete.ts - and it is the one that reached a client.
  'loanAmount',
  // bcTemplate is which scenario this is, and the email branches on it.
  'bcTemplate',
] as const

export type LoFieldTheBcOwns = typeof LO_FIELDS_THE_BC_OWNS[number]

/**
 * The stored record with every BC-owned field replaced by what the BC says now.
 *
 * `fresh` is blankData() - already built from the BC. Anything NOT in the list
 * is the lending options' own answer and is left exactly as it was saved.
 */
export function bcFieldsWin(stored: any, fresh: any): any {
  const out: any = { ...(stored && typeof stored === 'object' ? stored : {}) }
  for (const key of LO_FIELDS_THE_BC_OWNS) {
    if (fresh && key in fresh) out[key] = fresh[key]
  }
  return out
}
