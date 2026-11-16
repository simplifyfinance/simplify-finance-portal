// A DAY SAID AT 8:36 IS NOT A DAY THAT CANNOT CHANGE.
//
// 18 Nov 2026. Catherine, on Mellissa's screen: "She has ticked them but they
// aren't automatically saving when she leaves the screen and there is no option
// to save/send."
//
// She was right, and it was not a saving glitch. Her Today showed one of two
// things: a "Yes - this is my day" button BEFORE she had confirmed, and a green
// "Told the brokers - 8:36 am" chip after. Once the chip appeared the button
// was gone and there was no way back to it, so the three files she ticked at
// ten past nine lived on her screen and nowhere else.
//
// The screen was built as though a day is decided once in the morning and never
// moves. A credit assessor's day moves all morning.
//
// SO: THE CHIP STAYS AND THE BUTTON COMES BACK. One rule, in one place, asked
// by both day screens - components/PickTheDay.tsx and components/MyDay.tsx.

const sameList = (a: string[] | null | undefined, b: string[] | null | undefined) => {
  const x = (a || []).map(String), y = (b || []).map(String)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

const sameNotes = (a: any, b: any) => {
  const x = a && typeof a === 'object' ? a : {}
  const y = b && typeof b === 'object' ? b : {}
  const keys = new Set([...Object.keys(x), ...Object.keys(y)])
  for (const k of keys) {
    if (String(x[k] ?? '').trim() !== String(y[k] ?? '').trim()) return false
  }
  return true
}

export type DaySaid = {
  dealIds: string[]
  notes: Record<string, string>
  onItNow: string | null
}

/**
 * HAS ANYTHING MOVED SINCE SHE LAST TOLD THEM?
 *
 * The order counts, because the order IS the plan - first is first. A note
 * counts: "chase CBA at 11" is the day as much as the file is. So does the one
 * she is on now, which the team board reads.
 */
export function dayHasChanged(said: DaySaid | null | undefined, now: DaySaid): boolean {
  if (!said) return false            // nothing told yet - the button is there anyway
  if (!sameList(said.dealIds, now.dealIds)) return true
  if (!sameNotes(said.notes, now.notes)) return true
  return String(said.onItNow ?? '') !== String(now.onItNow ?? '')
}

/** What the button says, so both screens say it the same way. */
export function saveWords(busy: boolean, changed: boolean): string {
  if (busy) return 'Telling them...'
  return changed ? 'Save the change' : 'Yes — this is my day'
}

/** The line under the chip when a day has moved on since it was told. */
export const NOT_SENT = 'Changed since you told them'
