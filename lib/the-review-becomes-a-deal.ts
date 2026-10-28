// A GOOD REVIEW BECOMES A DEAL, IN ONE PRESS.
//
// 26 Oct 2026. Fabio, on the process we agreed and had not finished: "we were
// going to log calls and if successful I would create a deal card in one
// upload current fact find and register as a new lead we are not there yet
// with any leads but need to know the process works".
//
// Logging the call was built. The other half was not. `linked_deal_id` was
// read in two places and written in none - so "Became a deal" was a word
// somebody ticked, and then they went and built the deal from nothing,
// retyping the client, the broker and the securities that were on the screen
// in front of them.
//
// THE PORTAL ALREADY HOLDS EVERYTHING THE DEAL NEEDS. The name, both
// applicants, the email and the phone, every security with its lender, its
// balance and its value. Every one of those is a thing a person would
// otherwise type twice.
//
// Everything in this file is a function of its arguments - no database, no
// clock of its own - so the whole of it can be tested without one. The one
// side effect, creating the rows, is in components/ReviewActions.tsx.

const txt = (v: any) => String(v ?? '').trim()

export function makeUid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

// MOVED HERE FROM app/(app)/deals/page.tsx ON 26 Oct 2026, unchanged, so the
// new-deal modal and a review that becomes a deal cannot build an applicant
// two different ways. The call in the modal reads exactly as it did - see
// lib/applicant-carries-its-client.test.ts, which is about the call, not about
// where the function lives.
export function makeApplicant(
  first_name: string, last_name: string, email: string, phone: string, clientId?: string,
) {
  const id = makeUid()
  return {
    id, title: '', firstName: first_name, middleName: '', lastName: last_name,
    preferredName: '', previousName: '', gender: '', dob: '',
    phoneMobile: phone, emailPersonal: email, clientId,
    addresses: [{ id: makeUid(), address: '', residentialStatus: '', isCurrent: true, startDate: '' }],
    employment: [{ id: makeUid(), isCurrent: true, employmentPriority: 'Primary', employmentBasis: 'Full time', occupation: '', startDate: '', onProbation: false, employerName: '', employerAbn: '', employerAcn: '', employerType: '', employerAddress: '', contactPersonName: '', contactPersonDetails: '' }],
    income: [{ id: makeUid(), incomeType: 'PAYG', employmentId: '', grossSalary: '', grossSalaryFrequency: 'Annually', bonusAmount: '', bonusFrequency: 'Annually', overtimeEssentialAmount: '', overtimeEssentialFrequency: 'Annually', overtimeNonEssentialAmount: '', overtimeNonEssentialFrequency: 'Annually', commissionAmount: '', commissionFrequency: 'Annually', allowanceAmount: '', allowanceFrequency: 'Annually' }]
  }
}

/**
 * THE SECOND NAME ON THE BOOK ROW.
 *
 * book_name holds everybody: "Justin Barrasch, Jodie Verrall". The first and
 * last name columns hold only the one the emails are addressed to. 225 of the
 * 656 are a couple, and starting their deal with one applicant means somebody
 * types the other one in by hand five minutes later.
 *
 * It returns nothing rather than guessing where there is only one name in the
 * entry, or where the entry is a company. A wrong applicant on a new deal is
 * worse than a missing one.
 */
export function secondName(bookName: any, first: any, last: any): { first: string; last: string } | null {
  const whole = txt(bookName)
  if (!whole) return null
  const primary = `${txt(first)} ${txt(last)}`.trim().toLowerCase()
  for (const part of whole.split(',')) {
    const name = txt(part)
    if (!name || name.toLowerCase() === primary) continue
    const words = name.split(/\s+/).filter(Boolean)
    // One word is a company or half a name. Either way it is not two people.
    if (words.length < 2) continue
    return { first: words[0], last: words.slice(1).join(' ') }
  }
  return null
}

/** First Last & First Last Year - the format the new deal modal uses. */
export function dealNameFromReview(
  first: any, last: any, second: { first: string; last: string } | null, year: number,
): string {
  const one = `${txt(first)} ${txt(last)}`.trim()
  const two = second ? `${txt(second.first)} ${txt(second.last)}`.trim() : ''
  const who = [one, two].filter(Boolean).join(' & ')
  return `${who || 'New client'} ${year}`.trim()
}

