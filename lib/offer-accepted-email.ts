// THE OFFER ACCEPTED EMAIL.
//
// 21 Oct 2026. Built from Fabio's own two templates - the blank one his team
// fills in by hand, and a completed one a client actually received.
//
// WHAT HIS BLANK TEMPLATE DOES THAT THIS DOES NOT. It carries both versions of
// the valuation paragraph with asterisks around them and a note to delete one.
// It carries a Queensland paragraph marked "DELETE IF NOT QLD". It lists five
// states on the stamp duty line for somebody to cut down to one. Every one of
// those is a thing a tired person deletes wrongly at six in the evening, and
// every one of them is answered by the deal.
//
// WHAT COMES OFF THE DEAL AND IS NEVER TYPED: the price, the duty and its
// state, the total, the loan, the funds to complete, the product, the rate,
// the repayment type, the term, the monthly repayment, the address, the
// lender, whether the loan moved since the pre-approval, and what the clients
// still owe us.
//
// WHAT A PERSON CHOOSES: which valuation, what went with the contract, how
// many days until we expect to hear, which outstanding documents to chase,
// and whether to mention a fixed rate.
//
// THE MONTHLY REPAYMENT IS NEVER CALCULATED HERE. Fabio, 21 Oct 2026: "my fear
// is you always using 30 years on your calculations". It is read off the
// lending option, where a person typed it, and only when exactly one rate
// module is ticked - see monthlyOf in lib/milestone-figures.ts. Nothing in
// this file works out a repayment, so nothing in it can assume a term.

import { emailShell } from './email-shell'
import { anythingElseItems } from './anything-else'
import { type Brand, DEFAULT_BRAND } from './brand'
import {
  p, hero, heading, moneyTable, detailTable, markedList, noteBox, signature, plain, strip,
} from './milestone-email-parts'
import { type Block, on } from './milestone-blocks'
import { type PurchaseRow } from './purchase-rows'
import { type LoanDetail } from './milestone-figures'
import { contractLoan } from './contract-figures'
import { loanAmount } from './funds-to-complete'
import { money, readMoney } from './money'

const txt = (v: any) => String(v ?? '').trim()

const DISCLAIMER =
  'This email and any attachments are confidential and intended only for the named recipient. ' +
  'The figures above are based on the information we hold and are subject to the lender&rsquo;s ' +
  'assessment and valuation. '

// WHICH VALUATION, AND THEREFORE WHICH PARAGRAPH.
//
// His blank template had these as two blocks of asterisks with one to delete.
// A choice of three means the other two never reach a client.
// FOUR ANSWERS, NOT THREE - 22 Nov 2026.
//
// Camille, on a deal with a full valuation already back: "Ive got full val but
// its saying come back at purchase price." She had to pick between a DESKTOP
// that came back at price and a FULL that was still awaiting inspection, and
// neither was true. She picked Full and the email told her client the opposite
// of what had happened.
//
// A full valuation that has come back at price is the commonest good news on a
// purchase and there was no way to say it.
export type Valuation = 'desktop' | 'full_at_price' | 'full' | 'short' | 'none'

export type OfferAcceptedContext = {
  brand?: Brand
  /** "Oliver and Margot" */
  clientNames: string
  lenderName: string
  propertyAddress: string

  valuation: Valuation
  /** What went to the lender with the contract. "the Contract and rental appraisal". */
  sentWith: string
  /** How long until we expect to hear. Blank leaves the sentence out. */
  businessDays: string
  // WHAT A SHORT VALUATION CAME BACK AT.
  //
  // 22 Nov 2026. Fabio: "a situation where a valuation, either desktop or full
  // val, I don't want to describe, came back short, which is rare, but it
  // could happen... Valuation came in short at, and then a box that will put
  // the amount, which means we would have to rework your deposit as per below.
  // And then my credit team will know what to do."
  //
  // ONE ANSWER, NOT TWO. Whether it was a desktop or a full one stops
  // mattering the moment it is short: the figure is the news, and what follows
  // from it is the same either way.
  valuationAmount: string

  /** What they still owe us, in the deal's own words. */
  documents: string[]
  /** Anything else, typed. */
  extra: string

  rows: PurchaseRow[]
  details: LoanDetail[]
  /** "no change", or "increased from $520,000". Worked out, never typed. */
  loanMoved: string
  /** "of which $60,000 has already been paid". Only where a deposit is recorded. */
  depositPaid: string

  blocks: Block[]
  /** How many years, where the fixed rate block is on. Digits, never a phrase. */
  fixedTerm: string
  /** The RBA line, where one applies to this lender. */
  rateNotice: string

  senderName: string
  senderEmail: string
  senderPhone: string
  senderWeb: string
}

