// LOOKING AT SOMEBODY ELSE'S TODAY.
//
// 12 Nov 2026. Fabio, building the credit and broker screens: "I cant see
// credit and broker how do I know what it looks like and you didnt messes it
// up." He was approving mock-ups of screens he had no way to open.
//
// And again on the question of who gets it: "the view as I dont want everyone
// to have it just me."
//
// SO THIS IS HIS ACCOUNT, NOT THE ADMIN ROLE. Mark, Kylie, Alan and Catherine
// are admins and none of them get it. An admin seeing every deal is the
// business working; an admin opening a colleague's own morning plan is
// something else, and nobody asked for it.
//
// EVERYTHING IS READ ONLY, and that is not a detail. The three presses on a
// credit officer's Today are an answer she gives management about her own day.
// Pressing one as her would file a plan she never agreed to. The buttons are
// dead on purpose - see components/TodayPlan.tsx.
//
// AND SHE IS NOT TOLD. No notice, no red mark, nothing on her screen. Fabio is
// checking that a page he designed came out right, not standing behind anyone.

/** The only people who may look. A list, so adding one is deliberate. */
export const MAY_VIEW_AS = [
  'fabio@simplifyfinance.com.au',
] as const

/**
 * MAY THIS PERSON LOOK AT SOMEBODY ELSE'S DAY?
 *
 * By address, not by role. Compared lowercase and trimmed, because an address
 * typed with a capital letter is the same person and a feature that turns
 * itself off over a stray space is worse than no feature.
 */
export function mayViewAs(email: any): boolean {
  const who = String(email ?? '').trim().toLowerCase()
  if (!who) return false
  return (MAY_VIEW_AS as readonly string[]).includes(who)
}

/**
 * WHOSE DAY IS BEING LOOKED AT, from the address bar.
 *
 * Null means their own, which is the normal case and the one that must never
 * cost anything. A value that is not a plain id is read as null rather than
 * passed to the database - an id arrives from a dropdown we drew, so anything
 * else is somebody experimenting with the URL.
 */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function lookingAt(raw: any, canLook: boolean): string | null {
  if (!canLook) return null
  const id = String(raw ?? '').trim()
  if (!id || !ID.test(id)) return null
  return id
}

/** Looking at your own day is not "viewing as", however the URL is written. */
export function isSomebodyElse(target: string | null, meId: any): boolean {
  if (!target) return false
  return target !== String(meId ?? '')
}

export type Seat = 'credit' | 'broker' | 'admin' | 'staff'

export type Somebody = {
  id: string
  name: string
  seat: Seat
  /** The heading they are listed under in the picker. */
  group: string
}

export const SEAT_WORD: Record<Seat, string> = {
  credit: 'credit',
  broker: 'broker',
  admin: 'admin',
  staff: 'staff',
}

/**
 * THE PICKER, GROUPED THE WAY THE BUSINESS IS.
 *
 * Credit first because that is the screen that changes most, then the brokers,
 * then everyone else. Within a group, by name, so the list does not reshuffle
 * itself as people's workloads move.
 */
export function grouped(people: Somebody[]): Array<{ group: string; people: Somebody[] }> {
  const order: string[] = []
  const by = new Map<string, Somebody[]>()
  for (const p of people) {
    if (!by.has(p.group)) { by.set(p.group, []); order.push(p.group) }
    by.get(p.group)!.push(p)
  }
  return order.map(group => ({
    group,
    people: by.get(group)!.slice().sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

/** The sentence on the black strip. Says who, and says nothing saves. */
export function viewingLine(who: Somebody | null): string {
  if (!who) return ''
  return `${who.name} — ${SEAT_WORD[who.seat]}. This is their Today exactly as they see it. `
    + 'Nothing here saves, and they are not told you looked.'
}
