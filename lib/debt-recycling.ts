// DEBT RECYCLING - ONE LIMIT, SPLIT BY PURPOSE.
//
// Fabio, 1 Oct 2026: "a client that will have, for example, a loan for a million
// dollars, and we want to restructure their debt, create new splits ... most of
// our templates, which are the refinance ones, are really hard to understand
// that you have the original limit and then within that limit, we want to break
// down the splits in different categories."
//
// THE LIMIT IS THE CONTAINER. On a refinance the splits are a flat list and
// nothing on the page says they live inside one limit - so a client reading
// $620,000 and $300,000 and $80,000 asks why their loan went up to a million and
// a half. Here the limit is stated once, at the top, and every split sits inside
// it. The splits adding to the limit is then something a client can check, which
// is the whole point of sending it.
//
// WHAT THIS FILE WILL NOT SAY.
//
// Simplify Finance holds a credit licence (ACL 387025), not a tax agent
// registration. "This $380,000 is tax deductible" is advice we are not licensed
// to give, and it is the sentence that gets read back to us in two years. So a
// split carries a PURPOSE - what the borrowed money was used for, which is a
// fact about the loan - and never a deductibility. The purpose is the thing we
// are actually being paid to get right: one split per purpose, nothing mixed, so
// the client's accountant can see which dollar did what.
//
// Fabio, 1 Oct 2026, having been shown that distinction: "love it build".

import { money, readMoney } from './money'
import { normalisePurpose } from './split-purpose'
import { andList } from './and-list'

const txt = (v: any) => String(v ?? '').trim()
// readMoney gives null for anything it cannot read. Nothing downstream wants a
// null dollar, and 0 is the honest reading of an empty box.
const num = (v: any): number => readMoney(v) || 0

export function isDebtRecycling(template: any): boolean {
  return txt(template) === 'debt_recycling'
}

// --- the purpose of a split -------------------------------------------------

export type Purpose = 'owner_occupied' | 'investment'

export const PURPOSES: { id: Purpose; label: string }[] = [
  { id: 'owner_occupied', label: 'Owner-occupied' },
  { id: 'investment', label: 'Investment' },
]

// BLANK MEANS BLANK, NEVER OWNER-OCCUPIED.
//
// A default here would be the portal deciding, silently, that a split nobody has
// labelled is private borrowing - and printing that to a client. Every other
// guess in this codebase that looked this harmless has cost a day. Unset is
// unset; the email leaves the line out and the BC says the box is empty.
export function purposeOf(split: any): Purpose | '' {
  const p = txt(split?.purpose)
  if (p === 'owner_occupied' || p === 'investment') return p
  // THE SAME ANSWER IN THE DEAL STRIP'S WORDS. It writes 'OO' and 'INV' onto
  // the same field, so a split answered there reached this file as unanswered
  // and the email simply left the line out. See lib/split-purpose.ts.
  const n = normalisePurpose(p)
  return n === 'OO' ? 'owner_occupied' : n === 'INV' ? 'investment' : ''
}

export function purposeLabel(p: Purpose | '' | any): string {
  return PURPOSES.find(x => x.id === txt(p))?.label || ''
}

// What the money was actually used for - "purchase 12 Example Road", "listed
// shares". Free text, because the real ones never fit a dropdown.
export function fundsUsedFor(split: any): string {
  return txt(split?.fundsUsedFor)
}

// THE LINE A CLIENT READS. Purpose first, then what the funds did, when both are
// there. No purpose, no line - rather than a line that says half of it.
export function purposeLine(split: any): string {
  const label = purposeLabel(purposeOf(split))
  if (!label) return ''
  const used = fundsUsedFor(split)
  return used ? `${label} — funds used to ${used}` : label
}

// --- the limit, and whether the splits fill it -------------------------------

const realOnes = (splits: any): any[] =>
  (Array.isArray(splits) ? splits : []).filter(s => num(s?.amount) > 0)

export function splitsTotal(bc: any): number {
  return realOnes(bc?.splits).reduce((sum, s) => sum + num(s?.amount), 0)
}

// The limit the broker typed. Falling back to the sum of the splits is the one
// place a fallback is right: with no limit entered there is nothing to disagree
// with, and the email still has a total to show.
export function totalLimit(bc: any): number {
  const typed = num(bc?.totalLimit)
  return typed > 0 ? typed : splitsTotal(bc)
}

export type LimitCheck = {
  limit: number
  total: number
  difference: number   // splits minus limit: positive is over
  matches: boolean
  words: string
}

// WARN LOUDLY, NEVER BLOCK. Fabio has been asked and said the same thing about
// the peak debt box: the system does not check his arithmetic, it shows it. A
// send refused at 6pm is a worse failure than a figure he can see is wrong.
export function limitCheck(bc: any): LimitCheck {
  const limit = num(bc?.totalLimit)
  const total = splitsTotal(bc)
  const difference = total - limit

  if (limit <= 0) {
    return { limit: 0, total, difference: 0, matches: true,
             words: total > 0 ? `Splits total ${money(total)}.` : '' }
  }
  // A dollar either way is rounding, not a mistake.
  if (Math.abs(difference) < 1) {
    return { limit, total, difference: 0, matches: true,
             words: `Splits total ${money(total)} — matches the limit.` }
  }
  const over = difference > 0
  return { limit, total, difference, matches: false,
           words: `Splits total ${money(total)}, and the limit is ${money(limit)} — ` +
                  `${money(Math.abs(difference))} ${over ? 'over' : 'short'}.` }
}

