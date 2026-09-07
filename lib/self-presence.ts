// YOU, TWICE.
//
// deal_presence has one row per PERSON per deal, so it cannot see that you have
// the same deal open in two windows - both rows are you, and the banner
// deliberately ignores you. But two of your own windows overwrite each other
// exactly the way two people do: each holds its own copy of the record, each
// autosaves the whole thing, and the second one to save is refused or merged
// just the same.
//
// Fabio, 5 Sep 2026, after two windows of his own showed no banner at all:
// "it should probably warn you if YOU have the same deal open twice."
//
// The browser can answer this on its own. Windows of the same browser can talk
// to each other directly, so there is no table, no schema change and no extra
// database traffic - and it stops the moment the other window is closed.
//
// SAME BROWSER ONLY. Your laptop and your phone, or Chrome and Safari, cannot
// hear each other and will not be reported. That is the rarer case and the
// person doing it usually knows.

export const SELF_BEAT_MS = 3_000
// Two missed beats. Long enough that a busy window is not declared closed,
// short enough that the notice disappears while you are still looking at it.
export const SELF_STALE_AFTER_MS = 9_000

export type SelfWindow = { sessionId: string; tab: string; at: number }

export function otherWindows(rows: SelfWindow[], meSession: string, now: number): SelfWindow[] {
  const latest = new Map<string, SelfWindow>()
  for (const r of rows) {
    const id = String(r?.sessionId || '')
    if (!id || id === meSession) continue
    if (now - r.at >= SELF_STALE_AFTER_MS) continue
    const seen = latest.get(id)
    if (!seen || r.at > seen.at) latest.set(id, r)
  }
  return [...latest.values()].sort((a, b) => b.at - a.at)
}

// Said quietly. Nothing has gone wrong yet - this is the one warning that can be
// acted on completely, by closing a window.
export function selfMessage(others: SelfWindow[], myTab: string): string | null {
  if (others.length === 0) return null
  const tabs = [...new Set(others.map(o => String(o.tab || '').trim()).filter(Boolean))]
  const sameTab = tabs.some(t => t === String(myTab || '').trim())

  if (sameTab) {
    return 'You have this deal open in another window, on this same tab. Two of your own windows overwrite each '
         + 'other exactly like two people do — close one of them.'
  }
  const where = tabs.length === 0 ? 'another tab'
    : tabs.length === 1 ? tabs[0]
    : tabs.slice(0, -1).join(', ') + ' and ' + tabs[tabs.length - 1]
  return `You also have this deal open in another window, on ${where}.`
}
