import { NextRequest, NextResponse } from 'next/server'
import { markProceeded, buildNextStepsContent, nextStepsSubject, loadProceed, stageFor } from '@/lib/proceed-flow'
import { buildNextStepsEmailHtml } from '@/lib/next-steps-email'
import { createSupabaseServer } from '@/lib/supabase-server'

// WHAT WOULD BE SENT, WITHOUT SENDING IT.
//
// 11 Sep 2026. Fabio: "test it with robot, make sure emails are going out, link
// is there and subject line is good." The only way to press the real button is to
// email a real client and move their deal a stage, which a robot does not get to
// do. So the robot reads this instead.
//
// IT WRITES NOTHING AND SENDS NOTHING. It builds the subject and the HTML through
// exactly the same two functions the POST below uses, so what the robot reads is
// the real email rather than a copy that can quietly drift from it.
//
// Signed in only - it returns the client's first name and the WealthDesk link.
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const dealId = req.nextUrl.searchParams.get('dealId') || ''
  const hint = req.nextUrl.searchParams.get('stage') || ''
  if (!dealId) return NextResponse.json({ error: 'Missing dealId' }, { status: 400 })

  const result = await loadProceed(dealId)
  if (!result.ok) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const { deal, wealthDeskLink } = result
  const stage = stageFor(deal, hint)
  const { steps } = buildNextStepsContent(stage, wealthDeskLink)

  return NextResponse.json({
    preview: true,
    stage,
    subject: nextStepsSubject(stage),
    html: buildNextStepsEmailHtml({ stage, clientName: deal.clients?.first_name, wealthDeskLink }),
    wealthDeskLink,
    stepCount: steps.length,
    // Whether a real send would have a recipient at all. The address itself is
    // not returned - a robot has no business logging a client's email.
    hasClientEmail: !!deal.clients?.email,
  })
}

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

  const html = buildNextStepsEmailHtml({
    stage, clientName: deal.clients?.first_name, wealthDeskLink,
  })

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Simplify Finance <notifications@simplifyfinance.com.au>',
        to: clientEmail,
        subject: nextStepsSubject(stage),
        html
      })
    })
    return NextResponse.json({ ok: true, emailSent: true, by: byName })
  } catch (e) {
    return NextResponse.json({ ok: true, emailSent: false, by: byName, reason: 'Email failed to send' })
  }
}
