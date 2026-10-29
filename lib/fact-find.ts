// What the Fact Find document says, and what it does NOT ask for.
//
// A "still to confirm" list that flags things you have already answered is worse
// than no list at all - people stop reading it. Fabio, 2 Sep 2026: "we marked
// Natasha as not employed so why asking that questions missing employment???"
//
// So the rule here is the rule the form itself follows: if the form does not ask
// for a field given the answers already given, this does not call it missing.

import { readMoney, annualise } from './money'

export function notWorking(emp: any): boolean {
  return String(emp?.employmentType || '').trim().toLowerCase() === 'not working'
}
export function selfEmployed(emp: any): boolean {
  return String(emp?.employmentType || '').trim().toLowerCase() === 'self-employed'
}

export function currentEmployment(applicant: any): any[] {
  return (applicant?.employment || []).filter((e: any) => e?.isCurrent)
}
export function currentAddress(applicant: any): any {
  return (applicant?.addresses || []).find((a: any) => a?.isCurrent) || null
}

export function fullName(a: any): string {
  return [a?.firstName, a?.lastName].map((x: any) => String(x || '').trim()).filter(Boolean).join(' ')
}

// Age from a date of birth, in whatever order it was typed. Returns null rather
// than a wrong number when the date cannot be read.
// EVERY DATE AS dd/mm/yyyy.
//
// These values are copied out of the handover and pasted into SalesTrekker, so
// a date has to arrive as a date and nothing else. Fabio, 2 Sep 2026: "dates
// should be dd/mm/yyyy no works 'from' or 'age' as this wont work copy na dpast
// into system".
//
// The forms store dates two ways - "1984-11-02" from a date picker and
// "02/11/1984" typed by hand - and some fields only ever held a month and a
// year ("Mar 2019"). A full date is normalised; anything else is handed back
// untouched, because inventing a day of the month would be worse than leaving
// the month as written.
export function dateAU(v: any): string {
  const raw = String(v ?? '').trim()
  if (!raw) return ''
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const au = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (au) return `${au[1].padStart(2, '0')}/${au[2].padStart(2, '0')}/${au[3]}`
  return raw
}

// TWO YEARS OF HISTORY, whatever it consists of.
//
// A lender wants THREE YEARS of address history and three years of employment
// history. A period of NOT WORKING counts towards it - it is history, it is just
// not a job - and until 3 Sep 2026 the form hid the dates on a not-working entry
// entirely, so those applicants sat permanently at "0 months recorded" with no
// way to answer it.
//
// THIS WAS 24 UNTIL 27 OCT 2026, AND THAT WAS WRONG. Catherine, Operations
// Manager, listing what keeps coming back from credit: "Residential address
// history for the last 3 years... Employment history for the last 3 years."
// Fabio, the same day: "36 is hardcore so change the fact find as it is today
// with only 24."
//
// WHAT THE OLD NUMBER COST. The warning switched off at 24 months, so a file
// with 25 months of history read as finished on the fact find and then came
// back from credit a year short. Nobody was told anything untrue - the screen
// said exactly what it had been built to say, and what it had been built to say
// was two years.
//
// These two live here rather than inside the form because the still-to-confirm
// list has to agree with the warning on screen. Two copies of a calculation is
// two places for it to disagree.
export const REQUIRED_HISTORY_MONTHS = 36

export function monthsBetween(start: any, end: any, today = new Date()): number {
  const from = String(start ?? '').trim()
  if (!from) return 0
  const s = new Date(from)
  const e = String(end ?? '').trim() ? new Date(String(end)) : today
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  return Math.max(0, months)
}

export function totalHistoryMonths(
  entries: { isCurrent?: boolean; startDate?: string; endDate?: string }[] | null | undefined,
  today = new Date(),
): number {
  return (entries || []).reduce(
    (sum, e) => sum + monthsBetween(e?.startDate, e?.isCurrent ? '' : (e?.endDate || ''), today), 0)
}

