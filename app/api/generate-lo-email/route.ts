import { NextRequest, NextResponse } from 'next/server'
import { loPurchaseBlock, isBuyAndSell } from '@/lib/lo-purchase-block'
import { buysNothing } from '@/lib/buying'
import { ctas } from '@/lib/email-buttons'
import { resolveBrokerProfile, noBrokerMessage } from '@/lib/broker-profile'
import { type Brand, resolveBrand, brandLegal } from '@/lib/brand'
import { rateNoticeLines } from '@/lib/rate-notice-server'
import { isRecommended, recommendedLabel, recommendedOption, recommendedFirst } from '@/lib/recommended-option'
// EVERY DOLLAR FIGURE IN A CLIENT EMAIL GOES THROUGH money().
//
// This file used to write `'$' + (d.purchasePrice || '')` in a hundred
// places, which is correct only for as long as every value reaches the
// database already comma-formatted. One did not: the BC filled its existing
// loan balance straight from the fact find with String(), and $1,279,283.98
// went to a client as $1279283.98. Formatting at the point of DISPLAY means
// the next leak, wherever it comes from, cannot reach anybody.
//
// money('') is the empty string, not a lonely '$' - so a field nobody filled
// in prints as nothing rather than as a dollar sign with no number.
import { balanceTotal, releaseTotal } from '@/lib/complex-refinance'
import { money } from '@/lib/money'
import { emailParagraphs } from '@/lib/rich-text'
import { resolveLenderSplits, lenderTotal, lenderLvr } from '@/lib/lo-splits'
import { securitiesOf, totalsOf } from '@/lib/securities'
import { bufferNoteBlock } from '@/lib/buffer-note'
import { propertyColour } from '@/lib/lo-by-property'
import { showsOwnLoanAmount } from '@/lib/email-amounts'
import { rowLegalFeeLabel, feeText} from '@/lib/lender-fees'
import { siteUrl } from '@/lib/site-url'


