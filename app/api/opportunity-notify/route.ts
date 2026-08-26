import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyOpportunity } from '@/lib/opportunity-link'
import { FONT } from '@/lib/email-shell'

// Sent by the page once it is genuinely open in a browser. A mail scanner
// fetches the address without running the page, so it cannot make it look as
// though a client read something they never opened.
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: '' }))
  const p = verifyOpportunity(token)
  if (!p) return NextResponse.json({ error: 'That link is not valid.' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: broker } = await admin.from('brokers')
    .select('name, user_id').ilike('broker_key', p.brokerKey).maybeSingle()
  let to = ''
  if ((broker as any)?.user_id) {
    const { data: prof } = await admin.from('user_profiles')
      .select('email').eq('id', (broker as any).user_id).maybeSingle()
    to = String((prof as any)?.email || '')
  }
  // info@ is always copied, so a broker without a login never means a lost signal
  const recipients = [to, 'info@simplifyfinance.com.au'].filter(Boolean)

  const html = `<div style="font-family:${FONT};color:#575046;font-size:14px;line-height:1.6"><span style="color:#575046;">
<p>Hi ${(broker as any)?.name?.split(' ')[0] || ''},</p>
<p><b style="color:#221F1B">${p.name}</b> clicked through from the negative gearing email you sent on
${p.sentOn} and read the $85,000 comparison. They have not booked a time.</p>
<p><b style="color:#221F1B">Email</b><br>${p.email.split(',').map(e => e.trim()).join('<br>')}</p>
</span></div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to: recipients,
        reply_to: p.email.split(',').map(e => e.trim()).filter(Boolean),
        subject: `${p.name} read the buying opportunity page`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('[opportunity-notify] resend responded', res.status, await res.text())
      return NextResponse.json({ error: 'The notification could not be sent.' }, { status: 502 })
    }
  } catch (e) {
    console.error('[opportunity-notify] request failed', e)
    return NextResponse.json({ error: 'The notification could not be sent.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
