// WHAT EACH LENDER WANTS WHEN AN ACCEPTED OFFER CHANGES THE LOAN.
//
// Fabio's answers, 10 Sep 2026, to the questions in the "How we handle offer
// accepted" note. Recorded here verbatim rather than in somebody's head, because
// this is the step he named as the one that goes wrong most: "mostly the loan
// amount breakdown and pricing".
//
// TWO THINGS ARE DELIBERATELY NOT IN HERE, and the portal says so out loud
// rather than guessing:
//
//   1. HOW FAR THE LOAN CAN MOVE before the pricing has to be redone. Nobody has
//      given a figure per lender. A wrong threshold is worse than no threshold -
//      it would tell somebody the discount still holds when it does not.
//   2. HOW OLD A PAYSLIP MAY BE at submission. "90 days for all" was the answer
//      about the PREAPPROVAL. Whether documents carry the same limit was not
//      answered, and 30 days is common enough elsewhere that assuming 90 would
//      be a guess with a client's settlement on it.

export type NotifyHow = 'aol' | 'portal' | 'email'

export type LenderRule = {
  // The names this lender is recorded under, lower case. The lender library and
  // the team use different ones - STG, St George, Bank of Melbourne.
  names: string[]
  // How long the preapproval stands, in days.
  preapprovalDays: number
  // Whether it can be extended once, and what that costs.
  canExtend: boolean
  extendDays?: number
  extendFee?: number
  notify: NotifyHow
  // What to actually do, in the words of the person who does it.
  notifyDetail: string
  // Anything that is easy to miss and expensive to get wrong.
  watchOut?: string
}

// 90 DAYS FOR ALL. Fabio, 10 Sep 2026.
const NINETY = 90

export const LENDER_RULES: LenderRule[] = [
  {
    names: ['cba', 'commonwealth bank', 'commbank'],
    preapprovalDays: NINETY, canExtend: true, extendDays: NINETY,
    notify: 'aol',
    notifyDetail: 'Edit and resubmit in AOL, and upload the documents there.',
    watchOut: 'Untick preapproval on the resubmission, or it goes back as another preapproval.',
  },
  {
    names: ['st george', 'stg', 'bank of melbourne', 'bom', 'banksa', 'bank sa'],
    preapprovalDays: NINETY, canExtend: true, extendDays: NINETY,
    notify: 'aol',
    notifyDetail: 'Edit and resubmit in AOL, and upload the documents there.',
    watchOut: 'Untick preapproval on the resubmission, or it goes back as another preapproval.',
  },
  {
    names: ['westpac'],
    preapprovalDays: NINETY, canExtend: true, extendDays: NINETY,
    notify: 'aol',
    notifyDetail: 'Edit and resubmit in AOL, and upload the documents there.',
    watchOut: 'Untick preapproval on the resubmission, or it goes back as another preapproval.',
  },
  {
    names: ['nab', 'national australia bank'],
    preapprovalDays: NINETY, canExtend: false,
    notify: 'aol',
    notifyDetail: 'Edit and resubmit in AOL, and upload the documents there.',
    watchOut: 'Untick preapproval on the resubmission, or it goes back as another preapproval.',
  },
  {
    names: ['anz'],
    preapprovalDays: NINETY, canExtend: true, extendDays: NINETY,
    notify: 'email',
    notifyDetail: 'Email them the change.',
    // The one that is a real trap: a REDUCTION needs a signed acknowledgement
    // from the broker, not just a note about the new figure.
    watchOut: 'If the loan REDUCES, ANZ also needs the broker acknowledgement email. See anzReductionEmail().',
  },
  {
    names: ['macquarie', 'macquarie bank'],
    preapprovalDays: NINETY, canExtend: false,
    notify: 'aol',
    notifyDetail: 'Edit and resubmit in AOL, then upload the documents through the Macquarie portal.',
  },
  {
    names: ['bankwest'],
    preapprovalDays: NINETY, canExtend: false,
    notify: 'portal',
    notifyDetail: 'Through the Bankwest portal.',
  },
  {
    names: ['ing'],
    preapprovalDays: NINETY, canExtend: true, extendDays: NINETY,
    notify: 'email',
    notifyDetail: 'Email them the change.',
  },
  {
    names: ['ubank', 'u bank'],
    preapprovalDays: NINETY, canExtend: true, extendDays: NINETY,
    notify: 'email',
    notifyDetail: 'Email them the change.',
  },
  {
    names: ['wlth'],
    preapprovalDays: NINETY, canExtend: true, extendDays: NINETY, extendFee: 100,
    notify: 'email',
    notifyDetail: 'Email them the change.',
    watchOut: 'WLTH charge $100 to extend the preapproval.',
  },
]

const norm = (s: any) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

// The rule for a lender, or null when we have not been told about them. Null is
// a real answer here and the screen says so - it does not fall back to the most
// common rule and let somebody act on it.
export function ruleFor(lenderName: any): LenderRule | null {
  const want = norm(lenderName)
  if (!want) return null
  return LENDER_RULES.find(r => r.names.some(n => n === want))
      || LENDER_RULES.find(r => r.names.some(n => want.includes(n) || n.includes(want)))
      || null
}

export type PreapprovalAge = {
  days: number
  expiresOn: Date
  expired: boolean
  // Inside a fortnight of running out.
  soon: boolean
  canExtend: boolean
  extendFee?: number
}

