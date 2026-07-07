import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { dealId, creditOfficerId } = await req.json()
  if (!dealId || !creditOfficerId) return NextResponse.json({ ok: false, error: 'Missing dealId or creditOfficerId' }, { status: 400 })

  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return NextResponse.json({ ok: false, error: 'Could not verify permissions' }, { status: 403 })
  if (profile.role !== 'admin') return NextResponse.json({ ok: false, error: 'Only admins can manually reassign deals' }, { status: 403 })

  const { data: officer, error: officerError } = await supabase
    .from('credit_officers')
    .select('id, name')
    .eq('id', creditOfficerId)
    .single()

  if (officerError || !officer) return NextResponse.json({ ok: false, error: 'Credit officer not found' }, { status: 404 })

  const { error: updateError } = await supabase
    .from('deals')
    .update({ assigned_credit_officer: creditOfficerId, credit_assigned_at: new Date().toISOString() })
    .eq('id', dealId)

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, assignedTo: officer.name })
}
