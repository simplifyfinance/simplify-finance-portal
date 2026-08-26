import { NextRequest, NextResponse } from 'next/server'
import { resolveBrokerProfile, noBrokerMessage } from '@/lib/broker-profile'
import { createSupabaseServer } from '@/lib/supabase-server'


const DEFAULT_BRAND = {
  name: 'Simplify Finance',
  headerColor: '#343333',
  logoUrl: 'https://simplify-finance-portal.vercel.app/logo-charcoal.png',
  footerAddress: 'St Leonards, Sydney',
  acl: '387025',
}

function shell(body: string, b: { name: string; title: string; crn: string; calendly: string }, brand?: { name?: string; headerColor?: string; logoUrl?: string; footerAddress?: string; acl?: string }) {
  const brandName = brand?.name || DEFAULT_BRAND.name
  const headerColor = brand?.headerColor || DEFAULT_BRAND.headerColor
  const logoUrl = brand?.logoUrl || DEFAULT_BRAND.logoUrl
  const footerAddress = brand?.footerAddress || DEFAULT_BRAND.footerAddress
  const acl = brand?.acl || DEFAULT_BRAND.acl
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" height="80" style="height:80px;display:block;margin:0 auto 8px;border:0" />`
    : `<p style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px">${brandName}</p>`
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f3" style="background:#f5f5f3;font-family:Arial,sans-serif"><tr>
  <td bgcolor="#f5f5f3" align="center" style="background:#f5f5f3;padding:24px 12px">
  <table width="600" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#ffffff" style="background:#ffffff;margin:0 auto">
    <tr><td bgcolor="${headerColor}" style="background:${headerColor};padding:28px 24px;text-align:center">
      ${logoBlock}
      <p style="color:#9E9E9E;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0">Finance, Simplified.</p>
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px">${body}</td></tr>
    <tr><td bgcolor="${headerColor}" style="background:${headerColor};padding:14px 16px;text-align:center">
      <p style="font-size:10px;color:#B5B5B5;margin:0 0 6px;line-height:1.6">Rates quoted are indicative only and subject to change. Figures are based on information provided and are not a formal credit assessment. Subject to lender approval.</p>
      <p style="font-size:10px;color:#9E9E9E;margin:0">&copy; 2026 ${brandName} | ${footerAddress} | Australian Credit Licence: ${acl}</p>
    </td></tr>
  </table></td></tr></table>`
}

function brokerBox(personalisation: string, firstName?: string, jointFirstName?: string, joint?: string) {
  const fn = (firstName || '[Client First Name]').trim()
  const jfn = (jointFirstName || '').trim()
  const greetingName = (joint === 'Yes' && jfn) ? `${fn} and ${jfn}` : fn
  return `<!--BROKER-BOX--><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
    <td width="4" bgcolor="#F59E0B" style="background:#F59E0B;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#FFF8E7" style="background:#FFF8E7;padding:13px 15px">
      <p style="font-size:10px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px">Broker personalisation</p>
      <p style="font-size:14px;color:#333333;margin:0 0 14px;line-height:1.6">Hi ${greetingName},</p>
      <p style="font-size:14px;color:#333333;margin:0;line-height:1.6">${personalisation || '[Add your personal opening here.]'}</p>
    </td></tr></table><!--/BROKER-BOX-->`
}

function notesBox(items: string[]) {
  const all = ['Any rates or fees quoted are subject to change', ...items]
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
    <td width="4" bgcolor="#2DBEFF" style="background:#2DBEFF;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#EEF6FD" style="background:#EEF6FD;padding:13px 15px">
      <p style="font-size:10px;font-weight:600;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px">Important things to note</p>
      ${all.map(i => `<p style="font-size:12px;color:#334155;margin:4px 0;line-height:1.6">&bull; ${i}</p>`).join('')}
    </td></tr></table>`
}

function heading() { return `<p style="font-size:11px;font-weight:600;color:#343333;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px">Borrowing Capacity Review</p>` }

function card(title: string, rows: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
    <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px">${title}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr></table>`
}

function row(l: string, v: string) {
  return `<tr><td style="font-size:12px;color:#555;padding:3px 0">${l}</td><td style="font-size:12px;color:#343333;font-weight:500;text-align:right">${v}</td></tr>`
}

