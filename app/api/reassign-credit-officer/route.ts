import { NextRequest, NextResponse } from 'next/server'
import { STAGES, ownerOf, handOver, stageIsDone } from '@/lib/who-did-this-stage'
import { createSupabaseServer } from '@/lib/supabase-server'
import { can } from '@/lib/permissions'
import { siteUrl } from '@/lib/site-url'

async function notifyOfficer(supabase: any, userId: string | null, subject: string, message: string, dealName: string, dealId: string, clientName: string, brokerName: string) {
  if (!userId) return
  const { data: officerProfile } = await supabase.from('user_profiles').select('email, full_name').eq('id', userId).single()
  if (!officerProfile?.email) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to: officerProfile.email,
        cc: 'info@simplifyfinance.com.au',
        subject,
        html: `<p>Hi ${officerProfile.full_name?.split(' ')[0] || ''},</p><p>${message}</p>
          <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Deal</span></td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0">${dealName}</td></tr>
            <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Client</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${clientName}</td></tr>
            <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Broker</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${brokerName}</td></tr>
          </table>
          <p><a href="${siteUrl()}/deals/${dealId}">Open the deal</a></p>`
      })
    })
  } catch (e) {
    // Non-fatal - the reassignment itself already succeeded
  }
}

export async function POST(req: NextRequest) {
  const { dealId, creditOfficerId } = await req.json()
  if (!dealId || !creditOfficerId) return NextResponse.json({ ok: false, error: 'Missing dealId or creditOfficerId' }, { status: 400 })

  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return NextResponse.json({ ok: false, error: 'Could not verify permissions' }, { status: 403 })
  if (!can(profile.role, 'reassignDeals')) return NextResponse.json({ ok: false, error: 'You do not have permission to reassign deals' }, { status: 403 })

  const { data: officer, error: officerError } = await supabase
    .from('credit_officers')
    .select('id, name, user_id')
    .eq('id', creditOfficerId)
    .single()

  if (officerError || !officer) return NextResponse.json({ ok: false, error: 'Credit officer not found' }, { status: 404 })

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name)')  // 27 Oct 2026: the whole row. stageIsDone() walks the bead ladder and
    // ownerOf() reads the three per-stage columns - with the narrow select
    // above, every stage read as unfinished and unowned, so a reassign would
    // have stamped the new officer onto a BC somebody else had already
    // written. Caught by lib/the-sender-is-the-deals-broker.test.ts.
    .eq('id', dealId)
    .single()

  if (dealError || !deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

  const isFirstAssignment = !deal.salestrekker_created_at
  const previousOfficerId = deal.assigned_credit_officer
  const clientName = `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim()

  // AND THE STAGE THEY ARE ACTUALLY DOING, which this never touched.
  //
  // 27 Oct 2026. Fabio, on a deal reassigned from Katie to Mellissa: "Mel was
  // assigned but it says Katie is doing this." The chip at the top read
  // Mellissa and the row under the BC read "Katie Amos - credit", on the same
  // screen, because they are two different columns and only one of them moved.
  //
  // assigned_credit_officer is the deal's officer. bc_owner_officer and the
  // two beside it are who is doing THAT STAGE - added 23 Oct so a deal that
  // changes hands credits each person with their own work. Reassigning wrote
  // the first and left the second, so the per-stage owner stayed with whoever
  // had it before, for good.
  //
  // A FINISHED STAGE KEEPS ITS OWNER. That is the entire point of recording
  // one: a BC Katie wrote is Katie's work whoever carries the deal afterwards,
  // and the workload numbers are built on exactly that. Only stages still open
  // move - and only where the previous officer held them, or nobody did. A
  // stage a BROKER is doing themselves is left alone; reassigning credit does
  // not take work off a broker.
  const now = new Date().toISOString()
  const patch: Record<string, any> = {
    assigned_credit_officer: creditOfficerId,
    credit_assigned_at: now,
  }
  for (const stage of STAGES) {
    if (stageIsDone(deal, stage)) continue
    const owner = ownerOf(deal, stage)
    const heldByThePreviousOne = owner?.officerId && owner.officerId === previousOfficerId
    if (owner && !heldByThePreviousOne) continue
    Object.assign(patch, handOver(stage, { officerId: creditOfficerId, name: officer.name }, new Date(now)))
  }

  const { error: updateError } = await supabase
    .from('deals')
    .update(patch)
    .eq('id', dealId)

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })

  // Notify the previous officer (if there was one, and it's genuinely changing) that they no longer need to work this deal
  if (previousOfficerId && previousOfficerId !== creditOfficerId) {
    const { data: previousOfficer } = await supabase.from('credit_officers').select('user_id').eq('id', previousOfficerId).single()
    if (previousOfficer?.user_id) {
      await notifyOfficer(
        supabase, previousOfficer.user_id,
        `Deal reassigned: ${deal.deal_name}`,
        `This deal has been reassigned to another team member — you no longer need to action it.`,
        deal.deal_name, dealId, clientName, deal.assigned_broker || ''
      )
    }
  }

  // Always notify the newly-assigned officer
  await notifyOfficer(
    supabase, officer.user_id,
    `New deal assigned: ${deal.deal_name}`,
    `A deal has been assigned to you.`,
    deal.deal_name, dealId, clientName, deal.assigned_broker || ''
  )

  // If this was the deal's first-ever credit officer assignment, also fire the SalesTrekker card-creation trigger
  if (isFirstAssignment) {
    try {
      await fetch(`${siteUrl()}/api/notify-salestrekker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, trigger: 'bc_action' })
      })
    } catch (e) {
      // Non-fatal - the assignment itself already succeeded
    }
  }

  return NextResponse.json({ ok: true, assignedTo: officer.name })
}
