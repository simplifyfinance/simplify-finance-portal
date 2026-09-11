import { createSupabaseServer } from '@/lib/supabase-server'
import { resolveBrokerProfile } from '@/lib/broker-profile'
import { notifyCrisMoveCard } from '@/lib/salestrekker-notify'

import type { ProceedStage } from './next-steps-copy'

// Reading the deal, without touching it.
//
// The page used to record the client as proceeding simply by being loaded, and
// loading is not something only the client does: mail security scanners follow
// every link in an email before it reaches the inbox. That moved the deal a
// stage, allocated a credit officer and emailed two people, all without anyone
// having read the message. Nothing here writes; the write happens when a button
// is pressed.
export async function loadProceed(dealId: string) {
  const supabase = await createSupabaseServer()
  const { data: deal, error } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name, email)')
    .eq('id', dealId)
    .single()
  if (error || !deal) return { ok: false as const }

  const { data: settings } = await supabase.from('settings')
    .select('wealth_desk_link').eq('id', 'singleton').single()

  return { ok: true as const, deal, wealthDeskLink: settings?.wealth_desk_link || '' }
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
  const supabase = await createSupabaseServer()

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name, email)')
    .eq('id', dealId)
    .single()

  if (error || !deal) return { ok: false as const, error: error?.message || 'Deal not found' }

  const { data: settings } = await supabase.from('settings').select('wealth_desk_link').eq('id', 'singleton').single()
  const wealthDeskLink = settings?.wealth_desk_link || ''

  const alreadyProceeded = stage === 'BC' ? !!deal.client_proceeded : !!deal.lo_client_proceeded

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
            subject: `${deal.deal_name} has moved to ${nextStageLabel}`,
            html: `<p>Hi ${brokerRecord.name?.split(' ')[0] || ''},</p><p><strong>${deal.deal_name}</strong> has progressed to <strong>${nextStageLabel}</strong>.</p><p><a href="https://simplify-finance-portal.vercel.app/deals/${dealId}">Open the deal</a></p>`
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
