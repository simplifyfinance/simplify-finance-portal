import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, brokerName, dealName } = await req.json()

    if (!to || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const brokerEmails: Record<string, string> = {
      Fabio: 'fabio@simplifyfinance.com.au',
      Mark: 'mark@simplifyfinance.com.au',
    }

    const fromEmail = 'noreply@simplifyfinance.com.au'
    const replyTo = brokerEmails[brokerName] || 'info@simplifyfinance.com.au'

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
