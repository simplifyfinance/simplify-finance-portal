import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { can } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  const { dealId, brokerName } = await req.json()
  if (!dealId || !brokerName) return NextResponse.json({ ok: false, error: 'Missing dealId or brokerName' }, { status: 400 })

  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return NextResponse.json({ ok: false, error: 'Could not verify permissions' }, { status: 403 })
  if (!can(profile.role, 'reassignDeals')) return NextResponse.json({ ok: false, error: 'Only admins can manually reassign deals' }, { status: 403 })

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('deal_name, clients(first_name, last_name)')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

  const { error: updateError } = await supabase
    .from('deals')
    .update({ assigned_broker: brokerName })
    .eq('id', dealId)

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })

  // Notify the newly-assigned broker, same lookup pattern used throughout (brokers stored full name, matched by first name)
  let emailSent = false
  try {
    const { data: settings } = await supabase.from('settings').select('brokers').eq('id', 'singleton').single()
    const brokerRecord = (settings?.brokers || []).find((b: any) => (b.name || '').split(' ')[0] === brokerName)
    if (brokerRecord?.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
          to: brokerRecord.email,
          cc: 'info@simplifyfinance.com.au',
          subject: `Deal reassigned to you: ${deal.deal_name}`,
          html: `<p>Hi ${brokerRecord.name?.split(' ')[0] || ''},</p><p><strong>${deal.deal_name}</strong> (${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}) has been reassigned to you.</p><p><a href="https://simplify-finance-portal.vercel.app/deals/${dealId}">Open the deal</a></p>`
        })
      })
      emailSent = true
    }
  } catch (e) {
    // Non-fatal - the reassignment itself already succeeded
  }

  return NextResponse.json({ ok: true, emailSent })
}
