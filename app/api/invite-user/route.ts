import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { email, fullName, role } = await req.json()

  if (!email || !fullName || !role) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }

  const supabaseAdmin = createSupabaseAdmin()

  // Create auth user with a temporary password and send invite
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Insert user profile
  const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    active: true
  })

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
