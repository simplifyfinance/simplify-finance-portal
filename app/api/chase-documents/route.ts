import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { siteUrl } from '@/lib/site-url'
import { progressOf, rowsFor, withChase, type DocRow } from '@/lib/document-progress'
import { stillOut, isLate } from '@/lib/documents-outstanding'
import { documentsFor, documentsDue, formallyApproved } from '@/lib/document-rules'
import { patchDealColumn } from '@/lib/patch-deal-column'

// A CHASE IS NOT A SECOND REQUEST.
//
// 11 Nov 2026. Pressing "Request from client" again would send the same list
// to the same person as though nobody had replied, and would mark nothing new
// - the documents were asked for on the day they were asked for.
//
// So this says what is STILL missing and how long it has been, and records
// itself as a chase. Nothing on the deal changes except that line.
//
// IT GOES WHERE THE REQUEST WENT: to whoever raises document requests, not to
// the client. See docs_request_notification_user_id in lib/document-request.ts.

export const runtime = 'nodejs'
export const maxDuration = 20

const FROM = 'Simplify Finance Portal <notifications@simplifyfinance.com.au>'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* answered as missing below */ }
  const dealId = String(body?.dealId || '')
  const by = String(body?.by || '').trim()
  if (!dealId) return NextResponse.json({ error: 'No deal given.' }, { status: 400 })

  const { data: deal } = await supabase.from('deals')
    .select('id, deal_name, fact_find_data, bc_data, document_progress, formal_approval_at, clients(first_name, last_name)')
    .eq('id', dealId).maybeSingle()
  if (!deal) return NextResponse.json({ error: 'That deal could not be read.' }, { status: 404 })

  // READ FRESH. What is chased is what the record says is missing now, never
  // what a browser worked out some minutes ago.
  const progress = progressOf(deal)
  const { items } = documentsFor(deal)
  const all = rowsFor(items, progress, { formallyApproved: formallyApproved(deal) })
  const dueNow = new Set(documentsDue(deal, 'proceed').items.map(i => i.key))
  const rows: DocRow[] = all.filter((r: DocRow) => dueNow.has(r.key) || (r as any).addedByHand)
  const out = stillOut(rows)

  if (out.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Nothing is still out on this deal.' }, { status: 409 })
  }

  const { data: settingsRow } = await supabase.from('settings')
    .select('docs_file_notification_user_id, docs_request_notification_user_id')
    .eq('id', 'singleton').single()
  const askWho = settingsRow?.docs_request_notification_user_id
    || settingsRow?.docs_file_notification_user_id
  let toEmail = '', toName = ''
  if (askWho) {
    const { data: p } = await supabase.from('user_profiles').select('email, full_name')
      .eq('id', askWho).single()
    toEmail = String(p?.email || '')
    toName = String(p?.full_name || '')
  }
  if (!toEmail) {
    return NextResponse.json({
      ok: false,
      error: 'No recipient is set for document requests. Set one in Settings under Notifications. Nothing was sent.',
    }, { status: 500 })
  }

  const client = `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim()
  const name = String((deal as any).deal_name || client || 'this deal')
  const url = `${siteUrl()}/deals/${dealId}`

  const lines = out.map((r: DocRow) => {
    const days = r.requestedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / 86_400_000))
      : null
    const waited = days === null ? '' : ` — ${days} ${days === 1 ? 'day' : 'days'}`
    return `- ${r.label}${r.detail ? ' (' + r.detail + ')' : ''}${waited}`
  })
  const late = out.filter((r: DocRow) => isLate(r)).length

  const text = [
    `Hi ${toName.split(' ')[0] || 'there'},`,
    '',
    `Still waiting on ${out.length} ${out.length === 1 ? 'document' : 'documents'} for ${name}`
      + `${client ? ` (${client})` : ''}.`,
    '',
    ...lines,
    '',
    late > 0 ? `${late} of these have been out longer than a fortnight.` : '',
    '',
    `Could you chase them? ${url}`,
  ].filter(x => x !== '').join('\n')

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'The mail service is not configured on this deployment.' }, { status: 500 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: toEmail,
      ...(auth.user.email ? { reply_to: auth.user.email } : {}),
      subject: `Still waiting: ${out.length} ${out.length === 1 ? 'document' : 'documents'} — ${name}`,
      text,
    }),
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    console.error('[chase-documents]', res.status, detail)
    return NextResponse.json(
      { ok: false, error: (detail as any)?.message || `The mail service refused the send (${res.status}).` },
      { status: 502 })
  }

  // RECORDED ONLY ONCE IT HAS GONE. A chase nobody received is not a chase, and
  // the box saying "last chased today" over an email that failed would be worse
  // than saying nothing.
  const { problem } = await patchDealColumn(supabase, dealId, 'document_progress',
    (cur: any) => withChase(progressOf({ document_progress: cur }),
      out.map((r: DocRow) => r.key), by || auth.user.email || 'Somebody', new Date().toISOString(),
      toName || toEmail),
    progress)
  if (problem) {
    return NextResponse.json({ ok: true, sent: out.length, recorded: false, warning: problem })
  }

  return NextResponse.json({ ok: true, sent: out.length, to: toName || toEmail })
}
