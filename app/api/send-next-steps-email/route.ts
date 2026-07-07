import { NextRequest, NextResponse } from 'next/server'
import { markProceeded, buildNextStepsContent } from '@/lib/proceed-flow'

export async function POST(req: NextRequest) {
  const { dealId, stage } = await req.json()
  if (!dealId || (stage !== 'BC' && stage !== 'LO')) {
    return NextResponse.json({ ok: false, error: 'Missing dealId or invalid stage' }, { status: 400 })
  }

  const result = await markProceeded(dealId, stage)
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 404 })

  const { deal, alreadyProceeded, wealthDeskLink } = result
  if (alreadyProceeded) {
    return NextResponse.json({ ok: true, alreadyProceeded: true })
  }

  const clientEmail = deal.clients?.email
  if (!clientEmail) {
    return NextResponse.json({ ok: true, emailSent: false, reason: 'No email on file for this client' })
  }

  const { steps } = buildNextStepsContent(stage, wealthDeskLink)
  const clientName = deal.clients?.first_name || 'there'

  const stepsHtml = steps.map((s: any) => `
    <div style="display:flex;gap:12px;margin-bottom:18px">
      <div style="width:24px;height:24px;border-radius:50%;background:${s.accent ? '#1D9E75' : '#343333'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${s.num}</div>
      <div>
        <p style="margin:0 0 4px;font-weight:700;color:#343333;font-size:13px">${s.title}</p>
        <p style="margin:${s.button ? '0 0 8px' : '0'};color:#666;font-size:12px;line-height:1.6">${s.desc}</p>
        ${s.button && wealthDeskLink ? `<a href="${wealthDeskLink}" style="background:#1D9E75;color:#fff;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;display:inline-block">Click here to share your bank statements</a>` : ''}
      </div>
    </div>
  `).join('')

  const html = `<div style="font-family:Arial,sans-serif;background:#F2E8DB;padding:24px">
    <div style="background:#fff;border-radius:16px;padding:36px;max-width:480px;margin:0 auto">
      <h1 style="font-size:20px;font-weight:700;color:#343333;margin:0 0 8px">Great news, ${clientName}!</h1>
      <p style="font-size:13px;color:#666;margin:0 0 24px;line-height:1.6">Following our call, here's exactly what happens next.</p>
      ${stepsHtml}
      <p style="font-size:11px;color:#999;margin-top:16px;border-top:1px solid #eee;padding-top:16px">Simplify Finance | ACL 387025 | St Leonards, Sydney</p>
    </div>
  </div>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Simplify Finance <notifications@simplifyfinance.com.au>',
        to: clientEmail,
        subject: `${deal.deal_name} — what happens next`,
        html
      })
    })
    return NextResponse.json({ ok: true, emailSent: true })
  } catch (e) {
    return NextResponse.json({ ok: true, emailSent: false, reason: 'Email failed to send' })
  }
}
