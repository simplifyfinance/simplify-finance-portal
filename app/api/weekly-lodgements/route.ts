import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { everyRow } from '@/lib/the-whole-book'
import { realDealsOnly, REAL_DEALS_OR } from '@/lib/test-deal'
import { fyEndYear, todayYmd } from '@/lib/periods'
import { mondayOf, ymd, tabCounts } from '@/lib/lodging-when'
import { byReferral, byBroker, totals, forReferrer } from '@/lib/who-brought-us-this'
import {
  modeOf, referrerSubject, referrerBody, managementSubject, managementBody,
  weekEndingWords, FORWARD_NOTE,
} from '@/lib/the-friday-email'
import { viewFor, mayEmail } from '@/lib/who-sees-the-numbers'

// THE FRIDAY SEND.
//
// One management email, and one email per referral partner who had something
// this week. Nothing goes out for a partner who had nothing - see the note at
// the top of lib/the-friday-email.ts.
//
// TWO WAYS IN. A person pressing the button on the Lodged and settled page,
// and a scheduled call carrying CRON_SECRET. The second is the one that makes
// it automatic; the first is what makes it usable the day it ships.
//
// PREVIEW SENDS NOTHING. The page asks for one before it offers the button, so
// nobody presses send to find out what would go.

export const runtime = 'nodejs'
export const maxDuration = 60

const FROM = 'Simplify Finance Portal <notifications@simplifyfinance.com.au>'

function addressList(raw: any): string[] {
  return String(raw || '').split(/[,;\s]+/).map(a => a.trim())
    .filter(a => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a))
}

async function send(to: string[], subject: string, text: string): Promise<string> {
  if (!process.env.RESEND_API_KEY) return 'The mail service is not configured.'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, text }),
  })
  if (res.ok) return ''
  const detail = await res.json().catch(() => ({}))
  console.error('[weekly-lodgements]', res.status, detail)
  return (detail as any)?.message || `The mail service refused the send (${res.status}).`
}

// THE SCHEDULE CALLS WITH GET, BECAUSE VERCEL'S CRON ONLY DOES THAT.
//
// It carries "Authorization: Bearer <CRON_SECRET>". A person pressing the
// button on the page calls POST with their own session. Both end up in run(),
// and the only thing the scheduled one does differently is read the book with
// the service key, because it has no session to read it with.
//
// FRIDAY IS CHECKED HERE AS WELL AS IN THE SCHEDULE. A schedule edited by
// somebody in a hurry must not start sending referral partners a Tuesday
// summary. Sydney's day, not the server's - the same fault lib/rate-notice.ts
// had on 9 Oct, and todayYmd() in lib/periods.ts exists because of it.
//
// THE CHECKS ARE THE FIRST TWO LINES OF EACH HANDLER, on purpose. A guard
// twenty lines into the work has let twenty lines of work happen - see
// lib/every-door-is-locked.test.ts, which fails the ship over it.
export async function GET(req: NextRequest) {
  if (!carriesTheSecret(req)) return NextResponse.json({ error: 'Not for you.' }, { status: 401 })
  if (!fridayInSydney()) return NextResponse.json({ ok: false, skipped: 'Not Friday in Sydney.' })
  return run(true, false)
}

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch { /* a scheduled call sends nothing */ }
  return run(false, body?.preview === true)
}

function carriesTheSecret(req: NextRequest): boolean {
  const want = String(process.env.CRON_SECRET || '')
  return want !== '' && String(req.headers.get('authorization') || '') === `Bearer ${want}`
}

function fridayInSydney(now: Date = new Date()): boolean {
  return new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' })).getDay() === 5
}

async function run(scheduled: boolean, preview: boolean) {

  const supabase = scheduled
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    : await createSupabaseServer()

  if (!scheduled) {
    const { data: auth } = await (supabase as any).auth.getUser()
    if (!auth?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    // ADMIN ONLY, THE SAME AS THE PAGE. A route that sends a referral partner
    // their figures must ask the question the screen asks, or the gate is a
    // decoration anybody with a browser console can step round. 11 Nov 2026.
    const { data: profile } = await (supabase as any).from('user_profiles')
      .select('role').eq('id', auth.user.id).maybeSingle()
    if (!mayEmail(viewFor((profile as any)?.role))) {
      return NextResponse.json({ error: 'Only an admin can send these.' }, { status: 403 })
    }
  }

  const now = new Date()
  const span = { from: mondayOf(now), to: ymd(now) }
  const end = fyEndYear(todayYmd())
  const year = { from: `${end - 1}-07-01`, to: ymd(now) }
  const ending = weekEndingWords(now)

  const { rows } = await everyRow<any>((from, to) => (supabase as any)
    .from('deals').select('*').or(REAL_DEALS_OR)
    .order('created_at', { ascending: false }).order('id').range(from, to))
  const deals = realDealsOnly(rows as any[])

  const { data: brokerRows } = await (supabase as any).from('brokers').select('broker_key, name')
  const brokerNames: Record<string, string> = {}
  for (const b of (brokerRows || []) as any[]) {
    const k = String(b.broker_key || '').toLowerCase()
    if (k && String(b.name || '').trim()) brokerNames[k] = String(b.name).trim()
  }

  const sum = totals(deals, span)
  const referral = byReferral(deals, span)
  const brokers = byBroker(deals, span, brokerNames)
  const ahead = tabCounts(deals, now)

  const out: any = { weekEnding: ending, management: null, referrers: [] as any[] }

  // --- the management one ------------------------------------------------------
  const { data: settings } = await (supabase as any).from('settings')
    .select('weekly_report_recipients').eq('id', 'singleton').maybeSingle()
  const to = addressList((settings as any)?.weekly_report_recipients)
  const mSubject = managementSubject(sum, ending)
  const mBody = managementBody(sum, referral, brokers,
    { next: ahead.next_week, noWeek: ahead.no_week }, ending)
  out.management = { to, subject: mSubject, body: mBody, sent: false, error: '' }
  if (!to.length) {
    out.management.error = 'Nobody is set to receive the weekly report. Settings — notifications.'
  } else if (!preview) {
    out.management.error = await send(to, mSubject, mBody)
    out.management.sent = !out.management.error
  }

  // --- one per referral partner -------------------------------------------------
  const { data: splitRows } = await (supabase as any).from('commission_splits')
    .select('id, name, contact_email, weekly_email, active')
  for (const row of (splitRows || []) as any[]) {
    const mode = modeOf(row?.weekly_email)
    if (mode === 'off') continue
    const r = forReferrer(deals, String(row.id), span, year)
    // NOTHING FOR A QUIET WEEK. Not an empty email - no email.
    if (!r) continue

    const theirs = addressList(row?.contact_email)
    const subject = referrerSubject(r, ending)
    const written = referrerBody(r, String(row?.name || '').split(/[\s,]+/)[0])
    const direct = mode === 'direct' && theirs.length > 0
    const goesTo = direct ? theirs : to
    const text = direct ? written : `${FORWARD_NOTE}\n\n${'—'.repeat(20)}\n\n${written}`

    const entry: any = {
      name: row.name, mode, to: goesTo, subject, body: text,
      lodged: r.lodged.length, settled: r.settled.length, sent: false, error: '',
    }
    if (!goesTo.length) {
      entry.error = direct
        ? 'No email address on this referral partner.'
        : 'Nobody is set to receive the weekly report.'
    } else if (!preview) {
      entry.error = await send(goesTo, subject, text)
      entry.sent = !entry.error
    }
    out.referrers.push(entry)
  }

  return NextResponse.json({ ok: true, preview, ...out })
}
