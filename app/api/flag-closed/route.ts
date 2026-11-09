import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { closedSubject, closedBody, type Flag } from '@/lib/something-is-wrong'

// THE LOOP CLOSES.
//
// 17 Aug 2026. Alan's item 5: "close the loop, don't repeat the mistake."
// This is the half that does not happen today - somebody sends a screenshot
// about a wrong fee and never hears another word, so they keep working around
// it and the next person flags the same thing six weeks later.
//
// IT GOES BACK TO WHOEVER RAISED IT, nobody else. Management already know -
// they are the ones who just closed it. The person who spotted it is the one
// still working around it.
//
// AND IT SAYS WHAT THE FIX DOES NOT COVER. A quote already with a client still
// carries the old figure. Saying so is the difference between a fix and a
// surprise - see closedBody() in lib/something-is-wrong.ts.

export const runtime = 'nodejs'
export const maxDuration = 20

const FROM = 'Simplify Finance Portal <notifications@simplifyfinance.com.au>'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* answered as missing below */ }
  const flagId = String(body?.flagId || '')
  if (!flagId) return NextResponse.json({ error: 'No flag given.' }, { status: 400 })

  // READ FRESH. The same rule as every other sender in this portal: what goes
  // out is built here from the database, not from what the browser says.
  const { data: flag } = await supabase.from('deal_flags').select('*').eq('id', flagId).maybeSingle()
  if (!flag) return NextResponse.json({ error: 'That flag could not be read.' }, { status: 404 })

  if (!String((flag as any).checked_at || '').trim()) {
    // Fixed is not checked, and only checked closes the loop.
    return NextResponse.json(
      { ok: false, error: 'That has not been checked yet, so there is nothing to say.' },
      { status: 409 })
  }

  // WHO SPOTTED IT. The name is on the flag; the address is on their profile,
  // because a name is not something you can send to.
  let to = ''
  if ((flag as any).raised_by) {
    const { data: who } = await supabase.from('user_profiles')
      .select('email').eq('id', (flag as any).raised_by).maybeSingle()
    to = String((who as any)?.email || '').trim()
  }
  if (!to) {
    return NextResponse.json({
      ok: false,
      error: 'It is closed, but there is no email address for whoever raised it.',
    }, { status: 409 })
  }

  let dealName = ''
  if ((flag as any).deal_id) {
    const { data: deal } = await supabase.from('deals')
      .select('deal_name').eq('id', (flag as any).deal_id).maybeSingle()
    dealName = String((deal as any)?.deal_name || '')
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'The mail service is not configured on this deployment.' }, { status: 500 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      // A reply goes to whoever checked it, who is the person who can answer
      // "it is still wrong".
      ...(auth.user.email ? { reply_to: auth.user.email } : {}),
      subject: closedSubject(flag as Flag),
      text: closedBody(flag as Flag, dealName),
    }),
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    console.error('[flag-closed]', res.status, detail)
    return NextResponse.json(
      { ok: false, error: (detail as any)?.message || `The mail service refused the send (${res.status}).` },
      { status: 502 })
  }

  return NextResponse.json({ ok: true, told: to })
}
