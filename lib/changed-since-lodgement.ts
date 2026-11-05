// WHAT CHANGED AFTER THE DEAL WENT TO THE LENDER.
//
// 17 Aug 2026. Ellie, on a deal already lodged: the client moved house during
// the application, and the current address on the fact find is the old one.
//
// The fact find is read only past lodgement and has to stay that way - it is
// the record of what was submitted, and a file that cannot show what the
// lender was told is not a file. Fabio, 1 Sep 2026: "once the deal is sitting
// in lodged forwards ... those tabs at the bottom are read only."
//
// So the team were doing the only thing the portal offered: unlocking the deal
// and typing over the lodged answer. Which loses the submitted record, and
// does it quietly. Fabio: "I don't want it to be a mess of people unlocking
// things and changing names and numbers and addresses."
//
// THE CHANGE GOES BESIDE THE ANSWER, NOT OVER IT.
//
// Nothing here writes to fact_find_data. A change is a row of its own: the
// lodged answer, what it is now, who said so and when. Both are then on the
// screen, and anyone opening the file next week can see that the client is not
// where the application says they are.
//
// AND IT HAS SOMEWHERE TO GO, TWICE.
//
//   1. Straight away, as a Needs action alert to tell the lender. That is the
//      part with a deadline on it - a bank that finds out from somebody else is
//      a problem this week, not at settlement.
//   2. At settlement, in the question the portal already asks about updating
//      the client's record. Fabio: "maybe my staff is going to forget". They
//      are not asked to remember; they are shown it, ticked.
//
// NOBODY APPROVES IT. Fabio, asked directly: record who made the change, do
// not make it wait on a second person. The entry carries the name and the date
// and goes on the file notes, which is what a file note is for. A signature
// would mean a client's new address sitting unrecorded until somebody who is
// not in the room gets to it.

const txt = (v: any) => String(v ?? '').trim()

// --- which answers can change ----------------------------------------------

// ONLY THE FACT FIND, AND ONLY WHAT ACTUALLY MOVES MID-DEAL.
//
// Fabio: "Let's stick to fact find field for now." Not every box on the file -
// a list of forty is a dropdown nobody reads to the end of, and an income or a
// liability that changes after lodgement is not a correction, it is a new
// assessment. These five are the ones a client rings up about.
export type ChangeableField = {
  key: string
  label: string
  // Whether the answer belongs to one applicant or to the deal. Every one of
  // these is per applicant today; the shape is here so a deal-level field can
  // be added without a second kind of record.
  perApplicant: boolean
  // What to say under the box, where the answer is not free text.
  hint?: string
}

export const CHANGEABLE: ChangeableField[] = [
  { key: 'currentAddress', label: 'Current address', perApplicant: true,
    hint: 'The address they live at now. The lodged one stays on the file.' },
  { key: 'mobile', label: 'Mobile', perApplicant: true },
  { key: 'email', label: 'Email', perApplicant: true },
  { key: 'employer', label: 'Employer', perApplicant: true,
    hint: 'A change of job after lodgement almost always needs the lender told.' },
  { key: 'maritalStatus', label: 'Marital status', perApplicant: true },
]

export function fieldLabel(key: unknown): string {
  return CHANGEABLE.find(f => f.key === txt(key))?.label || txt(key)
}

export function isChangeable(key: unknown): boolean {
  return CHANGEABLE.some(f => f.key === txt(key))
}

// WHAT THE LODGED FACT FIND SAYS TODAY.
//
// One copy, so the box that records a change and the line that shows it cannot
// read the same answer out of two different places. The names are the fact
// find's own - phoneMobile, emailPersonal, relationshipStatus - and they live
// here rather than being typed again in a component.
export function lodgedAnswer(applicant: any, field: unknown): string {
  const a = applicant || {}
  switch (txt(field)) {
    case 'currentAddress': {
      const list = Array.isArray(a.addresses) ? a.addresses : []
      // isCurrent, not addresses[0]. The list is in the order somebody typed
      // it, and a previous address added afterwards sits wherever it landed.
      const here = list.find((x: any) => x?.isCurrent) || list[0]
      return txt(here?.address)
    }
    case 'mobile': return txt(a.phoneMobile)
    case 'email': return txt(a.emailPersonal)
    case 'employer': {
      const jobs = Array.isArray(a.employment) ? a.employment : []
      return txt(jobs.find((j: any) => txt(j?.employerName))?.employerName)
    }
    case 'maritalStatus': return txt(a.relationshipStatus)
    default: return ''
  }
}

/** "Mai Chen", off the fact find's own two boxes. */
export function nameOf(applicant: any): string {
  return [txt(applicant?.firstName), txt(applicant?.lastName)].filter(Boolean).join(' ')
}

// --- the record -------------------------------------------------------------

export type Change = {
  id: string
  field: string
  label: string
  applicantId: string
  applicantName: string
  // The lodged answer, copied at the moment the change is recorded. Copied, not
  // looked up later: the point of this record is to say what the lender was
  // told, and a lookup would follow the fact find if the deal is ever unlocked
  // and edited - which would quietly rewrite history.
  was: string
  now: string
  note: string
  byName: string
  byId: string | null
  at: string
  // Set when it is carried onto the client's record at settlement. A change
  // already applied is not offered again.
  appliedAt?: string | null
  // Set instead of deleting. A change recorded in error is part of the file
  // too, and a row that vanishes is a row nobody can ask about.
  undoneAt?: string | null
  undoneBy?: string | null
}

