import { after } from 'next/server'
import { resolveBrokerProfile } from '@/lib/broker-profile'
import { allocateCreditOfficer } from '@/lib/allocate-officer'
import { notifyCrisMoveCard } from '@/lib/salestrekker-notify'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requestDocuments, brokerDocumentLine, type DocRequestResult } from '@/lib/document-request'

import type { ProceedStage } from './next-steps-copy'
import { siteUrl } from './site-url'
import { lenderToRecord, lenderOnOffer } from './client-lender-choice'

// Reading the deal, without touching it.
//
// The page used to record the client as proceeding simply by being loaded, and
// loading is not something only the client does: mail security scanners follow
// every link in an email before it reaches the inbox. That moved the deal a
// stage, allocated a credit officer and emailed two people, all without anyone
// having read the message. Nothing here writes; the write happens when a button
// is pressed.
//
// ---------------------------------------------------------------------------
// THE CLIENT IS NOT SIGNED IN TO ANYTHING. 23 Sep 2026.
//
// This read used the VISITOR'S OWN session. A client opening their link from an
// email has no session, so row level security returned nothing, `loadProceed`
// returned not-ok, and the page called notFound(). Every client who pressed
// "Proceed" in a Borrowing Capacity or Lending Options email got a page saying
// it does not exist.
//
// It looked fine every time it was tested, because it was tested from a browser
// already signed in to the portal - and then the database answers.
//
// Measured before this was changed: 22 deals marked as proceeded, 20 of them by
// the office doing it by hand, ONE by a client, in four weeks. The team had been
// working around it without knowing why.
//
// The fault is mine and it has a date: 14 Sep 2026, when the document request
// below was given the admin client with a comment saying the client is not
// signed in - and the read eight lines above it was left alone.
//
// THE ADMIN CLIENT, AND A NARROW SELECT. The page is reached by a deal id that
// only the client has. It must be readable without a login, which is the whole
// point of a landing page. So it is read with the key that ignores row level
// security - and in exchange it asks for the FOUR THINGS THE PAGE DRAWS and
// nothing else. No fact find, no figures, no notes. If this ever needs another
// column, that is a decision, not a convenience.
// ---------------------------------------------------------------------------
export async function loadProceed(dealId: string) {
  const supabase = createSupabaseAdmin()
  const { data: deal, error } = await supabase
    .from('deals')
    // AND THE THREE ADDED ON 19 OCT 2026, WHICH IS THE DECISION THE NOTE ABOVE
    // ASKED FOR, NOT A CONVENIENCE. All three are plain columns.
    //
    // NOT lo_data, THOUGH THE PAGE NAMES THE LENDER. The bank, product and loan
    // amount the client is shown do not come from here at all - they come back
    // from the write itself, which reads the deal properly on a POST. See
    // markProceeded, and ConfirmedPanel.tsx. A server component holding the
    // whole lending options record is one careless prop away from handing a
    // broker's fee notes to a stranger with a deal id, and the rule that stops
    // that is this select staying narrow.
    .select('id, client_proceeded, lo_client_proceeded, lo_proceeded_lender, lo_wants_call, clients(first_name, email)')
    .eq('id', dealId)
    .single()
  if (error || !deal) return { ok: false as const }

  const { data: settings } = await supabase.from('settings')
    .select('wealth_desk_link').eq('id', 'singleton').single()

  // ONE CLIENT, NOT A LIST OF ONE.
  //
  // A joined table comes back as an array when the select names its columns,
  // and as a single object when the select is `*`. Narrowing the query above
  // changed the shape under two callers that both read `deal.clients.first_name`
  // - the page and the email preview. Flattened here, once, so neither has to
  // know which kind of query produced it.
  const row = deal as any
  const client = Array.isArray(row.clients) ? (row.clients[0] ?? null) : (row.clients ?? null)

  return {
    ok: true as const,
    deal: { ...row, clients: client },
    wealthDeskLink: settings?.wealth_desk_link || '',
  }
}

// Which step this is. The link carries a hint, but a link can be old or
// forwarded, so the deal's own record decides when there is no hint.
export function stageFor(deal: any, hint?: string): ProceedStage {
  if (hint === 'LO') return 'LO'
  if (hint === 'BC') return 'BC'
  return deal?.client_proceeded ? 'LO' : 'BC'
}

