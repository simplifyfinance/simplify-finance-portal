// WHAT IS ABOUT TO BE WRITTEN ON A CLIENT'S RECORD, IN WORDS, BEFORE IT IS.
//
// 26 Nov 2026. Fabio, after Catherine hit an error closing three of Mark's
// deals as lost:
//
//   "If we're marking a deal as lost, we got to ask the question, do you want
//    to update the current assets and liabilities? And the preference is
//    normally we don't because we lost the deal, but just that needs to be a
//    serious question... So please create a habit that you show what the A&L is
//    and say, are you confirming this is the current position?"
//
// THE OLD SHAPE WAS A TICK BOX, AND IT WAS TICKED FOR YOU. One click closed a
// deal AND overwrote two client records with figures nobody had looked at since
// the fact find was written. Nothing on the screen said which figures.
//
// A DEAL THAT WAS LOST USUALLY CHANGES NOTHING ABOUT WHAT SOMEBODY OWNS. They
// did not buy the house. They did not take the loan. So the default is now no,
// and yes has to be chosen, read and confirmed.
//
// EVERYTHING HERE IS PURE. It takes the fact find and returns lines of text, so
// what the screen promises can be tested rather than looked at and hoped over.
// The figures themselves are never invented or rounded - moneyOrBlank prints
// "not recorded" where the fact find is blank, because a made-up zero on an
// asset list is worse than an obvious gap.

import { positionFor, applicantName, type Position } from './client-position'
import { moneyOrBlank } from './money'

const txt = (v: any) => String(v ?? '').trim()

export type PositionLine = {
  /** "14 Example St, Wyoming - owner occupied" */
  what: string
  /** "$880,000", or "not recorded". Never a guess. */
  amount: string
}

export type PositionReview = {
  clientId: string
  name: string
  properties: PositionLine[]
  liabilities: PositionLine[]
  assets: PositionLine[]
  /** How many of the lines above nobody ever assigned to a person. */
  unconfirmed: number
  /** True when this applicant's fact find holds nothing at all. */
  holdsNothing: boolean
}

function propertyLines(p: Position): PositionLine[] {
  return (p.properties || []).map((x: any) => ({
    what: [txt(x.address) || 'Address not recorded', txt(x.purpose) || txt(x.propertyUse)]
      .filter(Boolean).join(' - '),
    amount: moneyOrBlank(x.value),
  }))
}

function liabilityLines(p: Position): PositionLine[] {
  return (p.liabilities || []).map((x: any) => {
    const kind = txt(x.liabilityType) || 'Liability'
    const who = txt(x.lenderName)
    // A CREDIT CARD IS A LIMIT, NOT A BALANCE, and a lender reads the limit.
    // Showing the balance here would flatter the position on the one line that
    // is routinely the difference between a deal working and not.
    const isCard = /credit card/i.test(kind)
    return {
      what: who ? `${kind} - ${who}` : kind,
      amount: isCard ? `${moneyOrBlank(x.limitAmount)} limit` : moneyOrBlank(x.balance),
    }
  })
}

function assetLines(p: Position): PositionLine[] {
  return (p.assets || []).map((x: any) => ({
    what: txt(x.assetType) || txt(x.description) || 'Asset',
    amount: moneyOrBlank(x.value),
  }))
}

/** One applicant's position, as the screen will read it out. */
export function reviewFor(factFind: any, applicant: any): PositionReview {
  const p = positionFor(factFind || {}, applicant)
  const properties = propertyLines(p)
  const liabilities = liabilityLines(p)
  const assets = assetLines(p)
  return {
    clientId: txt(applicant?.clientId),
    name: applicantName(applicant),
    properties,
    liabilities,
    assets,
    unconfirmed: p.unconfirmed,
    holdsNothing: properties.length + liabilities.length + assets.length === 0,
  }
}

export function reviewAll(factFind: any, applicants: any[]): PositionReview[] {
  return (applicants || []).map(a => reviewFor(factFind, a))
}

/** The names, for the question at the top. "Harrison and Jacob". */
export function namesInTheQuestion(applicants: any[]): string {
  const names = (applicants || []).map(a => txt(applicantName(a).split(' ')[0])).filter(Boolean)
  if (names.length === 0) return 'these clients'
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

/**
 * THE LINE THAT HAS TO BE TICKED, WITH THE NAMES IN IT.
 *
 * "I confirm" on its own is a thing people tick. "I confirm this is Harrison
 * and Jacob's current position" is a sentence somebody has to disagree with
 * before they can tick it, which is the entire point.
 */
export function confirmationLine(applicants: any[]): string {
  return `I confirm this is ${namesInTheQuestion(applicants)}'s current position.`
}

/**
 * WHETHER A FACT FIND IS WORTH WRITING ONTO A CLIENT RECORD AT ALL.
 *
 * Not the same question as the Natasha Chapman guard in client-position.ts,
 * which compares against what the client already holds. This one is on the
 * screen, before anything is read or written: a fact find that holds nothing
 * for anybody is not a position, it is a blank form.
 */
export function nothingToWrite(reviews: PositionReview[]): boolean {
  return reviews.length > 0 && reviews.every(r => r.holdsNothing)
}
