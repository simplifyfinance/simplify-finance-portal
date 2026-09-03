// THE NOTES THAT GO TO THE BANK.
//
// Every other box on the Compliance tab is between the broker, the client and
// our own compliance team. This one is not: it is copied into the lender's
// application portal and read by a credit assessor. Fabio, 3 Sep 2026: "this
// field is what goes to the lender... it needs to be very specific, it needs to
// be very structured."
//
// WHY THIS IS COMPOSED AND NOT GENERATED.
//
// The obvious build was a prompt with rules in it. That is the wrong tool here,
// for three reasons:
//
//   Every fact is already recorded. The employer name, the assessment method,
//   the financial year, the net profit, the add-backs, the stamp duty, the
//   intended retirement age and the repayment method are all fields somebody
//   has filled in. A model asked to write "$5,250,000" from a field containing
//   5,250,000 can only match it or spoil it.
//
//   The structure is fixed. Four paragraphs, fixed order, fixed content. That
//   is a template, and a template written as a template cannot drift.
//
//   It goes to a lender. A hallucinated employer name in an internal note is
//   embarrassing; in a submission to a bank it is a false statement made by a
//   licensed credit representative.
//
// So there is no model in this file. Every sentence below is assembled from a
// recorded value, and where a value is missing nothing is written at all - the
// caller is told what to go and fill in. Fabio, 3 Sep 2026, choosing that over
// leaving placeholders in the text: "refuse, and name what is missing."

import { money, readMoney } from './money'
import { fundsToComplete, loanAmount } from './funds-to-complete'
import { purposeSummary, splitsOf } from './deal-structure'
import { fullName, ageFrom, currentEmployment, selfEmployed, notWorking } from './fact-find'
import { annualIncomeOf, calculateSeAssessableIncome, seYearTotalFF } from './income-calculations'
import { incomeKind, incomeLabel } from './income-kind'

const txt = (v: any) => String(v ?? '').trim()

// A capital at the front and exactly one full stop at the back. These notes are
// read by a credit assessor, and "p.a.." is the kind of thing that makes a file
// look unchecked.
const sentence = (s: string): string => {
  const t = s.trim()
  if (!t) return ''
  const capped = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(capped) ? capped : capped + '.'
}
const has = (v: any) => (readMoney(v) ?? 0) > 0

export type NotesParagraph = { key: string; heading: string; lines: string[] }

// WHO THE ASSESSOR CALLS.
//
// The habit was to paste a block with everybody's name and number in it and let
// the bank's assessor pick out the right one. Fabio, 3 Sep 2026: "we're smarter
// than that. You know who the assessor is." We do - the deal records which
// credit assessor it is assigned to.
//
// It reads the ASSIGNED assessor, not whoever happens to be logged in. The
// broker generates these notes as often as the assessor does, and a submission
// telling a bank to ring the broker about a credit question is worse than the
// old block of names.
export type Assessor = { name: string; phone: string }

function contactLine(assessor: Assessor | null | undefined, missing: string[]): NotesParagraph | null {
  const name = txt(assessor?.name)
  const phone = txt(assessor?.phone)
  if (!name) { missing.push('No credit assessor is assigned to this deal, so the notes cannot say who to call'); return null }
  if (!phone) { missing.push(`No phone number is recorded for ${name} — add it in Settings, Credit team`); return null }
  // FABIO'S OWN WORDING, VERBATIM. This line has been pasted onto submissions
  // for years and the assessors on the other end know it on sight, so it is not
  // being improved into something nicer - the only change is that the portal
  // fills in the one name instead of listing the whole team for the bank to
  // sift. Fabio, 3 Sep 2026: "obviously whichever credit assessor in question".
  //
  // "Customer relationship manager" is what the LENDER is told. Internally the
  // same person is the credit assessor, which is what Settings calls them and
  // what the messages below say.
  return {
    key: 'contact', heading: '',
    lines: [`**** FOR ANY QUESTIONS RELATING TO THIS APPLICATION PLEASE CALL MY `
          + `CUSTOMER RELATIONSHIP MANAGER - ${name} ${phone} ****`],
  }
}

