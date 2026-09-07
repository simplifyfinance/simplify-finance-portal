// A SELF-EMPLOYED INCOME, AS FACTS RATHER THAN A SENTENCE.
//
// Three places describe the same self-employed income, for three different
// readers: the fact find shows the working while somebody types it, the broker
// submission notes say it to a lender, and the compliance notes have to justify
// it to an auditor. They were all reading the raw fields and each deciding for
// itself what a method meant, which is how three descriptions of one income end
// up disagreeing.
//
// This says what was recorded, once. Each reader writes its own words from it.
//
// IT NEVER GUESSES. An income with no financial years typed into it is not
// $0 - it is a form somebody has not finished, and hasFigures says so. The fact
// find used to print "$0 p.a." in a confident blue box on exactly that.

import { readMoney, money } from './money'
import { calculateSeAssessableIncome, seYearTotalFF } from './income-calculations'
import { incomeKind } from './income-kind'

const txt = (v: any) => String(v ?? '').trim()
const has = (v: any) => (readMoney(v) ?? 0) > 0

export type YearFacts = {
  fy: string
  netProfit: string
  salary: string
  addBacks: { label: string; amount: string }[]
  total: number
}

export type SelfEmployedFacts = {
  structure: string          // Sole trader, Company - as it was picked
  business: string
  method: string             // as chosen on the form
  methodWords: string        // "the average of the last two financial years"
  years: YearFacts[]         // empty for a director's salary
  directorSalary: string     // only for a director's salary
  profitable: string         // Yes / No / '' - the box nothing read until now
  assessed: number | null    // null when it cannot be worked out
  hasFigures: boolean        // did anybody type any money into it at all
  growingYearOnYear: boolean // the later year beat the earlier one
}

const ADD_BACKS: [string, string][] = [
  ['Depreciation', 'depreciation'], ['Interest', 'interest'],
  ['Super', 'superannuation'], ['OneOff', 'one-off expenses'], ['Other', 'other add-backs'],
]

function yearFacts(inc: any, nth: 1 | 2): YearFacts {
  const p = nth === 1 ? 'seYear1' : 'seYear2'
  return {
    fy: txt(inc?.[`${p}FY`]),
    netProfit: has(inc?.[`${p}NetProfit`]) ? money(inc[`${p}NetProfit`]) : '',
    salary: has(inc?.[`${p}Salary`]) ? money(inc[`${p}Salary`]) : '',
    addBacks: ADD_BACKS
      .filter(([k]) => has(inc?.[`${p}${k}`]))
      .map(([k, label]) => ({ label, amount: money(inc[`${p}${k}`]) })),
    total: seYearTotalFF(inc, nth),
  }
}

export function selfEmployedFacts(inc: any, employment?: any): SelfEmployedFacts {
  const method = txt(inc?.seAssessmentMethod)
  const isDirector = method === "Director's salary"
  const oneYear = method === 'One year in isolation'

  const growth = txt(inc?.seGrowthMethod)
  const pct = txt(inc?.seGrowthPercentOption) === 'Other'
    ? txt(inc?.seGrowthPercentCustom) : txt(inc?.seGrowthPercentOption)
  // WHAT THE NOTE SAYS THE FIGURE IS.
  //
  // Fabio, 8 Sep 2026, on the latest-year method: "do not say the word lower."
  // A compliance note is not the place to draw an assessor's eye to the weaker
  // of two years - the figure used IS the latest one, and that is the honest
  // description of it. And on growth: "the business is growing, performing very
  // well year on year, so we're using a conservative figure of previous year
  // plus twenty percent growth as per lender's policy."
  const methodWords = isDirector ? "the director's salary"
    : oneYear ? 'one financial year in isolation'
    : growth === 'latest_lower' ? 'the latest financial year as per the tax returns provided'
    : growth === 'previous_plus_growth' ? `a conservative figure of the previous financial year plus ${pct}% growth, as per lender policy`
    : 'the average of the last two financial years'

  // ONLY THE YEARS THE FIGURE ACTUALLY CAME FROM.
  //
  // Previous-plus-growth uses the earlier year and nothing else; the latest-year
  // method uses the later one. Printing the year that was NOT used invites an
  // assessor to ask why that number is on the page.
  const bothYears = [yearFacts(inc, 1), yearFacts(inc, 2)]
  const years = isDirector ? []
    : oneYear ? [bothYears[0]]
    : growth === 'latest_lower' ? [bothYears[1]]
    : growth === 'previous_plus_growth' ? [bothYears[0]]
    : bothYears
  const assessedRaw = calculateSeAssessableIncome(inc)
  const hasFigures = isDirector ? has(inc?.seDirectorSalary) : bothYears.some(y => y.total > 0)
  // Only said when the figures actually show it. The method is chosen because a
  // business is growing; the note only claims it when the two years agree.
  const growingYearOnYear = growth === 'previous_plus_growth'
    && bothYears[1].total > bothYears[0].total && bothYears[0].total > 0

  return {
    structure: txt(employment?.selfEmployedStructure),
    business: txt(inc?.seBusinessName) || txt(employment?.employerName),
    method,
    methodWords,
    years,
    directorSalary: has(inc?.seDirectorSalary) ? money(inc.seDirectorSalary) : '',
    profitable: txt(inc?.seDirectorProfitable),
    // Not a number when the method contradicts the figures, and not a number
    // when nothing has been typed. Zero is never an answer here.
    assessed: !hasFigures || Number.isNaN(assessedRaw) ? null : Math.round(assessedRaw),
    hasFigures,
    growingYearOnYear,
  }
}

