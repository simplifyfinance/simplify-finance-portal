import { ALL_TAGS, TAG_ALIASES } from './deal-tags'
// NOT from './paco' - paco.ts imports claimsFor() from this file, so taking
// anything from it here would be a circle. See lib/plain-words.ts.
import { flat } from './plain-words'

// WHAT THE TEAM TELLS PACO, AND WHY HE STILL IS NOT MAKING ANYTHING UP.
//
// 12 Oct 2026. Paco answers from our own deals today. This is the second of his
// three sources: a person types what they know, and he repeats it.
//
// HE QUOTES. HE DOES NOT SUMMARISE.
//
// This matters more here than anywhere else in him. A deal is fields - a lender,
// a date, an outcome - and a count of deals cannot be subtly wrong. A note is a
// SENTENCE SOMEBODY WROTE, and the obvious thing to do with a sentence is to
// tidy it, shorten it, blend three of them into one. Every one of those is Paco
// writing about lending, which is the thing he must never do.
//
// So a note comes back exactly as it was typed, with the name of whoever typed
// it and the day they did. The parrot metaphor is not decoration: he repeats,
// word for word, and says whose words they are.
//
// ANYONE CAN ADD ONE AND IT IS LIVE IMMEDIATELY.
//
// Fabio, 12 Oct 2026: "anyone can update paco but we data stmap and mark which
// person did". There is no approval queue and nothing waits on one person being
// at their desk. The safeguard is not a gate, it is that every note carries a
// name, a date and a tier, and Paco says all three every single time he repeats
// it. See docs/paco.md.
//
// NOTHING IS EVER DELETED. A note that turns out to be wrong is RETIRED - it
// stops being answered with, and it stays readable with the date it was retired
// and by whom. A knowledge base you can quietly edit is one nobody can trust.
//
// THE TIERS ARE NOT A CONFIDENCE SCORE. They say where a claim came from, which
// is a fact. A number between nought and one would be a guess, and a guess gets
// trusted without being read.
//
// NOTHING HERE TOUCHES REACT OR THE DATABASE.

const txt = (v: any) => String(v ?? '').trim()

// --- how firm is it --------------------------------------------------------
//
// Tiers A to E, from the Credit Policy AI Blueprint section 3. Paco holds D and
// B today - what we have seen, and what a BDM has put in writing. A and C arrive
// with the lender documents; E is a hint to go and check and is not stored.

export type Tier = 'A' | 'B' | 'C' | 'D'

export const TIERS: { tier: Tier; label: string; means: string; official: boolean }[] = [
  { tier: 'A', label: 'Lender policy',      means: 'From the lender’s own credit manual or policy page', official: true },
  { tier: 'B', label: 'In writing from the lender', means: 'A written update, email or BDM clarification we hold', official: true },
  { tier: 'C', label: 'Product guide',      means: 'A public summary — indicative, never the whole policy', official: false },
  { tier: 'D', label: 'Our experience',     means: 'What we have seen on our own deals, or a BDM said on a call', official: false },
]

/** The tiers a person can choose when typing a note. A and C come from documents. */
export type TypeableTier = 'B' | 'D'
export const TYPEABLE_TIERS: TypeableTier[] = ['B', 'D']

export function tierLabel(t: any): string {
  return TIERS.find(x => x.tier === txt(t))?.label || 'Our experience'
}

/** Official written policy, as opposed to what we have seen. */
export function isOfficial(t: any): boolean {
  return !!TIERS.find(x => x.tier === txt(t))?.official
}

// A OUTRANKS B OUTRANKS C OUTRANKS D, and that is the whole hierarchy.
//
// Blueprint section 2: official written lender policy outranks everything, and
// internal experience never silently overwrites official policy. "Silently" is
// the word that matters - outranking decides the ORDER Paco says things in, and
// nothing else. A lower tier is never hidden because a higher one exists.
const ORDER: Tier[] = ['A', 'B', 'C', 'D']
export function rankOf(t: any): number {
  const i = ORDER.indexOf(txt(t) as Tier)
  return i === -1 ? ORDER.length : i
}

// --- a note ----------------------------------------------------------------

