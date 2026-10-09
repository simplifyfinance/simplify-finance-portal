import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveBrand } from '@/lib/brand'
import { menuFor, templateById, withSent, type TemplateId, type SentEmail } from '@/lib/milestone-emails'
import { assembleMilestoneEmail, SETTLEMENTS_EMAIL } from '@/lib/milestone-send'
import { rulesOf } from '@/lib/lender-rules'
import { readNotice, noticeFor } from '@/lib/rate-notice'
import { lenderIdFrom } from '@/lib/lender-id'
import { lenderOnTheDeal } from '@/lib/client-agreement'
import { emailsGoTo, isTestDeal, testSubject } from '@/lib/test-deal'

// SENDING A MILESTONE EMAIL.
//
// Fabio, 29 Sep 2026: "Everyone can send it", "letter is compulsory", and the
// sign-off matches the From line. All three are enforced here rather than on the
// screen, because a screen can be got around and this cannot.
//
// THE EMAIL IS REBUILT HERE. Nothing arrives from the browser except which deal,
// which template, which blocks were ticked, the free text, and the lender's own
// letter. The subject, the figures, the conditions and the signature are built
// from the deal by the same function the preview used - so the preview cannot
// drift from what goes out, and nothing arbitrary can be posted through this
// route and sent under our licence number.

export const runtime = 'nodejs'
export const maxDuration = 30

const DOMAIN = '@simplifyfinance.com.au'
const FALLBACK_FROM = 'notifications@simplifyfinance.com.au'
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024

const txt = (v: any) => String(v ?? '').trim()

// Everything the assembly needs off the deal, in one read.
const DEAL_COLUMNS = '*, clients(first_name, last_name, email)'

async function loadDeal(supabase: any, dealId: string) {
  const { data, error } = await supabase.from('deals').select(DEAL_COLUMNS).eq('id', dealId).single()
  if (error || !data) return null
  return data
}

// The answers recorded for whichever lender THIS DEAL is with - the clients'
// own choice where they made one, never the original recommendation. Same
// question, same function, as everywhere else since 29 Sep.
// THE LENDER'S ANSWERS, AND THE LENDER'S OWN ROW.
//
// Both come from the same lookup, so they are fetched together rather than
// twice. The row is what the RBA notice is decided against - whether THIS bank
// has passed the increase on - see lib/rate-notice.ts.
async function loadLender(deal: any) {
  const name = lenderOnTheDeal(deal?.lo_data || {})
  const nothing = { rules: {}, row: null as any }
  if (!name) return nothing
  try {
    const admin = createSupabaseAdmin()
    const { data: lenders } = await admin.from('lenders')
      .select('id, name, aliases, rate_notice_for')
    const id = lenderIdFrom(lenders as any, name)
    if (!id) return nothing
    const row = (lenders || []).find((l: any) => l.id === id) || null
    const { data: rows } = await admin.from('lender_rules').select('key, value, set_by, set_at, used').eq('lender_id', id)
    return { rules: rulesOf(rows), row }
  } catch {
    // A rules table we cannot read leaves every lender block off with its reason
    // showing. An email short a condition is a problem; an email with a
    // GUESSED condition is a worse one.
    //
    // The notice goes the other way on purpose: an unknown lender has NOT passed
    // the increase on as far as we know, so the warning stays. Warning somebody
    // needlessly is survivable; quoting a rate that has moved is not.
    return nothing
  }
}

// THE NOTICE FOR THIS DEAL, OR NOTHING. Read here because a route is the only
// part of this that can reach settings; lib/rate-notice.ts decides, this only
// fetches.
async function loadRateNotice(lenderRow: any): Promise<string> {
  try {
    const admin = createSupabaseAdmin()
    const { data } = await admin.from('settings').select('rate_notice').eq('id', 'singleton').maybeSingle()
    return noticeFor(lenderRow, readNotice((data as any)?.rate_notice))
  } catch {
    // Settings unreachable means no notice rather than a guessed one. It is a
    // sentence about a decision we cannot see, so we do not write it.
    return ''
  }
}

async function senderOf(supabase: any) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) return null
  // The phone column arrives with docs/sender-phone-schema.sql. Asked for, and
  // asked for again without it if it is not there yet - so the deploy and the
  // migration can land in either order rather than one waiting on the other. A
  // signature with no mobile simply has no mobile line; see lib/milestone-email-parts.ts.
  let prof: any = null
  const withPhone = await supabase.from('user_profiles')
    .select('full_name, email, phone').eq('id', auth.user.id).maybeSingle()
  if (withPhone.error) {
    const plain = await supabase.from('user_profiles')
      .select('full_name, email').eq('id', auth.user.id).maybeSingle()
    prof = plain.data
  } else {
    prof = withPhone.data
  }
  const email = txt((prof as any)?.email) || txt(auth.user.email)
  return {
    id: auth.user.id,
    name: txt((prof as any)?.full_name) || email || 'Simplify Finance',
    email,
    phone: txt((prof as any)?.phone),
  }
}

