import { createSupabaseAdmin } from './supabase-admin'
import { readNotice, noticeForMany, appliesToLine, NO_NOTICE, type RateNotice, type LenderLike } from './rate-notice'

// FETCHING THE NOTICE, WHICH IS THE ONLY PART A LIBRARY CANNOT DO ON ITS OWN.
//
// lib/rate-notice.ts decides everything and reads nothing. This is the other
// half: one place that goes and gets the notice and the lender rows, so the
// three routes that need it do not each grow their own copy of the query.
//
// EVERY FAILURE HERE IS SILENT AND MEANS "NO NOTICE". A settings table we
// cannot read is not a reason to write a sentence about an RBA decision we
// cannot see. The opposite - guessing that a notice applies - would put a
// disclaimer on a client email that nobody authorised.

export async function loadRateNotice(): Promise<RateNotice> {
  try {
    const admin = createSupabaseAdmin()
    const { data } = await admin.from('settings').select('rate_notice').eq('id', 'singleton').maybeSingle()
    return readNotice((data as any)?.rate_notice)
  } catch {
    return NO_NOTICE
  }
}

export async function loadLenderNoticeRows(): Promise<LenderLike[]> {
  try {
    const admin = createSupabaseAdmin()
    const { data } = await admin.from('lenders').select('id, name, aliases, rate_notice_for')
    return (data || []) as LenderLike[]
  } catch {
    return []
  }
}

const norm = (v: any) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')

// THE ROWS FOR THE LENDERS THIS EMAIL ACTUALLY QUOTES.
//
// A name that matches nothing in the library comes back as a row with that name
// and no tick - which is the safe direction: an unknown bank has not passed the
// increase on as far as anybody here knows, so the notice stays on it.
export function rowsForNames(names: any[], rows: LenderLike[]): LenderLike[] {
  const byKey = new Map<string, LenderLike>()
  for (const r of rows) {
    const k = norm(r.name)
    if (k && !byKey.has(k)) byKey.set(k, r)
  }
  for (const r of rows) {
    for (const a of ((r as any).aliases || [])) {
      const k = norm(a)
      if (k && !byKey.has(k)) byKey.set(k, r)
    }
  }
  const out: LenderLike[] = []
  const seen = new Set<string>()
  for (const n of names || []) {
    const name = String(n ?? '').trim()
    if (!name || seen.has(norm(name))) continue
    seen.add(norm(name))
    out.push(byKey.get(norm(name)) || { name, rate_notice_for: null })
  }
  return out
}

// THE WHOLE ANSWER FOR ONE EMAIL, as the lines it should print.
//
// Empty array means nothing to say. One line where the notice covers every rate
// on the page; two where it covers only some, the second naming which.
export async function rateNoticeLines(lenderNames: any[]): Promise<string[]> {
  const notice = await loadRateNotice()
  if (!notice.on) return []
  const rows = lenderNames && lenderNames.length
    ? rowsForNames(lenderNames, await loadLenderNoticeRows())
    : []
  const { text, appliesTo } = noticeForMany(rows, notice)
  if (!text) return []
  const extra = appliesToLine(appliesTo)
  return extra ? [text, extra] : [text]
}
