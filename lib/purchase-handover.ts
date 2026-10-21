// THE PURCHASE HANDOVER.
//
// Fabio, 21 Oct 2026: "just create a brand new PDF that copies that oriignal
// one look and feel based on the offer accpeted information!! why worring about
// chnaging box 9 etc".
//
// He was right and my first attempt was wrong. It was going to take the
// pre-approval tick off the Compliance tab, rewrite box nine from the contract
// and rebuild the handover - four writes to a regulated record to produce one
// document. This writes nothing at all. It is a separate page, built from the
// offer accepted step, and the handover is not touched.
//
// WHY A SECOND DOCUMENT IS THE RIGHT ANSWER AND NOT A DUPLICATE. The handover
// is the position the file was ASSESSED on, and it has to stay that - it is
// what the compliance pack was written from. This is the position the clients
// actually bought at. Both are true and they are different facts, which is
// exactly why Fabio said: "the actual handover on documetns tab deos NOT
// replace preavvoal one that is not the same docuemtns so dont replace that."
//
// NOTHING ON THIS PAGE IS ESTIMATED TO COVER A BLANK. A figure nobody typed
// prints as not recorded and goes on the list at the bottom. A handover to a
// settlements team that quietly filled in a settlement date would be worse than
// one with a gap on it.

import { contractPrice, contractLoan, contractStampDuty } from './contract-figures'
import { loanAmount, lvrOf } from './funds-to-complete'
import { securityOf } from './deal-peek'
import { lenderOnTheDeal } from './client-agreement'
import { preapprovalLine } from './offer-accepted-panel'
import { loanNow, monthlyRepayment, rateWords, termWords, repaymentWords } from './the-loan-now'
import { dayMonthYear } from './same-date-everywhere'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any): number => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}
const money = (n: number) => `$${Math.round(n).toLocaleString('en-AU')}`

export type Row = { q: string; a: string; missing?: boolean }
export type Section = { no: number; title: string; pill?: string; rows: Row[] }
export type Tile = { label: string; value: string; lead?: boolean }

export type PurchaseHandover = {
  /** False on a deal with no price paid. Nothing is drawn and no button is offered. */
  applies: boolean
  who: string
  address: string
  pricePaid: string
  meta: string
  kicker: string
  sections: Section[]
  tiles: Tile[]
  /** The one box on the Compliance tab the bank reads. Empty where nobody composed it. */
  submissionNotes: string
  stillToRecord: string[]
}

const NOT_RECORDED = 'Not recorded'
const miss = (q: string, a: string): Row =>
  txt(a) ? { q, a: txt(a) } : { q, a: NOT_RECORDED, missing: true }

export function applicantNamesOf(deal: any): string[] {
  const fromCompliance = (deal?.compliance_data?.applicants || [])
    .map((a: any) => txt(a?.name)).filter(Boolean)
  if (fromCompliance.length) return fromCompliance
  const c = deal?.clients
  const one = c ? `${txt(c.first_name)} ${txt(c.last_name)}`.trim() : ''
  return one ? [one] : []
}

export function whoLine(names: string[], fallbackDealName?: string): string {
  const n = (names || []).map(txt).filter(Boolean)
  if (!n.length) return txt(fallbackDealName || '').replace(/_/g, ' ') || 'The applicants'
  return n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1]
}

/** The address the deal knows, from the fact find's own property list. */
export function addressOf(deal: any): string {
  const typed = txt(deal?.compliance_data?.securityAddress)
  if (typed && !/^TBA\b/i.test(typed)) return typed
  const peek = txt(securityOf(deal)?.address)
  return /^TBA\b/i.test(peek) ? '' : peek
}

/**
 * EVERYTHING THE PAGE PRINTS, DECIDED HERE AND NOT IN THE RENDERER.
 *
 * The route draws rows. It does not choose what a row says, which is what keeps
 * this testable and keeps a figure from being invented inside a PDF component
 * where nobody would ever see it again.
 */
