// Australian resident income tax, and the reverse: what gross salary has to be
// earned to leave a given amount in the bank.
//
// This exists because a bank statement shows net pay and a fact find shows gross.
// Comparing them means running the rate scale backwards. The result NEVER becomes
// the client's income - it only ever raises a flag for a person to answer.
//
// Two rules this file keeps:
//   1. The financial year comes from the statement dates, not from today. A
//      statement period from May to August crosses 1 July and the scales differ.
//   2. Where a threshold for a future year is not yet published, the last
//      published one is carried forward AND a caveat is returned saying so.
//      A silently stale threshold is how a wrong number looks right.

export type Bracket = { from: number; to: number | null; rate: number }

export type FyScale = {
  fy: string
  label: string
  brackets: Bracket[]
  // Medicare levy, single with no dependants. Below the threshold nothing is
  // payable; between threshold and shadeTo it phases in at 10c in the dollar.
  medicareThreshold: number
  medicareShadeTo: number
  medicareRate: number
  // Whether the levy thresholds for this year are published or carried forward.
  medicareConfirmed: boolean
  lito: { max: number; taper1From: number; taper1Rate: number; taper2From: number; taper2Rate: number }
}

// Legislated stage cuts: the first taxable bracket steps down 16 -> 15 -> 14
// on 1 July 2026 and 1 July 2027. Thresholds are unchanged across all of them.
function scale(fy: string, firstRate: number, medicareConfirmed: boolean): FyScale {
  const [a, b] = fy.split('-')
  return {
    fy,
    label: `FY ${a}–${b}`,
    brackets: [
      { from: 0, to: 18200, rate: 0 },
      { from: 18200, to: 45000, rate: firstRate },
      { from: 45000, to: 135000, rate: 0.30 },
      { from: 135000, to: 190000, rate: 0.37 },
      { from: 190000, to: null, rate: 0.45 },
    ],
    medicareThreshold: 27222,
    medicareShadeTo: 34027,
    medicareRate: 0.02,
    medicareConfirmed,
    lito: { max: 700, taper1From: 37500, taper1Rate: 0.05, taper2From: 45000, taper2Rate: 0.015 },
  }
}

const SCALES: Record<string, FyScale> = {
  '2023-24': scale('2023-24', 0.19, true),
  '2024-25': scale('2024-25', 0.16, true),
  '2025-26': scale('2025-26', 0.16, false),
  '2026-27': scale('2026-27', 0.15, false),
  '2027-28': scale('2027-28', 0.14, false),
}
const EARLIEST = '2023-24'
const LATEST = '2027-28'

// 1 July to 30 June. July 2026 is FY 2026-27.
export function fyForDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  const y = dt.getUTCFullYear()
  const m = dt.getUTCMonth() // 0 = January
  const startYear = m >= 6 ? y : y - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

export function scaleForFy(fy: string): { scale: FyScale; caveats: string[] } {
  const caveats: string[] = []
  let use = fy
  if (!SCALES[use]) {
    use = fy < EARLIEST ? EARLIEST : LATEST
    caveats.push(`No published rate scale for FY ${fy}; the ${SCALES[use].label} scale was used instead.`)
  }
  return { scale: SCALES[use], caveats }
}

// Every financial year the period touches, oldest first.
export function fysInPeriod(from: Date | string, to: Date | string): string[] {
  const a = typeof from === 'string' ? new Date(from) : from
  const b = typeof to === 'string' ? new Date(to) : to
  const out: string[] = []
  const cur = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1))
  const end = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1))
  while (cur <= end) {
    const fy = fyForDate(cur)
    if (!out.includes(fy)) out.push(fy)
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return out.length ? out : [fyForDate(a)]
}

// The financial year that covers most of the period. Used for the headline
// figure when a period straddles 1 July; the other year is still reported.
export function dominantFy(from: Date | string, to: Date | string): string {
  const a = typeof from === 'string' ? new Date(from) : from
  const b = typeof to === 'string' ? new Date(to) : to
  const days: Record<string, number> = {}
  const cur = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
  while (cur <= b) {
    const fy = fyForDate(cur)
    days[fy] = (days[fy] || 0) + 1
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return Object.keys(days).sort((x, y) => days[y] - days[x])[0] || fyForDate(a)
}

export type TaxLine = { label: string; rate: string; amount: number }

export function incomeTax(gross: number, s: FyScale): { tax: number; lines: TaxLine[] } {
  const lines: TaxLine[] = []
  let tax = 0
  for (const b of s.brackets) {
    const top = b.to === null ? Infinity : b.to
    if (gross <= b.from) break
    const slice = Math.min(gross, top) - b.from
    const amount = slice * b.rate
    tax += amount
    lines.push({
      label: b.to === null
        ? `$${b.from.toLocaleString('en-AU')} and above`
        : `$${(b.from === 0 ? 0 : b.from + 1).toLocaleString('en-AU')} – $${top.toLocaleString('en-AU')}`,
      rate: b.rate === 0 ? 'nil' : `${(b.rate * 100).toFixed(0)}%`,
      amount,
    })
  }
  return { tax, lines }
}

export function medicareLevy(gross: number, s: FyScale): number {
  if (gross <= s.medicareThreshold) return 0
  if (gross >= s.medicareShadeTo) return gross * s.medicareRate
  return (gross - s.medicareThreshold) * 0.10
}

export function lowIncomeOffset(gross: number, s: FyScale): number {
  const { max, taper1From, taper1Rate, taper2From, taper2Rate } = s.lito
  if (gross <= taper1From) return max
  const afterFirst = max - (Math.min(gross, taper2From) - taper1From) * taper1Rate
  if (gross <= taper2From) return Math.max(0, afterFirst)
  return Math.max(0, afterFirst - (gross - taper2From) * taper2Rate)
}

// The offset reduces tax payable but never below zero, and never refunds the levy.
export function netFromGross(gross: number, s: FyScale): number {
  if (gross <= 0) return 0
  const { tax } = incomeTax(gross, s)
  const payable = Math.max(0, tax - lowIncomeOffset(gross, s))
  return gross - payable - medicareLevy(gross, s)
}

export type GrossUp = {
  gross: number
  net: number
  incomeTax: number
  offset: number
  medicare: number
  lines: TaxLine[]
  scale: FyScale
  caveats: string[]
}

// Net to gross. Net rises strictly with gross across the whole scale, so a
// bisection always converges; there is no closed form once the offset shades in.
export function grossFromNet(net: number, fy: string): GrossUp {
  const { scale: s, caveats } = scaleForFy(fy)
  const out = (gross: number): GrossUp => {
    const { tax, lines } = incomeTax(gross, s)
    const offset = Math.min(lowIncomeOffset(gross, s), tax)
    const medicare = medicareLevy(gross, s)
    const cav = [...caveats]
    if (!s.medicareConfirmed && gross < 50000) {
      cav.push(`The Medicare levy thresholds for ${s.label} were not published when this was written, so the last published ones were used. They only affect incomes under about $34,000.`)
    }
    return { gross, net: gross - (tax - offset) - medicare, incomeTax: tax, offset, medicare, lines, scale: s, caveats: cav }
  }
  if (!(net > 0)) return out(0)

  let lo = 0, hi = Math.max(net * 3, 100000)
  while (netFromGross(hi, s) < net && hi < 1e9) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (netFromGross(mid, s) < net) lo = mid; else hi = mid
  }
  return out(Math.round((lo + hi) / 2))
}
