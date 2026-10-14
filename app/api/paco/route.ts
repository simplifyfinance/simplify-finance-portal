import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { answer, HOLA, lenderAsked } from '@/lib/paco'
import { realDealsOnly } from '@/lib/test-deal'
import { sectionAnswer, type SectionAnswer } from '@/lib/paco-reads-the-section'
import { isUsable, type Claim } from '@/lib/paco-knowledge'
import { answerFrom, USABLE } from '@/lib/paco-answers-from-policy'
import { whereToGetIt, WHERE_THE_POLICY_LIVES } from '@/lib/where-the-policy-lives'
import { type PolicyRule } from '@/lib/policy-rules'
import { flat } from '@/lib/plain-words'

// THE BANK NAMES PACO CAN RECOGNISE IN A QUESTION.
//
// Every lender the source sweep covered, not only the ones we hold a rule for.
// A question about a bank with nothing on file is exactly the one worth
// answering with where to go and get it.
const KNOWN_LENDERS = WHERE_THE_POLICY_LIVES.map(w => w.lender)

// WHAT PACO IS ALLOWED TO LOOK AT.
//
// 12 Oct 2026. One route, and it is deliberately thin: it fetches the deals,
// hands them to lib/paco.ts and returns what comes back. Every decision about
// what he says is in that file, where it can be tested without a database.
//
// NO MODEL IS CALLED HERE, and that is the point rather than an omission. The
// answer is assembled from fields - lender, count, month, outcome - so there is
// no sentence about lending for anything to get subtly wrong. See the note at
// the top of lib/paco.ts.
//
// SIGNED IN ONLY. It reads the firm's whole deal history, so it goes through
// the user's own session rather than the admin key: somebody who is not logged
// in gets nothing, and the database's own rules still apply to whoever is.
//
// ASKING HIM A QUESTION WRITES NOTHING. The POST below is the only thing here
// that writes, and it only ever adds a note or retires one - never an edit.
//
// A NOTE IS STAMPED BY THE DATABASE, NOT BY THE BROWSER. said_by comes from the
// session on this side, so the name on a note cannot be chosen by whoever is
// sending the request. The table's own rule says the same thing again.
export const dynamic = 'force-dynamic'

// NARROW ON PURPOSE. lo_data is the big one and it is the only one we need in
// full; pulling '*' would drag every fact find and compliance pack across the
// wire to count some tags.
// deal_handovers(hard) is where the "what was hard" answers live from 14 Oct
// 2026 - see factOf in lib/paco.ts. Older deals still carry theirs in lo_data,
// so both are pulled and both are read.
const COLUMNS = 'id, deal_name, lodged_at, formal_approval_at, settled_at, lo_data, deal_handovers(hard)'

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const question = String(req.nextUrl.searchParams.get('q') || '').trim()

  const { data, error } = await supabase.from('deals')
    .select(COLUMNS).order('created_at', { ascending: false }).limit(1000)

  if (error) {
    // A FAILED LOOK AND AN EMPTY ANSWER MUST NEVER READ THE SAME. One is a
    // broken screen and the other is a true "nobody has told me" - and Paco's
    // whole worth rests on the difference.
    return NextResponse.json({ error: `I could not reach the deals — ${error.message}` }, { status: 500 })
  }

  // A test deal is not the business. lib/test-deal.ts.
  const deals = realDealsOnly((data || []) as any[])
  const notes = await readNotes(supabase)
  // THE LENDERS' OWN WRITTEN POLICY. Read beside the notes, never instead of
  // them - see lib/paco-answers-from-policy.ts for why both are shown.
  const policy = await readPolicy(supabase)

  if (!question) {
    const a = answer('', deals, { bdmNotes: notes.length }, notes)
    return NextResponse.json({
      hola: HOLA,
      counts: { ...a.counts, policy: policy.length },
      tellable: notes !== null,
    })
  }

  // THE COUNT WAS NEVER PASSED IN. "0 lender policies loaded" was not a
  // reading of anything - policies defaulted to nought and stayed there, so
  // Paco reported an empty library however full it was.
  const said = answer(question, deals,
    { bdmNotes: notes.length, policies: policy.length }, notes)
  // WHAT THE LENDER WROTE DOWN, FOR THIS QUESTION.
  //
  // Filtered the same way the notes are - by the lender named in the question
  // and by the subjects it is about - so Paco cannot answer a Macquarie
  // question with a Bankwest rule. The ordering, the held future rules and the
  // "shown alongside, never instead" are all in answerFrom.
  // The same two things the deals were filtered by: the lender the question
  // named, and what it is about. Read off the question, not off the answer.
  // EVERY BANK WE DEAL WITH, NOT ONLY THE ONES WITH A DOCUMENT. A question
  // about a bank with nothing on file is exactly the one worth answering with
  // where to go and get it.
  const lenders = KNOWN_LENDERS
  const mine = forThisQuestion(
    policy,
    lenderAsked(question, lenders),
    said.asked,
  )
  const fromPolicy = answerFrom(mine, said.notes || [], new Date().toISOString().slice(0, 10))
  // WHEN HE HAS NOTHING IN WRITING, HE SAYS WHERE IT IS.
  //
  // 13 Oct 2026. "Nothing recorded, check with the lender" is true and it is a
  // dead end. Every lender's policy source was checked by hand that afternoon,
  // so the honest next line is where the missing document actually lives - on
  // their website, behind their portal, or nowhere at all.
  //
  // It is OUR note about a website and it is stamped with the day we looked.
  // It never says what a bank will lend, and lib/where-the-policy-lives.test.ts
  // holds it to that.
  const whereToGet = fromPolicy.policy.length === 0
    ? whereToGetIt(lenderAsked(question, lenders))
    : ''
  // THE BANK THE QUESTION NAMED, HANDED BACK. When he has nothing he asks
  // whether you know, and nobody should have to type the bank in again.
  const askedAbout = lenderAsked(question, lenders)
  // THE SECTIONS, BESIDE THE RULES AND NEVER INSTEAD OF THEM.
  //
  // The pre-chopped rules do not disappear the day this ships - every lender
  // already read has hundreds of them and they are still true. The sections
  // are the better answer where they exist; both are handed over and the
  // screen leads with the sections.
  const sections = await readSections(supabase, question, askedAbout)
  return NextResponse.json({ question, ...said, policy: fromPolicy, whereToGet, askedAbout, sections })
}