// A GAP IN THE MIDDLE IS INVISIBLE TO AN ADDITION.
//
// 27 Oct 2026. totalHistoryMonths() above adds the periods up, so three years
// of history with four months missing in the middle comes to thirty-two and
// reads as "short by four" - and four months missing between two jobs is not
// the same problem as four months missing off the back. A lender asks about a
// gap. Nothing in the portal could see one.
//
// Fabio: "fix the gap between 2 jobs".
//
// THE WINDOW MATTERS. A gap in 2015 is nobody's business. Only holes inside the
// last three years are looked for, because that is the only stretch anybody is
// being asked to account for.
//
// AND A HOLE AT THE END COUNTS TOO. Nothing current recorded, and the most
// recent thing ended in March, is a gap running to today - and it is the one
// most likely to be a real answer nobody has written down ("she stopped work in
// March").
//
// A HOLE AT THE START DEPENDS ON WHETHER THERE IS ENOUGH HISTORY.
//
// Short of three years, the earliest stretch IS the shortfall and saying it
// twice helps nobody - the total already says "32 of the 36 a lender needs".
//
// But a job from 2015 and a job from last year add up to eighty months, so the
// shortfall warning says nothing at all, and the three months at the start of
// the window are a real hole a lender will ask about. I missed that in my own
// check of this function and only found it by printing the cases out.
export type HistoryGap = { from: Date; to: Date; months: number }

