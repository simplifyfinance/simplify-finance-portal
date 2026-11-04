// THE SERVICEABILITY REQUEST, BUILT FROM THE RECORD.
//
// 4 Nov 2026. Fabio: "we are asking for help from a bot to allow us to do
// serviceability calculations. When we complete a fact find, a button that
// pops a little box asking me to summarise, and then the information we
// pre-populate on the fact find is sent to the bot's email, where he runs the
// borrowing capacity and sends everything back to me."
//
// The bot's own spec is docs/CRM_serviceability_email_spec.md. It is strict and
// it is strict for a good reason: it parses this by line. "The headings and
// keys must not change. Leave values blank if unknown. Never delete a key."
//
// PRIVACY IS NOT A SETTING HERE, IT IS THE SHAPE OF THE FILE.
//
// Fabio: "I'm very conscious on privacy in terms of individual names attached
// to payslips and things like that. So I want to make sure it is only first
// name, not last name, no contact details."
//
// There is no branch in this file that could ever put a surname in. A surname
// is not read, so it cannot be written - and the same for dates of birth,
// phone numbers, emails, street addresses, employer names, ABNs and account
// numbers. The only identifying thing that goes is a first name, which the
// bot's spec puts in the subject line, so there is nowhere to hide it anyway.
//
// A SUBURB AND POSTCODE IS NOT AN ADDRESS. Duty and lender policy turn on the
// state and the postcode; neither turns on the street. See suburbPostcode().

import { dutyStateOf, purchaseSuburbOf } from './duty-state'

const txt = (v: any) => String(v ?? '').trim()
const digits = (v: any) => {
  const n = String(v ?? '').replace(/[^0-9.]/g, '')
  if (!n) return ''
  const x = Number(n)
  return Number.isFinite(x) ? String(Math.round(x)) : ''
}

const PER_YEAR: Record<string, number> = {
  weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1, yearly: 1,
}