// THE LENDER'S OWN SECTION, SEARCHED WHEN SOMEBODY ASKS.
//
// 14 Oct 2026, and this is the half the whole library was for. Fabio: "are you
// now saving these as one big library where it will just search answers to
// questions? this is the whole premise."
//
// The document is stored whole and split into the sections the lender wrote.
// Nothing is carved up in advance, so an answer is a real section with its
// heading and its tables still attached.
//
// A MISSING FUNCTION IS NOT A FAULT. Same as the notebook and the rules above:
// if docs/lender-policy-search-that-works.sql has not been run, he answers from
// what he does have rather than reporting a broken screen.
async function readSections(
  supabase: any, question: string, lenderName: string,
): Promise<SectionAnswer | null> {
  if (!question.trim()) return null

  // The search is per lender, because a Macquarie question must never be
  // answered out of Bankwest's manual. No lender named, no section search -
  // lib/paco.ts already handles the across-everything case from deals.
  if (!lenderName) return null
  const { data: row } = await supabase.from('lenders')
    .select('id').ilike('name', lenderName).limit(1).maybeSingle()
  if (!row?.id) return null

  const { data, error } = await supabase.rpc('paco_find_sections', {
    p_lender: row.id, p_query: question, p_limit: 5,
  })
  if (error) return null

  const rows = Array.isArray(data) ? data : []
  // `loosened` comes back on every row and is the same for all of them - it
  // describes the SEARCH, not the section. See lib/paco-reads-the-section.ts
  // for why it decides whether any of this is allowed to be called an answer.
  const loosened = rows.length > 0 && !!rows[0]?.loosened
  return sectionAnswer(rows, loosened, lenderName)
}

// WHAT THE LENDERS THEMSELVES HAVE WRITTEN DOWN.
//
// 13 Oct 2026. This used to take only what somebody had ticked, and that made
// the library useless the moment it filled up: NAB's policy went in, 455 lines
// came out of it, and Paco answered "I have no lender policy on this" to a
// question whose answer was on the screen behind him.
//
// He now reads unchecked lines too and SAYS they are unchecked, every time,
// with the sentence they came from. The quote is what stops a machine's
// reading being mistaken for the bank's policy - not a tick nobody has time
// to do three hundred times. See lib/paco-answers-from-policy.ts.
//
// A missing table is a thing nobody has set up yet, not a fault. Same as the
// notebook above: he answers from what he does have.
async function readPolicy(supabase: any): Promise<PolicyRule[]> {
  const { data, error } = await supabase.from('lender_policy_rules')
    .select('id, lender_id, document_id, says, quote, section, heading, tags, tier, status, effective_from, effective_to, row_headers, row_cells, depends_on, excludes, max_lvr, lenders(name)')
    .in('status', USABLE as unknown as string[])
    .limit(5000)
  if (error || !data) return []
  return (data as any[]).map(r => ({
    id: String(r.id), documentId: String(r.document_id || ''), lenderId: String(r.lender_id || ''),
    says: String(r.says || ''), quote: String(r.quote || ''),
    rowHeaders: Array.isArray(r.row_headers) ? r.row_headers.map(String) : [],
    rowCells: Array.isArray(r.row_cells) ? r.row_cells.map(String) : [],
    section: String(r.section || ''), heading: String(r.heading || ''),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    tier: String(r.tier || 'A'),
    dependsOn: Array.isArray(r.depends_on) ? r.depends_on.map(String) : [],
    excludes: Array.isArray(r.excludes) ? r.excludes.map(String) : [],
    maxLvr: r.max_lvr === null || r.max_lvr === undefined ? null : Number(r.max_lvr),
    minValue: null, maxValue: null,
    effectiveFrom: r.effective_from || null, effectiveTo: r.effective_to || null,
    status: 'live' as const,
    decidedByName: '', decidedAt: null, rejectedWhy: '',
    // The bank's name, for saying whose policy this is.
    lenderName: String((r as any)?.lenders?.name || ''),
  })) as any
}