export function gapsInHistory(
  entries: { isCurrent?: boolean; startDate?: string; endDate?: string }[] | null | undefined,
  today = new Date(),
  windowMonths = REQUIRED_HISTORY_MONTHS,
): HistoryGap[] {
  const start = new Date(today.getFullYear(), today.getMonth() - windowMonths, 1)
  const end = new Date(today.getFullYear(), today.getMonth(), 1)

  // EVERY PERIOD AS REAL DATES FIRST. A period with no start date cannot be
  // placed and is left out rather than guessed at.
  const periods: [Date, Date][] = []
  for (const e of entries || []) {
    const from = String(e?.startDate ?? '').trim()
    if (!from) continue
    const s = new Date(from)
    if (isNaN(s.getTime())) continue
    const rawEnd = e?.isCurrent ? '' : String(e?.endDate ?? '').trim()
    const t = rawEnd ? new Date(rawEnd) : today
    if (isNaN(t.getTime())) continue
    periods.push([s, t])
  }

  // THEN THE JOINS ARE CLOSED, IN DAYS, BEFORE ANYTHING BECOMES A MONTH.
  //
  // 29 Oct 2026. Moving out on the 31st and in on the 1st is one move, and the
  // day between them is not a month unaccounted for. Months are the right unit
  // for REPORTING a gap and the wrong one for deciding whether there is one:
  // 31 December and 1 January fall in different months and are a day apart.
  //
  // Only the joins are closed. An address held until 3 March beside one
  // starting 3 July is still four months short, and still says so.
  periods.sort((x, y) => x[0].getTime() - y[0].getTime())
  const joined: [Date, Date][] = []
  for (const [s, t] of periods) {
    const last = joined[joined.length - 1]
    if (last && daysBetween(last[1], s) <= MOVING_DAYS) {
      if (t.getTime() > last[1].getTime()) last[1] = t
    } else joined.push([s, t])
  }

  // AND ONLY NOW, MONTHS. Clipped to the window.
  const spans: [number, number][] = []
  for (const [s, t] of joined) {
    const a = Math.max(months(start, s), 0)
    const b = Math.min(months(start, t), months(start, end))
    if (b > a) spans.push([a, b])
    // A period recorded with the same month in and out still covers that month.
    else if (b === a && b >= 0) spans.push([a, a + 1])
  }
  if (!spans.length) return []

  // Merge what overlaps, then the holes are what is left between them.
  spans.sort((x, y) => x[0] - y[0])
  const merged: [number, number][] = [spans[0]]
  for (const [a, b] of spans.slice(1)) {
    const last = merged[merged.length - 1]
    if (a <= last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }

  const out: HistoryGap[] = []
  // See the note above: only where there is already enough history, so the
  // shortfall and the gap never say the same thing twice.
  if (merged[0][0] > 0 && totalHistoryMonths(entries, today) >= windowMonths) {
    out.push(gap(start, 0, merged[0][0]))
  }
  for (let i = 1; i < merged.length; i++) {
    const a = merged[i - 1][1]
    const b = merged[i][0]
    if (b > a) out.push(gap(start, a, b))
  }
  const lastCovered = merged[merged.length - 1][1]
  const upToNow = months(start, end)
  if (upToNow > lastCovered) out.push(gap(start, lastCovered, upToNow))
  return out
}

/**
 * HOW LONG ANYBODY IS ALLOWED TO TAKE MOVING HOUSE.
 *
 * A fortnight. Longer than the day most leases join on, short enough that a
 * month nobody can account for is still a month nobody can account for. Out on
 * the 31st and in on the 1st is one day; out in March and in in July is 122.
 */
const MOVING_DAYS = 14

/** Whole days from one date to the next. Negative where they overlap. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function months(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

function gap(start: Date, a: number, b: number): HistoryGap {
  return {
    from: new Date(start.getFullYear(), start.getMonth() + a, 1),
    to: new Date(start.getFullYear(), start.getMonth() + b, 1),
    months: b - a,
  }
}

/**
 * "March 2024 and July 2024". The two months a person would say out loud.
 *
 * AND IT READS AS "BETWEEN X AND Y", not "between X to Y". Every place this is
 * printed puts the word "between" in front of it - the warning on the form and
 * the question to the client both do - and "between March and July" is how
 * somebody says it. I wrote "to" first and both sentences came out wrong.
 */
export function gapInWords(g: HistoryGap): string {
  const say = (d: Date) => d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  return `${say(g.from)} and ${say(g.to)}`
}

export function ageFrom(dob: any, today = new Date()): number | null {
  const raw = String(dob || '').trim()
  let d: Date | null = null
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (!d) {
    m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)      // Australian: day first
    if (m) d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]))
  }
  if (!d || isNaN(d.getTime())) return null
  let age = today.getUTCFullYear() - d.getUTCFullYear()
  const before = today.getUTCMonth() < d.getUTCMonth()
    || (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate())
  if (before) age -= 1
  return age >= 0 && age < 130 ? age : null
}

// Everything one applicant earns, in a year.
export function annualIncome(applicant: any): number {
  return (applicant?.income || []).reduce((total: number, inc: any) => {
    const parts = [
      annualise(inc?.grossSalary, inc?.grossSalaryFrequency),
      annualise(inc?.bonusAmount, inc?.bonusFrequency),
      annualise(inc?.overtimeEssentialAmount, inc?.overtimeEssentialFrequency),
      annualise(inc?.overtimeNonEssentialAmount, inc?.overtimeNonEssentialFrequency),
      annualise(inc?.commissionAmount, inc?.commissionFrequency),
      annualise(inc?.allowanceAmount, inc?.allowanceFrequency),
      annualise(inc?.otherIncomeAmount, 'annually'),
    ]
    return total + parts.reduce<number>((t, p) => t + (p ?? 0), 0)
  }, 0)
}

export type Position = { income: number; assets: number; liabilities: number; net: number }

