// WHAT EACH BANK CALLS THE FEE AT SETTLEMENT.
//
// The portal called it "Legal fee" everywhere, because that is what Bankwest
// calls it. Almost nobody else does - most lenders call it a settlement fee, and
// a few charge nothing at all beyond the government registration fees. A lending
// options email that puts "Legal fee: $200" against CBA is telling the client
// about a fee CBA does not have a name for, and the client then cannot find it
// on the bank's own paperwork.
//
// Fabio, 2 Sep 2026: "some banks call theyr legal and settlement fees in a
// different way... any chance you can change the wording on the library for all
// banks so I dotn ahve to do one by one".
//
// So the wording is a property of the LENDER, set once in the library, and every
// product underneath it inherits it. It is snapshotted onto the lending options
// row when a lender is chosen, exactly as the fee amounts already are, so a
// document written last month keeps the wording it was written with.

// The default is what an UNCHECKED lender says, so it should be the commoner
// word. Of the thirteen Fabio checked on 2 Sep 2026, twelve say settlement fee
// and only Bankwest says legal fee - so "Legal fee" was the worst possible
// default, and it was the one every lender had.
export const DEFAULT_LEGAL_FEE_LABEL = 'Settlement fee'

// A guess is still a guess. `confirmedFeeLabel` says whether a human has
// actually set this lender's wording, so the library can mark the ones nobody
// has checked instead of them looking as settled as the rest.
export function confirmedFeeLabel(lender: any): boolean {
  return String(lender?.legal_fee_label ?? '').trim() !== ''
}

// The lender record may not have one, and a blank must never print as a blank
// heading.
export function legalFeeLabel(lender: any): string {
  const set = String(lender?.legal_fee_label ?? '').trim()
  return set || DEFAULT_LEGAL_FEE_LABEL
}

// The same thing for a row already written into a deal's lending options, where
// the wording was copied at the time it was chosen.
export function rowLegalFeeLabel(row: any): string {
  const set = String(row?.legalFeeLabel ?? '').trim()
  return set || DEFAULT_LEGAL_FEE_LABEL
}

// What Fabio's list said each lender calls it, on 2 Sep 2026. Used to seed the
// library once; after that the library is the truth and this is only a record of
// where the seed came from. Names are matched loosely because the library holds
// "St George" and a rate sheet may say "St.George".
export const LEGAL_FEE_LABELS: { lender: string; label: string; fee: string }[] = [
  { lender: 'Bankwest',          label: 'Legal fee',      fee: '$350' },
  { lender: 'CBA',               label: 'Settlement fee', fee: '$200' },
  { lender: 'ANZ',               label: 'Settlement fee', fee: '$160' },
  { lender: 'St George',         label: 'Settlement fee', fee: '$100' },
  { lender: 'ING',               label: 'Settlement fee', fee: '$350' },
  { lender: 'Westpac',           label: 'Settlement fee', fee: '$100' },
  { lender: 'Suncorp',           label: 'Settlement fee', fee: 'None — government fees only' },
  { lender: 'Bank of Melbourne', label: 'Settlement fee', fee: '$100' },
  { lender: 'Bank Australia',    label: 'Settlement fee', fee: 'None — government fees only' },
  { lender: 'Macquarie',         label: 'Settlement fee', fee: '$350' },
  { lender: 'ME Bank',           label: 'Settlement fee', fee: '$150' },
  { lender: 'NAB',               label: 'Settlement fee', fee: 'None — government registration fees only' },
  { lender: 'ubank',             label: 'Settlement fee', fee: '$250' },
]
