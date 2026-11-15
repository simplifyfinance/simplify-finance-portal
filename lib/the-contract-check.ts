// WHAT THE CONTRACT SAYS, AGAINST WHAT THE DEAL SAYS.
//
// 17 Nov 2026. Fabio, on the biggest job the settlements team has: "the biggest
// task we have in our team is to make sure the rates is correct, the security
// is correct, the terms is correct, if it's interest only, if it's principal
// and interest. So you need to start reading contracts."
//
// And on where it happens and whose job it is: "contracts arrive at 'contracts
// issued' and its our job to verify if the rate security name of applicant and
// loan term is correct."
//
// ---------------------------------------------------------------------------
// SIX THINGS, AND NOT ONE OF THEM IS CORRECTED AUTOMATICALLY
// ---------------------------------------------------------------------------
//
// The portal says what differs and by how much. A person says which side is
// wrong - the contract, in which case the deal is updated, or the deal, in
// which case it goes back to the bank - and that answer goes on the trail with
// their name on it. The portal has no way of knowing which of a bank and a
// broker is right, and a screen that guesses at that is worse than no screen.
//
// SEVERAL CONTRACTS AT ONCE. A split loan has a contract per split and the team
// is checking all of them, so this works on a list.
//
// AND NOTHING IS INVENTED. A field the reader could not find is a GAP, not a
// difference. "The contract does not state a term" and "the contract says 25
// years where we say 30" are different problems with different answers, and
// collapsing them would have the team ringing a bank about a sentence nobody
// wrote.
import { readMonths, termWords, readRepayment, repaymentWords, type Repayment } from './years-and-months'
import { money, readMoney } from './money'

const txt = (v: any) => String(v ?? '').trim()

/** What one loan contract says, as read off it. */
export type ContractSays = {
  /** The split or account it is for, as the contract names it. */
  label?: string
  rate?: any
  repayment?: any
  ioTerm?: any
  amount?: any
  loanTerm?: any
  security?: any
  borrowers?: any
}

/** What the deal says the same loan should be. */
export type DealSays = ContractSays

export type Field = 'rate' | 'repayment' | 'ioTerm' | 'amount' | 'loanTerm' | 'security' | 'borrowers'

export const FIELD_LABEL: Record<Field, string> = {
  rate: 'Rate',
  repayment: 'Repayment',
  ioTerm: 'Interest only for',
  amount: 'Loan amount',
  loanTerm: 'Loan term',
  security: 'Security',
  borrowers: 'Borrowers',
}

/** In the order the team reads them. */
export const FIELDS: Field[] = ['rate', 'repayment', 'ioTerm', 'amount', 'loanTerm', 'security', 'borrowers']

export type Line = {
  field: Field
  label: string
  /** What the contract says, in words. */
  says: string
  /** What the deal says, in words. Empty where the deal is silent. */
  expected: string
  /** Different, the same, or nobody said. */
  state: 'differs' | 'matches' | 'not stated'
}

