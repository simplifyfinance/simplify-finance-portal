// THE FORMAL APPROVAL EMAIL.
//
// Built from Fabio's own sample of 29 Sep 2026, which carries its conditional
// lines marked *** AMEND *** for somebody to delete by hand before every send.
//
// WHAT CHANGED, AND WHY. His version ran every condition into one list, so a
// client could not tell what they had to do from what we were already doing.
// It is two lists here - "what happens next" is ours, "what we need from you"
// is theirs - and Fabio kept that on reading it. His wording is otherwise
// untouched, including "Your contribution required", which is better than the
// phrase this file first used and is now what the whole portal says.
//
// EVERY FIGURE COMES OFF THE DEAL. Nothing in this file accepts a number from a
// browser: the route loads the deal, this builds from it, and the same five
// lines appear here, on the client email and on the borrowing capacity because
// they are the same code.
//
// WHICH LINES APPEAR is not decided here. lib/milestone-blocks.ts answers that
// from the deal and from what the portal has learned about the lender; this
// file only knows what each one SAYS.

import { emailShell } from './email-shell'
import { type Brand, DEFAULT_BRAND } from './brand'
import {
  p, hero, heading, moneyTable, detailTable, markedList, signature, plain, strip,
} from './milestone-email-parts'
import { type Block, on } from './milestone-blocks'
import { type PurchaseRow } from './purchase-rows'

const txt = (v: any) => String(v ?? '').trim()

const DISCLAIMER =
  'This email and any attachments are confidential and intended only for the named recipient. ' +
  'The information above is general in nature and does not take account of anyone else&rsquo;s ' +
  'circumstances. Approval conditions are set by the lender and may change. '

export type FormalApprovalContext = {
  brand?: Brand
  // "Alexis and Daniel"
  clientNames: string
  lenderName: string
  propertyAddress: string
  rows: PurchaseRow[]
  details: { label: string; value: string }[]
  blocks: Block[]
  // How this lender issues contracts, already resolved to a phrase:
  // "by email", "by express post", "through your online banking".
  contractsBy: string
  // THE EXACT NAME this lender wants on the certificate of currency, learned
  // once and never guessed - see insuredPartyName in lib/lender-rules.ts. Empty
  // means the insurance line does not appear at all.
  insuredParty: string
  // How much, off this deal's approval letter. Optional and never remembered:
  // it is different on every deal. Empty and the sentence simply does not say.
  insuranceAmount?: string
  // WA, TAS or NT, where the mortgage document line applies.
  securityState: string
  // Whoever is genuinely on the copy line. Empty where nobody is - the email
  // never claims somebody was told unless they are reading it. See
  // lib/other-side.ts.
  toldTheOtherSide: string
  // The sender, who is also who signs it.
  senderName: string
  senderEmail: string
  senderPhone: string
  senderWeb: string
  // Free text, from the "anything else" box.
  extra?: string
}