export function changesOn(deal: any): Change[] {
  const raw = deal?.changes_since_lodgement
  return Array.isArray(raw) ? raw.filter(c => c && txt(c.id)) : []
}

/** The ones that still count - not undone. */
export function liveChanges(deal: any): Change[] {
  return changesOn(deal).filter(c => !txt(c.undoneAt))
}

/** Recorded, not yet carried onto the client's record. */
export function notYetApplied(deal: any): Change[] {
  return liveChanges(deal).filter(c => !txt(c.appliedAt))
}

/** The current answer for a field, where one has been recorded. */
export function changeFor(deal: any, field: string, applicantId: string): Change | null {
  const want = txt(field), who = txt(applicantId)
  // The latest one wins: a client who moves twice has two rows on the file and
  // one current address.
  const all = liveChanges(deal)
    .filter(c => txt(c.field) === want && txt(c.applicantId) === who)
  return all.length ? all[all.length - 1] : null
}

// --- making one --------------------------------------------------------------

export type NewChange = {
  field: string
  applicantId: string
  applicantName: string
  was: string
  now: string
  note?: string
}

/**
 * The entry to append, or null where there is nothing to record.
 *
 * Nothing to record means: no new answer, a field this does not cover, or a
 * new answer that is word for word the old one. The last of those is not an
 * error to show somebody - it is somebody confirming the file is already right.
 */
export function buildChange(c: NewChange, by: { id: string | null; name: string },
                            now: Date = new Date()): Change | null {
  const field = txt(c.field)
  const value = txt(c.now)
  if (!isChangeable(field) || !value) return null
  if (value === txt(c.was)) return null
  return {
    id: `${field}-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    field,
    label: fieldLabel(field),
    applicantId: txt(c.applicantId),
    applicantName: txt(c.applicantName),
    was: txt(c.was),
    now: value,
    note: txt(c.note),
    byName: txt(by?.name) || 'Unknown',
    byId: by?.id || null,
    at: now.toISOString(),
    appliedAt: null,
    undoneAt: null,
  }
}

/** The list to write back, with the new entry on the end. */
export function withChange(deal: any, entry: Change): Change[] {
  return [...changesOn(deal), entry]
}

/** The list to write back, with one entry marked. */
export function marked(deal: any, id: string,
                       patch: Partial<Change>): Change[] {
  const want = txt(id)
  return changesOn(deal).map(c => txt(c.id) === want ? { ...c, ...patch } : c)
}

// --- what it says -------------------------------------------------------------

// THE FILE NOTE. Written the moment the change is recorded, because the note
// log is the thing somebody reads in six months when a regulator asks why the
// client's address is not the one on the application.
export function noteFor(c: Change): string {
  const who = c.applicantName ? `${c.applicantName}: ` : ''
  const was = c.was ? ` Was ${c.was}.` : ''
  const note = c.note ? ` ${c.note}` : ''
  return `${who}${c.label} changed since lodgement. Now ${c.now}.${was}${note}`
}

/** "1 change since lodgement" / "3 changes since lodgement". */
export function changeCountLine(deal: any): string {
  const n = liveChanges(deal).length
  if (n === 0) return ''
  return `${n} change${n === 1 ? '' : 's'} since lodgement`
}

// THE CHASE IS AN ALERT, NOT A SECOND LIST.
//
// Needs action already exists, already shows as a red chip on the pipeline
// without the deal being opened, and already has a Resolve button and an owner
// and a due date. A change that the lender has to be told about is exactly
// that, so it becomes one rather than growing its own half of the same thing
// somewhere else on the screen.
//
// Which also answers "told, by whom, when" for free: resolving an alert
// records the name and the time. See components/DealFile.tsx.
export function alertFor(c: Change, lenderName?: string): string {
  const lender = txt(lenderName) || 'the lender'
  return `Tell ${lender} the ${c.label.toLowerCase()} changed`
}

// "Recorded by Ellie Nguyen, 17 Aug" - one copy, so the file note, the field
// and the settlement question cannot word it three ways.
export function recordedBy(c: Change, tz = 'Australia/Sydney'): string {
  let when = ''
  try {
    when = new Intl.DateTimeFormat('en-AU',
      { timeZone: tz, day: 'numeric', month: 'short' }).format(new Date(c.at))
  } catch { when = '' }
  return `Recorded by ${c.byName}${when ? ', ' + when : ''}`
}

// --- carrying it onto the client ---------------------------------------------

// WHICH COLUMN ON THE CLIENT RECORD EACH ONE LANDS IN.
//
// Written down once, here, rather than in the settlement box - so a field
// added to CHANGEABLE above cannot quietly become a tick that does nothing.
// The two lists are checked against each other in the tests.
const COLUMN: Record<string, string> = {
  currentAddress: 'address',
  mobile: 'phone',
  email: 'email',
  employer: 'employer',
  maritalStatus: 'marital_status',
}

export function columnFor(field: unknown): string {
  return COLUMN[txt(field)] || ''
}

/**
 * The patch to write to one client, built from the changes chosen at
 * settlement. Later changes win, which is right: a client who moved twice
 * lands at the second address.
 */
export function clientPatchFor(changes: Change[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of changes || []) {
    const col = columnFor(c?.field)
    if (col && txt(c?.now)) out[col] = txt(c.now)
  }
  return out
}

/** The changes on this deal belonging to one applicant, still to be applied. */
export function pendingFor(deal: any, applicantId: string): Change[] {
  const who = txt(applicantId)
  return notYetApplied(deal).filter(c => txt(c.applicantId) === who)
}
