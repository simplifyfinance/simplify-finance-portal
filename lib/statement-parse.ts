import ExcelJS from 'exceljs'

// Reads a CashDeck income verification workbook into plain rows.
//
// This file only reads. It makes no judgement about what a transaction means -
// that is statement-analysis.ts - so that a change to CashDeck's export breaks
// one file rather than the whole feature.
//
// The workbook that matters is "All Transactions" (CashDeck writes a trailing
// space in the sheet name, so every lookup here trims). "Accounts" carries the
// institution each account belongs to and its closing balance; "Summary" carries
// who the statements belong to.

export type ParsedTxn = {
  externalId: string
  date: string            // YYYY-MM-DD
  description: string
  merchant: string
  accountNumber: string
  accountName: string
  institution: string
  category: string
  summaryCategory: string
  categoryType: string    // Income | Expense | Outgoings
  amount: number          // signed: positive is money in
}

export type ParsedAccount = {
  accountNumber: string
  name: string
  institution: string
  available: number | null
  currentBalance: number | null
  from: string
  to: string
  txnCount: number
}

export type ParsedStatements = {
  source: 'cashdeck'
  client: { firstName: string; lastName: string; email: string; mobile: string; externalId: string }
  accounts: ParsedAccount[]
  institutions: string[]
  transactions: ParsedTxn[]
  periodFrom: string
  periodTo: string
  days: number
  balancesAvailable: boolean
  warnings: string[]
}

export class StatementParseError extends Error {}

function sheet(wb: ExcelJS.Workbook, name: string) {
  return wb.worksheets.find(w => String(w.name || '').trim().toLowerCase() === name.toLowerCase())
}

function txt(v: any): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    if ('text' in v) return String((v as any).text).trim()
    if ('result' in v) return String((v as any).result).trim()
    if ('richText' in v) return (v as any).richText.map((r: any) => r.text).join('').trim()
  }
  return String(v).trim()
}

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'object' && v !== null && 'result' in v) return Number((v as any).result) || 0
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function isoDate(v: any): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = txt(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z')
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / 86400000) + 1
}

// Column order has moved between CashDeck versions, so the header row is read
// rather than assumed. A missing column is named in the error, not silently zero.
function headerMap(row: ExcelJS.Row): Record<string, number> {
  const map: Record<string, number> = {}
  row.eachCell((cell, col) => {
    const key = txt(cell.value).toLowerCase().replace(/[^a-z]/g, '')
    if (key) map[key] = col
  })
  return map
}

function parseAccounts(ws: ExcelJS.Worksheet | undefined, warnings: string[]) {
  const out: { accountNumber: string; name: string; institution: string; available: number | null; currentBalance: number | null }[] = []
  if (!ws) { warnings.push('The workbook has no Accounts sheet, so no bank names or balances were read.'); return out }

  let institution = ''
  ws.eachRow(row => {
    const vals = row.values as any[]
    const cells = vals.slice(1).map(txt)
    const filled = cells.filter(Boolean)
    if (filled.length === 0) return

    const first = cells.find(Boolean) || ''
    // A row carrying one value and nothing else is a bank heading.
    if (filled.length === 1) {
      if (/^(account balances|grand total)$/i.test(first)) return
      institution = first
      return
    }
    if (/^account number$/i.test(first)) return           // the repeated header
    if (!/\d/.test(first)) return                          // not an account number

    const idx = cells.findIndex(Boolean)
    out.push({
      accountNumber: first,
      name: cells[idx + 2] || cells[idx + 1] || '',
      institution: institution || 'Unknown',
      available: cells[idx + 3] === '' ? null : num(cells[idx + 3]),
      currentBalance: cells[idx + 4] === '' ? null : num(cells[idx + 4]),
    })
  })
  return out
}

function parseClient(ws: ExcelJS.Worksheet | undefined) {
  const c = { firstName: '', lastName: '', email: '', mobile: '', externalId: '' }
  if (!ws) return c
  ws.eachRow(row => {
    const vals = (row.values as any[]).slice(1).map(txt).filter(Boolean)
    if (vals.length < 2) return
    const key = vals[0].toLowerCase().replace(/[^a-z]/g, '')
    const val = vals[1]
    if (key === 'firstname') c.firstName = val
    else if (key === 'lastname') c.lastName = val
    else if (key === 'email') c.email = val
    else if (key === 'mobile') c.mobile = val
    else if (key === 'id') c.externalId = val.replace(/\.0$/, '')
  })
  return c
}

