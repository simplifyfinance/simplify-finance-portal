// THE PROPERTIES AND LIABILITIES BLOCK AT THE BOTTOM OF A CLIENT EMAIL.
//
// Fabio, 24 Sep 2026, on Ravi Kishore: "see the properties details are not being
// wired to html templates...we had this issue fixed before."
//
// It was fixed before - f6da7d9, back in September - and then it sat inside
// BCForm.tsx with no test on it and quietly went thin. Ravi's email carried two
// facts out of eleven: the address and a balance. The value, the rate, the
// repayment, the repayment type, the rate type, the term and the status were all
// collected, all stored, and all dropped on the way to the client.
//
// THE STATUS DROPDOWN HAD NEVER PRINTED. NOT ONCE.
//
// statusBadge was written for LIABILITIES - "To be closed", "To be refinanced",
// "To be consolidated" - and pointed at property loans as well. A property loan
// cannot be set to any of those three; its options are "Ongoing", "Refinance"
// and "To be paid out". Nothing matched, so every one came out blank, and a
// client being refinanced out of a loan or paying one out at settlement was
// never told so. The liabilities underneath worked the whole time, which is
// exactly why it looked like it worked.
//
// So it lives here now, out of the form, with a test on every line it prints.

import { money as fmt, readMoney } from './money'
import { isSavings } from './fact-find-options'

const txt = (v: any) => String(v ?? '').trim()
const money = (v: any) => fmt(v)

// --- the words ---------------------------------------------------------------

// Fabio, 24 Sep 2026: "rent is always whatever the fact find says if weekly then
// weekly etc". It printed "/week" whatever was recorded, so a rent extracted
// from a fact find as monthly went out as a weekly figure - four times the real
// number, in writing, to a client.
const PER: Record<string, string> = {
  weekly: 'per week',
  fortnightly: 'per fortnight',
  monthly: 'per month',
  quarterly: 'per quarter',
  annually: 'per year',
  yearly: 'per year',
}

export function per(frequency: any, fallback: string): string {
  return PER[txt(frequency).toLowerCase()] || fallback
}

// What happens to this property. Only ever printed when it is NOT "Ongoing" -
// Fabio, 24 Sep 2026: "add future use IF and only IF anything BUT ongoing".
// A property carrying on as it is says nothing, because that is not news.
const FUTURE: Record<string, string> = {
  'to be sold': 'To be sold',
  'will become investment': 'Will become an investment after settlement',
  'will become owner occupied': 'Will become owner occupied after settlement',
}

export function futureUseLine(futureUse: any): string {
  const key = txt(futureUse).toLowerCase()
  if (!key || key === 'ongoing') return ''
  return FUTURE[key] || txt(futureUse)
}

// --- the badge ---------------------------------------------------------------

const BADGE: Record<string, string> = {
  // A PROPERTY LOAN. These three are the whole dropdown, and none of them were
  // recognised before today.
  'Ongoing': 'background:#EFEFED;color:#6B6B63',
  'Refinance': 'background:#D1FAE5;color:#065F46',
  'To be paid out': 'background:#FEF3C7;color:#92400E',
  // A LIABILITY. Unchanged. "Remain open" stays deliberately blank, as it has
  // since this was written - it is the do-nothing answer on that list and
  // badging it would put a chip on every credit card on the file.
  'To be closed': 'background:#FEF3C7;color:#92400E',
  'To be refinanced': 'background:#D1FAE5;color:#065F46',
  'To be consolidated': 'background:#DBEAFE;color:#1E40AF',
}

export function statusBadge(status: any): string {
  const s = txt(status)
  const style = BADGE[s]
  if (!style) return ''
  return ` <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;${style}">${s}</span>`
}

// --- a loan's terms ----------------------------------------------------------

// "6.04% variable, principal and interest, $2,499 per month"
//
// Built from whatever is actually recorded. A box left empty contributes
// nothing - no "$0", no "not recorded", no dangling comma. The interest only
// expiry is deliberately absent: Fabio, 24 Sep 2026, "Interest only expires -
// DONT PRINT".
export function loanTermsLine(loan: any): string {
  const bits: string[] = []

  const rate = txt(loan?.interestRate)
  const rateType = txt(loan?.rateType).toLowerCase()
  if (rate) bits.push(`${rate}%${rateType ? ` ${rateType}` : ''}`)
  else if (rateType) bits.push(rateType)

  const repaymentType = txt(loan?.repaymentType).toLowerCase()
  if (repaymentType) bits.push(repaymentType)

  const repayment = money(loan?.repaymentAmount)
  if (repayment) bits.push(`${repayment} ${per(loan?.repaymentFrequency, 'per month')}`)

  if (!bits.length) return ''
  const line = bits.join(', ')
  return line.charAt(0).toUpperCase() + line.slice(1)
}

