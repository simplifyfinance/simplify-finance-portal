import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { notifyEllieCreateCard, notifyCrisMoveCard } from '@/lib/salestrekker-notify'
import { emailLines, emailSubject, shortDate } from '@/lib/push-answers'
import { allSections, countCards } from '@/lib/handover-view'
import { generateSummaryPdfBuffer } from '@/app/api/generate-summary-pdf/route'
import { generateCompliancePdfBuffer } from '@/app/api/generate-compliance-pdf/route'

type Trigger = 'bc_action' | 'bc_sent' | 'lo_sent' | 'lo_to_compliance' | 'push_to_salestrekker' | 'close_followup'

export async function POST(req: NextRequest) {
  try {
    const { dealId, trigger } = await req.json() as { dealId: string; trigger: Trigger }
    if (!dealId || !trigger) return NextResponse.json({ ok: false, error: 'Missing dealId or trigger' }, { status: 400 })

    const supabase = await createSupabaseServer()
    const { data: deal, error } = await supabase
      .from('deals')
      // push_answers is what the broker was asked on the way out, and
      // transaction_type / property_use decide which of those answers apply -
      // a column missing from a select is a value that is silently undefined.
      .select('deal_name, assigned_broker, assigned_credit_officer, lead_source, deal_type, salestrekker_created_at, fact_find_data, internal_notes, push_answers, transaction_type, property_use, clients(first_name, last_name)')
      .eq('id', dealId)
      .single()

    if (error || !deal) return NextResponse.json({ ok: false, error: error?.message || 'Deal not found' }, { status: 404 })

    const clientName = `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim()
    const brokerName = deal.assigned_broker || ''
    const dealName = deal.deal_name

    // Resolve who currently receives each notification type from Settings (admin-editable, no code change needed)
    const { data: settingsRow } = await supabase.from('settings').select('new_deal_notification_user_id, stage_move_notification_user_id').eq('id', 'singleton').single()
    let ellieEmail: string | null = null
    let crisEmail: string | null = null
    if (settingsRow?.new_deal_notification_user_id) {
      const { data: p } = await supabase.from('user_profiles').select('email').eq('id', settingsRow.new_deal_notification_user_id).single()
      ellieEmail = p?.email || null
    }
    if (settingsRow?.stage_move_notification_user_id) {
      const { data: p } = await supabase.from('user_profiles').select('email').eq('id', settingsRow.stage_move_notification_user_id).single()
      crisEmail = p?.email || null
    }

    // Trigger 1: first BC action on a deal — fires once, whichever happens first
    if (trigger === 'bc_action') {
      // Atomically claim the send. This UPDATE only matches while the timestamp is
      // still null, so exactly one caller can ever win it - no duplicate emails to
      // Ellie however many triggers fire, or how close together.
      const { data: claimed, error: claimErr } = await supabase
        .from('deals')
        .update({ salestrekker_created_at: new Date().toISOString() })
        .eq('id', dealId)
        .is('salestrekker_created_at', null)
        .select('id')

      if (claimErr) {
        return NextResponse.json({ ok: false, error: claimErr.message }, { status: 500 })
      }
      if (!claimed || claimed.length === 0) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'already notified' })
      }

      const ff = deal.fact_find_data || {}
      const primaryApplicant = ff.applicants?.[0]
      const employmentBasis = primaryApplicant?.employment?.[0]?.employmentBasis || ''
      const incomeType = employmentBasis === 'Self-employed' ? 'Self-employed' : (employmentBasis ? 'PAYG' : '')

      let creditOfficerName: string | null = null
      let alreadyBcActioned = false

      if (deal.assigned_credit_officer) {
        // Path A: allocated to credit team
        const { data: officer } = await supabase.from('credit_officers').select('name').eq('id', deal.assigned_credit_officer).single()
        creditOfficerName = officer?.name || null
      } else {
        // Path B: broker completed BC solo, this is the first-ever touchpoint
        alreadyBcActioned = true
      }

      try {
        await notifyEllieCreateCard({
          dealId,
          dealName,
          clientName,
          brokerName,
          leadSource: deal.lead_source || '',
          dealType: deal.deal_type || '',
          incomeType,
          // The deal's own notes column since 1 Sep 2026. The fact find copy is
          // read as a fallback so a deal written before the migration still
          // carries its notes into SalesTrekker.
          internalNotes: deal.internal_notes || ff.internalNotes || '',
          creditOfficerName,
          alreadyBcActioned,
          recipientEmail: ellieEmail
        })
      } catch (e: any) {
        // Release the claim so a later trigger can retry, rather than a timestamp
        // permanently blocking an email that never actually sent. Checked,
        // because a rollback that silently fails leaves the deal marked as
        // pushed forever with no email ever sent - the very fault this line is
        // here to prevent.
        const { data: released, error: relErr } = await supabase.from('deals')
          .update({ salestrekker_created_at: null }).eq('id', dealId).select('id')
        if (relErr || !released?.length) {
          console.error('[notify-salestrekker] could not release the claim - this deal will not retry', relErr)
        }
        console.error('[notify-salestrekker] notifyEllieCreateCard failed', e)
        return NextResponse.json({ ok: false, error: e?.message || 'Notification failed' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    // Read from the deal, not the request body, so the email can only ever say what
    // was actually saved.
    if (trigger === 'close_followup') {
      const { data: c } = await supabase.from('deals')
        .select('close_reason, next_action, next_action_due').eq('id', dealId).maybeSingle()
      const due = c?.next_action_due
        ? new Date(c.next_action_due).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'no date set'
      const instruction =
        `Set up a follow-up task on this deal card for ${brokerName} and the support team. Due ${due}.`
        + (c?.next_action ? ` Action: ${c.next_action}.` : '')
        + (c?.close_reason ? ` The deal was closed as: ${String(c.close_reason).replace(/_/g, ' ')}.` : '')
      await notifyCrisMoveCard(dealName, brokerName, instruction, false, undefined, crisEmail)
      return NextResponse.json({ ok: true })
    }

    // Trigger 2: BC sent to client, card already exists
    if (trigger === 'bc_sent') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to BC Actioned', false, undefined, crisEmail)
      return NextResponse.json({ ok: true })
    }

    // Trigger 3: LO sent to client
    if (trigger === 'lo_sent') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to LO Actioned', false, undefined, crisEmail)
      return NextResponse.json({ ok: true })
    }

    // Trigger 4: client/broker confirms proceed LO -> Compliance
    if (trigger === 'lo_to_compliance') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to Compliance (to be actioned)', false, undefined, crisEmail)
      return NextResponse.json({ ok: true })
    }

    // Trigger 5: Push to SalesTrekker (final)
    if (trigger === 'push_to_salestrekker') {
      const attachments: { filename: string; content: string }[] = []

      try {
        const summaryResult = await generateSummaryPdfBuffer(dealId, supabase)
        const complianceResult = await generateCompliancePdfBuffer(dealId, supabase)

        for (const result of [
          summaryResult ? { ...summaryResult, kind: 'summary' } : null,
          complianceResult ? { ...complianceResult, kind: 'compliance' } : null
        ]) {
          if (!result) continue
          // Both documents are already named for the people they are about -
          // "Handover - ..." and "Fact Find - ..." - so neither needs a suffix.
          //
          // They DO need a date. What is stored here is a snapshot taken at the
          // moment of the push and it never changes again, while the live
          // document does. On 2 Sep 2026 that cost an afternoon: the PDFs were
          // rebuilt and shipped, and the copy opened from the deal's Documents
          // list was still the old one, with no way to tell. The date on the
          // name is how you tell.
          const fileName = `${result.dealName} (${shortDate(new Date().toISOString().slice(0, 10))}).pdf`
          const filePath = `${dealId}/${Date.now()}-${fileName}`

          const { error: uploadError } = await supabase.storage.from('deal-documents').upload(filePath, result.buffer, {
            contentType: 'application/pdf',
            upsert: false
          })

          if (!uploadError) {
            // The file is already in storage. Without this row nothing lists it,
            // so it becomes a file nobody can find - worth a line in the log even
            // though it must never block the push.
            const { data: rec, error: recErr } = await supabase.from('deal_documents').insert({
              deal_id: dealId,
              file_name: fileName,
              file_path: filePath,
              file_type: 'application/pdf'
            }).select('id')
            if (recErr || !rec?.length) {
              console.error('[notify-salestrekker] the pack was uploaded but not recorded on the deal', recErr)
            }
            attachments.push({ filename: fileName, content: result.buffer.toString('base64') })
          }
        }
      } catch (e) {
        // Non-fatal — PDF generation/upload failure should never block the actual SalesTrekker push
      }

      const answers = (deal as any)?.push_answers || null

      // How many boxes there are to copy, so the email can say. Read from the
      // whole deal, not from the slim select above - the select is deliberately
      // narrow and a missing column is a silently undefined value.
      let boxCount: number | undefined
      try {
        const { data: full } = await supabase.from('deals').select('*').eq('id', dealId).single()
        if (full) boxCount = countCards(allSections(full))
      } catch {
        // The count is a nicety. Never let it stop the email.
      }

      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to Compliance Issued', true, attachments, crisEmail, {
        subject: emailSubject(dealName, answers),
        lines: emailLines(deal, answers),
        urgent: !!answers?.urgent,
        dealId,
        boxCount,
      })

      // This used to set status = 'completed', and the deals list hides anything
      // completed — so the loan vanished the moment compliance went out, before it
      // was lodged, approved or settled. On 1 Sep 2026 that was nine of twenty-one
      // deals: none lodged, the oldest eight business days old, and no way to tell
      // one progressing nicely from one that had fallen over.
      //
      // It now records that compliance WAS SENT. The deal stays on the board, keeps
      // ageing, and keeps someone to chase. A deal is finished when it settles or
      // when it dies, and emailing a PDF is neither.
      const { data: wrote, error: sentErr } = await supabase.from('deals')
        .update({ compliance_sent_at: new Date().toISOString() })
        .eq('id', dealId).select('id')
      if (sentErr || !wrote || wrote.length === 0) {
        return NextResponse.json({
          ok: false,
          error: 'The documents were sent, but the deal was not marked as compliance sent. Mark it on the deal so it does not fall off the board.',
        }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Unknown trigger' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
