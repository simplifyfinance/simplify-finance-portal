// THE EMAILS FROM FORMAL APPROVAL TO A MONTH AFTER SETTLEMENT.
//
// 17 Nov 2026. Five of them. The sixth - the formal approval itself - already
// exists in lib/formal-approval-email.ts and is extended rather than rebuilt,
// because the spec says the approval and the welcome are one email and the
// portal already sends the approval.
//
// NOTHING SENDS ITSELF. Fabio: "we're not building automatic emails... It's
// just a button that you copy and then it pops... their Outlook... and then you
// just do Control V with the HTML." Same as every other template in the portal:
// pick it from the dropdown on the deal, read it, copy, paste, send from your
// own address.
//
// That matters more here than anywhere else, because these carry payout
// figures, contribution amounts and settlement dates. An email that fires on a
// trigger with a wrong number in it is a frightened client on the phone.
//
// EVERY ONE IS BRANDED. Simplify or Navigate, through the same Brand the rest
// of the portal uses - the shell, the logo, the licence line and the website
// under the signature all come off it. Nothing here hard-codes a company.
//
// WORD-SAFE, like everything in lib/milestone-email-parts.ts: coloured areas are
// table cells carrying a bgcolor ATTRIBUTE, and every piece of live text repeats
// its own colour on a span. scripts/check-email-html.sh fails the ship if that
// slips.
import { type Brand, DEFAULT_BRAND } from './brand'
import { emailShell } from './email-shell'
import {
  p, hero, heading, moneyTable, detailTable, markedList, noteBox, signature,
  outstandingBox, INFO_BG, plain, strip,
} from './milestone-email-parts'
import { reviewButton, reviewText } from './the-review-ask'

const txt = (v: any) => String(v ?? '').trim()

const DISCLAIMER =
  'This email and any attachments are confidential and intended only for the addressee. '
  + 'The figures in it are based on information available at the time of sending and may change '
  + 'before settlement.'

export type MoneyRow = { label: string; value: string; note?: boolean }

export type SettlementEmailContext = {
  brand?: Brand
  /** "Tomas and Lina" */
  clientNames: string
  lenderName: string
  propertyAddress?: string
  /** Already in words: "Friday 28 November". Never a raw date. */
  settlementDate?: string

  // --- learned once per lender, from lib/lender-rules.ts -------------------
  /** Belle's registration instructions, application number already filled in. */
  netbankingSteps?: string
  /** "A month after it settled". Left out entirely where nobody has answered. */
  firstRepaymentIO?: string
  /** This lender's own direct debit guidance, or empty for the plain ask. */
  directDebitGuidance?: string
  /** The exact name the lender wants noted on the insurance. Empty means no line. */
  insuredParty?: string
  /** Does this lender want the strata certificate from the client on a refinance? */
  strataFromClient?: boolean
  /** "by email", "through your online banking" - from contractsByPhrase. */
  contractsBy?: string

  // --- facts about this deal ------------------------------------------------
  isPurchase?: boolean
  isRefinance?: boolean
  isStrata?: boolean
  /** True where the loan documents live inside internet banking. */
  registrationFirst?: boolean
  /** Whatever we are waiting on, already in the team's words. */
  outstandings?: string[]
  /** The settlement numbers, already worked out and formatted. */
  rows?: MoneyRow[]
  /** "your Bankwest offset account ending 4417" */
  surplusTo?: string
  /** True on a refinance where nothing changes hands. */
  dollarForDollar?: boolean

  // --- who it comes from ----------------------------------------------------
  senderName: string
  senderEmail: string
  senderPhone: string
  senderWeb: string
  /** The team on the file, already filtered to who was really involved. */
  team?: { role: string; name: string }[]
  extra?: string
}

export type BuiltEmail = { subject: string; html: string; plainText: string }

const shell = (ctx: SettlementEmailContext, body: string): string =>
  emailShell(body, DISCLAIMER, ctx.brand || DEFAULT_BRAND)

const sign = (ctx: SettlementEmailContext): string =>
  signature(ctx.senderName, (ctx.brand || DEFAULT_BRAND).name,
    ctx.senderEmail, ctx.senderPhone, ctx.senderWeb)

const extraOf = (ctx: SettlementEmailContext): string =>
  txt(ctx.extra) ? p(txt(ctx.extra)) : ''

// ---------------------------------------------------------------- 2. documents

