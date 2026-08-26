import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// Which templates are archived, shared by the whole team. A template Kylie puts
// away should be away for everyone, not just her browser — so it lives in
// settings rather than localStorage.
//
// Written through the admin client so a staff member can archive one without
// needing write access to the settings row generally.

async function requireUser() {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.auth.getUser()
  return data?.user || null
}

export async function GET() {
  if (!await requireUser()) return NextResponse.json({ archived: [] })
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('settings')
    .select('archived_templates').eq('id', 'singleton').maybeSingle()
  return NextResponse.json({ archived: (data as any)?.archived_templates || [] })
}

export async function POST(req: NextRequest) {
  if (!await requireUser()) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

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
