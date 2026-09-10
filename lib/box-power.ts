import { money, readMoney } from './money'
import { dealRow, splitsOf } from './deal-structure'
import { applicantsOf } from './applicants'
import { annualIncomeOfApplicant } from './income-calculations'
import { currentEmployment, notWorking, selfEmployed } from './fact-find'
import { variantOf, andList, type Gap } from './box-one'

// BOX SIX — BORROWING POWER.
//
// What the clients have to repay this loan with: what they earn and how, what
// they owe, what they hold, and the LVR.
//
// TWO THINGS ARE NEVER IN THIS BOX, and it is not an oversight.
//
// Maximum borrowing capacity and debt-to-income ratio are not recorded anywhere
// in this portal. Fabio, 3 Sep 2026: "it's never gonna be present, so I don't
// want that to be part of the compliance notes." So they are not stated, not
// estimated, and their absence is not noted either - a box that says "maximum
// capacity has not been recorded" on every deal forever is worse than one that
// simply does not raise it.
//
// Living expenses are out too. Fabio, 10 Sep 2026: "don't mention living
// expenses. I don't want to mention the figure because that will be changed from
// time to time."
//
// SERVICING IS A FACT ABOUT THE PROCESS, NOT A CLAIM ABOUT THE NUMBERS.
//
// Fabio, 10 Sep 2026: "we would NEVER suggest a lender that doesn't service ...
// deal services as per lender calculator, fits its parameters in DTI and surplus
// funding including all buffers."
//
// That is what makes this sayable. Because a lender is never recommended unless
// the product services on their calculator, the fact that it services is true by
// construction on every deal - so it is stated plainly, with no figure behind it
// and nothing estimated.
//
// It says the DTI PARAMETERS are met. It does not say what the ratio is: ours
// would be built from gross income and recorded balances, and every lender
// shades income and counts card limits differently, so a number here would be
// compared against theirs and found not to match.
//
// AND NO JUDGEMENTS. Not robust, strong, comfortable, excellent or well within -
// an assessor asks what those are measured against and there is no answer.

const txt = (v: any) => String(v ?? '').trim()
const shout = (s: string) => `** ${s} **`
const num = (v: any) => readMoney(v) ?? 0

export type Box = { text: string; gaps: Gap[]; variant: 1 | 2 | 3 }

const first = (name: string) => name.split(' ')[0]

// A OR AN, for an occupation typed by a person.
const article = (w: string) => /^[aeiou]/i.test(w.trim()) ? 'an' : 'a'

// WHAT EACH APPLICANT EARNS AND HOW.
//
// Not working is a fact and is stated as one. Fabio, 3 Sep 2026 - it was being
// treated as a missing answer and shouted about on every single-income deal.
export function incomeLines(deal: any): { parts: string[]; gaps: Gap[] } {
  const parts: string[] = []
  const gaps: Gap[] = []
  const ff = deal?.fact_find_data || {}
  const byName: Record<string, any> = {}
  for (const a of ff.applicants || []) byName[`${txt(a?.firstName)} ${txt(a?.lastName)}`.trim()] = a

  for (const app of applicantsOf(deal, deal?.bc_data || {})) {
    const who = first(app.name)
    const rec = byName[app.name]
    if (!rec) {
      parts.push(shout(`NOT RECORDED — no income has been recorded for ${who}.`))
      gaps.push({ what: `Income for ${who}`, where: 'Fact Find → Income' })
      continue
    }

    // currentEmployment() returns the CURRENT JOBS, an array, and notWorking()
    // judges ONE job. Passing the applicant to notWorking() made Rachel - who is
    // recorded as not working - come out as "employed" with her income shouted
    // about. Same pattern box four uses.
    const jobs = currentEmployment(rec)
    const idle = jobs.length > 0 && jobs.every((e: any) => notWorking(e))
    const job = jobs.find((e: any) => !notWorking(e))
    const occupation = txt(job?.occupation) || txt(jobs[0]?.occupation)
    const annual = annualIncomeOfApplicant(rec)

    if (idle) {
      // A real answer, not a gap.
      parts.push(occupation
        ? `${who} is not currently working, recorded as ${occupation.toLowerCase()}.`
        : `${who} is not currently working.`)
      continue
    }

    const how = selfEmployed(job) ? 'self-employed' : 'employed'
    const as = occupation ? ` as ${article(occupation)} ${occupation.toLowerCase()}` : ''
    if (annual > 0) {
      parts.push(`${who} is ${how}${as} and earns ${money(annual)} a year.`)
    } else {
      parts.push(`${who} is ${how}${as}. ${shout(`NOT RECORDED — the income for ${who}.`)}`)
      gaps.push({ what: `Income for ${who}`, where: 'Fact Find → Income' })
    }
  }
  return { parts, gaps }
}

// WHAT THEY OWE.
//
// A liability being cleared at settlement is a different fact from one that
// remains, and an assessor reads them differently - so they are separated.
export function liabilityLine(deal: any): string {
  const list = (deal?.fact_find_data?.liabilities || []).filter((l: any) => txt(l?.liabilityType) || num(l?.balance) > 0)
  if (list.length === 0) {
    // Box four already asks for disclosure on this. Here it is stated as a fact
    // about the position and left there.
    return 'No liabilities are recorded on the fact find.'
  }
  const going = list.filter((l: any) => /clos|consolidat|paid|refinanc/i.test(txt(l?.status)))
  const staying = list.filter((l: any) => !going.includes(l))

  const describe = (l: any) => {
    const kind = txt(l?.liabilityType).toLowerCase() || 'liability'
    const lender = txt(l?.lenderName)
    const bal = num(l?.balance)
    return `${article(kind)} ${kind}${lender ? ` with ${lender}` : ''}${bal > 0 ? ` of ${money(bal)}` : ''}`
  }

  const bits: string[] = []
  if (staying.length) bits.push(`The clients hold ${andList(staying.map(describe))}, which will remain.`)
  if (going.length) {
    // A sentence starts with a capital. describe() opens with "a"/"an".
    const list = andList(going.map(describe))
    bits.push(`${list.charAt(0).toUpperCase()}${list.slice(1)} ${going.length === 1 ? 'is' : 'are'} being cleared as part of this loan.`)
  }
  return bits.join(' ')
}