// "30 years remaining". Its own line, because four facts on one line stops being
// a sentence.
export function loanTermLine(loan: any): string {
  const years = Number(txt(loan?.remainingLoanTermYears))
  if (!Number.isFinite(years) || years <= 0) return ''
  return `${years} ${years === 1 ? 'year' : 'years'} remaining`
}

// WHAT THE CLIENT IS TOLD THEY OWE.
//
// This printed `Balance $${fmtMoney(loan.balance)}`, and fmtMoney turned
// anything missing - or anything with a comma in it - into the string "0".
// Alexis Janes has eight mortgages recorded by LIMIT with the balance box left
// empty, so the email that went to her said "Balance $0" eight times against
// half a million dollars of debt apiece.
//
// A figure that is not recorded is not zero. Say which figure it is, and if
// there is neither, say nothing about the money at all.
export function loanFigure(loan: any): string {
  // A ZERO IS NOT A BALANCE. money('0') is "$0", and "$0" is a claim - it tells
  // a client they owe nothing on a loan recorded by limit. Anything that is not
  // a positive figure counts as not recorded.
  const has = (v: any) => { const n = readMoney(v); return n !== null && n > 0 }
  if (has(loan?.balance)) return `Balance ${money(loan.balance)}`
  if (has(loan?.limitAmount)) return `Limit ${money(loan.limitAmount)}`
  return ''
}

// --- ownership ---------------------------------------------------------------

export function ownersByPercent(ownership: any, applicants: any[]): string {
  if (!ownership) return ''
  return (applicants || [])
    .filter(a => (Number(ownership[a.id]) || 0) > 0)
    .map(a => txt(a.firstName) || 'Applicant').join(', ')
}

export function ownersByCheckbox(ownership: any, applicants: any[]): string {
  if (!ownership) return ''
  return (applicants || [])
    .filter(a => ownership[a.id] === 'Yes')
    .map(a => txt(a.firstName) || 'Applicant').join(', ')
}

export function freqLabel(freq: any): string {
  const f = txt(freq).toLowerCase()
  if (f === 'weekly') return 'week'
  if (f === 'fortnightly') return 'fortnight'
  return 'month'
}

// --- the block itself --------------------------------------------------------

type Line = { text: string; deep?: boolean }

function subBlock(lines: Line[]): string {
  if (!lines.length) return ''
  return `<div style="border-left:2px solid #d8c9a8;margin:4px 0 0 8px;padding-left:10px">` +
    // THE COLOUR GOES ON A SPAN, NOT ON THE PARAGRAPH.
    //
    // Word keeps a text colour on a run and drops one on a paragraph, so a <p>
    // with a colour on it arrives black - which is how Kylie's disclaimer came
    // through black on charcoal. Same rule the rest of the email follows, and
    // scripts/check-email-html.sh refuses to ship without it.
    lines.map(l => {
      const colour = l.deep ? '#8a8375' : '#666'
      return `<p style="font-size:12px;color:${colour};margin:2px 0${l.deep ? ';padding-left:12px' : ''}">`
        + `<span style="color:${colour};">${l.text}</span></p>`
    }).join('') +
    `</div>`
}

const moneyOrBlank = (v: any) => money(v) || ''