export function purchaseHandover(deal: any): PurchaseHandover {
  const bc = deal?.bc_data || {}
  const c = deal?.compliance_data || {}
  const paid = contractPrice(deal)
  const names = applicantNamesOf(deal)
  const who = whoLine(names, deal?.deal_name)
  const address = addressOf(deal)
  const lender = txt(deal?.lenders?.name) || lenderOnTheDeal(deal?.lo_data || {})
  const now = loanNow(deal)
  const monthly = monthlyRepayment(deal)
  const loan = loanAmount(deal)
  const lvr = lvrOf(deal)

  // THE ASSESSED PRICE BESIDE THE PAID ONE, never instead of it. The borrowing
  // capacity is left exactly as it was - see lib/contract-figures.ts - so the
  // two figures both exist and an assessor should be able to see both.
  const assessed = num(bc.purchasePrice) || num(bc.newPurchasePrice)
  const priceRow = paid > 0
    ? (assessed > 0 && Math.round(assessed) !== Math.round(paid)
        ? `${money(paid)}  (assessed ${money(assessed)})` : money(paid))
    : ''

  const purchase: Section = { no: 1, title: 'Property and contract', pill: 'CONTRACT', rows: [
    miss('Property', address),
    miss('Price paid', priceRow),
    miss('Deposit paid', num(deal?.deposit_paid) > 0
      ? `${money(num(deal.deposit_paid))}${deal?.deposit_paid_at ? ` on ${dayMonthYear(deal.deposit_paid_at)}` : ''}`
      : ''),
    miss('Stamp duty', contractStampDuty(deal) > 0 ? money(contractStampDuty(deal)) : ''),
    miss('Finance clause by', deal?.finance_clause_date ? dayMonthYear(deal.finance_clause_date) : ''),
    miss('Settlement date', deal?.expected_settlement_date ? dayMonthYear(deal.expected_settlement_date) : ''),
  ]}

  const theLoan: Section = { no: 2, title: 'The loan', pill: 'AS RECORDED ON THE DEAL', rows: [
    miss('Product', now.product),
    miss('Interest rate', rateWords(deal)),
    miss('Loan term', termWords(deal)),
    miss('Repayments', repaymentWords(deal)),
    // NO FIGURE WITHOUT A TERM. The whole rule of lib/the-loan-now.ts, carried
    // onto paper: a repayment built on a term nobody typed is a number a
    // settlements team would act on.
    miss('Monthly repayment', monthly === null ? '' : money(monthly)),
  ]}

  const pre = preapprovalLine(deal)
  const lenderSec: Section = { no: 3, title: `Where this sits with ${lender || 'the lender'}`,
    pill: lender ? lender.toUpperCase() : undefined, rows: [
    miss('Lender', lender),
    miss('Lender reference', deal?.lender_reference),
    miss('Pre-approval', pre ? txt(pre.text) : ''),
  ]}

  const otherSide: Section = { no: 4, title: 'The other side', rows: [
    miss('Solicitor / conveyancer', deal?.solicitor_name),
    miss('Their email', deal?.solicitor_email),
    miss('Their phone', deal?.solicitor_phone),
    miss('Buyers agent', deal?.buyers_agent_name),
    miss('Their email', deal?.buyers_agent_email),
  ]}

  const sections = [purchase, theLoan, lenderSec, otherSide]

  const tiles: Tile[] = [
    { label: 'LOAN AMOUNT', value: loan > 0 ? money(loan) : NOT_RECORDED, lead: true },
    { label: 'LVR', value: lvr === null ? 'Not known' : `${lvr.toFixed(1)}%` },
    { label: 'CLIENTS PUTTING IN', value: putIn(deal) },
  ]

  // EVERY GAP ON THE PAGE, COLLECTED ONCE AT THE BOTTOM. Somebody reading this
  // in a settlements queue should not have to scan four boxes for red text.
  const stillToRecord = sections.flatMap(s => s.rows.filter(r => r.missing).map(r => r.q.toLowerCase()))

  return {
    applies: paid > 0,
    who,
    address,
    pricePaid: paid > 0 ? money(paid) : NOT_RECORDED,
    kicker: `PURCHASE HANDOVER${deal?.contract_funding_at ? '' : ''}`,
    meta: [address, lender, txt(bc.propertyType) || txt(bc.newPurchasePropertyType),
           deal?.expected_settlement_date ? `Settles ${dayMonthYear(deal.expected_settlement_date)}` : '']
      .map(txt).filter(Boolean).join('  ·  '),
    sections,
    tiles,
    // THE ONE BOX ON THE COMPLIANCE TAB THE BANK READS. Fabio asked for it here
    // on 21 Oct: a settlements person or an assessor holding this page should
    // not have to open the deal to find what was said to the lender.
    submissionNotes: txt(c.applicationSubmissionComment),
    stillToRecord,
  }
}

/**
 * WHAT THE CLIENTS ARE PUTTING IN - price plus duty, less the loan.
 *
 * Only where all three are recorded. A subtraction with a blank in it is a
 * figure that looks like money and is not, and this page goes to the people who
 * ask the clients to transfer it.
 */
export function putIn(deal: any): string {
  const paid = contractPrice(deal)
  const duty = contractStampDuty(deal)
  const loan = contractLoan(deal) || loanAmount(deal)
  if (paid <= 0 || duty <= 0 || loan <= 0) return 'Not known'
  const n = paid + duty - loan
  return n > 0 ? money(n) : 'Not known'
}
