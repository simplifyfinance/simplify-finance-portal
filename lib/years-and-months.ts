// THIRTY YEARS AND THREE HUNDRED AND SIXTY MONTHS ARE THE SAME LOAN.
//
// 17 Nov 2026. The contract check compares what a lender wrote against what the
// deal says, and the two do not write a term the same way. A CBA schedule says
// "30 years". A Bankwest one says "360 months". ANZ writes "29 years 6 months"
// on a loan that started halfway through a month.
//
// Fabio, asked what the check has to cover: "yes check year and months if it is
// PI or IO."
//
// Compared as written, every contract stating months would flag against every
// handover stating years, on every deal. A check that cries wolf on half the
// book is a check the team turns off in a fortnight. So everything becomes
// months before anything is compared, and a difference only exists when the
// numbers genuinely differ.

const txt = (v: any) => String(v ?? '').trim()

export const MONTHS_IN_YEAR = 12

/**
 * A TERM, IN MONTHS, FROM HOWEVER IT WAS WRITTEN.
 *
 * "30 years", "30yr", "360 months", "29 years 6 months", "29y 6m", or a bare
 * number - which is read as YEARS, because every term box in this portal is in
 * years and a bare 30 has never meant thirty months.
 *
 * Null where there is no number at all. Never nought: a loan with no term
 * recorded and a loan of nought months are not the same thing, and one of them
 * does not exist.
 */
export function readMonths(v: any): number | null {
  const raw = txt(v).toLowerCase()
  if (!raw) return null

  const years = raw.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)\b/)
  const months = raw.match(/(\d+(?:\.\d+)?)\s*(?:months?|mths?|mos?|m)\b/)
  if (years || months) {
    const y = years ? Number(years[1]) : 0
    const m = months ? Number(months[1]) : 0
    const total = Math.round(y * MONTHS_IN_YEAR + m)
    return total > 0 ? total : null
  }

  // A bare number is years. See above.
  const bare = raw.match(/^(\d+(?:\.\d+)?)$/)
  if (bare) {
    const n = Math.round(Number(bare[1]) * MONTHS_IN_YEAR)
    return n > 0 ? n : null
  }
  return null
}

/** Months back into the words a person would use. */
export function termWords(months: number | null | undefined): string {
  if (months === null || months === undefined || months <= 0) return ''
  const y = Math.floor(months / MONTHS_IN_YEAR)
  const m = months % MONTHS_IN_YEAR
  const bits: string[] = []
  if (y > 0) bits.push(`${y} year${y === 1 ? '' : 's'}`)
  if (m > 0) bits.push(`${m} month${m === 1 ? '' : 's'}`)
  return bits.join(' ')
}

/** Same term, however each side wrote it. */
export function sameTerm(a: any, b: any): boolean {
  const x = readMonths(a)
  const y = readMonths(b)
  // NOTHING RECORDED IS NOT A DIFFERENCE. It is a gap, and it is reported as
  // one somewhere else rather than as the contract disagreeing with the deal.
  if (x === null || y === null) return true
  return x === y
}

export type Repayment = 'PI' | 'IO'

/**
 * PRINCIPAL AND INTEREST, OR INTEREST ONLY, HOWEVER IT WAS WRITTEN.
 *
 * Lenders write this six ways. Null where nobody said, which again is a gap
 * rather than a disagreement.
 */
export function readRepayment(v: any): Repayment | null {
  const raw = txt(v).toLowerCase()
  if (!raw) return null
  // Six ways, and the punctuation is half of them: "interest-only", "I/O",
  // "P & I". Every separator is optional.
  if (/interest[\s-]*only|\bi\s*\/\s*o\b|\bio\b/.test(raw)) return 'IO'
  if (/principal|\bp\s*[&+\/]?\s*(?:and\s*)?i\b/.test(raw)) return 'PI'
  return null
}

export const REPAYMENT_WORDS: Record<Repayment, string> = {
  PI: 'Principal & interest',
  IO: 'Interest only',
}

/** "Interest only — 5 years" / "Principal & interest". */
export function repaymentWords(r: Repayment | null, ioMonths: number | null): string {
  if (!r) return ''
  if (r === 'PI') return REPAYMENT_WORDS.PI
  const how = termWords(ioMonths)
  return how ? `${REPAYMENT_WORDS.IO} — ${how}` : REPAYMENT_WORDS.IO
}
