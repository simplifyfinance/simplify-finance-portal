// SOMETHING'S WRONG HERE.
//
// 17 Aug 2026. Alan's November brief, item 5. His own clarification is the
// spec: "It's a correction workflow: someone on the team spots something
// wrong, they flag it in the portal, Cath gets copied in, and she checks that
// the fix has actually been applied so the same error doesn't come back. Close
// the loop, don't repeat the mistake."
//
// WHAT THIS IS NOT. It is not a count of errors, it is not a report, and
// nobody's name goes against a mistake. Fabio: "I don't see the point of
// counting errors." Alan: "that's not what this is." So there is no total
// anywhere in this file.
//
// FIXED AND CHECKED ARE TWO STATES, because they are two people. Somebody says
// they fixed it; until the person who owns corrections has looked, it is not
// done. The gap between those two is where a fix quietly fails to hold, and
// closing it is the whole of what was asked for.
//
// AND NOBODY IS NAMED IN THE INTERFACE. The button says "Tell management",
// not a person - Fabio, 17 Aug: "in case she moves on". Who actually gets the
// email is a setting.

const txt = (v: any) => String(v ?? '').trim()

// WHERE IT WAS SEEN. Free text in the database so a screen added next month
// does not need a migration, and a list here so the box can offer the ones
// that exist today.
export const WHERE_OPTIONS = [
  'Fact find',
  'Borrowing capacity',
  'Lending options',
  'Compliance',
  'Settlement',
  'Lender library',
  'Somewhere else',
] as const

export type Scope = 'library' | 'deal'

export const SCOPE_LABEL: Record<Scope, string> = {
  library: 'The library — wrong for everyone',
  deal: 'Just this deal',
}

// What it is costing, said on the card. A library flag is wrong on every quote
// until it is fixed; a deal flag is wrong on one file. That difference is why
// the library ones get looked at first, and it is worth saying rather than
// leaving somebody to work out.
export const SCOPE_COST: Record<Scope, string> = {
  library: 'Wrong on every quote until it is fixed.',
  deal: 'Wrong on this deal only.',
}

export type Flag = {
  id: string
  deal_id?: string | null
  where_at: string
  scope: Scope
  description: string
  raised_by_name?: string | null
  raised_at: string
  fixed_at?: string | null
  fixed_by_name?: string | null
  checked_at?: string | null
  checked_by_name?: string | null
  sent_back_at?: string | null
  sent_back_why?: string | null
}

export type Status = 'waiting_on_a_fix' | 'ready_to_check' | 'closed'

export const STATUS_LABEL: Record<Status, string> = {
  waiting_on_a_fix: 'Waiting on a fix',
  ready_to_check: 'Ready to check',
  closed: 'Closed',
}

/**
 * Where a flag is up to, from its dates.
 *
 * Checked wins over fixed, because a flag sent back and fixed again carries
 * both. Nothing is stored that says "status" - a second copy of an answer the
 * dates already give is how two screens come to disagree.
 */
export function statusOf(f: Flag | null | undefined): Status {
  if (txt(f?.checked_at)) return 'closed'
  if (txt(f?.fixed_at)) return 'ready_to_check'
  return 'waiting_on_a_fix'
}

export function isOpen(f: Flag): boolean {
  return statusOf(f) !== 'closed'
}

/** The two piles the list is worked from. */
export function waitingOnAFix(list: Flag[]): Flag[] {
  return (list || []).filter(f => statusOf(f) === 'waiting_on_a_fix')
}

export function readyToCheck(list: Flag[]): Flag[] {
  return (list || []).filter(f => statusOf(f) === 'ready_to_check')
}

/** The open ones on one deal, newest last, for the card in the rail. */
export function openOn(list: Flag[], dealId: string): Flag[] {
  const want = txt(dealId)
  return (list || [])
    .filter(f => txt(f?.deal_id) === want && isOpen(f))
    .sort((a, b) => txt(a.raised_at).localeCompare(txt(b.raised_at)))
}

// FORGOTTEN, NOT WRONG.
//
// The only case where a flag turns red. A fortnight with nobody touching it is
// the point it stops being in hand and starts being forgotten - which is the
// thing Alan is trying to prevent. Up to then it is blue, because work in hand
// is not a fault.
export const FORGOTTEN_DAYS = 14

export function forgotten(f: Flag, now: Date = new Date()): boolean {
  if (!isOpen(f)) return false
  // THE LAST THING THAT HAPPENED, whichever it was. Not the first one filled
  // in - a flag sent back on the 7th and fixed again on the 9th has both, and
  // reading them in a fixed order would start the clock from the wrong one.
  const t = Math.max(...[f.sent_back_at, f.fixed_at, f.raised_at]
    .map(d => new Date(txt(d)).getTime())
    .filter(n => Number.isFinite(n)), -Infinity)
  if (!Number.isFinite(t)) return false
  return (now.getTime() - t) / 86_400_000 >= FORGOTTEN_DAYS
}

// --- what it says -------------------------------------------------------------

/** "ANZ settlement fee showing $350…" — the first line, for a list. */
export function headline(f: Flag, max = 70): string {
  const one = txt(f?.description).split(/[\n.]/)[0].trim()
  return one.length > max ? one.slice(0, max - 1).trimEnd() + '…' : one
}

/** "Katie Nguyen · 17 Aug · Lending options" */
export function raisedLine(f: Flag, tz = 'Australia/Sydney'): string {
  return [txt(f?.raised_by_name), shortDate(f?.raised_at, tz), txt(f?.where_at)]
    .filter(Boolean).join(' · ')
}

