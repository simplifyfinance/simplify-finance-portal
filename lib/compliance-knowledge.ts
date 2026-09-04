// WHAT COMPLIANCE SAYS EACH BOX IS FOR.
//
// Taken from the Simplify Finance Compliance Knowledge Base, which gives, per
// CRM field: what the box must cover, the rule it has to satisfy, how long the
// answer should be, the exact wording for a missing fact, and an APPROVED
// EXAMPLE ANSWER.
//
// The example is the valuable part. Until now every box told the model what to
// cover and never once showed it what a correct answer looks like - so tone,
// depth and running order were all left to chance.
//
// THREE LAYERS, AND ONLY THE FIRST TWO COME FROM THE DEAL:
//
//   Facts      every figure, name and date. Pulled from the deal by the facts
//              block. Traceable to a field. Never written by the model.
//   Reasoning  the sentences that connect the facts - why a split, why interest
//              only on one part. The model writes these, and every one has to be
//              defensible from a fact that is present.
//   Shape      length, order, how it opens and closes. From the example.
//
// THE EXAMPLE IS FENCED ON PURPOSE. Hand a model a worked example and it will
// borrow details from it - a suburb, a lender, a figure. That is the exact
// failure this whole exercise exists to stop, arriving through the door we
// opened to fix it. So the figures below are deliberately unmistakable
// (1,111,000 / 777,000 / 44 / Example Bank). If one of them ever appears in a
// real answer, it is obvious at a glance and the fence has failed.

export type ComplianceBox = {
  key: string
  crmField: string
  // Compliance's own bullet list of what the box must cover.
  covers: string[]
  rule: string
  outputStyle: string
  // Their words, not ours. This phrase appears in audited files.
  missingRule: string
  example: string
  // Every fact in the example, and the field it would come from on a real deal.
  // This is what makes the box auditable: if a sentence in a generated answer
  // has no row here, it came from somewhere it should not have.
  factSources: { fact: string; source: string }[]
}

export const NEEDS_PRIMARY: ComplianceBox = {
  key: 'needsPrimary',
  crmField: 'Needs and objectives — Please state primary reasons for seeking credit / your needs & objectives',
  covers: [
    'Purpose of the loan (owner occupied / investment) and why',
    'Loan amount / loan term and why',
    'Any specific features / lenders / interest rate types / repayment types and why',
    'Any flexibility on the client’s stated needs and objectives and why',
    'Savings held / retention of any savings and why',
    'Any personal circumstances that may affect the loan (financial circumstances, employment, family status)',
    'First home buyer',
  ],
  rule: 'Must reference client goals',
  outputStyle: 'Short paragraph',
  missingRule: 'If not provided, write: Not provided – requires confirmation.',

  example: `The applicant is seeking finance to purchase an investment property in Exampleton, NSW valued at approximately $1,111,000. She is requesting a loan amount of $777,000 over a 30-year term, representing a conservative LVR of approximately 70%.

The applicant has requested a split loan structure comprising both Interest Only and Principal & Interest repayments. The Interest Only split will assist with cash flow flexibility, while the Principal & Interest split will facilitate debt reduction and equity accumulation from settlement.

The applicant prefers Example Bank and requires a variable rate loan with offset, redraw and online banking functionality. While Example Bank is the preferred lender, the applicant is willing to consider alternative lenders that meet her requirements and provide a suitable overall outcome.

Funds for the purchase will be sourced from existing savings and the sale of shares. The applicant intends to retain a cash buffer after settlement to provide ongoing financial flexibility and cover unforeseen expenses.

The applicant is a 44-year-old full-time Office Manager earning approximately $111,000 per annum. She has two dependent children under a shared custody arrangement, stable employment, a strong asset position and no adverse credit history.

The applicant is not a first home buyer.`,

  factSources: [
    { fact: 'Investment or owner occupied', source: 'LO → each split’s purpose dropdown, added up. Never guessed from the scenario name' },
    { fact: 'Suburb and state', source: 'Compliance → security address on the deal structure block, else BC → suburb' },
    { fact: 'Property value', source: 'BC → purchase price, or every security added up on a refinance' },
    { fact: 'Loan amount', source: 'LO → loanAmount, else the BC splits added up' },
    { fact: 'Loan term', source: 'Compliance → term per split on the deal structure block, else BC → loanTerm' },
    { fact: 'LVR', source: 'Total lending ÷ every security recorded. Absent, never estimated, if either half is missing' },
    { fact: 'Split structure, and P&I or IO per split', source: 'LO → the recommended lender’s own splits' },
    { fact: 'Preferred lender', source: 'LO → recommendedLender' },
    { fact: 'Rate type', source: 'LO → which rate module the broker switched on (variable or fixed)' },
    { fact: 'Offset and redraw', source: 'LO → the recommended lender’s feature answers. Never claimed unless confirmed present' },
    { fact: 'Willingness to consider alternatives', source: 'LO → research criteria ticked, and the lender options actually researched' },
    { fact: 'Where the funds come from', source: 'BC → deposit source' },
    { fact: 'Savings retained after settlement', source: 'Fact find → assets, against the funds to complete. Only stated if there is something left over' },
    { fact: 'Age', source: 'Fact find → date of birth' },
    { fact: 'Employment basis, occupation, employer, income', source: 'Fact find → current employment and income rows, by type' },
    { fact: 'Dependants', source: 'Fact find → dependants. Not the BC copy, which defaults to zero when blank' },
    { fact: 'Custody arrangement', source: 'NOT RECORDED anywhere. Only ever appears if the broker wrote it in the goals boxes' },
    { fact: 'Credit history', source: 'Compliance → the four credit history answers on the Risks tab, as declarations' },
    { fact: 'First home buyer', source: 'BC → scenario is fhb, or the fact find shows property already held' },
  ],
}
