import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { purchaseHandover, putIn, whoLine, addressOf, applicantNamesOf } from './purchase-handover'
import {
  purchaseHandoverPath, purchaseHandoverName, thereIsAPurchase, PURCHASE_HANDOVER_KIND,
} from './the-purchase-handover'

// The deal after an offer is accepted. Invented names and figures.
const deal = (over: any = {}) => ({
  id: 'd1',
  deal_name: 'Thackeray_Purchase_2026',
  contract_price: 1200000,
  contract_loan_amount: 960000,
  contract_stamp_duty: 31200,
  deposit_paid: 120000,
  deposit_paid_at: '2026-10-17',
  finance_clause_date: '2026-10-23',
  expected_settlement_date: '2026-11-27',
  lender_reference: 'APP-89106',
  solicitor_name: 'The Conveyancing Practice',
  solicitor_email: 'office@conveyancing.example',
  solicitor_phone: '02 9981 6277',
  lenders: { name: 'ubank' },
  bc_data: {
    purchasePrice: '1000000', loanTerm: '30', propertyType: 'Owner-occupied',
    splits: [{ id: 's1', amount: '960000', repaymentType: 'IO', ioYears: '3', rate: '6.74' }],
  },
  compliance_data: {
    applicants: [{ name: 'Oliver Thackeray' }, { name: 'Margot Thackeray' }],
    securityAddress: '14 Dorrington Street, Ashgrove QLD 4060',
    applicationSubmissionComment: 'The applicants are seeking finance of $960,000.',
  },
  lo_data: { lenders: [{ lenderName: 'ubank', productName: 'Flex Home Loan', lenderSplits: [] }] },
  fact_find_data: {},
  ...over,
})

const rowOf = (v: any, label: string) =>
  v.sections.flatMap((s: any) => s.rows).find((r: any) => r.q === label)

describe('there has to be a purchase before there is a document', () => {
  it('offers nothing on a deal with no price paid', () => {
    expect(thereIsAPurchase({})).toBe(false)
    expect(thereIsAPurchase(deal({ contract_price: null }))).toBe(false)
    expect(purchaseHandover(deal({ contract_price: null })).applies).toBe(false)
  })

  it('offers it the moment a price is recorded', () => {
    expect(thereIsAPurchase(deal())).toBe(true)
    expect(purchaseHandover(deal()).applies).toBe(true)
  })
})

describe('it never replaces the handover', () => {
  // Fabio, 21 Oct 2026: "remenr this is a new docuemtn on document tabs do not
  // delete old handover". The handover is upserted to <dealId>/compliance.pdf
  // and one press of this must never land on that path.
  it('files under its own path', () => {
    expect(purchaseHandoverPath('d1')).toBe('d1/purchase_handover.pdf')
    expect(purchaseHandoverPath('d1')).not.toBe('d1/compliance.pdf')
    expect(PURCHASE_HANDOVER_KIND).not.toBe('compliance')
  })

  it('and the screen that files it really does use that path', () => {
    // Comments are not code - the email HTML gate learned that on 29 September
    // when it failed a ship over an rgba() inside a comment explaining rgba().
    // Both files below EXPLAIN that they stay off the handover's path, which is
    // the very string being looked for.
    const codeOf = (f: string) => readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    const src = codeOf('components/PurchaseHandover.tsx')
    expect(src).toContain('purchaseHandoverPath(deal.id)')
    expect(src, 'the purchase handover is writing to the handover\u2019s path')
      .not.toMatch(/compliance\.pdf/)
    expect(src).toContain('/api/generate-purchase-handover-pdf')
    expect(src).not.toContain('/api/generate-compliance-pdf')
    const docs = codeOf('components/DealDocuments.tsx')
    expect(docs).toContain('purchaseHandoverPath(deal.id)')
  })

  it('carries a name of its own, for the people', () => {
    expect(purchaseHandoverName(['Oliver Thackeray', 'Margot Thackeray']))
      .toBe('Purchase handover - Oliver Thackeray & Margot Thackeray.pdf')
    expect(purchaseHandoverName([], 'Thackeray_Purchase_2026'))
      .toBe('Purchase handover - Thackeray Purchase 2026.pdf')
    // A slash in a client's name is not a folder.
    expect(purchaseHandoverName(['A/B Co'])).toBe('Purchase handover - A-B Co.pdf')
  })
})

