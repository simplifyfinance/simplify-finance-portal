import { describe, it, expect } from 'vitest'
import { allSections, handoverSections, factFindSections, copyTextOf, countCards,
         EXPENSE_CATEGORIES, RISK_GROUPS, PRODUCT_GROUPS } from './handover-view'

const deal = {
  deal_name: 'Chapman_Purchase_2026',
  transaction_type: 'purchase',
  property_use: 'owner_occupied',
  loan_amount: 1700000,
  lenders: { name: 'ING Orange Advantage' },
  compliance_data: {
    applicants: [{ name: 'Natasha Chapman' }, { name: 'Richard Chapman' }],
    needsPrimary: 'Clients are seeking to upgrade their **owner occupied** home.',
    analysisComment: '**ANALYSIS**\n\nOur clients are seeking a loan of **$1,700,000**.\n\n---\n\n**ASSESSMENT**\n\nRichard presents with a strong income.',
    securityComment: 'TBA - owner-occupied residential property, NSW.',
    preApproval: true,
    risks: { 'Richard Chapman': { adverseChanges: 'No', beneficialChanges: 'No' } },
    productReqs: { variableRate: 'Yes' },
    expenses: {
      groceries: { monthlyAmount: '1,600' },
      healthInsurance: { monthlyAmount: '420', hem: 'out' },
    },
  },
  fact_find_data: {
    applicants: [
      { id: 'a1', title: 'Mrs', firstName: 'Natasha', lastName: 'Chapman', dob: '14/03/1988',
        addresses: [{ isCurrent: true, address: '6 Bella Vista Court', residentialStatus: 'Owner occupied with a mortgage' }],
        employment: [{ isCurrent: true, employmentType: 'Not working', occupation: 'Domestic duties' }], income: [] },
      { id: 'a2', title: 'Mr', firstName: 'Richard', lastName: 'Chapman', dob: '1984-11-02',
        addresses: [], employment: [], income: [{ grossSalary: '446,428.63', grossSalaryFrequency: 'Annually' }] },
    ],
    liabilities: [{ liabilityType: 'Credit card', lenderName: 'Westpac', balance: '1,240' }],
  },
  bc_data: { template: 'oo_purchase', lvrPercent: 32.4, purchasePrice: '5,250,000' },
  lo_data: {
    recommendedLender: 'ING', recommendationNote: 'ING was recommended on rate.',
    lenders: [{ lenderName: 'CBA', productName: 'Wealth Package' },
              { lenderName: 'ING', productName: 'Orange Advantage' }],
  },
}

describe('the lists are defined once', () => {
  it('keeps the two askable HEM rows', () => {
    const ask = EXPENSE_CATEGORIES.filter(c => c.askHem).map(c => c.key)
    expect(ask).toEqual(['healthInsurance', 'primaryResidenceBodyCorp'])
  })
  it('says strata, not body corporate, on the page', () => {
    expect(EXPENSE_CATEGORIES.find(c => c.key === 'primaryResidenceBodyCorp')!.label)
      .toBe('Strata (primary residence)')
  })
  it('names the risk groups the way the Risks tab names them', () => {
    expect(RISK_GROUPS.map(g => g.title))
      .toEqual(['Financial situation', 'Exit strategy', 'Financial security', 'Credit history'])
  })
  it('flags that credit history cannot be answered automatically', () => {
    expect(RISK_GROUPS.find(g => g.title === 'Credit history')!.note).toMatch(/Equifax/)
  })
  it('has the six product groups', () => {
    expect(PRODUCT_GROUPS).toHaveLength(6)
  })
})

describe('the handover boxes', () => {
  const secs = handoverSections(deal)
  const boxes = secs.filter(s => s.accent === 'ink').flatMap(s => s.cards)

  it('numbers the boxes straight through, so box 2 on screen is box 2 on paper', () => {
    // Continuous across both groups: needs first, then broker comments. A gap
    // here means the screen and the PDF disagree about which box is which.
    expect(boxes.map(b => b.no)).toEqual(boxes.map((_, i) => i + 1))
    expect(boxes[0].key).toBe('needsPrimary')
  })
  it('leaves out a box nobody has written in', () => {
    expect(boxes.map(b => b.key)).not.toContain('needsImmediate')
  })
  it('marks the security box as a pre-approval so nobody "fixes" the TBA', () => {
    expect(boxes.find(b => b.key === 'securityComment')!.tag).toBe('Pre-approval')
  })

  it('asks the risk questions of every applicant, never one of them', () => {
    const risks = secs.find(s => s.key === 'risks')!
    expect(risks.cards.map(c => c.title)).toEqual(['Natasha Chapman', 'Richard Chapman'])
  })
  it('says so honestly when an applicant has no risk answers', () => {
    const risks = secs.find(s => s.key === 'risks')!
    const natasha = risks.cards.find(c => c.title === 'Natasha Chapman')!
    expect(natasha.rows).toHaveLength(0)
    expect(natasha.note).toMatch(/have not been asked yet/)
  })
  it('carries the HEM flag through to the expenses box', () => {
    const exp = handoverSections(deal).find(s => s.key === 'expenses')!.cards[0]
    const health = exp.rows!.find(r => r.kind === 'kv' && r.k === 'Health insurance') as any
    expect(health.v).toMatch(/outside HEM/)
  })
})

describe('what lands on the clipboard', () => {
  it('drops the markdown and keeps the paragraphs', () => {
    const box = handoverSections(deal).flatMap(s => s.cards).find(c => c.key === 'analysisComment')!
    const text = copyTextOf(box)
    expect(text).not.toContain('**')
    expect(text).toContain('ANALYSIS')
    expect(text).toContain('Our clients are seeking a loan of $1,700,000.')
    // Paragraphs stay separated - that is what makes it paste cleanly.
    expect(text).toContain('\n\n')
  })
  it('never leaves a stray hyphen from a page break, unlike a PDF', () => {
    const box = handoverSections(deal).flatMap(s => s.cards).find(c => c.key === 'analysisComment')!
    expect(copyTextOf(box)).not.toMatch(/-\n/)
  })
  it('writes key/value cards as one field per line', () => {
    const card = factFindSections(deal).find(s => s.key === 'liabilities')!.cards[0]
    expect(copyTextOf(card)).toContain('Balance: $1,240')
  })
})

describe('the fact find half', () => {
  const secs = factFindSections(deal)

  it('shows both applicants, not just the one who is working', () => {
    expect(secs.find(s => s.key === 'applicants')!.cards).toHaveLength(2)
  })
  it('drops a section with nothing in it rather than printing an empty heading', () => {
    expect(secs.map(s => s.key)).not.toContain('assets')
  })
  it('does not ask a person who is not working for an employer', () => {
    const emp = secs.find(s => s.key === 'employment')!.cards[0]
    expect(copyTextOf(emp)).toContain('Not working')
    expect(copyTextOf(emp)).not.toContain('Employer:')
  })
  it('puts the recommended lender first and marks it', () => {
    const lo = secs.find(s => s.key === 'lo')!
    expect(lo.cards[0].key).toBe('lo:note')
    expect(lo.cards[1].title).toMatch(/^ING/)
    expect(lo.cards[1].tag).toBe('Recommended')
  })
})

describe('every card can be ticked off', () => {
  it('gives each card a key of its own', () => {
    const keys = allSections(deal).flatMap(s => s.cards).map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('counts the boxes somebody has to work through', () => {
    expect(countCards(allSections(deal))).toBeGreaterThan(10)
  })
})