// --- what moves, by purpose --------------------------------------------------

export type ByPurpose = {
  ownerOccupied: number
  investment: number
  // Splits with no purpose on them. While this is above zero the two totals
  // above are incomplete, and nothing that adds them up may be printed.
  unassigned: number
  complete: boolean
}

export function byPurpose(bc: any): ByPurpose {
  let ownerOccupied = 0, investment = 0, unassigned = 0
  for (const s of realOnes(bc?.splits)) {
    const amount = num(s?.amount)
    const p = purposeOf(s)
    if (p === 'owner_occupied') ownerOccupied += amount
    else if (p === 'investment') investment += amount
    else unassigned += amount
  }
  return { ownerOccupied, investment, unassigned, complete: unassigned === 0 }
}

// EVERY REAL SPLIT HAS A PURPOSE, OR THE EMAIL SAYS NOTHING ABOUT PURPOSE.
//
// Half a picture here is worse than none: "Investment purpose $300,000" under a
// structure that actually has $380,000 of it is a figure the client will plan
// around.
export function everySplitHasAPurpose(bc: any): boolean {
  const real = realOnes(bc?.splits)
  return real.length > 0 && real.every(s => purposeOf(s) !== '')
}

// --- where the offset sits ---------------------------------------------------
//
// An offset against an investment split reduces the interest on borrowing the
// client may be claiming; against the owner-occupied split it reduces interest
// on the one portion with no investment purpose behind it. Which split it is
// attached to is therefore a decision, not a detail - and until this box
// existed, every sentence the portal wrote about the offset was an assumption.
//
// Fabio, 1 Oct 2026: "keep the off dropdown".
//
// STORED AS THE SPLIT'S LABEL, and only returned while a split still answers to
// it. Rename or remove that split and this goes quiet rather than naming an
// account that is not there.
// A LIST, NOT A CHOICE. Fabio, 1 Oct 2026: "ensure we can add offset account to
// multiple splits ... want multiple offsets in debt recylcing as well". A client
// with four splits can hold offsets against three of them, and a box that only
// takes one would have the email naming the wrong number of accounts.
//
// Reads the list, and still reads the single value that shipped this morning, so
// a deal saved in the hour between the two says the same thing afterwards.
export function offsetSplitLabels(bc: any): string[] {
  const raw = Array.isArray(bc?.offsetSplits) ? bc.offsetSplits : [bc?.offsetSplit]
  const live = realOnes(bc?.splits).map(s => txt(s?.label))
  const out: string[] = []
  for (const v of raw.map(txt)) {
    if (v && live.includes(v) && !out.includes(v)) out.push(v)
  }
  // Named in the order the splits are in, not the order they were ticked - the
  // email lists them beside figures that are already in that order.
  return live.filter(l => out.includes(l))
}

// --- the words ---------------------------------------------------------------

// THE TAX LINE. Not a disclaimer bolted on the end - it is the honest answer to
// the question the email raises, and it sits under the structure it is about,
// which is where a caveat gets read. Same placement as the peak debt sentence.
// Fabio, 1 Oct 2026, having read the flag and decided: "say deductible to
// client as long as disclaimer is there htta we are not giving tax advice".
// So the email names a deductible portion, and this is the sentence that has to
// travel with it. It is not a disclaimer bolted on the end - it sits under the
// figure it is about, which is where a caveat gets read.
//
// TWO SENTENCES, TWO JOBS, TWO PLACES. Written as one, they printed twice over -
// once under the structure and again under the deductible figure, back to back.
// What we did goes under the structure; what we are not saying goes under the
// only figure that needs it.
export const STRUCTURE_NOTE =
  'We have set these loans up so the purpose of each one is clear and stays clear.'

export const ACCOUNTANT_NOTE =
  'Whether the investment portion is deductible depends on your own circumstances \u2014 please ' +
  'confirm it with your accountant before we proceed. This is not tax advice.'

// THE OFFSET SENTENCE, IN ONE PLACE. Both scenarios that ask where the offsets
// sit print it - one wording, one plural rule, one place to change it.
export function offsetLine(bc: any): string {
  const offsets = offsetSplitLabels(bc)
  if (offsets.length === 0) return ''
  // NAMED, WITH NO NOUN AFTER THEM. "the Home and Equity split splits" is what
  // appending the word produced on 1 Oct 2026, because a label is free to
  // contain it already. The labels are names; they do not need telling what
  // they are.
  if (offsets.length === 1) {
    return `Your offset account sits against ${offsets[0]}, where the savings held in it ` +
           'do the most good.'
  }
  return `Your offset accounts sit against ${andList(offsets)}, where the savings held ` +
         'in them do the most good.'
}

