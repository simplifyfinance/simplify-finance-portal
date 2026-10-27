// SENDING A DEAL BACK TO CREDIT, WITH THE REASON ATTACHED.
//
// 27 Oct 2026. Fabio: "How can we communicate with credit person thgat this
// needs a rework so it gets flagged in her queue and needs rework?"
//
// This is api/move-deal-back with the one thing it never had. That route clears
// a timestamp, writes a line in the note log and emails the assessor - and the
// email it sends says "Check with the broker whether this still needs working
// on", because the portal has never carried a reason. Here the reason is
// required before the button will go.
//
// WHY THIS IS ITS OWN ROUTE RATHER THAN A FLAG ON THAT ONE. They are different
// acts. Moving a card back a column is an administrative correction - somebody
// put it in the wrong place. Sending a BC back is a broker asking a person to
// do work again, and it is counted, flagged and apologised for in that person's
// day. One route doing both would have an `if` down the middle of every line.
//
// EVERYTHING IT WRITES IS WORKED OUT IN lib/send-it-back.ts, which has no
// database in it and is tested on its own.
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import {
  canSendBack, validateSendBack, sendBackPatch, sendBackLine, sendBackTarget,
  reworkReasonLabel, BACK_STAGE_LABEL, type BackStage,
} from '@/lib/send-it-back'
import { notifySentBack } from '@/lib/salestrekker-notify'

export async function POST(req: NextRequest) {
  try {
    const { dealId, stage, why, note, by } = await req.json() as
      { dealId: string; stage: BackStage; why: string; note: string; by: string }
    if (!dealId || (stage !== 'bc' && stage !== 'lo')) {
      return NextResponse.json({ ok: false, error: 'Missing dealId or stage' }, { status: 400 })
    }

    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

    // THE BOXES ARE CHECKED AGAIN HERE. The screen will not let an empty one
    // through, but the screen is not the thing that decides.
    const bad = validateSendBack({ why, note })
    if (bad.length) {
      return NextResponse.json({ ok: false, error: bad.map(b => b.message).join('; ') }, { status: 400 })
    }

    const { data: deal, error } = await supabase.from('deals')
      .select('*, clients(first_name, last_name)').eq('id', dealId).single()
    if (error || !deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

    const allowed = canSendBack(deal, stage)
    if (!allowed.ok) return NextResponse.json({ ok: false, error: allowed.why }, { status: 400 })

    const me = (await supabase.from('user_profiles').select('full_name').eq('id', user.id).single())
      .data?.full_name || null
    const input = { why, note, by: String(by || me || '').trim() || 'A broker' }

    // RLS REFUSES A WRITE BY RETURNING NO ROWS AND NO ERROR. The row coming
    // back is the only proof the change actually happened.
    const patch = sendBackPatch(deal, stage, input)
    const { data: rows, error: upErr } = await supabase.from('deals')
      .update(patch).eq('id', dealId).select('id')
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    if (!rows?.length) {
      return NextResponse.json({
        ok: false,
        error: 'That was not saved — the database refused the change. Nothing has been altered.',
      }, { status: 500 })
    }

    // --- the history line, which is the file's own memory ---------------------
    const { data: noted, error: noteErr } = await supabase.from('deal_notes')
      .insert({ deal_id: dealId, body: sendBackLine(deal, stage, input), kind: 'system',
                author_id: user.id, author_name: me })
      .select('id')
    const noteFailed = !!noteErr || !noted?.length

    // --- telling the person ---------------------------------------------------
    //
    // The owner of THIS STAGE, not deals.assigned_credit_officer - a deal can
    // have had one person on the BC and somebody else on the lending options.
    // See lib/who-did-this-stage.ts.
    let emailWarning: string | null = null
    const target = sendBackTarget(deal, stage)
    if (target) {
      const { data: officer } = await supabase.from('credit_officers')
        .select('name, user_id').eq('id', target.officerId).single()
      let toEmail: string | null = null
      let toName: string | null = officer?.name || target.name || null
      if (officer?.user_id) {
        const { data: p } = await supabase.from('user_profiles')
          .select('email, full_name').eq('id', officer.user_id).single()
        toEmail = p?.email || null
        toName = p?.full_name || toName
      }
      if (toEmail) {
        const sent = await notifySentBack({
          dealId,
          dealName: deal.deal_name,
          clientName: `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim(),
          stageLabel: BACK_STAGE_LABEL[stage],
          reason: reworkReasonLabel(why),
          note: String(note || '').trim(),
          byName: input.by,
          timesBefore: Number(deal[`${stage}_rework_count`] || 0),
          recipientEmail: toEmail,
          recipientName: toName,
        })
        if (!sent.ok) emailWarning = `${toName || 'They'} were not emailed (${sent.error}). Tell them yourself.`
      } else {
        emailWarning = `${toName || 'The credit assessor'} has no email address on their profile, so they were not told.`
      }
    }

    return NextResponse.json({
      ok: true,
      to: target?.name || null,
      warning: [
        noteFailed ? 'It is back with credit, but it was not written to the file notes.' : '',
        emailWarning,
      ].filter(Boolean).join(' ') || undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
