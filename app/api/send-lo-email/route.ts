import { NextRequest, NextResponse } from 'next/server'
import { resolveBrokerProfile, noBrokerMessage } from '@/lib/broker-profile'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, brokerName, dealName } = await req.json()

    if (!to || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const profile = await resolveBrokerProfile(brokerName)
    if (!profile) {
      return NextResponse.json({ error: noBrokerMessage(brokerName) }, { status: 400 })
    }

    const fromEmail = 'noreply@simplifyfinance.com.au'
    const replyTo = profile.email || 'info@simplifyfinance.com.au'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `Simplify Finance <${fromEmail}>`,
        to: [to],
        reply_to: replyTo,
        cc: ['info@simplifyfinance.com.au'],
        subject: subject || `Your lending options — ${dealName}`,
        html
      })
    })

    const data = await res.json()
    if (data.id) {
      return NextResponse.json({ ok: true, id: data.id })
    } else {
      return NextResponse.json({ error: data.message || 'Send failed' }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
