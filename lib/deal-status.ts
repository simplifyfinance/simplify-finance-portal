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

// ---------------------------------------------------------------------------
// The progress bar, from the same facts.
//
// The bar used to tick BC green on bc_completed_at. That timestamp means the
// credit officer finished typing and handed it to the broker - not sent, not
// agreed. So a deal sitting with the client unanswered showed BC ticked and
// Lending Options lit up, identical to a deal that had genuinely moved on, while
// the amber chip underneath correctly said they were in different places.
//
// A stage is finished when the client has agreed to move past it. Nothing else
// closes it. The beads and the chip now come out of this one file so they cannot
// drift apart again.

export type Bead = {
  key: string
  label: string
  done: boolean
  current: boolean
  date: string | null      // raw value; the component formats it
  state: string | null     // who is holding it up, under the live bead only
}

type BeadDef = { key: string; label: string; done: (d: any) => boolean; date: (d: any) => any }

const BEADS: BeadDef[] = [
  { key: 'fact_find', label: 'Fact Find',
    done: d => !!d?.fact_find_data && Object.keys(d.fact_find_data).length > 0,
    date: d => d?.created_at },
  // Closed by the client agreeing, not by the credit officer finishing.
  { key: 'bc', label: 'BC',
    done: d => !!d?.client_proceeded, date: d => d?.proceeded_at || d?.bc_completed_at },
  { key: 'lo', label: 'Lending Options',
    done: d => !!d?.lo_client_proceeded, date: d => d?.lo_proceeded_at || d?.lo_completed_at },
  { key: 'compliance', label: 'Compliance',
    done: d => !!d?.compliance_completed_at, date: d => d?.compliance_completed_at },
  { key: 'lodged', label: 'Lodged', done: d => !!d?.lodged_at, date: d => d?.lodged_at },
  { key: 'preapproved', label: 'Preapproved', done: d => !!d?.preapproval_at, date: d => d?.preapproval_at },
  { key: 'formal', label: 'Formal', done: d => !!d?.formal_approval_at, date: d => d?.formal_approval_at },
  { key: 'settled', label: 'Settled', done: d => !!d?.settled_at, date: d => d?.settled_at },
]

// Which of the eight waiting-on steps we are on, or -1 once they are all behind us.
function waitingStep(deal: any): number {
  let last = -1
  STEPS.forEach((s, i) => { if (s.done(deal)) last = i })
  return last + 1 < STEPS.length ? last + 1 : -1
}

// One short word for who is holding the live stage up. Same ladder as the chip,
// said in three words instead of a sentence.
function stateWord(deal: any): string | null {
  const i = waitingStep(deal)
  if (i === -1) return 'with lender'
  if (i === 0) return 'not started'
  const withCredit = deal?.assigned_credit_officer ? 'with credit' : 'with broker'
  if (i === 1 || i === 4 || i === 7) return withCredit
  if (i === 2 || i === 5) return 'with broker'
  return 'with client'          // 3 and 6
}

export function dealBeads(deal: any): Bead[] {
  const hit = BEADS.map(b => b.done(deal))
  // A skipped stage behind a further one is history, not a task - the same rule
  // the chip uses. A BC done outside the portal must not hold the bar back.
  let last = -1
  hit.forEach((v, i) => { if (v) last = i })
  const currentIdx = Math.min(last + 1, BEADS.length - 1)
  const word = stateWord(deal)

  return BEADS.map((b, i) => ({
    key: b.key,
    label: b.label,
    done: i <= last,
    current: i > last && i === currentIdx,
    date: b.date(deal) || null,
    state: (i > last && i === currentIdx) ? word : null,
  }))
}

// Which tab the deal page opens on. Taken from the same beads so the blue bead
// and the open tab can never disagree.
export function currentStage(deal: any): string {
  const beads = dealBeads(deal)
  const live = beads.find(b => b.current) || beads[beads.length - 1]
  if (live.key === 'fact_find') return 'FactFind'
  if (live.key === 'bc') return 'BC'
  if (live.key === 'lo') return 'LO'
  return 'Compliance'
}

// ---------------------------------------------------------------------------
// Who pressed "the client agreed", and when.
//
// There are two doors onto the same lock: the client presses Proceed in their
// email, or one of us presses "Client agreed - move to LO" because they rang.
// Both used to write client_proceeded and nothing else, so afterwards there was
// no way to tell which had happened. Deals recorded before this say so, rather
// than being credited to the client on no evidence.

export function proceedCredit(deal: any, stage: 'BC' | 'LO'): { when: string | null; who: string } {
  const when = stage === 'BC' ? (deal?.proceeded_at || null) : (deal?.lo_proceeded_at || null)
  const src = stage === 'BC' ? deal?.proceeded_source : deal?.lo_proceeded_source
  const by = stage === 'BC' ? deal?.proceeded_by : deal?.lo_proceeded_by
  if (src === 'client') return { when, who: 'client pressed Proceed' }
  if (src === 'office') return { when, who: by ? `recorded by ${by}` : 'recorded by our office' }
  return { when, who: 'recorded before we started tracking who pressed it' }
}
