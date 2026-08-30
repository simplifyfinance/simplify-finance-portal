// Reads an SFG statement. Everything the importer needs to know comes from inside
// the file - the period, the broker and the kind - never from the filename, which
// is how you end up with "SFG Trail May 2026xlsx.xlsx" landing in the wrong month.
//
// A statement is only accepted when it reconciles against its own tax invoice:
// The invoice's own lines are the authority, and both are checked, not just the
// total:
//
//   commission line = detail rows        - amounts paid out to third parties
//   clawback line   = clawback rows      + referral clawbacks
//                                        - amounts recovered back from third parties
//
// A clawback on a referred loan is reversed on the partner too, so it costs the
// business the gross clawback LESS what comes back. Treating the gross as the cost
// overstates it - on the August 2025 statement, by $3,253.25.
//
// Signs are taken as the file states them. SFG changed the layout: 2025 statements
// carry a separate Referrals tab and show disbursements negative, 2026 statements
// dropped that tab and show them positive. The rules above reconcile both.

import ExcelJS from 'exceljs'

export type SfgLine = {
  kind: 'trail' | 'upfront' | 'clawback'
  lenderRaw: string
  loanRef: string
  clientName: string
  balance: number | null
  settlementAmount: number | null
  settlementDate: string | null
  grossExGst: number
  gst: number
  grossIncGst: number
}

// A row from the Referrals tab. No loan reference on that tab, so these belong
// to the statement rather than to a loan.
export type SfgReferralLine = {
  rowType: string
  sourceBroker: string
  lenderRaw: string
  clientName: string
  splitName: string
  paymentType: string
  paymentRate: number | null
  commissionExGst: number
  gst: number | null
  netIncGst: number | null
}

export type SfgStatement = {
  kind: 'trail' | 'upfront'
  periodMonth: string          // YYYY-MM-01
  periodLabel: string
  daysInMonth: number
  brokerEmail: string
  brokerName: string
  lines: SfgLine[]
  referralLines: SfgReferralLine[]
  // loan ref -> what was paid away to third parties, ex GST
  thirdParty: Record<string, number>
  splitName: Record<string, string>
  totals: {
    grossExGst: number         // the detail rows, before anything is paid away
    netCommissionExGst: number // the invoice's own commission line
    clawbackExGst: number      // the invoice's own clawback line, net of recoveries
    referralsExGst: number
    thirdPartyExGst: number    // paid away to third parties
    recoveredExGst: number     // clawed back from third parties
    bankedExGst: number        // what the invoice says was paid
    computedBanked: number     // what the lines add up to
    reconciled: boolean
    outBy: number
  }
}

const num = (v: any): number => {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'result' in (v as any)) return num((v as any).result)
  const n = Number(String(v).replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}
const str = (v: any): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    const o: any = v
    if (o.text) return String(o.text).trim()
    if (o.result !== undefined) return String(o.result).trim()
    if (Array.isArray(o.richText)) return o.richText.map((r: any) => r.text).join('').trim()
  }
  return String(v).trim()
}
const dateStr = (v: any): string | null => {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = str(v)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function headerMap(ws: ExcelJS.Worksheet): { hdr: string[]; firstRow: number } {
  let hdr: string[] = []
  let firstRow = 2
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (hdr.length) return
    const vals = (row.values as any[]).slice(1).map(str)
    if (vals.filter(Boolean).length >= 3) { hdr = vals; firstRow = i + 1 }
  })
  return { hdr, firstRow }
}

function rows(ws: ExcelJS.Worksheet): Record<string, any>[] {
  const { hdr, firstRow } = headerMap(ws)
  const out: Record<string, any>[] = []
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i < firstRow) return
    const vals = (row.values as any[]).slice(1)
    if (!vals.some(v => v !== null && v !== undefined && str(v) !== '')) return
    const o: Record<string, any> = {}
    hdr.forEach((h, idx) => { if (h) o[h] = vals[idx] })
    out.push(o)
  })
  return out
}

