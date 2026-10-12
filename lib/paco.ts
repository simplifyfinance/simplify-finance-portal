import { ALL_TAGS, TAG_ALIASES, tagsOf } from './deal-tags'
import { lenderOnTheDeal } from './client-agreement'

// PACO, AND WHY HE CANNOT MAKE ANYTHING UP.
//
// 12 Oct 2026. The parrot in the bottom right of every page. He answers from
// three sources and nothing else - the lender policies we hold, the notes we
// write after BDM calls, and our own deals - and on day one only the third one
// exists.
//
// HE NEVER WRITES A SENTENCE ABOUT LENDING.
//
// This is the whole design and it is worth stating plainly, because the obvious
// way to build this is the dangerous one. There is no model here composing prose
// about what a bank will do. Every line he gives back is ASSEMBLED FROM FIELDS -
// the lender's name, how many deals, the month it was lodged, whether it was
// approved. The only words that are his are his manners, and they are written
// out below where anybody can read them.
//
// A model that writes "Northgate generally accepts limited title up to 80%" is
// one bad sentence away from a false representation to a client. A count of
// deals cannot be subtly wrong. It can only be right or absent.
//
// WHICH IS ALSO WHY THE MATCHING IS DETERMINISTIC. The question is matched
// against the tag list by words, not by a model's judgement. If nothing matches
// he says so rather than guessing which tag was meant - see UNDERSTOOD below.
//
// NO CLIENT NAMES AND NO FIGURES. "Lodged Jul 2026, formally approved", never
// the deal's name. The team can see names everywhere else in the portal; keeping
// them out of here means nothing Paco says can be pasted into a client email by
// accident.

const txt = (v: any) => String(v ?? '').trim()

// Punctuation and case are not meaning. "Self-employed" and "self employed" are
// the same question.
export function flat(s: any): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// --- what was asked --------------------------------------------------------

// WHICH TAGS THIS QUESTION IS ABOUT, or none.
//
// A tag matches when its own words, or one of the ways people actually say it,
// appear in the question. No scoring, no nearest match - either the words are
// there or they are not, because "nearest match" is how a bot ends up answering
// a question nobody asked.
export function tagsAsked(question: string): string[] {
  const q = ` ${flat(question)} `
  return ALL_TAGS.filter(tag => {
    const forms = [tag, ...(TAG_ALIASES[tag] || [])]
    return forms.some(f => q.includes(` ${flat(f)} `) || q.includes(`${flat(f)} `) || q.endsWith(` ${flat(f)}`))
  })
}

// AND WHICH LENDER, when one is named. Longest name first so "Bank of Melbourne"
// is not read as "Bank of Queensland" sharing the word bank.
export function lenderAsked(question: string, known: string[]): string {
  const q = ` ${flat(question)} `
  const hit = [...known].filter(Boolean).sort((a, b) => b.length - a.length)
    .find(n => q.includes(` ${flat(n)} `))
  return hit || ''
}

// --- what we know ----------------------------------------------------------

export type DealRow = {
  id?: string
  lo_data?: any
  compliance_data?: any
  lodged_at?: any
  formal_approval_at?: any
  settled_at?: any
}

