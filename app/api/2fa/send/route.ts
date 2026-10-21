import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { emailShell } from '@/lib/email-shell'
import {
  makeCode, makeToken, hashSecret, codeExpiry,
  CODE_MINUTES, MAX_SENDS_PER_HOUR, enforcedFor,
} from '@/lib/two-factor'

// SENDING SOMEBODY THEIR SIGN-IN CODE.
//
// 21 Oct 2026. WHO IS ALLOWED TO CALL THIS, in this order:
//   1. ARE YOU SIGNED IN. The password has already been checked by Supabase by
//      the time anybody reaches here. This route is the SECOND factor, so it
//      is only ever reached by somebody who has passed the first.
//   2. IS IT YOUR OWN CODE. It reads the user off the session and ignores any
//      email in the body. A route that took an address from the caller would
//      send codes to strangers on request.
//
// See app/api/invite-user/route.ts for why that paragraph exists.
//
// THE CODE NEVER COMES BACK IN THE RESPONSE. It goes to the mailbox and
// nowhere else; this hands back how many minutes it lasts and nothing more.

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id || !user?.email) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  }

  // Not configured for this person means there is nothing to send. Asking for
  // a code you do not need should not fill your inbox.
  if (!enforcedFor(user.email, process.env.TWO_FACTOR_EMAILS)) {
    return NextResponse.json({ notNeeded: true })
  }

  const admin = createSupabaseAdmin()
  const now = new Date()

  // RATE LIMIT, PER PERSON, PER HOUR. Without it this route is a button that
  // sends mail to any address in the business as fast as it can be pressed.
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString()
  const { count, error: countErr } = await admin.from('auth_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('created_at', hourAgo)
  if (countErr) {
    return NextResponse.json({ error: 'Could not check recent codes.' }, { status: 500 })
  }
  if ((count || 0) >= MAX_SENDS_PER_HOUR) {
    return NextResponse.json({
      error: `That is ${MAX_SENDS_PER_HOUR} codes in an hour. Wait a few minutes, or check your junk folder.`,
    }, { status: 429 })
  }

  const code = makeCode()
  const salt = makeToken()
  const code_hash = await hashSecret(code, salt)

  // THE WRITE IS CHECKED. A policy refusing this returns no rows and no error,
  // and an unchecked insert here would mail somebody a code that can never be
  // accepted - the worst kind of failure, because it looks like it worked.
  const { data: written, error: insErr } = await admin.from('auth_codes').insert({
    user_id: user.id,
    email: user.email,
    code_hash, salt,
    expires_at: codeExpiry(now),
    requested_ip: req.headers.get('x-forwarded-for') || '',
    requested_agent: (req.headers.get('user-agent') || '').slice(0, 300),
  }).select('id')
  if (insErr || !written || written.length === 0) {
    return NextResponse.json({ error: 'Could not start a sign-in. Try again.' }, { status: 500 })
  }

  // fire-and-forget: housekeeping, and a failed sweep must never stop a sign-in.
  admin.rpc('sweep_expired_auth').then(() => {}, () => {})

  const first = String((user.user_metadata as any)?.first_name || '').trim()
  const inner = ''
    + `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px">`
    + `<span style="color:#343333;font-weight:600;text-transform:uppercase;">Your sign-in code</span></p>`
    + `<p style="margin:0 0 13px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">`
    + `<span style="color:#3d3d3a;">Hi${first ? ` ${first}` : ''},</span></p>`
    + `<p style="margin:0 0 13px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">`
    + `<span style="color:#3d3d3a;">Here is your code for the portal. It works for the next `
    + `${CODE_MINUTES} minutes.</span></p>`
    // A pale cell with a bgcolor attribute, which is the only background Word
    // paints. Dark text on it, never the other way round.
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 15px">`
    + `<tr><td bgcolor="#F7F5F1" align="center" style="padding:16px;font-family:Arial,Helvetica,sans-serif">`
    + `<span style="color:#1a1a1a;font-size:30px;font-weight:bold;letter-spacing:7px;">`
    + `${code.slice(0, 3)} ${code.slice(3)}</span></td></tr></table>`
    + `<p style="margin:0 0 13px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">`
    + `<span style="color:#3d3d3a;">If you did not just try to sign in, somebody has your password. `
    + `Change it now and tell Fabio.</span></p>`

  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
      to: [user.email],
      subject: `${code.slice(0, 3)} ${code.slice(3)} is your portal sign-in code`,
      html: emailShell(inner,
        'This code is for one sign-in. We will never ring you and ask you to read it out.'),
    }),
  }).catch(() => null)

  if (!sent || !sent.ok) {
    return NextResponse.json({
      error: 'The code could not be emailed. Try again in a moment.',
    }, { status: 502 })
  }

  return NextResponse.json({ sent: true, minutes: CODE_MINUTES })
}
