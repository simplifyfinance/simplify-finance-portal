// SAYING WHICH FIELD, IN WORDS A BROKER USES.
//
// The merge in lib/deal-merge.ts works in paths - ['applicants', 0, 'income', 1,
// 'grossSalary']. Nobody should ever be shown that. A notice saying "their
// changes have been brought in" is worth very little; one saying "Applicant 1 -
// Income 2 - Gross salary" tells you where to look, which is the whole point of
// telling somebody at all.

import type { MergePath } from './deal-merge'

// Words this business writes in capitals. Left as they are rather than being
// turned into "Lmi" or "Abn".
const SHOUTED: Record<string, string> = {
  lvr: 'LVR', lmi: 'LMI', abn: 'ABN', acn: 'ACN', hecs: 'HECS', payg: 'PAYG',
  fhog: 'FHOG', dti: 'DTI', smsf: 'SMSF', bc: 'BC', lo: 'LO', io: 'IO', pi: 'P&I',
  id: 'ID', ai: 'AI', url: 'link', html: 'email', se: 'Self-employed', fy: 'financial year',
  cc: 'Credit card', crm: 'CRM', ato: 'ATO', gst: 'GST', hem: 'HEM',
}

// A list, and what one row of it is called. Without this an index reads as
// "Applicants 1", which is not how anybody says it.
const ONE_OF: Record<string, string> = {
  applicants: 'Applicant', employment: 'Job', income: 'Income', addresses: 'Address',
  assets: 'Asset', properties: 'Property', liabilities: 'Liability', loans: 'Loan',
  splits: 'Split', refinanceSplits: 'Split', lenders: 'Lender option',
  documentsRequired: 'Document', criteriaUsed: 'Research criterion',
  expenses: 'Expense', checklist: 'Checklist item', altScenarios: 'Alternative scenario',
  dependants: 'Dependant',
}

// Where the plain reading of the field name is not the name it goes by here.
const CALLED: Record<string, string> = {
  bc_data: 'BC', fact_find_data: 'Fact Find', lo_data: 'Lending options',
  compliance_data: 'Compliance', internalNotes: 'Internal notes',
  brokerNotes: 'Broker notes', templateNotes: 'Template notes',
  needsPrimary: 'Primary reasons for seeking credit',
  needsImmediate: 'Immediate needs', needsLongTerm: 'Longer term needs',
  applicationSubmissionComment: 'Application submission notes',
  grossSalary: 'Gross salary', existingLoanBal: 'Existing loan balance',
  recommendedLender: 'Recommended lender', recommendationNote: 'Recommendation note',
  emailHtml: 'Client email', emailHtmlTemplate: 'Client email template',
  purchasePropertySubtype: 'House or strata', depositSource: 'Deposit source',
  clientAgreedLender: 'Client agreed with the recommendation',
  clientChosenLender: 'Lender the client chose',
  dutyState: 'Stamp duty state', loanPurpose: 'Loan purpose',
  seAssessmentMethod: 'Self-employed assessment method',
  employmentBasis: 'Employment basis', employmentType: 'Employment type',
  isCurrent: 'Current job', onProbation: 'On probation',
}

// grossSalaryFrequency -> Gross salary frequency
export function humanise(key: string): string {
  if (CALLED[key]) return CALLED[key]
  const words = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim().split(/\s+/)
    .map(w => SHOUTED[w.toLowerCase()] || w.toLowerCase())
  if (words.length === 0) return key
  const first = words[0]
  // Do not flatten a word that is already deliberately capitalised.
  const head = first === first.toUpperCase() && first.length > 1
    ? first : first.charAt(0).toUpperCase() + first.slice(1)
  return [head, ...words.slice(1)].join(' ')
}

function oneOf(key: string): string {
  if (ONE_OF[key]) return ONE_OF[key]
  const label = humanise(key)
  return label.endsWith('s') ? label.slice(0, -1) : label
}

// ['applicants', 0, 'income', 1, 'grossSalary'] -> 'Applicant 1 - Income 2 - Gross salary'
export function describePath(path: MergePath): string {
  const parts: string[] = []
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]
    if (typeof seg === 'number') {
      // Belongs to the list named just before it. Counted from one, because
      // nobody outside this file calls the first applicant "applicant zero".
      if (parts.length > 0) parts[parts.length - 1] = `${parts[parts.length - 1]} ${seg + 1}`
      else parts.push(`Item ${seg + 1}`)
      continue
    }
    const nextIsIndex = typeof path[i + 1] === 'number'
    parts.push(nextIsIndex ? oneOf(seg) : humanise(seg))
  }
  // The whole record changed and there is nothing more specific to say.
  return parts.length > 0 ? parts.join(' - ') : 'this tab'
}

// "Applicant 1 - Date of birth, Dependants and 3 more"
export function describePaths(paths: MergePath[], limit = 3): string {
  const seen: string[] = []
  for (const p of paths) {
    const label = describePath(p)
    if (!seen.includes(label)) seen.push(label)
  }
  if (seen.length === 0) return ''
  const shown = seen.slice(0, limit)
  const rest = seen.length - shown.length
  const list = shown.length === 1 ? shown[0]
    : shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1]
  return rest > 0 ? `${list}, and ${rest} more` : list
}
