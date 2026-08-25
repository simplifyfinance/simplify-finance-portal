// When a statement actually exists, and how far back the commission history goes.
//
// SFG pays on a fixed cycle: upfront on the 26th of the month after the one it
// covers, trail on the 16th two months after. So on 25 August, June's trail has
// arrived and July's has not — and asking for a statement that has not been
// issued is noise, not a reminder.

export const COMMISSION_START = '2025-07'   // nothing before this counts

const DUE = {
  upfront: { lagMonths: 1, day: 26 },
  trail:   { lagMonths: 2, day: 16 },
} as const

export type StatementKind = keyof typeof DUE

export function stepMonth(monthKey: string, by: number): string {
  let y = Number(monthKey.slice(0, 4)), m = Number(monthKey.slice(5, 7)) + by
  while (m > 12) { m -= 12; y += 1 }
  while (m < 1) { m += 12; y -= 1 }
  return `${y}-${String(m).padStart(2, '0')}`
}

// The date the statement for `monthKey` is paid, as YYYY-MM-DD.
export function issuedOn(kind: StatementKind, monthKey: string): string {
  const { lagMonths, day } = DUE[kind]
  return `${stepMonth(monthKey, lagMonths)}-${String(day).padStart(2, '0')}`
}

export function isIssued(kind: StatementKind, monthKey: string, todayYmd: string): boolean {
  return todayYmd >= issuedOn(kind, monthKey)
}

// Every month from the start through the last one whose statement has been paid.
export function expectedMonths(kind: StatementKind, from: string, todayYmd: string): string[] {
  const start = from > COMMISSION_START ? from : COMMISSION_START
  const out: string[] = []
  for (let m = start; ; m = stepMonth(m, 1)) {
    if (!isIssued(kind, m, todayYmd)) break
    out.push(m)
    if (out.length > 240) break            // a decade is plenty
  }
  return out
}
