import { NextRequest, NextResponse } from 'next/server'
import { resolveBrokerProfile } from '@/lib/broker-profile'
import { createSupabaseServer } from '@/lib/supabase-server'
import { siteUrl } from '@/lib/site-url'
import { stuckOn, STAGE_LABEL } from '@/lib/my-work'
import { type Stage } from '@/lib/who-did-this-stage'

// CREDIT CANNOT ACTION THIS, AND THE BROKER IS TOLD WHY.
//
// Alan's item 3. The deal has already left the credit officer's queue by the
// time this runs - the browser wrote that. This is the sentence that stops it
// landing on somebody's list out of nowhere.
//
// READ FRESH, like every other sender in this portal. What goes out is built
// here from the record, never from what a browser says it wrote.
//
// NO CLIENT IS ON IT. This is one of us telling another of us why a file has
// come back. See lib/every-client-email-files-itself.test.ts.

export const runtime = 'nodejs'
export const maxDuration = 20

const FROM = 'Simplify Finance Portal <notifications@simplifyfinance.com.au>'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* answered as missing below */ }
  const dealId = String(body?.dealId || '')
  const stage = String(body?.stage || '') as Stage
  if (!dealId || !stage) {
    return NextResponse.json({ error: 'No deal or stage given.' }, { status: 400 })
  }

  const { data: deal } = await supabase.from('deals')
    .select('id, deal_name, assigned_broker, stuck_at, stuck_by_name, stuck_why')
    .eq('id', dealId).maybeSingle()
  if (!deal) return NextResponse.json({ error: 'That deal could not be read.' }, { status: 404 })

  const stuck = stuckOn(deal)
  if (!stuck) {
    // The write has not landed, so there is nothing to tell anybody yet. Said
    // rather than sending an email with a hole where the reason belongs.
    return NextResponse.json(
      { ok: false, error: 'Nothing is recorded against that deal yet.' }, { status: 409 })
  }

  const broker = await resolveBrokerProfile((deal as any).assigned_broker)
  if (!broker?.email) {
    return NextResponse.json({
      ok: false,
      error: `It has gone back, but there is no email on file for ${(deal as any).assigned_broker || 'that broker'}.`,
    }, { status: 409 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'The mail service is not configured on this deployment.' }, { status: 500 })
  }

  const first = (broker.name || '').split(' ')[0]
  const what = STAGE_LABEL[stage] || stage
  const name = String((deal as any).deal_name || 'the deal')
  const url = `${siteUrl()}/deals/${dealId}`
  const who = stuck.byName || 'The credit team'

  const text = [
    `Hi ${first || 'there'},`,
    '',
    `${who} could not action the ${what.toLowerCase()} on ${name}, so it is back with you.`,
    '',
    stuck.why,
    '',
    url,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: broker.email,
      // Replies go to whoever is stuck, which is who the broker will want.
      ...(auth.user.email ? { reply_to: auth.user.email } : {}),
      subject: `Back with you: ${name}`,
      text,
      html:
        `<p>Hi ${first || 'there'},</p>` +
        `<p>${who} could not action the <strong>${what.toLowerCase()}</strong> on ` +
        `<strong>${name}</strong>, so it is back with you.</p>` +
        `<p>${stuck.why.replace(/\n/g, '<br>')}</p>` +
        `<p><a href="${url}">Open the deal</a></p>`,
    }),
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    console.error('[cannot-action]', res.status, detail)
    return NextResponse.json(
      { ok: false, error: (detail as any)?.message || `The mail service refused the send (${res.status}).` },
      { status: 502 })
  }

  return NextResponse.json({ ok: true, told: broker.email })
}