export async function parseCashDeck(buf: ArrayBuffer): Promise<ParsedStatements> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buf)
  } catch {
    throw new StatementParseError('That file could not be opened as a spreadsheet. Upload the CashDeck income verification workbook (.xlsm or .xlsx), not the PDF.')
  }

  const ws = sheet(wb, 'All Transactions')
  if (!ws) {
    throw new StatementParseError(
      `This does not look like a CashDeck workbook — it has no "All Transactions" sheet. Sheets found: ${wb.worksheets.map(w => w.name.trim()).join(', ') || 'none'}.`
    )
  }

  const warnings: string[] = []
  const h = headerMap(ws.getRow(1))
  const need = ['date', 'description', 'accountnumber', 'category', 'categorytype']
  const missing = need.filter(k => !h[k])
  if (missing.length) {
    throw new StatementParseError(`The All Transactions sheet is missing these columns: ${missing.join(', ')}. Nothing was read.`)
  }

  const accountRows = parseAccounts(sheet(wb, 'Accounts'), warnings)
  const instByAccount = new Map(accountRows.map(a => [a.accountNumber, a.institution]))

  const transactions: ParsedTxn[] = []
  let grossMismatches = 0
  let undated = 0

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const cell = (k: string) => (h[k] ? row.getCell(h[k]).value : null)

    const date = isoDate(cell('date'))
    const accountNumber = txt(cell('accountnumber'))
    const description = txt(cell('description'))
    if (!date && !description && !accountNumber) continue
    if (!date) { undated++; continue }

    // Credit minus debit is the truth. GrossAmount agrees on every row of every
    // file seen so far, but it is a derived column and this is money, so it is
    // checked rather than trusted.
    const debit = num(cell('debit'))
    const credit = num(cell('credit'))
    const amount = Math.round((credit - debit) * 100) / 100
    const gross = Math.round(num(cell('grossamount')) * 100) / 100
    if (h['grossamount'] && Math.abs(gross - amount) > 0.01) grossMismatches++

    transactions.push({
      externalId: txt(cell('transactionid')).replace(/\.0$/, '') || `${date}-${r}`,
      date,
      description,
      merchant: txt(cell('merchant')),
      accountNumber,
      accountName: txt(cell('account')),
      institution: instByAccount.get(accountNumber) || 'Unknown',
      category: txt(cell('category')),
      summaryCategory: txt(cell('summarycategory')),
      categoryType: txt(cell('categorytype')),
      amount,
    })
  }

  if (transactions.length === 0) {
    throw new StatementParseError('The All Transactions sheet has no dated rows, so there is nothing to analyse.')
  }
  if (undated > 0) warnings.push(`${undated} row${undated === 1 ? '' : 's'} had no date and were skipped.`)
  if (grossMismatches > 0) {
    warnings.push(`${grossMismatches} row${grossMismatches === 1 ? "'s" : "s'"} GrossAmount did not match credit minus debit. Credit minus debit was used.`)
  }

  const dates = transactions.map(t => t.date).sort()
  const periodFrom = dates[0], periodTo = dates[dates.length - 1]

  const accounts: ParsedAccount[] = []
  const seen = new Set<string>()
  for (const a of accountRows) {
    const mine = transactions.filter(t => t.accountNumber === a.accountNumber)
    seen.add(a.accountNumber)
    if (mine.length === 0) continue      // an account with no transactions in the window
    const d = mine.map(t => t.date).sort()
    accounts.push({ ...a, from: d[0], to: d[d.length - 1], txnCount: mine.length })
  }
  // Anything transacting that the Accounts sheet never listed. Named, not dropped.
  for (const t of transactions) {
    if (seen.has(t.accountNumber) || accounts.some(a => a.accountNumber === t.accountNumber)) continue
    const mine = transactions.filter(x => x.accountNumber === t.accountNumber)
    const d = mine.map(x => x.date).sort()
    accounts.push({
      accountNumber: t.accountNumber, name: t.accountName, institution: 'Unknown',
      available: null, currentBalance: null, from: d[0], to: d[d.length - 1], txnCount: mine.length,
    })
    seen.add(t.accountNumber)
    warnings.push(`Account ${t.accountNumber} has transactions but is not on the Accounts sheet, so its bank and balance are unknown.`)
  }

  // CashDeck writes 0.00 for a balance it was not given. If every account reads
  // zero, balances were not supplied and every balance-derived figure is withheld
  // rather than shown as zero.
  const balancesAvailable = accounts.some(a => (a.currentBalance ?? 0) !== 0 || (a.available ?? 0) !== 0)
  if (!balancesAvailable) {
    warnings.push('No account balances were supplied, so overdrawn days, lowest balance, genuine savings and the savings trend cannot be worked out from this file.')
  }

  const institutions = [...new Set(accounts.map(a => a.institution))].filter(x => x && x !== 'Unknown').sort()

  return {
    source: 'cashdeck',
    client: parseClient(sheet(wb, 'Summary')),
    accounts,
    institutions,
    transactions,
    periodFrom,
    periodTo,
    days: daysBetween(periodFrom, periodTo),
    balancesAvailable,
    warnings,
  }
}
