import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { notifyEllieCreateCard, notifyCrisMoveCard } from '@/lib/salestrekker-notify'

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
      const incomeType = employmentBasis === 'Self-employed' ? 'Self-employed' : (employmentBasis ? 'PAYE' : '')

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
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to Compliance Issued', true)
      await supabase.from('deals').update({ status: 'completed' }).eq('id', dealId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Unknown trigger' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
