import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { notifyEllieCreateCard, notifyCrisMoveCard } from '@/lib/salestrekker-notify'
import { generateSummaryPdfBuffer } from '@/app/api/generate-summary-pdf/route'
import { generateCompliancePdfBuffer } from '@/app/api/generate-compliance-pdf/route'

type Trigger = 'bc_action' | 'bc_sent' | 'lo_sent' | 'lo_to_compliance' | 'push_to_salestrekker'

export async function POST(req: NextRequest) {
  try {
    const { dealId, trigger } = await req.json() as { dealId: string; trigger: Trigger }
    if (!dealId || !trigger) return NextResponse.json({ ok: false, error: 'Missing dealId or trigger' }, { status: 400 })

    const supabase = await createSupabaseServer()
    const { data: deal, error } = await supabase
      .from('deals')
      .select('deal_name, assigned_broker, assigned_credit_officer, lead_source, deal_type, salestrekker_created_at, fact_find_data, clients(first_name, last_name)')
      .eq('id', dealId)
      .single()

    if (error || !deal) return NextResponse.json({ ok: false, error: error?.message || 'Deal not found' }, { status: 404 })

    const clientName = `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim()
    const brokerName = deal.assigned_broker || ''
    const dealName = deal.deal_name

    // Trigger 1: first BC action on a deal — fires once, whichever happens first
    if (trigger === 'bc_action') {
      if (deal.salestrekker_created_at) {
        // Card already exists (shouldn't normally reach here for this trigger, but stay safe)
        return NextResponse.json({ ok: true, skipped: true })
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

      await notifyEllieCreateCard({
        dealId,
        dealName,
        clientName,
        brokerName,
        leadSource: deal.lead_source || '',
        dealType: deal.deal_type || '',
        incomeType,
        internalNotes: ff.internalNotes || '',
        creditOfficerName,
        alreadyBcActioned
      })

      await supabase.from('deals').update({ salestrekker_created_at: new Date().toISOString() }).eq('id', dealId)
      return NextResponse.json({ ok: true })
    }

    // Trigger 2: BC sent to client, card already exists
    if (trigger === 'bc_sent') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to BC Actioned')
      return NextResponse.json({ ok: true })
    }

    // Trigger 3: LO sent to client
    if (trigger === 'lo_sent') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to LO Actioned')
      return NextResponse.json({ ok: true })
    }

    // Trigger 4: client/broker confirms proceed LO -> Compliance
    if (trigger === 'lo_to_compliance') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to Compliance (to be actioned)')
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
          const fileName = `${result.dealName}-${result.kind}.pdf`
          const filePath = `${dealId}/${Date.now()}-${fileName}`

          const { error: uploadError } = await supabase.storage.from('deal-documents').upload(filePath, result.buffer, {
            contentType: 'application/pdf',
            upsert: false
          })

          if (!uploadError) {
            await supabase.from('deal_documents').insert({
              deal_id: dealId,
              file_name: fileName,
              file_path: filePath,
              file_type: 'application/pdf'
            })
            attachments.push({ filename: fileName, content: result.buffer.toString('base64') })
          }
        }
      } catch (e) {
        // Non-fatal — PDF generation/upload failure should never block the actual SalesTrekker push
      }

      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to Compliance Issued', true, attachments)
      await supabase.from('deals').update({ status: 'completed' }).eq('id', dealId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Unknown trigger' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
