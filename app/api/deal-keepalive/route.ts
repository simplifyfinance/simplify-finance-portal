import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { applyPatch, type Patch } from '@/lib/keepalive-patch'

// THE LAST WRITE ON THE WAY OUT.
//
// 15 Sep 2026. A refresh, a closed tab or a click through to another page
// inside the 600ms the autosave waits takes the sentence with it. The request a
// normal save would make dies with the page that made it; this one is sent with
// keepalive, so the browser finishes delivering it after the page is gone.
//
// See lib/keepalive-patch.ts for the rule that makes an unwatched write safe:
// every field carries what that screen last saw saved in it, and a field whose
// stored value no longer matches is SKIPPED rather than overwritten.
//
// IT RUNS AS THE PERSON, NOT AS THE SERVICE. createSupabaseServer reads their
// own session out of the cookies the browser sends with a keepalive request, so
// row level security applies exactly as it does to anything else they do. There
// is no admin client in this file on purpose.

const COLUMNS = ['bc_data', 'fact_find_data', 'lo_data', 'compliance_data'] as const
type Column = typeof COLUMNS[number]

// Somebody saving without pause could in principle keep this going round. Three
// is enough for a real collision and small enough that a wedged record cannot
// hold a request open.
const RETRIES = 3

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }) }

  const dealId = String(body?.dealId || '').trim()
  const column = String(body?.column || '') as Column
  const patch = body?.patch as Patch
  if (!dealId) return NextResponse.json({ error: 'no deal' }, { status: 400 })
  if (!COLUMNS.includes(column)) return NextResponse.json({ error: 'no column' }, { status: 400 })
  if (!patch || typeof patch !== 'object') return NextResponse.json({ error: 'no patch' }, { status: 400 })

  const supabase = await createSupabaseServer()
  const { data: who } = await supabase.auth.getUser()
  if (!who?.user) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

  for (let go = 0; go < RETRIES; go++) {
    const { data: current, error } = await supabase
      .from('deals').select(`${column},row_version`).eq('id', dealId).single()
    if (error || !current) return NextResponse.json({ error: 'deal not found' }, { status: 404 })

    const out = applyPatch((current as any)[column] ?? {}, patch)
    if (out.changed.length === 0) {
      return NextResponse.json({ ok: true, changed: [], skipped: out.skipped })
    }

    const seen: number | undefined =
      typeof (current as any).row_version === 'number' ? (current as any).row_version : undefined

    const fields: any = { [column]: out.record }
    if (seen !== undefined) fields.row_version = seen + 1

    let write = supabase.from('deals').update(fields).eq('id', dealId)
    if (seen !== undefined) write = write.eq('row_version', seen)
    const { data: rows, error: writeError } = await write.select('id')

    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 })
    // ZERO ROWS IS TWO DIFFERENT THINGS. Somebody saved in the gap - go round
    // again against what the record holds now - or row level security refused
    // us, which returns zero rows and NO error. The version check tells them
    // apart. See lib/save-conflict.ts, which learned this the hard way.
    if (rows && rows.length > 0) {
      return NextResponse.json({ ok: true, changed: out.changed, skipped: out.skipped })
    }
    if (seen === undefined) {
      return NextResponse.json({ error: 'not written' }, { status: 500 })
    }
  }
  // Somebody is saving continuously. Nothing has been written and nothing is
  // lost that was not already only on a page that has gone.
  return NextResponse.json({ ok: false, error: 'record kept moving' }, { status: 409 })
}