// HOW LONG IS LEFT ON THE PREAPPROVAL. Ninety days from the day it was given.
export function preapprovalAge(preapprovalAt: any, rule: LenderRule | null, now = new Date()): PreapprovalAge | null {
  if (!preapprovalAt || !rule) return null
  const from = new Date(preapprovalAt)
  if (Number.isNaN(from.getTime())) return null
  const days = Math.floor((now.getTime() - from.getTime()) / 86_400_000)
  const expiresOn = new Date(from.getTime() + rule.preapprovalDays * 86_400_000)
  const left = rule.preapprovalDays - days
  return {
    days,
    expiresOn,
    expired: left <= 0,
    soon: left > 0 && left <= 14,
    canExtend: rule.canExtend,
    extendFee: rule.extendFee,
  }
}

// THE ANZ REDUCTION EMAIL.
//
// Their words, not ours, and it is an acknowledgement rather than a notification
// - so it is reproduced exactly and the broker's own name goes on it. Given as a
// template to paste, never sent by the portal: it is the broker acknowledging
// something, and the portal cannot acknowledge on their behalf.
export function anzReductionEmail(opts: {
  applicationReference?: string
  change?: string
  conversationDate?: string
  brokerName?: string
}): string {
  const line = (v: any) => String(v ?? '').trim()
  return [
    `Application reference: ${line(opts.applicationReference)}`,
    '',
    `Description of Change: ${line(opts.change)}`,
    '',
    `Date of customer conversation: ${line(opts.conversationDate)}`,
    '',
    'Acknowledgement by Broker',
    'I acknowledge that I have asked all the Interview Guide questions and notified the',
    'applicant(s) of the risks associated with their selected loan features, including the risks',
    'identified. I confirm I have not provided the applicant(s) with tax or financial advice.',
    '',
    `Broker Name: ${line(opts.brokerName)}`,
  ].join('\n')
}

// Whether this lender needs that acknowledgement for this change.
export function needsAnzAcknowledgement(lenderName: any, oldLoan: number, newLoan: number): boolean {
  const rule = ruleFor(lenderName)
  if (!rule || !rule.names.includes('anz')) return false
  return newLoan > 0 && oldLoan > 0 && newLoan < oldLoan
}

// HOW FAR THE LOAN MOVED, AND WHETHER THIS LENDER CARES.
//
// Fabio, 27 Sep 2026: "10% is only a St George Westpac and Bank of Melbourne
// rule... changes always apply up or down just percentage no dollar figure".
//
// The threshold is NOT in this file. Every other rule here is something the
// portal has to understand; this is a number a bank changes its mind about, so
// it lives on the lender record where Fabio and Katie can type it without
// waiting for a deploy. See docs/lender-reprice-schema.sql.
//
// UP OR DOWN. A loan that drops 12% has moved 12%. The direction is reported
// because it matters elsewhere - ANZ want a signed acknowledgement for a
// reduction and nothing at all for an increase - but the threshold does not
// care which way it went.

export type RepricingCheck = {
  // How far it moved, as a percentage of what it was. Always positive.
  movedPercent: number
  direction: 'up' | 'down'
  // What the lender allows before the pricing is redone. Null means nobody has
  // recorded one, which is a real answer and is said out loud.
  threshold: number | null
  // Only meaningful when a threshold is recorded. False with no threshold - it
  // is not "within the rule", there is no rule.
  over: boolean
}

// Null when there is nothing to say: no loan, or the loan has not moved.
export function repricingCheck(oldLoan: any, newLoan: any,
                               thresholdPercent: any): RepricingCheck | null {
  const was = Number(String(oldLoan ?? '').replace(/[^0-9.]/g, ''))
  const now = Number(String(newLoan ?? '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(was) || !Number.isFinite(now) || was <= 0 || now <= 0) return null
  if (was === now) return null

  // THE COMPARISON IS ON THE EXACT FIGURE, the rounding is for the eye only.
  // Rounded first, a real movement of 0.0001% became 0.0% and then read as
  // "not over 0%" on a lender whose rule is that any movement at all needs
  // repricing. A displayed number and a decision are not the same thing.
  const exact = (Math.abs(now - was) / was) * 100
  const movedPercent = Math.round(exact * 10) / 10
  const threshold = thresholdOf(thresholdPercent)
  return {
    movedPercent,
    direction: now > was ? 'up' : 'down',
    threshold,
    over: threshold !== null && exact > threshold,
  }
}

// A threshold of zero would mean "any movement at all needs repricing", which is
// a real rule somebody could type. Only a blank, a null or nonsense is N/A.
function thresholdOf(v: any): number | null {
  if (v === null || v === undefined) return null
  const raw = String(v).trim()
  if (raw === '') return null
  // WORDS ARE NOT ZERO. "about ten" stripped down to an empty string, and
  // Number('') is 0 - which would have quietly meant "any movement at all needs
  // repricing" on every lender somebody had typed a note into.
  const digits = raw.replace(/[^0-9.]/g, '')
  if (!/[0-9]/.test(digits)) return null
  const n = Number(digits)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// The line a person reads, in one place, so the offer-accepted panel and
// anything else that moves a loan cannot word it differently.
export function repricingLine(check: RepricingCheck | null, lenderName: any): string {
  if (!check) return ''
  const who = String(lenderName ?? '').trim() || 'this lender'
  const moved = `The loan moves ${check.direction} ${check.movedPercent}%.`
  if (check.threshold === null) {
    return `${moved} No repricing rule is recorded for ${who}, so check before you submit.`
  }
  return check.over
    ? `${moved} Over ${who}'s ${check.threshold}% limit — they will want the pricing redone.`
    : `${moved} Within ${who}'s ${check.threshold}% limit, so the pricing stands.`
}
