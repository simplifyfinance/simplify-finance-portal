// The loan splits shown under each lender option on a Lending Options document.
//
// The LO holds two lists: the global splits that define the deal structure, and
// a per-lender copy that the broker can adjust because a lender may want the
// money carved up differently. The per-lender copy was only ever created when a
// lender was ADDED - and the first lender option is not added, it is there from
// the moment the LO is created, with an empty list.
//
// So option 1 - which is usually the recommended lender - showed "No splits
// loaded" and no equity release row, while options 2 and 3 were fine. On
// Clementine's refinance on 2 Sep 2026: Bank of Melbourne 0 splits, Macquarie 2,
// ubank 2. Nobody would read that as a bug in the first option; it reads as
// something you forgot to fill in.
//
// Falling back to the global splits is what the label on the box already
// promises - "pre-filled - editable per lender" - and it repairs every LO
// already saved without touching the database.

export type GlobalSplit = { id: string; label: string; amount: string }
export type LenderSplit = {
  id: string; label: string; amount: string
  lvr: string; rate: string; repayment: string; repaymentType: string
}

export function seedFromGlobal(globals: GlobalSplit[] | undefined | null): LenderSplit[] {
  return (globals || []).map(s => ({
    id: s.id, label: s.label, amount: s.amount,
    lvr: '', rate: '', repayment: '', repaymentType: 'P&I',
  }))
}

// What to show under this lender: its own splits once it has any, otherwise the
// deal's. A lender that has been edited keeps its edits - the fallback only
// covers the never-filled case, so pressing "Sync from top" is still the way to
// throw away an override.
export function resolveLenderSplits(
  lender: { lenderSplits?: LenderSplit[] | null } | null | undefined,
  globals: GlobalSplit[] | undefined | null,
): LenderSplit[] {
  const own = lender?.lenderSplits
  if (own && own.length > 0) return own
  return seedFromGlobal(globals)
}