// WHAT THEY HOLD. Grouped by kind rather than listed one by one - seven rows of
// "Superannuation balance - Applicant 1" is a table, not a sentence.
// The asset types as the form stores them are singular labels for a dropdown -
// "Bank account", "Vehicle", "Super". In a sentence about a total they read
// wrong: "$2,170,000 in bank account". These are the words for a sum of them.
const ASSET_WORDS: Record<string, string> = {
  'Bank account': 'bank accounts',
  'Super': 'superannuation',
  'Vehicle': 'vehicles',
  'Shares': 'shares',
  'Investment property': 'investment property',
  'Other': 'other assets',
}
function assetWords(kind: string): string {
  if (ASSET_WORDS[kind]) return ASSET_WORDS[kind]
  const l = kind.toLowerCase()
  return /s$/.test(l) ? l : `${l}s`
}

export function assetLine(deal: any): string {
  const list = (deal?.fact_find_data?.assets || []).filter((a: any) => num(a?.value) > 0)
  if (list.length === 0) return ''
  const byKind: Record<string, number> = {}
  for (const a of list) {
    const kind = txt(a?.assetType) || 'other assets'
    byKind[kind] = (byKind[kind] || 0) + num(a.value)
  }
  const total = Object.values(byKind).reduce((t, v) => t + v, 0)
  const named = Object.entries(byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, v]) => `${money(v)} in ${assetWords(kind)}`)
  return `The applicants hold assets of ${money(total)}, made up of ${andList(named)}.`
}

// The lender's calculator, and what follows from a recommendation existing.
export function servicingLines(deal: any): { parts: string[]; gaps: Gap[] } {
  const lender = txt(dealRow(deal).lender)
  if (!lender) {
    return { parts: [shout('NOT RECORDED — which lender was recommended, so servicing cannot be stated.')],
             gaps: [{ what: 'Recommended lender', where: 'Lending options' }] }
  }
  return {
    parts: [
      `Servicing has been assessed on ${lender}'s own calculator, which applies their assessment rate and buffers.`,
      `The recommended product services on ${lender}'s calculator, so the deal sits within their debt to income parameters and returns a surplus after their buffers have been applied.`,
    ],
    gaps: [],
  }
}

// HOW THE LOAN IS PUT TOGETHER, from the splits on the deal structure block.
const TERM_WORDS: Record<string, string> = {
  '1': 'one', '5': 'five', '10': 'ten', '15': 'fifteen', '20': 'twenty',
  '25': 'twenty-five', '30': 'thirty', '35': 'thirty-five', '40': 'forty',
}
export function structureLine(deal: any): string {
  const splits = splitsOf(deal)
  const terms = [...new Set(splits.map(s => txt(s.termYears)).filter(Boolean))]
  const term = terms.length === 1 ? terms[0] : txt(deal?.bc_data?.loanTerm)
  const reps = [...new Set(splits.map(s => txt(s.repaymentType)).filter(Boolean))]

  const io = reps.some(r => /^io$|interest only/i.test(r))
  const pi = reps.some(r => /p&i|principal/i.test(r))
  const how = io && pi ? ' with interest only and principal and interest components'
    : io ? ' on interest only'
    : pi ? ' on principal and interest' : ''

  if (!term) return how ? `The loan has been structured${how}, as recorded on the deal structure.` : ''
  const words = TERM_WORDS[term] || term
  return `The loan has been structured over a ${words} year term${how}, as recorded on the deal structure.`
}

export function boxSix(deal: any): Box {
  const v = variantOf(deal?.id)
  const row = dealRow(deal)
  const ff = deal?.fact_find_data || {}
  const parts: string[] = []
  const gaps: Gap[] = []

  const inc = incomeLines(deal)
  parts.push(...inc.parts)
  gaps.push(...inc.gaps)

  parts.push(liabilityLine(deal))

  const assets = assetLine(deal)
  if (assets) parts.push(assets)

  // Small counts as words, the same as box four writes them.
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
  const deps = Number(txt(ff.dependants) || '0')
  if (Number.isFinite(deps) && deps > 0) {
    parts.push(deps === 1 ? 'There is one dependant.' : `There are ${WORDS[deps] ?? deps} dependants.`)
  }

  const serv = servicingLines(deal)
  parts.push(...serv.parts)
  gaps.push(...serv.gaps)

  if (row.lvr === null) {
    parts.push(shout(`NOT RECORDED — the loan to value ratio cannot be stated because ${row.lvrWhy || 'the figures behind it are incomplete'}.`))
    gaps.push({ what: 'Loan to value ratio', where: 'Deal structure' })
  } else {
    parts.push(v === 2
      ? `Total lending of ${money(row.totalLending)} represents a loan to value ratio of ${row.lvr}%.`
      : `The lending of ${money(row.totalLending)} is at a loan to value ratio of ${row.lvr}%.`)
  }

  const structure = structureLine(deal)
  if (structure) parts.push(structure)

  return { text: parts.filter(Boolean).join(' '), gaps, variant: v }
}