export function buildFormalApprovalEmail(ctx: FormalApprovalContext): {
  subject: string; html: string; plainText: string
} {
  const brand = ctx.brand || DEFAULT_BRAND
  const b = ctx.blocks || []
  const lender = ctx.lenderName || 'your lender'
  const where = ctx.propertyAddress ? ` — ${ctx.propertyAddress}` : ''

  // WHAT WE ARE DOING. Ours, and written as done or about to be, because a
  // client reading this has nothing to act on in it.
  const ours: string[] = []
  if (on(b, 'contracts_issued_by')) {
    ours.push(`<b>Your loan contracts will be issued ${ctx.contractsBy}</b> by ${lender}, usually ` +
      `within two to three business days. Please sign and return them as soon as you can — ` +
      `settlement cannot be booked until they are back.`)
  }
  if (on(b, 'other_side') && ctx.toldTheOtherSide) {
    ours.push(ctx.toldTheOtherSide)
  }
  // A REFINANCE HAS NO SOLICITOR. The block that copies the other side in is
  // only on for a purchase, so it is also the honest test of whether there is
  // anybody but the client to confirm a date with.
  ours.push(on(b, 'other_side')
    ? 'Once your signed contracts are back with the lender, <b>we will book settlement</b> and ' +
      'confirm the date with you and your solicitor.'
    : 'Once your signed contracts are back with the lender, <b>we will book settlement</b> and ' +
      'confirm the date with you.')

  // WHAT THEY HAVE TO DO. Theirs, and each one a thing a person can go and do.
  const theirs: string[] = []
  // THE NAME IS THE BANK'S OWN WORDING, and the amount is optional - typed off
  // the approval letter for this deal, or left out. 30 Sep 2026.
  //
  // The block is only on when the name is recorded, so this never prints a
  // sentence with a hole where an entity should be. See lib/milestone-send.ts.
  if (on(b, 'insurance_interested_party') && ctx.insuredParty) {
    const amount = txt(ctx.insuranceAmount)
    theirs.push(`<b>Building insurance</b> on the property, noting <b>${ctx.insuredParty}</b> as an ` +
      `interested party${amount ? `, for at least ${amount}` : ''}. Please send us a copy of the ` +
      `certificate of currency once you have it.`)
  }
  if (on(b, 'original_mortgage')) {
    theirs.push(`Sign and return the <b>original mortgage document</b>. As your property is in ` +
      `${ctx.securityState || 'that state'}, this one has to be an original rather than a scan, and ` +
      `your Settlements Officer will walk you through it.`)
  }
  if (on(b, 'deposit_bond')) {
    theirs.push('Let us know if you would like us to arrange a <b>deposit bond</b>. We work with ' +
      'several providers and can organise one quickly.')
  }
  if (on(b, 'property_management')) {
    theirs.push('Let us know if you would like an obligation-free <b>property management quote</b> ' +
      '— we work with agents who look after investment properties like this one.')
  }
  if (on(b, 'deppro')) {
    theirs.push('Your package includes a discount on a <b>Deppro depreciation schedule</b>. Tell us ' +
      'if you would like us to arrange it.')
  }
  if (on(b, 'debt_recycling')) {
    theirs.push('Move the <b>offset funds</b> into the loan account ready for settlement, so the ' +
      'structure works the way we set it up.')
  }
  const extra = String(ctx.extra || '').trim()
  if (extra) theirs.push(extra)

  const body =
    p(`Hi ${ctx.clientNames || 'there'},`) +
    hero(`Great news — your loan has been formally approved by ${lender}.`) +
    p('This is the lender&rsquo;s full and final approval. There are no conditions left to satisfy, ' +
      'and the only steps remaining are signing your loan contracts and booking settlement.') +
    (ctx.rows.length ? heading('Your loan') + moneyTable(ctx.rows) : '') +
    (ctx.details.length ? heading('The details') + detailTable(ctx.details) : '') +
    heading('What happens next') + markedList(ours, 'number') +
    (theirs.length ? heading('What we need from you') + markedList(theirs, 'tick') : '') +
    p('If anything above does not look right, or you have a question about any of it, reply to this ' +
      'email or give us a call.') +
    p('Congratulations again — this is the hard part done.') +
    signature(ctx.senderName, brand.name, ctx.senderEmail, ctx.senderPhone, ctx.senderWeb)

  return {
    subject: `Your loan has been formally approved${where}`,
    html: emailShell(body, DISCLAIMER, brand),
    plainText: plain([
      `Hi ${ctx.clientNames || 'there'},`,
      `Great news - your loan has been formally approved by ${lender}.`,
      'This is the lender\'s full and final approval. There are no conditions left to satisfy, and ' +
      'the only steps remaining are signing your loan contracts and booking settlement.',
      ...(ctx.rows.length ? ['YOUR LOAN', ctx.rows.filter(r => !r.note)
        .map(r => `${r.label}: ${r.value}`)] : []),
      ...(ctx.details.length ? ['THE DETAILS', ctx.details.map(d => `${d.label}: ${d.value}`)] : []),
      'WHAT HAPPENS NEXT', ours.map(strip),
      ...(theirs.length ? ['WHAT WE NEED FROM YOU', theirs.map(strip)] : []),
      'If anything above does not look right, reply to this email or give us a call.',
      'Congratulations again - this is the hard part done.',
      ctx.senderName, brand.name,
    ]),
  }
}
