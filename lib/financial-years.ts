// THE FINANCIAL YEARS A SELF EMPLOYED CLIENT CAN HAVE RETURNS FOR.
//
// 10 Nov 2026. Fabio: "on self employed section add 25/26 how can I add in
// future without coming here."
//
// They were four <option> tags typed into FactFindForm.tsx - 2021/22 through
// 2024/25 - so every 1 July the newest financial year quietly stopped existing
// until somebody noticed and shipped. By November 2026 the form could not be
// told about a return that had been lodgeable for months.
//
// A DATE IS NOT A SETTING. There is nothing to configure here and nothing for
// anybody to remember: a financial year ends on 30 June, and the list is worked
// out from today. On 1 July 2027 the form offers 2026/27 on its own.
//
// AND WHAT IS ALREADY ON THE RECORD STAYS ON THE LIST. A deal from 2022 holding
// 2019/20 would otherwise show an empty box - the select has no option matching
// what is stored - and look like nobody answered. Worse, saving the form would
// then make that true.

/** 2026 -> "2025/26". The year a financial year ENDS in names it. */
export function fyLabel(endYear: number): string {
  return `${endYear - 1}/${String(endYear % 100).padStart(2, '0')}`
}

/**
 * The year the most recently finished financial year ended in.
 *
 * Local time, deliberately: a broker in Sydney on the morning of 1 July is in
 * the new year, and working it out in UTC would tell them otherwise for the
 * first ten hours of it.
 */
export function lastEndedFY(now: Date = new Date()): number {
  // getMonth() is zero based, so 6 is July.
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
}

const LOOKS_LIKE_A_FY = /^\d{4}\/\d{2}$/

/**
 * The list the two self employed boxes offer, oldest first.
 *
 * `include` is whatever those boxes already hold, so an older answer is never
 * dropped off the end of the window and never blanks the box.
 */
export function financialYears(
  now: Date = new Date(), howMany = 5, include: any[] = [],
): string[] {
  const end = lastEndedFY(now)
  const out = new Set<string>()
  for (let i = howMany - 1; i >= 0; i--) out.add(fyLabel(end - i))
  for (const v of include) {
    const t = String(v ?? '').trim()
    if (LOOKS_LIKE_A_FY.test(t)) out.add(t)
  }
  // "2021/22" < "2022/23" as text, so this is chronological without parsing.
  return [...out].sort()
}

/**
 * "2023/24" -> "2024/25". The year after.
 *
 * Year 1 on the fact find is the OLDER of the two and year 2 the newer, so
 * choosing year 1 fills year 2 in. Anything that is not a financial year comes
 * back untouched rather than becoming "NaN/aN".
 */
export function nextFY(fy: string): string {
  const match = String(fy ?? '').match(/^(\d{4})\/(\d{2})$/)
  if (!match) return fy
  const startYear = parseInt(match[1], 10) + 1
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}
