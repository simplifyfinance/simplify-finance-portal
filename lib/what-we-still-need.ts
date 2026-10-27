// WHAT WE STILL NEED FROM THE CLIENT, AND WHO HAS BEEN ASKED.
//
// 27 Oct 2026. Catherine, Operations Manager, on why deals keep coming back:
// "we are stuglging as there a feel gaps we need customers to clarify for
// example employment history we need 3 years same with addres history and some
// other etc". Then her list - address history, employment history, home
// contents, car make and model and year, super balance, shares, other assets,
// marital status, dependants and their ages.
//
// THE PORTAL ALREADY KNOWS NEARLY ALL OF IT. totalHistoryMonths() has been
// adding up address and employment history since September. The assets are
// typed. Marital status is a dropdown. Not one of those facts has ever been
// turned into a question a client could answer, because there has never been
// anywhere to put a question that is not a document request.
//
// THAT IS THE WHOLE DIFFERENCE. A document request says "employment history"
// and the client sends a payslip, because that is the only employment paper
// they own, and then credit asks again. A question says "who did you work for
// before January 2024" and there is exactly one answer and they already know
// it.
//
// THREE RULES THIS FILE HOLDS:
//
// 1. A QUESTION EXISTS ONLY WHILE THE GAP DOES. Nothing here is saved as a
//    list. It is worked out fresh from the fact find every time, same as the
//    document list - fill the gap and the question is gone, and nobody has to
//    remember to take it out. A list saved when the BC was written would be
//    wrong by the afternoon.
//
// 2. WHAT IS SAVED IS ONLY WHAT A HUMAN DID. When it was first asked, whether
//    a broker dropped it from one email, whether somebody ticked it off, and
//    any question a person typed themselves. Those file under the question's
//    `key`, and a key that no longer appears is ignored - so deleting an
//    applicant can never break this.
//
// 3. ASKED IS NOT ANSWERED. The portal can only see the fact find. A client
//    who replied to an email has not answered anything until somebody types it
//    in, and the next email will ask again. Fabio and I agreed that is right:
//    asking twice costs a sentence, finding out at submission costs a week.
import { REQUIRED_HISTORY_MONTHS, totalHistoryMonths, fullName,
         gapsInHistory, gapInWords, type HistoryGap } from './fact-find'

// ---------------------------------------------------------------------------
// WHAT A QUESTION IS
// ---------------------------------------------------------------------------

export type GapKind =
  | 'address_history'
  | 'employment_history'
  | 'employment_gap'
  | 'address_gap'
  | 'residency'
  | 'marital'
  | 'dependant_ages'
  | 'vehicle'
  | 'home_contents'
  | 'super'
  | 'shares'
  | 'by_hand'

export type Question = {
  /** Stable. Everything a human did files under this. */
  key: string
  kind: GapKind
  /** Who it is about, for the broker's list. Empty where it is the household. */
  who: string
  /**
   * Whose applicant record the answer belongs on. Empty on a household
   * question. Carried rather than parsed back out of the key, because a key is
   * an identifier and the moment anything reads meaning out of one, renaming it
   * breaks something a long way away.
   */
  applicantId?: string
  /** The sentence the CLIENT reads. Never jargon, never a field name. */
  ask: string
  /** One line under it, or empty. */
  help: string
  /** Why it is here, for the broker only. Never sent. */
  why: string
  /**
   * A gap the portal found closes itself when the gap closes. A question a
   * person typed cannot - the portal has no idea what would answer it - so it
   * stays until somebody ticks it off.
   */
  closesItself: boolean
  /** Set on a question somebody typed. */
  addedBy?: string
  addedAt?: string
}

/** What a human has done to a question. Saved; everything else is worked out. */
export type QuestionMark = {
  /** When it first went out. Null until an email carrying it is sent. */
  askedAt?: string | null
  /**
   * The words it went out with. Kept because the gap it came from will be gone
   * and a closed question still has to read as something a year later - the
   * same reason a deal keeps its own copy of a commission split.
   */
  ask?: string
  /** Taken off one email by a broker. Not an answer. */
  dropped?: boolean
  /** Ticked off by a person. Only ever used on a question a person typed. */
  closedAt?: string | null
  closedBy?: string | null
}

