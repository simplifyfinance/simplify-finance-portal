// SENDING A DEAL BACK TO CREDIT, WITH THE REASON ATTACHED.
//
// 27 Oct 2026. Fabio: "we have situatiomns where credit has worked on a BC but
// broker asked credit to reword that deal for exmaple do a different sceanrtio
// based on conversation with cleints. How can we communicate with credit person
// thgat this needs a rework so it gets flagged in her queue and needs rework?"
//
// THE MECHANISM ALREADY EXISTED. api/move-deal-back clears the timestamp that
// moved the deal on, writes a line in the note log and emails the allocated
// assessor. What it has never carried is WHY. The email it sends today says
// "Check with the broker whether this still needs working on" - which is the
// portal admitting it does not know, and making somebody pick up a phone.
//
// So this is not a new machine. It is the reason, written down, and three
// things that follow from having it:
//
//   - the deal reads REWORK rather than quietly reappearing in her queue
//     looking like she never finished it
//   - it goes to the top of her day, because a rework is a finished deal with
//     a client waiting and a broker stopped
//   - she is told, in the broker's own words, before she opens anything
//
// NOTHING IS DELETED. The BC she wrote stays on the deal and stays counted in
// her finished work for the day she finished it. If a rework wiped the first
// one her numbers would go DOWN for doing what she was asked, which is the
// opposite of what the measuring is for.
//
// WHAT IS CLEARED, AND WHY IT IS THE RIGHT THING TO CLEAR.
//
// The portal works out where a deal is from a ladder of timestamps - see STEPS
// in lib/deal-status.ts. Putting the deal back with credit is therefore not a
// new rule to write; it is unsetting the stamps that carried it past them. Clear
// bc_completed_at and the ladder says "waiting on credit to complete BC" by
// itself, and whoHasIt, the clock on the blue box, the board and the day's draft
// all follow with no further instruction.
//
// AND bc_sent_at GOES WITH IT, which fixes a second thing Fabio raised the same
// hour: "once we mark email sent it locks and we cant resend the email with
// rewoked figures". The Send to client button reads bc_sent_at. While it is set
// the button is green and dead, so a reworked BC could never be sent. Clearing
// it is not losing the fact that an email went - the date is kept on the deal in
// bc_rework_was_sent, and the note log records it in words.
//
// This file is arithmetic and no database on purpose, so all of it can be tested
// without one. The writes are in app/api/send-it-back/route.ts.

import { ownerOf, type Stage } from './who-did-this-stage'

const txt = (v: any) => String(v ?? '').trim()

export type BackStage = 'bc' | 'lo'

export const BACK_STAGE_LABEL: Record<BackStage, string> = {
  bc: 'BC', lo: 'Lending options',
}

// THE REASONS, AND THERE ARE SIX BECAUSE SIX IS WHAT FITS ON ONE LINE.
//
// A list somebody has to scroll is a list where everybody picks the first item.
// These are the things that actually send a BC back; anything else is
// 'something else' plus the words, which are required either way.
export const REWORK_REASONS: Record<string, string> = {
  scenario: 'A different scenario',
  client_changed: 'Client changed their mind',
  figures: 'Figures are wrong',
  lender: 'That lender will not work',
  missing: 'Something is missing',
  other: 'Something else',
}

export const REWORK_REASON_KEYS = Object.keys(REWORK_REASONS)

export function reworkReasonLabel(key: any): string {
  const k = txt(key)
  return REWORK_REASONS[k] || (k ? 'Something else' : '')
}

/** The six columns a stage keeps about having been sent back. */
export const reworkFields = (s: BackStage) => ({
  at: `${s}_rework_at`,
  by: `${s}_rework_by`,
  why: `${s}_rework_why`,
  note: `${s}_rework_note`,
  count: `${s}_rework_count`,
  wasSent: `${s}_rework_was_sent`,
})

/** The stamps that carried the deal past this stage, newest first. */
const STAMPS: Record<BackStage, string[]> = {
  bc: ['bc_sent_at', 'bc_completed_at'],
  lo: ['lo_sent_at', 'lo_completed_at'],
}

/** The stamp that means the client has agreed and it is too late. */
const AGREED: Record<BackStage, string> = {
  bc: 'client_proceeded', lo: 'lo_client_proceeded',
}

