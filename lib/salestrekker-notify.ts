// The email tells staff where to go, and then takes them there: copying out of
// a PDF loses the bold and splits words across lines.
import { siteUrl } from './ready-link'

async function sendResendEmail(to: string, subject: string, html: string, attachments?: { filename: string; content: string }[]) {
  try {
    await fetch('https://api.resend.com/emails', {
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
        ...(attachments && attachments.length ? { attachments } : {})
      })
    })
  } catch (e) {
    // Non-fatal — the underlying action itself already succeeded
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

  const steps = [
    `Create a new deal card for <b>${clientName || 'this client'}</b>`,
    `Allocate to broker: <b>${brokerName || ''}</b>`,
    `Create a OneDrive folder for this client, and a SalesTrekker BCC code if applicable`,
    `Paste these into the portal's Fact Find "Deal links" section: <a href="${dealLink}" style="color:#2DBEFF">Open the deal &rarr;</a>
    <table style="width:100%;margin-top:8px;border-collapse:separate;border-spacing:0 4px" cellpadding="0" cellspacing="0">
      <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:6px 10px;font-size:12px;color:#343333">4a. OneDrive folder link</td></tr>
      <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:6px 10px;font-size:12px;color:#343333">4b. SalesTrekker card link</td></tr>
      <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:6px 10px;font-size:12px;color:#343333">4c. SalesTrekker BCC code</td></tr>
    </table>`,
    `Add labels &mdash; Lead source: <b>${leadSource || 'Not provided'}</b>, Deal type: <b>${dealType || ''}</b>, Income type: <b>${incomeType || 'Not yet available — check Fact Find'}</b>`,
    `Copy internal notes from the portal:<br><span style="color:#666;font-style:italic">${internalNotes ? internalNotes.replace(/\n/g, '<br>') : '(no notes entered yet)'}</span>`,
  ]

  if (creditOfficerName) {
    steps.push(`Assign credit assessor label: <b>${creditOfficerName}</b>`)
  }
  if (alreadyBcActioned) {
    steps.push(`Note: this deal is already at <b>BC Actioned</b> stage — set the card to that stage as part of creating it`)
  }

  const stepsRows = steps.map((s, i) => `
    <tr>
      <td bgcolor="#EBF5FE" style="background:#EBF5FE;border-radius:8px;padding:10px 12px;font-size:13px;color:#343333">
        <b style="color:#2DBEFF">${i + 1}.</b> ${s}
      </td>
    </tr>`).join('')

  const html = `${greeting(recipientName)}
    <p>A new deal is ready to be set up in SalesTrekker. Please complete the following:</p>
    <table style="width:100%;border-collapse:separate;border-spacing:0 8px" cellpadding="0" cellspacing="0">${stepsRows}</table>`

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