export type BrokerNotes = {
  paragraphs: NotesParagraph[]
  // What stops this being written. Empty means ready.
  missing: string[]
  ready: boolean
  text: string
}

// --- 1. the deal, in one sentence -------------------------------------------

const PURCHASE_TEMPLATES = ['oo_purchase', 'oo_lvr_compare', 'investment_purchase', 'fhb',
  'smsf', 'family_pledge', 'buy_sell', 'investment_equity']

function transaction(deal: any): { verb: string; isPurchase: boolean; isConstruction: boolean } {
  const t = txt(deal?.bc_data?.template)
  if (t === 'construction') return { verb: 'construct', isPurchase: true, isConstruction: true }
  if (t === 'refinance_only') return { verb: 'refinance', isPurchase: false, isConstruction: false }
  if (t === 'refinance_equity') return { verb: 'refinance and release equity against', isPurchase: false, isConstruction: false }
  if (t === 'bridging') return { verb: 'purchase', isPurchase: true, isConstruction: false }
  if (PURCHASE_TEMPLATES.includes(t)) return { verb: 'purchase', isPurchase: true, isConstruction: false }
  return { verb: '', isPurchase: has(deal?.bc_data?.purchasePrice), isConstruction: false }
}

function applicantsOf(deal: any): any[] {
  return (deal?.fact_find_data?.applicants || []).filter((a: any) => fullName(a))
}

function theDeal(deal: any, missing: string[]): NotesParagraph | null {
  const apps = applicantsOf(deal)
  const total = loanAmount(deal)
  const purpose = purposeSummary(deal)
  const { verb } = transaction(deal)
  const where = txt(deal?.bc_data?.suburb) || txt(deal?.bc_data?.newPurchaseSuburb)

  if (apps.length === 0) missing.push('No applicant is recorded on the fact find')
  if (total <= 0) missing.push('No loan amount is recorded')
  if (!purpose) missing.push('No split has a purpose recorded, so the notes cannot say whether this is owner occupied or investment')
  if (!verb) missing.push('The scenario on the BC does not say whether this is a purchase or a refinance')
  if (apps.length === 0 || total <= 0 || !purpose || !verb) return null

  const who = apps.length > 1 ? 'The applicants are' : 'The applicant is'
  // Hyphenated here rather than patched afterwards. purposeSummary() writes
  // "Owner occupied" for the portal, where it is a label; in a sentence going to
  // a bank it is a compound adjective.
  const kind = purpose === 'Owner occupied & investment' ? 'owner-occupied and investment'
    : purpose === 'Owner occupied' ? 'owner-occupied'
    : purpose.toLowerCase()
  const place = where ? ` in ${where}` : ''
  return {
    key: 'deal', heading: '',
    lines: [`${who} seeking finance of ${money(total)} to ${verb} an ${kind} property${place}.`],
  }
}

// --- 2. the income used ------------------------------------------------------

const FREQ_WORD: Record<string, string> = {
  Weekly: 'per week', Fortnightly: 'per fortnight', Monthly: 'per month', Annually: 'p.a.',
}

function paygLine(a: any, inc: any, emp: any): string {
  const bits: string[] = []
  const role = txt(emp?.occupation)
  const employer = txt(emp?.employerName)
  bits.push(`PAYG${role ? `, ${role}` : ''}${employer ? ` at ${employer}` : ''}`)

  const parts: string[] = []
  const add = (label: string, amount: any, freq: any) => {
    if (!has(amount)) return
    parts.push(`${label} ${money(amount)} ${FREQ_WORD[txt(freq) || 'Annually'] || 'p.a.'}`)
  }
  add('gross salary', inc?.grossSalary, inc?.grossSalaryFrequency)
  add('bonus', inc?.bonusAmount, inc?.bonusFrequency)
  add('essential overtime', inc?.overtimeEssentialAmount, inc?.overtimeEssentialFrequency)
  add('non-essential overtime', inc?.overtimeNonEssentialAmount, inc?.overtimeNonEssentialFrequency)
  add('commission', inc?.commissionAmount, inc?.commissionFrequency)
  add('allowances', inc?.allowanceAmount, inc?.allowanceFrequency)
  // "p.a.." reads as a typo to an assessor, and a sentence starting lowercase
  // reads as a broker who did not check their own submission.
  return `${bits.join('')}. ${sentence(parts.join(', '))}`
}

