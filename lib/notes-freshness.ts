// WERE THESE NOTES WRITTEN FROM THIS DEAL, OR AN EARLIER ONE?
//
// The compliance notes are not built when you look at them. They are written
// once, by the model, from the deal as it stood that minute, and the text is
// saved onto the deal. Everything downstream - the CRM fields, the compliance
// PDF, the credit assessor - reads that saved text back.
//
// So changing the recommended lender, the loan amount, or a split's purpose
// updates every figure on the screen and leaves nine paragraphs of prose
// describing a deal that no longer exists. On a regulated document that is
// worse than a blank field: a blank field is obviously unfinished, and a
// confident paragraph naming the wrong lender is not.
//
// Same answer as the client email, for the same reason. Do NOT quietly
// regenerate: prose that has been read and approved must not rewrite itself
// behind somebody's back, and half of these notes get edited by hand
// afterwards. Record what each note was written from, and say plainly when the
// deal has moved on - naming what moved, because "something changed" sends
// somebody hunting through nine fields.

// The handful of facts that, if they change, make the prose wrong. Not every
// fact - a dependant count moving from 2 to 3 does not invalidate a paragraph
// about security. These are the ones the notes are built around and name out
// loud.
export type NoteFacts = {
  // Everything the notes were written from, in one fingerprint. Catches the
  // changes the headline fields below do not.
  hash: string
  lender: string
  loanAmount: string
  purpose: string
  fundsToComplete: string
  approval: string
  product: string
}

export type NoteStamp = {
  confidence?: string
  source?: string
  // When it was written, and what from. Absent on every note generated before
  // this existed - see 'unknown'.
  at?: string
  facts?: NoteFacts
}

export type NoteFreshness =
  // Nothing written yet.
  | { state: 'none' }
  // No stamp at all, so a person typed it. Their words, their business - it is
  // never called stale.
  | { state: 'typed' }
  | { state: 'fresh'; at?: string }
  // Generated before notes were stamped. We do not know whether it matches, so
  // it is kept as its own answer rather than folded into a guess, and nothing
  // is shown for it. It resolves the first time that field is regenerated.
  | { state: 'unknown'; at?: string }
  // The deal has moved. `changes` names what, in plain words.
  | { state: 'stale'; at?: string; changes: string[] }

const txt = (v: any) => String(v ?? '').trim()

// A stable fingerprint of the whole facts block. Not cryptography - this only
// has to notice a change, and it has to give the same answer on every machine
// and every deploy, which is why it is written out rather than pulled from a
// library whose output could change under us.
export function fingerprint(s: string): string {
  let h = 5381
  const text = String(s ?? '')
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function noteFacts(headline: Omit<NoteFacts, 'hash'>, factsBlock: string): NoteFacts {
  return { ...headline, hash: fingerprint(factsBlock) }
}

const LABEL: Record<keyof Omit<NoteFacts, 'hash'>, string> = {
  lender: 'the lender',
  loanAmount: 'the loan amount',
  purpose: 'the loan purpose',
  fundsToComplete: 'the funds to complete',
  approval: 'the approval type',
  product: 'the product',
}

// What moved, said the way a person would say it. A value that was blank and is
// now filled reads as "recorded", not "changed from  to X".
export function changesSince(was: NoteFacts | undefined, now: NoteFacts): string[] {
  if (!was) return []
  const out: string[] = []
  for (const key of Object.keys(LABEL) as (keyof typeof LABEL)[]) {
    const before = txt(was[key]), after = txt(now[key])
    if (before === after) continue
    if (!before) out.push(`${LABEL[key]} was not recorded, and is now ${after}`)
    else if (!after) out.push(`${LABEL[key]} was ${before}, and is now blank`)
    else out.push(`${LABEL[key]} changed from ${before} to ${after}`)
  }
  // Something moved that the headline fields do not cover - an income, a
  // liability, a security. Worth saying, without pretending to know what.
  if (out.length === 0 && was.hash !== now.hash) {
    out.push('something in the fact find changed after this was written')
  }
  return out
}

export function noteFreshness(text: string | null | undefined,
                              stamp: NoteStamp | null | undefined,
                              now: NoteFacts): NoteFreshness {
  if (!txt(text)) return { state: 'none' }
  if (!stamp) return { state: 'typed' }
  if (!stamp.facts) return { state: 'unknown', at: stamp.at }

  const changes = changesSince(stamp.facts, now)
  return changes.length === 0
    ? { state: 'fresh', at: stamp.at }
    : { state: 'stale', at: stamp.at, changes }
}

// Every note on the deal, in one answer, for the strip at the top of the tab.
export type NotesReview = {
  staleFields: string[]
  // Deduplicated across fields - nine notes written in the same batch all moved
  // for the same reason, and listing it nine times is noise.
  changes: string[]
  writtenAt?: string
}

export function reviewNotes(
  fields: { field: string; text?: string | null }[],
  stamps: Record<string, NoteStamp> | null | undefined,
  now: NoteFacts,
): NotesReview {
  const staleFields: string[] = []
  const changes: string[] = []
  let writtenAt: string | undefined

  for (const { field, text } of fields || []) {
    const f = noteFreshness(text, stamps?.[field], now)
    if (f.state !== 'stale') continue
    staleFields.push(field)
    if (f.at && (!writtenAt || f.at < writtenAt)) writtenAt = f.at
    for (const c of f.changes) if (!changes.includes(c)) changes.push(c)
  }
  return { staleFields, changes, writtenAt }
}