function check(items: string[]) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
    <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px">Based on your numbers</p>
    ${items.map(i => `<p style="font-size:13px;color:#555;margin:4px 0">&#10003; ${i}</p>`).join('')}
  </td></tr></table>`
}

function ctas(calendly: string, proceedUrl?: string) {
  // The colour has to live on the cell, not the link. Word paints a cell
  // background and ignores one on an inline anchor, which is why these arrived
  // as bare blue text in Outlook on Windows.
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

function sig(b: { name: string; title: string; crn: string }) {
  // Removed the signature box entirely - the broker already has their own signature set up in Outlook,
  // so this was showing a duplicate/redundant one inside the generated email body.
  return ''
}

// An amount inside a sentence. The tables hard-code the dollar sign; the prose
// did not, so figures were going to clients as bare numbers. A placeholder like
// [amount] is left exactly as it is, and a value the broker has already typed a
// dollar sign into is not given a second one.
function amt(v: unknown, placeholder: string): string {
  const t = String(v ?? '').trim()
  if (!t) return placeholder
  if (t.startsWith('$')) return t
  return /[0-9]/.test(t) ? `$${t}` : t
}

function p(t: string) { return `<p style="font-size:14px;color:#333;margin-bottom:14px">${t}</p>` }
function p13(t: string) { return `<p style="font-size:13px;color:#555;margin-bottom:12px">${t}</p>` }
function propHead(t: string, rentalIncome?: string) {
  return `<p style="font-size:13px;color:#343333;font-weight:600;margin-bottom:8px">&#127968; ${t}</p>` +
    (rentalIncome ? `<p style="font-size:12px;color:#666;margin-bottom:8px">Rental income: $${rentalIncome}/week</p>` : '')
}

function buildLVRLine(d: any) {
  const pct = Number(d.lvrPercent)
  if (!pct || pct <= 0) {
    return row('LVR', d.lvr || '80%')
  }
  if (pct > 80) {
    if (d.lmiApplicable === 'Applicable' && d.lmi) {
      return row('LVR', `${pct}%`) + row('LMI (estimated)', '$' + d.lmi)
    }
    if (d.lmiApplicable === 'Waived') {
      return row('LVR', `${pct}% (LMI waived)`)
    }
    return row('LVR', `${pct}%`)
  }
  return row('LVR', `${pct}% (no LMI)`)
}

function fmtNum(v: any): string {
  const n = Number(v)
  if (!v || isNaN(n)) return String(v || '')
  return n.toLocaleString('en-AU')
}

function buildChecklist(d: any) {
  // NOTE: HECS/car loan/personal loan/credit card lines were deliberately removed from here -
  // they duplicated what factFindChecklist (buildPropertyLiabilityChecklist) already shows correctly
  // from the real Fact Find liabilities data, causing double-counted, unformatted entries.
  const items = []
  const breakdown: { label: string; amount: number | null }[] = d.incomeBreakdown || []
  if (breakdown.length > 0) {
    breakdown.forEach(entry => {
      if (entry.amount === null) {
        items.push(`${entry.label}: Income as per tax returns provided`)
      } else {
        items.push(`${entry.label} $${fmtNum(entry.amount)} p.a.`)
      }
    })
  } else if (d.incomeBase) {
    items.push(`Base salary (excl. super) $${fmtNum(d.incomeBase)} p.a.`)
  }
  if (d.housingExpense) items.push(d.housingExpense)
  if (d.joint === 'Yes') items.push('Joint application')
  if (d.dependants) items.push(`${d.dependants} dependant${d.dependants === '1' ? '' : 's'}`)
  return items
}

