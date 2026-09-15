// THE BOX SOMEBODY IS TYPING IN BELONGS TO THEM.
//
// Kylie, 15 Sep 2026, typing broker notes on Jacob Joson: "letters are being
// deleted". Live editing was already off, so nothing was being pushed at her
// screen from anybody. It was her OWN save.
//
// Here is the mechanism, and it is the same one that has bitten three times:
//
//   she types                     the form holds brokerNotes as a piece of
//                                 React state; the textarea's value comes out
//                                 of it on every render
//   700ms after a keystroke       the whole record is read out of the form and
//                                 sent to the database
//   the save comes back merged    applyBcData() runs setBrokerNotes() with the
//                                 copy that was read out 700ms ago
//   React rewrites the textarea   every character typed in that 700ms is gone,
//                                 and the caret jumps to the end
//
// Merging is not the problem - the merge usually awards her the field. The
// problem is that ANY rewrite of that box carries a value from the past.
//
// THE RULE, and there is only one:
//
//   NOTHING EXTERNAL MAY WRITE A FIELD THAT IS FOCUSED OR HAS UNSAVED CHANGES.
//
// External means anything that is not this person's own keystroke: a merge, an
// adopt, somebody else's live save. Where the record came from does not matter;
// what matters is that the box is in use.
//
// NOTHING IS LOST BY REFUSING. The record still goes to the database with the
// other person's fields folded in - saveGuarded has already decided that and
// written it. The only thing that does not happen is this screen being rewritten
// underneath somebody's cursor. Their own next save writes what is in the box.

export type Ownership = {
  // The field that currently has the cursor in it, if any.
  focused: string | null
  // Fields changed on screen since the last save that included them.
  dirty: Set<string>
  // What this screen last saw saved in each box. The last write on the way out
  // carries it, so the server can refuse to overwrite anybody else's words.
  // See lib/keepalive-patch.ts.
  lastSaved: Record<string, any>
}

// The boxes this rule covers on the BC tab. Free text only: a figure is typed
// and left, a sentence is typed over minutes, and it is the sentence that gets
// destroyed. Widening this is a decision, not a tidy-up - every field added
// here is a field that stops showing somebody else's work while it is in use.
export const OWNED_FIELDS = ['brokerNotes', 'templateNotes', 'internalNotes'] as const

export function newOwnership(): Ownership {
  return { focused: null, dirty: new Set(), lastSaved: {} }
}

// A value this screen has seen reach the database.
export function noteSaved(o: Ownership, field: string, value: any): void {
  o.lastSaved[field] = value
}

export function focusField(o: Ownership, field: string): void {
  o.focused = field
}

// Only clears the focus if it is still this field's. Two blurs arriving out of
// order must not take the focus off the box somebody has just moved into.
export function blurField(o: Ownership, field: string): void {
  if (o.focused === field) o.focused = null
}

export function markDirty(o: Ownership, field: string): void {
  o.dirty.add(field)
}

// The save that carried this field's value has landed. Anything typed after
// this marks it dirty again, which is why the caller must only call this for
// the value it actually wrote.
export function markSaved(o: Ownership, field: string): void {
  o.dirty.delete(field)
}

export function mayWrite(o: Ownership, field: string): boolean {
  return o.focused !== field && !o.dirty.has(field)
}

// Every field this rule protects, whether somebody is in it or has left
// something unsaved in it.
export function busyFields(o: Ownership): string[] {
  const out = new Set(o.dirty)
  if (o.focused) out.add(o.focused)
  return [...out]
}

const isRecord = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v)

// A field is named by its path through the record:
//
//   "goals2Years"                      a box at the top of the record
//   "productReqs.otherRequirements"    one that lives a level down
//   "assets#as1.ownership"             the ownership ticks on ONE asset
//   "properties#p1.loans#l1.balance"   a row inside a row
//
// A ROW IS NAMED BY ITS ID, NEVER BY ITS POSITION. Somebody adding or removing
// a row above yours must not change which tick is protected - and the ids are
// already there, because that is how the three way merge decides what "the same
// row" means. See keyedById in lib/deal-merge.ts.
//
// Added 15 Sep 2026 for the fault Kylie reported with Melissa in the same deal:
// "If I tick the box after a few seconds - it unticks it. If I remove a data -
// it goes back." The fact find is mostly ticks, and every one of them lives
// inside a list.
const parts = (field: string) => field.split('.')

