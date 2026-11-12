// WHAT THE OFFER-ACCEPTED PANEL SAYS, worked out away from the screen.
//
// Fabio, 27 Sep 2026: "so far perfect". The panel itself is in
// components/OfferAccepted.tsx; everything it decides is here, where it can be
// tested without a browser.
//
// The lender's own rules - ninety days, who can extend, email or AOL, ANZ's
// acknowledgement - were written on 10 September in lib/offer-accepted-rules.ts
// and never connected to anything. Nobody in the team has ever seen a word of
// them. This is the wiring.

import { ruleFor, preapprovalAge, repricingCheck, repricingLine,
         needsAnzAcknowledgement, type LenderRule } from './offer-accepted-rules'
import { lenderOnTheDeal } from './client-agreement'
import { approvalOf, extensionWords, lenderWord, type ApprovalRow } from './lender-approval'
import { dayMonthYear } from './same-date-everywhere'
import { loanAmount } from './funds-to-complete'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export type PanelLine = {
  // 'do' is an instruction, 'watch' is the trap, 'clock' is a deadline,
  // 'unknown' is us saying we have not been told.
  kind: 'do' | 'watch' | 'clock' | 'unknown'
  text: string
}

// WHAT TO DO WITH THE LENDER, in the words of the people who do it.
//
// A lender we hold no rules for gets an honest blank rather than the most
// common answer. Half this team's lenders are not in the list.
export function lenderSteps(lenderName: any, rule: LenderRule | null = null): PanelLine[] {
  const r = rule ?? ruleFor(lenderName)
  const who = txt(lenderName) || 'this lender'
  if (!r) {
    return [{ kind: 'unknown',
      text: `We hold no submission rules for ${who}. Check how they want the change before you send it.` }]
  }
  const out: PanelLine[] = [{ kind: 'do', text: r.notifyDetail }]
  if (r.watchOut) out.push({ kind: 'watch', text: r.watchOut })
  return out
}

// HOW LONG IS LEFT ON THE PREAPPROVAL, said the way somebody would say it.
//
// Ninety days for every lender we have been told about. An offer accepted late
// in that window is a deal whose approval can lapse before it settles, and
// nothing has ever counted it.
// WHICH LENDER'S RULES APPLY. The one the deal is with - a client who moved
// from Macquarie to St George is on St George's 10% repricing rule, and reading
// the recommendation here would have applied Macquarie's (none) instead.
function lenderOnDeal(deal: any): string {
  return String(deal?.lenders?.name || '').trim() || lenderOnTheDeal(deal?.lo_data || {})
}

// THE TERMS COME OFF THE LENDER RECORD NOW. 17 Aug 2026.
//
// They were a list of ten banks in lib/offer-accepted-rules.ts, so Pepper, La
// Trobe, Liberty and Firstmac got no line at all - and nothing, on a screen
// about a deadline, reads as "there is no deadline". Fabio: "is there
// somewhere in the lender library that I can update that?" Now there is. See
// lib/lender-approval.ts.
//
// `lender` is the row off `lenders` the panel already loads for the repricing
// threshold. Passing nothing keeps the old behaviour of saying nothing, which
// is what every caller that has not been updated should do.
export function preapprovalLine(deal: any, lender?: ApprovalRow | null,
                                now = new Date()): PanelLine | null {
  if (!deal?.preapproval_at) return null
  const a = approvalOf(lender)

  // NOT RECORDED IS A LINE, NOT A BLANK. This is the whole of the change: a
  // lender nobody has filled in says so, and says where to fill it in, rather
  // than leaving a deal looking like it has no clock on it.
  if (!a) {
    const name = txt(lender?.name)
    return { kind: 'unknown',
      text: name
        ? `How long a ${name} preapproval stands is not recorded.`
        : 'How long this preapproval stands is not recorded.' }
  }

  const age = preapprovalAge(deal?.preapproval_at,
    { preapprovalDays: a.days, canExtend: a.extends, extendFee: a.extendFee ?? undefined }, now)
  if (!age) return null

  const on = dayMonthYear(age.expiresOn)
  const extend = extensionWords(a)

  if (age.expired) {
    return { kind: 'clock', text: `The preapproval ran out on ${on}.${extend}` }
  }
  if (age.soon) {
    return { kind: 'clock', text: `The preapproval runs out on ${on}.${extend}` }
  }
  return { kind: 'clock', text: `The preapproval stands until ${on}.` }
}

// WHETHER THE PRICING SURVIVES THE CHANGE.
//
// The threshold is the lender's own, typed into the lender library - 10% on
// St George, Westpac and Bank of Melbourne, and N/A on everybody else until
// somebody records one. N/A says so; it never borrows the common rule.
export function pricingLine(lenderName: any, oldLoan: any, newLoan: any,
                            thresholdPercent: any): PanelLine | null {
  const check = repricingCheck(oldLoan, newLoan, thresholdPercent)
  if (!check) return null
  return {
    kind: check.threshold === null ? 'unknown' : check.over ? 'watch' : 'do',
    text: repricingLine(check, lenderName),
  }
}

// THE ANZ ACKNOWLEDGEMENT, prefilled with what the deal already knows.
//
// Only on a REDUCTION, and only for ANZ - their rule, not ours. Handed over as
// text to paste, never sent: the broker is acknowledging something about a
// conversation they had, and the portal cannot acknowledge on their behalf.
export function anzTemplateFor(deal: any, oldLoan: any, newLoan: any,
                               brokerName: any, conversationDate?: any): {
  needed: boolean
  reference: string
  change: string
} {
  const lender = lenderOnDeal(deal)
  const was = num(oldLoan), now = num(newLoan)
  if (!needsAnzAcknowledgement(lender, was, now)) {
    return { needed: false, reference: '', change: '' }
  }
  return {
    needed: true,
    // salestrekker_card_id, not salestrekker_id. 12 Nov 2026: the second
    // spelling does not exist and never has - see docs/deals-columns.txt - so
    // this fell through to the deal name on every ANZ acknowledgement ever
    // sent, while reading as though it preferred the SalesTrekker reference.
    // The test pinned the wrong spelling too, which is how it survived.
    reference: txt(deal?.salestrekker_card_id) || txt(deal?.deal_name),
    change: `Loan amount reduced from $${was.toLocaleString('en-AU')} to $${now.toLocaleString('en-AU')}.`,
  }
}

// WHAT IS STILL BLANK ON THE PANEL. Named, so a half-filled panel is obvious
// without anybody hunting. A half-filled panel is allowed - Fabio was clear
// that a stage nobody marks is worse than a form nobody finishes.
export function stillBlank(deal: any): string[] {
  const out: string[] = []
  if (!txt(deal?.expected_settlement_date)) out.push('the settlement date')
  if (!txt(deal?.finance_clause_date)) out.push('the finance clause date')
  if (!num(deal?.contract_price)) out.push('the price paid')
  if (!num(deal?.deposit_paid)) out.push('the deposit paid')
  return out
}

// THE LOAN THE DEAL IS CURRENTLY BUILT ON. Read only - nothing here changes it.
// Which of these two the panel compares against decides whether the repricing
// line means anything, so it is one function and not a guess at each call site.
export function loanOnTheDeal(deal: any): number {
  // loanAmount() is the one place this is decided. This used to read
  // lo_data.loanAmount itself, which is the copy, so the repricing line was
  // measured against a figure the deal no longer held.
  return num(deal?.loan_amount) || loanAmount(deal) || num(deal?.bc_data?.loanAmount)
}
