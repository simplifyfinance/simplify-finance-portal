// THE QUESTIONS WE ASK ABOUT A LENDER ONCE.
//
// Fabio, 29 Sep 2026: "lets build a rules based on each ledner to learn as we
// seelct if preapprovalc na extended etc".
//
// THE CATALOGUE IS CODE; THE ANSWERS ARE DATA. A new question is an entry in the
// list below - no migration, no column, no deploy to change an answer later.
// That is deliberate: the questions will keep coming as templates are added, and
// if each one cost a schema change nobody would add one, and the answers would
// go back to living in people's heads.
//
// EVERY QUESTION HERE IS ABOUT A BANK, NOT ABOUT A CLIENT. "Is this an
// investment" belongs to the deal and the portal already knows it. "Does this
// lender want a DocuSign certificate" is true of every deal with that lender
// forever, and asking it twice is the thing this file exists to stop.
//
// NO ANSWER MEANS ASK. Never the commonest answer, never a guess. A lender
// nobody has answered for shows the block unticked with the reason on screen,
// because a confident wrong sentence on a client email is worse than a question
// - and silently leaving a postcode warning out of a non-bank pre-approval is
// exactly the failure this protects against.

const txt = (v: any) => String(v ?? '').trim()

export type RuleOption = {
  value: string
  // What the person choosing sees.
  label: string
}

export type RuleQuestion = {
  key: string
  // Asked of a person, in the words they would use.
  ask: string
  options: RuleOption[]
  // A note under the question when it is first asked. Empty where the question
  // speaks for itself.
  hint?: string
  // The column heading on the lender library page. Short.
  short: string
}

// THE FIVE WE START WITH. Each one is a line that used to be deleted by hand out
// of a template, or a fact somebody had to remember.
export const RULES: RuleQuestion[] = [
  {
    key: 'contracts_issued_by',
    ask: 'How does this lender issue loan contracts?',
    short: 'Contracts by',
    options: [
      { value: 'email', label: 'By email' },
      { value: 'post', label: 'By express post' },
      { value: 'online', label: 'Through online banking' },
    ],
    hint: 'It goes in the formal approval email, so the client knows where to look.',
  },
  {
    key: 'postcode_restrictions',
    ask: 'Do certain postcodes have lending restrictions with this lender?',
    short: 'Postcodes',
    options: [
      { value: 'yes', label: 'Yes — warn the client' },
      { value: 'no', label: 'No' },
    ],
    hint: 'A yes puts the postcode note in the pre-approval email.',
  },
  {
    key: 'docusign_certificate',
    ask: 'Does this lender want the DocuSign certificate on a digitally signed contract?',
    short: 'DocuSign',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    // Fabio named this one himself. His own template already says a fee applies
    // "beyond the second pre-approval", so how many times a lender will extend
    // is a fact the email has always depended on and nobody had written down.
    key: 'preapproval_extensions',
    ask: 'How many times will this lender extend a pre-approval?',
    short: 'Extensions',
    options: [
      { value: 'none', label: 'Not at all — a new application is needed' },
      { value: 'once', label: 'Once' },
      { value: 'twice', label: 'Twice' },
      { value: 'more', label: 'More than twice' },
    ],
  },
  {
    key: 'insurance_minimum',
    ask: 'What does this lender want building insurance cover to be at least?',
    short: 'Insurance for',
    options: [
      { value: 'property_value', label: 'The property value' },
      { value: 'loan_amount', label: 'The loan amount' },
      { value: 'figure', label: 'A figure they state on the approval' },
    ],
  },
]

export function ruleQuestion(key: string): RuleQuestion | null {
  return RULES.find(r => r.key === txt(key)) || null
}

export function optionLabel(key: string, value: any): string {
  const q = ruleQuestion(key)
  return q?.options.find(o => o.value === txt(value))?.label || ''
}

// --- what has been answered ------------------------------------------------

export type LenderRule = {
  key: string
  value: string
  setBy: string
  setAt: string
  used: number
}

// Rows as they come back from the table, keyed by question. Anything whose key
// is not in the catalogue is dropped: a question that has been retired must not
// keep steering an email from beyond the grave.
export function rulesOf(rows: any): Record<string, LenderRule> {
  const out: Record<string, LenderRule> = {}
  if (!Array.isArray(rows)) return out
  for (const r of rows) {
    const key = txt(r?.key)
    if (!ruleQuestion(key)) continue
    const value = txt(r?.value)
    if (!value) continue                      // an empty answer is not one
    out[key] = {
      key, value,
      setBy: txt(r?.set_by),
      setAt: txt(r?.set_at),
      used: Number(r?.used) || 0,
    }
  }
  return out
}

export function answerTo(rules: Record<string, LenderRule>, key: string): string {
  return rules?.[key]?.value || ''
}