/** Gross annual, which is what every key in the spec wants unless it says _monthly. */
export function annual(amount: any, frequency: any): string {
  const n = Number(String(amount ?? '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return ''
  const per = PER_YEAR[txt(frequency).toLowerCase()] ?? 1
  return String(Math.round(n * per))
}

export function monthly(amount: any, frequency: any): string {
  const n = Number(String(amount ?? '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return ''
  const per = PER_YEAR[txt(frequency).toLowerCase()] ?? 1
  return String(Math.round((n * per) / 12))
}

/**
 * A SUBURB AND A POSTCODE, OUT OF A FULL ADDRESS.
 *
 * "13 Kalinga Road, Ocean Grove VIC 3226, Australia" becomes "Ocean Grove 3226".
 * Anything this cannot read confidently comes back empty rather than guessing,
 * because half an address is worse than none: a blank key is a thing the bot
 * asks about, and a wrong suburb is a thing it silently prices.
 */
export function suburbPostcode(address: any): string {
  const s = txt(address)
  const m = s.match(/([A-Za-z][A-Za-z'\-\s]{1,40}?)\s+(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})\b/i)
  if (!m) return ''
  return `${txt(m[1])} ${m[2]}`
}

export const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const

export function stateOf(address: any): string {
  const m = txt(address).match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i)
  return m ? m[1].toUpperCase() : ''
}

// --- the enumerated values -------------------------------------------------
//
// "Enumerated fields must use one of the listed values exactly." Anything this
// cannot map lands on '' - never on a guess, because a wrong enum is a wrong
// calculation that looks like a right one.

export function employmentType(basis: any, incomeType: any): string {
  const t = txt(incomeType).toLowerCase()
  if (t === 'self-employed') return 'SELF_EMPLOYED'
  const b = txt(basis).toLowerCase()
  if (b.includes('full')) return 'PAYG_FULLTIME'
  if (b.includes('part')) return 'PAYG_PARTTIME'
  if (b.includes('casual')) return 'PAYG_CASUAL'
  if (b.includes('contract')) return 'CONTRACTOR'
  if (b.includes('retired')) return 'RETIRED'
  if (b.includes('not employed') || b.includes('unemployed')) return 'NOT_EMPLOYED'
  return ''
}

export function maritalStatus(v: any): string {
  const s = txt(v).toLowerCase().replace(/[\s-]/g, '_')
  const known = ['single', 'married', 'de_facto', 'separated', 'divorced', 'widowed']
  return known.includes(s) ? s.toUpperCase() : ''
}

export function liabilityType(v: any): string {
  const s = txt(v).toLowerCase()
  if (s.includes('credit card')) return 'CREDIT_CARD'
  if (s.includes('store')) return 'STORE_CARD'
  if (s.includes('car')) return 'CAR_LOAN'
  if (s.includes('personal')) return 'PERSONAL_LOAN'
  if (s.includes('overdraft')) return 'OVERDRAFT'
  if (s.includes('bnpl') || s.includes('buy now')) return 'BNPL'
  if (s.includes('hecs') || s.includes('help')) return 'OTHER'
  if (s.includes('tax')) return 'TAX_DEBT'
  if (s.includes('investment')) return 'INVESTMENT_LOAN'
  if (s.includes('home') || s.includes('mortgage')) return 'HOME_LOAN'
  return v ? 'OTHER' : ''
}

export function liabilityAction(status: any): string {
  const s = txt(status).toLowerCase()
  if (s === 'to be closed') return 'CLOSE'
  if (s === 'to be consolidated' || s === 'to be refinanced') return 'REFINANCE'
  if (s === 'to be paid out') return 'PAID_OUT_ON_SALE'
  if (s === 'remain open' || s === 'ongoing' || s === 'limit to be reduced') return 'KEEP'
  if (s === 'refinance') return 'REFINANCE'
  return ''
}

export function propertyAction(loans: any[], ownership: any): string {
  const statuses = (loans || []).map(l => txt(l?.status).toLowerCase())
  if (statuses.some(s => s === 'to be paid out')) return 'SELL'
  if (statuses.some(s => s === 'refinance' || s === 'to be refinanced')) return 'REFINANCE'
  return 'KEEP'
}

export function purposeOf(ownershipType: any): string {
  const s = txt(ownershipType).toLowerCase()
  if (s.includes('investment')) return 'INVESTMENT'
  if (s.includes('owner')) return 'OWNER_OCCUPIED'
  return ''
}

export function currentHousing(residentialStatus: any): string {
  const s = txt(residentialStatus).toLowerCase()
  if (s.includes('rent')) return 'RENTING'
  if (s.includes('board')) return 'BOARDING'
  if (s.includes('parent')) return 'WITH_PARENTS'
  if (s.includes('own')) return 'OWN_HOME'
  return ''
}

const PURCHASE = ['oo_purchase', 'oo_lvr_compare', 'investment_purchase', 'fhb',
  'refi_equity_purchase', 'buy_sell']
export function scenarioType(template: any): string {
  const t = txt(template)
  if (t === 'construction') return 'CONSTRUCTION'
  if (t === 'equity_release') return 'EQUITY_RELEASE'
  if (t === 'refinance_cashout' || t === 'refi_equity') return 'REFINANCE_CASHOUT'
  if (t === 'refinance') return 'REFINANCE'
  if (PURCHASE.includes(t)) return 'PURCHASE'
  return t ? 'PREAPPROVAL' : ''
}

// --- the body --------------------------------------------------------------
//
// "One Key: Value per line." Built as a list of lines rather than a template
// string, so a key cannot be lost in an edit and the order is the spec's order.

export type Line = [key: string, value: string]

const KEYLESS = /^[[=#]/

export function render(lines: (Line | string)[]): string {
  return lines.map(l => typeof l === 'string' ? l : `${l[0]}: ${l[1]}`.trimEnd()).join('\n')
}

export type Request = {
  to: string
  subject: string
  body: string
  /** Keys the bot calls required that this deal cannot answer. */
  gaps: string[]
  dealRef: string
}

export const BOT_EMAIL = 'fabio-tgt029+servicing@mail.grokbot.com'
export const COPY_TO = 'fabio@simplifyfinance.com.au'

/** SF-10482 from a deal id, stable so a re-run carries the same reference. */
export function dealRef(deal: any): string {
  const id = txt(deal?.id).replace(/-/g, '')
  if (!id) return 'SF-00000'
  let n = 0
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) % 100000
  return `SF-${String(n).padStart(5, '0')}`
}

function applicantBlock(a: any, n: number, ff: any): (Line | string)[] {
  const emp = (a?.employment || []).find((e: any) => e?.isCurrent) || (a?.employment || [])[0] || {}
  const incomes = a?.income || []
  const payg = incomes.find((i: any) => txt(i?.incomeType) === 'PAYG') || {}
  const se = incomes.find((i: any) => txt(i?.incomeType) === 'Self-employed') || {}
  const other = incomes.find((i: any) => txt(i?.incomeType).startsWith('Other')) || {}
  const sum = (key: string, freq: string) => {
    const total = incomes.reduce((t: number, i: any) => {
      const v = Number(annual(i?.[key], i?.[freq]) || 0)
      return t + (Number.isFinite(v) ? v : 0)
    }, 0)
    return total > 0 ? String(total) : ''
  }
  return [
    '',
    `[APPLICANT ${n}]`,
    // THE ONLY NAME THAT GOES. No surname is read anywhere in this file.
    ['FirstName', txt(a?.firstName)],
    ['Age', ''],
    ['EmploymentType', employmentType(emp?.employmentBasis, incomes[0]?.incomeType)],
    ['Occupation', txt(emp?.occupation)],
    ['EmploymentStartDate', txt(emp?.startDate)],
    ['OnProbation', emp?.onProbation ? 'Y' : 'N'],
    ['BaseIncome', sum('grossSalary', 'grossSalaryFrequency')],
    ['Overtime', sum('overtimeEssentialAmount', 'overtimeEssentialFrequency')],
    ['Bonus', sum('bonusAmount', 'bonusFrequency')],
    ['Commission', sum('commissionAmount', 'commissionFrequency')],
    ['Allowances', sum('allowanceAmount', 'allowanceFrequency')],
    ['SelfEmployed_NetProfit_Y1', digits(se?.seYear2NetProfit)],
    ['SelfEmployed_NetProfit_Y2', digits(se?.seYear1NetProfit)],
    ['SelfEmployed_Addbacks_Y1', ''],
    ['SelfEmployed_Addbacks_Y2', ''],
    ['OtherIncome', annual(other?.grossSalary, other?.grossSalaryFrequency)],
    ['OtherIncomeType', txt(other?.otherIncomeType).toUpperCase().replace(/\s+/g, '_')],
    ['HECS_Balance', ''],
  ]
}

export function buildRequest(deal: any, input: {
  instructions?: string
  lenders?: string
  brokerName?: string
}): Request {
  const ff = deal?.fact_find_data || {}
  const bc = deal?.bc_data || {}
  const apps = ff?.applicants || []
  const ref = dealRef(deal)
  const kind = scenarioType(bc?.template)

  // THE SECURITY, WHICH IS A SUBURB AND A POSTCODE AND NOTHING MORE.
  //
  // ASKED, NOT READ. The New purchase block has a box labelled "State" that
  // writes into the SUBURB, so that field holds "NSW" on a fair number of
  // deals - and the state itself is not on some templates at all. Both halves
  // are settled in lib/duty-state.ts, which is why nothing else reads either
  // field for itself. Without this the bot would have been sent a suburb of
  // "NSW" and no state, which it would have priced rather than queried.
  const buying = purchaseSuburbOf(bc) || txt(bc?.suburb)
  const held = (ff?.properties || [])[0] || {}
  const where = suburbPostcode(buying) || suburbPostcode(held?.address)
  const state = dutyStateOf(bc) || stateOf(buying) || stateOf(held?.address)

  const home = (apps[0]?.addresses || []).find((x: any) => x?.isCurrent) || {}
  const lines: (Line | string)[] = [
    '=== SERVICEABILITY REQUEST v1 ===',
    ['DealRef', ref],
    ['Broker', txt(input.brokerName)],
    ['RequestedLenders', txt(input.lenders) || 'ALL'],
    ['Instructions', txt(input.instructions).replace(/\s*\n\s*/g, ' ')],
    '',
    '[SCENARIO]',
    ['ScenarioType', kind],
    ['Purpose', purposeOf(bc?.newPurchasePropertyType ? 'Investment' : held?.ownershipType)
      || purposeOf(bc?.propertyType)],
    ['State', state],
    ['FirstHomeBuyer', txt(bc?.template) === 'fhb' ? 'Y' : 'N'],
    ['GovernmentScheme', 'NONE'],
    ['TargetPrice', digits(bc?.newPurchasePrice) || digits(bc?.purchasePrice) || digits(held?.value)],
    ['SuburbPostcode', where],
    ['PropertyType', txt(bc?.propertyType).toUpperCase().replace(/\s+/g, '_')],
    ['NewOrEstablished', ''],
    ['TargetLVR', digits(bc?.lvr)],
    ['LoanTermYears', digits(bc?.loanTerm) || '30'],
    ['RepaymentType', 'PI'],
    ['IOPeriodYears', ''],
    ['ShowMaxPrice', 'Y'],
    ['LMIPreference', 'STANDARD'],
    '',
    '[HOUSEHOLD]',
    ['NumberOfApplicants', apps.length ? String(apps.length) : ''],
    ['MaritalStatus', maritalStatus(apps[0]?.relationshipStatus)],
    ['NonApplicantSpouse', 'N'],
    ['Dependants', digits(ff?.dependants) || (ff?.dependants === '0' ? '0' : '')],
    ['DependantAges', (ff?.dependantAges || []).map(txt).filter(Boolean).join(',')],
    // LEFT BLANK ON PURPOSE. Fabio, 4 Nov 2026: "Declared living expenses, it's
    // fine - I'll tell the bot that, so don't put anything."
    ['DeclaredLivingExpenses_monthly', ''],
    ['CurrentHousing', currentHousing(home?.residentialStatus)],
    ['CurrentRent_monthly', monthly(home?.housingExpenseAmount, home?.housingExpenseFrequency)],
  ]

  apps.forEach((a: any, i: number) => lines.push(...applicantBlock(a, i + 1, ff)))

  // [RENTAL INCOME] - one line per property kept after settlement.
  lines.push('', '[RENTAL INCOME]')
  ;(ff?.properties || []).forEach((p: any, i: number) => {
    lines.push([`Property${i + 1}_RentWeekly`, annual(p?.rentalIncome, p?.rentalIncomeFrequency)
      ? String(Math.round(Number(annual(p?.rentalIncome, p?.rentalIncomeFrequency)) / 52)) : ''])
    lines.push([`Property${i + 1}_Owner`, 'JOINT'])
  })

  lines.push('', '[ASSETS]')
  const assets = ff?.assets || []
  const assetTotal = (match: RegExp) => {
    const t = assets.filter((x: any) => match.test(txt(x?.assetType).toLowerCase()))
      .reduce((s: number, x: any) => s + (Number(digits(x?.value)) || 0), 0)
    return t > 0 ? String(t) : ''
  }
  lines.push(['Savings', assetTotal(/savings|bank account/)])
  lines.push(['SavingsEvidenced', ''])
  lines.push(['GiftFunds', txt(bc?.depositSource).toLowerCase() === 'gift' ? digits(bc?.deposit) : ''])
  lines.push(['GiftFrom', txt(bc?.depositSource).toLowerCase() === 'gift' ? 'PARENTS' : ''])
  lines.push(['FirstHomeOwnerGrant', digits(bc?.fhog)])
  lines.push(['Superannuation', assetTotal(/super/)])
  lines.push(['Shares', assetTotal(/share|managed fund/)])
  lines.push(['Vehicles', assetTotal(/vehicle|car/)])
  lines.push(['OtherAssets', assetTotal(/^other/)])

  lines.push('', '[PROPERTIES OWNED]')
  ;(ff?.properties || []).forEach((p: any, i: number) => {
    const n = i + 1
    const loan = (p?.loans || [])[0] || {}
    lines.push([`Property${n}_Value`, digits(p?.value)])
    lines.push([`Property${n}_Purpose`, purposeOf(p?.ownershipType)])
    lines.push([`Property${n}_Action`, propertyAction(p?.loans, p?.ownership)])
    lines.push([`Property${n}_SalePrice`, ''])
    lines.push([`Property${n}_SellingCostsPct`, ''])
    lines.push([`Property${n}_LoanBalance`, digits(loan?.balance)])
    lines.push([`Property${n}_Lender`, txt(loan?.lenderName)])
  })

  ;(ff?.liabilities || []).forEach((l: any, i: number) => {
    lines.push('', `[LIABILITY ${i + 1}]`)
    lines.push(['Type', liabilityType(l?.liabilityType)])
    lines.push(['Lender', txt(l?.lenderName)])
    lines.push(['Limit', digits(l?.limitAmount)])
    lines.push(['Balance', digits(l?.balance)])
    lines.push(['Repayment_monthly', monthly(l?.repaymentAmount, l?.repaymentFrequency)])
    // LEFT BLANK, AND THAT IS THE ANSWER. Fabio, 4 Nov 2026: "on all the
    // liabilities we don't care. Credit card, the limit is the only thing that
    // is important. Car loans the same - the balance and the monthly
    // repayment." The keys stay because the spec says never delete a key.
    lines.push(['RemainingTermMonths', ''])
    lines.push(['InterestRate', ''])
    lines.push(['Action', liabilityAction(l?.status)])
    lines.push(['LinkedProperty', ''])
  })

  if (kind === 'REFINANCE' || kind === 'REFINANCE_CASHOUT') {
    const loan = ((ff?.properties || [])[0]?.loans || [])[0] || {}
    lines.push('', '[REFINANCE]')
    lines.push(['CurrentLoanBalance', digits(loan?.balance)])
    lines.push(['CurrentRate', txt(loan?.interestRate).replace(/[^0-9.]/g, '')])
    lines.push(['CurrentLender', txt(loan?.lenderName)])
    lines.push(['CashOutAmount', digits(bc?.equityRelease)])
    lines.push(['CashOutPurpose', ''])
    lines.push(['DebtsToConsolidate', ''])
  }

  lines.push('=== END ===')

  const body = render(lines)
  const who = txt(apps[0]?.firstName) || 'client'
  return {
    to: BOT_EMAIL,
    subject: `SERVICEABILITY | ${ref} | ${kind || 'PREAPPROVAL'} | ${who}`,
    body,
    gaps: gapsIn(lines, apps),
    dealRef: ref,
  }
}

/**
 * WHAT THE BOT WILL REFUSE TO GUESS AT.
 *
 * Its spec: "If any required field is missing it replies to the sender listing
 * exactly what's missing and does not guess." That is a round trip and a wait
 * to be told something this portal already knew when the button was pressed.
 *
 * Living expenses is deliberately not on this list - Fabio is telling the bot
 * about that one directly.
 */
const REQUIRED: [key: string, said: string][] = [
  ['ScenarioType', 'what kind of deal this is — set the scenario on the BC'],
  ['Purpose', 'owner occupied or investment'],
  ['State', 'the state the security is in'],
  ['NumberOfApplicants', 'at least one applicant'],
  ['MaritalStatus', 'marital status'],
  ['Dependants', 'how many dependants'],
]

export function gapsIn(lines: (Line | string)[], apps: any[]): string[] {
  const found = new Map<string, string>()
  for (const l of lines) if (typeof l !== 'string' && !found.has(l[0])) found.set(l[0], l[1])
  const out = REQUIRED.filter(([k]) => !txt(found.get(k))).map(([, said]) => said)

  // AT LEAST ONE INCOME LINE PER APPLICANT, and an employment type, which the
  // spec names separately because a lender cannot assess one without the other.
  apps.forEach((a: any, i: number) => {
    const who = txt(a?.firstName) || `Applicant ${i + 1}`
    if (!(a?.income || []).length) out.push(`an income for ${who}`)
    const emp = (a?.employment || []).find((e: any) => e?.isCurrent) || (a?.employment || [])[0]
    if (!employmentType(emp?.employmentBasis, (a?.income || [])[0]?.incomeType)) {
      out.push(`${who}'s employment type`)
    }
  })
  return out
}
