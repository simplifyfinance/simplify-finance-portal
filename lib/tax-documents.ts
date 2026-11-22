// WHAT THE SIMPLE READER WILL READ, AND WHEN IT STOPS.
//
// 22 Nov 2026. Fabio, setting the boundary before a line of this was written:
// "SIMPLE ONLY read company and individual, doesnt read trust, multiple
// entities etc - so we need to GUIDE my team."
//
// THE WHOLE POINT IS THE STOPPING. A reader that quietly skips the document it
// did not understand is worse than no reader, because the figure it hands back
// still looks finished. A trust distribution can be most of somebody's income
// and it goes to whichever beneficiary the trust chose - often the spouse, not
// the applicant. Reading three documents out of four and saying nothing is how
// that income disappears off a file.
//
// So this file answers one question: can the simple route handle what was
// dropped? Either it can and the screen shows the comparison, or it cannot and
// the screen hands the team to the complex route with a sentence saying why.
//
// IT IS DELIBERATELY NOT CLEVER. Judging a share of a second company, or which
// beneficiary a distribution lands on, is an assessor's job. This decides only
// whether the question is simple enough to be read off a page.

export type DocKind =
  | 'individual_return'
  | 'company_return'
  | 'company_financials'
  | 'trust_return'
  | 'partnership_return'
  | 'notice_of_assessment'
  | 'unknown'

/** The seven boxes the portal already holds for each financial year. */
export type YearFigures = {
  /** "2024/25" */
  fy: string
  salary: string
  netProfit: string
  depreciation: string
  interest: string
  superannuation: string
  oneOff: string
  other: string
}

export type ReadDocument = {
  /** What our own file was called, so a person can point at the one that stopped it. */
  fileName: string
  kind: DocKind
  /** "Ferraro Carpentry Pty Ltd", or the person's name on an individual return. */
  entityName: string
  /** Digits only, no spaces. Empty where the document does not carry one. */
  abn: string
  /** One per financial year the document covers. Financials usually carry two. */
  years: YearFigures[]
}

const txt = (v: any) => String(v ?? '').trim()

export const KIND_WORDS: Record<DocKind, string> = {
  individual_return: 'Individual tax return',
  company_return: 'Company tax return',
  company_financials: 'Company financials',
  trust_return: 'Trust tax return',
  partnership_return: 'Partnership tax return',
  notice_of_assessment: 'Notice of assessment',
  unknown: 'Could not tell what this is',
}

/** The two the simple reader cannot do anything with at all. */
export const BEYOND_SIMPLE: DocKind[] = ['trust_return', 'partnership_return']

/** Anything that describes a business rather than a person. */
const BUSINESS_KINDS: DocKind[] = ['company_return', 'company_financials']

/**
 * ONE BUSINESS, OR MORE THAN ONE?
 *
 * By ABN where there is one, because two documents for the same company can
 * easily carry its name two ways - "Ferraro Carpentry Pty Ltd" and "Ferraro
 * Carpentry P/L" are one business and must not read as two. The name is only
 * used where no ABN was found.
 */
export function businessesIn(docs: ReadDocument[]): string[] {
  const seen = new Map<string, string>()
  for (const d of docs) {
    if (!BUSINESS_KINDS.includes(d.kind)) continue
    const key = txt(d.abn) || txt(d.entityName).toLowerCase()
    if (!key) continue
    if (!seen.has(key)) seen.set(key, txt(d.entityName) || key)
  }
  return [...seen.values()]
}

export type Stop = {
  /** The heading on the band. Always the same, because the answer always is. */
  title: string
  /** Why, naming the documents. One sentence a person can act on. */
  why: string
  /** The second button, where there is a way to carry on without the problem. */
  without?: string
}

/**
 * CAN THE SIMPLE ROUTE DO THIS DEAL?
 *
 * Null means yes. Anything else is the band the team sees, in the words they
 * see it in - there is no error code here, because nobody has ever been helped
 * by one.
 *
 * ORDER MATTERS. A deal with a trust AND two companies is a trust problem
 * first: it is the one that silently loses income, so it is the one named.
 */
export function whySimpleCannot(docs: ReadDocument[]): Stop | null {
  const list = docs || []

  // A TRUST OR A PARTNERSHIP. Not a matter of effort - the income does not
  // belong to whoever the return is in the name of until somebody reads the
  // distribution, and that is a judgement.
  const beyond = list.filter(d => BEYOND_SIMPLE.includes(d.kind))
  if (beyond.length > 0) {
    const d = beyond[0]
    const what = d.kind === 'trust_return' ? 'trust' : 'partnership'
    const named = txt(d.entityName)
    return {
      title: 'This one needs the complex route',
      why: `Among the documents is a ${KIND_WORDS[d.kind].toLowerCase()}`
        + `${named ? ` for ${named}` : ''}. The simple reader handles individuals and one company only, `
        + `so it has stopped rather than read part of this and leave the ${what} out. `
        + `A distribution from a ${what} can be most of somebody's income.`,
      without: `Remove the ${what} return and carry on`,
    }
  }

  // MORE THAN ONE BUSINESS. Which share of which company belongs to this
  // applicant is a judgement, not a reading.
  const businesses = businessesIn(list)
  if (businesses.length > 1) {
    return {
      title: 'This one needs the complex route',
      why: `The documents cover ${businesses.length} businesses — ${businesses.join(' and ')}. `
        + 'The simple reader works on one. Which share of which company belongs to this applicant is '
        + 'a judgement, not a reading.',
      without: `Read ${businesses[0]} only`,
    }
  }

  return null
}

/**
 * IS THERE ENOUGH HERE TO READ AT ALL?
 *
 * Separate from the stop above, and said differently, because this is not "we
 * cannot" - it is "you have not given us enough yet". A person who dropped one
 * payslip by mistake needs a different sentence from a person with a trust.
 */
export function whatIsMissing(docs: ReadDocument[]): string {
  const list = (docs || []).filter(d => d.kind !== 'unknown')
  if (list.length === 0) return 'Nothing here could be read as a tax return or a set of financials.'

  const years = new Set<string>()
  for (const d of list) for (const y of d.years || []) if (txt(y.fy)) years.add(txt(y.fy))

  if (years.size === 0) {
    return 'No financial year could be read off these, so there is nothing to compare.'
  }
  return ''
}

/**
 * THE YEARS THESE DOCUMENTS COVER, OLDEST FIRST.
 *
 * Oldest first on purpose: the portal stores the EARLIER year as year 1 and
 * the later one as year 2 - seYear1FY is picked first and seYear2FY is set to
 * the year after it. See the FY pickers in FactFindForm. Getting that round
 * the wrong way would make "previous year plus growth" grow the latest year.
 */
export function yearsCovered(docs: ReadDocument[]): string[] {
  const years = new Set<string>()
  for (const d of docs || []) for (const y of d.years || []) if (txt(y.fy)) years.add(txt(y.fy))
  return [...years].sort()
}

/**
 * THE TWO MOST RECENT YEARS, OLDEST FIRST.
 *
 * Three years of financials is common and the policies only ever use two, so
 * the oldest is dropped rather than offered as a third column nobody asked for.
 */
export function twoYears(docs: ReadDocument[]): string[] {
  const all = yearsCovered(docs)
  return all.slice(-2)
}
