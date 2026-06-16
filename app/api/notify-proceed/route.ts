import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { dealName, clientName } = await req.json()

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#343333;padding:20px;text-align:center">
        <p style="color:#fff;font-size:18px;font-weight:bold;margin:0">Simplify Finance</p>
        <p style="color:#2DBEFF;font-size:12px;margin:4px 0 0">Client Ready to Proceed</p>
      </div>
      <div style="padding:32px;background:#fff">
        <p style="font-size:16px;color:#343333;font-weight:600">Action required</p>
        <p style="color:#555;line-height:1.6"><strong>${clientName}</strong> has confirmed they are ready to proceed on deal <strong>${dealName}</strong>.</p>
        <p style="color:#555;line-height:1.6">The deal has been automatically moved to the <strong>Lending Options</strong> stage in the portal.</p>
        <p style="color:#555;line-height:1.6">Next step: Send the client an invitation to the client portal to begin document collection.</p>
        <div style="background:#F2E8DB;border-radius:8px;padding:16px;margin:24px 0">
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

  // Send to both brokers via Resend or just return success for now
  // TODO: wire to email provider (Resend) when ready
  console.log('Proceed notification triggered for:', clientName, dealName)

  return NextResponse.json({ ok: true, html })
}
