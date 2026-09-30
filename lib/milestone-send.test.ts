// THE EMAIL A DEAL TURNS INTO.
//
// The builders were tested with a hand-written context. This is the half that
// was missing: a DEAL going in one end and the email coming out the other. Every
// mistake this area has made was made in that gap - the lender, the option, the
// figures, who is on the copy line.

import { describe, it, expect } from 'vitest'
import { assembleMilestoneEmail, preapprovalExpiry, longDate, SETTLEMENTS_EMAIL } from './milestone-send'
import { rulesOf } from './lender-rules'
import { emailsGoTo } from './test-deal'

const ANSWERED = rulesOf([
  { key: 'contracts_issued_by', value: 'post', set_by: 'Katie', used: 12 },
  { key: 'insurance_minimum', value: 'property_value', set_by: 'Katie', used: 9 },
  { key: 'postcode_restrictions', value: 'no', set_by: 'Katie', used: 4 },
  { key: 'docusign_certificate', value: 'yes', set_by: 'Katie', used: 4 },
  { key: 'preapproval_extensions', value: 'twice', set_by: 'Fabio', used: 2 },
])

const SENDER = { name: 'Belle Harrison', email: 'belle@simplifyfinance.com.au', phone: '0429 228 148' }

const DEAL: any = {
  id: 'd1',
  transaction_type: 'purchase',
  property_use: 'owner_occupied',
  deal_type: 'OO purchase',
  formal_approval_at: '2026-09-29T00:00:00Z',
  preapproval_at: '2026-07-01T00:00:00Z',
  contract_deposit: '239000',
  bc_data: { template: 'oo_purchase', dutyState: 'NSW', purchasePrice: '950000',
             stampDuty: '37000', deposit: '239000' },
  fact_find_data: {
    applicants: [
      { firstName: 'Alexis', lastName: 'Mitchell', emailPersonal: 'alexis@example.com' },
      { firstName: 'Daniel', lastName: 'Mitchell', emailPersonal: 'daniel@example.com' },
    ],
    properties: [{ address: '32A Rayner Avenue, Narraweena NSW 2099', futureUse: 'Purchase' }],
  },
  clients: { first_name: 'Alexis', last_name: 'Mitchell', email: 'alexis@example.com' },
  solicitor_name: 'Rebecca Toh', solicitor_email: 'rebecca@tohlegal.com.au',
  buyers_agent_name: 'Sam Ng', buyers_agent_email: 'sam@buyside.com.au',
  lo_data: {
    loanAmount: '748000',
    recommendedLender: 'Bankwest',
    recommendedOptionId: 'o1',
    lenders: [{ id: 'o1', lenderName: 'Bankwest', productName: 'Complete Home Loan Package',
                lenderSplits: [{ id: 's1', repaymentType: 'Principal & interest', termYears: '30' }] }],
  },
}

const build = (deal: any, over: any = {}) => assembleMilestoneEmail({
  deal, templateId: 'formal_approval', rules: ANSWERED, sender: SENDER, ...over,
})!

describe('the email is about the lender the deal is on', () => {
  // LUCY ILBERY & ANDREW LEIGH, 29 SEP 2026. Recommended Macquarie, the clients
  // chose ubank, and every document went out saying Macquarie. This is the same
  // shape, one layer further out than the tests that caught it last time.
  it('names the clients’ own choice, not the recommendation', () => {
    const chose = {
      ...DEAL,
      lo_data: {
        ...DEAL.lo_data,
        recommendedLender: 'Macquarie Bank',
        clientAgreedLender: 'No',
        clientChosenLender: 'ubank',
        clientChosenLenderReason: 'A lower rate on an equivalent product',
        lenders: [
          { id: 'o1', lenderName: 'Macquarie Bank', productName: 'Offset Package',
            lenderSplits: [{ id: 's1', repaymentType: 'Interest only', termYears: '30' }] },
          { id: 'o2', lenderName: 'ubank', productName: 'Neat Home Loan',
            lenderSplits: [{ id: 's2', repaymentType: 'Principal & interest', termYears: '30' }] },
        ],
      },
    }
    const out = build(chose)
    expect(out.html).toContain('ubank')
    expect(out.html).not.toContain('Macquarie')
    // AND THE PRODUCT WITH IT. A right name over the wrong product is the bug
    // that got through the first time.
    expect(out.html).toContain('Neat Home Loan')
    expect(out.html).not.toContain('Offset Package')
  })
})

