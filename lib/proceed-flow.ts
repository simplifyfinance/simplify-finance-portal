import { createSupabaseServer } from '@/lib/supabase-server'

type ProceedStage = 'BC' | 'LO'

export async function markProceeded(dealId: string, stage: ProceedStage) {
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
      await supabase.from('deals').update({ stage: 'LO', client_proceeded: true, proceeded_at: nowIso }).eq('id', dealId)
    } else {
      await supabase.from('deals').update({ stage: 'Compliance', lo_client_proceeded: true, lo_proceeded_at: nowIso }).eq('id', dealId)
    }

    // Notify the assigned broker either way — they need to know the client has moved forward
    try {
      const { data: settings } = await supabase.from('settings').select('brokers').eq('id', 'singleton').single()
      const brokerRecord = (settings?.brokers || []).find((b: any) => (b.name || '').split(' ')[0] === deal.assigned_broker)
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

export function buildNextStepsContent(stage: ProceedStage, wealthDeskLink?: string) {
  if (stage === 'BC') {
    const steps = wealthDeskLink
      ? [
          { num: '1', title: "You'll be invited to our client portal", desc: "You'll receive a text and an email with instructions to log in. That's where you'll upload your supporting documents.", accent: false },
          { num: '2', title: 'Share your bank statements', desc: "You'll also need to provide your bank statements. Click the button below now — it'll take you straight to a secure page to connect your bank and share them. It's bank-level encrypted and never stored.", accent: true, button: true },
          { num: '3', title: 'Your lending options presented', desc: "Once we've received your bank statements and documents through the client portal, we'll present your personalised lending options with rates, comparisons, and our recommendation — within 48 business hours.", accent: false },
        ]
      : [
          { num: '1', title: "You'll be invited to our client portal", desc: "You'll receive a text and an email with instructions to log in. That's where you'll upload your supporting documents.", accent: false },
          { num: '2', title: 'Your lending options presented', desc: "Once we've reviewed everything, we'll present your personalised lending options with rates, comparisons, and our recommendation — within 48 business hours.", accent: false },
        ]
    return { heading: 'What happens next', steps, showWealthDesk: !!wealthDeskLink }
  }
  const steps = [
    { num: '1', title: 'Application prepared', desc: 'Our credit team will finalise your compliance assessment and prepare your application for submission.', accent: false },
    { num: '2', title: 'Documents to review and sign', desc: "You'll receive our credit guide, credit proposal, and lender application form via email shortly. Please keep an eye out and sign these when they arrive.", accent: true },
    { num: '3', title: 'Lender submission', desc: "We'll submit your application to your chosen lender and keep you updated on their response.", accent: false },
    { num: '4', title: 'Approval & next steps', desc: "Once approved, we'll guide you through the remaining steps to settlement.", accent: false },
  ]
  return { heading: 'What happens next', steps, showWealthDesk: false }
}
