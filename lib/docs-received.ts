// DOCUMENTS RECEIVED, AND THE GAP BEFORE THE ASSESSOR IS TOLD.
//
// Two people need to know when a client's supporting documents arrive, but not
// at the same moment. The filing person renames them and puts them in the
// client's OneDrive folder; only after that are they any use to the assessor
// completing the lending options. Telling both at once sends the assessor to a
// folder full of IMG_4471.jpg.
//
// Fabio, 2 Sep 2026: "how about we delay message to credit by 30 min normally
// the time cris to label docs".
//
// The wait is not a timer in the browser and not a job we run. The assessor's
// email is handed to Resend at the moment the button is pressed, with the time
// it should go out. Nothing of ours has to still be awake half an hour later.

export const DEFAULT_DOCS_DELAY_MINUTES = 30

// Bounded, because this is a number typed on a settings page and "300" would
// silently park an email for five hours. Zero is allowed and means "tell them
// both at once".
export const MIN_DOCS_DELAY_MINUTES = 0
export const MAX_DOCS_DELAY_MINUTES = 240

export function docsDelayMinutes(settings: any): number {
  const raw = settings?.docs_delay_minutes
  if (raw === null || raw === undefined || String(raw).trim() === '') return DEFAULT_DOCS_DELAY_MINUTES
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_DOCS_DELAY_MINUTES
  return Math.min(MAX_DOCS_DELAY_MINUTES, Math.max(MIN_DOCS_DELAY_MINUTES, Math.round(n)))
}

export function assessorDueAt(receivedAtIso: string, minutes: number): Date {
  return new Date(new Date(receivedAtIso).getTime() + minutes * 60_000)
}

// WHO HEARS SECOND.
//
// Always the credit officer allocated to the deal. Between BC and lending
// options there is always one - and where there is not, the answer is to
// allocate one, not to invent a fallback recipient who is not working the file.
// Fabio, 2 Sep 2026: "we say allocate a credit assessor first before pressing
// the button".
export const NO_ASSESSOR_MESSAGE =
  'This deal has no credit assessor allocated, so there is nobody to tell in 30 minutes. Allocate one first, then mark the documents received.'

export function assessorMissing(deal: any): boolean {
  return !deal?.assigned_credit_officer
}

export type DocsState =
  | { kind: 'none' }
  // Pressed a moment ago. The claim is on the record, the emails are still on
  // their way out - see STILL_GOING_OUT_MS.
  | { kind: 'sending'; receivedAt: string }
  // Marked. Cris has been told; the assessor's email is sitting with Resend.
  | { kind: 'waiting'; receivedAt: string; dueAt: Date }
  | { kind: 'done'; receivedAt: string; dueAt: Date }
  // Marked, and the assessor's email really was never scheduled. Said out loud
  // rather than left looking finished.
  | { kind: 'unscheduled'; receivedAt: string }

// A GAP IS NOT A FAILURE, FOR THE FIRST TWO MINUTES.
//
// 10 Sep 2026. Ellie pressed "Docs received" on William Welton. Kylie was in the
// same deal, her page read the record while the press was still running, and she
// was told in red that nobody was going to be emailed. The email was with Resend
// the whole time - id 65aafb98, due 10:57.
//
// The route claims the deal FIRST, writing docs_received_at so two people cannot
// press it at once, and only then emails the filing team, hands the assessor's
// copy to Resend and writes the due time. For those few seconds the record
// genuinely reads "marked, assessor not scheduled" - which is the exact shape
// the red panel tests for.
//
// So the red is held back until the press has had time to finish. Before that it
// is what it actually is: still going out.
export const STILL_GOING_OUT_MS = 2 * 60_000

export function docsStateOf(deal: any, now = new Date()): DocsState {
  const receivedAt = deal?.docs_received_at
  if (!receivedAt) return { kind: 'none' }
  const due = deal?.docs_assessor_due_at
  if (!due) {
    const since = now.getTime() - new Date(receivedAt).getTime()
    // Negative on a clock that disagrees with the server's; that is still "just
    // pressed", never "failed two minutes ago".
    return since < STILL_GOING_OUT_MS
      ? { kind: 'sending', receivedAt }
      : { kind: 'unscheduled', receivedAt }
  }
  const dueAt = new Date(due)
  // The clock decides, because Resend owns the send and will not tell us it
  // happened. Once the time is past, it has gone.
  return dueAt.getTime() <= now.getTime()
    ? { kind: 'done', receivedAt, dueAt }
    : { kind: 'waiting', receivedAt, dueAt }
}

// Only while it is still in the future. Asking Resend to cancel something it
// has already sent is a promise we cannot keep.
export function stillCancellable(deal: any, now = new Date()): boolean {
  if (!deal?.docs_received_at || !deal?.docs_assessor_due_at) return false
  return new Date(deal.docs_assessor_due_at).getTime() > now.getTime()
}

// "2:15 pm". A time, not "in 30 minutes" - a page left open for an hour would
// otherwise keep promising half an hour.
export function atTime(d: Date): string {
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
}
