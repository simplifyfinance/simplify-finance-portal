// THE THREE EMAILS A DEAL CAN SEND, AND WHEN EACH ONE IS READY.
//
// Fabio, 29 Sep 2026: "a series of template emails... on milestones, for
// example, formal approval emails, pre-approval emails". Then, the next day,
// having looked: "we dont have a condtional apporval tempalkte we have a
// pre-approval and a pre-approval extnesion confirmaiton".
//
// THREE, NOT FOUR. The extension is the pre-approval with three changes - see
// lib/preapproval-email.ts, which builds both from one file for exactly that
// reason - but it is a separate thing to SEND, with its own moment and its own
// record.
//
// WHAT "READY" MEANS. The deal has reached the milestone the email announces.
// Nothing here checks whether the email would read well; the send screen does
// that, because a missing figure is a thing to fix rather than a reason to hide
// the button. An email that is not ready is still listed and still says why -
// hiding it just means somebody asks where it went.

const txt = (v: any) => String(v ?? '').trim()

export type TemplateId = 'preapproval' | 'preapproval_extension' | 'formal_approval'
  | 'final_checkin'

export type MilestoneTemplate = {
  id: TemplateId
  name: string
  // The bank's own letter. Fabio, 29 Sep: "letter is compulsory" - every one of
  // these says "please find attached", and an email that says that with nothing
  // attached is a phone call.
  // THREE OF THE FOUR SAY "please find attached", AND ONE DOES NOT.
  //
  // This was a literal `true` because every milestone email announced something
  // the bank had put in writing. The final check-in announces nothing and
  // carries nothing, so the rule it was standing in for is written properly in
  // lib/milestone-menu.test.ts: a template that PROMISES an attachment must
  // require one.
  letterRequired: boolean
  // Settlements copied in. Fabio's instinct on the other two, which I agree
  // with: there is no settlement to run on a pre-approval and a house hunt can
  // take months, so it would fill their inbox with deals nobody can act on.
  copySettlements: boolean
}

export const TEMPLATES: MilestoneTemplate[] = [
  // FIRST, BECAUSE IT IS THE EARLIEST POINT A DEAL CAN REACH THIS LIST - the
  // borrowing capacity has gone and nothing has come back. TEMPLATES is in the
  // order a deal LIVES them; see LIVED below.
  { id: 'final_checkin', name: 'Final check-in', letterRequired: false, copySettlements: false },
  { id: 'preapproval', name: 'Pre-approval', letterRequired: true, copySettlements: false },
  { id: 'preapproval_extension', name: 'Pre-approval extension', letterRequired: true, copySettlements: false },
  { id: 'formal_approval', name: 'Formal approval', letterRequired: true, copySettlements: true },
]

export function templateById(id: any): MilestoneTemplate | null {
  return TEMPLATES.find(t => t.id === txt(id)) || null
}

// --- what has already gone out ---------------------------------------------

export type SentEmail = {
  template: TemplateId
  at: string
  by: string
  to: string[]
  cc: string[]
  // Whether the bank's letter went with it. Kept because "we told them" and
  // "we told them and sent the approval" are different claims.
  attached: boolean
  // WHETHER THIS ONE CARRIED THE RBA NOTICE. An email sent on the 2nd said the
  // rate did not include the increase; one sent on the 25th did not, because by
  // then the bank had passed it on. In six months that is a question with an
  // answer rather than a guess. See lib/rate-notice.ts.
  rateNotice?: boolean
}

export function emailsSent(deal: any): SentEmail[] {
  const raw = deal?.emails_sent
  if (!Array.isArray(raw)) return []
  return raw
    .filter(x => x && templateById(x.template))
    .map((x: any) => ({
      template: txt(x.template) as TemplateId,
      at: txt(x.at),
      by: txt(x.by),
      to: Array.isArray(x.to) ? x.to.map(txt).filter(Boolean) : [],
      cc: Array.isArray(x.cc) ? x.cc.map(txt).filter(Boolean) : [],
      attached: !!x.attached,
      rateNotice: x.rateNotice === true,
    }))
}

// The most recent one of a kind. A template can go twice - a client loses the
// email, a second applicant is added - so this is the latest, not the only.
export function lastSent(deal: any, id: TemplateId): SentEmail | null {
  const mine = emailsSent(deal).filter(e => e.template === id)
  if (mine.length === 0) return null
  return mine.reduce((a, b) => (a.at > b.at ? a : b))
}

export function timesSent(deal: any, id: TemplateId): number {
  return emailsSent(deal).filter(e => e.template === id).length
}

// The whole list back, for the caller to save in one write. Never a partial
// update: emails_sent is a JSON column and two half-writes lose a send.
export function withSent(deal: any, entry: SentEmail): SentEmail[] {
  return [...emailsSent(deal), entry]
}