export function propertyChecklist(ff: any): string[] {
  const items: string[] = []
  const applicants = ff?.applicants || []
  const properties = ff?.properties || []
  const liabilities = ff?.liabilities || []
  const assets = ff?.assets || []

  // WHAT THEY HAVE, BEFORE WHAT THEY OWN AND WHAT THEY OWE.
  //
  // 29 Oct 2026. Savings is the asset the deposit comes out of and the one the
  // client is about to be asked to evidence, and it has never appeared in the
  // email that tells them what their numbers are. The rest of the assets stay
  // out: nobody needs their own car read back to them on a lending email.
  //
  // ONE LINE PER ACCOUNT, because two accounts is two statements to produce.
  // The total only where there is more than one - on a single account it would
  // be the same figure twice.
  const savings = assets.filter((a: any) => isSavings(a?.assetType) && readMoney(a?.value))
  if (savings.length) {
    const lines: Line[] = savings.map((a: any) => ({
      text: [txt(a?.description), money(a?.value)].filter(Boolean).join(' \u2014 '),
    }))
    if (savings.length > 1) {
      const total = savings.reduce((t: number, a: any) => t + (readMoney(a?.value) || 0), 0)
      lines.push({ text: `Total ${money(total)}` })
    }
    items.push('<strong>Savings</strong>' + subBlock(lines))
  }

  for (const prop of properties) {
    const owners = ownersByPercent(prop?.ownership, applicants)
    const isInvestment = txt(prop?.ownershipType) === 'Investment'
    const typeParts = [txt(prop?.propertySubtype), txt(prop?.zoning)].filter(Boolean).join(', ')
    const header = `<strong>${txt(prop?.address) || 'Property'}</strong>`
      + (typeParts ? ` — ${typeParts}` : '')
      + ` (${txt(prop?.ownershipType) || 'Owner occupied'})`

    const lines: Line[] = []

    // Value and rent on one line - they are read against each other.
    const headline: string[] = []
    const value = money(prop?.value)
    if (value) headline.push(`Value ${value}`)
    if (isInvestment && money(prop?.rentalIncome)) {
      headline.push(`${headline.length ? 'rental income' : 'Rental income'} ${money(prop.rentalIncome)} ${per(prop?.rentalIncomeFrequency, 'per week')}`)
    }
    if (headline.length) lines.push({ text: headline.join(' · ') })

    const future = futureUseLine(prop?.futureUse)
    if (future) lines.push({ text: `<strong>${future}</strong>` })

    if (owners) lines.push({ text: `Owned by: ${owners}` })

    for (const loan of (prop?.loans || [])) {
      const figure = loanFigure(loan)
      // An untouched row is not a loan. Nothing to say about it.
      if (!txt(loan?.lenderName) && !figure) continue
      lines.push({ text: `Linked loan: ${txt(loan?.lenderName) || 'Lender'}${figure ? ` — ${figure}` : ''}${statusBadge(loan?.status)}` })
      const terms = loanTermsLine(loan)
      if (terms) lines.push({ text: terms, deep: true })
      const term = loanTermLine(loan)
      if (term) lines.push({ text: term, deep: true })
    }

    items.push(header + subBlock(lines))
  }

  // A LABEL WITH NOTHING AFTER IT IS NOT A LINE.
  //
  // 29 Oct 2026. This block used to read "LIABILITIES ARE UNCHANGED. They
  // worked, and nothing was asked of them." They did not work: a credit card
  // with no limit recorded sent a client the word "Limit" and white space, and
  // a car loan with no figures sent "Repayment /monthly, Balance".
  //
  // Each part is now built only where there is something to say, and a line
  // with no parts is not pushed. The liability still appears - it exists, and
  // leaving a debt off a credit document to tidy a layout is not a trade worth
  // making. What goes is the empty label, not the fact.
  for (const liab of liabilities) {
    const owners = ownersByCheckbox(liab?.ownership, applicants)
    const header = `<strong>${txt(liab?.liabilityType)}</strong>${statusBadge(liab?.status)}`
    const lines: Line[] = []
    const type = txt(liab?.liabilityType)

    /** "Limit $20,000", or nothing at all. */
    const part = (label: string, v: any) => {
      const money = moneyOrBlank(v)
      return money ? `${label} ${money}`.trim() : ''
    }
    /** A repayment carries its frequency, and neither half stands alone. */
    const repayment = () => {
      const money = moneyOrBlank(liab?.repaymentAmount)
      if (!money) return ''
      const freq = freqLabel(liab?.repaymentFrequency)
      return freq ? `Repayment ${money}/${freq}` : `Repayment ${money}`
    }
    /** One line from whichever parts exist, or no line. */
    const line = (...parts: string[]) => {
      const real = parts.filter(Boolean)
      if (real.length) lines.push({ text: real.join(', ') })
    }

    if (type === 'Credit card') {
      line(part('Limit', liab?.limitAmount))
    } else if (type === 'Buy now pay later') {
      // Assessed on the limit like a card, but the repayment is often a fixed
      // instalment and gets asked about, so both are on the line.
      line(part('Limit', liab?.limitAmount), part('Balance', liab?.balance))
      line(repayment())
    } else if (type === 'HECS') {
      line(part('Balance', liab?.balance))
    } else if (type === 'Health Insurance') {
      // No label on this one - the figure and its frequency are the whole line.
      const money = moneyOrBlank(liab?.repaymentAmount)
      const freq = freqLabel(liab?.repaymentFrequency)
      line(money ? (freq ? `${money}/${freq}` : money) : '')
    } else {
      line(repayment(), part('Balance', liab?.balance))
    }
    if (owners) lines.push({ text: `Owned by: ${owners}` })
    items.push(header + subBlock(lines))
  }

  return items
}
