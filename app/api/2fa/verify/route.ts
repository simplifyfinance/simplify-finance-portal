import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import {
  hashSecret, makeToken, checkCode, sealPass, trustExpiry,
  SESSION_COOKIE, DEVICE_COOKIE, TRUST_DAYS, ABSOLUTE_HOURS, MAX_ATTEMPTS,
} from '@/lib/two-factor'

// CHECKING THE CODE, AND REMEMBERING THE BROWSER.
//
// 21 Oct 2026. Same two locks as the send route: signed in, and only ever your
// own code. The code is hashed before it is compared, and compared in constant
// time - see sameSecret in lib/two-factor.ts.
//
// WHAT COMES BACK IS TWO COOKIES AND NOTHING ELSE:
//   sf_pass   - this session has passed, signed, and carries the two clocks.
//   sf_device - this browser may skip the code for thirty days.
// Both HttpOnly, so nothing running on the page can read either of them.

const BAD: Record<string, string> = {
  expired: 'That code has expired. Send a new one.',
  used: 'That code has already been used. Send a new one.',
  'too-many': `That code has had ${MAX_ATTEMPTS} wrong tries and is now dead. Send a new one.`,
  wrong: 'That code is not right.',
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const secret = process.env.AUTH_COOKIE_SECRET || ''
  if (!secret) {
    // Said out loud rather than failing quietly: without it nothing can be
    // signed, and a silent pass here would be a door with no lock in it.
    return NextResponse.json({ error: 'Sign-in is not configured on this site.' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const given = String(body?.code || '').replace(/\D/g, '')
  const trust = body?.trust !== false
  if (given.length !== 6) return NextResponse.json({ error: 'Type the six digits.' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const now = new Date()

  // The newest live code for this person. Asking for several and taking the
  // newest means an old one sitting in the mailbox cannot be used instead.
  const { data: rows } = await admin.from('auth_codes')
    .select('id, code_hash, salt, expires_at, used_at, attempts')
    .eq('user_id', user.id).is('used_at', null)
    .order('created_at', { ascending: false }).limit(1)

  const row = (rows || [])[0] as any
  if (!row) return NextResponse.json({ error: 'Send yourself a code first.' }, { status: 400 })

  const verdict = checkCode(row, await hashSecret(given, String(row.salt || '')), now)

  if (!verdict.ok) {
    // EVERY WRONG GUESS COSTS ONE. Without this the five-try limit is a
    // decoration and a million guesses is an afternoon.
    // fire-and-forget: the count is best effort; the answer below is the point.
    if (verdict.why === 'wrong') {
      admin.from('auth_codes').update({ attempts: Number(row.attempts || 0) + 1 })
        .eq('id', row.id).then(() => {}, () => {})
    }
    return NextResponse.json({
      error: BAD[verdict.why] || 'That code is not right.',
      left: verdict.left,
    }, { status: 400 })
  }

  // A CODE IS FOR ONE SIGN-IN. Checked, because a refused update here would
  // leave it live in a mailbox for the rest of its ten minutes.
  const { data: spent, error: spendErr } = await admin.from('auth_codes')
    .update({ used_at: now.toISOString() }).eq('id', row.id).is('used_at', null).select('id')
  if (spendErr || !spent || spent.length === 0) {
    return NextResponse.json({ error: 'That code has already been used.' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  const secureCookie = {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }

  res.cookies.set(SESSION_COOKIE,
    await sealPass({ u: user.id, v: now.getTime(), s: now.getTime() }, secret),
    { ...secureCookie, maxAge: ABSOLUTE_HOURS * 3600 })

  if (trust) {
    const token = makeToken()
    const salt = makeToken()
    const agent = req.headers.get('user-agent') || ''
    const { data: kept, error: trustErr } = await admin.from('trusted_devices').insert({
      user_id: user.id,
      token_hash: await hashSecret(token, salt),
      salt,
      expires_at: trustExpiry(now),
      label: describe(agent),
    }).select('id')

    // A TRUST THAT WAS NOT SAVED MUST NOT BE HANDED OUT. The cookie would be
    // presented every morning and refused every morning, and the person would
    // be told their browser is not trusted while the box was ticked.
    if (!trustErr && kept && kept.length > 0) {
      res.cookies.set(DEVICE_COOKIE, `${kept[0].id}.${token}`,
        { ...secureCookie, maxAge: TRUST_DAYS * 86400 })
    }
  }

  return res
}

/** "Chrome on a Mac" - something a person can recognise on the Team page. */
function describe(agent: string): string {
  const a = agent.toLowerCase()
  const browser = a.includes('edg/') ? 'Edge'
    : a.includes('chrome') && !a.includes('edg/') ? 'Chrome'
    : a.includes('firefox') ? 'Firefox'
    : a.includes('safari') ? 'Safari' : 'A browser'
  const machine = a.includes('iphone') ? 'an iPhone'
    : a.includes('ipad') ? 'an iPad'
    : a.includes('android') ? 'an Android'
    : a.includes('mac os') ? 'a Mac'
    : a.includes('windows') ? 'Windows' : 'a computer'
  return `${browser} on ${machine}`
}