/** The line on the deal's rail card while one is open. */
export function cardLine(f: Flag, tz = 'Australia/Sydney'): string {
  const who = txt(f?.raised_by_name)
  const when = shortDate(f?.raised_at, tz)
  const raised = `Flagged${who ? ' by ' + who : ''}${when ? ' on ' + when : ''}.`
  if (statusOf(f) === 'ready_to_check') {
    const fixed = shortDate(f?.fixed_at, tz)
    return `${raised} Fixed${fixed ? ' ' + fixed : ''}, waiting to be checked.`
  }
  return `${raised} Waiting on a fix.`
}

/** The file note, written when it is raised. */
export function noteWhenRaised(f: Flag): string {
  const where = txt(f.where_at)
  const cost = f.scope === 'library' ? ' Flagged as a library problem.' : ''
  return `Something wrong flagged${where ? ' on ' + where : ''}: ${txt(f.description)}${cost}`
}

/** And when it closes, so the deal carries the end as well as the start. */
export function noteWhenChecked(f: Flag): string {
  const who = txt(f.checked_by_name)
  return `The ${txt(f.where_at).toLowerCase() || 'flagged'} problem has been fixed and checked`
    + `${who ? ' by ' + who : ''}. ${txt(f.description)}`
}

// --- the two emails ------------------------------------------------------------

export function raisedSubject(f: Flag, dealName?: string): string {
  const where = txt(f.where_at)
  const deal = txt(dealName)
  return `Something's wrong: ${where || 'the portal'}${deal ? ' — ' + deal : ''}`
}

export function raisedBody(f: Flag, dealName?: string, url?: string): string {
  return [
    txt(f.raised_by_name) ? `${txt(f.raised_by_name)} has flagged something.` : 'Something has been flagged.',
    '',
    txt(f.description),
    '',
    `Where: ${txt(f.where_at) || 'not said'}`,
    txt(dealName) ? `Deal: ${txt(dealName)}` : 'No deal — raised in the library.',
    SCOPE_COST[f.scope] || '',
    txt(url) ? '' : null,
    txt(url) || null,
  ].filter(x => x !== null).join('\n')
}

// THE ONE THAT DOES NOT HAPPEN TODAY. Somebody sends a screenshot and never
// hears another word, so they keep working around it and the next person
// flags the same thing.
export function closedSubject(f: Flag): string {
  return `Fixed: ${headline(f, 50) || txt(f.where_at)}`
}

export function closedBody(f: Flag, dealName?: string): string {
  const who = txt(f.checked_by_name)
  const deal = txt(dealName)
  return [
    `Hi ${txt(f.raised_by_name).split(' ')[0] || 'there'},`,
    '',
    `The thing you flagged${deal ? ' on ' + deal : ''} has been fixed and checked.`,
    '',
    `You said: ${txt(f.description)}`,
    '',
    f.scope === 'library'
      ? `Fixed in the library${who ? ' and checked by ' + who : ''}.`
      : `Fixed on the deal${who ? ' and checked by ' + who : ''}.`,
    '',
    // WHAT IT DOES NOT FIX. A quote already sent still has the old figure on
    // it. Saying so is the difference between a fix and a surprise.
    f.scope === 'library'
      ? 'It is right on every new quote from now. Anything already sent is unchanged.'
      : 'Anything already sent on this deal is unchanged.',
  ].join('\n')
}

function shortDate(v: any, tz: string): string {
  const d = new Date(txt(v))
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-AU',
      { timeZone: tz, day: 'numeric', month: 'short' }).format(d)
  } catch { return '' }
}

// --- the list management works from ------------------------------------------

// LIBRARY FIRST, THEN BY AGE.
//
// A library problem is wrong on every quote until it is fixed; a deal problem
// is wrong on one file. That is the whole ordering rule, and it does not need
// a setting - nobody should have to decide what to look at first when the
// difference is that plain.
export function inWorkOrder(list: Flag[]): Flag[] {
  return (list || []).slice().sort((a, b) => {
    const sa = a?.scope === 'library' ? 0 : 1
    const sb = b?.scope === 'library' ? 0 : 1
    if (sa !== sb) return sa - sb
    return txt(a?.raised_at).localeCompare(txt(b?.raised_at))
  })
}

/**
 * The button that goes where the fix is.
 *
 * A library problem opens the lender library; a deal problem opens the deal.
 * Nobody should have to go looking for the screen they were told about.
 * A deal flag with no deal behind it falls back to the library rather than
 * offering a link to nowhere.
 */
export function whereToFixIt(f: Flag): { label: string; href: string } {
  const deal = txt(f?.deal_id)
  if (f?.scope === 'deal' && deal) return { label: 'Open the deal', href: `/deals/${deal}` }
  if (f?.scope === 'library') return { label: 'Open the lender library', href: '/lenders' }
  return deal
    ? { label: 'Open the deal', href: `/deals/${deal}` }
    : { label: 'Open the lender library', href: '/lenders' }
}

/**
 * Sent back: the fix did not hold.
 *
 * It returns to Waiting on a fix and the clock starts again. The trail keeps
 * the fix that failed rather than quietly rewinding, so the second attempt is
 * visibly a second attempt.
 */
export function noteWhenSentBack(f: Flag): string {
  const why = txt(f?.sent_back_why)
  return `The ${txt(f?.where_at).toLowerCase() || 'flagged'} problem was marked fixed, but it is not`
    + ` fixed.${why ? ' ' + why : ''}`
}

/** The line under a sent-back flag, so the next person knows it is attempt two. */
export function sentBackLine(f: Flag, tz = 'Australia/Sydney'): string {
  if (!txt(f?.sent_back_at)) return ''
  const when = shortDate(f?.sent_back_at, tz)
  const why = txt(f?.sent_back_why)
  return `Sent back${when ? ' ' + when : ''}${why ? ': ' + why : '.'}`
}