// THE SAME TWO FILTERS THE NOTES GET: the lender the question named, and what
// it is about. A Macquarie question answered with a Bankwest rule would be
// worse than no answer, because it would look like one.
function forThisQuestion(rules: PolicyRule[], lender: string, tags: string[]): PolicyRule[] {
  const named = flat(lender)
  const want = (Array.isArray(tags) ? tags : []).filter(Boolean)
  return rules
    .filter(r => !named || flat((r as any).lenderName) === named)
    .filter(r => want.length === 0 || (r.tags || []).some(t => want.includes(t)))
}

// THE NOTEBOOK, OR AN EMPTY ONE.
//
// docs/paco-knowledge-schema.sql has to be run before this table exists. Until
// it is, Paco answers from the deals exactly as he did yesterday rather than
// showing an error - a missing table is a thing nobody has set up yet, not a
// fault, and he already has a way of saying a source is empty.
async function readNotes(supabase: any): Promise<Claim[]> {
  const { data, error } = await supabase.from('paco_knowledge')
    .select('id, lender, said, tags, tier, source, said_by_name, created_at, retired_at, retired_by_name')
    .is('retired_at', null)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error || !data) return []
  return (data as any[]).map(r => ({
    id: String(r.id),
    lender: String(r.lender || ''),
    said: String(r.said || ''),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    tier: (String(r.tier || 'D') as Claim['tier']),
    source: String(r.source || ''),
    who: String(r.said_by_name || ''),
    when: String(r.created_at || ''),
    retiredAt: r.retired_at || null,
    retiredBy: r.retired_by_name || null,
  })).filter(isUsable)
}

// TELLING PACO SOMETHING.
//
// Anyone signed in may add a note and it is live immediately - no queue, nobody
// to wait for. What makes that safe is the stamp, so the stamp is taken from the
// session here and from auth.uid() in the table's own rule. Neither trusts the
// browser. See docs/paco.md.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // RETIRING ONE. Never a delete, and never an edit of what was said - the note
  // stays readable with the date it was retired and by whom.
  if (body?.retire) {
    const { error } = await supabase.from('paco_knowledge')
      .update({
        retired_at: new Date().toISOString(),
        retired_by: auth.user.id,
        retired_by_name: await nameOf(supabase, auth.user.id),
        retired_why: String(body.why || '').slice(0, 500),
      })
      .eq('id', String(body.retire))
    if (error) return NextResponse.json({ error: `I could not retire that — ${error.message}` }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // A LINE SOMEBODY READ AND SAW WAS WRONG.
  //
  // 13 Oct 2026. The review list is gone: a line read out of a document is in
  // and Paco uses it, with the sentence it came from under every answer. That
  // quote is the check, and this is the one thing that happens when it fails.
  //
  // NEVER A DELETE AND NEVER AN EDIT, same as retiring a note. The line stops
  // answering and stays readable, with the name of whoever called it and when.
  // Nobody goes hunting for things to fix; this is clicked by somebody who
  // tripped over one while doing their job.
  if (body?.wrong) {
    const { error } = await supabase.from('lender_policy_rules')
      .update({
        status: 'rejected',
        decided_by: auth.user.id,
        decided_by_name: await nameOf(supabase, auth.user.id),
        decided_at: new Date().toISOString(),
        rejected_why: String(body.why || 'Not what the document says').slice(0, 500),
      })
      .eq('id', String(body.wrong))
    if (error) return NextResponse.json({ error: `I could not drop that — ${error.message}` }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const lender = String(body?.lender || '').trim()
  const said = String(body?.said || '').trim()
  if (!lender || !said) {
    return NextResponse.json({ error: 'A note needs a lender and something to say.' }, { status: 400 })
  }

  const { error } = await supabase.from('paco_knowledge').insert({
    lender,
    said: said.slice(0, 2000),
    tags: Array.isArray(body?.tags) ? body.tags.map(String).slice(0, 12) : [],
    // Only the two a person is allowed to choose. A and C come from documents,
    // and letting them be typed would mean somebody could mark their own
    // recollection as the lender's written policy.
    tier: body?.tier === 'B' ? 'B' : 'D',
    source: String(body?.source || '').slice(0, 300),
    said_by: auth.user.id,
    said_by_name: await nameOf(supabase, auth.user.id),
  })
  if (error) {
    const missing = /relation .* does not exist/i.test(error.message)
    return NextResponse.json({
      error: missing
        ? 'Paco\u2019s notebook is not set up yet. Run docs/paco-knowledge-schema.sql in Supabase.'
        : `I could not write that down — ${error.message}`,
    }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

async function nameOf(supabase: any, id: string): Promise<string> {
  const { data } = await supabase.from('user_profiles').select('full_name').eq('id', id).maybeSingle()
  return String(data?.full_name || '').trim()
}
