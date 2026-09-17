import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'

// CHANGING SOMEBODY'S EMAIL MEANS CHANGING THEIR LOGIN.
//
// 17 Sep 2026. Ellesse was recorded as ellesse@simpilfyfinance.com.au - the
// domain is misspelled and does not exist, so every invitation and every
// notification the portal has ever sent her went nowhere, and the Team screen
// could not fix it: the name had a pencil beside it and the email was grey text.
//
// The address lives in TWO places. user_profiles.email is what the portal shows
// and matches on; the login itself belongs to Supabase Auth. Making the field
// editable on the screen alone would have changed the first and left her signing
// in as simpilfy - a fix that looks complete and is not.
//
// THE ORDER IS DELIBERATE. The login is changed first and the profile second. Do
// it the other way and a failure in the middle leaves somebody signing in with
// an address the portal does not know, which is a person locked out by a tidy-up.
// This way the worst case is a login that changed and a screen that says so, in
// words, with what to do about it.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const { userId, email } = await req.json()
  const next = String(email || '').trim().toLowerCase()

  if (!userId) return NextResponse.json({ ok: false, error: 'No user was named.' }, { status: 400 })
  if (!EMAIL.test(next)) {
    return NextResponse.json({ ok: false, error: 'That is not an email address. Nothing was changed.' }, { status: 400 })
  }

  // Changing a login is an admin thing. Checked on the server, because a button
  // that is not drawn is not a permission.
  const server = await createSupabaseServer()
  const { data: { user: me } } = await server.auth.getUser()
  if (!me) return NextResponse.json({ ok: false, error: 'You are not signed in.' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data: myProfile } = await admin.from('user_profiles').select('is_admin, role').eq('id', me.id).single()
  if (!myProfile?.is_admin && myProfile?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Only an admin can change somebody\'s email.' }, { status: 403 })
  }

  const { data: target } = await admin.from('user_profiles')
    .select('id, email, full_name').eq('id', userId).single()
  if (!target) return NextResponse.json({ ok: false, error: 'That person is not on the team list.' }, { status: 404 })

  // The same address in different case is not a change, and refusing it would be
  // a confusing way to say nothing needed doing.
  if (String(target.email || '').trim().toLowerCase() === next) {
    return NextResponse.json({ ok: true, unchanged: true, email: next })
  }

  // TWO PEOPLE CANNOT SHARE A LOGIN. Named, so nobody has to go looking.
  const { data: clash } = await admin.from('user_profiles')
    .select('full_name').neq('id', userId).ilike('email', next).maybeSingle()
  if (clash) {
    return NextResponse.json({ ok: false,
      error: `That address already belongs to ${clash.full_name}. Two people cannot share a login.` }, { status: 409 })
  }

  // 1. The login.
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { email: next })
  if (authError) {
    return NextResponse.json({ ok: false,
      error: `The login was not changed: ${authError.message}. Nothing else was touched.` }, { status: 500 })
  }

  // 2. The profile. If this fails the login HAS changed, and saying so plainly is
  // the only honest thing to do - the person can still sign in, with the new
  // address, and somebody has to put the profile right.
  const { data: rows, error: profileError } = await admin
    .from('user_profiles').update({ email: next }).eq('id', userId).select('id')
  if (profileError || !rows || rows.length === 0) {
    return NextResponse.json({ ok: false, halfDone: true, email: next,
      error: `${target.full_name} now signs in as ${next}, but the team list could not be updated`
           + `${profileError ? `: ${profileError.message}` : ''}. Tell Fabio - the two are out of step.` },
      { status: 500 })
  }

  return NextResponse.json({ ok: true, email: next, was: target.email })
}
