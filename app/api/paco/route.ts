import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { answer, HOLA } from '@/lib/paco'
import { realDealsOnly } from '@/lib/test-deal'
import { isUsable, type Claim } from '@/lib/paco-knowledge'

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
const COLUMNS = 'id, deal_name, lodged_at, formal_approval_at, settled_at, lo_data'

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

  if (!question) {
    const a = answer('', deals, { bdmNotes: notes.length }, notes)
    return NextResponse.json({ hola: HOLA, counts: a.counts, tellable: notes !== null })
  }

  return NextResponse.json({ question, ...answer(question, deals, { bdmNotes: notes.length }, notes) })
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
