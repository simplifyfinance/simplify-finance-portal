import { createSupabaseAdmin } from './supabase-admin'
import { patchDealColumn } from './patch-deal-column'
import { verifyAnswers, hasExpired, type AnswersPayload } from './answers-link'
import { openQuestions, marksOn, type Question } from './what-we-still-need'
import { applyAnswers, keysAnswered, type Answer } from './answers-from-the-client'

// THE PAGE A CLIENT OPENS TO ANSWER WHAT IS STILL MISSING.
//
// 27 Oct 2026. Read this before touching anything in here:
//
// A CLIENT HAS NO SESSION. They have never logged in to anything and never
// will. On 23 Sep 2026 every client who pressed Proceed in a borrowing capacity
// email got a page saying it does not exist, because the page read the deal
// using the VISITOR's session and row level security correctly returned
// nothing. Four weeks, 22 deals, and the office doing it by hand without
// knowing there was anything to work around.
//
// So the read AND the write both use createSupabaseAdmin(). Both. Fixing one
// and not the other gives a client a page that looks fine and then tells them
// it could not be saved - which is the second half of that same bug.
// lib/the-client-pages-work-logged-out.test.ts exists so it cannot happen
// again on any client page, and this is the fourth.

// ONLY WHAT THE QUESTION NEEDS, AND NOT ONE FIELD MORE.
//
// 27 Oct 2026. Fabio, on the answers page: "thats really important cleints dont
// have access to the portal". He is right and checking it found this.
//
// THE FIRST VERSION HANDED THE WHOLE FACT FIND TO THE BROWSER so the form could
// print the current address above "where did you live before September 2024".
// A client component's props are serialised into the page source, so that is
// every income figure, every liability, both applicants' dates of birth and
// everything else on the file, readable by anybody holding the link - and the
// form used four strings out of it.
//
// So the locked lines are built HERE, on the server, as plain sentences. What
// crosses to the browser is the question, the applicant it belongs to, and the
// one or two lines of their own history the question refers to. Nothing else
// about the deal exists on that page: no figures, no lender, no commission, no
// notes, no other deal, no other client.
export type ClientQuestion = {
  key: string
  kind: string
  applicantId: string
  /** The sentence they read. */
  ask: string
  help: string
  /** Their own history, as one line each, shown locked. Never a record. */
  known: string[]
  /** How many boxes to draw. Only the dependants question uses it. */
  count?: number
}

export type AnswersView =
  | { ok: false; why: 'expired' | 'unknown' }
  | { ok: true; dealId: string; sentOn: string; firstName: string; brokerName: string
      questions: ClientQuestion[] }

export async function loadAnswers(token: string, today = new Date()): Promise<AnswersView> {
  const payload: AnswersPayload | null = verifyAnswers(token, today)
  if (!payload) return { ok: false, why: hasExpired(token, today) ? 'expired' : 'unknown' }

  // The key that does not need a login. See the note at the top.
  const supabase = createSupabaseAdmin()
  const { data: deal } = await supabase
    .from('deals').select('*, clients(first_name, last_name)').eq('id', payload.dealId).single()
  if (!deal) return { ok: false, why: 'unknown' }

  const ff = deal.fact_find_data || {}
  const first = String(ff?.applicants?.[0]?.firstName || deal.clients?.first_name || '').trim()
  return {
    ok: true,
    dealId: String(deal.id),
    sentOn: payload.sentOn,
    firstName: first,
    brokerName: String(deal.broker_first_name || '').trim(),
    questions: openQuestions(deal, today).map(q => forTheClient(q, ff)),
  }
}

const txt = (v: any) => String(v ?? '').trim()
const list = (v: any) => (Array.isArray(v) ? v : [])

function forTheClient(q: Question, ff: any): ClientQuestion {
  const id = txt(q.applicantId)
  const who = list(ff?.applicants).find((a: any) => txt(a?.id) === id)
  return {
    key: q.key,
    kind: String(q.kind),
    applicantId: id,
    ask: q.ask,
    help: q.help,
    // NOT q.why. That sentence is for the broker - "25 months of the 36 a
    // lender needs" is our business, not something to put in front of a client.
    known: q.kind === 'address_history' ? knownAddresses(who)
      : q.kind === 'employment_history' ? knownJobs(who)
      : [],
    ...(q.kind === 'dependant_ages' ? { count: dependantCount(ff) } : {}),
  }
}

