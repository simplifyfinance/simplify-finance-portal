import { altLvrPurchase, altLvrEquity, altRepayment } from '@/lib/alt-scenario'
import { NextRequest, NextResponse } from 'next/server'
import { ctas } from '@/lib/email-buttons'
import { resolveBrokerProfile, noBrokerMessage } from '@/lib/broker-profile'
import { createSupabaseServer } from '@/lib/supabase-server'
import { lmiClientLines, lmiIsInTheLoan, clientLoan } from '@/lib/lmi'
import { repaymentOf, splitRows, cardTitle, structureLead, realSplits } from '@/lib/split-cards'
import { purchaseRows } from '@/lib/purchase-rows'
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
import { money, readMoney } from '@/lib/money'
import { estimatedRepayment } from '@/lib/email-figures'
import { emailParagraphs } from '@/lib/rich-text'
import { showsOwnLoanAmount } from '@/lib/email-amounts'
import { PLEDGE_PROS, PLEDGE_CONS, PLEDGE_LOAN_1, PLEDGE_LOAN_2, guarantorPhrase } from '@/lib/family-pledge-copy'
import { totalCost, totalLending, fundsToContribute, repaymentDuringConstruction,
         num, DRAWDOWN_NOTE } from '@/lib/construction'


const DEFAULT_BRAND = {
  name: 'Simplify Finance',
  headerColor: '#343333',
  logoUrl: 'https://simplify-finance-portal.vercel.app/logo-charcoal-tagline.png',
  footerAddress: 'St Leonards, Sydney',
  acl: '387025',
}

function shell(body: string, b: { name: string; title: string; crn: string; calendly: string }, brand?: { name?: string; headerColor?: string; logoUrl?: string; footerAddress?: string; acl?: string }) {
  const brandName = brand?.name || DEFAULT_BRAND.name
  const headerColor = brand?.headerColor || DEFAULT_BRAND.headerColor
  const logoUrl = brand?.logoUrl || DEFAULT_BRAND.logoUrl
  const footerAddress = brand?.footerAddress || DEFAULT_BRAND.footerAddress
  const acl = brand?.acl || DEFAULT_BRAND.acl
  // A brand with no logo file used to set its name in white on the charcoal —
  // the same pale-on-dark trap as the disclaimer, and one nobody would notice
  // until a client got an email with an apparently empty header. Without
  // artwork the band is dropped and the name is set dark on white instead.
  const hasLogo = !!logoUrl
  const logoBlock = hasLogo
    ? `<img src="${logoUrl}" alt="${brandName}" height="94" style="height:94px;display:block;margin:0 auto;border:0" />`
    : ''
  const header = hasLogo
    ? `<tr><td bgcolor="${headerColor}" style="background:${headerColor};padding:28px 24px;text-align:center">${logoBlock}</td></tr>`
    : `<tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;padding:28px 24px 8px;text-align:center"><p style="color:#1a1a1a;font-size:22px;font-weight:700;margin:0"><span style="color:#1a1a1a;">${brandName}</span></p></td></tr>`
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f3" style="background:#f5f5f3;font-family:Arial,sans-serif"><tr>
  <td bgcolor="#f5f5f3" align="center" style="background:#f5f5f3;padding:24px 12px">
  <table width="600" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#ffffff" style="background:#ffffff;margin:0 auto">
    ${header}
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:20px 28px 28px">${body}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0"><tr>
      <td bgcolor="#ffffff" style="background:#ffffff;border-top:1px solid #E4E2DC;padding:12px 0 0">
      <p style="font-size:10px;color:#9e9e98;margin:0;line-height:1.65"><span style="color:#9e9e98;">&copy; 2026 ${brandName} | ${footerAddress} | Australian Credit Licence: ${acl}</span></p>
      </td></tr></table>
    </td></tr>
  </table></td></tr></table>`
}

// Duty is a state tax. Printing it unlabelled, or labelled NSW for everyone,
// puts a figure on a client-facing email that may belong to a different state.
function dutyLabel(d: any): string {
  const st = String(d?.dutyState || '').trim().toUpperCase()
  return st ? `Stamp duty (${st})` : 'Stamp duty'
}

function brokerBox(personalisation: string, firstName?: string, jointFirstName?: string, joint?: string) {
  const fn = (firstName || '[Client First Name]').trim()
  const jfn = (jointFirstName || '').trim()
  const greetingName = (joint === 'Yes' && jfn) ? `${fn} and ${jfn}` : fn
  return `<!--BROKER-BOX--><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
    <td width="4" bgcolor="#F59E0B" style="background:#F59E0B;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#FFF8E7" style="background:#FFF8E7;padding:13px 15px">
      <p style="font-size:10px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px"><span style="color:#92400E;">Broker personalisation</span></p>
      <p style="font-size:14px;color:#333333;margin:0 0 14px;line-height:1.6"><span style="color:#333333;">Hi ${greetingName},</span></p>
      ${emailParagraphs(personalisation) || `<p style="font-size:14px;color:#333333;margin:0;line-height:1.6"><span style="color:#333333;">[Add your personal opening here.]</span></p>`}
    </td></tr></table><!--/BROKER-BOX-->`
}

function notesBox(items: string[]) {
  const all = ['Any rates or fees quoted are subject to change', ...items]
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
    <td width="4" bgcolor="#2DBEFF" style="background:#2DBEFF;width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="#EEF6FD" style="background:#EEF6FD;padding:13px 15px">
      <p style="font-size:10px;font-weight:600;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px"><span style="color:#0369a1;">Important things to note</span></p>
      ${all.map(i => `<p style="font-size:12px;color:#334155;margin:4px 0;line-height:1.6"><span style="color:#334155;">&bull; ${i}</span></p>`).join('')}
    </td></tr></table>`
}

function heading() { return `<p style="font-size:11px;font-weight:600;color:#343333;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px"><span style="color:#343333;">Borrowing Capacity Review</span></p>` }

function card(title: string, rows: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
    <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px"><span style="color:#7a5c3a;">${title}</span></p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr></table>`
}

// Two names for the same number is not information. lib/email-amounts.ts holds
// the rule and the reasoning; this just builds the row when there is one.
//
// Refinance only passes 'New loan amount' as the label. Fabio, 2 Sep 2026: that
// scenario "is only for dollar for dollar refi" - so the row is normally the
// balance said twice, and on the rare file where it is not, it stays and the
// difference is the point.
function loanAmountRow(headline: any, splitAmount: any, label = 'Loan amount'): string {
  return showsOwnLoanAmount(headline, splitAmount) ? row(label, money(splitAmount)) : ''
}

