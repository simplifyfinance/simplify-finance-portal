// WHICH LINES BELONG IN THIS PARTICULAR EMAIL.
import { dutyStateOf } from './duty-state'
//
// Fabio's own templates carry the instructions in capitals: *** AMEND ***,
// "DELETE WHAT IS NOT APPLICABLE", "DELETE IF NOT APPLICABLE". Somebody reads
// down a wall of text before every send and takes out the parts that do not
// apply to this client.
//
// THAT IS WHERE IT GOES WRONG, and it goes wrong in two directions. A block that
// should have been deleted and was not tells a client to arrange a deposit bond
// they do not need. A block deleted that should have stayed means nobody asks
// for the building insurance. Neither is noticed until it matters.
//
// So the portal decides, and SAYS WHY. Every block is still on the send screen -
// the ones it turned off are visible, unticked, with their reason beside them -
// so a person can put any of them back. Deciding is not the same as hiding.
//
// THREE KINDS OF DECISION, and the difference is the whole design:
//
//   deal    the record already knows. Investment or not, SMSF or not, which
//           state the security is in. Nobody is asked, ever.
//   lender  true of the bank rather than the client - how contracts are issued,
//           whether postcodes are restricted. Asked once and remembered against
//           the lender. See lib/lender-rules.ts.
//   ask     genuinely different every time. Free text, and never remembered.
//
// AND A FOURTH STATE THAT IS NOT A DECISION: a lender question nobody has
// answered yet. That block is OFF and says so, because handing an unanswered
// lender the commonest answer is how a non-bank pre-approval goes out with no
// postcode warning in it.

import { typeOf, useOf } from './deal-labels'
import { lenderOnTheDeal, optionOnTheDeal } from './client-agreement'
import { depositAsAssessed } from './contract-funding'
import { answerTo, isAnswered, rememberedLine, notRecordedLine,
         type LenderRule } from './lender-rules'

const txt = (v: any) => String(v ?? '').trim()

// The three states that want an ORIGINAL mortgage document rather than a scan.
// Fabio, 29 Sep 2026: "which state uses original mortgage docs WAS, TAS and
// Northern Territory so only use that line for securities in those states."
export const ORIGINAL_MORTGAGE_STATES = ['WA', 'TAS', 'NT']

export type DecidedBy = 'deal' | 'lender' | 'ask'

export type Block = {
  key: string
  // What the tick says on the send screen.
  label: string
  on: boolean
  by: DecidedBy
  // Why it is on or off, in the words that go beside the tick.
  why: string
  // The lender question this block waits on, where it has one.
  needs?: string
}

// --- helpers ---------------------------------------------------------------

const isPurchase = (d: any) => typeOf(d) === 'purchase'
const isInvestment = (d: any) => useOf(d) === 'investment'
const isSmsf = (d: any) => useOf(d) === 'smsf'

// A family guarantee, however the deal came to be one. The BC template is the
// reliable answer; the deal's own name is the fallback for a deal that was set
// up before templates, which is most of the old ones.
export function isFamilyGuarantee(deal: any): boolean {
  const tpl = txt(deal?.bc_data?.template).toLowerCase()
  if (tpl === 'family_pledge') return true
  return /family (pledge|guarantee)|guarantor/i.test(
    `${txt(deal?.deal_type)} ${txt(deal?.deal_name)}`)
}

// THE STATE THE SECURITY IS IN.
//
// The compliance tab's security address is the truest answer once a property
// exists. Before that the BC's stamp duty state is what every figure on the deal
// was worked out against, so it is the one to believe - not the client's own
// address, which is where they live now and not where they are buying.
export function securityState(deal: any): string {
  const addr = txt(deal?.compliance_data?.securityAddress)
  const found = addr.toUpperCase().match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/)
  if (found) return found[1]
  // Through lib/duty-state.ts, so a deal whose state went into the mislabelled
  // suburb box still gets its original mortgage line. WA, TAS and NT is not a
  // nicety - it is a document the client has to post rather than scan.
  const bc = dutyStateOf(deal?.bc_data)
  if (bc) return bc
  const sub = txt(deal?.bc_data?.suburb).toUpperCase().match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/)
  return sub ? sub[1] : ''
}

