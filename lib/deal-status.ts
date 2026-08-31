// What a deal is waiting on, worked out from what has actually happened to it.
//
// This used to read deals.stage. That column is only ever advanced in one place
// in the whole codebase - when a client clicks "proceed" - so a deal whose client
// has not proceeded stays on 'BC' no matter how far the work has got. A deal with
// its LO written, sent and sitting with the client still read "Waiting on: Broker
// to review and send", because the label was answering a question about the BC.
//
// The progress bar never had this problem: it reads the timestamps. So does this
// now. The rule is the same one DealProgress uses - find the last thing that
// happened, and name the next thing that has not.

type Step = {
  done: (d: any) => boolean
  label: (officer: string) => string
  color: 'warning' | 'accent' | 'pro' | 'success'
}

// In order. Each one cannot happen before the one above it.
const STEPS: Step[] = [
  { done: d => !!d?.fact_find_data && Object.keys(d.fact_find_data).length > 0,
    label: () => 'Waiting on: Fact Find to be completed', color: 'warning' },
  { done: d => !!d?.bc_completed_at,
    label: o => `Waiting on: ${o} to complete BC`, color: 'warning' },
  { done: d => !!d?.bc_sent_at,
    label: () => 'Waiting on: Broker to review and send the BC', color: 'accent' },
  { done: d => !!d?.client_proceeded,
    label: () => 'Waiting on: Client to respond to the BC', color: 'pro' },
  { done: d => !!d?.lo_completed_at,
    label: o => `Waiting on: ${o} to complete LO`, color: 'warning' },
  { done: d => !!d?.lo_sent_at,
    label: () => 'Waiting on: Broker to review and send the LO', color: 'accent' },
  { done: d => !!d?.lo_client_proceeded,
    label: () => 'Waiting on: Client to respond to the LO', color: 'pro' },
  { done: d => !!d?.compliance_completed_at,
    label: o => `Waiting on: ${o} to complete Compliance`, color: 'warning' },
]

export function getWaitingOnLabel(
  deal: any,
  creditOfficerName?: string | null,
): { text: string; color: 'warning' | 'accent' | 'pro' | 'success' } | null {
  if (!deal) return null
  if (deal.status === 'completed') return { text: '✓ Done', color: 'success' }
  if (deal.status === 'lost') return null

  const officer = creditOfficerName || (deal.assigned_credit_officer ? 'Credit officer' : 'Broker')

  // A step can be skipped in practice - a broker who never ticked "sent" still
  // went on and finished the LO. So the furthest thing that HAS happened decides
  // where the deal is, and anything unticked behind it is history, not a task.
  let last = -1
  STEPS.forEach((s, i) => { if (s.done(deal)) last = i })

  const next = STEPS[last + 1]
  if (!next) return { text: '✓ Ready to push to SalesTrekker', color: 'success' }
  return { text: next.label(officer), color: next.color }
}

export const WAITING_ON_STYLES: Record<string, string> = {
  warning: 'bg-amber-100 text-amber-700',
  accent: 'bg-[#2DBEFF]/10 text-[#2DBEFF]',
  pro: 'bg-purple-100 text-purple-700',
  success: 'bg-green-100 text-green-700',
}
