import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { securitiesWithPurchase } from '@/lib/securities'
import { buildValuation, type Answers } from '@/lib/order-a-valuation'

// SENDING THE VALUATION REQUEST, INSTEAD OF ASKING SOMEBODY TO PASTE IT.
//
// 17 Aug 2026. Ordering a valuation put the request on the clipboard and
// opened a blank mail window. Fabio: "I don't want to copy and paste to the
// bot - cant we use resend so the email goes without my staff having to press".
//
// Six steps - press, copy, open, paste, check, send - and three of them can
// simply not happen with nothing in the portal any the wiser. A valuation
// everybody believes was ordered and was not is a week lost on a deal.
//
// THE EMAIL IS REBUILT HERE, NOT ACCEPTED FROM THE BROWSER. Same function the
// screen drew its preview with, same deal read fresh out of the database, so
// what goes out is what was read - and nothing arbitrary can be posted through
// this route. Same rule as app/api/send-template-email/route.ts, which has
// sent the template emails this way since October.
//
// AND THE ADDRESS IS OURS, NOT THEIRS. `to` comes from VALUER_EMAIL inside the
// builder and is never read off the request. A route that mailed wherever the
// browser asked would be an open relay wearing our domain.

export const runtime = 'nodejs'
export const maxDuration = 30

const DOMAIN = '@simplifyfinance.com.au'
const FALLBACK_FROM = 'notifications@simplifyfinance.com.au'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'The mail service is not configured on this deployment.' }, { status: 500 })
  }

  let input: any = {}
  try { input = await req.json() } catch { /* answered as missing below */ }

  const dealId = String(input?.dealId || '')
  const securityId = String(input?.securityId || '')
  const answers: Answers = input?.answers || ({} as Answers)
  if (!dealId || !securityId) {
    return NextResponse.json({ error: 'Which deal and which security were not given.' }, { status: 400 })
  }
  if (!(answers?.lenders || []).filter(Boolean).length) {
    return NextResponse.json({ error: 'Tick at least one lender.' }, { status: 400 })
  }

  // THE DEAL, READ FRESH. The figures on the request are the ones in the
  // database when it was sent, not the ones a tab had in it an hour ago.
  const { data: deal, error } = await supabase
    .from('deals')
    .select('id, deal_name, bc_data, fact_find_data, purchase_address, valuations_ordered')
    .eq('id', dealId).maybeSingle()
  if (error || !deal) {
    return NextResponse.json({ error: 'That deal could not be read.' }, { status: 404 })
  }

  const security = securitiesWithPurchase(deal.bc_data, deal.fact_find_data, deal.purchase_address)
    .find((s: any) => String(s.id) === securityId)
  if (!security) {
    return NextResponse.json(
      { error: 'That security is no longer ticked on this deal.' }, { status: 409 })
  }

  // WHO IS ASKING, off the session rather than off the request. The reply comes
  // back to them, so it cannot be somebody the browser named.
  const myEmail = (auth.user.email || '').trim().toLowerCase()
  const { data: mine } = await supabase.from('user_profiles')
    .select('full_name').eq('id', auth.user.id).maybeSingle()
  const who = { name: String((mine as any)?.full_name || '').trim() || myEmail, email: myEmail }

  // THE BROKER THE ORDER IS PLACED UNDER. Valerio signs into CoreLogic with
  // this broker's own login, so a valuation ordered by credit still lands in
  // the right account. Looked up by email rather than trusted as a name.
  const brokerEmail = String(input?.brokerEmail || '').trim().toLowerCase()
  let broker: { name?: string; email?: string } | undefined
  if (brokerEmail) {
    const { data: b } = await supabase.from('user_profiles')
      .select('full_name, email').ilike('email', brokerEmail).maybeSingle()
    broker = { name: String((b as any)?.full_name || '').trim(), email: (b as any)?.email || brokerEmail }
  }
  if (!broker?.email) {
    return NextResponse.json(
      { error: 'Pick the broker this is ordered under - Valerio needs their CoreLogic login.' },
      { status: 400 })
  }

  const built = buildValuation(deal, security, answers, who, broker)

  // Sent as the person who pressed it where that address is on our own domain,
  // because the reply is coming back to them. Anything else and Resend refuses
  // the send outright.
  const from = myEmail.endsWith(DOMAIN) ? myEmail : FALLBACK_FROM

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${who.name} <${from}>`,
      to: [built.to],
      ...(built.cc.length ? { cc: built.cc } : {}),
      reply_to: myEmail || FALLBACK_FROM,
      subject: built.subject,
      // PLAIN TEXT, as the bot's own spec asks: one Key: Value per line, keys
      // never change. An HTML body would reach Valerio wrapped in markup he
      // would have to strip back off.
      text: built.body,
    }),
  })

  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Said out loud rather than swallowed. A send that failed quietly is a
    // valuation everybody believes was ordered.
    console.error('[send-valuation]', res.status, json)
    return NextResponse.json(
      { error: json?.message || `The mail service refused the send (${res.status}).` },
      { status: 502 })
  }

  // ONLY NOW IS ANYTHING WRITTEN. A deal that says a valuation was ordered when
  // none was is worse than no record at all, so the date goes on after the
  // email has gone and not before.
  const when = new Date().toISOString()
  const next = { ...((deal as any).valuations_ordered || {}), [securityId]: when }
  const { error: saveError } = await supabase.from('deals')
    .update({ valuations_ordered: next }).eq('id', dealId)

  return NextResponse.json({
    ok: true,
    when,
    ref: built.ref,
    cc: built.cc,
    byHand: built.byHand,
    sentFrom: from,
    brokerName: broker.name,
    valuationsOrdered: next,
    // The email HAS gone. A failed write is a date nobody recorded, not an
    // order that did not happen, and the screen says so rather than implying
    // the send failed.
    saveProblem: saveError ? saveError.message : null,
  })
}