// WHO THE EMAIL IS SIGNED BY, WHEN THAT IS A CHOICE.
//
// The other three milestone emails are signed by whoever is logged in, because
// announcing a bank's decision is done by the person who just read the letter.
// The final check-in is a chase on behalf of the broker whose client went
// quiet, and that is often not the person at the keyboard - see picksSender in
// lib/milestone-emails.ts.
//
// THE BROKER RECORD HAS NO EMAIL OR PHONE. public.brokers holds the name, the
// title, the Calendly link and the brands. The address and the mobile live on
// the user_profiles row, and brokers.user_id is the link between them. A broker
// nobody has linked to a login therefore has a name and no contact details -
// which is a thing to SAY, not to paper over with the wrong person's mobile.
// The screen is told via senderNote and prints it.
async function brokerSender(supabase: any, brokerKey: string) {
  if (!brokerKey) return null
  const { data: b } = await supabase.from('brokers')
    .select('broker_key, name, calendly, user_id, active')
    .eq('broker_key', brokerKey).maybeSingle()
  if (!b) return null

  let email = '', phone = ''
  if (b.user_id) {
    // phone arrives with docs/sender-phone-schema.sql, so it is asked for and
    // then asked for again without it - the same two-step senderOf uses, for
    // the same reason: the deploy and the migration land in either order.
    const withPhone = await supabase.from('user_profiles')
      .select('email, phone').eq('id', b.user_id).maybeSingle()
    if (withPhone.error) {
      const plain = await supabase.from('user_profiles')
        .select('email').eq('id', b.user_id).maybeSingle()
      email = txt((plain.data as any)?.email)
    } else {
      email = txt((withPhone.data as any)?.email)
      phone = txt((withPhone.data as any)?.phone)
    }
  }

  return {
    name: txt(b.name) || brokerKey,
    email,
    phone,
    calendly: txt(b.calendly),
    // Said out loud rather than discovered in a sent email.
    note: b.user_id
      ? (email ? '' : `${txt(b.name) || brokerKey} has a login but no email address on it, so the signature carries no E line.`)
      : `${txt(b.name) || brokerKey} is not linked to a login, so the signature carries their name without an email or mobile. Link them in Settings, Brokers.`,
  }
}

// --- the preview -----------------------------------------------------------
//
// WHAT WOULD BE SENT, WITHOUT SENDING IT. The send screen draws itself from
// this, and so does the browser check - which is the only way a robot can look
// at a client email without emailing a client. It writes nothing.
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const sender = await senderOf(supabase)
  if (!sender) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const dealId = txt(req.nextUrl.searchParams.get('dealId'))
  const templateId = txt(req.nextUrl.searchParams.get('template')) as TemplateId
  if (!dealId) return NextResponse.json({ error: 'Missing dealId.' }, { status: 400 })

  const deal = await loadDeal(supabase, dealId)
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 })

  const menu = menuFor(deal)
  if (!templateId) return NextResponse.json({ preview: true, menu })

  let overrides: Record<string, boolean> = {}
  try { overrides = JSON.parse(txt(req.nextUrl.searchParams.get('overrides')) || '{}') } catch { /* none */ }

  // WHOSE NAME GOES AT THE FOOT. The logged-in user unless this template picks
  // its own sender, and even then only if the chosen broker actually resolves -
  // a key that matches nothing falls back rather than sending an email signed
  // by nobody.
  const tpl = templateById(templateId)
  const chosen = tpl?.picksSender
    ? await brokerSender(supabase, txt(req.nextUrl.searchParams.get('brokerKey')))
    : null
  const who = chosen || sender
  const typedCalendly = txt(req.nextUrl.searchParams.get('calendly'))

  const lender = await loadLender(deal)
  const built = assembleMilestoneEmail({
    deal, templateId,
    rules: lender.rules,
    rateNotice: await loadRateNotice(lender.row),
    brand: await resolveBrand(txt(req.nextUrl.searchParams.get('brandId'))),
    sender: { name: who.name, email: who.email, phone: who.phone },
    // Typed on the screen wins for this one email; otherwise the broker's own
    // link. Neither, and the email simply has no button.
    calendlyUrl: tpl?.picksSender ? (typedCalendly || (chosen?.calendly || '')) : '',
    overrides,
    extra: txt(req.nextUrl.searchParams.get('extra')),
    expiry: txt(req.nextUrl.searchParams.get('expiry')),
    insuranceAmount: txt(req.nextUrl.searchParams.get('insuranceAmount')),
  })
  if (!built) return NextResponse.json({ error: 'Unknown template.' }, { status: 400 })

  const where = emailsGoTo({
    deal, clientEmails: built.to, copyTo: built.cc, testerEmail: sender.email,
  })

  return NextResponse.json({
    preview: true,
    menu,
    state: menu.find(m => m.id === templateId)?.state || null,
    subject: where.redirected ? testSubject(built.subject) : built.subject,
    html: built.html,
    blocks: built.blocks,
    problems: built.problems,
    // WHO IT IS GOING TO, by name. The person sending has to be able to see it
    // - half the point of a preview is catching an address that belongs to
    // somebody's old work account. They can read it on the fact find anyway.
    to: where.to,
    recipientCount: where.to.length,
    cc: where.cc,
    copyDropped: where.copyDropped,
    testDeal: isTestDeal(deal),
    redirected: where.redirected,
    // PER TEMPLATE, NOT ALWAYS. The final check-in attaches nothing and
    // promises nothing - see lib/milestone-emails.ts.
    letterRequired: templateById(templateId)?.letterRequired ?? true,
    // The screen draws its own Sending as panel off this rather than keeping a
    // second list of which templates have one.
    picksSender: tpl?.picksSender ?? false,
    // Empty unless the chosen broker is missing contact details - see
    // brokerSender above. Printed on the screen, not swallowed.
    senderNote: chosen?.note || '',
    senderName: who.name,
  })
}

