// WHAT THE SAVE LINE SAYS, AND WHEN IT IS ALLOWED TO SAY IT.
//
// Fabio, 15 Sep 2026: the line beside the deal name said "Autosaved 10:42" and
// then sat there. It only ever moved when a save SUCCEEDED, so ten minutes of
// typing later it still said 10:42 - and it said exactly the same thing whether
// every one of those keystrokes had landed, whether the wifi had dropped, or
// whether the tab had been offline the whole time. A person reads "Autosaved",
// believes it, and closes the laptop.
//
// So the rule here is that the line is about THE WORK ON SCREEN, not about the
// last time something happened to go through:
//
//   "Saved 10:52" means everything you can see is in the database.
//   It does not mean "a save succeeded at 10:52".
//
// The moment anything changes, the line stops claiming to be saved and does not
// claim it again until the write has genuinely landed.
//
// Kept away from React on purpose: the four tabs each own their own save, and
// this is the one place that decides what a person is told, so they cannot drift
// into telling four different stories. The timing lives in
// components/useSaveIndicator.ts.

// clean  - nothing on screen is unsaved
// saving - something changed, or a write is on its way
// slow   - a write has been in flight past SLOW_SAVE_MS, or the computer is offline
// failed - the database refused it, or it never arrived
export type SaveStage = 'clean' | 'saving' | 'slow' | 'failed'

export type SaveStatus = {
  stage: SaveStage
  // Time of the last landed save, "10:52". Absent until one lands.
  at?: string
  // Plain English, for a person. Only on 'failed'.
  message?: string
  // The database's own words. Small and grey, so it can still be sent to Fabio
  // without being the thing anybody has to read.
  technical?: string
}

// How long a write may be in flight before the line stops being quiet about it.
// Long enough not to cry wolf on a slow morning, short enough that somebody has
// not already walked away. Fabio chose 8s, 16 Sep 2026.
export const SLOW_SAVE_MS = 8000

export function stampNow(now: Date = new Date()): string {
  return now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

// quiet - grey text, no box. warn/bad - a coloured pill, because these are the
// two states somebody has to notice before they close the tab.
export type Tone = 'quiet' | 'warn' | 'bad'

export type IndicatorLine = {
  tone: Tone
  text: string
  // Second line, under the pill.
  note?: string
  technical?: string
}

export function indicatorLine(s: SaveStatus): IndicatorLine {
  if (s.stage === 'failed') {
    return {
      tone: 'bad',
      text: 'NOT SAVED — don’t close this tab',
      note: s.message || FALLBACK_FAILURE,
      technical: s.technical,
    }
  }
  if (s.stage === 'slow') {
    return { tone: 'warn', text: 'Still saving — keep this tab open' }
  }
  if (s.stage === 'saving') return { tone: 'quiet', text: 'Saving…' }
  // clean
  return { tone: 'quiet', text: s.at ? `Saved ${s.at}` : 'All changes saved' }
}

export const FALLBACK_FAILURE =
  'Your last change did not reach the database. Copy anything you cannot afford to lose somewhere '
  + 'safe before you close this tab, then tell Fabio.'

// TURNING A DATABASE ERROR INTO A SENTENCE.
//
// saveGuarded returns two different sorts of failure in the same field. Some are
// already written for a person - the wipe guard explains itself, and so does a
// write that never arrived. One is not: a raw Postgres error, which is where
// "new row violates row-level security policy for table deals" came from.
//
// The two are told apart by save-conflict handing us `technical` alongside the
// message, NOT by guessing from the English. Guessing at it would be one more
// thing to be wrong about.
export function plainFailure(message: string, technical?: string): { message: string; technical?: string } {
  const human = strip(message)
  if (technical) return { message: FALLBACK_FAILURE, technical: strip(technical) }
  return { message: human || FALLBACK_FAILURE }
}

// The messages come in shouting "NOT SAVED - " because that used to be the whole
// indicator. The pill says that now, so the sentence under it should not repeat it.
function strip(m: string): string {
  return String(m || '').replace(/^\s*NOT SAVED\s*[-–—:]\s*/i, '').trim()
}
