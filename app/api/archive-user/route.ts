import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { can } from '@/lib/permissions'

// SOMEBODY LEAVES. THEY DO NOT DISAPPEAR.
//
// 18 Nov 2026. Fabio, on the Delete button: "I asked you to archive when I
// delete, as we cant delete so we need to archive." He had already found out
// the hard way - "tried deleting but says error in database".
//
// DELETING A PERSON IS NOT POSSIBLE AND SHOULD NOT BE. Their name is on the
// deals they worked, the plans they wrote, the stage trail and the notes. The
// database refuses it, which is the database being right: the only two
// outcomes are an error, or a hole where somebody's work used to be.
//
// SO THE BUTTON ARCHIVES, AND ARCHIVING IS THREE THINGS:
//
//   1. MARKED PAST. active = false, which folds them into "past team members"
//      in Settings -> Team and off every list that offers a person to pick.
//   2. SIGNED OUT OF EVERY BROWSER, including trusted ones. A leaver with a
//      laptop open is a leaver who is still inside.
//   3. LOCKED OUT OF SIGNING BACK IN. This is the part that was missing:
//      switching somebody off hid them from the screens and left the login
//      working.
//
// AND IT GOES BACK. Somebody who returns, or a mistake, is one press the other
// way - the ban lifts and the rows were never touched.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 })

  const { data: me } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
  if (!can(me as any, 'manageTeam')) {
    return NextResponse.json({ ok: false, error: 'Only an admin can archive somebody.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const userId = String(body?.userId || '')
  const bringBack = body?.bringBack === true
  if (!userId) return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 })

  // NOT YOURSELF. Archiving your own account locks you out of the screen you
  // would need to undo it on.
  if (userId === user.id) {
    return NextResponse.json({ ok: false, error: 'You cannot archive your own account.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  // 1 - THE ROW. Checked, because a refused update returns no rows and no
  // error, and a screen that says "archived" over a live account is worse than
  // one that says nothing at all.
  const { data: rows, error } = await admin.from('user_profiles')
    .update({ active: bringBack }).eq('id', userId).select('id, full_name')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!rows?.length) {
    return NextResponse.json({ ok: false, error: 'Nothing was written. Tell Fabio.' }, { status: 500 })
  }

  // 2 and 3 - THE LOGIN. A ban of a hundred years is Supabase's way of saying
  // never; lifting it is setting it to none.
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: bringBack ? 'none' : '876000h',
  } as any)
  if (banError) {
    return NextResponse.json({
      ok: false,
      error: `Marked ${bringBack ? 'active' : 'past'}, but their sign-in could not be changed: ${banError.message}`,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, name: rows[0]?.full_name || '' })
}
