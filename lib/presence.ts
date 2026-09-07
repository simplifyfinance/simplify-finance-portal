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
  // Same tab. What that costs depends on WHICH tab - see tabMerges.
  | { level: 'same-tab'; who: string; tab: string }

export function presenceState(others: Presence[], myTab: string): PresenceState {
  if (others.length === 0) return { level: 'none' }

  const sameTab = others.filter(o => txt(o.tab) === txt(myTab))
  if (sameTab.length > 0) return { level: 'same-tab', who: names(sameTab), tab: txt(myTab) }

  return { level: 'elsewhere', who: names(others), where: whereList(others) }
}

// DOES THIS TAB PUT TWO PEOPLE'S WORK TOGETHER, OR PICK ONE?
//
// Fact Find, Lending options and Compliance hold their record in one piece of
// state, so somebody else's fields can be folded onto a screen being typed into
// without disturbing it - two people on different fields both save, and only the
// same field, changed by both, refuses. See lib/deal-merge.ts.
//
// Everything else cannot. BC holds its record as forty separate pieces of state
// with no single setter, so it refuses instead. Statements has no guard at all.
// The banner has to say which of those two worlds you are in, because the
// difference is "carry on" versus "one of you should stop".
const MERGING_TABS = ['fact find', 'lending options', 'compliance']

export function tabMerges(tab: string): boolean {
  return MERGING_TABS.includes(txt(tab).toLowerCase())
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
  //
  // This used to say "only the first save lands" on every tab. That stopped
  // being true on 5 Sep 2026 for three of them, and a warning that overstates
  // the danger is its own problem - people either stop working together or stop
  // reading the banner.
  const plural = s.who.includes(' and ')
  const text = `${s.who} ${plural ? 'are' : 'is'} on this same tab right now.`
  if (tabMerges(s.tab)) {
    return {
      text,
      detail: 'You can both work. Fill in different fields and both are saved — theirs will appear on your '
            + 'screen as they go. Only if you both change the SAME field will one of you be asked to reload.',
    }
  }
  return {
    text,
    detail: 'On this tab only one of you should type at a time — the second save is refused and that person '
          + 'has to reload and type it again. Worth a message before you both start.',
  }
}
