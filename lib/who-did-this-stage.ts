// WHO IS DOING THIS STAGE, AND WHO DID THE LAST ONE.
//
// 23 Oct 2026. Fabio, on why the workload numbers cannot be trusted: "i need
// each stage tro be recoreded and managed by that perison remmeber as we
// measure productivy".
//
// The portal stored ONE credit officer per deal. So a broker who wrote the BC
// himself and then handed the lending options to Sylvan produced a deal that
// said Sylvan did both, and Sylvan's average carried a BC he never opened.
//
// THE RULES, HIS WORDS, 23 Oct 2026:
//
//   "A broker still needs to either do the BC /LO or Allocate to credit"
//   "if allocated to credit in BC that carries for LO"
//   "if done themsleves BC they still can allocate to credit LO"
//
// So the owner of a stage DEFAULTS to whoever had the one before it, and can
// always be changed. The default is a convenience, never a decision - which is
// why the stage stores its own answer rather than reading the one before it
// every time.
//
// AND THE BROKER NEVER PICKS A PERSON. They pick "the credit queue" and
// lib/allocate-officer.ts works out who - by who covers that broker, who is on
// leave, and who is carrying the least. See pickForStage below.

import { dealBeads } from './deal-status'

export type Stage = 'bc' | 'lo' | 'compliance'

export const STAGES: Stage[] = ['bc', 'lo', 'compliance']

export const STAGE_LABEL: Record<Stage, string> = {
  bc: 'BC', lo: 'Lending options', compliance: 'Compliance',
}

/** The three columns a stage keeps about its owner. */
export const ownerFields = (s: Stage) => ({
  officer: `${s}_owner_officer`,
  name: `${s}_owner_name`,
  since: `${s}_owner_since`,
})

export type Owner = {
  /** Set when a credit officer has it. Null means a broker. */
  officerId: string | null
  /** Always set once somebody owns it - the person's name, for the screen. */
  name: string
  /** When it became theirs. The clock this stage is measured on. */
  since: string | null
  /** True when this is credit rather than the broker. */
  isCredit: boolean
}

const txt = (v: any) => String(v ?? '').trim()

/**
 * WHO OWNS THIS STAGE RIGHT NOW.
 *
 * Null means nobody has decided - a stage nobody has opened. That is different
 * from "the broker is doing it", which is a decision somebody made by leaving
 * it alone, and it is why the broker's name is written down rather than
 * inferred from the absence of an officer.
 */
export function ownerOf(deal: any, stage: Stage): Owner | null {
  if (!deal) return null
  const f = ownerFields(stage)
  const officerId = txt(deal[f.officer]) || null
  const name = txt(deal[f.name])
  if (!officerId && !name) return null
  return { officerId, name, since: deal[f.since] || null, isCredit: !!officerId }
}

/**
 * WHAT THE NEXT STAGE OPENS ON.
 *
 * The stage before it, if anybody owned it. Otherwise the broker on the deal.
 * This is the "carries for LO" rule, and it is only ever a default - the
 * control on screen can change it, and changing it never touches the stage
 * before.
 */
export function defaultOwnerFor(deal: any, stage: Stage): Owner | null {
  const i = STAGES.indexOf(stage)
  for (let j = i - 1; j >= 0; j--) {
    const before = ownerOf(deal, STAGES[j])
    if (before) return { ...before, since: null }
  }
  const broker = txt(deal?.assigned_broker)
  return broker ? { officerId: null, name: broker, since: null, isCredit: false } : null
}

/** The owner to show, whether this stage has been answered or not. */
export function showingOwner(deal: any, stage: Stage): Owner | null {
  return ownerOf(deal, stage) || defaultOwnerFor(deal, stage)
}

// WHEN A STAGE OPENED AND WHEN IT CLOSED.
//
// 23 Oct 2026, an hour after the row shipped. Fabio, on a deal whose BC closed
// on 24 September: the blue box read "Doing this, 29.1 days", and the lending
// options beside it read "Did this, 1.1 days" while the lending options were
// still open with the broker. Both wrong, for the same reason: I had handed
// the row the date CREDIT marked their part done, which is not the same thing
// as the stage being finished, and on that deal was never set at all.
//
// The portal already has one answer to "is this stage finished", and the cards
// and the pipeline both read it: the BC closes when the client agrees, the
// lending options when the client agrees to them, compliance when it is marked
// complete. See BEADS in lib/deal-status.ts. This now reads the same list, so
// the row cannot disagree with the card sitting above it.
//
// AND THE CLOCK MEASURES THE STAGE, NOT THE PERSON. Fabio, asked straight out
// which one the number should be: the time the stage took. So it runs from the
// stage opening - which is the moment the one before it closed - until the
// client agrees, whoever was holding it in between. A stage that sat with a
// broker for a month reads a month, which is the number worth looking at.
const BEAD: Record<Stage, string> = { bc: 'bc', lo: 'lo', compliance: 'compliance' }
const BEAD_BEFORE: Record<Stage, string> = { bc: 'fact_find', lo: 'bc', compliance: 'lo' }

export type StageWindow = {
  /** When the stage opened: the moment the one before it closed. */
  startedAt: string | null
  /** When the client agreed to it. Null while it is still open. */
  finishedAt: string | null
  done: boolean
}

export function stageWindow(deal: any, stage: Stage): StageWindow {
  const beads = dealBeads(deal)
  const mine = beads.find(b => b.key === BEAD[stage])
  const before = beads.find(b => b.key === BEAD_BEFORE[stage])
  return {
    startedAt: before?.done && before.date ? String(before.date) : null,
    finishedAt: mine?.done && mine.date ? String(mine.date) : null,
    done: !!mine?.done,
  }
}

/** Finished, by the same rule the card above it uses. */
export function stageIsDone(deal: any, stage: Stage): boolean {
  return stageWindow(deal, stage).done
}

/**
 * HOW LONG THIS STAGE TOOK, in days to one decimal.
 *
 * Null where we cannot know when it opened - a number worked out from a clock
 * that was not running is worse than no number.
 */
export function daysOnStage(deal: any, stage: Stage, now: Date = new Date()): number | null {
  const { startedAt, finishedAt } = stageWindow(deal, stage)
  if (!startedAt) return null
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : now.getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.round(((end - start) / 86_400_000) * 10) / 10
}

/** The write that hands a stage to somebody. One shape, so three screens agree. */
export function handOver(stage: Stage, to: { officerId: string | null; name: string }, now = new Date()) {
  const f = ownerFields(stage)
  return {
    [f.officer]: to.officerId,
    [f.name]: to.name,
    [f.since]: now.toISOString(),
  } as Record<string, any>
}

/**
 * IS THE QUEUE THE ANSWER TO THIS STAGE?
 *
 * The broker picks "me" or "the credit queue" - never a person. This says
 * whether the queue still has to run: it has not where this stage already
 * belongs to an officer. The old round robin asked the DEAL that question,
 * which is why a broker who did the BC himself could not put the lending
 * options in the queue - the deal already had an officer on it from nowhere.
 */
export function needsAllocating(deal: any, stage: Stage): boolean {
  return !ownerOf(deal, stage)?.officerId
}

/** What the control on screen offers. Two answers, never a list of names. */
export type OwnerChoice = 'me' | 'queue'
