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
}) {
  const { dealId, dealName, clientName, brokerName, leadSource, dealType, incomeType, internalNotes, creditOfficerName, alreadyBcActioned, recipientEmail } = params
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

  const html = `<p>Hi,</p>
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
export async function notifyCrisMoveCard(dealName: string, brokerName: string, action: string, closed = false, attachments?: { filename: string; content: string }[], recipientEmail?: string | null, answers?: { subject?: string; lines?: string[]; urgent?: boolean }) {
  const bg = closed ? '#E6F5EC' : '#F2E9FB'
  const color = closed ? '#1D9E75' : '#7C3AED'
  const html = `<p>Hi,</p>
    <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Deal</span></td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0">${dealName}</td></tr>
      <tr><td style="color:#666;font-size:13px;padding:3px 0"><span style="color:#666;">Broker</span></td><td style="text-align:right;font-size:13px;padding:3px 0">${brokerName || ''}</td></tr>
    </table>
    <p style="color:#666;font-size:13px;margin:0 0 6px"><span style="color:#666;">Action needed in SalesTrekker:</span></p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0"><tr><td bgcolor="${bg}" style="background:${bg};border-radius:8px;padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:${color}">${action}</td></tr></table>
    ${answers?.lines?.length ? `<table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:16px 0 0" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${answers.lines.map(l => {
        const at = l.indexOf(':')
        const k = at > 0 ? l.slice(0, at) : ''
        const v = at > 0 ? l.slice(at + 1).trim() : l
        return `<tr><td style="color:#666;font-size:13px;padding:3px 0;vertical-align:top;width:38%"><span style="color:#666;">${k}</span></td><td style="font-size:13px;padding:3px 0">${v}</td></tr>`
      }).join('')}
    </table>` : ''}
    ${attachments && attachments.length ? `<p style="color:#666;font-size:13px;margin:12px 0 0"><span style="color:#666;">The handover and the deal summary are attached — please save both into this client's OneDrive folder. Each numbered box in the handover is the box of the same name in SalesTrekker.</span></p>` : ''}`

  // The subject carries the urgency, because that is the only part of an email a
  // busy person reads before deciding when to open it.
  const subject = answers?.subject || `SalesTrekker update needed — ${dealName}`
  await sendResendEmail(recipientEmail || 'info@simplifyfinance.com.au', subject, html, attachments)
}
