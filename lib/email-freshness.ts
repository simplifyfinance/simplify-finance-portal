// IS THE SAVED EMAIL STILL THE RIGHT EMAIL?
//
// The client email is not built when you look at it. It is built once, when
// somebody presses "Generate email", and the finished HTML is saved onto the
// deal. The preview, "Copy to Outlook" and "Send to client" all read that saved
// copy back.
//
// So changing the scenario - investment purchase to first home buyer, say -
// updates every field on the form and leaves the saved email exactly as it was,
// written for a scenario the deal is no longer on. Nothing said so out loud.
// Fabio, 3 Sep 2026: "when we push it to the HTML, the HTML is still stuck on
// the original template".
//
// The fix is not to quietly regenerate. An email that has already been read and
// approved should not rewrite itself behind somebody's back. The fix is to
// record which scenario each saved email was written for, and to say plainly
// when that stops matching.

export type SavedEmail = {
  emailHtml?: string | null
  // The scenario the saved HTML was generated for. Written at generate time.
  emailHtmlTemplate?: string | null
}

export type EmailFreshness =
  // Nothing saved yet, or it matches the scenario the deal is on.
  | { state: 'fresh' }
  // Saved for a different scenario. This is the bug, caught.
  | { state: 'stale'; wasFor: string; nowOn: string }
  // Saved before the portal recorded the scenario. We genuinely do not know
  // whether it matches, so we say that rather than guessing either way - a
  // false alarm on every old deal is as useless as no alarm at all.
  | { state: 'unknown'; nowOn: string }

export function emailFreshness(saved: SavedEmail | null | undefined, template: string): EmailFreshness {
  const html = saved?.emailHtml
  if (!html || !String(html).trim()) return { state: 'fresh' }

  const wasFor = saved?.emailHtmlTemplate
  if (!wasFor) return { state: 'unknown', nowOn: template }

  return wasFor === template
    ? { state: 'fresh' }
    : { state: 'stale', wasFor, nowOn: template }
}

// Sending is blocked only on a KNOWN mismatch. An unknown stamp is every deal
// generated before today, and locking those would break work in flight over a
// thing we are not sure about.
export function blocksSending(f: EmailFreshness): boolean {
  return f.state === 'stale'
}

// THE NOTES THAT COME WITH A SCENARIO.
//
// "Important things to note" is filled in from the scenario when it is picked -
// for an investment, the line about assuming a 4% rental yield. It was then
// never touched again, on the reasoning that overwriting a broker's writing is
// worse than leaving stale wording. Both are bad; the way out is to tell them
// apart. If the notes are still word for word what the old scenario put there,
// nobody has written anything and they can be swapped. One character of the
// broker's own and they are left alone.
export function notesAreUntouched(current: string | null | undefined, previousDefaults: string[]): boolean {
  return normaliseNotes(current) === normaliseNotes((previousDefaults || []).join('\n'))
}

function normaliseNotes(s: string | null | undefined): string {
  return String(s ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

// What the notes should become when the scenario changes. Returns the current
// notes unchanged whenever the broker has written anything of their own.
export function notesAfterScenarioChange(
  current: string | null | undefined,
  previousDefaults: string[],
  nextDefaults: string[],
): string {
  if (!notesAreUntouched(current, previousDefaults)) return String(current ?? '')
  return (nextDefaults || []).join('\n')
}
