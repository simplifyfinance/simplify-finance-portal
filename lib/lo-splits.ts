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

// --- the totals under each lender ------------------------------------------
//
// LVR is not a property of a split. Fabio, 2 Sep 2026: "dont calcualte LVR per
// split the LVR is alsways a sum of all splits /property value". The per-split
// LVR box invited three different answers to a question that has one, and
// nothing checked them against each other.
//
// It is calculated per LENDER, because a lender may lend a different total, and
// it is calculated rather than typed so the form and the email cannot disagree.

export function amountOf(v: any): number {
  return parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')) || 0
}

export function lenderTotal(splits: LenderSplit[] | undefined | null): number {
  return (splits || []).reduce((sum, s) => sum + amountOf(s?.amount), 0)
}

// Rounded UP to one decimal, the way every other LVR in the portal is, so a hair
// over 80 reads as over 80 rather than being rounded down into "no LMI".
// Zero when there is no value to divide by - the caller leaves the line out
// rather than printing "LVR 0%".
export function lenderLvr(splits: LenderSplit[] | undefined | null, propertyValue: any): number {
  const value = amountOf(propertyValue)
  if (value <= 0) return 0
  return Math.ceil((lenderTotal(splits) / value) * 1000) / 10
}

// Fold a lender's splits into a single loan.
//
// Some lenders will not carve a refinance up the way the deal is structured -
// ubank on Clementine's file wanted one loan of $696,000 where the others took
// $666,000 plus a $30,000 equity access. There was no way to say that: the
// per-lender rows had no delete, so the only option was zeroing a split and
// leaving a $0 line in the client's email.
//
// The amounts add up, because that much is arithmetic. The rate and type carry
// over ONLY if every split already agreed on them - picking the first one when
// they differ would be inventing a rate. The repayment is always cleared: a
// merged loan has a new repayment and the old one is now wrong.
export function combineIntoOneLoan(splits: LenderSplit[] | undefined | null): LenderSplit[] {
  const rows = splits || []
  if (rows.length === 0) return []
  const allSame = (get: (s: LenderSplit) => string) => {
    const first = get(rows[0]) || ''
    return rows.every(s => (get(s) || '') === first) ? first : ''
  }
  const total = lenderTotal(rows)
  return [{
    id: rows[0].id,
    label: 'One loan',
    amount: total > 0 ? total.toLocaleString('en-AU') : '',
    lvr: '',
    rate: allSame(s => s.rate),
    repayment: '',
    repaymentType: allSame(s => s.repaymentType) || 'P&I',
  }]
}

// What the client is taking on top of what they already owe.
//
// The "Your numbers would be" block on a refinance printed "Loan Amount:
// $666,000" and "Existing Loan Balance: $666,000" - the same figure twice, with
// the $30,000 equity release nowhere. Fabio, 2 Sep 2026: "did you forget that we
// also need this section to have the euqity release same as BC".
//
// It is the total being borrowed less the loan being paid out, which is what new
// money means. Zero when there is none, so a plain refinance does not sprout an
// "Equity release: $0" line - and never negative: a client borrowing LESS than
// they owe is contributing cash, which is a different sentence and not one this
// block is trying to write.
export function equityReleaseAmount(globals: { amount?: string }[] | undefined | null, existingLoan: any): number {
  const extra = lenderTotal(globals as LenderSplit[]) - amountOf(existingLoan)
  return extra > 0 ? Math.round(extra) : 0
}
