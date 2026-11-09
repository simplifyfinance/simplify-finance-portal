import { NextRequest, NextResponse } from 'next/server'
import { resolveBrokerProfile } from '@/lib/broker-profile'
import { createSupabaseServer } from '@/lib/supabase-server'
import { siteUrl } from '@/lib/site-url'
import { STAGE_LABELS, handoverSubject, handoverHtml, handoverText, shapeOf,
         dealLine } from '@/lib/a-handover-tells-the-broker'
import { money, readMoney } from '@/lib/money'

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
    // The lender, the shape and the amount so the email can say which file it
    // is without the reader opening anything. 17 Aug 2026.
    .select('id, deal_name, assigned_broker, assigned_credit_officer, loan_amount, transaction_type, property_use, lenders(name)')
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

  // COMPLIANCE PREP IS ITS OWN EMAIL, not the same sentence with a different
  // noun in it. Alan's November brief, item 4: the broker wants to add
  // information or double-check details BEFORE compliance is finalised, so the
  // email says that rather than announcing a state change. See
  // lib/a-handover-tells-the-broker.ts.
  const officerName = String((deal as any).assigned_credit_officer || '').trim()
  const amount = readMoney((deal as any).loan_amount)
  const facts = {
    dealName: String(deal.deal_name || ''),
    brokerFirstName: brokerRecord.name?.split(' ')[0] || '',
    officerName,
    lender: String(((deal as any).lenders as any)?.name || ''),
    shape: shapeOf(deal),
    amount: amount !== null ? money(amount) : '',
    dealUrl: `${siteUrl()}/deals/${dealId}`,
  }
  const handover = stage === 'COMPLIANCE'
  const subject = handover
    ? handoverSubject(facts)
    : `${stageLabel} ready for your review: ${deal.deal_name}`
  const html = handover
    ? handoverHtml(facts)
    : `<p>Hi ${facts.brokerFirstName},</p><p>The credit team has completed the <strong>${stageLabel}</strong> stage for <strong>${deal.deal_name}</strong>. It's ready for you to add your personalisation and send to the client.</p><p><a href="${facts.dealUrl}">Open the deal</a></p><p style="font-size:12px;color:#A79F93;margin-top:16px">${dealLine(facts)}</p>`

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
        subject,
        html,
        ...(handover ? { text: handoverText(facts) } : {}),
      })
    })
    return NextResponse.json({ ok: true, emailSent: true })
  } catch (e) {
    return NextResponse.json({ ok: true, emailSent: false, reason: 'Email failed to send' })
  }
}
