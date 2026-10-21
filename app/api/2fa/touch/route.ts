import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import {
  openPass, sealPass, sessionVerdict, shouldPush,
  SESSION_COOKIE, ABSOLUTE_HOURS,
} from '@/lib/two-factor'

// SOMEBODY IS ACTUALLY THERE.
//
// 21 Oct 2026. THE WHOLE FEATURE TURNS ON THIS ROUTE BEING HONEST.
//
// This portal saves as you type and keeps a presence record for every open
// deal. If the idle clock were pushed by any request at all, a laptop left open
// overnight would keep itself alive until morning - which is the exact thing
// Fabio asked to have fixed.
//
// So the portal talking to itself never reaches here. Only a real finger on a
// key or a mouse button does, and the page sends it at most once every five
// minutes. A tab sitting open with nobody at it sends nothing and times out.

export async function POST(req: NextRequest) {
  const secret = process.env.AUTH_COOKIE_SECRET || ''
  if (!secret) return NextResponse.json({ ok: false })

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false }, { status: 401 })

  const pass = await openPass(req.cookies.get(SESSION_COOKIE)?.value, secret)
  const now = new Date()
  // AN EXPIRED SESSION IS NOT REVIVED BY TYPING INTO IT. Once the hour is up
  // the next page load signs them out; this must not hand back the time.
  if (sessionVerdict(pass, user.id, now) !== 'ok') return NextResponse.json({ ok: false })
  if (!shouldPush(pass!, now)) return NextResponse.json({ ok: true, quiet: true })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE,
    // v is carried, never reset: the twelve hour cap is from when the code was
    // accepted, and being busy must not be able to extend it.
    await sealPass({ u: user.id, v: pass!.v, s: now.getTime() }, secret),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ABSOLUTE_HOURS * 3600,
    })
  return res
}