// Why it is split this way, in the client's words rather than ours. Only the
// lines that are true of THIS structure are printed.
export function whySplitThisWay(bc: any): string[] {
  const lines: string[] = []

  // THE CLAIM HAS TO BE TRUE OF THIS STRUCTURE. Read back on 1 Oct 2026, a
  // four-split scenario with one split unlabelled still said "each split holds
  // one purpose and nothing else" - a sentence the email itself disproved three
  // rows higher. It is only said when every split actually carries a purpose.
  if (everySplitHasAPurpose(bc)) {
    lines.push('Each split holds one purpose and nothing else, so no account mixes private and ' +
               'investment borrowings.')
  }
  const oo = realOnes(bc?.splits).filter(s => purposeOf(s) === 'owner_occupied')
  if (oo.length > 0) {
    const named = txt(oo[0].label)
    lines.push(
      `Any extra repayments are best directed to ${oo.length === 1 ? (named ? `the ${named} split` : 'the owner-occupied split') : 'the owner-occupied splits'}, ` +
      'because that borrowing has no investment purpose behind it.')
  }
  const io = realOnes(bc?.splits).filter(s =>
    purposeOf(s) === 'investment' && /interest only|^io$/i.test(txt(s?.type)))
  if (io.length > 0) {
    lines.push('The investment splits are interest only, so each balance stays at the figure the ' +
               'funds were drawn for.')
  }
  const offset = offsetLine(bc)
  if (offset) lines.push(offset)
  return lines
}

// The headline sentence. The total is said once and said as unchanged only when
// it genuinely is - a restructure that also raises the limit is a different
// email and must not claim otherwise.
export function openingLine(bc: any): string {
  const limit = totalLimit(bc)
  const existing = num(bc?.existingLoanBal)
  if (limit <= 0) return 'Here is how we would restructure the lending.'
  const same = existing > 0 && Math.abs(limit - existing) < 1
  return same
    ? `The total amount you owe does not change — ${money(limit)} today and ${money(limit)} after. ` +
      'What changes is that it is divided into separate loans, each one tied to a single purpose, so ' +
      'that the purpose of every dollar is clear and stays clear.'
    : `The total facility comes to ${money(limit)}, divided into separate loans, each one tied to a ` +
      'single purpose, so that the purpose of every dollar is clear and stays clear.'
}

// --- what the compliance write-up says when this scenario is picked ----------
//
// The write-up already reads the scenario: it mentions first home buyers only on
// the FHB template and progress draws only on construction. This is the same
// idea, and it is here rather than in lib/box-one.ts so the words and the
// arithmetic they quote cannot drift apart.
//
// Fabio is sending his own phrases for this. When they arrive they replace these
// - these are the facts the file has to state, not the way he says them.
export function complianceLines(bc: any): string[] {
  const lines: string[] = []
  const limit = totalLimit(bc)
  const count = realOnes(bc?.splits).length
  if (count === 0) return lines

  // ONE SENTENCE, WHICHEVER WAY THE LIMIT HAS GONE.
  //
  // Fabio, 1 Oct 2026: "remove this The total borrowing is unchanged; in case we
  // need to increase or reduce". He is right - a restructure that also raises or
  // lowers the facility is a normal thing to do, and a sentence claiming
  // otherwise is one nobody would notice was false. (The two-branch version it
  // replaced also read "into a facility of $X into 3 separate splits".)
  lines.push(
    `This application restructures the lending into a facility of ${money(limit)} across ` +
    `${count} separate split${count === 1 ? '' : 's'}, so that each split carries a single purpose.`)

  if (everySplitHasAPurpose(bc)) {
    const p = byPurpose(bc)
    const bits: string[] = []
    if (p.ownerOccupied > 0) bits.push(`${money(p.ownerOccupied)} is for owner-occupied purposes`)
    if (p.investment > 0) bits.push(`${money(p.investment)} relates to funds used for investment purposes`)
    if (bits.length) lines.push(bits.join(' and ') + '.')
  }

  const offsets = offsetSplitLabels(bc)
  if (offsets.length === 1) {
    lines.push(`An offset account has been placed against ${offsets[0]} only.`)
  } else if (offsets.length > 1) {
    lines.push(`Offset accounts have been placed against ${andList(offsets)}.`)
  }

  // THE SENTENCE THAT PROTECTS THE LICENCE. Stated on the file whether or not
  // anything else about the purposes could be worked out.
  lines.push('The clients have been advised to confirm the tax treatment of this structure with their ' +
             'accountant. No taxation advice has been provided by Simplify Finance.')
  return lines
}

// WHAT IS NOT DRAWN.
//
// A limit the splits do not fill is normal on a restructure - the balance of the
// facility sits there available. Printing the limit at the top and three rows
// that add to less than it, with nothing saying why, is a column that does not
// add up, which is the fault the construction and bridging emails were both
// fixed for. Empty when the splits fill the limit, or overfill it.
export function undrawnNote(bc: any): string {
  const limit = num(bc?.totalLimit)
  const total = splitsTotal(bc)
  if (limit <= 0 || total <= 0) return ''
  const left = limit - total
  if (left < 1) return ''
  return `${money(left)} of the limit above is not drawn at settlement and remains available.`
}
