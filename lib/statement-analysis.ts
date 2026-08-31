import type { ParsedStatements, ParsedTxn } from './statement-parse'
import { grossFromNet, fysInPeriod, dominantFy } from './tax-au'
import {
  GOVERNMENT_PAYERS, SALARY_WORDS, DISHONOUR_WORDS,
  INTERNAL_TRANSFER_WORDS, normKey, matchesAny,
} from './statement-watchlists'
import { type StatementRules, DEFAULT_RULES, normaliseRules } from './statement-rules'

// Reads the parsed statements against the deal's fact find and produces the
// findings the Statements tab shows.
//
// Three rules run through the whole file:
//   1. Nothing here writes to the fact find. Every difference is a flag for a
//      person to answer, never an automatic correction.
//   2. A figure that cannot be worked out honestly is withheld with a reason.
//      No zeros standing in for "not supplied", no annualising one payment.
//   3. Every finding carries the ids of the transactions behind it, so the card
//      can show exactly what it was reading and nothing more.

export const ANALYSIS_VERSION = 1
export const DAY = 86400000

export type Flag = 'ok' | 'query' | 'action' | 'favourable' | 'unavailable'

const ms = (d: string) => Date.parse(d + 'T00:00:00Z')
const round2 = (n: number) => Math.round(n * 100) / 100
const daysBetween = (a: string, b: string) => Math.round((ms(b) - ms(a)) / DAY) + 1

export function annualiseFreq(amount: number, freq: string): number {
  const f = String(freq || '').toLowerCase()
  const mult = f.startsWith('week') ? 52 : f.startsWith('fortn') ? 26 : f.startsWith('month') ? 12
    : f.startsWith('quart') ? 4 : f.startsWith('half') ? 2 : 1
  return (Number(amount) || 0) * mult
}

// ---------------------------------------------------------------- grouping

export type Cadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'irregular' | 'once'

export function cadenceOf(dates: string[]): { kind: Cadence; meanDays: number; gaps: number[] } {
  const sorted = [...dates].sort()
  if (sorted.length < 2) return { kind: 'once', meanDays: 0, gaps: [] }
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) gaps.push(Math.round((ms(sorted[i]) - ms(sorted[i - 1])) / DAY))
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const kind: Cadence =
    mean >= 5 && mean <= 9 ? 'weekly' :
    mean >= 12 && mean <= 17 ? 'fortnightly' :
    mean >= 25 && mean <= 36 ? 'monthly' :
    mean >= 80 && mean <= 100 ? 'quarterly' : 'irregular'
  return { kind, meanDays: Math.round(mean * 10) / 10, gaps }
}

export type Group = {
  key: string
  payer: string
  txns: ParsedTxn[]
  total: number
  count: number
  dates: string[]
  cadence: Cadence
  meanDays: number
  gaps: number[]
  meanAmount: number
  variationPct: number   // how much the amount moves cycle to cycle
}

// Statement lines carry the plumbing as well as the payer: the account the money
// left, the words "transfer to", a receipt number. Stripping those is what turns
// "Savings - Transfer to AFG Home Loan - Receipt 862882" into "AFG Home Loan".
const NOISE_LEAD = /^\s*(?:transfer|payment|pmt|direct debit|dd|debit|credit|deposit|withdrawal|from|to)\b[\s:-]*/i
const CUT_AT = /\s[-–]?\s*(?:receipt|ref(?:erence)?|invoice|inv|trans(?:action)? id|card\s*x+\d*)\b.*$/i
// The mechanism is not the payer. "NOW FINANCE DIRECT DEBIT" is Now Finance.
const NOISE_TRAIL = /[\s-]+(?:direct debit|dd|repayment|payment|pmt|debit|autopay|auto pay|recurring|instal?lment)\s*$/i