export function hasProceeded(deal: any, stage: ProceedStage): boolean {
  return stage === 'BC' ? !!deal?.client_proceeded : !!deal?.lo_client_proceeded
}

// Who pressed it. 'client' is the Proceed button on the client's own page;
// 'office' is one of us recording that they rang or replied instead. Both doors
// used to write client_proceeded and nothing else, so afterwards there was no way
// to tell them apart - and the button on the BC tab vanished, so there was no way
// to tell "already done" from "broken" either.
export type ProceedBy = { source: 'client' | 'office'; name?: string | null }


// THE BROKER'S EMAIL, AFTER THE CLIENT HAS BEEN ANSWERED.
//
// It says whether the automatic document request worked, because this is the
// only place anybody finds out - the client has already been told their
// documents are coming.
async function notifyBrokerOfProgress(
  deal: any, dealId: string, stage: ProceedStage, docs: DocRequestResult | null,
  lender?: string | null,
) {
  try {
    const brokerRecord = await resolveBrokerProfile(deal.assigned_broker)
    if (!brokerRecord?.email) return
    const nextStageLabel = stage === 'BC' ? 'Lending Options' : 'Compliance'
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to: brokerRecord.email,
        cc: 'info@simplifyfinance.com.au',
        // THE BANK IN THE SUBJECT LINE. 19 Oct 2026. "has moved to Compliance"
        // was true and told the broker nothing about the thing the client had
        // just agreed to. Left out where no lender was captured rather than
        // padded with a word like "a lender".
        subject: docs && !docs.ok
          ? `ACTION NEEDED - documents not requested: ${deal.deal_name}`
          : lender
            ? `${deal.deal_name} confirmed ${lender} and has moved to ${nextStageLabel}`
            : `${deal.deal_name} has moved to ${nextStageLabel}`,
        html: `<p>Hi ${brokerRecord.name?.split(' ')[0] || ''},</p><p><strong>${deal.deal_name}</strong> has progressed to <strong>${nextStageLabel}</strong>.</p>${lender ? `<p>The client confirmed <strong>${lender}</strong> on their own page.</p>` : ''}${brokerDocumentLine(docs)}<p><a href="${siteUrl()}/deals/${dealId}">Open the deal</a></p>`
      })
    })
  } catch (e) {
    // Non-fatal - the stage has already moved, which is the thing that matters.
    console.error('[proceed] the broker notice did not send', e)
  }
}