/**
 * THE VALUATION PARAGRAPH, IN HIS WORDS.
 *
 * Kept close to what he wrote. The desktop one says it came back at price
 * because that is the only reason a desktop valuation is worth mentioning; the
 * full one promises a call about the inspection because that is the next thing
 * the client will hear about.
 */
export function valuationLine(ctx: OfferAcceptedContext): string {
  const lender = ctx.lenderName || 'the lender'
  const withWhat = txt(ctx.sentWith)
  const together = withWhat
    ? `This together with ${withWhat} has been sent to ${lender} to move them to full assess for `
      + `formal approval.`
    : `This has been sent to ${lender} to move them to full assess for formal approval.`

  if (ctx.valuation === 'desktop') {
    return `We have now ordered a valuation through <b>${lender}</b> which has come back at purchase `
      + `price. ${together}`
  }
  // IT CAME BACK SHORT, AND THE NUMBERS BELOW HAVE ALREADY MOVED.
  //
  // Said plainly, then straight to what it means for them, because the figures
  // table under this paragraph is where the reworked deposit is. Rare, but the
  // one case where the email has to carry bad news, so it does not dress it up.
  //
  // NO FIGURE, NO INVENTED ONE. The sentence still says it came in short; it
  // just does not name an amount nobody typed.
  if (ctx.valuation === 'short') {
    // money() on something unreadable comes back empty, which is what we want:
    // "come in short at , which means" would be worse than no figure at all.
    const at = money(ctx.valuationAmount)
    return at
      ? `The valuation has come in short at ${at}, which means we will need to rework your `
        + `deposit as set out below.`
      : `The valuation has come in short, which means we will need to rework your deposit as set `
        + `out below.`
  }

  // A FULL VALUATION THAT IS BACK, AND BACK AT PRICE. It says "full" out loud,
  // because a client who knows an inspection happened should see it named.
  if (ctx.valuation === 'full_at_price') {
    return `We have now had a full valuation completed through <b>${lender}</b> which has come back `
      + `at purchase price. ${together}`
  }
  if (ctx.valuation === 'full') {
    return `We have now ordered a valuation through <b>${lender}</b>. Once we have an inspection date `
      + `and time we will be in touch to update you further.`
  }
  // NOT ORDERED YET IS A REAL ANSWER and it still has a sentence. Saying
  // nothing about the valuation leaves the client wondering whether we have
  // started.
  return withWhat
    ? `We have sent ${withWhat} to <b>${lender}</b> and are arranging the valuation now.`
    : `We have sent the contract to <b>${lender}</b> and are arranging the valuation now.`
}

// WHAT WENT TO THE LENDER WITH THE CONTRACT.
//
// 21 Oct 2026. THE SCREEN SENDS TICKS, NOT A SENTENCE.
//
// lib/emails-survive-the-lock.test.ts refuses a form field that is words
// destined for a client email, and it was right to refuse the first version of
// this: a free text box whose contents landed in the middle of "This together
// with ___ has been sent to Ubank". A browser that can write half a sentence
// in a client email is a browser that can write any sentence in it.
//
// So the screen ticks keys and this turns them into English.
export const SENT_WITH: { key: string; words: string }[] = [
  { key: 'contract', words: 'the Contract' },
  { key: 'rental_appraisal', words: 'a rental appraisal' },
  { key: 'building_pest', words: 'the building and pest report' },
  { key: 'strata', words: 'the strata report' },
]

