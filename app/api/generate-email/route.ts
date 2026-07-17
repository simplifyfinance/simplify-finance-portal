import { NextRequest, NextResponse } from 'next/server'

const brokers: Record<string, { name: string; title: string; crn: string; calendly: string; email: string }> = {
  'Fabio': { name: 'Fabio de Castro', title: 'Director / Mortgage Broker', crn: '483807', calendly: 'https://calendly.com/fabiobroker', email: 'fabio@simplifyfinance.com.au' },
  'Mark': { name: 'Mark Gallo', title: 'Mortgage Broker', crn: '496195', calendly: 'https://calendly.com/markgallo/phonecall', email: 'mark@simplifyfinance.com.au' },
}

function shell(body: string, b: { name: string; title: string; crn: string; calendly: string }) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f3;font-family:Arial,sans-serif"><tr><td>
  <table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;margin:0 auto">
    <tr><td style="background:#343333;padding:28px 24px;text-align:center">
      <img src="https://simplify-finance-portal.vercel.app/logo-charcoal.png" alt="Simplify Finance" style="height:80px;width:auto;display:block;margin:0 auto 8px" />
      <p style="color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0">Finance, Simplified.</p>
    </td></tr>
    <tr><td style="padding:28px">${body}</td></tr>
    <tr><td style="background:#343333;padding:14px 16px;text-align:center">
      <p style="font-size:10px;color:rgba(255,255,255,0.6);margin:0 0 6px;line-height:1.6">Rates quoted are indicative only and subject to change. Figures are based on information provided and are not a formal credit assessment. Subject to lender approval.</p>
      <p style="font-size:10px;color:rgba(255,255,255,0.4);margin:0">&copy; 2026 Simplify Finance | St Leonards, Sydney | Australian Credit Licence: 387025</p>
    </td></tr>
  </table></td></tr></table>`
}

function brokerBox(personalisation: string) {
  return `<div style="background:#FFF8E7;border-left:4px solid #F59E0B;border-radius:0 6px 6px 0;padding:13px 15px;margin-bottom:18px">
    <p style="font-size:10px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Broker — personalise before sending</p>
    <p style="font-size:13px;color:#333;line-height:1.6">${personalisation || 'Hi [Client First Name], great speaking with you today. [Add your personal opening here.]'}</p>
  </div>`
}

function notesBox(items: string[]) {
  const all = ['Any rates or fees quoted are subject to change', ...items]
  return `<div style="background:#EEF6FD;border-left:4px solid #2DBEFF;border-radius:0 6px 6px 0;padding:13px 15px;margin-bottom:18px">
    <p style="font-size:10px;font-weight:600;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Important things to note</p>
    ${all.map(i => `<p style="font-size:12px;color:#334155;margin:4px 0;line-height:1.6">&bull; ${i}</p>`).join('')}
  </div>`
}

function heading() { return `<p style="font-size:11px;font-weight:600;color:#343333;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px">Borrowing Capacity Review</p>` }

function card(title: string, rows: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td style="padding:14px">
    <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">${title}</p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr></table>`
}

function row(l: string, v: string) {
  return `<tr><td style="font-size:12px;color:#555;padding:3px 0">${l}</td><td style="font-size:12px;color:#343333;font-weight:500;text-align:right">${v}</td></tr>`
}

function check(items: string[]) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td style="padding:14px">
    <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Based on your numbers</p>
    ${items.map(i => `<p style="font-size:13px;color:#555;margin:4px 0">&#10003; ${i}</p>`).join('')}
  </td></tr></table>`
}

function ctas(calendly: string, proceedUrl?: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>
    <td><a href="${proceedUrl || calendly}" style="background:#2DBEFF;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">I am ready to proceed</a></td>
    <td width="10">&nbsp;</td>
    <td><a href="${calendly}" style="background:#343333;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">Book a call</a></td>
  </tr></table>`
}

function sig(b: { name: string; title: string; crn: string }) {
  return `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;max-width:240px">
    <p style="font-size:14px;font-weight:600;color:#333;margin-bottom:2px">${b.name}</p>
    <p style="font-size:12px;color:#666;margin-bottom:2px">${b.title}</p>
    <p style="font-size:11px;color:#999">CR No. ${b.crn}</p>
  </div>`
}

