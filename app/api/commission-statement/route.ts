import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// Removing a statement that should not have been loaded.
//
// Until now this took hand-written SQL, which meant a wrong file sat in the
// figures until somebody went looking for it. The lines go first, then the
// statement, and the count of each is reported back — a delete that removed
// nothing must not look like a delete that worked.

async function allowed() {
  const supabase = await createSupabaseServer()
  const { data: u } = await supabase.auth.getUser()
  if (!u?.user) return null
  const { data: p } = await supabase.from('user_profiles')
    .select('is_admin, sees_finance').eq('id', u.user.id).single()
  return (p?.is_admin || p?.sees_finance) ? u.user : null
}

export async function DELETE(req: NextRequest) {
  if (!await allowed()) {
    return NextResponse.json({ error: 'You do not have access to commission figures.' }, { status: 403 })
  }
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Which statement?' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: stmt } = await admin.from('commission_statements')
    .select('id, broker_key, kind, period_month, filename').eq('id', id).maybeSingle()
  if (!stmt) return NextResponse.json({ error: 'That statement is no longer there.' }, { status: 404 })

  const { data: lines, error: lineErr } = await admin.from('commission_lines')
    .delete().eq('statement_id', id).select('id')
  if (lineErr) {
    return NextResponse.json({ error: `The lines could not be removed: ${lineErr.message}` }, { status: 500 })
  }

  const { data: gone, error: stmtErr } = await admin.from('commission_statements')
    .delete().eq('id', id).select('id')
  if (stmtErr || !gone?.length) {
    return NextResponse.json(
      { error: stmtErr?.message || 'The lines were removed but the statement itself was not. Nothing is half-loaded — try again.' },
      { status: 500 })
  }

  return NextResponse.json({ ok: true, removedLines: lines?.length || 0, statement: stmt })
}
