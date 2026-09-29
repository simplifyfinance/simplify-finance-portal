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
import { dayMonthYear } from './same-date-everywhere'

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

export function preapprovalLine(deal: any, now = new Date()): PanelLine | null {
  const rule = ruleFor(lenderOnDeal(deal))
  const age = preapprovalAge(deal?.preapproval_at, rule, now)
  if (!age || !rule) return null

  const on = dayMonthYear(age.expiresOn)
  const extend = age.canExtend
    ? (age.extendFee
        ? ` They will extend it, for $${age.extendFee}.`
        : ' They will extend it by another 90 days.')
    : ' They do not extend it.'

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
    reference: txt(deal?.salestrekker_id) || txt(deal?.deal_name),
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
  return num(deal?.loan_amount) || num(deal?.lo_data?.loanAmount) || num(deal?.bc_data?.loanAmount)
}