function p(t: string) { return `<p style="font-size:14px;color:#333;margin-bottom:14px">${t}</p>` }
function p13(t: string) { return `<p style="font-size:13px;color:#555;margin-bottom:12px">${t}</p>` }
function propHead(t: string, rentalIncome?: string) {
  return `<p style="font-size:13px;color:#343333;font-weight:600;margin-bottom:8px">&#127968; ${t}</p>` +
    (rentalIncome ? `<p style="font-size:12px;color:#666;margin-bottom:8px">Rental income: $${rentalIncome}/week</p>` : '')
}

function buildLVRrow(lvr: string, lvrCustom: string, lmi: string) {
  const effectiveLvr = lvr === 'Other' ? lvrCustom : lvr
  const lvrNum = parseFloat(effectiveLvr)
  if (lvrNum > 80 && lmi) {
    return row('LVR', effectiveLvr) + row('LMI (estimated)', lmi)
  }
  return row('LVR', lvrNum <= 80 ? `${effectiveLvr} (no LMI)` : effectiveLvr)
}

function buildChecklist(d: any) {
  const items = []
  const breakdown: { label: string; amount: number | null }[] = d.incomeBreakdown || []
  if (breakdown.length > 0) {
    breakdown.forEach(entry => {
      if (entry.amount === null) {
        items.push(`${entry.label}: Income as per tax returns provided`)
      } else {
        items.push(`${entry.label} $${entry.amount} p.a.`)
      }
    })
  } else if (d.incomeBase) {
    items.push(`Base salary (excl. super) $${d.incomeBase} p.a.`)
  }
  if (d.housingExpense) items.push(d.housingExpense)
  if (d.joint === 'Yes') items.push('Joint application')
  if (d.dependants) items.push(`${d.dependants} dependant${d.dependants === '1' ? '' : 's'}`)
  if (d.hecs) items.push(`HECS $${d.hecs} p.a.`)
  if (d.carLoan) items.push(`Car loan $${d.carLoan}/mo`)
  if (d.personalLoan) items.push(`Personal loan $${d.personalLoan}/mo`)
  if (d.ccLimit) items.push(`Credit card limit $${d.ccLimit}`)
  return items
}

