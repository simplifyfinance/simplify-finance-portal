// THREE THINGS TO PRESS, IN ORDER.
//
// 12 Nov 2026. Fabio, on the credit assessor's morning:
//
//   "they press three buttons. Yes, this is my day. Yes, this is what I did
//    yesterday. And then they go to the blue section and say, are we ready to
//    send this... Make it fucking intuitive."
//
// Until today there was ONE button and it did two jobs at once: it saved her
// day and it told everybody. So there was no way to fix a list before it went
// out, and nothing at all confirmed what she had actually finished the day
// before - the portal wrote that list from what moved and nobody ever agreed
// with it.
//
// SO THE THREE ARE SEPARATE, AND THE THIRD IS DEAD UNTIL THE FIRST TWO.
//
//   1  Yesterday      she agrees with what the portal saw, after fixing it
//   2  Today          she picks what she is doing and saves the order
//   3  Inform         it goes to management
//
// AND IT IS MANAGEMENT, NOT THE BROKERS. Fabio, same conversation: "I never
// say tell the brokers, it's inform management." Every word on this screen
// says management now.
//
// WHAT "DID" MEANS. Fabio: "the definition of did is BC, LO, compliance...
// it's not like, hey, I spoke with a BDM." A stage finished, on a named deal.
// Nothing else goes on this list, which is what keeps it comparable from one
// day to the next.

const txt = (v: any) => String(v ?? '').trim()

/** One finished stage, as the portal saw it or as she added it. */
export type Done = {
  id: string
  name: string
  /** 'BC' | 'Lending options' | 'Compliance' - the words already on screen. */
  what: string
  days: number | null
  /** True where she added it herself rather than the portal seeing it move. */
  byHand?: boolean
}

export type Added = { id: string; name: string; what: string }

/**
 * ONE DEAL CAN FINISH TWO STAGES IN A DAY, so a row is keyed by both.
 *
 * Keying on the deal alone would have "Not me" on a BC quietly remove a
 * compliance she did finish.
 */
export function keyOf(id: any, what: any): string {
  return `${txt(id)}|${txt(what)}`
}

/**
 * THE LIST SHE IS LOOKING AT.
 *
 * What the portal saw, less anything she said was not hers, plus anything she
 * added. Her corrections are kept as corrections - they are never written over
 * what the portal recorded, so the two can always be compared later.
 */
export function yesterdayShown(
  found: Done[], added: Added[] = [], removed: string[] = [],
): Done[] {
  const gone = new Set((removed || []).map(txt))
  const out = (found || []).filter(d => !gone.has(keyOf(d.id, d.what)))
  for (const a of added || []) {
    if (!txt(a?.id) || !txt(a?.what)) continue
    // Already there because the portal has since seen it move. Hers is the
    // duplicate, and the portal's row carries the real elapsed days.
    if (out.some(d => keyOf(d.id, d.what) === keyOf(a.id, a.what))) continue
    out.push({ id: txt(a.id), name: txt(a.name), what: txt(a.what), days: null, byHand: true })
  }
  return out
}

/** Press "Not me" - or press it again to put the row back. */
export function toggleRemoved(removed: string[], id: any, what: any): string[] {
  const k = keyOf(id, what)
  const list = (removed || []).map(txt)
  return list.includes(k) ? list.filter(x => x !== k) : [...list, k]
}

/** Add one, ignoring a second press on something already on the list. */
export function withAdded(added: Added[], row: Added): Added[] {
  const list = added || []
  if (!txt(row?.id) || !txt(row?.what)) return list
  if (list.some(a => keyOf(a.id, a.what) === keyOf(row.id, row.what))) return list
  return [...list, { id: txt(row.id), name: txt(row.name), what: txt(row.what) }]
}

export function withoutAdded(added: Added[], id: any, what: any): Added[] {
  const k = keyOf(id, what)
  return (added || []).filter(a => keyOf(a.id, a.what) !== k)
}

/** The three stages a day's work can be. Nothing else is offered. */
export const STAGES_DONE = ['BC', 'Lending options', 'Compliance'] as const

// --- where she is up to -------------------------------------------------------

export type Where = {
  /** She has agreed what she did yesterday. */
  yesterday: boolean
  /** She has saved a day - even an empty one, which is a real answer. */
  today: boolean
  /** Both done, so the third button works. */
  ready: boolean
  /** Already sent. */
  sent: boolean
  /** What the button should say right now. */
  label: string
}

/**
 * WHAT THE THIRD BUTTON SAYS, AND WHETHER IT WORKS.
 *
 * It never invites a press it would refuse. A button that says "Inform
 * management" and then does nothing teaches people the screen is broken; one
 * that says "Nothing has been sent yet" is telling the truth about the state
 * of the morning.
 */
export function whereSheIsUpTo(plan: {
  yesterdayOkAt?: any; daySavedAt?: any; sentAt?: any
}): Where {
  const yesterday = !!txt(plan?.yesterdayOkAt)
  const today = !!txt(plan?.daySavedAt)
  const sent = !!txt(plan?.sentAt)
  const ready = yesterday && today
  return {
    yesterday, today, ready, sent,
    label: sent ? 'Sent to management'
      : ready ? 'Inform management'
      : 'Nothing has been sent yet',
  }
}

/** What is still owed, in words, for the step list on the right. */
export function stillOwed(w: Where): string[] {
  const out: string[] = []
  if (!w.yesterday) out.push('What you did yesterday')
  if (!w.today) out.push('What you are doing today')
  return out
}