export async function POST(req: NextRequest) {
  const { prompt, broker, brand, dealId, formData } = await req.json()
  const d = formData || {}

  const resolved = await resolveBrokerProfile(broker)
  if (!resolved) return NextResponse.json({ error: noBrokerMessage(broker) }, { status: 400 })
  let b: any = resolved
  let brandObj: any = undefined
  try {
    const supabase = await createSupabaseServer()
    const { data: settings } = await supabase.from('settings').select('brokers, brands').eq('id', 'singleton').single()
    if (settings?.brokers?.length) {
      const liveBroker = settings.brokers.find((x: any) => x.name === broker)
      if (liveBroker) {
        b = {
          name: liveBroker.name,
          title: liveBroker.title || 'Mortgage Broker',
          crn: liveBroker.crn || '',
          calendly: liveBroker.calendly || '',
          email: liveBroker.email || '',
        }
      }
    }
    if (settings?.brands?.length && brand) {
      brandObj = settings.brands.find((x: any) => x.id === brand)
    }
  } catch (e) {
    console.error('Failed to fetch live settings, using defaults:', e)
  }

  const template = d.template || 'oo_purchase'
  const personalisation = d.brokerNotes || ''
  const checkItems = [...buildChecklist(d), ...(d.factFindChecklist || []), ...(d.checklist || [])]
  const notes = d.additionalNotes || []

  let body = ''

  if (template === 'refinance_equity' && d.compareOptions) {
    const buildOptionColRE = (opt: any, label: string) => {
      const existingLoanN = parseFloat((d.existingLoanBal || '0').replace(/,/g, '')) || 0
      const propertyValueN = parseFloat((d.propertyValue || '0').replace(/,/g, '')) || 0
      const equityReleaseN = parseFloat((opt.equityReleaseAmount || '0').replace(/,/g, '')) || 0
      const lvrNum = propertyValueN > 0 ? Math.ceil(((existingLoanN + equityReleaseN) / propertyValueN) * 1000) / 10 : 0
      const actions = []
      if (opt.ccPayoff) actions.push((Number(opt.ccPayoffAmount) || 0) > 0 ? `Reduce credit card by $${opt.ccPayoffAmount}` : 'Credit card closed')
      if (opt.hecsPayoff) actions.push((Number(opt.hecsPayoffAmount) || 0) > 0 ? `Reduce HECS by $${opt.hecsPayoffAmount}` : 'HECS closed')
      if (opt.carLoanPayoff) actions.push('Car loan closed')
      if (opt.personalLoanPayoff) actions.push('Personal loan closed')
      const nonBankNote = opt.nonBankLender ? `<p style="font-size:11px;color:#555;font-style:italic;margin:8px 0 2px">This option is based on a non-bank lending solution, which typically allows more flexibility around serviceability.</p>` : ''
      let lmiLine = ''
      if (lvrNum > 80) {
        if (opt.lmiApplicable === 'Applicable' && opt.lmi) lmiLine = `<p style="font-size:11px;color:#555;margin:3px 0">LMI (estimated): $${opt.lmi}</p>`
        else if (opt.lmiApplicable === 'Waived') lmiLine = `<p style="font-size:11px;color:#555;margin:3px 0">LMI waived</p>`
      }
      return `<td style="width:50%;vertical-align:top;padding:0 6px">
        <p style="font-size:13px;font-weight:700;color:#343333;text-align:center;margin-bottom:8px;background:#fff;padding:6px 8px;border-radius:4px">${label}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Existing loan balance: $${d.existingLoanBal || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Equity release amount: $${opt.equityReleaseAmount || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">LVR: ${lvrNum}%</p>${lmiLine}
        ${actions.length ? `<p style="font-size:11px;font-weight:600;color:#343333;margin:8px 0 3px">To achieve this option:</p>` + actions.map((a: string) => `<p style="font-size:11px;color:#555;margin:2px 0">&#10003; ${a}</p>`).join('') : ''}${nonBankNote}
      </td>`
    }
    const baseOptionRE = {
      equityReleaseAmount: d.equityRelease,
      lmiApplicable: d.lmiApplicable, lmi: d.lmi,
      ccPayoff: false, hecsPayoff: false, carLoanPayoff: false, personalLoanPayoff: false, nonBankLender: false
    }
    const allOptionsRE = [buildOptionColRE(baseOptionRE, `Option 1${d.optionLabel ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + d.optionLabel + '</span>' : ''}`), ...(d.altScenarios || []).map((alt: any, i: number) => buildOptionColRE(alt, `Option ${i + 2}${alt.label ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + alt.label + '</span>' : ''}`))]
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Based on your current financial position, you have capacity to refinance and access equity. Below we have outlined different equity release scenarios depending on your financial position.') +
      propHead(`Against ${d.suburb || '[Property Address]'}`, d.incomeRental) +
      `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td style="padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Equity Release Options</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${allOptionsRE.join('')}</tr></table>
      </td></tr></table>` +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The numbers are looking strong. The next step is finding the right lender and rate for your situation \u2014 and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'refinance_equity') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`Based on your current financial position, you have sufficient capacity to refinance your property and access approximately ${amt(d.splits?.[1]?.amount, '[equity amount]')} in equity, while also securing a competitive rate.`) +
      p13('Here is a breakdown of the structure:') +
      propHead(`Against ${d.suburb || '[Property Address]'}`, d.incomeRental) +
      card('Split 1 - Refinanced Loan', row('Existing loan balance', '$' + (d.existingLoanBal || '')) + row('Loan amount', '$' + d.splits?.[0]?.amount || '') + row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') + row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') + row('Repayment type', d.splits?.[0]?.type || 'P&I') + row('Loan term', (d.loanTerm || '30') + ' years')) +
      card('Split 2 - Equity Release', row('Equity release amount', '$' + (d.equityRelease || '')) + row('Loan amount', '$' + d.splits?.[1]?.amount || '') + row('Indicative rate', (d.splits?.[1]?.rate || '') + '% p.a.*') + row('Estimated repayments', d.splits?.[1]?.repayment ? '$' + (parseFloat(String(d.splits[1].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') + row('Repayment type', d.splits?.[1]?.type || 'Interest Only') + buildLVRLine(d)) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The numbers are looking strong. The next step is finding the right lender and rate for your situation — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'refinance_only') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Based on your current financial position, you have sufficient capacity to refinance your existing loan and secure a competitive rate.') +
      p13('Here is a breakdown of the structure:') +
      propHead(`Against ${d.suburb || '[Property Address]'}`, d.incomeRental) +
      card('Refinanced Loan', row('Existing loan balance', '$' + (d.existingLoanBal || '')) + row('New loan amount', '$' + d.splits?.[0]?.amount || '') + row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') + row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') + row('Repayment type', d.splits?.[0]?.type || 'P&I') + row('Loan term', (d.loanTerm || '30') + ' years') + buildLVRLine(d)) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The numbers are looking strong. The next step is finding the right lender and rate for your situation — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'oo_purchase' && d.compareOptions) {
    const buildOptionCol = (opt: any, label: string) => {
      const priceNum = parseFloat((opt.purchasePrice || '').replace(/,/g, '')) || 0
      const loanNum = parseFloat((opt.loanAmount || '').replace(/,/g, '')) || 0
      const lvrNum = priceNum > 0 ? Math.ceil((loanNum / priceNum) * 1000) / 10 : 0
      const actions = []
      if (opt.ccPayoff) actions.push((Number(opt.ccPayoffAmount) || 0) > 0 ? `Reduce credit card by $${opt.ccPayoffAmount}` : 'Credit card closed')
      if (opt.hecsPayoff) actions.push((Number(opt.hecsPayoffAmount) || 0) > 0 ? `Reduce HECS by $${opt.hecsPayoffAmount}` : 'HECS closed')
      if (opt.carLoanPayoff) actions.push('Car loan closed')
      if (opt.personalLoanPayoff) actions.push('Personal loan closed')
      const nonBankNote = opt.nonBankLender ? `<p style="font-size:11px;color:#555;font-style:italic;margin:8px 0 2px">This option is based on a non-bank lending solution, which typically allows more flexibility around serviceability.</p>` : ''
      let lmiLine = ''
      if (lvrNum > 80) {
        if (opt.lmiApplicable === 'Applicable' && opt.lmi) lmiLine = `<p style="font-size:11px;color:#555;margin:3px 0">LMI (estimated): $${opt.lmi}</p>`
        else if (opt.lmiApplicable === 'Waived') lmiLine = `<p style="font-size:11px;color:#555;margin:3px 0">LMI waived</p>`
      }
      return `<td style="width:50%;vertical-align:top;padding:0 6px">
        <p style="font-size:13px;font-weight:700;color:#343333;text-align:center;margin-bottom:8px;background:#fff;padding:6px 8px;border-radius:4px">${label}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Purchase price: $${opt.purchasePrice || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Deposit: $${opt.deposit || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Stamp duty: $${opt.stampDuty || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Loan amount: $${opt.loanAmount || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">LVR: ${lvrNum}%</p>${lmiLine}
        <p style="font-size:11px;color:#555;margin:3px 0">Rate: ${opt.rate}% p.a.*</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Est. repayment: ${opt.repayment ? '$' + (parseFloat(String(opt.repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]'}</p>
        ${actions.length ? `<p style="font-size:11px;font-weight:600;color:#343333;margin:8px 0 3px">To achieve this option:</p>` + actions.map((a: string) => `<p style="font-size:11px;color:#555;margin:2px 0">&#10003; ${a}</p>`).join('') : ''}${nonBankNote}
      </td>`
    }
    const baseOption = {
      purchasePrice: d.purchasePrice, deposit: d.deposit, stampDuty: d.stampDuty,
      loanAmount: d.splits?.[0]?.amount, rate: d.splits?.[0]?.rate, repayment: d.splits?.[0]?.repayment,
      lmiApplicable: d.lmiApplicable, lmi: d.lmi,
      ccPayoff: false, hecsPayoff: false, carLoanPayoff: false, personalLoanPayoff: false
    }
    const allOptions = [buildOptionCol(baseOption, `Option 1${d.optionLabel ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + d.optionLabel + '</span>' : ''}`), ...(d.altScenarios || []).map((alt: any, i: number) => buildOptionCol(alt, `Option ${i + 2}${alt.label ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + alt.label + '</span>' : ''}`))]
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Below we have outlined different purchase price scenarios depending on your financial position.') +
      `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td style="padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Purchase Options</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${allOptions.join('')}</tr></table>
      </td></tr></table>` +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'oo_purchase') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.splits?.[0]?.amount, '[amount]')}</strong>.`) +
      p(`With a contribution of <strong>${amt(d.deposit, '[deposit]')}</strong> in savings, you could achieve a purchase price of <strong>${amt(d.purchasePrice, '[purchase price]')}</strong>.`) +
      p13('Here is a breakdown of the structure:') +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row(`Deposit${d.depositSource ? ` (${d.depositSource})` : ''}`, '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        buildLVRLine(d) +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'investment_purchase' && d.compareOptions) {
    const buildOptionColIP = (opt: any, label: string) => {
      const priceNum = parseFloat((opt.purchasePrice || '').replace(/,/g, '')) || 0
      const loanNum = parseFloat((opt.loanAmount || '').replace(/,/g, '')) || 0
      const lvrNum = priceNum > 0 ? Math.ceil((loanNum / priceNum) * 1000) / 10 : 0
      const actions = []
      if (opt.ccPayoff) actions.push((Number(opt.ccPayoffAmount) || 0) > 0 ? `Reduce credit card by $${opt.ccPayoffAmount}` : 'Credit card closed')
      if (opt.hecsPayoff) actions.push((Number(opt.hecsPayoffAmount) || 0) > 0 ? `Reduce HECS by $${opt.hecsPayoffAmount}` : 'HECS closed')
      if (opt.carLoanPayoff) actions.push('Car loan closed')
      if (opt.personalLoanPayoff) actions.push('Personal loan closed')
      const nonBankNote = opt.nonBankLender ? `<p style="font-size:11px;color:#555;font-style:italic;margin:8px 0 2px">This option is based on a non-bank lending solution, which typically allows more flexibility around serviceability.</p>` : ''
      let lmiLine = ''
      if (lvrNum > 80) {
        if (opt.lmiApplicable === 'Applicable' && opt.lmi) lmiLine = `<p style="font-size:11px;color:#555;margin:3px 0">LMI (estimated): $${opt.lmi}</p>`
        else if (opt.lmiApplicable === 'Waived') lmiLine = `<p style="font-size:11px;color:#555;margin:3px 0">LMI waived</p>`
      }
      return `<td style="width:50%;vertical-align:top;padding:0 6px">
        <p style="font-size:13px;font-weight:700;color:#343333;text-align:center;margin-bottom:8px;background:#fff;padding:6px 8px;border-radius:4px">${label}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Purchase price: $${opt.purchasePrice || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Deposit: $${opt.deposit || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Stamp duty: $${opt.stampDuty || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Loan amount: $${opt.loanAmount || ''}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">LVR: ${lvrNum}%</p>${lmiLine}
        <p style="font-size:11px;color:#555;margin:3px 0">Rate: ${opt.rate}% p.a.*</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Est. repayment: ${opt.repayment ? '$' + (parseFloat(String(opt.repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]'}</p>
        ${actions.length ? `<p style="font-size:11px;font-weight:600;color:#343333;margin:8px 0 3px">To achieve this option:</p>` + actions.map((a: string) => `<p style="font-size:11px;color:#555;margin:2px 0">&#10003; ${a}</p>`).join('') : ''}${nonBankNote}
      </td>`
    }
    const baseOptionIP = {
      purchasePrice: d.purchasePrice, deposit: d.deposit, stampDuty: d.stampDuty,
      loanAmount: d.splits?.[0]?.amount, rate: d.splits?.[0]?.rate, repayment: d.splits?.[0]?.repayment,
      lmiApplicable: d.lmiApplicable, lmi: d.lmi,
      ccPayoff: false, hecsPayoff: false, carLoanPayoff: false, personalLoanPayoff: false, nonBankLender: false
    }
    const allOptionsIP = [buildOptionColIP(baseOptionIP, `Option 1${d.optionLabel ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + d.optionLabel + '</span>' : ''}`), ...(d.altScenarios || []).map((alt: any, i: number) => buildOptionColIP(alt, `Option ${i + 2}${alt.label ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + alt.label + '</span>' : ''}`))]
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Below we have outlined different purchase price scenarios depending on your financial position.') +
      `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td style="padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Purchase Options</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${allOptionsIP.join('')}</tr></table>
      </td></tr></table>` +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right structure for your investment \u2014 and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'investment_purchase') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.splits?.[0]?.amount, '[amount]')}</strong>.`) +
      p(`With a contribution of <strong>${amt(d.deposit, '[deposit]')}</strong> in savings, you could achieve a purchase price of <strong>${amt(d.purchasePrice, '[purchase price]')}</strong>.`) +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row(`Deposit${d.depositSource ? ` (${d.depositSource})` : ''}`, '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        buildLVRLine(d) +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', d.splits?.[0]?.type || 'Interest Only (5 years)')
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right structure for your investment — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'buy_sell') {
    const depositLabel = (Number(d.additionalSavings) || 0) > 0 ? 'Deposit (from sale proceeds and savings)' : 'Deposit (from sale proceeds)'
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.splits?.[0]?.amount, '[amount]')}</strong>.`) +
      card('Sale Proceeds Summary',
        row('Expected sale price', '$' + (d.salePrice || '')) +
        row('Agent fees / selling costs', '$' + (d.agentFees || '')) +
        row('Existing loan balance (to be discharged)', '$' + (d.existingLoanBal || '')) +
        `<tr style="border-top:1px solid #CEBEAB"><td style="font-size:12px;font-weight:600;color:#343333;padding-top:6px">Net proceeds (est.)</td><td style="font-size:12px;font-weight:600;color:#343333;text-align:right;padding-top:6px">$${d.netProceeds || ''}</td></tr>`
      ) +
      card('New Purchase',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row(depositLabel, '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        buildLVRLine(d) +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('Now it is about finding the right lender, the right rate, and making sure the timing between your sale and purchase lines up perfectly. That is exactly what we are here for.') +
      
      notesBox(notes) + sig(b)

  } else if (template === 'oo_lvr_compare') {
    const splits = d.splits || []
    const priceNum = parseFloat((d.purchasePrice || '').replace(/,/g, '')) || 0
    const lvrCols = splits.map((s: any) => {
      const amountNum = parseFloat((s.amount || '').replace(/,/g, '')) || 0
      const lvrNum = priceNum > 0 ? Math.ceil((amountNum / priceNum) * 1000) / 10 : 0
      let lmiLine = ''
      if (lvrNum > 80) {
        if (s.lmiApplicable === 'Applicable' && s.lmi) {
          lmiLine = `<p style="font-size:11px;color:#555;margin:3px 0">LMI (estimated): $${s.lmi}</p>`
        } else if (s.lmiApplicable === 'Waived') {
          lmiLine = `<p style="font-size:11px;color:#555;margin:3px 0">LMI waived</p>`
        }
      }
      return `<td style="width:${Math.floor(100/splits.length)}%;vertical-align:top;padding:0 4px">
        <p style="font-size:13px;font-weight:700;color:#343333;text-align:center;margin-bottom:8px;background:#fff;padding:6px 8px;border-radius:4px">${s.label}</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Loan amount: $${s.amount}</p>${s.deposit ? `<p style="font-size:11px;color:#555;margin:3px 0">Deposit required: $${s.deposit}</p>` : ""}
        <p style="font-size:11px;color:#555;margin:3px 0">LVR: ${lvrNum}%</p>${lmiLine}
        <p style="font-size:11px;color:#555;margin:3px 0">Rate: ${s.rate}% p.a.*</p>
        <p style="font-size:11px;color:#555;margin:3px 0">Type: ${s.type}</p>
      </td>`
    }).join('')
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.purchasePrice, '[purchase price]')}</strong>. Below we have outlined ${splits.length} scenarios based on different deposit contributions.`) +
      `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td style="padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Deposit Options</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${lvrCols}</tr></table>
      </td></tr></table>` +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'fhb') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
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
        row('LMI', 'Waived under Gov. Deposit Scheme') +
        row('Your contribution required', '$' + d.deposit || '') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'bridging') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Based on your current financial position, bridging finance is achievable for your next owner-occupied purchase.') +
      p('Bridging finance lets you buy your new home before your current one sells. Here is how it works: while you hold both properties, your bridging loan accrues interest at the rate below, but that interest is <strong>capitalised</strong> \u2014 added to your loan balance rather than paid month to month. When your existing property sells, the proceeds pay off that combined balance. Whatever is left over becomes your <strong>end debt</strong>: an ordinary home loan with regular repayments, which you will see broken out below.') +
      card('New Purchase Details',
        row('Purchase price', '$' + (d.purchasePrice || '')) +
        row('Stamp duty', '$' + (d.stampDuty || '')) +
        `<tr style="border-top:1px solid #CEBEAB"><td style="font-size:12px;font-weight:600;color:#343333;padding-top:6px">Total cost</td><td style="font-size:12px;font-weight:600;color:#343333;text-align:right;padding-top:6px">$${(() => { const pp = parseFloat((d.purchasePrice||'0').replace(/,/g,'')) || 0; const sd = parseFloat((d.stampDuty||'0').replace(/,/g,'')) || 0; return (pp+sd).toLocaleString('en-AU') })()}</td></tr>` +
        row(`Contribution${d.depositSource ? ` (from ${d.depositSource})` : ''}`, '$' + (d.deposit || '')) +
        row('Bridging loan (peak debt)', '$' + (d.splits?.[0]?.amount || '')) +
        row('End debt', '$' + (d.splits?.[1]?.amount || ''))
      ) +
      card('Loan 1 - Bridging Loan',
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Interest treatment', 'Capitalised \u2014 no repayments during the bridging period') +
        row('Bridging period', (d.bridgingPeriod || '12') + ' months') +
        (d.splits?.[0]?.interestCapitalised ? row('Estimated interest capitalised', '$' + (parseFloat(String(d.splits[0].interestCapitalised).replace(/,/g,'')) || 0).toLocaleString('en-AU')) : '')
      ) +
      card('Loan 2 - End Debt (your ongoing repayments)',
        row('Loan amount', '$' + d.splits?.[1]?.amount || '') +
        row('Indicative rate', (d.splits?.[1]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[1]?.repayment ? '$' + (parseFloat(String(d.splits[1].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', `${d.splits?.[1]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right structure for your bridging scenario — and that is exactly what we will do for you.') +
      
      notesBox(notes) + sig(b)

  } else if (template === 'family_pledge') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.splits?.[0]?.amount, '[amount]')}</strong>.`) +
      p(`With a contribution of <strong>${amt(d.deposit, '[deposit]')}</strong> in savings, you could achieve a purchase price of <strong>${amt(d.purchasePrice, '[purchase price]')}</strong> — using your parents' property as a security guarantee to avoid Lenders Mortgage Insurance.`) +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Your contribution required', '$' + d.deposit || '') +
        row('Guarantor', d.guarantorName || '') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
      
      notesBox(notes) + sig(b)

  } else if (template === 'smsf') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('When looking at your numbers, your borrowing capacity is looking strong for an SMSF purchase.') +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Your contribution required', '$' + d.deposit || '') +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right SMSF structure for your investment — and that is exactly what we will do for you.') +
      
      notesBox(notes) + sig(b)

  } else if (template === 'construction') {
    const landN = parseFloat((d.landValue || '0').replace(/,/g, '')) || 0
    const constrN = parseFloat((d.constructionCost || '0').replace(/,/g, '')) || 0
    const sdN = parseFloat((d.stampDuty || '0').replace(/,/g, '')) || 0
    const totalCost = landN + constrN + sdN
    const loanAmtN = parseFloat((d.splits?.[0]?.amount || '0').replace(/,/g, '')) || 0
    const depositRequired = Math.max(0, Math.round(totalCost - loanAmtN))
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.splits?.[0]?.amount, '[amount]')}</strong>.`) +
      card('Your Loan Structure',
        row('Land value', '$' + (d.landValue || '')) +
        row('Construction cost', '$' + (d.constructionCost || '')) +
        row('Stamp duty', '$' + (d.stampDuty || '')) +
        `<tr style="border-top:1px solid #CEBEAB"><td style="font-size:12px;font-weight:600;color:#343333;padding-top:6px">Total cost</td><td style="font-size:12px;font-weight:600;color:#343333;text-align:right;padding-top:6px">$${totalCost.toLocaleString('en-AU')}</td></tr>` +
        row('"As if complete" valuation', '$' + (d.asIfCompleteValue || '')) +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        row('Deposit required', '$' + depositRequired.toLocaleString('en-AU')) +
        buildLVRLine(d) +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender and construction loan structure for your project — and we will guide you through every step of that process.') +
      
      notesBox(notes) + sig(b)

  } else if (template === 'investment_equity') {
    const npPrice   = d.newPurchasePrice     || d.purchasePrice || ''
    const npStamp   = d.newPurchaseStampDuty || d.stampDuty     || ''
    const npDeposit = d.newPurchaseDeposit   || d.equityRelease || d.deposit || ''
    const totalCost = npPrice && npStamp ? `$${npPrice} + $${npStamp}` : ''
    const existingLoanCol = `
      <p style="font-size:12px;font-weight:600;color:#343333;margin:0 0 6px">Existing loan refinanced</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Loan amount: $${d.splits?.[0]?.amount || ''}</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Indicative rate: ${d.splits?.[0]?.rate || ''}% p.a.*</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Estimated repayments: ${d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]'}</p>
      <p style="font-size:11px;color:#555;margin:2px 0 10px">Repayment type: ${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years</p>
      <p style="font-size:12px;font-weight:600;color:#343333;margin:0 0 6px">Equity access</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Loan amount: $${d.splits?.[1]?.amount || ''}</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Indicative rate: ${d.splits?.[1]?.rate || ''}% p.a.*</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Estimated repayments: ${d.splits?.[1]?.repayment ? '$' + (parseFloat(String(d.splits[1].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]'}</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Repayment type: ${d.splits?.[1]?.type || 'P&I'} over ${d.loanTerm || '30'} years</p>`
    const newPurchaseCol = `
      <p style="font-size:11px;color:#555;margin:2px 0">Loan amount: $${d.splits?.[2]?.amount || ''}</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Indicative rate: ${d.splits?.[2]?.rate || ''}% p.a.*</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Estimated repayments: ${d.splits?.[2]?.repayment ? '$' + (parseFloat(String(d.splits[2].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]'}</p>
      <p style="font-size:11px;color:#555;margin:2px 0">Repayment type: ${d.splits?.[2]?.type || 'P&I'} over ${d.loanTerm || '30'} years</p>`

    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('We have now finalised your review as you are looking at purchasing an owner-occupied/investment property.') +
      p('We would use equity in your owner-occupied/investment property to help fund the deposit plus stamp duty costs.') +
      p('A second loan will be set up against your new purchase, so all properties are stand alone — these are two separate securities, not cross-collateralised.') +
      p(`Provided you are ok to use equity, we could look at a purchase price of <strong>$${amt(npPrice, '[amount]')}</strong>.`) +
      p13('Your numbers would be:') +
      card('Summary',
        row('Purchase price', '$' + npPrice) +
        row('Stamp duty', '$' + npStamp) +
        row('Total cost (plus solicitor\'s fees and incidentals)', totalCost) +
        row('Loan amount', '$' + (d.splits?.[2]?.amount || '')) +
        row('Deposit needed (from equity release and personal savings)', '$' + npDeposit)
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
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('Please let us know your thoughts and if you have any questions regarding the numbers above.') +
      p('The next step is to collect your documentation so we can look at specific lenders and interest rates.') +
       notesBox(notes) + sig(b)

  } else if (template === 'custom') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.splits?.[0]?.amount, '[amount]')}</strong>.`) +
      card('Your Loan Structure',
        row('Purchase price', '$' + d.purchasePrice || '') +
        row(`Deposit${d.depositSource ? ` (${d.depositSource})` : ''}`, '$' + d.deposit || '') +
        row('Stamp duty', '$' + d.stampDuty || '') +
        row('Loan amount', '$' + d.splits?.[0]?.amount || '') +
        buildLVRLine(d) +
        row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Estimated repayments', d.splits?.[0]?.repayment ? '$' + (parseFloat(String(d.splits[0].repayment).replace(/,/g,'')) || 0).toLocaleString('en-AU') : '[calculated]') +
        row('Repayment type', `${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender and rate for your situation — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) + p('Email template coming soon.') + ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) + sig(b)
  }

  const html = shell(body, b, brandObj)
  const brokerFirstName = b.name.split(' ')[0]; return NextResponse.json({ html, brokerFirstName })
}