export type DealFact = {
  lender: string
  tags: string[]
  // "Jul 2026", or empty when it never got that far.
  when: string
  // settled / formally approved / lodged / not lodged yet. Off the deal's own
  // dates - nobody types this and nobody can get it wrong.
  outcome: string
  // Everyone who was compared and not chosen on this deal.
  considered: string[]
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function monthYear(v: any): string {
  const s = txt(v)
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// THE OUTCOME IS NOT AN OPINION. It is which dates the deal has.
export function outcomeOf(deal: DealRow): string {
  if (txt(deal?.settled_at)) return 'settled'
  if (txt(deal?.formal_approval_at)) return 'formally approved'
  if (txt(deal?.lodged_at)) return 'lodged'
  return 'not lodged yet'
}

export function factOf(deal: DealRow): DealFact {
  const lo = deal?.lo_data || {}
  const lender = txt(lenderOnTheDeal(lo))
  const options: any[] = Array.isArray(lo?.lenders) ? lo.lenders : []
  const considered = options.map(o => txt(o?.lenderName))
    .filter(n => n && flat(n) !== flat(lender))
  return {
    lender,
    tags: tagsOf(lo),
    when: monthYear(deal?.settled_at || deal?.formal_approval_at || deal?.lodged_at),
    outcome: outcomeOf(deal),
    considered: [...new Set(considered)],
  }
}

// --- the answer ------------------------------------------------------------

export type Counts = {
  tagged: number
  untagged: number
  // Both zero until those sources exist. Said out loud rather than hidden, so
  // "Nada" reads as a gap somebody can close rather than a broken screen.
  policies: number
  bdmNotes: number
}

export type LenderLine = { lender: string; deals: { when: string; outcome: string; alsoTagged: string[] }[] }

export type Answer = {
  // found       - we have deals for what was asked
  // none_tagged - we understood, and no deal carries that tag
  // not_understood - the words matched nothing he holds
  kind: 'found' | 'none_tagged' | 'not_understood'
  asked: string[]
  lenders: LenderLine[]
  alsoConsidered: string[]
  counts: Counts
  // Which of his three sources he is missing on this question. Every answer
  // ends with this, because the line that says what is missing is the line that
  // turns a lookup into a habit.
  missing: ('policy' | 'bdm')[]
}

export function answer(question: string, deals: DealRow[], counts?: Partial<Counts>): Answer {
  const rows = Array.isArray(deals) ? deals : []
  const facts = rows.map(factOf)
  const tagged = facts.filter(f => f.tags.length > 0)

  const base: Counts = {
    tagged: tagged.length,
    untagged: facts.length - tagged.length,
    policies: 0,
    bdmNotes: 0,
    ...(counts || {}),
  }
  const missing: ('policy' | 'bdm')[] = []
  if (base.policies === 0) missing.push('policy')
  if (base.bdmNotes === 0) missing.push('bdm')

  const asked = tagsAsked(question)
  const named = lenderAsked(question, facts.map(f => f.lender))

  if (asked.length === 0 && !named) {
    return { kind: 'not_understood', asked: [], lenders: [], alsoConsidered: [], counts: base, missing }
  }

  const hits = tagged.filter(f =>
    (asked.length === 0 || asked.some(t => f.tags.includes(t))) &&
    (!named || flat(f.lender) === flat(named)))

  if (hits.length === 0) {
    return { kind: 'none_tagged', asked, lenders: [], alsoConsidered: [], counts: base, missing }
  }

  // GROUPED BY LENDER, MOST DEALS FIRST - which is the shape of the question.
  // Nobody asks "what happened in July", they ask "who will do this".
  const by = new Map<string, LenderLine>()
  for (const f of hits) {
    const key = f.lender || 'No lender recorded'
    if (!by.has(key)) by.set(key, { lender: key, deals: [] })
    by.get(key)!.deals.push({
      when: f.when,
      outcome: f.outcome,
      alsoTagged: f.tags.filter(t => !asked.includes(t)),
    })
  }
  const lenders = [...by.values()].sort((a, b) =>
    b.deals.length - a.deals.length || a.lender.localeCompare(b.lender))

  const chosen = new Set(lenders.map(l => flat(l.lender)))
  const alsoConsidered = [...new Set(hits.flatMap(f => f.considered))]
    .filter(n => !chosen.has(flat(n)))

  return { kind: 'found', asked, lenders, alsoConsidered, counts: base, missing }
}

// --- his manners -----------------------------------------------------------
//
// The only words in this file that are not a field off a record. They are here,
// together, so that what Paco is able to say can be read in one place and
// argued with - rather than being scattered through a screen.

export const HOLA = '¡Hola! Ask me about a lender, or what we have done before.'

export function opener(a: Answer): string {
  if (a.kind === 'found') {
    const n = a.lenders.reduce((t, l) => t + l.deals.length, 0)
    return `¡Eso! ${n} deal${n === 1 ? '' : 's'} tagged ${listOf(a.asked)}.`
  }
  if (a.kind === 'none_tagged') return 'Nada — yet.'
  return 'Nada.'
}

export function line(a: Answer): string {
  if (a.kind === 'found') return ''
  if (a.kind === 'none_tagged') {
    return `No deal has been tagged ${listOf(a.asked)}.`
  }
  return 'I’ve got nothing on that — and I don’t invent.'
}

// THE DIFFERENCE BETWEEN "WE NEVER HAVE" AND "NOBODY TOLD ME".
//
// He knows which, and he says which. A bot that lets those two look the same
// teaches people that it does not work.
export function sinceWhen(a: Answer): string {
  if (a.kind !== 'none_tagged') return ''
  return 'That does not mean we have never done one. It means nobody has tagged one yet.'
}

export function missingLine(a: Answer): string {
  if (a.missing.length === 0) return ''
  const bits: string[] = []
  if (a.missing.includes('policy')) bits.push('no lender policy')
  if (a.missing.includes('bdm')) bits.push('no BDM note')
  return `I have ${bits.join(' and ')} on this.`
}

function listOf(names: string[]): string {
  if (names.length === 0) return 'that'
  if (names.length === 1) return names[0].toLowerCase()
  return `${names.slice(0, -1).map(n => n.toLowerCase()).join(', ')} and ${names[names.length - 1].toLowerCase()}`
}
