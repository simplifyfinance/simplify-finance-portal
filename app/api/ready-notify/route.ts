import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyReady } from '@/lib/ready-link'

const money = (v: number) => '$' + Math.round(Number(v) || 0).toLocaleString('en-AU')

// Sent by the landing page once it is actually open in a browser, not by the
// link being fetched. Mail scanners and Safe Links retrieve the page without
// running it, so they cannot raise a false "ready to proceed".
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: '' }))
  const p = verifyReady(token)
  if (!p) return NextResponse.json({ error: 'That link is not valid.' }, { status: 400 })

  // The broker who sent it. Their address comes from their login; info@ is
  // always copied so a broker without one never means a lost lead.
  const admin = createSupabaseAdmin()
  const { data: broker } = await admin.from('brokers')
    .select('name, user_id').ilike('broker_key', p.brokerKey).maybeSingle()
  let to = ''
  if ((broker as any)?.user_id) {
    const { data: prof } = await admin.from('user_profiles')
      .select('email').eq('id', (broker as any).user_id).maybeSingle()
    to = String((prof as any)?.email || '')
  }
  const recipients = [to, 'info@simplifyfinance.com.au'].filter(Boolean)

  const rows: [string, string][] = [
    ['Balance', money(p.balance)],
    ['Rate', `${p.currentRate}% → ${p.newRate}%`],
    ['Repayment type', p.repaymentType === 'IO'
      ? 'Interest only' : `Principal & interest, ${p.remainingYears} years remaining`],
    [p.repaymentType === 'IO' ? 'Monthly cashflow' : 'Monthly saving', money(p.monthlySaving)],
  ]
  if (p.cashback > 0) rows.push(['Cashback', money(p.cashback)])

  const table = rows.map(([k, v]) =>
    `<tr><td style="font-size:13px;color:#575046;padding:7px 11px;border-bottom:1px solid #EFEAE0;">${k}</td>` +
    `<td style="font-size:13px;color:#221F1B;padding:7px 11px;border-bottom:1px solid #EFEAE0;text-align:right;">${v}</td></tr>`
  ).join('')

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#575046;font-size:14px;line-height:1.6">
<p>Hi ${(broker as any)?.name?.split(' ')[0] || ''},</p>
<p><b style="color:#221F1B">${p.name}</b> pressed <b style="color:#221F1B">Get started</b> on the refinance email
you sent on ${p.sentOn}. They are expecting a call within one business day.</p>
<p style="margin-bottom:4px"><b style="color:#221F1B">What they were quoted</b></p>
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #E5DED2;">${table}</table>
<p style="margin-top:14px"><b style="color:#221F1B">Email</b><br>${p.email.split(',').map(e => e.trim()).join('<br>')}</p>
<table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#2DBEFF" align="center" style="background:#2DBEFF;border-radius:7px;padding:9px 16px">
<a href="mailto:${encodeURIComponent(p.email)}" style="color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">Reply to ${p.name}</a></td></tr></table>
</div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to: recipients,
        reply_to: p.email.split(',').map(e => e.trim()).filter(Boolean),
        subject: `${p.name} is ready to proceed — refinance`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('[ready-notify] resend responded', res.status, await res.text())
      return NextResponse.json({ error: 'The notification could not be sent.' }, { status: 502 })
    }
  } catch (e) {
    console.error('[ready-notify] request failed', e)
    return NextResponse.json({ error: 'The notification could not be sent.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
