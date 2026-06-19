import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { email, fullName, role } = await req.json()

  if (!email || !fullName || !role) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }

  const supabase = await createSupabaseServer()

  // Create auth user with a temporary password and send invite
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Insert user profile
  await supabase.from('user_profiles').insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    active: true
  })

  return NextResponse.json({ ok: true })
}
