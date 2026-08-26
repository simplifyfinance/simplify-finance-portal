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
export async function notifyCrisMoveCard(dealName: string, brokerName: string, action: string, closed = false, attachments?: { filename: string; content: string }[], recipientEmail?: string | null) {
  const bg = closed ? '#E6F5EC' : '#F2E9FB'
  const color = closed ? '#1D9E75' : '#7C3AED'
  const html = `<p>Hi,</p>
    <table bgcolor="#f5f5f3" style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="color:#666;font-size:13px;padding:3px 0">Deal</td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0">${dealName}</td></tr>
      <tr><td style="color:#666;font-size:13px;padding:3px 0">Broker</td><td style="text-align:right;font-size:13px;padding:3px 0">${brokerName || ''}</td></tr>
    </table>
    <p style="color:#666;font-size:13px;margin:0 0 6px">Action needed in SalesTrekker:</p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0"><tr><td bgcolor="${bg}" style="background:${bg};border-radius:8px;padding:8px 12px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:${color}">${action}</td></tr></table>
    ${attachments && attachments.length ? `<p style="color:#666;font-size:13px;margin:12px 0 0">Two PDFs are attached to this email (deal summary and compliance summary) — please save both into this client's OneDrive folder.</p>` : ''}`

  await sendResendEmail(recipientEmail || 'info@simplifyfinance.com.au', `SalesTrekker update needed — ${dealName}`, html, attachments)
}