const rate = (v: any): number | null => {
  const n = Number(txt(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
const amount = (v: any): number | null => {
  const n = readMoney(v)
  return n !== null && n > 0 ? n : null
}

/** An address compared the way a person would: ignoring case, punctuation and the country. */
export function sameAddress(a: any, b: any): boolean {
  const k = (v: any) => txt(v).toLowerCase()
    .replace(/,?\s*australia\s*$/i, '')
    .replace(/[^a-z0-9]/g, '')
  const x = k(a)
  const y = k(b)
  if (!x || !y) return true
  return x === y || x.startsWith(y) || y.startsWith(x)
}

/** Names compared as a set, because nobody agrees on the order or the middle name. */
export function sameNames(a: any, b: any): boolean {
  const set = (v: any) => {
    const raw = Array.isArray(v) ? v.join(',') : txt(v)
    return raw.toLowerCase().split(/[,;&]|\band\b/)
      .map(s => s.trim().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean))
      // First and last only. A contract carrying a middle name the fact find
      // does not is not two different people.
      .map(w => w.length > 1 ? `${w[0]} ${w[w.length - 1]}` : w[0])
      .filter(Boolean).sort()
  }
  const x = set(a)
  const y = set(b)
  if (x.length === 0 || y.length === 0) return true
  return x.length === y.length && x.every((n, i) => n === y[i])
}

const words = {
  rate: (v: any) => { const n = rate(v); return n === null ? '' : `${n}%` },
  amount: (v: any) => { const n = amount(v); return n === null ? '' : money(n) },
  term: (v: any) => termWords(readMonths(v)),
  names: (v: any) => (Array.isArray(v) ? v.join(', ') : txt(v)),
}

/**
 * ONE CONTRACT, CHECKED.
 *
 * Every field it could read, with what the deal says beside it. A field neither
 * side states is left out entirely - there is nothing to say about it and a row
 * reading "not stated / not stated" is noise on a screen somebody is scanning.
 */
// `want` and not `deal`: this takes a plain object of what the figures SHOULD
// be, not a deals row, and scripts/check-deal-columns.sh rightly reads `deal.`
// anywhere in the portal as a column on the table. It caught this on its first
// run, which is what it is for.
export function checkContract(said: ContractSays, want: DealSays): Line[] {
  const out: Line[] = []
  const add = (field: Field, says: string, expected: string, same: boolean) => {
    if (!says && !expected) return
    out.push({
      field, label: FIELD_LABEL[field], says, expected,
      state: !says || !expected ? 'not stated' : same ? 'matches' : 'differs',
    })
  }

  add('rate', words.rate(said.rate), words.rate(want.rate), rate(said.rate) === rate(want.rate))

  const rSaid = readRepayment(said.repayment)
  const rDeal = readRepayment(want.repayment)
  add('repayment', rSaid ? repaymentWords(rSaid, null) : '',
      rDeal ? repaymentWords(rDeal, null) : '', rSaid === rDeal)

  // ONLY ASKED ON AN INTEREST ONLY LOAN. "Interest only for nothing" is not a
  // difference on a loan that is principal and interest.
  if (rSaid === 'IO' || rDeal === 'IO') {
    add('ioTerm', words.term(said.ioTerm), words.term(want.ioTerm),
        readMonths(said.ioTerm) === readMonths(want.ioTerm))
  }

  add('amount', words.amount(said.amount), words.amount(want.amount),
      amount(said.amount) === amount(want.amount))
  add('loanTerm', words.term(said.loanTerm), words.term(want.loanTerm),
      readMonths(said.loanTerm) === readMonths(want.loanTerm))
  add('security', txt(said.security), txt(want.security), sameAddress(said.security, want.security))
  add('borrowers', words.names(said.borrowers), words.names(want.borrowers),
      sameNames(said.borrowers, want.borrowers))

  return out
}

export const differences = (lines: Line[]) => lines.filter(l => l.state === 'differs')
export const notStated = (lines: Line[]) => lines.filter(l => l.state === 'not stated')

/** "2 of 6 differ" / "all 6 match". */
export function countWords(lines: Line[]): string {
  const n = differences(lines).length
  if (lines.length === 0) return 'nothing read'
  if (n === 0) return `all ${lines.length} match`
  return `${n} of ${lines.length} differ${n === 1 ? 's' : ''}`
}

// WHAT SOMEBODY DECIDED ABOUT A DIFFERENCE.
export type Answer = 'contract' | 'deal' | 'unsure'

export const ANSWER_WORDS: Record<Answer, string> = {
  contract: 'The contract — update the deal',
  deal: 'The deal — go back to the lender',
  unsure: 'Not sure yet',
}

/** "The contract says 6.14% and the deal says 6.08%. Which one is right?" */
export function askAbout(l: Line): string {
  return `The contract says ${l.says} and the deal says ${l.expected}. Which one is right?`
}

/**
 * CAN THE CLIENT BE TOLD YET?
 *
 * 17 Nov 2026, Fabio: "you'll confirm when we're sending the confirmation email
 * that everything is correct." The loan documents email carries the figures, so
 * an unanswered difference holds it. A difference that has been ANSWERED does
 * not - somebody has looked at it and said which side is right, which is the
 * whole job.
 *
 * This is the only thing in the settlements build that blocks anything.
 */
export function heldBack(lines: Line[], answers: Record<string, Answer | undefined>): Line[] {
  return differences(lines).filter(l => {
    const a = answers?.[l.field]
    return !a || a === 'unsure'
  })
}

export function holdWords(n: number): string {
  if (n <= 0) return ''
  return n === 1
    ? 'One left to settle before the client is told'
    : `${n} left to settle before the client is told`
}