/**
 * YOUR LOAN DOCUMENTS. Goes at Contracts Issued.
 *
 * Belle's sample email, 14 Nov 2026, with its four lender switches wired to the
 * lender rules. A switch nobody has answered DOES NOT PRINT - the section is
 * left out rather than filled with a plausible instruction, which is the rule
 * everywhere in this portal and the reason insuredPartyName exists.
 *
 * THIS IS THE ONE EMAIL THAT CAN BE HELD. An unanswered contract difference
 * stops it, because it carries the figures. See lib/the-contract-check.ts.
 */
export function loanDocumentsEmail(ctx: SettlementEmailContext): BuiltEmail {
  const lender = txt(ctx.lenderName) || 'your lender'
  const by = txt(ctx.contractsBy)
  const issued = by ? `have now been issued ${by}` : 'have now been issued'

  const steps: string[] = []

  steps.push('<b>Loan documents to be signed and returned.</b> Please review, sign and return your '
    + 'loan documents as soon as possible. If you would like any assistance, we are happy to arrange '
    + 'a Teams meeting to walk through the paperwork with you.')

  // INSURANCE, AND ONLY WITH A NAME TO PUT ON IT. A certificate naming the wrong
  // thing is rejected and settlement waits on a re-issue.
  if (txt(ctx.insuredParty)) {
    let ins = `<b>Building insurance.</b> You will need to arrange building insurance noting `
      + `<b>${txt(ctx.insuredParty)}</b> as an interested party. Please send us a copy so we can check `
      + `it and submit it to the bank on your behalf. While some online signing platforms allow you to `
      + `upload insurance at the same time, it is not required at that stage — we recommend letting us `
      + `review it first.`
    // NAB's platform demands an upload before submission. Belle, 14 Nov 2026.
    if (/\bnab\b/i.test(lender)) {
      ins += ` NAB's platform will require an upload before submission — you can upload a blank page `
        + `to proceed, and then email the insurance to us separately.`
    }
    steps.push(ins)
  }

  // STRATA. Never asked of a client on a purchase: it comes from the solicitor.
  // On a refinance, only where that lender wants it.
  if (ctx.isStrata) {
    steps.push(ctx.isPurchase
      ? '<b>Strata certificate.</b> We will request the strata building insurance certificate directly '
        + 'from your solicitor or conveyancer — nothing is needed from you.'
      : ctx.strataFromClient
        ? '<b>Strata certificate.</b> You may need to contact your strata manager to request a copy of '
          + 'the current strata building insurance certificate, and send it to us.'
        : '')
  }

  steps.push(txt(ctx.directDebitGuidance)
    ? `<b>Direct debit.</b> ${txt(ctx.directDebitGuidance)}`
    : '<b>Direct debit.</b> Please complete the direct debit form in your loan pack, along with your '
      + 'offset, surplus or shortfall nomination on the loan contracts, and let us know your nominated '
      + 'accounts so we can confirm it has been set up correctly.')

  if (ctx.isPurchase) {
    steps.push('<b>Your contribution.</b> If you are contributing funds toward the purchase, please let '
      + 'us know where the money will be coming from — an EFT from your account, an existing offset, or '
      + 'something else. Your solicitor will coordinate this as part of settlement, but the lender needs '
      + 'to be told in advance.')
  }

  steps.push('<b>Final checks.</b> Once your documents are returned, the bank verifies them and prepares '
    + 'for settlement. We will confirm with you when that is done, and be in touch promptly if anything '
    + 'further is needed.')

  const live = steps.filter(Boolean)
  const waiting = (ctx.outstandings || []).filter(Boolean)

  const body =
    p(`Hi ${txt(ctx.clientNames) || 'there'},`) +
    hero(`Your loan documents ${issued}.`) +
    p('To help you finalise everything required from a lending perspective, here are the steps. '
      + 'Getting these done promptly keeps the lead-up to settlement smooth.') +
    heading('Your checklist') + markedList(live, 'number') +
    // THE ONLY PART OF THIS EMAIL THAT IS A JOB FOR THEM. Everything above it
    // is what we are doing, so it gets the brand's blue line around it.
    (waiting.length
      ? outstandingBox(
          heading('Still outstanding', INFO_BG)
          + p('These are the things we are waiting on before settlement can be booked.')
          + markedList(waiting, 'tick', INFO_BG))
      : '') +
    // NO AMBER ANYWHERE IN SETTLEMENTS, emails included - the brand's blue.
    (ctx.registrationFirst
      ? noteBox(`Your loan documents are issued through ${lender} internet banking, so please make sure `
        + `your online banking is set up first — you will not be able to sign until it is.`,
        (ctx.brand || DEFAULT_BRAND).accentColor)
      : '') +
    extraOf(ctx) +
    p('Let us know once you have returned your documents, or if you would like a hand with any of it. '
      + 'We are here to support you through to settlement.') +
    sign(ctx)

  return {
    subject: 'Your loan documents are ready',
    html: shell(ctx, body),
    plainText: plain([
      `Hi ${txt(ctx.clientNames) || 'there'},`,
      `Your loan documents ${issued}.`,
      'YOUR CHECKLIST', live.map(strip),
      ...(waiting.length ? ['STILL OUTSTANDING', waiting.map(strip)] : []),
      'Let us know once you have returned your documents, or if you would like a hand with any of it.',
      ctx.senderName, (ctx.brand || DEFAULT_BRAND).name,
    ]),
  }
}

