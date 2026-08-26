import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { signOpportunity, opportunityUrl, type OpportunityPayload } from '@/lib/opportunity-link'

// Signed on the server — the secret must never reach the browser. Only a
// signed-in member of the team can mint a link.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: u } = await supabase.auth.getUser()
  if (!u?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const p = (await req.json()) as OpportunityPayload
  if (!p?.email || !p?.brokerKey) {
    return NextResponse.json({ error: 'The client email and broker are both needed.' }, { status: 400 })
  }
  return NextResponse.json({ url: opportunityUrl(signOpportunity(p)) })
}
