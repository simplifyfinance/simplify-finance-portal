import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { answer, HOLA } from '@/lib/paco'
import { realDealsOnly } from '@/lib/test-deal'

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
// AND IT WRITES NOTHING. Asking Paco a question changes no record anywhere.
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

  if (!question) {
    return NextResponse.json({ hola: HOLA, counts: answer('', deals).counts })
  }

  return NextResponse.json({ question, ...answer(question, deals) })
}
