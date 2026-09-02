// The email tells staff where to go, and then takes them there: copying out of
// a PDF loses the bold and splits words across lines.
import { siteUrl } from './ready-link'

// SENDING, AND KNOWING WHETHER IT SENT.
//
// This used to swallow every error with "non-fatal - the underlying action
// already succeeded". That is true of a card-move reminder and badly untrue of
// anything the screen then claims was sent. It now returns what happened, and
// callers who care can say so.
//
// `scheduledAt` hands the send to Resend with a time on it. That is how the
// documents-received email waits half an hour without anything of ours staying
// awake - no timer in a browser, no job to run, nothing to miss.
export type SendResult = { ok: boolean; id?: string; error?: string }

async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: string }[],
  scheduledAt?: string,
): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Simplify Finance Portal <notifications@simplifyfinance.com.au>',
        to,
        cc: 'info@simplifyfinance.com.au',
        subject,
        html,
        ...(attachments && attachments.length ? { attachments } : {}),
        ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
      })
    })
    const body = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      const why = body?.message || body?.error?.message || `Resend returned ${res.status}`
      console.error('[resend] send failed', why)
      return { ok: false, error: why }
    }
    return { ok: true, id: body?.id }
  } catch (e: any) {
    console.error('[resend] send threw', e)
    return { ok: false, error: e?.message || 'The email could not be sent.' }
  }
}