// WHICH OF THE TWO THEY PRESSED.
//
// Fabio, 1 Oct 2026, wanted both scenarios in one email - and the moment there
// are two, "I am ready to proceed" no longer says what they are proceeding with.
//
// IT RECORDS A PREFERENCE. IT DOES NOT SWITCH THE SCENARIO. The click arrives
// from a link in an email, so the value is whatever somebody put in the URL, and
// swapping a deal's whole borrowing capacity on the strength of that is not a
// thing this portal will do. It writes a number and a timestamp; a human still
// presses "go ahead with this one" on the BC.
//
// Checked into 1, 2 or nothing before it is allowed anywhere near the database
// - see optionFromLink in lib/bc-scenarios.ts.
export async function markProceeded(
  dealId: string, stage: ProceedStage, by: ProceedBy, option?: 1 | 2 | null,
) {
  // SAME REASON AS loadProceed ABOVE. The client pressing the button has no
  // session, so the update below returned "no rows" - which this function
  // correctly reported as "the deal would not save", to a client who had done
  // nothing wrong and could do nothing about it.
  //
  // The office path reaches this through send-next-steps-email, which checks
  // the signed-in user before calling it. The client path reaches it through a
  // server action on the client's own page, which is a POST, so a link
  // scanner cannot trigger it. Both doors are accounted for.
  const supabase = createSupabaseAdmin()

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name, email)')
    .eq('id', dealId)
    .single()

  if (error || !deal) return { ok: false as const, error: error?.message || 'Deal not found' }

  const { data: settings } = await supabase.from('settings').select('wealth_desk_link').eq('id', 'singleton').single()
  const wealthDeskLink = settings?.wealth_desk_link || ''

  const alreadyProceeded = stage === 'BC' ? !!deal.client_proceeded : !!deal.lo_client_proceeded
  // What the lending options page shows the client once the write has landed.
  // Set on the Lending Options branch, and on a repeat visit, so a refresh
  // still names the bank they agreed to.
  let offer = stage === 'LO' ? lenderOnOffer(deal.lo_data) : null

  if (!alreadyProceeded) {
    const nowIso = new Date().toISOString()
    if (stage === 'BC') {
      // Only ever set, never cleared by a press that did not carry one - an
      // older email with a single button must not wipe what a client already
      // told us.
      const chose = (option === 1 || option === 2)
        ? { client_chose_scenario: option, client_chose_scenario_at: nowIso }
        : {}
      const { data: wrote, error: wErr } = await supabase.from('deals').update({
        stage: 'LO', last_tab: 'LO', client_proceeded: true, proceeded_at: nowIso,
        proceeded_source: by.source, proceeded_by: by.source === 'office' ? (by.name || null) : null,
        ...chose,
      }).eq('id', dealId).select('id')
      // RLS refuses a write by returning no rows and no error. Saying the client
      // agreed when nothing was stored would be the worst kind of quiet failure.
      if (wErr || !wrote || wrote.length === 0) {
        return { ok: false as const, error: wErr?.message || 'The deal would not save. Nothing was recorded.' }
      }

      // THE CLIENT DOES NOT WAIT FOR ANY OF THIS.
      //
      // 24 Sep 2026. Pressing Proceed used to hold the page while three things
      // happened: a credit officer was allocated, the documents were requested,
      // and the broker was emailed. None of those are the client's business,
      // and all three are ours to chase if they fail.
      //
      // Worse, the allocation was an HTTP request the server made TO ITS OWN
      // FRONT DOOR, which carries nobody's login - so after the sign-in check
      // went on that route the previous night, the client was waiting on a call
      // that could never succeed. Fabio, 24 Sep: "took a while it worked."
      //
      // `after` runs work once the response has gone. The stage has already
      // moved by this point, which is the only thing the client is waiting to
      // hear.
      after(async () => {
        try {
          if (!deal.assigned_credit_officer) {
            // THE CLIENT AGREEING TO THE BC OPENS THE LENDING OPTIONS, so the
            // officer being found here is the LO's, not the BC's. Before stages
            // had their own owner this distinction did not exist.
            const allocation = await allocateCreditOfficer(supabase, dealId, 'lo')
            if (!allocation.ok) console.error('[proceed] credit officer not allocated:', allocation.error)
          }
        } catch (e) {
          console.error('[proceed] credit officer allocation threw', e)
        }
      })

      // THE DOCUMENTS GO OUT NOW, NOT WHEN SOMEBODY REMEMBERS.
      //
      // The credit team ticks the list during BC. Until 14 Sep 2026 it then sat
      // there until a broker opened the deal and pressed Request documents - so
      // the gap between a client saying yes and being asked for anything was
      // however long it took somebody to notice.
      //
      // Fabio, 14 Sep 2026: "can we not automatically have the system send Ellie
      // the email to load documents to SalesTrekker, so she can share the
      // portal?" Immediately, and only at this step - the LO one is being brought
      // forward to here, so it needs nothing.
      //
      // THE ADMIN CLIENT, because the client pressing the button on their own
      // page is not signed in to anything. Row Level Security would hand an
      // anonymous read an empty settings row and an empty statements list - no
      // error, just nothing - and the request would go to nobody while asking
      // for statements already on file. See lib/supabase-admin.ts.
      //
      // NON-FATAL. The stage has already moved and that is the thing the client
      // is waiting on. A failure here is reported in the broker's email rather
      // than thrown back at a client who has done nothing wrong.
      // The document request, and the broker's email that reports on it, both
      // run after the client has been answered - see the note above. They are
      // still in the right ORDER, because the broker's email says whether the
      // request worked.
      after(async () => {
        let outcome: DocRequestResult | null = null
        try {
          outcome = await requestDocuments(createSupabaseAdmin(), {
            dealId, origin: 'proceed',
            by: 'The portal, when the client agreed to proceed',
          })
        } catch (e: any) {
          outcome = { ok: false, status: 500, sent: 0, error: e?.message || 'The document request did not run.' }
        }
        await notifyBrokerOfProgress(deal, dealId, stage, outcome)
      })
    } else {
      // THE LENDER THE CLIENT AGREED TO, READ OFF THE DEAL - NEVER OFF THE LINK.
      //
      // 19 Oct 2026. Until today nothing recorded which bank a client said yes
      // to: the page named none and this update wrote none, so the only lender
      // agreement on any deal was the box a broker ticks afterwards. Fabio
      // believed it had stopped working; `git log -S clientAgreedLender` says it
      // never did.
      //
      // It is worked out HERE, from the recommendation saved on the deal, for
      // the same reason the BC's option is bound on the server: the client's
      // page is reached by a link, and a link is whatever somebody typed. A
      // lender name posted from a browser is not evidence of anything.
      //
      // NULL WHERE THE RECOMMENDATION IS AMBIGUOUS. Two options from the same
      // bank with nothing recording which is "we do not know" everywhere else
      // in this portal. The client has still agreed to proceed and the deal
      // still moves; the compliance record says the lender was not captured
      // rather than naming one nobody chose.
      //
      // ONLY EVER SET, NEVER CLEARED - an office recording the same proceed a
      // second time must not wipe what the client themselves confirmed.
      const agreed = by.source === 'client' ? lenderToRecord(deal.lo_data) : null
      // AND THE SAME THING THE PAGE WILL PRINT, handed back with the result.
      //
      // The client's page reads a deliberately narrow set of columns and
      // lo_data is not among them - see loadProceed. This read is the proper
      // one, on a POST, so the bank, product and loan amount travel back with
      // the answer rather than the page going looking for them.
      offer = lenderOnOffer(deal.lo_data)
      const { data: wrote, error: wErr } = await supabase.from('deals').update({
        stage: 'Compliance', last_tab: 'Compliance', lo_client_proceeded: true, lo_proceeded_at: nowIso,
        lo_proceeded_source: by.source, lo_proceeded_by: by.source === 'office' ? (by.name || null) : null,
        ...(agreed ? { lo_proceeded_lender: agreed } : {}),
        // They pressed the real button in the end, so the request for a call is
        // answered. The timestamp stays: it is a true record of what happened.
        lo_wants_call: false,
      }).eq('id', dealId).select('id')
      if (wErr || !wrote || wrote.length === 0) {
        return { ok: false as const, error: wErr?.message || 'The deal would not save. Nothing was recorded.' }
      }
      // Ours, not the client's - so after the response, like the BC branch.
      after(async () => {
        try {
          await notifyCrisMoveCard(deal.deal_name, deal.assigned_broker, 'Move this deal card to Compliance (to be actioned)')
        } catch (e) {
          console.error('[proceed] the move-card notice did not send', e)
        }
        await notifyBrokerOfProgress(deal, dealId, stage, null, agreed)
      })
    }

  }

  return { ok: true as const, deal, alreadyProceeded, wealthDeskLink, offer }
}



