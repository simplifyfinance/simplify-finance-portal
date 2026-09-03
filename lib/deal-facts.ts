// EVERYTHING WE ACTUALLY KNOW ABOUT THIS DEAL, IN WORDS.
//
// The compliance notes were written from seven numbers typed onto the BC, and
// the prompts asked the model to discuss ages, employment stability, liabilities
// and funds for completion - none of which it was ever given. Everything beyond
// those seven numbers was invention, because there was nothing else in the room.
//
// This is the room, filled. Read live from the fact find, never from a frozen
// copy, and written as plain sentences a person could check line by line.
//
// TWO RULES, AND THEY ARE THE WHOLE POINT:
//
// 1. NOTHING IS INVENTED, ESTIMATED OR ASSUMED. A figure nobody recorded is not
//    zero and not a typical value - it is absent, and it goes in `missing` by
//    name. Fabio, 3 Sep 2026: "I do not want to invent things ever."
//
// 2. NOTHING IS SUMMARISED AWAY. Income is listed by type, not totalled.
//    Liabilities are listed one by one. A split loan keeps its labels - an
//    owner-occupied refinance with an equity release for investment is two
//    facts, and flattening it to one number is why the notes never understood
//    the purpose.

import { currentAddress, currentEmployment, fullName, notWorking, selfEmployed, ageFrom } from './fact-find'
import { templateLabel } from './templates'
import { fundsToComplete, loanAmount, securityValue } from './funds-to-complete'
import { splitsOf, dealRow, purposeSummary, PURPOSE_LABEL } from './deal-structure'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const has = (v: any) => num(v) > 0
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-AU')

// A block of facts under a heading. Rendered into the prompt as-is.
export type FactSection = { title: string; lines: string[] }

export type DealFacts = {
  sections: FactSection[]
  // Named holes. These go to the model too, so it can say "not recorded"
  // instead of writing something plausible.
  missing: string[]
}

// --- the loan, and what it is FOR -------------------------------------------

// The complaint that started this. A three-split equity release arrived at the
// model as one number and the raw key "investment_equity", and it had to guess.
// The splits already carry labels - "Existing loan refinanced", "Equity access",
// "New purchase" - which is exactly "refinance OO debt and release equity for
// investment", written down and then thrown away by adding them up.
export function purposeLines(deal: any): string[] {
  const bc = deal?.bc_data || {}
  const out: string[] = []

  const label = templateLabel(bc.template)
  if (label) out.push(`Scenario: ${label}`)

  const ffPurpose = txt(deal?.fact_find_data?.loanPurpose)
  if (ffPurpose) out.push(`What the client said they want it for: ${ffPurpose}`)

  // EACH SPLIT'S PURPOSE, AS A PERSON RECORDED IT. Not sniffed from the label
  // and not inferred from the scenario name - answered on the LO, read here.
  const splits = splitsOf(deal).filter((s: any) => has(s?.amount))
  if (splits.length > 1) {
    out.push(`The loan is in ${splits.length} parts, and they are for different purposes:`)
    for (const s of splits) {
      const bits = [s.label || 'Unlabelled split', money(num(s.amount))]
      if (s.rate) bits.push(`${s.rate}% p.a.`)
      if (s.repaymentType) bits.push(s.repaymentType)
      if (s.termYears) bits.push(`${s.termYears} year term`)
      if (s.productType) bits.push(s.productType)
      bits.push(s.purpose ? PURPOSE_LABEL[s.purpose] : 'PURPOSE NOT RECORDED')
      out.push(`  - ${bits.join(', ')}`)
    }
    const r = dealRow(deal)
    if (r.ooTotal > 0 && r.invTotal > 0) {
      out.push(`Owner occupied ${money(r.ooTotal)}, investment ${money(r.invTotal)} — this deal is BOTH. Treat each part as what it is; do not describe the whole loan as one or the other.`)
    }
    if (r.unsetTotal > 0) {
      out.push(`${money(r.unsetTotal)} of the lending has no purpose recorded. Say so rather than assuming.`)
    }
  } else if (splits.length === 1) {
    const s = splits[0]
    const bits = [s.label || 'Loan', money(num(s.amount))]
    if (s.purpose) bits.push(PURPOSE_LABEL[s.purpose])
    out.push(bits.join(', '))
  }

  return out
}

