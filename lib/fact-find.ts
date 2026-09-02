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
      // of somebody who has told us they do not work.
      if (notWorking(e)) continue
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
