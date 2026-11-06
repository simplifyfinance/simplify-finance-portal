// WHAT WENT, SAID BACK IN THE NUMBERS THAT MATTER.
//
// 17 Aug 2026. Ordering a valuation put the request on the clipboard and opened
// a blank mail window for somebody to paste into. Fabio: "I don't want to copy
// and paste to the bot - cant we use resend so the email goes without my staff
// having to press, than a new box shows saying email sent valuation amount X
// LVR X Banks X for Broker X".
//
// Six steps became one, and this is the sixth: the box that comes back. It is
// built from the same inputs the email was built from, so the screen cannot
// claim a figure the email did not carry.
//
// WHY EACH LINE IS THERE
//
// The valuation amount says WHICH KIND it is - a contract price on a purchase,
// a customer estimate on a refinance. CoreLogic is told which, and the two
// produce different answers, so a box that said "$1,200,000" and stopped would
// be hiding the half that matters.
//
// Ordered for and Sent by are two lines because they are two people. Credit
// order valuations under a broker's own CoreLogic login - see BrokerEmail in
// lib/order-a-valuation.ts - so a box that showed one name would imply the
// wrong one placed it.

import { money, readMoney } from './money'
import { andList } from './and-list'
import { valuationRef, expectedLvr, loanPurposeOf, copyList,
         type Answers, type Broker } from './order-a-valuation'

const txt = (v: any) => String(v ?? '').trim()

export type SentRow = { label: string; value: string }

export type Sent = {
  address: string
  /** "$1,200,000 — customer estimate" */
  valueLine: string
  loanAmount: string
  lvr: string
  lenders: string[]
  brokerName: string
  sentByName: string
  copiedTo: string[]
  ref: string
  rows: SentRow[]
}

// CoreLogic's two words, in ours. valueTypeOf() gives the machine's
// CONTRACT_PRICE and CUSTOMER_ESTIMATE; this is the same answer for a person.
export function valueWords(purpose: string): string {
  return purpose === 'PURCHASE' ? 'contract price' : 'customer estimate'
}

export function sentSummary(
  deal: any, security: any, a: Answers,
  who: { name?: string; email?: string }, broker?: Broker,
): Sent {
  const purpose = loanPurposeOf(security, deal?.bc_data, deal?.fact_find_data)
  const value = readMoney(security?.value)
  const limit = readMoney(security?.limit)
  const lvr = expectedLvr(security?.limit, security?.value)
  const lenders = (a?.lenders || []).map(txt).filter(Boolean)
  const copied = copyList(txt(who?.email), txt(broker?.email))

  const valueLine = value !== null
    ? `${money(value)} — ${valueWords(purpose)}`
    : `Not recorded — ${valueWords(purpose)}`

  const s: Sent = {
    address: txt(security?.address),
    valueLine,
    loanAmount: limit !== null ? money(limit) : '',
    lvr: lvr ? `${lvr}%` : '',
    lenders,
    brokerName: txt(broker?.name),
    sentByName: txt(who?.name),
    copiedTo: copied,
    ref: valuationRef(deal, security),
    rows: [],
  }

  // THE ROWS THE BOX DRAWS, in one place so the order cannot drift between a
  // screen and a test. A row with nothing in it is left out rather than drawn
  // empty - a blank beside a label reads as a figure of zero.
  const add = (label: string, value: string) => { if (txt(value)) s.rows.push({ label, value }) }
  add('Property', s.address)
  add('Valuation amount', s.valueLine)
  add('Loan amount', s.loanAmount)
  add('Expected LVR', s.lvr)
  add('Banks', s.lenders.join(', '))
  add('Ordered for', s.brokerName)
  add('Sent by', s.sentByName)
  add('Copied to', s.copiedTo.join(', '))
  add('Reference', s.ref)
  return s
}

/**
 * The line that goes on the file notes.
 *
 * With the figures in it, so somebody opening this deal in three weeks can see
 * what was ordered, for how much, with which banks and under whose login,
 * without going to anybody's mailbox.
 */
export function sentNote(s: Sent): string {
  const banks = s.lenders.length ? andList(s.lenders) : 'no lender named'
  const bits = [
    `Valuation ordered, ${banks}.`,
    s.address ? `${s.address}.` : '',
    [s.valueLine, s.lvr ? `${s.lvr} LVR` : ''].filter(Boolean).join(', ') + '.',
    s.brokerName ? `For ${s.brokerName}.` : '',
    s.ref ? `Ref ${s.ref}.` : '',
  ]
  return bits.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

/** "Sent to Valerio at 2:14pm." - Sydney, like every other time in the portal. */
export function sentAtWords(when: any, tz = 'Australia/Sydney'): string {
  // null and '' both make a valid Date at the epoch, which would print
  // "10:00am" for a valuation nobody sent.
  if (when === null || when === undefined || txt(when) === '') return ''
  const d = new Date(when)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-AU',
      { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
      .format(d).replace(/\s/g, '').toLowerCase()
  } catch { return '' }
}
