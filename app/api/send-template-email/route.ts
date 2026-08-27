import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { resolveBrokerProfile } from '@/lib/broker-profile'
import { resolveBrand } from '@/lib/brand'
import { buildRebateEmail } from '@/lib/new-property-rebate-email'
import { buildNegativeGearingEmail } from '@/lib/negative-gearing-email'
import { buildPriceOpportunityEmail } from '@/lib/price-opportunity-email'

// Sending a template email from the portal rather than from the sender's mailbox.
//
// A mail link cannot carry an attachment — that is a limit of how a web page
// talks to a mail program, not of this code. The compliance notification to the
// credit officer has always had its PDFs because the portal sends it directly,
// so the templates that need attachments now go the same way.
//
// The email is rebuilt here from the same builder the preview used, rather than
// accepting HTML from the browser. Same inputs, same function, same email — and
// nothing arbitrary can be posted through this route.

export const runtime = 'nodejs'
export const maxDuration = 30

const BUILDERS: Record<string, (ctx: any) => { subject: string; html: string; plainText: string }> = {
  'new-property-rebate': buildRebateEmail,
  'negative-gearing': buildNegativeGearingEmail,
  'price-opportunity': buildPriceOpportunityEmail,
}

const DOMAIN = '@simplifyfinance.com.au'
const FALLBACK_FROM = 'notifications@simplifyfinance.com.au'
// Vercel refuses a request body over about 4.5MB, so the attachments are capped
// below that with room for the message itself.
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024

function addressList(raw: string): string[] {
  return raw.split(/[,;\s]+/).map(a => a.trim()).filter(a => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a))
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'The mail service is not configured on this deployment.' }, { status: 500 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'The attachments were too large to upload. Keep them under 3.5MB in total.' }, { status: 413 })
  }

  const template = String(form.get('template') || '')
  const build = BUILDERS[template]
  if (!build) return NextResponse.json({ error: 'Unknown template.' }, { status: 400 })

  const to = addressList(String(form.get('to') || ''))
  if (!to.length) return NextResponse.json({ error: 'No valid client email address.' }, { status: 400 })

  let ctx: any = {}
  try { ctx = JSON.parse(String(form.get('ctx') || '{}')) } catch { /* built with nothing rather than guessed */ }

  const broker = await resolveBrokerProfile(String(form.get('brokerKey') || ''))
  if (!broker) return NextResponse.json({ error: 'That broker could not be found.' }, { status: 400 })

  // Sent as the broker where the address is on our own domain, because that is
  // who the client is expecting to hear from. Anything else and Resend would
  // refuse the send outright.
  const brokerEmail = (broker.email || '').trim().toLowerCase()
  const fromAddress = brokerEmail.endsWith(DOMAIN) ? brokerEmail : FALLBACK_FROM
  const replyTo = brokerEmail || auth.user.email || FALLBACK_FROM

  // The sender's copy is sent separately, not as a BCC on the client's message.
  // BCCing them meant a message from their own address arriving from an outside
  // server, which Microsoft treats as spoofing and quietly junks — which is
  // exactly what happened on the first send. The copy now comes from the
  // portal's own address, which the domain has always sent from, and says what
  // it is in the subject line so it cannot be mistaken for the real thing.
  // The copy goes to the broker the email went out as, not to whoever happened
  // to press the button. It left their address and replies come back to them,
  // so they are the one who needs the record — Fabio sending as Kylie should
  // put the copy in Kylie's inbox.
  const senderCopy = brokerEmail || (auth.user.email || '').trim().toLowerCase()
  const bcc = addressList(String(form.get('bcc') || ''))

  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
  let bytes = 0
  const attachments: { filename: string; content: string }[] = []
  for (const f of files) {
    bytes += f.size
    if (bytes > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: 'The attachments come to more than 3.5MB in total. Remove one, or use a smaller PDF.' }, { status: 413 })
    }
    attachments.push({
      filename: f.name.replace(/[\r\n"]/g, '').slice(0, 120) || 'attachment.pdf',
      content: Buffer.from(await f.arrayBuffer()).toString('base64'),
    })
  }

  // Resolved here rather than trusted from the browser, for the same reason the
  // email itself is rebuilt here: the licence number in the footer is a
  // compliance statement, not a display preference.
  const brand = await resolveBrand(String(form.get('brandId') || ''))
  const email = build({ ...ctx, brand, brokerName: broker.name, attachmentCount: String(attachments.length) })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${broker.name} <${fromAddress}>`,
      to,
      ...(bcc.length ? { bcc } : {}),
      reply_to: replyTo,
      subject: email.subject,
      html: email.html,
      text: email.plainText,
      ...(attachments.length ? { attachments } : {}),
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Said out loud rather than swallowed — a send that silently failed is worse
    // than one that failed loudly.
    console.error('[send-template-email]', res.status, json)
    return NextResponse.json(
      { error: (json as any)?.message || `The mail service refused the send (${res.status}).` },
      { status: 502 })
  }

  // The client's email has gone. A copy that fails from here is worth saying
  // out loud, but it must not be reported as a failed send.
  let copySent = false
  if (senderCopy) {
    try {
      const note = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4FAFE" style="background-color:#F4FAFE;"><tr>
<td bgcolor="#F4FAFE" style="background-color:#F4FAFE;padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3d3d3a;line-height:1.6;">
<span style="color:#3d3d3a;"><b style="color:#1a1a1a;">This is your copy.</b> The email below went out in your name to ${to.join(', ')}${attachments.length ? ` with ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}` : ''}, sent from the portal by ${auth.user.email || 'a member of the team'}. It will not be in your Sent items, because it left the portal rather than your mailbox. Replies come to you.</span>
</td></tr></table>`
      const copyRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Simplify Finance Portal <${FALLBACK_FROM}>`,
          to: [senderCopy],
          subject: `Your copy \u2014 ${email.subject}`,
          html: note + email.html,
          text: `This is your copy. The email below went out in your name to ${to.join(', ')}, sent from the portal by ${auth.user.email || 'a member of the team'}.\n\n${email.plainText}`,
          ...(attachments.length ? { attachments } : {}),
        }),
      })
      copySent = copyRes.ok
      if (!copyRes.ok) console.error('[send-template-email] copy failed', copyRes.status, await copyRes.text())
    } catch (e) {
      console.error('[send-template-email] copy failed', e)
    }
  }

  return NextResponse.json({
    ok: true,
    id: (json as any)?.id || null,
    sentTo: to,
    copiedTo: bcc,
    copyTo: copySent ? senderCopy : null,
    attached: attachments.length,
  })
}
