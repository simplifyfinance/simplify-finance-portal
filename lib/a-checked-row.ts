// ONE ROW OF A DOCUMENT CHECK, WHICHEVER DOCUMENT IT IS.
//
// 17 Nov 2026. Three documents arrive during settlement and all three are
// checked the same way: the loan contract, the signed loan documents, and the
// building insurance or strata certificate. Each has its own list of fields,
// and nothing else about them differs.
//
//   It is read      by the same reader the fact find and the payslips use
//   It is not kept  the file goes; what it said stays on the deal
//   Nothing is corrected  the portal says what differs, a person says which
//                         side is wrong, and that answer carries their name
//   Nothing is invented   a field it cannot find reads "not stated"
//
// So the row, the counting, the answering and the holding live here once, and
// each document brings only its own list of fields. Written the day the second
// document was built, by moving them out of the contract check rather than
// copying them - two copies of "2 of 6 differ" drift within a month.

const txt = (v: any) => String(v ?? '').trim()

export type RowState =
  /** Both sides said something and they are not the same. */
  | 'differs'
  /** Both sides said something and they agree. */
  | 'matches'
  /** One side said nothing, so there is nothing to compare. */
  | 'not stated'

export type Row = {
  /** Which field this is, in the document's own list. */
  field: string
  label: string
  /** What the document says, in words. */
  says: string
  /** What the deal says, in words. Empty where the deal is silent. */
  expected: string
  state: RowState
}

/**
 * BUILD A ROW, OR DO NOT.
 *
 * A field neither side states is left out entirely. There is nothing to say
 * about it, and a row reading "not stated / not stated" is noise on a screen
 * somebody is scanning for the one thing that is wrong.
 */
export function row(
  field: string, label: string, says: string, expected: string, same: boolean,
): Row | null {
  const s = txt(says)
  const e = txt(expected)
  if (!s && !e) return null
  return { field, label, says: s, expected: e, state: !s || !e ? 'not stated' : same ? 'matches' : 'differs' }
}

export const differences = <T extends Row>(rows: T[]) => rows.filter(r => r.state === 'differs')
export const notStated = <T extends Row>(rows: T[]) => rows.filter(r => r.state === 'not stated')

/** "2 of 6 differ" / "all 6 match" / "nothing read". */
export function countWords(rows: Row[]): string {
  const n = differences(rows).length
  if (rows.length === 0) return 'nothing read'
  if (n === 0) return `all ${rows.length} match`
  return `${n} of ${rows.length} differ${n === 1 ? 's' : ''}`
}

// WHAT SOMEBODY DECIDED ABOUT A DIFFERENCE.
export type Answer = 'contract' | 'deal' | 'unsure'

/**
 * The same three choices every time, named after whichever document is on
 * screen. 'contract' is the key on all three because the answer means the same
 * thing - believe the paper, not the portal - and renaming the key per document
 * would make three shapes of the same saved answer.
 */
export function answerWords(noun: string): Record<Answer, string> {
  return {
    contract: `The ${noun} — update the deal`,
    deal: 'The deal — go back to the lender',
    unsure: 'Not sure yet',
  }
}

/**
 * CAN THE CLIENT BE TOLD YET?
 *
 * An unanswered difference holds the email that carries the figures. A
 * difference that has been ANSWERED does not - somebody looked at it and said
 * which side is right, which is the whole job.
 */
export function heldBack<T extends Row>(
  rows: T[], answers: Record<string, Answer | undefined>,
): T[] {
  return differences(rows).filter(r => {
    const a = answers?.[r.field]
    return !a || a === 'unsure'
  })
}

export function holdWords(n: number): string {
  if (n <= 0) return ''
  return n === 1
    ? 'One left to settle before the client is told'
    : `${n} left to settle before the client is told`
}
