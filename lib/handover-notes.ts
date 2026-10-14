import { ALL_TAGS } from './deal-tags'
// WHAT CREDIT TELLS THE BROKER WHEN THEY HAND IT OVER.
//
// 13 Oct 2026. Fabio: "when a credit is building the BC and is sending to the
// broker for the broker to accept and email the client, there's no box to
// communicate with the broker why... just an internal communication."
//
// And the second half, which is the reason this file exists at all: "incorporate
// some questions in there that will allow us to constantly teach Paco."
//
// THE LEARNING RIDES ON WORK SOMEBODY WAS ALREADY DOING. Credit has to hand
// over. A "what made this deal hard" section sitting on the lending options
// waiting to be filled in is a chore and would be ignored; the same question
// asked at the moment of handover is one tap on a screen that is already open.
// Fabio threw the first version out for exactly that reason.
//
// TWO MOMENTS, TWO QUESTIONS. The borrowing capacity knows what was HARD,
// because that is where the difficulty showed up. The lending options know WHY
// each lender is on the deal. Asking either in the wrong place gets a shrug.
//
// AND ALMOST NONE OF IT REACHES PACO. The note is for the broker and Paco never
// reads a word of it. The taps are counted, never quoted - three deals going the
// same way might be policy, might be a good BDM, might be what the client asked
// for, and a bot that turns a count into a reason is a bot that invents. The one
// thing that becomes knowledge is the surprise, because that is a sentence a
// person wrote on purpose about a bank.

export type Stage = 'bc' | 'lo'

/** What made this deal hard. Asked at the borrowing capacity, never later. */
// THE SAME WORDS THE LENDING OPTIONS TAB USED TO ASK FOR.
//
// 14 Oct 2026. The broker was asked "what made this one hard" twice - once on
// the Lending Options tab and again here when the BC is sent. The comment at
// the top of components/Handover.tsx even says the Lending Options version was
// thrown out for being a chore. It never was. Fabio, finding it still there:
// "we removed that when we added notes when sending BC and LO didnt we?"
//
// So the Lending Options block is gone and its list moved here, because the two
// lists were NOT the same question stored twice:
//
//   this file's old list    Servicing was tight, Credit history, Expat
//   the tab's list          Off the plan, Limited title, Self-employed under 2 yrs
//
// Paco only ever read the tab's. Deleting the tab and keeping these words would
// have quietly stopped him learning anything useful, so the detailed ones won.
//
// ONE LIST, IN ONE PLACE. lib/deal-tags.ts owns the words; this is the same
// list with the honest way out on the end.
export const NOTHING_UNUSUAL = 'Nothing unusual'

export const HARD = [...ALL_TAGS,
  // THE HONEST WAY OUT. The questions have to be answered, so there has to be a
  // true answer for a deal that was simply straightforward. Without this
  // somebody ticks "credit impairment" on a clean file to get past the box, and
  // every count Paco does afterwards is rubbish.
  NOTHING_UNUSUAL] as const

/** What would have made it easier. Optional, and the broker sees it too. */
export const EASIER = [
  'Another year of returns',
  'Paying out a liability',
  'A bigger deposit',
  'A different structure',
  'A guarantor',
  'More time',
] as const

/** Why this lender is on the deal. Asked once per lender, at the options. */
export const WHY = [
  'Policy fit',
  'Servicing',
  'Rate',
  'Speed',
  'Relationship',
  'Only one who would',
] as const

export type Handover = {
  stage: Stage
  /** Free text for the broker. Internal, and Paco never reads it. */
  note: string
  /** Chosen from HARD. */
  hard: string[]
  /** Chosen from EASIER. */
  easier: string[]
  /** lender name -> reasons chosen from WHY. */
  why: Record<string, string[]>
  /** One sentence about a bank doing something unexpected. */
  surprise: string
  /** Which bank the surprise is about. */
  surpriseLender: string
  /** Where the surprise came from. Only the two a person may choose. */
  surpriseTier: 'B' | 'D'
}

const txt = (v: any): string => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim()
const only = (chosen: any, allowed: readonly string[]): string[] =>
  (Array.isArray(chosen) ? chosen : []).map(txt).filter(c => allowed.includes(c))

export function empty(stage: Stage): Handover {
  return { stage, note: '', hard: [], easier: [], why: {}, surprise: '', surpriseLender: '', surpriseTier: 'D' }
}

/**
 * Everything typed, cleaned, with anything we did not offer thrown away.
 *
 * A tap that is not one of ours is somebody posting straight at the database,
 * and a made-up tag would quietly poison every count Paco does afterwards.
 */
