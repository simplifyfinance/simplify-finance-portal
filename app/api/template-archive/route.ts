import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { onlyStaff } from '@/lib/only-staff'

// Which templates are archived, shared by the whole team. A template Kylie puts
// away should be away for everyone, not just her browser — so it lives in
// settings rather than localStorage.
//
// Written through the admin client so a staff member can archive one without
// needing write access to the settings row generally.

// 23 Nov 2026. THIS USED TO ASK "ARE YOU SIGNED IN?" and then write with the
// admin client, which ignores every rule in the database. A login with no staff
// record behind it - which is what a deleted staff member leaves - could change
// which templates are hidden for the whole team. See lib/only-staff.ts.

export async function GET() {
  const { refusal } = await onlyStaff()
  // A LIST, NOT A REFUSAL. The screen asks for this on load; an empty list is
  // the honest answer and does not throw a red box at somebody mid-sign-in.
  if (refusal) return NextResponse.json({ archived: [] })
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('settings')
    .select('archived_templates').eq('id', 'singleton').maybeSingle()
  return NextResponse.json({ archived: (data as any)?.archived_templates || [] })
}

export async function POST(req: NextRequest) {
  const { refusal } = await onlyStaff()
  if (refusal) return refusal

  const { id, archived } = await req.json().catch(() => ({}))
  if (!id || typeof archived !== 'boolean') {
    return NextResponse.json({ error: 'A template id and a state are both needed.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data } = await admin.from('settings')
    .select('archived_templates').eq('id', 'singleton').maybeSingle()
  const current: string[] = (data as any)?.archived_templates || []
  const next = archived
    ? Array.from(new Set([...current, String(id)]))
    : current.filter(x => x !== String(id))

  const { error } = await admin.from('settings')
    .update({ archived_templates: next }).eq('id', 'singleton')
  if (error) {
    console.error('[template-archive]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ archived: next })
}