function knownAddresses(a: any): string[] {
  return list(a?.addresses)
    .filter((x: any) => txt(x?.address) || txt(x?.startDate))
    .map((x: any) => [txt(x.address) || 'Address recorded', txt(x.residentialStatus), span(x)]
      .filter(Boolean).join(' \u00b7 '))
}

function knownJobs(a: any): string[] {
  return list(a?.employment)
    .filter((e: any) => txt(e?.employmentPriority) !== 'Secondary')
    .filter((e: any) => txt(e?.employerName) || txt(e?.startDate))
    .map((e: any) => [txt(e.employerName) || 'Employer recorded', txt(e.occupation), span(e)]
      .filter(Boolean).join(' \u00b7 '))
}

function span(e: any): string {
  const from = month(e?.startDate)
  const to = e?.isCurrent ? 'now' : month(e?.endDate)
  if (!from && !to) return ''
  return `${from || '?'} \u2192 ${to || '?'}`
}

function month(v: any): string {
  const d = new Date(txt(v))
  if (!txt(v) || isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

function dependantCount(ff: any): number {
  const n = Number(txt(ff?.dependants) || '0')
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 1
}

export type SaveResult = { ok: true; closed: string[] } | { ok: false; why: string }

/**
 * WHAT THEY TYPED, ONTO THE FACT FIND.
 *
 * patchDealColumn re-reads the record, applies the change to what the database
 * holds RIGHT NOW and pins the write to the version it read - so a broker
 * saving the fact find in the same second cannot have their work replaced by a
 * copy this page was rendered with. That was the Wesley Perrott fault and it is
 * the reason this does not write fact_find_data directly.
 *
 * It is an ordinary save, so the version it replaced goes into the deal history
 * with the client's name on it. Undoing is one press and nothing is ever lost.
 */
export async function saveAnswers(
  token: string, answers: Answer[], today = new Date(),
): Promise<SaveResult> {
  const payload = verifyAnswers(token, today)
  if (!payload) return { ok: false, why: hasExpired(token, today) ? 'expired' : 'unknown' }
  if (!answers?.length) return { ok: true, closed: [] }

  const supabase = createSupabaseAdmin()
  const { data: before } = await supabase
    .from('deals').select('fact_find_data, questions_state').eq('id', payload.dealId).single()
  if (!before) return { ok: false, why: 'unknown' }

  const who = String(
    before.fact_find_data?.applicants?.[0]?.firstName || 'The client').trim()
  const { problem } = await patchDealColumn(
    supabase, payload.dealId, 'fact_find_data',
    current => applyAnswers(current, answers, today),
    before.fact_find_data || {},
    { name: `${who} (answered the email)` },
  )
  if (problem) return { ok: false, why: problem }

  // WHO ANSWERED IT, AND WHEN. The only moment this is knowable.
  //
  // A gap closes the instant somebody types the missing address in, and nothing
  // watches the fact find - so for an answer typed by a broker there is no
  // moment to record and the list honestly says "Answered" with no date. Here
  // there IS a moment and we know who was typing, so the broker's panel can say
  // "Answered 16 Oct by Priya" instead.
  const marks: Record<string, any> = { ...marksOn(before) }
  const closed = keysAnswered(answers)
  for (const key of closed) {
    marks[key] = { ...(marks[key] || {}), closedAt: today.toISOString(), closedBy: who }
  }
  const { error } = await supabase
    .from('deals').update({ questions_state: marks }).eq('id', payload.dealId)
  // A NOTE THAT DID NOT SAVE IS NOT A FAILURE. Their answers are on the fact
  // find, which is the part that matters. Telling them it went wrong would make
  // them type it all again.
  if (error) console.error('[saveAnswers] could not record who answered', error)

  return { ok: true, closed }
}
