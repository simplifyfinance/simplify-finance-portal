// ASKING A CLIENT FOR THEIR DOCUMENTS - THE ONE PLACE IT HAPPENS.
//
// Lifted out of app/api/request-documents/route.ts on 14 Sep 2026, because there
// are now two ways in and they must not drift apart:
//
//   'button'  - somebody opened the deal and pressed Request documents.
//   'proceed' - the client said yes at the end of BC, and the portal did it
//               without waiting for anybody. Fabio, 14 Sep 2026: "if the client
//               (or we) hit the 'I want to proceed to LO' button, can we not
//               automatically have the system send Ellie the email to load
//               documents to SalesTrekker, so she can share the portal?"
//
// THE LIST IS BUILT HERE, NEVER TRUSTED FROM THE BROWSER. A key that is not a
// real document on this deal is dropped rather than emailed.
//
// THE RECORD IS THE IMPORTANT HALF, and it is written BEFORE the email - the
// opposite way round to docs-received, on purpose. A record with no email is
// recoverable by pressing the button again. An email with no record is not: the
// next press asks the client all over again for what they already sent.

import { documentsFor, documentsDue, formallyApproved } from './document-rules'
import { progressOf, rowsFor, toRequest, withRequest, requestRounds, type DocRow } from './document-progress'
import { banksSeen, coveredRows } from './statement-cover'
import { notifyDocumentRequest } from './salestrekker-notify'
import { patchDealColumn } from './patch-deal-column'

export type DocRequestResult = {
  ok: boolean
  status: number
  // How many were actually asked for.
  sent: number
  to?: string | null
  requestedAt?: string
  rounds?: number
  ignored?: number
  // Crossed off because statements already on file cover them. Named so that a
  // person can see WHY the list is short.
  covered?: string[]
  // Rows waiting on a human yes or no - the discharge form on a refinance. These
  // are never sent automatically and never were.
  awaitingAnswer?: string[]
  skipped?: boolean
  reason?: string
  recorded?: boolean
  error?: string
}

// WHAT THE STATEMENTS ALREADY COVER.
//
// This used to live only in the browser, which was fine while the browser was
// the only thing that could start a request: it filtered the list before posting
// it. The moment the portal starts one by itself, that filter has to be here, or
// the request asks whoever raises them to chase bank statements the client sent
// last week.
//
// A read that comes back empty removes nothing, which is the safe direction -
// the worst case is the list somebody already reviewed, unchanged.
async function coveredKeysFor(supabase: any, dealId: string, rows: DocRow[]) {
  try {
    const [{ data: uploads }, { data: lenders }] = await Promise.all([
      supabase.from('deal_statement_uploads')
        .select('institutions, period_from, period_to, days').eq('deal_id', dealId),
      supabase.from('lenders').select('name, statement_codes'),
    ])
    if (!uploads?.length || !lenders?.length) return new Map<string, string>()
    const seen = banksSeen(uploads, lenders)
    return new Map(coveredRows(rows as any, seen).map(c => [c.key, c.bank]))
  } catch {
    return new Map<string, string>()
  }
}