// NEVER A SQUARE BRACKET, NEVER AN EMPTY ROW.
//
// These three lines went to Alexis Janes on 7 Sep 2026 inside an email that
// otherwise looked finished: "Against [Property Address]", an "Existing loan
// balance" row with nothing after it, and "Estimated repayments [calculated]".
// A client reading that is being shown the workings of a form, not an answer.
//
// A figure we can work out is worked out. A figure we cannot is left out, and
// the row goes with it. See lib/email-figures.ts.
function rowIf(l: string, v: string) {
  return v ? row(l, v) : ''
}

// The same rule for the option columns and split blocks, which are lines rather
// than table rows: no figure, no line.
function lineIf(l: string, v: string) {
  return v ? `<p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">${l}: ${v}</span></p>` : ''
}

// The repayment is worked out from the loan amount the broker actually typed -
// never from a total inferred off the fact find. If nobody has said what the new
// loan is, there is no repayment to quote and the row does not appear.
// ONE CARD PER SPLIT.
//
// Most templates were written around splits[0] and printed nothing else, so a
// second split changed nothing about the email and said nothing about being
// ignored. Titles, rows and the counting line above them are all decided in
// lib/split-cards.ts, so no template can drift back into its own answer.
// THE PURCHASE BLOCK - five lines, one order, every scenario that buys. What it
// says is decided in lib/purchase-rows.ts; this only turns it into table rows.
function purchaseBlock(input: Parameters<typeof purchaseRows>[0]): string {
  // A NOTE IS A SENTENCE, NOT AN AMOUNT. row() right-aligns its value in the
  // money column in the same weight as the figures, so "includes LMI of $9,000,
  // added to the loan" read like a number that had lost its digits. Full width,
  // italic, the same treatment the construction drawdown note already gets.
  return purchaseRows(input).map(r => r.note
    ? `<tr><td colspan="2" style="font-size:11px;color:#7a5c3a;font-style:italic;line-height:1.5;padding:0 0 4px"><span style="color:#7a5c3a;">${r.value}</span></td></tr>`
    : row(r.label, r.value)).join('')
}

// The same five lines in a comparison column, which stacks them rather than
// putting them in a two-column table.
function purchaseColumn(input: Parameters<typeof purchaseRows>[0]): string {
  return purchaseRows(input).map(r => r.note
    ? `<p style="font-size:11px;color:#7a5c3a;font-style:italic;margin:2px 0 4px"><span style="color:#7a5c3a;">${r.value}</span></p>`
    : `<p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">${r.label}${r.label ? ': ' : ''}${r.value}</span></p>`
  ).join('')
}

function splitCards(d: any, templateName: string, opts?: {
  amountLabel?: string; showTerm?: boolean; termWithType?: boolean
  existingFallback?: any; after?: (i: number, total: number) => string
  // Templates with hand-written cards of their own - a bridging loan, an equity
  // release - keep those and use this to pick up anything past them. Numbering
  // still counts from the whole list, so the third split is "Split 3".
  from?: number
  // Set on a template with no purchase breakdown of its own, where the split
  // card IS the loan line. Ignored unless there is exactly one real split.
  lmiOnTheSplit?: boolean
}) {
  const splits = realSplits(d.splits)
  const from = opts?.from || 0
  if (splits.length <= from) return ''
  return splits.slice(from).map((sp: any, k: number) => ((i: number) =>
    card(cardTitle(sp, i, splits.length, templateName),
      splitRows(sp, d.loanTerm, {
        amountLabel: opts?.amountLabel,
        showTerm: opts?.showTerm,
        termWithType: opts?.termWithType,
        // The DEAL's balance only stands in for a lone split. With two, each one
        // carries its own or the row is simply not there - a deal-level figure
        // printed on one of two property cards would be wrong on both.
        existingFallback: splits.length === 1 ? opts?.existingFallback : undefined,
        // Same rule, same reason: one split or nothing.
        lmiBc: opts?.lmiOnTheSplit && splits.length === 1 ? d : undefined,
      }).map(r => r.note
        ? `<tr><td colspan="2" style="font-size:11px;color:#7a5c3a;font-style:italic;line-height:1.5;padding:0 0 4px"><span style="color:#7a5c3a;">${r.value}</span></td></tr>`
        : row(r.label, r.value)).join('')
      + (opts?.after ? opts.after(i, splits.length) : '')))(from + k)).join('')
}

function repaymentRow(split: any, loanTerm: any) {
  // THE TYPED BOX WINS. It used to call estimatedRepayment() and print the
  // portal's own arithmetic over whatever the broker had entered - $2,912 on a
  // split whose Repayment box said $3,445. Fabio, 16 Sep 2026: "our typed
  // repayments take over never calculate repayments." See lib/split-cards.ts.
  return rowIf('Estimated repayments', repaymentOf(split, loanTerm))
}

// WHERE THE TOP OF THIS EMAIL READS FROM, AND WHY IT IS NOT THE FACT FIND.
//
// The loan card at the top is the BROKER'S scenario - the suburb, the balance,
// the split he decided on. The checklist further down is the client's own
// position, read from the fact find. Two blocks, two sources, on purpose.
//
// For a few hours on 8 Sep 2026 this fell back to the fact find whenever the BC
// was blank, and that was wrong: an unfinished scenario is not something the
// portal should fill in on a broker's behalf. Fabio: "the top part comes from
// the BC tab, what is the problem here?" The problem was never the source. It
// was that an empty box printed the words "[Property Address]" and sent them to
// a client. Empty now means the line is not there, and the Preview screen says
// which boxes are empty before anybody presses send.
function securityHead(d: any) {
  return d.suburb ? propHead(`Against ${d.suburb}`, d.incomeRental) : ''
}

function existingLoanRow(d: any) {
  return rowIf('Existing loan balance', money(d.existingLoanBal))
}

// WHAT THE CLIENT STILL HAS TO FIND ON TOP.
//
// The contribution line is the number a client reads as "so that's what I need
// on the day", and it is never the whole of it - conveyancing and the small
// costs around settlement sit on top, and they are not figures this portal
// holds. Fabio, 10 Sep 2026, on every purchase scenario.
//
// Plain text inside the label, so it inherits the label's colour and the money
// column stays a clean column of numbers.
export const PLUS_INCIDENTALS = " (plus solicitor's fees and incidentals)"

function row(l: string, v: string) {
  return `<tr><td style="font-size:12px;color:#555;padding:3px 0"><span style="color:#555;">${l}</span></td><td style="font-size:12px;color:#343333;font-weight:500;text-align:right"><span style="color:#343333;">${v}</span></td></tr>`
}

