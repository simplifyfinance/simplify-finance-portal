// WHAT THE CLIENT'S BANK STATEMENTS ALREADY COVER.
//
// A client who has been through CashDeck has already sent us most of what the
// document list asks for. Asking again is the thing this whole feature exists to
// stop. Fabio, 3 Sep 2026: "when the bank statements come in, always check that
// and then if a NAB credit card is already on file because it has been analysed,
// just automatically cross that."
//
// THREE DELIBERATE LIMITS, so this stays something people trust:
//
// 1. BANK LEVEL ONLY. No account numbers, no card digits. The fact find records
//    a bank against each debt; the statements record which banks arrived; that
//    is the whole match. A NAB home loan with three splits does not need three
//    of anything - NAB statements arrived, or they did not.
//
// 2. NOTHING IS EVER HIDDEN. A covered row goes quiet with its reason showing,
//    and can still be ticked back on by anybody who disagrees. A wrong guess
//    costs a glance, never a missing document.
//
// 3. AN UNKNOWN BANK IS SAID OUT LOUD, not silently ignored. Statements from a
//    bank the fact find has never heard of is an undeclared account, and it is
//    the kind a lender finds later.

export type StatementUpload = {
  institutions?: string[] | null
  period_from?: string | null
  period_to?: string | null
  days?: number | null
}

// Only the columns this needs. The full transaction row is much wider.
export type CoverTxn = {
  institution?: string | null
  account_number?: string | null
  account_name?: string | null
  category?: string | null
  summary_category?: string | null
  amount?: number | null
}

// A lender as the library holds it, plus what it calls itself on a statement.
export type LenderCode = { name: string; statement_codes?: string | null }

const txt = (v: any) => String(v ?? '').trim()
const norm = (v: any) => txt(v).toLowerCase().replace(/[^a-z0-9]/g, '')

// --- translating a statement's short code into a lender ---------------------

// "CBA" is what a statement says; "Commonwealth Bank" is what the fact find
// says. The bridge is a column on the lender library, maintained by the team
// rather than buried in code.
export function lenderForCode(code: string, lenders: LenderCode[]): string | null {
  const c = norm(code)
  if (!c) return null
  for (const l of lenders) {
    if (norm(l.name) === c) return l.name
    const codes = txt(l.statement_codes).split(',').map(norm).filter(Boolean)
    if (codes.includes(c)) return l.name
  }
  return null
}

export type BanksSeen = {
  // Lender names, translated. What the fact find would call them.
  known: string[]
  // Codes nothing in the library recognises. Shown so somebody can say which
  // bank it is, and the library learns it.
  unrecognised: string[]
  from: string | null
  to: string | null
  days: number
}

export function banksSeen(uploads: StatementUpload[], lenders: LenderCode[]): BanksSeen {
  const known = new Set<string>()
  const unrecognised = new Set<string>()
  let from: string | null = null, to: string | null = null, days = 0

  for (const u of uploads || []) {
    for (const code of u?.institutions || []) {
      const name = lenderForCode(code, lenders)
      if (name) known.add(name)
      else if (txt(code)) unrecognised.add(txt(code))
    }
    if (u?.period_from && (!from || u.period_from < from)) from = u.period_from
    if (u?.period_to && (!to || u.period_to > to)) to = u.period_to
    days = Math.max(days, Number(u?.days) || 0)
  }
  return { known: [...known], unrecognised: [...unrecognised], from, to, days }
}

// How many separate accounts arrived from each bank. Counted, never matched -
// three NAB accounts is a fact worth showing, not a puzzle to solve.
export function accountsPerBank(txns: CoverTxn[], lenders: LenderCode[]): Record<string, number> {
  const seen = new Map<string, Set<string>>()
  for (const t of txns || []) {
    const name = lenderForCode(txt(t?.institution), lenders) || txt(t?.institution)
    if (!name) continue
    const acct = txt(t?.account_number) || txt(t?.account_name) || 'unknown'
    if (!seen.has(name)) seen.set(name, new Set())
    seen.get(name)!.add(acct)
  }
  const out: Record<string, number> = {}
  for (const [k, v] of seen) out[k] = v.size
  return out
}