// --- which one is ready, and why not -----------------------------------------

export type MenuState = 'ready' | 'sent' | 'not_yet'

export type MenuItem = {
  id: TemplateId
  name: string
  state: MenuState
  // "approved 29 Sep", "sent 12 Sep by Katie", "no pre-approval recorded"
  note: string
}

function when(iso: any): string {
  const d = new Date(txt(iso))
  if (!txt(iso) || Number.isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]}`
}

// READY IS ABOUT THE DEAL, NOT ABOUT THE EMAIL.
//
// The extension is the one with a rule of its own: there is nothing to extend
// until a pre-approval has actually been told to the client, so it stays out of
// reach until the pre-approval email has gone.
function readiness(deal: any, t: MilestoneTemplate): { state: MenuState; note: string } {
  const already = lastSent(deal, t.id)
  const sentNote = already
    ? `sent ${when(already.at)}${already.by ? ` by ${already.by}` : ''}`
    : ''

  // ALWAYS AVAILABLE, ON PURPOSE.
  //
  // Fabio, 9 Oct 2026: "this is when we are chasing clients so dont tie to
  // anyhting like formal apporval settlement etc make it always available to
  // generate."
  //
  // The other three announce something that either happened or did not, so they
  // ask the deal. Nothing in the record knows whether a client has gone quiet -
  // a person decides that - and a portal that guessed would hide the button on
  // the deal somebody wants it for. Sent once already is still said, because
  // sending it twice is worth noticing; it is not stopped.
  if (t.id === 'final_checkin') {
    return already
      ? { state: 'sent', note: `${sentNote}${timesSent(deal, t.id) > 1 ? ` \u00b7 ${timesSent(deal, t.id)} times` : ''}` }
      : { state: 'ready', note: 'send whenever a client has gone quiet' }
  }

  if (t.id === 'formal_approval') {
    if (!deal?.formal_approval_at) return { state: 'not_yet', note: 'not formally approved yet' }
    return already
      ? { state: 'sent', note: sentNote }
      : { state: 'ready', note: `approved ${when(deal.formal_approval_at)}` }
  }

  if (t.id === 'preapproval') {
    if (!deal?.preapproval_at) return { state: 'not_yet', note: 'no pre-approval recorded' }
    return already
      ? { state: 'sent', note: sentNote }
      : { state: 'ready', note: `pre-approved ${when(deal.preapproval_at)}` }
  }

  // preapproval_extension
  if (!deal?.preapproval_at) return { state: 'not_yet', note: 'no pre-approval recorded' }
  if (!lastSent(deal, 'preapproval')) {
    return { state: 'not_yet', note: 'the pre-approval email has not gone yet' }
  }
  return already
    ? { state: 'sent', note: `${sentNote}${timesSent(deal, t.id) > 1 ? ` · ${timesSent(deal, t.id)} extensions` : ''}` }
    : { state: 'ready', note: 'the pre-approval has been sent' }
}

// THE MENU, IN THE ORDER IT IS READ. What is ready leads, what has gone sits
// under it, and what is not yet is last and says why - listed rather than
// hidden, because a missing button is a question and a greyed one is an answer.
//
// WITHIN "READY", THE FURTHEST MILESTONE COMES FIRST.
//
// TEMPLATES is in the order a deal LIVES them - pre-approval, extension, formal
// approval - and the first version sorted by that, so a formally approved deal
// offered the pre-approval email first. Wrong way round: the one somebody wants
// is the milestone just reached, and anything earlier still unsent is months
// late rather than next.
const LIVED = (id: TemplateId) => TEMPLATES.findIndex(t => t.id === id)

export function menuFor(deal: any): MenuItem[] {
  const items = TEMPLATES.map(t => ({ id: t.id, name: t.name, ...readiness(deal, t) }))
  const rank: Record<MenuState, number> = { ready: 0, sent: 1, not_yet: 2 }
  return items.sort((a, b) => {
    if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state]
    // Ready: newest milestone first. Everything else: the order a deal lives
    // them, which is how somebody reads a history.
    return a.state === 'ready' ? LIVED(b.id) - LIVED(a.id) : LIVED(a.id) - LIVED(b.id)
  })
}

// The one to open when somebody presses Email without choosing: the milestone
// this deal has just reached. Null where nothing is ready - then the menu opens
// and explains itself.
//
// THE FINAL CHECK-IN IS NEVER SUGGESTED. It is always ready, so without this it
// would be the answer on every deal that has reached no milestone - and pressing
// Email on a brand new deal would offer to close the client's file. It is a
// decision a person makes about a client who has gone quiet, never the portal's
// idea of what comes next. It is in the menu, one click away, and that is where
// it belongs.
export function suggestedFor(deal: any): TemplateId | null {
  return menuFor(deal).find(i => i.state === 'ready' && i.id !== 'final_checkin')?.id || null
}
