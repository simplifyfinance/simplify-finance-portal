// IS THIS BC FINISHED ENOUGH TO SEND?
//
// The client email is built from the BC's own boxes. An empty box used to print
// a placeholder - "Against [Property Address]", "Estimated repayments
// [calculated]" - straight into an email that went to the client. Those lines
// are gone now: an empty box means the line is simply not there.
//
// Which is safer, and quieter, and creates its own problem. A half-finished
// scenario now LOOKS finished: the card just has fewer rows in it, and nothing
// says why. Fabio, 8 Sep 2026: "the broker needs to see it is wrong before
// sending."
//
// So this says which boxes the email wanted and did not get. It is advisory - it
// never stops anybody sending anything - and it names the boxes in the words
// they are labelled with on the form, so there is no hunting.
//
// ONLY WHAT THIS TEMPLATE'S EMAIL ACTUALLY PRINTS. A refinance email never shows
// a purchase price, so a blank purchase price is not missing - it is irrelevant,
// and a warning that lists irrelevant things is one nobody reads twice.

const txt = (v: any) => String(v ?? '').trim()
const empty = (v: any) => txt(v) === '' || txt(v) === '0'

export type MissingBox = { label: string; where: string }

// What each scenario's client email puts on screen, in the order the form has
// them. `splitAmount`/`splitRate` mean split 1; `split2*` mean the second.
const NEEDS: Record<string, string[]> = {
  refinance_only:      ['suburb', 'existingLoanBal', 'propertyValue', 'splitAmount', 'splitRate'],
  refinance_equity:    ['suburb', 'existingLoanBal', 'propertyValue', 'splitAmount', 'splitRate', 'equityRelease', 'split2Amount', 'split2Rate'],
  investment_equity:   ['suburb', 'existingLoanBal', 'propertyValue', 'splitAmount', 'splitRate', 'equityRelease'],
  oo_purchase:         ['suburb', 'purchasePrice', 'deposit', 'stampDuty', 'splitAmount', 'splitRate'],
  investment_purchase: ['suburb', 'purchasePrice', 'deposit', 'stampDuty', 'splitAmount', 'splitRate'],
  fhb:                 ['suburb', 'purchasePrice', 'deposit', 'stampDuty', 'splitAmount', 'splitRate'],
  oo_lvr_compare:      ['suburb', 'purchasePrice', 'splitAmount', 'splitRate'],
  buy_sell:            ['salePrice', 'agentFees', 'existingLoanBal', 'newPurchasePrice', 'newPurchaseDeposit', 'splitAmount', 'splitRate'],
  bridging:            ['suburb', 'purchasePrice', 'existingLoanBal', 'splitAmount', 'splitRate'],
  family_pledge:       ['suburb', 'purchasePrice', 'deposit', 'guarantorName', 'splitAmount', 'splitRate'],
  smsf:                ['suburb', 'purchasePrice', 'deposit', 'splitAmount', 'splitRate'],
  construction:        ['suburb', 'landValue', 'constructionCost', 'asIfCompleteValue', 'splitAmount', 'splitRate'],
  custom:              ['splitAmount', 'splitRate'],
}

// The words on the form, so nobody has to work out which box is meant.
const LABEL: Record<string, { label: string; where: string }> = {
  suburb:            { label: 'Suburb',                    where: 'Scenario details' },
  existingLoanBal:   { label: 'Existing loan balance',     where: 'Scenario details' },
  propertyValue:     { label: 'Property value',            where: 'Scenario details' },
  purchasePrice:     { label: 'Purchase price',            where: 'Scenario details' },
  newPurchasePrice:  { label: 'New purchase price',        where: 'Scenario details' },
  newPurchaseDeposit:{ label: 'New purchase deposit',      where: 'Scenario details' },
  deposit:           { label: 'Deposit',                   where: 'Scenario details' },
  stampDuty:         { label: 'Stamp duty',                where: 'Scenario details' },
  salePrice:         { label: 'Expected sale price',       where: 'Scenario details' },
  agentFees:         { label: 'Agent fees / selling costs',where: 'Scenario details' },
  equityRelease:     { label: 'Equity release',            where: 'Scenario details' },
  landValue:         { label: 'Land value',                where: 'Scenario details' },
  constructionCost:  { label: 'Construction cost',         where: 'Scenario details' },
  asIfCompleteValue: { label: 'As if complete value',      where: 'Scenario details' },
  guarantorName:     { label: 'Guarantor name',            where: 'Scenario details' },
  splitAmount:       { label: 'Amount',                    where: 'Loan splits, split 1' },
  splitRate:         { label: 'Rate',                      where: 'Loan splits, split 1' },
  split2Amount:      { label: 'Amount',                    where: 'Loan splits, split 2' },
  split2Rate:        { label: 'Rate',                      where: 'Loan splits, split 2' },
}

function valueOf(key: string, d: any): any {
  if (key === 'splitAmount')  return d?.splits?.[0]?.amount
  if (key === 'splitRate')    return d?.splits?.[0]?.rate
  if (key === 'split2Amount') return d?.splits?.[1]?.amount
  if (key === 'split2Rate')   return d?.splits?.[1]?.rate
  return d?.[key]
}

export function missingForEmail(template: string, d: any): MissingBox[] {
  const wanted = NEEDS[txt(template)] || NEEDS.custom
  return wanted
    .filter(k => empty(valueOf(k, d)))
    .map(k => LABEL[k])
    .filter(Boolean)
}

// "Suburb, Existing loan balance and Amount (split 1)"
export function missingSentence(missing: MissingBox[]): string {
  const names = missing.map(m => m.label)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}
