// WHO ELSE IS IN THIS DEAL CARD.
//
// The save guard stops two people overwriting each other. It does not stop the
// surprise - you still find out only at the moment your work will not save. This
// says so up front. Fabio, 4 Sep 2026: "I don't wanna lock it to the point that
// they can't edit, but it will say."
//
// NOTHING IS EVER LOCKED. Every field stays editable in every state below. The
// only thing that ever refuses is the save guard, and only at the moment data
// would actually be lost.
//
// THE TAB IS THE POINT. Each tab writes its own jsonb column - bc_data,
// fact_find_data, lo_data, compliance_data - so two people on DIFFERENT tabs
// cannot touch each other's work. Saying "Katie is in this deal" makes you
// wonder; saying "Katie is on Fact Find" answers it, and usually the answer is
// that the two of you are fine.

export type Presence = {
  userId: string
  name: string
  tab: string
  lastSeen: string
}

// A heartbeat older than this is somebody who closed the tab. Three missed
// beats at twenty seconds, so a slow network does not make people flicker in
// and out of the banner.
export const STALE_AFTER_MS = 60_000
export const HEARTBEAT_MS = 20_000

const txt = (v: any) => String(v ?? '').trim()

export function stillHere(rows: Presence[] | null | undefined, meId: string, now = Date.now()): Presence[] {
  return (rows || [])
    .filter(r => txt(r?.userId) && txt(r.userId) !== txt(meId))
    .filter(r => {
      const t = Date.parse(txt(r?.lastSeen))
      return Number.isFinite(t) && now - t < STALE_AFTER_MS
    })
    // Newest heartbeat first, so the most recently active person reads first.
    .sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen))
}

export type PresenceState =
  | { level: 'none' }
  // Elsewhere in the deal. Different column, nobody in anybody's way.
  | { level: 'elsewhere'; who: string; where: string }
  // The case that costs an afternoon.
  | { level: 'same-tab'; who: string }

export function presenceState(others: Presence[], myTab: string): PresenceState {
  if (others.length === 0) return { level: 'none' }

  const sameTab = others.filter(o => txt(o.tab) === txt(myTab))
  if (sameTab.length > 0) return { level: 'same-tab', who: names(sameTab) }

  return { level: 'elsewhere', who: names(others), where: whereList(others) }
}

function names(rows: Presence[]): string {
  const list = [...new Set(rows.map(r => txt(r.name)).filter(Boolean))]
  if (list.length === 0) return 'Somebody else'
  if (list.length === 1) return list[0]
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]
}

function whereList(rows: Presence[]): string {
  const tabs = [...new Set(rows.map(r => txt(r.tab)).filter(Boolean))]
  if (tabs.length === 0) return 'this deal'
  if (tabs.length === 1) return tabs[0]
  return tabs.slice(0, -1).join(', ') + ' and ' + tabs[tabs.length - 1]
}

// The words. Kept here rather than in the component so they can be tested, and
// so the three states cannot drift into saying different things about the same
// situation.
export function presenceMessage(s: PresenceState): { text: string; detail?: string } | null {
  if (s.level === 'none') return null
  if (s.level === 'elsewhere') {
    return { text: `${s.who} ${s.who.includes(' and ') ? 'are' : 'is'} also in this deal, on ${s.where}.` }
  }
  // Says what will HAPPEN, not that something might. A warning that says "be
  // careful" is one people stop reading by the second week.
  const plural = s.who.includes(' and ')
  return {
    text: `${s.who} ${plural ? 'are' : 'is'} on this same tab right now.`,
    detail: 'You can both type, but only the first save lands — the other person will be told to reload '
          + 'and will lose what they typed. Worth a message before you both start filling things in.',
  }
}
