import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { dealId } = await req.json()
  if (!dealId) return NextResponse.json({ ok: false, error: 'Missing dealId' }, { status: 400 })

  const supabase = await createSupabaseServer()

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, deal_name, assigned_broker, assigned_credit_officer')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) return NextResponse.json({ ok: false, error: dealError?.message || 'Deal not found' }, { status: 404 })

  if (deal.assigned_credit_officer) {
    return NextResponse.json({ ok: true, alreadyAssigned: true })
  }

  const brokerSlug = (deal.assigned_broker || '').split(' ')[0]

  // Find active credit officers covering this broker
  const { data: links, error: linksError } = await supabase
    .from('credit_officer_brokers')
    .select('credit_officer_id, credit_officers!inner(id, name, active, user_id)')
    .eq('broker_slug', brokerSlug)
    .eq('credit_officers.active', true)

  if (linksError) return NextResponse.json({ ok: false, error: linksError.message }, { status: 500 })

  const candidates = (links || []).map((l: any) => l.credit_officers).filter(Boolean)
  if (candidates.length === 0) {
    return NextResponse.json({ ok: false, error: `No active credit officer covers deals for "${brokerSlug}". Check Settings > Credit Team.` }, { status: 400 })
  }

  // Company-wide average active workload — the baseline "overloaded" is measured against.
  // Computed across ALL active credit officers, not just those eligible for this broker,
  // so it reflects genuine team-wide load rather than a small local group's own average.
  const { data: allActiveOfficers } = await supabase.from('credit_officers').select('id').eq('active', true)
  const allOfficerIds = (allActiveOfficers || []).map((o: any) => o.id)
  const { data: allTeamDeals } = await supabase
    .from('deals')
    .select('assigned_credit_officer, compliance_completed_at')
    .in('assigned_credit_officer', allOfficerIds.length > 0 ? allOfficerIds : [''])

  const companyActiveCounts: Record<string, number> = {}
  allOfficerIds.forEach((id: string) => { companyActiveCounts[id] = 0 })
  ;(allTeamDeals || []).forEach((d: any) => {
    if (!d.compliance_completed_at && companyActiveCounts[d.assigned_credit_officer] !== undefined) {
      companyActiveCounts[d.assigned_credit_officer] += 1
    }
  })
  const teamAverage = allOfficerIds.length > 0
    ? Object.values(companyActiveCounts).reduce((a, b) => a + b, 0) / allOfficerIds.length
    : 0
  const overloadThreshold = teamAverage * 1.5

  // Active workload + last-assigned time, scoped to the eligible candidates for this broker
  const candidateIds = candidates.map((c: any) => c.id)
  const { data: theirDeals, error: workloadError } = await supabase
    .from('deals')
    .select('assigned_credit_officer, compliance_completed_at, credit_assigned_at')
    .in('assigned_credit_officer', candidateIds)

  if (workloadError) return NextResponse.json({ ok: false, error: workloadError.message }, { status: 500 })

  const stats: Record<string, { active: number; lastAssigned: string | null }> = {}
  candidateIds.forEach((id: string) => { stats[id] = { active: 0, lastAssigned: null } })
  ;(theirDeals || []).forEach((d: any) => {
    const id = d.assigned_credit_officer
    if (!stats[id]) return
    if (!d.compliance_completed_at) stats[id].active += 1
    if (!stats[id].lastAssigned || (d.credit_assigned_at && d.credit_assigned_at > stats[id].lastAssigned!)) {
      stats[id].lastAssigned = d.credit_assigned_at
    }
  })

  // Round-robin order: whoever was least recently assigned goes first (never-assigned = highest priority)
  const roundRobinOrder = [...candidates].sort((a: any, b: any) => {
    const sa = stats[a.id], sb = stats[b.id]
    if (!sa.lastAssigned && !sb.lastAssigned) return 0
    if (!sa.lastAssigned) return -1
    if (!sb.lastAssigned) return 1
    return sa.lastAssigned < sb.lastAssigned ? -1 : 1
  })

  // Walk the round-robin order, skipping anyone currently above the overload threshold
  let chosen = roundRobinOrder.find((c: any) => stats[c.id].active <= overloadThreshold)
  let allOverloaded = false

  // If literally everyone eligible is above threshold, fall back to whoever has the least active load
  if (!chosen) {
    allOverloaded = true
    chosen = [...candidates].sort((a: any, b: any) => stats[a.id].active - stats[b.id].active)[0]
  }

  const nowIso = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('deals')
    .update({ assigned_credit_officer: chosen.id, credit_assigned_at: nowIso })
    .eq('id', dealId)

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })

  // Alert Alan specifically when every eligible officer was overloaded and we had to
  // assign anyway. Assignment always proceeds — this is a heads-up for rebalancing, not a block.
  let overloadAlertSent = false
  if (allOverloaded) {
    try {
      const { data: alan } = await supabase.from('user_profiles').select('email, full_name').ilike('full_name', '%Alan%').single()
      if (alan?.email) {
        const chosenActive = stats[chosen.id].active + 1
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
            to: alan.email,
            subject: `Workload alert: everyone covering ${brokerSlug} is above average`,
            html: `<p>Hi ${alan.full_name?.split(' ')[0] || ''},</p><p>Every credit officer covering ${brokerSlug}'s deals is currently above the team average (${teamAverage.toFixed(1)} active deals). Deal <strong>${deal.deal_name}</strong> was still assigned to <strong>${chosen.name}</strong> (now at ${chosenActive} active) to keep things moving — worth a look at rebalancing coverage.</p><p><a href="https://simplify-finance-portal.vercel.app/credit-team-workload">View team workload</a></p>`
          })
        })
        overloadAlertSent = true
      }
    } catch (e) {
      // Non-fatal — the allocation itself already succeeded
    }
  }

  // Notify the credit officer by email, if their portal account is linked
  let emailSent = false
  if (chosen.user_id) {
    const { data: profile } = await supabase.from('user_profiles').select('email, full_name').eq('id', chosen.user_id).single()
    if (profile?.email) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
            to: profile.email,
            cc: 'info@simplifyfinance.com.au',
            subject: `New deal assigned: ${deal.deal_name}`,
            html: `<p>Hi ${profile.full_name?.split(' ')[0] || ''},</p><p>A new deal has been assigned to you: <strong>${deal.deal_name}</strong>.</p><p><a href="https://simplify-finance-portal.vercel.app/deals/${dealId}">Open the deal</a></p>`
          })
        })
        emailSent = true
      } catch (e) {
        // Non-fatal — allocation itself succeeded even if the email failed
      }
    }
  }

  return NextResponse.json({ ok: true, assignedTo: chosen.name, emailSent, overloadAlertSent })
}
