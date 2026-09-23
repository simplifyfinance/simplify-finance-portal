import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { allocateCreditOfficer } from '@/lib/allocate-officer'

// Choosing which credit officer takes a deal.
//
// The deciding is in lib/allocate-officer.ts, because this is not the only
// caller: a client pressing "Proceed" on their own page allocates one too, and
// until 24 Sep 2026 it did that by making an HTTP request to this very route -
// from the server it was already running on. See that file for what that cost.
//
// What is left here is the front door: who is asking, and turning the answer
// into a response.
export async function POST(req: NextRequest) {
  const { dealId } = await req.json()
  if (!dealId) return NextResponse.json({ ok: false, error: 'Missing dealId' }, { status: 400 })

  const supabase = await createSupabaseServer()

  // SIGNED IN, FIRST. 23 Sep 2026: this route sends email and read the deal as
  // whoever called it, so with no session the database returned nothing and it
  // stopped at "deal not found". That is a lock made of a side effect. It is
  // said out loud now, because the next person to change the query should not
  // be able to remove the lock without noticing.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const result = await allocateCreditOfficer(supabase, dealId)
  const { status, ...body } = result
  return NextResponse.json(body, { status: status || (body.ok ? 200 : 500) })
}