// ------------------------------------------------------------------ 3. numbers

/**
 * YOUR SETTLEMENT NUMBERS. Goes about a week before settlement.
 *
 * NOT SENT ON A DOLLAR-FOR-DOLLAR REFINANCE. There is no number to tell them,
 * and an email headed "your settlement numbers" that contains nothing is worse
 * than silence. The caller checks shouldSendNumbers first.
 */
export function settlementNumbersEmail(ctx: SettlementEmailContext): BuiltEmail {
  const rows = ctx.rows || []
  const when = txt(ctx.settlementDate)

  const body =
    p(`Hi ${txt(ctx.clientNames) || 'there'},`) +
    (when
      ? hero(`Your settlement is booked for ${when}.`)
      : hero('Your settlement is being booked.')) +
    p('Here is where the money goes on the day, so there are no surprises.') +
    (rows.length ? moneyTable(rows) : '') +
    (txt(ctx.surplusTo)
      ? p(`The surplus will be deposited to <b>${txt(ctx.surplusTo)}</b> on the day.`)
      : '') +
    extraOf(ctx) +
    p('Nothing is needed from you — this is for your records. If any of it does not look right, '
      + 'please tell us today rather than on the day.') +
    sign(ctx)

  return {
    subject: 'Your settlement numbers',
    html: shell(ctx, body),
    plainText: plain([
      `Hi ${txt(ctx.clientNames) || 'there'},`,
      when ? `Your settlement is booked for ${when}.` : 'Your settlement is being booked.',
      'Here is where the money goes on the day.',
      rows.filter(r => !r.note).map(r => `${r.label}: ${r.value}`),
      ...(txt(ctx.surplusTo) ? [`The surplus will be deposited to ${txt(ctx.surplusTo)}.`] : []),
      'Nothing is needed from you. If any of it does not look right, tell us today.',
      ctx.senderName, (ctx.brand || DEFAULT_BRAND).name,
    ]),
  }
}

/** A dollar-for-dollar refinance has no numbers worth an email. */
export function shouldSendNumbers(ctx: SettlementEmailContext): boolean {
  return !ctx.dollarForDollar && (ctx.rows || []).length > 0
}

// ------------------------------------------------------------------- 4. booked

/** YOUR SETTLEMENT IS BOOKED. Goes at Settlement Booked, date confirmed. */
export function settlementBookedEmail(ctx: SettlementEmailContext): BuiltEmail {
  const when = txt(ctx.settlementDate)
  const first = txt(ctx.firstRepaymentIO)

  const body =
    p(`Hi ${txt(ctx.clientNames) || 'there'},`) +
    hero(when ? `Your settlement is confirmed for ${when}.` : 'Your settlement is confirmed.') +
    p('All parties have accepted the date.') +
    heading('What happens on the day') +
    p('Settlement happens between the banks and the solicitors. There is nothing for you to attend and '
      + 'nothing more for you to sign. We will email you once it has gone through, usually the same '
      + 'afternoon.') +
    // ONLY WHERE SOMEBODY HAS ANSWERED. Belle's table has eight lenders and they
    // do not agree; a guess here is a client who thinks they have three weeks
    // and has three days.
    (first ? p(`Your first repayment comes out <b>${first}</b>.`) : '') +
    extraOf(ctx) +
    p('If anything changes between now and then, we will let you know straight away.') +
    sign(ctx)

  return {
    subject: when ? `Your settlement is booked — ${when}` : 'Your settlement is booked',
    html: shell(ctx, body),
    plainText: plain([
      `Hi ${txt(ctx.clientNames) || 'there'},`,
      when ? `Your settlement is confirmed for ${when}.` : 'Your settlement is confirmed.',
      'All parties have accepted the date.',
      'WHAT HAPPENS ON THE DAY',
      'Settlement happens between the banks and the solicitors. There is nothing for you to attend.',
      ...(first ? [`Your first repayment comes out ${first}.`] : []),
      ctx.senderName, (ctx.brand || DEFAULT_BRAND).name,
    ]),
  }
}