function selfEmployedLine(inc: any, emp: any): string {
  const structure = txt(emp?.selfEmployedStructure)
  const business = txt(inc?.seBusinessName) || txt(emp?.employerName)
  const method = txt(inc?.seAssessmentMethod)

  // The structure keeps the case it was picked with - "(Company)", not
  // "(company)" - because it is the name of a legal form.
  const head = `Self-employed${structure ? ` (${structure})` : ''}${business ? `, ${business}` : ''}.`

  if (method === "Director's salary") {
    const freq = FREQ_WORD[txt(inc?.seDirectorSalaryFrequency) || 'Annually'] || 'p.a.'
    return `${head} Assessed on director's salary of ${money(inc?.seDirectorSalary)} ${freq}.`
  }

  // Which year, and what is in it.
  const year = (nth: 1 | 2) => {
    const p = nth === 1 ? 'seYear1' : 'seYear2'
    const backs: string[] = []
    for (const [k, label] of [['Depreciation', 'depreciation'], ['Interest', 'interest'],
                              ['Super', 'superannuation'], ['OneOff', 'one-off expenses'], ['Other', 'other add-backs']]) {
      if (has(inc?.[`${p}${k}`])) backs.push(`${money(inc[`${p}${k}`])} ${label}`)
    }
    const bits: string[] = []
    if (has(inc?.[`${p}NetProfit`])) bits.push(`net profit ${money(inc[`${p}NetProfit`])}`)
    if (has(inc?.[`${p}Salary`])) bits.push(`salary ${money(inc[`${p}Salary`])}`)
    const core = bits.join(' and ')
    return `FY${txt(inc?.[`${p}FY`])}: ${core}${backs.length ? `, plus add-backs of ${backs.join(', ')}` : ''}`
        + ` — ${money(seYearTotalFF(inc, nth))}`
  }

  if (method === 'One year in isolation') {
    return `${head} Assessed on one year in isolation. ${year(1)}.`
  }

  const how = txt(inc?.seGrowthMethod)
  const howWords = how === 'latest_lower' ? 'the latest year, being lower than the previous year'
    : how === 'previous_plus_growth'
      ? `the previous year plus ${txt(inc?.seGrowthPercentOption) === 'Other' ? txt(inc?.seGrowthPercentCustom) : txt(inc?.seGrowthPercentOption)}% growth`
      : 'the average of the last two financial years'
  return `${head} Assessed on ${howWords}. ${year(1)}. ${year(2)}.`
}