// THE CLIENT WOULD RATHER TALK FIRST.
//
// 19 Oct 2026. The second button on the Lending Options email, and the honest
// no. Until today the client's page had one button and no way to disagree, so a
// client who was not comfortable simply did not press anything - and a deal
// waiting on a client who has decided against the recommendation looks exactly
// like a deal waiting on a client who has not opened the email.
//
// IT MOVES NOTHING. No stage, no credit officer, no documents, no card. The
// deal stays precisely where it is and the broker is told to ring them. That is
// deliberate and it is the whole point: Fabio's own rule is that the Lending
// Options tab does not invent structure, and a client picking a different bank
// off a web page with nobody on the phone would be exactly that. What actually
// happens goes in the box on that tab, after the call, in a broker's words.
//
// IT IS NOT AN ANSWER ABOUT A LENDER. Nothing here writes lo_proceeded_lender.
// The client has said "not yet", which is not the same as "someone else".
export async function markWantsCall(dealId: string, by: ProceedBy) {
  const supabase = createSupabaseAdmin()

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name, email)')
    .eq('id', dealId)
    .single()

  if (error || !deal) return { ok: false as const, error: error?.message || 'Deal not found' }

  // ALREADY PROCEEDED IS NOT A REASON TO IGNORE THEM - IT IS THE URGENT CASE.
  //
  // This is where "Pressed this by mistake? Let us know" lands, and a client
  // saying that about a deal already on its way to Compliance needs a call
  // sooner than one who has not pressed anything. The stage is NOT pulled back:
  // undoing a client's recorded agreement on the strength of a second link
  // press is not a thing this portal will do, and a broker can move it back
  // themselves once they know what happened. The flag is raised and the email
  // says which of the two it is.
  const already = !!deal.lo_client_proceeded

  // Pressed twice, or the page re-rendered: the record is already there and the
  // broker has already been emailed. Saying so again is noise on a day somebody
  // has to act on it. The page still shows the client the right words.
  if (deal.lo_wants_call) {
    return { ok: true as const, deal, alreadyProceeded: already }
  }

  const nowIso = new Date().toISOString()
  const { data: wrote, error: wErr } = await supabase.from('deals').update({
    lo_wants_call: true, lo_wants_call_at: nowIso,
  }).eq('id', dealId).select('id')

  // Same reason as every other write on this path: row level security refuses
  // by returning no rows and no error, and telling a client we have passed the
  // message on when nothing was stored is the worst kind of quiet failure.
  if (wErr || !wrote || wrote.length === 0) {
    return { ok: false as const, error: wErr?.message || 'That would not save. Nothing was recorded.' }
  }

  // After the response, like everything else the client is not waiting on.
  after(async () => { await notifyBrokerWantsCall(deal, dealId, already) })

  return { ok: true as const, deal, alreadyProceeded: already }
}

