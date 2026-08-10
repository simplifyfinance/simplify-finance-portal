import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

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
  if (profile.role !== 'admin') return NextResponse.json({ ok: false, error: 'Only admins can manually reassign deals' }, { status: 403 })

  const { data: officer, error: officerError } = await supabase
    .from('credit_officers')
    .select('id, name, user_id')
    .eq('id', creditOfficerId)
    .single()

  if (officerError || !officer) return NextResponse.json({ ok: false, error: 'Credit officer not found' }, { status: 404 })

  // Check whether this deal already had a card created in SalesTrekker - if not, this manual
  // assignment is effectively the deal's FIRST-EVER credit officer assignment, so the usual
  // "create the deal card" notification (normally fired from BC's own Send to credit team flow)
  // needs to be triggered here too, since this admin tool bypasses that flow entirely.
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('deal_name, assigned_broker, salestrekker_created_at, bc_data, fact_find_data, clients(first_name, last_name)')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

  const isFirstAssignment = !deal.salestrekker_created_at

  const { error: updateError } = await supabase
    .from('deals')
    .update({ assigned_credit_officer: creditOfficerId, credit_assigned_at: new Date().toISOString() })
    .eq('id', dealId)

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })

  // Always notify the newly-assigned officer - same email pattern as auto-allocation
  let emailSent = false
  if (officer.user_id) {
    const { data: officerProfile } = await supabase.from('user_profiles').select('email, full_name').eq('id', officer.user_id).single()
    if (officerProfile?.email) {
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
            subject: `New deal assigned: ${deal.deal_name}`,
            html: `<p>Hi ${officerProfile.full_name?.split(' ')[0] || ''},</p><p>A deal has been assigned to you.</p>
              <table style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="color:#666;font-size:13px;padding:3px 0">Deal</td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0">${deal.deal_name}</td></tr>
                <tr><td style="color:#666;font-size:13px;padding:3px 0">Client</td><td style="text-align:right;font-size:13px;padding:3px 0">${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}</td></tr>
                <tr><td style="color:#666;font-size:13px;padding:3px 0">Broker</td><td style="text-align:right;font-size:13px;padding:3px 0">${deal.assigned_broker || ''}</td></tr>
              </table>
              <p><a href="https://simplify-finance-portal.vercel.app/deals/${dealId}">Open the deal</a></p>`
          })
        })
        emailSent = true
      } catch (e) {
        // Non-fatal - the assignment itself already succeeded
      }
    }
  }

  // If this was the deal's first-ever credit officer assignment, also fire the SalesTrekker
  // card-creation trigger that normally happens via BC's own Send to credit team flow.
  let cardCreationTriggered = false
  if (isFirstAssignment) {
    try {
      await fetch('https://simplify-finance-portal.vercel.app/api/notify-salestrekker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, trigger: 'bc_action' })
      })
      cardCreationTriggered = true
    } catch (e) {
      // Non-fatal - the assignment itself already succeeded
    }
  }

  return NextResponse.json({ ok: true, assignedTo: officer.name, emailSent, cardCreationTriggered })
}
