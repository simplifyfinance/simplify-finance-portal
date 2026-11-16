// WHAT THE CREDIT BAR SAYS, AND WHERE EVERY NUMBER ON IT COMES FROM.
//
// 18 Nov 2026. Fabio, looking at his Today beside Catherine's: "the whole point
// of today for admin which is me Kylie Mark Alan and Catherine was so we can see
// credits queue and reallocate... WHY I dont have Mellissa and Katies work load
// now that they completed."
//
// It was there. It was behind a button, in a 316px column, and it cut the names
// off. So the queue comes out of the rail and gets its own bar, and this file is
// the bar's arithmetic - nothing is counted in the component.
//
// NOTHING NEW IS MEASURED. Every figure here is a sum of what the dashboard page
// already hands the credit panel, so this bar cannot disagree with the rail
// above it or with the assessor's own Today.

export type CreditPerson = {
  id: string
  name: string
  /** When she told management her day, or null if she has not. */
  informedAt?: string | null
  /** How many she ticked off yesterday. */
  yesterdayCount?: number
  /** How many are on her day today. */
  todayCount?: number
  /** Her open files, whether or not they are on her day. */
  open?: number
}

export type CreditMorning = {
  sent: number
  team: number
  onToday: number
  doneYesterday: number
  openTotal: number
  /** Open files on nobody's day. The ones that go a whole day untouched. */
  unwatched: number
}

export function creditMorning(team: CreditPerson[]): CreditMorning {
  const n = (v: any) => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0)
  const onToday = team.reduce((a, t) => a + n(t.todayCount), 0)
  const openTotal = team.reduce((a, t) => a + n(t.open), 0)
  return {
    sent: team.filter(t => !!t.informedAt).length,
    team: team.length,
    onToday,
    doneYesterday: team.reduce((a, t) => a + n(t.yesterdayCount), 0),
    openTotal,
    // A FILE CAN ONLY BE ON ONE DAY. Her plan is drawn from her own open files,
    // so the two subtract. Floored, because a plan can outlive the file leaving
    // her - the answer is then "none unwatched", never a negative.
    unwatched: Math.max(0, openTotal - onToday),
  }
}

/** The other assessors a file can be moved to. Empty when she is the only one. */
export function othersFor(team: CreditPerson[], id: string) {
  return team.filter(t => t.id && t.id !== id).map(t => ({ id: t.id, name: t.name }))
}

/** "Move to Mellissa" - her first name, because the row is already cramped. */
export function moveWords(name: string) {
  return `Move to ${String(name || '').trim().split(/\s+/)[0] || 'the other one'}`
}