function incomeUsed(deal: any, missing: string[]): NotesParagraph | null {
  const apps = applicantsOf(deal)
  if (apps.length === 0) return null

  const lines: string[] = []
  let total = 0

  for (const a of apps) {
    const name = fullName(a)
    const employments = currentEmployment(a)
    const incomes = (a?.income || [])

    if (employments.length && employments.every((e: any) => notWorking(e)) && incomes.length === 0) {
      lines.push(`${name} — not working. No income used.`)
      continue
    }
    if (incomes.length === 0) {
      missing.push(`${name} has no income recorded on the fact find`)
      continue
    }

    const parts: string[] = []
    for (const inc of incomes) {
      const emp = employments.find((e: any) => e?.id === inc?.employmentId) || employments[0] || {}
      // What the entry contains, never what it is labelled - see
      // lib/income-kind.ts. Chapman's fact find was AI-extracted, so every
      // income on it said "Base salary" and these notes refused to compose.
      const kind = incomeKind(inc)

      if (kind === 'payg') {
        if (!txt(emp?.employerName)) missing.push(`${name} has PAYG income with no employer recorded`)
        if (!has(inc?.grossSalary)) missing.push(`${name} has PAYG income with no gross salary recorded`)
        parts.push(paygLine(a, inc, emp))
      } else if (kind === 'self-employed') {
        if (!txt(inc?.seAssessmentMethod)) missing.push(`${name} has self-employed income with no assessment method chosen`)
        const assessed = calculateSeAssessableIncome(inc)
        if (Number.isNaN(assessed)) {
          missing.push(`${name}: the latest financial year is not lower than the previous one, so "latest year because lower" cannot be used — choose another method`)
        }
        parts.push(selfEmployedLine(inc, emp))
      } else if (kind === 'other') {
        parts.push(`${incomeLabel(inc)} of ${money(inc?.otherIncomeAmount)} p.a.`)
      } else if (txt(inc?.incomeType)) {
        // A row with a label and nothing in it. Somebody started it and stopped.
        missing.push(`${name} has ${txt(inc.incomeType).toLowerCase()} income recorded with no amount against it`)
      }
      total += annualIncomeOf(inc)
    }

    const used = (a?.income || []).reduce((t: number, i: any) => t + annualIncomeOf(i), 0)
    lines.push(`${name} — ${parts.join(' ')} Income used: ${money(Math.round(used))} p.a.`
      .replace(/\.\.+/g, '.').replace(/\s+/g, ' '))
  }

  // Rental income sits on the property that earns it, not on an applicant.
  const rent = (deal?.fact_find_data?.properties || [])
    .filter((p: any) => has(p?.rentalIncome))
  if (rent.length) {
    const annual = rent.reduce((t: number, p: any) => t + (readMoney(p.rentalIncome) ?? 0) * 52, 0)
    lines.push(`Rental income from ${rent.length} investment ${rent.length === 1 ? 'property' : 'properties'}: `
             + `${money(Math.round(annual))} p.a. (${rent.map((p: any) => `${money(p.rentalIncome)} per week`).join(', ')}).`)
    total += annual
  }

  if (lines.length === 0) return null
  lines.push(`Total income used: ${money(Math.round(total))} p.a.`)
  return { key: 'income', heading: 'INCOME USED', lines }
}

// --- 3. funds to complete ----------------------------------------------------

function fundsParagraph(deal: any, missing: string[]): NotesParagraph | null {
  const { isPurchase } = transaction(deal)
  if (!isPurchase) return null

  const f = fundsToComplete(deal)
  if (!f.applies) return null
  for (const m of f.missing) missing.push(m)
  if (!f.workable) return null

  const bc = deal?.bc_data || {}
  const lines = f.lines.filter(l => l.kind === 'cost').map(l => `${l.label}: ${money(l.amount)}`)

  const loan = f.lines.find(l => l.kind === 'source')
  if (loan) {
    // "with or without LMI" - Fabio was explicit that this has to be on the face
    // of it, because it changes the figure the assessor is checking.
    const lmi = has(bc.lmi)
      ? ` (including capitalised LMI of ${money(bc.lmi)})`
      : txt(bc.lmiApplicable).toLowerCase().startsWith('n') ? ' (no LMI applicable)' : ''
    lines.push(`${loan.label}: ${money(loan.amount)}${lmi}`)
  }

  // Where the money comes from. Fabio, 3 Sep 2026: "we just dictate where the
  // funds from." An assessor asks it every time, so saying it up front saves a
  // phone call.
  const source = txt(bc.depositSource) || txt(deal?.fact_find_data?.depositSource)
  const met = f.deposit !== null && f.depositAgrees
  lines.push(`Funds to complete: ${money(f.toFind)}`
    + (met ? `, met by the client's contribution${source ? ` from ${source.toLowerCase()}` : ''}` : ''))
  if (met && !source) missing.push('No deposit source is recorded, so the notes cannot say where the funds come from')
  if (f.deposit !== null && !f.depositAgrees) {
    missing.push(`The deposit recorded on the BC (${money(f.deposit)}) does not match the funds to complete (${money(f.toFind)})`)
  }
  return { key: 'funds', heading: 'FUNDS TO COMPLETE', lines }
}