// Calling off a scheduled send. Checked rather than assumed: if Resend will not
// cancel it, the caller has to tell somebody, not pretend it is stopped.
export async function cancelResendEmail(id: string): Promise<SendResult> {
  try {
    const res = await fetch(`https://api.resend.com/emails/${id}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as any))
      return { ok: false, error: body?.message || `Resend returned ${res.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'The scheduled email could not be cancelled.' }
  }
}

// Trigger 1 (Path A or B) — whoever Settings nominates creates the deal card in SalesTrekker
// "Hi Cris," not "Hi,". Both notifications used the bare comma; a name is the
// cheapest way to make an automated email read as addressed to somebody rather
// than posted to a list. First name only - a profile often holds
// "Cristina Alvarez Reyes" and nobody greets a colleague like that.
function greeting(fullName?: string | null): string {
  const first = String(fullName || '').trim().split(/\s+/)[0]
  return first ? `<p>Hi ${first},</p>` : '<p>Hi,</p>'
}

export async function notifyEllieCreateCard(params: {
  dealId: string
  dealName: string
  clientName: string
  brokerName: string
  leadSource: string
  dealType: string
  incomeType: string
  internalNotes: string
  creditOfficerName?: string | null
  alreadyBcActioned?: boolean
  recipientEmail?: string | null
  recipientName?: string | null
}) {
  const { dealId, dealName, clientName, brokerName, leadSource, dealType, incomeType, internalNotes, creditOfficerName, alreadyBcActioned, recipientEmail, recipientName } = params
  const dealLink = `https://simplify-finance-portal.vercel.app/deals/${dealId}`

  // Built to read like the compliance push email, because the same people read
  // both and two different-looking emails from one system is one system that
  // looks like two. Fabio, 2 Sep 2026: "I rathe same look and feel as
  // complaince". Facts first, then What to do as numbered panels, then the
  // notes.
  const fact = (k: string, v: string) =>
    `<tr><td style="color:#666;font-size:13px;padding:3px 0;vertical-align:top;width:38%"><span style="color:#666;">${k}</span></td><td style="font-size:13px;padding:3px 0">${v}</td></tr>`

  const facts = [
    fact('Deal', dealName),
    fact('Client', clientName || 'Not provided'),
    fact('Broker', brokerName || 'Not provided'),
    fact('Lead source', leadSource || 'Not provided'),
    fact('Deal type', dealType || 'Not provided'),
    fact('Income type', incomeType || 'Not yet available — check the Fact Find'),
    creditOfficerName ? fact('Credit assessor', creditOfficerName) : '',
  ].join('')

  const html = `${greeting(recipientName)}
    <p>A new deal is ready to be set up in SalesTrekker.</p>
    <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 18px" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${facts}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">
      <tr><td style="font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:0 0 12px"><span style="color:#141C24;">What to do</span></td></tr>

      <tr><td bgcolor="#FDF6E7" style="background:#FDF6E7;border-radius:8px;padding:13px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 4px"><span style="color:#8A6218;">1 &nbsp;Create the deal card</span></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55;padding:0 0 4px"><span style="color:#8A6218;">For <b>${clientName || 'this client'}</b>, allocated to <b>${brokerName || 'the broker above'}</b>.</span></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55"><span style="color:#8A6218;">Add the labels from the table above: lead source, deal type and income type${creditOfficerName ? `, and the credit assessor <b>${creditOfficerName}</b>` : ''}.</span></td></tr>
          ${alreadyBcActioned ? `<tr><td style="padding:8px 0 0"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:7px 11px;font-family:Arial,sans-serif;font-size:12.5px"><span style="color:#B23A34;">The broker has already done the borrowing capacity on this one, so the card does not start at the beginning &mdash; create it straight at the <b>BC Actioned</b> stage.</span></td></tr></table></td></tr>` : ''}
        </table>
      </td></tr>
      <tr><td style="padding:8px 0 0"></td></tr>

      <tr><td bgcolor="#EAF6FD" style="background:#EAF6FD;border-radius:8px;padding:13px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 4px"><span style="color:#0B5E8A;">2 &nbsp;Set up the folders</span></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55"><span style="color:#0B5E8A;">A OneDrive folder for this client, and a SalesTrekker BCC code if one applies.</span></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 0 0"></td></tr>

      <tr><td bgcolor="#EFF9F2" style="background:#EFF9F2;border-radius:8px;padding:13px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 4px"><span style="color:#15803D;">3 &nbsp;Paste the three links back into the portal</span></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55;padding:0 0 9px"><span style="color:#15803D;">Open the deal, go to the Fact Find, and fill in <b>Deal links</b>. Without these nobody else can find the folder or the card.</span></td></tr>
          <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:7px 11px;font-family:Arial,sans-serif;font-size:12.5px"><span style="color:#141C24;">OneDrive folder link</span></td></tr>
          <tr><td style="padding:4px 0 0"></td></tr>
          <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:7px 11px;font-family:Arial,sans-serif;font-size:12.5px"><span style="color:#141C24;">SalesTrekker card link</span></td></tr>
          <tr><td style="padding:4px 0 0"></td></tr>
          <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:7px 11px;font-family:Arial,sans-serif;font-size:12.5px"><span style="color:#141C24;">SalesTrekker BCC code</span></td></tr>
          <tr><td style="padding:11px 0 0">
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0"><tr>
              <td bgcolor="#2DBEFF" style="background:#2DBEFF;border-radius:8px;padding:11px 20px">
                <a href="${dealLink}" style="color:#08252F;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none">Open the deal &rarr;</a>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td></tr>
    </table>

    <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="font-family:Arial,sans-serif;font-size:12.5px;font-weight:700;padding:0 0 5px"><span style="color:#141C24;">Internal notes from the broker</span></td></tr>
      <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6"><span style="color:#555;">${internalNotes ? internalNotes.replace(/\n/g, '<br>') : 'None entered yet.'}</span></td></tr>
    </table>`

  await sendResendEmail(recipientEmail || 'info@simplifyfinance.com.au', `New deal created — ${dealName}`, html)
}

// Triggers 2-5 — whoever Settings nominates moves/closes the card in SalesTrekker
// `answers` are what the broker was asked on the way out: commission, urgency,
// what is closing at settlement, how ID was done. They used to be asked in Slack
// after the pack had already gone, or not at all.
//
// This email is being rewritten properly later. For now the answers are here, in
// the order credit reads them, so nothing has to be chased.
export async function notifyCrisMoveCard(dealName: string, brokerName: string, action: string, closed = false, attachments?: { filename: string; content: string }[], recipientEmail?: string | null, answers?: { subject?: string; lines?: string[]; urgent?: boolean; dealId?: string; boxCount?: number; recipientName?: string | null; attachmentNames?: string[] }) {
  const bg = closed ? '#E6F5EC' : '#F2E9FB'
  const color = closed ? '#1D9E75' : '#7C3AED'
  const html = `${greeting(answers?.recipientName)}
    <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Deal</span></td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0">${dealName}</td></tr>
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Broker</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${brokerName || ''}</td></tr>
    </table>
    ${answers?.dealId ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">
      <tr><td style="font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:0 0 12px"><span style="color:#141C24;">What to do</span></td></tr>

      <tr><td bgcolor="#FDF6E7" style="background:#FDF6E7;border-radius:8px;padding:13px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 4px"><span style="color:#8A6218;">1 &nbsp;Save the ${attachments && attachments.length === 1 ? 'attached PDF' : 'two attached PDFs'} to OneDrive</span></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55;padding:0 0 8px"><span style="color:#8A6218;">Into this client&rsquo;s folder. They are the compliance record of what went to credit today.</span></td></tr>
          ${(answers?.attachmentNames || []).map(nm => `<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:7px 10px;font-family:Arial,sans-serif;font-size:12.5px"><span style="color:#141C24;">${nm}</span></td></tr><tr><td style="padding:4px 0 0"></td></tr>`).join('')}
        </table>
      </td></tr>
      <tr><td style="padding:8px 0 0"></td></tr>

      <tr><td bgcolor="#EAF6FD" style="background:#EAF6FD;border-radius:8px;padding:13px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 4px"><span style="color:#0B5E8A;">2 &nbsp;Copy ${answers?.boxCount ? `the ${answers.boxCount} boxes` : 'the boxes'} into SalesTrekker &mdash; from the portal, not the PDF</span></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55;padding:0 0 5px"><span style="color:#0B5E8A;">Every box on that page is a field in SalesTrekker with the same name. Press <b>Copy box</b>, paste into the field of that name. Single values &mdash; a date of birth, an ABN, a balance &mdash; copy on click.</span></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55;padding:0 0 11px"><span style="color:#0B5E8A;">Each box turns green once copied and stays green, so you can stop and come back. Do not summarise and do not reword &mdash; the wording is the compliance record.</span></td></tr>
          <tr><td style="padding:0">
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0"><tr>
              <td bgcolor="#2DBEFF" style="background:#2DBEFF;border-radius:8px;padding:11px 20px">
                <a href="${siteUrl()}/deals/${answers.dealId}/handover" style="color:#08252F;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none">Open the handover to copy &rarr;</a>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 0 0"></td></tr>

      <tr><td bgcolor="#E6F5EC" style="background:#E6F5EC;border-radius:8px;padding:13px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 4px"><span style="color:#166F52;">3 &nbsp;${action}</span></td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55"><span style="color:#166F52;">Once the boxes are in.</span></td></tr>
        </table>
      </td></tr>
    </table>` : `
    <p style="color:#666;font-size:13px;margin:0 0 6px"><span style="color:#666;">Action needed in SalesTrekker:</span></p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0"><tr><td bgcolor="${bg}" style="background:${bg};border-radius:8px;padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:${color}">${action}</td></tr></table>`}
    ${answers?.lines?.length ? `<table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:16px 0 0" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${answers.lines.map(l => {
        const at = l.indexOf(':')
        const k = at > 0 ? l.slice(0, at) : ''
        const v = at > 0 ? l.slice(at + 1).trim() : l
        return `<tr><td style="color:#666;font-size:13px;padding:3px 0;vertical-align:top;width:38%"><span style="color:#666;">${k}</span></td><td style="font-size:13px;padding:3px 0">${v}</td></tr>`
      }).join('')}
    </table>` : ''}`

  // The subject carries the urgency, because that is the only part of an email a
  // busy person reads before deciding when to open it.
  const subject = answers?.subject || `SalesTrekker update needed — ${dealName}`
  await sendResendEmail(recipientEmail || 'info@simplifyfinance.com.au', subject, html, attachments)
}

// --- documents received -----------------------------------------------------
//
// Two emails, one press, a gap between them. The filing person hears now; the
// assessor hears once the documents have had time to be renamed and filed. See
// lib/docs-received.ts for the timing and app/api/docs-received for the sending.

export async function notifyDocsToFile(params: {
  dealId: string; dealName: string; clientName: string; brokerName: string
  recipientEmail?: string | null; recipientName?: string | null
}): Promise<SendResult> {
  const { dealId, dealName, clientName, brokerName, recipientEmail, recipientName } = params
  const html = `${greeting(recipientName)}
    <p>The supporting documents for this client have come in.</p>
    <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 18px" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Deal</span></td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0">${dealName}</td></tr>
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Client</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${clientName || ''}</td></tr>
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Broker</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${brokerName || ''}</td></tr>
    </table>
    <table bgcolor="#FDF6E7" style="background:#FDF6E7;border-radius:8px;padding:13px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 4px"><span style="color:#8A6218;">Please rename them and file them in this client&rsquo;s OneDrive folder.</span></td></tr>
      <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55"><span style="color:#8A6218;">The credit assessor is told the documents are ready shortly, so this is the step that has to happen first.</span></td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0"><tr>
      <td bgcolor="#2DBEFF" style="background:#2DBEFF;border-radius:8px;padding:11px 20px">
        <a href="${siteUrl()}/deals/${dealId}" style="color:#08252F;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none">Open the deal &rarr;</a>
      </td>
    </tr></table>`
  return sendResendEmail(recipientEmail || 'info@simplifyfinance.com.au',
    `Documents received — please file — ${dealName}`, html)
}

export async function notifyDocsReadyForAssessor(params: {
  dealId: string; dealName: string; clientName: string; brokerName: string
  filedBy?: string | null
  recipientEmail?: string | null; recipientName?: string | null
  // When Resend should send it. Absent means now.
  scheduledAt?: string
}): Promise<SendResult> {
  const { dealId, dealName, clientName, brokerName, filedBy, recipientEmail, recipientName, scheduledAt } = params
  const html = `${greeting(recipientName)}
    <p>The supporting documents for this client are in and have been filed.</p>
    <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 18px" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Deal</span></td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0">${dealName}</td></tr>
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Client</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${clientName || ''}</td></tr>
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Broker</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${brokerName || ''}</td></tr>
      ${filedBy ? `<tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Marked received by</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${filedBy}</td></tr>` : ''}
    </table>
    <table bgcolor="#EFF9F2" style="background:#EFF9F2;border-radius:8px;padding:13px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:0 0 4px"><span style="color:#15803D;">You can complete the lending options.</span></td></tr>
      <tr><td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55"><span style="color:#15803D;">If anything is missing or unreadable, say so on the deal rather than going back to the client directly.</span></td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0"><tr>
      <td bgcolor="#2DBEFF" style="background:#2DBEFF;border-radius:8px;padding:11px 20px">
        <a href="${siteUrl()}/deals/${dealId}?stage=LO" style="color:#08252F;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none">Open the lending options &rarr;</a>
      </td>
    </tr></table>`
  return sendResendEmail(recipientEmail || 'info@simplifyfinance.com.au',
    `Documents ready — lending options can be completed — ${dealName}`, html, undefined, scheduledAt)
}