export function tidy(h: any, lenders: string[] = []): Handover {
  const stage: Stage = h?.stage === 'lo' ? 'lo' : 'bc'
  const names = (Array.isArray(lenders) ? lenders : []).map(txt).filter(Boolean)
  const why: Record<string, string[]> = {}
  for (const name of names) {
    const picked = only(h?.why?.[name], WHY)
    if (picked.length > 0) why[name] = picked
  }
  return {
    stage,
    note: txt(h?.note).slice(0, 4000),
    hard: only(h?.hard, HARD),
    easier: only(h?.easier, EASIER),
    why,
    surprise: txt(h?.surprise).slice(0, 600),
    surpriseLender: names.includes(txt(h?.surpriseLender)) ? txt(h?.surpriseLender) : txt(h?.surpriseLender),
    surpriseTier: h?.surpriseTier === 'B' ? 'B' : 'D',
  }
}

/** Is there anything here at all. */
export function saidSomething(h: Handover): boolean {
  return !!(txt(h.note) || h.hard.length || h.easier.length ||
            Object.keys(h.why).length || txt(h.surprise))
}

// THE BOXES GET ANSWERED.
//
// 13 Oct 2026. The first version had a "Send without notes" button on it,
// which I put there on my own reasoning that nothing should block a handover.
// Nobody asked for it and Fabio was blunt about it: "I never heard of it we
// never discussed so NO they need to fucking answer the boxes."
//
// He is right. The whole point is that the explanation which used to go in the
// email has a home again - an opt-out means it goes back to not happening, and
// the one thing worse than no answers is answers from half the team.
//
// WHAT IS REQUIRED IS DELIBERATELY SMALL. A sentence to the broker, and the
// question that stage can answer. "Nothing unusual" is a real answer and the
// surprise box stays optional, because most deals have no surprise and
// demanding one would manufacture them.
const NEEDS_A_SENTENCE = 12

export function whatIsMissing(h: Handover, lenders: string[] = []): string[] {
  const missing: string[] = []
  if (txt(h.note).length < NEEDS_A_SENTENCE) missing.push('what the broker needs to know')

  if (h.stage === 'bc') {
    if (h.hard.length === 0) missing.push('whether anything was hard about it')
    return missing
  }

  const names = (Array.isArray(lenders) ? lenders : []).map(txt).filter(Boolean)
  const unanswered = names.filter(n => (h.why[n] || []).length === 0)
  if (unanswered.length > 0) {
    missing.push(unanswered.length === names.length
      ? 'why these lenders are on the deal'
      : `why ${unanswered.join(' and ')} ${unanswered.length === 1 ? 'is' : 'are'} on the deal`)
  }
  return missing
}

/** Can this be sent. */
export function readyToSend(h: Handover, lenders: string[] = []): boolean {
  return whatIsMissing(h, lenders).length === 0
}

/**
 * The one thing that becomes team knowledge.
 *
 * NOT the taps. A count is not a reason, and "Bankwest, policy fit" is not a
 * sentence anybody can act on - Paco counts those and ASKS about them later,
 * which is a different thing from repeating them. The surprise is a sentence a
 * person wrote on purpose about a bank, which is exactly what a note is.
 *
 * NOTHING ABOUT THE CLIENT TRAVELS. No name, no figure off their file, no deal.
 * Only the bank and what it did. Returns null when there is nothing to keep.
 */
export function whatPacoKeeps(h: Handover): { lender: string; said: string; tier: 'B' | 'D' } | null {
  const said = txt(h.surprise)
  const lender = txt(h.surpriseLender)
  if (!said || !lender) return null
  return { lender, said, tier: h.surpriseTier }
}

/** What the broker reads at the top of the deal, in one sentence. */
export function theShortVersion(h: Handover): string {
  const bits: string[] = []
  if (h.hard.length) bits.push(`Hard because: ${h.hard.join(', ').toLowerCase()}`)
  if (h.easier.length) bits.push(`Easier with: ${h.easier.join(', ').toLowerCase()}`)
  const lenders = Object.keys(h.why)
  if (lenders.length) {
    bits.push(lenders.map(l => `${l} — ${(h.why[l] || []).join(', ').toLowerCase()}`).join(' · '))
  }
  return bits.join('. ')
}

/** The questions this stage asks. The other stage's questions are not shown. */
export function asksAbout(stage: Stage): ('hard' | 'easier' | 'why' | 'surprise')[] {
  return stage === 'bc' ? ['hard', 'easier'] : ['why', 'surprise']
}
