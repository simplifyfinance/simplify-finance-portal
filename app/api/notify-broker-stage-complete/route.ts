import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

const STAGE_LABELS: Record<string, string> = { BC: 'Borrowing Capacity', LO: 'Lending Options' }

export async function POST(req: NextRequest) {
  const { dealId, stage } = await req.json()
  if (!dealId || !stage) return NextResponse.json({ ok: false, error: 'Missing dealId or stage' }, { status: 400 })

  const supabase = await createSupabaseServer()

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, deal_name, assigned_broker')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) return NextResponse.json({ ok: false, error: dealError?.message || 'Deal not found' }, { status: 404 })

  const { data: settings } = await supabase.from('settings').select('brokers').eq('id', 'singleton').single()
  const brokerRecord = (settings?.brokers || []).find((b: any) => (b.name || '').split(' ')[0] === deal.assigned_broker)

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
