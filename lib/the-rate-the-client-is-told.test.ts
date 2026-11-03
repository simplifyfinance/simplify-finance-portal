import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { loanNow, seedFrom } from './the-loan-now'
import { loanDetails } from './milestone-figures'

// THE RATE THE CLIENT IS TOLD IS THE RATE ON THE DEAL.
//
// 3 Nov 2026. Fabio: "on offer accepted we upload the new property details,
// new loan amount and stuff like that, and that's all working really fine. But
// when I'm then moving to a formal approval email it's not letting me update
// the rate. It's locking in whatever the lending options is giving... the RBA
// increased rates and we need to change rates, or we had to reprice it."
//
// Two faults, and the first one has been fixed once already.
//
// 21 Oct 2026, Belle, on the offer accepted email: "Can we please add a bit to
// include the new rate - most cases that will change if the LVR position is
// different or rates go up or down." Five boxes went onto the offer accepted
// step and that email was switched to read them.
//
// THE FORMAL APPROVAL EMAIL WAS NOT. It went on reading the lending option -
// the rate the client was PRE-APPROVED on, from before the offer was even
// accepted. So the one email that confirms a rate in writing was quoting the
// oldest rate on the deal, and nothing on the screen could change it.
//
// AND THE RATE MOVES AGAIN AFTER OFFER ACCEPTED. An RBA change, or a
// repricing. So it is editable where the email is sent - writing to the deal,
// never to the email alone, because a rate that lives inside one email is a
// rate the next email contradicts.

// The borrowing capacity owns the structure - see splitsOf in
// lib/deal-structure.ts - and the lending option supplies the rate against it.
const DEAL_WITH_OLD_PREAPPROVAL = {
  bc_data: { splits: [{ id: 's1', label: 'Loan 1', amount: '700000',
    rate: '6.24', termYears: '30', repaymentType: 'Principal and interest' }] },
  lo_data: { recommendedLender: 'Bankwest',
    lenders: [{ lenderName: 'Bankwest', productName: 'Complete Variable',
      variablePI: { enabled: true, rate: '6.24' } }] },
}

describe('THE DEAL’S OWN ANSWER WINS', () => {
  it('and the lending option is only the starting point', () => {
    const repriced = { ...DEAL_WITH_OLD_PREAPPROVAL, offer_rate: '6.74' }
    expect(seedFrom(repriced).rate).toBe(6.24)
    expect(loanNow(repriced).rate).toBe(6.74)
  })

  it('and a deal nobody has answered still has the pre-approval to fall back on', () => {
    expect(loanNow(DEAL_WITH_OLD_PREAPPROVAL).rate).toBe(6.24)
  })
})

describe('AND THE FORMAL APPROVAL EMAIL READS IT', () => {
  const SEND = readFileSync('lib/milestone-send.ts', 'utf8')
  // The BRANCH, not the first mention of the name: there is a check on the
  // insured party higher up the file that matches the same words.
  const at = SEND.indexOf("} else if (template.id === 'formal_approval') {")
  const formal = SEND.slice(at, at + 2600)

  it('the loan as it is now, not as it was pre-approved', () => {
    expect(formal).toContain('details: loanDetailsNow(deal)')
  })

  it('AND IT NO LONGER READS THE LENDING OPTION DIRECTLY', () => {
    expect(formal).not.toContain('loanDetails(deal, optionOnTheDeal(lo)')
  })

  it('and the offer accepted email still does what it did', () => {
    const offer = SEND.slice(0, SEND.indexOf("} else if (template.id === 'formal_approval') {"))
    expect(offer).toContain('details: loanDetailsNow(deal)')
  })
})

describe('AND THE RATE IS EDITABLE WHERE THE EMAIL IS SENT', () => {
  const UI = readFileSync('components/MilestoneEmails.tsx', 'utf8')

  it('on formal approval, and nowhere it does not belong', () => {
    expect(UI).toContain("const isFormalApproval = templateId === 'formal_approval'")
    expect(UI).toContain('The rate going in this email')
    expect(UI).toContain('{isFormalApproval && (')
  })

  it('AND IT WRITES TO THE DEAL, NOT TO THE EMAIL', () => {
    // A rate that lives inside one email is a rate the next email contradicts.
    expect(UI).toContain('offer_rate: cleaned || null')
  })

  it('AND THE WRITE IS CHECKED', () => {
    // Postgres returns zero rows and no error when a policy blocks a write, so
    // an unchecked update says it worked and saves nothing.
    expect(UI).toContain("checkedWrite(")
    expect(UI).toContain("'The rate')")
  })

  it('and the preview is rebuilt from the record afterwards', () => {
    // Not patched in the browser. The route composes from the deal.
    expect(UI).toContain('setRateSaved(cleaned)')
    expect(UI).toContain('load()')
  })

  it('AND SAVING DOES NOT SHUT THE SCREEN SOMEBODY IS WORKING IN', () => {
    // onSent() is what the parent listens to in order to close the dialog.
    const block = UI.slice(UI.indexOf('async function saveRate'), UI.indexOf('const already = lastSent'))
    // The CALL, not the word: the comment in there explains why it is absent.
    expect(block).not.toContain('onSent({')
  })

  it('AND AN UNCHANGED BOX IS NOT A WRITE', () => {
    // A blur on the way past must not touch the deal.
    expect(UI).toContain('if (cleaned === rateSaved)')
  })
})
