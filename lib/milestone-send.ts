// TURNING A DEAL INTO THE EMAIL THAT GOES OUT.
//
// The builders in lib/formal-approval-email.ts and lib/preapproval-email.ts take
// a context - names, a lender, rows, blocks, a sender - and give back a subject,
// some HTML and the plain text. Nothing in the portal builds that context yet,
// and this is the file that does.
//
// WHY IT IS HERE AND NOT IN THE ROUTE. The send screen shows the client exactly
// what will arrive, and the route sends it. Those must be the same email or the
// preview is a lie, and the only way to guarantee that is one function that both
// call. It is also why this file does no input and output of its own: everything
// it needs is handed to it, so a test can hand it a deal and read the email back
// without a database.
//
// WHAT IT WILL NOT DO. It will not invent a figure, a date or an answer. Where
// something is missing the block comes out and the reason goes in `problems`,
// which the send screen prints before anybody presses anything. An email that
// quietly drops a condition is the failure this whole area exists to prevent.

import { templateById, type TemplateId, type MilestoneTemplate } from './milestone-emails'
import { formalApprovalBlocks, preapprovalBlocks, withOverrides, on,
         securityState, waitingOnLender, type Block, type Overrides } from './milestone-blocks'
import { milestoneRows, loanDetails, missingFigures } from './milestone-figures'
import { contractsByPhrase, insuredPartyName, type LenderRule } from './lender-rules'
import { buildFormalApprovalEmail } from './formal-approval-email'
import { buildPreapprovalEmail } from './preapproval-email'
import { lenderOnTheDeal, optionOnTheDeal, splitsOnTheDeal } from './client-agreement'
import { toldTheOtherSide, copyTheseIn, otherSideGaps } from './other-side'
import { clientEmails, clientFirstNames } from './client-emails'
import { securityOf } from './deal-peek'
import { ruleFor, preapprovalAge } from './offer-accepted-rules'
import { DEFAULT_BRAND, type Brand } from './brand'

const txt = (v: any) => String(v ?? '').trim()

// Settlements are copied on the formal approval and on nothing else. The
// address lives here, once, beside the only rule that uses it.
export const SETTLEMENTS_EMAIL = 'settlements@simplifyfinance.com.au'

export type Sender = {
  name: string
  email: string
  phone: string
}

export type AssembleInput = {
  deal: any
  templateId: TemplateId
  // Answers already loaded for THIS deal's lender. An empty object is a lender
  // nobody has been asked about yet, which is a legitimate state.
  rules: Record<string, LenderRule>
  brand?: Brand
  sender: Sender
  // What the person ticked or unticked on the send screen, by block key.
  overrides?: Overrides
  // The "anything else" box.
  extra?: string
  // The extension's new expiry, as typed. The plain pre-approval works its own
  // out and ignores this.
  expiry?: string
  // HOW MUCH THE BUILDING HAS TO BE INSURED FOR, off this deal's approval
  // letter. Typed per deal and never remembered - it is a different figure every
  // time. Empty is normal: the sentence then names who has to be on the policy
  // without saying for how much.
  insuranceAmount?: string
  now?: Date
}

export type Assembled = {
  template: MilestoneTemplate
  subject: string
  html: string
  plainText: string
  to: string[]
  cc: string[]
  blocks: Block[]
  // Everything worth reading before pressing send. Never a reason to refuse -
  // a missing solicitor email is a thing to go and fix, and the email is still
  // correct without it.
  problems: string[]
}

// "24 December 2026", the way a person says a date rather than the way a
// database stores one.
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