export function position(ff: any): Position {
  // Everything here is `any` off a jsonb blob, so the accumulators are typed by
  // hand rather than inferred.
  const add = (rows: any[], value: (r: any) => number): number =>
    (rows || []).reduce((t: number, r: any) => t + value(r), 0)

  const income = add(ff?.applicants, (a: any) => annualIncome(a))
  const otherAssets = add(ff?.assets, (a: any) => readMoney(a?.value) ?? 0)
  const propertyValue = add(ff?.properties, (p: any) => readMoney(p?.value) ?? 0)
  const propertyLoans = add(ff?.properties, (p: any) => add(p?.loans, (l: any) => readMoney(l?.balance) ?? 0))
  const otherDebt = add(ff?.liabilities, (l: any) => readMoney(l?.balance) ?? 0)
  const assets = otherAssets + propertyValue
  const liabilities = propertyLoans + otherDebt
  return { income, assets, liabilities, net: assets - liabilities }
}

// --- what is genuinely still to confirm -------------------------------------

export function stillToConfirm(deal: any): string[] {
  const ff = deal?.fact_find_data || {}
  const bc = deal?.bc_data || {}
  const out: string[] = []

  for (const a of (ff.applicants || [])) {
    const who = fullName(a) || 'An applicant'
    if (!String(a?.dob || '').trim()) out.push(`${who} — date of birth`)
    if (!String(a?.phoneMobile || '').trim() && !String(a?.emailPersonal || '').trim()) {
      out.push(`${who} — no phone or email`)
    }

    const addr = currentAddress(a)
    if (!addr) out.push(`${who} — no current address`)
    else {
      const status = String(addr.residentialStatus || '').trim()
      if (!status) out.push(`${who} — residential status of the current address`)
      // Only renting and boarding have a housing expense. An owner is not asked.
      const rents = /rent|board/i.test(status)
      if (rents && readMoney(addr.housingExpenseAmount) === null) {
        out.push(`${who} — housing expense on the current address`)
      }
    }

    const jobs = currentEmployment(a)
    if (jobs.length === 0) { out.push(`${who} — no current employment recorded`); continue }
    for (const e of jobs) {
      // Not working is an ANSWER. No employer, no basis and no income are asked
      // of somebody who has told us they do not work - but the DATE still is,
      // because two years of history has to add up whatever it is made of.
      if (notWorking(e)) {
        if (!String(e.startDate || '').trim()) out.push(`${who} — the date they stopped working`)
        continue
      }
      if (!String(e.startDate || '').trim()) out.push(`${who} — employment start date`)
      if (!String(e.occupation || '').trim()) out.push(`${who} — occupation`)
      if (selfEmployed(e)) {
        if (!String(e.employerName || '').trim() && !(a.income || []).some((i: any) => String(i?.seBusinessName || '').trim())) {
          out.push(`${who} — business name`)
        }
      } else {
        if (!String(e.employerName || '').trim()) out.push(`${who} — employer`)
        if (!String(e.employmentBasis || '').trim()) out.push(`${who} — employment basis`)
      }
      if (annualIncome(a) === 0) out.push(`${who} — no income recorded against a current job`)
    }

    // The 24-month total is deliberately NOT repeated here. The fact find already
    // warns about it in amber, on the same screen, right under the entries it is
    // counting - and a list that repeats a warning somebody is already looking at
    // is a list people stop reading. What this list adds is the missing DATE,
    // which is the thing that makes the total wrong in the first place.
  }

  // The BC is only asked about the figures its own template uses.
  const t = String(bc.template || '')
  const purchase = /purchase|fhb|construction|bridging|investment_equity/.test(t)
  const refinance = t.startsWith('refinance')
  if (purchase && readMoney(bc.purchasePrice) === null && readMoney(bc.newPurchasePrice) === null) out.push('BC — purchase price')
  if (purchase && readMoney(bc.deposit) === null && readMoney(bc.newPurchaseDeposit) === null) out.push('BC — deposit')
  if (purchase && readMoney(bc.stampDuty) === null && readMoney(bc.newPurchaseStampDuty) === null) out.push('BC — stamp duty')
  if (refinance && readMoney(bc.existingLoanBal) === null) out.push('BC — existing loan balance')
  if (refinance && readMoney(bc.propertyValue) === null) out.push('BC — property value')

  return [...new Set(out)]
}
