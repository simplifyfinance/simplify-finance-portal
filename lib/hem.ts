// Whether an expense sits inside the Household Expenditure Measure, and who says so.
//
// Every category was hardcoded: health insurance in HEM, strata in HEM, and no
// way for anyone to say otherwise. Lenders do not all agree, and the two that
// come up are health insurance and strata - so on those two the answer belongs
// to the person writing the file, not to a constant in the source.
//
// Fabio, 2 Sep 2026: a toggle on those two, optional to answer, and the row sits
// in light red until somebody does.

export type HemAnswer = 'in' | 'out'
export type HemState = 'in' | 'out' | 'unanswered'

export type ExpenseCategory = {
  key: string
  label: string
  inHem: boolean
  // Only these ask. Everything else is settled and shows no toggle at all - a
  // switch on twenty rows is twenty more chances to get one wrong.
  askHem?: boolean
}

export type ExpenseEntry = { monthlyAmount?: string; hem?: string }

export function hemStateOf(cat: ExpenseCategory | undefined, entry: ExpenseEntry | undefined): HemState {
  if (!cat) return 'in'
  if (!cat.askHem) return cat.inHem ? 'in' : 'out'
  const answer = entry?.hem
  if (answer === 'in' || answer === 'out') return answer
  return 'unanswered'
}

// An unanswered row counts as IN HEM, which is where it sat before there was a
// question to ask. The totals must not move on their own the moment this ships -
// a file becomes visibly unfinished, never quietly different.
export function countsInHem(state: HemState): boolean {
  return state !== 'out'
}

export function toNum(v: any): number {
  return parseFloat(String(v ?? '').replace(/,/g, '')) || 0
}

export type HemTotals = { all: number; inHem: number; notInHem: number; unanswered: number }

export function hemTotals(
  cats: ExpenseCategory[],
  expenses: Record<string, ExpenseEntry> | undefined | null,
): HemTotals {
  let all = 0, inHem = 0, notInHem = 0, unanswered = 0
  for (const cat of cats) {
    const entry = expenses?.[cat.key]
    const amount = toNum(entry?.monthlyAmount)
    const state = hemStateOf(cat, entry)
    all += amount
    if (countsInHem(state)) inHem += amount; else notInHem += amount
    // Counted whether or not an amount has been typed. A blank health insurance
    // row is still a question nobody has answered, and a lender asking "did you
    // consider this" wants to know either way.
    if (state === 'unanswered') unanswered += 1
  }
  return { all, inHem, notInHem, unanswered }
}

// Plain English for the banner under the totals.
export function unansweredNote(n: number): string {
  if (n <= 0) return ''
  return `${n} expense${n === 1 ? '' : 's'} still need${n === 1 ? 's' : ''} a HEM answer. `
       + `${n === 1 ? 'It is' : 'They are'} counted as in HEM until you decide.`
}
