// What credit is asked before a deal is pushed to SalesTrekker.
//
// These questions were asked in Slack, in email, or not at all. The answers
// decide what the credit team does first, and half of them were arriving as
// "quick one - is this urgent?" after the pack had already gone out.
//
// Fabio, 2 Sep 2026. Everything here is recorded on the deal, so a second push
// does not start from a blank form, and every answer goes into the email that
// carries the handover.

export type IdMethod = 'face_to_face' | 'virtual'
export type IdService = 'idyou' | 'infotrack' | 'facetime'
export type Commission = 'simplify_100' | 'check_label'

export type LiabilityChoice = { id: string; label: string; detail: string; closing: boolean }

export type PushAnswers = {
  commission?: Commission
  urgent?: boolean
  complianceNeededBy?: string      // yyyy-mm-dd
  urgentReason?: string
  liabilities?: LiabilityChoice[]
  idMethod?: IdMethod
  idService?: IdService
  // Refinance only. Ticked by default: the discharge is the longest thing
  // between compliance and settlement, so it starts now rather than when the
  // loan is approved.
  dischargePrepared?: boolean
  // Investment purchase only. An owner occupied purchase is never asked.
  rentalIncome?: string
  investmentExpenses?: string
  notes?: string
  pushedAt?: string
  pushedBy?: string
}

// --- dates, said the same way everywhere ------------------------------------
//
// Not toLocaleDateString. Node's own idea of "short month" in en-AU is "Sept" on
// one machine and "Sep" on another depending on which CLDR it was built with, so
// the chip on somebody's laptop, the subject line the server sends, and the date
// on the PDF could all disagree about the same day. Three characters is not
// worth a bug that only shows up in production.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "Fri 5 Sep" from a yyyy-mm-dd. Empty string when it is not a date - the caller
// then says just "Urgent", which is true, rather than "Urgent by Invalid Date".
export function shortDate(ymd: any): string {
  const raw = String(ymd || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  // Built and read in UTC, so a laptop in Sydney and a server in the United
  // States name the same day.
  const d = new Date(raw + 'T00:00:00Z')
  if (isNaN(d.getTime())) return ''
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

export const COMMISSION_LABEL: Record<Commission, string> = {
  simplify_100: '100% Simplify',
  check_label: 'Check label',
}
export const ID_METHOD_LABEL: Record<IdMethod, string> = {
  face_to_face: 'Face to face',
  virtual: 'Virtual',
}
export const ID_SERVICE_LABEL: Record<IdService, string> = {
  idyou: 'IDYou', infotrack: 'InfoTrack', facetime: 'FaceTime',
}

// --- which questions this deal actually gets --------------------------------
//
// A question that does not apply to the deal in front of you is a question
// somebody answers wrongly. Fabio, 2 Sep 2026: rental income only on an
// INVESTMENT purchase - an owner occupied buyer is not letting the place out.

export function isRefinanceDeal(deal: any): boolean {
  const t = String(deal?.transaction_type || '')
  return t === 'refinance' || t === 'equity_release'
}
export function isInvestmentPurchase(deal: any): boolean {
  const t = String(deal?.transaction_type || '')
  const use = String(deal?.property_use || '')
  return (t === 'purchase' || t === 'construction') && use === 'investment'
}

export function defaultAnswers(deal: any, liabilities: LiabilityChoice[]): PushAnswers {
  return {
    commission: 'simplify_100',
    urgent: false,
    complianceNeededBy: '',
    liabilities,
    idMethod: 'face_to_face',
    // Ticked by default on a refinance, and not present at all otherwise.
    ...(isRefinanceDeal(deal) ? { dischargePrepared: true } : {}),
  }
}

// --- what has to be answered ------------------------------------------------
//
// Deliberately short. Everything else has a sensible default or genuinely may
// be blank, and a form that argues about optional fields gets clicked through.
export function missingAnswers(a: PushAnswers | undefined | null): string[] {
  const out: string[] = []
  if (!a?.commission) out.push('Commission has not been chosen')
  if (a?.urgent && !a?.complianceNeededBy) {
    out.push('This deal is marked urgent but has no date for compliance to work to')
  }
  if (a?.idMethod === 'virtual' && !a?.idService) {
    out.push('ID was done virtually but the service has not been named')
  }
  return out
}

// --- the urgency flag -------------------------------------------------------
//
// It ends at LODGEMENT. Fabio, 2 Sep 2026: "when we move box to lodged".
//
// The flag means "compliance needs to move on this", and once the deal is
// lodged compliance is finished with it. A flag that never clears is a flag
// everybody stops seeing - which is exactly how nine deals ended up hidden on a
// board nobody trusted.
export function isUrgentNow(deal: any): boolean {
  if (!deal?.is_urgent) return false
  if (deal?.lodged_at) return false
  if (deal?.status === 'lost') return false
  return true
}

// "Urgent · compliance by Fri 5 Sep", or just "Urgent" when no date was given.
export function urgentChipLabel(deal: any): string {
  const when = shortDate(deal?.compliance_needed_by)
  return when ? `Urgent · compliance by ${when}` : 'Urgent'
}

// Urgent first, then the order the board already used - oldest at the top,
// because the top of a column is the thing to do first.
export function boardOrder(a: any, b: any, since: (d: any) => string | null): number {
  const ua = isUrgentNow(a) ? 0 : 1
  const ub = isUrgentNow(b) ? 0 : 1
  if (ua !== ub) return ua - ub
  return String(since(a) || '').localeCompare(String(since(b) || ''))
}

// --- what credit reads ------------------------------------------------------
// The email is being rewritten separately. This is the content, not the layout.
export function emailLines(deal: any, a: PushAnswers | undefined | null): string[] {
  const out: string[] = []
  if (a?.commission) out.push(`Commission: ${COMMISSION_LABEL[a.commission]}`)
  if (a?.idMethod) {
    const method = ID_METHOD_LABEL[a.idMethod]
    const svc = a.idMethod === 'virtual' && a.idService ? ` — ${ID_SERVICE_LABEL[a.idService]}` : ''
    out.push(`ID: ${method}${svc}`)
  }
  const closing = (a?.liabilities || []).filter(l => l.closing)
  const staying = (a?.liabilities || []).filter(l => !l.closing)
  if (closing.length) out.push('Closing at settlement: ' + closing.map(l => `${l.label} (${l.detail})`).join(', '))
  if (staying.length) out.push('Staying: ' + staying.map(l => `${l.label} (${l.detail})`).join(', '))
  if (a?.dischargePrepared) out.push('Discharge authority: prepare now')
  if (isInvestmentPurchase(deal)) {
    out.push(`Proposed rental income: ${a?.rentalIncome ? '$' + a.rentalIncome : 'not stated'}`)
    out.push(`Proposed investment expenses: ${a?.investmentExpenses ? '$' + a.investmentExpenses : 'not stated'}`)
  }
  if (a?.notes) out.push(`Notes: ${a.notes}`)
  return out
}

export function emailSubject(dealName: string, a: PushAnswers | undefined | null): string {
  const base = `${dealName} — ready for compliance`
  if (!a?.urgent) return base
  const by = shortDate(a.complianceNeededBy)
  return `${base} · URGENT${by ? ', needed by ' + by : ''}`
}
