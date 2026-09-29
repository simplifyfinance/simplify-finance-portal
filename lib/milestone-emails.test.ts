// THE THREE MILESTONE EMAILS.
//
// Fabio's own samples carry their conditional lines marked *** AMEND *** and
// "DELETE IF NOT APPLICABLE", deleted by hand before every send. The tests that
// matter most here are the ones about what is NOT in the email: a deposit bond
// line nobody deleted tells a client to arrange something they do not need.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { buildFormalApprovalEmail } from './formal-approval-email'
import { buildPreapprovalEmail } from './preapproval-email'
import { formalApprovalBlocks, preapprovalBlocks } from './milestone-blocks'
import { rulesOf } from './lender-rules'
import { milestoneRows } from './milestone-figures'

const ANSWERED = rulesOf([
  { key: 'contracts_issued_by', value: 'online', set_by: 'Katie', used: 12 },
  { key: 'insurance_minimum', value: 'property_value', set_by: 'Katie', used: 9 },
  { key: 'postcode_restrictions', value: 'no', set_by: 'Katie', used: 4 },
  { key: 'docusign_certificate', value: 'no', set_by: 'Katie', used: 4 },
  { key: 'preapproval_extensions', value: 'twice', set_by: 'Fabio', used: 2 },
])

const DEAL = {
  property_use: 'owner_occupied', transaction_type: 'purchase', deal_type: 'OO purchase',
  contract_price: 950000, contract_stamp_duty: 37000,
  contract_loan_amount: 748000, contract_deposit: 239000,
  bc_data: { template: 'oo_purchase', dutyState: 'NSW', purchasePrice: '1000000',
             stampDuty: '39000', deposit: '239000' },
  lo_data: { recommendedLender: 'Bankwest', recommendedOptionId: 'o1',
             lenders: [{ id: 'o1', lenderName: 'Bankwest', productName: 'Complete Home Loan Package',
                         variablePI: { enabled: true, rate: '5.94', repayment: '4452' } }] },
}

const SENDER = {
  senderName: 'Katie Amos', senderEmail: 'katie@simplifyfinance.com.au',
  senderPhone: '0429 228 148', senderWeb: 'simplifyfinance.com.au',
}

const formal = (over: any = {}) => buildFormalApprovalEmail({
  clientNames: 'Alexis and Daniel', lenderName: 'Bankwest',
  propertyAddress: '32A Rayner Avenue, Narraweena',
  rows: milestoneRows(DEAL),
  details: [{ label: 'Product', value: 'Complete Home Loan Package' }],
  blocks: formalApprovalBlocks(DEAL, ANSWERED),
  contractsBy: 'through your online banking',
  insuranceFor: 'at least the property value',
  securityState: 'NSW',
  toldTheOtherSide: 'We have copied your solicitor in on this email, so they have the approval too.',
  ...SENDER, ...over,
})

const pre = (over: any = {}) => buildPreapprovalEmail({
  clientNames: 'Alexis and Daniel', lenderName: 'Bankwest',
  expiry: '24 December 2026', isExtension: false,
  rows: milestoneRows(DEAL), blocks: preapprovalBlocks(DEAL, ANSWERED),
  ...SENDER, ...over,
})

describe('the formal approval separates their jobs from ours', () => {
  const e = formal()

  it('has both headings', () => {
    expect(e.html).toContain('What happens next')
    expect(e.html).toContain('What we need from you')
  })

  it('puts the contract delivery in ours, in the lender\'s own way', () => {
    expect(e.html).toContain('through your online banking')
  })

  it('never claims the solicitor was told unless they are copied in', () => {
    expect(e.html).toContain('We have copied your solicitor in')
    // Nobody reachable: the CLAIM must vanish. The settlement line may still
    // mention a solicitor, because "we will confirm the date with you and your
    // solicitor" is not a claim that anybody has been told anything.
    const silent = formal({ toldTheOtherSide: '' })
    expect(silent.html).not.toContain('We have copied')
  })

  it('does not promise to confirm a date with a solicitor a refinance does not have', () => {
    const refi = { ...DEAL, transaction_type: 'refinance', deal_type: 'Refinance only',
                   bc_data: { ...DEAL.bc_data, template: 'refinance_only' } }
    const e2 = formal({ blocks: formalApprovalBlocks(refi, ANSWERED), toldTheOtherSide: '' })
    expect(e2.html).toContain('confirm the date with you.')
    expect(e2.html).not.toContain('confirm the date with you and your solicitor')
    expect(e.html).toContain('confirm the date with you and your solicitor')
    // Asserted on the SENTENCE rather than the word: the money block's own
    // "Total cost (plus solicitor's fees, and incidentals)" is not a claim
    // about anybody and stays on both.
  })

  it('leaves out the deposit bond on a deal with a cash deposit', () => {
    expect(e.html).not.toContain('deposit bond')
  })

  it('leaves out the mortgage document in NSW', () => {
    expect(e.html).not.toContain('original mortgage document')
  })

  it('names the state when the block does apply', () => {
    const wa = { ...DEAL, bc_data: { ...DEAL.bc_data, dutyState: 'WA' } }
    const e2 = formal({ blocks: formalApprovalBlocks(wa, ANSWERED), securityState: 'WA' })
    expect(e2.html).toContain('original mortgage document')
    expect(e2.html).toContain('your property is in WA')
  })

  it('carries the figures off the contract, not the assessment', () => {
    expect(e.html).toContain('$950,000')     // contracted
    expect(e.html).toContain('$748,000')     // the loan that fell out of it
    expect(e.html).not.toContain('$1,000,000')
  })

  it('names the property in the subject, so two loans are not one email twice', () => {
    expect(e.subject).toBe('Your loan has been formally approved — 32A Rayner Avenue, Narraweena')
  })

  it('takes free text at the end of what we need', () => {
    expect(formal({ extra: 'Please confirm the new bank account.' }).html)
      .toContain('Please confirm the new bank account.')
  })
})