// OWNER OCCUPIED, INVESTMENT, OR BOTH.
//
// This was decided everywhere by asking whether the scenario NAME contained the
// word "investment". So "refinance_equity" - an owner-occupied refinance whose
// released equity is very often going into an investment - was filed as Owner
// occupied, unconditionally, and a deal that is genuinely both could not be
// represented at all.
//
// Read from what the deal actually contains instead: the labels on the splits,
// the properties involved, and what is being bought.
export type DealPurpose = {
  ownerOccupied: boolean
  investment: boolean
  // 'Owner occupied' | 'Investment' | 'Both' | '' when nothing says either way.
  label: string
  // The single answer for screens that can only hold one. Investment wins when
  // both are true, because it is the stricter set of requirements.
  binary: 'Owner occupied' | 'Investment'
}

const OO_WORDS = /owner.?occup|\bOO\b|home loan|end debt|principal place/i
const INV_WORDS = /invest/i

export function dealPurpose(deal: any): DealPurpose {
  const bc = deal?.bc_data || {}
  let ownerOccupied = false
  let investment = false

  // What the broker called each part of the loan. The most direct evidence
  // there is, and it was being thrown away.
  for (const sp of bc.splits || []) {
    const label = txt(sp?.label)
    if (!label) continue
    if (INV_WORDS.test(label)) investment = true
    if (OO_WORDS.test(label)) ownerOccupied = true
  }

  // The property being bought.
  const buyingUse = txt(bc.propertyType) || txt(bc.newPurchasePropertyType)
  if (INV_WORDS.test(buyingUse)) investment = true
  else if (OO_WORDS.test(buyingUse)) ownerOccupied = true

  // Properties already held whose loans are part of this deal.
  for (const p of deal?.fact_find_data?.properties || []) {
    const involved = (p?.loans || []).some((l: any) =>
      ['To be refinanced', 'To be consolidated'].includes(txt(l?.status)))
    if (!involved) continue
    if (txt(p?.ownershipType) === 'Investment') investment = true
    if (txt(p?.ownershipType) === 'Owner occupied') ownerOccupied = true
  }

  // Last resort: the scenario name. Only when nothing above said anything, so
  // it can no longer overrule the deal's own contents.
  if (!ownerOccupied && !investment) {
    const t = txt(bc.template)
    if (INV_WORDS.test(t)) investment = true
    else if (t) ownerOccupied = true
  }

  const label = ownerOccupied && investment ? 'Both'
    : investment ? 'Investment'
    : ownerOccupied ? 'Owner occupied'
    : ''

  return { ownerOccupied, investment, label, binary: investment ? 'Investment' : 'Owner occupied' }
}

// --- who they are -----------------------------------------------------------

