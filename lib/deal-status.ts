export function getWaitingOnLabel(deal: any, creditOfficerName?: string | null): { text: string; color: 'warning' | 'accent' | 'pro' | 'success' } | null {
  if (deal.status === 'completed') return { text: '✓ Done', color: 'success' }
  if (deal.status === 'lost') return null

  const officerLabel = creditOfficerName || (deal.assigned_credit_officer ? 'Credit officer' : 'Broker')

  if (deal.stage === 'BC') {
    if (!deal.bc_completed_at) return { text: `Waiting on: ${officerLabel} to complete BC`, color: 'warning' }
    if (!deal.bc_sent_at) return { text: 'Waiting on: Broker to review and send', color: 'accent' }
    if (!deal.client_proceeded) return { text: 'Waiting on: Client to respond', color: 'pro' }
  }
  if (deal.stage === 'LO') {
    if (!deal.lo_completed_at) return { text: `Waiting on: ${officerLabel} to complete LO`, color: 'warning' }
    if (!deal.lo_sent_at) return { text: 'Waiting on: Broker to review and send', color: 'accent' }
    if (!deal.lo_client_proceeded) return { text: 'Waiting on: Client to respond', color: 'pro' }
  }
  if (deal.stage === 'Compliance') {
    if (!deal.compliance_completed_at) return { text: `Waiting on: ${officerLabel} to complete Compliance`, color: 'warning' }
    return { text: '✓ Ready to push to SalesTrekker', color: 'success' }
  }

  return null
}

export const WAITING_ON_STYLES: Record<string, string> = {
  warning: 'bg-amber-100 text-amber-700',
  accent: 'bg-[#2DBEFF]/10 text-[#2DBEFF]',
  pro: 'bg-purple-100 text-purple-700',
  success: 'bg-green-100 text-green-700',
}
