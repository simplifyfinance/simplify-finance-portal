// TAKING A CLIENT'S AGREEMENT BACK OFF THE FILE.
//
// 25 Nov 2026. Fabio needed to pivot a client off Bankwest after they had
// already agreed. Both buttons that would have let him were hidden, nothing on
// the screen said why, and it ended in a hand-written SQL update on a live deal:
//
//   "I don't like dragging deal cards... even when we send to the client, it
//    doesn't suppress. So we can always change it and send it again."
//
// The buttons now stay. This route is what they call first when there is an
// agreement in the way.
//
// IT CLEARS BOTH HALVES OR IT CLEARS NEITHER, and that is the whole risk of the
// feature. The client's own press lives on `deals`. The broker's recorded
// answer - "Yes, they went with Bankwest" - lives in `lo_data`, and THAT is
// what the compliance pack reads. Clear one and not the other and compliance
// faithfully rebuilds from a stale answer, naming a lender nobody is taking, on
// a regulated document. That is the Charles Mullins fault of 25 Sep 2026 coming
// back through a different door.
//
// Both halves are worked out in lib/send-it-back.ts, which has no database in
// it, and lib/the-agreement-comes-off-both.test.ts fails the build if either
// list shrinks.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { can } from '@/lib/permissions'
import {
  undoesTheAgreement, undoTheAgreement, loDataWithoutTheAgreement,
  undoTheAgreementLine, type BackStage,
} from '@/lib/send-it-back'

export async function POST(req: NextRequest) {
  try {
    const { dealId, stage, by } = await req.json() as
      { dealId: string; stage: BackStage; by: string }
    if (!dealId || (stage !== 'bc' && stage !== 'lo')) {
      return NextResponse.json({ ok: false, error: 'Missing dealId or stage' }, { status: 400 })
    }

    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

    const me = await supabase.from('user_profiles')
      .select('role, full_name').eq('id', user.id).single()
    if (!me.data) {
      return NextResponse.json({ ok: false, error: 'Could not verify permissions' }, { status: 403 })
    }
    // THE SAME GATE AS SENDING THE EMAIL. Undoing an agreement is a broker
    // talking to their client about a different deal; it is not an admin tidy-up.
    if (!can(me.data.role, 'sendClientEmails')) {
      return NextResponse.json({
        ok: false, error: 'Only a broker can take a client agreement back off a deal',
      }, { status: 403 })
    }

    const { data: deal, error } = await supabase.from('deals')
      .select('*').eq('id', dealId).single()
    if (error || !deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    // NOTHING TO UNDO IS A SUCCESS, NOT A FAULT. Two browsers on one deal, or a
    // double click, must not leave the second press showing a red message about
    // a thing that is already true.
    if (!undoesTheAgreement(deal, stage)) {
      return NextResponse.json({ ok: true, alreadyOff: true })
    }

    const byName = String(by || me.data.full_name || '').trim() || 'A broker'
    const { deal: patch, loDataStamp } = undoTheAgreement(stage, byName)
    const update: Record<string, any> = { ...patch }
    if (stage === 'lo') {
      update.lo_data = loDataWithoutTheAgreement(deal.lo_data, loDataStamp)
    }

    // RLS REFUSES A WRITE BY RETURNING NO ROWS AND NO ERROR. The row coming
    // back is the only proof the change actually happened.
    const { data: rows, error: upErr } = await supabase.from('deals')
      .update(update).eq('id', dealId).select('id')
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    if (!rows?.length) {
      return NextResponse.json({
        ok: false,
        error: 'That was not saved — the database refused the change. Nothing has been altered.',
      }, { status: 500 })
    }

    // THE FILE'S OWN MEMORY. An agreement that can be taken off without a line
    // in the notes is an agreement nobody can audit.
    const { data: noted, error: noteErr } = await supabase.from('deal_notes')
      .insert({ deal_id: dealId, body: undoTheAgreementLine(deal, stage, byName),
                kind: 'system', author_id: user.id, author_name: me.data.full_name })
      .select('id')

    return NextResponse.json({
      ok: true,
      warning: (noteErr || !noted?.length)
        ? 'The agreement came off, but it was not written to the file notes.'
        : undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
