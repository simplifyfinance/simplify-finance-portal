import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { notifyEllieCreateCard, notifyCrisMoveCard } from '@/lib/salestrekker-notify'
import { emailLines, emailSubject, shortDate } from '@/lib/push-answers'
import { allSections, countCards } from '@/lib/handover-view'
import { generateSummaryPdfBuffer } from '@/app/api/generate-summary-pdf/route'
import { generateCompliancePdfBuffer } from '@/app/api/generate-compliance-pdf/route'
import { generateBrokerNotesPdfBuffer } from '@/app/api/generate-broker-notes-pdf/route'
import { allocate, todaySoFar, type Person } from '@/lib/compliance-allocation'
import { checkedWrite } from '@/lib/checked-write'
import { documentChaseFor } from '@/lib/documents-block'

type Trigger = 'bc_action' | 'bc_sent' | 'lo_sent' | 'lo_to_compliance' | 'push_to_salestrekker' | 'close_followup'

export async function POST(req: NextRequest) {
  try {
    const { dealId, trigger } = await req.json() as { dealId: string; trigger: Trigger }
    if (!dealId || !trigger) return NextResponse.json({ ok: false, error: 'Missing dealId or trigger' }, { status: 400 })

    const supabase = await createSupabaseServer()

    // SIGNED IN, FIRST. 23 Sep 2026: the read below ran as the caller, so a
    // stranger got nothing - safe by side effect. This route pushes a deal to
    // SalesTrekker and sends notifications, so it asks explicitly.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    const { data: deal, error } = await supabase
      .from('deals')
      // push_answers is what the broker was asked on the way out, and
      // transaction_type / property_use decide which of those answers apply -
      // a column missing from a select is a value that is silently undefined.
      .select('deal_name, assigned_broker, assigned_credit_officer, lead_source, deal_type, salestrekker_created_at, bc_completed_at, fact_find_data, internal_notes, push_answers, transaction_type, property_use, clients(first_name, last_name)')
      .eq('id', dealId)
      .single()

    if (error || !deal) return NextResponse.json({ ok: false, error: error?.message || 'Deal not found' }, { status: 404 })

    const clientName = `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim()
    const brokerName = deal.assigned_broker || ''
    const dealName = deal.deal_name

    // Resolve who currently receives each notification type from Settings (admin-editable, no code change needed)
    // A COLUMN THE DATABASE MAY NOT HAVE YET DOES NOT TAKE THE REST DOWN.
    //
    // Naming compliance_issued_notification_user_id in a select fails the whole
    // query on a database where docs/compliance-pack-recipient.sql has not been
    // run, and that query is what every notification on this route depends on.
    // So it is asked for separately and a failure simply means "not set".
    const { data: settingsRow } = await supabase.from('settings').select('new_deal_notification_user_id, stage_move_notification_user_id').eq('id', 'singleton').single()
    let packUserId: string | null = null
    let packBackupUserId: string | null = null
    let packCap: any = null
    try {
      const { data: packRow } = await supabase.from('settings')
        .select('compliance_issued_notification_user_id').eq('id', 'singleton').single()
      packUserId = packRow?.compliance_issued_notification_user_id || null
    } catch {
      // The column is not there. Null, which falls back below.
    }
    try {
      const { data: twoRow } = await supabase.from('settings')
        .select('compliance_issued_backup_user_id, compliance_daily_cap').eq('id', 'singleton').single()
      packBackupUserId = twoRow?.compliance_issued_backup_user_id || null
      packCap = twoRow?.compliance_daily_cap ?? null
    } catch {
      // docs/compliance-allocation.sql has not been run. One person, no cap -
      // exactly how it behaved yesterday.
    }
    let ellieEmail: string | null = null
    let crisEmail: string | null = null
    // The name as well as the address, so the email can open "Hi Cris," rather
    // than "Hi,". Same query, one more column.
    let ellieName: string | null = null
    let crisName: string | null = null
    if (settingsRow?.new_deal_notification_user_id) {
      const { data: p } = await supabase.from('user_profiles').select('email, full_name').eq('id', settingsRow.new_deal_notification_user_id).single()
      ellieEmail = p?.email || null
      ellieName = p?.full_name || null
    }
    if (settingsRow?.stage_move_notification_user_id) {
      const { data: p } = await supabase.from('user_profiles').select('email, full_name').eq('id', settingsRow.stage_move_notification_user_id).single()
      crisEmail = p?.email || null
      crisName = p?.full_name || null
    }

    // WHO GETS THE COMPLIANCE PACK, WHICH IS NOT THE SAME QUESTION.
    //
    // 28 Oct 2026. "When a deal moves stage — who is asked to move the
    // SalesTrekker card" was deciding four emails. Three are a chore. The
    // fourth carries the Fact Find, the Handover and the Broker Notes - the
    // compliance record of what went to credit that day, to be filed into the
    // client's OneDrive folder. The pack for a live deal went to Ellie when it
    // was meant for Ellesse, and nothing on the Settings page explained why.
    //
    // Fabio: "when a deal moves stage is one thing, and then when compliance is
    // issued is a separate thing."
    //
    // NOT SET MEANS EXACTLY WHAT HAPPENED BEFORE. Until somebody deliberately
    // picks a person, the pack follows whoever moves the card. Nothing changes
    // on the day this ships.
    let packEmail: string | null = crisEmail
    let packName: string | null = crisName
    let packChosenId: string | null = null
    let packWhy = ''

    // TWO PEOPLE AND A NUMBER. 28 Oct 2026. Fabio: "it goes to the first person
    // until we hit the number of that particular day of five. Once we hit five,
    // anything after that goes to person number two."
    //
    // THE RULE IS IN lib/compliance-allocation.ts AND IT IS NOT REPEATED HERE.
    // This fetches the three facts it needs - the two people, and every pack
    // that has gone out today - and does as it is told. The deciding is tested
    // without a database; this part cannot be.
    if (packUserId || packBackupUserId) {
      const who = async (id: string | null): Promise<Person> => {
        if (!id) return null
        const { data: u } = await supabase.from('user_profiles')
          .select('email, full_name').eq('id', id).single()
        // Somebody removed from the team is not a person to allocate to.
        if (!u?.email) return null

        // AND WHETHER THEY ARE AWAY.
        //
        // 28 Oct 2026. Fabio: "if number one is off, it always goes to number
        // two." The dates live on the person - see docs/compliance-leave.sql -
        // and the deciding is lib/compliance-allocation.ts, which is handed
        // them here and left to it.
        //
        // ASKED SEPARATELY so that a database without the columns yet still
        // sends the pack. Folded into the select above, two missing columns
        // would fail the query and allocate to nobody, which is the one outcome
        // worse than allocating to somebody on leave.
        let onLeaveFrom: string | null = null
        let onLeaveUntil: string | null = null
        try {
          const { data: l } = await supabase.from('user_profiles')
            .select('on_leave_from, on_leave_until').eq('id', id).single()
          onLeaveFrom = l?.on_leave_from || null
          onLeaveUntil = l?.on_leave_until || null
        } catch {
          // docs/compliance-leave.sql has not been run. Nobody is away.
        }
        return { id, name: u.full_name || u.email, onLeaveFrom, onLeaveUntil }
      }
      const first = await who(packUserId)
      const second = await who(packBackupUserId)

      // TODAY'S PACKS, COUNTED FROM THE DEALS THEMSELVES. No tally anywhere, so
      // nothing to reset at midnight and nothing that can drift from the deal
      // card or the workload tab.
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
      let sent: Array<{ userId?: string | null; at?: string | null }> = []
      try {
        const { data: rows } = await supabase.from('deals')
          .select('compliance_pack_user_id, compliance_pack_at')
          .gte('compliance_pack_at', `${today}T00:00:00`)
        sent = (rows || []).map((r: any) => ({ userId: r.compliance_pack_user_id, at: r.compliance_pack_at }))
      } catch {
        // No column yet. An empty day, which sends to the first person.
      }

      // A DEAL KEEPS WHOEVER IT WAS FIRST GIVEN TO. Pushing it again does not
      // move it and does not use a second slot out of the day.
      //
      // Asked separately, not added to the main deal select above: a column the
      // database has not got yet would fail that query, and every notification
      // on this route depends on it.
      let alreadyOn: Person = null
      try {
        const { data: mine } = await supabase.from('deals')
          .select('compliance_pack_user_id, compliance_pack_user_name').eq('id', dealId).single()
        if (mine?.compliance_pack_user_id) {
          alreadyOn = { id: mine.compliance_pack_user_id, name: mine.compliance_pack_user_name || '' }
        }
      } catch {
        // No column yet. Treated as a deal nobody has been given.
      }

      const picked = allocate({ first, second, cap: packCap, today, sent, alreadyOn })
      packWhy = picked.words
      if (picked.to) {
        const { data: u } = await supabase.from('user_profiles')
          .select('email, full_name').eq('id', picked.to.id).single()
        if (u?.email) {
          packEmail = u.email
          packName = u.full_name || picked.to.name
          packChosenId = picked.to.id
        }
      }
    } else if (packUserId) {
      const { data: p } = await supabase.from('user_profiles').select('email, full_name').eq('id', packUserId).single()
      // A person who has been removed is not a reason to send the pack nowhere.
      if (p?.email) { packEmail = p.email; packName = p.full_name || null }
    }

    // NOBODY IS EMAILED TO ASK THEMSELVES TO DO SOMETHING.
    //
    // These notifications say "please create the card" or "please move the
    // card". When the person who receives them is the person who just did the
    // thing, the email is noise - and worse than noise, because a mailbox full
    // of self-addressed tasks is a mailbox people stop reading. Fabio, 2 Sep
    // 2026: "when Ellie and Cris or whomever is on the the dropdown box they
    // should not receive an email to credte the deal card as it redundant".
    //
    // Compared on the profile id, which is what Settings actually stores. If
    // there is no session - a server-to-server call - nothing is skipped, which
    // is the safe way round.
    const { data: session } = await supabase.auth.getUser()
    const actorId = session?.user?.id || null
    // Only the "create the card" email. Fabio, 2 Sep 2026: "just create deal
    // card". The move-the-card notes to Cris are the same shape and could be
    // skipped the same way, but they were not asked for and a notification that
    // silently stops arriving is a bad surprise.
    const ellieIsActing = !!actorId && settingsRow?.new_deal_notification_user_id === actorId

    // Trigger 1: first BC action on a deal — fires once, whichever happens first
    if (trigger === 'bc_action') {
      // Atomically claim the send. This UPDATE only matches while the timestamp is
      // still null, so exactly one caller can ever win it - no duplicate emails to
      // Ellie however many triggers fire, or how close together.
      const { data: claimed, error: claimErr } = await supabase
        .from('deals')
        .update({ salestrekker_created_at: new Date().toISOString() })
        .eq('id', dealId)
        .is('salestrekker_created_at', null)
        .select('id')

      if (claimErr) {
        return NextResponse.json({ ok: false, error: claimErr.message }, { status: 500 })
      }
      if (!claimed || claimed.length === 0) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'already notified' })
      }

      const ff = deal.fact_find_data || {}
      const primaryApplicant = ff.applicants?.[0]
      const employmentBasis = primaryApplicant?.employment?.[0]?.employmentBasis || ''
      const incomeType = employmentBasis === 'Self-employed' ? 'Self-employed' : (employmentBasis ? 'PAYG' : '')

      let creditOfficerName: string | null = null

      // HAS THE BC ACTUALLY BEEN DONE?
      //
      // This used to be "there is no credit officer on the deal, so the broker
      // must have done it himself". That is a guess, and it is wrong in the case
      // that fires this email most often: a broker choosing "I'll do the BC
      // myself" has, at that moment, done nothing. Ellie was being told to create
      // the card at BC Actioned for a BC nobody had started.
      //
      // bc_completed_at is a fact. It is written when the BC is sent to the
      // client, which is the point at which the stage really is BC Actioned.
      // Fabio, 2 Sep 2026: "do mark someone BC was done when crteating a deal
      // card - we do right?" We did not.
      const alreadyBcActioned = !!deal.bc_completed_at

      if (deal.assigned_credit_officer) {
        const { data: officer } = await supabase.from('credit_officers').select('name').eq('id', deal.assigned_credit_officer).single()
        creditOfficerName = officer?.name || null
      }

      // The claim above stands whether or not an email goes out: Ellie doing it
      // herself is exactly as good as Ellie being told to, and leaving the
      // timestamp null would email her about it later.
      if (ellieIsActing) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'the recipient is the one who acted' })
      }

      try {
        await notifyEllieCreateCard({
          dealId,
          dealName,
          clientName,
          brokerName,
          leadSource: deal.lead_source || '',
          dealType: deal.deal_type || '',
          incomeType,
          // The deal's own notes column since 1 Sep 2026. The fact find copy is
          // read as a fallback so a deal written before the migration still
          // carries its notes into SalesTrekker.
          internalNotes: deal.internal_notes || ff.internalNotes || '',
          creditOfficerName,
          alreadyBcActioned,
          recipientEmail: ellieEmail,
          recipientName: ellieName
        })
      } catch (e: any) {
        // Release the claim so a later trigger can retry, rather than a timestamp
        // permanently blocking an email that never actually sent. Checked,
        // because a rollback that silently fails leaves the deal marked as
        // pushed forever with no email ever sent - the very fault this line is
        // here to prevent.
        const { data: released, error: relErr } = await supabase.from('deals')
          .update({ salestrekker_created_at: null }).eq('id', dealId).select('id')
        if (relErr || !released?.length) {
          console.error('[notify-salestrekker] could not release the claim - this deal will not retry', relErr)
        }
        console.error('[notify-salestrekker] notifyEllieCreateCard failed', e)
        return NextResponse.json({ ok: false, error: e?.message || 'Notification failed' }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    // Read from the deal, not the request body, so the email can only ever say what
    // was actually saved.
    if (trigger === 'close_followup') {
      const { data: c } = await supabase.from('deals')
        .select('close_reason, next_action, next_action_due').eq('id', dealId).maybeSingle()
      const due = c?.next_action_due
        ? new Date(c.next_action_due).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'no date set'
      const instruction =
        `Set up a follow-up task on this deal card for ${brokerName} and the support team. Due ${due}.`
        + (c?.next_action ? ` Action: ${c.next_action}.` : '')
        + (c?.close_reason ? ` The deal was closed as: ${String(c.close_reason).replace(/_/g, ' ')}.` : '')
      await notifyCrisMoveCard(dealName, brokerName, instruction, false, undefined, crisEmail, { recipientName: crisName })
      return NextResponse.json({ ok: true })
    }

    // Trigger 2: BC sent to client, card already exists
    if (trigger === 'bc_sent') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to BC Actioned', false, undefined, crisEmail, { recipientName: crisName })
      return NextResponse.json({ ok: true })
    }

    // Trigger 3: LO sent to client
    if (trigger === 'lo_sent') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to LO Actioned', false, undefined, crisEmail, { recipientName: crisName })
      return NextResponse.json({ ok: true })
    }

    // Trigger 4: client/broker confirms proceed LO -> Compliance
    if (trigger === 'lo_to_compliance') {
      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to Compliance (to be actioned)', false, undefined, crisEmail, { recipientName: crisName })
      return NextResponse.json({ ok: true })
    }

    // Trigger 5: Push to SalesTrekker (final)
    if (trigger === 'push_to_salestrekker') {
      // Deliberately NOT skipped when the recipient is the one pushing. This
      // email is not a request to do something - it carries the PDFs, which have
      // to be filed into the client's OneDrive folder, and the link to the
      // handover. It is wanted in the inbox even by the person who pressed the
      // button.
      const attachments: { filename: string; content: string }[] = []

      try {
        const summaryResult = await generateSummaryPdfBuffer(dealId, supabase)
        const complianceResult = await generateCompliancePdfBuffer(dealId, supabase)
        // The third document. Unlike the other two it is not an internal record:
        // it is what gets pasted into the lender's portal, so the filed copy is
        // the evidence of what was submitted. It also goes in the lodgement
        // folder - see the email itself, which says so against this file only.
        const brokerNotesResult = await generateBrokerNotesPdfBuffer(dealId, supabase)

        for (const result of [
          summaryResult ? { ...summaryResult, kind: 'summary' } : null,
          complianceResult ? { ...complianceResult, kind: 'compliance' } : null,
          brokerNotesResult ? { ...brokerNotesResult, kind: 'broker_notes' } : null
        ]) {
          if (!result) continue
          // Both documents are already named for the people they are about -
          // "Handover - ..." and "Fact Find - ..." - so neither needs a suffix.
          //
          // They DO need a date. What is stored here is a snapshot taken at the
          // moment of the push and it never changes again, while the live
          // document does. On 2 Sep 2026 that cost an afternoon: the PDFs were
          // rebuilt and shipped, and the copy opened from the deal's Documents
          // list was still the old one, with no way to tell. The date on the
          // name is how you tell.
          // ONE CURRENT COPY PER DEAL, NOT ONE PER PUSH.
          //
          // This used to mint a new file and a new row every single time - the
          // path carried Date.now() and the insert was unconditional - so a deal
          // pushed five times carried fifteen documents. Natasha Chapman had the
          // same handover filed nine times over. Fabio, 16 Sep 2026: "I dont
          // need a new one saving every time."
          //
          // A STABLE PATH PER KIND is what fixes it: the same three names every
          // time, overwritten in place. No duplicate rows to clean up, and
          // nothing is deleted to achieve it.
          //
          // The EMAIL attachment keeps the date in its name, because that copy
          // lands in somebody's inbox where "which one is this" is a real
          // question. The deal keeps the current one.
          const storedName = `${result.dealName}.pdf`
          const filePath = `${dealId}/${result.kind}.pdf`
          const sentName = `${result.dealName} (${shortDate(new Date().toISOString().slice(0, 10))}).pdf`

          const { error: uploadError } = await supabase.storage.from('deal-documents').upload(filePath, result.buffer, {
            contentType: 'application/pdf',
            // Overwrites the copy from the last push. Same path, same row.
            upsert: true
          })

          if (!uploadError) {
            // The row only has to exist once. On every push after the first the
            // file behind it has just been replaced, so there is nothing to
            // write - and a second row pointing at the same path is exactly the
            // pile this is fixing.
            const { data: already } = await supabase.from('deal_documents')
              .select('id').eq('deal_id', dealId).eq('file_path', filePath).limit(1)

            if (!already?.length) {
              // Without this row nothing lists the file, so it becomes a file
              // nobody can find - worth a line in the log even though it must
              // never block the push.
              const { data: rec, error: recErr } = await supabase.from('deal_documents').insert({
                deal_id: dealId,
                file_name: storedName,
                file_path: filePath,
                file_type: 'application/pdf'
              }).select('id')
              if (recErr || !rec?.length) {
                console.error('[notify-salestrekker] the pack was uploaded but not recorded on the deal', recErr)
              }
            }
            attachments.push({ filename: sentName, content: result.buffer.toString('base64') })
          }
        }
      } catch (e) {
        // Non-fatal — PDF generation/upload failure should never block the actual SalesTrekker push
      }

      const answers = (deal as any)?.push_answers || null

      // How many boxes there are to copy, so the email can say. Read from the
      // whole deal, not from the slim select above - the select is deliberately
      // narrow and a missing column is a silently undefined value.
      let boxCount: number | undefined
      // WHAT IS STILL OUT, off the same read as the box count.
      //
      // 28 Oct 2026. One query, two answers. Both are niceties in the sense
      // that neither may stop the pack going out - the three PDFs are the point
      // of this email and a chase list is the reason somebody opens it twice.
      let outstanding: Array<{ name: string; asked: string; late: boolean }> = []
      try {
        const { data: full } = await supabase.from('deals').select('*').eq('id', dealId).single()
        if (full) {
          boxCount = countCards(allSections(full))
          outstanding = documentChaseFor(full)
        }
      } catch {
        // The count is a nicety. Never let it stop the email.
      }

      await notifyCrisMoveCard(dealName, brokerName, 'Move this deal card to Compliance Issued', true, attachments, packEmail, {
        subject: emailSubject(dealName, answers),
        lines: emailLines(deal, answers),
        urgent: !!answers?.urgent,
        dealId,
        boxCount,
        recipientName: packName,
        // ONE NAMED PERSON, NOBODY COPIED. Fabio, 28 Oct 2026: "We do not need
        // info to be CC'd on everything in that tab." Only this email - the
        // card-moving ones and the two document ones are unchanged.
        copyTheOffice: false,
        outstanding,
        // Named in the email itself, not left to a paperclip at the bottom.
        // Fabio, 2 Sep 2026: "the atatchments will get misssed at the bottom".
        attachmentNames: attachments.map(a => a.filename),
      })

      // WHO GOT IT, WRITTEN ON THE DEAL.
      //
      // This is the only record of the allocation, and everything else is
      // derived from it: the day's count on the next push, the owner on the
      // deal card, and the workload numbers. There is no second copy anywhere,
      // so there is nothing that can disagree with it.
      //
      // ONLY ON THE FIRST PUSH. compliance_pack_at is what today's count is
      // counted from, and re-stamping it would move a deal into a later day and
      // quietly free a slot in one that has already happened.
      if (packChosenId) {
        try {
          const { data: mine } = await supabase.from('deals')
            .select('compliance_pack_user_id').eq('id', dealId).single()
          if (!mine?.compliance_pack_user_id) {
            const problem = await checkedWrite(
              supabase.from('deals').update({
                compliance_pack_user_id: packChosenId,
                compliance_pack_user_name: packName,
                compliance_pack_at: new Date().toISOString(),
              }).eq('id', dealId),
              'Who the compliance pack went to')
            // Never fail the push over the record of it. The email has already
            // gone; refusing here would leave the pack sent and the button red.
            if (problem) console.error('[compliance pack]', problem, packWhy)
          }
        } catch (e) {
          console.error('[compliance pack] not recorded', e)
        }
      }

      // This used to set status = 'completed', and the deals list hides anything
      // completed — so the loan vanished the moment compliance went out, before it
      // was lodged, approved or settled. On 1 Sep 2026 that was nine of twenty-one
      // deals: none lodged, the oldest eight business days old, and no way to tell
      // one progressing nicely from one that had fallen over.
      //
      // It now records that compliance WAS SENT. The deal stays on the board, keeps
      // ageing, and keeps someone to chase. A deal is finished when it settles or
      // when it dies, and emailing a PDF is neither.
      const { data: wrote, error: sentErr } = await supabase.from('deals')
        .update({ compliance_sent_at: new Date().toISOString() })
        .eq('id', dealId).select('id')
      if (sentErr || !wrote || wrote.length === 0) {
        return NextResponse.json({
          ok: false,
          error: 'The documents were sent, but the deal was not marked as compliance sent. Mark it on the deal so it does not fall off the board.',
        }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Unknown trigger' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