// "assets#as1" is one step: the list called assets, and the row in it whose id
// is as1.
function splitSegment(k: string): { key: string; id: string | null } {
  const at = k.indexOf('#')
  return at < 0 ? { key: k, id: null } : { key: k.slice(0, at), id: k.slice(at + 1) }
}

function step(at: any, k: string): any {
  const { key, id } = splitSegment(k)
  if (!isRecord(at)) return undefined
  const here = at[key]
  if (id === null) return here
  if (!Array.isArray(here)) return undefined
  return here.find(r => isRecord(r) && String(r.id) === id)
}

export function readPath(obj: any, field: string): any {
  let at = obj
  for (const k of parts(field)) {
    at = step(at, k)
    if (at === undefined) return undefined
  }
  return at
}

// Copies only the objects along the path, so nothing else in the record is
// touched and React still sees a new object where it needs to.
//
// Exported because lib/keepalive-patch.ts needs exactly this and a second copy
// of it is how a fix stops being a fix. See lib/no-duplicate-logic.test.ts,
// which caught the second copy on 15 Sep 2026 before it shipped.
export function writePath(obj: any, field: string, value: any): any {
  const [head, ...rest] = parts(field)
  const { key, id } = splitSegment(head)
  const base: any = isRecord(obj) ? { ...obj } : {}

  // A plain key.
  if (id === null) {
    base[key] = rest.length === 0 ? value : writePath(base[key], rest.join('.'), value)
    return base
  }

  // A row in a list, found by its id. The list is copied, that row is replaced,
  // and every other row - including any the other person has just added - is
  // left exactly where it was.
  const list = base[key]
  if (!Array.isArray(list)) return obj
  const at = list.findIndex((r: any) => isRecord(r) && String(r.id) === id)
  // They deleted the row. Nothing to put back - and putting it back would be
  // undoing their delete rather than protecting a tick.
  if (at < 0) return obj
  const copy = [...list]
  copy[at] = rest.length === 0 ? value : writePath(copy[at], rest.join('.'), value)
  base[key] = copy
  return base
}

// PUT A WHOLE RECORD ON SCREEN WITHOUT DISTURBING THE BOXES IN USE.
//
// The Fact Find, Lending options and Compliance tabs hold everything in ONE
// object and replace it wholesale - setD(record) - so they cannot go field by
// field through setters the way the BC tab does. This hands back the incoming
// record with every busy field's ON-SCREEN value put back into it, so setD is
// safe to call.
export function keepOwned(incoming: any, onScreen: any, o: Ownership): any {
  if (!isRecord(incoming)) return incoming
  let out = incoming
  for (const field of busyFields(o)) {
    const mine = readPath(onScreen, field)
    if (mine === undefined) continue
    if (JSON.stringify(readPath(out, field)) === JSON.stringify(mine)) continue
    out = writePath(out, field, mine)
  }
  return out
}

// A SAVE HAS LANDED. Any box whose saved value is still exactly what is on
// screen is no longer unsaved. Compared against the screen as it is NOW, not as
// it was when the save was built, so anything typed while it was in flight
// keeps that box protected.
export function settleSaved(o: Ownership, saved: any, onScreen: any): void {
  for (const field of busyFields(o)) {
    const wrote = readPath(saved, field)
    if (wrote !== undefined) noteSaved(o, field, wrote)
    if (JSON.stringify(wrote) === JSON.stringify(readPath(onScreen, field))) markSaved(o, field)
  }
}

// Used by the last write on the way out - see lib/keepalive-patch.ts.
export const readField = readPath

// Put a record on screen, going around the boxes that are in use. Returns the
// fields it held back so the screen can say so if it wants to.
export function applyOwned(
  incoming: any,
  setters: Record<string, (v: any) => void>,
  o: Ownership,
): string[] {
  if (!isRecord(incoming)) return []
  const held: string[] = []
  for (const [key, set] of Object.entries(setters)) {
    // Only the boxes the record actually carries. A record saved before a field
    // existed must not blank that field out on the person merging.
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue
    if (!mayWrite(o, key)) { held.push(key); continue }
    set(incoming[key])
  }
  return held
}