// --- the send --------------------------------------------------------------
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const sender = await senderOf(supabase)
  if (!sender) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'The mail service is not configured on this deployment.' }, { status: 500 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'The attachment was too large to upload. Keep it under 3.5MB.' }, { status: 413 })
  }

  const dealId = txt(form.get('dealId'))
  const templateId = txt(form.get('template')) as TemplateId
  const template = templateById(templateId)
  if (!dealId || !template) return NextResponse.json({ error: 'Missing deal or unknown template.' }, { status: 400 })

  const deal = await loadDeal(supabase, dealId)
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 })

  // YOU MAY SEND IT AGAIN. YOU MAY NOT SEND IT EARLY.
  //
  // A client loses an email, a second applicant is added, an extension is
  // granted twice - all ordinary, and all a second send. Announcing a milestone
  // the deal has not reached is not ordinary, and the deal itself is the only
  // honest test of that.
  const item = menuFor(deal).find(m => m.id === template.id)
  if (item?.state === 'not_yet') {
    return NextResponse.json({ error: `That email is not ready yet — ${item.note}.` }, { status: 400 })
  }

  let overrides: Record<string, boolean> = {}
  try { overrides = JSON.parse(txt(form.get('overrides')) || '{}') } catch { /* ticked nothing */ }

  // The same resolution the preview did, from the form rather than the query.
  // Both doors through one function, so a preview cannot show one signature and
  // the send go out under another.
  const chosen = template.picksSender
    ? await brokerSender(supabase, txt(form.get('brokerKey')))
    : null
  const who = chosen || sender
  const typedCalendly = txt(form.get('calendly'))

  const lender = await loadLender(deal)
  const built = assembleMilestoneEmail({
    deal, templateId: template.id,
    rules: lender.rules,
    rateNotice: await loadRateNotice(lender.row),
    brand: await resolveBrand(txt(form.get('brandId'))),
    sender: { name: who.name, email: who.email, phone: who.phone },
    calendlyUrl: template.picksSender ? (typedCalendly || (chosen?.calendly || '')) : '',
    overrides,
    extra: txt(form.get('extra')),
    expiry: txt(form.get('expiry')),
    insuranceAmount: txt(form.get('insuranceAmount')),
  })
  if (!built) return NextResponse.json({ error: 'Unknown template.' }, { status: 400 })

  // THE LENDER'S LETTER IS COMPULSORY, FOR THE ONES THAT PROMISE IT.
  //
  // Three of these emails say the approval is attached, and one that says so
  // with nothing attached is a phone call from the client and a second email
  // from us. The final check-in promises nothing and carries nothing, so this
  // asks the template instead of assuming - it is the record's letterRequired,
  // the same flag the screen draws itself from.
  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
  if (template.letterRequired && !files.length) {
    return NextResponse.json({
      error: `The ${template.name.toLowerCase()} email has to go out with the lender's own letter attached. Attach it and send again.`,
    }, { status: 400 })
  }

  let bytes = 0
  const attachments: { filename: string; content: string }[] = []
  for (const f of files) {
    bytes += f.size
    if (bytes > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: 'The attachments come to more than 3.5MB in total. Use a smaller PDF.' }, { status: 413 })
    }
    attachments.push({
      filename: f.name.replace(/[\r\n"]/g, '').slice(0, 120) || 'approval.pdf',
      content: Buffer.from(await f.arrayBuffer()).toString('base64'),
    })
  }

  const where = emailsGoTo({
    deal, clientEmails: built.to, copyTo: built.cc, testerEmail: sender.email,
  })
  if (!where.to.length) {
    return NextResponse.json({
      error: where.redirected
        ? 'This is a test deal, so the email comes to you rather than the clients — and we do not have your address. Nothing was sent.'
        : 'There is no email address on file for these clients. Nothing was sent.',
    }, { status: 400 })
  }

  // Sent as the person pressing the button where their address is on our own
  // domain, because the name at the foot of the email is theirs and the two must
  // match. Resend refuses anything else outright.
  // The name at the foot and the name in the from line are the same person, so
  // this follows whoever signed it - the broker when the template picks one.
  const fromAddress = txt(who.email).toLowerCase().endsWith(DOMAIN) ? who.email : FALLBACK_FROM
  const subject = where.redirected ? testSubject(built.subject) : built.subject

  // REPLIES REACH BOTH. On a formal approval the client's reply has to land with
  // settlements as well as with the sender, or an answer waits on one person
  // being at their desk.
  //
  // Resend takes reply_to as an array, but this codebase has never sent one, so
  // it is not assumed: a refusal falls back to the sender alone and the answer
  // is reported rather than guessed. One real send settles it.
  const replyBoth = template.copySettlements && !where.redirected
  const replyTo: string | string[] = replyBoth
    ? [sender.email || FALLBACK_FROM, SETTLEMENTS_EMAIL]
    : (sender.email || FALLBACK_FROM)

  const payload = (reply: string | string[]) => ({
    from: `${sender.name} <${fromAddress}>`,
    to: where.to,
    ...(where.cc.length ? { cc: where.cc } : {}),
    reply_to: reply,
    subject,
    html: built.html,
    text: built.plainText,
    attachments,
  })

  const post = (body: any) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let res = await post(payload(replyTo))
  let replyToUsed: 'both' | 'sender' = replyBoth ? 'both' : 'sender'
  if (!res.ok && replyBoth) {
    const first = await res.text()
    console.error('[send-milestone-email] two reply-to addresses refused', res.status, first)
    res = await post(payload(sender.email || FALLBACK_FROM))
    replyToUsed = 'sender'
  }

  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[send-milestone-email]', res.status, json)
    return NextResponse.json(
      { error: json?.message || `The mail service refused the send (${res.status}).` }, { status: 502 })
  }

  // THE EMAIL HAS GONE. Everything from here on is bookkeeping, and a failure in
  // it is said out loud rather than reported as a failed send - the worst
  // outcome would be somebody sending it twice because the record did not save.
  const entry: SentEmail = {
    template: template.id,
    at: new Date().toISOString(),
    by: sender.name,
    to: where.to,
    cc: where.cc,
    attached: attachments.length > 0,
    // What this particular email told them about the rate.
    rateNotice: !!built.rateNotice,
  }
  let recorded = false
  try {
    // Written whole. emails_sent is a JSON column and a partial write loses a
    // send - see docs/milestone-emails-schema.sql.
    const { data: wrote } = await supabase.from('deals')
      .update({ emails_sent: withSent(deal, entry) }).eq('id', dealId).select('id')
    recorded = !!wrote && wrote.length > 0
  } catch (e) {
    console.error('[send-milestone-email] record failed', e)
  }

  return NextResponse.json({
    ok: true,
    id: json?.id || null,
    sentTo: where.redirected ? where.to : undefined,
    recipientCount: where.to.length,
    cc: where.cc,
    copyDropped: where.copyDropped,
    attached: attachments.length,
    replyTo: replyToUsed,
    testDeal: isTestDeal(deal),
    redirected: where.redirected,
    recorded,
    // Said in words, because the screen shows this one to a person.
    warning: recorded ? '' :
      'The email has gone, but the deal would not record it. Check with whoever else can send before sending it again.',
    problems: built.problems,
  })
}
