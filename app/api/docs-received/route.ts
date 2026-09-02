// Marking a client's supporting documents as received.
//
// One press, two emails, a gap between them. The filing person is emailed now.
// The credit assessor's email is handed to Resend with a send time on it, so the
// wait costs us no timer, no scheduled job and nothing to miss - see
// lib/docs-received.ts.
//
// POST { dealId }              - mark received, email the filer, queue the assessor
// POST { dealId, cancel: true } - unmark, and call off the queued email
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { notifyDocsToFile, notifyDocsReadyForAssessor, cancelResendEmail } from '@/lib/salestrekker-notify'
import { docsDelayMinutes, assessorDueAt, assessorMissing, stillCancellable, NO_ASSESSOR_MESSAGE } from '@/lib/docs-received'

export async function POST(req: NextRequest) {
  try {
    const { dealId, cancel } = await req.json() as { dealId: string; cancel?: boolean }
    if (!dealId) return NextResponse.json({ ok: false, error: 'Missing dealId' }, { status: 400 })

    const supabase = await createSupabaseServer()
    const { data: deal, error } = await supabase.from('deals')
      .select('deal_name, assigned_broker, assigned_credit_officer, docs_received_at, docs_assessor_due_at, docs_assessor_email_id, clients(first_name, last_name)')
      .eq('id', dealId).single()
    if (error || !deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    // --- taking it back -----------------------------------------------------
    if (cancel) {
      if (!stillCancellable(deal)) {
        return NextResponse.json({
          ok: false,
          error: 'That email has already gone out, so it cannot be called back. Tell the assessor on the deal instead.',
        }, { status: 409 })
      }
      // Call it off with Resend FIRST. Clearing our own record while their copy
      // still goes out is the one outcome worth avoiding: the screen would say
      // nothing was sent while the assessor reads that it was.
      if (deal.docs_assessor_email_id) {
        const called = await cancelResendEmail(deal.docs_assessor_email_id)
        if (!called.ok) {
          return NextResponse.json({
            ok: false,
            error: 'The queued email could not be called back (' + called.error + '). It will still go out — tell the assessor directly.',
          }, { status: 502 })
        }
      }
      const { data: rows, error: e } = await supabase.from('deals')
        .update({ docs_received_at: null, docs_received_by: null, docs_assessor_due_at: null, docs_assessor_email_id: null })
        .eq('id', dealId).select('id')
      if (e) return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
      if (!rows?.length) {
        return NextResponse.json({
          ok: false,
          error: 'The email was called back, but the deal still shows the documents as received. Say so on the deal.',
        }, { status: 500 })
      }
      return NextResponse.json({ ok: true, cancelled: true })
    }

    // --- nobody to tell -----------------------------------------------------
    //
    // Checked before anything is sent or written. Between BC and lending options
    // a deal has a credit officer; where it does not, the answer is to allocate
    // one rather than send the filing person off on work nobody is waiting for.
    if (assessorMissing(deal)) {
      return NextResponse.json({ ok: false, error: NO_ASSESSOR_MESSAGE, needsAssessor: true }, { status: 409 })
    }

    const { data: officer } = await supabase.from('credit_officers')
      .select('name, user_id').eq('id', deal.assigned_credit_officer).single()
    let assessorEmail: string | null = null
    let assessorName: string | null = officer?.name || null
    if (officer?.user_id) {
      const { data: p } = await supabase.from('user_profiles').select('email, full_name').eq('id', officer.user_id).single()
      assessorEmail = p?.email || null
      assessorName = p?.full_name || assessorName
    }
    if (!assessorEmail) {
      return NextResponse.json({
        ok: false,
        error: `${assessorName || 'The allocated credit assessor'} has no email address on their profile, so they cannot be told. Fix that first.`,
      }, { status: 409 })
    }

    // --- marking it ---------------------------------------------------------
    //
    // Claimed on docs_received_at being null, so two people pressing at once
    // send one pair of emails rather than two.
    const { data: u } = await supabase.auth.getUser()
    const me = u?.user?.id
      ? (await supabase.from('user_profiles').select('full_name').eq('id', u.user.id).single()).data?.full_name || null
      : null
    const nowIso = new Date().toISOString()
    const { data: claimed, error: claimErr } = await supabase.from('deals')
      .update({ docs_received_at: nowIso, docs_received_by: me })
      .eq('id', dealId).is('docs_received_at', null).select('id')
    if (claimErr) return NextResponse.json({ ok: false, error: claimErr.message }, { status: 500 })
    if (!claimed?.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'already marked', receivedAt: deal.docs_received_at })
    }

    const clientName = `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim()
    const { data: settingsRow } = await supabase.from('settings')
      .select('docs_delay_minutes, docs_file_notification_user_id').eq('id', 'singleton').single()

    let filerEmail: string | null = null, filerName: string | null = null
    if (settingsRow?.docs_file_notification_user_id) {
      const { data: p } = await supabase.from('user_profiles').select('email, full_name')
        .eq('id', settingsRow.docs_file_notification_user_id).single()
      filerEmail = p?.email || null
      filerName = p?.full_name || null
    }

    const filed = await notifyDocsToFile({
      dealId, dealName: deal.deal_name, clientName,
      brokerName: deal.assigned_broker || '',
      recipientEmail: filerEmail, recipientName: filerName,
      // Keyed on this press, so a cancelled-then-repressed deal is not refused
      // by Resend as a duplicate of the first one.
      idempotencyKey: `docs-file:${dealId}:${nowIso}`,
    })
    if (!filed.ok) {
      // Release the claim rather than leaving a deal marked with nobody told.
      // Checked, because a rollback that fails silently leaves a deal that can
      // never be marked again.
      const { data: released } = await supabase.from('deals')
        .update({ docs_received_at: null, docs_received_by: null }).eq('id', dealId).select('id')
      return NextResponse.json({
        ok: false,
        error: (filed.error || 'The email did not send.')
          + (released?.length
            ? ' Nothing has been marked.'
            : ' The deal is still marked as received and could not be unmarked — tell the filing team directly.'),
      }, { status: 500 })
    }

    // The assessor's copy, handed to Resend with its send time.
    const dueAt = assessorDueAt(nowIso, docsDelayMinutes(settingsRow))
    const queued = await notifyDocsReadyForAssessor({
      dealId, dealName: deal.deal_name, clientName,
      brokerName: deal.assigned_broker || '',
      filedBy: me,
      recipientEmail: assessorEmail, recipientName: assessorName,
      scheduledAt: dueAt.toISOString(),
      idempotencyKey: `docs-ready:${dealId}:${nowIso}`,
    })

    if (!queued.ok) {
      // The filing person HAS been told, so the mark stands - undoing it would
      // make the screen contradict an email already in somebody's inbox. The
      // deal shows "not scheduled" instead, in red, so a person closes the gap.
      console.error('[docs-received] the assessor email could not be queued', queued.error)
      return NextResponse.json({
        ok: true, receivedAt: nowIso, by: me, assessorQueued: false,
        warning: `${filerName || 'The filing team'} has been emailed, but the assessor's email could not be queued (${queued.error}). Tell ${assessorName || 'them'} yourself.`,
      })
    }

    const { data: wrote } = await supabase.from('deals')
      .update({ docs_assessor_due_at: dueAt.toISOString(), docs_assessor_email_id: queued.id || null })
      .eq('id', dealId).select('id')
    if (!wrote?.length) {
      // Both emails are away; only our record of WHEN failed to save. The due
      // time still goes back to the screen, because without it the page would
      // show the red "the assessor was not emailed" panel about an email that
      // is, in fact, queued - the screen contradicting an inbox.
      return NextResponse.json({
        ok: true, receivedAt: nowIso, by: me, assessorQueued: true,
        dueAt: dueAt.toISOString(), assessorName,
        warning: 'Both emails are away, but the deal did not save when the assessor is told, so this line will be gone if you reload. The email still arrives.',
      })
    }

    return NextResponse.json({
      ok: true, receivedAt: nowIso, by: me, assessorQueued: true,
      dueAt: dueAt.toISOString(), assessorName,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
