import { NextRequest, NextResponse } from 'next/server'

const brokers: Record<string, { name: string; email: string }> = {
  'Fabio': { name: 'Fabio de Castro', email: 'fabio@simplifyfinance.com.au' },
  'Mark': { name: 'Mark Gallo', email: 'mark@simplifyfinance.com.au' },
}

export async function POST(req: NextRequest) {
  const { dealName, clientName, brokerKey } = await req.json()

  const broker = brokers[brokerKey] || brokers['Fabio']

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#343333;padding:20px;text-align:center">
        <p style="color:#fff;font-size:18px;font-weight:bold;margin:0">Simplify Finance</p>
        <p style="color:#2DBEFF;font-size:12px;margin:4px 0 0">Client Ready to Proceed</p>
      </div>
      <div style="padding:32px;background:#fff">
        <p style="font-size:16px;color:#343333;font-weight:bold;margin:0 0 16px">Action required</p>
        <p style="color:#555;line-height:1.6;margin:0 0 12px"><strong>${clientName}</strong> has confirmed they are ready to proceed on deal <strong>${dealName}</strong>.</p>
        <p style="color:#555;line-height:1.6;margin:0 0 12px">The deal has been automatically moved to the <strong>Lending Options</strong> stage in the portal.</p>
        <p style="color:#555;line-height:1.6;margin:0 0 24px">Next step: Send the client an invitation to the client portal to begin document collection.</p>
        <div style="background:#F2E8DB;border-radius:8px;padding:16px">
          <p style="margin:0;font-size:13px;color:#343333"><strong>Deal:</strong> ${dealName}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#343333"><strong>Client:</strong> ${clientName}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#343333"><strong>Stage:</strong> Moved to Lending Options</p>
        </div>
      </div>
      <div style="background:#343333;padding:14px;text-align:center">
        <p style="color:rgba(255,255,255,0.4);font-size:10px;margin:0">Simplify Finance | ACL 387025 | St Leonards, Sydney</p>
      </div>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Simplify Finance <onboarding@resend.dev>',
        to: [broker.email],
        cc: ['info@simplifyfinance.com.au'],
        subject: `${clientName} is ready to proceed — ${dealName}`,
        html
      })
    })
    const data = await res.json()
    console.log('Resend response:', data)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
