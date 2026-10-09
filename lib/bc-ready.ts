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

import { everySplitHasAPurpose } from './debt-recycling'
import { isSellAndBuild } from './sale-build'
import { everySplitHasAProperty } from './complex-refinance'

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
  // THE BOXES THIS FORM ACTUALLY HAS. It asked for newPurchasePrice and
  // newPurchaseDeposit, which the buy and sell form never draws and the buy and
  // sell email never prints - so every one of these BCs reported two boxes
  // missing that nobody could fill. 9 Oct 2026.
  buy_sell:            ['salePrice', 'agentFees', 'existingLoanBal', 'purchasePrice', 'deposit', 'splitAmount', 'splitRate'],
  // The same sale, and then the construction card instead of the purchase one.
  // See lib/sale-build.ts - this is an answer on buy_sell, not a template.
  buy_sell_build:      ['salePrice', 'agentFees', 'existingLoanBal', 'landValue', 'constructionCost', 'asIfCompleteValue', 'splitAmount', 'splitRate'],
  bridging:            ['suburb', 'purchasePrice', 'existingLoanBal', 'splitAmount', 'splitRate'],
  family_pledge:       ['suburb', 'purchasePrice', 'deposit', 'guarantorName', 'splitAmount', 'splitRate'],
  smsf:                ['suburb', 'purchasePrice', 'deposit', 'splitAmount', 'splitRate'],
  construction:        ['suburb', 'landValue', 'constructionCost', 'asIfCompleteValue', 'splitAmount', 'splitRate'],
  // The limit is the container the whole email is drawn around, and a split
  // with no purpose on it is the one thing this scenario must never guess at -
  // so both are boxes the email wanted and did not get. See lib/debt-recycling.ts.
  debt_recycling:      ['suburb', 'existingLoanBal', 'propertyValue', 'totalLimit',
                        'splitAmount', 'splitRate', 'splitPurposes'],
  // The whole email is grouped by property, so a split with no property on it
  // lands in a card headed "Other lending" - visible, but not what anybody
  // meant. Named here so it is caught on the Preview screen first.
  complex_refinance:   ['existingLoanBal', 'splitAmount', 'splitRate',
                        'splitPurposes', 'splitProperties'],
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
  totalLimit:        { label: 'Total limit after restructure', where: 'Scenario details' },
  splitPurposes:     { label: 'Purpose',                   where: 'Loan splits - every split needs one' },
  splitProperties:   { label: 'Property',                  where: 'Loan splits - every split needs one' },
  ioYears:           { label: 'IO period (years)',         where: 'Loan splits - on every interest only split' },
  splitAmount:       { label: 'Amount',                    where: 'Loan splits, split 1' },
  splitRate:         { label: 'Rate',                      where: 'Loan splits, split 1' },
  split2Amount:      { label: 'Amount',                    where: 'Loan splits, split 2' },
  split2Rate:        { label: 'Rate',                      where: 'Loan splits, split 2' },
}

function valueOf(key: string, d: any): any {
  // NOT A BOX, A CONDITION. Every split with money in it has to carry a purpose
  // before the email can say anything about purpose at all - so this answers
  // "are they all set" in the only shape this file understands, filled or empty.
  if (key === 'splitPurposes') return everySplitHasAPurpose(d) ? 'set' : ''
  if (key === 'splitProperties') return everySplitHasAProperty(d) ? 'set' : ''
  if (key === 'splitAmount')  return d?.splits?.[0]?.amount
  if (key === 'splitRate')    return d?.splits?.[0]?.rate
  if (key === 'split2Amount') return d?.splits?.[1]?.amount
  if (key === 'split2Rate')   return d?.splits?.[1]?.rate
  return d?.[key]
}

export function missingForEmail(template: string, d: any): MissingBox[] {
  // The template decides, except where an answer inside the template decides
  // instead. Asked of the record, so nothing has to pass a second argument.
  const wanted = isSellAndBuild({ ...d, template })
    ? NEEDS.buy_sell_build
    : (NEEDS[txt(template)] || NEEDS.custom)
  const missing = wanted
    .filter(k => empty(valueOf(k, d)))
    .map(k => LABEL[k])
    .filter(Boolean)

  // THE ONE THAT APPLIES TO EVERY SCENARIO.
  //
  // Fabio, 1 Oct 2026: "ensure we are including IO perios 1-5 years as we tehnd
  // to forget." An interest only split with no period printed "Interest only"
  // and stopped, which a client reads as thirty years of it. It is not a box
  // one template wants and another does not - any scenario can carry an
  // interest only split - so it is checked for all of them rather than added to
  // fourteen lists, which is how the next scenario would miss it.
  if (ioYearsMissing(d)) missing.push(LABEL.ioYears)

  return missing
}

const IO = /interest only|^io$/i

export function ioYearsMissing(d: any): boolean {
  const splits = Array.isArray(d?.splits) ? d.splits : []
  return splits.some((s: any) =>
    // An empty row the form is always carrying is not a split.
    !empty(s?.amount) && IO.test(txt(s?.type)) && empty(s?.ioYears))
}

// "Suburb, Existing loan balance and Amount (split 1)"
export function missingSentence(missing: MissingBox[]): string {
  const names = missing.map(m => m.label)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}