export type Claim = {
  id: string
  lender: string
  tags: string[]
  /** Exactly what the person typed. Never edited, never summarised. */
  said: string
  tier: Tier
  /** Where it came from, in their words - "email from BDM John, 3 Oct". */
  source: string
  who: string
  when: string
  retiredAt?: string | null
  retiredBy?: string | null
}

export function isLive(c: Claim): boolean {
  return !txt(c?.retiredAt)
}

/** A note is worth keeping only if it says something about a lender. */
export function isUsable(c: Partial<Claim>): boolean {
  return !!txt(c?.said) && !!txt(c?.lender)
}

// --- finding the ones that answer the question -----------------------------
//
// THE SAME WORDS THE DEALS ARE MATCHED BY. lib/deal-tags.ts holds one tag
// vocabulary for the whole portal, so a question that finds deals about limited
// title finds notes about limited title too. A second vocabulary here would mean
// two ways of saying the same thing and a bot that answers half a question.

function wordsFor(tag: string): string[] {
  return [tag, ...(TAG_ALIASES[tag] || [])].map(flat).filter(Boolean)
}

/** The tags a note is about, read from its own tags and from what it says. */
export function tagsOfClaim(c: Claim): string[] {
  const own = (Array.isArray(c?.tags) ? c.tags : []).map(txt).filter(t => ALL_TAGS.includes(t))
  if (own.length > 0) return own
  // Nothing ticked: fall back to the words in the note itself, so a note typed
  // in a hurry is still findable. Deterministic - the words are there or not.
  const said = flat(c?.said)
  return ALL_TAGS.filter(tag => wordsFor(tag).some(w => w && said.includes(w)))
}

export function claimsFor(claims: any, asked: string[], lender: string): Claim[] {
  const rows: Claim[] = (Array.isArray(claims) ? claims : []).filter(isUsable).filter(isLive)
  const want = (Array.isArray(asked) ? asked : []).filter(Boolean)
  const named = flat(lender)
  return rows
    .filter(c => !named || flat(c.lender) === named)
    .filter(c => want.length === 0 || tagsOfClaim(c).some(t => want.includes(t)))
    // Official first, then newest. Never official INSTEAD of - see ORDER above.
    .sort((a, b) => rankOf(a.tier) - rankOf(b.tier) || txt(b.when).localeCompare(txt(a.when)))
}

// --- two people who disagree -----------------------------------------------
//
// Shown, both of them, with their names and dates. Paco never picks. Blueprint
// section 16: contradictory sources produce an escalation, not a silent
// overwrite - and the honest version of an escalation in a four-person office is
// putting both in front of whoever asked.
export function disagree(claims: Claim[]): boolean {
  const byLender = new Map<string, Claim[]>()
  for (const c of claims) {
    const k = flat(c.lender)
    byLender.set(k, [...(byLender.get(k) || []), c])
  }
  for (const list of byLender.values()) {
    if (list.length < 2) continue
    if (new Set(list.map(c => rankOf(c.tier))).size > 1) return true
  }
  return false
}

// --- how old is too old ----------------------------------------------------
//
// Hedged, never hidden. A note that has not been looked at in a while is still
// the best thing we have; Paco says when it was written and lets a person
// decide. Written policy lasts longer than what somebody saw once.
export const AGEING_DAYS: Record<Tier, number> = { A: 365, B: 180, C: 180, D: 90 }

const DAY = 86_400_000

export function ageingAt(c: Claim, now: Date = new Date()): boolean {
  const t = Date.parse(txt(c?.when))
  if (!Number.isFinite(t)) return false
  const days = (now.getTime() - t) / DAY
  return days > (AGEING_DAYS[txt(c?.tier) as Tier] ?? 90)
}

// --- the words --------------------------------------------------------------
//
// Assembled from fields, exactly like the rest of Paco. The only free text is
// the note itself, and it is reproduced rather than rewritten.

export function attribution(c: Claim, now: Date = new Date()): string {
  const when = txt(c.when).slice(0, 10)
  const bits = [tierLabel(c.tier), txt(c.who) || 'someone here', when].filter(Boolean)
  const old = ageingAt(c, now) ? ' · worth re-checking' : ''
  return bits.join(' · ') + old
}

/** The line under an unofficial note, so it can never read as lender policy. */
export function caveatFor(c: Claim): string {
  return isOfficial(c.tier) ? '' : 'Not lender policy — confirm with the lender or BDM.'
}