// THE EMAIL THAT ACTUALLY GETS SOMEBODY TO LOOK.
//
// Fabio, 19 Oct 2026: "I like that it's on the portal, but unless we see on the
// portal, it doesn't flag the broker to go and have a look at it." The flag on
// the deal is the record; this is the thing that gets it read. Same list as
// every other notice on this path - the assigned broker, copied to the office.
//
// ACTION NEEDED in the subject, like the failed document request, because it is
// a job somebody has to do today and not a notice that something happened.
async function notifyBrokerWantsCall(deal: any, dealId: string, alreadyProceeded: boolean) {
  try {
    const brokerRecord = await resolveBrokerProfile(deal.assigned_broker)
    if (!brokerRecord?.email) return
    const offered = lenderOnOffer(deal.lo_data)
    const first = String(deal.clients?.first_name || '').trim()
    const who = first || 'The client'
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to: brokerRecord.email,
        cc: 'info@simplifyfinance.com.au',
        subject: alreadyProceeded
          ? `ACTION NEEDED - ${who} says they pressed proceed by mistake: ${deal.deal_name}`
          : `ACTION NEEDED - ${who} wants to talk before proceeding: ${deal.deal_name}`,
        html: `<p>Hi ${brokerRecord.name?.split(' ')[0] || ''},</p>`
          + (alreadyProceeded
            ? `<p><strong>${who}</strong> has told us they pressed proceed by mistake`
              + `${offered?.name ? ` on <strong>${offered.name}</strong>` : ''}.</p>`
              + `<p><strong>The deal has already moved to Compliance and is still there.</strong> Nothing `
              + `has been pulled back automatically - that is yours to decide once you have spoken to them. `
              + `Call them, then put the deal where it should be and record what they decided in `
              + `&ldquo;The client&rsquo;s decision&rdquo; on the lending options tab.</p>`
            : `<p><strong>${who}</strong> opened the lending options email and asked to talk it through`
              + `${offered?.name ? ` rather than go ahead with <strong>${offered.name}</strong>` : ''}.</p>`
              + `<p><strong>Nothing has moved.</strong> The deal is still on Lending Options, nothing has `
              + `been submitted and no lender has been recorded against their name. Give them a call, then `
              + `record what they decided in &ldquo;The client&rsquo;s decision&rdquo; on the lending `
              + `options tab.</p>`)
          + `<p><a href="${siteUrl()}/deals/${dealId}">Open the deal</a></p>`
      })
    })
  } catch (e) {
    // Non-fatal, like every other notice here. The flag is already on the deal,
    // which is the record; this is the nudge.
    console.error('[proceed] the wants-a-call notice did not send', e)
  }
}

// The email's words and its subject line live in one file that imports nothing,
// so they can be tested without loading the database client. Re-exported here
// because everything already imports them from this module.
export { buildNextStepsContent, nextStepsSubject } from './next-steps-copy'
export type { ProceedStep } from './next-steps-copy'
