// Moving a deal back a column on the board.
//
// NOTHING IS EVER DELETED. Fabio, 3 Sep 2026: "I dont want anyhtuing to be
// wiped out no data to be lost". Two kinds of move, and neither touches a
// client's answers:
//
//   place  - Fact Find. There is no date that put the deal past it, only the
//            fact find itself, so the card is placed and the record is left
//            exactly as it was.
//   clear  - every other column. The timestamp that moved the deal on is
//            cleared, because that timestamp IS the thing being undone.
//
// Both leave a line in the deal's note log, which is append-only, so the file
// carries its own history of having been moved. And if a credit assessor is
// allocated, they are told - otherwise somebody carries on working a deal that
// has been pulled back underneath them.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { PHASE_LABEL, derivedPhaseOf, type Phase } from '@/lib/deal-phase'
import { notifyDealMovedBack } from '@/lib/salestrekker-notify'

export async function POST(req: NextRequest) {
  try {
    const { dealId, target, fields, place } = await req.json() as
      { dealId: string; target: Phase; fields: string[]; place?: boolean }
    if (!dealId || !target) return NextResponse.json({ ok: false, error: 'Missing dealId or target' }, { status: 400 })

    const supabase = await createSupabaseServer()
    const { data: deal, error } = await supabase.from('deals')
      .select('*, clients(first_name, last_name)').eq('id', dealId).single()
    if (error || !deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    const from = derivedPhaseOf(deal)
    const patch: Record<string, any> = {}
    if (place) {
      patch.phase_override = target
      patch.phase_override_from = from
      patch.phase_override_at = new Date().toISOString()
    } else {
      for (const f of (fields || [])) patch[f] = null
      // A deliberate move supersedes an older hand placement.
      patch.phase_override = null
      patch.phase_override_from = null
      patch.phase_override_at = null
    }

    const { data: rows, error: upErr } = await supabase.from('deals').update(patch).eq('id', dealId).select('id')
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    if (!rows?.length) {
      return NextResponse.json({
        ok: false,
        error: 'The move was not saved - the database refused the change. Nothing has been altered.',
      }, { status: 500 })
    }

    // --- the history line ---------------------------------------------------
    const { data: u } = await supabase.auth.getUser()
    const me = u?.user?.id
      ? (await supabase.from('user_profiles').select('full_name').eq('id', u.user.id).single()).data?.full_name || null
      : null

    const body = place
      ? `Moved back to ${PHASE_LABEL[target]} from ${PHASE_LABEL[from]} on the board. Nothing was deleted — the fact find, the BC workings and every date are unchanged; only where the deal is shown has moved.`
      : `Moved back to ${PHASE_LABEL[target]} from ${PHASE_LABEL[from]} on the board. Cleared: ${(fields || []).join(', ') || 'nothing'}.`

    const { data: noted, error: noteErr } = await supabase.from('deal_notes')
      .insert({ deal_id: dealId, body, kind: 'system', author_id: u?.user?.id || null, author_name: me })
      .select('id')
    // The move itself is done. A missing note is worth saying out loud - the log
    // is the file's memory - but never worth undoing the move for.
    const noteFailed = !!noteErr || !noted?.length

    // --- telling the assessor ------------------------------------------------
    let emailWarning: string | null = null
    if (deal.assigned_credit_officer) {
      const { data: officer } = await supabase.from('credit_officers')
        .select('name, user_id').eq('id', deal.assigned_credit_officer).single()
      let toEmail: string | null = null, toName: string | null = officer?.name || null
      if (officer?.user_id) {
        const { data: p } = await supabase.from('user_profiles').select('email, full_name').eq('id', officer.user_id).single()
        toEmail = p?.email || null
        toName = p?.full_name || toName
      }
      if (toEmail) {
        const sent = await notifyDealMovedBack({
          dealId,
          dealName: deal.deal_name,
          clientName: `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim(),
          brokerName: deal.assigned_broker || '',
          fromLabel: PHASE_LABEL[from],
          toLabel: PHASE_LABEL[target],
          movedBy: me,
          recipientEmail: toEmail,
          recipientName: toName,
        })
        if (!sent.ok) emailWarning = `${toName || 'The credit assessor'} was not emailed (${sent.error}). Tell them yourself.`
      } else {
        emailWarning = `${toName || 'The allocated credit assessor'} has no email address on their profile, so they were not told.`
      }
    }

    return NextResponse.json({
      ok: true,
      warning: [noteFailed ? 'The move is done, but it was not written to the file notes.' : '', emailWarning]
        .filter(Boolean).join(' ') || undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