describe('the page says what the deal says and nothing more', () => {
  it('prints the purchase', () => {
    const v = purchaseHandover(deal())
    expect(v.who).toBe('Oliver Thackeray & Margot Thackeray')
    expect(v.pricePaid).toBe('$1,200,000')
    expect(rowOf(v, 'Property').a).toBe('14 Dorrington Street, Ashgrove QLD 4060')
    expect(rowOf(v, 'Deposit paid').a).toBe('$120,000 on 17 Oct 2026')
    expect(rowOf(v, 'Stamp duty').a).toBe('$31,200')
    expect(rowOf(v, 'Settlement date').a).toBe('27 Nov 2026')
  })

  it('shows the assessed price beside the one that was paid', () => {
    // The borrowing capacity is never rewritten - see lib/contract-figures.ts -
    // so both figures exist and an assessor should be able to see both.
    expect(rowOf(purchaseHandover(deal()), 'Price paid').a)
      .toBe('$1,200,000  (assessed $1,000,000)')
  })

  it('and not when they are the same figure', () => {
    const v = purchaseHandover(deal({ contract_price: 1000000 }))
    expect(rowOf(v, 'Price paid').a).toBe('$1,000,000')
  })

  it('prints the loan as the offer accepted step records it', () => {
    const v = purchaseHandover(deal())
    expect(rowOf(v, 'Product').a).toBe('Flex Home Loan')
    expect(rowOf(v, 'Interest rate').a).toBe('6.74%')
    expect(rowOf(v, 'Loan term').a).toBe('30 years')
    expect(rowOf(v, 'Repayments').a).toBe('Interest only — 3 years')
    // Interest only on $960,000 at 6.74%.
    expect(rowOf(v, 'Monthly repayment').a).toBe('$5,392')
  })

  it('takes the rate typed on the step over the one on the lending option', () => {
    const v = purchaseHandover(deal({ offer_rate: 7.14 }))
    expect(rowOf(v, 'Interest rate').a).toBe('7.14%')
  })

  it('leaves out a repayment it would have to assume a term for', () => {
    const v = purchaseHandover(deal({
      offer_repayment_type: 'Principal and interest',
      bc_data: { purchasePrice: '1000000', splits: [{ amount: '960000', rate: '6.74' }] },
    }))
    expect(rowOf(v, 'Monthly repayment').a).toBe('Not recorded')
    expect(rowOf(v, 'Monthly repayment').missing).toBe(true)
  })

  it('carries the one box on the compliance tab the bank reads', () => {
    expect(purchaseHandover(deal()).submissionNotes)
      .toBe('The applicants are seeking finance of $960,000.')
    expect(purchaseHandover(deal({ compliance_data: {} })).submissionNotes).toBe('')
  })
})

describe('a blank prints as a blank', () => {
  it('says not recorded rather than guessing', () => {
    const bare = deal({
      expected_settlement_date: null, solicitor_name: null, solicitor_email: null,
      solicitor_phone: null, lender_reference: null, contract_stamp_duty: null,
    })
    const v = purchaseHandover(bare)
    expect(rowOf(v, 'Settlement date').a).toBe('Not recorded')
    expect(rowOf(v, 'Stamp duty').missing).toBe(true)
    expect(rowOf(v, 'Lender reference').missing).toBe(true)
  })

  it('collects every gap once, at the bottom', () => {
    const v = purchaseHandover(deal({ expected_settlement_date: null }))
    expect(v.stillToRecord).toContain('settlement date')
    // The buyers agent is blank on this deal and belongs on the list too.
    expect(v.stillToRecord).toContain('buyers agent')
    expect(v.stillToRecord).not.toContain('property')
  })

  it('does not work out what the clients are putting in from a blank', () => {
    expect(putIn(deal())).toBe('$271,200')
    expect(putIn(deal({ contract_stamp_duty: null }))).toBe('Not known')
    expect(putIn(deal({ contract_price: null }))).toBe('Not known')
  })
})

describe('who and where', () => {
  it('names the applicants, and falls back to the deal record', () => {
    expect(whoLine(['A'])).toBe('A')
    expect(whoLine(['A', 'B', 'C'])).toBe('A, B & C')
    expect(whoLine([], 'Some_Deal_2026')).toBe('Some Deal 2026')
  })

  it('reads the applicants off compliance, then the client on the deal', () => {
    expect(applicantNamesOf(deal())).toEqual(['Oliver Thackeray', 'Margot Thackeray'])
    expect(applicantNamesOf({ clients: { first_name: 'Ruth', last_name: 'Vane' } }))
      .toEqual(['Ruth Vane'])
  })

  it('a TBA is not an address', () => {
    expect(addressOf(deal({ compliance_data: { securityAddress: 'TBA — Ashgrove' } }))).toBe('')
    expect(addressOf(deal({ compliance_data: { securityAddress: 'TBA' },
      fact_find_data: { properties: [{ address: '14 Dorrington Street', futureUse: 'purchase' }] } })))
      .toBe('14 Dorrington Street')
  })
})