export async function requestDocuments(supabase: any, opts: {
  dealId: string
  // The keys somebody ticked. Leave it out and the portal asks for everything
  // that is due, ticked and not already covered - which is the automatic path.
  keys?: string[] | null
  by?: string | null
  origin: 'button' | 'proceed'
}): Promise<DocRequestResult> {
  const { dealId, origin } = opts
  const by = opts.by || (origin === 'proceed' ? 'The portal, when the client agreed to proceed' : 'Somebody')

  const { data: deal, error } = await supabase.from('deals')
    .select('id, deal_name, assigned_broker, fact_find_data, bc_data, document_progress, formal_approval_at, clients(first_name, last_name)')
    .eq('id', dealId).single()
  if (error || !deal) return { ok: false, status: 404, sent: 0, error: 'Deal not found' }

  const progress = progressOf(deal)
  const { items } = documentsFor(deal)
  const all = rowsFor(items, progress, { formallyApproved: formallyApproved(deal) })

  // The same slice of the list the box shows under "now": everything due at this
  // round, plus anything added by hand.
  const dueNow = new Set(documentsDue(deal, 'proceed').items.map(i => i.key))
  const nowRows = all.filter(r => dueNow.has(r.key) || (r as any).addedByHand)

  const covered = await coveredKeysFor(supabase, dealId, nowRows)

  // Waiting on a person, not on the client. toRequest() has always excluded
  // these; naming them is new, so that going automatic does not make them
  // disappear quietly.
  const awaitingAnswer = nowRows
    .filter(r => (r as any).askFirst && !r.requestedAt)
    .map(r => r.label)

  let candidates: DocRow[]
  let ignored = 0
  if (opts.keys && opts.keys.length) {
    const byKey = new Map(all.map(r => [r.key, r]))
    const picked = opts.keys.map(k => byKey.get(k)).filter(Boolean) as DocRow[]
    ignored = opts.keys.length - picked.length
    // Everything the browser posted has since stopped being a document on this
    // deal - a liability deleted this morning, say. Worth saying out loud rather
    // than reporting "nothing to do".
    if (picked.length === 0) {
      return { ok: false, status: 409, sent: 0, awaitingAnswer,
        error: 'None of those are documents on this deal any more. Reload the deal and try again.' }
    }
    candidates = picked
  } else {
    candidates = toRequest(nowRows)
  }

  const coveredHere = candidates.filter(r => covered.has(r.key)).map(r => r.label)
  candidates = candidates.filter(r => !covered.has(r.key))

  if (candidates.length === 0) {
    return {
      ok: true, status: 200, sent: 0, skipped: true, covered: coveredHere, awaitingAnswer,
      reason: coveredHere.length
        ? 'Everything due is already covered by the statements on file.'
        : 'There is nothing due to ask for.',
    }
  }

  const fresh = candidates.filter(r => !r.requestedAt)
  if (fresh.length === 0) {
    return { ok: true, status: 200, sent: 0, skipped: true, reason: 'already requested',
             covered: coveredHere, awaitingAnswer }
  }

  // WHO IS ASKED TO RAISE THEM. Its own setting since 10 Sep 2026; blank falls
  // back to whoever files them when they come back.
  const { data: settingsRow } = await supabase.from('settings')
    .select('docs_file_notification_user_id, docs_request_notification_user_id')
    .eq('id', 'singleton').single()
  const askWho = settingsRow?.docs_request_notification_user_id
    || settingsRow?.docs_file_notification_user_id
  let toEmail: string | null = null, toName: string | null = null
  if (askWho) {
    const { data: p } = await supabase.from('user_profiles').select('email, full_name')
      .eq('id', askWho).single()
    toEmail = p?.email || null
    toName = p?.full_name || null
  }

  // NOBODY TO SEND IT TO. Worth stopping for rather than recording a request
  // that no human was ever told about - especially on the automatic path, where
  // there is no one watching a screen for a result.
  if (!toEmail) {
    return {
      ok: false, status: 500, sent: 0, awaitingAnswer, covered: coveredHere,
      error: 'No recipient is set for document requests. Set one in Settings under Notifications. Nothing was sent and nothing was recorded.',
    }
  }

  const nowIso = new Date().toISOString()
  const clientName = `${(deal.clients as any)?.first_name || ''} ${(deal.clients as any)?.last_name || ''}`.trim()
  const askedFor = fresh.map(r => r.key)

  // Applied to what the deal holds at the moment of writing, not to the copy
  // read at the top of this call - every tick lives in this one column.
  const { next, problem } = await patchDealColumn(supabase, dealId, 'document_progress',
    (cur: any) => withRequest(progressOf({ document_progress: cur }), askedFor, by, nowIso),
    progress)
  if (problem) {
    return { ok: false, status: 500, sent: 0, awaitingAnswer, covered: coveredHere,
             error: 'The request could not be recorded on the deal, so nothing was sent.' }
  }

  const sent = await notifyDocumentRequest({
    dealId, dealName: deal.deal_name, clientName,
    brokerName: deal.assigned_broker || '',
    requestedBy: by,
    documents: fresh.map(r => ({ label: r.label, detail: r.detail, who: (r as any).groupLabel })),
    alreadyAsked: all.filter(r => r.requestedAt).length,
    recipientEmail: toEmail, recipientName: toName,
    idempotencyKey: `doc-request:${dealId}:${nowIso}`,
  })

  if (!sent.ok) {
    return {
      ok: false, status: 502, sent: 0, recorded: true, requestedAt: nowIso,
      to: toName, awaitingAnswer, covered: coveredHere,
      error: `The ${fresh.length} ${fresh.length === 1 ? 'document is' : 'documents are'} recorded as asked for, but the email did not go out (${sent.error}). Tell ${toName || 'the person who does the requesting'} directly.`,
    }
  }

  return {
    ok: true, status: 200, sent: fresh.length, to: toName, requestedAt: nowIso,
    rounds: requestRounds(next).length, ignored, covered: coveredHere, awaitingAnswer,
  }
}

// WHAT THE BROKER IS TOLD, in the email that already goes out when the client
// agrees to proceed.
//
// The request now happens without anybody pressing anything, so the one place
// somebody finds out it happened - or did not - is this paragraph. A failure
// SHOUTS, because nothing else will: the client is being told their documents
// are coming and the deal has already moved on.
export function brokerDocumentLine(docs: DocRequestResult | null): string {
  if (!docs) return ''

  const esc = (v: any) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const notes: string[] = []

  if (docs.covered?.length) {
    notes.push(`Not asked for, because the statements already on file cover them: ${esc(docs.covered.join(', '))}.`)
  }
  if (docs.awaitingAnswer?.length) {
    notes.push(`<strong>Waiting on your yes or no:</strong> ${esc(docs.awaitingAnswer.join(', '))}. `
      + 'That is never sent automatically. Open the deal and answer it, or it comes back at formal approval.')
  }
  const extra = notes.length ? `<p style="font-size:13px;color:#666">${notes.join('<br>')}</p>` : ''

  if (!docs.ok) {
    return `<p style="font-size:14px"><strong>** THE DOCUMENT REQUEST DID NOT GO OUT &mdash; `
      + `${esc(docs.error || 'no reason given')} **</strong><br>`
      + `Open the deal and press Request documents.</p>${extra}`
  }

  if (docs.skipped || docs.sent === 0) {
    return `<p style="font-size:13px;color:#666">No documents were requested. `
      + `${esc(docs.reason || 'There was nothing due.')}</p>${extra}`
  }

  const n = docs.sent
  return `<p style="font-size:14px">${n} ${n === 1 ? 'document has' : 'documents have'} been requested `
    + `from ${esc(docs.to || 'the person who raises them')}, to go out on the SalesTrekker client portal. `
    + `Nothing for you to press.</p>${extra}`
}
