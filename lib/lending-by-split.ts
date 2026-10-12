import { splitsOf, isInterestOnly, type StructureSplit } from './deal-structure'
import { securitiesOf, type Security } from './box-security'
import { purposeOf, fundsUsedFor } from './debt-recycling'
import { money, readMoney } from './money'

// WHAT EACH SPLIT IS, AND WHY IT IS THAT WAY.
//
// 12 Oct 2026. Box four said this, two sentences apart, about the same loan:
//
//   "...has been recommended, on rates of 6.34% and 6.59% with principal and
//    interest repayments over a thirty year term."
//   "Interest only repayments for the first 5 years keep the commitment as low
//    as possible..."
//
// Six splits: three principal and interest, three interest only. The first
// sentence took the FIRST split's repayment type and stated it as the whole
// deal's; the second read the product's ticked modules and said interest only.
// A compliance pack making two different statements about how a loan repays.
//
// This is not a multiple-securities fault. Any deal with a mix of P&I and
// interest only splits produced it, which is most split deals.
//
// Fabio, 12 Oct 2026: "the wording should say we are refinancing multiple
// securities and each loan split has its specific characteristics and needs
// with principal and interest repayment and interest [only] because..."
//
// SO IT STOPS SUMMARISING AND STARTS LISTING. One line per split, under the
// house it is secured by, each saying what it is and why.
//
// AND THE "WHY" IS QUOTED, NEVER COMPOSED. The only reason anybody has written
// down is the "Original purpose of funds" box and the split's purpose. Those
// are printed back. A split with neither gets a NOT RECORDED flag, the same as
// every other missing fact in this pack - it does not get a plausible sentence
// invented for it.
//
// NOTHING HERE TOUCHES REACT.

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any) => readMoney(v) ?? 0

export type SplitLine = {
  split: StructureSplit
  /** The house it is against, where one is recorded. */
  security: Security | null
  text: string
  /** True when nothing was recorded to explain this split. */
  unexplained: boolean
}

export type LendingBySplit = {
  /** Securities that carry at least one split, in the order box nine names them. */
  groups: { security: Security | null; lines: SplitLine[] }[]
  lines: SplitLine[]
  /** More than one repayment type across the splits. */
  mixed: boolean
  /** Set when every split shares one purpose, so it can be said once. */
  sharedPurpose: string
  securityCount: number
  /** Worth printing at all: more than one split, or more than one security. */
  worthSaying: boolean
}

// THIS IS PROSE, NOT A FORM FIELD.
//
// repaymentLine() is the portal's wording for a SCREEN: it writes "P&I" and
// "Interest only \u00b7 5 yrs", which is right beside a box and wrong in the
// middle of a sentence in a regulated document. Lower-casing it gave "p&i" and
// "interest only \u00b7 term not recorded" inside the compliance pack, which is
// how this was caught.
//
// A fixed rate is named, because fixed for five years and variable are not the
// same promise to a client and an assessor should not have to infer it.
export function howItRepays(s: StructureSplit): string {
  const type = txt(s?.repaymentType)
  if (!type) return ''
  const fixed = /fixed/i.test(type)
  if (!isInterestOnly(type)) return fixed ? 'fixed, principal and interest' : 'principal and interest'
  const years = txt(s?.ioYears)
  const io = years ? `interest only for ${years} years` : 'interest only, term not recorded'
  return fixed ? `fixed, ${io}` : io
}

const PURPOSE_WORDS: Record<string, string> = {
  owner_occupied: 'owner-occupied borrowing',
  investment: 'investment borrowing',
}

/**
 * The reason this split is set up the way it is, in the words that were
 * recorded. Empty when nothing was.
 */
export function reasonFor(s: StructureSplit): string {
  const used = fundsUsedFor(s)
  if (!used) return ''
  return `These funds were used to ${used.charAt(0).toLowerCase()}${used.slice(1)}.`
}

/** The purpose recorded against a split, as words. Empty when unanswered. */
export function purposeWords(s: StructureSplit): string {
  return PURPOSE_WORDS[purposeOf(s) as string] || ''
}

export function lendingBySplit(deal: any): LendingBySplit {
  const splits = splitsOf(deal).filter(s => num(s.amount) > 0)
  const secs = securitiesOf(deal)
  const byId = new Map(secs.filter(x => x.id).map(x => [x.id, x]))

  const lines: SplitLine[] = splits.map(split => {
    const security = byId.get(txt(split.securityId)) || null
    const repays = howItRepays(split)
    const rate = txt(split.rate)
    // Amount, rate and repayment type - then the recorded reason, or nothing.
    // "Investment equity loan split, $740,000 at 6.59%, interest only for 5
    // years." The rate joins the amount rather than taking a comma of its own,
    // which read as a list of three unrelated facts.
    const head = [
      `${split.label || 'Split'}, ${money(split.amount)}${rate ? ` at ${rate}%` : ''}`,
      repays,
    ].filter(Boolean).join(', ')
    const why = reasonFor(split)
    return { split, security, text: why ? `${head}. ${why}` : `${head}.`, unexplained: !why }
  })

  const used = new Set(lines.map(l => l.security?.id).filter(Boolean) as string[])
  const groups: { security: Security | null; lines: SplitLine[] }[] =
    secs.filter(x => x.id && used.has(x.id))
      .map(security => ({ security: security as Security | null,
                          lines: lines.filter(l => l.security?.id === security.id) }))
  const loose = lines.filter(l => !l.security)
  if (loose.length > 0) groups.push({ security: null, lines: loose })

  const kinds = new Set(lines.map(l => howItRepays(l.split)).filter(Boolean))
  // SAID ONCE, NOT SIX TIMES. Where every split carries the same purpose and
  // nothing else was recorded, the pack said "This split is investment
  // borrowing." under all six of them. One sentence above the list says the
  // same thing and reads like a person wrote it.
  const purposes = new Set(lines.map(l => purposeWords(l.split)).filter(Boolean))
  return {
    groups,
    lines,
    mixed: kinds.size > 1,
    sharedPurpose: purposes.size === 1 && lines.every(l => purposeWords(l.split))
      ? [...purposes][0] : '',
    securityCount: secs.length,
    worthSaying: lines.length > 1 || secs.length > 1,
  }
}