// Has this lender been asked yet? Used to decide whether a block shows its
// answer or its question.
export function isAnswered(rules: Record<string, LenderRule>, key: string): boolean {
  return !!answerTo(rules, key)
}

// "Remembered for Bankwest — set 29 Sep by Katie Amos, used on 12 deals."
//
// Shown beside the answer rather than hidden in a tooltip. Somebody has to be
// askable when a rule turns out to be wrong, and a rule used twelve times is
// worth trusting in a way one set this morning is not.
export function rememberedLine(rules: Record<string, LenderRule>, key: string,
                               lenderName: string): string {
  const r = rules?.[key]
  if (!r) return ''
  const parts = [`Remembered for ${txt(lenderName) || 'this lender'}`]
  if (r.setBy) parts.push(`set by ${r.setBy}`)
  if (r.used > 0) parts.push(`used on ${r.used} deal${r.used === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

// WHY A BLOCK IS BLANK, in words somebody can act on. Empty when the question
// has been answered.
export function notRecordedLine(rules: Record<string, LenderRule>, key: string,
                                lenderName: string): string {
  if (isAnswered(rules, key)) return ''
  const q = ruleQuestion(key)
  if (!q) return ''
  return `Not recorded for ${txt(lenderName) || 'this lender'} — ${q.ask.toLowerCase()}`
}

// Everything still unanswered for this lender, so the send screen can say so
// once rather than five times.
export function unanswered(rules: Record<string, LenderRule>,
                           keys: string[] = RULES.map(r => r.key)): RuleQuestion[] {
  return keys.map(ruleQuestion)
    .filter((q): q is RuleQuestion => q !== null)
    .filter(q => !isAnswered(rules, q.key))
}

// --- writing ---------------------------------------------------------------

// CHANGING ONE IS TWO DIFFERENT ACTIONS, and the caller must say which.
//
//   'deal'   - this client went differently for a reason. The rule is untouched,
//              so the next twelve clients are unaffected.
//   'lender' - the bank changed its process. Everybody after this gets it.
//
// One button doing both is how a rule quietly becomes wrong for everybody
// because of one unusual file.
export type RuleScope = 'deal' | 'lender'

export type RuleWrite = {
  lender_id: string
  key: string
  value: string
  set_by: string
}

// The row to upsert, or null when nothing should be written - an unknown
// question, an empty answer, an answer that is not one of the options, or a
// change the caller said was for this deal only.
export function ruleWrite(lenderId: any, key: string, value: any, by: string,
                          scope: RuleScope): RuleWrite | null {
  if (scope !== 'lender') return null
  const id = txt(lenderId)
  const q = ruleQuestion(key)
  const v = txt(value)
  if (!id || !q || !v) return null
  // An answer outside the list is a bug upstream, not a new option. Writing it
  // would put a value in the table that nothing can read back.
  if (!q.options.some(o => o.value === v)) return null
  return { lender_id: id, key: q.key, value: v, set_by: txt(by) }
}

// --- how an answer reads in a client email ----------------------------------

// // HOW AN ANSWER READS IN A CLIENT EMAIL.
//
// The catalogue above stores 'email', 'post', 'online' - short values, right for
// a table and wrong for a sentence. The formal approval email needs "by express
// post", and until now the only place those words existed was a fixture in a
// test file, which is the same as not existing.
//
// They live HERE, beside the options they belong to, so adding an option and
// forgetting its wording is one edit away from being noticed rather than two
// files away. The test below is the thing that notices.

const CONTRACTS_BY: Record<string, string> = {
  email: 'by email',
  post: 'by express post',
  online: 'through your online banking',
}

const INSURANCE_FOR: Record<string, string> = {
  property_value: 'at least the property value',
  loan_amount: 'at least the loan amount',
  // The lender states a figure on its own approval letter. We do not know it
  // here and will not invent one, so the sentence points at the letter that
  // does - which is attached to this very email.
  figure: 'at least the amount stated on the approval letter attached',
}

// Empty where the lender has not been asked. An empty phrase is what stops the
// block being ticked at all, so no email ever says "issued  by Bankwest".
export function contractsByPhrase(rules: Record<string, LenderRule>): string {
  return CONTRACTS_BY[answerTo(rules, 'contracts_issued_by')] || ''
}

export function insuranceForPhrase(rules: Record<string, LenderRule>): string {
  return INSURANCE_FOR[answerTo(rules, 'insurance_minimum')] || ''
}

// Exported for the guard test only: every option in the catalogue must have
// words. See lib/rule-phrases.test.ts.
export const PHRASE_TABLES: Record<string, Record<string, string>> = {
  contracts_issued_by: CONTRACTS_BY,
  insurance_minimum: INSURANCE_FOR,
}
