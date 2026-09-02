import { describe, it, expect } from 'vitest'
import { allSections, handoverSections, factFindSections, copyTextOf, countCards,
         copyableCards, EXPENSE_CATEGORIES, RISK_GROUPS, PRODUCT_GROUPS } from './handover-view'
import { NEEDS_BOXES, COMMENT_BOXES } from './handover'

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

  it('numbers a box by which box it is, not by where it sits on the page', () => {
    // The page runs in SalesTrekker's order, which puts Security up with the
    // home loan and the written comments after it. The NUMBERS come from the
    // canonical list, so box 9 is Security on the screen and on the PDF alike.
    // If these ever came from position, the two documents would disagree.
    const byKey = Object.fromEntries(boxes.map(b => [b.key, b.no]))
    const canonical = [...NEEDS_BOXES, ...COMMENT_BOXES].map(b => b.key)
    const filled = canonical.filter(k => k in byKey)
    expect(filled.map(k => byKey[k])).toEqual(filled.map((_, i) => i + 1))
  })

  it('puts security with the home loan and the written comments after it', () => {
    const keys = allSections(deal).map(s => s.key)
    expect(keys.indexOf('security')).toBeLessThan(keys.indexOf('broker'))
    expect(keys.indexOf('applicants')).toBeLessThan(keys.indexOf('needs'))
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
  it('counts the boxes somebody presses a button on, not every card on the page', () => {
    const secs = allSections(deal)
    expect(countCards(secs)).toBe(copyableCards(secs).length)
    // This number goes into the push email - "copy the 24 boxes" - so it has to
    // be the number of Copy buttons, not the number of cards.
    expect(countCards(secs)).toBeLessThan(secs.flatMap(s => s.cards).length)
  })
})

// The page runs in the same direction as SalesTrekker's left-hand menu, so
// somebody loading a deal works down both lists together.
describe('the order of the page', () => {
  const keys = allSections(deal).map(s => s.key)

  it('starts with the client profile, not the broker write-up', () => {
    expect(keys[0]).toBe('applicants')
  })
  it('follows SalesTrekker: who they are, what they own, owe and earn', () => {
    const want = ['applicants', 'address', 'employment', 'liabilities', 'income', 'expenses']
    const got = want.filter(k => keys.includes(k))
    expect(got).toEqual(want.filter(k => keys.includes(k)))
    expect(keys.indexOf('liabilities')).toBeLessThan(keys.indexOf('income'))
    expect(keys.indexOf('income')).toBeLessThan(keys.indexOf('expenses'))
  })
  it('puts the home loan half last', () => {
    const groups = allSections(deal).map(s => s.group)
    const firstHome = groups.indexOf('Home loan')
    expect(firstHome).toBeGreaterThan(-1)
    expect(groups.slice(firstHome).every(g => g === 'Home loan')).toBe(true)
  })
})

// A value is pasted into SalesTrekker exactly as it appears. A word in front of
// a date makes it unpasteable.
describe('dates are dates', () => {
  it('gives a date of birth with no age attached', () => {
    const card = allSections(deal).find(s => s.key === 'applicants')!.cards[1]
    const dob = card.rows!.find(r => r.kind === 'kv' && r.k === 'Date of birth') as any
    expect(dob.v).toBe('02/11/1984')
  })
  it('splits a period into a start and an end, with no "From"', () => {
    const text = copyTextOf(allSections(deal).find(s => s.key === 'address')!.cards[0])
    expect(text).not.toMatch(/From /)
    expect(text).not.toMatch(/Period:/)
  })
  it('never writes an age into something that gets pasted', () => {
    const everything = allSections(deal).flatMap(s => s.cards).map(copyTextOf).join('\n')
    expect(everything).not.toMatch(/\(\d{1,3}\)/)
  })
})

// A whole-card Copy button only makes sense where the card IS one SalesTrekker
// field. A card of key/value rows is a dozen fields; one clipboard cannot fill
// them, and a button offering to try would have staff pasting a block of labels
// into a single box.
describe('what can be copied whole', () => {
  const secs = allSections(deal)

  it('offers it on the written boxes', () => {
    const box = secs.flatMap(s => s.cards).find(c => c.key === 'analysisComment')!
    expect(box.copyable).toBe(true)
  })
  it('offers it on the recommendation, which is also one field', () => {
    const note = secs.find(s => s.key === 'lo')!.cards.find(c => c.key === 'lo:note')!
    expect(note.copyable).toBe(true)
  })
  it('does not offer it on a card of separate fields', () => {
    for (const key of ['applicants', 'address', 'employment', 'income', 'liabilities', 'bc']) {
      const sec = secs.find(s => s.key === key)
      if (!sec) continue
      for (const card of sec.cards) expect(card.copyable).toBeFalsy()
    }
  })
  it('counts only the boxes somebody presses a button on', () => {
    const n = copyableCards(secs).length
    expect(n).toBe(secs.flatMap(s => s.cards).filter(c => c.blocks).length)
    expect(n).toBeLessThan(secs.flatMap(s => s.cards).length)
  })
})