export type Marks = Record<string, QuestionMark>

const txt = (v: any) => String(v ?? '').trim()
const list = (v: any) => (Array.isArray(v) ? v : [])

function ff(deal: any): any {
  return deal?.fact_find_data || {}
}

function applicantsOf(deal: any): any[] {
  return list(ff(deal).applicants)
}

/** First name where there is one, so a question reads like a person wrote it. */
function callThem(a: any, i: number): string {
  return txt(a?.firstName) || txt(fullName(a)) || `Applicant ${i + 1}`
}

// ---------------------------------------------------------------------------
// THE GAPS THE PORTAL CAN SEE
// ---------------------------------------------------------------------------

/** The month a run of history reaches back to, as a client would say it. */
export function reachesBackTo(entries: any[], today = new Date()): string {
  const starts = list(entries)
    .map(e => txt(e?.startDate))
    .filter(Boolean)
    .map(s => new Date(s))
    .filter(d => !isNaN(d.getTime()) && d.getTime() <= today.getTime())
  if (!starts.length) return ''
  const earliest = new Date(Math.min(...starts.map(d => d.getTime())))
  return earliest.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

function monthsWord(n: number): string {
  return `${n} ${n === 1 ? 'month' : 'months'}`
}

function addressQuestions(deal: any, today: Date): Question[] {
  const out: Question[] = []
  applicantsOf(deal).forEach((a, i) => {
    const months = totalHistoryMonths(list(a?.addresses), today)
    if (months >= REQUIRED_HISTORY_MONTHS) return
    const name = callThem(a, i)
    const back = reachesBackTo(list(a?.addresses), today)
    out.push({
      key: `address_history:${txt(a?.id) || i}`,
      kind: 'address_history',
      who: name,
      applicantId: txt(a?.id),
      // A DATE, NOT A MONTH COUNT. Nobody can act on "eleven months short".
      ask: back
        ? `${name} — where did you live before ${back}?`
        : `${name} — what are your last three years of addresses?`,
      help: back
        ? 'Lenders need three years of address history. I have everything from '
          + `${back} onwards, so I just need the address before that and roughly the dates.`
        : 'Lenders need three years. The address, whether you rented or owned, and roughly the dates.',
      why: `${monthsWord(months)} of the ${REQUIRED_HISTORY_MONTHS} a lender needs.`,
      closesItself: true,
    })
  })
  return out
}

function employmentQuestions(deal: any, today: Date): Question[] {
  const out: Question[] = []
  applicantsOf(deal).forEach((a, i) => {
    // Secondary employment runs ALONGSIDE the primary, so counting it would
    // double up the same months and make a short history look complete.
    const primary = list(a?.employment).filter((e: any) => txt(e?.employmentPriority) !== 'Secondary')
    const months = totalHistoryMonths(primary, today)
    if (months >= REQUIRED_HISTORY_MONTHS) return
    const name = callThem(a, i)
    const back = reachesBackTo(primary, today)
    out.push({
      key: `employment_history:${txt(a?.id) || i}`,
      kind: 'employment_history',
      who: name,
      applicantId: txt(a?.id),
      ask: back
        ? `${name} — who did you work for before ${back}?`
        : `${name} — what are your last three years of work?`,
      help: 'Just the employer, what you did there and roughly the months is fine. '
        + 'Time not working counts too — it is still history.',
      why: `${monthsWord(months)} of the ${REQUIRED_HISTORY_MONTHS} a lender needs.`,
      closesItself: true,
    })
  })
  return out
}

// A GAP IN THE MIDDLE IS ITS OWN QUESTION, AND NOT THE SAME ONE.
//
// 27 Oct 2026. "You have 41 months of history" and "there are four months in
// the middle of it nobody has accounted for" are different things, and a client
// can only answer the second one if you tell them which four months.
//
// NOT ALWAYS A JOB. A gap in employment is as likely to be a real answer nobody
// wrote down - travel, study, a baby, looking after somebody - as it is a job
// that was forgotten. So the question asks what they were doing, not who they
// worked for, and the answer goes to credit either way.
function gapQuestions(deal: any, today: Date): Question[] {
  const out: Question[] = []
  applicantsOf(deal).forEach((a, i) => {
    const name = callThem(a, i)
    const id = txt(a?.id)

    const jobs = list(a?.employment).filter((e: any) => txt(e?.employmentPriority) !== 'Secondary')
    gapsInHistory(jobs, today).forEach((g: HistoryGap, k: number) => {
      out.push({
        key: `employment_gap:${id || i}:${g.from.toISOString().slice(0, 7)}`,
        kind: 'employment_gap',
        who: name,
        applicantId: id,
        ask: `${name} — what were you doing between ${gapInWords(g)}?`,
        help: 'Another job, travelling, studying, between things — whatever it was is fine. '
          + 'Lenders ask about any break, they do not mind what it was.',
        why: `${monthsWord(g.months)} unaccounted for between two jobs.`,
        closesItself: true,
      })
    })

    gapsInHistory(list(a?.addresses), today).forEach((g: HistoryGap) => {
      out.push({
        key: `address_gap:${id || i}:${g.from.toISOString().slice(0, 7)}`,
        kind: 'address_gap',
        who: name,
        applicantId: id,
        ask: `${name} — where were you living between ${gapInWords(g)}?`,
        help: 'The address and roughly the dates is all we need.',
        why: `${monthsWord(g.months)} with no address recorded.`,
        closesItself: true,
      })
    })
  })
  return out
}

function residencyQuestions(deal: any): Question[] {
  return applicantsOf(deal).flatMap((a, i) => {
    if (txt(a?.residencyStatus)) return []
    const name = callThem(a, i)
    return [{
      key: `residency:${txt(a?.id) || i}`,
      kind: 'residency' as GapKind,
      who: name,
      applicantId: txt(a?.id),
      ask: `${name} — are you an Australian citizen, a permanent resident, or here on a visa?`,
      help: 'It changes which lenders we can use, so we ask everybody.',
      why: 'No residency status recorded.',
      closesItself: true,
    }]
  })
}

function maritalQuestions(deal: any): Question[] {
  return applicantsOf(deal).flatMap((a, i) => {
    if (txt(a?.relationshipStatus)) return []
    const name = callThem(a, i)
    return [{
      key: `marital:${txt(a?.id) || i}`,
      kind: 'marital' as GapKind,
      who: name,
      applicantId: txt(a?.id),
      ask: `${name} — are you single, married, in a de facto relationship, separated, divorced or widowed?`,
      help: '',
      why: 'No marital status recorded.',
      closesItself: true,
    }]
  })
}

function dependantQuestions(deal: any): Question[] {
  const data = ff(deal)
  const count = Number(txt(data?.dependants) || '0')
  if (!Number.isFinite(count) || count <= 0) return []
  // A COUNT IS NOT AN AGE. Two dependants aged 2 and 4 and two aged 19 and 22
  // are not the same household and nothing in the portal could tell them apart.
  const ages = list(data?.dependantAges).map(txt).filter(Boolean)
  if (ages.length >= count) return []
  return [{
    key: 'dependant_ages',
    kind: 'dependant_ages',
    who: '',
    ask: count === 1
      ? 'How old is your dependant?'
      : `You have ${count} dependants — how old is each of them?`,
    help: 'Age in years is enough.',
    why: ages.length
      ? `${ages.length} of ${count} ages recorded.`
      : `Count says ${count}. No ages recorded.`,
    closesItself: true,
  }]
}

// ASSETS: NOBODY ASKED IS NOT THEY HAVE NONE.
//
// An empty list says nothing. No shares row might mean no shares, or might mean
// the conversation never got that far, and credit cannot tell - so credit asks,
// so the client is chased for something they already said. Exactly the rule
// Fabio settled on the commission split: "nobody has checked" and "none" are
// different answers and both have to be writable.
//
// Saying "we have none" closes the question, with who said so and when. That IS
// the record. There is no separate nil box to keep in step with it.
type AssetGap = { kind: GapKind; type: string; ask: string; help: string; why: string }

const ASSET_GAPS: AssetGap[] = [
  { kind: 'home_contents', type: 'Home Contents',
    ask: 'Roughly what are your home contents worth?',
    help: 'Furniture, white goods, the usual. A round number is fine — nobody itemises this.',
    why: 'No home contents recorded, and nobody has said there are none.' },
  { kind: 'vehicle', type: 'Vehicle',
    ask: 'What cars do you have, and roughly what is each worth?',
    help: 'Make, model and year for each one.',
    why: 'No vehicle recorded, and nobody has said there is none.' },
  { kind: 'super', type: 'Super',
    ask: 'What is your superannuation balance, and who is it with?',
    help: 'The latest figure you can see is fine.',
    why: 'No super recorded, and nobody has said there is none.' },
  { kind: 'shares', type: 'Shares',
    ask: 'Do you hold any shares or managed funds, and roughly what are they worth?',
    help: '',
    why: 'No shares recorded, and nobody has said there are none.' },
]

/** A row of this type with something actually in it. */
function hasAsset(deal: any, type: string): boolean {
  return list(ff(deal).assets).some((a: any) =>
    txt(a?.assetType) === type && (txt(a?.value) || txt(a?.description)))
}

/**
 * SOMEBODY SAID THEY HAVE NONE, AND THAT IS AN ANSWER.
 *
 * Not a nil row. A nil asset would show up in the position and in every total
 * that reads the assets; this is a note saying the question was put and the
 * answer was no. Without it a client who says "we do not own a car" is asked
 * about the car again in the next email, which is exactly the chasing this was
 * built to stop.
 */
function saidTheyHaveNone(deal: any, kind: GapKind): boolean {
  const said = ff(deal)?.nothingToDeclare
  return Boolean(said && typeof said === 'object' && txt(said[kind as string]))
}

/** A vehicle row that nobody has described properly is still a gap. */
function vehicleIsVague(deal: any): boolean {
  const cars = list(ff(deal).assets).filter((a: any) => txt(a?.assetType) === 'Vehicle')
  if (!cars.length) return false
  return cars.some((c: any) => !txt(c?.make) || !txt(c?.model) || !txt(c?.year))
}

function assetQuestions(deal: any): Question[] {
  return ASSET_GAPS.flatMap(g => {
    if (saidTheyHaveNone(deal, g.kind)) return []
    const missing = !hasAsset(deal, g.type)
    const vague = g.kind === 'vehicle' && vehicleIsVague(deal)
    if (!missing && !vague) return []
    return [{
      key: `asset:${g.kind}`,
      kind: g.kind,
      who: '',
      ask: g.ask,
      help: g.help,
      why: vague ? 'A car is recorded, but not its make, model and year.' : g.why,
      closesItself: true,
    }]
  })
}

/**
 * EVERY GAP THE PORTAL CAN SEE, WORKED OUT FRESH.
 *
 * Order matters: this is read top to bottom by a client, so the two that hold
 * a file up come first and the asset sweep comes last.
 */
export function gapsFound(deal: any, today = new Date()): Question[] {
  // A DEAL WITH NO APPLICANTS IS NOT A DEAL YET.
  //
  // Without this, a brand new file asks for home contents, a car and a share
  // portfolio belonging to nobody - because "no assets recorded" is true of an
  // empty fact find in exactly the way it is true of a real one. There is no
  // client to ask, so there is nothing to ask.
  if (!applicantsOf(deal).length) return []
  return [
    ...addressQuestions(deal, today),
    ...employmentQuestions(deal, today),
    ...gapQuestions(deal, today),
    ...residencyQuestions(deal),
    ...maritalQuestions(deal),
    ...dependantQuestions(deal),
    ...assetQuestions(deal),
  ]
}

// ---------------------------------------------------------------------------
// QUESTIONS SOMEBODY TYPED
// ---------------------------------------------------------------------------

// Fabio, 27 Oct 2026, asked whether credit should be able to add their own:
// "yes I want them to ask questions as well".
//
// TIED TO THE DEAL, NOT A BANK IN SETTINGS. "Is the Brunswick place still
// tenanted" is about one file. A question bank nobody prunes is noise on every
// deal inside a month.
//
// AND IT CANNOT CLOSE ITSELF. The portal has no idea what would answer it, so
// it stays until a person ticks it off - and it says who added it and when, so
// a question nobody recognises can be traced rather than guessed at.
export function askedByHand(deal: any): Question[] {
  return list(deal?.questions_added).map((q: any, i: number) => ({
    key: txt(q?.key) || `by_hand:${i}`,
    kind: 'by_hand' as GapKind,
    who: txt(q?.who),
    ask: txt(q?.ask),
    help: txt(q?.help),
    why: txt(q?.addedBy) ? `Added by ${txt(q.addedBy)}.` : 'Added by hand.',
    closesItself: false,
    addedBy: txt(q?.addedBy),
    addedAt: txt(q?.addedAt),
  })).filter(q => q.ask)
}

export function newHandQuestion(ask: string, help: string, who: string, now = new Date()) {
  return {
    key: `by_hand:${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ask: txt(ask), help: txt(help), addedBy: txt(who), addedAt: now.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// WHAT HUMANS HAVE DONE TO THEM
// ---------------------------------------------------------------------------

export function marksOn(deal: any): Marks {
  const raw = deal?.questions_state
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Marks : {}
}

export function markFor(deal: any, key: string): QuestionMark {
  return marksOn(deal)[key] || {}
}

/** Every question on this deal: the ones found, then the ones typed. */
export function allQuestions(deal: any, today = new Date()): Question[] {
  return [...gapsFound(deal, today), ...askedByHand(deal)]
}

/**
 * IS IT STILL OPEN?
 *
 * A gap the portal found is open while the gap is there - its mere presence in
 * gapsFound() is the answer, so nothing has to be ticked. A question somebody
 * typed is open until a person closes it.
 *
 * A DROPPED QUESTION IS STILL OPEN. Unticking takes it off ONE email. It does
 * not say the answer is known, and if it were known it would be on the fact
 * find and the question would have gone on its own.
 */
export function isOpen(deal: any, q: Question): boolean {
  if (q.closesItself) return true
  return !txt(markFor(deal, q.key).closedAt)
}

export function openQuestions(deal: any, today = new Date()): Question[] {
  return allQuestions(deal, today).filter(q => isOpen(deal, q))
}

/** The ones that WERE asked and are not open any more, newest first. */
export type Closed = {
  key: string
  ask: string
  askedAt: string
  /**
   * EMPTY ON A GAP THAT CLOSED ITSELF, AND THAT IS HONEST.
   *
   * Nothing watches the fact find. A gap closes the moment somebody types the
   * missing address in, and the portal only finds out next time a screen is
   * drawn - so there is no moment to record. Printing the date it was ASKED
   * here would read as the date it was answered, which is a lie told by a
   * fallback, and this codebase has shipped enough of those.
   *
   * The client answers page fills this in, because that IS a moment and it
   * knows who was typing. See round three.
   */
  closedAt: string
  closedBy: string
}

export function closedQuestions(deal: any, today = new Date()): Closed[] {
  const open = new Set(openQuestions(deal, today).map(q => q.key))
  const marks = marksOn(deal)
  const typed = new Map(askedByHand(deal).map(q => [q.key, q.ask]))
  return Object.entries(marks)
    .filter(([key, m]) => !open.has(key) && txt(m?.askedAt))
    .map(([key, m]) => ({
      key,
      // A GAP THAT CLOSED HAS NO SENTENCE ANY MORE, because the question only
      // existed while the gap did. The mark keeps the words it went out with.
      ask: typed.get(key) || txt(m?.ask) || 'Answered',
      askedAt: txt(m?.askedAt),
      closedAt: txt(m?.closedAt),
      closedBy: txt(m?.closedBy),
    }))
    .sort((a, b) => (b.closedAt || b.askedAt).localeCompare(a.closedAt || a.askedAt))
}

/** "Answered" or "Answered 16 Oct by Priya" - never a date we are guessing at. */
export function closedLine(c: Closed): string {
  const when = shortDate(c.closedAt)
  const who = txt(c.closedBy)
  if (!when) return who ? `Answered by ${who}` : 'Answered'
  return who ? `Answered ${when} by ${who}` : `Answered ${when}`
}

/** What goes in the next email: open, and not dropped from this one. */
export function goingOut(deal: any, dropped: string[] = [], today = new Date()): Question[] {
  const off = new Set(dropped.map(txt))
  return openQuestions(deal, today).filter(q => !off.has(q.key))
}

// ---------------------------------------------------------------------------
// FIRST ASK OR SECOND ASK
// ---------------------------------------------------------------------------

export function daysSince(iso: any, today = new Date()): number | null {
  const d = new Date(txt(iso))
  if (!txt(iso) || isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86_400_000))
}

export function shortDate(iso: any): string {
  const d = new Date(txt(iso))
  if (!txt(iso) || isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

/** "Asked 14 Oct · 14 days", or empty where this is the first time. */
export function askedLine(deal: any, key: string, today = new Date()): string {
  const at = markFor(deal, key).askedAt
  if (!txt(at)) return ''
  const days = daysSince(at, today)
  return `Asked ${shortDate(at)}${days === null ? '' : ` · ${days} ${days === 1 ? 'day' : 'days'}`}`
}

/**
 * THE HEADING ON THE BLOCK, WHICH IS NOT THE SAME SENTENCE TWICE.
 *
 * A second ask that does not say it is a second ask is just the same email
 * again. So the first one is a request and the second one names the date.
 */
export function blockHeading(deal: any, going: Question[], today = new Date()): string {
  if (!going.length) return ''
  const again = going.filter(q => txt(markFor(deal, q.key).askedAt)).length
  if (!again) return 'A few things I still need from you'
  if (again === going.length) {
    return again === 1 ? 'Still waiting on one thing' : `Still waiting on ${again} things`
  }
  return 'A few things I still need from you'
}

export function blockLead(deal: any, going: Question[], today = new Date()): string {
  const again = going.filter(q => txt(markFor(deal, q.key).askedAt))
  if (!again.length) return 'These take a minute and you can answer straight back to this email.'
  const oldest = again
    .map(q => txt(markFor(deal, q.key).askedAt))
    .sort()[0]
  return `I asked about ${again.length === 1 ? 'this' : 'these'} on ${shortDate(oldest)}`
    + ' — I cannot submit without them.'
}

// ---------------------------------------------------------------------------
// WRITING IT DOWN
// ---------------------------------------------------------------------------

/**
 * SENDING AN EMAIL RECORDS WHEN EACH QUESTION FIRST WENT OUT, AND ONLY THEN.
 *
 * The date is the one thing here that cannot be worked out again later, and it
 * is the whole reason the LO can say "asked on 14 October" rather than sending
 * the same sentence twice. An askedAt that is already set is never moved - the
 * first ask is the one that counts for how long somebody has been waiting.
 */
export function askedPatch(deal: any, keys: string[], now = new Date()): Record<string, any> {
  const marks = { ...marksOn(deal) }
  const open = new Map(openQuestions(deal, now).map(q => [q.key, q]))
  let touched = false
  for (const key of keys.map(txt).filter(Boolean)) {
    const was = marks[key] || {}
    if (txt(was.askedAt)) continue
    marks[key] = {
      ...was,
      askedAt: now.toISOString(),
      // The words it went out with, so a closed question still reads as
      // something a year later even though the gap it came from is gone.
      ...(open.get(key) ? { ask: open.get(key)!.ask } : {}),
    }
    touched = true
  }
  return touched ? { questions_state: marks } : {}
}

/** A person ticking off a question a person typed. Never used on a found gap. */
export function closeByHandPatch(deal: any, key: string, who: string, now = new Date()) {
  const marks = { ...marksOn(deal) }
  marks[txt(key)] = { ...(marks[txt(key)] || {}), closedAt: now.toISOString(), closedBy: txt(who) }
  return { questions_state: marks }
}

export function reopenPatch(deal: any, key: string) {
  const marks = { ...marksOn(deal) }
  const was = { ...(marks[txt(key)] || {}) }
  delete was.closedAt
  delete was.closedBy
  marks[txt(key)] = was
  return { questions_state: marks }
}

// THE LINK THE CLIENT OPENS LIVES IN lib/answers-link.ts.
//
// It is signed and carries the deal and its expiry inside itself, like the
// Ready and Opportunity links beside it, so there is no column here to keep in
// step and nothing in this file knows about it. That also keeps this file out
// of node's crypto, which matters because the BC panel imports it in a browser.
