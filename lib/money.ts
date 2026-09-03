// Reading money the forms actually store.
//
// The deal summary printed "Purchase price: 0" on a deal whose BC clearly said
// $5,250,000, and Fabio quite reasonably concluded the fact find was empty. It
// was not. The forms store money as FORMATTED STRINGS - "5,250,000" - and the
// PDF did this:
//
//   const n = Number(v)
//   if (!v || isNaN(n)) return '0'
//
// Number("5,250,000") is NaN, so it returned '0'. Fourteen call sites, every one
// fed a comma-formatted string: purchase price, deposit, property values, loan
// balances, every liability limit and repayment, salaries, fees. A document
// reporting most of the money on a file as zero.
//
// Four lines above it, the LVR calculation stripped the commas correctly.

// The number, or null when there is genuinely nothing there.
//
// Zero is a value, not an absence: a credit card sitting at $0 is a fact worth
// printing. Only an empty or unreadable field comes back null.
export function readMoney(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const cleaned = String(v).replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// "$5,250,000". Cents are kept only when they are there - $1,279,283.98 matters
// on a payout figure and ".00" on everything else is noise.
export function money(v: any): string {
  const n = readMoney(v)
  if (n === null) return ''
  const hasCents = Math.round(n * 100) % 100 !== 0
  return '$' + n.toLocaleString('en-AU', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

// What to print when a field is empty.
//
// "0" is a claim - it says the client has nothing. "not recorded" is the truth,
// and it is the difference between a lender reading a client with no assets and
// a lender reading a form somebody has not finished.
export function moneyOrBlank(v: any, blank = 'not recorded'): string {
  return money(v) || blank
}

export function sumMoney(values: any[]): number {
  return (values || []).reduce<number>((t, v) => t + (readMoney(v) ?? 0), 0)
}

// Per-frequency amounts, said once a year.
const PER_YEAR: Record<string, number> = {
  weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1, yearly: 1, annual: 1,
}
export function annualise(amount: any, frequency: any): number | null {
  const n = readMoney(amount)
  if (n === null) return null
  const mult = PER_YEAR[String(frequency || 'annually').trim().toLowerCase()]
  return mult === undefined ? n : n * mult
}

// "$780 weekly", or nothing at all when there is no amount.
export function withFrequency(amount: any, frequency: any): string {
  const m = money(amount)
  if (!m) return ''
  const f = String(frequency || '').trim()
  return f ? `${m} ${f.toLowerCase()}` : m
}

// FORMATTING AS SOMEBODY TYPES.
//
// Different from money() above: this runs on every keystroke inside a
// NumberInput, so it has to cope with a half-typed number - "5,2", "1234." -
// and hand back exactly what should now be in the box, with no dollar sign.
//
// It was written out twice, character for character, in BCForm and LOForm. That
// is the shape of fault that kept the money bugs alive: a fix to one copy is not
// a fix, and nothing said the second one existed. See lib/no-duplicate-logic.test.ts.
export function formatAsTyped(val: string): string {
  let cleaned = String(val ?? '').replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  const [intPart, decPart] = cleaned.split('.')
  if (!intPart && decPart === undefined) return ''
  const formattedInt = (parseInt(intPart || '0', 10) || 0).toLocaleString('en-AU')
  return decPart !== undefined ? formattedInt + '.' + decPart.slice(0, 2) : formattedInt
}

// "$1.35m", "$450k" - for a dashboard tile where the exact dollar does not
// matter and the width does. Also had two copies.
export function compactMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  const a = Math.abs(n)
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm'
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'k'
  return '$' + Math.round(n)
}

// Digits only, for a field where a person types a target or an actual. Null when
// they have typed nothing, so an empty box stays empty rather than becoming 0.
export function digitsOnly(s: any): number | null {
  const d = String(s ?? '').replace(/[^0-9]/g, '')
  if (d === '') return null
  const n = Number(d)
  return Number.isNaN(n) ? null : n
}
