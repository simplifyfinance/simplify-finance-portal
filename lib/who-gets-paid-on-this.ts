// WHOSE DEAL IS THIS, FOR THE PURPOSE OF WRITING TO SOMEBODY ABOUT IT.
//
// 12 Nov 2026. Fabio, on four commission splits with overlapping names:
//
//   "when we're doing the lodge and settle and we're sending that
//    communication to Navigate, you need to find all the deals that has
//    Simplify Navigate Advisory as a commission, and also the Navigate
//    Advisory's commissions... Now remember, Justin, when we're communicating
//    to Justin... do not ever send the one that is marked Simplify Navigate
//    Advisors. As you can see on the commissions tab, he doesn't get paid."
//
// THE FOUR SPLITS, as they stand:
//
//   Navigate Advisors                          Justin 60/40, SFB 20/20, Navigate 20/40
//   Simplify - Justin Cornock referral         Justin 50/50, Simplify 50/50
//   Simplify - Navigate Advisors               Navigate 20/50, Simplify 80/50
//   Simplify Finance Brokers - Justin Cornock  SFB 20/20, Justin 80/80
//
// Three of those pay Justin. One does not, and its NAME is the most
// Justin-looking of the lot - it is the Navigate arrangement where Simplify
// writes the deal and Navigate is the referrer. Send him that one and we have
// told a broker he earned something he did not.
//
// SO THE RULE IS NOT THE NAME. IT IS THE PAYMENT LINES.
//
// A split is somebody's when they are named in its lines with a share. That is
// a fact already recorded on the split, it is what the commissions tab shows,
// and it keeps working when a split is renamed or a fifth one is added - which
// is exactly how this went wrong in the first place.
//
// IT ANSWERS BOTH QUESTIONS WITH ONE RULE. Writing to Navigate asks which
// splits pay Navigate Advisors, and picks up two. Writing to Justin asks which
// pay Justin Cornock, and picks up three. Nobody has to remember the anomaly,
// because there is no anomaly left - there is just who is paid.

const txt = (v: any) => String(v ?? '').trim()
const fold = (v: any) => txt(v).toLowerCase().replace(/\s+/g, ' ')

export type SplitLine = { who?: any; upfront?: any; trail?: any }

/** The payment lines on a split, whatever shape the row arrived in. */
export function linesOf(split: any): SplitLine[] {
  const raw = split?.lines
  if (Array.isArray(raw)) return raw.filter(Boolean)
  // THE OLD ONE-PARTY SHAPE. A split written before three-way splits existed
  // carries `who` on the row itself - see lib/who-shares-this-deal.ts.
  const who = txt(split?.who)
  return who ? [{ who, upfront: split?.upfront, trail: split?.trail }] : []
}

/** A share of nothing is not a share. 0% upfront and 0% trail is not payment. */
function paid(line: SplitLine): boolean {
  const up = Number(line?.upfront)
  const tr = Number(line?.trail)
  const hasUp = Number.isFinite(up) && up > 0
  const hasTr = Number.isFinite(tr) && tr > 0
  // A LINE WITH NO PERCENTAGES AT ALL IS STILL A PARTY TO THE SPLIT. Null
  // means nobody wrote the number down, which is different from zero - see the
  // note on percentages in lib/who-shares-this-deal.ts. Being named is enough.
  const blank = !txt(line?.upfront) && !txt(line?.trail)
  return hasUp || hasTr || blank
}

/**
 * IS THIS SPLIT THEIRS?
 *
 * Matched on the name as written on the line, ignoring case and extra spaces.
 * Nothing clever: a party is whoever the line says it is, and a near-miss
 * should be fixed on the split rather than guessed at here.
 */
export function paysThem(split: any, who: any): boolean {
  const want = fold(who)
  if (!want) return false
  return linesOf(split).some(l => fold(l?.who) === want && paid(l))
}

/** Their share, or null where the split is not theirs. */
export function shareOf(split: any, who: any): { upfront: number | null; trail: number | null } | null {
  const want = fold(who)
  if (!want) return null
  const line = linesOf(split).find(l => fold(l?.who) === want)
  if (!line || !paid(line)) return null
  const n = (v: any) => (txt(v) && Number.isFinite(Number(v)) ? Number(v) : null)
  return { upfront: n(line.upfront), trail: n(line.trail) }
}

/** Every split that pays them, in the order they were given. */
export function splitsThatPay(splits: any[], who: any): any[] {
  return (splits || []).filter(s => paysThem(s, who))
}

/** The ids, for matching deals that carry a split id. */
export function splitIdsThatPay(splits: any[], who: any): string[] {
  return splitsThatPay(splits, who).map(s => txt(s?.id)).filter(Boolean)
}

/**
 * EVERY PARTY NAMED ON A SPLIT, so a screen can offer them rather than
 * somebody typing a name that almost matches.
 */
export function partiesOf(splits: any[]): string[] {
  const seen = new Map<string, string>()
  for (const s of splits || []) {
    for (const l of linesOf(s)) {
      const name = txt(l?.who)
      if (name && !seen.has(fold(name))) seen.set(fold(name), name)
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/**
 * THE DEALS TO WRITE TO SOMEBODY ABOUT.
 *
 * `splitOf` says which split a deal carries - the caller knows whether that
 * lives on an id or a name, and this does not need to.
 */
export function dealsFor(
  deals: any[], splits: any[], who: any, splitOf: (deal: any) => any,
): any[] {
  const mine = new Set(splitIdsThatPay(splits, who))
  const byName = new Set(splitsThatPay(splits, who).map(s => fold(s?.name)))
  if (!mine.size && !byName.size) return []
  return (deals || []).filter(d => {
    const on = splitOf(d)
    const id = txt(on?.id ?? on)
    return (id && mine.has(id)) || byName.has(fold(on?.name ?? on))
  })
}
