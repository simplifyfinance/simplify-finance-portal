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

/**
 * HOW LONG THIS STAGE HAS BEEN WITH THIS PERSON, in days to one decimal.
 *
 * Null until somebody owns it, and null where the stage finished before the
 * owner was recorded - a number worked out from a clock that was not running
 * is worse than no number.
 */
export function daysOnStage(deal: any, stage: Stage, finishedAt?: any, now = new Date()): number | null {
  const o = ownerOf(deal, stage)
  if (!o?.since) return null
  const start = new Date(o.since).getTime()
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
