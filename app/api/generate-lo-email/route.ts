import { NextRequest, NextResponse } from 'next/server'
import { resolveBrokerProfile, noBrokerMessage } from '@/lib/broker-profile'


function shell(body: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f3" style="background:#f5f5f3;font-family:Arial,sans-serif"><tr><td bgcolor="#f5f5f3" align="center" style="background:#f5f5f3;padding:24px 12px"><table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" align="center" style="background:#ffffff;margin:0 auto"><tr><td bgcolor="#343333" align="center" style="background:#343333;padding:28px 24px;text-align:center"><img src="https://simplify-finance-portal.vercel.app/logo-charcoal.png" alt="Simplify Finance" height="80" style="height:80px;display:block;margin:0 auto;border:0" /></td></tr><tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;padding:14px 20px 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8A8279"><span style="color:#8A8279;">Finance, Simplified.</span></td></tr><tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 28px 28px">${body}<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-top:1px solid #E4E2DC;padding:12px 0 0"><p style="color:#8a8a84;font-size:10px;line-height:1.65;margin:0"><span style="color:#8a8a84;">Rates quoted are indicative only and subject to change. This email does not constitute formal approval.</span></p><p style="color:#9e9e98;font-size:10px;margin:6px 0 0;line-height:1.65"><span style="color:#9e9e98;">&copy; 2026 Simplify Finance | St Leonards, Sydney | Australian Credit Licence: 387025</span></p></td></tr></table></td></tr></table></td></tr></table>`
}

function brokerBox(text: string, firstName?: string, jointFirstName?: string, joint?: string) {
  const fn = (firstName || '[Client First Name]').trim()
  const jfn = (jointFirstName || '').trim()
  const greetingName = (joint === 'Yes' && jfn) ? `${fn} and ${jfn}` : fn
  return `<!--BROKER-BOX--><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
    <td width="4" bgcolor="#F59E0B" style="background:#F59E0B;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#FFF8E7" style="background:#FFF8E7;padding:13px 15px">
      <p style="font-size:10px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px"><span style="color:#92400E;">Broker personalisation</span></p>
      <p style="font-size:14px;color:#333333;margin:0 0 14px;line-height:1.6"><span style="color:#333333;">Hi ${greetingName},</span></p>
      <p style="font-size:14px;color:#333333;margin:0;line-height:1.6"><span style="color:#333333;">${text || '[Add your personal opening here.]'}</span></p>
    </td></tr></table><!--/BROKER-BOX-->`
}

function sig(b: { name: string; title: string; crn: string }) {
  // Removed the signature box entirely - the broker already has their own signature set up in Outlook,
  // so this was showing a duplicate/redundant one inside the generated email body.
  return ''
}

function p(t: string) { return `<p style="font-size:14px;color:#333;margin-bottom:14px;line-height:1.6"><span style="color:#333;">${t}</span></p>` }
function tick(s: string) { return `<p style="font-size:12px;color:#444;margin:4px 0;line-height:1.5"><span style="color:#2DBEFF;font-weight:700;margin-right:6px">&#10003;</span>${s}</p>` }
function notesBox(items: string[]) {
  if (!items.length) return ''
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0"><tr>
    <td width="4" bgcolor="#2DBEFF" style="background:#2DBEFF;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#EFF6FF" style="background:#EFF6FF;padding:13px 15px">
      <p style="font-size:10px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px"><span style="color:#1d4ed8;">Important things to note</span></p>
      ${items.map(i => `<p style="font-size:12px;color:#334155;margin:4px 0;line-height:1.6"><span style="color:#334155;">&bull; ${i}</span></p>`).join('')}
    </td></tr></table>`
}
function ctas(calendly: string, proceedUrl?: string) {
  // Word will not paint a background on an inline link, so the colour lives on
  // the cell. Without this these arrived as bare blue and black text.
  const button = (href: string, bg: string, label: string) =>
    `<table cellpadding="0" cellspacing="0" border="0" style="display:inline-table"><tr>
      <td bgcolor="${bg}" align="center" style="background:${bg};border-radius:6px;padding:10px 18px">
        <a href="${href}" style="color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">${label}</a>
      </td></tr></table>`
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px"><tr>
    <td>${button(proceedUrl || calendly, '#2DBEFF', 'I am ready to proceed')}</td>
    <td width="10">&nbsp;</td>
    <td>${button(calendly, '#343333', 'Book a call')}</td>
  </tr></table>`
}