describe('a lender nobody has answered for', () => {
  it('leaves the line out rather than printing a hole in a sentence', () => {
    // Both halves of it. Unanswered, which the block builder already handles -
    // and answered with a value the catalogue no longer offers, which it does
    // not: that one arrives here as a ticked block with no words behind it, and
    // would print "will be issued  by Bankwest" into a client's inbox.
    const retired = rulesOf([
      { key: 'contracts_issued_by', value: 'courier', set_by: 'x', used: 1 },
      { key: 'insurance_minimum', value: 'whatever_they_ask_for', set_by: 'x', used: 1 },
    ])
    for (const rules of [{}, retired]) {
      const out = build(DEAL, { rules })
      expect(out.html).not.toContain('will be issued  by')
      expect(out.html).not.toContain('financial interest, for .')
      expect(out.blocks.find(b => b.key === 'contracts_issued_by')!.on).toBe(false)
      expect(out.blocks.find(b => b.key === 'insurance_minimum')!.on).toBe(false)
    }
  })

  it('says so before anybody presses send', () => {
    const out = build(DEAL, { rules: {} })
    expect(out.problems.join(' ')).toContain('Not recorded')
  })

  // A rule answered with something that is not one of the options - a value left
  // behind by a question that has been reworded - must not tick the block back on.
  it('is not rescued by an answer that is not one of the options', () => {
    const odd = rulesOf([{ key: 'contracts_issued_by', value: 'carrier pigeon', set_by: 'x', used: 1 }])
    expect(build(DEAL, { rules: odd }).blocks.find(b => b.key === 'contracts_issued_by')!.on).toBe(false)
  })

  it('prints the words, not the stored value, when it has been answered', () => {
    expect(build(DEAL).html).toContain('by express post')
    expect(build(DEAL).html).not.toContain('>post<')
  })
})

describe('who is on the copy line', () => {
  it('copies settlements on the formal approval and on nothing else', () => {
    expect(build(DEAL).cc).toContain(SETTLEMENTS_EMAIL)
    const pre = assembleMilestoneEmail({
      deal: DEAL, templateId: 'preapproval', rules: ANSWERED, sender: SENDER })!
    expect(pre.cc).not.toContain(SETTLEMENTS_EMAIL)
    const ext = assembleMilestoneEmail({
      deal: DEAL, templateId: 'preapproval_extension', rules: ANSWERED, sender: SENDER })!
    expect(ext.cc).not.toContain(SETTLEMENTS_EMAIL)
  })

  it('copies the solicitor and the buyers agent on a purchase', () => {
    const out = build(DEAL)
    expect(out.cc).toContain('rebecca@tohlegal.com.au')
    expect(out.cc).toContain('sam@buyside.com.au')
    expect(out.html).toContain('copied')
  })

  // THE SENTENCE AND THE COPY LINE ARE ONE DECISION. An email that says we told
  // the solicitor, sent to a copy line the solicitor is not on, is a false
  // statement on a regulated file.
  it('never claims we told somebody who is not on the email', () => {
    const noEmail = { ...DEAL, solicitor_email: 'rebecca at tohlegal', buyers_agent_email: '' }
    const out = build(noEmail)
    expect(out.cc).toEqual([SETTLEMENTS_EMAIL])
    expect(out.html).not.toContain('have copied')
    expect(out.problems.join(' ')).toContain('not be copied in')
  })

  it('drops the other side when the block is turned off by hand', () => {
    const out = build(DEAL, { overrides: { other_side: false } })
    expect(out.cc).not.toContain('rebecca@tohlegal.com.au')
    expect(out.html).not.toContain('have copied')
  })

  it('puts nobody on the copy line twice, and nobody on both lines', () => {
    const solicitorIsTheClient = { ...DEAL, solicitor_email: 'alexis@example.com' }
    const out = build(solicitorIsTheClient)
    expect(out.cc.filter(a => a === 'alexis@example.com')).toEqual([])
    expect(new Set(out.cc).size).toBe(out.cc.length)
  })
})