function applicantLines(a: any, i: number, ff: any, missing: string[]): string[] {
  const who = fullName(a) || `Applicant ${i + 1}`
  const out: string[] = [`${who}:`]

  const age = ageFrom(a?.dob)
  if (age !== null) out.push(`  Age ${age}`)
  else missing.push(`${who}'s date of birth is not recorded, so their age is unknown`)

  if (txt(a?.residencyStatus)) out.push(`  Residency: ${txt(a.residencyStatus)}`)

  const addr = currentAddress(a)
  const status = txt(addr?.residentialStatus)
  if (status) {
    const cost = has(addr?.housingExpenseAmount)
      ? `, ${money(num(addr.housingExpenseAmount))} ${txt(addr.housingExpenseFrequency).toLowerCase() || 'per week'}`
      : ''
    out.push(`  Currently ${status.toLowerCase()}${cost}`)
  }

  // Employment, one line per job, with the things a lender actually asks about.
  const jobs = currentEmployment(a)
  if (jobs.length === 0) {
    missing.push(`No current employment is recorded for ${who}`)
  }
  for (const e of jobs) {
    if (notWorking(e)) { out.push('  Not working'); continue }
    const bits: string[] = []
    if (selfEmployed(e)) {
      bits.push('Self-employed')
      if (txt(e?.selfEmployedStructure)) bits.push(txt(e.selfEmployedStructure).toLowerCase())
      else missing.push(`Nobody has recorded whether ${who} is a sole trader or a company`)
    } else {
      bits.push('PAYG')
      if (txt(e?.employmentBasis)) bits.push(txt(e.employmentBasis).toLowerCase())
    }
    if (txt(e?.occupation)) bits.push(`as ${txt(e.occupation)}`)
    if (txt(e?.employerName)) bits.push(`at ${txt(e.employerName)}`)
    const months = monthsSince(e?.startDate)
    if (months !== null) bits.push(months >= 24 ? `for ${Math.floor(months / 12)} years` : `for ${months} months`)
    if (e?.onProbation) bits.push('— ON PROBATION')
    out.push(`  ${bits.join(' ')}`)
  }

  // INCOME BY TYPE. The BC added all of this into one number before the model
  // ever saw it, so bonus, commission and overtime were invisible.
  const inc = incomeLines(a)
  if (inc.length > 0) out.push('  Income:', ...inc.map(l => `    ${l}`))
  else missing.push(`No income is recorded for ${who}`)

  return out
}

function incomeLines(a: any): string[] {
  const out: string[] = []
  for (const inc of a?.income || []) {
    const each = (amount: any, freq: any, label: string) => {
      if (!has(amount)) return
      out.push(`${label}: ${money(num(amount))} ${txt(freq).toLowerCase() || 'annually'}`)
    }
    each(inc?.grossSalary, inc?.grossSalaryFrequency, 'Gross salary')
    each(inc?.bonusAmount, inc?.bonusFrequency, 'Bonus')
    each(inc?.commissionAmount, inc?.commissionFrequency, 'Commission')
    each(inc?.overtimeEssentialAmount, inc?.overtimeEssentialFrequency, 'Overtime (essential)')
    each(inc?.overtimeNonEssentialAmount, inc?.overtimeNonEssentialFrequency, 'Overtime (non-essential)')
    each(inc?.allowanceAmount, inc?.allowanceFrequency, 'Allowances')

    if (txt(inc?.seBusinessName) || has(inc?.seYear1NetProfit)) {
      const bits = [`Self-employed${txt(inc?.seBusinessName) ? ` — ${txt(inc.seBusinessName)}` : ''}`]
      if (txt(inc?.seAssessmentMethod)) bits.push(`assessed on ${txt(inc.seAssessmentMethod).toLowerCase()}`)
      out.push(bits.join(', '))
      for (const y of ['seYear1', 'seYear2'] as const) {
        const fy = txt(inc?.[`${y}FY`])
        const profit = inc?.[`${y}NetProfit`]
        if (has(profit)) out.push(`  ${fy || y}: net profit ${money(num(profit))}`)
      }
      each(inc?.seDirectorSalary, inc?.seDirectorSalaryFrequency, "  Director's salary")
    }

    if (has(inc?.otherIncomeAmount)) {
      out.push(`${txt(inc?.otherIncomeType) || 'Other income'}: ${money(num(inc.otherIncomeAmount))} annually`)
    }
  }
  return out
}

function monthsSince(start: any): number | null {
  const s = txt(start)
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  return m >= 0 ? m : null
}

// --- what they owe and own --------------------------------------------------

