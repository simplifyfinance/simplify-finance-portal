// TWO PEOPLE IN THE INTERNAL NOTES BOX.
//
// 14 Sep 2026. A robot reproduced this twice: Kylie typed a note, Melissa typed
// one character into the same box on her own screen, and Kylie's note was gone
// from the database - while her screen carried on showing it. She would have
// closed the tab believing it saved.
//
// The four big tab records go through saveGuarded, which merges two people's
// work field by field. Internal notes used to live inside the Fact Find record
// and got all of that for free. When it moved out into its own column on the
// deal it left every bit of it behind: no version check, no merge, no copy kept.
// Last write wins, silently.
//
// This is the merge for it. Notes are not a form - they are lines somebody jots
// while on the phone - so they merge by line rather than by field.
//
// THE RULE, in the words it would be explained in:
//
//   Start from what is on YOUR screen. Add any line the other person wrote that
//   you have not got. Merging never deletes anything.
//
// That last part is deliberate. A merge that removes a line because the other
// person's copy did not have it would be the same silent loss in a new costume.
// Deleting a note stays something a person does on purpose, on their own screen.

export type NotesMerge = {
  text: string
  // The other person's lines that were added, so the screen can say what
  // appeared rather than changing under somebody with no explanation.
  broughtIn: string[]
}

const lines = (v: any) => String(v ?? '').split('\n')
const key = (l: string) => l.trim().toLowerCase()

export function mergeNotes(base: any, theirs: any, mine: any): NotesMerge {
  const b = String(base ?? ''), t = String(theirs ?? ''), m = String(mine ?? '')

  // Nothing between us, or only one of us changed anything.
  if (t === m) return { text: m, broughtIn: [] }
  if (t === b) return { text: m, broughtIn: [] }
  if (m === b) return { text: t, broughtIn: addedLines(b, t) }

  // Both of us have written. Keep this screen exactly as it is and append
  // whatever they wrote that is not already here - so the caret does not move
  // and nothing anybody typed goes anywhere.
  const known = new Set([...lines(b), ...lines(m)].map(key))
  const theirAdded = lines(t).filter(l => key(l) !== '' && !known.has(key(l)))

  if (theirAdded.length === 0) return { text: m, broughtIn: [] }
  return { text: [m.replace(/\s+$/, ''), ...theirAdded].join('\n'), broughtIn: theirAdded }
}

// Which lines exist in the second that did not in the first. Used for saying
// what came in, never for deciding what to delete.
export function addedLines(before: any, after: any): string[] {
  const had = new Set(lines(before).map(key))
  return lines(after).filter(l => key(l) !== '' && !had.has(key(l)))
}

// Did this save take anything away? Whitespace-only differences do not count.
// A shrinking note is the one kind anybody ever wants back, so it is what
// decides whether a copy is kept before writing.
export function removesAnything(before: any, after: any): boolean {
  const now = new Set(lines(after).map(key))
  return lines(before).some(l => key(l) !== '' && !now.has(key(l)))
}
