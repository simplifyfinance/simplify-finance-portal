import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { siteUrl } from '@/lib/site-url'
import { raisedSubject, raisedBody, type Flag } from '@/lib/something-is-wrong'

// TELLING MANAGEMENT SOMETHING IS WRONG.
//
// 17 Aug 2026. Alan's item 5, as he described it: somebody spots something
// wrong, flags it, and whoever owns corrections is copied in so they can check
// the fix actually lands.
//
// NOBODY IS NAMED HERE. Fabio: "change to tell management not Catherine in
// case she moves on." The recipients come out of Settings. An empty setting
// sends nothing and says so, rather than quietly dropping it - the flag is on
// the list either way.

export const runtime = 'nodejs'
export const maxDuration = 20

const FROM = 'Simplify Finance Portal <notifications@simplifyfinance.com.au>'

function addressList(raw: any): string[] {
  return String(raw || '').split(/[,;\s]+/).map(a => a.trim())
    .filter(a => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a))
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* answered as missing below */ }
  const flagId = String(body?.flagId || '')
  if (!flagId) return NextResponse.json({ error: 'No flag given.' }, { status: 400 })

  // READ FRESH, rather than trusting what the browser says was flagged. The
  // same rule as every other sender in this portal.
  const { data: flag } = await supabase.from('deal_flags').select('*').eq('id', flagId).maybeSingle()
  if (!flag) return NextResponse.json({ error: 'That flag could not be read.' }, { status: 404 })

  let dealName = ''
  if ((flag as any).deal_id) {
    const { data: deal } = await supabase.from('deals')
      .select('deal_name').eq('id', (flag as any).deal_id).maybeSingle()
    dealName = String((deal as any)?.deal_name || '')
  }

  const { data: settings } = await supabase.from('settings')
    .select('flag_recipients').eq('id', 'singleton').maybeSingle()
  const to = addressList((settings as any)?.flag_recipients)

  if (!to.length) {
    // SAID, NOT SWALLOWED. A flag that reached nobody because the setting is
    // empty is exactly the failure this whole thing exists to stop.
    return NextResponse.json({
      ok: false,
      error: 'Nobody is set to receive flags. Settings — error flags.',
    }, { status: 409 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'The mail service is not configured on this deployment.' }, { status: 500 })
  }

  const url = (flag as any).deal_id ? `${siteUrl()}/deals/${(flag as any).deal_id}` : `${siteUrl()}/lenders`
  const text = raisedBody(flag as Flag, dealName, url)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to,
      // Replies go to whoever spotted it, which is who management will want to
      // ask about it.
      ...(auth.user.email ? { reply_to: auth.user.email } : {}),
      subject: raisedSubject(flag as Flag, dealName),
      text,
    }),
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    console.error('[flag-raised]', res.status, detail)
    return NextResponse.json(
      { ok: false, error: (detail as any)?.message || `The mail service refused the send (${res.status}).` },
      { status: 502 })
  }

  return NextResponse.json({ ok: true, told: to.length })
}
