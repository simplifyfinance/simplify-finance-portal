// ASKING A CLIENT FOR THEIR DOCUMENTS - the button on the deal.
//
// The work is in lib/document-request.ts, because since 14 Sep 2026 there are two
// ways in: this button, and the portal doing it by itself the moment the client
// agrees to proceed at the end of BC. One function so they cannot drift.
//
// POST { dealId, keys: string[] }
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requestDocuments } from '@/lib/document-request'

export async function POST(req: NextRequest) {
  try {
    const { dealId, keys } = await req.json() as { dealId: string; keys: string[] }
    if (!dealId) return NextResponse.json({ ok: false, error: 'Missing dealId' }, { status: 400 })
    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nothing was ticked, so there is nothing to ask for.' }, { status: 400 })
    }

    const supabase = await createSupabaseServer()
    const { data: u } = await supabase.auth.getUser()
    const me = u?.user?.id
      ? (await supabase.from('user_profiles').select('full_name').eq('id', u.user.id).single()).data?.full_name || null
      : null

    const r = await requestDocuments(supabase, { dealId, keys, by: me, origin: 'button' })

    if (!r.ok) {
      return NextResponse.json({
        ok: false, error: r.error, recorded: r.recorded, requestedAt: r.requestedAt,
      }, { status: r.status })
    }
    if (r.skipped) {
      return NextResponse.json({ ok: true, skipped: true, reason: r.reason, covered: r.covered })
    }
    return NextResponse.json({
      ok: true, requestedAt: r.requestedAt, count: r.sent, to: r.to,
      rounds: r.rounds, ignored: r.ignored, covered: r.covered,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Something went wrong' }, { status: 500 })
  }
}