export async function parseSfg(buffer: ArrayBuffer | Buffer): Promise<SfgStatement> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)

  const rcti = wb.getWorksheet('RCTI Details')
  if (!rcti) throw new Error('This does not look like an SFG statement — there is no "RCTI Details" tab.')

  let periodLabel = '', brokerEmail = '', brokerName = ''
  const summary: Record<string, number> = {}
  rcti.eachRow({ includeEmpty: false }, row => {
    const vals = (row.values as any[]).slice(1).map(str).filter(v => v !== '')
    if (!vals.length) return
    const [a, b] = vals
    if (/^Period/i.test(a) && b) periodLabel = b
    if (/^To:/i.test(a) && b && !brokerName) brokerName = b
    if (/^Email/i.test(a) && b && /simplifyfinance/i.test(b) && !brokerEmail) brokerEmail = b.toLowerCase()
    if (vals.length === 4 && /commission|banked|fees/i.test(a)) {
      summary[a.replace(/:$/, '').trim()] = num(vals[1])
    }
  })

  const start = periodLabel.split('-')[0].trim()
  const m = start.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) throw new Error(`Could not read the period from the tax invoice (found "${periodLabel}").`)
  const year = Number(m[3]), month = Number(m[2])
  const periodMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const trailWs = wb.getWorksheet('Trail Details')
  const upfrontWs = wb.getWorksheet('Upfront Details')
  const kind: 'trail' | 'upfront' = trailWs ? 'trail' : 'upfront'
  const detailWs = trailWs || upfrontWs
  if (!detailWs) throw new Error('No "Trail Details" or "Upfront Details" tab in this file.')

  const toLine = (r: Record<string, any>, k: SfgLine['kind']): SfgLine => ({
    kind: k,
    lenderRaw: str(r['Lender']),
    loanRef: str(r['Loan ID']),
    clientName: str(r['Client']),
    balance: num(r['Loan Balance/Amount']) || null,
    settlementAmount: num(r['Settlement Amount']) || null,
    settlementDate: dateStr(r['Settlement Date']),
    grossExGst: num(r['Gross Commission (ex GST)']),
    gst: num(r['Gross Commission (GST)']),
    grossIncGst: num(r['Total Gross Commission (inc GST)']),
  })

  const lines: SfgLine[] = rows(detailWs).map(r => toLine(r, kind)).filter(l => l.loanRef || l.grossExGst)

  const clawWs = wb.getWorksheet('Clawback Details')
  if (clawWs) {
    for (const r of rows(clawWs)) {
      const l = toLine(r, 'clawback')
      if (l.loanRef || l.grossExGst) lines.push(l)
    }
  }

  // The 2025 layout carries a Referrals tab of third-party amounts, each with a
  // Type. A CLAWBACK row there is a referral partner's share being reversed - it is
  // clawback, not a referral fee, and counting it as the latter would put the money
  // in the wrong bucket. No loan reference on the tab, so it stays statement-level.
  let referralsExGst = 0
  let referralClawbackExGst = 0
  // The rows themselves are kept, not just the total. A single number with
  // nothing behind it is unanswerable: $34,182 sat on one statement for months
  // and took an afternoon and a spreadsheet to explain.
  const referralLines: SfgReferralLine[] = []
  const refWs = wb.getWorksheet('Referrals')
  if (refWs) {
    for (const r of rows(refWs)) {
      const amt = num(r['Commission'])
      if (!amt) continue
      const rowType = str(r['Type'])
      if (/clawback/i.test(rowType)) referralClawbackExGst += amt
      else referralsExGst += amt
      referralLines.push({
        rowType,
        sourceBroker: str(r['Broker']),
        lenderRaw: str(r['Lender']),
        clientName: str(r['Client']),
        splitName: str(r['Split Name']),
        paymentType: str(r['Payment Type']),
        paymentRate: num(r['Payment Rate']),
        commissionExGst: amt,
        gst: num(r['GST']),
        netIncGst: num(r['Remitted/Net']),
      })
    }
  }

  const thirdParty: Record<string, number> = {}
  const splitName: Record<string, string> = {}
  const disbWs = wb.getWorksheet('Disbursements (Itemised)')
  if (disbWs) {
    for (const r of rows(disbWs)) {
      const ref = str(r['Loan Id'])
      const amt = num(r['Commission Amount'])       // ex GST, and the figure that reconciles
      if (ref) {
        // signed for reconciliation, but what leaves the business is the size of it
        thirdParty[ref] = (thirdParty[ref] || 0) + amt
        const sn = str(r['Split Name'])
        if (sn && !splitName[ref]) splitName[ref] = sn
      }
    }
  }

  const grossExGst = lines.filter(l => l.kind !== 'clawback').reduce((t, l) => t + l.grossExGst, 0)
  const clawDetailExGst = lines.filter(l => l.kind === 'clawback').reduce((t, l) => t + l.grossExGst, 0)

  // paid away to third parties, versus recovered back from them on a clawback
  const disb = Object.values(thirdParty)
  const paidAway = disb.filter(v => v > 0).reduce((t, v) => t + v, 0)
  const recovered = disb.filter(v => v < 0).reduce((t, v) => t + v, 0)   // negative
  const thirdPartyExGst = paidAway
  const recoveredExGst = recovered

  const netCommissionExGst = grossExGst - paidAway
  const clawbackExGst = clawDetailExGst + referralClawbackExGst - recovered

  const bankedExGst = summary['Total Electronically Banked'] ?? 0
  const computedBanked = netCommissionExGst + clawbackExGst + referralsExGst
  const outBy = Math.round((computedBanked - bankedExGst) * 100) / 100

  return {
    kind, periodMonth, periodLabel, daysInMonth, brokerEmail, brokerName,
    lines, referralLines, thirdParty, splitName,
    totals: {
      grossExGst: Math.round(grossExGst * 100) / 100,
      netCommissionExGst: Math.round(netCommissionExGst * 100) / 100,
      clawbackExGst: Math.round(clawbackExGst * 100) / 100,
      referralsExGst: Math.round(referralsExGst * 100) / 100,
      thirdPartyExGst: Math.round(thirdPartyExGst * 100) / 100,
      recoveredExGst: Math.round(recoveredExGst * 100) / 100,
      bankedExGst, computedBanked: Math.round(computedBanked * 100) / 100,
      reconciled: Math.abs(outBy) < 0.05,
      outBy,
    },
  }
}

// Clawback figures arrive as positive numbers on their own tab; they are a deduction.
export function signedClawback(l: SfgLine): number {
  return l.kind === 'clawback' ? -Math.abs(l.grossExGst) : l.grossExGst
}
