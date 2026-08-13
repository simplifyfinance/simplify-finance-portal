import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 })

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ ok: false, error: 'Only admins can delete team members' }, { status: 403 })

  const supabaseAdmin = createSupabaseAdmin()

  // Clear any credit_officers link first, so deleting the account never leaves an
  // orphaned reference behind (the officer record itself stays, just unlinked)
  await supabaseAdmin.from('credit_officers').update({ user_id: null }).eq('user_id', userId)

  const { error: profileError } = await supabaseAdmin.from('user_profiles').delete().eq('id', userId)
  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 })

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authError) return NextResponse.json({ ok: false, error: authError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