function check(items: string[]) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
    <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px"><span style="color:#7a5c3a;">Based on your numbers</span></p>
    ${items.map(i => `<p style="font-size:13px;color:#555;margin:4px 0"><span style="color:#555;">&#10003; ${i}</span></p>`).join('')}
  </td></tr></table>`
}

// One copy, in lib/email-buttons.ts.

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
  return /[0-9]/.test(t) ? `${money(t)}` : t
}

function p(t: string) { return `<p style="font-size:14px;color:#333;margin-bottom:14px"><span style="color:#333;">${t}</span></p>` }
function p13(t: string) { return `<p style="font-size:13px;color:#555;margin-bottom:12px"><span style="color:#555;">${t}</span></p>` }
function propHead(t: string, rentalIncome?: string) {
  return `<p style="font-size:13px;color:#343333;font-weight:600;margin-bottom:8px"><span style="color:#343333;">&#127968; ${t}</span></p>` +
    (rentalIncome ? `<p style="font-size:12px;color:#666;margin-bottom:8px"><span style="color:#666;">Rental income: ${money(rentalIncome)}/week</span></p>` : '')
}

// FAMILY PLEDGE: ONE CARD PER LOAN, WITH THE SENTENCE THAT EXPLAINS IT.
//
// 15 Sep 2026. This template printed splits[0] and nothing else, so the pledge
// split - the part that IS the family pledge - never reached the client, and
// the headline said "your borrowing capacity is sitting at around $408,000"
// when the two splits together were $527,500. Every family pledge email that
// has gone out understated the loan.
//
// Fabio, 15 Sep 2026: "look at bc there 2 splits". And on whether a deal could
// ever have three: "we can never have 3 splits" - so loan 2 is the guaranteed
// one, always, and the wording says so rather than being worked out.
function pledgeLoan(title: string, split: any, loanTerm: any, sentence: string) {
  if (!split) return ''
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:11px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
    <p style="font-size:11px;font-weight:700;color:#7a5c3a;margin:0 0 6px"><span style="color:#7a5c3a;">${title}${split.label ? ' &mdash; ' + split.label : ''}</span></p>
    <p style="font-size:12px;color:#5b4a33;margin:0 0 9px;line-height:1.6"><span style="color:#5b4a33;">${sentence}</span></p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${
      rowIf('Loan amount', money(split.amount)) +
      rowIf('Indicative rate', split.rate ? `${split.rate}% p.a.*` : '') +
      repaymentRow(split, loanTerm) +
      rowIf('Repayment type', split.type ? `${split.type} over ${loanTerm || '30'} years` : '')
    }</table>
  </td></tr></table>`
}

// The pros and the cons, in Fabio's words. His wording, his punctuation - this
// goes to a client and it is not mine to tidy.
function pledgeList(title: string, items: string[], bar: string, bg: string, heading: string, marker: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:13px"><tr>
    <td width="4" bgcolor="${bar}" style="background:${bar};width:4px;font-size:0;line-height:0">&nbsp;</td>
    <td bgcolor="${bg}" style="background:${bg};padding:13px 15px">
      <p style="font-size:10px;font-weight:700;color:${heading};text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px"><span style="color:${heading};">${title}</span></p>
      ${items.map(i => `<p style="font-size:12px;color:#334155;margin:6px 0;line-height:1.65"><span style="color:${heading};font-weight:700;">${marker}</span> <span style="color:#334155;">${i}</span></p>`).join('')}
    </td></tr></table>`
}

// ONE SET OF WORDS ABOUT THE LMI, FOUR COLUMN BUILDERS.
//
// Each of these used to carry its own copy of the same two lines, and none of
// them said whether the premium was inside the loan figure above it. What the
// client is told is decided in lib/lmi.ts; this only wraps it in the markup the
// columns already use. A deal where nobody has answered yet renders exactly what
// it rendered before, character for character - see lmiClientLines().
function lmiLines(opt: any, treatment: any, base: number): string {
  const rows = lmiClientLines({ lmiApplicable: opt?.lmiApplicable, lmi: opt?.lmi, lmiTreatment: treatment },
                              base > 0 ? base : null)
  return rows.map(r => {
    const colour = r.strong ? '#343333' : '#555'
    const size = r.strong ? '12.5px' : '11px'
    const weight = r.strong ? 'font-weight:700;' : ''
    const text = r.label ? `${r.label}: ${r.value}` : r.value
    return `<p style="font-size:${size};color:${colour};margin:3px 0"><span style="color:${colour};${weight}">${text}</span></p>`
  }).join('')
}

function buildLVRLine(d: any, lmiAlreadyInTheLoan?: boolean) {
  const pct = Number(d.lvrPercent)
  if (!pct || pct <= 0) {
    return row('LVR', d.lvr || '80%')
  }
  if (pct > 80) {
    if (d.lmiApplicable === 'Applicable' && d.lmi) {
      // WHERE A LOAN FIGURE ABOVE ALREADY ABSORBED THE PREMIUM, this prints the
      // LVR and stops. It used to add a "Total loan" row underneath a breakdown
      // that had just shown the base - two loan amounts, four lines apart, and
      // nothing in between that added up. Fabio, 24 Sep 2026.
      if (lmiAlreadyInTheLoan) return row('LVR', `${pct}%`)
      // No purchase breakdown on this template, so the premium has nowhere else
      // to go and reads here exactly as it always has.
      const base = (d.splits || []).reduce((t: number, sp: any) =>
        t + (parseFloat(String(sp?.amount ?? '').replace(/,/g, '')) || 0), 0)
      const rows = lmiClientLines({ lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment },
                                  base > 0 ? base : null)
      return row('LVR', `${pct}%`)
        + rows.map(r => row(r.label, r.value)).join('')
    }
    if (d.lmiApplicable === 'Waived') {
      return row('LVR', `${pct}% (LMI waived)`)
    }
    return row('LVR', `${pct}%`)
  }
  return row('LVR', `${pct}% (no LMI)`)
}

