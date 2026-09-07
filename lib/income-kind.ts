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

// ONLY FIELDS A PERSON TYPES. Not one that the form fills in for them.
//
// This list used to start with 'seAssessmentMethod'. Every income row the fact
// find creates - PAYG, self-employed, anything - is born carrying
//
//     seAssessmentMethod: 'Last 2 financial years'
//
// because that is the default in the dropdown. It is not evidence of anything.
// But this test asks "is any self-employed field filled in?", and that one
// always was. So EVERY income row in the portal was read as self-employed, its
// PAYG salary was never looked at, and the self-employed maths found no
// financial years and returned nothing.
//
// Alexis Janes: $146,380 of PAYG salary sitting in the fact find, and every
// email, every total and every set of broker notes saying $0. Fabio, 7 Sep 2026:
// "I regenerated the email, and it still shows zero. What is going on?"
//
// The rule for this list, and the test below it: a field belongs here only if a
// person had to type something for it to have a value. Anything the form
// pre-fills says nothing about what kind of income this is.
const SE_FIELDS = ['seDirectorSalary', 'seBusinessName',
  'seYear1Salary', 'seYear1NetProfit', 'seYear2Salary', 'seYear2NetProfit',
  'seYear1Depreciation', 'seYear1Interest', 'seYear1Super', 'seYear1OneOff', 'seYear1Other',
  'seYear2Depreciation', 'seYear2Interest', 'seYear2Super', 'seYear2OneOff', 'seYear2Other']

// Everything the fact find puts on a new income row without anybody typing it.
// Exported so the test can prove none of it is ever treated as evidence.
export const FORM_FILLED_DEFAULTS = [
  'seGrowthMethod', 'seGrowthPercentOption',
  'seYear1FY', 'seYear2FY', 'seDirectorSalaryFrequency', 'seDirectorProfitable',
  'grossSalaryFrequency', 'bonusFrequency', 'overtimeEssentialFrequency',
  'overtimeNonEssentialFrequency', 'commissionFrequency', 'allowanceFrequency',
]

export const KIND_EVIDENCE_FIELDS = [...SE_FIELDS, 'grossSalary', 'bonusAmount',
  'overtimeEssentialAmount', 'overtimeNonEssentialAmount', 'commissionAmount',
  'allowanceAmount', 'otherIncomeAmount']

// Only used when the entry is empty and there is nothing to go on but the word.
const SE_WORDS = /self.?employ|sole trader|company|director/i
const PAYG_WORDS = /payg|salary|wage|employ/i

// The value every income row is born with. Choosing one of the OTHER methods -
// "One year in isolation", "Director's salary" - is a person saying this income
// is self-employed, and a director on a salary has nothing else to say it with.
// Leaving it as it came says nothing at all, and treating it as evidence is what
// made every PAYG salary in the portal read as zero.
export const DEFAULT_ASSESSMENT_METHOD = 'Last 2 financial years'

export function incomeKind(inc: any): IncomeKind {
  if (!inc) return 'none'

  // What is actually filled in, first.
  if (SE_FIELDS.some(f => filled(inc[f]))) return 'self-employed'
  if (filled(inc.seAssessmentMethod) && txt(inc.seAssessmentMethod) !== DEFAULT_ASSESSMENT_METHOD) {
    return 'self-employed'
  }
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
