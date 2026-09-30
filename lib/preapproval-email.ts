// THE PRE-APPROVAL EMAIL, AND ITS EXTENSION.
//
// Built from Fabio's two samples of 29 Sep 2026. He was explicit that there is
// no conditional approval template: "we dont have a condtional apporval
// tempalkte we have a pre-approval and a pre-approval extnesion confirmaiton".
//
// ONE BUILDER, NOT TWO. Read side by side, the extension is the pre-approval
// with three changes: the subject carries a new expiry, the opening says "new
// extended", and a paragraph goes in saying the lender will allow no more. The
// checklist, the notes and the fee line are word for word identical. Two files
// would have drifted the first time somebody edited one of them.
//
// THE EMOJIS ARE GONE, and that is a decision rather than an oversight. The
// green tick in his sample is an emoji character, which Outlook on Windows
// draws as an empty box, and several corporate filters strip the rest. The
// ticks here are real tick marks in a table cell. Everything else is his
// wording, including "Your Contribution Required", which is better than the
// phrase this portal used before and is now what all of it says.
//
// WHICH LINES APPEAR is decided in lib/milestone-blocks.ts. This file only
// knows what each one says.

import { emailShell } from './email-shell'
import { type Brand, DEFAULT_BRAND } from './brand'
import {
  p, hero, heading, moneyTable, markedList, noteBox, signature, plain, strip,
} from './milestone-email-parts'
import { type Block, on } from './milestone-blocks'
import { type PurchaseRow } from './purchase-rows'

const DISCLAIMER =
  'This email and any attachments are confidential and intended only for the named recipient. ' +
  'The information above is general in nature and does not take account of anyone else&rsquo;s ' +
  'circumstances. A pre-approval is not a formal approval and is subject to the lender&rsquo;s ' +
  'conditions, to a satisfactory property and valuation, and to your circumstances not changing. '

export type PreapprovalContext = {
  brand?: Brand
  clientNames: string
  lenderName: string
  // The pre-approval runs out on this date, already written the way a person
  // says it: "24 December 2026". Empty is allowed and the subject says so
  // rather than inventing one.
  expiry: string
  // True for the extension. Everything else about the two is the same.
  isExtension: boolean
  rows: PurchaseRow[]
  blocks: Block[]
  senderName: string
  senderEmail: string
  senderPhone: string
  senderWeb: string
  extra?: string
}

export function buildPreapprovalEmail(ctx: PreapprovalContext): {
  subject: string; html: string; plainText: string
} {
  const brand = ctx.brand || DEFAULT_BRAND
  const b = ctx.blocks || []
  const lender = ctx.lenderName || 'your lender'
  const ext = !!ctx.isExtension

  // WHAT THEY WILL NEED ONCE AN OFFER IS ACCEPTED. His list, in his order.
  const needs: string[] = []
  if (on(b, 'contract_of_sale')) needs.push('Signed and dated contract of sale')
  if (on(b, 'rental_letter')) {
    needs.push('A letter from the real estate agent confirming the proposed weekly rental income ' +
      'that can be received from the property being purchased')
  }
  if (on(b, 'updated_payslips')) {
    needs.push('Depending on when your offer is accepted, we may need updated payslips and savings ' +
      'statements. We will tell you if that applies.')
  }
  if (on(b, 'solicitor_details')) {
    needs.push('Confirmation of the solicitor or conveyancer who will be acting on the purchase')
  }
  if (on(b, 'deposit_bond')) {
    needs.push('Because of the deposit you have available, it will be important to arrange a ' +
      'deposit bond for your purchase. We have access to some excellent providers — please reach ' +
      'out if this is something you need.')
  }
  if (on(b, 'smsf_entity')) {
    needs.push('Please check and confirm with your accountant or financial planner the entity name ' +
      'required on the contract.')
  }
  const extra = String(ctx.extra || '').trim()
  if (extra) needs.push(extra)

  const moneyHeading = ext ? 'Purchase numbers' : 'Your pre-approval is based on the following'

  const body =
    p(`Hi ${ctx.clientNames || 'there'},`) +
    hero(ext
      ? `Congratulations — please find attached confirmation of your new extended pre-approval with ${lender}.`
      : `Congratulations — please find attached confirmation of your pre-approval with ${lender}.`) +
    (ext
      ? noteBox('Please note that the lender will not allow any further extensions beyond this ' +
          'date. If a property is not found during this period, a new application will be required.')
      : '') +
    (ctx.rows.length ? heading(moneyHeading) + moneyTable(ctx.rows) : '') +
    (on(b, 'strata')
      ? noteBox('Please note that purchasing a strata title property — a unit or townhouse — can ' +
          'affect borrowing capacity. Please tell us if you are considering one and we will factor ' +
          'it into our calculations.')
      : '') +
    (on(b, 'postcode_restrictions')
      ? noteBox('Certain postcodes may have lending restrictions with this lender. Please tell us ' +
          'the areas you are focusing on and we will advise whether that applies.')
      : '') +
    (on(b, 'rp_data')
      ? p('If there are any properties that interest you, let us know the address and we can ' +
          'complete an RP Data property report for you, which is a great starting point for your ' +
          'research.')
      : '') +
    (needs.length
      ? heading('Once you have an offer accepted, we will need')
        + markedList(needs, 'tick')
      : '') +
    p('Please let us know if you have any questions.') +
    (on(b, 'preapproval_extensions')
      ? noteBox('If a further extension is required beyond the second pre-approval, a fee of $800 ' +
          'plus GST will apply.')
      : '') +
    signature(ctx.senderName, brand.name, ctx.senderEmail, ctx.senderPhone, ctx.senderWeb)

  // THE EXPIRY IS THE POINT OF THE SUBJECT LINE, so a missing one is said out
  // loud rather than left as a blank after a colon.
  const when = String(ctx.expiry || '').trim()
  const subject = ext
    ? (when ? `Pre-approval extension — new expiry ${when}` : 'Pre-approval extension — confirmation')
    : (when ? `Pre-approval confirmation — expiry ${when}` : 'Pre-approval confirmation')

  return {
    subject,
    html: emailShell(body, DISCLAIMER, brand),
    plainText: plain([
      `Hi ${ctx.clientNames || 'there'},`,
      ext
        ? `Congratulations - please find attached confirmation of your new extended pre-approval with ${lender}.`
        : `Congratulations - please find attached confirmation of your pre-approval with ${lender}.`,
      ext ? 'The lender will not allow any further extensions beyond this date. If a property is ' +
            'not found during this period, a new application will be required.' : '',
      ...(ctx.rows.length ? [moneyHeading.toUpperCase(),
        ctx.rows.filter(r => !r.note).map(r => `${r.label}: ${r.value}`)] : []),
      ...(needs.length ? ['ONCE YOU HAVE AN OFFER ACCEPTED, WE WILL NEED', needs.map(strip)] : []),
      'Please let us know if you have any questions.',
      ctx.senderName, brand.name,
    ]),
  }
}