function buildLenderTable(lenders: any[], isBridging: boolean, recommendedLender?: string) {
  const cols = lenders.length
  const pct = cols === 1 ? '100%' : cols === 2 ? '50%' : '33%'

  const headers = lenders.map((l, i) => { const isRec = recommendedLender && l.lenderName === recommendedLender; return `<td width="${pct}" bgcolor="#f8f8f8" style="background:#f8f8f8;padding:14px;border:1px solid #e0e0e0;vertical-align:top"><p style="font-size:13px;font-weight:700;color:#343333;margin:0 0 6px"><span style="color:#343333;">OPTION ${i+1}</span></p><p style="font-size:14px;font-weight:700;color:#2DBEFF;margin:0 0 4px"><span style="color:#2DBEFF;">${l.lenderName} &mdash; ${l.productName}</span></p>${l.approvalDays ? `<p style="font-size:12px;color:#777;margin:4px 0 0"><span style="color:#777;">${l.approvalDays} to approval</span></p>` : ''}${isRec ? '<p style="font-size:11px;font-weight:700;color:#D97706;border:1px solid #D97706;display:inline-block;padding:2px 8px;border-radius:3px;margin:6px 0 0"><span style="color:#D97706;">&#9733; Recommended</span></p>' : ''}${l.specialNote ? `<p style="font-size:11px;color:#dc2626;margin:6px 0 0"><span style="color:#dc2626;">&#10071; ${l.specialNote}</span></p>` : ''}</td>` }).join('')

  let featureCells = ''
  if (isBridging) {
    const rows = [
      (l: any) => l.bridgingRate ? tick(`Variable rate from ${l.bridgingRate}% p.a.*`) : '',
      (l: any) => l.bridgingTerm ? tick(`Loan term up to ${l.bridgingTerm} months`) : '',
      () => tick('Interest Only Capitalised'),
      (l: any) => l.establishmentFee ? tick(`Establishment Fee of $${l.establishmentFee}`) : '',
      (l: any) => l.monthlyFee ? tick(`Monthly Loan Account Fee of $${l.monthlyFee}`) : '',
      (l: any) => l.docProcessingFee ? tick(`Document Processing Fee of $${l.docProcessingFee}`) : '',
    ]
    featureCells = `<tr>${lenders.map(l => `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top">${rows.map(fn => fn(l)).join('')}</td>`).join('')}</tr>`
    const bridgingRows = lenders.map(l => `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top"><p style="font-size:12px;font-weight:600;color:#333;margin:0 0 6px"><span style="color:#333;">Bridging Loan (debt while holding both properties):</span></p><p style="font-size:12px;color:#333;margin:0 0 8px"><span style="color:#333;"><strong>Bridging loan: $${l.bridgingLoanAmount || 'XXX'}</strong></span></p><p style="font-size:12px;color:#333;margin:0"><span style="color:#333;"><strong>Estimated Interest Capitalised (over ${l.bridgingTerm || '12'} months): $${l.estimatedInterest || 'XXX'}</strong></span></p></td>`).join('')
    featureCells += `<tr>${bridgingRows}</tr>`
  } else {
    const modules = ['variablePI', 'variableIO', 'fixedPI', 'fixedIO'] as const
    const moduleLabels: Record<string, string> = { variablePI: 'Principal and Interest', variableIO: 'Interest Only', fixedPI: 'Fixed — Principal and Interest', fixedIO: 'Fixed — Interest Only' }
    const anyEnabled = (module: string) => lenders.some((l: any) => l[module]?.enabled)
    modules.forEach(mod => {
      if (!anyEnabled(mod)) return
      const headerCells = lenders.map(() => `<td bgcolor="#fafafa" style="padding:10px 14px;border:1px solid #e0e0e0;background:#fafafa"><p style="font-size:12px;font-weight:700;color:#343333;margin:0;text-decoration:none"><span style="color:#343333;">${moduleLabels[mod]}</span></p></td>`).join('')
      featureCells += `<tr>${headerCells}</tr>`
      const contentCells = lenders.map((l: any) => {
        const m = l[mod]
        if (!m?.enabled) return `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top"><p style="font-size:12px;color:#999"><span style="color:#999;">Not offered</span></p></td>`
        let content = tick(`Variable rate from ${m.rate}% p.a.*`)
        if (mod === 'fixedPI' || mod === 'fixedIO') content = tick(`Fixed rate ${m.rate}% p.a.* for ${m.fixedYears} years`)
        content += tick(`Monthly repayments of $${m.repayment}`)
        if (mod === 'variableIO' || mod === 'fixedIO') content += tick(`Interest Only for ${m.ioYears} years`)
        content += tick(`Over ${m.loanTerm} year loan term`)
        return `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top">${content}</td>`
      }).join('')
      featureCells += `<tr>${contentCells}</tr>`
    })
    const feeRows = lenders.map(l => {
      let fees = ''
      if (l.applicationFee) fees += tick("Application fee: " + l.applicationFee)
      if (l.annualFee) fees += tick("Annual fee: " + l.annualFee)
      if (l.valuationFee) fees += tick("Valuation fee: " + l.valuationFee)
      if (l.legalFee) fees += tick("Legal fee: " + l.legalFee)
      if (l.rateLockFee) fees += tick("Rate lock fee: " + l.rateLockFee)
      // What it costs to leave. Clients ask about these when comparing two
      // lenders, and until now they were nowhere in the email.
      if (l.earlyRepaymentFee) fees += tick("Early repayment fee: " + l.earlyRepaymentFee)
      if (l.dischargeFee) fees += tick("Discharge fee: " + l.dischargeFee)
      if (l.offsetAccount) fees += tick("Offset account: " + l.offsetAccount)
      return `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top">${fees}</td>`
    }).join('')
    featureCells += `<tr>${feeRows}</tr>`
  }

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>${headers}</tr>${featureCells}</table>`
}

function walletLinkBox(link: string) {
  if (!link) return ''
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0"><tr>
    <td width="4" bgcolor="#1D9E75" style="background:#1D9E75;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#F0FBF7" style="background:#F0FBF7;padding:16px">
      <p style="font-size:13px;font-weight:700;color:#0F6E56;margin:0 0 8px"><span style="color:#0F6E56;">Share your bank statements securely</span></p>
      <p style="font-size:13px;color:#333333;line-height:1.6;margin:0 0 12px"><span style="color:#333333;">To help us verify your income and finalise your application, we use a secure platform called WealthDesk to safely collect your bank statements. This is a secure, read-only connection &mdash; we never see or store your online banking login details.</span></p>
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#1D9E75" align="center" style="background:#1D9E75;border-radius:6px;padding:10px 18px">
          <a href="${link}" style="color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">Share bank statements</a>
        </td></tr></table>
    </td></tr></table>`
}

export async function POST(req: NextRequest) {
  const { broker, dealId, loData: d } = await req.json()
  const resolved = await resolveBrokerProfile(broker)
  if (!resolved) return NextResponse.json({ error: noBrokerMessage(broker) }, { status: 400 })
  const b = {
    name: resolved.name || String(broker || ''),
    title: resolved.title || '',
    crn: resolved.crn || '',
    calendly: resolved.calendly || '',
    email: resolved.email || '',
  }
  const isBridging = d.template === 'lo_bridging'
  const proceedUrl = dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=LO` : undefined


  // The broker's own opening already says what the client is doing and why, in
  // their words. Restating it underneath read as a second, blander version of
  // the same sentence, so the email goes straight to the figures.
  let body = brokerBox(d.brokerPersonalisation, d.firstName, d.jointFirstName, d.joint)

  if (!isBridging && (d.purchasePrice || d.loanAmount)) {
    body += `<p style="font-size:14px;font-weight:600;color:#343333;margin-bottom:8px"><span style="color:#343333;">Your numbers would be:</span></p>`
    if (d.purchasePrice) body += p(`Purchase Price: $${d.purchasePrice}`)
    if (d.stampDuty) body += p(`Stamp Duty (NSW): $${d.stampDuty}`)
    if (d.deposit) body += p(`Deposit Required: $${d.deposit}`)
    if (d.loanAmount) body += p(`Loan Amount: $${d.loanAmount}`)
    if (d.existingLoan) body += p(`Existing Loan Balance: $${d.existingLoan}`)
  }

  if (d.documentsRequired.length > 0) {
    body += `<p style="font-size:14px;font-weight:600;color:#343333;margin-bottom:8px"><span style="color:#343333;">Please note, below numbers are subject to reviewing the following documents:</span></p>`
    body += d.documentsRequired.map((doc: string) => `<p style="font-size:13px;color:#555;margin:4px 0"><span style="color:#555;">&ndash; ${doc}</span></p>`).join('')
    body += '<br>'
  }

  if (d.criteriaUsed.length > 0) {
    body += p('<strong>When conducting our research, we focused on lenders that would offer the following:</strong>')
    body += d.criteriaUsed.map((c: string) => `<p style="font-size:13px;color:#555;margin:4px 0"><span style="color:#555;">&ndash; ${c}</span></p>`).join('')
    body += '<br>'
  }

  body += p('<strong>Please note that this email does not constitute as a pre-approval.</strong>')

  if (d.additionalNotes) {
    body += p(d.additionalNotes)
  }

  body += p('Please note, for the requested loan amount, we have added a buffer to cover the last month\'s repayment and any applicable discharge fees. This will ensure there is no shortfall come settlement. Any funds not required will be credited back into your loan so that no additional interest is charged.')

  if (d.recommendedLender && d.recommendationNote) {
    body += `<p style="font-size:14px;font-weight:700;color:#343333;margin-bottom:8px"><span style="color:#343333;">Our Recommendation: ${d.recommendedLender}</span></p>`
    body += p(d.recommendationNote)
  }
  const sortedLenders = d.recommendedLender ? [...d.lenders].sort((a: any, b: any) => a.lenderName === d.recommendedLender ? -1 : b.lenderName === d.recommendedLender ? 1 : 0) : d.lenders
  body += buildLenderTable(sortedLenders, isBridging, d.recommendedLender)

  body += p('Please let us know which lender you would like to proceed with and if you have any questions regarding the numbers above.')
  body += ctas(b.calendly, proceedUrl)
  body += notesBox(d.importantNotesList || ['Any rates or fees quoted are subject to change', 'This email does not constitute as a formal approval'])
  body += sig(b)

  const html = shell(body)
  return NextResponse.json({ html })
}
