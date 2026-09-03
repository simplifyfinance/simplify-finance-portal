// WHAT KIND OF INCOME THIS ENTRY IS, DECIDED BY WHAT IS IN IT.
//
// The fact find's own dropdown offers four labels - PAYG, Self-employed, Other
// taxable, Other non-taxable. The AI fact find extractor writes three different
// ones: "Base salary", "Rental", "Other". Nothing ever reconciled the two, and
// every piece of code downstream switched on the label.
//
// So a $300,000 salary on an extracted fact find came out as $0 - in the BC's
// income total, and in the broker notes, which refused to compose at all and
// said "Natasha Chapman has base salary income with no amount recorded".
// Fabio, 3 Sep 2026, seeing it on Chapman: "is there an issue that we need to
// worry about?" There was.
//
// The label is now the LAST thing consulted. An entry carrying a gross salary is
// PAYG whatever it calls itself, and an entry carrying two financial years of
// net profit is self-employed whatever it calls itself. That is true of every
// row already saved, however it was created, and it stays true if somebody adds
// a fifth label next year.

export type IncomeKind = 'payg' | 'self-employed' | 'other' | 'none'

const txt = (v: any) => String(v ?? '').trim()
const filled = (v: any) => txt(v) !== '' && txt(v) !== '0'

const PAYG_FIELDS = ['grossSalary', 'bonusAmount', 'overtimeEssentialAmount',
  'overtimeNonEssentialAmount', 'commissionAmount', 'allowanceAmount']

const SE_FIELDS = ['seAssessmentMethod', 'seDirectorSalary', 'seBusinessName',
  'seYear1Salary', 'seYear1NetProfit', 'seYear2Salary', 'seYear2NetProfit']

// Only used when the entry is empty and there is nothing to go on but the word.
const SE_WORDS = /self.?employ|sole trader|company|director/i
const PAYG_WORDS = /payg|salary|wage|employ/i

export function incomeKind(inc: any): IncomeKind {
  if (!inc) return 'none'

  // What is actually filled in, first.
  if (SE_FIELDS.some(f => filled(inc[f]))) return 'self-employed'
  if (PAYG_FIELDS.some(f => filled(inc[f]))) return 'payg'
  if (filled(inc.otherIncomeAmount)) return 'other'

  // Nothing filled in. Fall back to the label so a half-created row still shows
  // the right fields on the form.
  const label = txt(inc.incomeType)
  if (!label) return 'none'
  if (SE_WORDS.test(label)) return 'self-employed'
  if (PAYG_WORDS.test(label)) return 'payg'
  return 'other'
}

// What to call it in a sentence going to a lender. The stored label when it says
// something ("Rental", "Centrelink"), otherwise the kind.
export function incomeLabel(inc: any): string {
  const specific = txt(inc?.otherIncomeType) || txt(inc?.incomeType)
  const kind = incomeKind(inc)
  if (kind === 'payg') return 'PAYG'
  if (kind === 'self-employed') return 'Self-employed'
  return specific || 'Other income'
}
