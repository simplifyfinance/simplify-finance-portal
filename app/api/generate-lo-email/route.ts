import { NextRequest, NextResponse } from 'next/server'

const brokers: Record<string, { name: string; title: string; crn: string; calendly: string }> = {
  'Fabio': { name: 'Fabio de Castro', title: 'Director / Mortgage Broker', crn: '483807', calendly: 'https://calendly.com/fabiobroker' },
  'Mark': { name: 'Mark Gallo', title: 'Mortgage Broker', crn: '496195', calendly: 'https://calendly.com/markgallo/phonecall' },
}

function shell(body: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f3;font-family:Arial,sans-serif"><tr><td><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;margin:0 auto"><tr><td style="background:#F2E8DB;padding:24px;text-align:center"><img src="https://simplify-finance-portal.vercel.app/logo-dark.png" alt="Simplify Finance" style="height:180px;width:auto;display:block;margin:0 auto 6px" /><p style="color:#7a6f5f;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0">Finance, Simplified.</p></td></tr><tr><td style="padding:28px">${body}</td></tr><tr><td style="background:#343333;padding:14px 16px;text-align:center"><p style="color:rgba(255,255,255,0.6);font-size:10px;line-height:1.6;margin:0">Rates quoted are indicative only and subject to change. This email does not constitute formal approval.</p><p style="color:rgba(255,255,255,0.4);font-size:10px;margin:4px 0 0">&copy; 2026 Simplify Finance | St Leonards, Sydney | Australian Credit Licence: 387025</p></td></tr></table></td></tr></table>`
}

function brokerBox(text: string) {
  return `<div style="background:#FFF8E7;border-left:4px solid #F59E0B;border-radius:0 6px 6px 0;padding:13px 15px;margin-bottom:18px"><p style="font-size:10px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Broker personalisation</p><p style="font-size:13px;color:#333;line-height:1.6">${text || 'Hi [Client First Name], [Add your personal opening here.]'}</p></div>`
}

function sig(b: { name: string; title: string; crn: string }) {
  return `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;max-width:240px;margin-top:20px"><p style="font-size:14px;font-weight:600;color:#333;margin-bottom:2px">${b.name}</p><p style="font-size:12px;color:#666;margin-bottom:2px">${b.title}</p><p style="font-size:11px;color:#999">CR No. ${b.crn}</p></div>`
}