// --- 4. retirement -----------------------------------------------------------

// Fabio, 3 Sep 2026: "if anyone is over fifty years old". At application, on the
// date the notes are written.
const RETIREMENT_AGE_TRIGGER = 50

function loanTermYears(deal: any): number | null {
  const fromSplit = splitsOf(deal).map(s => readMoney(s.termYears)).find(v => v && v > 0)
  return fromSplit || readMoney(deal?.bc_data?.loanTerm) || null
}

function retirement(deal: any, missing: string[], today: Date): NotesParagraph | null {
  const risks = deal?.compliance_data?.risks || {}
  const term = loanTermYears(deal)
  const lines: string[] = []

  for (const a of applicantsOf(deal)) {
    const name = fullName(a)
    const age = ageFrom(a?.dob, today)
    if (age === null || age < RETIREMENT_AGE_TRIGGER) continue

    const r = risks[name] || {}
    const intended = readMoney(r.retirementAge)
    const method = txt(r.repaymentMethod)

    if (!intended) { missing.push(`${name} is ${age} — an intended retirement age is needed on the Risks tab`); continue }
    if (!method) { missing.push(`${name} is ${age} — a repayment method is needed on the Risks tab`); continue }

    const atEnd = term ? ` The loan term of ${term} years ends when they are ${age + term}.` : ''
    lines.push(`${name} is ${age} and intends to retire at ${intended}.${atEnd} `
             + `Repayment beyond retirement is by ${method.toLowerCase()}.`)
  }

  if (lines.length === 0) return null
  return { key: 'retirement', heading: 'RETIREMENT', lines }
}

// --- the closing declaration -------------------------------------------------
//
// On every set of submission notes, last. Fabio, 3 Sep 2026: "can we add this
// sentence at the bottom of every submission note section?"
//
// It is a DECLARATION, not a fact read off the file - nothing in the portal
// records whether a conflict exists, so this states the normal case. On a deal
// where there IS one (a related party, a referral arrangement, a family member)
// the sentence has to be edited by hand, and the text sits in an editable box
// precisely so it can be.
const NO_CONFLICTS = 'There are no known conflicts of interest as part of this transaction.'

function declaration(): NotesParagraph {
  return { key: 'declaration', heading: '', lines: [NO_CONFLICTS] }
}

// --- the whole thing ---------------------------------------------------------

export function brokerNotes(deal: any, assessor?: Assessor | null, today = new Date()): BrokerNotes {
  const missing: string[] = []
  const paragraphs = [
    contactLine(assessor, missing),
    theDeal(deal, missing),
    incomeUsed(deal, missing),
    fundsParagraph(deal, missing),
    retirement(deal, missing, today),
    declaration(),
  ].filter(Boolean) as NotesParagraph[]

  // Deduplicated: a missing stamp duty is one problem however many paragraphs
  // trip over it.
  const gaps = [...new Set(missing)]
  // The declaration alone is not a set of notes. It is always present, so it
  // cannot be what makes this look finished.
  const ready = gaps.length === 0 && paragraphs.some(p => p.key !== 'declaration')

  return {
    paragraphs, missing: gaps, ready,
    text: ready ? render(paragraphs) : '',
  }
}

// Plain text. It is pasted into a bank's web form, which will not thank you for
// markdown, bullets or a non-breaking space.
function render(paragraphs: NotesParagraph[]): string {
  return paragraphs.map(p => (p.heading ? `${p.heading}\n` : '') + p.lines.join('\n')).join('\n\n')
}
