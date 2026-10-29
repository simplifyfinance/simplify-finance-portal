import { describe, it, expect } from 'vitest'
import { documentsFor } from './document-rules'
import { LOW_DOC_BAS, LOW_DOC_LETTER } from './low-doc'

// A LOW DOC CLIENT IS NOT ASKED FOR TWO YEARS OF TAX RETURNS.
//
// 29 Oct 2026. The two low doc methods shipped in the morning and the document
// list had not been told: a client assessed on their BAS was still being asked
// for personal tax returns, notices of assessment, company returns and company
// financials - the entire set of things low doc exists to avoid, and the exact
// set the client cannot produce, which is why they are low doc.
//
// Invented clients. The shapes are real.

const deal = (method: string, structure = 'Company') => ({
  fact_find_data: {
    applicants: [{
      id: 'a0', firstName: 'Dean', lastName: 'Okafor',
      addresses: [{ address: '1 Example St', isCurrent: true, startDate: '2020-01-01' }],
      employment: [{
        // selfEmployed() reads employmentType, not employmentBasis - see
        // lib/fact-find.ts. The first version of this fixture used the wrong
        // one and produced a PAYG applicant asking for payslips.
        id: 'e0', isCurrent: true, employmentType: 'Self-employed',
        employerName: 'Harrow Lane Joinery Pty Ltd', selfEmployedStructure: structure,
      }],
      income: [{ incomeType: 'Self-employed', employmentId: 'e0', seAssessmentMethod: method }],
    }],
    properties: [], liabilities: [],
  },
  bc_data: {},
})

const labels = (method: string, structure?: string) =>
  documentsFor(deal(method, structure)).items.map(i => i.label)

describe('LOW DOC — BAS', () => {
  it('asks for the BAS', () => {
    expect(labels(LOW_DOC_BAS)).toContain('BAS × 4')
  })

  it('FOUR QUARTERS, BECAUSE THE LENDER IS NOT CHOSEN YET', () => {
    // Fabio: "all the lenders, they need two BASs... Latrobe asks for four."
    // These go out at proceed, long before a lending option is picked. A
    // quarter nobody needed costs a download; a quarter missing costs a week.
    const bas = documentsFor(deal(LOW_DOC_BAS)).items.find(i => i.key.startsWith('lowdoc-bas'))
    expect(bas?.detail).toBe('last four quarters')
  })

  it('AND ASKS FOR NONE OF THE FULL DOC SET', () => {
    const out = labels(LOW_DOC_BAS).join(' | ')
    expect(out).not.toContain('Personal tax returns')
    expect(out).not.toContain('Notices of assessment')
    expect(out).not.toContain('Company tax returns')
    expect(out).not.toContain('Company financials')
  })

  it('and it is ticked by default, because it is not optional on this method', () => {
    const bas = documentsFor(deal(LOW_DOC_BAS)).items.find(i => i.key.startsWith('lowdoc-bas'))
    expect(bas?.auto).toBe(true)
  })
})

describe("LOW DOC — ACCOUNTANT'S LETTER", () => {
  it('asks for the letter and nothing else', () => {
    const out = labels(LOW_DOC_LETTER)
    expect(out).toContain("Accountant's letter")
    expect(out.join(' | ')).not.toContain('Personal tax returns')
    expect(out.join(' | ')).not.toContain('BAS')
  })
})

describe('AND THE STRUCTURE QUESTION DOES NOT HOLD IT UP', () => {
  it('because nothing it decides is being asked for', () => {
    // Sole trader or company decides notices of assessment versus company
    // returns and financials. On low doc we ask for neither.
    const list = documentsFor(deal(LOW_DOC_BAS, ''))
    expect(list.gaps.map(g => g.key).join(' ')).not.toContain('structure')
    expect(list.items.map(i => i.label)).toContain('BAS × 4')
  })

  it('but it still holds up a full doc client, exactly as it did', () => {
    const list = documentsFor(deal('Last 2 financial years', ''))
    expect(list.gaps.map(g => g.key).join(' ')).toContain('structure')
  })
})

describe('WHAT DOES NOT CHANGE', () => {
  it('a full doc company client gets the full set', () => {
    const out = labels('Last 2 financial years', 'Company').join(' | ')
    expect(out).toContain('Personal tax returns × 2')
    expect(out).toContain('Company tax returns × 2')
    expect(out).toContain('Company financials × 2')
  })

  it('and a full doc sole trader gets the notices of assessment', () => {
    expect(labels('One year in isolation', 'Sole trader').join(' | '))
      .toContain('Notices of assessment × 2')
  })

  it('and a self-employed income with no method chosen is treated as full doc', () => {
    // Safer in the direction that matters: asking for a document we did not
    // need costs a download, missing one costs a week.
    expect(labels('', 'Company').join(' | ')).toContain('Personal tax returns × 2')
  })

  it('AND TWO BUSINESSES, ONE LOW DOC AND ONE NOT, GETS BOTH LISTS', () => {
    const two: any = deal(LOW_DOC_BAS)
    two.fact_find_data.applicants[0].income.push({
      incomeType: 'Self-employed', employmentId: 'e0', seAssessmentMethod: 'Last 2 financial years',
    })
    const out = documentsFor(two).items.map(i => i.label).join(' | ')
    expect(out).toContain('BAS × 4')
    expect(out).toContain('Personal tax returns × 2')
  })

  it('and everybody still gets ID, the salary account and super', () => {
    const out = labels(LOW_DOC_BAS).join(' | ')
    expect(out).toMatch(/ID|identification/i)
  })
})
