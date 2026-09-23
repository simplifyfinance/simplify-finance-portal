import { resolveBrokerProfile } from '@/lib/broker-profile'
import { notifyCrisMoveCard } from '@/lib/salestrekker-notify'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requestDocuments, brokerDocumentLine, type DocRequestResult } from '@/lib/document-request'

import type { ProceedStage } from './next-steps-copy'

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
    .select('id, client_proceeded, lo_client_proceeded, clients(first_name, email)')
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

export async function markProceeded(dealId: string, stage: ProceedStage, by: ProceedBy) {
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

  // What the automatic document request did, so the broker's email can say it.
  // Null means it was never attempted - the LO step, or an already-proceeded deal.
  let docs: DocRequestResult | null = null

  if (!alreadyProceeded) {
    const nowIso = new Date().toISOString()
    if (stage === 'BC') {
      const { data: wrote, error: wErr } = await supabase.from('deals').update({
        stage: 'LO', last_tab: 'LO', client_proceeded: true, proceeded_at: nowIso,
        proceeded_source: by.source, proceeded_by: by.source === 'office' ? (by.name || null) : null,
      }).eq('id', dealId).select('id')
      // RLS refuses a write by returning no rows and no error. Saying the client
      // agreed when nothing was stored would be the worst kind of quiet failure.
      if (wErr || !wrote || wrote.length === 0) {
        return { ok: false as const, error: wErr?.message || 'The deal would not save. Nothing was recorded.' }
      }

      if (!deal.assigned_credit_officer) {
        try {
          await fetch('https://simplify-finance-portal.vercel.app/api/allocate-credit-officer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId })
          })
        } catch (e) {
        }
      }

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
      try {
        docs = await requestDocuments(createSupabaseAdmin(), {
          dealId, origin: 'proceed',
          by: 'The portal, when the client agreed to proceed',
        })
      } catch (e: any) {
        docs = { ok: false, status: 500, sent: 0, error: e?.message || 'The document request did not run.' }
      }
    } else {
      const { data: wrote, error: wErr } = await supabase.from('deals').update({
        stage: 'Compliance', last_tab: 'Compliance', lo_client_proceeded: true, lo_proceeded_at: nowIso,
        lo_proceeded_source: by.source, lo_proceeded_by: by.source === 'office' ? (by.name || null) : null,
      }).eq('id', dealId).select('id')
      if (wErr || !wrote || wrote.length === 0) {
        return { ok: false as const, error: wErr?.message || 'The deal would not save. Nothing was recorded.' }
      }
      try {
        await notifyCrisMoveCard(deal.deal_name, deal.assigned_broker, 'Move this deal card to Compliance (to be actioned)')
      } catch (e) {
      }
    }

    // Notify the assigned broker either way — they need to know the client has moved forward
    try {
      const brokerRecord = await resolveBrokerProfile(deal.assigned_broker)
      if (brokerRecord?.email) {
        const nextStageLabel = stage === 'BC' ? 'Lending Options' : 'Compliance'
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
            to: brokerRecord.email,
            cc: 'info@simplifyfinance.com.au',
            // An internal email, so the file name belongs on it. It shouts when the
            // document request failed, because this is the only place anybody
            // finds out - the client has already been told their documents are
            // coming.
            subject: docs && !docs.ok
              ? `ACTION NEEDED - documents not requested: ${deal.deal_name}`
              : `${deal.deal_name} has moved to ${nextStageLabel}`,
            html: `<p>Hi ${brokerRecord.name?.split(' ')[0] || ''},</p><p><strong>${deal.deal_name}</strong> has progressed to <strong>${nextStageLabel}</strong>.</p>${brokerDocumentLine(docs)}<p><a href="https://simplify-finance-portal.vercel.app/deals/${dealId}">Open the deal</a></p>`
          })
        })
      }
    } catch (e) {
      // Non-fatal — the stage transition itself already succeeded
    }
  }

  return { ok: true as const, deal, alreadyProceeded, wealthDeskLink }
}



// The email's words and its subject line live in one file that imports nothing,
// so they can be tested without loading the database client. Re-exported here
// because everything already imports them from this module.
export { buildNextStepsContent, nextStepsSubject } from './next-steps-copy'
export type { ProceedStep } from './next-steps-copy'