describe('the figures', () => {
  it('go in off the deal, not typed', () => {
    const out = build(DEAL)
    expect(out.html).toContain('950,000')
    expect(out.html).toContain('37,000')
  })

  // WHOLE OR NOT AT ALL. A money block that is one line looks like the figures
  // and is a fragment of them.
  it('come out whole when one of them is missing', () => {
    const noPrice = { ...DEAL, bc_data: { ...DEAL.bc_data, purchasePrice: '' } }
    const out = build(noPrice)
    expect(out.html).not.toContain('950,000')
    expect(out.problems.join(' ')).toContain('purchase price')
  })
})

describe('when a pre-approval runs out', () => {
  it('is worked out from the lender, never typed', () => {
    // Bankwest holds a pre-approval 90 days; given 1 July, that is 29 September.
    expect(preapprovalExpiry(DEAL, new Date('2026-08-01T00:00:00Z'))).toBe('29 September 2026')
  })

  it('takes the extension’s new date as given, because the lender granted it', () => {
    const out = assembleMilestoneEmail({
      deal: DEAL, templateId: 'preapproval_extension', rules: ANSWERED, sender: SENDER,
      expiry: '2026-12-24' })!
    expect(out.subject).toContain('24 December 2026')
  })

  it('says the subject will be short of a date rather than inventing one', () => {
    const out = assembleMilestoneEmail({
      deal: DEAL, templateId: 'preapproval_extension', rules: ANSWERED, sender: SENDER })!
    expect(out.problems.join(' ')).toContain('No new expiry')
  })

  it('reads a date the way a person says it', () => {
    expect(longDate('2026-12-24')).toBe('24 December 2026')
    expect(longDate('')).toBe('')
    expect(longDate('not a date')).toBe('')
  })
})

describe('the signature is the person who sent it', () => {
  it('is the sender, never the broker on the deal', () => {
    const out = build(DEAL)
    expect(out.html).toContain('Belle Harrison')
    expect(out.html).toContain('belle@simplifyfinance.com.au')
    expect(out.html).toContain('0429 228 148')
  })

  it('leaves the mobile line out rather than printing an empty one', () => {
    const out = build(DEAL, { sender: { ...SENDER, phone: '' } })
    expect(out.html).not.toContain('M </span>')
    expect(out.html).not.toContain('>M <')
  })
})

describe('a test deal reaches nobody it should not', () => {
  it('goes to the person testing, and the solicitor is left off on purpose', () => {
    const out = build({ ...DEAL, is_test: true })
    const where = emailsGoTo({
      deal: { ...DEAL, is_test: true }, clientEmails: out.to, copyTo: out.cc,
      testerEmail: 'belle@simplifyfinance.com.au',
    })
    expect(where.to).toEqual(['belle@simplifyfinance.com.au'])
    expect(where.cc).toEqual([])
    expect(where.copyDropped).toContain('rebecca@tohlegal.com.au')
    expect(where.copyDropped).toContain(SETTLEMENTS_EMAIL)
    expect(where.insteadOf).toContain('alexis@example.com')
  })

  it('leaves a real deal’s copy line alone', () => {
    const out = build(DEAL)
    const where = emailsGoTo({
      deal: DEAL, clientEmails: out.to, copyTo: out.cc, testerEmail: 'belle@simplifyfinance.com.au',
    })
    expect(where.redirected).toBe(false)
    expect(where.to).toEqual(['alexis@example.com', 'daniel@example.com'])
    expect(where.cc).toContain(SETTLEMENTS_EMAIL)
  })
})

describe('both applicants get it', () => {
  it('goes to every applicant with an address', () => {
    expect(build(DEAL).to).toEqual(['alexis@example.com', 'daniel@example.com'])
  })

  it('falls back to the client record when the fact find has none', () => {
    const bare = { ...DEAL, fact_find_data: { ...DEAL.fact_find_data, applicants: [
      { firstName: 'Alexis' }, { firstName: 'Daniel' }] } }
    expect(build(bare).to).toEqual(['alexis@example.com'])
  })

  it('says hello to people, not to a deal', () => {
    expect(build(DEAL).html).toContain('Alexis and Daniel')
  })

  it('says there is nobody to send to rather than sending to nobody', () => {
    const nobody = { ...DEAL, fact_find_data: { ...DEAL.fact_find_data, applicants: [] }, clients: {} }
    const out = build(nobody)
    expect(out.to).toEqual([])
    expect(out.problems.join(' ')).toContain('nobody to send this to')
  })
})