function liabilityLines(ff: any): string[] {
  const out: string[] = []
  for (const l of ff?.liabilities || []) {
    const kind = txt(l?.liabilityType) || 'Liability'
    const bits = [kind]
    if (txt(l?.lenderName)) bits.push(`with ${txt(l.lenderName)}`)
    if (has(l?.limitAmount)) bits.push(`limit ${money(num(l.limitAmount))}`)
    if (has(l?.balance)) bits.push(`balance ${money(num(l.balance))}`)
    if (has(l?.repaymentAmount)) {
      bits.push(`repayment ${money(num(l.repaymentAmount))} ${txt(l?.repaymentFrequency).toLowerCase() || 'monthly'}`)
    }
    // The status is the compliance point: a card being closed changes the
    // assessment, and it was never once mentioned to the model.
    if (txt(l?.status)) bits[bits.length - 1] += ` — ${txt(l.status).toLowerCase()}`
    out.push(bits.join(', '))
  }
  return out
}

function propertyLines(ff: any): string[] {
  const out: string[] = []
  for (const p of ff?.properties || []) {
    const bits = [txt(p?.address) || 'Property']
    if (txt(p?.propertySubtype)) bits.push(txt(p.propertySubtype).toLowerCase())
    if (txt(p?.ownershipType)) bits.push(txt(p.ownershipType).toLowerCase())
    if (has(p?.value)) bits.push(`valued ${money(num(p.value))}`)
    if (has(p?.rentalIncome)) {
      bits.push(`rent ${money(num(p.rentalIncome))} ${txt(p?.rentalIncomeFrequency).toLowerCase() || 'weekly'}`)
    }
    out.push(bits.join(', '))
    for (const loan of p?.loans || []) {
      const lb = ['  Loan']
      if (txt(loan?.lenderName)) lb.push(`with ${txt(loan.lenderName)}`)
      if (has(loan?.balance)) lb.push(`balance ${money(num(loan.balance))}`)
      if (has(loan?.limitAmount)) lb.push(`limit ${money(num(loan.limitAmount))}`)
      if (txt(loan?.repaymentType)) lb.push(txt(loan.repaymentType))
      if (txt(loan?.status)) lb[lb.length - 1] += ` — ${txt(loan.status).toLowerCase()}`
      out.push(lb.join(', '))
    }
  }
  return out
}

function assetLines(ff: any): string[] {
  return (ff?.assets || [])
    .filter((a: any) => has(a?.value) || txt(a?.description))
    .map((a: any) => {
      const bits = [txt(a?.assetType) || 'Asset']
      if (txt(a?.description)) bits.push(txt(a.description))
      if (has(a?.value)) bits.push(money(num(a.value)))
      return bits.join(' — ')
    })
}

// --- the build --------------------------------------------------------------