/** The stamp credit sets when they finish. Nothing to send back before it. */
const FINISHED: Record<BackStage, string> = {
  bc: 'bc_completed_at', lo: 'lo_completed_at',
}

// ---------------------------------------------------------------------------
// CAN THIS BE SENT BACK?
// ---------------------------------------------------------------------------
//
// Fabio, 27 Oct 2026, asked where the line is: any time until the client
// agrees. So a BC that has gone out to the client and is sitting unanswered
// CAN be sent back - that is the common case, because reading it is what makes
// a client change their mind. Once they have agreed it is a different
// conversation and a different stage, and the button is gone.

export type CanSendBack = { ok: boolean; why: string }

/**
 * WHO WOULD GET IT BACK. Null where nobody would.
 *
 * Reads the stage's own owner - see lib/who-did-this-stage.ts - and answers
 * only where that is a credit officer. A broker who wrote the BC himself has
 * nobody to send it back TO; he opens it and changes it, which is what the
 * form is for. So the button is not there, rather than there and pointless.
 */
export function sendBackTarget(deal: any, stage: BackStage): { officerId: string; name: string } | null {
  const o = ownerOf(deal, stage as Stage)
  return o?.officerId ? { officerId: o.officerId, name: o.name } : null
}

export function canSendBack(deal: any, stage: BackStage): CanSendBack {
  if (!deal) return { ok: false, why: 'No deal' }
  if (!deal[FINISHED[stage]]) {
    return { ok: false, why: `There is no finished ${BACK_STAGE_LABEL[stage]} to send back yet` }
  }
  if (deal[AGREED[stage]]) {
    return { ok: false, why: 'The client has already agreed to this one' }
  }
  if (!sendBackTarget(deal, stage)) {
    return { ok: false, why: 'Nobody in credit worked on this one - open it and change it' }
  }
  return { ok: true, why: '' }
}

/** Which timestamp columns this send-back would clear. For the words on screen. */
export function clearedBySendingBack(deal: any, stage: BackStage): string[] {
  return STAMPS[stage].filter(f => !!deal?.[f])
}

// ---------------------------------------------------------------------------
// THE WRITE
// ---------------------------------------------------------------------------

export type SendBackInput = {
  /** One of REWORK_REASON_KEYS. Required - see validateSendBack. */
  why: string
  /** The broker's own words. Required. This is what she reads. */
  note: string
  /** The broker's name, for the chip and the email. */
  by: string
  /** 'same' keeps the person who did it, 'queue' sends it back to the round robin. */
  to?: 'same' | 'queue'
}

export type Invalid = { field: 'why' | 'note'; message: string }

// BOTH REQUIRED, the same way the handover box credit fills in is both
// required. Fabio, 27 Oct 2026, asked straight out: both. The whole point of
// this is that she gets the reason, and "figures are wrong" with no words is a
// phone call, which is what we are removing.
export function validateSendBack(input: Partial<SendBackInput>): Invalid[] {
  const out: Invalid[] = []
  if (!REWORK_REASON_KEYS.includes(txt(input?.why))) {
    out.push({ field: 'why', message: 'Pick what needs doing again' })
  }
  if (txt(input?.note).length < 10) {
    out.push({ field: 'note', message: 'Say it in your own words - she reads this before she opens the deal' })
  }
  return out
}

/**
 * EVERYTHING THAT CHANGES ON THE DEAL, in one object.
 *
 * The count is worked out from the deal in hand rather than in the database,
 * because a plain update cannot say count + 1 - and a deal that has been sent
 * back three times is a thing somebody should see.
 */
export function sendBackPatch(
  deal: any, stage: BackStage, input: SendBackInput, now: Date = new Date(),
): Record<string, any> {
  const f = reworkFields(stage)
  const patch: Record<string, any> = {
    [f.at]: now.toISOString(),
    [f.by]: txt(input.by),
    [f.why]: txt(input.why),
    [f.note]: txt(input.note),
    [f.count]: Number(deal?.[f.count] || 0) + 1,
  }
  // THE DATE THE EMAIL WENT IS KEPT, not thrown away. Clearing bc_sent_at is
  // what unlocks the button; it is not a claim that nothing was ever sent.
  // Only the FIRST send is remembered - a deal sent back twice keeps the date
  // the client first saw something, which is the date anybody would ask about.
  const sentField = `${stage}_sent_at`
  if (deal?.[sentField] && !deal?.[f.wasSent]) patch[f.wasSent] = deal[sentField]

  for (const s of clearedBySendingBack(deal, stage)) patch[s] = null

  // A HAND PLACEMENT ON THE BOARD IS SUPERSEDED, the same as a deliberate move
  // back - otherwise the card stays where somebody dragged it while the deal
  // underneath has moved.
  patch.phase_override = null
  patch.phase_override_from = null
  patch.phase_override_at = null
  return patch
}