// --- crossing rows off ------------------------------------------------------

export type Covered = { key: string; bank: string; days: number }

// A row is covered when statements arrived from the bank it names. That is all.
// A row naming no bank - the salary and expenses accounts, ID, a rates notice -
// is never crossed off this way; those are answered elsewhere or not at all.
export function coveredRows(
  rows: { key: string; coveredByBank?: string }[],
  seen: BanksSeen,
): Covered[] {
  const banks = new Set(seen.known.map(norm));
  const out: Covered[] = []
  for (const r of rows || []) {
    const bank = txt(r?.coveredByBank)
    if (!bank) continue
    if (banks.has(norm(bank))) out.push({ key: r.key, bank, days: seen.days })
  }
  return out
}

// Some documents want six months and some want three. The uploads say how many
// days actually arrived, so a short period can be said out loud rather than
// discovered by a lender.
export function shortOfPeriod(detail: string | undefined, days: number): number | null {
  const m = /last (\d+) months?/i.exec(txt(detail))
  if (!m) return null
  const wanted = Number(m[1]) * 30
  return days > 0 && days < wanted - 10 ? wanted : null
}

// --- the account the salary lands in ----------------------------------------

// CashDeck classifies the line, so this is read rather than guessed. Fabio,
// 3 Sep 2026: "the bank statements is already analysing salary credits. So he
// knows exactly what account the salary credits are coming in."
const WAGES = /wage|salary|payroll/i

export type NamedAccount = { bank: string; account: string; count: number }

export function salaryAccounts(txns: CoverTxn[], lenders: LenderCode[]): NamedAccount[] {
  return topAccounts(txns, lenders, t =>
    WAGES.test(`${txt(t?.category)} ${txt(t?.summary_category)}`) && Number(t?.amount) > 0)
}

// THE HONEST BIT: there is no "expenses" classification, so this is the account
// most of the spending goes out of - most separate payments out, ignoring the
// wages coming in. It is a heuristic, and it is named as one on screen rather
// than presented as a fact.
export function expensesAccount(txns: CoverTxn[], lenders: LenderCode[]): NamedAccount | null {
  return topAccounts(txns, lenders, t => Number(t?.amount) < 0)[0] || null
}

function topAccounts(txns: CoverTxn[], lenders: LenderCode[], keep: (t: CoverTxn) => boolean): NamedAccount[] {
  const counts = new Map<string, NamedAccount>()
  for (const t of txns || []) {
    if (!keep(t)) continue
    const bank = lenderForCode(txt(t?.institution), lenders) || txt(t?.institution)
    const account = txt(t?.account_name) || txt(t?.account_number)
    if (!bank) continue
    const id = `${bank}|${account}`
    const found = counts.get(id)
    if (found) found.count++
    else counts.set(id, { bank, account, count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

// --- the bank nobody declared -----------------------------------------------

// Bank level, like everything else here. Statements arrived from somewhere the
// fact find has no account, card or loan against - which is either a naming
// mismatch or an undeclared debt, and both are worth one question.
export function undeclaredBanks(seen: BanksSeen, deal: any, lenders: LenderCode[]): string[] {
  const ff = deal?.fact_find_data || {}
  const declared = new Set<string>()

  const add = (v: any) => {
    const name = lenderForCode(txt(v), lenders) || txt(v)
    if (name) declared.add(norm(name))
  }
  for (const l of ff.liabilities || []) add(l?.lenderName)
  for (const a of ff.assets || []) add(a?.description)
  for (const p of ff.properties || []) for (const loan of p?.loans || []) add(loan?.lenderName)

  return seen.known.filter(b => !declared.has(norm(b)))
}