export function longDate(v: any): string {
  const s = txt(v)
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// WHEN THE PRE-APPROVAL RUNS OUT. Off the lender's own validity period, from
// the day it was given - the same calculation the offer-accepted panel has been
// showing for weeks, so the email and the panel cannot disagree.
export function preapprovalExpiry(deal: any, now = new Date()): string {
  const lender = lenderOnTheDeal(deal?.lo_data || {})
  const age = preapprovalAge(deal?.preapproval_at, ruleFor(lender), now)
  return age ? longDate(age.expiresOn.toISOString()) : ''
}

export function propertyAddressOf(deal: any): string {
  return txt(securityOf(deal)?.address)
}

// THE BLOCKS, BEFORE ANYBODY TOUCHES THEM.
//
// Separated out because the send screen needs them to draw the tick list, and
// it must be looking at the same list the email is built from.
export function blocksFor(deal: any, templateId: TemplateId,
                          rules: Record<string, LenderRule>): Block[] {
  return templateId === 'formal_approval'
    ? formalApprovalBlocks(deal, rules)
    : preapprovalBlocks(deal, rules)
}

// A BLOCK THAT WOULD PRINT A HOLE IS NOT A BLOCK.
//
// Two of the formal approval's lines are sentences with an answer dropped into
// the middle of them. With no answer the sentence reads "issued  by Bankwest",
// which is worse than the line being absent. So the phrase itself is the last
// word on whether the block is on - after the lender rule, after the override,
// after everything.
function silenceTheHoles(blocks: Block[], phrases: { contractsBy: string; insuredParty: string }): Block[] {
  return blocks.map(b => {
    if (b.key === 'contracts_issued_by' && b.on && !phrases.contractsBy) {
      return { ...b, on: false, why: 'Off — we have not recorded how this lender issues contracts' }
    }
    if (b.key === 'insurance_interested_party' && b.on && !phrases.insuredParty) {
      return { ...b, on: false,
        why: 'Off — we have not recorded the exact name this lender wants on the policy' }
    }
    return b
  })
}

export function assembleMilestoneEmail(input: AssembleInput): Assembled | null {
  const template = templateById(input.templateId)
  if (!template) return null

  const deal = input.deal || {}
  const lo = deal.lo_data || {}
  const brand = input.brand || DEFAULT_BRAND
  const now = input.now || new Date()
  const rules = input.rules || {}

  const phrases = {
    contractsBy: contractsByPhrase(rules),
    // NEVER A FALLBACK TO THE BANK'S PLAIN NAME. Fabio, 30 Sep 2026: "Leave it
    // out. and flag do not guess." An insurance certificate naming the wrong
    // entity is rejected by the lender and settlement waits on a re-issue, so an
    // unanswered lender loses the line entirely and the send screen says why.
    insuredParty: insuredPartyName(rules),
  }

  const blocks = silenceTheHoles(
    withOverrides(blocksFor(deal, template.id, rules), input.overrides || {}),
    phrases)

  const problems: string[] = []
  const missing = missingFigures(deal)
  if (missing.length) {
    // Said as one sentence rather than three, because it is one job.
    problems.push(`The money block is left out — ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not on the deal.`)
  }
  for (const line of waitingOnLender(blocks)) problems.push(line)

  // SAID IN WORDS, NOT LEFT AS AN ABSENCE. A missing condition on a formal
  // approval is the one thing on this screen somebody must not scroll past, and
  // "not recorded" on its own does not tell anybody what it costs.
  if (template.id === 'formal_approval' && !phrases.insuredParty) {
    problems.push(
      `DO NOT GUESS THIS. The building insurance line is left out because nobody has recorded the ` +
      `exact name ${lenderOnTheDeal(lo) || 'this lender'} wants noted on the policy. A certificate ` +
      `naming the wrong entity is rejected and settlement waits on a re-issue. Answer it on the ` +
      `Lenders page and it is remembered for every deal after this one.`)
  }

  const rows = missing.length ? [] : milestoneRows(deal)
  const clientNames = clientFirstNames(deal)
  const lenderName = lenderOnTheDeal(lo)
  const to = clientEmails(deal)
  if (!to.length) problems.push('No email address on file for the clients — there is nobody to send this to.')

  const cc: string[] = []
  if (template.copySettlements) cc.push(SETTLEMENTS_EMAIL)

  let built: { subject: string; html: string; plainText: string }

  if (template.id === 'formal_approval') {
    // The other side only goes on the copy line when the block is on, which is
    // the same condition the sentence in the email is written under. One
    // decision, so the email cannot say we told them while the copy line is empty.
    const theOtherSide = on(blocks, 'other_side') ? copyTheseIn(deal) : []
    for (const p of theOtherSide) cc.push(p.email)
    if (on(blocks, 'other_side')) for (const gap of otherSideGaps(deal)) problems.push(gap)

    built = buildFormalApprovalEmail({
      brand,
      clientNames,
      lenderName,
      propertyAddress: propertyAddressOf(deal),
      rows,
      details: loanDetails(deal, optionOnTheDeal(lo), splitsOnTheDeal(lo)),
      blocks,
      contractsBy: phrases.contractsBy,
      insuredParty: phrases.insuredParty,
      insuranceAmount: txt(input.insuranceAmount),
      securityState: securityState(deal),
      toldTheOtherSide: theOtherSide.length ? toldTheOtherSide(deal) : '',
      senderName: input.sender.name,
      senderEmail: input.sender.email,
      senderPhone: input.sender.phone,
      senderWeb: brandWeb(brand),
      extra: txt(input.extra),
    })
  } else {
    const isExtension = template.id === 'preapproval_extension'
    // The extension's new date is granted by the lender and typed in. The plain
    // pre-approval's is the lender's own validity period and is never typed.
    const expiry = isExtension ? longDate(input.expiry) || txt(input.expiry) : preapprovalExpiry(deal, now)
    if (!expiry) {
      problems.push(isExtension
        ? 'No new expiry date — the subject line will not say when the extension runs to.'
        : `We do not know how long ${lenderName || 'this lender'} holds a pre-approval, so the email cannot say when it expires.`)
    }

    built = buildPreapprovalEmail({
      brand,
      clientNames,
      lenderName,
      expiry,
      isExtension,
      rows,
      blocks,
      senderName: input.sender.name,
      senderEmail: input.sender.email,
      senderPhone: input.sender.phone,
      senderWeb: brandWeb(brand),
      extra: txt(input.extra),
    })
  }

  return {
    template,
    subject: built.subject,
    html: built.html,
    plainText: built.plainText,
    to,
    // Nobody appears twice, and nobody on the copy line is already a recipient.
    cc: [...new Set(cc)].filter(a => a && !to.includes(a)),
    blocks,
    problems,
  }
}

// The address that goes under the signature. Brands live in settings as JSON,
// so a brand with its own website needs no migration to have one - and one
// without borrows nothing. See normaliseBrand in lib/brand.ts.
export function brandWeb(brand: Brand): string {
  return txt(brand?.web)
}
