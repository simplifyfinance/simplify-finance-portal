import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { can } from '@/lib/permissions'

// CUTTING OFF A LOST LAPTOP.
//
// 21 Oct 2026. Trusting a browser for thirty days is what makes a code
// bearable - and it is also what makes a stolen laptop worth something. This
// is the answer to that, and it has to exist on the same day the trust does.
//
// Two locks, the same shape as invite-user and delete-user beside it:
//   1. ARE YOU SIGNED IN.
//   2. ARE YOU AN ADMIN, or is it your own account. Cutting off somebody
//      else's browsers is an admin job; cutting off your own is a thing anyone
//      should be able to do the moment they get a code they did not ask for.
//
// IT DOES NOT DELETE THE ROWS. It marks them revoked, with the time, so there
// is a record that the laptop was cut off and when. A deleted row answers no
// questions in three months.

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const target = String(body?.userId || user.id)

  if (target !== user.id) {
    const { data: me } = await supabase.from('user_profiles')
      .select('*').eq('id', user.id).single()
    if (!can(me as any, 'manageTeam')) {
      return NextResponse.json({ error: 'Only an admin can do that.' }, { status: 403 })
    }
  }

  const admin = createSupabaseAdmin()
  // THE WRITE IS CHECKED. A refused update returns no rows and no error, and a
  // screen that says "signed out everywhere" over a laptop that is still
  // trusted is worse than no button at all.
  const { data, error } = await admin.from('trusted_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', target).is('revoked_at', null)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, cutOff: (data || []).length })
}
