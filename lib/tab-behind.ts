// WHEN A TAB IS SHOWING LESS THAN THE DEAL HOLDS, IT SAYS SO.
//
// A tab re-reads its record from the database the moment it opens, and then
// decides whether to put that on screen. If somebody has typed while the round
// trip was in flight it leaves the screen alone - which is right, because
// writing over what somebody is in the middle of typing is worse than showing
// them something out of date.
//
// What it has never done is SAY ANYTHING when it decides that. Silence is how a
// blank Compliance tab looked like lost work for an hour on 18 September.
// Nothing was lost, nothing was ever at risk, and nobody could tell.
//
// So: when the screen is behind AND the record holds materially more, the tab
// PUTS IT BACK and says it did. One condition, deliberately narrow. Everything
// else stays as quiet as it is today.
//
// WHY IT IS NOT A CHOICE. The first version of this asked - "show me what is
// saved" or "keep what is on screen". Fabio, 21 Sep 2026: "doesnt seem like a
// sentence that directs my team to do that". He was right, and the reason is
// that one of the two answers is always correct. The merge below keeps every
// box the person has typed in and only fills the ones they have not, so there
// is no version of pressing it that loses work. A decision where one side is
// always right is not a decision, it is a thing for somebody to hesitate over
// at the worst moment.
//
// AND THERE IS NO UNDO BUTTON, which is a change of mind worth recording.
// Undoing this would mean writing the smaller record back over the bigger one -
// which is exactly what lib/wipe-guard.ts exists to refuse. The button would
// have failed with an alarming message every time it was pressed. Anybody who
// genuinely wants the boxes empty clears them, the same as any other day.

import { filledCount } from './wipe-guard'

// Below this there is nothing to judge. Two boxes against five is somebody who
// has just started, not a screen that loaded from the wrong place.
const ENOUGH_TO_JUDGE = 8

// A screen holding at least this much of the record is somebody working, mid
// sentence, mid save. Below it, the screen came from somewhere older than the
// record - which is the whole fault this exists for. Richard Lake's Compliance
// tab was showing 6 against 41, which is 0.15.
const ON_SCREEN_IS_BEHIND_BELOW = 0.6

// And it has to be worth interrupting somebody for. Three boxes fewer on a busy
// form is not.
const AT_LEAST_THIS_MANY_MISSING = 5

export type TabBehind = {
  onScreen: number
  stored: number
  missing: number
}

// Null means say nothing - which is almost always. Anything else is the one
// case: the person has typed, the screen is keeping what they typed, and the
// record holds materially more than is in front of them.
export function tabIsBehind(onScreen: any, stored: any): TabBehind | null {
  const held = filledCount(stored)
  if (held < ENOUGH_TO_JUDGE) return null

  const showing = filledCount(onScreen)
  const missing = held - showing
  if (missing < AT_LEAST_THIS_MANY_MISSING) return null
  if (showing >= held * ON_SCREEN_IS_BEHIND_BELOW) return null

  return { onScreen: showing, stored: held, missing }
}

// IT COUNTS, AND IT NAMES, AND IT IS IN THE PAST TENSE. "This tab may be out of
// date" is a sentence people learn to scroll past. "35 things were saved but not
// showing, and they have been put back" is one they read once and carry on.
export function behindLine(b: TabBehind, savedBy?: string | null, savedAt?: string | null): string {
  const who = String(savedBy || '').trim()
  const when = clockTime(savedAt)
  const tail = who
    ? ` Last saved by ${who}${when ? ` at ${when}` : ''}.`
    : (when ? ` Last saved at ${when}.` : '')
  const things = b.missing === 1 ? 'One thing was' : `${b.missing} things were`
  return `${things} saved on this deal but not showing here, and ${b.missing === 1 ? 'it has' : 'they have'} been put back.`
    + ` Everything you typed has been kept.${tail}`
}

function clockTime(at: string | null | undefined): string {
  if (!at) return ''
  const d = new Date(at)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '')
}

// WHAT "SHOW ME WHAT IS SAVED" ACTUALLY DOES.
//
// It is a merge, not a replace. Start from the saved record, then put back
// every box this person has changed since the tab opened. Anything they typed
// stays exactly as they typed it; everything the record holds that this screen
// never had arrives around it.
//
// merge3 in lib/deal-merge.ts is the right tool when two people are editing at
// once and neither is more entitled than the other, and it refuses when the
// same box was changed by both. That refusal is correct there and wrong here:
// the person has pressed a button ASKING for this, so on the few boxes that
// clash, theirs is the answer.
export function keepWhatTheyTyped(atOpen: any, stored: any, onScreen: any): any {
  const sameValue = (a: any, b: any) =>
    JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b)

  const isRecord = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v)

  const walk = (base: any, theirs: any, mine: any): any => {
    // They have not touched this box since the tab opened. The record wins.
    if (sameValue(base, mine)) return theirs
    // Both sides are shaped the same, so go deeper before deciding.
    if (isRecord(theirs) && isRecord(mine)) {
      const out: any = {}
      const keys = new Set([...Object.keys(isRecord(base) ? base : {}), ...Object.keys(theirs), ...Object.keys(mine)])
      for (const k of keys) {
        const v = walk(isRecord(base) ? base[k] : undefined, theirs[k], mine[k])
        if (v !== undefined) out[k] = v
      }
      return out
    }
    // They typed in it. What they typed stays.
    return mine
  }

  return walk(atOpen, stored, onScreen)
}
