// ASKING A CLIENT FOR THEIR DOCUMENTS.
//
// The list is worked out on the deal from the fact find. This is how it leaves
// the building: one email to whoever does the requesting, listing exactly what
// to raise on SalesTrekker's client portal, and one record on the deal of what
// was asked for and when.
//
// The RECORD is the important half. Without it, pressing the button a second
// time asks the client again for the payslips they already sent - see
// toRequest() in lib/document-progress.ts.
//
// POST { dealId, keys: string[] }
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { notifyDocumentRequest } from '@/lib/salestrekker-notify'
import { documentsFor, formallyApproved } from '@/lib/document-rules'
import { progressOf, rowsFor, withRequest, requestRounds } from '@/lib/document-progress'

export async function POST(req: NextRequest) {
  try {
    const { dealId, keys } = await req.json() as { dealId: string; keys: string[] }
    if (!dealId) return NextResponse.json({ ok: false, error: 'Missing dealId' }, { status: 400 })
    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nothing was ticked, so there is nothing to ask for.' }, { status: 400 })
    }

    const supabase = await createSupabaseServer()
    const { data: deal, error } = await supabase.from('deals')
      .select('id, deal_name, assigned_broker, fact_find_data, bc_data, document_progress, formal_approval_at, clients(first_name, last_name)')
      .eq('id', dealId).single()
    if (error || !deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    // THE LIST IS REBUILT HERE, not trusted from the browser. A key that is not
    // a real document on this deal is dropped rather than emailed - what goes
    // out is what the deal actually says is needed, whatever was posted.
    const progress = progressOf(deal)
    const { items } = documentsFor(deal)
    const rows = rowsFor(items, progress, { formallyApproved: formallyApproved(deal) })
    const byKey = new Map(rows.map(r => [r.key, r]))

    const asking = keys.map(k => byKey.get(k)).filter(Boolean) as typeof rows
    const unknown = keys.length - asking.length
    if (asking.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'None of those are documents on this deal any more. Reload the deal and try again.',
      }, { status: 409 })
    }

    // Already asked for, and quietly skipped rather than sent twice.
    const fresh = asking.filter(r => !r.requestedAt)
    if (fresh.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'already requested' })
    }

    const { data: u } = await supabase.auth.getUser()
    const me = u?.user?.id
      ? (await supabase.from('user_profiles').select('full_name').eq('id', u.user.id).single()).data?.full_name || null
      : null

    // Same person the "documents received" email goes to - whoever does the
    // filing does the requesting. Set in Settings, not hard-wired to a name.
    const { data: settingsRow } = await supabase.from('settings')
      .select('docs_file_notification_user_id').eq('id', 'singleton').single()
    let toEmail: string | null = null, toName: string | null = null
    if (settingsRow?.docs_file_notification_user_id) {
      const { data: p } = await supabase.from('user_profiles').select('email, full_name')
        .eq('id', settingsRow.docs_file_notification_user_id).single()
      toEmail = p?.email || null
      toName = p?.full_name || null
    }

    const nowIso = new Date().toISOString()
    const clientName = `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim()

    // RECORD FIRST, THEN SEND - the opposite way round to docs-received, and on
    // purpose. There, a failed email had to un-mark the deal. Here the worse
    // outcome is an email going out that nothing remembers, because the next
    // press would ask the client for the same things all over again. A record
    // with no email is recoverable by pressing again; an email with no record
    // is not.
    const next = withRequest(progress, fresh.map(r => r.key), me || 'Somebody', nowIso)
    const { data: saved, error: saveErr } = await supabase.from('deals')
      .update({ document_progress: next }).eq('id', dealId).select('id')
    if (saveErr) return NextResponse.json({ ok: false, error: saveErr.message }, { status: 500 })
    if (!saved?.length) {
      return NextResponse.json({
        ok: false,
        error: 'The request could not be recorded on the deal, so nothing was sent. Try again.',
      }, { status: 500 })
    }

    const sent = await notifyDocumentRequest({
      dealId, dealName: deal.deal_name, clientName,
      brokerName: deal.assigned_broker || '',
      requestedBy: me,
      documents: fresh.map(r => ({ label: r.label, detail: r.detail, who: r.groupLabel })),
      // Everything asked for on an earlier round, so the reader knows the list
      // is short because the rest is already done, not because it is incomplete.
      alreadyAsked: rows.filter(r => r.requestedAt).length,
      recipientEmail: toEmail, recipientName: toName,
      idempotencyKey: `doc-request:${dealId}:${nowIso}`,
    })

    if (!sent.ok) {
      return NextResponse.json({
        ok: false, recorded: true, requestedAt: nowIso,
        error: `The ${fresh.length} ${fresh.length === 1 ? 'document is' : 'documents are'} recorded as asked for, but the email did not go out (${sent.error}). Tell ${toName || 'the person who does the requesting'} directly.`,
      }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      requestedAt: nowIso,
      count: fresh.length,
      to: toName,
      rounds: requestRounds(next).length,
      ignored: unknown,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Something went wrong' }, { status: 500 })
  }
}