export function sentWithWords(keys: string[] | undefined): string {
  const want = new Set((keys || []).map(k => String(k || '').trim()))
  const parts = SENT_WITH.filter(x => want.has(x.key)).map(x => x.words)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * DID THE LOAN MOVE SINCE THE PRE-APPROVAL?
 *
 * Fabio wrote "(no change)" beside the loan amount by hand in the email he
 * sent. The deal already knows: the pre-approval was built on one figure and
 * the accepted contract may be funded by another.
 *
 * Silent where it cannot tell. A line saying "no change" on a deal where
 * nobody has answered the funding would be a claim rather than an answer.
 */
export function loanMovedLine(deal: any): string {
  const after = readMoney(contractLoan(deal)) || 0
  if (after <= 0) return ''
  // THE FIGURE BEFORE THE CONTRACT WAS ANSWERED, which is not what
  // loanAmount() hands back: an answered contract supersedes everything and it
  // returns that answer first, so comparing the two compared a number with
  // itself and every deal read "no change". Caught by its own test.
  //
  // Asking the same function with the contract taken away gets the
  // pre-approval's figure without this file having to know the fallback order,
  // which lives in lib/funds-to-complete.ts and has changed twice.
  const before = readMoney(loanAmount({
    ...deal, contract_loan_amount: null, contractLoanAmount: null,
  })) || 0
  if (before <= 0) return ''
  if (Math.round(before) === Math.round(after)) return 'no change'
  return after > before
    ? `increased from ${money(before)}`
    : `reduced from ${money(before)}`
}

/**
 * WHAT HAS ALREADY GONE IN.
 *
 * A client told to find $708,000 who paid $60,000 on exchange rings to ask
 * whether it is on top of what they have already paid. One sentence stops it.
 *
 * Only where a deposit is actually recorded. Zero is not a deposit paid, it is
 * nobody having filled the box in.
 */
export function depositPaidLine(deal: any): string {
  const paid = readMoney(deal?.deposit_paid) || 0
  if (paid <= 0) return ''
  return `Of that, <b>${money(paid)}</b> has already been paid as your deposit.`
}

/** "2 year", from digits. Never a phrase a browser wrote. */
export function fixedYears(raw: any): string {
  const n = parseInt(String(raw ?? '').replace(/[^0-9]/g, ''), 10)
  const years = Number.isFinite(n) && n > 0 && n <= 10 ? n : 2
  return `${years} year`
}

export function buildOfferAcceptedEmail(ctx: OfferAcceptedContext): {
  subject: string; html: string; plainText: string
} {
  const brand = ctx.brand || DEFAULT_BRAND
  const b = ctx.blocks || []
  const where = txt(ctx.propertyAddress)
  const days = txt(ctx.businessDays)

  // THE BAND AT THE TOP, WITH THE ADDRESS IN IT.
  //
  // Fabio asked for something that celebrates and stands out, and said no to
  // the party emoji his template carried. hero() is the cyan bar and tint
  // every other milestone email already uses, so this is the house style
  // rather than a new thing - and it is painted with a bgcolor attribute,
  // which is the only background Outlook and Word both get right.
  const congratulations = where
    ? `Congratulations — ${where} is yours.`
    : 'Congratulations on your purchase.'

  const ours: string[] = [valuationLine(ctx)]
  if (days) {
    ours.push(`We should have an update from ${ctx.lenderName || 'the lender'} in `
      + `<b>${days} business ${days === '1' ? 'day' : 'days'}</b>.`)
  }

  const theirs = [...(ctx.documents || []).map(txt).filter(Boolean)]
  // One item per paragraph. See lib/anything-else.ts.
  for (const item of anythingElseItems(ctx.extra)) theirs.push(item)

  // QUEENSLAND ONLY, AND THE DEAL DECIDES. His template says "DELETE IF NOT
  // QLD" in capitals across the middle of it. The duty state is on the deal,
  // so this is on or absent and nobody deletes anything.
  const qld = on(b, 'qld_insurance')
    ? p('We would recommend taking out insurance as soon as you can, and speaking to your solicitor '
      + 'if you have any questions about it.')
    : ''

  const fixed = on(b, 'fixed_rate')
    ? noteBox(`${ctx.lenderName || 'The lender'} has a ${fixedYears(ctx.fixedTerm)} fixed rate `
      + `option with a rate lock fee. Let us know if that is of interest and we will send through the `
      + `quoted repayments.`)
    : ''

  const body =
    p(`Hi ${ctx.clientNames || 'there'},`) +
    hero(congratulations) +
    heading('Where things are up to') + markedList(ours, 'number') +
    (theirs.length ? heading('Can you please send through the following') + markedList(theirs, 'tick') : '') +
    qld +
    (ctx.rows.length ? heading('Your final purchase numbers') + moneyTable(ctx.rows) : '') +
    // BESIDE THE FIGURES, NOT INSTEAD OF THEM. He wrote "(no change)" next to
    // the loan amount by hand; the deal knows the answer, so it says it here
    // rather than leaving somebody to remember.
    (txt(ctx.loanMoved) && ctx.rows.length
      ? p(`The loan amount above is <b>${txt(ctx.loanMoved)}</b> from your pre-approval.`) : '') +
    // UNDER THE NUMBERS, BECAUSE IT IS ABOUT THEM. A client reading that they
    // need to find $708,000 when $60,000 of it went in on exchange rings to
    // ask whether it is on top.
    (txt(ctx.depositPaid) ? p(txt(ctx.depositPaid)) : '') +
    (ctx.details.length ? heading('Loan details') + detailTable(ctx.details) : '') +
    (txt(ctx.rateNotice) ? noteBox(txt(ctx.rateNotice)) : '') +
    fixed +
    p('We&rsquo;ll let you know when we have further updates, but please let us know if you have any '
      + 'questions in the meantime.') +
    signature(ctx.senderName, brand.name, ctx.senderEmail, ctx.senderPhone, ctx.senderWeb)

  return {
    // THE ADDRESS IN THE SUBJECT. Nothing else in this portal does it, and a
    // client with three properties with us gets three threads they can tell
    // apart. 21 Oct 2026.
    subject: where
      ? `Congratulations — next steps for ${where}`
      : 'Congratulations on your purchase — next steps',
    html: emailShell(body, DISCLAIMER, brand),
    plainText: plain([
      `Hi ${ctx.clientNames || 'there'},`,
      '',
      strip(congratulations),
      '',
      ...ours.map(strip),
      '',
      ...(theirs.length ? ['Can you please send through the following:', ...theirs.map(s => `- ${strip(s)}`), ''] : []),
      ...(ctx.rows.length
        ? ['Your final purchase numbers:',
           ...ctx.rows.map(r => `${r.label}${r.label ? ': ' : ''}${r.value}`), '']
        : []),
      ...(txt(ctx.loanMoved) && ctx.rows.length
        ? [`The loan amount above is ${txt(ctx.loanMoved)} from your pre-approval.`, ''] : []),
      ...(txt(ctx.depositPaid) ? [strip(txt(ctx.depositPaid)), ''] : []),
      ...(ctx.details.length
        ? ['Loan details:', ...ctx.details.map(d => `${d.label}: ${d.value}`), '']
        : []),
      ...(txt(ctx.rateNotice) ? [strip(txt(ctx.rateNotice)), ''] : []),
      'We will let you know when we have further updates, but please let us know if you have any '
        + 'questions in the meantime.',
      '',
      ctx.senderName,
    ]),
  }
}
