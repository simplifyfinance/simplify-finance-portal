// WHAT A LINE ON A PAYSLIP ACTUALLY IS.
//
// 28 Oct 2026. The second half of the payslip job. lib/annualise-income.ts does
// the arithmetic; this decides what it is doing the arithmetic TO.
//
// NO AUSTRALIAN PAYSLIP LOOKS LIKE ANY OTHER. Fabio: "most payslips in
// Australia are very different." The same money is "Ordinary Hours" at one
// employer, "Base - Salaried" at the next and "NORM" at the third. Nothing can
// match on an exact name.
//
// WHY THIS IS CODE AND NOT LEFT TO THE READER MODEL. The route reads a PDF and
// comes back with labels and figures, and that is all it is trusted with. What
// a label MEANS changes the number: a bonus called income is annualised and
// claims four times what was paid. A model that classifies is a model that can
// classify differently next Tuesday on the same payslip, with no test failing
// and nobody told. This file is the judgement, it is the same every time, and
// the tests below say what it is.
//
// THREE DECISIONS PER LINE, AND ONLY THREE:
//
//   WHICH BUCKET   base, allowance, overtime, commission, bonus, other.
//                  lib/annualise-income.ts never shades base or allowances,
//                  so putting a line in the wrong one of those two moves money
//                  into the 100% column and leaves it there.
//   PAID ONCE      a bonus, back pay, a leave payout. Taken at what was paid
//                  and never multiplied out.
//   NOT INCOME     money handed back, money withheld, money that was never
//                  theirs. Out of both columns.
//
// AND WHEN IT DOES NOT KNOW IT SAYS SO. `recognised: false` is not a failure,
// it is the honest answer for "Site Uplift 7B", and the screen puts those in
// front of a person rather than quietly folding them into a total.
import type { LineKey } from './annualise-income'

export type Seen = {
  key: LineKey
  oneOff: boolean
  notIncome: boolean
  /** False where the label matched nothing known. Shown, never hidden. */
  recognised: boolean
}

type Rule = { test: RegExp; key: LineKey; oneOff?: boolean; notIncome?: boolean }

/**
 * ORDER IS THE WHOLE DESIGN. First match wins, so the specific sits above the
 * general: "annual leave payout" is a one-off and must be read before "annual
 * leave", which is ordinary pay. Moving a rule down this list changes what
 * money means.
 */
const RULES: Rule[] = [
  // ─── NOT INCOME ─────────────────────────────────────────────────────────
  // Read first, because several of these carry a word that would otherwise
  // put them in a real bucket - "overtime meal allowance" is a meal, not an
  // allowance, and "salary sacrifice" is not salary.
  { test: /reimburse|expense claim|out of pocket|mileage|km claim|meal money/, key: 'other', notIncome: true },
  { test: /salary sacrifice|sacrificed|novated|pre.?tax deduction/, key: 'other', notIncome: true },
  { test: /\bsuper(annuation)?\b|\bsgc\b|\bsg\b contribution|employer contribution/, key: 'other', notIncome: true },
  { test: /\bpayg\b|withhold|withheld|\btax\b|medicare levy/, key: 'other', notIncome: true },
  { test: /net pay|nett pay|take home|total deduction|union|child support|garnish/, key: 'other', notIncome: true },
  { test: /leave balance|accrued|entitlement balance|hours owing/, key: 'other', notIncome: true },
  { test: /overtime meal|meal allowance/, key: 'other', notIncome: true },

  // ─── PAID ONCE ──────────────────────────────────────────────────────────
  // Every one of these is a real payment that is real income. It simply must
  // not be spread across the days of the year and multiplied back out.
  { test: /annual leave (pay.?out|cash.?out|in lieu)|cash.?out|leave pay.?out/, key: 'bonus', oneOff: true },
  { test: /termination|redundanc|severance|in lieu of notice|\betp\b|lump sum [a-e]\b/, key: 'bonus', oneOff: true },
  { test: /back.?pay|arrears|retro(active)?( pay)?|underpayment|adjustment/, key: 'bonus', oneOff: true },
  { test: /sign.?on|retention|ex.?gratia|one.?off|gift|christmas/, key: 'bonus', oneOff: true },
  { test: /bonus|incentive payment/, key: 'bonus', oneOff: true },

  // ─── COMMISSION ─────────────────────────────────────────────────────────
  // Paid again and again, however lumpy. Annualised, and shaded.
  { test: /commission|\bcomms\b|sales incentive/, key: 'commission' },

  // ─── OVERTIME AND THE THINGS THAT BEHAVE LIKE IT ────────────────────────
  // Shift loading sits here on purpose. It is regular for a shift worker and
  // some lenders take it in full - which is exactly what the 100% column is
  // for. Putting it with allowances would take it in full in BOTH columns and
  // nobody would ever see the question.
  { test: /overtime|\bo\/?t\b|time and a half|double time|penalty|shift|afternoon rate|night rate|weekend rate|call.?out|on.?call|standby/, key: 'overtime' },

  // ─── ALLOWANCES ─────────────────────────────────────────────────────────
  // Contracted and paid every period. Not shaded, which is why a line only
  // belongs here when it really is paid every period.
  { test: /car allow|motor vehicle allow|\bmva\b|vehicle allow/, key: 'allowance' },
  { test: /tool|uniform|laundry|first aid|higher duties|site allow|industry allow|travel allow|living away|\blafha\b|district|remote|qualification|licence allow/, key: 'allowance' },
  { test: /allowance|\ballw\b/, key: 'allowance' },

  // ─── ORDINARY PAY ───────────────────────────────────────────────────────
  // Leave TAKEN is ordinary pay. It covers days that would otherwise have been
  // worked, and the year to date splits it into its own bucket - adding both is
  // right, dropping one understates by the length of their holiday.
  { test: /annual leave|personal leave|sick leave|carer|compassionate|long service|public holiday|\bphol\b/, key: 'base' },
  { test: /ordinary|base|salary|normal|\bnorm\b|standard hours|wage|regular|hourly|hours worked/, key: 'base' },
]

const GROSS = /^(gross|total gross|gross earnings|total earnings|total pay|gross pay)\b/

/** True where the label is a payslip TOTAL rather than a line of pay. */
export function isTotal(label: string): boolean {
  return GROSS.test(clean(label))
}

function clean(label: string): string {
  return String(label || '').toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * WHAT THIS LINE IS.
 *
 * An unknown label is 'other' and `recognised: false`. It is still annualised
 * and still shaded, because leaving it out would understate somebody on the
 * strength of their employer's naming - but it is marked, and the screen asks.
 */
export function classify(label: string): Seen {
  const s = clean(label)
  for (const r of RULES) {
    if (r.test.test(s)) {
      return {
        key: r.key,
        oneOff: Boolean(r.oneOff),
        notIncome: Boolean(r.notIncome),
        recognised: true,
      }
    }
  }
  return { key: 'other', oneOff: false, notIncome: false, recognised: false }
}