export function cleanName(raw: string): string {
  let s = String(raw || '').trim()
  s = s.replace(CUT_AT, '')
  // "Savings - Transfer to AFG Home Loan": the part before the dash is the
  // client's own account, not the payer, so it goes once the rest is a transfer.
  const dash = s.split(/\s[-–]\s/)
  if (dash.length > 1 && NOISE_LEAD.test(dash[1])) s = dash.slice(1).join(' ')
  let prev = ''
  while (s !== prev) { prev = s; s = s.replace(NOISE_LEAD, '') }
  prev = ''
  while (s !== prev) { prev = s; s = s.replace(NOISE_TRAIL, '') }
  s = s.replace(/\b(?:x{2,}\d+|\d{5,})\b/g, ' ')
       .replace(/[^A-Za-z0-9&' ]+/g, ' ')
       .replace(/\s+/g, ' ')
       .trim()
  return s
}

// A payer key that survives reference numbers. "ACME LOGISTICS PAYROLL 88213" and
// "ACME LOGISTICS PAYROLL 88422" are one employer; the trailing number is not.
const GENERIC = new Set(['account','payment','transfer','deposit','credit','debit','withdrawal','purchase','direct','the','misc','other'])

// A cleaned name that comes back as one generic word tells a reviewer nothing.
// Better an ugly bank line than a card that says "payment".
export function displayName(raw: string, fallback: string): string {
  const c = cleanName(raw)
  const words = c.toLowerCase().split(/\s+/).filter(Boolean)
  if (!c || (words.length <= 1 && GENERIC.has(words[0] || ''))) return String(fallback || c || '').trim()
  return c
}

export function payerKey(t: ParsedTxn): string {
  const base = displayName(t.merchant, '') || displayName(t.description, t.description) || t.description
  const words = String(base).toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !/^\d+$/.test(w) && !/^x+\d*$/.test(w))
  return words.slice(0, 3).join(' ') || normKey(base) || 'unknown'
}

// Money moving between the client's own accounts, or in from their own name, is
// not income. It is never dropped silently - it is listed under its own heading
// so a reviewer can see what was set aside and disagree.
// The first two significant words of a payer. Matching a dishonour to the
// payment that put it right needs a looser key than grouping does: the bank
// writes "ORIGIN ENERGY DD RETURNED UNPAID" for the return and "ORIGIN ENERGY
// DIRECT DEBIT" for the retry, and those are the same obligation.
export function payerRoot(t: ParsedTxn): string {
  return payerKey(t).split(' ').slice(0, 2).join(' ')
}

export function ownNameTokens(client: { firstName?: string; lastName?: string }): string[] {
  const out: string[] = []
  const last = normKey(client?.lastName || '')
  if (last.length >= 4) out.push(last)
  return out
}

export function groupBy(txns: ParsedTxn[]): Group[] {
  const map = new Map<string, ParsedTxn[]>()
  for (const t of txns) {
    const k = payerKey(t)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  return [...map.entries()].map(([key, list]) => {
    const dates = list.map(t => t.date).sort()
    const { kind, meanDays, gaps } = cadenceOf(dates)
    const amounts = list.map(t => Math.abs(t.amount))
    const meanAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const spread = amounts.length > 1 ? (Math.max(...amounts) - Math.min(...amounts)) : 0
    return {
      key,
      payer: (displayName(list[0].merchant, '') || displayName(list[0].description, list[0].description) || key).trim(),
      txns: list,
      total: round2(list.reduce((s, t) => s + t.amount, 0)),
      count: list.length,
      dates,
      cadence: kind, meanDays, gaps,
      meanAmount: round2(meanAmount),
      variationPct: meanAmount > 0 ? Math.round((spread / meanAmount) * 1000) / 10 : 0,
    }
  }).sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
}

// ------------------------------------------------------- classification

export function isInternalTransfer(t: ParsedTxn, all: ParsedTxn[]): boolean {
  const cat = t.category.toLowerCase()
  if (cat === 'internal transfer') return true
  if (matchesAny(t.description, INTERNAL_TRANSFER_WORDS)) return true
  // A debit on one of the client's own accounts with a matching credit on another
  // within a day is money moved, not money earned or spent.
  return all.some(o =>
    o !== t &&
    o.accountNumber !== t.accountNumber &&
    Math.abs(o.amount + t.amount) < 0.01 &&
    Math.abs(ms(o.date) - ms(t.date)) <= DAY
  )
}

export function isDishonour(t: ParsedTxn): boolean {
  const cat = t.category.toLowerCase()
  if (cat === 'dishonour fees' || cat === 'unmatched dishonours') return true
  return matchesAny(t.description, DISHONOUR_WORDS)
}

export function isGambling(t: ParsedTxn, R: StatementRules = DEFAULT_RULES): boolean {
  if (t.category.toLowerCase() === 'gambling') return true
  return matchesAny(t.merchant || t.description, R.gambling)
}

export function bnplProvider(t: ParsedTxn, R: StatementRules = DEFAULT_RULES): string | null {
  const hay = `${t.merchant} ${t.description}`
  for (const p of R.bnpl) if (matchesAny(hay, p.terms)) return p.name
  if (t.category.toLowerCase().startsWith('buy now')) return t.merchant || 'Buy now pay later'
  return null
}

export function highCostLender(t: ParsedTxn, R: StatementRules = DEFAULT_RULES): string | null {
  const hay = `${t.merchant} ${t.description}`
  for (const p of R.highCost) if (matchesAny(hay, p.terms)) return p.name
  return null
}

export function isCommitment(t: ParsedTxn, R: StatementRules = DEFAULT_RULES): boolean {
  if (t.amount >= 0) return false
  const cat = t.category.toLowerCase()
  const sum = t.summaryCategory.toLowerCase()
  if (['credit card', 'loans', 'non sacc loans', 'sacc loans', 'buy now, pay later',
       'wage advance', 'debt collection', 'debt management'].includes(cat)) return true
  if (['loans', 'credit card'].includes(sum)) return true
  return Boolean(bnplProvider(t, R) || highCostLender(t, R))
}

export function isGovernment(t: ParsedTxn, R: StatementRules = DEFAULT_RULES): boolean {
  if (t.amount <= 0) return false
  // Same rule as salary: CashDeck's own category is read first.
  const cats = `${t.category} ${t.summaryCategory}`
  if (/\bgovernment\b/i.test(cats)) return true
  if (matchesAny(cats, GOVERNMENT_PAYERS)) return true
  const hay = `${t.merchant} ${t.description}`
  if (matchesAny(hay, GOVERNMENT_PAYERS)) return true
  return R.benefits.some(b => matchesAny(hay, b.terms))
}

export function benefitType(t: ParsedTxn, R: StatementRules = DEFAULT_RULES): { name: string; servicingUse: string } {
  const hay = `${t.merchant} ${t.description}`
  for (const b of R.benefits) if (matchesAny(hay, b.terms)) return { name: b.name, servicingUse: b.servicingUse }
  return { name: 'Government payment', servicingUse: 'sometimes' }
}

export function isRealEstateAgent(t: ParsedTxn, R: StatementRules = DEFAULT_RULES): boolean {
  return matchesAny(`${t.merchant} ${t.description}`, R.agents)
}

export function isSalaryLike(t: ParsedTxn): boolean {
  if (t.amount <= 0) return false
  // CashDeck has already read the line and called it Wages. That beats anything
  // we could infer from the narration, and it is checked first.
  //
  // Kornelia Viragova, 31 Aug 2026: $28,559 of wages across 11 credits, sitting
  // in the file under the category "Wages", and this function found none of it -
  // because the employer pays under its own name and the bank narration carries
  // no pay-word for us to match. We had the answer in the file and threw it away.
  if (matchesAny(`${t.category} ${t.summaryCategory}`, SALARY_WORDS)) return true
  const hay = `${t.merchant} ${t.description}`
  if (matchesAny(hay, SALARY_WORDS)) return true
  // An employer paying by name rather than by the word "payroll" still looks like
  // an employer: a company, paying in, on a cycle. Cadence is checked by the caller.
  return /pty\s*ltd|p\/l\b|limited|\bltd\b|group|services|holdings/i.test(hay)
}

export function isCash(t: ParsedTxn): boolean {
  const cat = t.category.toLowerCase()
  if (cat === 'atm withdrawals' || cat === 'withdrawal') return true
  return /\batm\b|cash (deposit|withdrawal|out|wdl)|cash dep|branch cash/i.test(`${t.merchant} ${t.description}`)
}

// Money coming back is not money earned. A Medicare rebate, an ATO refund or a
// retailer reversal all land as credits and none of them is servicing income.
export function isRebate(t: ParsedTxn, R: StatementRules = DEFAULT_RULES): boolean {
  if (t.amount <= 0) return false
  // Wages win. A pay run narrated with the word "reimbursement" in it is still a
  // pay run, and calling it a rebate would drop it out of income entirely.
  if (matchesAny(`${t.category} ${t.summaryCategory}`, SALARY_WORDS)) return false
  if (matchesAny(`${t.category} ${t.summaryCategory}`, R.rebates)) return true
  return matchesAny(`${t.merchant} ${t.description}`, R.rebates)
}

export function isInterest(t: ParsedTxn): boolean {
  return t.amount > 0 && /interest (paid|earned|credit)|credit interest|bonus interest/i.test(`${t.merchant} ${t.description}`)
}

// ------------------------------------------------------------- fact find

export type DeclaredIncome = {
  employmentAnnual: number
  components: { label: string; amount: number }[]
  otherAnnual: number
  otherItems: { label: string; amount: number }[]
  rentAnnual: number
  rentItems: { label: string; amount: number }[]
  present: boolean
}

export function readDeclaredIncome(factFind: any): DeclaredIncome {
  const components: { label: string; amount: number }[] = []
  const otherItems: { label: string; amount: number }[] = []
  const rentItems: { label: string; amount: number }[] = []
  let employmentAnnual = 0, otherAnnual = 0, rentAnnual = 0
  let sawAnything = false

  for (const a of (factFind?.applicants || [])) {
    const who = [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Applicant'
    for (const inc of (a.income || [])) {
      const pairs: [string, string, string][] = [
        ['Base salary', 'grossSalary', 'grossSalaryFrequency'],
        ['Bonus', 'bonusAmount', 'bonusFrequency'],
        ['Overtime (essential)', 'overtimeEssentialAmount', 'overtimeEssentialFrequency'],
        ['Overtime (non-essential)', 'overtimeNonEssentialAmount', 'overtimeNonEssentialFrequency'],
        ['Commission', 'commissionAmount', 'commissionFrequency'],
        ['Allowances', 'allowanceAmount', 'allowanceFrequency'],
      ]
      for (const [label, amtKey, freqKey] of pairs) {
        const v = Number(inc[amtKey]) || 0
        if (!v) continue
        sawAnything = true
        const annual = annualiseFreq(v, inc[freqKey])
        employmentAnnual += annual
        components.push({ label: `${who} — ${label}`, amount: round2(annual) })
      }
      const other = Number(inc.otherIncomeAmount) || 0
      if (other) {
        sawAnything = true
        otherAnnual += other
        otherItems.push({ label: `${who} — ${inc.otherIncomeType || 'Other income'}`, amount: round2(other) })
      }
    }
  }

  for (const p of (factFind?.properties || [])) {
    const v = Number(p.rentalIncome) || 0
    if (!v) continue
    sawAnything = true
    const annual = annualiseFreq(v, p.rentalIncomeFrequency)
    rentAnnual += annual
    rentItems.push({ label: p.address || 'Investment property', amount: round2(annual) })
  }

  return {
    employmentAnnual: round2(employmentAnnual), components,
    otherAnnual: round2(otherAnnual), otherItems,
    rentAnnual: round2(rentAnnual), rentItems,
    present: sawAnything,
  }
}

export type DeclaredLiability = { lender: string; type: string; monthly: number; status: string }

export function readDeclaredLiabilities(factFind: any): DeclaredLiability[] {
  return (factFind?.liabilities || []).map((l: any) => ({
    lender: String(l.lenderName || '').trim(),
    type: String(l.liabilityType || '').trim(),
    monthly: round2(annualiseFreq(Number(l.repaymentAmount) || 0, l.repaymentFrequency) / 12),
    status: String(l.status || '').trim(),
  })).filter((l: DeclaredLiability) => l.lender || l.monthly > 0)
}

// Does a commitment seen in the account match one the client declared? Names, not
// amounts - a car loan declared at $500 and debiting $585 is still declared, and
// showing it as hidden would train people to ignore the card.
export function matchesDeclared(seenName: string, seenType: string, declared: DeclaredLiability[], R: StatementRules = DEFAULT_RULES): DeclaredLiability | null {
  const seen = normKey(seenName)
  if (!seen) return null
  const expand = (s: string) => {
    const k = normKey(s)
    const out = [k]
    for (const { name: canon, terms: aliases } of R.lenderAliases) {
      const all = [normKey(canon), ...aliases.map(normKey)]
      if (all.some(a => a && (k.includes(a) || a.includes(k)))) out.push(...all)
    }
    return out.filter(Boolean)
  }
  const seenForms = expand(seenName)
  for (const d of declared) {
    if (!d.lender) continue
    const declForms = expand(d.lender)
    const hit = seenForms.some(s => declForms.some(x => x.length >= 3 && (s.includes(x) || x.includes(s))))
    if (hit) return d
  }
  // A declared credit card with no lender written on it still explains a card debit.
  if (/credit card/i.test(seenType)) {
    const card = declared.find(d => /credit card/i.test(d.type))
    if (card) return card
  }
  return null
}

// ------------------------------------------------------------- balances

export type BalancePoint = { date: string; balance: number }

export type Balances = {
  available: boolean
  reason: string
  accounts: { accountNumber: string; name: string; institution: string; closing: number; points: BalancePoint[] }[]
  combined: BalancePoint[]
  monthEnds: BalancePoint[]
  daysOverdrawn: number
  overdrawnDates: string[]
  lowest: { date: string; balance: number; accountNumber: string; name: string } | null
  lowestCombined: number | null
  trendPerMonth: number | null
  closingTotal: number
}

// CashDeck gives one closing balance per account and every transaction. The
// balance on any earlier day is the closing balance less everything that happened
// after it. Accounts with no balance supplied are left out entirely rather than
// treated as zero, and the card says which.
export function deriveBalances(parsed: ParsedStatements): Balances {
  const usable = parsed.accounts.filter(a => a.currentBalance !== null && a.currentBalance !== 0)
  if (usable.length === 0) {
    return {
      available: false,
      reason: 'No closing balances were supplied with these statements, so balances cannot be worked out.',
      accounts: [], combined: [], monthEnds: [], daysOverdrawn: 0, overdrawnDates: [],
      lowest: null, lowestCombined: null, trendPerMonth: null, closingTotal: 0,
    }
  }

  const accounts = usable.map(a => {
    const mine = parsed.transactions.filter(t => t.accountNumber === a.accountNumber)
      .sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0)
    const closing = a.currentBalance as number
    const points: BalancePoint[] = []
    let running = closing
    for (let i = mine.length - 1; i >= 0; i--) {
      points.unshift({ date: mine[i].date, balance: round2(running) })
      running -= mine[i].amount
    }
    return { accountNumber: a.accountNumber, name: a.name, institution: a.institution, closing, points }
  })

  const balanceOn = (acc: typeof accounts[number], date: string): number | null => {
    let last: number | null = null
    for (const p of acc.points) { if (p.date <= date) last = p.balance; else break }
    return last
  }

  const combined: BalancePoint[] = []
  const overdrawnDates: string[] = []
  let lowest: Balances['lowest'] = null
  const from = parsed.periodFrom, to = parsed.periodTo
  for (let d = ms(from); d <= ms(to); d += DAY) {
    const date = new Date(d).toISOString().slice(0, 10)
    let total = 0, any = false
    for (const acc of accounts) {
      const b = balanceOn(acc, date)
      if (b === null) continue
      any = true
      total += b
      if (b < 0 && !overdrawnDates.includes(date)) overdrawnDates.push(date)
      if (!lowest || b < lowest.balance) lowest = { date, balance: b, accountNumber: acc.accountNumber, name: acc.name }
    }
    if (any) combined.push({ date, balance: round2(total) })
  }

  const monthEnds: BalancePoint[] = []
  for (let i = 0; i < combined.length; i++) {
    const next = combined[i + 1]
    if (!next || next.date.slice(0, 7) !== combined[i].date.slice(0, 7)) monthEnds.push(combined[i])
  }

  let trendPerMonth: number | null = null
  if (monthEnds.length >= 2) {
    const first = monthEnds[0].balance, last = monthEnds[monthEnds.length - 1].balance
    trendPerMonth = round2((last - first) / (monthEnds.length - 1))
  }

  const notCovered = parsed.accounts.length - usable.length
  return {
    available: true,
    reason: (notCovered > 0
      ? `${usable.length} of ${parsed.accounts.length} accounts had a closing balance supplied. The other ${notCovered} ${notCovered === 1 ? 'is' : 'are'} left out of every balance figure rather than counted as zero. `
      : 'Every account had a closing balance supplied. ')
      + 'Balances are worked backwards from the closing figure, so they are only as right as it is.',
    accounts,
    combined,
    monthEnds,
    daysOverdrawn: overdrawnDates.length,
    overdrawnDates,
    lowest,
    lowestCombined: combined.length ? Math.min(...combined.map(p => p.balance)) : null,
    trendPerMonth,
    closingTotal: round2(accounts.reduce((s, a) => s + a.closing, 0)),
  }
}

// --------------------------------------------------------------- cards

export type Card = {
  key: string
  title: string
  value: string
  valueNumber: number | null
  sub: string
  flag: Flag
  flagLabel?: string
  drill: 'transactions' | 'working' | 'compare' | 'balances' | 'source' | 'none'
  txnIds: string[]
  detail: any
}

const fmtMoney = (n: number, dp = 2) =>
  '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })
const signed = (n: number, dp = 2) => (n < 0 ? '−' : '') + fmtMoney(n, dp)
const ids = (ts: ParsedTxn[]) => ts.map(t => t.externalId)
const auDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z')
  return isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export type Analysis = {
  version: number
  generatedAt: string
  period: { from: string; to: string; days: number; fys: string[]; dominantFy: string }
  coverage: { complete: boolean; note: string; accounts: { accountNumber: string; name: string; institution: string; from: string; to: string; txnCount: number; pct: number }[] }
  client: ParsedStatements['client']
  institutions: string[]
  txnCount: number
  balances: Balances
  cards: Card[]
  // `key` is stable across re-analyses so an answer recorded against an item
  // still belongs to it after the file is analysed again. `card` only says
  // which figure to scroll to, and two items can point at the same one.
  worklist: { key: string; flag: Flag; label: string; text: string; card: string }[]
  score: {
    total: number
    components: { key: string; label: string; weight: number; score: number; open: number; note: string }[]
    openItems: number
  }
  rules: StatementRules
  warnings: string[]
}

export function analyse(parsed: ParsedStatements, factFind: any, rulesInput?: any): Analysis {
  const R = normaliseRules(rulesInput)
  const all = parsed.transactions
  const days = Math.max(1, parsed.days)
  const perYear = 365.25 / days
  const perMonth = perYear / 12
  const fys = fysInPeriod(parsed.periodFrom, parsed.periodTo)
  const domFy = dominantFy(parsed.periodFrom, parsed.periodTo)

  const internal = new Set(all.filter(t => isInternalTransfer(t, all)).map(t => t.externalId))
  const external = all.filter(t => !internal.has(t.externalId))
  // Credits carrying the client's own surname are their own money arriving from
  // an account we were not given. Counting them as income would inflate what the
  // client earns, so they are set aside - and shown, under their own heading.
  const nameTokens = ownNameTokens(parsed.client)
  const ownIds = new Set(external.filter(t =>
    t.amount > 0 && nameTokens.length > 0 &&
    nameTokens.some(tok => normKey(`${t.merchant} ${t.description}`).includes(tok))
  ).map(t => t.externalId))
  const ownTxns = external.filter(t => ownIds.has(t.externalId))
  const credits = external.filter(t => t.amount > 0 && !ownIds.has(t.externalId))
  const debits = external.filter(t => t.amount < 0)
  const totalCredits = round2(credits.reduce((s, t) => s + t.amount, 0))

  const declaredInc = readDeclaredIncome(factFind)
  const declaredLiabs = readDeclaredLiabilities(factFind)
  const balances = deriveBalances(parsed)
  const cards: Card[] = []
  const warnings = [...parsed.warnings]

  // ---- coverage -------------------------------------------------------
  const covAccounts = parsed.accounts.map(a => ({
    accountNumber: a.accountNumber, name: a.name, institution: a.institution,
    from: a.from, to: a.to, txnCount: a.txnCount,
    pct: Math.round((daysBetween(a.from, a.to) / days) * 100),
  }))
  const coverageComplete = covAccounts.length > 0 && covAccounts.every(a => a.pct >= 90)
  const shortAccounts = covAccounts.filter(a => a.pct < 90)
  const coverageNote = coverageComplete
    ? `Every account spans the full ${days} days.`
    : `${shortAccounts.length} of ${covAccounts.length} accounts cover less than the full period — ${shortAccounts.map(a => `${a.name} ${a.pct}%`).join(', ')}. Annualised figures below are less reliable because of it.`

  // ---- salary ---------------------------------------------------------
  const govIds = new Set(credits.filter(t => isGovernment(t, R)).map(t => t.externalId))
  const rentAgentCredits = credits.filter(t => !govIds.has(t.externalId) && (isRealEstateAgent(t, R) || t.category.toLowerCase() === 'rent'))
  const rentIds = new Set(rentAgentCredits.map(t => t.externalId))
  const interestIds = new Set(credits.filter(isInterest).map(t => t.externalId))
  const rebateIds = new Set(credits.filter(t => isRebate(t, R) && !interestIds.has(t.externalId)).map(t => t.externalId))

  const salaryCandidates = credits.filter(t =>
    !govIds.has(t.externalId) && !rentIds.has(t.externalId) && !interestIds.has(t.externalId) &&
    !rebateIds.has(t.externalId) && isSalaryLike(t))
  // Pay does not have to be tidy to be pay.
  //
  // Kornelia Viragova, 31 Aug 2026: three credits from one employer - 12 Mar,
  // 14 Jul, 14 Aug - $23,135 of salary, against $125,000 declared. The cadence
  // filter here only accepted weekly, fortnightly or monthly, so the lot was
  // thrown away and the card read "no regular salary credits found". A four
  // month hole in someone's pay and a declaration the statements do not support,
  // and the screen said nothing. She was on maternity leave, which explains a
  // lower figure - it does not explain a blank one.
  //
  // An irregular run is counted and then marked irregular, loudly. What still
  // needs a cycle is a credit that only LOOKS like an employer - a company name
  // with no pay word anywhere on it - because for those the rhythm is the only
  // evidence there is.
  const REGULAR_PAY: Cadence[] = ['weekly', 'fortnightly', 'monthly']
  const isPayWorded = (g: Group) => g.txns.some(t =>
    matchesAny(`${t.category} ${t.summaryCategory} ${t.merchant} ${t.description}`, SALARY_WORDS))
  const salaryGroups = groupBy(salaryCandidates)
    .filter(g => g.count >= 2 && (REGULAR_PAY.includes(g.cadence) || isPayWorded(g)))
  const salaryIrregular = salaryGroups.length > 0 && salaryGroups.some(g => !REGULAR_PAY.includes(g.cadence))
  const salaryTxns = salaryGroups.flatMap(g => g.txns)
  const salaryTotal = round2(salaryTxns.reduce((s, t) => s + t.amount, 0))
  const salaryAnnualNet = round2(salaryTotal * perYear)
  const salaryMonthlyNet = round2(salaryTotal * perMonth)

  // The longest stretch with no pay in it. A month either side of a monthly cycle
  // is normal; anything past that is a hole somebody has to explain.
  const SALARY_GAP_DAYS = 45
  const salaryDates = salaryTxns.map(t => t.date).sort()
  let salaryGapDays = 0, salaryGapFrom = '', salaryGapTo = ''
  for (let i = 1; i < salaryDates.length; i++) {
    const d = daysBetween(salaryDates[i - 1], salaryDates[i]) - 1
    if (d > salaryGapDays) { salaryGapDays = d; salaryGapFrom = salaryDates[i - 1]; salaryGapTo = salaryDates[i] }
  }
  const salaryHasGap = salaryGapDays >= SALARY_GAP_DAYS

  // What they are being paid NOW. Averaging across months with no pay in them
  // answers a different question from "what does this person earn today", and on
  // a return-to-work file the second one is what a lender is assessing.
  const lastTwo = salaryTxns.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-2)
  const runSpacing = lastTwo.length === 2 ? daysBetween(lastTwo[0].date, lastTwo[1].date) - 1 : 0
  const runRateMonthly = (lastTwo.length === 2 && runSpacing > 0)
    ? round2(((lastTwo[0].amount + lastTwo[1].amount) / 2) * (30.44 / runSpacing))
    : 0
  const runRateAnnualNet = round2(runRateMonthly * 12)

  const grossUps = fys.map(fy => ({ fy, up: grossFromNet(salaryAnnualNet, fy) }))
  const headline = grossUps.find(g => g.fy === domFy) || grossUps[0]
  const grossedUp = salaryGroups.length ? (headline?.up.gross ?? 0) : 0

  cards.push({
    key: 'salary', title: 'Net salary credits',
    value: salaryGroups.length ? fmtMoney(salaryMonthlyNet) : '—',
    valueNumber: salaryGroups.length ? salaryMonthlyNet : null,
    sub: !salaryGroups.length
      ? 'No salary credits found in this period'
      : salaryIrregular
        ? `per month across ${days} days · ${salaryGroups.length} employer${salaryGroups.length === 1 ? '' : 's'} · ${salaryTxns.length} credits, no steady cycle — the average is spread over months with no pay in them`
        : `per month · ${salaryGroups.length} employer${salaryGroups.length === 1 ? '' : 's'} · paid ${salaryGroups[0].cadence}`,
    flag: !salaryGroups.length ? 'unavailable' : salaryIrregular ? 'query' : 'ok',
    flagLabel: salaryIrregular ? 'Irregular' : undefined,
    drill: 'transactions', txnIds: ids(salaryTxns),
    detail: {
      sources: salaryGroups.map(g => ({ payer: g.payer, count: g.count, cadence: g.cadence, meanDays: g.meanDays, total: g.total, meanAmount: g.meanAmount })),
      total: salaryTotal, days, annualNet: salaryAnnualNet, monthlyNet: salaryMonthlyNet,
      irregular: salaryIrregular,
      gap: salaryHasGap ? { days: salaryGapDays, from: salaryGapFrom, to: salaryGapTo } : null,
    },
  })

  // Only worth showing when the run is uneven. On a steady fortnightly cycle it
  // would just repeat the card above.
  const runGrossUp = (salaryIrregular && runRateMonthly > 0) ? grossFromNet(runRateAnnualNet, domFy) : null
  const runGrossAnnual = runGrossUp ? round2(runGrossUp.gross) : 0
  if (salaryIrregular && runRateMonthly > 0) {
    const runGross = runGrossUp!
    cards.push({
      key: 'runrate', title: 'Recent run rate',
      value: fmtMoney(runRateMonthly), valueNumber: runRateMonthly,
      sub: `per month · the last two pays, ${runSpacing} days apart · grosses to about ${fmtMoney(runGross.gross, 0)}`,
      flag: 'ok',
      drill: 'transactions', txnIds: ids(lastTwo),
      detail: {
        pays: lastTwo.map(t => ({ date: t.date, amount: t.amount, description: t.description })),
        spacingDays: runSpacing, monthlyNet: runRateMonthly, annualNet: runRateAnnualNet,
        gross: round2(runGross.gross), scale: runGross.scale.label,
        why: 'What they are being paid now. The card beside it averages across the whole period, including any months with no pay in them.',
      },
    })
  }

  cards.push({
    key: 'gross', title: 'Grosses up to',
    value: grossedUp ? fmtMoney(grossedUp, 0) : '—',
    valueNumber: grossedUp || null,
    sub: !grossedUp
      ? 'Nothing to gross up — no salary credits found'
      : salaryIrregular
        ? `${headline.up.scale.label} rates · this is the whole period, gaps included — see the run rate for what they earn now`
        : `${headline.up.scale.label} rates · before HELP or salary sacrifice`,
    // Grossing up a period with a hole in it understates the income, and saying
    // so is the difference between a figure and a misleading figure.
    flag: !grossedUp ? 'unavailable' : salaryIrregular ? 'query' : 'ok',
    drill: 'working', txnIds: ids(salaryTxns),
    detail: {
      annualNet: salaryAnnualNet,
      byFy: grossUps.map(g => ({
        fy: g.fy, label: g.up.scale.label, gross: g.up.gross, incomeTax: round2(g.up.incomeTax),
        offset: round2(g.up.offset), medicare: round2(g.up.medicare), net: round2(g.up.net),
        lines: g.up.lines.map(l => ({ ...l, amount: round2(l.amount) })), headline: g.fy === domFy,
      })),
      caveats: [...new Set(grossUps.flatMap(g => g.up.caveats))],
    },
  })

  cards.push({
    key: 'declaredSalary', title: 'Declared on fact find',
    value: declaredInc.employmentAnnual ? fmtMoney(declaredInc.employmentAnnual, 0) : '—',
    valueNumber: declaredInc.employmentAnnual || null,
    sub: declaredInc.employmentAnnual
      ? `${declaredInc.components.length} line${declaredInc.components.length === 1 ? '' : 's'} · base, bonus, overtime and allowances`
      : 'No employment income entered on the fact find',
    flag: declaredInc.employmentAnnual ? 'ok' : 'query',
    drill: 'source', txnIds: [],
    detail: { components: declaredInc.components, total: declaredInc.employmentAnnual, field: 'Fact find · Income' },
  })

  const salaryVariance = grossedUp && declaredInc.employmentAnnual ? round2(grossedUp - declaredInc.employmentAnnual) : null
  const salaryVariancePct = salaryVariance !== null && declaredInc.employmentAnnual
    ? Math.round((salaryVariance / declaredInc.employmentAnnual) * 1000) / 10 : null
  const salaryFlag: Flag = salaryVariancePct === null ? 'unavailable'
    : Math.abs(salaryVariancePct) <= R.salaryQueryPct ? 'ok'
    : Math.abs(salaryVariancePct) <= R.salaryActionPct ? 'query' : 'action'

  cards.push({
    key: 'salaryVariance', title: 'Salary variance',
    value: salaryVariance === null ? '—' : signed(salaryVariance, 0),
    valueNumber: salaryVariance,
    sub: salaryVariancePct === null
      ? (grossedUp ? 'Nothing declared to compare against' : 'No regular salary credits to compare')
      : `Credits are ${Math.abs(salaryVariancePct)}% ${salaryVariancePct < 0 ? 'below' : 'above'} declared`,
    flag: salaryFlag,
    flagLabel: salaryFlag === 'ok' ? 'Consistent' : salaryFlag === 'query' ? 'Query' : salaryFlag === 'action' ? 'Query' : undefined,
    drill: 'compare', txnIds: ids(salaryTxns),
    detail: { grossedUp, declared: declaredInc.employmentAnnual, variance: salaryVariance, variancePct: salaryVariancePct },
  })

  // ---- rental ---------------------------------------------------------
  const rentGroups = groupBy(rentAgentCredits)
  // One rent credit in the window says nothing about a year. Below two, the total
  // is reported and nothing is multiplied up.
  const rentRecurring = rentGroups.filter(g => g.count >= 2)
  const rentRecurringTxns = rentRecurring.flatMap(g => g.txns)
  const rentAnnualisable = rentRecurringTxns.length > 0
  const rentTotal = round2(rentRecurringTxns.reduce((s, t) => s + t.amount, 0))
  const rentMonthly = rentAnnualisable ? round2(rentTotal * perMonth) : 0
  const rentAnnual = rentAnnualisable ? round2(rentTotal * perYear) : 0
  const rentVariance = rentAnnualisable && declaredInc.rentAnnual ? round2(rentAnnual - declaredInc.rentAnnual) : null
  const rentVariancePct = rentVariance !== null && declaredInc.rentAnnual
    ? Math.round((rentVariance / declaredInc.rentAnnual) * 1000) / 10 : null
  // Agent-managed rent always lands net of fees, so a gap of up to a quarter is
  // what fees look like, not a discrepancy. Past that it is vacancy or arrears.
  const rentFlag: Flag = rentVariancePct === null ? 'unavailable'
    : rentVariancePct >= -R.rentalTolerancePct ? 'ok' : 'query'

  cards.push({
    key: 'rent', title: 'Rent credits received',
    value: rentAnnualisable ? fmtMoney(rentMonthly) : '—',
    valueNumber: rentAnnualisable ? rentMonthly : null,
    sub: rentAnnualisable
      ? `per month · ${fmtMoney(rentAnnual, 0)} annualised · ${rentRecurring.length} source${rentRecurring.length === 1 ? '' : 's'}`
      : rentAgentCredits.length
        ? `${rentAgentCredits.length} credit${rentAgentCredits.length === 1 ? '' : 's'} found but none repeating — not annualised`
        : 'No rental credits found in this period',
    flag: rentAnnualisable ? 'ok' : 'unavailable',
    drill: 'transactions', txnIds: ids(rentAgentCredits),
    detail: {
      annualisable: rentAnnualisable, total: rentTotal, monthly: rentMonthly, annual: rentAnnual,
      sources: rentGroups.map(g => ({ payer: g.payer, count: g.count, cadence: g.cadence, total: g.total, annualised: g.count >= 2 })),
    },
  })
  cards.push({
    key: 'declaredRent', title: 'Declared gross rent',
    value: declaredInc.rentAnnual ? fmtMoney(declaredInc.rentAnnual, 0) : '—',
    valueNumber: declaredInc.rentAnnual || null,
    sub: declaredInc.rentAnnual ? `${declaredInc.rentItems.length} propert${declaredInc.rentItems.length === 1 ? 'y' : 'ies'} on the fact find` : 'No rental income entered',
    flag: 'ok', drill: 'source', txnIds: [],
    detail: { components: declaredInc.rentItems, total: declaredInc.rentAnnual, field: 'Fact find · Properties' },
  })
  cards.push({
    key: 'rentVariance', title: 'Rental variance',
    value: rentVariance === null ? '—' : signed(rentVariance, 0),
    valueNumber: rentVariance,
    sub: rentVariancePct === null ? 'Nothing to compare'
      : rentVariancePct >= -R.rentalTolerancePct && rentVariancePct <= 0
        ? `${Math.abs(rentVariancePct)}% — within the normal agent-fee range`
        : `${Math.abs(rentVariancePct)}% ${rentVariancePct < 0 ? 'below' : 'above'} declared`,
    flag: rentFlag,
    flagLabel: rentFlag === 'ok' ? 'Consistent' : rentFlag === 'query' ? 'Query' : undefined,
    drill: 'compare', txnIds: ids(rentAgentCredits),
    detail: { received: rentAnnual, declared: declaredInc.rentAnnual, variance: rentVariance, variancePct: rentVariancePct },
  })

  // ---- stability ------------------------------------------------------
  const primary = salaryGroups[0]
  const expectedCycles = primary
    ? Math.floor(days / (primary.cadence === 'weekly' ? 7 : primary.cadence === 'fortnightly' ? 14 : 30.44))
    : 0
  const stabilityTests = primary ? [
    { test: 'Employers seen', result: `${salaryGroups.length} — ${salaryGroups.map(g => g.payer).join(', ')}`, pass: salaryGroups.length === 1 },
    { test: 'Pay cycle', result: `${primary.cadence}, about ${primary.meanDays} days apart`, pass: primary.cadence !== 'irregular' },
    { test: 'Cycles paid', result: `${primary.count} of about ${expectedCycles} expected`, pass: primary.count >= expectedCycles - 1 },
    { test: 'Longest gap', result: `${primary.gaps.length ? Math.max(...primary.gaps) : 0} days`, pass: !primary.gaps.length || Math.max(...primary.gaps) <= primary.meanDays * 1.5 },
    { test: 'Amount variation', result: `${primary.variationPct}% between the largest and smallest`, pass: primary.variationPct <= 20 },
  ] : []
  const stabilityFails = stabilityTests.filter(t => !t.pass).length
  if (primary && stabilityFails > 0) {
    warnings.push('The pay pattern is not steady, so the annualised salary and the gross-up are less reliable than usual.')
  }
  cards.push({
    key: 'stability', title: 'Income stability',
    value: !primary ? '—' : stabilityFails === 0 ? 'No gaps' : `${stabilityFails} issue${stabilityFails === 1 ? '' : 's'}`,
    valueNumber: null,
    sub: !primary ? 'No regular salary credits to test'
      : `${salaryGroups.length} employer${salaryGroups.length === 1 ? '' : 's'} · ${primary.count} of ${expectedCycles} cycles · ${primary.variationPct}% variation`,
    flag: !primary ? 'unavailable' : stabilityFails === 0 ? 'ok' : 'query',
    flagLabel: !primary ? undefined : stabilityFails === 0 ? 'Stable' : 'Check',
    drill: 'transactions', txnIds: ids(salaryTxns),
    detail: { tests: stabilityTests },
  })

  // ---- other income ---------------------------------------------------
  const salaryIds = new Set(salaryTxns.map(t => t.externalId))
  const govTxns = credits.filter(t => govIds.has(t.externalId))
  const otherCandidates = credits.filter(t =>
    !salaryIds.has(t.externalId) && !rentIds.has(t.externalId) &&
    !interestIds.has(t.externalId) && !rebateIds.has(t.externalId))
  const rebateTxns = credits.filter(t => rebateIds.has(t.externalId))
  const otherGroups = groupBy(otherCandidates)
  // Only money that repeats is treated as income. One credit in ninety days says
  // nothing about a year, so it is listed separately and never annualised.
  const recurringOther = otherGroups.filter(g => g.count >= 2 && g.cadence !== 'irregular' && g.cadence !== 'once')
  const oneOffOther = otherGroups.filter(g => !recurringOther.includes(g))
  const otherRecurringTotal = round2(recurringOther.reduce((s, g) => s + g.total, 0))
  const otherMonthly = round2(otherRecurringTotal * perMonth)
  const otherAnnual = round2(otherRecurringTotal * perYear)
  const oneOffTotal = round2(oneOffOther.reduce((s, g) => s + g.total, 0))

  const describeOther = (g: Group) => {
    const t = g.txns[0]
    if (govIds.has(t.externalId)) return benefitType(t, R).name
    return g.payer
  }

  cards.push({
    key: 'other', title: 'Other income identified',
    value: recurringOther.length ? fmtMoney(otherMonthly) : '—',
    valueNumber: recurringOther.length ? otherMonthly : null,
    sub: recurringOther.length
      ? `per month · ${recurringOther.length} recurring source${recurringOther.length === 1 ? '' : 's'}${oneOffTotal ? ` · plus ${fmtMoney(oneOffTotal)} one-off` : ''}`
      : oneOffTotal ? `No recurring source · ${fmtMoney(oneOffTotal)} of one-off credits` : 'No other income found',
    flag: recurringOther.length ? 'ok' : 'unavailable',
    drill: 'transactions', txnIds: ids(otherCandidates),
    detail: {
      recurring: recurringOther.map(g => ({ payer: describeOther(g), raw: g.payer, count: g.count, cadence: g.cadence, total: g.total, monthly: round2(g.total * perMonth), annual: round2(g.total * perYear), ids: ids(g.txns) })),
      oneOff: oneOffOther.map(g => ({ payer: g.payer, count: g.count, total: g.total, ids: ids(g.txns) })),
      interest: round2(credits.filter(t => interestIds.has(t.externalId)).reduce((s, t) => s + t.amount, 0)),
      ownTransfers: {
        total: round2(ownTxns.reduce((s, t) => s + t.amount, 0)),
        count: ownTxns.length,
        ids: ids(ownTxns),
        note: nameTokens.length
          ? `Credits carrying the client's own name were set aside as their own money rather than counted as income.`
          : '',
      },
      internalTransfers: { count: internal.size },
      rebates: {
        total: round2(rebateTxns.reduce((s, t) => s + t.amount, 0)),
        count: rebateTxns.length, ids: ids(rebateTxns),
        note: 'Refunds, rebates and Medicare benefits are money coming back, not money earned, so they are not counted as income.',
      },
      monthly: otherMonthly, annual: otherAnnual,
    },
  })

  const govByType = new Map<string, { name: string; servicingUse: string; txns: ParsedTxn[] }>()
  for (const t of govTxns) {
    const b = benefitType(t, R)
    if (!govByType.has(b.name)) govByType.set(b.name, { ...b, txns: [] })
    govByType.get(b.name)!.txns.push(t)
  }
  const govTotal = round2(govTxns.reduce((s, t) => s + t.amount, 0))
  const govMonthly = round2(govTotal * perMonth)
  const govTypeList = [...govByType.values()].map(g => ({
    name: g.name, servicingUse: g.servicingUse, count: g.txns.length,
    total: round2(g.txns.reduce((s, t) => s + t.amount, 0)),
    monthly: round2(g.txns.reduce((s, t) => s + t.amount, 0) * perMonth),
    cadence: cadenceOf(g.txns.map(t => t.date)).kind, ids: ids(g.txns),
  })).sort((a, b) => b.total - a.total)

  cards.push({
    key: 'govt', title: 'Government payments',
    value: govTxns.length ? fmtMoney(govMonthly) : '—',
    valueNumber: govTxns.length ? govMonthly : null,
    sub: govTxns.length
      ? `per month · ${govTypeList.map(g => g.name).slice(0, 2).join(', ')}${govTypeList.length > 2 ? ` +${govTypeList.length - 2}` : ''}`
      : 'No government payments found',
    flag: govTxns.length ? 'ok' : 'unavailable',
    drill: 'transactions', txnIds: ids(govTxns),
    detail: { types: govTypeList, total: govTotal, monthly: govMonthly },
  })

  cards.push({
    key: 'declaredOther', title: 'Declared on fact find',
    value: fmtMoney(declaredInc.otherAnnual, 0),
    valueNumber: declaredInc.otherAnnual,
    sub: declaredInc.otherAnnual ? `${declaredInc.otherItems.length} entry${declaredInc.otherItems.length === 1 ? '' : 'ies'}` : 'No other income entered',
    flag: 'ok', drill: 'source', txnIds: [],
    detail: { components: declaredInc.otherItems, total: declaredInc.otherAnnual, field: 'Fact find · Income · Other income' },
  })

  const undeclaredIncome = round2(Math.max(0, otherAnnual - declaredInc.otherAnnual))
  cards.push({
    key: 'incomeNotDeclared', title: 'Income not declared',
    value: undeclaredIncome ? '+' + fmtMoney(undeclaredIncome, 0) : fmtMoney(0, 0),
    valueNumber: undeclaredIncome,
    sub: undeclaredIncome
      ? 'a year · may help servicing if the lender accepts it'
      : 'Nothing found that is not already declared',
    flag: undeclaredIncome ? 'favourable' : 'ok',
    flagLabel: undeclaredIncome ? 'In their favour' : undefined,
    drill: 'compare', txnIds: ids(otherCandidates.filter(t => !oneOffOther.some(g => g.txns.includes(t)))),
    detail: {
      sources: recurringOther.map(g => ({ name: describeOther(g), monthly: round2(g.total * perMonth), annual: round2(g.total * perYear), servicingUse: govIds.has(g.txns[0].externalId) ? benefitType(g.txns[0], R).servicingUse : 'sometimes' })),
      declared: declaredInc.otherAnnual, found: otherAnnual, difference: undeclaredIncome,
    },
  })

  // ---- commitments ----------------------------------------------------
  const commitmentTxns = debits.filter(t => isCommitment(t, R))
  // A commitment is something that keeps coming out. A single debit to a lender
  // is a one-off payment until it happens twice; it is listed, not counted.
  const commitAll = groupBy(commitmentTxns)
  const commitOnce = commitAll.filter(g => g.count < 2)
  const commitGroups = commitAll.filter(g => g.count >= 2).map(g => {
    const t = g.txns[0]
    const provider = bnplProvider(t, R) || highCostLender(t, R) || g.payer
    const kind = bnplProvider(t, R) ? 'Buy now pay later'
      : highCostLender(t, R) ? 'Small amount credit'
      : t.category || 'Credit'
    const declared = matchesDeclared(provider, kind, declaredLiabs, R)
    return {
      provider, kind, group: g,
      monthly: round2(Math.abs(g.total) * perMonth),
      declared, isBnpl: Boolean(bnplProvider(t, R)),
    }
  }).sort((a, b) => b.monthly - a.monthly)

  const commitRecurringTxns = commitGroups.flatMap(c => c.group.txns)
  const seenMonthly = round2(commitGroups.reduce((s, c) => s + c.monthly, 0))
  const declaredMonthly = round2(declaredLiabs.reduce((s, l) => s + l.monthly, 0))
  const undeclared = commitGroups.filter(c => !c.declared)
  const undeclaredMonthly = round2(undeclared.reduce((s, c) => s + c.monthly, 0))

  cards.push({
    key: 'commitments', title: 'Commitments seen',
    value: commitGroups.length ? fmtMoney(seenMonthly) : '—',
    valueNumber: commitGroups.length ? seenMonthly : null,
    sub: commitGroups.length ? `per month · ${commitGroups.length} recurring credit obligation${commitGroups.length === 1 ? '' : 's'}` : 'No credit commitments found',
    flag: commitGroups.length ? 'ok' : 'unavailable',
    drill: 'transactions', txnIds: ids(commitRecurringTxns),
    detail: {
      oneOff: commitOnce.map(g => ({ payer: g.payer, total: g.total, date: g.dates[0], ids: ids(g.txns) })),
      providers: commitGroups.map(c => ({
        provider: c.provider, kind: c.kind, monthly: c.monthly, count: c.group.count,
        cadence: c.group.cadence, declared: Boolean(c.declared),
        declaredAs: c.declared ? `${c.declared.lender || c.declared.type} at ${fmtMoney(c.declared.monthly)}/mo` : null,
        ids: ids(c.group.txns),
      })),
      seenMonthly,
    },
  })
  cards.push({
    key: 'declaredCommitments', title: 'Declared on fact find',
    value: fmtMoney(declaredMonthly),
    valueNumber: declaredMonthly,
    sub: `${declaredLiabs.length} liabilit${declaredLiabs.length === 1 ? 'y' : 'ies'} on the fact find`,
    flag: 'ok', drill: 'source', txnIds: [],
    detail: { components: declaredLiabs.map(l => ({ label: `${l.lender || l.type}${l.status ? ` · ${l.status}` : ''}`, amount: l.monthly })), total: declaredMonthly, field: 'Fact find · Liabilities' },
  })
  cards.push({
    key: 'undisclosed', title: 'Undisclosed',
    value: fmtMoney(undeclaredMonthly),
    valueNumber: undeclaredMonthly,
    sub: undeclared.length
      ? `per month across ${undeclared.length} commitment${undeclared.length === 1 ? '' : 's'}`
      : 'Every commitment seen is on the fact find',
    flag: undeclared.length ? 'action' : 'ok',
    flagLabel: undeclared.length ? 'Action' : 'Clear',
    drill: 'transactions', txnIds: ids(undeclared.flatMap(c => c.group.txns)),
    detail: {
      providers: undeclared.map(c => ({ provider: c.provider, kind: c.kind, monthly: c.monthly, count: c.group.count, cadence: c.group.cadence, ids: ids(c.group.txns) })),
      monthly: undeclaredMonthly, incomeFound: undeclaredIncome,
    },
  })

  const bnplGroups = commitGroups.filter(c => c.isBnpl)
  const bnplMonthly = round2(bnplGroups.reduce((s, c) => s + c.monthly, 0))
  const bnplTxns = bnplGroups.flatMap(c => c.group.txns)
  const bnplUndeclared = bnplGroups.filter(c => !c.declared).length
  cards.push({
    key: 'bnpl', title: 'Buy now pay later',
    value: bnplGroups.length ? fmtMoney(bnplMonthly) : fmtMoney(0),
    valueNumber: bnplMonthly,
    sub: bnplGroups.length
      ? `per month · ${bnplGroups.map(c => c.provider).join(', ')}${bnplUndeclared ? ` · ${bnplUndeclared === bnplGroups.length ? 'none' : `${bnplUndeclared}`} declared` : ''}`
      : 'No buy now pay later found',
    flag: bnplUndeclared ? 'action' : bnplGroups.length ? 'query' : 'ok',
    flagLabel: bnplGroups.length ? `${bnplGroups.length} provider${bnplGroups.length === 1 ? '' : 's'}` : undefined,
    drill: 'transactions', txnIds: ids(bnplTxns),
    detail: {
      providers: bnplGroups.map(c => ({
        provider: c.provider, monthly: c.monthly, count: c.group.count, cadence: c.group.cadence,
        declared: Boolean(c.declared), ids: ids(c.group.txns),
        returns: c.group.txns.filter(isDishonour).length,
      })),
      monthly: bnplMonthly,
      watchlist: R.bnpl.map(p => p.name),
    },
  })

  // ---- conduct --------------------------------------------------------
  const dishonourTxns = all.filter(isDishonour)
  // A fee and the item it belongs to land on the same day. That is one event.
  const eventDates = [...new Set(dishonourTxns.map(t => t.date))].sort()
  const dishonourEvents = eventDates.map(date => {
    const onDay = dishonourTxns.filter(t => t.date === date)
    const item = onDay.find(t => !/fee/i.test(t.description)) || onDay[0]
    const key = payerRoot(item)
    // Represented and paid? A successful debit to the same payer inside a
    // fortnight is the timing accident; nothing after it is a missed obligation.
    const repaid = all.some(t =>
      t.amount < 0 && !isDishonour(t) && payerRoot(t) === key &&
      ms(t.date) > ms(date) && ms(t.date) <= ms(date) + 14 * DAY)
    return { date, payer: item.merchant || item.description, amount: round2(onDay.reduce((s, t) => s + t.amount, 0)), repaid, ids: ids(onDay) }
  })
  const unrepaid = dishonourEvents.filter(e => !e.repaid).length
  cards.push({
    key: 'dishonours', title: 'Dishonours',
    value: String(dishonourEvents.length),
    valueNumber: dishonourEvents.length,
    sub: dishonourEvents.length
      ? `${unrepaid} with no repayment found afterwards`
      : 'None in the period',
    flag: unrepaid ? 'action' : dishonourEvents.length ? 'query' : 'ok',
    flagLabel: unrepaid ? 'Explain' : undefined,
    drill: 'transactions', txnIds: ids(dishonourTxns),
    detail: { events: dishonourEvents, unrepaid },
  })

  const gamblingTxns = debits.filter(t => isGambling(t, R))
  const gamblingTotal = round2(Math.abs(gamblingTxns.reduce((s, t) => s + t.amount, 0)))
  const gamblingPct = totalCredits > 0 ? Math.round((gamblingTotal / totalCredits) * 1000) / 10 : 0
  const gamblingByMonth = new Map<string, number>()
  for (const t of gamblingTxns) {
    const m = t.date.slice(0, 7)
    gamblingByMonth.set(m, round2((gamblingByMonth.get(m) || 0) + Math.abs(t.amount)))
  }
  const gMonths = [...gamblingByMonth.entries()].sort()
  const gRising = gMonths.length >= 3 && gMonths[gMonths.length - 1][1] > gMonths[0][1] * 1.5
  cards.push({
    key: 'gambling', title: 'Gambling spend',
    value: fmtMoney(gamblingTotal),
    valueNumber: gamblingTotal,
    sub: gamblingTxns.length
      ? `${gamblingTxns.length} debits over ${days} days · ${gamblingPct}% of credits${gRising ? ' · rising' : ''}`
      : 'None in the period',
    flag: !gamblingTxns.length ? 'ok' : (gamblingPct >= R.gamblingPct || gRising) ? 'action' : 'query',
    flagLabel: gamblingTxns.length ? ((gamblingPct >= R.gamblingPct || gRising) ? 'Explain' : 'Note') : undefined,
    drill: 'transactions', txnIds: ids(gamblingTxns),
    detail: { total: gamblingTotal, pctOfCredits: gamblingPct, byMonth: gMonths.map(([m, v]) => ({ month: m, amount: v })), rising: gRising, count: gamblingTxns.length },
  })

  const cashTxns = external.filter(t => isCash(t) && Math.abs(t.amount) >= R.cashThreshold)
  const cashIn = cashTxns.filter(t => t.amount > 0)
  // A cash deposit with a cash withdrawal of similar size just before it is money
  // going back in. One with nothing behind it is a question: gift, or income.
  const unexplainedIn = cashIn.filter(dep => !cashTxns.some(w =>
    w.amount < 0 && Math.abs(Math.abs(w.amount) - dep.amount) < dep.amount * 0.2 &&
    ms(w.date) < ms(dep.date) && ms(w.date) >= ms(dep.date) - 7 * DAY))
  const cashTotal = round2(cashTxns.reduce((s, t) => s + Math.abs(t.amount), 0))
  cards.push({
    key: 'cash', title: 'Large cash movements',
    value: fmtMoney(cashTotal, 0),
    valueNumber: cashTotal,
    sub: cashTxns.length
      ? `${cashTxns.length} over ${fmtMoney(R.cashThreshold, 0)}${unexplainedIn.length ? ` · ${unexplainedIn.length} deposit${unexplainedIn.length === 1 ? '' : 's'} unexplained` : ''}`
      : `Nothing over ${fmtMoney(R.cashThreshold, 0)}`,
    flag: unexplainedIn.length ? 'query' : cashTxns.length ? 'query' : 'ok',
    flagLabel: cashTxns.length ? 'Note' : undefined,
    drill: 'transactions', txnIds: ids(cashTxns),
    detail: {
      threshold: R.cashThreshold, count: cashTxns.length, total: cashTotal,
      unexplainedDeposits: unexplainedIn.map(t => ({ date: t.date, description: t.description, amount: t.amount, id: t.externalId })),
    },
  })

  cards.push({
    key: 'overdrawn', title: 'Days overdrawn',
    value: balances.available ? String(balances.daysOverdrawn) : '—',
    valueNumber: balances.available ? balances.daysOverdrawn : null,
    sub: balances.available
      ? (balances.daysOverdrawn
          ? `${balances.daysOverdrawn} day${balances.daysOverdrawn === 1 ? '' : 's'} below zero · lowest ${balances.lowest ? signed(balances.lowest.balance) : '—'}`
          : `No episodes · lowest balance ${balances.lowest ? fmtMoney(balances.lowest.balance) : '—'}`)
      : 'Balances not supplied with these statements',
    flag: !balances.available ? 'unavailable' : balances.daysOverdrawn > 3 ? 'action' : balances.daysOverdrawn ? 'query' : 'ok',
    drill: 'balances', txnIds: [],
    detail: { balances },
  })

  // ---- savings and housing --------------------------------------------
  const rentPaidTxns = debits.filter(t => t.category.toLowerCase() === 'rent' || (isRealEstateAgent(t, R) && !isCommitment(t, R)))
  const rentPaidGroups = groupBy(rentPaidTxns).filter(g => g.count >= 2)
  const rentPaidRecurring = rentPaidGroups.flatMap(g => g.txns)
  const rentPaidAnnualisable = rentPaidRecurring.length > 0
  const rentPaidMonthly = rentPaidAnnualisable
    ? round2(Math.abs(rentPaidRecurring.reduce((s, t) => s + t.amount, 0)) * perMonth) : 0
  const rentDays = rentPaidRecurring.map(t => Number(t.date.slice(8, 10)))
  const rentOnTime = rentDays.length > 1
    ? rentDays.every(d => Math.abs(d - rentDays[0]) <= 3 || Math.abs(d - rentDays[0]) >= 27)
    : rentDays.length === 1
  cards.push({
    key: 'rentPaid', title: 'Rent paid',
    value: rentPaidAnnualisable ? fmtMoney(rentPaidMonthly) : '—',
    valueNumber: rentPaidAnnualisable ? rentPaidMonthly : null,
    sub: rentPaidAnnualisable
      ? `per month · ${rentPaidRecurring.length} payments${rentOnTime ? ' · all on the same day of the month' : ' · dates move around'}`
      : rentPaidTxns.length
        ? `${rentPaidTxns.length} rent payment${rentPaidTxns.length === 1 ? '' : 's'} found but none repeating — not annualised`
        : 'No rent payments found — the client may own where they live',
    flag: !rentPaidAnnualisable ? 'unavailable' : rentOnTime ? 'ok' : 'query',
    flagLabel: !rentPaidAnnualisable ? undefined : rentOnTime ? 'On time' : 'Irregular',
    drill: 'transactions', txnIds: ids(rentPaidTxns),
    detail: { monthly: rentPaidMonthly, onTime: rentOnTime, sources: rentPaidGroups.map(g => ({ payer: g.payer, count: g.count, cadence: g.cadence, total: g.total })) },
  })

  // Genuine savings is not the balance - it is the part that has stayed put. The
  // lowest the combined balance reached is the honest floor.
  const seasonFrom = new Date(Math.max(ms(parsed.periodFrom), ms(parsed.periodTo) - R.savingsWindowDays * DAY)).toISOString().slice(0, 10)
  const seasonPoints = balances.combined.filter(p => p.date >= seasonFrom)
  const genuine = seasonPoints.length ? round2(Math.min(...seasonPoints.map(p => p.balance))) : null
  const seasonDays = seasonPoints.length
  cards.push({
    key: 'genuineSavings', title: 'Genuine savings',
    value: genuine === null ? '—' : fmtMoney(genuine, 0),
    valueNumber: genuine,
    sub: genuine === null ? balances.reason
      : `lowest combined balance over the last ${seasonDays} days · of ${fmtMoney(balances.closingTotal, 0)} held today`,
    flag: genuine === null ? 'unavailable' : genuine > 0 ? 'ok' : 'query',
    flagLabel: genuine === null ? undefined : genuine > 0 ? 'Held' : undefined,
    drill: 'balances', txnIds: [],
    detail: { genuine, closingTotal: balances.closingTotal, seasonFrom, seasonDays, monthEnds: balances.monthEnds, reason: balances.reason },
  })
  cards.push({
    key: 'savingsTrend', title: 'Savings trend',
    value: balances.trendPerMonth === null ? '—' : (balances.trendPerMonth >= 0 ? '+' : '−') + fmtMoney(balances.trendPerMonth, 0),
    valueNumber: balances.trendPerMonth,
    sub: balances.trendPerMonth === null ? balances.reason
      : `per month across ${balances.monthEnds.length} month end${balances.monthEnds.length === 1 ? '' : 's'}`,
    flag: balances.trendPerMonth === null ? 'unavailable' : balances.trendPerMonth > 0 ? 'ok' : 'query',
    flagLabel: balances.trendPerMonth === null ? undefined : balances.trendPerMonth > 0 ? 'Rising' : 'Falling',
    drill: 'balances', txnIds: [],
    detail: { monthEnds: balances.monthEnds, trendPerMonth: balances.trendPerMonth, reason: balances.reason },
  })
  cards.push({
    key: 'lowestBalance', title: 'Lowest balance',
    value: balances.lowest ? fmtMoney(balances.lowest.balance) : '—',
    valueNumber: balances.lowest ? balances.lowest.balance : null,
    sub: balances.lowest
      ? `${balances.lowest.name} · ${new Date(balances.lowest.date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
      : balances.reason,
    flag: !balances.lowest ? 'unavailable' : balances.lowest.balance < 0 ? 'action' : 'ok',
    drill: 'transactions',
    txnIds: balances.lowest ? ids(all.filter(t => t.date === balances.lowest!.date)) : [],
    detail: { lowest: balances.lowest, reason: balances.reason },
  })

  // ---- the score ------------------------------------------------------
  // This scores THE FILE, not the client. It measures how much of what was
  // declared the statements confirm and how many questions are still open.
  // Nothing in it is an opinion about creditworthiness; it is never shown to the
  // client and never sent to a lender.
  let incomeScore = 100, incomeOpen = 0
  const incomeNotes: string[] = []
  if (salaryVariancePct !== null && Math.abs(salaryVariancePct) > R.salaryActionPct) { incomeScore -= 25; incomeOpen++; incomeNotes.push(`salary credits ${Math.abs(salaryVariancePct)}% ${salaryVariancePct < 0 ? 'under' : 'over'} declared`) }
  else if (salaryVariancePct !== null && Math.abs(salaryVariancePct) > R.salaryQueryPct) { incomeScore -= 15; incomeOpen++; incomeNotes.push(`salary credits ${Math.abs(salaryVariancePct)}% ${salaryVariancePct < 0 ? 'under' : 'over'} declared`) }
  else if (salaryVariancePct !== null) incomeNotes.push('salary credits agree with the fact find')
  if (salaryGroups.length && !declaredInc.employmentAnnual) { incomeScore -= 20; incomeOpen++; incomeNotes.push('salary credits found with no employment income declared') }
  if (undeclaredIncome > 0) { incomeScore -= 15; incomeOpen++; incomeNotes.push(`${fmtMoney(otherMonthly)} a month of income not on the fact find`) }
  if (stabilityFails > 0) { incomeScore -= 15; incomeOpen++; incomeNotes.push(`${stabilityFails} income stability test${stabilityFails === 1 ? '' : 's'} failed`) }
  // A hole in the pay run is not automatically a problem - parental leave, a
  // change of employer, pay landing in an account we were not given. It IS
  // automatically a question, and it must not be able to pass unasked.
  if (salaryHasGap) { incomeScore -= 15; incomeOpen++; incomeNotes.push(`${salaryGapDays} days with no pay credit`) }
  if (rentVariancePct !== null && rentVariancePct < -R.rentalTolerancePct) { incomeScore -= 10; incomeOpen++; incomeNotes.push('rent received well under declared') }
  else if (rentVariancePct !== null) incomeNotes.push('rental consistent')
  incomeScore = Math.max(0, incomeScore)

  const commitScore = commitGroups.length === 0 ? 100
    : Math.round(((commitGroups.length - undeclared.length) / commitGroups.length) * 100)
  const commitNote = commitGroups.length === 0
    ? 'No credit commitments found in the accounts'
    : undeclared.length === 0
      ? `All ${commitGroups.length} obligations seen are on the fact find`
      : `${commitGroups.length - undeclared.length} of ${commitGroups.length} obligations declared · ${undeclared.map(c => c.provider).join(', ')} missing`

  let conductScore = 100, conductOpen = 0
  const conductNotes: string[] = []
  if (unrepaid) { conductScore -= Math.min(30, unrepaid * 15); conductOpen += unrepaid; conductNotes.push(`${unrepaid} dishonour${unrepaid === 1 ? '' : 's'} with no repayment`) }
  else if (dishonourEvents.length) conductNotes.push(`${dishonourEvents.length} dishonour${dishonourEvents.length === 1 ? '' : 's'}, all repaid`)
  else conductNotes.push('no dishonours')
  if (balances.available && balances.daysOverdrawn > 3) { conductScore -= 20; conductOpen++; conductNotes.push(`${balances.daysOverdrawn} days overdrawn`) }
  else if (balances.available && balances.daysOverdrawn) { conductScore -= 10; conductOpen++; conductNotes.push(`${balances.daysOverdrawn} day${balances.daysOverdrawn === 1 ? '' : 's'} overdrawn`) }
  else if (balances.available) conductNotes.push('no overdrawn days')
  if (gamblingPct >= R.gamblingPct || gRising) { conductScore -= 15; conductOpen++; conductNotes.push(`gambling ${gamblingPct}% of credits${gRising ? ' and rising' : ''}`) }
  else if (gamblingTxns.length) { conductScore -= 5; conductNotes.push(`gambling present at ${gamblingPct}% of credits`) }
  if (unexplainedIn.length) { conductScore -= Math.min(20, unexplainedIn.length * 10); conductOpen += unexplainedIn.length; conductNotes.push(`${unexplainedIn.length} unexplained cash deposit${unexplainedIn.length === 1 ? '' : 's'}`) }
  conductScore = Math.max(0, conductScore)

  const coverageScore = covAccounts.length === 0 ? 0
    : Math.round(covAccounts.reduce((s, a) => s + Math.min(100, a.pct), 0) / covAccounts.length)

  const components = [
    { key: 'income', label: 'Income verified', weight: 30, score: incomeScore, open: incomeOpen, note: incomeNotes.join(' · ') || 'nothing to verify' },
    { key: 'commitments', label: 'Commitments matched', weight: 30, score: commitScore, open: undeclared.length, note: commitNote },
    { key: 'conduct', label: 'Conduct', weight: 25, score: conductScore, open: conductOpen, note: conductNotes.join(' · ') },
    { key: 'coverage', label: 'Coverage', weight: 15, score: coverageScore, open: shortAccounts.length, note: coverageNote },
  ]
  const total = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0) / 100)
  const openItems = components.reduce((s, c) => s + c.open, 0)

  // ---- worklist -------------------------------------------------------
  const worklist: Analysis['worklist'] = []
  if (undeclared.length) worklist.push({
    key: 'undisclosed_commitments', flag: 'action', label: 'Action', card: 'undisclosed',
    text: `${fmtMoney(undeclaredMonthly)} a month of commitments not declared — ${undeclared.map(c => c.provider).join(', ')}. Re-run servicing before you call the client.`,
  })
  // One cause, one question.
  //
  // Fabio, 31 Aug 2026, on the Viragova file: "these 3 all cover the same". He
  // was right — a 124 day hole in the pay run is ALSO why the credits came out
  // 55.8% under the declared gross and why four stability tests failed. Three
  // rows, one fact, and answering any of them answers the others. A list that
  // repeats itself stops being read.
  //
  // So when there is a gap, the gap owns the question. The variance is not simply
  // dropped though: it is re-measured against the run rate, because "still short
  // even on what they earn NOW" is a different question from "short because of
  // the months they were not paid", and only the first one deserves its own row.
  const runVariancePct = (salaryHasGap && runGrossAnnual && declaredInc.employmentAnnual)
    ? Math.round(((runGrossAnnual - declaredInc.employmentAnnual) / declaredInc.employmentAnnual) * 1000) / 10
    : null
  const varianceIsJustTheGap = salaryHasGap
    && (runVariancePct === null || Math.abs(runVariancePct) <= R.salaryQueryPct)

  if (salaryVariancePct !== null && Math.abs(salaryVariancePct) > R.salaryQueryPct && !varianceIsJustTheGap) {
    const onRunRate = salaryHasGap && runVariancePct !== null
    const pct = onRunRate ? Math.abs(runVariancePct!) : Math.abs(salaryVariancePct)
    const dir = (onRunRate ? runVariancePct! : salaryVariancePct) < 0 ? 'below' : 'above'
    worklist.push({
      key: 'salary_variance',
      flag: pct > R.salaryActionPct ? 'action' : 'query', label: 'Query', card: 'salaryVariance',
      text: onRunRate
        ? `Even on the current run rate — leaving the ${salaryGapDays} day gap out of it — the pay grosses to about ${fmtMoney(runGrossAnnual, 0)}, ${pct}% ${dir} the declared ${fmtMoney(declaredInc.employmentAnnual, 0)}. HELP or salary sacrifice would explain a shortfall, but it needs an answer on file.`
        : `Salary credits sit ${pct}% ${dir} the declared gross — HELP or salary sacrifice would explain a shortfall, but it needs an answer on file.`,
    })
  }
  if (unrepaid) worklist.push({
    key: 'dishonours', flag: 'action', label: 'Explain', card: 'dishonours',
    text: `${unrepaid} dishonour${unrepaid === 1 ? '' : 's'} with no repayment found afterwards.`,
  })
  if (unexplainedIn.length) worklist.push({
    key: 'cash_deposits', flag: 'query', label: 'Note', card: 'cash',
    text: `${unexplainedIn.map(t => fmtMoney(t.amount)).join(', ')} deposited in cash with no matching withdrawal — gift letter or undeclared income.`,
  })
  if (gamblingPct >= R.gamblingPct || gRising) worklist.push({
    key: 'gambling', flag: 'query', label: 'Note', card: 'gambling',
    text: `Gambling is ${gamblingPct}% of credits${gRising ? ' and rising month on month' : ''}.`,
  })
  // Every stability test that fails on a file with a gap fails BECAUSE of the
  // gap — irregular cycle, cycles missed, longest gap, amounts moving. Asking
  // about it separately is asking the same question twice.
  if (stabilityFails > 0 && !salaryHasGap) worklist.push({
    key: 'income_stability', flag: 'query', label: 'Check', card: 'stability',
    text: `${stabilityFails} income stability test${stabilityFails === 1 ? '' : 's'} failed, so the annualised salary is less reliable than usual.`,
  })
  if (salaryHasGap) worklist.push({
    key: 'salary_gap', flag: 'action', label: 'Ask the client', card: 'salary',
    text: `No salary credit between ${auDate(salaryGapFrom)} and ${auDate(salaryGapTo)} — ${salaryGapDays} days.`
      + (stabilityFails > 0 || varianceIsJustTheGap
        ? ` That one gap is also why ${[
            stabilityFails > 0 ? `${stabilityFails} of the income stability tests failed` : '',
            varianceIsJustTheGap && salaryVariancePct !== null ? `the credits come out ${Math.abs(salaryVariancePct)}% under the declared gross` : '',
          ].filter(Boolean).join(' and ')}, so it is asked once here rather than three times.`
        : '')
      + ` Ask the client why and put the answer on file: parental leave, a change of employer, or pay going to an account we have not been given.`
      + (runRateMonthly > 0 ? ` Until it is answered, assess on the run rate of ${fmtMoney(runRateMonthly)} a month rather than the period average.` : ''),
  })
  if (!coverageComplete) worklist.push({
    key: 'coverage', flag: 'query', label: 'Coverage', card: 'overdrawn',
    text: coverageNote,
  })
  if (undeclaredIncome > 0) worklist.push({
    key: 'income_not_declared', flag: 'favourable', label: 'In their favour', card: 'incomeNotDeclared',
    text: `${fmtMoney(undeclaredIncome, 0)} a year of income not declared — ${recurringOther.map(describeOther).join(', ')}. Get the evidence and it may cover the commitments above.`,
  })

  return {
    version: ANALYSIS_VERSION,
    generatedAt: new Date().toISOString(),
    period: { from: parsed.periodFrom, to: parsed.periodTo, days, fys, dominantFy: domFy },
    coverage: { complete: coverageComplete, note: coverageNote, accounts: covAccounts },
    client: parsed.client,
    institutions: parsed.institutions,
    txnCount: all.length,
    balances,
    cards,
    worklist,
    score: { total, components, openItems },
    rules: R,
    warnings,
  }
}
