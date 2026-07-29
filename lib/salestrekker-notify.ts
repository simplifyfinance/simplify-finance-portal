async function sendResendEmail(to: string, subject: string, html: string) {
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
        html
      })
    })
  } catch (e) {
    // Non-fatal — the underlying action itself already succeeded
  }
}

// Trigger 1 (Path A or B) — Ellie creates the deal card in SalesTrekker
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
}) {
  const { dealId, dealName, clientName, brokerName, leadSource, dealType, incomeType, internalNotes, creditOfficerName, alreadyBcActioned } = params
  const dealLink = `https://simplify-finance-portal.vercel.app/deals/${dealId}`

  const steps = [
    `Create a new deal card for <b>${clientName || 'this client'}</b>`,
    `Allocate to broker: <b>${brokerName || ''}</b>`,
    `Create a OneDrive folder for this client, and a SalesTrekker BCC code if applicable`,
    `Paste the OneDrive link, SalesTrekker card link, and BCC code into the portal's Fact Find "Deal links" section: <a href="${dealLink}">Open the deal &rarr;</a>`,
    `Add labels &mdash; Lead source: <b>${leadSource || 'Not provided'}</b>, Deal type: <b>${dealType || ''}</b>, Income type: <b>${incomeType || 'Not yet available — check Fact Find'}</b>`,
    `Copy internal notes from the portal:<br><span style="color:#666;font-style:italic">${internalNotes ? internalNotes.replace(/\n/g, '<br>') : '(no notes entered yet)'}</span>`,
  ]

  if (creditOfficerName) {
    steps.push(`Assign credit assessor label: <b>${creditOfficerName}</b>`)
  }
  if (alreadyBcActioned) {
    steps.push(`Note: this deal is already at <b>BC Actioned</b> stage — set the card to that stage as part of creating it`)
  }

  const stepsHtml = steps.map((s, i) => `
    <div style="display:flex;gap:10px;align-items:flex-start;background:#EBF5FE;border-radius:8px;padding:10px 12px;margin-bottom:8px">
      <span style="font-size:12px;font-weight:600;background:#2DBEFF;color:#fff;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</span>
      <span style="font-size:13px;color:#343333">${s}</span>
    </div>`).join('')

  const html = `<p>Hi Ellie,</p><p>A new deal is ready to be set up in SalesTrekker. Please complete the following:</p>${stepsHtml}`

  await sendResendEmail('ellie@simplifyfinance.com.au', `New deal created — ${dealName}`, html)
}

// Triggers 2-5 — Cris moves/closes the card in SalesTrekker
export async function notifyCrisMoveCard(dealName: string, brokerName: string, action: string, closed = false) {
  const bg = closed ? '#E6F5EC' : '#F2E9FB'
  const color = closed ? '#1D9E75' : '#7C3AED'
  const html = `<p>Hi Cris,</p>
    <table style="background:#f5f5f3;border-radius:8px;padding:12px 16px;margin:0 0 16px" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="color:#666;font-size:13px;padding:3px 0">Deal</td><td style="text-align:right;font-size:13px;font-weight:600;padding:3px 0">${dealName}</td></tr>
      <tr><td style="color:#666;font-size:13px;padding:3px 0">Broker</td><td style="text-align:right;font-size:13px;padding:3px 0">${brokerName || ''}</td></tr>
    </table>
    <p style="color:#666;font-size:13px;margin:0 0 6px">Action needed in SalesTrekker:</p>
    <p style="font-size:14px;font-weight:600;padding:8px 12px;border-radius:8px;background:${bg};color:${color};margin:0">${action}</p>`

  await sendResendEmail('cris@simplifyfinance.com.au', `SalesTrekker update needed — ${dealName}`, html)
}