export async function POST(req: NextRequest) {
  const { prompt, broker, dealId, formData } = await req.json()
  const b = brokers[broker] || brokers['Fabio']
  const d = formData || {}

  const template = d.template || 'oo_purchase'
  const personalisation = d.brokerNotes || ''
  const checkItems = buildChecklist(d)
  const notes = d.additionalNotes || []

  let body = ''

  if (template === 'refinance_equity') {
    body = heading() + brokerBox(personalisation) +
      p('Great news — we have finished running your numbers and the results are looking really positive.') +
      p(`Based on your current financial position, you have sufficient capacity to refinance your property and access approximately ${d.splits?.[1]?.amount || '[equity amount]'} in equity, while also securing a competitive rate.`) +
      p13('Here is a breakdown of the structure:') +
      propHead(`Against ${d.suburb || '[Property Address]'}`, d.incomeRental) +
      card('Split 1 - Refinanced Loan', row('Existing loan balance', '$' + (d.existingLoanBal || '')) + row('Loan amount', '$' + d.splits?.[0]?.amount || '') + row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') + row('Estimated repayments', '[calculated]') + row('Repayment type', d.splits?.[0]?.type || 'P&I') + row('Loan term', (d.loanTerm || '30') + ' years')) +
      card('Split 2 - Equity Release', row('Equity release amount', '$' + (d.equityRelease || '')) + row('Loan amount', '$' + d.splits?.[1]?.amount || '') + row('Indicative rate', (d.splits?.[1]?.rate || '') + '% p.a.*') + row('Estimated repayments', '[calculated]') + row('Repayment type', d.splits?.[1]?.type || 'Interest Only')) +
      check(checkItems) +
      p('The numbers are looking strong. The next step is finding the right lender and rate for your situation — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + notesBox(notes) + sig(b)

  } else if (template === 'refinance_only') {
    body = heading() + brokerBox(personalisation) +
      p('Great news — we have finished running your numbers and the results are looking really positive.') +
      p('Based on your current financial position, you have sufficient capacity to refinance your existing loan and secure a competitive rate.') +
      p13('Here is a breakdown of the structure:') +
      propHead(`Against ${d.suburb || '[Property Address]'}`, d.incomeRental) +
      card('Refinanced Loan', row('Existing loan balance', '$' + (d.existingLoanBal || '')) + row('New loan amount', '$' + d.splits?.[0]?.amount || '') + row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') + row('Estimated repayments', '[calculated]') + row('Repayment type', d.splits?.[0]?.type || 'P&I') + row('Loan term', (d.loanTerm || '30') + ' years')) +
      check(checkItems) +
      p('The numbers are looking strong. The next step is finding the right lender and rate for your situation — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + notesBox(notes) + sig(b)

  } else if (template === 'oo_purchase') {
    const lvr = d.lvr || '80%'
    const lvrNum = parseFloat(lvr)
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${d.splits?.[0]?.amount || '[amount]'}</strong>.`) +
      p(`With a contribution of <strong>${d.deposit || '[deposit]'}</strong> in savings, you could achieve a purchase price of <strong>${d.purchasePrice || '[purchase price]'}</strong>.`) +
      p13('Here is a breakdown of the structure:') +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row(`Deposit${d.depositSource ? ` (${d.depositSource})` : ''}`, '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        (lvrNum > 80 && d.lmi ? row('LVR', lvr) + row('LMI (estimated)', d.lmi) : row('LVR', `${lvr} (no LMI)`)) +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + notesBox(notes) + sig(b)

  } else if (template === 'investment_purchase') {
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${d.splits?.[0]?.amount || '[amount]'}</strong>.`) +
      p(`With a contribution of <strong>${d.deposit || '[deposit]'}</strong> in savings, you could achieve a purchase price of <strong>${d.purchasePrice || '[purchase price]'}</strong>.`) +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row(`Deposit${d.depositSource ? ` (${d.depositSource})` : ''}`, '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('LVR', d.lvr || '80%') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', d.splits?.[0]?.type || 'Interest Only (5 years)')
      ) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right structure for your investment — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + notesBox(notes) + sig(b)

  } else if (template === 'buy_sell') {
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${d.splits?.[0]?.amount || '[amount]'}</strong>.`) +
      card('Sale Proceeds Summary',
        row('Expected sale price', d.salePrice || '') +
        row('Agent fees / selling costs', d.agentFees || '') +
        row('Mortgage to discharge', d.mortgageDischarge || '') +
        `<tr style="border-top:1px solid rgba(122,92,58,0.3)"><td style="font-size:12px;font-weight:600;color:#343333;padding-top:6px">Net proceeds (est.)</td><td style="font-size:12px;font-weight:600;color:#343333;text-align:right;padding-top:6px">${d.netProceeds || ''}</td></tr>`
      ) +
      card('New Purchase',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row('Deposit (from sale proceeds)', '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      check(checkItems) +
      p('Now it is about finding the right lender, the right rate, and making sure the timing between your sale and purchase lines up perfectly. That is exactly what we are here for.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      notesBox(notes) + sig(b)

  } else if (template === 'oo_lvr_compare') {
    const splits = d.splits || []
    const lvrCols = splits.map((s: any) => {
      const lvrNum = parseFloat(s.label)
      return `<td style="width:${Math.floor(100/splits.length)}%;vertical-align:top;padding:0 4px">
        <p style="font-size:13px;font-weight:700;color:#343333;text-align:center;margin-bottom:8px;background:#fff;padding:6px 8px;border-radius:4px">${s.label}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Loan amount: $${s.amount}</p>${s.deposit ? `<p style="font-size:11px;color:#555;margin:3px 0">Deposit required: $${s.deposit}</p>` : ""}
        <p style="font-size:11px;color:#555;margin:3px 0">Rate: ${s.rate}% p.a.*</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Type: ${s.type}</p>
      </td>`
    }).join('')
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${d.purchasePrice || '[purchase price]'}</strong>. Below we have outlined ${splits.length} scenarios based on different deposit contributions.`) +
      `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td style="padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Deposit Options</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${lvrCols}</tr></table>
      </td></tr></table>` +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + notesBox(notes) + sig(b)

  } else if (template === 'fhb') {
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p('There is currently a government scheme we believe that you would be eligible for. The 5% Deposit Scheme is a current government scheme that allows first home buyers with a minimum 5% deposit to purchase a property without the cost of mortgage insurance.') +
      `<p style="font-size:14px;color:#333;margin-bottom:8px">To apply for the 5% Deposit Scheme, home buyers must be:</p>
      <ul style="font-size:13px;color:#555;margin:0 0 16px 20px;line-height:1.9">
        <li>An Australian citizen(s) or Permanent Resident at the time they enter the loan</li>
        <li>Applying as an individual or couple</li>
        <li>Saved a minimum deposit of 5%**</li>
        <li>Intending to be owner-occupiers of the purchased property</li>
        <li>First home buyers who have not previously owned, or had an interest in, a property in Australia in the last 10 years</li>
        <li>Purchase a property within the price cap relevant to your state/territory</li>
      </ul>
      <p style="font-size:12px;color:#777;margin:0 0 16px;line-height:1.6">**Retained savings explanation: after the payment of your 5% deposit (plus any relevant stamp duty), the government allows you to retain up to 6 months of living expenses AND up to 6 months of scheduled loan repayments.</p>
      <p style="font-size:13px;color:#555;margin:0 0 16px">Further information: <a href="https://firsthomebuyers.gov.au/australian-government-5-percent-deposit-scheme" style="color:#2DBEFF">firsthomebuyers.gov.au/australian-government-5-percent-deposit-scheme</a></p>` +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row('Stamp duty', '$' + d.stampDuty || '/bin/zsh — first home buyer exemption') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('LMI', '/bin/zsh — guaranteed by NHFIC') +
        row('Your contribution required', '$' + d.deposit || '') +
        row('First home owner grant', d.fhog ? '$' + d.fhog : 'Not applicable') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + notesBox(notes) + sig(b)

  } else if (template === 'bridging') {
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p('Based on your current financial position, bridging finance is achievable for your next owner-occupied purchase.') +
      card('Bridging Loan Summary',
        row('Bridging loan (debt while holding both properties)', d.splits?.[0]?.amount || '') +
        row('End debt (after selling existing property)', d.splits?.[1]?.amount || '')
      ) +
      card('Loan 1 - Bridging Loan',
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Rate', 'Standard variable rate*') +
        row('Interest treatment', 'Capitalised during bridging period') +
        row('Bridging period', (d.bridgingPeriod || '12') + ' months')
      ) +
      card('Loan 2 - End Debt',
        row('Loan amount', '$' + d.splits?.[1]?.amount || '') +
        row('Indicative rate', (d.splits?.[1]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', `${d.splits?.[1]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right structure for your bridging scenario — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      notesBox(notes) + sig(b)

  } else if (template === 'family_pledge') {
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${d.splits?.[0]?.amount || '[amount]'}</strong>.`) +
      p(`With a contribution of <strong>${d.deposit || '[deposit]'}</strong> in savings, you could achieve a purchase price of <strong>${d.purchasePrice || '[purchase price]'}</strong> — using your parents' property as a security guarantee to avoid Lenders Mortgage Insurance.`) +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Your contribution required', '$' + d.deposit || '') +
        row('Guarantor', d.guarantorName || '') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      notesBox(notes) + sig(b)

  } else if (template === 'smsf') {
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p('When looking at your numbers, your borrowing capacity is looking strong for an SMSF purchase.') +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Your contribution required', '$' + d.deposit || '') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right SMSF structure for your investment — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      notesBox(notes) + sig(b)

  } else if (template === 'construction') {
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${d.splits?.[0]?.amount || '[amount]'}</strong>.`) +
      card('Your Loan Structure',
        row('Land value', d.landValue || '') +
        row('Construction cost', d.constructionCost || '') +
        row('Total project cost', d.purchasePrice || '') +
        row(`Deposit${d.depositSource ? ` (${d.depositSource})` : ''}`, '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      check(checkItems) +
      p('The next step is finding the right lender and construction loan structure for your project — and we will guide you through every step of that process.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      notesBox(notes) + sig(b)

  } else if (template === 'investment_equity') {
    const totalCost = d.purchasePrice && d.stampDuty ? `$${d.purchasePrice} + $${d.stampDuty}` : ''
    const existingLoanCol = `
      <p style="font-size:12px;font-weight:600;color:#343333;margin:0 0 6px">Existing loan refinanced</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Loan amount: $${d.splits?.[0]?.amount || ''}</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Indicative rate: ${d.splits?.[0]?.rate || ''}% p.a.*</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Estimated repayments: [calculated]</p>
      <p style="font-size:11px;color:#555;margin:2px 0 10px">Repayment type: ${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years</p>
      <p style="font-size:12px;font-weight:600;color:#343333;margin:0 0 6px">Equity access</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Loan amount: $${d.splits?.[1]?.amount || ''}</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Indicative rate: ${d.splits?.[1]?.rate || ''}% p.a.*</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Estimated repayments: [calculated]</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Repayment type: ${d.splits?.[1]?.type || 'P&I'} over ${d.loanTerm || '30'} years</p>`
    const newPurchaseCol = `
      <p style="font-size:11px;color:#555;margin:2px 0">Loan amount: $${d.splits?.[2]?.amount || ''}</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Indicative rate: ${d.splits?.[2]?.rate || ''}% p.a.*</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Estimated repayments: [calculated]</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Repayment type: ${d.splits?.[2]?.type || 'P&I'} over ${d.loanTerm || '30'} years</p>`

    body = heading() + brokerBox(personalisation) +
      p('We have now finalised your review as you are looking at purchasing an owner-occupied/investment property.') +
      p('We would use equity in your owner-occupied/investment property to help fund the deposit plus stamp duty costs.') +
      p('A second loan will be set up against your new purchase, so all properties are stand alone — these are two separate securities, not cross-collateralised.') +
      p(`Provided you are ok to use equity, we could look at a purchase price of <strong>$${d.purchasePrice || '[amount]'}</strong>.`) +
      p13('Your numbers would be:') +
      card('Summary',
        row('Purchase price', '$' + (d.purchasePrice || '')) +
        row('Stamp duty', '$' + (d.stampDuty || '')) +
        row('Total cost (plus solicitor\'s fees and incidentals)', totalCost) +
        row('Loan amount', '$' + (d.splits?.[2]?.amount || '')) +
        row('Deposit needed (from equity release and personal savings)', '$' + (d.equityRelease || ''))
      ) +
      p13('Below is a breakdown of the structure:') +
      `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px"><tr>
        <td width="50%" style="background:#F2E8DB;padding:14px;border:1px solid #e5ddc8;vertical-align:top">
          <p style="font-size:12px;font-weight:700;color:#343333;margin:0 0 10px">&#127968; Against ${d.suburb || '[Existing Property]'}</p>
          ${existingLoanCol}
        </td>
        <td width="50%" style="background:#F2E8DB;padding:14px;border:1px solid #e5ddc8;vertical-align:top">
          <p style="font-size:12px;font-weight:700;color:#343333;margin:0 0 10px">&#127968; Against new purchase</p>
          ${newPurchaseCol}
        </td>
      </tr></table>` +
      check(checkItems) +
      p('Please let us know your thoughts and if you have any questions regarding the numbers above.') +
      p('The next step is to collect your documentation so we can look at specific lenders and interest rates.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + notesBox(notes) + sig(b)

  } else if (template === 'custom') {
    body = heading() + brokerBox(personalisation) +
      p('We have completed your borrowing capacity assessment.') +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${d.splits?.[0]?.amount || '[amount]'}</strong>.`) +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row(`Deposit${d.depositSource ? ` (${d.depositSource})` : ''}`, '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('LVR', d.lvr || '') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      check(checkItems) +
      p('The next step is finding the right lender and rate for your situation — and that is exactly what we will do for you.') +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + notesBox(notes) + sig(b)

  } else {
    body = heading() + brokerBox(personalisation) + p('Email template coming soon.') + ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + sig(b)
  }

  const html = shell(body, b)
  const brokerFirstName = b.name.split(' ')[0]; return NextResponse.json({ html, brokerFirstName })
}