export function needsOriginalMortgage(deal: any): boolean {
  return ORIGINAL_MORTGAGE_STATES.includes(securityState(deal))
}

// A deposit bond comes up where the clients have no cash deposit to hand over,
// which on this portal is either a family guarantee or a deposit of nil.
export function needsDepositBond(deal: any): boolean {
  if (isFamilyGuarantee(deal)) return true
  return depositAsAssessed(deal) <= 0 && Number(deal?.contract_deposit || 0) <= 0
}

// A lender-answered block. On when the answer says so, OFF with the question
// showing when nobody has answered - never the commonest answer.
function fromLender(key: string, label: string, rules: Record<string, LenderRule>,
                    lender: string, isOn: (answer: string) => boolean): Block {
  if (!isAnswered(rules, key)) {
    return { key, label, on: false, by: 'lender', needs: key,
             why: notRecordedLine(rules, key, lender) }
  }
  const answer = answerTo(rules, key)
  return {
    key, label, on: isOn(answer), by: 'lender', needs: key,
    why: rememberedLine(rules, key, lender),
  }
}

// --- the formal approval ---------------------------------------------------

export function formalApprovalBlocks(deal: any,
                                     rules: Record<string, LenderRule>): Block[] {
  const lender = lenderOnTheDeal(deal?.lo_data || {}) || 'this lender'
  const product = txt(optionOnTheDeal(deal?.lo_data || {})?.productName)
  const state = securityState(deal)
  const out: Block[] = []

  out.push(fromLender('contracts_issued_by', 'How the loan contracts will be issued',
    rules, lender, () => true))

  out.push(fromLender('insurance_minimum',
    `Building insurance, with ${lender}'s interest noted`, rules, lender, () => true))

  out.push({
    key: 'other_side', label: 'Solicitor and buyers agent copied in',
    on: isPurchase(deal), by: 'deal',
    why: isPurchase(deal)
      ? 'On — this is a purchase, and whoever is recorded on the deal is copied in'
      : 'Off — not a purchase',
  })

  out.push({
    key: 'property_management', label: 'Obligation-free property management quote',
    on: isInvestment(deal), by: 'deal',
    why: isInvestment(deal) ? 'On — the purchase is an investment' : 'Off — not an investment',
  })

  out.push({
    key: 'original_mortgage', label: 'An original mortgage document must be signed',
    on: needsOriginalMortgage(deal), by: 'deal',
    why: needsOriginalMortgage(deal)
      ? `On — the security is in ${state}`
      : state
        ? `Off — the security is in ${state}. This line is for WA, TAS and NT only`
        : 'Off — no state recorded for the security, so it cannot be decided',
  })

  out.push({
    key: 'deposit_bond', label: 'A deposit bond will be needed',
    on: needsDepositBond(deal), by: 'deal',
    why: needsDepositBond(deal)
      ? (isFamilyGuarantee(deal) ? 'On — family guarantee' : 'On — no cash deposit recorded')
      : 'Off — a cash deposit is recorded, and this is not a family guarantee',
  })

  // Deppro rides on the lender's own package product, which the deal already
  // holds - so it is a deal decision rather than a lender one.
  const deppro = /package/i.test(product)
  out.push({
    key: 'deppro', label: 'Deppro depreciation schedule discount',
    on: deppro, by: 'deal',
    why: deppro ? `On — the product is ${product}`
                : product ? `Off — ${product} is not a package product`
                          : 'Off — no product recorded on the lending options',
  })

  // Fabio, 29 Sep 2026: "I will build a template for debt recycling so it iwll
  // be on BC/LO". Until that lands there is nothing to read, and the honest
  // answer is off with the reason showing.
  const recycling = /debt recycl/i.test(
    `${txt(deal?.bc_data?.template)} ${txt(deal?.lo_data?.strategy)} ${txt(deal?.bc_data?.strategy)}`)
  out.push({
    key: 'debt_recycling', label: 'Move offset funds into the loan before settlement',
    on: recycling, by: 'deal',
    why: recycling ? 'On — the deal is a debt recycling strategy'
                   : 'Off — the BC and the lending options do not say debt recycling',
  })

  out.push({
    key: 'anything_else', label: 'Anything else',
    on: false, by: 'ask',
    why: 'Free text. Never remembered, because it is different every time',
  })

  return out
}

