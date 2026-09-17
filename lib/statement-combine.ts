// EVERY SET OF STATEMENTS ON A DEAL, READ AS ONE.
//
// Fabio, 17 Sep 2026: "bank statements tab we can only drop 1 set of statements
// we need multiple... should be one however for example siblings so one analysis
// but still when reporting flag which person."
//
// NOTHING WAS EVER LOST. Every workbook dropped on a deal is already its own row
// with its own transactions - the tab asked for the newest one and showed only
// that, so a second set has been invisible rather than missing. This reads the
// lot and hands it to analyse() as a single ledger, so one deal gets one score,
// one coverage check and one set of findings.
//
// AND NOTHING IS GUESSED ON THE WAY. The balances a lender's conduct assessment
// depends on are stored per upload in parsed_meta, so a rebuild is faithful: the
// combined analysis sees exactly what the individual ones saw. If that had not
// been true this would have had to store them first, because an analysis that
// quietly loses balances changes a number that goes to a lender.

import type { ParsedStatements, ParsedTxn, ParsedAccount } from './statement-parse'

const txt = (v: any) => String(v ?? '').trim()

// One stored workbook. Only the fields this file reads.
export type StoredUpload = {
  id: string
  file_name?: string
  client_name?: string | null
  uploaded_at?: string
  parsed_meta?: any
}

// One stored transaction, exactly as the columns are named.
export type StoredTxn = {
  upload_id: string
  external_id?: string
  txn_date?: string
  description?: string
  merchant?: string
  account_number?: string
  account_name?: string
  institution?: string
  category?: string
  summary_category?: string
  category_type?: string
  amount?: number | string
}

// WHOSE STATEMENTS THESE ARE. The name off the workbook itself, which is the
// client CashDeck exported it for. Falling back to the file name is better than
// an empty chip: a person can read a file name and know whose it is.
export function personOf(u: StoredUpload | null | undefined): string {
  return txt(u?.client_name) || txt(u?.parsed_meta?.client?.firstName)
    || txt(u?.file_name) || 'Unnamed set'
}

const dayMs = 86_400_000
const asDate = (v: any) => { const d = new Date(txt(v)); return isNaN(d.getTime()) ? null : d }

export function daysBetween(from: any, to: any): number {
  const a = asDate(from), b = asDate(to)
  if (!a || !b) return 0
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / dayMs) + 1)
}

// The period the whole deal covers: the earliest start of any set to the latest
// end of any set. A set covering three months inside a six month one does not
// shrink the period - it shows up as an account with poor coverage, which is the
// honest way for it to appear and the way a lender reads it.
export function periodOf(uploads: StoredUpload[]): { from: string; to: string; days: number } {
  const froms = uploads.map(u => txt(u?.parsed_meta?.periodFrom)).filter(Boolean).sort()
  const tos = uploads.map(u => txt(u?.parsed_meta?.periodTo)).filter(Boolean).sort()
  const from = froms[0] || ''
  const to = tos[tos.length - 1] || ''
  return { from, to, days: from && to ? daysBetween(from, to) : 0 }
}

// Which person each account belongs to. Built from the transactions, because a
// transaction knows both its account and the workbook it arrived in - so a
// finding can say "Joshua, ubank 3306" instead of an account number nobody can
// place.
export function peopleByAccount(uploads: StoredUpload[], txns: StoredTxn[]): Record<string, string> {
  const person = new Map(uploads.map(u => [txt(u.id), personOf(u)]))
  const out: Record<string, string> = {}
  for (const t of txns || []) {
    const acct = txt(t.account_number)
    if (!acct || out[acct]) continue
    out[acct] = person.get(txt(t.upload_id)) || ''
  }
  return out
}

function accountsOf(uploads: StoredUpload[]): ParsedAccount[] {
  const out: ParsedAccount[] = []
  const seen = new Set<string>()
  for (const u of uploads) {
    for (const a of (u?.parsed_meta?.accounts || []) as ParsedAccount[]) {
      const key = txt(a?.accountNumber) || `${txt(a?.institution)}|${txt(a?.name)}`
      // The same account in two workbooks is one account. Keeping both would
      // count its coverage twice and its balance twice.
      if (seen.has(key)) continue
      seen.add(key)
      out.push(a)
    }
  }
  return out
}

function txnOf(t: StoredTxn): ParsedTxn {
  return {
    externalId: txt(t.external_id),
    date: txt(t.txn_date).slice(0, 10),
    description: txt(t.description),
    merchant: txt(t.merchant),
    accountNumber: txt(t.account_number),
    accountName: txt(t.account_name),
    institution: txt(t.institution),
    category: txt(t.category),
    summaryCategory: txt(t.summary_category),
    categoryType: txt(t.category_type),
    amount: Number(t.amount) || 0,
  }
}

// The whole deal as one workbook, in the shape analyse() already reads. Nothing
// about the analysis itself changes - it is handed more transactions and more
// accounts, and everything it works out, it works out the same way.
export function combine(uploads: StoredUpload[], txns: StoredTxn[]): ParsedStatements {
  const sets = (uploads || []).filter(Boolean)
  const period = periodOf(sets)
  const institutions = [...new Set(sets.flatMap(u =>
    ((u?.parsed_meta?.institutions || []) as any[]).map(txt).filter(Boolean)))]
  const first = sets[0]
  return {
    source: 'cashdeck',
    client: first?.parsed_meta?.client
      || { firstName: '', lastName: '', email: '', mobile: '', externalId: '' },
    accounts: accountsOf(sets),
    institutions,
    transactions: (txns || []).map(txnOf).sort((a, b) => a.date.localeCompare(b.date)),
    periodFrom: period.from,
    periodTo: period.to,
    days: period.days,
    balancesAvailable: sets.some(u => u?.parsed_meta?.balancesAvailable === true),
    warnings: sets.flatMap(u => ((u?.parsed_meta?.warnings || []) as any[]).map(txt).filter(Boolean)),
  }
}

// WHAT REMOVING A SET WOULD COST, said before it is removed rather than after.
// A plain "are you sure" names neither the transactions nor the hole it leaves.
export function removalCost(uploads: StoredUpload[], txns: StoredTxn[], uploadId: string):
    { transactions: number; person: string; leavesGap: boolean; keptSets: number } {
  const going = txns.filter(t => txt(t.upload_id) === txt(uploadId))
  const rest = uploads.filter(u => txt(u.id) !== txt(uploadId))
  const before = periodOf(uploads)
  const after = periodOf(rest)
  return {
    transactions: going.length,
    person: personOf(uploads.find(u => txt(u.id) === txt(uploadId))),
    // The period being assessed gets shorter at one end or the other.
    leavesGap: rest.length > 0 && (after.from > before.from || after.to < before.to),
    keptSets: rest.length,
  }
}