/** The line that goes in the append-only note log, so the file remembers. */
export function sendBackLine(deal: any, stage: BackStage, input: SendBackInput): string {
  const cleared = clearedBySendingBack(deal, stage)
  const kept = cleared.includes(`${stage}_sent_at`)
    ? ' The date it went to the client is kept on the deal.' : ''
  return `${BACK_STAGE_LABEL[stage]} sent back for rework by ${txt(input.by) || 'a broker'} — `
    + `${reworkReasonLabel(input.why)}. “${txt(input.note)}” `
    + `Nothing was deleted; the ${BACK_STAGE_LABEL[stage]} workings are unchanged. `
    + `Cleared: ${cleared.join(', ') || 'nothing'}.${kept}`
}

// ---------------------------------------------------------------------------
// READING IT BACK
// ---------------------------------------------------------------------------

export type Rework = {
  at: string
  by: string
  why: string
  /** The reason in words, ready for the screen. */
  label: string
  note: string
  /** 1 the first time it went back. */
  count: number
  /** The date the client was first sent this stage, where one was. */
  wasSent: string | null
}

/**
 * THE OPEN REWORK ON THIS STAGE, or null.
 *
 * It is open while it has been sent back and not finished again. There is no
 * second column saying so, deliberately: pressing Done sets bc_completed_at,
 * which closes it, and one fact cannot then disagree with another. The reason,
 * the words, the count and who sent it stay on the deal afterwards as history.
 */
export function reworkOn(deal: any, stage: BackStage): Rework | null {
  const f = reworkFields(stage)
  const at = txt(deal?.[f.at])
  if (!at) return null
  if (deal?.[FINISHED[stage]]) return null
  return {
    at,
    by: txt(deal?.[f.by]),
    why: txt(deal?.[f.why]),
    label: reworkReasonLabel(deal?.[f.why]),
    note: txt(deal?.[f.note]),
    count: Number(deal?.[f.count] || 1),
    wasSent: txt(deal?.[f.wasSent]) || null,
  }
}

/** Has this stage EVER been sent back, open or not. For the history line. */
export function reworkCount(deal: any, stage: BackStage): number {
  return Number(deal?.[reworkFields(stage).count] || 0)
}

/** The chip on her day and on the deal. Short, and it names the broker. */
export function reworkChip(r: Rework | null, now: Date = new Date()): string {
  if (!r) return ''
  const who = r.by || 'The broker'
  const when = new Date(r.at)
  const sameDay = !Number.isNaN(when.getTime())
    && when.toDateString() === now.toDateString()
  const at = Number.isNaN(when.getTime()) ? '' : ' ' + when.toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Sydney', hour: 'numeric', minute: '2-digit',
  }).toLowerCase()
  const again = r.count > 1 ? ` (${r.count}${r.count === 2 ? 'nd' : r.count === 3 ? 'rd' : 'th'} time)` : ''
  return sameDay
    ? `REWORK · ${who} sent it back${at}${again}`
    : `REWORK · ${who} sent it back${again}`
}

// ---------------------------------------------------------------------------
// SENDING THE EMAIL AGAIN, WHICH IS A DIFFERENT PROBLEM WITH THE SAME CAUSE
// ---------------------------------------------------------------------------
//
// 27 Oct 2026, Fabio, in the same breath as asking for the rework: "it needs to
// give us the ability of resnding emails to client both BC and LO as right now
// once we mark email sent it locks and we cant resend the email with rewoked
// figures".
//
// The button is green and dead once bc_sent_at is set. A sent date is a fact
// worth showing, so the green stays - but it is a statement, not a lock, and
// there is now a quiet second button beside it. It asks before it goes, because
// a client receiving the same email twice by accident is its own problem.
export function canSendAgain(deal: any, stage: BackStage): boolean {
  return !!deal?.[`${stage}_sent_at`] && !deal?.[AGREED[stage]]
}
