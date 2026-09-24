// ANOTHER DEAL FOR THE SAME PEOPLE.
//
// 23 Sep 2026. Two deals sat side by side for the same clients:
//
//   Hameed Abdul Jabbar & Suleka Hameed Sadiq Equity 2026
//   Hameed Abdul Jabbar & Suleka Hameed Sadiq Land/Construction 2027
//
// The first 42 characters are identical. The part that tells them apart is the
// last thing you read, in the same size and weight as everything else. Forty
// minutes went on believing a credit officer's work had been wiped, when it was
// simply on the other one - and the only reason anybody could be sure was a
// database query.
//
// This does not try to be clever about names. Names in this book are typed by
// people and follow no convention - underscores, ampersands, years at the end,
// years in the middle. Anything that parsed them would be right most of the
// time, which is the worst way for a warning to behave.
//
// It matches on the client instead, which is a fact rather than a guess.

export type DealLike = {
  id: string
  deal_name?: string | null
  client_id?: string | null
  status?: string | null
  is_test?: boolean | null
  fact_find_data?: { applicants?: Array<{ clientId?: string | null }> } | null
}

// Every client id a deal touches: the one on the deal, and anybody named inside
// the fact find. A joint applicant is a client of this deal too, and matching
// only on deals.client_id would miss every second applicant.
export function clientIdsOn(deal: DealLike | null | undefined): string[] {
  const out = new Set<string>()
  const primary = String(deal?.client_id || '').trim()
  if (primary) out.add(primary)
  for (const a of (deal?.fact_find_data?.applicants || [])) {
    const id = String(a?.clientId || '').trim()
    if (id) out.add(id)
  }
  return [...out]
}

export function sharesAClient(a: DealLike, b: DealLike): boolean {
  const mine = clientIdsOn(a)
  if (mine.length === 0) return false
  const theirs = new Set(clientIdsOn(b))
  return mine.some(id => theirs.has(id))
}

// THE OTHER DEALS THESE PEOPLE HAVE.
//
// Test deals are never one of them. A deal that is finished still is: knowing
// the same clients settled something in March is worth as much as knowing they
// have another one open, and hiding it would make the warning lie by omission.
export function otherDealsForSameClients<T extends DealLike>(deal: T, all: T[] | null | undefined): T[] {
  return (all || []).filter(d =>
    d && d.id !== deal.id && !d.is_test && sharesAClient(deal, d))
}

// WHAT THE PART THAT DIFFERS ACTUALLY IS.
//
// Only ever used to EMPHASISE, never to decide anything. When two names share a
// long opening, the tail is the only thing a person needs to read - so the tail
// is what gets the weight. If they share nothing, the whole name is the tail and
// it reads exactly as it does today.
export function splitOnCommonStart(name: string, others: string[]): { shared: string; tail: string } {
  const full = String(name || '')
  const rest = (others || []).map(o => String(o || '')).filter(Boolean)
  if (rest.length === 0) return { shared: '', tail: full }

  let n = full.length
  for (const other of rest) {
    let i = 0
    while (i < n && i < other.length && full[i] === other[i]) i++
    n = Math.min(n, i)
  }
  // A handful of letters in common is a coincidence, not a shared name. Below
  // this the split would chop a name in a place that means nothing.
  const ENOUGH_TO_BE_THE_SAME_NAME = 12
  if (n < ENOUGH_TO_BE_THE_SAME_NAME) return { shared: '', tail: full }
  // Back up to a word boundary so the emphasis starts at a word, not mid-word.
  let cut = n
  while (cut > 0 && !/[\s_\-—–/]/.test(full[cut - 1])) cut--
  if (cut < ENOUGH_TO_BE_THE_SAME_NAME) return { shared: '', tail: full }
  const tail = full.slice(cut)
  if (!tail.trim()) return { shared: '', tail: full }
  return { shared: full.slice(0, cut), tail }
}

export function otherDealsLine(others: DealLike[]): string {
  if (others.length === 0) return ''
  if (others.length === 1) return 'These clients have another deal'
  return `These clients have ${others.length} other deals`
}


// FINDING A CLIENT INSIDE fact_find_data->applicants.
//
// 24 Sep 2026. Two screens wrote this filter by hand, and both wrote it wrong:
//
//     .contains('fact_find_data->applicants', [{ clientId: id }])
//
// supabase-js turns an ARRAY into a Postgres array literal - every element put
// through String() - so the query that actually went out was
//
//     fact_find_data->applicants=cs.{[object Object]}
//
// Postgres answered 400 every single time. It was written on 23 September and
// nothing noticed, because both callers swallow their errors on purpose: this
// only draws a helpful line beside a deal name, and it is not allowed to put an
// error in front of anybody. So it failed silently for a day, and a joint
// applicant's other deals simply never appeared.
//
// A jsonb column needs the value as JSON TEXT, not as an array. One function
// now, used by both, with a test that builds the real query and reads the URL.
export function applicantIsClient(clientId: string): string {
  return JSON.stringify([{ clientId }])
}
