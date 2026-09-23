import { NextRequest, NextResponse } from 'next/server'
import { resolveBrokerProfile } from '@/lib/broker-profile'
import { createSupabaseServer } from '@/lib/supabase-server'

const STAGE_LABELS: Record<string, string> = { BC: 'Borrowing Capacity', LO: 'Lending Options' }

export async function POST(req: NextRequest) {
  const { dealId, stage } = await req.json()
  if (!dealId || !stage) return NextResponse.json({ ok: false, error: 'Missing dealId or stage' }, { status: 400 })

  const supabase = await createSupabaseServer()

  // SIGNED IN, FIRST. 23 Sep 2026: this route sends email and read the deal as
  // whoever called it, so with no session the database returned nothing and it
  // stopped at "deal not found". That is a lock made of a side effect. It is
  // said out loud now, because the next person to change the query should not
  // be able to remove the lock without noticing.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, deal_name, assigned_broker, assigned_credit_officer')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) return NextResponse.json({ ok: false, error: dealError?.message || 'Deal not found' }, { status: 404 })

  // Only notify the broker if a credit officer actually did the work — if the broker
  // completed this stage themselves (no allocation), they don't need to be told
  // "the credit team has completed" something they just did personally.
  if (!deal.assigned_credit_officer) {
    return NextResponse.json({ ok: true, emailSent: false, reason: 'No credit officer assigned — broker completed this stage themselves' })
  }

  const brokerRecord = await resolveBrokerProfile(deal.assigned_broker)

  if (!brokerRecord?.email) {
    return NextResponse.json({ ok: true, emailSent: false, reason: 'No email on file for this broker' })
  }

  const stageLabel = STAGE_LABELS[stage] || stage

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to: brokerRecord.email,
        cc: 'info@simplifyfinance.com.au',
        subject: `${stageLabel} ready for your review: ${deal.deal_name}`,
        html: `<p>Hi ${brokerRecord.name?.split(' ')[0] || ''},</p><p>The credit team has completed the <strong>${stageLabel}</strong> stage for <strong>${deal.deal_name}</strong>. It's ready for you to add your personalisation and send to the client.</p><p><a href="https://simplify-finance-portal.vercel.app/deals/${dealId}">Open the deal</a></p>`
      })
    })
    return NextResponse.json({ ok: true, emailSent: true })
  } catch (e) {
    return NextResponse.json({ ok: true, emailSent: false, reason: 'Email failed to send' })
  }
}
