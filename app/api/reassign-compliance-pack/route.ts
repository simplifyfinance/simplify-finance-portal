import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { can } from '@/lib/permissions'
import { checkedWrite } from '@/lib/checked-write'
import { fileNote } from '@/lib/file-note'
import { siteUrl } from '@/lib/site-url'

// MOVING THE COMPLIANCE PACK TO SOMEBODY ELSE.
//
// 28 Oct 2026. Fabio: "compliance was sent to Elise. Elise called sick or she's
// late. We can go press reassign and then it goes to the next person... and
// that person gets an email."
//
// WHAT IT DOES NOT TOUCH: compliance_pack_at. That timestamp is what the day's
// count is read from, and today's allocation has already happened. Moving a
// deal to somebody else must not quietly free up a slot in a day that is over,
// or the next push would land on the wrong desk because of a reassign made an
// hour earlier. Who has it changes; when it went out does not.
//
// AND THE PDFs ARE NOT RE-SENT FROM HERE. They were generated at the moment of
// the push and filed against the deal; that filed copy is the compliance record
// of what went to credit that day. Regenerating them now would attach a
// DIFFERENT document - the fact find moves on - and leave two versions of "the
// pack" in two people's inboxes with no way to tell which was which. The email
// points at the deal, where the filed copies are.

async function tellThem(opts: {
  email: string; name: string; dealId: string; dealName: string
  clientName: string; brokerName: string; fromName: string; byName: string
}) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to: opts.email,
        // Deliberately no cc. Fabio, 28 Oct 2026: "We do not need info to be
        // CC'd on everything in that tab."
        subject: `Compliance pack moved to you — ${opts.dealName}`,
        html: `<p>Hi ${opts.name.split(' ')[0] || ''},</p>
          <p>The compliance pack for this deal has been moved to you${opts.fromName ? ` from ${opts.fromName}` : ''}${opts.byName ? ` by ${opts.byName}` : ''}.</p>
          <p>The Fact Find, Handover and Broker Notes are on the deal, under Documents, exactly as they were sent. They still need filing into the client&rsquo;s OneDrive folder, and the Broker Notes also goes in the lodgement folder.</p>
          <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="font-size:13px;padding:3px 0"><span style="color:#666;">Deal</span></td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0"><span style="color:#141C24;">${opts.dealName}</span></td></tr>
            <tr><td style="font-size:13px;padding:3px 0"><span style="color:#666;">Client</span></td><td style="text-align:right;font-size:13px;padding:3px 0"><span style="color:#141C24;">${opts.clientName}</span></td></tr>
            <tr><td style="font-size:13px;padding:3px 0"><span style="color:#666;">Broker</span></td><td style="text-align:right;font-size:13px;padding:3px 0"><span style="color:#141C24;">${opts.brokerName}</span></td></tr>
          </table>
          <p><a href="${siteUrl()}/deals/${opts.dealId}">Open the deal</a> &nbsp;·&nbsp;
             <a href="${siteUrl()}/deals/${opts.dealId}/handover">Open the handover to copy</a></p>`,
      }),
    })
    return true
  } catch {
    // Non-fatal. The reassignment has already happened and is on the file; an
    // email that did not send is a smaller problem than a half-done move.
    return false
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ ok: false, error: 'Could not check permissions' }, { status: 403 })
  if (!can(profile.role, 'reassignDeals')) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to reassign deals' }, { status: 403 })
  }

  const { dealId, userId } = await req.json()
  if (!dealId || !userId) {
    return NextResponse.json({ ok: false, error: 'Missing the deal or the person' }, { status: 400 })
  }

  const { data: to } = await supabase.from('user_profiles').select('email, full_name').eq('id', userId).single()
  if (!to?.email) {
    return NextResponse.json({ ok: false, error: 'That person has no email address on their profile' }, { status: 400 })
  }

  const { data: deal } = await supabase.from('deals')
    .select('id, deal_name, assigned_broker, compliance_pack_user_name, clients(first_name, last_name)')
    .eq('id', dealId).single()
  if (!deal) return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 })

  const fromName = String(deal.compliance_pack_user_name || '').trim()
  const toName = String(to.full_name || to.email).trim()

  const problem = await checkedWrite(
    supabase.from('deals').update({
      compliance_pack_user_id: userId,
      compliance_pack_user_name: toName,
      // compliance_pack_at is deliberately untouched - see the note above.
    }).eq('id', dealId),
    'The compliance pack owner')
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })

  const client = (deal as any).clients
  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(' ')
    : String(deal.deal_name || '').replace(/_/g, ' ')

  const sent = await tellThem({
    email: to.email, name: toName, dealId, dealName: String(deal.deal_name || 'Deal').replace(/_/g, ' '),
    clientName, brokerName: String(deal.assigned_broker || ''),
    fromName, byName: String(profile.full_name || ''),
  })

  // A LINE IN THE FILE, ALWAYS. The move is the thing somebody will ask about
  // in six months - who had it, who has it now, and who moved it.
  await fileNote(dealId,
    `Compliance pack moved${fromName ? ` from ${fromName}` : ''} to ${toName}.`
      + (sent ? '' : ' The email to them could not be sent.'),
    String(profile.full_name || ''))

  return NextResponse.json({ ok: true, assignedTo: toName, emailSent: sent })
}