// The fifth hand-written money formatter found in this codebase, and the one
// closest to the client - it prints figures into the email itself. Number() on
// "506,514" is NaN, so a stored figure with commas in it fell straight through
// to being printed raw and unformatted. money() from lib/money.ts is the one way
// money is printed here; the raw value stays as the fallback so nothing that
// used to appear can disappear.
function fmtNum(v: any): string {
  return money(v).replace(/^\$/, '') || String(v || '')
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
        items.push(`${entry.label} ${money(entry.amount)} p.a.`)
      }
    })
  } else if (d.incomeBase) {
    items.push(`Base salary (excl. super) ${money(d.incomeBase)} p.a.`)
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
      const equityReleaseN = parseFloat((opt.equityReleaseAmount || '0').replace(/,/g, '')) || 0
      // ONE COPY OF THE ARITHMETIC, shared with the box on the broker's screen.
      const lvrNum = altLvrEquity(opt, d.existingLoanBal, d.propertyValue).percent
      const actions = []
      if (opt.ccPayoff) actions.push((Number(opt.ccPayoffAmount) || 0) > 0 ? `Reduce credit card by ${money(opt.ccPayoffAmount)}` : 'Credit card closed')
      if (opt.hecsPayoff) actions.push((Number(opt.hecsPayoffAmount) || 0) > 0 ? `Reduce HECS by ${money(opt.hecsPayoffAmount)}` : 'HECS closed')
      if (opt.carLoanPayoff) actions.push('Car loan closed')
      if (opt.personalLoanPayoff) actions.push('Personal loan closed')
      const nonBankNote = opt.nonBankLender ? `<p style="font-size:11px;color:#555;font-style:italic;margin:8px 0 2px"><span style="color:#555;">This option is based on a non-bank lending solution, which typically allows more flexibility around serviceability.</span></p>` : ''
      // EACH OPTION'S OWN ANSWER. This passed d.lmiTreatment - Option 1's answer -
      // to every alternative column, so a deal where Option 1 capitalises and
      // Option 2 does not told the client the wrong thing about Option 2.
      const lmiLine = lvrNum > 80 ? lmiLines(opt, opt.lmiTreatment, existingLoanN + equityReleaseN) : ''
      return `<td style="width:50%;vertical-align:top;padding:0 6px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px"><tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;border-radius:4px;padding:6px 8px;font-size:13px;font-weight:700;color:#343333;font-family:Arial,sans-serif">${label}</td></tr></table>
        ${lineIf('Existing loan balance', money(d.existingLoanBal))}
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">Equity release amount: ${money(opt.equityReleaseAmount) || ''}</span></p>
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">LVR: ${lvrNum}%</span></p>${lmiLine}
        ${actions.length ? `<p style="font-size:11px;font-weight:600;color:#343333;margin:8px 0 3px"><span style="color:#343333;">To achieve this option:</span></p>` + actions.map((a: string) => `<p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">&#10003; ${a}</span></p>`).join('') : ''}${nonBankNote}
      </td>`
    }
    const baseOptionRE = {
      equityReleaseAmount: d.equityRelease,
      lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment,
      ccPayoff: false, hecsPayoff: false, carLoanPayoff: false, personalLoanPayoff: false, nonBankLender: false
    }
    const allOptionsRE = [buildOptionColRE(baseOptionRE, `Option 1${d.optionLabel ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + d.optionLabel + '</span>' : ''}`), ...(d.altScenarios || []).map((alt: any, i: number) => buildOptionColRE(alt, `Option ${i + 2}${alt.label ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + alt.label + '</span>' : ''}`))]
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Based on your current financial position, you have capacity to refinance and access equity. Below we have outlined different equity release scenarios depending on your financial position.') +
      securityHead(d) +
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px"><span style="color:#7a5c3a;">Equity Release Options</span></p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${allOptionsRE.join('')}</tr></table>
      </td></tr></table>` +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The numbers are looking strong. The next step is finding the right lender and rate for your situation \u2014 and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'refinance_equity') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      // Reads the equity release field FIRST, which is what the card underneath
      // shows. It read the split amount, and a broker who edited one and not the
      // other got an email whose opening sentence contradicted its own numbers.
      p(`Based on your current financial position, you have sufficient capacity to refinance your property and access approximately ${amt(d.equityRelease || d.splits?.[1]?.amount, '[equity amount]')} in equity, while also securing a competitive rate.`) +
      p13('Here is a breakdown of the structure:') +
      securityHead(d) +
      card('Split 1 - Refinanced Loan', existingLoanRow(d) + loanAmountRow(d.existingLoanBal, d.splits?.[0]?.amount) + row('Indicative rate', (d.splits?.[0]?.rate || '') + '% p.a.*') + repaymentRow(d.splits?.[0], d.loanTerm) + row('Repayment type', d.splits?.[0]?.type || 'P&I') + row('Loan term', (d.loanTerm || '30') + ' years')) +
      card('Split 2 - Equity Release', row('Equity release amount', money(d.equityRelease)) + loanAmountRow(d.equityRelease, d.splits?.[1]?.amount) + row('Indicative rate', (d.splits?.[1]?.rate || '') + '% p.a.*') + repaymentRow(d.splits?.[1], d.loanTerm) + row('Repayment type', d.splits?.[1]?.type || 'Interest Only') + buildLVRLine(d)) +
      // Those two cards are written by hand because each has a headline figure of
      // its own. A third split had nowhere to go and was dropped in silence.
      splitCards(d, 'Additional lending', { from: 2, amountLabel: 'New loan amount', showTerm: true }) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The numbers are looking strong. The next step is finding the right lender and rate for your situation — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'refinance_only') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Based on your current financial position, you have sufficient capacity to refinance your existing loan and secure a competitive rate.') +
      p13(structureLead(realSplits(d.splits).length)) +
      securityHead(d) +
      splitCards(d, 'Refinanced Loan', {
        amountLabel: 'New loan amount', showTerm: true, existingFallback: d.existingLoanBal,
        // One split here means the card IS the loan, so a capitalised premium
        // goes into the new loan amount and the LVR line below stops repeating
        // it as a "Total loan" four rows down.
        lmiOnTheSplit: true,
        // The LVR is a fact about the whole deal, not about a part of it.
        after: (i) => (i === 0 ? buildLVRLine(d, lmiIsInTheLoan(d) && realSplits(d.splits).length === 1) : ''),
      }) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The numbers are looking strong. The next step is finding the right lender and rate for your situation — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'oo_purchase' && d.compareOptions) {
    const buildOptionCol = (opt: any, label: string) => {
      // ONE COPY OF THE ARITHMETIC, shared with the box on the broker's screen.
      // It now adds the LMI premium when this option says it is capitalised.
      const lvrNum = altLvrPurchase(opt).percent
      const actions = []
      if (opt.ccPayoff) actions.push((Number(opt.ccPayoffAmount) || 0) > 0 ? `Reduce credit card by ${money(opt.ccPayoffAmount)}` : 'Credit card closed')
      if (opt.hecsPayoff) actions.push((Number(opt.hecsPayoffAmount) || 0) > 0 ? `Reduce HECS by ${money(opt.hecsPayoffAmount)}` : 'HECS closed')
      if (opt.carLoanPayoff) actions.push('Car loan closed')
      if (opt.personalLoanPayoff) actions.push('Personal loan closed')
      const nonBankNote = opt.nonBankLender ? `<p style="font-size:11px;color:#555;font-style:italic;margin:8px 0 2px"><span style="color:#555;">This option is based on a non-bank lending solution, which typically allows more flexibility around serviceability.</span></p>` : ''
      return `<td style="width:50%;vertical-align:top;padding:0 6px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px"><tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;border-radius:4px;padding:6px 8px;font-size:13px;font-weight:700;color:#343333;font-family:Arial,sans-serif">${label}</td></tr></table>
        ${purchaseColumn({
          price: opt.purchasePrice, duty: opt.stampDuty, dutyLabel: dutyLabel(d),
          loan: opt.loanAmount, contribution: opt.deposit, contributionFrom: d.depositSource,
          lmiApplicable: opt.lmiApplicable, lmi: opt.lmi, lmiTreatment: opt.lmiTreatment,
        })}
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">LVR: ${lvrNum}%</span></p>
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">Rate: ${opt.rate}% p.a.*</span></p>
        ${lineIf('Est. repayment', altRepayment(opt, d.loanTerm))}
        ${actions.length ? `<p style="font-size:11px;font-weight:600;color:#343333;margin:8px 0 3px"><span style="color:#343333;">To achieve this option:</span></p>` + actions.map((a: string) => `<p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">&#10003; ${a}</span></p>`).join('') : ''}${nonBankNote}
      </td>`
    }
    const baseOption = {
      purchasePrice: d.purchasePrice, deposit: d.deposit, stampDuty: d.stampDuty,
      loanAmount: d.splits?.[0]?.amount, rate: d.splits?.[0]?.rate, repayment: d.splits?.[0]?.repayment,
      type: d.splits?.[0]?.type, ioYears: d.splits?.[0]?.ioYears,
      lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment,
      ccPayoff: false, hecsPayoff: false, carLoanPayoff: false, personalLoanPayoff: false
    }
    const allOptions = [buildOptionCol(baseOption, `Option 1${d.optionLabel ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + d.optionLabel + '</span>' : ''}`), ...(d.altScenarios || []).map((alt: any, i: number) => buildOptionCol(alt, `Option ${i + 2}${alt.label ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + alt.label + '</span>' : ''}`))]
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Below we have outlined different purchase price scenarios depending on your financial position.') +
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px"><span style="color:#7a5c3a;">Purchase Options</span></p>
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
      card('The Purchase',
        purchaseBlock({
          price: d.purchasePrice, duty: d.stampDuty, dutyLabel: dutyLabel(d),
          loan: totalLending(d.splits), contribution: d.deposit, contributionFrom: d.depositSource,
          lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment,
        }) +
        buildLVRLine(d, lmiIsInTheLoan(d))
      ) +
      p13(structureLead(realSplits(d.splits).length)) +
      splitCards(d, 'Owner-occupied loan', { termWithType: true }) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'investment_purchase' && d.compareOptions) {
    const buildOptionColIP = (opt: any, label: string) => {
      // ONE COPY OF THE ARITHMETIC, shared with the box on the broker's screen.
      // It now adds the LMI premium when this option says it is capitalised.
      const lvrNum = altLvrPurchase(opt).percent
      const actions = []
      if (opt.ccPayoff) actions.push((Number(opt.ccPayoffAmount) || 0) > 0 ? `Reduce credit card by ${money(opt.ccPayoffAmount)}` : 'Credit card closed')
      if (opt.hecsPayoff) actions.push((Number(opt.hecsPayoffAmount) || 0) > 0 ? `Reduce HECS by ${money(opt.hecsPayoffAmount)}` : 'HECS closed')
      if (opt.carLoanPayoff) actions.push('Car loan closed')
      if (opt.personalLoanPayoff) actions.push('Personal loan closed')
      const nonBankNote = opt.nonBankLender ? `<p style="font-size:11px;color:#555;font-style:italic;margin:8px 0 2px"><span style="color:#555;">This option is based on a non-bank lending solution, which typically allows more flexibility around serviceability.</span></p>` : ''
      return `<td style="width:50%;vertical-align:top;padding:0 6px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px"><tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;border-radius:4px;padding:6px 8px;font-size:13px;font-weight:700;color:#343333;font-family:Arial,sans-serif">${label}</td></tr></table>
        ${purchaseColumn({
          price: opt.purchasePrice, duty: opt.stampDuty, dutyLabel: dutyLabel(d),
          loan: opt.loanAmount, contribution: opt.deposit, contributionFrom: d.depositSource,
          lmiApplicable: opt.lmiApplicable, lmi: opt.lmi, lmiTreatment: opt.lmiTreatment,
        })}
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">LVR: ${lvrNum}%</span></p>
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">Rate: ${opt.rate}% p.a.*</span></p>
        ${lineIf('Est. repayment', altRepayment(opt, d.loanTerm))}
        ${actions.length ? `<p style="font-size:11px;font-weight:600;color:#343333;margin:8px 0 3px"><span style="color:#343333;">To achieve this option:</span></p>` + actions.map((a: string) => `<p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">&#10003; ${a}</span></p>`).join('') : ''}${nonBankNote}
      </td>`
    }
    const baseOptionIP = {
      purchasePrice: d.purchasePrice, deposit: d.deposit, stampDuty: d.stampDuty,
      loanAmount: d.splits?.[0]?.amount, rate: d.splits?.[0]?.rate, repayment: d.splits?.[0]?.repayment,
      type: d.splits?.[0]?.type, ioYears: d.splits?.[0]?.ioYears,
      lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment,
      ccPayoff: false, hecsPayoff: false, carLoanPayoff: false, personalLoanPayoff: false, nonBankLender: false
    }
    const allOptionsIP = [buildOptionColIP(baseOptionIP, `Option 1${d.optionLabel ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + d.optionLabel + '</span>' : ''}`), ...(d.altScenarios || []).map((alt: any, i: number) => buildOptionColIP(alt, `Option ${i + 2}${alt.label ? '<br><span style="font-size:11px;font-weight:400;color:#666">' + alt.label + '</span>' : ''}`))]
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Below we have outlined different purchase price scenarios depending on your financial position.') +
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px"><span style="color:#7a5c3a;">Purchase Options</span></p>
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
      card('The Purchase',
        purchaseBlock({
          price: d.purchasePrice, duty: d.stampDuty, dutyLabel: dutyLabel(d),
          loan: totalLending(d.splits), contribution: d.deposit, contributionFrom: d.depositSource,
          lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment,
        }) +
        buildLVRLine(d, lmiIsInTheLoan(d))
      ) +
      p13(structureLead(realSplits(d.splits).length)) +
      splitCards(d, 'Investment loan', { termWithType: true }) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right structure for your investment — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'buy_sell') {
    const depositLabel = (Number(d.additionalSavings) || 0) > 0 ? 'Deposit (from sale proceeds and savings)' : 'Deposit (from sale proceeds)'
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.splits?.[0]?.amount, '[amount]')}</strong>.`) +
      card('Sale Proceeds Summary',
        row('Expected sale price', money(d.salePrice)) +
        row('Agent fees / selling costs', money(d.agentFees)) +
        rowIf('Existing loan balance (to be discharged)', money(d.existingLoanBal)) +
        `<tr style="border-top:1px solid #CEBEAB"><td style="font-size:12px;font-weight:600;color:#343333;padding-top:6px"><span style="color:#343333;">Net proceeds (est.)</span></td><td style="font-size:12px;font-weight:600;color:#343333;text-align:right;padding-top:6px"><span style="color:#343333;">${money(d.netProceeds) || ''}</span></td></tr>`
      ) +
      card('New Purchase',
        purchaseBlock({
          price: d.purchasePrice, duty: d.stampDuty, dutyLabel: dutyLabel(d),
          loan: totalLending(d.splits), contribution: d.deposit,
          contributionFrom: (Number(d.additionalSavings) || 0) > 0 ? 'sale proceeds and savings' : 'sale proceeds',
          lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment,
        }) +
        buildLVRLine(d, lmiIsInTheLoan(d))
      ) +
      p13(structureLead(realSplits(d.splits).length)) +
      splitCards(d, 'End debt', { termWithType: true }) +
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
      // ONE LOAN LINE PER COLUMN. Each of these columns is a deposit scenario
      // with its own LMI figure, and the premium now goes INTO the loan amount
      // when it is capitalised rather than trailing the LVR underneath it.
      const col = clientLoan({ ...s, lmiTreatment: s.lmiTreatment || d.lmiTreatment }, amountNum || null)
      const colNote = col.note
        ? `<p style="font-size:11px;color:#7a5c3a;font-style:italic;margin:2px 0 4px"><span style="color:#7a5c3a;">${col.note}</span></p>`
        : ''
      const lmiLine = lvrNum > 80 && !col.note
        ? lmiLines(s, s.lmiTreatment || d.lmiTreatment, amountNum) : ''
      return `<td style="width:${Math.floor(100/splits.length)}%;vertical-align:top;padding:0 4px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px"><tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;border-radius:4px;padding:6px 8px;font-size:13px;font-weight:700;color:#343333;font-family:Arial,sans-serif">${s.label}</td></tr></table>
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">Loan amount: ${col.amount !== null ? money(col.amount) : money(s.amount)}</span></p>${colNote}${s.deposit ? `<p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">Deposit required${PLUS_INCIDENTALS}: ${money(s.deposit)}</span></p>` : ""}
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">LVR: ${lvrNum}%</span></p>${lmiLine}
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">Rate: ${s.rate}% p.a.*</span></p>
        <p style="font-size:11px;color:#555;margin:3px 0"><span style="color:#555;">Type: ${s.type}</span></p>
      </td>`
    }).join('')
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.purchasePrice, '[purchase price]')}</strong>. Below we have outlined ${splits.length} scenarios based on different deposit contributions.`) +
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2E8DB" style="background:#F2E8DB;border-radius:8px;margin-bottom:14px"><tr><td bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px">
        <p style="font-size:11px;font-weight:600;color:#7a5c3a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px"><span style="color:#7a5c3a;">Deposit Options</span></p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${lvrCols}</tr></table>
      </td></tr></table>` +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'fhb') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('There is currently a government scheme we believe that you would be eligible for. The 5% Deposit Scheme is a current government scheme that allows first home buyers with a minimum 5% deposit to purchase a property without the cost of mortgage insurance.') +
      `<p style="font-size:14px;color:#333;margin-bottom:8px"><span style="color:#333;">To apply for the 5% Deposit Scheme, home buyers must be:</span></p>
      <ul style="font-size:13px;color:#555;margin:0 0 16px 20px;line-height:1.9">
        <li>An Australian citizen(s) or Permanent Resident at the time they enter the loan</li>
        <li>Applying as an individual or couple</li>
        <li>Saved a minimum deposit of 5%**</li>
        <li>Intending to be owner-occupiers of the purchased property</li>
        <li>First home buyers who have not previously owned, or had an interest in, a property in Australia in the last 10 years</li>
        <li>Purchase a property within the price cap relevant to your state/territory</li>
      </ul>
      <p style="font-size:12px;color:#777;margin:0 0 16px;line-height:1.6"><span style="color:#777;">**Retained savings explanation: after the payment of your 5% deposit (plus any relevant stamp duty), the government allows you to retain up to 6 months of living expenses AND up to 6 months of scheduled loan repayments.</span></p>
      <p style="font-size:13px;color:#555;margin:0 0 16px"><span style="color:#555;">Further information: <a href="https://firsthomebuyers.gov.au/australian-government-5-percent-deposit-scheme" style="color:#2DBEFF">firsthomebuyers.gov.au/australian-government-5-percent-deposit-scheme</a></span></p>` +
      card('The Purchase',
        purchaseBlock({
          price: d.purchasePrice, duty: d.stampDuty, dutyLabel: dutyLabel(d),
          dutyText: d.stampDuty ? '' : '$0 — first home buyer exemption',
          loan: totalLending(d.splits), contribution: d.deposit, contributionFrom: d.depositSource,
        }) +
        row('LMI', 'Waived under Gov. Deposit Scheme')
      ) +
      p13(structureLead(realSplits(d.splits).length)) +
      splitCards(d, 'Owner-occupied loan', { termWithType: true }) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the particular features to match your goals — and that is exactly what we will do for you.') +
       notesBox(notes) + sig(b)

  } else if (template === 'bridging') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('Based on your current financial position, bridging finance is achievable for your next owner-occupied purchase.') +
      p('Bridging finance lets you buy your new home before your current one sells. Here is how it works: while you hold both properties, your bridging loan accrues interest at the rate below, but that interest is <strong>capitalised</strong> \u2014 added to your loan balance rather than paid month to month. When your existing property sells, the proceeds pay off that combined balance. Whatever is left over becomes your <strong>end debt</strong>: an ordinary home loan with regular repayments, which you will see broken out below.') +
      card('New Purchase Details',
        // NO "LOAN AMOUNT" ROW ON A BRIDGE. The lending here is two figures
        // with names of their own - the peak debt and the end debt - and the
        // first version of this printed the peak debt twice, once as "Loan
        // amount" and once under its real name. Two names for the same number is
        // not information; see lib/email-amounts.ts. Passing no loan leaves that
        // row out and the bridge keeps its own words.
        purchaseBlock({
          price: d.purchasePrice, duty: d.stampDuty, dutyLabel: dutyLabel(d),
          loan: '', contribution: d.deposit, contributionFrom: d.depositSource,
        }) +
        row('Bridging loan (peak debt)', money(d.splits?.[0]?.amount)) +
        row('End debt', money(d.splits?.[1]?.amount))
      ) +
      card('Loan 1 - Bridging Loan',
        row('Loan amount', money(d.splits?.[0]?.amount)) +
        row('Rate', (d.splits?.[0]?.rate || '') + '% p.a.*') +
        row('Interest treatment', 'Capitalised \u2014 no repayments during the bridging period') +
        row('Bridging period', (d.bridgingPeriod || '12') + ' months') +
        (d.splits?.[0]?.interestCapitalised ? row('Estimated interest capitalised', money(d.splits[0].interestCapitalised)) : '')
      ) +
      card('Loan 2 - End Debt (your ongoing repayments)',
        row('Loan amount', money(d.splits?.[1]?.amount)) +
        row('Indicative rate', (d.splits?.[1]?.rate || '') + '% p.a.*') +
        repaymentRow(d.splits?.[1], d.loanTerm) +
        row('Repayment type', `${d.splits?.[1]?.type || 'P&I'} over ${d.loanTerm || '30'} years`)
      ) +
      // The bridging loan and the end debt are written by hand - one capitalises
      // its interest, the other does not. A third split is an ordinary loan and
      // prints as one, rather than vanishing.
      splitCards(d, 'Additional lending', { from: 2, termWithType: true }) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right structure for your bridging scenario — and that is exactly what we will do for you.') +
      
      notesBox(notes) + sig(b)

  } else if (template === 'family_pledge') {
    // BOTH SPLITS, AND THE WHOLE LOAN AS THE HEADLINE. See pledgeLoan() above
    // for what this used to do and why it was wrong.
    const lending = totalLending(d.splits)
    const priceN = readMoney(d.purchasePrice) ?? 0
    const dutyN = readMoney(d.stampDuty) ?? 0
    // Purchase price plus stamp duty, the way the old email did it. The only
    // arithmetic on this template, and both figures are typed.
    const cost = priceN > 0 && dutyN > 0 ? priceN + dutyN : 0
    const guarantor = String(d.guarantorName || '').trim()

    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      (lending > 0 ? p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${money(lending)}</strong>.`) : '') +
      p(`When using ${guarantorPhrase(guarantor)} property as security you can borrow 100% of the purchase price. You would just need to contribute your own funds to cover stamp duty and costs.`) +
      p('Your application will be split into 2 loans.') +
      card('Your numbers would be',
        rowIf('Purchase price', money(d.purchasePrice)) +
        rowIf(dutyLabel(d), money(d.stampDuty)) +
        rowIf(`Total cost${PLUS_INCIDENTALS}`, cost > 0 ? money(cost) : '') +
        rowIf('Loan amount (borrowing 100% of the purchase price with a family security guarantee)', lending > 0 ? money(lending) : '') +
        rowIf('Your contribution required (coming from own savings)', money(d.deposit)) +
        rowIf('Guarantor', guarantor)
      ) +
      pledgeLoan('Loan 1', d.splits?.[0], d.loanTerm, PLEDGE_LOAN_1) +
      pledgeLoan('Loan 2', d.splits?.[1], d.loanTerm, PLEDGE_LOAN_2) +
      pledgeList('Pros of doing a family guarantee', PLEDGE_PROS, '#16a34a', '#F0FDF4', '#15803d', '&#10003;') +
      pledgeList('Cons of doing a family guarantee', PLEDGE_CONS, '#D97706', '#FFFBEB', '#92400E', '&bull;') +
      check(checkItems) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      p('Please let us know your thoughts and if you have any questions regarding the numbers.') +
      notesBox(notes) + sig(b)

  } else if (template === 'smsf') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('When looking at your numbers, your borrowing capacity is looking strong for an SMSF purchase.') +
      card('The Purchase',
        purchaseBlock({
          price: d.purchasePrice, duty: d.stampDuty, dutyLabel: dutyLabel(d),
          loan: totalLending(d.splits), contribution: d.deposit, contributionFrom: d.depositSource,
          lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment,
        }) +
        buildLVRLine(d, lmiIsInTheLoan(d))
      ) +
      p13(structureLead(realSplits(d.splits).length)) +
      splitCards(d, 'SMSF loan', { termWithType: true }) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender, the right rate, and the right SMSF structure for your investment — and that is exactly what we will do for you.') +
      
      notesBox(notes) + sig(b)

  } else if (template === 'construction') {
    // Every figure here used to read splits[0] and stop, so a land + construction
    // deal reported half the lending, four times the deposit and half the LVR.
    // lib/construction.ts holds the arithmetic and the reasoning.
    const cost = totalCost(d)
    const lending = totalLending(d.splits)
    const contribute = fundsToContribute(d, d.splits)
    const duringConstruction = repaymentDuringConstruction(d.splits)

    // One row per split, so the construction loan and its own rate and repayment
    // type are actually in the email. They never were.
    const splitLines = (d.splits || [])
      .filter((sp: any) => num(sp?.amount) > 0)
      .map((sp: any, i: number) => row(
        sp.label || `Split ${i + 1}`,
        `${money(num(sp.amount))} &nbsp;\u00b7&nbsp; ${sp.rate || ''}% &nbsp;\u00b7&nbsp; ${sp.type || 'P&I'}`,
      )).join('')

    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your total lending is sitting at around <strong>${amt(lending > 0 ? fmtNum(lending) : '', '[amount]')}</strong>.`) +
      card('Your Loan Structure',
        row('Land value', money(d.landValue)) +
        row('Construction cost', money(d.constructionCost)) +
        row(dutyLabel(d), money(d.stampDuty)) +
        `<tr style="border-top:1px solid #CEBEAB"><td style="font-size:12px;font-weight:600;color:#343333;padding-top:6px"><span style="color:#343333;">Total cost</span></td><td style="font-size:12px;font-weight:600;color:#343333;text-align:right;padding-top:6px"><span style="color:#343333;">${money(cost)}</span></td></tr>` +
        row('"As if complete" valuation', money(d.asIfCompleteValue)) +
        splitLines +
        row('Total lending', money(lending)) +
        // Not "deposit". It is cash found across the land settlement and the
        // build, not a deposit on a purchase. Fabio, 2 Sep 2026.
        row(`Funds you need to contribute${PLUS_INCIDENTALS}`, money(contribute)) +
        buildLVRLine(d) +
        // Left out entirely when nobody has typed a repayment, rather than
        // mailing a client "$0 / month".
        (duringConstruction > 0
          ? row('Repayments during construction', money(duringConstruction) + ' / month') +
            `<tr><td colspan="2" style="font-size:11px;color:#7a5c3a;font-style:italic;line-height:1.5;padding:8px 0 0"><span style="color:#7a5c3a;">${DRAWDOWN_NOTE}</span></td></tr>`
          : '')
      ) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('The next step is finding the right lender and construction loan structure for your project \u2014 and we will guide you through every step of that process.') +
      notesBox(notes) + sig(b)

  } else if (template === 'investment_equity') {
    const npPrice   = d.newPurchasePrice     || d.purchasePrice || ''
    const npStamp   = d.newPurchaseStampDuty || d.stampDuty     || ''
    const npDeposit = d.newPurchaseDeposit   || d.equityRelease || d.deposit || ''
    const existingLoanCol = `
      <p style="font-size:12px;font-weight:600;color:#343333;margin:0 0 6px"><span style="color:#343333;">Existing loan refinanced</span></p>
      <p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">Loan amount: ${money(d.splits?.[0]?.amount) || ''}</span></p>
      <p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">Indicative rate: ${d.splits?.[0]?.rate || ''}% p.a.*</span></p>
      ${lineIf('Estimated repayments', repaymentOf(d.splits?.[0], d.loanTerm))}
      <p style="font-size:11px;color:#555;margin:2px 0 10px"><span style="color:#555;">Repayment type: ${d.splits?.[0]?.type || 'P&I'} over ${d.loanTerm || '30'} years</span></p>
      <p style="font-size:12px;font-weight:600;color:#343333;margin:0 0 6px"><span style="color:#343333;">Equity access</span></p>
      <p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">Loan amount: ${money(d.splits?.[1]?.amount) || ''}</span></p>
      <p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">Indicative rate: ${d.splits?.[1]?.rate || ''}% p.a.*</span></p>
      ${lineIf('Estimated repayments', repaymentOf(d.splits?.[1], d.loanTerm))}
      <p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">Repayment type: ${d.splits?.[1]?.type || 'P&I'} over ${d.loanTerm || '30'} years</span></p>`
    const newPurchaseCol = `
      <p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">Loan amount: ${money(d.splits?.[2]?.amount) || ''}</span></p>
      <p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">Indicative rate: ${d.splits?.[2]?.rate || ''}% p.a.*</span></p>
      ${lineIf('Estimated repayments', repaymentOf(d.splits?.[2], d.loanTerm))}
      <p style="font-size:11px;color:#555;margin:2px 0"><span style="color:#555;">Repayment type: ${d.splits?.[2]?.type || 'P&I'} over ${d.loanTerm || '30'} years</span></p>`

    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p('We have now finalised your review as you are looking at purchasing an owner-occupied/investment property.') +
      p('We would use equity in your owner-occupied/investment property to help fund the deposit plus stamp duty costs.') +
      p('A second loan will be set up against your new purchase, so all properties are stand alone — these are two separate securities, not cross-collateralised.') +
      p(`Provided you are ok to use equity, we could look at a purchase price of <strong>${amt(npPrice, '[amount]')}</strong>.`) +
      p13('Your numbers would be:') +
      card('Summary',
        purchaseBlock({
          price: npPrice, duty: npStamp, dutyLabel: dutyLabel(d),
          loan: d.splits?.[2]?.amount, contribution: npDeposit,
          contributionFrom: 'equity release and personal savings',
        })
      ) +
      p13('Below is a breakdown of the structure:') +
      `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px"><tr>
        <td width="50%" bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px;border:1px solid #e5ddc8;vertical-align:top">
          <p style="font-size:12px;font-weight:700;color:#343333;margin:0 0 10px"><span style="color:#343333;">&#127968; Against ${d.suburb || '[Existing Property]'}</span></p>
          ${existingLoanCol}
        </td>
        <td width="50%" bgcolor="#F2E8DB" style="background:#F2E8DB;padding:14px;border:1px solid #e5ddc8;vertical-align:top">
          <p style="font-size:12px;font-weight:700;color:#343333;margin:0 0 10px"><span style="color:#343333;">&#127968; Against new purchase</span></p>
          ${newPurchaseCol}
        </td>
      </tr></table>` +
      // Three columns are written by hand because each sits against a different
      // security. A fourth split belongs to neither and used to disappear.
      splitCards(d, 'Additional lending', { from: 3, termWithType: true }) +
      ctas(b.calendly, dealId ? `https://simplify-finance-portal.vercel.app/proceed/${dealId}?from=BC` : undefined) +
      check(checkItems) +
      p('Please let us know your thoughts and if you have any questions regarding the numbers above.') +
      p('The next step is to collect your documentation so we can look at specific lenders and interest rates.') +
       notesBox(notes) + sig(b)

  } else if (template === 'custom') {
    body = heading() + brokerBox(personalisation, d.firstName, d.jointFirstName, d.joint) +
      p(`When looking at your numbers, your borrowing capacity is sitting at around <strong>${amt(d.splits?.[0]?.amount, '[amount]')}</strong>.`) +
      card('The Purchase',
        purchaseBlock({
          price: d.purchasePrice, duty: d.stampDuty, dutyLabel: dutyLabel(d),
          loan: totalLending(d.splits), contribution: d.deposit, contributionFrom: d.depositSource,
          lmiApplicable: d.lmiApplicable, lmi: d.lmi, lmiTreatment: d.lmiTreatment,
        }) +
        buildLVRLine(d, lmiIsInTheLoan(d))
      ) +
      p13(structureLead(realSplits(d.splits).length)) +
      splitCards(d, 'Your loan', { termWithType: true }) +
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