function p(t: string) { return `<p style="font-size:14px;color:#333;margin-bottom:14px;line-height:1.6">${t}</p>` }
function tick(s: string) { return `<p style="font-size:12px;color:#444;margin:4px 0;line-height:1.5"><span style="color:#2DBEFF;font-weight:700;margin-right:6px">&#10003;</span>${s}</p>` }
function notesBox(items: string[]) {
  if (!items.length) return ''
  return `<div style="background:#EFF6FF;border-left:4px solid #2DBEFF;border-radius:0 6px 6px 0;padding:13px 15px;margin:18px 0"><p style="font-size:10px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Important things to note</p>${items.map(i => `<p style="font-size:12px;color:#334155;margin:4px 0;line-height:1.6">&bull; ${i}</p>`).join('')}</div>`
}
function ctas(calendly: string, proceedUrl?: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>
    <td><a href="${proceedUrl || calendly}" style="background:#2DBEFF;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">I am ready to proceed</a></td>
    <td width="10">&nbsp;</td>
    <td><a href="${calendly}" style="background:#343333;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">Book a call</a></td>
  </tr></table>`
}

function buildLenderTable(lenders: any[], isBridging: boolean, recommendedLender?: string) {
  const cols = lenders.length
  const pct = cols === 1 ? '100%' : cols === 2 ? '50%' : '33%'

  const headers = lenders.map((l, i) => { const isRec = recommendedLender && l.lenderName === recommendedLender; return `<td width="${pct}" style="background:#f8f8f8;padding:14px;border:1px solid #e0e0e0;vertical-align:top"><p style="font-size:13px;font-weight:700;color:#343333;margin:0 0 6px">OPTION ${i+1}</p><p style="font-size:14px;font-weight:700;color:#2DBEFF;margin:0 0 4px">${l.lenderName} &mdash; ${l.productName}</p>${l.approvalDays ? `<p style="font-size:12px;color:#777;margin:4px 0 0">${l.approvalDays} to approval</p>` : ''}${isRec ? '<p style="font-size:11px;font-weight:700;color:#D97706;border:1px solid #D97706;display:inline-block;padding:2px 8px;border-radius:3px;margin:6px 0 0">&#9733; Recommended</p>' : ''}${l.specialNote ? `<p style="font-size:11px;color:#dc2626;margin:6px 0 0">&#10071; ${l.specialNote}</p>` : ''}</td>` }).join('')

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
    const bridgingRows = lenders.map(l => `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top"><p style="font-size:12px;font-weight:600;color:#333;margin:0 0 6px">Bridging Loan (debt while holding both properties):</p><p style="font-size:12px;color:#333;margin:0 0 8px"><strong>Bridging loan: $${l.bridgingLoanAmount || 'XXX'}</strong></p><p style="font-size:12px;color:#333;margin:0"><strong>Estimated Interest Capitalised (over ${l.bridgingTerm || '12'} months): $${l.estimatedInterest || 'XXX'}</strong></p></td>`).join('')
    featureCells += `<tr>${bridgingRows}</tr>`
  } else {
    const modules = ['variablePI', 'variableIO', 'fixedPI', 'fixedIO'] as const
    const moduleLabels: Record<string, string> = { variablePI: 'Principal and Interest', variableIO: 'Interest Only', fixedPI: 'Fixed — Principal and Interest', fixedIO: 'Fixed — Interest Only' }
    const anyEnabled = (module: string) => lenders.some((l: any) => l[module]?.enabled)
    modules.forEach(mod => {
      if (!anyEnabled(mod)) return
      const headerCells = lenders.map(() => `<td style="padding:10px 14px;border:1px solid #e0e0e0;background:#fafafa"><p style="font-size:12px;font-weight:700;color:#343333;margin:0;text-decoration:none">${moduleLabels[mod]}</p></td>`).join('')
      featureCells += `<tr>${headerCells}</tr>`
      const contentCells = lenders.map((l: any) => {
        const m = l[mod]
        if (!m?.enabled) return `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top"><p style="font-size:12px;color:#999">Not offered</p></td>`
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
      if (l.rateLockFee) fees += tick("Rate lock fee: " + l.rateLockFee)
      if (l.offsetAccount) fees += tick("Offset account: " + l.offsetAccount)
      return `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top">${fees}</td>`
    }).join('')
    featureCells += `<tr>${feeRows}</tr>`
  }

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>${headers}</tr>${featureCells}</table>`
}

function walletLinkBox(link: string) {
  if (!link) return ''
  return `<div style="background:#F0FBF7;border-left:4px solid #1D9E75;border-radius:0 6px 6px 0;padding:16px;margin:18px 0">
    <p style="font-size:13px;font-weight:700;color:#0F6E56;margin:0 0 8px">Share your bank statements securely</p>
    <p style="font-size:13px;color:#333;line-height:1.6;margin:0 0 12px">To help us verify your income and finalise your application, we use a secure platform called WealthDesk to safely collect your bank statements. This is a secure, read-only connection — we never see or store your online banking login details.</p>
    <a href="${link}" style="background:#1D9E75;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">Share bank statements</a>
  </div>`
}

export async function POST(req: NextRequest) {
  const { broker, dealId, loData: d } = await req.json()
  const b = brokers[broker] || brokers['Fabio']
  const isBridging = d.template === 'lo_bridging'
  const proceedUrl = dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=LO` : undefined

  const templateLabel = d.template === 'lo_purchase' ? 'purchase an owner-occupied property' : d.template === 'lo_refinance' ? 'refinance your existing loan' : 'bridge between properties'

  let body = brokerBox(d.brokerPersonalisation)
  body += p(`Our team have now finalised your lending options to select from as you are looking to ${templateLabel}.`)

  if (!isBridging && (d.purchasePrice || d.loanAmount)) {
    body += `<p style="font-size:14px;font-weight:600;color:#343333;margin-bottom:8px">Your numbers would be:</p>`
    if (d.purchasePrice) body += p(`Purchase Price: $${d.purchasePrice}`)
    if (d.stampDuty) body += p(`Stamp Duty (NSW): $${d.stampDuty}`)
    if (d.deposit) body += p(`Deposit Required: $${d.deposit}`)
    if (d.loanAmount) body += p(`Loan Amount: $${d.loanAmount}`)
    if (d.existingLoan) body += p(`Existing Loan Balance: $${d.existingLoan}`)
  }

  if (d.documentsRequired.length > 0) {
    body += `<p style="font-size:14px;font-weight:600;color:#343333;margin-bottom:8px">Please note, below numbers are subject to reviewing the following documents:</p>`
    body += d.documentsRequired.map((doc: string) => `<p style="font-size:13px;color:#555;margin:4px 0">&ndash; ${doc}</p>`).join('')
    body += '<br>'
  }

  if (d.criteriaUsed.length > 0) {
    body += p('<strong>When conducting our research, we focused on lenders that would offer the following:</strong>')
    body += d.criteriaUsed.map((c: string) => `<p style="font-size:13px;color:#555;margin:4px 0">&ndash; ${c}</p>`).join('')
    body += '<br>'
  }

  body += p('<strong>Please note that this email does not constitute as a pre-approval.</strong>')

  if (d.additionalNotes) {
    body += p(d.additionalNotes)
  }

  body += p('Please note, for the requested loan amount, we have added a buffer to cover the last month\'s repayment and any applicable discharge fees. This will ensure there is no shortfall come settlement. Any funds not required will be credited back into your loan so that no additional interest is charged.')

  if (d.recommendedLender && d.recommendationNote) {
    body += `<p style="font-size:14px;font-weight:700;color:#343333;margin-bottom:8px">Our Recommendation: ${d.recommendedLender}</p>`
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