// --- the pre-approval, and its extension -----------------------------------

export function preapprovalBlocks(deal: any,
                                  rules: Record<string, LenderRule>): Block[] {
  const lender = lenderOnTheDeal(deal?.lo_data || {}) || 'this lender'
  const out: Block[] = []

  // Always. A unit or townhouse can move a borrowing capacity, and the client
  // is the only one who knows what they are about to bid on.
  out.push({
    key: 'strata', label: 'Strata title can affect borrowing capacity',
    on: true, by: 'deal', why: 'On — always, on a pre-approval',
  })

  out.push(fromLender('postcode_restrictions', 'Certain postcodes may be restricted',
    rules, lender, a => a === 'yes'))

  out.push({
    key: 'rp_data', label: 'Offer of an RP Data property report',
    on: true, by: 'deal', why: 'On — always',
  })

  out.push({
    key: 'contract_of_sale', label: 'Signed and dated contract of sale',
    on: true, by: 'deal', why: 'On — always',
  })

  out.push({
    key: 'rental_letter', label: 'Agent letter confirming the weekly rental income',
    on: isInvestment(deal), by: 'deal',
    why: isInvestment(deal) ? 'On — the purchase is an investment' : 'Off — not an investment',
  })

  out.push({
    key: 'updated_payslips', label: 'Payslips and savings statements may need updating',
    on: true, by: 'deal',
    why: 'On — always. The line already says we will advise if it applies',
  })

  out.push({
    key: 'solicitor_details', label: 'Confirmation of the solicitor or conveyancer',
    on: true, by: 'deal', why: 'On — always, on a purchase',
  })

  out.push({
    key: 'deposit_bond', label: 'A deposit bond will be needed',
    on: needsDepositBond(deal), by: 'deal',
    why: needsDepositBond(deal)
      ? (isFamilyGuarantee(deal) ? 'On — family guarantee' : 'On — no cash deposit recorded')
      : 'Off — a cash deposit is recorded, and this is not a family guarantee',
  })

  out.push({
    key: 'smsf_entity', label: 'Check the entity name required on the contract',
    on: isSmsf(deal), by: 'deal',
    why: isSmsf(deal) ? 'On — an SMSF purchase' : 'Off — not an SMSF purchase',
  })

  out.push(fromLender('docusign_certificate',
    'A DocuSign certificate is needed on a digitally signed contract',
    rules, lender, a => a === 'yes'))

  // Fabio's own line. It only means anything once the portal knows how many
  // times this lender extends, which is why that became a lender question.
  out.push(fromLender('preapproval_extensions',
    'A further extension attracts $800 plus GST', rules, lender, a => a !== 'none'))

  out.push({
    key: 'anything_else', label: 'Anything else',
    on: false, by: 'ask',
    why: 'Free text. Never remembered',
  })

  return out
}

// --- applying what a person changed ----------------------------------------

// The sender's own ticks, by key. A key absent means they did not touch it, so
// the portal's decision stands - which is different from them turning it off.
export type Overrides = Record<string, boolean>

export function withOverrides(blocks: Block[], overrides: Overrides): Block[] {
  return blocks.map(b => {
    if (!(b.key in (overrides || {}))) return b
    const on = !!overrides[b.key]
    if (on === b.on) return b
    return { ...b, on, why: `${on ? 'Turned on' : 'Turned off'} for this deal — ${b.why}` }
  })
}

export function on(blocks: Block[], key: string): boolean {
  return !!blocks.find(b => b.key === key)?.on
}

// Everything this email is waiting on a lender answer for. Said once on the
// send screen rather than five times down the list.
export function waitingOnLender(blocks: Block[]): string[] {
  return blocks.filter(b => b.by === 'lender' && !!b.needs && b.why.startsWith('Not recorded'))
    .map(b => b.why)
}