// Was hardcoded to Simplify Finance, licence number included, so a second
// trading name would have gone out under the wrong licence. The brand now comes
// from settings the same way the borrowing capacity email has always read it.
function shell(body: string, brand: Brand) {
  const header = brand.logoUrl
    ? `<tr><td bgcolor="${brand.headerColor}" align="center" style="background:${brand.headerColor};padding:28px 24px;text-align:center"><img src="${brand.logoUrl}" alt="${brand.name}" height="94" style="height:94px;display:block;margin:0 auto;border:0" /></td></tr>`
    : `<tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;padding:28px 24px 8px;text-align:center"><p style="color:#1a1a1a;font-size:22px;font-weight:700;margin:0"><span style="color:#1a1a1a;">${brand.name}</span></p></td></tr>`
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f3" style="background:#f5f5f3;font-family:Arial,sans-serif"><tr><td bgcolor="#f5f5f3" align="center" style="background:#f5f5f3;padding:24px 12px"><table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" align="center" style="background:#ffffff;margin:0 auto">${header}<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 28px 28px">${body}<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-top:1px solid #E4E2DC;padding:12px 0 0"><p style="color:#9e9e98;font-size:10px;margin:0;line-height:1.65"><span style="color:#9e9e98;">${brandLegal(brand)}</span></p></td></tr></table></td></tr></table></td></tr></table>`
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
      ${emailParagraphs(text) || `<p style="font-size:14px;color:#333333;margin:0;line-height:1.6"><span style="color:#333333;">[Add your personal opening here.]</span></p>`}
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
// One copy, in lib/email-buttons.ts.

// The loan splits, one row per split across every column.
//
// Your team fills these in per lender and the client never saw them: the word
// `lenderSplits` did not appear in this file. The email said "Loan Amount: $X"
// and "Existing Loan Balance: $X" - the same figure twice on Clementine's
// refinance, with the $30,000 equity release nowhere at all.
//
// One row per split so the client compares like with like. A lender that folds
// the deal into a single loan is shorter than the others, and that gap is
// information rather than a hole - it is exactly what is different about that
// option.
function splitBand(lenders: any[], globals: any[], propertyValue: any, secs: any[] = []): string {
  const per = lenders.map(l => resolveLenderSplits(l, globals))
  const deepest = per.reduce((m, rows) => Math.max(m, rows.length), 0)
  if (deepest === 0) return ''

  const cell = (inner: string) =>
    `<td style="padding:12px 14px;border:1px solid #e0e0e0;vertical-align:top">${inner}</td>`
  const totalCell = (inner: string) =>
    `<td bgcolor="#fbfbfb" style="background:#fbfbfb;padding:12px 14px;border:1px solid #e0e0e0;vertical-align:top">${inner}</td>`

  const splitCell = (sp: any) => {
    if (!sp) return cell(`<p style="font-size:12px;color:#bbbbbb;margin:0"><span style="color:#bbbbbb;">&mdash;</span></p>`)
    const line2 = [sp.rate ? `${sp.rate}%` : '', sp.repaymentType || ''].filter(Boolean).join(' &nbsp;\u00b7&nbsp; ')
    return cell(
      `<p style="font-size:12px;font-weight:600;color:#343333;margin:0 0 2px"><span style="color:#343333;">${sp.label || 'Split'}</span></p>` +
      `<p style="font-size:12px;color:#444444;margin:0 0 1px"><span style="color:#444444;">${money(sp.amount) || ''}${line2 ? ' &nbsp;\u00b7&nbsp; ' + line2 : ''}</span></p>` +
      (sp.repayment ? `<p style="font-size:11px;color:#777777;margin:0"><span style="color:#777777;">${money(sp.repayment)} / month</span></p>` : '')
    )
  }

  const heading = (text: string) =>
    `<tr>${lenders.map(() => `<td bgcolor="#fafafa" style="padding:10px 14px;border:1px solid #e0e0e0;background:#fafafa"><p style="font-size:12px;font-weight:700;color:#343333;margin:0"><span style="color:#343333;">${text}</span></p></td>`).join('')}</tr>`

  // ONE LVR PER LENDER: that lender's whole loan over the property value. Never
  // per split - an LVR is a question about the deal, and it is calculated here
  // rather than typed so the email and the form cannot disagree.
  // AGAINST EVERY HOUSE, NOT AGAINST ONE EMPTY BOX.
  //
  // 16 Oct 2026. propertyValue here is bc.propertyValue falling back to
  // bc.purchasePrice. Both are empty once a deal's values live on its
  // securities - so lenderLvr returned 0 and the LVR was simply left off. The
  // Avard email went to a client reading "Total lending $369,000" with no LVR,
  // on a deal sitting at 38.8%.
  //
  // `secs` has been passed into this function since 12 Oct and never read here.
  const against = totalsOf(secs).value || propertyValue

  const totals = () => `<tr>${per.map(rows => {
    const tot = lenderTotal(rows)
    const lvr = lenderLvr(rows, against)
    return totalCell(
      `<p style="font-size:12px;color:#343333;margin:0"><span style="color:#343333;"><strong>Total lending ${money(tot)}</strong>${lvr > 0 ? ` &nbsp;\u00b7&nbsp; LVR ${lvr}%` : ''}</span></p>`,
    )
  }).join('')}</tr>`

  // ONE HOUSE AT A TIME, IN THE SAME ORDER UNDER EVERY LENDER.
  //
  // 12 Oct 2026. Fabio: "each line that has a property make it a different
  // colour to really pop and separate". A complex refinance put six loans in
  // front of a client as one flat list with nothing saying which house any of
  // them sat on.
  //
  // NO SUBTOTAL UNDER EACH PROPERTY. There was one, and Fabio asked for it to
  // go: "scrap the last line on each property", "no need to add splits and
  // repayments". The only total is the whole deal's, at the foot.
  //
  // THE COLOUR IS NEVER THE ONLY CUE - every band carries its number and its
  // address, for a client who prints in black and white or a mail client that
  // strips the colour. The three colours are checked for colourblind separation
  // in lib/lo-by-property.ts; they are not chosen here.
  const list = (secs || []).filter((x: any) => x && x.id)
  if (list.length > 1) {
    const idsOf = (rows: any[], id: string) => rows.filter(r => String(r?.securityId || '') === id)
    const known = new Set(list.map((x: any) => String(x.id)))
    let out = heading('Your loans, by property')

    list.forEach((sec: any, n: number) => {
      const c = propertyColour(n)
      const mine = per.map(rows => idsOf(rows, String(sec.id)))
      const rowsHere = mine.reduce((m, r) => Math.max(m, r.length), 0)
      if (rowsHere === 0) return
      const name = `${n + 1} &nbsp;&middot;&nbsp; ${sec.address || 'Address not recorded'}`
      out += `<tr>${lenders.map(() => `<td bgcolor="${c.band}" style="padding:9px 14px;border:1px solid #e0e0e0;border-left:5px solid ${c.bar};background:${c.band}"><p style="font-size:12.5px;font-weight:700;color:${c.ink};margin:0"><span style="color:${c.ink};">${name}</span></p></td>`).join('')}</tr>`
      for (let i = 0; i < rowsHere; i++) {
        out += `<tr>${mine.map(rows => splitCell(rows[i])).join('')}</tr>`
      }
    })

    // A loan against nothing is never dropped. It is the one the client should
    // be asking about.
    const orphans = per.map(rows => rows.filter(r => !known.has(String(r?.securityId || ''))))
    const looseRows = orphans.reduce((m, r) => Math.max(m, r.length), 0)
    if (looseRows > 0) {
      out += heading('Other lending')
      for (let i = 0; i < looseRows; i++) {
        out += `<tr>${orphans.map(rows => splitCell(rows[i])).join('')}</tr>`
      }
    }

    return out + totals()
  }

  // One security, or none recorded: the flat list, exactly as it was.
  let out = heading('Loan splits')
  for (let i = 0; i < deepest; i++) {
    out += `<tr>${per.map(rows => splitCell(rows[i])).join('')}</tr>`
  }
  return out + totals()
}

// `lo` rather than a lender name: two options from the same bank both answered
// yes to a name, so both columns wore the star. See lib/recommended-option.ts.
function buildLenderTable(lenders: any[], isBridging: boolean, lo?: any, globals?: any[], propertyValue?: any, secs: any[] = []) {
  const cols = lenders.length
  const pct = cols === 1 ? '100%' : cols === 2 ? '50%' : '33%'

  const headers = lenders.map((l, i) => { const isRec = lo ? isRecommended(lo, l) : false; return `<td width="${pct}" bgcolor="#f8f8f8" style="background:#f8f8f8;padding:14px;border:1px solid #e0e0e0;vertical-align:top"><p style="font-size:13px;font-weight:700;color:#343333;margin:0 0 6px"><span style="color:#343333;">OPTION ${i+1}</span></p><p style="font-size:14px;font-weight:700;color:#2DBEFF;margin:0 0 4px"><span style="color:#2DBEFF;">${[l.lenderName, l.productName].map((v: any) => String(v ?? '').trim()).filter(Boolean).join(' &mdash; ')}</span></p>${l.approvalDays ? `<p style="font-size:12px;color:#777;margin:4px 0 0"><span style="color:#777;">${l.approvalDays} to approval</span></p>` : ''}${isRec ? '<p style="font-size:11px;font-weight:700;color:#D97706;border:1px solid #D97706;display:inline-block;padding:2px 8px;border-radius:3px;margin:6px 0 0"><span style="color:#D97706;">&#9733; Recommended</span></p>' : ''}${l.specialNote ? `<p style="font-size:11px;color:#dc2626;margin:6px 0 0"><span style="color:#dc2626;">&#10071; ${l.specialNote}</span></p>` : ''}</td>` }).join('')

  let featureCells = ''
  if (isBridging) {
    const rows = [
      (l: any) => l.bridgingRate ? tick(`Variable rate from ${l.bridgingRate}% p.a.*`) : '',
      (l: any) => l.bridgingTerm ? tick(`Loan term up to ${l.bridgingTerm} months`) : '',
      () => tick('Interest Only Capitalised'),
      (l: any) => l.establishmentFee ? tick(`Establishment Fee of ${money(l.establishmentFee)}`) : '',
      (l: any) => l.monthlyFee ? tick(`Monthly Loan Account Fee of ${money(l.monthlyFee)}`) : '',
      (l: any) => l.docProcessingFee ? tick(`Document Processing Fee of ${money(l.docProcessingFee)}`) : '',
    ]
    featureCells = `<tr>${lenders.map(l => `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top">${rows.map(fn => fn(l)).join('')}</td>`).join('')}</tr>`
    // NOTHING INVENTED, NOTHING SPELLED "XXX".
    //
    // This printed a literal "$XXX" for a bridging amount nobody had entered,
    // and fell back to "over 12 months" for a term nobody had chosen - so a
    // client could be told a bridging period out of thin air. Same cleanup the
    // BC email had on 8 Sep; it never reached here.
    //
    // An empty box means the line is not there. A half-finished card looks
    // shorter, which is honest, instead of finished and wrong.
    const bridgingRows = lenders.map(l => {
      const amount = money(l.bridgingLoanAmount)
      const interest = money(l.estimatedInterest)
      const term = String(l.bridgingTerm ?? '').trim()
      const lines = [
        `<p style="font-size:12px;font-weight:600;color:#333;margin:0 0 6px"><span style="color:#333;">Bridging Loan (debt while holding both properties):</span></p>`,
        amount ? `<p style="font-size:12px;color:#333;margin:0 0 8px"><span style="color:#333;"><strong>Bridging loan: ${amount}</strong></span></p>` : '',
        // The interest is only meaningful alongside the period it was worked
        // out over, so without a term it says the amount and stops.
        interest ? `<p style="font-size:12px;color:#333;margin:0"><span style="color:#333;"><strong>Estimated Interest Capitalised${term ? ` (over ${term} months)` : ''}: ${interest}</strong></span></p>` : '',
      ].filter(Boolean).join('')
      return `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top">${lines}</td>`
    }).join('')
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
        content += tick(`Monthly repayments of ${money(m.repayment)}`)
        if (mod === 'variableIO' || mod === 'fixedIO') content += tick(`Interest Only for ${m.ioYears} years`)
        content += tick(`Over ${m.loanTerm} year loan term`)
        return `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top">${content}</td>`
      }).join('')
      featureCells += `<tr>${contentCells}</tr>`
    })
    const feeRows = lenders.map(l => {
      let fees = ''
      if (l.applicationFee) fees += tick("Application fee: " + feeText(l.applicationFee))
      if (l.annualFee) fees += tick("Annual fee: " + feeText(l.annualFee))
      // 18 Oct 2026. The bridging branch above has printed a monthly fee since
      // bridging was built. Every other scenario had no way to record one, so
      // this line had nothing to print and was never written. The product
      // library has the box now, so the email needs the line.
      if (l.monthlyFee) fees += tick("Monthly fee: " + feeText(l.monthlyFee))
      if (l.valuationFee) fees += tick("Valuation fee: " + feeText(l.valuationFee))
      if (l.legalFee) fees += tick(rowLegalFeeLabel(l) + ": " + feeText(l.legalFee))
      if (l.rateLockFee) fees += tick("Rate lock fee: " + feeText(l.rateLockFee))
      // What it costs to leave. Clients ask about these when comparing two
      // lenders, and until now they were nowhere in the email.
      if (l.earlyRepaymentFee) fees += tick("Early repayment fee: " + feeText(l.earlyRepaymentFee))
      if (l.dischargeFee) fees += tick("Discharge fee: " + feeText(l.dischargeFee))
      if (l.offsetAccount) fees += tick("Offset account: " + l.offsetAccount)
      return `<td style="padding:14px;border:1px solid #e0e0e0;vertical-align:top">${fees}</td>`
    }).join('')
    featureCells += `<tr>${feeRows}</tr>`
  }

  // Splits go directly under the lender names, before the rates: the client's
  // first question about an option is what the money looks like, not what the
  // annual fee is. Bridging keeps its own structure block instead.
  const splits = isBridging ? '' : splitBand(lenders, globals || [], propertyValue, secs)
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>${headers}</tr>${splits}${featureCells}</table>`
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
  // bcData IS READ, NEVER STORED. The lending options form holds the deal, so
  // it sends the borrowing capacity along with this request and the email is
  // built from whatever the BC says at the moment the button is pressed. The
  // alternative - copying the land value and the build cost onto the LO record
  // - is the stale-copy fault this codebase spent 8 Oct undoing on the loan
  // amount. See lib/lo-purchase-block.ts.
  //
  // ffData COMES WITH IT FOR THE SAME REASON. The addresses, the uses and the
  // values of the securities live on the fact find, and the email names them -
  // so it reads them live rather than printing a copy that was right last week.
  const { broker, dealId, loData: d, bcData, ffData } = await req.json()
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
  const proceedUrl = dealId ? `${siteUrl()}/proceed/${dealId}?from=LO` : undefined


  // The broker's own opening already says what the client is doing and why, in
  // their words. Restating it underneath read as a second, blander version of
  // the same sentence, so the email goes straight to the figures.
  let body = brokerBox(d.brokerPersonalisation, d.firstName, d.jointFirstName, d.joint)

  // DOES THIS DEAL BUY ANYTHING. Asked once, off the scenario, and used by
  // every line below that talks about a purchase. See lib/buying.ts.
  const buying = !buysNothing(d.bcTemplate || bcData?.template)
  const owes = Number(String(d.existingLoan ?? '').replace(/[^0-9.]/g, '')) || 0
  if (!isBridging && (d.purchasePrice || d.loanAmount)) {
    body += `<p style="font-size:14px;font-weight:600;color:#343333;margin-bottom:8px"><span style="color:#343333;">Your numbers would be:</span></p>`

    // A PURCHASE PRINTS WHAT THE BC PRINTS, out of the one file that decides
    // those words. 7 Oct 2026 - see lib/lo-purchase-block.ts for the whole of
    // why, including what is deliberately left out of it.
    //
    // A REFINANCE IS UNTOUCHED. Its three lines are in the order a client thinks
    // in - what I owe now, what extra I am taking, what the loan ends up being -
    // and they are not a purchase breakdown. They stay exactly as they were.
    // IS THIS DEAL REFINANCING - NOT "IS THERE A NUMBER IN THAT BOX".
    //
    // 9 Oct 2026. The lending options form copies existingLoanBal across from
    // the BC on every scenario, so on a buy and sell this box always holds the
    // figure being DISCHARGED BY THE SALE. Reading it as a refinance sent every
    // buy and sell down the branch below, which printed "Existing Loan Balance"
    // on a purchase email and then an "Equity Release" line worked out as the
    // lending minus that balance - a figure nobody typed and no client is
    // getting. It also meant loPurchaseBlock, written for this exact scenario
    // on 7 Oct, has never once run.
    if ((buying && owes === 0) || isBuyAndSell(d)) {
      body += loPurchaseBlock(d, bcData)
    } else {
      // NOTHING IS BEING BOUGHT ON A REFINANCE, WHATEVER IS LEFT IN THE BOXES.
      //
      // 13 Oct 2026, the Veljovic email. A complex refinance went to the client
      // reading "Purchase Price: $1,000,000", "Stamp Duty: $40,000", "Deposit
      // Required: $20,000". Nobody typed any of them for this deal - the BC
      // stopped showing a purchase box on a complex refinance last week, and
      // the figures somebody entered before that are still on the record.
      //
      // This asked "is there a number in that box", which is a question about
      // the record. The question that matters is whether this deal buys
      // anything, and lib/buying.ts has answered that since 12 Oct. The same
      // mistake, and the same fix, as box-security.ts made on the compliance
      // side - this is the client-facing half of it, which is the worse half.
      if (!buying) {
        // Nothing to print. A refinance's own three lines follow below.
      } else if (d.purchasePrice) body += p(`Purchase Price: ${money(d.purchasePrice)}`)
      if (buying && d.stampDuty) {
        // Was hardcoded to NSW, which was simply wrong for a client buying
        // anywhere else. It now says whichever state the deal carries, or nothing
        // at all rather than a state the deal never named.
        const st = String(d.dutyState || '').trim().toUpperCase()
        body += p(`Stamp Duty${st ? ` (${st})` : ''}: ${money(d.stampDuty)}`)
      }
      // See PLUS_INCIDENTALS in generate-email/route.ts - the same words, on the same
      // line, so the two emails a client receives do not disagree about what they
      // have to bring.
      if (buying && d.deposit) body += p(`Deposit Required (plus solicitor's fees and incidentals): ${money(d.deposit)}`)

      // It used to read "Loan Amount: $666,000" then "Existing Loan Balance:
      // $666,000" - the same figure twice, with the equity release missing.
      const total = lenderTotal(d.refinanceSplits)

      // THE LENDING OPTIONS DO NOT DECIDE WHAT IS BEING RELEASED. THE BC DOES.
      //
      // 16 Oct 2026, the Avard deal. This worked the release out itself, as
      // literally total lending MINUS the one existing loan balance. On a deal
      // secured by two houses that box holds one of them, so the other house's
      // entire refinanced loan read as equity:
      //
      //   lending  129,000 + 240,000 = 369,000
      //   balance                      237,392   <- ONE house
      //   "equity release"             131,608   <- on a deal releasing nothing
      //
      // Fabio: "LO is not only wrong showing equity, it is creating its own
      // breakdown, when I said 10000 times LO doesn't create structure, BC
      // holds that."
      //
      // So both figures are read off the BC, where a person typed them. Nothing
      // typed, nothing printed - the arithmetic that filled the gap is gone.
      const owing = balanceTotal(bcData || {})
      const extra = releaseTotal(bcData || {})
      // A ZERO BALANCE IS NOT A BALANCE. "0" is a truthy string, so the test
      // above sent this deal down the refinance branch and then printed
      // "Existing Loan Balance: $0" to a client. Nothing is being refinanced
      // off it; the line says nothing instead.
      if (owing > 0) body += p(`Existing Loan Balance: ${money(owing)}`)
      if (extra > 0) body += p(`Equity Release: ${money(extra)}`)
      // Dropped when it is the balance under a second name - the same rule the
      // BC follows. A dollar-for-dollar refinance has one number, not two.
      if (total > 0 && showsOwnLoanAmount(owing, total)) {
        body += p(`Total Loan Amount: ${money(total)}`)
      }
    }
  }

  if (d.documentsRequired.length > 0) {
    body += `<p style="font-size:14px;font-weight:600;color:#343333;margin-bottom:8px"><span style="color:#343333;">Please note, below numbers are subject to reviewing the following documents:</span></p>`
    body += d.documentsRequired.map((doc: string) => `<p style="font-size:13px;color:#555;margin:4px 0"><span style="color:#555;">&ndash; ${doc}</span></p>`).join('')
    body += '<br>'
  }

  if (d.criteriaUsed.length > 0) {
    // ONE OPTION IS A LENDER, NOT LENDERS. Katie, 13 Oct 2026: "one option only
    // so should be lender - we have specifically focused on a specific lender".
    // Counted rather than hard-coded, so it is still right at three.
    body += p(`<strong>When conducting our research, we focused on ${
      (Array.isArray(d.lenders) ? d.lenders.length : 0) === 1 ? 'a lender' : 'lenders'} that would offer the following:</strong>`)
    body += d.criteriaUsed.map((c: string) => `<p style="font-size:13px;color:#555;margin:4px 0"><span style="color:#555;">&ndash; ${c}</span></p>`).join('')
    body += '<br>'
  }

  body += p('<strong>Please note that this email does not constitute as a pre-approval.</strong>')

  if (d.additionalNotes) {
    body += p(d.additionalNotes)
  }

  // THE BUFFER NOTE, DECIDED BY THE DEAL AND NOT BY THIS EMAIL'S TEMPLATE.
  //
  // 12 Oct 2026. This read `d.template !== 'lo_purchase'`. That is a label on an
  // email deciding whether a client is told about their own loan amount, and
  // when a refinance got stuck on the purchase template - which is exactly what
  // was happening, see lib/lo-template.ts - the paragraph silently stopped
  // going out. Nothing prints to say a paragraph was left out, so it went
  // unnoticed for weeks.
  //
  // It reads the borrowing capacity's scenario now, which is the same thing the
  // borrowing capacity email reads, so the two cannot disagree about whether a
  // client was told. And it wears the same panel as the BC email rather than
  // being a loose paragraph. See lib/buffer-note.ts.
  body += bufferNoteBlock(bcData?.template)

  // The note is written text and stays, even on an old deal where we cannot tell
  // which of two same-bank products was meant. recommendedLabel() falls back to
  // the bank on its own, exactly as this line read before - what changed is that
  // the table below no longer stars both columns.
  if (d.recommendationNote && (recommendedOption(d) || d.recommendedLender)) {
    // The PRODUCT as well as the bank. "Our Recommendation: Bankwest" on a deal
    // holding two Bankwest products told the processing team nothing.
    body += `<p style="font-size:14px;font-weight:700;color:#343333;margin-bottom:8px"><span style="color:#343333;">Our Recommendation: ${recommendedLabel(d)}</span></p>`
    body += p(d.recommendationNote)
  }
  // THE BUTTON GOES ABOVE THE TABLE.
  //
  // Fabio, 15 Sep 2026. It used to sit at the very end, so a client had to
  // scroll past the whole comparison - three option columns, the splits, the
  // totals and every fee - before anything told them how to reply. It now sits
  // straight after the recommendation note and straight before the options, so
  // they read why, then see the button, then look at the numbers.
  //
  // The closing line stays where it is: it says "the numbers above", which only
  // makes sense underneath them. lib/email-buttons.test.ts fails if the button
  // ever drifts back below the table.
  body += ctas(b.calendly, proceedUrl)

  const sortedLenders = recommendedFirst(d, d.lenders || [])
  // The securities, read live off the borrowing capacity and the fact find
  // rather than copied - see the note on bcData at the top of this handler.
  const secs = securitiesOf(bcData || {}, ffData || {})
  body += buildLenderTable(sortedLenders, isBridging, d, d.refinanceSplits, d.propertyValue, secs)

  body += p('Please let us know which lender you would like to proceed with and if you have any questions regarding the numbers above.')
  // THE RBA NOTICE, FIRST IN THE BOX THE CLIENT ALREADY READS FOR CAVEATS.
  //
  // This email puts several banks on one page and they will not all move on the
  // same day, so it names which options it applies to where only some are still
  // to pass it on. Empty where the notice is off, or where every bank quoted has
  // already moved. See lib/rate-notice.ts.
  const rbaLines = await rateNoticeLines((sortedLenders || []).map((l: any) => l?.lenderName))
  body += notesBox([...rbaLines,
    ...(d.importantNotesList || ['Any rates or fees quoted are subject to change', 'This email does not constitute as a formal approval'])])
  body += sig(b)

  const brand = await resolveBrand(d.brandId)
  const html = shell(body, brand)
  return NextResponse.json({ html })
}
