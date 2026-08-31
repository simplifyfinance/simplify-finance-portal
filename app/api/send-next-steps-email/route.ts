import { NextRequest, NextResponse } from 'next/server'
import { markProceeded, buildNextStepsContent } from '@/lib/proceed-flow'
import { createSupabaseServer } from '@/lib/supabase-server'

// This route is only ever reached from the "Client agreed" button on the BC and
// LO tabs, which only we can see. So anything arriving here was recorded by our
// office, not pressed by the client - and we name who, so the two are never
// confused later.
export async function POST(req: NextRequest) {
  const { dealId, stage } = await req.json()
  if (!dealId || (stage !== 'BC' && stage !== 'LO')) {
    return NextResponse.json({ ok: false, error: 'Missing dealId or invalid stage' }, { status: 400 })
  }

  let byName: string | null = null
  try {
    const supabase = await createSupabaseServer()
    const { data: auth } = await supabase.auth.getUser()
    if (auth?.user?.id) {
      const { data: prof } = await supabase.from('user_profiles')
        .select('full_name').eq('id', auth.user.id).maybeSingle()
      byName = (prof as any)?.full_name || auth.user.email || null
    }
  } catch {
    // Not knowing the name is survivable - it still records that we pressed it.
  }

  const result = await markProceeded(dealId, stage, { source: 'office', name: byName })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 404 })

  const { deal, alreadyProceeded, wealthDeskLink } = result
  if (alreadyProceeded) {
    return NextResponse.json({ ok: true, alreadyProceeded: true, by: byName })
  }

  const clientEmail = deal.clients?.email
  if (!clientEmail) {
    return NextResponse.json({ ok: true, emailSent: false, by: byName, reason: 'No email on file for this client' })
  }

  const { steps } = buildNextStepsContent(stage, wealthDeskLink)
  const clientName = deal.clients?.first_name || 'there'

  // Tables, not flex. Word ignores display:flex and border-radius entirely, so
  // the numbered steps collapsed into a stack of loose text in Outlook on
  // Windows. Every colour sits on a cell as a bgcolor attribute for the same
  // reason — Word paints nothing from CSS alone.
  const stepsHtml = steps.map((s: any) => {
    const badge = s.accent ? '#1D9E75' : '#343333'
    const button = s.button && wealthDeskLink
      ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px"><tr>
           <td bgcolor="#1D9E75" align="center" style="background:#1D9E75;border-radius:6px;padding:8px 14px">
             <a href="${wealthDeskLink}" style="color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;display:inline-block">Click here to share your bank statements</a>
           </td></tr></table>`
      : ''
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
      <td width="34" valign="top" style="width:34px">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="24" height="24" bgcolor="${badge}" align="center" valign="middle"
              style="width:24px;height:24px;background:${badge};border-radius:12px;color:#ffffff;font-size:11px;font-weight:700;font-family:Arial,sans-serif">${s.num}</td>
        </tr></table>
      </td>
      <td valign="top" style="font-family:Arial,sans-serif">
        <p style="margin:0 0 4px;font-weight:700;color:#343333;font-size:13px"><span style="color:#343333;">${s.title}</span></p>
        <p style="margin:0;color:#666666;font-size:12px;line-height:1.6"><span style="color:#666666;">${s.desc}</span></p>
        ${button}
      </td>
    </tr></table>`
  }).join('')

  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;font-family:Arial,sans-serif">
    <tr><td bgcolor="#F2E8DB" align="center" style="background:#F2E8DB;padding:24px 12px">
      <table width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" align="center" style="background:#ffffff;border-radius:16px;max-width:480px">
        <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:36px">
          <h1 style="font-size:20px;font-weight:700;color:#343333;margin:0 0 8px">Great news, ${clientName}!</h1>
          <p style="font-size:13px;color:#666666;margin:0 0 24px;line-height:1.6"><span style="color:#666666;">Following our call, here&rsquo;s exactly what happens next.</span></p>
          ${stepsHtml}
          <p style="font-size:11px;color:#999999;margin:16px 0 0;border-top:1px solid #eeeeee;padding-top:16px"><span style="color:#999999;">Simplify Finance | ACL 387025 | St Leonards, Sydney</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>`

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
    return NextResponse.json({ ok: true, emailSent: true, by: byName })
  } catch (e) {
    return NextResponse.json({ ok: true, emailSent: false, by: byName, reason: 'Email failed to send' })
  }
}
