import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { resolveBrokerProfile } from '@/lib/broker-profile'
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

  // The sender gets a copy, since it will not be in their Sent items.
  const senderCopy = (auth.user.email || '').trim().toLowerCase()
  const bcc = Array.from(new Set([
    ...addressList(String(form.get('bcc') || '')),
    ...(senderCopy ? [senderCopy] : []),
  ]))

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

  const email = build({ ...ctx, brokerName: broker.name, attachmentCount: String(attachments.length) })

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

  return NextResponse.json({
    ok: true,
    id: (json as any)?.id || null,
    sentTo: to,
    copiedTo: bcc,
    attached: attachments.length,
  })
}