// WHAT COMPLIANCE HAS TO BE ABLE TO JUSTIFY.
//
// The client email deliberately says none of this - Fabio, 8 Sep 2026: "we don't
// like disclosing calculations". An auditor asking how a self-employed income
// was arrived at is the whole reason the compliance notes exist, so here it is
// in full: the structure, the method, each year and what made it up, and whether
// the company is profitable.
export function selfEmployedParagraph(name: string, f: SelfEmployedFacts): string {
  if (!f.hasFigures) {
    return `${name} is self-employed${f.business ? ` through ${f.business}` : ''}, and no income figures `
         + `have been recorded against that income yet. This must be completed before the file is assessed.`
  }

  const who = `${name} is self-employed${f.business ? ` through ${f.business}` : ''}`
    + `${f.structure ? `, a ${f.structure.toLowerCase()} structure` : ''}.`

  if (f.method === "Director's salary") {
    return `${who} Income has been assessed at ${money(f.assessed)} per annum, being the director's salary`
         + `${f.directorSalary ? ` of ${f.directorSalary}` : ''}.`
         + profitLine(f) + verifyLine(f)
  }

  const growing = f.growingYearOnYear
    ? ' The business is growing and performing well year on year.' : ''

  const yearBits = f.years.filter(y => y.total > 0).map(y => {
    const made = [y.netProfit && `net profit ${y.netProfit}`, y.salary && `salary ${y.salary}`]
      .filter(Boolean).join(' and ')
    const backs = y.addBacks.length
      ? `, plus add-backs of ${y.addBacks.map(a => `${a.amount} ${a.label}`).join(', ')}`
      : ''
    return `FY${y.fy} of ${money(y.total)}${made ? ` (${made}${backs})` : ''}`
  })

  return `${who}${growing} Income has been assessed at ${money(f.assessed)} per annum, being ${f.methodWords} — `
       + `${yearBits.join(' and ')}.` + profitLine(f) + verifyLine(f)
}

function profitLine(f: SelfEmployedFacts): string {
  if (f.profitable === 'Yes') return ' The business is currently profitable.'
  if (f.profitable === 'No') return ' The business is not currently profitable, which has been taken into account in the assessment.'
  return ''
}

// What has been obtained, which is not the same as what was quoted - two years
// are on file for every method that looks at two, even when the note only
// describes the one the figure came from.
function verifyLine(f: SelfEmployedFacts): string {
  if (f.method === "Director's salary") return ' Payslips and an ATO income statement have been obtained to verify this position.'
  if (f.method === 'One year in isolation') return ' One year of tax returns and financial statements has been obtained to verify this position.'
  return ' Two years of tax returns and financial statements have been obtained to verify this position.'
}

// EVERY SELF-EMPLOYED INCOME ON A DEAL, ALREADY WRITTEN OUT.
//
// Composed, never generated. The compliance boxes are otherwise written by a
// model from a prompt, and a model asked to describe an income assessment will
// paraphrase a figure sooner or later. This paragraph is assembled from the
// recorded fields and dropped into the box verbatim, so what an auditor reads
// and what the fact find holds cannot come apart.
export function selfEmployedParagraphsFor(deal: any): string[] {
  const applicants = deal?.fact_find_data?.applicants || []
  const out: string[] = []
  for (const a of applicants) {
    const name = [a?.firstName, a?.lastName].map((x: any) => txt(x)).filter(Boolean).join(' ') || 'The applicant'
    for (const inc of (a?.income || [])) {
      if (incomeKind(inc) !== 'self-employed') continue
      const employment = (a?.employment || []).find((e: any) => e?.id === inc?.employmentId)
        || (a?.employment || []).find((e: any) => txt(e?.employmentType) === 'Self-employed')
      out.push(selfEmployedParagraph(name, selfEmployedFacts(inc, employment)))
    }
  }
  return out
}