// ------------------------------------------------------------------ 5. settled

/**
 * YOU'RE SETTLED. Goes on the day.
 *
 * This is Fabio's own email, as it goes out today, with one change: the raw
 * rebrand.ly link becomes a button. His words on it: "make it a button so it's
 * not that ridiculous link."
 *
 * THE ONE REVIEW ASK IN THE WHOLE BUILD. See lib/the-review-ask.ts for why it
 * is here and unconditional rather than at formal as well.
 */
export function settledEmail(ctx: SettlementEmailContext): BuiltEmail {
  const lender = txt(ctx.lenderName) || 'your lender'
  const services = [
    'Ongoing home loan rate reviews every 6 to 12 months',
    'Vehicle and equipment finance',
    'Business lending solutions',
    'Accounting and tax support through our in-house team',
  ]

  const body =
    p(`Hi ${txt(ctx.clientNames) || 'there'},`) +
    hero('Congratulations — your settlement has officially gone through!') +
    p(`We will now contact ${lender} to obtain your updated loan details and will be back in touch `
      + `shortly with everything you need moving forward.`) +
    p('We hope you have had a great experience with us, and that we delivered the level of service we '
      + 'pride ourselves on.') +
    reviewButton() +
    heading('We are here long after settlement') +
    p('Your settlement is not the end of your journey with us. Our services extend well beyond home '
      + 'loans, including:') +
    markedList(services, 'tick') +
    p('And remember — home loan rates are always changing, so if someone mentions a "better rate" at a '
      + 'BBQ, call us first. We are always here to help.') +
    extraOf(ctx) +
    p('Congratulations again, and we look forward to supporting you for many years to come.') +
    sign(ctx)

  return {
    subject: `${(ctx.brand || DEFAULT_BRAND).name} — settlement confirmed`,
    html: shell(ctx, body),
    plainText: plain([
      `Hi ${txt(ctx.clientNames) || 'there'},`,
      'Congratulations - your settlement has officially gone through!',
      `We will now contact ${lender} to obtain your updated loan details and will be back in touch shortly.`,
      reviewText(),
      'WE ARE HERE LONG AFTER SETTLEMENT', services,
      'Congratulations again, and we look forward to supporting you for many years to come.',
      ctx.senderName, (ctx.brand || DEFAULT_BRAND).name,
    ]),
  }
}

// ----------------------------------------------------------------- 6. month in

/**
 * ONE MONTH IN. Goes about thirty days after settlement.
 *
 * THE FOUR CHECKS ARE NOT WRITTEN YET. The communication breakdown says this
 * email carries "the four checks" and the Loan Guide, and never lists them.
 * Four invented questions about somebody's mortgage is exactly the kind of
 * confident wrong content this portal refuses to produce, so the section does
 * not print until somebody says what they are - the same way an unanswered
 * lender rule leaves its block out.
 *
 * Pass them in and the section appears. Nothing else changes.
 */
export function monthInEmail(ctx: SettlementEmailContext & { checks?: string[] }): BuiltEmail {
  const checks = (ctx.checks || []).filter(Boolean)

  const body =
    p(`Hi ${txt(ctx.clientNames) || 'there'},`) +
    hero('It has been about a month since your loan settled.') +
    p('This is a quick check that everything is running the way it should.') +
    (checks.length ? heading('Worth a look') + markedList(checks, 'tick') : '') +
    p('Your Loan Guide is attached — worth keeping. It covers the things people usually ring us about '
      + 'in the first year.') +
    extraOf(ctx) +
    p('If anything looks off, or your circumstances have changed, reply here and we will take a look.') +
    sign(ctx)

  return {
    subject: 'How is the new loan going?',
    html: shell(ctx, body),
    plainText: plain([
      `Hi ${txt(ctx.clientNames) || 'there'},`,
      'It has been about a month since your loan settled.',
      ...(checks.length ? ['WORTH A LOOK', checks.map(strip)] : []),
      'Your Loan Guide is attached.',
      'If anything looks off, or your circumstances have changed, reply here.',
      ctx.senderName, (ctx.brand || DEFAULT_BRAND).name,
    ]),
  }
}