export function dealFacts(deal: any): DealFacts {
  const ff = deal?.fact_find_data || {}
  const bc = deal?.bc_data || {}
  const lo = deal?.lo_data || {}
  const sections: FactSection[] = []
  const missing: string[] = []

  // The loan and its purpose first, because it frames everything else.
  const purpose = purposeLines(deal)
  const loan = loanAmount(deal)
  const loanLines = [...purpose]
  if (loan > 0) loanLines.push(`Total lending: ${money(loan)}`)
  const recorded = purposeSummary(deal)
  if (recorded) loanLines.push(`Purpose: ${recorded}`)

  const sec = securityValue(deal)
  if (sec.lvr !== null) {
    loanLines.push(sec.count > 1
      ? `LVR: ${sec.lvr}% across ${sec.count} securities totalling ${money(sec.total)}`
      : `LVR: ${sec.lvr}%`)
  } else {
    missing.push(`LVR cannot be worked out — ${sec.why}`)
  }
  if (txt(lo?.recommendedLender)) loanLines.push(`Recommended lender: ${txt(lo.recommendedLender)}`)
  if (loanLines.length) sections.push({ title: 'THE LOAN', lines: loanLines })

  // People.
  const applicants = ff.applicants || []
  if (applicants.length === 0) missing.push('No applicants are recorded on the fact find')
  const people: string[] = []
  for (const [i, a] of applicants.entries()) people.push(...applicantLines(a, i, ff, missing))
  if (txt(ff.dependants)) people.push(`Dependants: ${txt(ff.dependants)}`)
  else missing.push('The number of dependants is not recorded')
  if (people.length) sections.push({ title: 'THE APPLICANTS', lines: people })

  const liabs = liabilityLines(ff)
  sections.push({
    title: 'LIABILITIES',
    lines: liabs.length ? liabs : ['None recorded on the fact find.'],
  })

  const props = propertyLines(ff)
  if (props.length) sections.push({ title: 'PROPERTIES HELD', lines: props })

  const assets = assetLines(ff)
  if (assets.length) sections.push({ title: 'ASSETS', lines: assets })

  // Living expenses. Entered in three separate places in this portal and shown
  // to the model in none of them.
  const exp = expenseLines(deal)
  if (exp.length) sections.push({ title: 'LIVING EXPENSES', lines: exp })
  else missing.push('No living expenses have been recorded')

  // Purchase price + stamp duty, less deposit and loan. Nothing else, and
  // nothing at all on a refinance - there is no completion to fund.
  const funds = fundsToComplete(deal)
  if (funds.applies) {
    const lines = funds.lines.map(l => `${l.kind === 'cost' ? '+' : '−'} ${l.label}: ${money(l.amount)}`)
    // No total while a mixed deal's splits are unanswered - see purchaseLoan().
    if (funds.workable) {
      lines.push(funds.toFind > 0
        ? `= Funds to complete: ${money(funds.toFind)}`
        : '= Funds to complete: nil')
    }
    // Capitalised, so it is stated but kept out of the sum - otherwise the
    // notes would describe money the client has to find that they do not.
    for (const c of funds.capitalised) {
      lines.push(`${c.label}: ${money(c.amount)} — capitalised onto the loan, not part of the funds to complete`)
    }
    sections.push({ title: 'FUNDS TO COMPLETE', lines })
    missing.push(...funds.missing)
  }

  // ANYTHING A PERSON WROTE, FIRST. The goals boxes on the front page of the
  // fact find are where the broker writes their own summary of the deal, so it
  // frames everything below rather than trailing after it as an afterthought.
  // Passed through word for word - never paraphrased, never summarised.
  const notes: string[] = []
  if (txt(ff.goals2Years)) notes.push(`Goals, next 2 years: ${txt(ff.goals2Years)}`)
  if (txt(ff.goals10Years)) notes.push(`Goals, next 10 years: ${txt(ff.goals10Years)}`)
  if (txt(bc.brokerNotes)) notes.push(`Broker notes: ${txt(bc.brokerNotes)}`)
  if (txt(lo.recommendationNote)) notes.push(`Why this lender: ${txt(lo.recommendationNote)}`)
  if (notes.length) {
    sections.unshift({ title: 'IN THE BROKER’S OWN WORDS — use these, they are a person’s summary of this deal', lines: notes })
  } else {
    missing.push('The broker has not written a summary in the goals boxes on the fact find')
  }

  return { sections, missing }
}

function expenseLines(deal: any): string[] {
  const exp = deal?.compliance_data?.expenses || {}
  const out: string[] = []
  let total = 0
  for (const [key, entry] of Object.entries(exp as Record<string, any>)) {
    if (!has(entry?.monthlyAmount)) continue
    const amount = num(entry.monthlyAmount)
    total += amount
    out.push(`${key}: ${money(amount)} monthly`)
  }
  if (out.length) out.push(`Total declared: ${money(total)} monthly`)
  return out
}

// What actually goes into the prompt. Facts first, then the holes named out
// loud - so the model can write "not recorded" rather than something plausible.
export function factsBlock(facts: DealFacts): string {
  const body = facts.sections
    .map(s => `${s.title}\n${s.lines.join('\n')}`)
    .join('\n\n')

  if (facts.missing.length === 0) return body

  return `${body}\n\nNOT RECORDED — these are genuinely unknown. Say so plainly if a field calls for them. Do not estimate, assume, or write around them:\n${
    facts.missing.map(m => `- ${m}`).join('\n')}`
}