describe('the pre-approval', () => {
  const e = pre()

  it('puts the expiry in the subject, because that is the point of it', () => {
    expect(e.subject).toBe('Pre-approval confirmation — expiry 24 December 2026')
  })

  it('says so rather than trailing off when nobody has recorded one', () => {
    expect(pre({ expiry: '' }).subject).toBe('Pre-approval confirmation')
    expect(pre({ expiry: '' }).subject).not.toContain('undefined')
  })

  it('carries the strata note and the RP Data offer', () => {
    expect(e.html).toContain('strata title')
    expect(e.html).toContain('RP Data')
  })

  it('leaves out the postcode note when the lender said no', () => {
    expect(e.html).not.toContain('postcodes may have lending restrictions')
  })

  it('and puts it in when the lender said yes', () => {
    const yes = rulesOf([{ key: 'postcode_restrictions', value: 'yes', set_by: 'K', used: 1 }])
    expect(pre({ blocks: preapprovalBlocks(DEAL, yes) }).html)
      .toContain('postcodes may have lending restrictions')
  })

  it('leaves the rental letter out on an owner-occupied purchase', () => {
    expect(e.html).not.toContain('weekly rental income')
  })

  it('carries the assessed figures when there is no contract yet', () => {
    const bcOnly = { ...DEAL, contract_price: null, contract_loan_amount: null,
                     contract_stamp_duty: null, contract_deposit: null,
                     lo_data: { ...DEAL.lo_data, loanAmount: '800000' } }
    expect(pre({ rows: milestoneRows(bcOnly) }).html).toContain('$1,000,000')
  })
})

describe('the extension is the same email, three changes', () => {
  const a = pre()
  const b = pre({ isExtension: true, expiry: '24 March 2027' })

  it('says new extended', () => {
    expect(b.html).toContain('new extended pre-approval')
    expect(a.html).not.toContain('new extended')
  })

  it('warns that there will be no more', () => {
    expect(b.html).toContain('will not allow any further extensions')
    expect(a.html).not.toContain('will not allow any further extensions')
  })

  it('carries the new expiry in the subject', () => {
    expect(b.subject).toBe('Pre-approval extension — new expiry 24 March 2027')
  })

  it('and changes nothing else — the checklist is word for word', () => {
    // Two files would have drifted the first time somebody edited one of them.
    const list = (h: string) => h.slice(h.indexOf('Once you have an offer accepted'))
    expect(list(b.html)).toBe(list(a.html))
  })
})

describe('the plain text is the same email, not a second wording', () => {
  it('carries the figures and the sender', () => {
    const e = formal()
    expect(e.plainText).toContain('Loan amount: $748,000')
    expect(e.plainText).toContain('Katie Amos')
    expect(e.plainText).not.toContain('<')
  })

  it('carries the pre-approval checklist', () => {
    expect(pre().plainText).toContain('Signed and dated contract of sale')
  })
})

describe('it survives Outlook on Windows', () => {
  // Word paints a background only from a bgcolor ATTRIBUTE, and throws away a
  // text colour set on a paragraph rather than a run. scripts/check-email-html.sh
  // fails the ship on either - these are the same rules, asserted on the output
  // rather than on the source, so a helper that stops obeying them is caught.
  const html = formal().html + pre().html

  it('never paints a background on a div, a link or a span', () => {
    for (const tag of ['div', 'a', 'p', 'span']) {
      const re = new RegExp(`<${tag}\\b[^>]*background(-color)?\\s*:`, 'i')
      expect(re.test(html)).toBe(false)
    }
  })

  it('carries a bgcolor attribute wherever a cell is painted', () => {
    const cells = html.match(/<t[dh]\b[^>]*background-color:[^>]*>/gi) || []
    expect(cells.length).toBeGreaterThan(0)
    for (const c of cells) expect(/bgcolor=/i.test(c)).toBe(true)
  })

  it('never uses rgba, which Word does not understand at all', () => {
    expect(html.toLowerCase()).not.toContain('rgba(')
  })

  it('uses no list tags, which indent differently in every mail program', () => {
    expect(/<(ul|ol|li)\b/i.test(html)).toBe(false)
  })

  it('has no emoji left in it', () => {
    // Fabio's samples use a green tick emoji, which Outlook draws as a box.
    expect(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u.test(html)).toBe(false)
  })
})

describe('no figure is ever typed into these', () => {
  it('neither builder reads a raw amount out of its context', () => {
    for (const f of ['lib/formal-approval-email.ts', 'lib/preapproval-email.ts']) {
      const src = readFileSync(f, 'utf8').split('\n')
        .filter(l => !l.trim().startsWith('//')).join('\n')
      // Money reaches them as rows already built by lib/milestone-figures.ts.
      expect(src).not.toMatch(/\$\$\{/)
      expect(src).toContain('PurchaseRow')
    }
  })
})