// ---------------------------------------------------------------------------
// THE FACT FIND, FROM WHAT THE BOOK ALREADY KNOWS
// ---------------------------------------------------------------------------
//
// THE KEYS HERE MATCH defaultProperty() AND defaultPropertyLoan() IN
// FactFindForm.tsx, and lib/the-review-becomes-a-deal.test.ts reads that file
// and fails if one of them grows a field this does not set. A fact find seeded
// with a property the form does not recognise is a property that loses half
// its boxes the first time somebody saves.

export type ReviewProperty = {
  id?: string
  address?: any
  investor?: boolean | null
  lender_raw?: any
  current_balance?: any
  original_loan?: any
  estimated_current_value?: any
  original_value?: any
  ordinal?: number | null
}

const money = (v: any) => {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) && n !== 0 ? String(Math.round(n)) : ''
}

export function seededProperty(p: ReviewProperty, ownership: Record<string, string>, uid = makeUid) {
  const investor = p.investor !== false
  const balance = money(p.current_balance ?? p.original_loan)
  return {
    id: uid(),
    address: txt(p.address),
    ownershipType: investor ? 'Investment' : 'Owner occupied',
    futureUse: 'Ongoing',
    zoning: 'Residential',
    propertySubtype: 'Fully detached house',
    value: money(p.estimated_current_value ?? p.original_value),
    // WHERE THE FIGURE CAME FROM, said rather than implied. It is the book's
    // number or a value somebody looked up, not the applicant's guess.
    runningCosts: '', runningCostsFrequency: 'Monthly',
    bodyCorpAmount: '', bodyCorpFrequency: 'Monthly',
    rentalIncome: '', rentalIncomeFrequency: 'Weekly',
    ownership,
    loans: balance ? [{
      id: uid(),
      lenderName: txt(p.lender_raw),
      bsb: '', accountNumber: '',
      mortgageType: investor ? 'Investment' : 'Owner occupied',
      limitAmount: '', balance,
      interestRate: '', repaymentAmount: '', repaymentFrequency: 'Monthly',
      repaymentType: 'Interest only', interestOnlyExpiryDate: '',
      rateType: 'Variable', fixedRateExpiryDate: '',
      loanTermExpiryDate: '', remainingLoanTermYears: '30',
      status: 'Ongoing', ownership,
    }] : [],
  }
}

/** Evenly split between whoever is on the deal - what the form does itself. */
export function ownershipSplit(applicantIds: string[]): Record<string, string> {
  const n = applicantIds.length
  if (n === 0) return {}
  const pct = n === 1 ? '100' : (100 / n).toFixed(2).replace(/\.00$/, '')
  const out: Record<string, string> = {}
  for (const id of applicantIds) out[id] = pct
  return out
}

export function factFindFromReview(
  applicants: any[], properties: ReviewProperty[], uid = makeUid,
) {
  const ownership = ownershipSplit(applicants.map(a => a.id))
  const ordered = [...(properties || [])]
    .sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0))
    .filter(p => txt(p.address))
  return {
    applicants,
    properties: ordered.map(p => seededProperty(p, ownership, uid)),
    liabilities: [],
    assets: [],
  }
}

/**
 * THE DEAL ROW ITSELF.
 *
 * A NEW LEAD, SAID OUT LOUD. lead_source is what the business counts, and a
 * deal that came out of the portfolio review is the whole point of the
 * portfolio review. Left blank it would be indistinguishable from a referral.
 */
export const REVIEW_LEAD_SOURCE = 'Portfolio review'

export function dealRowFromReview(input: {
  dealName: string
  clientId: string | null
  brokerKey: any
  factFind: any
  isTest?: boolean
}) {
  return {
    deal_name: input.dealName,
    client_id: input.clientId,
    lead_source: REVIEW_LEAD_SOURCE,
    assigned_broker: txt(input.brokerKey),
    // A new deal starts at the fact find, the same as one started by hand.
    stage: 'FactFind',
    status: 'in_progress',
    is_test: !!input.isTest,
    fact_find_data: input.factFind,
  }
}
